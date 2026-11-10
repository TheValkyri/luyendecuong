# KhaoThi Precision Suite v2.0

Nen tang Khao thi Truc tuyen, Giam sat Phong thi Thoi gian thuc va Bien soan Cau hoi tu Word (`.doc` / `.docx` / MathType MTEF / OMML) dat chuan WCAG 2.2 AA va kien truc phan tach ranh gioi tin cay (Trust Boundaries).

---

## 1. Báo Cáo Thực Thi Taste Skill (Mục 5.2)

Trước khi thiết kế và triển khai, hệ thống đã kiểm tra và đọc đầy đủ toàn bộ tài liệu trong bộ `taste` skill đã cài đặt trên môi trường:
1. [`taste/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/taste/SKILL.md)
2. [`design-taste-frontend/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/design-taste-frontend/SKILL.md) (1.206 dòng, bao gồm Phụ lục A, B, C)
3. [`design-taste-frontend-v1/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/design-taste-frontend-v1/SKILL.md)
4. [`minimalist-ui/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/minimalist-ui/SKILL.md)
5. [`high-end-visual-design/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/high-end-visual-design/SKILL.md)
6. [`full-output-enforcement/SKILL.md`](file:///C:/Users/Darne/.gemini/config/skills/full-output-enforcement/SKILL.md)

### Báo cáo trung thực về phạm vi của `design-taste-frontend`:
- Skill `design-taste-frontend` (v2) được cài đặt đầy đủ tại `C:\Users\Darne\.gemini\config\skills\design-taste-frontend\SKILL.md`. Thư mục skill chỉ chứa file `SKILL.md` (các tài liệu tham chiếu chuẩn đã được tích hợp trực tiếp vào `Appendix A`, `Appendix B`, `Appendix C` bên trong `SKILL.md`, không tách thành thư mục `references/` rời).
- Theo đúng Mục 13 (`OUT OF SCOPE`) của `design-taste-frontend/SKILL.md`, bộ quy tắc bố cục trang đích (landing page) của v2 không áp đặt máy móc lên các màn hình ứng dụng chuyên sâu (Dashboards, Data Tables, Multi-step Assessment UI) mà hướng dẫn sử dụng hệ thống Design Tokens nhất quán kết hợp với các nguyên tắc cốt lõi của bộ `taste`:
  - **Design Read**: *"Reading this as: High-trust EdTech Examination, Live Proctoring Telemetry & Question Authoring Suite for students and educators, with a Utilitarian Editorial & Swiss Precision language, leaning toward custom semantic design tokens + Plus Jakarta Sans / Geist + JetBrains Mono + restrained hardware-accelerated motion."*
  - **Three Dials**: `DESIGN_VARIANCE: 4` | `MOTION_INTENSITY: 5` | `VISUAL_DENSITY: 6`.
  - **Kỷ luật Anti-Slop**: Không dùng màu tím AI (Lila Ban), không dùng emoji thay icon (sử dụng `@phosphor-icons/react`), không dùng dấu gạch ngang dài em-dash, không lồng nhiều lớp card vô nghĩa, sử dụng kiến trúc khung viền kép (`bezel-shell` + `bezel-core`) và chỉ animate `transform` + `opacity`.

---

## 2. Cấu Trúc Dự Án

```text
.
├── data/
│   └── example-exam.json              # Đề thi mẫu chuẩn Schema v2.0.0 (đủ 4 loại câu hỏi, SVG, LaTeX)
├── docs/
│   ├── ARCHITECTURE.md                # Tài liệu kiến trúc hệ thống, Trust Boundaries & Reliability
│   ├── API.md                         # Tài liệu đặc tả REST API & Idempotency
│   ├── DATABASE_SCHEMA.md             # Thiết kế cơ sở dữ liệu, IndexedDB & Schema Migration
│   ├── PYTHON_ETL.md                  # Tài liệu pipeline xử lý Word (.doc / .docx / MTEF v3 & v5)
│   ├── AUDIT_REPORT.md                # Báo cáo kiểm định chất lượng (Functional, Recovery, Responsive, A11y)
│   ├── DEPLOYMENT.md                  # Hướng dẫn triển khai, cấu hình, sao lưu và khôi phục
│   ├── SECURITY_REVIEW.md             # Báo cáo rà soát bảo mật & quyền riêng tư
│   ├── UI_GALLERY.md                  # Thư viện ảnh chụp màn hình thực tế trên các viewport
│   └── KNOWN_LIMITATIONS.md           # Các giới hạn đã biết và phương án xử lý
├── etl/
│   ├── doc_parser.py                  # Parser độc lập cho định dạng Word nhị phân cũ (.doc OLE2)
│   ├── docx_parser.py                 # Parser độc lập cho định dạng Word OOXML (.docx)
│   ├── mtef_decoder.py                # Bộ giải mã công thức MathType MTEF v3, MTEF v5 và OMML
│   ├── validator.py                   # Bộ tính điểm tin cậy (confidence), needs_review và cổng kiểm duyệt
│   ├── generate_fixtures.py           # Trình tạo bộ golden test fixtures (.doc và .docx)
│   ├── cli.py                         # Giao diện dòng lệnh kết nối ETL với Backend Server
│   ├── test_etl.py                    # Bộ kiểm thử tự động cho Python ETL Pipeline
│   └── fixtures/                      # Các file .doc / .docx mẫu phục vụ kiểm thử chuẩn (Golden Fixtures)
├── public/
│   └── sw.js                          # Service Worker quản lý App Shell và dữ liệu ngoại tuyến được phép
├── scripts/
│   └── run-browser-audit.ts           # Kịch bản Playwright kiểm thử E2E, 5 viewport, A11y & chụp ảnh UI
├── server/
│   ├── app.ts                         # Backend API Server thực thi Trust Boundaries, RBAC, Chấm điểm & Audit
│   └── index.ts                       # Điểm khởi chạy HTTP Server (cổng 3001)
├── src/
│   ├── components/
│   │   ├── StudentWorkspace.tsx       # Phân hệ A: Không gian làm bài của Thí sinh (Exam & Practice Mode)
│   │   ├── TeacherMonitoringDashboard.tsx # Phân hệ B: Bảng giám sát phòng thi & Phân tích phổ điểm
│   │   ├── TeacherQuestionStudio.tsx  # Phân hệ C: Studio biên soạn đề, nhập Word & xuất bản phiên bản
│   │   ├── MathText.tsx               # Bộ hiển thị toán học KaTeX tích hợp làm sạch chống XSS
│   │   └── ImageZoomModal.tsx         # Hộp thoại phóng to sơ đồ kỹ thuật bảo toàn ngữ cảnh focus
│   ├── data/
│   │   └── seed-exams.ts              # Khởi tạo dữ liệu đề thi chuẩn
│   ├── lib/
│   │   ├── design-tokens.ts           # Hệ thống Design Tokens & 11 trạng thái Component (Mục 5.3)
│   │   ├── motion-engine.ts           # Motion Engine & hỗ trợ prefers-reduced-motion (Mục 5.4)
│   │   ├── sound-engine.ts            # Web Audio API SFX Engine nhẹ, không dùng SDK ngoài (Mục 5.5)
│   │   ├── grading-engine.ts          # Động cơ chấm điểm chuẩn & trộn đề tất định theo hạt giống
│   │   ├── reliability.ts             # IndexedDB, BroadcastChannel đa tab, Exponential Backoff + Jitter
│   │   ├── schema-migration.ts        # Công cụ nâng cấp Schema v1.0 lên v2.0.0
│   │   └── security-utils.ts          # Bộ lọc chống XSS từ Word và chống CSV Formula Injection
│   ├── styles/
│   │   └── tokens.css                 # Biến CSS toàn cục cho Light/Dark mode, bóng đổ và chuyển động
│   ├── types/
│   │   └── exam.ts                    # Định nghĩa hợp đồng dữ liệu TypeScript (Data Contracts)
│   ├── App.tsx                        # Khung điều hướng 3 phân hệ UX tách biệt
│   └── main.tsx                       # Điểm khởi chạy ứng dụng React & đăng ký Service Worker
├── tests/
│   ├── functional-grading.test.ts     # Kiểm thử chức năng, loại câu hỏi, chính sách chấm điểm & tokens
│   ├── recovery-reliability.test.ts   # Kiểm thử khôi phục sau sự cố, hàng đợi ngoại tuyến & đa tab
│   └── security-api.test.ts           # Kiểm thử bảo mật, chống lộ đáp án, chống sửa điểm & CSV injection
└── firestore.rules                    # Quy tắc bảo mật Firebase Firestore (Production Security Rules)
```

---

## 3. Hướng Dẫn Khởi Chạy Nhanh

### Yêu cầu môi trường
- **Node.js**: >= 20.x (đã kiểm thử trên v24.16.0)
- **Python**: >= 3.10 (đã kiểm thử trên Python 3.13.14)

### Cài đặt và Chạy thử nghiệm
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Chạy Backend API Server (Cổng 3001)
npm run dev:server

# 3. Chạy Frontend Vite Server (Cổng 5173)
npm run dev:client
```

### Chạy toàn bộ bộ kiểm thử chất lượng (Quality Gates)
```bash
# Chạy Unit, Integration, Recovery & Security Tests (Vitest)
npm test

# Chạy Golden Fixture Tests cho Python Word (.doc/.docx/MTEF) ETL Pipeline
npm run test:etl

# Đóng gói Production và chạy kiểm thử trình duyệt thực tế (Playwright E2E + 5 Viewports)
npm run build
npm run test:e2e
```
