# Tài Liệu Đặc Tả API (REST API Documentation)

Toàn bộ các điểm cuối API được phục vụ bởi [`server/app.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/server/app.ts).

---

## 1. Xác Thực & Header Bảo Mật

| Header | Ngữ cảnh sử dụng | Mô tả |
|---|---|---|
| `X-Session-Token` | Các API của Thí sinh (`/api/sessions/*`) | Mã HMAC-SHA256 định danh phiên thi, chống đọc/ghi chéo giữa các thí sinh. |
| `Idempotency-Key` | `POST /sync` và `POST /submit` | Khóa chống xử lý trùng lặp khi mạng chập chờn hoặc thí sinh bấm nộp nhiều lần. |
| `X-Role` | Các API của Giáo viên (`/api/monitor/*`, `/api/studio/*`) | Giá trị yêu cầu: `teacher` hoặc `admin`. |
| `X-Teacher-Auth` | Các API của Giáo viên | Mã xác thực phiên làm việc của giáo viên/quản trị viên. |

---

## 2. Danh Sách Điểm Cuối (Endpoints)

### 2.1. Lấy Dữ Liệu Đề Thi Theo Chế Độ
- **Endpoint**: `GET /api/exams/:examId?mode=exam|practice&version=<number>`
- **Ranh giới bảo mật**:
  - Khi `mode=exam` (mặc định): Server tự động loại bỏ `answer_key` và `explanation` khỏi mọi câu hỏi trước khi trả về.
  - Khi `mode=practice`: Giữ nguyên `answer_key` và `explanation` để phục vụ tự học và chấm ngoại tuyến.

### 2.2. Khởi Tạo Hoặc Khôi Phục Phiên Thi
- **Endpoint**: `POST /api/sessions/start`
- **Request Body**:
  ```json
  {
    "exam_id": "exam_thpt_math_phys_2026_01",
    "student_id": "HS20260888",
    "student_name": "Dang Khoa Nguyen",
    "student_code": "12A1-088",
    "class_name": "12A1 Chuyen Toan",
    "mode": "exam"
  }
  ```
- **Response (`201 Created`)**:
  - Trả về `session` (bao gồm `session_id`, `session_token`, `started_at_server`, `expires_at_server`, `question_order`, `option_orders`) và `exam` đã được lọc theo `mode`.

### 2.3. Đồng Bộ Bài Làm & Telemetry (Autosave)
- **Endpoint**: `POST /api/sessions/:sessionId/sync`
- **Headers**: `X-Session-Token`, `Idempotency-Key`
- **Request Body**:
  ```json
  {
    "idempotency_key": "sync_9b1deb4d",
    "answers": {
      "q_2026_001": {
        "question_id": "q_2026_001",
        "value": { "type": "single_choice", "selected_option_id": "q_2026_001_opt_C" },
        "flagged": false,
        "client_updated_at": 1762431600000,
        "sequence_number": 1
      }
    },
    "telemetry": [
      {
        "event_id": "evt_01",
        "session_id": "ses_123",
        "event_type": "visibility_hidden",
        "client_timestamp": 1762431605000,
        "detail": "Su kien trinh duyet: document.visibilityState = hidden"
      }
    ]
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "ok": true,
    "ack_id": "ack_1762431605120_a1b2c3",
    "idempotency_key": "sync_9b1deb4d",
    "server_timestamp": 1762431605120,
    "synced_answer_count": 1
  }
  ```

### 2.4. Nộp Bài Chính Thức & Nhận Biên Lai Chấm Điểm
- **Endpoint**: `POST /api/sessions/:sessionId/submit`
- **Headers**: `X-Session-Token`, `Idempotency-Key`
- **Cơ chế bảo vệ**:
  - Nếu phiên đã nộp trước đó, trả về ngay biên lai cũ với `"duplicate_prevented": true`.
  - Nếu thời gian gửi vượt quá `expires_at_server + grace_period_seconds`, trả về `422 EXAM_TIME_LIMIT_EXCEEDED`.
  - Bỏ qua hoàn toàn mọi trường điểm số do client tự chèn vào body.
- **Response (`200 OK`)**: Trả về `ExamSubmissionReceipt` kèm chữ ký `signature_sha256`.

### 2.5. Giám Sát Phòng Thi & Xuất CSV (Teacher RBAC)
- `GET /api/monitor/dashboard`: Trả về danh sách thí sinh, trạng thái kết nối, số câu đã làm, thống kê phổ điểm, độ khó từng câu hỏi và nhật ký kiểm toán (`audit_logs`).
- `GET /api/monitor/export.csv`: Xuất bảng điểm và thống kê sự kiện trình duyệt ở định dạng CSV đã được lọc chống tấn công CSV Formula Injection.

### 2.6. Studio Biên Soạn Đề & Xuất Bản Phiên Bản (Teacher RBAC)
- `POST /api/studio/import-word`: Thực thi Python ETL (`python -m etl.cli --fixture <name>`) để bóc tách câu hỏi, bảng biểu, hình ảnh và công thức MTEF/OMML từ file `.doc` hoặc `.docx`.
- `POST /api/studio/publish`: Kiểm tra cổng chất lượng (`CRITICAL_*` errors). Chặn ghi đè trực tiếp lên phiên bản đề đang có thí sinh dự thi (`409 ACTIVE_EXAM_VERSION_IMMUTABLE`) và phát hành phiên bản mới bất biến (`exam_version + 1`).
- `GET /api/studio/versions/:examId`: Truy vấn lịch sử các phiên bản đề thi.
- `POST /api/studio/migrate-schema`: Nâng cấp cấu trúc đề từ `schema_version: "1.0.0"` lên `"2.0.0"`.
