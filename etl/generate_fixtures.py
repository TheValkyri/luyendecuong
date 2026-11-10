"""
Generates golden test fixtures in etl/fixtures/ for .docx, .doc, MTEF v3, MTEF v5,
undecodable MTEF preservation, paragraph/table/image order preservation, and XSS sanitization.
"""

import os
import json
import zipfile
from .mtef_decoder import build_mtef_v3_stream, build_mtef_v5_stream
from .doc_parser import OLE2_MAGIC

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def generate_all_fixtures() -> None:
    os.makedirs(FIXTURES_DIR, exist_ok=True)
    _create_golden_docx(os.path.join(FIXTURES_DIR, "golden_exam_v2.docx"))
    _create_xss_docx(os.path.join(FIXTURES_DIR, "malicious_xss.docx"))
    _create_golden_doc(os.path.join(FIXTURES_DIR, "golden_legacy_v3.doc"))
    _create_corrupted_mtef_doc(os.path.join(FIXTURES_DIR, "corrupted_formula.doc"))


def _create_golden_docx(path: str) -> None:
    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/graph1.png"/>
  <Relationship Id="rIdMtef1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="embeddings/eq_v5.bin"/>
</Relationships>"""

    document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:o="urn:schemas-microsoft-com:office:office">
  <w:body>
    <w:p>
      <w:r><w:t>Cau 1: Cho ham so co bieu thuc </w:t></w:r>
      <m:oMath>
        <m:f>
          <m:num><m:r><m:t>2x+1</m:t></m:r></m:num>
          <m:den><m:r><m:t>x-1</m:t></m:r></m:den>
        </m:f>
      </m:oMath>
      <w:r><w:t> va phuong trinh tiem can </w:t></w:r>
      <w:object><o:OLEObject r:id="rIdMtef1"/></w:object>
      <w:drawing>
        <a:blip r:embed="rIdImg1" title="Do thi ham phan thuc bac nhat"/>
      </w:drawing>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>-oo</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>+oo</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>y'</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>-</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>||</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>-</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:r><w:t>*A. y = 2 va x = 1</w:t></w:r></w:p>
    <w:p><w:r><w:t>B. y = 1 va x = 2</w:t></w:r></w:p>
    <w:p><w:r><w:t>C. y = -1 va x = 1</w:t></w:r></w:p>
    <w:p><w:r><w:t>D. y = 2 va x = -1</w:t></w:r></w:p>
    <w:p><w:r><w:t>Loi giai: Tiem can ngang y = 2, tiem can dung x = 1.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Cau 2: Xet tinh dung sai cua cac menh de sau:</w:t></w:r></w:p>
    <w:p><w:r><w:t>*a) Tiem can ngang la y = 2</w:t></w:r></w:p>
    <w:p><w:r><w:t>*b) Tiem can dung la x = 1</w:t></w:r></w:p>
    <w:p><w:r><w:t>c) Ham so dong bien tren R</w:t></w:r></w:p>
    <w:p><w:r><w:t>*d) Dao ham y' = -3/(x-1)^2</w:t></w:r></w:p>
    <w:p><w:r><w:t>Loi giai: Kiem tra tung menh de theo bang bien thien.</w:t></w:r></w:p>
  </w:body>
</w:document>"""

    mtef_v5_bytes = build_mtef_v5_stream("y=2")

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", rels_xml)
        zf.writestr("word/embeddings/eq_v5.bin", mtef_v5_bytes)
        zf.writestr("word/media/graph1.png", b"\x89PNG\r\n\x1a\nMOCK_PNG")


def _create_xss_docx(path: str) -> None:
    document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Cau 1: Noi dung chua ma doc &lt;script&gt;alert('xss')&lt;/script&gt; va &lt;img src=x onerror="alert(1)"&gt; can duoc lam sach.</w:t></w:r></w:p>
    <w:p><w:r><w:t>*A. Dap an an toan</w:t></w:r></w:p>
    <w:p><w:r><w:t>B. Phuong an B</w:t></w:r></w:p>
    <w:p><w:r><w:t>C. Phuong an C</w:t></w:r></w:p>
    <w:p><w:r><w:t>D. Phuong an D</w:t></w:r></w:p>
    <w:p><w:r><w:t>Loi giai: Da loai bo the script.</w:t></w:r></w:p>
  </w:body>
</w:document>"""
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", document_xml)


def _create_golden_doc(path: str) -> None:
    mtef_v3_hex = build_mtef_v3_stream("E=mc^2").hex()
    stream_payload = {
        "elements": [
            {
                "type": "paragraph",
                "text": "Cau 1: Nang luong nghỉ cua hat theo cong thuc {FORMULA} la gi?",
                "mtef_streams_hex": [mtef_v3_hex],
            },
            {
                "type": "table",
                "rows": [
                    ["Dai luong", "Don vi"],
                    ["Khoi luong m", "kg"],
                    ["Toc do anh sang c", "3x10^8 m/s"],
                ],
            },
            {
                "type": "inline_image",
                "asset_id": "doc_img_relativity_01",
                "alt_text": "So do tuong duong nang luong - khoi luong",
            },
            {"type": "paragraph", "text": "*A. E = mc^2", "mtef_streams_hex": []},
            {"type": "paragraph", "text": "B. E = 0.5mv^2", "mtef_streams_hex": []},
            {"type": "paragraph", "text": "C. E = mgh", "mtef_streams_hex": []},
            {"type": "paragraph", "text": "D. E = hf", "mtef_streams_hex": []},
            {
                "type": "paragraph",
                "text": "Loi giai: He thuc Einstein E = mc^2.",
                "mtef_streams_hex": [],
            },
        ]
    }
    raw_bytes = (
        OLE2_MAGIC
        + b"\x00" * 16
        + b"WORDDOC_STREAM_V1:"
        + json.dumps(stream_payload).encode("utf-8")
        + b":END_WORDDOC_STREAM"
    )
    with open(path, "wb") as f:
        f.write(raw_bytes)


def _create_corrupted_mtef_doc(path: str) -> None:
    # Version 99 unknown MTEF stream + corrupted record bytes
    corrupted_mtef_hex = "63010104ffdeadbeef99"
    stream_payload = {
        "elements": [
            {
                "type": "paragraph",
                "text": "Cau 1: Tinh bieu thuc chua cong thuc loi {FORMULA}",
                "mtef_streams_hex": [corrupted_mtef_hex],
            },
            {"type": "paragraph", "text": "*A. 10", "mtef_streams_hex": []},
            {"type": "paragraph", "text": "B. 20", "mtef_streams_hex": []},
            {"type": "paragraph", "text": "C. 30", "mtef_streams_hex": []},
            {"type": "paragraph", "text": "D. 40", "mtef_streams_hex": []},
        ]
    }
    raw_bytes = (
        OLE2_MAGIC
        + b"\x00" * 16
        + b"WORDDOC_STREAM_V1:"
        + json.dumps(stream_payload).encode("utf-8")
        + b":END_WORDDOC_STREAM"
    )
    with open(path, "wb") as f:
        f.write(raw_bytes)


if __name__ == "__main__":
    generate_all_fixtures()
    print(f"Generated golden fixtures in {FIXTURES_DIR}")
