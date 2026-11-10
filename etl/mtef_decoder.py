"""
Section 6.4: Multi-Version MTEF (MathType Equation Format v3 & v5) + OMML Decoder
- Decodes MTEF v3 (Equation Editor 3.x) and MTEF v5 (MathType 5.x/6.x/7.x) binary streams
- Decodes Office Math Markup Language (OMML <m:oMath>) XML nodes
- Always preserves raw_payload_hex / raw_omml
- NEVER silently modifies or drops undecodable formulas; flags needs_review=True and decodable=False
"""

from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
import xml.etree.ElementTree as ET


@dataclass
class DecodedFormula:
    formula_id: str
    source_format: str  # 'mtef_v3' | 'mtef_v5' | 'omml' | 'mtef_unknown'
    mtef_version: Optional[int]
    latex: str
    raw_payload_hex: Optional[str]
    raw_omml: Optional[str]
    decodable: bool
    confidence: float
    needs_review: bool
    diagnostic_note: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# MTEF Record Types (v3 & v5 specification)
MTEF_END = 0
MTEF_SLOT = 1
MTEF_CHAR = 2
MTEF_TMPL = 3
MTEF_PILE = 4
MTEF_MATRIX = 5
MTEF_EMBELL = 6
MTEF_RULER = 7
MTEF_FONT_STYLE_DEF = 8
MTEF_SIZE = 9
MTEF_FULL = 10

# Common MTEF Template Selectors (v5 / v3)
TMPL_ROOT = 10      # Square root / nth root
TMPL_FRACT = 11     # Fraction \frac{a}{b}
TMPL_INTEGRAL = 15  # Integral \int
TMPL_SUM = 16       # Summation \sum
TMPL_SUP = 27       # Superscript
TMPL_SUB = 28       # Subscript
TMPL_SUBSUP = 29    # Subscript + Superscript

GREEK_CHAR_MAP = {
    0x03B1: r"\alpha",
    0x03B2: r"\beta",
    0x03B3: r"\gamma",
    0x03B4: r"\delta",
    0x03C0: r"\pi",
    0x03C9: r"\omega",
    0x0394: r"\Delta",
    0x03A9: r"\Omega",
    0x222B: r"\int",
    0x2211: r"\sum",
    0x221E: r"\infty",
    0x2264: r"\le",
    0x2265: r"\ge",
    0x2260: r"\ne",
}


def decode_mtef_bytes(payload: bytes, formula_id: str = "f_mtef") -> DecodedFormula:
    """
    Decodes an MTEF binary stream (either raw MTEF or OLE-wrapped MathType Equation stream).
    Always retains the exact hex payload in raw_payload_hex.
    If the stream is truncated, corrupted, or uses an unsupported MTEF version,
    returns decodable=False and needs_review=True without fabricating LaTeX.
    """
    raw_hex = payload.hex() if payload else ""

    if not payload or len(payload) < 5:
        return DecodedFormula(
            formula_id=formula_id,
            source_format="mtef_unknown",
            mtef_version=None,
            latex=f"[UNDECODABLE_MTEF_RAW:{raw_hex}]",
            raw_payload_hex=raw_hex,
            raw_omml=None,
            decodable=False,
            confidence=0.0,
            needs_review=True,
            diagnostic_note="MTEF stream shorter than minimum 5-byte header",
        )

    # Check if there is an OLE Equation Native 28-byte header before the MTEF header
    stream = payload
    if len(payload) > 28 and payload[0] == 0x1C and payload[1] == 0x00:
        header_len = int.from_bytes(payload[0:2], byteorder="little")
        if header_len < len(payload):
            stream = payload[header_len:]

    mtef_ver = stream[0]
    if mtef_ver == 3:
        return _decode_mtef_v3(stream, raw_hex, formula_id)
    elif mtef_ver == 5:
        return _decode_mtef_v5(stream, raw_hex, formula_id)
    else:
        return DecodedFormula(
            formula_id=formula_id,
            source_format="mtef_unknown",
            mtef_version=int(mtef_ver),
            latex=f"[UNDECODABLE_MTEF_V{mtef_ver}_RAW:{raw_hex}]",
            raw_payload_hex=raw_hex,
            raw_omml=None,
            decodable=False,
            confidence=0.1,
            needs_review=True,
            diagnostic_note=f"Unsupported MTEF version {mtef_ver}; preserved raw hex without modification",
        )


def _decode_mtef_v3(stream: bytes, raw_hex: str, formula_id: str) -> DecodedFormula:
    """
    MTEF v3 Header:
    Byte 0: version (3)
    Byte 1: platform (0=Mac, 1=Windows)
    Byte 2: product (0=MathType, 1=Equation Editor)
    Byte 3: product version
    Byte 4: product subversion
    Bytes 5..: records
    """
    if len(stream) < 6:
        return DecodedFormula(
            formula_id=formula_id,
            source_format="mtef_v3",
            mtef_version=3,
            latex=f"[UNDECODABLE_MTEF_V3_RAW:{raw_hex}]",
            raw_payload_hex=raw_hex,
            raw_omml=None,
            decodable=False,
            confidence=0.15,
            needs_review=True,
            diagnostic_note="Truncated MTEF v3 stream (no records after 5-byte header)",
        )

    body = stream[5:]
    return _parse_mtef_records(body, version=3, raw_hex=raw_hex, formula_id=formula_id)


def _decode_mtef_v5(stream: bytes, raw_hex: str, formula_id: str) -> DecodedFormula:
    """
    MTEF v5 Header:
    Byte 0: version (5)
    Byte 1: platform
    Byte 2: product
    Byte 3: product version
    Byte 4: product subversion
    Null-terminated application key string (e.g. "DSMT4\\x00" or "\\x00")
    1 byte: equation options (0=inline, 1=display)
    Remaining bytes: records
    """
    idx = 5
    # Advance past null-terminated application key
    while idx < len(stream) and stream[idx] != 0:
        idx += 1
    if idx >= len(stream):
        return DecodedFormula(
            formula_id=formula_id,
            source_format="mtef_v5",
            mtef_version=5,
            latex=f"[UNDECODABLE_MTEF_V5_RAW:{raw_hex}]",
            raw_payload_hex=raw_hex,
            raw_omml=None,
            decodable=False,
            confidence=0.15,
            needs_review=True,
            diagnostic_note="Corrupted MTEF v5 header: missing null terminator for application key",
        )
    idx += 1  # skip null byte
    if idx >= len(stream):
        return DecodedFormula(
            formula_id=formula_id,
            source_format="mtef_v5",
            mtef_version=5,
            latex=f"[UNDECODABLE_MTEF_V5_RAW:{raw_hex}]",
            raw_payload_hex=raw_hex,
            raw_omml=None,
            decodable=False,
            confidence=0.15,
            needs_review=True,
            diagnostic_note="Truncated MTEF v5 header: missing equation options byte",
        )
    idx += 1  # skip equation options byte

    body = stream[idx:]
    return _parse_mtef_records(body, version=5, raw_hex=raw_hex, formula_id=formula_id)


def _parse_mtef_records(
    body: bytes, version: int, raw_hex: str, formula_id: str
) -> DecodedFormula:
    tokens: List[str] = []
    idx = 0
    unknown_opcodes = 0

    while idx < len(body):
        raw_tag = body[idx]
        rec_type = raw_tag & 0x0F
        options = (raw_tag & 0xF0) >> 4
        idx += 1

        if rec_type == MTEF_END:
            break
        elif rec_type in (MTEF_SLOT, MTEF_FULL, MTEF_SIZE, MTEF_RULER, MTEF_FONT_STYLE_DEF):
            # Structural framing markers
            continue
        elif rec_type == MTEF_CHAR:
            # In our structured MTEF v3/v5 stream encoding:
            # [typeface_byte, char_low, char_high]
            if idx + 3 > len(body):
                unknown_opcodes += 1
                break
            _typeface = body[idx]
            codepoint = int.from_bytes(body[idx + 1 : idx + 3], byteorder="little")
            idx += 3
            if codepoint in GREEK_CHAR_MAP:
                tokens.append(GREEK_CHAR_MAP[codepoint])
            elif 32 <= codepoint <= 126:
                tokens.append(chr(codepoint))
            else:
                unknown_opcodes += 1
        elif rec_type == MTEF_TMPL:
            if idx >= len(body):
                unknown_opcodes += 1
                break
            selector = body[idx]
            idx += 1
            if selector == TMPL_FRACT:
                tokens.append(r"\frac")
            elif selector == TMPL_ROOT:
                tokens.append(r"\sqrt")
            elif selector == TMPL_INTEGRAL:
                tokens.append(r"\int")
            elif selector == TMPL_SUM:
                tokens.append(r"\sum")
            elif selector == TMPL_SUP:
                tokens.append("^")
            elif selector == TMPL_SUB:
                tokens.append("_")
            else:
                unknown_opcodes += 1
        elif rec_type == 0x0F or options >= 0x08:
            # Explicit damaged / vendor-private record opcode
            unknown_opcodes += 1
            break
        else:
            unknown_opcodes += 1

    assembled = "".join(tokens).strip()
    source_fmt = f"mtef_v{version}"

    if unknown_opcodes > 0 or not assembled:
        return DecodedFormula(
            formula_id=formula_id,
            source_format=source_fmt,
            mtef_version=version,
            latex=f"[UNDECODABLE_MTEF_V{version}_RAW:{raw_hex}]",
            raw_payload_hex=raw_hex,
            raw_omml=None,
            decodable=False,
            confidence=0.22,
            needs_review=True,
            diagnostic_note=f"Encountered {unknown_opcodes} undecodable MTEF record(s); preserved original hex payload",
        )

    confidence = 0.96 if version == 3 else 0.99
    return DecodedFormula(
        formula_id=formula_id,
        source_format=source_fmt,
        mtef_version=version,
        latex=assembled,
        raw_payload_hex=raw_hex,
        raw_omml=None,
        decodable=True,
        confidence=confidence,
        needs_review=False,
        diagnostic_note=f"Decoded cleanly from MTEF v{version}",
    )


def build_mtef_v3_stream(ascii_expr: str) -> bytes:
    """Helper to construct a valid canonical MTEF v3 binary stream for fixtures and tests."""
    out = bytearray([3, 1, 1, 3, 0])  # v3, Windows, Equation Editor 3.0
    out.append(MTEF_FULL)
    for ch in ascii_expr:
        out.append(MTEF_CHAR)
        out.append(1)  # typeface
        cp = ord(ch)
        out.extend(cp.to_bytes(2, byteorder="little"))
    out.append(MTEF_END)
    return bytes(out)


def build_mtef_v5_stream(ascii_expr: str, app_key: str = "DSMT4") -> bytes:
    """Helper to construct a valid canonical MTEF v5 binary stream for fixtures and tests."""
    out = bytearray([5, 1, 0, 6, 0])  # v5, Windows, MathType 6.0
    out.extend(app_key.encode("ascii"))
    out.append(0)  # null terminator
    out.append(0)  # inline equation option
    out.append(MTEF_FULL)
    for ch in ascii_expr:
        out.append(MTEF_CHAR)
        out.append(1)
        cp = ord(ch)
        out.extend(cp.to_bytes(2, byteorder="little"))
    out.append(MTEF_END)
    return bytes(out)


def decode_omml_element(omml_elem: ET.Element, formula_id: str = "f_omml") -> DecodedFormula:
    """
    Converts an Office Math Markup Language (<m:oMath>) XML element into LaTeX while
    preserving the exact raw XML string in raw_omml.
    """
    raw_xml = ET.tostring(omml_elem, encoding="unicode")
    try:
        latex = _walk_omml(omml_elem).strip()
        if not latex:
            return DecodedFormula(
                formula_id=formula_id,
                source_format="omml",
                mtef_version=None,
                latex=f"[UNDECODABLE_OMML_RAW]",
                raw_payload_hex=None,
                raw_omml=raw_xml,
                decodable=False,
                confidence=0.3,
                needs_review=True,
                diagnostic_note="OMML node produced empty LaTeX; flagged for human review",
            )
        return DecodedFormula(
            formula_id=formula_id,
            source_format="omml",
            mtef_version=None,
            latex=latex,
            raw_payload_hex=None,
            raw_omml=raw_xml,
            decodable=True,
            confidence=0.98,
            needs_review=False,
            diagnostic_note="Decoded cleanly from OOXML OMML",
        )
    except Exception as exc:
        return DecodedFormula(
            formula_id=formula_id,
            source_format="omml",
            mtef_version=None,
            latex=f"[UNDECODABLE_OMML_RAW]",
            raw_payload_hex=None,
            raw_omml=raw_xml,
            decodable=False,
            confidence=0.2,
            needs_review=True,
            diagnostic_note=f"OMML decode exception: {exc}",
        )


def _local_tag(elem: ET.Element) -> str:
    return elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag


def _walk_omml(elem: ET.Element) -> str:
    tag = _local_tag(elem)
    if tag == "t":
        return elem.text or ""
    if tag == "f":
        num_el = next((c for c in elem if _local_tag(c) == "num"), None)
        den_el = next((c for c in elem if _local_tag(c) == "den"), None)
        num_str = _walk_omml(num_el) if num_el is not None else ""
        den_str = _walk_omml(den_el) if den_el is not None else ""
        return f"\\frac{{{num_str}}}{{{den_str}}}"
    if tag == "rad":
        deg_el = next((c for c in elem if _local_tag(c) == "deg"), None)
        e_el = next((c for c in elem if _local_tag(c) == "e"), None)
        deg_str = _walk_omml(deg_el).strip() if deg_el is not None else ""
        e_str = _walk_omml(e_el) if e_el is not None else ""
        if deg_str:
            return f"\\sqrt[{deg_str}]{{{e_str}}}"
        return f"\\sqrt{{{e_str}}}"
    if tag == "sSup":
        e_el = next((c for c in elem if _local_tag(c) == "e"), None)
        sup_el = next((c for c in elem if _local_tag(c) == "sup"), None)
        base_str = _walk_omml(e_el) if e_el is not None else ""
        sup_str = _walk_omml(sup_el) if sup_el is not None else ""
        return f"{base_str}^{{{sup_str}}}"
    if tag == "sSub":
        e_el = next((c for c in elem if _local_tag(c) == "e"), None)
        sub_el = next((c for c in elem if _local_tag(c) == "sub"), None)
        base_str = _walk_omml(e_el) if e_el is not None else ""
        sub_str = _walk_omml(sub_el) if sub_el is not None else ""
        return f"{base_str}_{{{sub_str}}}"

    parts: List[str] = []
    for child in elem:
        parts.append(_walk_omml(child))
    return "".join(parts)
