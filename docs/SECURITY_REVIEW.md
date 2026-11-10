# Báo Cáo Rà Soát Bảo Mật & Quyền Riêng Tư (Security Review Report)

Tài liệu này tổng hợp kết quả kiểm định bảo mật theo Mục 6.1, 6.5 và Mục 7 (Security Tests).

---

## 1. Ma Trận Kiểm Soát Các Mối Đe Dọa (Threat Model & Mitigations)

| Mối đe dọa / Kịch bản tấn công | Cơ chế phòng vệ đã triển khai | Tệp thực thi & Kiểm thử | Trạng thái |
|---|---|---|---|
| **1. Xem trộm đáp án (`answer_key`) trong Exam Mode qua DevTools Network** | Hàm `prepareExamForClient(exam, 'exam')` xóa sạch `answer_key` và `explanation` trên Server trước khi đóng gói JSON trả về. | [`grading-engine.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/src/lib/grading-engine.ts), [`security-api.test.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/tests/security-api.test.ts) | **ĐẠT (100%)** |
| **2. Can thiệp sửa điểm số (`total_score: 10`) trong gói tin Submit** | Server bỏ qua hoàn toàn mọi trường điểm số từ client, tự chấm điểm lại từ bản gốc trên Server và ghi cảnh báo `TAMPERED_SCORE_PAYLOAD_IGNORED` vào Audit Log. | [`server/app.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/server/app.ts), [`security-api.test.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/tests/security-api.test.ts) | **ĐẠT (100%)** |
| **3. Đọc hoặc ghi đè dữ liệu phiên thi của thí sinh khác** | Mỗi phiên thi được cấp mã `X-Session-Token` ký bằng `HMAC-SHA256(session_id:student_id:exam_id)`. Yêu cầu thiếu hoặc sai token bị chặn với mã `403 FORBIDDEN_SESSION_ACCESS`. | [`server/app.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/server/app.ts), [`firestore.rules`](file:///c:/Users/Darne/Downloads/The%20Fragrent/firestore.rules) | **ĐẠT (100%)** |
| **4. Tấn công XSS qua nội dung file Word (`.doc`/`.docx`) hoặc trình soạn thảo** | Cả tầng Python ETL (`sanitize_text_content`) và tầng TypeScript (`sanitizeWordHtml`) đều loại bỏ thẻ `<script>`, `<iframe>`, `<object>`, thuộc tính `on*` (`onerror`, `onload`) và giao thức `javascript:`. | [`security-utils.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/src/lib/security-utils.ts), [`docx_parser.py`](file:///c:/Users/Darne/Downloads/The%20Fragrent/etl/docx_parser.py) | **ĐẠT (100%)** |
| **5. Gửi nhiều yêu cầu nộp bài trùng lặp (Race Condition / Replay)** | Kiểm tra `Idempotency-Key` và khóa trạng thái phiên `status === 'submitted'`. Các lần gọi nộp bài lặp lại trả về biên lai ban đầu với `duplicate_prevented: true`. | [`server/app.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/server/app.ts), [`security-api.test.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/tests/security-api.test.ts) | **ĐẠT (100%)** |
| **6. Truy cập trái phép API của Giáo viên (Monitoring / Publish)** | Middleware `requireTeacherRole` kiểm tra `X-Role` (`teacher`/`admin`) và khóa xác thực, đồng thời ghi nhận mọi truy cập trái phép vào `audit_logs`. | [`server/app.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/server/app.ts), [`security-api.test.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/tests/security-api.test.ts) | **ĐẠT (100%)** |
| **7. Tấn công CSV Formula Injection khi giáo viên xuất bảng điểm Excel** | Hàm `escapeCsvCell` kiểm tra các ký tự kích hoạt công thức (`=`, `+`, `-`, `@`, `\t`, `\r`) ở đầu chuỗi và tự động thêm dấu nháy đơn `'` bảo vệ, đồng thời giữ nguyên số âm hợp lệ (ví dụ `-12.5`). | [`security-utils.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/src/lib/security-utils.ts), [`security-api.test.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/tests/security-api.test.ts) | **ĐẠT (100%)** |

---

## 2. Quyền Riêng Tư & Đạo Đức Giám Sát (Neutral Telemetry Policy - Mục 6.5)

- Hệ thống chỉ ghi nhận các sự kiện kỹ thuật quan sát được từ trình duyệt:
  - `visibility_hidden` / `visibility_visible` (`document.visibilityState`)
  - `window_blur` / `window_focus`
  - `network_offline` / `network_restored`
  - `session_recovered`
- **Không tự động kết luận vi phạm**: Giao diện Giám sát của Giáo viên hiển thị nhãn trung lập `"Sự kiện quan sát"` (`Observable Focus Events`) kèm mô tả kỹ thuật chính xác (ví dụ: `"Trình duyệt chuyển tab (document.hidden = true)"`), tuyệt đối không tự động gán nhãn `"Gian lận"` hay tự động hủy bài thi của học sinh vì lý do rớt mạng hoặc thông báo hệ điều hành.
