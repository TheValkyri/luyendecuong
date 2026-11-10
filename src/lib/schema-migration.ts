/**
 * Section 6.2: Data Contract Versioning & Schema Migration
 * Supports migrating v1.0.0 legacy exam schemas to v2.0.0 contract with stable IDs and policies.
 */

import { ExamContract, ExamQuestion, GradingPolicy } from '../types/exam';

export interface LegacyExamV1 {
  schema_version?: '1.0' | '1.0.0';
  id?: string;
  exam_id?: string;
  version?: number;
  title?: string;
  subject?: string;
  duration_minutes?: number;
  questions: Array<{
    id?: string;
    type?: string;
    question_text: string;
    points?: number;
    options?: Array<{ id?: string; label: string; text: string }>;
    correct_answer?: string;
    explanation?: string;
  }>;
}

export const DEFAULT_GRADING_POLICY_V2: GradingPolicy = {
  policy_id: 'thpt_national_2025_standard',
  total_max_score: 10,
  single_choice_default_points: 0.25,
  true_false_cluster_scale: {
    1: 0.1,
    2: 0.25,
    3: 0.5,
    4: 1.0,
  },
  multi_select_mode: 'partial_with_penalty',
  short_answer_case_sensitive: false,
  short_answer_normalize_comma_decimal: true,
  negative_marking_factor: 0,
  rounding_decimals: 2,
};

/**
 * Migrates a legacy v1 exam object or validates a v2 exam object into the strict v2.0.0 contract.
 */
export function migrateExamSchema(input: unknown): ExamContract {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid exam data: expected non-null object');
  }

  const raw = input as Record<string, unknown>;
  const version = String(raw.schema_version || '1.0.0');

  if (version === '2.0.0') {
    return validateExamContractV2(raw as unknown as ExamContract);
  }

  if (version === '1.0' || version === '1.0.0') {
    const v1 = raw as unknown as LegacyExamV1;
    const examId = v1.exam_id || v1.id || 'exam_migrated_default';
    const timeLimitSeconds = (v1.duration_minutes || 45) * 60;

    const migratedQuestions: ExamQuestion[] = (v1.questions || []).map((q, index) => {
      const stableId = q.id || `${examId}_q_${String(index + 1).padStart(3, '0')}`;
      const options = (q.options || []).map((opt, optIdx) => ({
        id: opt.id || `${stableId}_opt_${opt.label || String.fromCharCode(65 + optIdx)}`,
        label: opt.label || String.fromCharCode(65 + optIdx),
        content: opt.text,
      }));

      const matchedCorrectOption = options.find(
        (o) => o.label === q.correct_answer || o.id === q.correct_answer
      );

      return {
        id: stableId,
        number: index + 1,
        section: 'Part I',
        type: 'single_choice',
        cognitive_level: 'comprehension',
        points: typeof q.points === 'number' ? q.points : 0.25,
        stem: q.question_text,
        stem_blocks: [
          {
            block_id: `${stableId}_blk_1`,
            order_index: 0,
            type: 'paragraph',
            content: q.question_text,
          },
        ],
        formulas: [],
        options,
        answer_key: matchedCorrectOption
          ? {
              question_type: 'single_choice',
              correct_option_id: matchedCorrectOption.id,
            }
          : undefined,
        explanation: q.explanation || '',
        validation: {
          confidence: 0.98,
          needs_review: !matchedCorrectOption,
          verified_by_human: Boolean(matchedCorrectOption),
          critical_errors: matchedCorrectOption ? [] : ['CRITICAL_MISSING_ANSWER_KEY'],
          warnings: [],
        },
      };
    });

    const migrated: ExamContract = {
      schema_version: '2.0.0',
      exam_id: examId,
      exam_version: typeof v1.version === 'number' ? v1.version : 1,
      title: v1.title || 'De Thi Chuyen Doi Schema v2.0',
      subject_id: (v1.subject || 'math').toLowerCase(),
      subject_name: v1.subject || 'Toan Hoc',
      grade_level: 12,
      published_at: new Date().toISOString(),
      status: 'published',
      time_limit: timeLimitSeconds,
      grading_policy: {
        ...DEFAULT_GRADING_POLICY_V2,
        total_max_score: Number(
          migratedQuestions.reduce((acc, item) => acc + item.points, 0).toFixed(2)
        ),
      },
      attempt_policy: {
        max_attempts: 1,
        allow_resume_on_disconnect: true,
        grace_period_seconds: 120,
        auto_submit_on_timeout: true,
        require_session_token: true,
        allow_review_after_submit: true,
      },
      randomization_policy: {
        shuffle_questions_within_section: true,
        shuffle_options: true,
        preserve_section_order: true,
        deterministic_seed_strategy: 'hmac_session_student',
      },
      questions: migratedQuestions,
      assets_manifest: [],
    };

    return validateExamContractV2(migrated);
  }

  throw new Error(`Unsupported schema_version: ${version}`);
}

/**
 * Validates that all required Section 6.2 contract fields and stable question IDs exist.
 */
export function validateExamContractV2(contract: ExamContract): ExamContract {
  const requiredFields: Array<keyof ExamContract> = [
    'schema_version',
    'exam_id',
    'exam_version',
    'subject_id',
    'published_at',
    'time_limit',
    'grading_policy',
    'attempt_policy',
    'randomization_policy',
    'questions',
    'assets_manifest',
  ];

  for (const field of requiredFields) {
    if (contract[field] === undefined || contract[field] === null) {
      throw new Error(`ExamContract missing required field: ${field}`);
    }
  }

  if (contract.schema_version !== '2.0.0') {
    throw new Error(`Invalid schema_version: expected 2.0.0, got ${contract.schema_version}`);
  }

  const seenIds = new Set<string>();
  for (const q of contract.questions) {
    if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
      throw new Error('Every question in ExamContract must have a non-empty stable id');
    }
    if (seenIds.has(q.id)) {
      throw new Error(`Duplicate question id detected in ExamContract: ${q.id}`);
    }
    seenIds.add(q.id);
  }

  return contract;
}
