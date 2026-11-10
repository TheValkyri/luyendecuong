# Thư Viện Ảnh Chụp Giao Diện Thực Tế (UI Screenshot Gallery)

Toàn bộ ảnh chụp màn hình dưới đây được trích xuất tự động từ trình duyệt Chromium thực tế qua kịch bản [`scripts/run-browser-audit.ts`](file:///c:/Users/Darne/Downloads/The%20Fragrent/scripts/run-browser-audit.ts) và lưu trữ tại thư mục [`docs/screenshots/`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots).

---

## 1. Phân Hệ A: Student Workspace (Không Gian Làm Bài Của Thí Sinh)

| Tập tin ảnh | Mô tả trạng thái giao diện |
|---|---|
| [`01-student-workspace-light.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/01-student-workspace-light.png) | Giao diện làm bài chính thức (1440px Light Mode): Câu hỏi hàm số bậc ba kèm công thức KaTeX, đồ thị kỹ thuật SVG, đồng hồ đếm ngược, chỉ báo đồng bộ Server ACK và bản đồ câu hỏi. |
| [`02-student-diagram-zoom-modal.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/02-student-diagram-zoom-modal.png) | Hộp thoại phóng to hình vẽ kỹ thuật (`ImageZoomModal` ở mức phóng 125%) không làm mất ngữ cảnh câu hỏi đang chọn. |
| [`03-student-true-false-cluster.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/03-student-true-false-cluster.png) | Giao diện câu hỏi Đúng/Sai 4 mệnh đề độc lập (`a, b, c, d`) kèm hướng dẫn thang điểm thành phần 10% - 25% - 50% - 100%. |
| [`04-student-focus-mode.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/04-student-focus-mode.png) | Chế độ Tập trung (`Focus Mode`): Ẩn thanh điều hướng toàn cục để tối đa hóa không gian đọc đề. |
| [`05-student-submit-confirmation.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/05-student-submit-confirmation.png) | Hộp thoại xác nhận nộp bài: Tổng hợp rõ số câu đã trả lời, chưa làm và đã đánh dấu xem lại. |
| [`06-student-official-result-receipt.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/06-student-official-result-receipt.png) | Màn hình Biên lai Kết quả Chính thức từ Server (`10 / 10 điểm`) kèm mã xác thực `HMAC-SHA256` và lời giải toán học chi tiết từng câu. |
| [`student-390px-mobile.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/student-390px-mobile.png) | Giao diện Mobile chuẩn (`390x844`) tự động thu gọn về bố cục 1 cột, không tràn ngang. |
| [`student-360px-small-mobile.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/student-360px-small-mobile.png) | Giao diện Small Mobile (`360x740`) đảm bảo đầy đủ vùng chạm 44px và khả năng đọc công thức rõ ràng. |

---

## 2. Phân Hệ B: Teacher Monitoring Dashboard (Bảng Giám Sát Phòng Thi)

| Tập tin ảnh | Mô tả trạng thái giao diện |
|---|---|
| [`07-teacher-monitoring-dashboard.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/07-teacher-monitoring-dashboard.png) | Bảng điều khiển giám sát thời gian thực: Lưới thí sinh, bộ lọc trạng thái, phân tích độ khó từng câu hỏi, dòng thời gian sự kiện trình duyệt trung lập và nhật ký kiểm toán. |
| [`08-teacher-candidate-detail-drawer.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/08-teacher-candidate-detail-drawer.png) | Ngăn kéo chi tiết hồ sơ phiên thi của thí sinh (`Candidate Detail Slide-Over Panel`) hiển thị tiến độ từng câu và lịch sử sự kiện quan sát được. |

---

## 3. Phân Hệ C: Teacher Question Studio & Design System Tokens

| Tập tin ảnh | Mô tả trạng thái giao diện |
|---|---|
| [`09-teacher-question-studio.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/09-teacher-question-studio.png) | Giao diện Studio biên soạn câu hỏi: Công cụ nhập file Word `.doc`/`.docx`, báo cáo kiểm định (`Validation Report`), trình soạn thảo LaTeX, xem trước trực tiếp và kiểm tra mã hex MTEF. |
| [`10-studio-corrupted-mtef-blocked.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/10-studio-corrupted-mtef-blocked.png) | Cổng an toàn dữ liệu khi nhập file `corrupted_formula.doc`: Hiển thị trạng thái `CHAN XUAT BAN`, cảnh báo công thức MTEF lỗi kèm mã hex gốc chờ giáo viên xác minh. |
| [`11-teacher-studio-dark-mode.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/11-teacher-studio-dark-mode.png) | Giao diện Chế độ Tối (`Dark Mode`) được cân chỉnh độ tương phản chuẩn WCAG 2.2 AA. |
| [`12-design-system-tokens-modal.png`](file:///c:/Users/Darne/Downloads/The%20Fragrent/docs/screenshots/12-design-system-tokens-modal.png) | Bảng kiểm tra hệ thống Design Tokens và đầy đủ 11 trạng thái Component chuẩn hóa (Mục 5.3 & 5.4). |
