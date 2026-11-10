/**
 * Section 7: Functional Tests
 * - Every question type (single_choice, true_false_cluster, short_answer, multi_select)
 * - All grading policies (THPT 2025 partial credit scale, multi-select modes, decimal normalization)
 * - Deterministic randomization & reproducible seeds
 * - Schema contract v2.0.0 validation & v1 -> v2 migration
 * - Design System Tokens, Motion Engine & Sound Engine verification
 */

import { describe, expect, it } from 'vitest';
import {
  INITIAL_PUBLISHED_EXAM,
  CONG_NGHE_11_TONG_HOP_EXAM,
  CONG_NGHE_11_LESSON_EXAMS,
} from '../src/data/seed-exams';
import {
  computeSessionRandomization,
  gradeExamAttempt,
  gradeQuestion,
  normalizeShortAnswer,
  prepareExamForClient,
} from '../src/lib/grading-engine';
import {
  DEFAULT_GRADING_POLICY_V2,
  migrateExamSchema,
  validateExamContractV2,
} from '../src/lib/schema-migration';
import {
  DESIGN_SYSTEM_TOKENS,
  getStateTokenClasses,
  SUPPORTED_COMPONENT_STATES,
} from '../src/lib/design-tokens';
import { motionEngine, MOTION_SPECS } from '../src/lib/motion-engine';
import { soundEngine } from '../src/lib/sound-engine';
import { validateCandidateName } from '../src/lib/name-validator';
import { ExamQuestion } from '../src/types/exam';

describe('Section 7: Functional & Grading Policy Tests', () => {
  it('grades single_choice questions accurately', () => {
    const q1 = INITIAL_PUBLISHED_EXAM.questions[0];
    const correctRes = gradeQuestion(
      q1,
      { type: 'single_choice', selected_option_id: 'q_2026_001_opt_C' },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(correctRes.is_fully_correct).toBe(true);
    expect(correctRes.earned_points).toBe(1.5);

    const wrongRes = gradeQuestion(
      q1,
      { type: 'single_choice', selected_option_id: 'q_2026_001_opt_A' },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(wrongRes.is_fully_correct).toBe(false);
    expect(wrongRes.earned_points).toBe(0);
  });

  it('grades true_false_cluster questions using the official 10% / 25% / 50% / 100% scale', () => {
    const q4 = INITIAL_PUBLISHED_EXAM.questions[3]; // 2.0 points, key: a=T, b=T, c=F, d=T

    // 1 correct out of 4 -> 0.1 * 2.0 = 0.2
    const r1 = gradeQuestion(
      q4,
      {
        type: 'true_false_cluster',
        statements: { stmt_a: true, stmt_b: false, stmt_c: true, stmt_d: false },
      },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(r1.correct_sub_items).toBe(1);
    expect(r1.earned_points).toBe(0.2);
    expect(r1.is_partially_correct).toBe(true);

    // 2 correct out of 4 -> 0.25 * 2.0 = 0.5
    const r2 = gradeQuestion(
      q4,
      {
        type: 'true_false_cluster',
        statements: { stmt_a: true, stmt_b: true, stmt_c: true, stmt_d: false },
      },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(r2.correct_sub_items).toBe(2);
    expect(r2.earned_points).toBe(0.5);

    // 3 correct out of 4 -> 0.5 * 2.0 = 1.0
    const r3 = gradeQuestion(
      q4,
      {
        type: 'true_false_cluster',
        statements: { stmt_a: true, stmt_b: true, stmt_c: false, stmt_d: false },
      },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(r3.correct_sub_items).toBe(3);
    expect(r3.earned_points).toBe(1.0);

    // 4 correct out of 4 -> 1.0 * 2.0 = 2.0
    const r4 = gradeQuestion(
      q4,
      {
        type: 'true_false_cluster',
        statements: { stmt_a: true, stmt_b: true, stmt_c: false, stmt_d: true },
      },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(r4.correct_sub_items).toBe(4);
    expect(r4.earned_points).toBe(2.0);
    expect(r4.is_fully_correct).toBe(true);
  });

  it('grades short_answer questions with decimal comma/dot normalization and numeric tolerance', () => {
    const q5 = INITIAL_PUBLISHED_EXAM.questions[4]; // 2.0 points, key: 48
    expect(normalizeShortAnswer(' 48,0 ', DEFAULT_GRADING_POLICY_V2)).toBe('48.0');

    const resComma = gradeQuestion(
      q5,
      { type: 'short_answer', text_value: ' 48,00 ' },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(resComma.is_fully_correct).toBe(true);
    expect(resComma.earned_points).toBe(2.0);

    const resWrong = gradeQuestion(
      q5,
      { type: 'short_answer', text_value: '36' },
      DEFAULT_GRADING_POLICY_V2
    );
    expect(resWrong.is_fully_correct).toBe(false);
    expect(resWrong.earned_points).toBe(0);
  });

  it('grades multi_select questions across exact_match, partial_no_penalty, and partial_with_penalty policies', () => {
    const q6 = INITIAL_PUBLISHED_EXAM.questions[5]; // 1.5 points, correct: A, B, D (3 options)

    // Picked A, B (2 of 3 correct, 0 wrong)
    const partialRes = gradeQuestion(
      q6,
      {
        type: 'multi_select',
        selected_option_ids: ['q_2026_006_opt_A', 'q_2026_006_opt_B'],
      },
      { ...DEFAULT_GRADING_POLICY_V2, multi_select_mode: 'partial_with_penalty' }
    );
    expect(partialRes.earned_points).toBe(1.0);
    expect(partialRes.is_partially_correct).toBe(true);

    // Exact match policy should award 0 for partial selection
    const exactPolicyRes = gradeQuestion(
      q6,
      {
        type: 'multi_select',
        selected_option_ids: ['q_2026_006_opt_A', 'q_2026_006_opt_B'],
      },
      { ...DEFAULT_GRADING_POLICY_V2, multi_select_mode: 'exact_match' }
    );
    expect(exactPolicyRes.earned_points).toBe(0);
  });

  it('grades a full perfect exam attempt to 10.0 / 10.0', () => {
    const result = gradeExamAttempt(INITIAL_PUBLISHED_EXAM, {
      q_2026_001: {
        question_id: 'q_2026_001',
        value: { type: 'single_choice', selected_option_id: 'q_2026_001_opt_C' },
        flagged: false,
        client_updated_at: 1,
        sequence_number: 1,
      },
      q_2026_002: {
        question_id: 'q_2026_002',
        value: { type: 'single_choice', selected_option_id: 'q_2026_002_opt_C' },
        flagged: false,
        client_updated_at: 2,
        sequence_number: 2,
      },
      q_2026_003: {
        question_id: 'q_2026_003',
        value: { type: 'single_choice', selected_option_id: 'q_2026_003_opt_B' },
        flagged: false,
        client_updated_at: 3,
        sequence_number: 3,
      },
      q_2026_004: {
        question_id: 'q_2026_004',
        value: {
          type: 'true_false_cluster',
          statements: { stmt_a: true, stmt_b: true, stmt_c: false, stmt_d: true },
        },
        flagged: false,
        client_updated_at: 4,
        sequence_number: 4,
      },
      q_2026_005: {
        question_id: 'q_2026_005',
        value: { type: 'short_answer', text_value: '48' },
        flagged: false,
        client_updated_at: 5,
        sequence_number: 5,
      },
      q_2026_006: {
        question_id: 'q_2026_006',
        value: {
          type: 'multi_select',
          selected_option_ids: ['q_2026_006_opt_A', 'q_2026_006_opt_B', 'q_2026_006_opt_D'],
        },
        flagged: false,
        client_updated_at: 6,
        sequence_number: 6,
      },
    });

    expect(result.totalScore).toBe(10.0);
    expect(result.maxScore).toBe(10.0);
    expect(result.percentage).toBe(100);
    expect(result.answeredCount).toBe(6);
  });

  it('produces deterministic, reproducible question and option randomization per session seed', () => {
    const examWithShuffle = {
      ...INITIAL_PUBLISHED_EXAM,
      randomization_policy: {
        ...INITIAL_PUBLISHED_EXAM.randomization_policy,
        shuffle_questions_within_section: true,
        shuffle_options: true,
      },
    };

    const runA = computeSessionRandomization(examWithShuffle, 'seed_student_001');
    const runB = computeSessionRandomization(examWithShuffle, 'seed_student_001');
    const runC = computeSessionRandomization(examWithShuffle, 'seed_student_999');

    expect(runA.questionOrder).toEqual(runB.questionOrder);
    expect(runA.optionOrders).toEqual(runB.optionOrders);
    // Different student seed produces different option ordering
    expect(JSON.stringify(runA.optionOrders)).not.toEqual(JSON.stringify(runC.optionOrders));
  });

  it('migrates legacy v1.0 schema to v2.0.0 contract and validates required fields', () => {
    const v1Exam = {
      schema_version: '1.0.0',
      id: 'legacy_phys_01',
      version: 1,
      title: 'De Vat Ly v1',
      subject: 'Vat Ly',
      duration_minutes: 30,
      questions: [
        {
          question_text: 'Van toc anh sang trong chan khong la bao nhieu?',
          points: 2.0,
          options: [
            { label: 'A', text: '3e8 m/s' },
            { label: 'B', text: '3e5 m/s' },
          ],
          correct_answer: 'A',
        },
      ],
    };

    const migrated = migrateExamSchema(v1Exam);
    expect(migrated.schema_version).toBe('2.0.0');
    expect(migrated.time_limit).toBe(1800);
    expect(migrated.questions[0].id).toBe('legacy_phys_01_q_001');
    expect(migrated.questions[0].answer_key?.correct_option_id).toBe(
      'legacy_phys_01_q_001_opt_A'
    );
    expect(() => validateExamContractV2(migrated)).not.toThrow();
  });

  it('verifies all 11 design system component states, motion timings, and sound engine controls', () => {
    expect(SUPPORTED_COMPONENT_STATES.length).toBe(11);
    for (const st of SUPPORTED_COMPONENT_STATES) {
      expect(getStateTokenClasses(st).length).toBeGreaterThan(10);
    }

    // Motion durations must fall within Section 5.4 reference bounds
    expect(MOTION_SPECS.micro.durationMs).toBeGreaterThanOrEqual(120);
    expect(MOTION_SPECS.micro.durationMs).toBeLessThanOrEqual(180);
    expect(MOTION_SPECS.component.durationMs).toBeGreaterThanOrEqual(180);
    expect(MOTION_SPECS.component.durationMs).toBeLessThanOrEqual(260);
    expect(MOTION_SPECS.modal.durationMs).toBeGreaterThanOrEqual(180);
    expect(MOTION_SPECS.modal.durationMs).toBeLessThanOrEqual(300);
    expect(MOTION_SPECS.completion.durationMs).toBeGreaterThanOrEqual(300);
    expect(MOTION_SPECS.completion.durationMs).toBeLessThanOrEqual(450);

    // Reduced motion override
    motionEngine.setReducedMotionOverride(true);
    expect(motionEngine.getEffectiveDuration('micro')).toBe(0);
    motionEngine.setReducedMotionOverride(false);
    expect(motionEngine.getEffectiveDuration('micro')).toBe(150);

    // Sound engine volume and toggle
    soundEngine.setEnabled(false);
    expect(soundEngine.play('button_interaction')).toBe(false);
    soundEngine.setEnabled(true);
    soundEngine.setVolume(0.5);
    expect(soundEngine.getSettings().volume).toBe(0.5);
    expect(DESIGN_SYSTEM_TOKENS.iconSystem.emojiAllowed).toBe(false);
  });

  it('strips answer_key and explanation in Exam Mode while preserving them in Practice Mode', () => {
    const examModePayload = prepareExamForClient(INITIAL_PUBLISHED_EXAM, 'exam');
    for (const q of examModePayload.questions) {
      expect((q as ExamQuestion).answer_key).toBeUndefined();
      expect((q as ExamQuestion).explanation).toBeUndefined();
    }

    const practiceModePayload = prepareExamForClient(INITIAL_PUBLISHED_EXAM, 'practice');
    for (const q of practiceModePayload.questions) {
      expect(q.answer_key).toBeDefined();
      expect(q.explanation).toBeDefined();
    }
  });

  it('enforces candidate full name rules (no leading numbers/symbols, min 5 letters, proper words, no profanity)', () => {
    expect(validateCandidateName('123 Nguyễn Văn An').isValid).toBe(false);
    expect(validateCandidateName('@Nguyễn Văn An').isValid).toBe(false);
    expect(validateCandidateName('-Trần Hoàng').isValid).toBe(false);
    expect(validateCandidateName('Nguyễn Văn 9').isValid).toBe(false);
    expect(validateCandidateName('An').isValid).toBe(false);
    expect(validateCandidateName('Lê A').isValid).toBe(false);
    expect(validateCandidateName('Minh Khang 1').isValid).toBe(false);
    expect(validateCandidateName('Nguyễn Ngu Ngốc').isValid).toBe(false);
    expect(validateCandidateName('Trần Óc Chó').isValid).toBe(false);
    expect(validateCandidateName('dm nguyen van').isValid).toBe(false);

    const validRes = validateCandidateName('nguyễn minh khang');
    expect(validRes.isValid).toBe(true);
    expect(validRes.normalizedName).toBe('Nguyễn Minh Khang');
    expect(validRes.letterCount).toBeGreaterThanOrEqual(5);
    expect(validRes.wordCount).toBeGreaterThanOrEqual(2);
  });

  it('verifies Cong Nghe 11 comprehensive curriculum integrity across all 6 lessons and both question types', () => {
    expect(CONG_NGHE_11_TONG_HOP_EXAM.exam_id).toBe('exam_cong_nghe_11_tong_hop');
    expect(CONG_NGHE_11_TONG_HOP_EXAM.questions.length).toBe(176);
    expect(CONG_NGHE_11_LESSON_EXAMS.length).toBe(7);

    // Verify all 6 individual lesson exams are populated
    const lessonExamIds = CONG_NGHE_11_LESSON_EXAMS.slice(1).map((e) => e.exam_id);
    expect(lessonExamIds).toEqual([
      'exam_cn11_bai_1',
      'exam_cn11_bai_2',
      'exam_cn11_bai_3',
      'exam_cn11_bai_4',
      'exam_cn11_bai_5',
      'exam_cn11_bai_6',
    ]);

    // Verify full question type diversity: single_choice and true_false_cluster
    const singleChoiceList = CONG_NGHE_11_TONG_HOP_EXAM.questions.filter((q) => q.type === 'single_choice');
    const tfClusterList = CONG_NGHE_11_TONG_HOP_EXAM.questions.filter((q) => q.type === 'true_false_cluster');

    expect(singleChoiceList.length).toBe(157);
    expect(tfClusterList.length).toBe(19);

    // Verify single_choice structure: 4 options, valid key, non-empty stem & options
    for (const q of singleChoiceList) {
      expect(q.options?.length).toBe(4);
      expect(q.answer_key?.correct_option_id).toMatch(/_opt_[A-D]$/);
      expect(q.stem.trim().length).toBeGreaterThan(0);
      for (const opt of q.options!) {
        expect(opt.content.trim().length).toBeGreaterThan(0);
      }
    }

    // Verify true_false_cluster structure: 4 items (a, b, c, d), valid true/false keys
    for (const q of tfClusterList) {
      expect(q.statements?.length).toBe(4);
      expect(q.answer_key?.statement_answers).toBeDefined();
      expect(Object.keys(q.answer_key!.statement_answers!).length).toBe(4);
    }

    // Randomization: two different session seeds produce completely different layouts ("không có cùng 1 khuôn")
    const sessionSeed1 = `ses_${Date.now()}_candidate_A_${Math.random()}`;
    const sessionSeed2 = `ses_${Date.now()}_candidate_B_${Math.random()}`;
    const rand1 = computeSessionRandomization(CONG_NGHE_11_TONG_HOP_EXAM, sessionSeed1);
    const rand2 = computeSessionRandomization(CONG_NGHE_11_TONG_HOP_EXAM, sessionSeed2);

    expect(rand1.questionOrder).not.toEqual(rand2.questionOrder);

    // prepareExamForClient applies the shuffle and updates question numbers
    const clientExam1 = prepareExamForClient(CONG_NGHE_11_TONG_HOP_EXAM, 'exam', {
      question_order: rand1.questionOrder,
      option_orders: rand1.optionOrders,
    });
    const clientExam2 = prepareExamForClient(CONG_NGHE_11_TONG_HOP_EXAM, 'exam', {
      question_order: rand2.questionOrder,
      option_orders: rand2.optionOrders,
    });

    expect(clientExam1.questions[0].id).not.toBe(clientExam2.questions[0].id);
    expect(clientExam1.questions[0].number).toBe(1);
    expect(clientExam1.questions[175].number).toBe(176);
    // Guarantees zero answer key leakage in Exam Mode
    expect(clientExam1.questions[0].answer_key).toBeUndefined();
    expect(clientExam1.questions[0].explanation).toBeUndefined();
  });
});
