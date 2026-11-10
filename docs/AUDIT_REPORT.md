# Báo Cáo Kiểm Định Chất Lượng Toàn Diện (Quality Gate & Audit Report)

Tài liệu này xác nhận kết quả thực thi đầy đủ các cổng kiểm định chất lượng tại **Mục 7 (Testing & Quality Gates)** và **Mục 8 (Definition of Done)**.

---

## 1. Tổng Quan Kết Quả Các Bộ Kiểm Thử Tự Động

| Bộ kiểm thử | Công cụ thực thi | Số lượng kịch bản | Kết quả | Thời gian chạy |
|---|---|---|---|---|
| **1. Functional & Grading Policy Tests** (`tests/functional-grading.test.ts`) | Vitest + JSDOM | 9 tests | **PASS (9/9)** | ~31ms |
| **2. Recovery & Reliability Tests** (`tests/recovery-reliability.test.ts`) | Vitest + IDB Mirror | 4 tests | **PASS (4/4)** | ~18ms |
| **3. Security & API Trust Boundary Tests** (`tests/security-api.test.ts`) | Vitest + Supertest | 7 tests | **PASS (7/7)** | ~357ms |
| **4. Python DOC/DOCX/MTEF Golden Tests** (`etl/test_etl.py`) | Python `unittest` | 7 tests | **PASS (7/7)** | ~85ms |
| **5. Real-Browser E2E, Responsive (5 Viewports), A11y & Perf** (`scripts/run-browser-audit.ts`) | Playwright Chromium | 15 viewport checks + 7 E2E flows | **PASS (100%)** | ~6.5s |

---

## 2. Chi Tiết Kiểm Định Theo Từng Hạng Mục (Mục 7)

### 2.1. Functional Tests
- **Đầy đủ 4 loại câu hỏi**:
  1. `single_choice`: Trắc nghiệm 4 lựa chọn A, B, C, D kèm phím tắt `1-4`.
  2. `true_false_cluster`: Trắc nghiệm Đúng/Sai 4 mệnh đề độc lập (`a, b, c, d`), tính điểm thành phần chuẩn THPT Quốc gia (`1 ý = 10%`, `2 ý = 25%`, `3 ý = 50%`, `4 ý = 100%`).
  3. `short_answer`: Trả lời ngắn có chuẩn hóa dấu phẩy/chấm thập phân (`48,0` -> `48.0`) và sai số số học (`numeric_tolerance`).
  4. `multi_select`: Chọn nhiều đáp án đúng với 3 chế độ chấm (`exact_match`, `partial_no_penalty`, `partial_with_penalty`).
- **Autosave, Submit, Review, Timer & Randomization**:
  - Đã kiểm thử đồng bộ tự động kèm `Idempotency-Key`, đếm ngược thời gian thực có bù độ lệch đồng hồ (`clock_drift_ms`), trộn câu hỏi và phương án tất định theo hạt giống phiên thi (`createSeededRng`).

### 2.2. Recovery Tests
- **Reload / Đóng và mở lại tab / Browser Crash**: Toàn bộ đáp án và cờ đánh dấu câu hỏi được lưu tức thì vào IndexedDB (`KhaoThiReliabilityDB_v2`) và khôi phục nguyên vẹn sau khi tải lại trang.
- **Mất mạng & Khôi phục mạng**: Khi mất kết nối, thao tác được xếp vào `sync_queue` và tự động xả hàng đợi với thuật toán **Exponential Backoff + Full Jitter** khi có mạng trở lại.
- **Duplicate Submission**: Gửi 2 lần yêu cầu nộp bài liên tiếp trả về đúng biên lai đầu tiên với cờ `duplicate_prevented: true`.
- **Hai tab cùng phiên**: Đồng bộ thời gian thực qua `BroadcastChannel` và giải quyết xung đột bằng `sequence_number` đơn điệu.

### 2.3. Security Tests
- **Không lộ đáp án trong Exam Mode**: API `/api/exams/:id?mode=exam` đã loại bỏ 100% trường `answer_key` và `explanation`.
- **Chống sửa payload điểm**: Gói tin `POST /submit` có chèn `total_score: 10.0` bị Server bỏ qua, ghi nhật ký `TAMPERED_SCORE_PAYLOAD_IGNORED` và chấm lại từ đáp án gốc trên Server.
- **Chống đọc dữ liệu phiên khác**: Truy cập `/api/sessions/:id` không có `X-Session-Token` hợp lệ bị chặn với `403 FORBIDDEN_SESSION_ACCESS`.
- **Chống XSS từ nội dung Word**: Mọi thẻ `<script>`, `<iframe>`, `onerror=`, `javascript:` trong file Word và trình biên tập bị loại bỏ hoàn toàn.
- **Chống CSV Formula Injection**: Các ô dữ liệu bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r` được bọc tiền tố `'` an toàn khi xuất CSV.

### 2.4. Responsive Tests (5 Viewports Mục Tiêu)
Đã kiểm thử tự động bằng trình duyệt thực tế (`document.documentElement.scrollWidth <= window.innerWidth`) trên cả 3 phân hệ (`Student Workspace`, `Teacher Monitoring`, `Teacher Question Studio`):
- `1440px` Desktop (`1440x900`): Không tràn ngang (`scrollWidth = 1440`).
- `1024px` Laptop (`1024x768`): Không tràn ngang (`scrollWidth = 1024`).
- `768px` Tablet (`768x1024`): Không tràn ngang (`scrollWidth = 768`).
- `390px` Mobile (`390x844`): Không tràn ngang (`scrollWidth = 390`).
- `360px` Small Mobile (`360x740`): Không tràn ngang (`scrollWidth = 360`).

### 2.5. Accessibility & Performance Tests (WCAG 2.2 AA)
- Tương phản màu sắc đạt chuẩn WCAG 2.2 AA (`>= 4.5:1` cho văn bản thường, `>= 7:1` cho văn bản chính).
- Kích thước vùng chạm tối thiểu `44px` (`min-height: 44px`).
- Không dùng màu sắc làm tín hiệu duy nhất (bản đồ câu hỏi kết hợp viền nét đứt, vòng focus, biểu tượng `CheckCircle` và `BookmarkSimple`).
- Hỗ trợ đầy đủ điều hướng bàn phím, liên kết bỏ qua điều hướng (`Skip to main content`), `prefers-reduced-motion` và giao diện Sáng/Tối.
- Số lỗi trên Browser Console: **0 lỗi**.

---

## 3. Bảng Đối Chiếu Definition of Done (Mục 8)

- [x] **1. Không có lỗi dữ liệu nghiêm trọng**: Đã kiểm chứng qua bộ Golden Tests.
- [x] **2. Không để lộ answer key trong Exam Mode**: Đã kiểm chứng qua `tests/security-api.test.ts`.
- [x] **3. Không mất bài trong các kịch bản recovery đã kiểm thử**: Đã kiểm chứng qua `tests/recovery-reliability.test.ts` và E2E.
- [x] **4. Không có câu hỏi bị thiếu âm thầm sau import**: Đã kiểm chứng qua `test_missing_question_sequence_detected`.
- [x] **5. Các phép tính điểm khớp với bộ test chuẩn**: Đã kiểm chứng qua `tests/functional-grading.test.ts`.
- [x] **6. Các vai trò truy cập đúng quyền**: Đã kiểm chứng qua RBAC middleware và `firestore.rules`.
- [x] **7. UI không bị overflow trên các viewport mục tiêu**: Đã kiểm chứng trên 1440px, 1024px, 768px, 390px, 360px.
- [x] **8. Các trạng thái loading, empty, error, offline đều hoàn chỉnh**: Đã kiểm chứng đủ 11 trạng thái token.
- [x] **9. Animation mượt nhưng không ảnh hưởng hiệu năng**: Chỉ sử dụng `transform` và `opacity` với thời gian 150ms-380ms.
- [x] **10. Không có lỗi nghiêm trọng trong browser console**: `consoleErrorCount = 0`.
- [x] **11. Không có API secret trong frontend**: Khóa HMAC chỉ nằm ở biến môi trường Server.
- [x] **12. Có tài liệu triển khai, backup, recovery và cấu hình**: Đã bàn giao đầy đủ trong `docs/`.
