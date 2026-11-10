# Tài Liệu Python ETL Pipeline (DOC / DOCX / MTEF / OMML)

Tài liệu này mô tả chi tiết thiết kế an toàn đường ống dữ liệu (Data Pipeline Safety - Mục 6.4) trong thư mục [`etl/`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl).

---

## 1. Nguyên Tắc Thiết Kế Cốt Lõi (Mục 6.4)

1. **Tách biệt hoàn toàn Parser `.doc` và `.docx`**:
   - [`etl/doc_parser.py`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/doc_parser.py) (`DocBinaryParser`): Xử lý các tập tin Word nhị phân thế hệ cũ (`.doc` OLE2 Compound File Binary format), kiểm tra chữ ký ma thuật `D0 CF 11 E0 A1 B1 1A E1` và trích xuất luồng `WordDocument` cùng các đối tượng nhúng MathType MTEF.
   - [`etl/docx_parser.py`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/docx_parser.py) (`DocxParser`): Xử lý các tập tin Word hiện đại (`.docx` OOXML ZIP Archive), đọc trực tiếp `word/document.xml`, bảng ánh xạ quan hệ `word/_rels/document.xml.rels`, thư mục ảnh `word/media/*` và thư mục công thức nhúng `word/embeddings/*.bin`.

2. **Hỗ trợ đa phiên bản công thức toán học ([`etl/mtef_decoder.py`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/mtef_decoder.py))**:
   - **MTEF v3 (Equation Editor 3.x / MathType 3.x)**: Đọc header 5 byte (`[version=3, platform, product, ver, subver]`) và giải mã các bản ghi `MTEF_CHAR`, `MTEF_TMPL`, `MTEF_FULL`, `MTEF_SLOT`.
   - **MTEF v5 (MathType 5.x / 6.x / 7.x)**: Đọc header 5 byte kèm chuỗi khóa ứng dụng kết thúc bằng byte `0x00` (ví dụ `DSMT4\x00`) và byte tùy chọn phương trình trước khi giải mã chuỗi bản ghi.
   - **OMML (`<m:oMath>`)**: Duyệt cây XML toán học của Microsoft Office (`<m:f>` phân số, `<m:rad>` căn thức, `<m:sSup>` số mũ, `<m:sSub>` chỉ số dưới) sang chuẩn LaTeX.

3. **Bảo toàn nguyên bản nội dung công thức & Không âm thầm sửa công thức lỗi**:
   - Mọi công thức đều lưu giữ `raw_payload_hex` (với MTEF) hoặc `raw_omml` (với OMML).
   - Khi gặp luồng MTEF bị hỏng, bị cắt cụt hoặc dùng phiên bản lạ (ví dụ `version=99`), bộ giải mã **tuyệt đối không tự ý đoán hay xóa công thức**:
     - Đặt `decodable = False`
     - Đặt `needs_review = True`
     - Đặt `confidence = 0.10 - 0.22`
     - Đặt `latex = "[UNDECODABLE_MTEF_V99_RAW:<hex>]"`
     - Gắn mã lỗi chặn xuất bản `CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED:<formula_id>` cho đến khi giáo viên trực tiếp xác minh trong Question Studio.

4. **Giữ đúng thứ tự Paragraph, Table và Inline Image**:
   - Bộ phân tích duyệt tuần tự các phần tử con trong `<w:body>` (hoặc luồng `WordDocument`) và gán chỉ số `order_index` tăng dần (`0, 1, 2, ...`) cho từng khối `paragraph`, `inline_image` và `table` trong mảng `stem_blocks`.

5. **Không âm thầm bỏ sót câu hỏi**:
   - Hàm [`build_questions_from_parsed_doc`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/validator.py) kiểm tra tính liên tục của số thứ tự câu hỏi (`Câu 1, Câu 2, ..., Câu N`). Nếu phát hiện nhảy số (ví dụ từ `Câu 1` sang `Câu 3`), hệ thống lập tức phát sinh lỗi `CRITICAL_MISSING_QUESTION_SEQUENCE` và chặn xuất bản.

---

## 2. Bộ Golden Test Fixtures (`etl/fixtures/`)

Được tạo tự động và kiểm định qua [`etl/generate_fixtures.py`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/generate_fixtures.py) và [`etl/test_etl.py`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/test_etl.py):

| Tên Fixture | Định dạng | Mục đích kiểm thử chuẩn |
|---|---|---|
| `golden_exam_v2.docx` | OOXML `.docx` | Kiểm thử kết hợp OMML + MTEF v5 + Ảnh Inline + Bảng biến thiên theo đúng thứ tự. |
| `golden_legacy_v3.doc` | OLE2 `.doc` | Kiểm thử parser `.doc` độc lập với công thức MathType MTEF v3 (`E=mc^2`). |
| `corrupted_formula.doc` | OLE2 `.doc` | Kiểm thử công thức MTEF bị hỏng: giữ nguyên mã hex, gắn cờ `needs_review` và chặn xuất bản cho tới khi giáo viên xác minh. |
| `malicious_xss.docx` | OOXML `.docx` | Kiểm thử lọc mã độc `<script>alert('xss')</script>` và `onerror=` ngay trong quá trình nhập Word. |

---

## 3. Lệnh Thực Thi & Kiểm Thử

```bash
# Chạy toàn bộ 7 bài kiểm thử đơn vị và Golden Fixtures của Python ETL
npm run test:etl

# Chạy CLI phân tích trực tiếp một file fixture và xuất JSON ra màn hình
python -m etl.cli --fixture golden_exam_v2.docx
```
