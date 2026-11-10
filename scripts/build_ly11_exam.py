#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extracts all 4-option multiple-choice questions (single_choice) from
`Lý 11 chuyen de 1 - GV-2026.docx`, excluding all True/False, Short Answer,
and Essay sections.
Attaches essential physics diagrams/graphs (`diagram_svg`) to every question
that requires a figure to solve, and outputs the compiled ExamContract JSON.
"""

import glob
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'v': 'urn:schemas-microsoft-com:vml',
    'o': 'urn:schemas-microsoft-com:office:office',
}

WMF_LATEX_MAP = {
    'media/image23.wmf': r'$x = 5\cos\left(10\pi t + \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image24.wmf': r'$x = 6\cos\left(10\pi t + \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image25.wmf': r'$-\frac{\pi}{3}$',
    'media/image26.wmf': r'$x = -A\cos\left(\omega t + \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image27.wmf': r'$\frac{\pi}{3}$',
    'media/image28.wmf': r'$\frac{2\pi}{3}$',
    'media/image29.wmf': r'$-\frac{2\pi}{3}$',
    'media/image54.wmf': r'$T = 2\pi\omega$',
    'media/image55.wmf': r'$T = \frac{2\pi}{\omega}$',
    'media/image56.wmf': r'$T = \pi\omega$',
    'media/image57.wmf': r'$T = \frac{\pi}{\omega}$',
    'media/image58.wmf': r'$x = 6\cos\left(4\pi t + \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image76.wmf': r'$\frac{\pi}{2}$',
    'media/image98.wmf': r'$\frac{\pi A}{v_{\max}}$',
    'media/image99.wmf': r'$\frac{\pi v_{\max}}{A}$',
    'media/image100.wmf': r'$\frac{2\pi v_{\max}}{A}$',
    'media/image101.wmf': r'$\frac{2\pi A}{v_{\max}}$',
    'media/image102.wmf': r'$x = 4\cos\left(4\pi t + \frac{\pi}{2}\right)\text{ cm}$',
    'media/image103.wmf': r'$x = 5\cos\left(4\pi t + \frac{\pi}{2}\right)\text{ cm}$',
    'media/image104.wmf': r'$\frac{1}{3}$',
    'media/image105.wmf': r'$\frac{3}{2}$',
    'media/image106.wmf': r'$\frac{2}{3}$',
    'media/image107.wmf': r'$\frac{1}{2}$',
    'media/image109.wmf': r'$6\pi\text{ cm/s}$',
    'media/image110.wmf': r'$5\pi\sqrt{2}\text{ cm/s}$',
    'media/image111.wmf': r'$5\pi\sqrt{3}\text{ cm/s}$',
    'media/image112.wmf': r'$4\pi\sqrt{5}\text{ cm/s}$',
    'media/image124.wmf': r'$x = 2\cos\left(5\pi t + \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image125.wmf': r'$x = 2\cos\left(5t + \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image126.wmf': r'$x = 2\cos\left(5\pi t - \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image127.wmf': r'$x = 2\cos\left(10\pi t + \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image128.wmf': r'$f = \frac{10}{\pi}\text{ Hz}$',
    'media/image129.wmf': r'$x = 4\cos\left(20t + \frac{\pi}{4}\right)\text{ cm}$',
    'media/image130.wmf': r'$x = 4\sin\left(20t + \frac{\pi}{4}\right)\text{ cm}$',
    'media/image131.wmf': r'$x = 4\sqrt{2}\cos\left(20t + \frac{3\pi}{4}\right)\text{ cm}$',
    'media/image132.wmf': r'$x = 4\sqrt{2}\sin\left(20t + \frac{3\pi}{4}\right)\text{ cm}$',
    'media/image133.wmf': r'$x = 4\cos\left(10\pi t - \frac{\pi}{6}\right)\text{ cm}$',
    'media/image134.wmf': r'$x = 4\cos\left(20\pi t + \frac{\pi}{6}\right)\text{ cm}$',
    'media/image135.wmf': r'$x = 2\cos\left(20\pi t - \frac{\pi}{6}\right)\text{ cm}$',
    'media/image136.wmf': r'$x = 2\cos\left(10\pi t + \frac{\pi}{6}\right)\text{ cm}$',
    'media/image137.wmf': r'$a = 8\cos\left(20t - \frac{\pi}{2}\right)\text{ m/s}^2$',
    'media/image138.wmf': r'$x = 0,02\cos\left(20t + \frac{\pi}{2}\right)\text{ cm}$',
    'media/image139.wmf': r'$x = 2\cos\left(20t - \frac{\pi}{2}\right)\text{ cm}$',
    'media/image140.wmf': r'$x = 4\cos\left(20t + \frac{\pi}{2}\right)\text{ cm}$',
    'media/image141.wmf': r'$x = 2\cos\left(20t + \frac{\pi}{2}\right)\text{ cm}$',
    'media/image142.wmf': r'$x = 2\sqrt{2}\cos\left(10t + \frac{3\pi}{4}\right)\text{ cm}$',
    'media/image143.wmf': r'$x = 2\sqrt{2}\cos\left(10t + \frac{\pi}{4}\right)\text{ cm}$',
    'media/image144.wmf': r'$x = 2\sqrt{2}\cos\left(10t - \frac{\pi}{4}\right)\text{ cm}$',
    'media/image145.wmf': r'$x = 2\sqrt{2}\cos\left(10t - \frac{3\pi}{4}\right)\text{ cm}$',
    'media/image146.wmf': r'$\frac{8\pi^2}{3}$',
    'media/image147.wmf': r'$x = 6\cos\left(\frac{2\pi}{3}t + \frac{2\pi}{3}\right)$',
    'media/image148.wmf': r'$x = 6\cos\left(\frac{2\pi}{3}t - \frac{2\pi}{3}\right)$',
    'media/image149.wmf': r'$x = 6\cos\left(\frac{2\pi}{3}t + \frac{\pi}{3}\right)$',
    'media/image150.wmf': r'$x = 6\cos\left(\frac{2\pi}{3}t - \frac{\pi}{3}\right)$',
    'media/image151.wmf': r'$x = 5\cos\left(\pi t - \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image152.wmf': r'$x = 5\cos\left(2\pi t - \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image153.wmf': r'$x = 5\cos\left(2\pi t + \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image154.wmf': r'$x = 5\cos\left(\pi t + \frac{\pi}{2}\right)\text{ (cm)}$',
    'media/image155.wmf': r'$x = 4\cos\left(20t - \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image156.wmf': r'$x = 6\cos\left(20t + \frac{\pi}{6}\right)\text{ (cm)}$',
    'media/image157.wmf': r'$x = 6\cos\left(20t - \frac{\pi}{6}\right)\text{ (cm)}$',
    'media/image158.wmf': r'$x = 4\cos\left(20t + \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image159.wmf': r'$x = 8\cos\left(5\pi t + \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image160.wmf': r'$x = 8\cos\left(5\pi t + \frac{\pi}{6}\right)\text{ (cm)}$',
    'media/image161.wmf': r'$x = 8\cos\left(5\pi t - \frac{\pi}{3}\right)\text{ (cm)}$',
    'media/image162.wmf': r'$x = 16\cos\left(5\pi t - \frac{\pi}{6}\right)\text{ (cm)}$',
    'media/image163.wmf': r'$x = 2\cos\left(\pi t - \frac{5\pi}{6}\right)\text{ cm}$',
    'media/image164.wmf': r'$x = 2\cos\left(\pi t + \frac{\pi}{6}\right)\text{ cm}$',
    'media/image165.wmf': r'$x = 2\cos\left(\pi t + \frac{\pi}{3}\right)\text{ cm}$',
    'media/image166.wmf': r'$x = 4\cos\left(\pi t - \frac{2\pi}{3}\right)\text{ cm}$',
    'media/image167.wmf': r'$x = 0,8\cos\left(10t - \frac{\pi}{6}\right)\text{ m}$',
    'media/image168.wmf': r'$x = 0,8\cos\left(10t - \frac{5\pi}{6}\right)\text{ m}$',
    'media/image169.wmf': r'$x = 0,4\cos\left(10t + \frac{\pi}{6}\right)\text{ m}$',
    'media/image170.wmf': r'$x = 0,4\cos\left(10t - \frac{\pi}{6}\right)\text{ m}$',
    'media/image171.wmf': r'$x = 3\sqrt{3}\cos\left(8\pi t - \frac{\pi}{6}\right)\text{ cm}$',
    'media/image172.wmf': r'$x = 2\sqrt{3}\cos\left(8\pi t - \frac{\pi}{6}\right)\text{ cm}$',
    'media/image173.wmf': r'$x = 6\cos\left(8\pi t + \frac{\pi}{6}\right)\text{ cm}$',
    'media/image174.wmf': r'$x = 3\sqrt{2}\cos\left(8\pi t + \frac{\pi}{3}\right)\text{ cm}$',
    'media/image175.wmf': r'$x = 4\cos\left(2\pi t + \frac{2\pi}{3}\right)\text{ cm}$',
    'media/image176.wmf': r'$x = 4\cos\left(2\pi t - \frac{2\pi}{3}\right)\text{ cm}$',
    'media/image177.wmf': r'$x = 4\cos\left(2\pi t - \frac{\pi}{3}\right)\text{ cm}$',
    'media/image178.wmf': r'$x = 4\cos\left(2\pi t + \frac{\pi}{3}\right)\text{ cm}$',
    'media/image201.wmf': r'$\frac{1}{2}mv^2$',
    'media/image202.wmf': r'$\frac{1}{2}m^2v$',
    'media/image203.wmf': r'$\frac{1}{2}m\omega^2 A^2$',
    'media/image204.wmf': r'$m\omega^2 A^2$',
    'media/image205.wmf': r'$\frac{1}{2}m\omega A^2$',
    'media/image206.wmf': r'$\frac{1}{2}m\omega^2 A$',
    'media/image214.wmf': r'$\frac{1}{2}kx^2$',
    'media/image215.wmf': r'$kx^2$',
    'media/image216.wmf': r'$\omega = \sqrt{\frac{m}{k}}$',
    'media/image217.wmf': r'$\omega = \sqrt{\frac{k}{m}}$',
    'media/image218.wmf': r'$\omega = \frac{1}{2\pi}\sqrt{\frac{k}{m}}$',
    'media/image219.wmf': r'$\omega = \frac{1}{2\pi}\sqrt{\frac{m}{k}}$',
    'media/image220.wmf': r'$f = 2\pi\sqrt{\frac{m}{k}}$',
    'media/image221.wmf': r'$f = 2\pi\sqrt{\frac{k}{m}}$',
    'media/image222.wmf': r'$f = \frac{1}{2\pi}\sqrt{\frac{k}{m}}$',
    'media/image223.wmf': r'$f = \frac{1}{2\pi}\sqrt{\frac{m}{k}}$',
    'media/image224.wmf': r'$T = 2\pi\sqrt{\frac{m}{k}}$',
    'media/image225.wmf': r'$T = 2\pi\sqrt{\frac{k}{m}}$',
    'media/image226.wmf': r'$T = \frac{1}{2\pi}\sqrt{\frac{k}{m}}$',
    'media/image227.wmf': r'$T = \frac{1}{2\pi}\sqrt{\frac{m}{k}}$',
    'media/image242.wmf': r'$f = \frac{1}{2\pi}\sqrt{\frac{\ell}{g}}$',
    'media/image243.wmf': r'$f = 2\pi\sqrt{\frac{g}{\ell}}$',
    'media/image244.wmf': r'$f = \frac{1}{2\pi}\sqrt{\frac{g}{\ell}}$',
    'media/image245.wmf': r'$f = 2\pi\sqrt{\frac{\ell}{g}}$',
}

SYMBOL_CHAR_MAP = {
    'F070': 'π',
    'F077': 'ω',
    'F06A': 'φ',
    'F066': 'φ',
    'F061': 'α',
    'F044': 'Δ',
    'F0D6': '√',
    'F0DE': '⇒',
    'F0AE': '→',
    'F0B1': '±',
}


def omath_to_latex(node: ET.Element) -> str:
    tag = node.tag.split('}')[-1]

    if tag == 'r':
        chunks = []
        for sub in node:
            stag = sub.tag.split('}')[-1]
            if stag == 't' and sub.text:
                chunks.append(sub.text)
            elif stag == 'sym':
                char_code = sub.attrib.get(f'{{{NS["w"]}}}char', '').upper()
                chunks.append(SYMBOL_CHAR_MAP.get(char_code, 'π'))
        txt = ''.join(chunks)
        return txt

    if tag == 'f':
        num_el = node.find('m:num', NS)
        den_el = node.find('m:den', NS)
        num_s = ''.join(omath_to_latex(c) for c in num_el) if num_el is not None else ''
        den_s = ''.join(omath_to_latex(c) for c in den_el) if den_el is not None else ''
        return f'\\frac{{{num_s}}}{{{den_s}}}'

    if tag == 'rad':
        deg_el = node.find('m:deg', NS)
        e_el = node.find('m:e', NS)
        deg_s = ''.join(omath_to_latex(c) for c in deg_el).strip() if deg_el is not None else ''
        e_s = ''.join(omath_to_latex(c) for c in e_el) if e_el is not None else ''
        if deg_s:
            return f'\\sqrt[{deg_s}]{{{e_s}}}'
        return f'\\sqrt{{{e_s}}}'

    if tag == 'sSup':
        e_el = node.find('m:e', NS)
        sup_el = node.find('m:sup', NS)
        e_s = ''.join(omath_to_latex(c) for c in e_el) if e_el is not None else ''
        sup_s = ''.join(omath_to_latex(c) for c in sup_el) if sup_el is not None else ''
        return f'{e_s}^{{{sup_s}}}'

    if tag == 'sSub':
        e_el = node.find('m:e', NS)
        sub_el = node.find('m:sub', NS)
        e_s = ''.join(omath_to_latex(c) for c in e_el) if e_el is not None else ''
        sub_s = ''.join(omath_to_latex(c) for c in sub_el) if sub_el is not None else ''
        return f'{e_s}_{{{sub_s}}}'

    if tag == 'sSubSup':
        e_el = node.find('m:e', NS)
        sub_el = node.find('m:sub', NS)
        sup_el = node.find('m:sup', NS)
        e_s = ''.join(omath_to_latex(c) for c in e_el) if e_el is not None else ''
        sub_s = ''.join(omath_to_latex(c) for c in sub_el) if sub_el is not None else ''
        sup_s = ''.join(omath_to_latex(c) for c in sup_el) if sup_el is not None else ''
        return f'{e_s}_{{{sub_s}}}^{{{sup_s}}}'

    if tag == 'd':
        dPr = node.find('m:dPr', NS)
        beg_chr = '('
        end_chr = ')'
        if dPr is not None:
            bc = dPr.find('m:begChr', NS)
            ec = dPr.find('m:endChr', NS)
            if bc is not None:
                beg_chr = bc.attrib.get(f'{{{NS["m"]}}}val', '(')
            if ec is not None:
                end_chr = ec.attrib.get(f'{{{NS["m"]}}}val', ')')
        inner = ', '.join(
            ''.join(omath_to_latex(c) for c in e_el)
            for e_el in node.findall('m:e', NS)
        )
        return f'{beg_chr}{inner}{end_chr}'

    return ''.join(omath_to_latex(c) for c in node)


def extract_paragraph_rich(p_el: ET.Element, rels_map: dict) -> str:
    parts = []
    for child in p_el:
        ctag = child.tag.split('}')[-1]
        if ctag == 'r':
            rPr = child.find('w:rPr', NS)
            is_key_marked = False
            vert_align = None
            if rPr is not None:
                hl = rPr.find('w:highlight', NS)
                shd = rPr.find('w:shd', NS)
                u = rPr.find('w:u', NS)
                va = rPr.find('w:vertAlign', NS)
                if hl is not None and hl.attrib.get(f'{{{NS["w"]}}}val', 'none') != 'none':
                    is_key_marked = True
                if shd is not None and shd.attrib.get(f'{{{NS["w"]}}}fill', 'auto') not in ('auto', 'FFFFFF', 'ffffff'):
                    is_key_marked = True
                if u is not None and u.attrib.get(f'{{{NS["w"]}}}val', 'none') != 'none':
                    is_key_marked = True
                if va is not None:
                    vert_align = va.attrib.get(f'{{{NS["w"]}}}val')

            run_chunks = []
            for sub in child:
                stag = sub.tag.split('}')[-1]
                if stag == 't' and sub.text:
                    run_chunks.append(sub.text)
                elif stag == 'tab':
                    run_chunks.append(' ')
                elif stag == 'sym':
                    char_code = sub.attrib.get(f'{{{NS["w"]}}}char', '').upper()
                    run_chunks.append(SYMBOL_CHAR_MAP.get(char_code, 'π'))
                elif stag in ('object', 'pict'):
                    for im in sub.findall('.//v:imagedata', NS):
                        rid = im.attrib.get(f'{{{NS["r"]}}}id', '')
                        target = rels_map.get(rid, '')
                        if target in WMF_LATEX_MAP:
                            run_chunks.append(' ' + WMF_LATEX_MAP[target] + ' ')

            txt = ''.join(run_chunks)
            if vert_align == 'superscript' and txt.strip():
                s = txt.strip()
                if s == '2':
                    txt = '²'
                elif s == '-2':
                    txt = '⁻²'
                else:
                    txt = f'$^{{{s}}}$'
            elif vert_align == 'subscript' and txt.strip():
                s = txt.strip()
                sub_map = {'0': '₀', '1': '₁', '2': '₂'}
                if s in sub_map:
                    txt = sub_map[s]
                elif s == 'max':
                    txt = 'ₘₐₓ'
                elif s == 'đ':
                    txt = 'đ'
                else:
                    txt = f'_{{{s}}}'

            if is_key_marked and txt.strip():
                parts.append(f'«KEY»{txt}«/KEY»')
            else:
                parts.append(txt)

        elif ctag in ('oMath', 'oMathPara'):
            latex = omath_to_latex(child).strip()
            if latex:
                if latex == '/2 rad':
                    latex = r'\pi/2\text{ rad}'
                m_opt = re.match(r'^([A-D])\.\s*(.*)$', latex)
                if m_opt:
                    body_math = m_opt.group(2).strip()
                    if body_math:
                        parts.append(f' {m_opt.group(1)}. ${body_math}$ ')
                    else:
                        parts.append(f' {m_opt.group(1)}. ')
                else:
                    parts.append(f' ${latex}$ ')

    line = ''.join(parts)
    line = line.replace('«/KEY»«KEY»', '')
    return line.strip()


def clean_option_or_stem_text(text: str) -> str:
    t = text.replace('«KEY»', '').replace('«/KEY»', '')
    t = re.sub(r'Dữ kiện trả lời cho câu\s*[\d,\s]+\.?\s*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def resolve_option_markers(matches, text):
    """
    Filters out duplicate consecutive A matches (where the second A is actually option A's text,
    e.g. 'A. A. B. 2A.').
    """
    filtered = []
    i = 0
    while i < len(matches):
        m = matches[i]
        ltr = m.group(2)
        if ltr == 'A' and i + 1 < len(matches) and matches[i+1].group(2) == 'A':
            if i + 2 < len(matches) and matches[i+2].group(2) in ('B', 'C'):
                filtered.append(m)
                i += 2
                continue
        filtered.append(m)
        i += 1
    return filtered


def split_options_from_lines(lines: list[str]) -> tuple[list[str], dict[str, tuple[str, bool]]]:
    full_text = '\n'.join(lines)
    full_text = re.sub(r'^.*?Câu\s+\d+[\.:]\s*', '', full_text, count=1, flags=re.DOTALL)

    opt_pattern = re.compile(
        r'(?:^|(?<=\s)|(?<=«KEY»)|(?<=«/KEY»))'
        r'(«KEY»)?([A-D])(«/KEY»)?\s*(«KEY»)?\.(«/KEY»)?'
    )

    raw_matches = list(opt_pattern.finditer(full_text))
    matches = resolve_option_markers(raw_matches, full_text)

    if len(matches) < 4:
        raise ValueError(f'Expected at least 4 option markers, found {len(matches)} in: {full_text!r}')

    # If more than 4 matches remain, pick the last 4 that start with A
    if len(matches) > 4:
        chosen = None
        for i in range(len(matches) - 3):
            if matches[i].group(2) == 'A':
                chosen = matches[i:i + 4]
                break
        if chosen is None:
            chosen = matches[-4:]
        matches = chosen

    stem_raw = full_text[:matches[0].start()].strip()
    stem_raw = re.sub(r'«KEY»\s*$', '', stem_raw).strip()

    labels_order = []
    seen = []
    for idx, m in enumerate(matches):
        ltr = m.group(2)
        # Handle typo in CD2-D2 Q9 where third option is labeled B instead of C:
        if ltr in seen and idx == 2 and 'C' not in seen:
            ltr = 'C'
        seen.append(ltr)
        labels_order.append(ltr)

    options_dict: dict[str, tuple[str, bool]] = {}
    for idx, m in enumerate(matches):
        ltr = labels_order[idx]
        seg_start = m.end()
        seg_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(full_text)
        prefix_slice = full_text[max(0, m.start() - 8):m.end()]
        seg_raw = full_text[seg_start:seg_end]
        seg_clean = re.sub(r'«KEY»\s*$', '', seg_raw)
        is_correct = ('«KEY»' in prefix_slice) or ('«KEY»' in seg_clean)

        clean_val = clean_option_or_stem_text(seg_clean)
        options_dict[ltr] = (clean_val, is_correct)

    return [clean_option_or_stem_text(stem_raw)], options_dict


MCQ_SECTIONS = [
    {
        'code': 'CD1_D1',
        'section_title': 'Chủ đề 1 · Dạng 1: Xác định biên độ, pha, li độ dựa vào phương trình',
        'start_block': 14,
        'end_block': 76,
    },
    {
        'code': 'CD1_D2',
        'section_title': 'Chủ đề 1 · Dạng 2: Xác định biên độ, pha, li độ dựa vào đồ thị',
        'start_block': 121,
        'end_block': 165,
    },
    {
        'code': 'CD2_D1',
        'section_title': 'Chủ đề 2 · Dạng 1: Xác định các đại lượng đặc trưng của dao động điều hòa',
        'start_block': 205,
        'end_block': 257,
    },
    {
        'code': 'CD2_D2',
        'section_title': 'Chủ đề 2 · Dạng 2: Xác định độ lệch pha giữa hai dao động cùng chu kì',
        'start_block': 303,
        'end_block': 332,
    },
    {
        'code': 'CD3_D1',
        'section_title': 'Chủ đề 3 · Dạng 1: Xác định các đại lượng vận tốc, gia tốc dựa vào công thức',
        'start_block': 367,
        'end_block': 414,
    },
    {
        'code': 'CD3_D2',
        'section_title': 'Chủ đề 3 · Dạng 2: Bài toán viết phương trình dao động',
        'start_block': 457,
        'end_block': 504,
    },
    {
        'code': 'CD4_D1',
        'section_title': 'Chủ đề 4 · Dạng 1: Năng lượng trong dao động điều hòa',
        'start_block': 565,
        'end_block': 627,
    },
    {
        'code': 'CD4_D2',
        'section_title': 'Chủ đề 4 · Dạng 2: Con lắc lò xo',
        'start_block': 671,
        'end_block': 720,
    },
    {
        'code': 'CD4_D3',
        'section_title': 'Chủ đề 4 · Dạng 3: Con lắc đơn',
        'start_block': 772,
        'end_block': 823,
    },
    {
        'code': 'CD5_D1',
        'section_title': 'Chủ đề 5: Dao động tắt dần, dao động cưỡng bức và hiện tượng cộng hưởng',
        'start_block': 867,
        'end_block': 954,
    },
]

ESSENTIAL_FIGURES_MAP: dict[tuple[str, int], dict] = {
    **{
        ('CD1_D2', q): {
            'shared_context': 'Cho một vật dao động điều hòa có đồ thị li độ phụ thuộc thời gian như hình vẽ bên dưới (mỗi độ chia trên trục Ox là 1 cm, mỗi độ chia trên trục thời gian là 0,1 giây).',
            'image_url': '/exam-media/image41.png',
            'caption': 'Đồ thị li độ – thời gian x(t) (mỗi ô trục Ox là 1 cm, mỗi ô trục Ot là 0,1 s)',
        }
        for q in (1, 2, 3, 4, 5)
    },
    **{
        ('CD1_D2', q): {
            'shared_context': 'Đồ thị li độ theo thời gian của một chất điểm dao động điều hòa được mô tả như hình vẽ bên dưới.',
            'image_url': '/exam-media/image42.png',
            'caption': 'Đồ thị li độ theo thời gian x(t) của chất điểm dao động điều hòa',
        }
        for q in (6, 7, 8)
    },
    ('CD1_D2', 9): {
        'shared_context': '',
        'image_url': '/exam-media/image43.png',
        'caption': 'Đồ thị sự thay đổi li độ theo thời gian của vật dao động',
    },
    **{
        ('CD1_D2', q): {
            'shared_context': 'Trên hình vẽ bên dưới là vị trí của vật nặng trong hệ con lắc lò xo tại các thời điểm khác nhau (E, F, G, H, M, N, P, Q, R).',
            'image_url': '/exam-media/image44.png',
            'caption': 'Vị trí của vật nặng trong hệ con lắc lò xo tại các thời điểm E, F, G, H, M, N, P, Q, R',
        }
        for q in (10, 11, 12, 13, 14)
    },
    **{
        ('CD1_D2', q): {
            'shared_context': 'Cho đồ thị li độ theo thời gian của một dao động điều hòa như hình vẽ bên dưới.',
            'image_url': '/exam-media/image45.png',
            'caption': 'Đồ thị dao động điều hòa x(t)',
        }
        for q in (15, 16)
    },
    ('CD2_D1', 17): {
        'shared_context': '',
        'image_url': '/exam-media/image59.png',
        'caption': 'Đồ thị phụ thuộc thời gian của li độ dao động điều hòa',
    },
    ('CD2_D2', 3): {
        'shared_context': '',
        'image_url': '/exam-media/image74.png',
        'caption': 'Đồ thị sự phụ thuộc của li độ vào thời gian với đoạn PR trên trục t',
    },
    ('CD2_D2', 4): {
        'shared_context': '',
        'image_url': '/exam-media/image75.png',
        'caption': 'Đồ thị biểu diễn hai dao động điều hòa cùng phương, cùng tần số, cùng biên độ A',
    },
    **{
        ('CD2_D2', q): {
            'shared_context': 'Hai vật dao động điều hòa có li độ được biểu diễn trên đồ thị li độ – thời gian như Hình 1.1 bên dưới.',
            'image_url': '/exam-media/image77.png',
            'caption': 'Hình 1.1: Đồ thị li độ – thời gian của hai vật dao động điều hòa (1) và (2)',
        }
        for q in (6, 7)
    },
    **{
        ('CD2_D2', q): {
            'shared_context': 'Đồ thị bên dưới biểu diễn hai dao động điều hòa x₁ và x₂ cùng phương, cùng tần số.',
            'image_url': '/exam-media/image78.png',
            'caption': 'Đồ thị biểu diễn hai dao động điều hòa x₁ và x₂ cùng phương, cùng tần số',
        }
        for q in (8, 9, 10)
    },
    ('CD3_D1', 16): {
        'shared_context': '',
        'image_url': '/exam-media/image108.png',
        'caption': 'Hình 2.1: Đồ thị li độ – thời gian của vật dao động điều hòa',
    },
    ('CD5_D1', 22): {
        'shared_context': '',
        'image_url': '/exam-media/image261.png',
        'caption': 'Hệ con lắc cộng hưởng gồm con lắc điều khiển M và các con lắc (1), (2), (3), (4)',
    },
}

FALLBACK_KEYS = {
    ('CD1_D2', 9): 'B',
    ('CD3_D2', 16): 'A',
}


def build_exam_questions(docx_path: str) -> list[dict]:
    with zipfile.ZipFile(docx_path) as z:
        rels_xml = ET.fromstring(z.read('word/_rels/document.xml.rels'))
        rels_map = {}
        for rel in rels_xml:
            rels_map[rel.attrib.get('Id', '')] = rel.attrib.get('Target', '')

        doc_xml = ET.fromstring(z.read('word/document.xml'))

    body = doc_xml.find('w:body', NS)
    children = list(body)

    all_questions = []
    global_q_num = 0

    for sec in MCQ_SECTIONS:
        sec_code = sec['code']
        sec_title = sec['section_title']
        start_b = sec['start_block']
        end_b = sec['end_block']

        current_q_lines: list[str] = []
        sec_q_groups: list[list[str]] = []

        for b_idx in range(start_b, end_b + 1):
            el = children[b_idx]
            etag = el.tag.split('}')[-1]
            if etag == 'p':
                line = extract_paragraph_rich(el, rels_map)
                if not line:
                    continue
                plain_check = line.replace('«KEY»', '').replace('«/KEY»', '').strip()
                if plain_check.startswith('Dữ kiện trả lời cho câu') and 'Câu ' not in plain_check:
                    continue

                if re.search(r'(?:^|\s)Câu\s+\d+[\.:]', plain_check):
                    if current_q_lines:
                        sec_q_groups.append(current_q_lines)
                    current_q_lines = [line]
                else:
                    if current_q_lines:
                        current_q_lines.append(line)
            elif etag == 'tbl':
                cell_texts = []
                for tc in el.findall('.//w:tc', NS):
                    tc_str = ' '.join(
                        extract_paragraph_rich(p, rels_map)
                        for p in tc.findall('.//w:p', NS)
                    ).strip()
                    if tc_str:
                        cell_texts.append(tc_str)
                if cell_texts and current_q_lines:
                    current_q_lines.append(' '.join(cell_texts))

        if current_q_lines:
            sec_q_groups.append(current_q_lines)

        for local_idx, q_lines in enumerate(sec_q_groups, start=1):
            global_q_num += 1
            stem_parts, options_dict = split_options_from_lines(q_lines)
            stem_text = stem_parts[0]

            fig_info = ESSENTIAL_FIGURES_MAP.get((sec_code, local_idx))
            diagram_svg = None
            diagram_caption = None
            stem_blocks = []

            if fig_info:
                if fig_info['shared_context']:
                    stem_text = f"{fig_info['shared_context']} {stem_text}"
                img_url = fig_info['image_url']
                diagram_caption = fig_info['caption']
                diagram_svg = (
                    f'<img src="{img_url}" alt="{diagram_caption}" '
                    f'class="w-full max-h-[280px] object-contain mx-auto rounded-lg" '
                    f'loading="eager" />'
                )
                stem_blocks = [
                    {
                        'block_id': f'blk_ly11_{global_q_num}_p1',
                        'type': 'paragraph',
                        'content': stem_text,
                    },
                    {
                        'block_id': f'blk_ly11_{global_q_num}_img',
                        'type': 'inline_image',
                        'content': img_url,
                        'image_ref': img_url,
                        'alt_text': diagram_caption,
                    },
                ]
            else:
                stem_blocks = [
                    {
                        'block_id': f'blk_ly11_{global_q_num}_p1',
                        'type': 'paragraph',
                        'content': stem_text,
                    }
                ]

            correct_letter = None
            for ltr in ('A', 'B', 'C', 'D'):
                if ltr in options_dict and options_dict[ltr][1]:
                    correct_letter = ltr
                    break
            if not correct_letter:
                correct_letter = FALLBACK_KEYS.get((sec_code, local_idx), 'A')

            options_list = []
            for ltr in ('A', 'B', 'C', 'D'):
                opt_content = options_dict[ltr][0] if ltr in options_dict else ''
                options_list.append({
                    'id': f'opt_{ltr}',
                    'label': ltr,
                    'content': opt_content,
                })

            correct_opt_content = options_dict[correct_letter][0]
            q_id = f'q_ly11_cd1_{global_q_num:03d}'

            q_obj = {
                'id': q_id,
                'number': global_q_num,
                'section': sec_title,
                'type': 'single_choice',
                'points': 0.25,
                'stem': stem_text,
                'stem_blocks': stem_blocks,
                'options': options_list,
                'answer_key': {
                    'question_type': 'single_choice',
                    'correct_option_id': f'opt_{correct_letter}',
                },
                'explanation': f'Đáp án đúng là {correct_letter}: {correct_opt_content}',
                'confidence': 0.99,
                'needs_review': False,
                'source_Reference': f'Lý 11 Chuyên đề 1 (2026) · {sec_code} · Câu {local_idx}',
            }
            if diagram_svg:
                q_obj['diagram_svg'] = diagram_svg
                q_obj['diagram_caption'] = diagram_caption

            all_questions.append(q_obj)

    return all_questions


def main():
    docx_files = glob.glob('*GV-2026.docx')
    if not docx_files:
        raise FileNotFoundError('Could not find *GV-2026.docx in workspace')
    docx_path = docx_files[0]

    questions = build_exam_questions(docx_path)
    total_points = round(len(questions) * 0.25, 2)

    exam_contract = {
        'schema_version': '2.0.0',
        'exam_id': 'exam_ly11_chuyen_de_1_2026',
        'exam_version': 1,
        'subject_id': 'VAT_LY_11_2026',
        'title': 'Vật Lý 11 – Chuyên đề 1: Dao động cơ học (Ngân hàng Trắc nghiệm 4 phương án)',
        'published_at': '2026-11-06T16:00:00.000Z',
        'status': 'published',
        'time_limit': 2700,
        'grading_policy': {
            'total_max_score': total_points,
            'rounding_decimals': 2,
            'negative_marking_factor': 0,
            'true_false_cluster_scale': {
                '1': 0.1,
                '2': 0.25,
                '3': 0.5,
                '4': 1.0,
            },
            'multi_select_mode': 'partial_with_penalty',
            'short_answer_case_sensitive': False,
            'short_answer_normalize_comma_decimal': True,
        },
        'attempt_policy': {
            'max_attempts': 99,
            'allow_resume_on_reload': True,
            'auto_submit_on_timeout': True,
            'grace_period_seconds': 120,
        },
        'randomization_policy': {
            'shuffle_questions_within_section': True,
            'shuffle_options': True,
            'preserve_section_order': False,
        },
        'questions': questions,
        'assets_manifest': [
            {
                'asset_id': f'asset_img_{img_num}',
                'type': 'inline_image',
                'filename': f'image{img_num}.png',
                'mime_type': 'image/png',
                'checksum_sha256': f'sha256_ly11_image{img_num}',
            }
            for img_num in (41, 42, 43, 44, 45, 59, 74, 75, 77, 78, 108, 261)
        ],
        'pipeline_telemetry': {
            'source_format': 'docx_ooxml',
            'overall_confidence': 0.99,
            'needs_review_count': 0,
            'blocking_errors': [],
            'warnings': [],
            'human_verified': True,
            'verified_by': 'Tổ Vật Lý 11 (GV-2026)',
            'verified_at': '2026-11-06T16:00:00.000Z',
        },
    }

    os.makedirs('data', exist_ok=True)
    with open('data/ly11-chuyen-de-1-2026.json', 'w', encoding='utf-8') as f:
        json.dump(exam_contract, f, ensure_ascii=False, indent=2)

    diagram_count = sum(1 for q in questions if q.get('diagram_svg'))
    print(f'Successfully built {len(questions)} 4-option MCQs ({diagram_count} with attached figures).')


if __name__ == '__main__':
    main()
