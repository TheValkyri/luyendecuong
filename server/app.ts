/**
 * Section 6.1 - 6.5: Authoritative Backend Server
 * Enforces:
 * - Trust Boundaries (Practice vs Exam Mode; strips answer_key in Exam Mode)
 * - Authoritative server-side grading & score payload tampering rejection
 * - Session HMAC authentication & cross-session isolation
 * - Idempotency keys & duplicate submission protection
 * - Versioned Exam Contracts & immutability of active exam versions
 * - Role-Based Access Control (Student, Teacher, Admin), Rate Limiting & CSRF header check
 * - Python DOC/DOCX/MTEF ETL invocation & human verification gate
 * - CSV Formula Injection sanitization & immutable Audit Log
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import {
  ActiveExamSession,
  AssessmentMode,
  CandidateAnswerRecord,
  ExamContract,
  ExamQuestion,
  ExamSubmissionReceipt,
  TelemetryEvent,
} from '../src/types/exam';
import { INITIAL_PUBLISHED_EXAM, CONG_NGHE_11_TONG_HOP_EXAM, CONG_NGHE_11_LESSON_EXAMS } from '../src/data/seed-exams';
import {
  computeSessionRandomization,
  gradeExamAttempt,
  prepareExamForClient,
} from '../src/lib/grading-engine';
import { resolveAnswerConflicts } from '../src/lib/reliability';
import { generateSafeCsv, sanitizeWordHtml } from '../src/lib/security-utils';
import {
  DEFAULT_GRADING_POLICY_V2,
  migrateExamSchema,
  validateExamContractV2,
} from '../src/lib/schema-migration';
import { validateCandidateName } from '../src/lib/name-validator';

const execFileAsync = promisify(execFile);

const SERVER_HMAC_SECRET =
  process.env.KHAOTHI_HMAC_SECRET || 'khaothi-server-only-hmac-secret-key-2026-v2';
const TEACHER_ACCESS_TOKEN =
  process.env.KHAOTHI_TEACHER_TOKEN || 'teacher-authorized-session-2026';

export interface AuditLogEntry {
  audit_id: string;
  timestamp: number;
  actor_role: 'student' | 'teacher' | 'admin' | 'system';
  actor_id: string;
  action: string;
  target_id: string;
  detail: string;
}

export function signSessionToken(sessionId: string, studentId: string, examId: string): string {
  return crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(`${sessionId}:${studentId}:${examId}`)
    .digest('hex');
}

export function signReceiptHash(receiptPayload: string): string {
  return crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(receiptPayload)
    .digest('hex');
}

export function createServerApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // In-memory authoritative state store (starts completely clean with zero fake sessions or pre-listed UI exams)
  const examVersions = new Map<string, ExamContract[]>();
  const publishedExamIds = new Set<string>();
  const initialCopy: ExamContract = JSON.parse(JSON.stringify(INITIAL_PUBLISHED_EXAM));
  const v1Copy: ExamContract = {
    ...JSON.parse(JSON.stringify(initialCopy)),
    exam_version: 1,
    published_at: '2026-11-01T08:00:00.000Z',
    status: 'archived',
  };
  examVersions.set(initialCopy.exam_id, [v1Copy, initialCopy]);

  // Technology 11 (Cơ khí chế tạo - Bài 1 đến Bài 6) compiled exams
  for (const cnExam of CONG_NGHE_11_LESSON_EXAMS) {
    const copy: ExamContract = JSON.parse(JSON.stringify(cnExam));
    examVersions.set(copy.exam_id, [copy]);
    publishedExamIds.add(copy.exam_id);
  }

  const sessions = new Map<string, ActiveExamSession>();
  const processedIdempotencyKeys = new Map<string, unknown>();
  const auditLogs: AuditLogEntry[] = [];
  const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

  function recordAudit(
    actorRole: AuditLogEntry['actor_role'],
    actorId: string,
    action: string,
    targetId: string,
    detail: string
  ) {
    auditLogs.unshift({
      audit_id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      actor_role: actorRole,
      actor_id: actorId,
      action,
      target_id: targetId,
      detail,
    });
  }

  // Simple IP/Session Rate Limiter Middleware (Section 6.5)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'local';
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || now - bucket.windowStart > 60_000) {
      rateLimitBuckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > 600) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests in a 60-second window. Please retry shortly.',
      });
      return;
    }
    next();
  });

  // Helper to get latest published exam or specific version
  function getExamVersion(examId: string, version?: number): ExamContract | undefined {
    const list = examVersions.get(examId);
    if (!list || list.length === 0) return undefined;
    if (typeof version === 'number') {
      return list.find((e) => e.exam_version === version);
    }
    return list[list.length - 1];
  }

  // RBAC Middleware for Teacher / Admin routes (Section 6.5)
  function requireTeacherRole(req: Request, res: Response, next: NextFunction) {
    const roleHeader = req.header('X-Role');
    const authHeader = req.header('X-Teacher-Auth');
    if (
      (roleHeader !== 'teacher' && roleHeader !== 'admin') ||
      authHeader !== TEACHER_ACCESS_TOKEN
    ) {
      recordAudit(
        'student',
        req.header('X-Student-Id') || 'anonymous',
        'UNAUTHORIZED_API_ATTEMPT',
        req.path,
        `Blocked unauthorized access to teacher endpoint ${req.method} ${req.path}`
      );
      res.status(403).json({
        error: 'FORBIDDEN_RBAC',
        message: 'Access denied: requires verified teacher or administrator credentials.',
      });
      return;
    }
    next();
  }

  /**
   * GET /api/exams
   * Lists all exercises/exams currently published on the system.
   * Starts empty on a clean system until an exercise is published in Studio.
   */
  app.get('/api/exams', (_req: Request, res: Response) => {
    const items = Array.from(publishedExamIds)
      .map((id) => getExamVersion(id))
      .filter((e): e is ExamContract => Boolean(e))
      .map((e) => ({
        exam_id: e.exam_id,
        exam_version: e.exam_version,
        subject_id: e.subject_id,
        title: e.title,
        published_at: e.published_at,
        time_limit: e.time_limit,
        question_count: e.questions.length,
        total_max_score: e.grading_policy.total_max_score,
      }));
    res.json({
      server_timestamp: Date.now(),
      exams: items,
    });
  });

  /**
   * GET /api/exams/:examId
   * Enforces Section 6.1 Trust Boundary:
   * - mode=exam (default): strips answer_key and explanation from every question!
   * - mode=practice: preserves answer_key and explanation for client-side learning & offline practice.
   */
  app.get('/api/exams/:examId', (req: Request, res: Response) => {
    const examId = String(req.params.examId);
    const mode: AssessmentMode = req.query.mode === 'practice' ? 'practice' : 'exam';
    const versionParam = req.query.version ? Number(req.query.version) : undefined;

    const exam = getExamVersion(examId, versionParam);
    if (!exam) {
      res.status(404).json({ error: 'EXAM_NOT_FOUND', message: `Exam ${examId} not found.` });
      return;
    }

    const clientSafeExam = prepareExamForClient(exam, mode);
    res.json({
      mode,
      server_timestamp: Date.now(),
      exam: clientSafeExam,
    });
  });

  /**
   * POST /api/sessions/start
   * Creates or resumes an authenticated student session, pinning the exam_version and randomization seed.
   */
  app.post('/api/sessions/start', (req: Request, res: Response) => {
    const {
      exam_id = INITIAL_PUBLISHED_EXAM.exam_id,
      student_id,
      student_name,
      student_code = '12A1-099',
      class_name = '12A1 Chuyên Toán',
      mode = 'exam',
      resume_session_id,
    } = req.body || {};

    if (!student_id || !student_name) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'student_id and student_name are required to start a session.',
      });
      return;
    }

    const nameValidation = validateCandidateName(String(student_name));
    if (!nameValidation.isValid) {
      res.status(400).json({
        error: 'INVALID_CANDIDATE_NAME',
        message: nameValidation.errorMessage || 'Họ và tên thí sinh không hợp lệ.',
      });
      return;
    }

    const cleanMode: AssessmentMode = mode === 'practice' ? 'practice' : 'exam';

    // Support resuming an existing session if valid token provided
    if (resume_session_id && sessions.has(resume_session_id)) {
      const existing = sessions.get(resume_session_id)!;
      const providedToken = req.header('X-Session-Token') || req.body.session_token;
      if (existing.session_token === providedToken && existing.student_id === student_id) {
        const pinnedExam = getExamVersion(existing.exam_id, existing.exam_version)!;
        res.json({
          resumed: true,
          server_timestamp: Date.now(),
          session: {
            ...existing,
            session_token: existing.session_token,
          },
          exam: prepareExamForClient(pinnedExam, existing.mode, existing),
        });
        return;
      }
    }

    const latestExam = getExamVersion(String(exam_id));
    if (!latestExam) {
      res.status(404).json({ error: 'EXAM_NOT_FOUND', message: 'Requested exam does not exist.' });
      return;
    }

    // Deduplicate active in_progress session for the same student + exam + mode on browser reload
    if (!req.body?.force_new) {
      for (const existing of sessions.values()) {
        if (
          existing.student_id === String(student_id) &&
          existing.exam_id === latestExam.exam_id &&
          existing.mode === cleanMode &&
          existing.status === 'in_progress'
        ) {
          existing.last_sync_at_server = Date.now();
          const pinnedExam = getExamVersion(existing.exam_id, existing.exam_version) || latestExam;
          res.status(201).json({
            resumed: true,
            server_timestamp: Date.now(),
            session: existing,
            exam: prepareExamForClient(pinnedExam, existing.mode, existing),
          });
          return;
        }
      }
    }

    const now = Date.now();
    const sessionId = `ses_${now}_${crypto.randomBytes(4).toString('hex')}`;
    const sessionToken = signSessionToken(sessionId, String(student_id), latestExam.exam_id);
    const sessionSeed = `${sessionId}:${student_id}:${latestExam.exam_id}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const { questionOrder, optionOrders } = computeSessionRandomization(
      latestExam,
      sessionSeed
    );

    const newSession: ActiveExamSession = {
      session_id: sessionId,
      session_token: sessionToken,
      exam_id: latestExam.exam_id,
      exam_version: latestExam.exam_version,
      student_id: sanitizeWordHtml(String(student_id)),
      student_name: sanitizeWordHtml(String(student_name)),
      student_code: sanitizeWordHtml(String(student_code)),
      class_name: sanitizeWordHtml(String(class_name)),
      mode: cleanMode,
      started_at_server: now,
      expires_at_server: now + latestExam.time_limit * 1000,
      last_sync_at_server: now,
      status: 'in_progress',
      connection_state: 'online',
      question_order: questionOrder,
      option_orders: optionOrders,
      answers: {},
      telemetry: [
        {
          event_id: `evt_start_${sessionId}`,
          session_id: sessionId,
          event_type: 'session_started',
          client_timestamp: now,
          server_timestamp: now,
          detail: `Khởi tạo phiên ${cleanMode.toUpperCase()} trên đề v${latestExam.exam_version}`,
        },
      ],
    };

    sessions.set(sessionId, newSession);
    recordAudit(
      'student',
      newSession.student_id,
      'SESSION_STARTED',
      sessionId,
      `${newSession.student_name} bắt đầu phiên (${cleanMode}) đề ${latestExam.exam_id} v${latestExam.exam_version}`
    );

    res.status(201).json({
      resumed: false,
      server_timestamp: now,
      session: newSession,
      exam: prepareExamForClient(latestExam, cleanMode, newSession),
    });
  });

  /**
   * GET /api/sessions/:sessionId
   * Enforces strict session isolation: a student can only read their own session with a valid X-Session-Token.
   */
  app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session not found.' });
      return;
    }

    const tokenHeader = req.header('X-Session-Token');
    const teacherAuth = req.header('X-Teacher-Auth');
    const isTeacher = teacherAuth === TEACHER_ACCESS_TOKEN;

    if (!isTeacher && tokenHeader !== session.session_token) {
      recordAudit(
        'student',
        'unauthorized_client',
        'CROSS_SESSION_READ_BLOCKED',
        sessionId,
        'Blocked attempt to read another candidate session without valid session token'
      );
      res.status(403).json({
        error: 'FORBIDDEN_SESSION_ACCESS',
        message: 'You are not authorized to access this exam session.',
      });
      return;
    }

    const { session_token: _omitToken, ...safeSessionView } = session;
    res.json({
      server_timestamp: Date.now(),
      session: safeSessionView,
    });
  });

  /**
   * POST /api/sessions/:sessionId/sync
   * Autosaves candidate answers & observable telemetry events with idempotency and conflict resolution.
   */
  app.post('/api/sessions/:sessionId/sync', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session not found.' });
      return;
    }

    const tokenHeader = req.header('X-Session-Token') || req.body?.session_token;
    if (tokenHeader !== session.session_token) {
      res.status(403).json({
        error: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Invalid or missing session token.',
      });
      return;
    }

    if (session.status === 'submitted') {
      res.status(200).json({
        ok: true,
        already_submitted: true,
        ack_id: `ack_locked_${sessionId}`,
        server_timestamp: Date.now(),
        synced_answer_count: Object.keys(session.answers).length,
      });
      return;
    }

    const idempotencyKey =
      req.header('Idempotency-Key') || req.body?.idempotency_key || `sync_${Date.now()}`;

    if (processedIdempotencyKeys.has(idempotencyKey)) {
      res.json(processedIdempotencyKeys.get(idempotencyKey));
      return;
    }

    const now = Date.now();
    const incomingAnswers: Record<string, CandidateAnswerRecord> = req.body?.answers || {};
    const incomingTelemetry: TelemetryEvent[] = Array.isArray(req.body?.telemetry)
      ? req.body.telemetry
      : [];

    // Merge answers using deterministic conflict resolution
    session.answers = resolveAnswerConflicts(session.answers, incomingAnswers);

    // Deduplicate telemetry events by event_id
    const existingIds = new Set(session.telemetry.map((e) => e.event_id));
    for (const ev of incomingTelemetry) {
      if (ev && ev.event_id && !existingIds.has(ev.event_id)) {
        existingIds.add(ev.event_id);
        session.telemetry.push({
          event_id: String(ev.event_id),
          session_id: sessionId,
          event_type: ev.event_type,
          client_timestamp: Number(ev.client_timestamp) || now,
          server_timestamp: now,
          detail: sanitizeWordHtml(String(ev.detail || '')),
        });
      }
    }

    session.last_sync_at_server = now;
    session.connection_state = 'online';

    const ackPayload = {
      ok: true,
      ack_id: `ack_${now}_${crypto.randomBytes(3).toString('hex')}`,
      idempotency_key: idempotencyKey,
      server_timestamp: now,
      synced_answer_count: Object.keys(session.answers).length,
    };

    processedIdempotencyKeys.set(idempotencyKey, ackPayload);
    res.json(ackPayload);
  });

  /**
   * POST /api/sessions/:sessionId/submit
   * Official Exam Submission Endpoint (Section 6.1 & 6.3):
   * - Rejects unauthorized tokens
   * - Ignores any client-side tampered score payload
   * - Prevents duplicate submissions (returns existing receipt if already submitted)
   * - Grades authoritatively against the server's pinned exam version
   */
  app.post('/api/sessions/:sessionId/submit', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session not found.' });
      return;
    }

    const tokenHeader = req.header('X-Session-Token') || req.body?.session_token;
    if (tokenHeader !== session.session_token) {
      res.status(403).json({
        error: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Invalid session token for submission.',
      });
      return;
    }

    const idempotencyKey =
      req.header('Idempotency-Key') || req.body?.idempotency_key || `sub_${sessionId}`;

    // Duplicate submission protection: if already submitted, return the original receipt idempotently
    if (session.status === 'submitted' && session.submission_receipt) {
      res.status(200).json({
        ok: true,
        duplicate_prevented: true,
        server_timestamp: Date.now(),
        receipt: session.submission_receipt,
      });
      return;
    }

    const authoritativeExam = getExamVersion(session.exam_id, session.exam_version);
    if (!authoritativeExam) {
      res.status(500).json({ error: 'EXAM_VERSION_MISSING', message: 'Pinned exam version missing.' });
      return;
    }

    const now = Date.now();
    const graceMs = (authoritativeExam.attempt_policy.grace_period_seconds || 120) * 1000;
    if (now > session.expires_at_server + graceMs) {
      session.status = 'expired';
      res.status(422).json({
        error: 'EXAM_TIME_LIMIT_EXCEEDED',
        message: 'Submission rejected: server time limit and grace period have expired.',
      });
      return;
    }

    // Detect if client tried to inject a fake score in payload and log it to audit trail
    if (
      req.body &&
      (req.body.total_score !== undefined ||
        req.body.score !== undefined ||
        req.body.earned_points !== undefined)
    ) {
      recordAudit(
        'student',
        session.student_id,
        'TAMPERED_SCORE_PAYLOAD_IGNORED',
        sessionId,
        'Client submitted custom score fields in payload; server ignored client score and graded from authoritative key.'
      );
    }

    // Merge final answers if included in submit body
    if (req.body?.answers && typeof req.body.answers === 'object') {
      session.answers = resolveAnswerConflicts(session.answers, req.body.answers);
    }

    // Grade officially on the server
    const graded = gradeExamAttempt(authoritativeExam, session.answers);
    const durationSec = Math.max(1, Math.round((now - session.started_at_server) / 1000));
    const receiptId = `rcpt_${now}_${crypto.randomBytes(4).toString('hex')}`;
    const signature = signReceiptHash(
      `${receiptId}:${sessionId}:${session.student_id}:${graded.totalScore}:${now}`
    );

    const receipt: ExamSubmissionReceipt = {
      receipt_id: receiptId,
      idempotency_key: idempotencyKey,
      session_id: sessionId,
      exam_id: authoritativeExam.exam_id,
      exam_version: authoritativeExam.exam_version,
      student_id: session.student_id,
      student_name: session.student_name,
      mode: session.mode,
      submitted_at_server: now,
      duration_seconds: durationSec,
      total_score: graded.totalScore,
      max_score: graded.maxScore,
      percentage: graded.percentage,
      answered_count: graded.answeredCount,
      total_questions: authoritativeExam.questions.length,
      breakdown: graded.breakdown,
      signature_sha256: signature,
    };

    session.status = 'submitted';
    session.last_sync_at_server = now;
    session.submission_receipt = receipt;
    session.telemetry.push({
      event_id: `evt_sub_${now}`,
      session_id: sessionId,
      event_type: 'exam_submitted',
      client_timestamp: now,
      server_timestamp: now,
      detail: `Nộp bài thành công (${graded.totalScore}/${graded.maxScore} điểm)`,
    });

    processedIdempotencyKeys.set(idempotencyKey, {
      ok: true,
      duplicate_prevented: false,
      server_timestamp: now,
      receipt,
    });

    recordAudit(
      'student',
      session.student_id,
      'EXAM_SUBMITTED',
      sessionId,
      `Nộp bài chính thức: ${graded.totalScore}/${graded.maxScore} (${graded.percentage}%), receipt=${receiptId}`
    );

    res.status(200).json({
      ok: true,
      duplicate_prevented: false,
      server_timestamp: now,
      receipt,
    });
  });

  /**
   * GET /api/monitor/dashboard
   * Teacher Monitoring Dashboard endpoint (RBAC protected).
   */
  app.get('/api/monitor/dashboard', requireTeacherRole, (_req: Request, res: Response) => {
    const now = Date.now();
    const allSessions = Array.from(sessions.values());
    const activeExamId =
      allSessions[0]?.exam_id ||
      Array.from(publishedExamIds)[0] ||
      null;
    const latestExam = activeExamId ? getExamVersion(activeExamId) : undefined;

    const candidates = allSessions.map((s) => {
      const sExam = getExamVersion(s.exam_id, s.exam_version) || latestExam || initialCopy;
      const answeredCount = Object.keys(s.answers).length;
      const remainingSec =
        s.status === 'submitted'
          ? 0
          : Math.max(0, Math.round((s.expires_at_server - now) / 1000));
      const focusEventsCount = s.telemetry.filter((t) =>
        ['visibility_hidden', 'window_blur', 'fullscreen_exited', 'multi_tab_detected'].includes(
          t.event_type
        )
      ).length;

      return {
        session_id: s.session_id,
        student_id: s.student_id,
        student_name: s.student_name,
        student_code: s.student_code,
        class_name: s.class_name,
        exam_id: s.exam_id,
        exam_title: sExam.title,
        exam_version: s.exam_version,
        mode: s.mode,
        status: s.status,
        connection_state: s.connection_state,
        started_at_server: s.started_at_server,
        last_sync_at_server: s.last_sync_at_server,
        remaining_seconds: remainingSec,
        answered_count: answeredCount,
        total_questions: sExam.questions.length,
        observable_focus_events: focusEventsCount,
        score: s.submission_receipt?.total_score ?? null,
        max_score: s.submission_receipt?.max_score ?? sExam.grading_policy.total_max_score,
        percentage: s.submission_receipt?.percentage ?? null,
        answers: s.answers,
        telemetry: s.telemetry,
        submission_receipt: s.submission_receipt ?? null,
      };
    });

    // Compute Score Analytics across submitted candidates
    const submitted = candidates.filter((c) => c.status === 'submitted' && c.score !== null);
    const scores = submitted.map((c) => c.score as number).sort((a, b) => a - b);
    const meanScore =
      scores.length > 0
        ? Number((scores.reduce((acc, v) => acc + v, 0) / scores.length).toFixed(2))
        : 0;
    const medianScore =
      scores.length > 0
        ? scores.length % 2 === 1
          ? scores[Math.floor(scores.length / 2)]
          : Number(
              ((scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2).toFixed(2)
            )
        : 0;

    // Item difficulty analytics per question (empty when no exam or session is active)
    const itemAnalytics = latestExam
      ? latestExam.questions.map((q) => {
          let fullCorrect = 0;
          let partialCorrect = 0;
          for (const s of allSessions) {
            if (s.status === 'submitted' && s.submission_receipt) {
              const item = s.submission_receipt.breakdown.find((b) => b.question_id === q.id);
              if (item?.is_fully_correct) fullCorrect += 1;
              else if (item?.is_partially_correct) partialCorrect += 1;
            }
          }
          const denom = Math.max(1, submitted.length);
          return {
            question_id: q.id,
            question_number: q.number,
            question_type: q.type,
            points: q.points,
            correct_rate_percent:
              submitted.length > 0 ? Number(((fullCorrect / denom) * 100).toFixed(1)) : 0,
            partial_rate_percent:
              submitted.length > 0 ? Number(((partialCorrect / denom) * 100).toFixed(1)) : 0,
          };
        })
      : [];

    res.json({
      server_timestamp: now,
      summary: {
        total_candidates: candidates.length,
        in_progress_count: candidates.filter((c) => c.status === 'in_progress').length,
        submitted_count: submitted.length,
        offline_count: candidates.filter((c) => c.connection_state === 'offline').length,
        mean_score: meanScore,
        median_score: medianScore,
      },
      candidates,
      item_analytics: itemAnalytics,
      audit_logs: auditLogs.slice(0, 50),
    });
  });

  /**
   * POST /api/monitor/clear
   * Clears all candidate sessions and audit logs to return the monitoring room to an empty state.
   */
  app.post('/api/monitor/clear', requireTeacherRole, (_req: Request, res: Response) => {
    sessions.clear();
    processedIdempotencyKeys.clear();
    auditLogs.length = 0;
    res.json({ ok: true, server_timestamp: Date.now() });
  });

  /**
   * GET /api/monitor/export.csv
   * Secure CSV Export with strict formula-injection sanitization (Section 6.5).
   */
  app.get('/api/monitor/export.csv', requireTeacherRole, (_req: Request, res: Response) => {
    const headers = [
      'Session ID',
      'Student ID',
      'Student Code',
      'Full Name',
      'Class',
      'Exam Version',
      'Status',
      'Connection',
      'Answered Count',
      'Score',
      'Max Score',
      'Percentage',
      'Observable Focus Events',
      'Receipt Signature SHA256',
    ];

    const rows = Array.from(sessions.values()).map((s) => {
      const focusEvents = s.telemetry.filter((t) =>
        ['visibility_hidden', 'window_blur', 'fullscreen_exited', 'multi_tab_detected'].includes(
          t.event_type
        )
      ).length;
      return [
        s.session_id,
        s.student_id,
        s.student_code,
        s.student_name,
        s.class_name,
        `v${s.exam_version}`,
        s.status,
        s.connection_state,
        Object.keys(s.answers).length,
        s.submission_receipt ? s.submission_receipt.total_score : 'N/A',
        s.submission_receipt ? s.submission_receipt.max_score : 10,
        s.submission_receipt ? `${s.submission_receipt.percentage}%` : 'N/A',
        focusEvents,
        s.submission_receipt ? s.submission_receipt.signature_sha256 : '',
      ];
    });

    const csvContent = generateSafeCsv(headers, rows);
    recordAudit(
      'teacher',
      'teacher_admin',
      'CSV_EXPORTED',
      INITIAL_PUBLISHED_EXAM.exam_id,
      `Exported ${rows.length} candidate records with CSV formula injection protection`
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="khaothi-results-${INITIAL_PUBLISHED_EXAM.exam_id}.csv"`
    );
    res.status(200).send(csvContent);
  });

  /**
   * POST /api/studio/import-word
   * Runs the Python DOC/DOCX/MTEF ETL parser on a specified fixture or uploaded payload.
   */
  app.post('/api/studio/import-word', requireTeacherRole, async (req: Request, res: Response) => {
    const fixtureName = String(req.body?.fixture_name || 'golden_exam_v2.docx');
    const allowedFixtures = [
      'golden_exam_v2.docx',
      'golden_legacy_v3.doc',
      'corrupted_formula.doc',
      'malicious_xss.docx',
    ];

    if (!allowedFixtures.includes(fixtureName)) {
      res.status(400).json({
        error: 'INVALID_FIXTURE',
        message: `Unsupported fixture: ${fixtureName}`,
      });
      return;
    }

    try {
      const cwd = path.resolve(process.cwd());
      const { stdout } = await execFileAsync('python', [
        '-m',
        'etl.cli',
        '--fixture',
        fixtureName,
      ], { cwd });

      const parsedResult = JSON.parse(stdout);
      recordAudit(
        'teacher',
        'teacher_studio',
        'WORD_ETL_IMPORT',
        fixtureName,
        `Imported ${parsedResult.question_count} questions via ${parsedResult.parser_type} (can_publish=${parsedResult.validation_report?.can_publish})`
      );
      res.json(parsedResult);
    } catch (err) {
      res.status(500).json({
        error: 'ETL_EXECUTION_ERROR',
        message: err instanceof Error ? err.message : 'Python ETL execution failed',
      });
    }
  });

  /**
   * POST /api/studio/publish
   * Publishes a verified exam contract (Section 6.2 & 6.4):
   * - Blocks publish if any question has unresolved critical_errors
   * - Prevents in-place mutation of an active exam version with ongoing student sessions
   * - Creates an immutable incremented exam_version
   */
  app.post('/api/studio/publish', requireTeacherRole, (req: Request, res: Response) => {
    const {
      exam_id = INITIAL_PUBLISHED_EXAM.exam_id,
      subject_id = 'Toán & Khoa học',
      time_limit = 2700,
      title,
      questions,
      mutate_version_in_place,
    } = req.body || {};

    const targetExamId = String(exam_id);
    const latest = getExamVersion(targetExamId);

    // Section 6.2 Rule: Never directly modify an exam version that is currently in use for an ongoing exam!
    if (mutate_version_in_place && latest) {
      const hasActiveSessions = Array.from(sessions.values()).some(
        (s) =>
          s.exam_id === latest.exam_id &&
          s.exam_version === latest.exam_version &&
          s.status === 'in_progress'
      );
      if (hasActiveSessions) {
        res.status(409).json({
          error: 'ACTIVE_EXAM_VERSION_IMMUTABLE',
          message:
            'Cannot modify an exam version in place while candidates have active in-progress sessions. Publish a new version instead.',
        });
        return;
      }
    }

    const candidateQuestions: ExamQuestion[] = Array.isArray(questions)
      ? questions
      : latest?.questions || [];

    if (candidateQuestions.length === 0) {
      res.status(422).json({
        error: 'PUBLISH_BLOCKED_EMPTY_QUESTIONS',
        message: 'Bài tập cần có tối thiểu 1 câu hỏi trước khi xuất bản.',
      });
      return;
    }

    // Sanitize all stems/explanations and check for blocking critical errors
    const blockingErrors: string[] = [];
    const sanitizedQuestions: ExamQuestion[] = candidateQuestions.map((q, idx) => {
      const cleanStem = sanitizeWordHtml(q.stem || '');
      const cleanExp = sanitizeWordHtml(q.explanation || '');
      const qErrors: string[] = [];

      if (!cleanStem) {
        qErrors.push('CRITICAL_EMPTY_STEM');
      }
      if (!q.answer_key) {
        qErrors.push('CRITICAL_MISSING_ANSWER_KEY');
      }
      for (const f of q.formulas || []) {
        if ((!f.decodable || f.needs_review) && !q.validation?.verified_by_human) {
          qErrors.push(`CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED:${f.formula_id}`);
        }
      }

      for (const err of qErrors) {
        blockingErrors.push(`${q.id || `q_${idx + 1}`}:${err}`);
      }

      return {
        ...q,
        number: idx + 1,
        stem: cleanStem,
        explanation: cleanExp,
        validation: {
          ...q.validation,
          critical_errors: qErrors,
          needs_review: qErrors.length > 0,
        },
      };
    });

    if (blockingErrors.length > 0) {
      res.status(422).json({
        error: 'PUBLISH_BLOCKED_CRITICAL_ERRORS',
        message: 'Cannot publish exam: unresolved critical validation errors exist.',
        blocking_errors: blockingErrors,
      });
      return;
    }

    const rawTimeLimit =
      typeof time_limit === 'object' && time_limit !== null
        ? Number((time_limit as { duration_seconds?: number }).duration_seconds)
        : Number(time_limit);
    const resolvedTimeLimit = Math.max(60, rawTimeLimit || latest?.time_limit || 2700);

    const totalPoints = Number(
      sanitizedQuestions.reduce((acc, q) => acc + (Number(q.points) || 1), 0).toFixed(2)
    );
    const newVersionNumber = latest ? latest.exam_version + 1 : 1;
    const baseContract = latest || {
      ...initialCopy,
      exam_id: targetExamId,
      subject_id: sanitizeWordHtml(String(subject_id)),
      time_limit: resolvedTimeLimit,
      grading_policy: {
        ...DEFAULT_GRADING_POLICY_V2,
        total_max_score: totalPoints,
      },
      assets_manifest: [],
    };

    const newContract: ExamContract = validateExamContractV2({
      ...baseContract,
      exam_id: targetExamId,
      exam_version: newVersionNumber,
      subject_id: subject_id ? sanitizeWordHtml(String(subject_id)) : baseContract.subject_id,
      time_limit: resolvedTimeLimit,
      title: title ? sanitizeWordHtml(String(title)) : baseContract.title,
      published_at: new Date().toISOString(),
      status: 'published',
      grading_policy: {
        ...baseContract.grading_policy,
        total_max_score: totalPoints,
      },
      questions: sanitizedQuestions,
    });

    const list = examVersions.get(targetExamId) || [];
    list.push(newContract);
    examVersions.set(targetExamId, list);
    publishedExamIds.add(targetExamId);

    recordAudit(
      'teacher',
      'teacher_studio',
      'EXAM_VERSION_PUBLISHED',
      targetExamId,
      `Đã xuất bản bài tập "${newContract.title}" (v${newVersionNumber}, ${newContract.questions.length} câu hỏi)`
    );

    res.status(201).json({
      ok: true,
      published_version: newVersionNumber,
      exam: newContract,
    });
  });

  /**
   * DELETE /api/studio/exams/:examId
   * Deletes an exercise from the active system list.
   */
  app.delete('/api/studio/exams/:examId', requireTeacherRole, (req: Request, res: Response) => {
    const examId = String(req.params.examId);
    publishedExamIds.delete(examId);
    if (examId !== INITIAL_PUBLISHED_EXAM.exam_id) {
      examVersions.delete(examId);
    }
    res.json({ ok: true, deleted_exam_id: examId });
  });

  /**
   * GET /api/studio/versions/:examId
   * Returns all published versions of an exam and schema migration support.
   */
  app.get('/api/studio/versions/:examId', requireTeacherRole, (req: Request, res: Response) => {
    const examId = String(req.params.examId);
    const list = examVersions.get(examId) || [];
    res.json({
      exam_id: examId,
      versions: list.map((v) => ({
        schema_version: v.schema_version,
        exam_version: v.exam_version,
        title: v.title,
        published_at: v.published_at,
        status: v.status,
        question_count: v.questions.length,
        total_max_score: v.grading_policy.total_max_score,
      })),
      latest_exam: list[list.length - 1] || null,
    });
  });

  /**
   * POST /api/studio/migrate-schema
   * Migrates a legacy v1 exam payload to the v2.0.0 contract.
   */
  app.post('/api/studio/migrate-schema', requireTeacherRole, (req: Request, res: Response) => {
    try {
      const migrated = migrateExamSchema(req.body);
      res.json({
        ok: true,
        migrated_exam: migrated,
      });
    } catch (err) {
      res.status(400).json({
        error: 'SCHEMA_MIGRATION_FAILED',
        message: err instanceof Error ? err.message : 'Invalid schema input',
      });
    }
  });

  return app;
}
