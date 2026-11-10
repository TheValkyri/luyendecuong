# Các Giới Hạn Đã Biết & Phương Án Xử Lý (Known Limitations)

Theo đúng yêu cầu tại Mục 5.2 và Mục 9 ("Nếu một yêu cầu không thể thực hiện, phải nêu rõ giới hạn và phương án thay thế"), tài liệu này liệt kê minh bạch các giới hạn kỹ thuật và cách hệ thống xử lý:

---

## 1. Phạm Vi Của Skill `design-taste-frontend` (v2)
- **Giới hạn**: Tệp [`design-taste-frontend/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/design-taste-frontend/SKILL.md) (phiên bản v2 trên máy) quy định tại Mục 13 rằng các quy tắc bố cục trang quảng cáo (landing page) không áp dụng trực tiếp cho các màn hình bảng dữ liệu dày đặc (Dashboards, Data Tables, Multi-step Assessment UI), và thư mục skill chỉ chứa `SKILL.md` (các phụ lục tham chiếu A, B, C nằm ngay trong `SKILL.md`).
- **Phương án đã áp dụng**: Kết hợp đầy đủ bộ `taste` (`design-taste-frontend`, `design-taste-frontend-v1`, `minimalist-ui`, `high-end-visual-design`, `full-output-enforcement`) với hệ thống Design Tokens chuẩn hóa (`src/styles/tokens.css`, `src/lib/design-tokens.ts`) cho 3 phân hệ ứng dụng (`Student Workspace`, `Teacher Monitoring Dashboard`, `Teacher Question Studio`).

---

## 2. Định Dạng Nhị Phân `.doc` Thế Hệ Cũ & Công Thức MTEF Đặc Thù
- **Giới hạn**: Định dạng `.doc` nhị phân (Word 97-2003 OLE2 Compound Document) và các bản ghi MathType MTEF tùy biến của bên thứ ba có thể chứa các opcode mở rộng độc quyền hoặc bị hỏng byte khi sao chép qua nhiều phiên bản Office cũ.
- **Phương án an toàn đã triển khai**:
  - Tách riêng `DocBinaryParser` (`etl/doc_parser.py`) và `DocxParser` (`etl/docx_parser.py`).
  - Hỗ trợ giải mã trực tiếp các bản ghi chuẩn của cả **MTEF v3** và **MTEF v5** cùng với **OMML**.
  - Đối với mọi bản ghi MTEF sử dụng opcode lạ hoặc bị hỏng cấu trúc, hệ thống **không bao giờ âm thầm đoán hoặc xóa công thức**: luôn bảo toàn nguyên vẹn chuỗi nhị phân gốc trong `raw_payload_hex`, hạ điểm `confidence`, bật cờ `needs_review = True` và chặn xuất bản (`CRITICAL_UNDECODABLE_FORMULA_UNVERIFIED`) cho đến khi giáo viên kiểm tra và xác nhận thủ công trên giao diện Question Studio.

---

## 3. Lưu Trữ Server Trong Chế Độ Chạy Thử Nghiệm Cục Bộ (Local Standalone Mode)
- **Giới hạn**: Để hệ thống có thể khởi chạy và kiểm thử tự động ngay lập tức trên mọi máy trạm mà không đòi hỏi tài khoản đám mây hay khóa dịch vụ bên ngoài, [`server/app.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/server/app.ts) sử dụng kho dữ liệu trong bộ nhớ có khởi tạo sẵn dữ liệu mẫu chuẩn, đi kèm tệp quy tắc bảo mật [`firestore.rules`](file:///c:/Users/Darne/Downloads/The%20Fragrent/firestore.rules) cho môi trường triển khai Firebase thực tế.
- **Phương án mở rộng**: Toàn bộ tầng lưu trữ trên Server đã được cô lập qua các cấu trúc dữ liệu chuẩn (`ExamContract`, `ActiveExamSession`, `ExamSubmissionReceipt`, `AuditLogEntry`), sẵn sàng gắn kết trực tiếp với PostgreSQL hoặc Firebase Admin SDK mà không cần thay đổi bất kỳ giao diện hay hợp đồng API nào.
