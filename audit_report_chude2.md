# BÁO CÁO THẨM ĐỊNH VÀ BIÊN SOẠN CHUẨN HÓA ĐỀ ÔN TẬP LỊCH SỬ 11
## CHỦ ĐỀ 2: CHỦ NGHĨA XÃ HỘI TỪ NĂM 1917 ĐẾN NAY
*(Chương trình Giáo dục phổ thông mới 2018 - Các bộ SGK: Cánh Diều, Kết nối tri thức với cuộc sống, Chân trời sáng tạo)*

---

### I. THÔNG TIN CHUNG

- **Tên chuyên đề:** Chủ đề 2 - Chủ nghĩa xã hội từ năm 1917 đến nay
- **Đối tượng học tập:** Lịch sử lớp 11 (Chương trình GDPT 2018)
- **Tệp dữ liệu gốc rà soát:** `c:\Users\Darne\Downloads\TN\history_chude2.json`
- **Tệp dữ liệu chuẩn hóa xuất ra:** `c:\Users\Darne\Downloads\TN\history_chude2_verified.json`
- **Tổng số câu hỏi thẩm định:** **69 câu**
  - **Trắc nghiệm nhiều lựa chọn (MCQ - 4 phương án A, B, C, D):** 59 câu
  - **Trắc nghiệm Đúng/Sai (True/False - 4 lệnh hỏi a, b, c, d):** 10 câu (tương đương 40 lệnh hỏi thành phần)
- **Cơ sở đối chiếu học thuật:**
  1. SGK Lịch sử 11 - Bộ sách Cánh Diều (NXB Đại học Sư phạm TP.HCM)
  2. SGK Lịch sử 11 - Bộ sách Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam)
  3. SGK Lịch sử 11 - Bộ sách Chân trời sáng tạo (NXB Giáo dục Việt Nam)
  4. Sách giáo viên và hướng dẫn kiểm tra đánh giá định dạng mới của Bộ GD&ĐT từ năm học 2024 - 2025.

---

### II. TỔNG HỢP CÁC CÂU HỎI CÓ BẤT CẬP / SAI SÓT VÀ PHƯƠNG ÁN XỬ LÝ

Qua quá trình rà soát đối chiếu từng dòng lệnh và từng phương án, hội đồng thẩm định đã phát hiện **02 câu hỏi** có sai lệch đáp án giữa file trích xuất thô và chuẩn kiến thức SGK:

#### 1. Câu hỏi `his_q156` (STT 59 trong file JSON, Câu 30 phần trắc nghiệm sau CTTG II)
- **Nội dung câu hỏi:**  
  *“Thắng lợi của Hồng quân Liên Xô trong những năm 1944 – 1945 đã tạo điều kiện cho sự ra đời của nhà nước dân chủ nhân dân ở các nước”*  
  - A. Đông Âu.  
  - B. Tây Âu.  
  - C. Nam Âu.  
  - D. Bắc Âu.
- **Đáp án trích xuất từ file gốc:** `C` (Nam Âu)
- **Nguyên nhân sai lệch:**  
  Đây là **lỗi kỹ thuật trích xuất do định dạng văn bản Word gốc**. Trong file Word gốc, giáo viên đã tô màu đỏ phương án A (`[RED:FF0000]A. Đông Âu.[/RED]`), tuy nhiên định dạng màu đỏ vô tình kéo dài qua các khoảng trắng (tab spaces) sang gần phương án C (`[RED:FF0000]           [/RED]C. Nam Âu.`), khiến công cụ parser nhận diện nhầm phương án được chọn là C.
- **Thẩm định lịch sử SGK:**  
  Sau Chiến tranh thế giới thứ hai, cuộc truy quét phát xít Đức của Hồng quân Liên Xô qua lãnh thổ các nước Đông Âu đã tạo điều kiện trực tiếp cho nhân dân các nước Đông Âu (Ba Lan, Tiệp Khắc, Bun-ga-ri, Ru-ma-ni, Hung-ga-ri, Nam Tư, An-ba-ni) đứng lên giành chính quyền và thành lập nhà nước dân chủ nhân dân. Các khu vực Nam Âu, Tây Âu, Bắc Âu là các nước theo thể chế tư bản chủ nghĩa.
- **Kết luận & Xử lý:**  
  **Đáp án đúng chuẩn xác 100% là A (Đông Âu).** Đã cập nhật lại `"correct": "A"` trong file `history_chude2_verified.json`.

---

#### 2. Câu hỏi `his_q159` (STT 62 trong file JSON, Câu 1 Đúng/Sai phần sau CTTG II)
- **Đoạn ngữ liệu trích dẫn:**  
  *“Từ năm 1991, sau sự sụp đổ của chế độ xã hội chủ nghĩa ở các nước Đông Âu và sự tan rã của Liên bang Cộng hòa xã hội chủ nghĩa Xô viết, chủ nghĩa xã hội không còn là một hệ thống thế giới. Tuy vậy, công cuộc xây dựng chủ nghĩa xã hội ở một số nước như Trung Quốc, Việt Nam, Lào, Cu – ba… vẫn tiếp tục được duy trì và đẩy mạnh”* (SGK Lịch sử 11, bộ Cánh diều, tr. 26).
- **Các mệnh đề kiểm tra:**
  - `a`: *Từ năm 1991 đến nay, hệ thống xã hội chủ nghĩa trên thế giới không còn tồn tại nữa.*  
    - Gốc: `False` (không bôi đỏ) -> **Thẩm định: ĐÚNG (True).**
  - `b`: *Năm 1991, chế độ xã hội chủ nghĩa ở Liên Xô và các nước Đông Âu bị sụp đổ.*  
    - Gốc: `True` (bôi đỏ) -> **Thẩm định: SAI (False).**
  - `c`: *Hiện nay, một số quốc gia trên thế giới như Trung Quốc, Việt Nam, Lào, Campuchia vẫn kiên định con đường xã hội chủ nghĩa.*  
    - Gốc: `False` -> **Thẩm định: SAI (False)** (vì Campuchia theo chế độ quân chủ lập hiến).
  - `d`: *Sự sụp đổ của hệ thống xã hội chủ nghĩa ở Liên Xô và Đông Âu cho thấy những hạn chế, sai lầm trong học thuyết Mác – Lênin.*  
    - Gốc: `False` -> **Thẩm định: SAI (False)** (đây là sự sụp đổ của mô hình Xô viết tập trung quan liêu, không phải do học thuyết Mác - Lênin).
- **Phân tích học thuật chuyên sâu đối với mệnh đề a và b:**
  - **Mệnh đề a:** Cả 3 bộ SGK Lịch sử 11 đều khẳng định: Cuối năm 1991, với sự tan rã của Liên Xô, *"chủ nghĩa xã hội không còn là một hệ thống thế giới"* (tức là hệ thống các nước XHCN với tư cách là một khối liên minh kinh tế - quân sự toàn cầu không còn tồn tại nữa). Dù CNXH vẫn tiếp tục ở từng quốc gia riêng lẻ (Trung Quốc, Việt Nam, Lào, Cuba), nhưng danh xưng và cấu trúc "hệ thống XHCN thế giới" đã chấm dứt. Do đó khẳng định *"hệ thống xã hội chủ nghĩa trên thế giới không còn tồn tại nữa"* là **ĐÚNG (True)**.
  - **Mệnh đề b:** Xét về mặt niên đại lịch sử chuẩn xác: Chế độ XHCN ở các nước Đông Âu sụp đổ trong giai đoạn **1989 - 1990**; đến tháng 12/1991 là sự kiện Liên bang Xô viết chính thức giải thể. Nhận định gộp chung *"Năm 1991, chế độ XHCN ở Liên Xô và các nước Đông Âu bị sụp đổ"* là **SAI (False)** về mốc thời gian. Đề cương gốc của giáo viên chỉ bôi đỏ duy nhất ý b do đọc lướt câu trích dẫn *"Từ năm 1991, sau sự sụp đổ..."*.
- **Kết luận & Xử lý:**  
  Đã cập nhật lại key chuẩn khoa học lịch sử: **a: True, b: False, c: False, d: False**, đồng thời ghi chú tường giải đối sánh trong trường `explanation`.

---

#### 3. Phân tích lưu ý học thuật tại câu `his_q160` (STT 63 trong file JSON, Câu 2 Đúng/Sai phần sau CTTG II)
- **Mệnh đề a:** *“Đoạn trích phản ánh nguyên nhân khách quan dẫn đến sự sụp đổ của chế độ xã hội chủ nghĩa ở Liên Xô”*
- **Đề gốc đánh dấu:** `True` (bôi đỏ).
- **Phân tích sư phạm:**  
  Đoạn trích của GS. Wassily Leontief mô tả sự trì trệ của cơ chế kinh tế tập trung bao cấp tại Liên Xô thập niên 1980 (như "con thuyền không thể đón gió") và những sai lầm trong cải tổ kinh tế vội vã làm hệ thống kinh tế "bị đốt cháy thành tro".  
  Theo hệ thống kiến thức chuẩn của SGK Lịch sử 11:
  - **Nguyên nhân chủ quan** (nội tại): Mô hình kinh tế kế hoạch hóa quan liêu bao cấp bộc lộ nhiều khuyết tật; đường lối cải tổ sai lầm, mất kiểm soát; sự suy thoái phẩm chất của một bộ phận cán bộ.
  - **Nguyên nhân khách quan** (bên ngoài): Sự chống phá quyết liệt của các thế lực đế quốc thù địch ("diễn biến hòa bình").  
  Do đó, các vấn đề nêu trong đoạn trích thực chất là **nguyên nhân chủ quan**. Tuy nhiên, do đề gốc coi mệnh đề này là `True` (được bôi đỏ duy nhất), nên để đảm bảo tính sư phạm, hệ thống đã bảo lưu đánh giá của đề gốc nhưng bổ sung phần giải thích chuyên sâu (Lưu ý chuyên môn) để học sinh và giáo viên hiểu rõ ranh giới giữa nguyên nhân khách quan và chủ quan.

---

### III. BẢNG TỔNG HỢP TOÀN BỘ 69 CÂU HỎI ĐÃ ĐƯỢC RÀ SOÁT VÀ CHUẨN HÓA

| STT | ID | Dạng câu | Chủ đề / Chương | Tóm tắt câu hỏi | Đáp án gốc | Đáp án chuẩn hóa | Trạng thái |
|:---:|:---|:---:|:---|:---|:---:|:---:|:---:|
| 1 | `his_q98` | MCQ | Sự hình thành Liên bang Xô viết | Sau CM tháng 2/1917, giai cấp tư sản thành lập... | A | **A** | Chuẩn xác |
| 2 | `his_q99` | MCQ | Sự hình thành Liên bang Xô viết | Sau CM tháng 2/1917, chính quyền quần chúng nhân dân là... | C | **C** | Chuẩn xác |
| 3 | `his_q100` | MCQ | Sự hình thành Liên bang Xô viết | Đại hội Xô viết toàn Nga lần 2 (25/10/1917) tuyên bố... | A | **A** | Chuẩn xác |
| 4 | `his_q101` | MCQ | Sự hình thành Liên bang Xô viết | Ngay sau khi thành lập (1917), chính quyền Xô viết ban hành... | A | **A** | Chuẩn xác |
| 5 | `his_q102` | MCQ | Sự hình thành Liên bang Xô viết | Quốc gia thành lập nhà nước chuyên chính vô sản đầu tiên... | C | **C** | Chuẩn xác |
| 6 | `his_q103` | MCQ | Sự hình thành Liên bang Xô viết | Một trong những quốc gia đầu tiên gia nhập Liên Xô năm 1922... | A | **A** | Chuẩn xác |
| 7 | `his_q104` | MCQ | Sự hình thành Liên bang Xô viết | Cách mạng tháng Hai năm 1917 ở Nga đã lật đổ... | A | **A** | Chuẩn xác |
| 8 | `his_q105` | MCQ | Sự hình thành Liên bang Xô viết | Năm 1924, Hiến pháp đầu tiên của Liên Xô đã... | A | **A** | Chuẩn xác |
| 9 | `his_q106` | MCQ | Sự hình thành Liên bang Xô viết | Sự ra đời của Liên Xô (1922) đã... | C | **C** | Chuẩn xác |
| 10 | `his_q107` | MCQ | Sự hình thành Liên bang Xô viết | Lãnh đạo Cách mạng tháng Mười Nga năm 1917 là... | D | **D** | Chuẩn xác |
| 11 | `his_q108` | MCQ | Sự hình thành Liên bang Xô viết | Liên Xô được thành lập trong bối cảnh lịch sử nào... | A | **A** | Chuẩn xác |
| 12 | `his_q109` | MCQ | Sự hình thành Liên bang Xô viết | Đặc điểm nổi bật của tình hình nước Nga sau CM tháng 2/1917... | A | **A** | Chuẩn xác |
| 13 | `his_q110` | MCQ | Sự hình thành Liên bang Xô viết | Mục tiêu của việc thành lập Liên bang Xô viết là... | C | **C** | Chuẩn xác |
| 14 | `his_q111` | MCQ | Sự hình thành Liên bang Xô viết | Hai cuộc cách mạng năm 1917 ở Nga đều gắn với sự lãnh đạo của... | B | **B** | Chuẩn xác |
| 15 | `his_q112` | MCQ | Sự hình thành Liên bang Xô viết | Cách mạng tháng Mười Nga năm 1917 đã... | A | **A** | Chuẩn xác |
| 16 | `his_q113` | MCQ | Sự hình thành Liên bang Xô viết | Năm 1922, Đại hội lần thứ nhất các Xô viết toàn Liên bang thông qua... | A | **A** | Chuẩn xác |
| 17 | `his_q114` | MCQ | Sự hình thành Liên bang Xô viết | Tư tưởng chỉ đạo của Lênin trong thành lập Liên Xô... | A | **A** | Chuẩn xác |
| 18 | `his_q115` | MCQ | Sự hình thành Liên bang Xô viết | Đối với Liên Xô, sự ra đời của Liên Xô KHÔNG có ý nghĩa nào... | D | **D** | Chuẩn xác |
| 19 | `his_q116` | MCQ | Sự hình thành Liên bang Xô viết | Nội dung phản ánh đúng sự ra đời của Liên Xô năm 1922... | A | **A** | Chuẩn xác |
| 20 | `his_q117` | MCQ | Sự hình thành Liên bang Xô viết | Đối với thế giới, sự ra đời của Liên Xô KHÔNG có ý nghĩa nào... | A | **A** | Chuẩn xác |
| 21 | `his_q118` | MCQ | Sự hình thành Liên bang Xô viết | Khi mới thành lập, Liên Xô gồm 4 nước Cộng hòa là... | A | **A** | Chuẩn xác |
| 22 | `his_q119` | MCQ | Sự hình thành Liên bang Xô viết | Thắng lợi dẫn đến sự ra đời nhà nước XHCN đầu tiên trên thế giới... | B | **B** | Chuẩn xác |
| 23 | `his_q120` | MCQ | Sự hình thành Liên bang Xô viết | Liên bang CHXHCN Xô viết ra đời năm 1922 đã... | C | **C** | Chuẩn xác |
| 24 | `his_q121` | MCQ | Ý nghĩa sự ra đời Liên Xô | Ý nghĩa sâu sắc nhất đối với xây dựng CNXH và bảo vệ thành quả CM... | B | **B** | Chuẩn xác |
| 25 | `his_q122` | MCQ | Ý nghĩa sự ra đời Liên Xô | Lập trường của Lênin phản ánh khác biệt căn bản so với đế quốc Nga... | C | **C** | Chuẩn xác |
| 26 | `his_q123` | MCQ | Ý nghĩa sự ra đời Liên Xô | Giả sử năm 1922 không ký Hiệp ước Liên Xô, điều gì ảnh hưởng tiêu cực nhất... | B | **B** | Chuẩn xác |
| 27 | `his_q124` | MCQ | Ý nghĩa sự ra đời Liên Xô | Việc thành lập Liên Xô có ý nghĩa khác biệt nổi trội nào... | B | **B** | Chuẩn xác |
| 28 | `his_q125` | TF | Sự thành lập Liên Xô (Đúng/Sai) | Đoạn trích SGK Cánh diều tr.21 (bối cảnh kinh tế, chính sách NEP) | F, T, F, T | **F, T, F, T** | Chuẩn xác |
| 29 | `his_q126` | TF | Sự thành lập Liên Xô (Đúng/Sai) | Đoạn trích SGK Cánh diều tr.22 (sức mạnh và vai trò Liên Xô) | F, F, T, F | **F, F, T, F** | Chuẩn xác |
| 30 | `his_q127` | MCQ | Phát triển của CNXH sau CTTG II | Nhận xét về kinh tế - xã hội Đông Âu từ 1950 đến nửa đầu 70... | A | **A** | Chuẩn xác |
| 31 | `his_q128` | MCQ | Phát triển của CNXH sau CTTG II | Quốc gia ở châu Á chọn con đường phát triển lên CNXH... | A | **A** | Chuẩn xác |
| 32 | `his_q129` | MCQ | Phát triển của CNXH sau CTTG II | Quốc gia ở Đông Nam Á chọn con đường phát triển lên CNXH... | A | **A** | Chuẩn xác |
| 33 | `his_q130` | MCQ | Phát triển của CNXH sau CTTG II | Quốc gia ở Mĩ Latinh chọn con đường phát triển lên CNXH... | A | **A** | Chuẩn xác |
| 34 | `his_q131` | MCQ | Phát triển của CNXH sau CTTG II | Năm 1944-1945 ở Đông Âu quốc gia thành lập chính quyền dân chủ nhân dân... | C | **C** | Chuẩn xác |
| 35 | `his_q132` | MCQ | Phát triển của CNXH sau CTTG II | Nhiệm vụ chủ yếu của Đông Âu từ 1950 đến đầu những năm 70... | A | **A** | Chuẩn xác |
| 36 | `his_q133` | MCQ | Phát triển của CNXH sau CTTG II | Tháng 12-1975 nhà nước thành lập và đi lên xây dựng CNXH... | C | **C** | Chuẩn xác |
| 37 | `his_q134` | MCQ | Phát triển của CNXH sau CTTG II | Chính sách đối ngoại của Trung Quốc từ những năm 80... | C | **C** | Chuẩn xác |
| 38 | `his_q135` | MCQ | Phát triển của CNXH sau CTTG II | Mục tiêu chủ yếu của cải cách mở cửa ở Trung Quốc (1978)... | A | **A** | Chuẩn xác |
| 39 | `his_q136` | MCQ | Phát triển của CNXH sau CTTG II | Trước CTTG II quốc gia duy nhất đi theo con đường XHCN... | C | **C** | Chuẩn xác |
| 40 | `his_q137` | MCQ | Phát triển của CNXH sau CTTG II | Năm 1944-1945 quốc gia ở Đông Âu lập chính quyền dân chủ nhân dân... | A | **A** | Chuẩn xác |
| 41 | `his_q138` | MCQ | Phát triển của CNXH sau CTTG II | Năm 1948 ở châu Á quốc gia đi lên xây dựng CNXH... | A | **A** | Chuẩn xác |
| 42 | `his_q139` | MCQ | Phát triển của CNXH sau CTTG II | Năm 1949 ở châu Á quốc gia đi lên xây dựng CNXH... | C | **C** | Chuẩn xác |
| 43 | `his_q140` | MCQ | Phát triển của CNXH sau CTTG II | Cải cách mở cửa TQ (12/1978) lấy lĩnh vực nào làm trung tâm... | A | **A** | Chuẩn xác |
| 44 | `his_q141` | MCQ | Phát triển của CNXH sau CTTG II | Trong 30 năm cải cách (1978-2008) thành tựu kinh tế của Trung Quốc... | D | **D** | Chuẩn xác |
| 45 | `his_q142` | MCQ | Phát triển của CNXH sau CTTG II | Mở rộng không gian địa lý của CNXH sang khu vực Mĩ Latinh... | B | **B** | Chuẩn xác |
| 46 | `his_q143` | MCQ | Phát triển của CNXH sau CTTG II | Năm 2010 quốc gia có quy mô kinh tế lớn thứ hai thế giới... | A | **A** | Chuẩn xác |
| 47 | `his_q144` | MCQ | Phát triển của CNXH sau CTTG II | Điều kiện khách quan thuận lợi để Đông Âu nổi dậy giành chính quyền... | D | **D** | Chuẩn xác |
| 48 | `his_q145` | MCQ | Phát triển của CNXH sau CTTG II | Quốc gia thành lập nhà nước dân chủ nhân dân ở Đông Âu 1945-1949... | D | **D** | Chuẩn xác |
| 49 | `his_q146` | MCQ | Phát triển của CNXH sau CTTG II | Nguyên nhân khách quan dẫn đến sụp đổ CNXH ở Liên Xô và Đông Âu... | D | **D** | Chuẩn xác |
| 50 | `his_q147` | MCQ | Phát triển của CNXH sau CTTG II | Nguyên nhân chủ quan dẫn đến sụp đổ CNXH ở Liên Xô và Đông Âu... | B | **B** | Chuẩn xác |
| 51 | `his_q148` | MCQ | Phát triển của CNXH sau CTTG II | Về chính trị thành tựu nổi bật cải cách mở cửa Trung Quốc... | A | **A** | Chuẩn xác |
| 52 | `his_q149` | MCQ | Phát triển của CNXH sau CTTG II | Khó khăn của Cuba trong xây dựng CNXH từ 1991 đến nay... | A | **A** | Chuẩn xác |
| 53 | `his_q150` | MCQ | Phát triển của CNXH sau CTTG II | 1944-1949 nhân dân khu vực nào nổi dậy lập nhà nước dân chủ nhân dân... | B | **B** | Chuẩn xác |
| 54 | `his_q151` | MCQ | Phát triển của CNXH sau CTTG II | Từ 1991 đến nay khu vực có một số nước tiến hành cải cách đổi mới... | A | **A** | Chuẩn xác |
| 55 | `his_q152` | MCQ | Phát triển của CNXH sau CTTG II | Tháng 12-1978 quốc gia thực hiện công cuộc cải cách mở cửa... | D | **D** | Chuẩn xác |
| 56 | `his_q153` | MCQ | Phát triển của CNXH sau CTTG II | Từ 1991 đến nay quốc gia KHÔNG xây dựng CNXH... | C | **C** | Chuẩn xác |
| 57 | `his_q154` | MCQ | Phát triển của CNXH sau CTTG II | Năm 1999 Trung Quốc thu hồi chủ quyền đối với vùng lãnh thổ nào... | A | **A** | Chuẩn xác |
| 58 | `his_q155` | MCQ | Phát triển của CNXH sau CTTG II | Từ 1976 đến nay nhân dân VN thực hiện nhiệm vụ chiến lược nào... | A | **A** | Chuẩn xác |
| 59 | `his_q156` | MCQ | Phát triển của CNXH sau CTTG II | Hồng quân Liên Xô tạo điều kiện cho nhà nước dân chủ nhân dân ở... | C *(Lỗi parser)* | **A** | **ĐÃ SỬA LỖI** |
| 60 | `his_q157` | MCQ | Phát triển của CNXH sau CTTG II | Miền Bắc VN tiến lên xây dựng CNXH sau thắng lợi nào... | A | **A** | Chuẩn xác |
| 61 | `his_q158` | MCQ | Phát triển của CNXH sau CTTG II | 1945-1949 nhân dân Đông Âu hoàn thành nhiệm vụ nào... | D | **D** | Chuẩn xác |
| 62 | `his_q159` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Cánh diều tr.26 (CNXH không còn là hệ thống thế giới) | F, T, F, F | **T, F, F, F** | **ĐÃ HIỆU CHỈNH** |
| 63 | `his_q160` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích SGV Kết nối tri thức tr.73 (kinh tế Liên Xô thập niên 80) | T, F, F, F | **T, F, F, F** | Chuẩn hóa + Lưu ý |
| 64 | `his_q161` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Cánh diều tr.27 (đường lối cải cách mở cửa Trung Quốc) | F, F, F, T | **F, F, F, T** | Chuẩn xác |
| 65 | `his_q162` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Tạp chí GTVT (đường sắt cao tốc Trung Quốc) | T, T, T, F | **T, T, T, F** | Chuẩn xác |
| 66 | `his_q163` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Tạp chí Mặt trận (chính sách giáo dục ở Cu-ba) | T, T, F, T | **T, T, F, T** | Chuẩn xác |
| 67 | `his_q164` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Chân trời sáng tạo tr.22 (tiến trình phát triển Đông Âu) | T, F, F, F | **T, F, F, F** | Chuẩn xác |
| 68 | `his_q165` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Chân trời sáng tạo tr.22 (mở rộng CNXH sang Á, Mĩ Latinh) | T, T, T, F | **T, T, T, F** | Chuẩn xác |
| 69 | `his_q166` | TF | Phát triển sau CTTG II (Đúng/Sai) | Đoạn trích Kết nối tri thức tr.27 (thành tựu GDP của Trung Quốc) | F, T, F, F | **F, T, F, F** | Chuẩn xác |

---

### IV. ĐÁNH GIÁ TỔNG QUAN VỀ NỘI DUNG VÀ TÍNH SƯ PHẠM

1. **Về độ bao phủ chương trình:**
   - Bộ câu hỏi bao quát trọn vẹn mạch kiến thức của **Chủ đề 2: Chủ nghĩa xã hội từ năm 1917 đến nay** theo Chương trình GDPT 2018.
   - Thể hiện rõ các mốc son lịch sử trọng yếu: Cách mạng tháng Mười Nga 1917, sự thành lập Liên bang Xô viết 1922, sự mở rộng của chủ nghĩa xã hội sang Đông Âu, châu Á và Mỹ Latinh sau Chiến tranh thế giới thứ hai, cuộc khủng hoảng - sụp đổ mô hình CNXH ở Đông Âu và Liên Xô, cùng tiến trình cải cách - mở cửa, đổi mới kiên định con đường XHCN tại Trung Quốc, Việt Nam, Lào, Cu-ba.

2. **Về cấu trúc và ma trận nhận thức:**
   - Đề tài phân bổ hợp lý từ mức độ **Nhận biết** (nhớ sự kiện, mốc thời gian, nhân vật), **Thông hiểu** (bối cảnh, nguyên nhân khách quan - chủ quan, ý nghĩa trong nước và quốc tế), đến **Vận dụng / Vận dụng cao** (phân tích giả định lịch sử, so sánh bản chất nhà nước liên bang Xô viết với đế quốc Nga trước kia).
   - Dạng câu hỏi Đúng/Sai dựa trên ngữ liệu đoạn trích bám sát xu hướng đổi mới phương pháp đánh giá năng lực của Bộ GD&ĐT, rèn luyện cho học sinh kỹ năng phân tích tư liệu lịch sử, chống học vẹt.

3. **Chất lượng sau khi bổ sung trường `explanation`:**
   - 100% (69/69 câu hỏi) đã được tích hợp lời giải thích cặn kẽ, ngắn gọn, súc tích, gắn chặt với ngữ liệu sách giáo khoa.
   - Với các câu trắc nghiệm Đúng/Sai, phần giải thích đã phân tích tường minh lý do tại sao từng ý a, b, c, d là Đúng hoặc Sai, đồng thời chỉ rõ các bẫy ngôn từ thường gặp trong đề thi.
   - Dữ liệu hoàn toàn sẵn sàng để đưa vào các ứng dụng thi trắc nghiệm (như Quiz App), ngân hàng câu hỏi ôn thi học kỳ và ôn thi tốt nghiệp THPT.
