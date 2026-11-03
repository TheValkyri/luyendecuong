# BÁO CÁO THẨM ĐỊNH VÀ BIÊN SOẠN NGÂN HÀNG CÂU HỎI
## CHỦ ĐỀ 1: CÁCH MẠNG TƯ SẢN VÀ SỰ PHÁT TRIỂN CỦA CHỦ NGHĨA TƯ BẢN
**Chương trình Giáo dục Phổ thông 2018 - Môn Lịch Sử 11**  
*(Áp dụng đồng bộ cho các bộ sách giáo khoa: Kết nối tri thức với cuộc sống, Cánh Diều, Chân trời sáng tạo)*

---

### I. TỔNG QUAN RÀ SOÁT VÀ THẨM ĐỊNH

- **File dữ liệu nguồn:** `c:\Users\Darne\Downloads\TN\history_chude1.json`
- **File kết quả thẩm định:** `c:\Users\Darne\Downloads\TN\history_chude1_verified.json`
- **Tổng số câu hỏi được thẩm định:** **97 câu hỏi** (100% được rà soát và bổ sung lời giải chi tiết).
- **Phân loại cấu trúc định dạng câu hỏi:**
  1. **Câu trắc nghiệm nhiều lựa chọn (MCQ - 4 phương án A, B, C, D):** 86 câu.
  2. **Câu trắc nghiệm Đúng/Sai (True/False - dạng 4 lệnh hỏi a, b, c, d theo chuẩn ma trận đề thi tốt nghiệp THPT từ năm 2025):** 11 câu (gồm 44 lệnh hỏi đơn lẻ).

#### Phân bố theo mạch nội dung chuyên đề:
| Phần / Chương | Số câu MCQ | Số câu Đúng/Sai | Tổng số câu | Mã định danh câu hỏi |
| :--- | :---: | :---: | :---: | :--- |
| **Phần 1: Một số vấn đề chung về cách mạng tư sản** | 41 | 6 | 47 | `his_q1` -> `his_q47` |
| **Phần 2: Sự xác lập và phát triển của chủ nghĩa tư bản** | 33 | 0 | 33 | `his_q48` -> `his_q80` |
| **Phần 3: Sự phát triển của CNTB hiện đại (Cơ bản)** | 4 | 0 | 4 | `his_q81` -> `his_q84` |
| **Phần 4: Sự phát triển của CNTB hiện đại (Nâng cao)** | 8 | 0 | 8 | `his_q85` -> `his_q92` |
| **Phần 5: Sự phát triển của CNTB hiện đại (Đúng/Sai)** | 0 | 5 | 5 | `his_q93` -> `his_q97` |
| **TỔNG CỘNG** | **86** | **11** | **97** | `his_q1` -> `his_q97` |

---

### II. CÁC VẤN ĐỀ PHÁT HIỆN VÀ ĐỀ XUẤT HIỆU CHỈNH CHUYÊN MÔN

Trong quá trình đối chiếu độc lập giữa nội dung câu hỏi, dữ liệu gốc (đoạn text có gắn tag `[RED:FF0000]`), và nội dung chuẩn hóa của SGK Lịch Sử 11 GDPT 2018, chúng tôi ghi nhận các vấn đề cụ thể sau:

#### 1. Lỗi kỹ thuật trích xuất văn bản (Parsing Glitch)
- **Câu hỏi `his_q92`:**
  - *Hiện trạng trong file JSON cũ:* Phần nội dung câu hỏi bị cắt cụt do cụm từ viết tắt `CNTB.` có chứa ký tự `B.` khiến thuật toán tách lựa chọn cắt nhầm:
    ```text
    "question": "Khủng hoảng biến đổi khí hậu và cạn kiệt tài nguyên được coi là hệ quả tất yếu của CNT"
    ```
    Đồng thời thứ tự các phương án trong từ điển `options` bị đảo lộn (phương án B xuất hiện trước phương án A).
  - *Hiệu chỉnh trong file verified:* Đã khôi phục toàn vẹn câu hỏi gốc từ trường `raw`:
    ```text
    "question": "Khủng hoảng biến đổi khí hậu và cạn kiệt tài nguyên được coi là hệ quả tất yếu của CNTB. Yếu tố nào trong bản chất của CNTB là nguyên nhân sâu xa nhất dẫn đến sự hủy hoại môi trường toàn cầu?"
    ```
    Đồng thời định dạng và sắp xếp lại các lựa chọn A, B, C, D theo đúng trật tự chuẩn.

#### 2. Vấn đề bất cập về thuật ngữ lịch sử trong đề cương gốc
- **Câu hỏi `his_q10`:**
  - *Nội dung:* *"Trong các cuộc cách mạng tư sản từ giữa thế kỉ XVI đến đầu thế kỉ XX, động lực quyết định thắng lợi của cách mạng là..."*
  - *Các lựa chọn:* A. mục tiêu của cách mạng; B. phương pháp đấu tranh; C. kết quả cuối cùng; D. giai cấp lãnh đạo.
  - *Đáp án đề gốc:* **D (giai cấp lãnh đạo)**.
  - *Phân tích chuyên môn:* 
    + Theo quy chuẩn lý luận và SGK Lịch Sử 11, **"động lực của cách mạng"** là đông đảo quần chúng nhân dân (nông dân, công nhân, thợ thủ công, bình dân thành thị). Còn giai cấp tư sản (hoặc quý tộc mới) là **"lực lượng lãnh đạo"** giữ vai trò định hướng đường lối và quyết định phương hướng thắng lợi.
    + Việc câu hỏi ghép cụm từ *"động lực quyết định thắng lợi"* với đáp án *"giai cấp lãnh đạo"* là một sự bất cập về mặt sử dụng khái niệm của tác giả đề cương gốc. 
    + Trong file verified, đáp án D được giữ nguyên theo đề gốc để đảm bảo tính đồng bộ với barem đề thi, nhưng phần `explanation` đã được biên soạn rất rõ ràng nhằm giúp học sinh phân biệt rạch ròi giữa khái niệm "lực lượng lãnh đạo" (nhân tố quyết định chủ quan) và "động lực cách mạng" (quần chúng nhân dân).

- **Câu hỏi `his_q9`:**
  - *Nội dung:* *"Lê nin nhận định cách mạng tư sản Pháp (1789) là..."*
  - *Các lựa chọn:* A. cách mạng triệt để; B. cách mạng vĩ đại; C. đại cách mạng; D. cách mạng tiêu biểu.
  - *Đáp án đề gốc:* **B (cách mạng vĩ đại)**.
  - *Phân tích chuyên môn:*
    + Câu trích dẫn nổi tiếng của V.I. Lê-nin trong tác phẩm viết về Cách mạng Pháp: *"Cách mạng Pháp xứng đáng là một cuộc đại cách mạng"* (tiếng Nga: *Великая французская революция*). Tùy văn cảnh dịch thuật tiếng Việt, từ "Великая" có thể dịch là "vĩ đại" (cuộc cách mạng vĩ đại) hoặc "đại cách mạng".
    + Cả hai phương án B và C đều có cơ sở dịch thuật. Đề gốc chốt B. Trong lời giải đã ghi chú rõ nguồn gốc luận điểm này của Lê-nin để học sinh không bị băn khoăn giữa phương án B và C.

#### 3. Phân định ranh giới giữa "Đọc hiểu ngữ liệu" và "Kiến thức lịch sử" trong câu Đúng/Sai
- **Câu hỏi `his_q42`, ý c:**
  - *Mệnh đề c:* *"Mâu thuẫn giữa đẳng cấp thứ ba với đẳng cấp tăng lữ và quý tộc ngày càng sâu sắc."*
  - *Đáp án đề gốc:* **Sai (False)** (Trong bản Word gốc, tác giả chỉ tô màu đỏ ở ý a và ý d).
  - *Phân tích chuyên môn:*
    + **Về mặt kiến thức lịch sử:** Đây là một chân lý lịch sử hoàn toàn ĐÚNG. Trước năm 1789, mâu thuẫn giữa Đẳng cấp thứ ba (chịu mọi áp bức, thuế khóa, không có quyền chính trị) với hai đẳng cấp Tăng lữ và Quý tộc (nắm mọi đặc quyền, miễn thuế) là mâu thuẫn đối kháng cốt lõi dẫn đến sự bùng nổ của Cách mạng tư sản Pháp.
    + **Về mặt đọc hiểu ngữ liệu văn bản:** Đoạn trích dẫn của A. Man-phờ-rét trong đề bài chỉ tập trung mô tả vương quyền chuyên chế và các mật lệnh bắt bớ, đày ải nhân dân của cá nhân vua Lu-I XVI, hoàn toàn không nhắc tới thiết chế ba đẳng cấp. Do đó, nếu câu hỏi được thiết kế theo dạng thuần túy đọc hiểu văn bản thì ý này không được xác thực từ đoạn trích.
    + Lời giải trong `history_chude1_verified.json` đã giải thích thỏa đáng cả hai khía cạnh để giáo viên và học sinh khi sử dụng bộ đề có thể linh hoạt vận dụng.

---

### III. BỔ SUNG LỜI GIẢI CHI TIẾT (EXPLANATIONS)

Trong sản phẩm chuẩn hóa `history_chude1_verified.json`:
1. **100% câu hỏi MCQ (86 câu)** đều có trường `explanation` đạt các tiêu chí:
   - Khẳng định rõ đáp án đúng.
   - Trích dẫn trọng tâm kiến thức lịch sử tương ứng trong SGK Lịch Sử 11 (bộ 2018).
   - Chỉ rõ điểm sai của các phương án nhiễu, giúp học sinh rèn luyện tư duy phản biện và ghi nhớ kiến thức cốt lõi.
2. **100% câu hỏi Đúng/Sai (11 câu)** được xây dựng hệ thống giải thích kép:
   - Cấp độ câu hỏi: Trường `explanation` khái quát bối cảnh lịch sử và ý nghĩa của toàn bộ đoạn tư liệu nguồn.
   - Cấp độ từng mệnh đề (a, b, c, d): Mỗi item đều có trường `explanation` riêng biệt, giải thích cặn kẽ vì sao mệnh đề đó Đúng (True) hoặc Sai (False) dựa trên cả ngữ liệu đọc hiểu và kiến thức SGK.

---

### IV. ĐÁNH GIÁ CHẤT LƯỢNG CHUYÊN MÔN VÀ KHUYẾN NGHỊ SỬ DỤNG

1. **Về độ phủ kiến thức:**
   - Bộ câu hỏi bao quát toàn diện các nội dung trọng tâm của Chủ đề 1: Tiền đề bùng nổ, mục tiêu, nhiệm vụ, động lực, kết quả và ý nghĩa của các cuộc CMTS tiêu biểu (Anh, Bắc Mĩ, Pháp, Hà Lan); sự xác lập của CNTB ở châu Âu - Bắc Mĩ; sự mở rộng sang châu Á (Nhật Bản, Trung Quốc); giai đoạn CNTB độc quyền và đặc biệt là hệ thống câu hỏi chuyên sâu về Chủ nghĩa tư bản hiện đại.
2. **Về tính phân hóa:**
   - Các câu hỏi thuộc Phần 4 và Phần 5 (từ câu 81 đến 97) có chất lượng chuyên môn rất cao, đào sâu vào bản chất kinh tế - chính trị (giá trị thặng dư trong kinh tế tri thức, mâu thuẫn xã hội hóa - chiếm hữu tư nhân, vai trò của Nhà nước Phúc lợi, khủng hoảng chu kì, tác động hai mặt của toàn cầu hóa). Đây là những câu hỏi phân hóa đạt cấp độ Vận dụng và Vận dụng cao, rất phù hợp cho việc ôn luyện thi học sinh giỏi và kỳ thi Tốt nghiệp THPT theo định hướng đánh giá năng lực từ năm 2025.
3. **Kết luận:**
   - Bộ dữ liệu `history_chude1_verified.json` đã đạt độ chuẩn xác khoa học, tính sư phạm cao, cấu trúc JSON chuẩn mực, sẵn sàng tích hợp vào các nền tảng kiểm tra trực tuyến, ôn luyện trắc nghiệm hoặc in ấn làm tài liệu giảng dạy chính thức.
