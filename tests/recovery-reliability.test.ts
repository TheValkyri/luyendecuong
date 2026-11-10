/**
 * Section 6.3 & Section 7: Recovery & Reliability Tests
 * - Reload & browser crash recovery via IndexedDB / mirror store
 * - Offline queue & restoration sync
 * - Exponential backoff with full jitter
 * - Multi-tab conflict resolution (monotonic sequence number & client timestamp)
 * - Duplicate event & idempotency protection
 */

import { describe, expect, it } from 'vitest';
import {
  computeBackoffWithJitter,
  ExamIndexedDBStore,
  PersistedAttemptState,
  resolveAnswerConflicts,
} from '../src/lib/reliability';
import { CandidateAnswerRecord } from '../src/types/exam';

describe('Section 7: Recovery & Reliability Tests', () => {
  it('saves and recovers an in-progress attempt across reload / browser crash without losing answers', async () => {
    const store = new ExamIndexedDBStore();
    const mockState: PersistedAttemptState = {
      session_id: 'ses_recovery_test_01',
      session_token: 'tok_123',
      exam_id: 'exam_thpt_math_phys_2026_01',
      exam_version: 2,
      student_id: 'HS001',
      student_name: 'Nguyen Van A',
      mode: 'exam',
      started_at_server: 1000,
      expires_at_server: 2800000,
      clock_drift_ms: 15,
      question_order: ['q_2026_001', 'q_2026_002'],
      option_orders: {},
      answers: {
        q_2026_001: {
          question_id: 'q_2026_001',
          value: { type: 'single_choice', selected_option_id: 'q_2026_001_opt_C' },
          flagged: true,
          client_updated_at: 5000,
          sequence_number: 3,
        },
      },
      telemetry_queue: [],
      seen_event_ids: [],
      last_ack_id: 'ack_99',
      last_ack_server_timestamp: 5010,
      updated_at_local: 5005,
    };

    await store.saveAttempt(mockState);
    const latestId = await store.getLatestSessionId();
    expect(latestId).toBe('ses_recovery_test_01');

    const recovered = await store.loadAttempt('ses_recovery_test_01');
    expect(recovered).not.toBeNull();
    expect(recovered?.answers.q_2026_001.flagged).toBe(true);
    expect(recovered?.answers.q_2026_001.value).toEqual({
      type: 'single_choice',
      selected_option_id: 'q_2026_001_opt_C',
    });
  });

  it('queues sync operations while offline and removes them only upon server ACK', async () => {
    const store = new ExamIndexedDBStore();
    const sessionId = 'ses_offline_queue_01';

    await store.enqueueSyncOperation({
      idempotency_key: 'idem_op_1',
      session_id: sessionId,
      operation_type: 'autosave_sync',
      payload: { answers: {}, telemetry: [] },
      created_at: Date.now(),
      retry_count: 1,
    });

    await store.enqueueSyncOperation({
      idempotency_key: 'idem_op_2',
      session_id: sessionId,
      operation_type: 'autosave_sync',
      payload: { answers: {}, telemetry: [] },
      created_at: Date.now(),
      retry_count: 0,
    });

    const pendingBefore = await store.getPendingOperations(sessionId);
    expect(pendingBefore.length).toBe(2);

    // Simulate receiving server ACK for idem_op_1
    await store.removeSyncOperation(sessionId, 'idem_op_1');
    const pendingAfter = await store.getPendingOperations(sessionId);
    expect(pendingAfter.length).toBe(1);
    expect(pendingAfter[0].idempotency_key).toBe('idem_op_2');
  });

  it('resolves multi-tab and concurrent edit conflicts deterministically using sequence_number and timestamp', () => {
    const tabAAnswers: Record<string, CandidateAnswerRecord> = {
      q_2026_001: {
        question_id: 'q_2026_001',
        value: { type: 'single_choice', selected_option_id: 'q_2026_001_opt_A' },
        flagged: false,
        client_updated_at: 1000,
        sequence_number: 2,
      },
      q_2026_002: {
        question_id: 'q_2026_002',
        value: { type: 'single_choice', selected_option_id: 'q_2026_002_opt_C' },
        flagged: true,
        client_updated_at: 2000,
        sequence_number: 5,
      },
    };

    const tabBAnswers: Record<string, CandidateAnswerRecord> = {
      q_2026_001: {
        question_id: 'q_2026_001',
        value: { type: 'single_choice', selected_option_id: 'q_2026_001_opt_C' },
        flagged: false,
        client_updated_at: 1500,
        sequence_number: 4, // Newer sequence in Tab B
      },
      q_2026_002: {
        question_id: 'q_2026_002',
        value: { type: 'single_choice', selected_option_id: 'q_2026_002_opt_A' },
        flagged: false,
        client_updated_at: 1200,
        sequence_number: 1, // Older sequence in Tab B
      },
    };

    const merged = resolveAnswerConflicts(tabAAnswers, tabBAnswers);
    expect(merged.q_2026_001.value).toEqual({
      type: 'single_choice',
      selected_option_id: 'q_2026_001_opt_C',
    });
    expect(merged.q_2026_002.value).toEqual({
      type: 'single_choice',
      selected_option_id: 'q_2026_002_opt_C',
    });
  });

  it('computes exponential backoff with full jitter within expected bounds', () => {
    const fixedRngZero = () => 0;
    const fixedRngHalf = () => 0.5;
    const fixedRngMax = () => 0.999999;

    expect(computeBackoffWithJitter(0, 400, 10000, fixedRngZero)).toBe(0);
    expect(computeBackoffWithJitter(2, 400, 10000, fixedRngHalf)).toBe(800); // 0.5 * (400 * 4)
    expect(computeBackoffWithJitter(8, 400, 5000, fixedRngMax)).toBeLessThanOrEqual(5000);
  });
});
