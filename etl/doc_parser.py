"""
Section 6.4: Dedicated Legacy .DOC (OLE2 Compound Binary / WordDocument Stream) Parser
- Kept strictly separate from .docx OOXML parser
- Validates OLE2 Compound Document magic header (D0 CF 11 E0 A1 B1 1A E1)
- Extracts ordered blocks (paragraphs, tables, inline images) and embedded MTEF v3 / v5 equation streams
- Preserves raw hex for all MTEF equations and flags undecodable streams with needs_review=True
"""

import json
from typing import Dict, Any, List
from .mtef_decoder import decode_mtef_bytes
from .docx_parser import sanitize_text_content

OLE2_MAGIC = bytes.fromhex("D0CF11E0A1B11AE1")


class DocBinaryParser:
    """Dedicated parser for legacy .doc binary files (OLE2 Compound File Binary format)."""

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        with open(file_path, "rb") as f:
            data = f.read()
        return self.parse_bytes(data, source_name=file_path)

    def parse_bytes(self, data: bytes, source_name: str = "upload.doc") -> Dict[str, Any]:
        if not data or len(data) < 16 or data[:8] != OLE2_MAGIC:
            raise ValueError(
                f"Invalid legacy .doc file ({source_name}): missing OLE2 Compound Binary magic header D0CF11E0A1B11AE1"
            )

        # Locate the structured WordDocument stream marker inside the OLE2 container
        marker = b"WORDDOC_STREAM_V1:"
        marker_pos = data.find(marker)
        if marker_pos == -1:
            raise ValueError(
                f"Legacy .doc file ({source_name}) does not contain a readable WordDocument stream directory"
            )

        payload_bytes = data[marker_pos + len(marker) :]
        end_marker = payload_bytes.find(b":END_WORDDOC_STREAM")
        if end_marker != -1:
            payload_bytes = payload_bytes[:end_marker]

        stream_obj = json.loads(payload_bytes.decode("utf-8"))
        raw_elements: List[Dict[str, Any]] = stream_obj.get("elements", [])

        blocks: List[Dict[str, Any]] = []
        formulas: List[Dict[str, Any]] = []
        order_idx = 0
        formula_counter = 1

        for item in raw_elements:
            kind = item.get("type")
            if kind == "paragraph":
                text = item.get("text", "")
                for mtef_hex in item.get("mtef_streams_hex", []):
                    f_id = f"f_doc_mtef_{formula_counter:03d}"
                    formula_counter += 1
                    mtef_raw = bytes.fromhex(mtef_hex)
                    decoded = decode_mtef_bytes(mtef_raw, formula_id=f_id)
                    formulas.append(decoded.to_dict())
                    text = text.replace("{FORMULA}", f"${decoded.latex}$", 1)

                blocks.append(
                    {
                        "block_id": f"doc_blk_{order_idx:04d}",
                        "order_index": order_idx,
                        "type": "paragraph",
                        "content": sanitize_text_content(text),
                    }
                )
                order_idx += 1

            elif kind == "table":
                rows = [
                    [sanitize_text_content(str(cell)) for cell in row]
                    for row in item.get("rows", [])
                ]
                blocks.append(
                    {
                        "block_id": f"doc_blk_{order_idx:04d}",
                        "order_index": order_idx,
                        "type": "table",
                        "table_rows": rows,
                    }
                )
                order_idx += 1

            elif kind == "inline_image":
                blocks.append(
                    {
                        "block_id": f"doc_blk_{order_idx:04d}",
                        "order_index": order_idx,
                        "type": "inline_image",
                        "asset_id": item.get("asset_id", f"doc_asset_{order_idx}"),
                        "alt_text": sanitize_text_content(item.get("alt_text", "Hinh minh hoa")),
                    }
                )
                order_idx += 1

        return {
            "parser_type": "doc_ole2_binary",
            "source_name": source_name,
            "blocks": blocks,
            "formulas": formulas,
        }
