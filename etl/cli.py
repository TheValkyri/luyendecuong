"""
CLI Entry Point for KhaoThi Pro Python ETL Pipeline.
Allows Node.js backend or command line users to parse .doc and .docx fixtures and output JSON.
"""

import sys
import os
import json
from .doc_parser import DocBinaryParser
from .docx_parser import DocxParser
from .validator import build_questions_from_parsed_doc
from .generate_fixtures import generate_all_fixtures, FIXTURES_DIR


def parse_word_document(file_path: str, exam_id: str = "exam_word_import") -> dict:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".docx":
        parser = DocxParser()
        parsed = parser.parse_file(file_path)
    elif ext == ".doc":
        parser = DocBinaryParser()
        parsed = parser.parse_file(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {ext}. Expected .doc or .docx")

    structured = build_questions_from_parsed_doc(parsed, exam_id=exam_id)
    structured["raw_blocks_count"] = len(parsed.get("blocks", []))
    structured["decoded_formulas"] = parsed.get("formulas", [])
    return structured


def main() -> None:
    generate_all_fixtures()
    if len(sys.argv) < 2:
        default_fixture = os.path.join(FIXTURES_DIR, "golden_exam_v2.docx")
        result = parse_word_document(default_fixture)
        print(json.dumps(result, indent=2))
        return

    cmd = sys.argv[1]
    if cmd == "--fixture":
        fixture_name = sys.argv[2] if len(sys.argv) > 2 else "golden_exam_v2.docx"
        target_path = os.path.join(FIXTURES_DIR, fixture_name)
        result = parse_word_document(target_path)
        print(json.dumps(result))
    else:
        result = parse_word_document(cmd)
        print(json.dumps(result))


if __name__ == "__main__":
    main()
