/**
 * Section 6.1, 6.2, 6.4, 6.5: Versioned Data Contracts & Trust Boundary Types
 */

export type AssessmentMode = 'exam' | 'practice';

export type QuestionType =
  | 'single_choice'
  | 'true_false_cluster'
  | 'short_answer'
  | 'multi_select';

export type CognitiveLevel =
  | 'recognition'
  | 'comprehension'
  | 'application'
  | 'high_application';

export interface FormulaNode {
  formula_id: string;
  source_format: 'mtef_v3' | 'mtef_v5' | 'omml' | 'latex';
  mtef_version?: number;
  latex: string;
  raw_payload_hex?: string;
  raw_omml?: string;
  decodable: boolean;
  confidence: number;
  needs_review: boolean;
}

export interface ContentBlock {
  block_id: string;
  order_index: number;
  type: 'paragraph' | 'table' | 'inline_image' | 'formula';
  content?: string;
  table_rows?: string[][];
  asset_id?: string;
  alt_text?: string;
  formula?: FormulaNode;
}

export interface ChoiceOption {
  id: string; // Stable ID e.g. "opt_A", "opt_B"
  label: string; // Display label A, B, C, D
  content: string;
  latex?: string;
}

export interface TrueFalseStatement {
  id: string; // Stable ID e.g. "stmt_a", "stmt_b", "stmt_c", "stmt_d"
  label: string; // a, b, c, d
  content: string;
  latex?: string;
}

export interface AnswerKeySpec {
  question_type: QuestionType;
  /** For single_choice */
  correct_option_id?: string;
  /** For multi_select */
  correct_option_ids?: string[];
  /** For true_false_cluster: map of statement_id -> boolean */
  statement_answers?: Record<string, boolean>;
  /** For short_answer: canonical value + acceptable numeric tolerance */
  accepted_values?: string[];
  numeric_value?: number;
  numeric_tolerance?: number;
}

export interface QuestionValidationMeta {
  confidence: number; // 0.0 to 1.0
  needs_review: boolean;
  verified_by_human: boolean;
  verified_at?: string;
  verified_by?: string;
  critical_errors: string[];
  warnings: string[];
}

export interface ExamQuestion {
  id: string; // Stable immutable question ID
  number: number;
  section: string;
  type: QuestionType;
  cognitive_level: CognitiveLevel;
  points: number;
  stem: string;
  stem_blocks: ContentBlock[];
  formulas: FormulaNode[];
  diagram_svg?: string;
  diagram_asset_id?: string;
  diagram_caption?: string;
  options?: ChoiceOption[];
  statements?: TrueFalseStatement[];
  /**
   * TRUST BOUNDARY (Section 6.1):
   * Present in server store, Teacher Studio, and Practice Mode.
   * Strictly STRIPPED before sending payload to client in Exam Mode!
   */
  answer_key?: AnswerKeySpec;
  explanation?: string;
  validation: QuestionValidationMeta;
}

export interface GradingPolicy {
  policy_id: string;
  total_max_score: number;
  single_choice_default_points: number;
  /**
   * Standard THPT 2025 4-statement cluster partial credit scale:
   * 1 correct = 0.1, 2 correct = 0.25, 3 correct = 0.5, 4 correct = 1.0 (multiplied by question points)
   */
  true_false_cluster_scale: {
    1: number;
    2: number;
    3: number;
    4: number;
  };
  multi_select_mode: 'exact_match' | 'partial_no_penalty' | 'partial_with_penalty';
  short_answer_case_sensitive: boolean;
  short_answer_normalize_comma_decimal: boolean;
  negative_marking_factor: number; // 0 for standard non-negative grading
  rounding_decimals: number;
}

export interface AttemptPolicy {
  max_attempts: number;
  allow_resume_on_disconnect: boolean;
  grace_period_seconds: number;
  auto_submit_on_timeout: boolean;
  require_session_token: boolean;
  allow_review_after_submit: boolean;
}

export interface RandomizationPolicy {
  shuffle_questions_within_section: boolean;
  shuffle_options: boolean;
  preserve_section_order: boolean;
  deterministic_seed_strategy: 'hmac_session_student';
}

export interface AssetManifestEntry {
  asset_id: string;
  type: 'svg_diagram' | 'image' | 'table_snapshot';
  mime_type: string;
  sha256: string;
  width: number;
  height: number;
  alt_text: string;
  inline_svg?: string;
  url?: string;
}

/**
 * Section 6.2: Required Versioned Exam Data Contract
 */
export interface ExamContract {
  schema_version: '2.0.0';
  exam_id: string;
  exam_version: number;
  title: string;
  subject_id: string;
  subject_name: string;
  grade_level: number;
  published_at: string;
  status: 'draft' | 'published' | 'archived';
  time_limit: number; // in seconds
  grading_policy: GradingPolicy;
  attempt_policy: AttemptPolicy;
  randomization_policy: RandomizationPolicy;
  questions: ExamQuestion[];
  assets_manifest: AssetManifestEntry[];
}

export type CandidateAnswerValue =
  | { type: 'single_choice'; selected_option_id: string }
  | { type: 'multi_select'; selected_option_ids: string[] }
  | { type: 'true_false_cluster'; statements: Record<string, boolean> }
  | { type: 'short_answer'; text_value: string };

export interface CandidateAnswerRecord {
  question_id: string;
  value: CandidateAnswerValue;
  flagged: boolean;
  client_updated_at: number;
  sequence_number: number;
}

export type ObservableBrowserEventType =
  | 'session_started'
  | 'visibility_hidden'
  | 'visibility_visible'
  | 'window_blur'
  | 'window_focus'
  | 'fullscreen_entered'
  | 'fullscreen_exited'
  | 'network_offline'
  | 'network_restored'
  | 'multi_tab_detected'
  | 'session_recovered'
  | 'exam_submitted';

export interface TelemetryEvent {
  event_id: string;
  session_id: string;
  event_type: ObservableBrowserEventType;
  client_timestamp: number;
  server_timestamp?: number;
  detail: string;
}

export interface QuestionScoreBreakdown {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  earned_points: number;
  max_points: number;
  is_fully_correct: boolean;
  is_partially_correct: boolean;
  correct_sub_items?: number;
  total_sub_items?: number;
  candidate_answer?: CandidateAnswerValue;
  official_answer_key?: AnswerKeySpec;
  explanation?: string;
}

export interface ExamSubmissionReceipt {
  receipt_id: string;
  idempotency_key: string;
  session_id: string;
  exam_id: string;
  exam_version: number;
  student_id: string;
  student_name: string;
  mode: AssessmentMode;
  submitted_at_server: number;
  duration_seconds: number;
  total_score: number;
  max_score: number;
  percentage: number;
  answered_count: number;
  total_questions: number;
  breakdown: QuestionScoreBreakdown[];
  signature_sha256: string;
}

export interface ActiveExamSession {
  session_id: string;
  session_token: string;
  exam_id: string;
  exam_version: number;
  student_id: string;
  student_name: string;
  student_code: string;
  class_name: string;
  mode: AssessmentMode;
  started_at_server: number;
  expires_at_server: number;
  last_sync_at_server: number;
  status: 'in_progress' | 'submitted' | 'expired';
  connection_state: 'online' | 'offline' | 'idle';
  question_order: string[];
  option_orders: Record<string, string[]>;
  answers: Record<string, CandidateAnswerRecord>;
  telemetry: TelemetryEvent[];
  submission_receipt?: ExamSubmissionReceipt;
}
