"""
Section 6.4: Question Extractor, Confidence Scorer & Publish Gate Validator
- Groups ordered blocks (paragraphs, tables, inline images, formulas) into structured questions
- Never silently drops a question; detects gaps in numbering (e.g. Question 1 -> Question 3) as CRITICAL_MISSING_QUESTION_SEQUENCE
- Flags undecodable formulas with needs_review=True and CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED until verified by a human
- Blocks publication ONLY when unresolved critical errors exist
"""

import re
from typing import Dict, Any, List, Optional


QUESTION_START_RE = re.compile(r"^Cau\s+(\d+)\s*[:\.]\s*(.*)$", re.IGNORECASE)
CHOICE_LINE_RE = re.compile(r"^\s*(\*?)([A-D])\.\s*(.+)$")
STATEMENT_LINE_RE = re.compile(r"^\s*(\*?)([a-d])\)\s*(.+)$")
ANSWER_LINE_RE = re.compile(r"^\s*Dap\s*an\s*[:\.]\s*(.+)$", re.IGNORECASE)
EXPLANATION_LINE_RE = re.compile(r"^\s*Loi\s*giai\s*[:\.]\s*(.*)$", re.IGNORECASE)


def build_questions_from_parsed_doc(
    parsed_doc: Dict[str, Any],
    exam_id: str = "exam_imported_word",
) -> Dict[str, Any]:
    blocks: List[Dict[str, Any]] = parsed_doc.get("blocks", [])
    all_formulas: List[Dict[str, Any]] = parsed_doc.get("formulas", [])

    questions: List[Dict[str, Any]] = []
    current_q: Optional[Dict[str, Any]] = None

    def finalize_current(q: Dict[str, Any]) -> None:
        # Determine question type and answer key
        if q["statements"]:
            q["type"] = "true_false_cluster"
            stmt_answers = {}
            for st in q["statements"]:
                if st.get("_is_true") is not None:
                    stmt_answers[st["id"]] = bool(st.pop("_is_true"))
            if len(stmt_answers) == len(q["statements"]):
                q["answer_key"] = {
                    "question_type": "true_false_cluster",
                    "statement_answers": stmt_answers,
                }
        elif q["options"]:
            q["type"] = "single_choice"
            correct_opt_id = q.pop("_correct_option_id", None)
            if correct_opt_id:
                q["answer_key"] = {
                    "question_type": "single_choice",
                    "correct_option_id": correct_opt_id,
                }
        else:
            q["type"] = "short_answer"
            short_ans = q.pop("_short_answer_val", None)
            if short_ans:
                q["answer_key"] = {
                    "question_type": "short_answer",
                    "accepted_values": [short_ans],
                }

        q.pop("_correct_option_id", None)
        q.pop("_short_answer_val", None)

        # Attach formulas referenced in this question's stem/options
        q_text_combined = q["stem"] + " " + " ".join(o["content"] for o in q["options"])
        q_formulas = [
            f for f in all_formulas if f["latex"] in q_text_combined
        ]
        q["formulas"] = q_formulas

        # Evaluate validation, confidence, and needs_review
        critical_errors: List[str] = []
        warnings: List[str] = []
        confidence = 0.99

        if not q["stem"].strip():
            critical_errors.append("CRITICAL_EMPTY_STEM")
            confidence = min(confidence, 0.2)

        if not q.get("answer_key"):
            critical_errors.append("CRITICAL_MISSING_ANSWER_KEY")
            confidence = min(confidence, 0.45)

        for f in q_formulas:
            if not f.get("decodable", True):
                if not q["validation"].get("verified_by_human", False):
                    critical_errors.append(
                        f"CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED:{f['formula_id']}"
                    )
                confidence = min(confidence, float(f.get("confidence", 0.22)))
            else:
                confidence = min(confidence, float(f.get("confidence", 0.98)))

        if not q.get("explanation"):
            warnings.append("WARN_MISSING_EXPLANATION")

        needs_review = len(critical_errors) > 0 or confidence < 0.85
        q["validation"] = {
            "confidence": round(confidence, 2),
            "needs_review": needs_review,
            "verified_by_human": False,
            "critical_errors": critical_errors,
            "warnings": warnings,
        }
        questions.append(q)

    for blk in blocks:
        btype = blk["type"]
        if btype == "paragraph":
            text = blk.get("content", "").strip()
            m_q = QUESTION_START_RE.match(text)
            if m_q:
                if current_q is not None:
                    finalize_current(current_q)
                q_num = int(m_q.group(1))
                stem_init = m_q.group(2).strip()
                q_id = f"{exam_id}_q_{q_num:03d}"
                current_q = {
                    "id": q_id,
                    "number": q_num,
                    "section": "Phan I",
                    "type": "single_choice",
                    "cognitive_level": "comprehension",
                    "points": 1.0,
                    "stem": stem_init,
                    "stem_blocks": [
                        {
                            "block_id": blk["block_id"],
                            "order_index": 0,
                            "type": "paragraph",
                            "content": stem_init,
                        }
                    ],
                    "formulas": [],
                    "options": [],
                    "statements": [],
                    "explanation": "",
                    "validation": {},
                }
                continue

            if current_q is None:
                continue

            m_choice = CHOICE_LINE_RE.match(text)
            if m_choice:
                star, label, opt_content = m_choice.groups()
                opt_id = f"{current_q['id']}_opt_{label}"
                current_q["options"].append(
                    {
                        "id": opt_id,
                        "label": label,
                        "content": opt_content.strip(),
                    }
                )
                if star == "*":
                    current_q["_correct_option_id"] = opt_id
                continue

            m_stmt = STATEMENT_LINE_RE.match(text)
            if m_stmt:
                star, label, stmt_content = m_stmt.groups()
                stmt_id = f"stmt_{label}"
                current_q["statements"].append(
                    {
                        "id": stmt_id,
                        "label": label,
                        "content": stmt_content.strip(),
                        "_is_true": True if star == "*" else False,
                    }
                )
                continue

            m_ans = ANSWER_LINE_RE.match(text)
            if m_ans:
                ans_val = m_ans.group(1).strip()
                if current_q["options"]:
                    for opt in current_q["options"]:
                        if opt["label"].upper() == ans_val.upper():
                            current_q["_correct_option_id"] = opt["id"]
                else:
                    current_q["_short_answer_val"] = ans_val
                continue

            m_exp = EXPLANATION_LINE_RE.match(text)
            if m_exp:
                current_q["explanation"] = m_exp.group(1).strip()
                continue

            # Regular continuation paragraph in stem
            next_order = len(current_q["stem_blocks"])
            current_q["stem"] = (current_q["stem"] + "\n" + text).strip()
            current_q["stem_blocks"].append(
                {
                    "block_id": blk["block_id"],
                    "order_index": next_order,
                    "type": "paragraph",
                    "content": text,
                }
            )

        elif btype in ("table", "inline_image"):
            if current_q is not None:
                next_order = len(current_q["stem_blocks"])
                copied_blk = dict(blk)
                copied_blk["order_index"] = next_order
                current_q["stem_blocks"].append(copied_blk)

    if current_q is not None:
        finalize_current(current_q)

    # Check sequence continuity so no question is ever silently dropped!
    global_critical_errors: List[str] = []
    global_warnings: List[str] = []

    expected_num = 1
    for q in questions:
        if q["number"] != expected_num:
            err = f"CRITICAL_MISSING_QUESTION_SEQUENCE:Expected_Cau_{expected_num}_Found_Cau_{q['number']}"
            global_critical_errors.append(err)
            q["validation"]["critical_errors"].append(err)
            q["validation"]["needs_review"] = True
        expected_num = q["number"] + 1

        for ce in q["validation"]["critical_errors"]:
            if ce not in global_critical_errors:
                global_critical_errors.append(f"{q['id']}:{ce}")
        for wn in q["validation"]["warnings"]:
            global_warnings.append(f"{q['id']}:{wn}")

    can_publish = len(global_critical_errors) == 0

    return {
        "exam_id": exam_id,
        "parser_type": parsed_doc.get("parser_type"),
        "source_name": parsed_doc.get("source_name"),
        "question_count": len(questions),
        "questions": questions,
        "validation_report": {
            "can_publish": can_publish,
            "blocking_critical_count": len(global_critical_errors),
            "warning_count": len(global_warnings),
            "critical_errors": global_critical_errors,
            "warnings": global_warnings,
        },
    }


def verify_question_by_human(
    question: Dict[str, Any],
    verifier_name: str,
    corrected_latex_map: Optional[Dict[str, str]] = None,
    answer_key_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Applies human verification to a question in Teacher Question Studio.
    If undecodable formulas are supplied with human-verified LaTeX and an answer key is present,
    clears the critical blocking errors while preserving the raw formula payload for audit.
    """
    if corrected_latex_map:
        for f in question.get("formulas", []):
            fid = f["formula_id"]
            if fid in corrected_latex_map and corrected_latex_map[fid].strip():
                f["latex"] = corrected_latex_map[fid].strip()
                f["needs_review"] = False

    if answer_key_override:
        question["answer_key"] = answer_key_override

    remaining_critical: List[str] = []
    if not question.get("stem", "").strip():
        remaining_critical.append("CRITICAL_EMPTY_STEM")
    if not question.get("answer_key"):
        remaining_critical.append("CRITICAL_MISSING_ANSWER_KEY")

    for f in question.get("formulas", []):
        if f.get("needs_review") or f.get("latex", "").startswith("[UNDECODABLE"):
            remaining_critical.append(f"CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED:{f['formula_id']}")

    question["validation"]["verified_by_human"] = True
    question["validation"]["verified_by"] = verifier_name
    question["validation"]["critical_errors"] = remaining_critical
    question["validation"]["needs_review"] = len(remaining_critical) > 0
    return question
