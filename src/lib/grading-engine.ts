/**
 * Section 6.1 & 7: Official Grading Engine, Trust Boundary Stripper, and Deterministic Shuffler
 * Shared by Server (Authoritative Exam Mode Grading) and Client (Practice Mode Only).
 */

import {
  AssessmentMode,
  CandidateAnswerRecord,
  CandidateAnswerValue,
  ExamContract,
  ExamQuestion,
  GradingPolicy,
  QuestionScoreBreakdown,
} from '../types/exam';

/**
 * TRUST BOUNDARY ENFORCEMENT (Section 6.1):
 * Strips answer_key and explanation from every question when mode === 'exam'.
 * Guarantees zero answer leakage in network responses or client memory during Exam Mode.
 */
export function prepareExamForClient(
  exam: ExamContract,
  mode: AssessmentMode,
  sessionRandomization?: {
    question_order?: string[];
    option_orders?: Record<string, string[]>;
  }
): ExamContract {
  const cloned: ExamContract = JSON.parse(JSON.stringify(exam));

  // Reorder questions if question_order is provided
  if (sessionRandomization?.question_order && sessionRandomization.question_order.length > 0) {
    const qMap = new Map<string, ExamQuestion>();
    for (const q of cloned.questions) {
      qMap.set(q.id, q);
    }
    const reordered: ExamQuestion[] = [];
    sessionRandomization.question_order.forEach((qid, idx) => {
      const q = qMap.get(qid);
      if (q) {
        q.number = idx + 1;
        reordered.push(q);
      }
    });
    for (const q of cloned.questions) {
      if (!reordered.some((item) => item.id === q.id)) {
        q.number = reordered.length + 1;
        reordered.push(q);
      }
    }
    cloned.questions = reordered;
  }

  // Reorder options within questions if option_orders is provided and exam policy allows
  if (sessionRandomization?.option_orders && exam.randomization_policy.shuffle_options) {
    for (const q of cloned.questions) {
      const optOrder = sessionRandomization.option_orders[q.id];
      if (optOrder && q.options && q.options.length > 0) {
        const optMap = new Map(q.options.map((opt) => [opt.id, opt]));
        const reorderedOpts: typeof q.options = [];
        optOrder.forEach((optId, idx) => {
          const opt = optMap.get(optId);
          if (opt) {
            opt.label = String.fromCharCode(65 + idx);
            reorderedOpts.push(opt);
          }
        });
        for (const opt of q.options) {
          if (!reorderedOpts.some((item) => item.id === opt.id)) {
            opt.label = String.fromCharCode(65 + reorderedOpts.length);
            reorderedOpts.push(opt);
          }
        }
        q.options = reorderedOpts;
      }
    }
  }

  if (mode === 'exam') {
    cloned.questions = cloned.questions.map((q) => {
      const { answer_key: _ak, explanation: _exp, ...safeQuestion } = q;
      return safeQuestion;
    });
  }
  return cloned;
}

/**
 * Normalizes short answer strings (trims, collapses whitespace, normalizes decimal comma to dot).
 */
export function normalizeShortAnswer(
  raw: string,
  policy: Pick<GradingPolicy, 'short_answer_case_sensitive' | 'short_answer_normalize_comma_decimal'>
): string {
  let cleaned = raw.trim().replace(/\s+/g, '');
  if (policy.short_answer_normalize_comma_decimal) {
    cleaned = cleaned.replace(/,/g, '.');
  }
  if (!policy.short_answer_case_sensitive) {
    cleaned = cleaned.toLowerCase();
  }
  return cleaned;
}

/**
 * Grades a single question against its authoritative answer key and grading policy.
 */
export function gradeQuestion(
  question: ExamQuestion,
  candidateAnswer: CandidateAnswerValue | undefined,
  policy: GradingPolicy
): QuestionScoreBreakdown {
  const key = question.answer_key;
  if (!key) {
    throw new Error(`Cannot grade question ${question.id}: authoritative answer_key is missing`);
  }

  const maxPoints = question.points;

  if (!candidateAnswer) {
    return {
      question_id: question.id,
      question_number: question.number,
      question_type: question.type,
      earned_points: 0,
      max_points: maxPoints,
      is_fully_correct: false,
      is_partially_correct: false,
      official_answer_key: key,
      explanation: question.explanation,
    };
  }

  switch (question.type) {
    case 'single_choice': {
      const selectedId =
        candidateAnswer.type === 'single_choice' ? candidateAnswer.selected_option_id : '';
      const isCorrect = Boolean(selectedId && selectedId === key.correct_option_id);
      const rawPoints = isCorrect
        ? maxPoints
        : selectedId
          ? -maxPoints * (policy.negative_marking_factor || 0)
          : 0;
      const earned = Math.max(0, Number(rawPoints.toFixed(policy.rounding_decimals)));
      return {
        question_id: question.id,
        question_number: question.number,
        question_type: 'single_choice',
        earned_points: earned,
        max_points: maxPoints,
        is_fully_correct: isCorrect,
        is_partially_correct: false,
        candidate_answer: candidateAnswer,
        official_answer_key: key,
        explanation: question.explanation,
      };
    }

    case 'true_false_cluster': {
      const expectedMap = key.statement_answers || {};
      const statementIds = Object.keys(expectedMap);
      const totalStatements = statementIds.length || 4;
      const candidateStatements =
        candidateAnswer.type === 'true_false_cluster' ? candidateAnswer.statements : {};

      let correctCount = 0;
      let anyAnswered = false;
      for (const stmtId of statementIds) {
        if (typeof candidateStatements[stmtId] === 'boolean') {
          anyAnswered = true;
          if (candidateStatements[stmtId] === expectedMap[stmtId]) {
            correctCount += 1;
          }
        }
      }

      let scaleMultiplier = 0;
      if (anyAnswered && correctCount > 0) {
        if (correctCount === 1) scaleMultiplier = policy.true_false_cluster_scale[1];
        else if (correctCount === 2) scaleMultiplier = policy.true_false_cluster_scale[2];
        else if (correctCount === 3) scaleMultiplier = policy.true_false_cluster_scale[3];
        else if (correctCount >= 4) scaleMultiplier = policy.true_false_cluster_scale[4];
      }

      const earned = Number((maxPoints * scaleMultiplier).toFixed(policy.rounding_decimals));
      return {
        question_id: question.id,
        question_number: question.number,
        question_type: 'true_false_cluster',
        earned_points: earned,
        max_points: maxPoints,
        is_fully_correct: correctCount === totalStatements,
        is_partially_correct: correctCount > 0 && correctCount < totalStatements,
        correct_sub_items: correctCount,
        total_sub_items: totalStatements,
        candidate_answer: candidateAnswer,
        official_answer_key: key,
        explanation: question.explanation,
      };
    }

    case 'short_answer': {
      const rawText = candidateAnswer.type === 'short_answer' ? candidateAnswer.text_value : '';
      const normalizedCandidate = normalizeShortAnswer(rawText, policy);
      let isCorrect = false;

      if (normalizedCandidate.length > 0) {
        // Check exact normalized string match against accepted_values
        if (Array.isArray(key.accepted_values)) {
          for (const accepted of key.accepted_values) {
            if (normalizeShortAnswer(accepted, policy) === normalizedCandidate) {
              isCorrect = true;
              break;
            }
          }
        }
        // Check numeric tolerance match if configured
        if (!isCorrect && typeof key.numeric_value === 'number') {
          const parsedNum = Number(normalizedCandidate);
          const tolerance = typeof key.numeric_tolerance === 'number' ? key.numeric_tolerance : 1e-6;
          if (!Number.isNaN(parsedNum) && Math.abs(parsedNum - key.numeric_value) <= tolerance) {
            isCorrect = true;
          }
        }
      }

      const earned = isCorrect ? maxPoints : 0;
      return {
        question_id: question.id,
        question_number: question.number,
        question_type: 'short_answer',
        earned_points: earned,
        max_points: maxPoints,
        is_fully_correct: isCorrect,
        is_partially_correct: false,
        candidate_answer: candidateAnswer,
        official_answer_key: key,
        explanation: question.explanation,
      };
    }

    case 'multi_select': {
      const expectedSet = new Set(key.correct_option_ids || []);
      const selectedIds =
        candidateAnswer.type === 'multi_select' ? candidateAnswer.selected_option_ids : [];
      const selectedSet = new Set(selectedIds);

      let correctPicked = 0;
      let wrongPicked = 0;
      for (const id of selectedSet) {
        if (expectedSet.has(id)) correctPicked += 1;
        else wrongPicked += 1;
      }

      const isExact =
        correctPicked === expectedSet.size && wrongPicked === 0 && expectedSet.size > 0;

      let earned = 0;
      if (policy.multi_select_mode === 'exact_match') {
        earned = isExact ? maxPoints : 0;
      } else if (policy.multi_select_mode === 'partial_no_penalty') {
        earned =
          wrongPicked === 0 && expectedSet.size > 0
            ? Number(((correctPicked / expectedSet.size) * maxPoints).toFixed(policy.rounding_decimals))
            : 0;
      } else {
        // partial_with_penalty
        const netCorrect = Math.max(0, correctPicked - wrongPicked);
        earned =
          expectedSet.size > 0
            ? Number(((netCorrect / expectedSet.size) * maxPoints).toFixed(policy.rounding_decimals))
            : 0;
      }

      return {
        question_id: question.id,
        question_number: question.number,
        question_type: 'multi_select',
        earned_points: earned,
        max_points: maxPoints,
        is_fully_correct: isExact,
        is_partially_correct: earned > 0 && !isExact,
        correct_sub_items: correctPicked,
        total_sub_items: expectedSet.size,
        candidate_answer: candidateAnswer,
        official_answer_key: key,
        explanation: question.explanation,
      };
    }
  }
}

/**
 * Grades an entire exam attempt against the authoritative exam contract.
 */
export function gradeExamAttempt(
  authoritativeExam: ExamContract,
  answers: Record<string, CandidateAnswerRecord>
): {
  totalScore: number;
  maxScore: number;
  percentage: number;
  answeredCount: number;
  breakdown: QuestionScoreBreakdown[];
} {
  const policy = authoritativeExam.grading_policy;
  const breakdown: QuestionScoreBreakdown[] = [];
  let rawTotal = 0;
  let rawMax = 0;
  let answeredCount = 0;

  for (const question of authoritativeExam.questions) {
    const record = answers[question.id];
    const hasValue = isAnswerPopulated(record?.value);
    if (hasValue) {
      answeredCount += 1;
    }
    const itemResult = gradeQuestion(question, hasValue ? record?.value : undefined, policy);
    breakdown.push(itemResult);
    rawTotal += itemResult.earned_points;
    rawMax += itemResult.max_points;
  }

  const totalScore = Number(rawTotal.toFixed(policy.rounding_decimals));
  const maxScore = Number(rawMax.toFixed(policy.rounding_decimals));
  const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;

  return {
    totalScore,
    maxScore,
    percentage,
    answeredCount,
    breakdown,
  };
}

export function isAnswerPopulated(val: CandidateAnswerValue | undefined): boolean {
  if (!val) return false;
  switch (val.type) {
    case 'single_choice':
      return Boolean(val.selected_option_id && val.selected_option_id.trim() !== '');
    case 'multi_select':
      return Array.isArray(val.selected_option_ids) && val.selected_option_ids.length > 0;
    case 'true_false_cluster':
      return Object.keys(val.statements || {}).length > 0;
    case 'short_answer':
      return Boolean(val.text_value && val.text_value.trim() !== '');
  }
}

/**
 * Deterministic Mulberry32 PRNG seeded from a string (session_id + student_id + exam_id).
 * Ensures question & option randomization is reproducible on reload/recovery.
 */
export function createSeededRng(seedString: string): () => number {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return t / 4294967296;
  };
}

export function deterministicShuffle<T>(items: readonly T[], seedString: string): T[] {
  const result = [...items];
  const rng = createSeededRng(seedString);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Computes deterministic question order and option order per session according to randomization_policy.
 */
export function computeSessionRandomization(
  exam: ExamContract,
  sessionSeed: string
): {
  questionOrder: string[];
  optionOrders: Record<string, string[]>;
} {
  const policy = exam.randomization_policy;
  let orderedQuestions = [...exam.questions];

  if (policy.shuffle_questions_within_section) {
    if (policy.preserve_section_order) {
      const sections = new Map<string, ExamQuestion[]>();
      for (const q of orderedQuestions) {
        const list = sections.get(q.section) || [];
        list.push(q);
        sections.set(q.section, list);
      }
      orderedQuestions = [];
      for (const [secName, secQuestions] of sections.entries()) {
        const shuffledSec = deterministicShuffle(secQuestions, `${sessionSeed}_sec_${secName}`);
        orderedQuestions.push(...shuffledSec);
      }
    } else {
      orderedQuestions = deterministicShuffle(orderedQuestions, `${sessionSeed}_all_q`);
    }
  }

  const optionOrders: Record<string, string[]> = {};
  for (const q of orderedQuestions) {
    if (q.options && q.options.length > 0) {
      const optIds = q.options.map((o) => o.id);
      optionOrders[q.id] = policy.shuffle_options
        ? deterministicShuffle(optIds, `${sessionSeed}_opts_${q.id}`)
        : optIds;
    }
  }

  return {
    questionOrder: orderedQuestions.map((q) => q.id),
    optionOrders,
  };
}
