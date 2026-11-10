# Hướng Dẫn Triển Khai, Sao Lưu & Khôi Phục (Deployment & Recovery Guide)

Tài liệu này hướng dẫn cấu hình môi trường, triển khai Production, sao lưu dữ liệu và quy trình khôi phục sau sự cố (Disaster Recovery) theo Mục 8.12 và Mục 9.

---

## 1. Cấu Hình Biến Môi Trường (Environment Variables)

Không có bất kỳ khóa bí mật (Secret Key) hay quyền quản trị nào được nhúng trong mã nguồn Frontend (`src/`). Toàn bộ khóa bí mật chỉ tồn tại trên môi trường Server:

| Biến môi trường | Giá trị mặc định (Dev) | Vai trò trên Production |
|---|---|---|
| `PORT` | `3001` | Cổng lắng nghe của Authoritative API Server. |
| `NODE_ENV` | `development` | Đặt thành `production` khi vận hành thực tế. |
| `KHAOTHI_HMAC_SECRET` | *(dev fallback)* | Khóa bí mật 256-bit dùng để ký `X-Session-Token` và chữ ký biên lai `signature_sha256`. |
| `KHAOTHI_TEACHER_TOKEN` | *(dev fallback)* | Khóa xác thực phân quyền RBAC cho Giáo viên và Quản trị viên. |

---

## 2. Quy Trình Đóng Gói & Triển Khai Production

```bash
# Bước 1: Cài đặt gói phụ thuộc chuẩn
npm ci

# Bước 2: Chạy cổng kiểm định chất lượng (Unit, Recovery, Security & Python ETL)
npm test
npm run test:etl

# Bước 3: Biên dịch gói giao diện tĩnh tối ưu (Vite Code-Splitting)
npm run build

# Bước 4: Khởi chạy Production Server
npm start
```

### Triển khai Quy tắc Bảo mật Firebase (`firestore.rules`)
Khi kết nối với cụm Firebase Firestore trong môi trường đám mây:
```bash
firebase deploy --only firestore:rules
```
Tệp [`firestore.rules`](file:///c:/Users/Darne/Downloads/The%20Fragrent/firestore.rules) đảm bảo:
- Tập hợp `/exams_private_keys/{examId}` hoàn toàn bị chặn đối với tài khoản học sinh.
- Học sinh chỉ có thể cập nhật câu trả lời trên phiên `/sessions/{sessionId}` của chính mình khi `status == 'in_progress'` và không thể tự ghi trường `total_score` hay `submission_receipt`.

---

## 3. Chiến Lược Sao Lưu & Lưu Trữ (Backup & Retention Policy)

1. **Sao lưu Đề thi & Lịch sử Phiên bản (`examVersions`)**:
   - Mỗi phiên bản đề thi sau khi xuất bản là bất biến (`immutable`).
   - Sao lưu định kỳ (Snapshot mỗi 6 giờ) toàn bộ kho đề thi và `assets_manifest` sang kho lưu trữ đối tượng có kiểm soát phiên bản.
2. **Sao lưu Biên lai Nộp bài & Nhật ký Kiểm toán (`submission_receipts` & `audit_logs`)**:
   - Biên lai nộp bài có chữ ký `HMAC-SHA256` được lưu trữ tối thiểu **24 tháng** phục vụ công tác phúc khảo và hậu kiểm.
   - Dữ liệu sự kiện trình duyệt thô (`telemetry`) áp dụng chính sách giảm thiểu dữ liệu (Data Minimization) và tự động ẩn danh hóa sau **90 ngày** kể từ khi kỳ thi kết thúc.

---

## 4. Quy Trình Khôi Phục Sau Sự Cố (Recovery Playbook)

### Kịch bản 1: Thí sinh bị sập trình duyệt, tải lại trang hoặc mất điện máy trạm
- Khi mở lại trình duyệt, `ExamIndexedDBStore` trong [`src/lib/reliability.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/src/lib/reliability.ts) tự động đọc `latest_session_id` và khôi phục toàn bộ đáp án đã chọn, câu hỏi đã đánh dấu và thời gian còn lại.
- Hiển thị thông báo xác nhận số câu đã khôi phục an toàn trên đầu màn hình làm bài.

### Kịch bản 2: Mất kết nối mạng diện rộng tại phòng thi
- Thí sinh tiếp tục làm bài bình thường; mọi thao tác được ghi vào IndexedDB và xếp vào `sync_queue`.
- Trạng thái hiển thị trung thực: `Luu IndexedDB (Hang doi: N)`.
- Khi mạng khôi phục, trình duyệt tự động xả hàng đợi với thuật toán **Exponential Backoff + Full Jitter** kèm `Idempotency-Key` để không gây nghẽn máy chủ và không tạo bản ghi trùng.
- Nếu hết giờ trong lúc đang khôi phục mạng, Server áp dụng khoảng thời gian ân hạn (`grace_period_seconds: 120`) để chấp nhận gói nộp bài hợp lệ từ hàng đợi ngoại tuyến.
