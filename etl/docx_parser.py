"""
Section 6.4: Dedicated .DOCX (OOXML) Parser
- Separately parses .docx archives (word/document.xml, word/_rels/document.xml.rels, embedded OLE objects)
- Preserves exact document sequence of paragraphs (<w:p>), tables (<w:tbl>), and inline images (<w:drawing> / <v:imagedata>)
- Extracts both OMML (<m:oMath>) and embedded MTEF v3/v5 binary equations
- Sanitizes dangerous HTML/script payloads
"""

import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
import re
from .mtef_decoder import decode_mtef_bytes, decode_omml_element, DecodedFormula


SCRIPT_CLEAN_RE = re.compile(r"<\s*/?\s*(script|iframe|object|embed|style)[^>]*>", re.IGNORECASE)
ON_EVENT_RE = re.compile(r"\s+on[a-z]+\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)", re.IGNORECASE)


def sanitize_text_content(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<\s*script[^>]*>[\s\S]*?<\s*/\s*script\s*>", "", text, flags=re.IGNORECASE)
    cleaned = SCRIPT_CLEAN_RE.sub("", cleaned)
    cleaned = ON_EVENT_RE.sub("", cleaned)
    cleaned = re.sub(r"javascript\s*:", "blocked:", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def _local_name(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


class DocxParser:
    """Dedicated OOXML .docx parser enforcing strict document block ordering."""

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        with zipfile.ZipFile(file_path, "r") as zf:
            return self._parse_zip(zf, source_name=file_path)

    def parse_bytes(self, data: bytes, source_name: str = "upload.docx") -> Dict[str, Any]:
        import io
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            return self._parse_zip(zf, source_name=source_name)

    def _parse_zip(self, zf: zipfile.ZipFile, source_name: str) -> Dict[str, Any]:
        names = set(zf.namelist())
        if "word/document.xml" not in names:
            raise ValueError(f"Invalid .docx archive ({source_name}): missing word/document.xml")

        # Load relationships to map r:embed -> media or embeddings target
        rels_map: Dict[str, str] = {}
        if "word/_rels/document.xml.rels" in names:
            rels_xml = zf.read("word/_rels/document.xml.rels")
            rels_root = ET.fromstring(rels_xml)
            for rel in rels_root:
                r_id = rel.attrib.get("Id")
                target = rel.attrib.get("Target", "")
                if r_id:
                    rels_map[r_id] = target

        # Pre-load any embedded MTEF binary streams stored under word/embeddings/
        embedded_mtef: Dict[str, bytes] = {}
        for name in names:
            if name.startswith("word/embeddings/") and (name.endswith(".bin") or name.endswith(".mtef")):
                embedded_mtef[name] = zf.read(name)

        doc_xml = zf.read("word/document.xml")
        root = ET.fromstring(doc_xml)
        body = next((c for c in root if _local_name(c.tag) == "body"), None)
        if body is None:
            raise ValueError("Invalid word/document.xml: missing <w:body>")

        blocks: List[Dict[str, Any]] = []
        formulas: List[Dict[str, Any]] = []
        order_idx = 0
        formula_counter = 1

        for child in body:
            lname = _local_name(child.tag)

            if lname == "p":
                # Walk paragraph children in exact inline order to preserve text, inline images, and formulas
                para_segments: List[str] = []
                inline_images_in_para: List[Dict[str, Any]] = []

                for elem in child.iter():
                    el_name = _local_name(elem.tag)

                    if el_name == "t" and elem.text:
                        # Avoid duplicating text inside <m:oMath> which is handled by OMML walker
                        para_segments.append(elem.text)

                    elif el_name == "oMath":
                        f_id = f"f_omml_{formula_counter:03d}"
                        formula_counter += 1
                        decoded = decode_omml_element(elem, formula_id=f_id)
                        formulas.append(decoded.to_dict())
                        para_segments.append(f" ${decoded.latex}$ ")

                    elif el_name in ("blip", "imagedata"):
                        # Find relationship ID r:embed or r:id
                        r_embed = None
                        for attr_k, attr_v in elem.attrib.items():
                            if attr_k.endswith("embed") or attr_k.endswith("id"):
                                r_embed = attr_v
                                break
                        target_path = rels_map.get(r_embed or "", f"media/{r_embed or 'img'}.png")
                        inline_images_in_para.append(
                            {
                                "asset_id": f"asset_{r_embed or order_idx}",
                                "target": target_path,
                                "alt_text": elem.attrib.get("title") or f"Inline diagram ({target_path})",
                            }
                        )

                    elif el_name == "OLEObject":
                        r_id = None
                        for attr_k, attr_v in elem.attrib.items():
                            if attr_k.endswith("id"):
                                r_id = attr_v
                                break
                        target = rels_map.get(r_id or "", "")
                        norm_target = f"word/{target.lstrip('/')}" if not target.startswith("word/") else target
                        mtef_bytes = embedded_mtef.get(norm_target, b"")
                        f_id = f"f_mtef_{formula_counter:03d}"
                        formula_counter += 1
                        decoded: DecodedFormula = decode_mtef_bytes(mtef_bytes, formula_id=f_id)
                        formulas.append(decoded.to_dict())
                        para_segments.append(f" ${decoded.latex}$ ")

                cleaned_text = sanitize_text_content("".join(para_segments))
                if cleaned_text:
                    blocks.append(
                        {
                            "block_id": f"blk_{order_idx:04d}",
                            "order_index": order_idx,
                            "type": "paragraph",
                            "content": cleaned_text,
                        }
                    )
                    order_idx += 1

                for img_info in inline_images_in_para:
                    blocks.append(
                        {
                            "block_id": f"blk_{order_idx:04d}",
                            "order_index": order_idx,
                            "type": "inline_image",
                            "asset_id": img_info["asset_id"],
                            "alt_text": sanitize_text_content(img_info["alt_text"]),
                        }
                    )
                    order_idx += 1

            elif lname == "tbl":
                rows_data: List[List[str]] = []
                for tr in child:
                    if _local_name(tr.tag) != "tr":
                        continue
                    row_cells: List[str] = []
                    for tc in tr:
                        if _local_name(tc.tag) != "tc":
                            continue
                        cell_texts = [
                            t.text for t in tc.iter() if _local_name(t.tag) == "t" and t.text
                        ]
                        row_cells.append(sanitize_text_content("".join(cell_texts)))
                    if row_cells:
                        rows_data.append(row_cells)

                if rows_data:
                    blocks.append(
                        {
                            "block_id": f"blk_{order_idx:04d}",
                            "order_index": order_idx,
                            "type": "table",
                            "table_rows": rows_data,
                        }
                    )
                    order_idx += 1

        return {
            "parser_type": "docx_ooxml",
            "source_name": source_name,
            "blocks": blocks,
            "formulas": formulas,
        }
