"""
Section 6.4 & Section 7: Golden Test Suite for Python DOC / DOCX / MTEF ETL Pipeline
Verifies:
1. Separation of .doc (OLE2 binary) and .docx (OOXML) parsers
2. MTEF v3 and MTEF v5 formula decoding + OMML decoding
3. Preservation of original raw_payload_hex on undecodable formulas without silent modification
4. Exact order preservation of paragraphs, inline images, and tables
5. Confidence scoring, needs_review flagging, and human verification before publish
6. Missing question sequence detection (no silent question dropping)
7. XSS payload sanitization from Word content
"""

import os
import unittest
from .mtef_decoder import (
    decode_mtef_bytes,
    build_mtef_v3_stream,
    build_mtef_v5_stream,
)
from .doc_parser import DocBinaryParser
from .docx_parser import DocxParser
from .validator import build_questions_from_parsed_doc, verify_question_by_human
from .generate_fixtures import generate_all_fixtures, FIXTURES_DIR


class TestPythonEtlPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        generate_all_fixtures()

    def test_mtef_v3_and_v5_decoding(self) -> None:
        v3_stream = build_mtef_v3_stream("x^2+y^2=R^2")
        res_v3 = decode_mtef_bytes(v3_stream, formula_id="test_v3")
        self.assertTrue(res_v3.decodable)
        self.assertEqual(res_v3.mtef_version, 3)
        self.assertEqual(res_v3.source_format, "mtef_v3")
        self.assertEqual(res_v3.latex, "x^2+y^2=R^2")
        self.assertEqual(res_v3.raw_payload_hex, v3_stream.hex())
        self.assertFalse(res_v3.needs_review)

        v5_stream = build_mtef_v5_stream("f(x)=2x+1")
        res_v5 = decode_mtef_bytes(v5_stream, formula_id="test_v5")
        self.assertTrue(res_v5.decodable)
        self.assertEqual(res_v5.mtef_version, 5)
        self.assertEqual(res_v5.source_format, "mtef_v5")
        self.assertEqual(res_v5.latex, "f(x)=2x+1")
        self.assertEqual(res_v5.raw_payload_hex, v5_stream.hex())
        self.assertFalse(res_v5.needs_review)

    def test_undecodable_mtef_preserves_raw_and_flags_review(self) -> None:
        corrupted = bytes.fromhex("63010104ffdeadbeef99")
        res = decode_mtef_bytes(corrupted, formula_id="bad_f1")
        self.assertFalse(res.decodable)
        self.assertTrue(res.needs_review)
        self.assertLess(res.confidence, 0.5)
        self.assertEqual(res.raw_payload_hex, "63010104ffdeadbeef99")
        self.assertIn("UNDECODABLE_MTEF", res.latex)

    def test_docx_preserves_paragraph_image_table_order(self) -> None:
        docx_path = os.path.join(FIXTURES_DIR, "golden_exam_v2.docx")
        parser = DocxParser()
        parsed = parser.parse_file(docx_path)
        self.assertEqual(parsed["parser_type"], "docx_ooxml")

        structured = build_questions_from_parsed_doc(parsed, exam_id="test_docx")
        self.assertEqual(structured["question_count"], 2)
        q1 = structured["questions"][0]

        # Question 1 stem_blocks must preserve order: paragraph (0) -> inline_image (1) -> table (2)
        block_types = [b["type"] for b in q1["stem_blocks"]]
        self.assertEqual(block_types, ["paragraph", "inline_image", "table"])
        order_indices = [b["order_index"] for b in q1["stem_blocks"]]
        self.assertEqual(order_indices, [0, 1, 2])

        # Verify OMML fraction and MTEF v5 were both decoded in Q1
        self.assertIn(r"\frac{2x+1}{x-1}", q1["stem"])
        self.assertIn("y=2", q1["stem"])
        self.assertTrue(structured["validation_report"]["can_publish"])

    def test_legacy_doc_binary_parser_separate_from_docx(self) -> None:
        doc_path = os.path.join(FIXTURES_DIR, "golden_legacy_v3.doc")
        parser = DocBinaryParser()
        parsed = parser.parse_file(doc_path)
        self.assertEqual(parsed["parser_type"], "doc_ole2_binary")

        structured = build_questions_from_parsed_doc(parsed, exam_id="test_doc")
        self.assertEqual(structured["question_count"], 1)
        q1 = structured["questions"][0]
        self.assertEqual(
            [b["type"] for b in q1["stem_blocks"]],
            ["paragraph", "table", "inline_image"],
        )
        self.assertIn("E=mc^2", q1["stem"])
        self.assertTrue(structured["validation_report"]["can_publish"])

    def test_corrupted_formula_blocks_publish_until_human_verified(self) -> None:
        bad_doc_path = os.path.join(FIXTURES_DIR, "corrupted_formula.doc")
        parser = DocBinaryParser()
        parsed = parser.parse_file(bad_doc_path)
        structured = build_questions_from_parsed_doc(parsed, exam_id="test_bad_doc")

        # Must block publish because formula is undecodable and unverified
        self.assertFalse(structured["validation_report"]["can_publish"])
        q1 = structured["questions"][0]
        self.assertTrue(q1["validation"]["needs_review"])
        self.assertTrue(
            any("CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED" in e for e in q1["validation"]["critical_errors"])
        )

        # Human teacher verifies and supplies corrected LaTeX while keeping raw_payload_hex intact
        formula_id = q1["formulas"][0]["formula_id"]
        original_hex = q1["formulas"][0]["raw_payload_hex"]
        verify_question_by_human(
            q1,
            verifier_name="TS. Nguyen Hoang Minh",
            corrected_latex_map={formula_id: "x^2 + 2x + 10"},
        )
        self.assertFalse(q1["validation"]["needs_review"])
        self.assertEqual(len(q1["validation"]["critical_errors"]), 0)
        self.assertEqual(q1["formulas"][0]["raw_payload_hex"], original_hex)

    def test_xss_sanitization_in_word_import(self) -> None:
        xss_path = os.path.join(FIXTURES_DIR, "malicious_xss.docx")
        parser = DocxParser()
        parsed = parser.parse_file(xss_path)
        structured = build_questions_from_parsed_doc(parsed, exam_id="test_xss")
        q1_stem = structured["questions"][0]["stem"]
        self.assertNotIn("<script>", q1_stem.lower())
        self.assertNotIn("onerror=", q1_stem.lower())

    def test_missing_question_sequence_detected(self) -> None:
        mock_parsed = {
            "parser_type": "docx_ooxml",
            "source_name": "gap_test.docx",
            "blocks": [
                {"block_id": "b1", "order_index": 0, "type": "paragraph", "content": "Cau 1: Cau hoi mot"},
                {"block_id": "b2", "order_index": 1, "type": "paragraph", "content": "*A. Dap an 1"},
                {"block_id": "b3", "order_index": 2, "type": "paragraph", "content": "Cau 3: Cau hoi ba bi nhay so"},
                {"block_id": "b4", "order_index": 3, "type": "paragraph", "content": "*A. Dap an 3"},
            ],
            "formulas": [],
        }
        structured = build_questions_from_parsed_doc(mock_parsed, exam_id="test_gap")
        self.assertFalse(structured["validation_report"]["can_publish"])
        self.assertTrue(
            any(
                "CRITICAL_MISSING_QUESTION_SEQUENCE" in err
                for err in structured["validation_report"]["critical_errors"]
            )
        )


if __name__ == "__main__":
    unittest.main()
