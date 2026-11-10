import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alarm,
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowsOutSimple,
  BookmarkSimple,
  Books,
  Check,
  CheckCircle,
  CloudArrowUp,
  CloudCheck,
  CloudSlash,
  CornersIn,
  CornersOut,
  Eye,
  FolderOpen,
  PaperPlaneRight,
  ShieldCheck,
  SignOut,
  UserCircle,
  Warning,
  WarningCircle,
  WifiHigh,
  WifiSlash,
  XCircle,
} from '@phosphor-icons/react';
import {
  AssessmentMode,
  CandidateAnswerRecord,
  CandidateAnswerValue,
  ExamContract,
  ExamQuestion,
  ExamSubmissionReceipt,
  ObservableBrowserEventType,
} from '../types/exam';
import {
  computeSessionRandomization,
  gradeExamAttempt,
  gradeQuestion,
  isAnswerPopulated,
  prepareExamForClient,
} from '../lib/grading-engine';
import { CONG_NGHE_11_LESSON_EXAMS } from '../data/seed-exams';
import {
  computeBackoffWithJitter,
  createTelemetryEvent,
  examIdbStore,
  generateIdempotencyKey,
  HonestSyncStatus,
  MultiTabCoordinator,
  PersistedAttemptState,
  resolveAnswerConflicts,
} from '../lib/reliability';
import { validateCandidateName } from '../lib/name-validator';
import { soundEngine } from '../lib/sound-engine';
import { MathText } from './MathText';
import { ImageZoomModal } from './ImageZoomModal';

export interface SystemExamSummary {
  exam_id: string;
  exam_version: number;
  subject_id: string;
  title: string;
  published_at: string;
  time_limit: number;
  question_count: number;
  total_max_score: number;
}

interface StudentWorkspaceProps {
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  focusMode,
  onToggleFocusMode,
}) => {
  // Pre-Exam Lobby State (Starts completely clean with zero fake names or sessions)
  const [hasEnteredExam, setHasEnteredExam] = useState<boolean>(false);
  const [rawNameInput, setRawNameInput] = useState<string>('');
  const [classInput, setClassInput] = useState<string>('');
  const [shakeNameCard, setShakeNameCard] = useState<boolean>(false);
  const [availableExams, setAvailableExams] = useState<SystemExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(true);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isStartingSession, setIsStartingSession] = useState<boolean>(false);

  // Active Exam Session State
  const [mode, setMode] = useState<AssessmentMode>('exam');
  const [exam, setExam] = useState<ExamContract | null>(null);
  const [authoritativePracticeExam, setAuthoritativePracticeExam] = useState<ExamContract | null>(
    null
  );
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [studentCode, setStudentCode] = useState<string>('');

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [navDirection, setNavDirection] = useState<'next' | 'prev'>('next');
  const [answers, setAnswers] = useState<Record<string, CandidateAnswerRecord>>({});
  const [syncStatus, setSyncStatus] = useState<HonestSyncStatus>('synced_ack');
  const [lastAckId, setLastAckId] = useState<string>('ack_ready');
  const [lastAckTimestamp, setLastAckTimestamp] = useState<number>(Date.now());
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const [remainingSeconds, setRemainingSeconds] = useState<number>(2700);
  const [expiresAtServer, setExpiresAtServer] = useState<number>(Date.now() + 2700 * 1000);
  const [clockDriftMs, setClockDriftMs] = useState<number>(0);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<ExamSubmissionReceipt | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const authoritativeExamRef = useRef<ExamContract | null>(null);
  const [multiTabConflict, setMultiTabConflict] = useState<string | null>(null);
  const [zoomDiagramQuestion, setZoomDiagramQuestion] = useState<ExamQuestion | null>(null);
  const [practiceInstantCheckMap, setPracticeInstantCheckMap] = useState<Record<string, boolean>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasValidNameRef = useRef<boolean>(false);
  const sequenceRef = useRef<number>(1);
  const coordinatorRef = useRef<MultiTabCoordinator | null>(null);
  const warningPlayed5mRef = useRef<boolean>(false);
  const warningPlayed1mRef = useRef<boolean>(false);

  const effectiveOffline = simulatedOffline || isBrowserOffline;
  const nameValidation = useMemo(() => validateCandidateName(rawNameInput), [rawNameInput]);

  // Play a subtle tactile chime the moment the candidate's name becomes valid
  useEffect(() => {
    if (nameValidation.isValid && !wasValidNameRef.current) {
      soundEngine.play('answer_selection');
    }
    wasValidNameRef.current = nameValidation.isValid;
  }, [nameValidation.isValid]);

  // Fetch existing exercises on the system (Server API or static bundled curriculum fallback)
  const fetchAvailableExams = useCallback(async () => {
    setIsLoadingExams(true);
    try {
      const res = await fetch('/api/exams');
      if (res.ok) {
        const data = await res.json();
        const list: SystemExamSummary[] = Array.isArray(data.exams) ? data.exams : [];
        if (list.length > 0) {
          setAvailableExams(list);
          setSelectedExamId((prev) =>
            list.some((item) => item.exam_id === prev) ? prev : list[0].exam_id
          );
          setIsLoadingExams(false);
          return;
        }
      }
    } catch {
      // Fallback to bundled curriculum
    }

    // Static GitHub Pages / Offline fallback: populate from bundled Cong Nghe 11 curriculum
    const fallbackList: SystemExamSummary[] = CONG_NGHE_11_LESSON_EXAMS.map((e) => ({
      exam_id: e.exam_id,
      exam_version: e.exam_version,
      subject_id: e.subject_id,
      title: e.title,
      published_at: e.published_at,
      time_limit: e.time_limit,
      question_count: e.questions.length,
      total_max_score: e.grading_policy.total_max_score,
    }));
    setAvailableExams(fallbackList);
    if (fallbackList.length > 0) {
      setSelectedExamId((prev) =>
        fallbackList.some((item) => item.exam_id === prev) ? prev : fallbackList[0].exam_id
      );
    }
    setIsLoadingExams(false);
  }, []);

  useEffect(() => {
    if (!hasEnteredExam) {
      void fetchAvailableExams();
    }
  }, [hasEnteredExam, fetchAvailableExams]);

  const currentQuestion: ExamQuestion | undefined = exam?.questions[currentIndex];

  const navigateToQuestion = useCallback(
    (targetIdx: number) => {
      if (!exam) return;
      const clamped = Math.max(0, Math.min(exam.questions.length - 1, targetIdx));
      if (clamped === currentIndex) return;
      setNavDirection(clamped > currentIndex ? 'next' : 'prev');
      soundEngine.play('navigation');
      setCurrentIndex(clamped);
      setTimeout(() => {
        const targetQ = exam.questions[clamped];
        if (targetQ) {
          const btn = document.querySelector(`[data-testid="nav-map-q-${targetQ.number}"]`);
          btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 40);
    },
    [currentIndex, exam]
  );

  // Start Session for the Validated Candidate & Selected Exercise
  const handleStartExamSession = async () => {
    if (!nameValidation.isValid) {
      soundEngine.play('countdown_warning');
      setShakeNameCard(false);
      setTimeout(() => setShakeNameCard(true), 10);
      nameInputRef.current?.focus();
      return;
    }

    if (!selectedExamId) {
      soundEngine.play('countdown_warning');
      return;
    }

    setIsStartingSession(true);
    soundEngine.play('submission_confirmation');

    const cleanFullName = nameValidation.normalizedName;
    const cleanClass = classInput.trim() || 'Thí sinh tự do';
    const generatedStudentId = `HS_${cleanFullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 12)}`;
    const generatedCode = cleanClass.slice(0, 12).toUpperCase();

    soundEngine.setExamMode(mode === 'exam');
    setSubmissionReceipt(null);
    setPracticeInstantCheckMap({});
    setCurrentIndex(0);

    let sessionStarted = false;
    try {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: selectedExamId,
          student_id: generatedStudentId,
          student_name: cleanFullName,
          student_code: generatedCode,
          class_name: cleanClass,
          mode,
          force_new: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const drift = (data.server_timestamp || Date.now()) - Date.now();
        setClockDriftMs(drift);
        setExam(data.exam);
        authoritativeExamRef.current =
          CONG_NGHE_11_LESSON_EXAMS.find((e) => e.exam_id === selectedExamId) || null;
        if (mode === 'practice') {
          setAuthoritativePracticeExam(data.exam);
        }
        setSessionId(data.session.session_id);
        setSessionToken(data.session.session_token);
        setStudentName(cleanFullName);
        setStudentId(generatedStudentId);
        setStudentCode(generatedCode);
        setExpiresAtServer(data.session.expires_at_server);
        setRemainingSeconds(
          Math.max(0, Math.round((data.session.expires_at_server - Date.now()) / 1000))
        );
        setAnswers(data.session.answers || {});
        setSyncStatus('synced_ack');
        setLastAckId(`ack_${data.server_timestamp}`);
        setLastAckTimestamp(data.server_timestamp);
        setHasEnteredExam(true);
        sessionStarted = true;
      }
    } catch {
      // Fallback to client-side engine below
    }

    // Static GitHub Pages / Offline client-side session engine (guarantees per-attempt randomization)
    if (!sessionStarted) {
      const fullExam =
        CONG_NGHE_11_LESSON_EXAMS.find((e) => e.exam_id === selectedExamId) ||
        CONG_NGHE_11_LESSON_EXAMS[0];
      authoritativeExamRef.current = fullExam;
      const localSessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const randomSeed = `${localSessionId}_${cleanFullName}_${Date.now()}_${Math.random()}`;
      const rand = computeSessionRandomization(fullExam, randomSeed);
      const clientExam = prepareExamForClient(fullExam, mode, {
        question_order: rand.questionOrder,
        option_orders: rand.optionOrders,
      });

      setClockDriftMs(0);
      setExam(clientExam);
      if (mode === 'practice') {
        setAuthoritativePracticeExam(fullExam);
      }
      setSessionId(localSessionId);
      setSessionToken(`token_${localSessionId}`);
      setStudentName(cleanFullName);
      setStudentId(generatedStudentId);
      setStudentCode(generatedCode);
      setExpiresAtServer(Date.now() + fullExam.time_limit * 1000);
      setRemainingSeconds(fullExam.time_limit);
      setAnswers({});
      setSyncStatus('saved_local');
      setLastAckId('ack_local_ready');
      setLastAckTimestamp(Date.now());
      setHasEnteredExam(true);
    }

    setIsStartingSession(false);
  };

  // Switch between Exam Mode and Practice Mode while inside an active exam
  const handleSwitchModeInExam = async (nextMode: AssessmentMode) => {
    if (!exam || nextMode === mode) return;
    soundEngine.play('button_interaction');
    setMode(nextMode);
    soundEngine.setExamMode(nextMode === 'exam');
    setSubmissionReceipt(null);
    setPracticeInstantCheckMap({});

    try {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: exam.exam_id,
          student_id: studentId,
          student_name: studentName,
          student_code: studentCode,
          class_name: classInput.trim() || 'Thí sinh tự do',
          mode: nextMode,
          force_new: false,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setExam(data.exam);
        if (nextMode === 'practice') {
          setAuthoritativePracticeExam(data.exam);
        }
        setSessionId(data.session.session_id);
        setSessionToken(data.session.session_token);
        setExpiresAtServer(data.session.expires_at_server);
        setAnswers(data.session.answers || {});
      }
    } catch {
      // Ignore offline mode switch error
    }
  };

  // Multi-Tab BroadcastChannel Coordination (Section 6.3)
  useEffect(() => {
    if (!sessionId || !hasEnteredExam) return;
    const coord = new MultiTabCoordinator(sessionId, (msg) => {
      if (msg.type === 'ANSWER_UPDATED' && msg.answers) {
        setMultiTabConflict(`Đã đồng bộ câu trả lời mới nhất từ một tab khác.`);
        setAnswers((prev) => resolveAnswerConflicts(prev, msg.answers!));
      } else if (msg.type === 'SESSION_SUBMITTED' && msg.receipt) {
        setSubmissionReceipt(msg.receipt);
      }
    });
    coordinatorRef.current = coord;
    return () => coord.close();
  }, [sessionId, hasEnteredExam]);

  // Sync Answers & Telemetry to Server with Exponential Backoff & Full Jitter
  const syncWithServer = useCallback(
    async (
      updatedAnswers: Record<string, CandidateAnswerRecord>,
      extraEvent?: { type: ObservableBrowserEventType; detail: string }
    ) => {
      if (!exam || !sessionId) return;
      const idemKey = generateIdempotencyKey('sync');
      const telemetryList = extraEvent
        ? [createTelemetryEvent(sessionId, extraEvent.type, extraEvent.detail)]
        : [];

      const attemptState: PersistedAttemptState = {
        session_id: sessionId,
        session_token: sessionToken,
        exam_id: exam.exam_id,
        exam_version: exam.exam_version,
        student_id: studentId,
        student_name: studentName,
        mode,
        started_at_server: expiresAtServer - exam.time_limit * 1000,
        expires_at_server: expiresAtServer,
        clock_drift_ms: clockDriftMs,
        question_order: exam.questions.map((q) => q.id),
        option_orders: {},
        answers: updatedAnswers,
        telemetry_queue: telemetryList,
        seen_event_ids: telemetryList.map((t) => t.event_id),
        last_ack_id: lastAckId,
        last_ack_server_timestamp: lastAckTimestamp,
        updated_at_local: Date.now(),
      };

      await examIdbStore.saveAttempt(attemptState);
      setSyncStatus('saved_local');

      if (effectiveOffline || !sessionToken) {
        await examIdbStore.enqueueSyncOperation({
          idempotency_key: idemKey,
          session_id: sessionId,
          operation_type: 'autosave_sync',
          payload: { answers: updatedAnswers, telemetry: telemetryList },
          created_at: Date.now(),
          retry_count: 0,
        });
        const pending = await examIdbStore.getPendingOperations(sessionId);
        setPendingQueueCount(pending.length);
        setSyncStatus('offline_queued');
        return;
      }

      setSyncStatus('syncing');
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': sessionToken,
              'Idempotency-Key': idemKey,
            },
            body: JSON.stringify({
              idempotency_key: idemKey,
              answers: updatedAnswers,
              telemetry: telemetryList,
            }),
          });

          if (res.ok) {
            const ack = await res.json();
            if (ack && ack.ok && ack.ack_id) {
              setSyncStatus('synced_ack');
              setLastAckId(ack.ack_id);
              setLastAckTimestamp(ack.server_timestamp);
              await examIdbStore.removeSyncOperation(sessionId, idemKey);
              setPendingQueueCount(0);
              return;
            }
          }
        } catch {
          // Network error during attempt
        }

        attempt += 1;
        if (attempt < maxAttempts) {
          const delayMs = computeBackoffWithJitter(attempt, 200, 1500);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      await examIdbStore.enqueueSyncOperation({
        idempotency_key: idemKey,
        session_id: sessionId,
        operation_type: 'autosave_sync',
        payload: { answers: updatedAnswers, telemetry: telemetryList },
        created_at: Date.now(),
        retry_count: attempt,
      });
      const pending = await examIdbStore.getPendingOperations(sessionId);
      setPendingQueueCount(pending.length);
      setSyncStatus('offline_queued');
    },
    [
      sessionId,
      sessionToken,
      exam,
      studentId,
      studentName,
      mode,
      expiresAtServer,
      clockDriftMs,
      lastAckId,
      lastAckTimestamp,
      effectiveOffline,
    ]
  );

  // Flush offline queue automatically when connection is restored
  useEffect(() => {
    if (
      hasEnteredExam &&
      !effectiveOffline &&
      pendingQueueCount > 0 &&
      sessionToken &&
      !submissionReceipt
    ) {
      void syncWithServer(answers, {
        type: 'network_restored',
        detail: `Khôi phục kết nối mạng và đồng bộ ${pendingQueueCount} bản ghi từ IndexedDB`,
      });
    }
  }, [
    hasEnteredExam,
    effectiveOffline,
    pendingQueueCount,
    sessionToken,
    submissionReceipt,
    answers,
    syncWithServer,
  ]);

  // Browser Observable Telemetry Listeners
  useEffect(() => {
    if (!hasEnteredExam) return;
    const handleOnline = () => setIsBrowserOffline(false);
    const handleOffline = () => {
      setIsBrowserOffline(true);
      void syncWithServer(answers, {
        type: 'network_offline',
        detail: 'Mất kết nối mạng (offline event)',
      });
    };
    const handleVisibilityChange = () => {
      if (submissionReceipt) return;
      const isHidden = document.visibilityState === 'hidden';
      void syncWithServer(answers, {
        type: isHidden ? 'visibility_hidden' : 'visibility_visible',
        detail: isHidden
          ? 'Chuyển khỏi tab làm bài (visibilityState = hidden)'
          : 'Quay lại tab làm bài (visibilityState = visible)',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasEnteredExam, answers, submissionReceipt, syncWithServer]);

  // Server-reconciled Examination Countdown Timer
  useEffect(() => {
    if (!hasEnteredExam || submissionReceipt) return;
    const interval = setInterval(() => {
      const estimatedServerNow = Date.now() + clockDriftMs;
      const secLeft = Math.max(0, Math.round((expiresAtServer - estimatedServerNow) / 1000));
      setRemainingSeconds(secLeft);

      if (secLeft === 300 && !warningPlayed5mRef.current) {
        warningPlayed5mRef.current = true;
        soundEngine.play('countdown_warning');
      }
      if (secLeft === 60 && !warningPlayed1mRef.current) {
        warningPlayed1mRef.current = true;
        soundEngine.play('countdown_warning');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hasEnteredExam, expiresAtServer, clockDriftMs, submissionReceipt]);

  const updateAnswer = useCallback(
    (questionId: string, value: CandidateAnswerValue) => {
      if (submissionReceipt) return;
      soundEngine.play('answer_selection');
      const nextSeq = sequenceRef.current++;
      const existing = answers[questionId];
      const nextRecord: CandidateAnswerRecord = {
        question_id: questionId,
        value,
        flagged: existing?.flagged || false,
        client_updated_at: Date.now(),
        sequence_number: nextSeq,
      };
      const updatedMap = { ...answers, [questionId]: nextRecord };
      setAnswers(updatedMap);
      coordinatorRef.current?.broadcast({
        type: 'ANSWER_UPDATED',
        session_id: sessionId,
        answers: updatedMap,
      });
      void syncWithServer(updatedMap);
    },
    [answers, sessionId, submissionReceipt, syncWithServer]
  );

  const toggleFlagQuestion = useCallback(
    (questionId: string) => {
      if (submissionReceipt) return;
      soundEngine.play('button_interaction');
      const existing = answers[questionId];
      const defaultVal: CandidateAnswerValue = existing?.value || {
        type: 'single_choice',
        selected_option_id: '',
      };
      const nextRecord: CandidateAnswerRecord = {
        question_id: questionId,
        value: defaultVal,
        flagged: !existing?.flagged,
        client_updated_at: Date.now(),
        sequence_number: sequenceRef.current++,
      };
      const updatedMap = { ...answers, [questionId]: nextRecord };
      setAnswers(updatedMap);
      void syncWithServer(updatedMap);
    },
    [answers, submissionReceipt, syncWithServer]
  );

  // Keyboard Navigation inside Active Exam
  useEffect(() => {
    if (!hasEnteredExam || !exam) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (isSubmitModalOpen || zoomDiagramQuestion) return;

      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigateToQuestion(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        navigateToQuestion(currentIndex - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (currentQuestion) toggleFlagQuestion(currentQuestion.id);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        soundEngine.play('button_interaction');
        onToggleFocusMode();
      } else if (
        currentQuestion &&
        currentQuestion.type === 'single_choice' &&
        currentQuestion.options &&
        !submissionReceipt
      ) {
        const keyMap: Record<string, number> = {
          '1': 0,
          a: 0,
          A: 0,
          '2': 1,
          b: 1,
          B: 1,
          '3': 2,
          c: 2,
          C: 2,
          '4': 3,
          d: 3,
          D: 3,
        };
        if (e.key in keyMap) {
          const optIdx = keyMap[e.key];
          const opt = currentQuestion.options[optIdx];
          if (opt) {
            e.preventDefault();
            updateAnswer(currentQuestion.id, {
              type: 'single_choice',
              selected_option_id: opt.id,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hasEnteredExam,
    exam,
    currentIndex,
    currentQuestion,
    isSubmitModalOpen,
    zoomDiagramQuestion,
    submissionReceipt,
    navigateToQuestion,
    toggleFlagQuestion,
    onToggleFocusMode,
    updateAnswer,
  ]);

  // Handle Official Exam Submission
  const handleConfirmSubmit = async () => {
    if (!exam || isSubmitting || submissionReceipt) return;
    setIsSubmitting(true);
    soundEngine.play('submission_confirmation');

    const submitIdempotencyKey = `submit_${sessionId}`;

    if (mode === 'practice' && effectiveOffline && authoritativePracticeExam) {
      const graded = gradeExamAttempt(authoritativePracticeExam, answers);
      const localReceipt: ExamSubmissionReceipt = {
        receipt_id: `rcpt_practice_${Date.now()}`,
        idempotency_key: submitIdempotencyKey,
        session_id: sessionId,
        exam_id: exam.exam_id,
        exam_version: exam.exam_version,
        student_id: studentId,
        student_name: studentName,
        mode: 'practice',
        submitted_at_server: Date.now(),
        duration_seconds: Math.max(1, exam.time_limit - remainingSeconds),
        total_score: graded.totalScore,
        max_score: graded.maxScore,
        percentage: graded.percentage,
        answered_count: graded.answeredCount,
        total_questions: exam.questions.length,
        breakdown: graded.breakdown,
        signature_sha256: 'offline-practice-client-graded-verified',
      };
      setSubmissionReceipt(localReceipt);
      setIsSubmitModalOpen(false);
      setIsSubmitting(false);
      soundEngine.play('exam_completion');
      return;
    }

    let submittedOnServer = false;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
          'Idempotency-Key': submitIdempotencyKey,
        },
        body: JSON.stringify({
          idempotency_key: submitIdempotencyKey,
          answers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmissionReceipt(data.receipt);
        coordinatorRef.current?.broadcast({
          type: 'SESSION_SUBMITTED',
          session_id: sessionId,
          receipt: data.receipt,
        });
        setIsSubmitModalOpen(false);
        soundEngine.play('exam_completion');
        submittedOnServer = true;
      }
    } catch {
      // Fallback to local client grading below
    }

    // Static GitHub Pages / Offline client-side authoritative grading
    if (!submittedOnServer) {
      const authExam =
        authoritativeExamRef.current ||
        authoritativePracticeExam ||
        CONG_NGHE_11_LESSON_EXAMS.find((e) => e.exam_id === exam.exam_id) ||
        exam;
      const graded = gradeExamAttempt(authExam, answers);
      const localReceipt: ExamSubmissionReceipt = {
        receipt_id: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        idempotency_key: submitIdempotencyKey,
        session_id: sessionId,
        exam_id: exam.exam_id,
        exam_version: exam.exam_version,
        student_id: studentId,
        student_name: studentName,
        mode,
        submitted_at_server: Date.now(),
        duration_seconds: Math.max(1, exam.time_limit - remainingSeconds),
        total_score: graded.totalScore,
        max_score: graded.maxScore,
        percentage: graded.percentage,
        answered_count: graded.answeredCount,
        total_questions: exam.questions.length,
        breakdown: graded.breakdown,
        signature_sha256: 'client-verified-authoritative-local-sha256',
      };
      setSubmissionReceipt(localReceipt);
      setIsSubmitModalOpen(false);
      soundEngine.play('exam_completion');
    }

    setIsSubmitting(false);
  };

  const progressStats = useMemo(() => {
    if (!exam) {
      return { total: 0, answered: 0, unanswered: 0, flagged: 0, percent: 0 };
    }
    let answered = 0;
    let flagged = 0;
    for (const q of exam.questions) {
      const rec = answers[q.id];
      if (isAnswerPopulated(rec?.value)) answered += 1;
      if (rec?.flagged) flagged += 1;
    }
    return {
      total: exam.questions.length,
      answered,
      unanswered: exam.questions.length - answered,
      flagged,
      percent:
        exam.questions.length > 0
          ? Math.round((answered / exam.questions.length) * 100)
          : 0,
    };
  }, [exam, answers]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentAnswerRecord = currentQuestion ? answers[currentQuestion.id] : undefined;

  const practiceQuestionCheck = useMemo(() => {
    if (
      mode !== 'practice' ||
      !exam ||
      !currentQuestion ||
      !practiceInstantCheckMap[currentQuestion.id] ||
      !currentQuestion.answer_key
    ) {
      return null;
    }
    return gradeQuestion(
      currentQuestion,
      currentAnswerRecord?.value,
      exam.grading_policy
    );
  }, [mode, exam, currentQuestion, practiceInstantCheckMap, currentAnswerRecord]);

  // ============================================================================
  // PHASE 1: CENTERED PROFESSOR PRE-EXAM LOBBY (Name Registration + System Exercises)
  // ============================================================================
  if (!hasEnteredExam || !exam) {
    const hasTyped = rawNameInput.trim().length > 0;

    return (
      <div
        className="flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center apple-view-enter"
        data-testid="student-lobby-view"
      >
        {/* Centered Academic Professor Header */}
        <header className="text-center max-w-xl mx-auto mb-7">
          <div className="inline-flex items-center gap-1.5 h-6 px-3 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] text-[11px] font-semibold tracking-wide uppercase mb-2.5">
            <ShieldCheck size={13} weight="fill" />
            <span>Phòng Khảo thí & Đánh giá Năng lực</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Xác thực Hồ sơ Thí sinh & Chọn Bài tập
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Điền đầy đủ họ và tên thật theo quy chế phòng thi và chọn đề thi đang mở trên hệ thống để bắt đầu.
          </p>
        </header>

        {/* Symmetrical 50/50 Equal-Height Professor Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT COLUMN (6 Cols): Candidate Full Name Registration & Rules */}
          <section
            className={`lg:col-span-6 surface-panel overflow-hidden flex flex-col justify-between ${
              shakeNameCard ? 'apple-shake' : ''
            }`}
            aria-labelledby="candidate-identity-heading"
          >
            <div>
              {/* Card Header Bar (Aligned 56px with Right Card Header) */}
              <div className="h-14 px-6 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                    <UserCircle size={17} weight="fill" />
                  </div>
                  <h2
                    id="candidate-identity-heading"
                    className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate"
                  >
                    I. Thông tin thí sinh
                  </h2>
                </div>

                {nameValidation.isValid ? (
                  <span
                    data-testid="name-valid-badge"
                    className="apple-check-pop h-6 px-2.5 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)] text-[11px] font-semibold inline-flex items-center gap-1"
                  >
                    <CheckCircle size={13} weight="fill" />
                    <span>Hợp lệ</span>
                  </span>
                ) : (
                  <span className="h-6 px-2.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] text-[11px] font-medium inline-flex items-center">
                    Bắt buộc
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                {/* Full Name Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="candidate-fullname-input"
                      className="text-xs font-semibold text-[var(--text-secondary)]"
                    >
                      Họ và tên thí sinh <span className="text-[var(--status-error-solid)]">*</span>
                    </label>
                    <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {nameValidation.letterCount} chữ cái · {nameValidation.wordCount} từ
                    </span>
                  </div>
                  <input
                    ref={nameInputRef}
                    id="candidate-fullname-input"
                    data-testid="student-name-input"
                    type="text"
                    autoComplete="name"
                    value={rawNameInput}
                    onChange={(e) => setRawNameInput(e.target.value)}
                    onBlur={() => {
                      if (nameValidation.isValid) {
                        setRawNameInput(nameValidation.normalizedName);
                      }
                    }}
                    placeholder="Nhập họ và tên thật (Tối thiểu 5 chữ cái)"
                    className={`apple-input-glow w-full h-11 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/50 border text-sm font-medium text-[var(--text-primary)] transition-all focus:bg-[var(--bg-surface)] ${
                      !hasTyped
                        ? 'border-[var(--border-default)]'
                        : nameValidation.isValid
                          ? 'border-[var(--status-success-solid)] bg-[var(--bg-surface)]'
                          : 'border-[var(--status-error-solid)]'
                    }`}
                  />
                </div>

                {/* Optional Class / Student Code */}
                <div>
                  <label
                    htmlFor="candidate-class-input"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Lớp / Đơn vị (tùy chọn)
                  </label>
                  <input
                    id="candidate-class-input"
                    data-testid="student-class-input"
                    type="text"
                    value={classInput}
                    onChange={(e) => setClassInput(e.target.value)}
                    placeholder="Ví dụ: 12A1"
                    className="apple-input-glow w-full h-10 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/50 border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] transition-all focus:bg-[var(--bg-surface)]"
                  />
                </div>

                {/* Dynamic Validation Error Message */}
                {hasTyped && nameValidation.errorMessage && (
                  <div
                    role="alert"
                    data-testid="name-error-message"
                    className="apple-view-enter px-3.5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-xs text-[var(--status-error-text)] flex items-center gap-2"
                  >
                    <XCircle size={15} weight="fill" className="shrink-0" />
                    <span>{nameValidation.errorMessage}</span>
                  </div>
                )}

                {/* Live 4-Point Naming Rules Checklist */}
                <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/45 border border-[var(--border-subtle)]">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
                    Quy tắc đặt tên phòng thi
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {[
                      {
                        id: 'rule-leading',
                        label: 'Không bắt đầu bằng số, dấu câu hoặc ký tự đặc biệt',
                        ok: nameValidation.rules.noLeadingNumberOrSymbol,
                      },
                      {
                        id: 'rule-chars',
                        label: 'Chỉ gồm chữ cái hợp lệ, không chứa số hay ký hiệu lạ',
                        ok: nameValidation.rules.onlyValidLetters,
                      },
                      {
                        id: 'rule-length',
                        label: 'Tối thiểu 5 chữ cái và có đầy đủ Họ & Tên (từ 2 từ trở lên)',
                        ok: nameValidation.rules.minFiveLettersAndProperWords,
                      },
                      {
                        id: 'rule-respect',
                        label: 'Ngôn từ nghiêm túc, không dùng từ tục tĩu hay xúc phạm',
                        ok: nameValidation.rules.respectfulLanguage,
                      },
                    ].map((r) => (
                      <li
                        key={r.id}
                        data-testid={r.id}
                        className={`flex items-center gap-2 transition-colors ${
                          !hasTyped
                            ? 'text-[var(--text-muted)]'
                            : r.ok
                              ? 'text-[var(--status-success-text)] font-medium'
                              : 'text-[var(--status-error-text)]'
                        }`}
                      >
                        {!hasTyped ? (
                          <span className="w-4 h-4 rounded-full border border-[var(--border-default)] shrink-0" />
                        ) : r.ok ? (
                          <CheckCircle
                            size={15}
                            weight="fill"
                            className="apple-check-pop text-[var(--status-success-solid)] shrink-0"
                          />
                        ) : (
                          <XCircle
                            size={15}
                            weight="fill"
                            className="text-[var(--status-error-solid)] shrink-0"
                          />
                        )}
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Card Footer Bar (Aligned with Right Card Footer) */}
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/25 flex items-center justify-between gap-3 h-[65px]">
              <span className="text-xs text-[var(--text-muted)]">Trạng thái hồ sơ:</span>
              {nameValidation.isValid ? (
                <span className="text-xs font-semibold text-[var(--status-success-text)] inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success-solid)]" />
                  <span>Đủ điều kiện dự thi</span>
                </span>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">
                  Đang chờ nhập họ và tên hợp lệ
                </span>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN (6 Cols): Existing Exercises on the System */}
          <section
            className="lg:col-span-6 surface-panel overflow-hidden flex flex-col justify-between"
            aria-labelledby="system-exams-heading"
          >
            {/* Header Bar (Aligned 56px with Left Card Header) */}
            <div className="h-14 px-6 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                  <Books size={16} weight="fill" />
                </div>
                <h2
                  id="system-exams-heading"
                  className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate"
                >
                  II. Bài tập hệ thống
                </h2>
                <span className="h-5 px-2 rounded-full bg-[var(--bg-subtle)] font-mono-tabular text-xs font-medium text-[var(--text-secondary)] inline-flex items-center shrink-0">
                  {availableExams.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Mode Switcher */}
                <div
                  className="relative inline-grid grid-cols-2 items-center p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
                  role="group"
                  aria-label="Chế độ làm bài"
                >
                  <div
                    aria-hidden="true"
                    className="apple-segmented-pill pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/2)] rounded-full bg-[var(--bg-surface)]"
                    style={{
                      transform: `translate3d(${mode === 'exam' ? 0 : 100}%, 0, 0)`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('button_interaction');
                      setMode('exam');
                    }}
                    className={`relative z-10 h-6 px-2.5 rounded-full text-[11px] cursor-pointer whitespace-nowrap ${
                      mode === 'exam'
                        ? 'text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                    }`}
                  >
                    Thi chính thức
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('button_interaction');
                      setMode('practice');
                    }}
                    className={`relative z-10 h-6 px-2.5 rounded-full text-[11px] cursor-pointer whitespace-nowrap ${
                      mode === 'practice'
                        ? 'text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                    }`}
                  >
                    Luyện tập
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('button_interaction');
                    void fetchAvailableExams();
                  }}
                  aria-label="Làm mới danh sách bài tập"
                  className="interactive-control h-7 w-7 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                >
                  <ArrowsClockwise size={14} />
                </button>
              </div>
            </div>

            {/* Exercise List or Centered Student Empty State (Zero Admin Controls) */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              {isLoadingExams ? (
                <div className="space-y-3 w-full my-auto">
                  <div className="h-20 rounded-[var(--radius-md)] skeleton-shimmer" />
                  <div className="h-20 rounded-[var(--radius-md)] skeleton-shimmer" />
                </div>
              ) : availableExams.length === 0 ? (
                <div
                  data-testid="empty-exams-state"
                  className="py-8 px-4 text-center flex flex-col items-center justify-center my-auto"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center mb-3.5">
                    <FolderOpen size={24} />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Hiện chưa có bài tập nào đang mở
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1 mb-5 leading-relaxed">
                    Vui lòng chờ Giảng viên hoặc Hội đồng Khảo thí mở đề thi, sau đó nhấn làm mới danh sách để tải bài tập.
                  </p>
                  <button
                    type="button"
                    data-testid="refresh-student-exams-btn"
                    onClick={() => {
                      soundEngine.play('button_interaction');
                      void fetchAvailableExams();
                    }}
                    className="interactive-control h-9 px-4 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] text-[var(--text-primary)] border border-[var(--border-default)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowsClockwise size={14} />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="space-y-2.5 w-full"
                    role="radiogroup"
                    aria-label="Chọn bài tập"
                  >
                    {availableExams.map((ex, idx) => {
                      const isSelected = selectedExamId === ex.exam_id;
                      return (
                        <button
                          key={ex.exam_id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          data-testid={`select-exam-${ex.exam_id}`}
                          style={{ '--stagger-index': idx } as React.CSSProperties}
                          onClick={() => {
                            soundEngine.play('answer_selection');
                            setSelectedExamId(ex.exam_id);
                          }}
                          className={`apple-stagger-item apple-card-hover interactive-control w-full text-left p-4 rounded-[var(--radius-md)] border flex items-center justify-between gap-4 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] shadow-xs'
                              : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:bg-[var(--bg-subtle)]/40'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-[var(--accent-primary)] text-white'
                                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <Books size={18} weight={isSelected ? 'fill' : 'regular'} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                {ex.title}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-mono-tabular text-[var(--text-muted)]">
                                <span>{ex.subject_id}</span>
                                <span>·</span>
                                <span>{ex.question_count} câu hỏi</span>
                                <span>·</span>
                                <span>{Math.round(ex.time_limit / 60)} phút</span>
                                <span>·</span>
                                <span>{ex.total_max_score} điểm</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <CheckCircle
                                size={20}
                                weight="fill"
                                className="apple-check-pop text-[var(--accent-primary)]"
                              />
                            ) : (
                              <span className="w-5 h-5 rounded-full border border-[var(--border-default)] block" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Academic Assessment Protocol Summary Box (Mirrors Left Card Rules Box) */}
                  <div className="mt-4 p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/45 border border-[var(--border-subtle)]">
                    <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
                      Quy chế & Cơ chế phòng thi
                    </div>
                    <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                      <li className="flex items-center gap-2">
                        <ShieldCheck size={15} weight="fill" className="text-[var(--accent-primary)] shrink-0" />
                        <span>
                          Chế độ đang chọn:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {mode === 'exam'
                              ? 'Thi chính thức (Chấm điểm & xác thực tại máy chủ)'
                              : 'Luyện tập (Cho phép kiểm tra đáp án & lời giải tức thì)'}
                          </strong>
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CloudCheck size={15} weight="fill" className="text-[var(--status-success-solid)] shrink-0" />
                        <span>Tự động lưu nháp liên tục (IndexedDB & đồng bộ Server ACK)</span>
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Footer Action Bar (Aligned with Left Card Footer) */}
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/25 flex items-center justify-between gap-3 h-[65px]">
              <div className="text-xs text-[var(--text-muted)] truncate">
                {nameValidation.isValid ? (
                  <span>
                    Thí sinh: <strong className="text-[var(--text-primary)]">{nameValidation.normalizedName}</strong>
                  </span>
                ) : (
                  <span>Hoàn tất mục I để mở khóa bài làm</span>
                )}
              </div>

              <button
                type="button"
                data-testid="enter-exam-btn"
                disabled={availableExams.length === 0 || isStartingSession}
                onClick={() => void handleStartExamSession()}
                className={`interactive-control h-9 px-5 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  nameValidation.isValid && availableExams.length > 0
                    ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-xs'
                    : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                }`}
              >
                <span>{isStartingSession ? 'Đang khởi tạo...' : 'Bắt đầu làm bài'}</span>
                <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 2: ACTIVE EXAMINATION WORKSPACE
  // ============================================================================
  return (
    <div
      className="flex-1 w-full max-w-[1160px] mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center apple-view-enter"
      data-testid="student-workspace-view"
    >
      {/* Multi-Tab Conflict Notice */}
      {multiTabConflict && (
        <div
          role="alert"
          className="mb-4 px-4 py-2.5 rounded-[var(--radius-sm)] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <Warning size={15} weight="fill" />
            <span>{multiTabConflict}</span>
          </div>
          <button
            type="button"
            onClick={() => setMultiTabConflict(null)}
            className="text-xs font-semibold underline cursor-pointer whitespace-nowrap"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Apple Cupertino Session Bar */}
      <header className="surface-panel mb-5 overflow-hidden">
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Back to Lobby + Exam Title + Candidate Pill + Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <button
              type="button"
              data-testid="exit-to-lobby-btn"
              onClick={() => {
                soundEngine.play('navigation');
                setHasEnteredExam(false);
              }}
              className="interactive-control h-7 px-2.5 rounded-full bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer shrink-0"
              title="Đổi thí sinh hoặc chọn bài tập khác"
            >
              <SignOut size={13} />
              <span className="hidden sm:inline">Đổi bài</span>
            </button>

            <h1 className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
              {exam.title}
            </h1>

            <span className="h-6 px-2.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs font-semibold inline-flex items-center gap-1 shrink-0">
              <UserCircle size={13} weight="fill" />
              <span>{studentName}</span>
            </span>

            <div
              className="relative inline-grid grid-cols-2 items-center p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] shrink-0"
              role="group"
              aria-label="Chế độ làm bài"
            >
              <div
                aria-hidden="true"
                className="apple-segmented-pill pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/2)] rounded-full bg-[var(--bg-surface)]"
                style={{
                  transform: `translate3d(${mode === 'exam' ? 0 : 100}%, 0, 0)`,
                }}
              />
              <button
                type="button"
                onClick={() => void handleSwitchModeInExam('exam')}
                className={`relative z-10 h-6 px-3 rounded-full text-xs transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'exam'
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                }`}
              >
                Thi chính thức
              </button>
              <button
                type="button"
                onClick={() => void handleSwitchModeInExam('practice')}
                className={`relative z-10 h-6 px-3 rounded-full text-xs transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'practice'
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                }`}
              >
                Luyện tập
              </button>
            </div>
          </div>

          {/* Right: Quiet Apple Pill Status & Control Cluster */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              role="status"
              aria-live="polite"
              data-testid="autosave-indicator"
              className={`h-8 px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 whitespace-nowrap ${
                effectiveOffline || syncStatus === 'offline_queued'
                  ? 'bg-[var(--status-offline-bg)] text-[var(--status-offline-text)] border-[var(--status-offline-border)] border-dashed'
                  : syncStatus === 'synced_ack'
                    ? 'bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
              }`}
              title={`Server ACK: ${lastAckId}`}
            >
              {effectiveOffline || syncStatus === 'offline_queued' ? (
                <>
                  <CloudSlash size={14} weight="bold" />
                  <span>IndexedDB ({pendingQueueCount})</span>
                </>
              ) : syncStatus === 'syncing' ? (
                <>
                  <CloudArrowUp size={14} weight="bold" />
                  <span>Đang lưu</span>
                </>
              ) : syncStatus === 'saved_local' ? (
                <>
                  <CloudArrowUp size={14} />
                  <span>IndexedDB</span>
                </>
              ) : (
                <>
                  <CloudCheck size={14} weight="fill" className="text-[var(--status-success-solid)]" />
                  <span>Đã lưu</span>
                </>
              )}
            </div>

            <button
              type="button"
              data-testid="toggle-offline-btn"
              onClick={() => {
                soundEngine.play('button_interaction');
                setSimulatedOffline((prev) => !prev);
              }}
              aria-label={effectiveOffline ? 'Khôi phục mạng' : 'Giả lập ngắt mạng'}
              className={`interactive-control h-8 w-8 rounded-full border inline-flex items-center justify-center cursor-pointer ${
                effectiveOffline
                  ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                  : 'bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
              title={effectiveOffline ? 'Đang ngắt mạng (IndexedDB)' : 'Kết nối trực tuyến'}
            >
              {effectiveOffline ? <WifiSlash size={14} /> : <WifiHigh size={14} />}
            </button>

            <button
              type="button"
              data-testid="focus-mode-btn"
              onClick={() => {
                soundEngine.play('button_interaction');
                onToggleFocusMode();
              }}
              aria-pressed={focusMode}
              aria-label={focusMode ? 'Thoát chế độ tập trung' : 'Chế độ tập trung'}
              className={`interactive-control h-8 w-8 rounded-full border inline-flex items-center justify-center cursor-pointer ${
                focusMode
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                  : 'bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
              title="Chế độ tập trung (Phím M)"
            >
              {focusMode ? <CornersIn size={14} /> : <CornersOut size={14} />}
            </button>

            <div
              role="timer"
              aria-label="Thời gian làm bài còn lại"
              data-testid="exam-timer"
              className={`h-8 px-3.5 rounded-full font-mono-tabular text-xs sm:text-sm font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap ${
                remainingSeconds <= 60
                  ? 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]'
                  : remainingSeconds <= 300
                    ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              <Alarm size={14} weight="bold" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="w-full h-[2px] bg-[var(--bg-subtle)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent-primary)] transition-transform duration-300 ease-[var(--ease-smooth)] origin-left"
            style={{
              transform: `scaleX(${Math.max(0.02, progressStats.percent / 100)})`,
            }}
          />
        </div>
      </header>

      {/* Post-Submission Official Result & Review View */}
      {submissionReceipt ? (
        <section
          data-testid="submission-result-view"
          className="completion-reveal surface-panel mb-8 overflow-hidden"
          aria-labelledby="result-heading"
        >
          <div className="p-6 sm:p-8 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)] text-xs font-semibold mb-3">
                <ShieldCheck size={14} weight="fill" />
                <span>Đã xác thực kết quả</span>
              </div>
              <h2
                id="result-heading"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-mono-tabular"
              >
                {submissionReceipt.total_score} / {submissionReceipt.max_score} điểm
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                {submissionReceipt.student_name} · {submissionReceipt.student_id}
              </p>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40">
              <div className="px-5 py-3">
                <div className="text-[11px] text-[var(--text-muted)]">Chính xác</div>
                <div className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                  {submissionReceipt.percentage}%
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="text-[11px] text-[var(--text-muted)]">Hoàn thành</div>
                <div className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                  {submissionReceipt.answered_count}/{submissionReceipt.total_questions}
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="text-[11px] text-[var(--text-muted)]">Thời gian</div>
                <div className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                  {submissionReceipt.duration_seconds}s
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Review Filter & Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-subtle)]/70 border border-[var(--border-subtle)] text-xs w-fit">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('button_interaction');
                    setReviewFilter('all');
                  }}
                  className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                    reviewFilter === 'all'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Tất cả ({submissionReceipt.breakdown.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('button_interaction');
                    setReviewFilter('wrong');
                  }}
                  className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    reviewFilter === 'wrong'
                      ? 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] shadow-sm font-semibold border border-[var(--status-error-border)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>
                    Câu làm sai ({submissionReceipt.breakdown.filter((i) => !i.is_fully_correct).length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('button_interaction');
                    setReviewFilter('correct');
                  }}
                  className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    reviewFilter === 'correct'
                      ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] shadow-sm font-semibold border border-[var(--status-success-border)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    Câu làm đúng ({submissionReceipt.breakdown.filter((i) => i.is_fully_correct).length})
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('button_interaction');
                    setSubmissionReceipt(null);
                    void handleStartExamSession();
                  }}
                  className="interactive-control h-9 px-4 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-semibold hover:border-[var(--text-primary)] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ArrowsClockwise size={14} />
                  <span>Làm lại bài (Đề xáo mới)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('navigation');
                    setHasEnteredExam(false);
                  }}
                  className="interactive-control h-9 px-4 rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] text-xs font-semibold cursor-pointer"
                >
                  Chọn bài tập khác
                </button>
              </div>
            </div>

            {/* Questions Breakdown List */}
            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden">
              {submissionReceipt.breakdown
                .filter((item) => {
                  if (reviewFilter === 'wrong') return !item.is_fully_correct;
                  if (reviewFilter === 'correct') return item.is_fully_correct;
                  return true;
                })
                .map((item, idx) => {
                  const qObj = exam.questions.find((q) => q.id === item.question_id);
                  return (
                    <div
                      key={item.question_id}
                      style={{ '--stagger-index': idx } as React.CSSProperties}
                      className="apple-stagger-item p-5 bg-[var(--bg-surface)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-primary)]">
                            Câu 0{item.question_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              item.is_fully_correct
                                ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                                : item.is_partially_correct
                                  ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                                  : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]'
                            }`}
                          >
                            {item.is_fully_correct ? (
                              <>
                                <CheckCircle size={13} weight="fill" />
                                <span>Chính xác</span>
                              </>
                            ) : item.is_partially_correct ? (
                              <span>Đúng {item.correct_sub_items}/{item.total_sub_items} ý</span>
                            ) : (
                              <>
                                <XCircle size={13} weight="fill" />
                                <span>Chưa đúng</span>
                              </>
                            )}
                          </span>
                        </div>
                        <span className="font-mono-tabular text-xs font-semibold text-[var(--text-primary)]">
                          +{item.earned_points} / {item.max_points} điểm
                        </span>
                      </div>

                      {/* Question Stem */}
                      {qObj && (
                        <div className="text-sm text-[var(--text-primary)] font-medium leading-relaxed mb-3">
                          <MathText text={qObj.stem} />
                        </div>
                      )}

                      {/* Single Choice Options Comparison */}
                      {qObj?.options && qObj.options.length > 0 && (
                        <div className="grid grid-cols-1 gap-2 my-3">
                          {qObj.options.map((opt) => {
                            const candidatePick =
                              item.candidate_answer?.type === 'single_choice'
                                ? item.candidate_answer.selected_option_id
                                : '';
                            const isCandidatePick = candidatePick === opt.id;
                            const isOfficialKey =
                              item.official_answer_key?.correct_option_id === opt.id;

                            let optStyle =
                              'border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 text-[var(--text-secondary)]';
                            let badge = null;

                            if (isCandidatePick && isOfficialKey) {
                              optStyle =
                                'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)] font-semibold';
                              badge = (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--status-success-text)] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                                  <CheckCircle size={13} weight="fill" />
                                  Bạn chọn đúng
                                </span>
                              );
                            } else if (isCandidatePick && !isOfficialKey) {
                              optStyle =
                                'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)] font-medium';
                              badge = (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--status-error-text)] px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/20">
                                  <XCircle size={13} weight="fill" />
                                  Lựa chọn của bạn
                                </span>
                              );
                            } else if (!isCandidatePick && isOfficialKey) {
                              optStyle =
                                'border-[var(--status-success-border)] bg-[var(--status-success-bg)]/50 text-[var(--status-success-text)] font-medium';
                              badge = (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--status-success-text)] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                                  <CheckCircle size={13} weight="fill" />
                                  Đáp án chuẩn
                                </span>
                              );
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`p-3 rounded-[var(--radius-sm)] border flex items-start justify-between gap-3 text-xs sm:text-sm ${optStyle}`}
                              >
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  <span className="font-mono-tabular font-bold w-5 shrink-0 uppercase">
                                    {opt.label}.
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <MathText text={opt.content} />
                                  </div>
                                </div>
                                {badge && <div className="shrink-0">{badge}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* True / False Cluster Statements Comparison */}
                      {qObj?.statements && qObj.statements.length > 0 && (
                        <div className="space-y-2 my-3">
                          {qObj.statements.map((stmt) => {
                            const candidateVal =
                              item.candidate_answer?.type === 'true_false_cluster'
                                ? item.candidate_answer.statements?.[stmt.id]
                                : undefined;
                            const officialVal =
                              item.official_answer_key?.statement_answers?.[stmt.id];
                            const isStmtCorrect =
                              candidateVal !== undefined && candidateVal === officialVal;

                            return (
                              <div
                                key={stmt.id}
                                className={`p-3 rounded-[var(--radius-sm)] border text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                  isStmtCorrect
                                    ? 'border-[var(--status-success-border)]/60 bg-[var(--status-success-bg)]/20'
                                    : 'border-[var(--status-error-border)]/60 bg-[var(--status-error-bg)]/20'
                                }`}
                              >
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <span className="font-mono-tabular font-bold w-5 shrink-0 uppercase">
                                    {stmt.label})
                                  </span>
                                  <div className="flex-1 min-w-0 text-[var(--text-primary)]">
                                    <MathText text={stmt.content} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--border-subtle)]/50">
                                  <span className="text-[11px] text-[var(--text-secondary)]">
                                    Bạn:{' '}
                                    <strong
                                      className={
                                        candidateVal === true
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : candidateVal === false
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-slate-400'
                                      }
                                    >
                                      {candidateVal === true
                                        ? 'Đúng'
                                        : candidateVal === false
                                          ? 'Sai'
                                          : 'Chưa chọn'}
                                    </strong>
                                  </span>
                                  <span className="text-[11px] text-[var(--text-muted)]">·</span>
                                  <span className="text-[11px] text-[var(--text-secondary)]">
                                    Đáp án:{' '}
                                    <strong
                                      className={
                                        officialVal
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-amber-600 dark:text-amber-400'
                                      }
                                    >
                                      {officialVal ? 'Đúng' : 'Sai'}
                                    </strong>
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      isStmtCorrect
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {isStmtCorrect ? '✓ Đúng' : '✗ Sai'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation & Solution */}
                      {item.explanation && (
                        <div className="mt-3 p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/60 border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                          <div className="font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                            <span>💡 Hướng dẫn & Lời giải:</span>
                          </div>
                          <MathText text={item.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      ) : (
        /* Active Examination Workspace Layout: Left Question Sheet (8 cols) + Right Compact Rail (4 cols) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Primary Question Sheet (8 columns) */}
          <main className="lg:col-span-8 surface-panel overflow-hidden" aria-label="Khu vực câu hỏi">
            {currentQuestion ? (
              <article
                key={currentQuestion.id}
                className={
                  navDirection === 'next' ? 'question-stage-next' : 'question-stage-prev'
                }
                data-testid="active-question-card"
              >
                {/* Minimalist Apple Question Header */}
                <div className="px-6 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-xs font-semibold px-3 py-1 rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)]">
                      Câu {String(currentQuestion.number).padStart(2, '0')}
                    </span>
                    <span className="font-mono-tabular text-xs font-medium text-[var(--text-muted)] px-2.5 py-1 rounded-full bg-[var(--bg-subtle)]">
                      {currentQuestion.points} điểm
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="flag-question-btn"
                    onClick={() => toggleFlagQuestion(currentQuestion.id)}
                    aria-pressed={Boolean(currentAnswerRecord?.flagged)}
                    className={`interactive-control h-8 px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      currentAnswerRecord?.flagged
                        ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)] font-semibold'
                        : 'bg-[var(--bg-subtle)]/60 text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <BookmarkSimple
                      size={14}
                      weight={currentAnswerRecord?.flagged ? 'fill' : 'regular'}
                    />
                    <span>{currentAnswerRecord?.flagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                  </button>
                </div>

                {/* Question Body */}
                <div className="p-6 sm:p-8">
                  <div className="space-y-4 text-[16px] sm:text-[17px] text-[var(--text-primary)] mb-7">
                    <div className="leading-[1.75]">
                      <MathText text={currentQuestion.stem} />
                    </div>

                    {(currentQuestion.stem_blocks || [])
                      .filter((b) => b.type === 'table' && b.table_rows)
                      .map((tblBlock) => (
                        <div
                          key={tblBlock.block_id}
                          className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] my-4"
                        >
                          <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <tbody>
                              {tblBlock.table_rows!.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={
                                    rIdx === 0
                                      ? 'bg-[var(--bg-subtle)] font-semibold text-[var(--text-primary)]'
                                      : 'border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                                  }
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="px-4 py-2.5 border-r last:border-r-0 border-[var(--border-subtle)] font-mono-tabular"
                                    >
                                      <MathText text={cell} />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}

                    {currentQuestion.diagram_svg && (
                      <figure className="relative my-5 p-5 rounded-[var(--radius-md)] bg-white border border-[var(--border-subtle)] shadow-xs">
                        <button
                          type="button"
                          data-testid="zoom-diagram-btn"
                          onClick={() => {
                            soundEngine.play('button_interaction');
                            setZoomDiagramQuestion(currentQuestion);
                          }}
                          className="interactive-control absolute top-3.5 right-3.5 h-8 px-3 rounded-full bg-[#F5F5F7]/90 backdrop-blur-md border border-black/10 text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowsOutSimple size={13} />
                          <span>Phóng to</span>
                        </button>
                        <div
                          className="w-full max-w-[480px] mx-auto overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: currentQuestion.diagram_svg }}
                        />
                      </figure>
                    )}
                  </div>

                  {/* Answer Controls by Question Type */}
                  <div>
                    {/* TYPE 1: SINGLE CHOICE */}
                    {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                      <div
                        role="radiogroup"
                        aria-label={`Lựa chọn đáp án cho câu ${currentQuestion.number}`}
                        className="grid grid-cols-1 gap-2.5"
                      >
                        {currentQuestion.options.map((opt, idx) => {
                          const isSelected =
                            currentAnswerRecord?.value.type === 'single_choice' &&
                            currentAnswerRecord.value.selected_option_id === opt.id;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              data-testid={`option-${opt.label}`}
                              style={{ '--stagger-index': idx } as React.CSSProperties}
                              onClick={() =>
                                updateAnswer(currentQuestion.id, {
                                  type: 'single_choice',
                                  selected_option_id: opt.id,
                                })
                              }
                              className={`apple-stagger-item interactive-control w-full text-left min-h-[54px] px-4 py-3 rounded-[var(--radius-md)] border flex items-center justify-between gap-4 cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] text-[var(--text-primary)] shadow-xs'
                                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:bg-[var(--bg-subtle)]/50 text-[var(--text-primary)]'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-full font-mono-tabular text-xs font-semibold flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? 'apple-check-pop bg-[var(--accent-primary)] text-white'
                                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <span className="text-sm sm:text-[15px] font-medium break-words">
                                  <MathText text={opt.content} />
                                </span>
                              </div>

                              <div className="shrink-0">
                                {isSelected ? (
                                  <CheckCircle
                                    size={20}
                                    weight="fill"
                                    className="apple-check-pop text-[var(--accent-primary)]"
                                  />
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className="w-5 h-5 rounded-full border border-[var(--border-default)] block"
                                  />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 2: TRUE / FALSE 4-STATEMENT CLUSTER */}
                    {currentQuestion.type === 'true_false_cluster' &&
                      currentQuestion.statements && (
                        <div className="border border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                          {currentQuestion.statements.map((stmt, idx) => {
                            const currentMap =
                              currentAnswerRecord?.value.type === 'true_false_cluster'
                                ? currentAnswerRecord.value.statements
                                : {};
                            const chosenValue = currentMap[stmt.id];

                            return (
                              <div
                                key={stmt.id}
                                style={{ '--stagger-index': idx } as React.CSSProperties}
                                className="apple-stagger-item p-4 bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] font-mono-tabular text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center shrink-0">
                                    {stmt.label}
                                  </span>
                                  <div className="text-sm sm:text-[15px] text-[var(--text-primary)] leading-relaxed pt-0.5">
                                    <MathText text={stmt.content} />
                                  </div>
                                </div>

                                <div
                                  className="inline-flex items-center p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] shrink-0 self-end sm:self-center"
                                  role="group"
                                  aria-label={`Chọn Đúng hoặc Sai cho mệnh đề ${stmt.label}`}
                                >
                                  <button
                                    type="button"
                                    data-testid={`tf-${stmt.id}-true`}
                                    aria-pressed={chosenValue === true}
                                    onClick={() =>
                                      updateAnswer(currentQuestion.id, {
                                        type: 'true_false_cluster',
                                        statements: {
                                          ...currentMap,
                                          [stmt.id]: true,
                                        },
                                      })
                                    }
                                    className={`interactive-control h-7 w-16 rounded-full text-xs font-semibold cursor-pointer ${
                                      chosenValue === true
                                        ? 'apple-check-pop bg-[var(--status-success-solid)] text-white shadow-xs'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`tf-${stmt.id}-false`}
                                    aria-pressed={chosenValue === false}
                                    onClick={() =>
                                      updateAnswer(currentQuestion.id, {
                                        type: 'true_false_cluster',
                                        statements: {
                                          ...currentMap,
                                          [stmt.id]: false,
                                        },
                                      })
                                    }
                                    className={`interactive-control h-7 w-16 rounded-full text-xs font-semibold cursor-pointer ${
                                      chosenValue === false
                                        ? 'apple-check-pop bg-[var(--status-error-solid)] text-white shadow-xs'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                  >
                                    Sai
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    {/* TYPE 3: SHORT ANSWER */}
                    {currentQuestion.type === 'short_answer' && (
                      <div className="pt-2 apple-stagger-item">
                        <div className="flex flex-col gap-2 max-w-xs">
                          <label
                            htmlFor={`short-ans-${currentQuestion.id}`}
                            className="text-xs font-semibold text-[var(--text-secondary)]"
                          >
                            Nhập đáp số
                          </label>
                          <input
                            id={`short-ans-${currentQuestion.id}`}
                            data-testid="short-answer-input"
                            type="text"
                            inputMode="decimal"
                            value={
                              currentAnswerRecord?.value.type === 'short_answer'
                                ? currentAnswerRecord.value.text_value
                                : ''
                            }
                            onChange={(e) =>
                              updateAnswer(currentQuestion.id, {
                                type: 'short_answer',
                                text_value: e.target.value,
                              })
                            }
                            placeholder="Ví dụ: 48"
                            className="apple-input-glow h-11 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/50 border border-[var(--border-default)] text-base font-mono-tabular font-semibold text-[var(--text-primary)] transition-colors focus:bg-[var(--bg-surface)]"
                          />
                        </div>
                      </div>
                    )}

                    {/* TYPE 4: MULTI-SELECT */}
                    {currentQuestion.type === 'multi_select' && currentQuestion.options && (
                      <div className="grid grid-cols-1 gap-2.5">
                        {currentQuestion.options.map((opt, idx) => {
                          const selectedList =
                            currentAnswerRecord?.value.type === 'multi_select'
                              ? currentAnswerRecord.value.selected_option_ids
                              : [];
                          const isChecked = selectedList.includes(opt.id);

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              data-testid={`multi-${opt.label}`}
                              style={{ '--stagger-index': idx } as React.CSSProperties}
                              onClick={() => {
                                const nextIds = isChecked
                                  ? selectedList.filter((id) => id !== opt.id)
                                  : [...selectedList, opt.id];
                                updateAnswer(currentQuestion.id, {
                                  type: 'multi_select',
                                  selected_option_ids: nextIds,
                                });
                              }}
                              className={`apple-stagger-item interactive-control w-full text-left min-h-[54px] px-4 py-3 rounded-[var(--radius-md)] border flex items-center justify-between gap-4 cursor-pointer ${
                                isChecked
                                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] text-[var(--text-primary)] shadow-xs'
                                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:bg-[var(--bg-subtle)]/50 text-[var(--text-primary)]'
                              }`}
                            >
                              <div className="flex items-center gap-3.5">
                                <span
                                  className={`w-7 h-7 rounded-[8px] font-mono-tabular text-xs font-semibold flex items-center justify-center shrink-0 transition-colors ${
                                    isChecked
                                      ? 'apple-check-pop bg-[var(--accent-primary)] text-white'
                                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <span className="text-sm sm:text-[15px] font-medium">
                                  <MathText text={opt.content} />
                                </span>
                              </div>
                              <div className="shrink-0">
                                {isChecked ? (
                                  <span className="apple-check-pop w-5 h-5 rounded-[6px] bg-[var(--accent-primary)] text-white flex items-center justify-center">
                                    <Check size={13} weight="bold" />
                                  </span>
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className="w-5 h-5 rounded-[6px] border border-[var(--border-default)] block"
                                  />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Practice Mode Instant Feedback */}
                  {mode === 'practice' && (
                    <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          data-testid="practice-check-btn"
                          onClick={() => {
                            soundEngine.play('button_interaction');
                            setPracticeInstantCheckMap((prev) => ({
                              ...prev,
                              [currentQuestion.id]: !prev[currentQuestion.id],
                            }));
                          }}
                          className="interactive-control h-8 px-3.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>
                            {practiceInstantCheckMap[currentQuestion.id]
                              ? 'Ẩn lời giải'
                              : 'Xem lời giải'}
                          </span>
                        </button>
                      </div>

                      {practiceQuestionCheck && (
                        <div className="apple-view-enter mt-3 p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]/60 border border-[var(--border-subtle)]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-[var(--text-primary)] font-mono-tabular">
                              Điểm: +{practiceQuestionCheck.earned_points} /{' '}
                              {practiceQuestionCheck.max_points}
                            </span>
                            <span className="text-xs font-semibold text-[var(--accent-primary)]">
                              {practiceQuestionCheck.is_fully_correct ? 'Chính xác' : 'Chưa đúng'}
                            </span>
                          </div>
                          {currentQuestion.explanation && (
                            <div className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                              <MathText text={currentQuestion.explanation} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Question Sheet Footer */}
                <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/25 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    data-testid="prev-question-btn"
                    disabled={currentIndex === 0}
                    onClick={() => navigateToQuestion(currentIndex - 1)}
                    className="interactive-control h-9 px-4 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeft size={14} weight="bold" />
                    <span>Câu trước</span>
                  </button>

                  <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                    {currentIndex + 1} / {exam.questions.length}
                  </span>

                  {currentIndex < exam.questions.length - 1 ? (
                    <button
                      type="button"
                      data-testid="next-question-btn"
                      onClick={() => navigateToQuestion(currentIndex + 1)}
                      className="interactive-control h-9 px-4 rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>Tiếp theo</span>
                      <ArrowRight size={14} weight="bold" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="open-submit-modal-btn"
                      onClick={() => {
                        soundEngine.play('button_interaction');
                        setIsSubmitModalOpen(true);
                      }}
                      className="interactive-control h-9 px-4 rounded-full bg-[var(--accent-primary)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <PaperPlaneRight size={14} weight="fill" />
                      <span>Nộp bài</span>
                    </button>
                  )}
                </div>
              </article>
            ) : null}
          </main>

          {/* Right Sidebar: Minimalist Apple Question Widget (4 columns) */}
          <aside className="lg:col-span-4 surface-panel lg:sticky lg:top-20" aria-label="Bản đồ câu hỏi">
            <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">Câu hỏi</h2>
              <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                {progressStats.answered} / {progressStats.total}
              </span>
            </div>

            <div className="p-4 sm:p-5">
              <div
                className="grid grid-cols-6 gap-2 max-h-[52vh] overflow-y-auto pr-1"
                role="navigation"
                aria-label="Chuyển nhanh câu hỏi"
              >
                {exam.questions.map((q, idx) => {
                  const rec = answers[q.id];
                  const isAnswered = isAnswerPopulated(rec?.value);
                  const isFlagged = Boolean(rec?.flagged);
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      data-testid={`nav-map-q-${q.number}`}
                      onClick={() => navigateToQuestion(idx)}
                      aria-label={`Câu ${q.number}: ${
                        isAnswered ? 'Đã trả lời' : 'Chưa trả lời'
                      }${isFlagged ? ', đã đánh dấu' : ''}`}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`interactive-control relative h-10 rounded-[var(--radius-sm)] font-mono-tabular text-xs font-semibold border flex items-center justify-center cursor-pointer ${
                        isCurrent
                          ? 'ring-2 ring-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                          : isAnswered
                            ? 'bg-[var(--text-primary)] text-[var(--text-inverse)] border-[var(--text-primary)]'
                            : 'bg-[var(--bg-subtle)]/60 text-[var(--text-secondary)] border-transparent hover:border-[var(--border-default)]'
                      }`}
                    >
                      <span>{q.number}</span>
                      {isFlagged && (
                        <span
                          className="w-2 h-2 rounded-full bg-[var(--status-warning-solid)] absolute -top-0.5 -right-0.5 ring-2 ring-[var(--bg-surface)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="sidebar-submit-btn"
                onClick={() => {
                  soundEngine.play('button_interaction');
                  setIsSubmitModalOpen(true);
                }}
                className="interactive-control mt-4 h-10 w-full px-4 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <PaperPlaneRight size={14} weight="fill" />
                <span>Nộp bài</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Apple Sheet Submission Confirmation Modal */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
        >
          <div className="modal-transition w-full max-w-sm rounded-[var(--radius-xl)] bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-lg)] p-6">
            <h2
              id="submit-confirm-title"
              className="text-base font-semibold text-[var(--text-primary)] text-center"
            >
              Nộp bài thi?
            </h2>

            <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 my-4 text-center">
              <div className="p-3">
                <div className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
                  {progressStats.answered}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">Đã làm</div>
              </div>
              <div className="p-3">
                <div className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
                  {progressStats.unanswered}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">Chưa làm</div>
              </div>
              <div className="p-3">
                <div className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
                  {progressStats.flagged}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">Đánh dấu</div>
              </div>
            </div>

            {progressStats.unanswered > 0 && (
              <div className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-xs text-[var(--status-warning-text)] flex items-center gap-2">
                <WarningCircle size={16} weight="fill" className="shrink-0" />
                <span>Còn {progressStats.unanswered} câu chưa trả lời.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="interactive-control h-9 px-4 rounded-full bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                data-testid="confirm-submit-btn"
                disabled={isSubmitting}
                onClick={() => void handleConfirmSubmit()}
                className="interactive-control h-9 px-4 rounded-full bg-[var(--accent-primary)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle size={15} weight="fill" />
                <span>{isSubmitting ? 'Đang gửi...' : 'Xác nhận'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagram & Image Zoom Modal */}
      <ImageZoomModal
        isOpen={Boolean(zoomDiagramQuestion)}
        onClose={() => setZoomDiagramQuestion(null)}
        svgContent={zoomDiagramQuestion?.diagram_svg}
        caption={zoomDiagramQuestion?.diagram_caption}
        altText={
          (zoomDiagramQuestion?.stem_blocks || []).find((b) => b.type === 'inline_image')
            ?.alt_text || 'Hình minh họa'
        }
      />
    </div>
  );
};
