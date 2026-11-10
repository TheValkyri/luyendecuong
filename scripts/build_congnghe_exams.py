import json
import os
import re

def create_question(q_id, number, section, q_type, points, stem, options=None, statements=None, correct_opt=None, stmt_answers=None, explanation=""):
    q = {
        "id": q_id,
        "number": number,
        "section": section,
        "type": q_type,
        "cognitive_level": "comprehension",
        "points": points,
        "stem": stem,
        "stem_blocks": [
            {
                "block_id": f"{q_id}_blk_1",
                "order_index": 0,
                "type": "paragraph",
                "content": stem
            }
        ],
        "formulas": [],
        "explanation": explanation,
        "validation": {
            "confidence": 1.0,
            "needs_review": False,
            "verified_by_human": True,
            "critical_errors": [],
            "warnings": []
        }
    }
    
    if q_type == "single_choice" and options:
        opt_objs = []
        for idx, (label, text) in enumerate(options):
            opt_objs.append({
                "id": f"{q_id}_opt_{label}",
                "label": label,
                "content": text
            })
        q["options"] = opt_objs
        q["answer_key"] = {
            "question_type": "single_choice",
            "correct_option_id": f"{q_id}_opt_{correct_opt}"
        }
    elif q_type == "true_false_cluster" and statements:
        stmt_objs = []
        stmt_map = {}
        for label, text, is_true in statements:
            s_id = f"{q_id}_stmt_{label}"
            stmt_objs.append({
                "id": s_id,
                "label": label,
                "content": text
            })
            stmt_map[s_id] = is_true
        q["statements"] = stmt_objs
        q["answer_key"] = {
            "question_type": "true_false_cluster",
            "statement_answers": stmt_map
        }
        
    return q

def build_cong_nghe_exams():
    os.makedirs("data", exist_ok=True)
    all_questions = []
    
    # ----------------------------------------------------
    # BÀI 1: KHÁI QUÁT VỀ CƠ KHÍ CHẾ TẠO
    # ----------------------------------------------------
    sec1 = "Bài 1: Khái quát về cơ khí chế tạo"
    b1_mcq = [
        (1, "Cơ khí chế tạo là ngành kỹ thuật công nghệ sử dụng các kiến thức toán học, nguyên lí vật lí và kết quả của ngành nào để thực hiện các quá trình thiết kế, chế tạo, vận hành, bảo dưỡng máy móc thiết bị?",
         [("A", "Khai thác quặng kim loại"), ("B", "Công nghệ vật liệu"), ("C", "Đúc kim loại"), ("D", "Gia công áp lực")],
         "B", "Cơ khí chế tạo dựa trên kiến thức toán học, nguyên lí vật lí và kết quả nghiên cứu của công nghệ vật liệu."),
        (2, "Đâu KHÔNG phải là vai trò trực tiếp của ngành cơ khí chế tạo?",
         [("A", "Chế tạo công cụ lao động cho các ngành nghề"), ("B", "Chế tạo đồ dùng, dụng cụ sinh hoạt gia đình"), ("C", "Chế tạo linh kiện vi mạch điện tử bán dẫn"), ("D", "Chế tạo máy móc, thiết bị sản xuất")],
         "C", "Chế tạo linh kiện vi mạch điện tử bán dẫn thuộc lĩnh vực công nghiệp điện tử - viễn thông."),
        (3, "Đối tượng lao động chủ yếu của ngành cơ khí chế tạo là gì?",
         [("A", "Các máy móc công cụ gia công"), ("B", "Vật liệu cơ khí (kim loại, hợp kim, phi kim, vật liệu mới)"), ("C", "Các loại dao cắt gọt kim loại"), ("D", "Đội ngũ thợ và kỹ sư cơ khí")],
         "B", "Đối tượng lao động của cơ khí chế tạo là các vật liệu cơ khí được dùng để tạo ra sản phẩm."),
        (4, "Sản phẩm của ngành cơ khí chế tạo bao gồm những gì?",
         [("A", "Các công trình kiến trúc kết cấu thép"), ("B", "Các loại máy móc thiết bị sản xuất"), ("C", "Các phương tiện giao thông vận tải"), ("D", "Tất cả các sản phẩm trên")],
         "D", "Sản phẩm cơ khí bao gồm công trình, máy móc, phương tiện giao thông và thiết bị sinh hoạt."),
        (5, "Đâu là các công việc chính trong ngành cơ khí chế tạo?",
         [("A", "Thiết kế cơ khí"), ("B", "Gia công cắt gọt kim loại"), ("C", "Lắp ráp cơ khí"), ("D", "Cả 3 công việc trên")],
         "D", "Các công việc cơ khí chế tạo gồm thiết kế, gia công, lắp ráp và bảo dưỡng sửa chữa."),
        (6, "Vai trò nổi bật của cơ khí chế tạo đối với đời sống con người là gì?",
         [("A", "Chế tạo công cụ, máy móc giúp lao động nhẹ nhàng, nâng cao năng suất"), ("B", "Tạo ra đồ dùng tiện nghi, nâng cao chất lượng cuộc sống"), ("C", "Chế tạo thiết bị phục vụ nghiên cứu và chinh phục không gian"), ("D", "Cả A, B và C đều đúng")],
         "D", "Cơ khí chế tạo phục vụ sản xuất, đời sống và khoa học công nghệ."),
        (7, "Ngành cơ khí chế tạo được định nghĩa là ngành nghề:",
         [("A", "Chỉ thiết kế các loại máy móc và đồ dùng"), ("B", "Thiết kế, chế tạo, vận hành, bảo dưỡng, sửa chữa máy móc thiết bị"), ("C", "Xây dựng các công trình kiến trúc"), ("D", "Chăn nuôi và chế biến thực phẩm")],
         "B", "Định nghĩa chuẩn của ngành cơ khí chế tạo."),
        (8, "Sản phẩm cơ khí chế tạo nào sau đây giúp nâng cao chất lượng tiện nghi trong gia đình?",
         [("A", "Máy thêu công nghiệp"), ("B", "Máy khai thác khoáng sản"), ("C", "Máy điều hòa không khí"), ("D", "Máy thi công cầu đường")],
         "C", "Máy điều hòa là thiết bị cơ điện lạnh gia dụng nâng cao tiện nghi."),
        (9, "Đâu KHÔNG phải là sản phẩm trực tiếp của cơ khí chế tạo?",
         [("A", "Nhà xưởng khung thép"), ("B", "Trung tâm thương mại tổng hợp"), ("C", "Tàu thủy chở hàng"), ("D", "Máy bơm nước tưới tiêu")],
         "B", "Trung tâm thương mại là công trình xây dựng - dịch vụ."),
        (10, "Sản phẩm nào dưới đây là sản phẩm tiêu biểu của ngành cơ khí chế tạo?",
         [("A", "Ô tô, xe máy"), ("B", "Máy giặt, quạt gió"), ("C", "Giàn khoan dầu khí"), ("D", "Tất cả các sản phẩm trên")],
         "D", "Tất cả đều là sản phẩm của ngành cơ khí chế tạo."),
        (11, "Đâu KHÔNG phải là đặc điểm của ngành cơ khí chế tạo?",
         [("A", "Đối tượng lao động là vật liệu cơ khí kim loại, phi kim loại"), ("B", "Công cụ lao động là máy tiện, phay, bào, hàn, gia công"), ("C", "Hồ sơ kỹ thuật sản xuất gồm bản vẽ kỹ thuật và quy trình công nghệ"), ("D", "Sản phẩm cơ khí không phổ biến và chỉ dùng trong phạm vi hẹp")],
         "D", "Sản phẩm cơ khí có mặt khắp nơi trong đời sống và sản xuất."),
        (12, "Bản vẽ kĩ thuật có vai trò gì trong quá trình chế tạo cơ khí?",
         [("A", "Căn cứ thiết kế, bảo đảm yêu cầu kỹ thuật cho quá trình chế tạo"), ("B", "Giúp người sử dụng vận hành và bảo trì máy móc đúng cách"), ("C", "Cung cấp đầy đủ thông tin kích thước, dung sai cho gia công lắp ráp"), ("D", "Cả 3 đáp án trên")],
         "D", "Bản vẽ kỹ thuật là ngôn ngữ chung xuyên suốt từ thiết kế, chế tạo đến sử dụng."),
        (13, "Đặc điểm quan trọng giúp phân biệt cơ khí chế tạo với các ngành nghề khác là gì?",
         [("A", "Sử dụng bản vẽ kĩ thuật trong suốt quá trình chế tạo"), ("B", "Mọi thiết bị sản xuất chỉ dùng máy tính"), ("C", "Vật liệu chế tạo chỉ dùng gỗ tự nhiên"), ("D", "Quy trình làm việc tùy tiện, không cần tiêu chuẩn")],
         "A", "Sử dụng bản vẽ kỹ thuật là ngôn ngữ đặc trưng của ngành cơ khí chế tạo."),
        (14, "Cơ khí chế tạo đóng vai trò thúc đẩy các ngành kinh tế khác phát triển vì:",
         [("A", "Cung cấp toàn bộ máy móc, công cụ phục vụ đời sống"), ("B", "Cung cấp máy móc, trang thiết bị kỹ thuật cho mọi ngành kinh tế"), ("C", "Nâng cao năng suất và hiệu quả kỹ thuật cho toàn bộ xã hội"), ("D", "Cả 3 lý do trên")],
         "D", "Cơ khí chế tạo là ngành công nghiệp xương sống."),
        (15, "Việc sử dụng các sản phẩm cơ khí chế tạo trong sản xuất mang lại điều gì?",
         [("A", "Giảm nhẹ sức lao động cơ bắp của con người"), ("B", "Tăng năng suất và độ chính xác gia công"), ("C", "Tiết kiệm nguyên vật liệu và năng lượng"), ("D", "Cả 3 đáp án trên")],
         "D", "Cơ khí hóa giúp giải phóng sức lao động và tăng năng suất."),
        (16, "Việc thiết kế cơ khí thường do chức danh nào sau đây đảm nhận?",
         [("A", "Kĩ sư cơ khí"), ("B", "Kĩ sư hóa học"), ("C", "Thợ hàn áp lực"), ("D", "Thợ điện dân dụng")],
         "A", "Kỹ sư cơ khí được đào tạo chuyên sâu về thiết kế và tính toán cơ học."),
        (17, "Lí do vật liệu kim loại và hợp kim trở thành vật liệu chế tạo cơ khí chủ yếu là:",
         [("A", "Có tính gia công tốt (đúc, hàn, cắt gọt)"), ("B", "Độ cứng và độ bền cao"), ("C", "Độ bền nhiệt và khả năng chịu tải vượt trội"), ("D", "Cả 3 đáp án trên")],
         "D", "Kim loại và hợp kim hội tụ đầy đủ cơ tính và tính công nghệ."),
        (18, "Tại sao người tham gia sản xuất cơ khí cần phải tuân thủ nghiêm ngặt quy trình thiết kế?",
         [("A", "Để bảo đảm tính kĩ thuật và độ chính xác của sản phẩm"), ("B", "Để bảo đảm tính an toàn lao động và tuổi thọ máy móc"), ("C", "Để bảo đảm hiệu quả kinh tế và tính thẩm mỹ"), ("D", "Cả 3 đáp án trên")],
         "D", "Tuân thủ quy trình bảo đảm chất lượng, an toàn và hiệu quả."),
        (19, "Sắp xếp các bước đúng theo quy trình chế tạo cơ khí thông thường:",
         [("A", "1. Đọc bản vẽ chi tiết -> 2. Chế tạo phôi -> 3. Gia công chi tiết máy -> 4. Xử lí bề mặt -> 5. Lắp ráp và kiểm tra"),
          ("B", "1. Chế tạo phôi -> 2. Đọc bản vẽ chi tiết -> 3. Xử lí bề mặt -> 4. Gia công chi tiết -> 5. Lắp ráp"),
          ("C", "1. Gia công chi tiết -> 2. Chế tạo phôi -> 3. Đọc bản vẽ -> 4. Lắp ráp -> 5. Xử lí bề mặt"),
          ("D", "1. Lắp ráp -> 2. Kiểm tra -> 3. Chế tạo phôi -> 4. Gia công chi tiết -> 5. Đọc bản vẽ")],
         "A", "Quy trình: Đọc bản vẽ -> Chế tạo phôi -> Gia công cắt gọt -> Xử lý bề mặt -> Lắp ráp và kiểm tra."),
        (20, "Trong quy trình chế tạo cơ khí, bước nào quyết định trực tiếp việc tạo hình và độ chính xác chi tiết máy?",
         [("A", "Đọc bản vẽ chi tiết"), ("B", "Chế tạo phôi"), ("C", "Thực hiện gia công các chi tiết máy (tiện, phay, mài,...)"), ("D", "Xử lí và bảo vệ bề mặt")],
         "C", "Gia công cắt gọt tạo nên hình dáng, kích thước và độ nhẵn bóng chính xác."),
        (21, "Bước lập quy trình công nghệ gia công, chọn thiết bị, dụng cụ và chế độ cắt thuộc giai đoạn nào?",
         [("A", "Đọc và phân tích bản vẽ kỹ thuật chi tiết"), ("B", "Chế tạo phôi thô"), ("C", "Xử lí và bảo vệ bề mặt"), ("D", "Gia công các chi tiết máy")],
         "D", "Chuẩn bị công nghệ gia công chi tiết."),
        (22, "Cho các phát biểu sau: (1) Sản phẩm cơ khí có thể là máy móc, công trình, đồ dùng gia đình; (2) Quá trình sản xuất cơ khí rất đơn giản, không cần quy trình; (3) Sản phẩm cơ khí có mặt khắp nơi trong đời sống; (4) Kĩ sư cơ khí là người được đào tạo lắp ráp tại cơ sở chuyên nghiệp; (5) Tháp Eiffel là một sản phẩm cơ khí kết cấu thép. Có bao nhiêu phát biểu đúng?",
         [("A", "1"), ("B", "2"), ("C", "3"), ("D", "4")],
         "D", "Các phát biểu (1), (3), (4), (5) đúng. Phát biểu (2) sai vì cơ khí đòi hỏi quy trình công nghệ nghiêm ngặt.")
    ]
    
    for num, stem, opts, ans, exp in b1_mcq:
        all_questions.append(create_question(f"cn11_b1_mcq_{num:02d}", len(all_questions) + 1, sec1, "single_choice", 0.25, stem, options=opts, correct_opt=ans, explanation=exp))
        
    b1_tf = [
        (1, "Khi nói về vai trò của cơ khí chế tạo, phát biểu nào sau đây đúng hay sai?",
         [("a", "Chế tạo ra các công cụ, máy móc giúp cho lao động trở nên nhẹ nhàng hơn.", True),
          ("b", "Chế tạo ra các thiết bị, máy để nghiên cứu, chinh phục vũ trụ.", True),
          ("c", "Chế tạo ra các hợp chất hoá học để thay đổi tính chất vật liệu cơ khí.", False),
          ("d", "Chế tạo dây dẫn điện phục vụ cho ngành điện lực, viễn thông.", False)],
         "Ngành cơ khí chế tạo cơ khí, không chế tạo hóa chất tổng hợp hay sản xuất cáp điện lực viễn thông."),
        (2, "Phát biểu nào sau đây đúng hay sai khi nói về đặc điểm của ngành cơ khí chế tạo?",
         [("a", "Đối tượng lao động của ngành cơ khí chế tạo là thợ hoặc kỹ sư ngành cơ khí.", False),
          ("b", "Công cụ lao động là các máy công cụ như máy tiện, máy phay, máy bào, máy hàn,...", True),
          ("c", "Trong quá trình sản xuất ra sản phẩm không cần có hồ sơ kỹ thuật.", False),
          ("d", "Các sản phẩm của cơ khí rất phổ biến, có mặt trong tất cả các lĩnh vực đời sống.", True)],
         "Đối tượng lao động là vật liệu cơ khí (không phải con người). Sản xuất cơ khí bắt buộc phải có hồ sơ kỹ thuật.")
    ]
    for num, stem, stmts, exp in b1_tf:
        all_questions.append(create_question(f"cn11_b1_tf_{num:02d}", len(all_questions) + 1, sec1, "true_false_cluster", 1.0, stem, statements=stmts, explanation=exp))

    # ----------------------------------------------------
    # BÀI 2: NGÀNH NGHỀ TRONG LĨNH VỰC CƠ KHÍ CHẾ TẠO
    # ----------------------------------------------------
    sec2 = "Bài 2: Ngành nghề trong lĩnh vực cơ khí chế tạo"
    b2_mcq = [
        (1, "Ngành nghề trong lĩnh vực cơ khí chế tạo gắn liền với những nhóm công việc chủ yếu nào?",
         [("A", "Thiết kế sản phẩm cơ khí, gia công cơ khí, lắp ráp sản phẩm cơ khí, bảo dưỡng sửa chữa thiết bị cơ khí"),
          ("B", "Nghiên cứu thị trường, tìm kiếm khách hàng, vận hành máy phát điện"),
          ("C", "Khai thác dầu khí, lọc hóa dầu, vận chuyển nguyên liệu khoáng sản"),
          ("D", "Thiết kế vi mạch máy tính, lập trình phần mềm hệ thống mạng")],
         "A", "4 nhóm công việc nền tảng của cơ khí: Thiết kế, Gia công, Lắp ráp, Bảo dưỡng & Sửa chữa."),
        (2, "Công việc chính của người làm nhiệm vụ thiết kế sản phẩm cơ khí là gì?",
         [("A", "Nghiên cứu, ứng dụng kiến thức toán học, khoa học, kỹ thuật vào chọn vật liệu, thiết kế chi tiết máy đạt yêu cầu kinh tế - kỹ thuật"),
          ("B", "Vận hành máy tiện, máy phay để cắt gọt kim loại"),
          ("C", "Lắp ráp các linh kiện thành cụm máy hoàn chỉnh"),
          ("D", "Sơn phủ bảo vệ và kiểm tra đóng gói xuất xưởng")],
         "A", "Thiết kế cơ khí là quá trình nghiên cứu, tính toán, dựng mô hình và lập bản vẽ chi tiết."),
        (3, "Công việc chính của người thực hiện gia công cơ khí là gì?",
         [("A", "Dựng bản vẽ phối cảnh và phân tích thị trường"),
          ("B", "Sử dụng máy móc, công cụ, công nghệ (tiện, phay, bào, hàn, rèn, dập) để tạo ra các chi tiết máy từ phôi"),
          ("C", "Lắp các chi tiết máy thành sản phẩm hoàn chỉnh"),
          ("D", "Kiểm định chất lượng sau bảo dưỡng")],
         "B", "Gia công cơ khí là quá trình gia công biến phôi thành chi tiết có kích thước và hình dáng yêu cầu."),
        (4, "Công việc chính của người làm nhiệm vụ lắp ráp sản phẩm cơ khí là gì?",
         [("A", "Nghiên cứu lý thuyết vật liệu và toán ứng dụng"),
          ("B", "Gia công cắt gọt các phôi tấm"),
          ("C", "Dựa vào bản vẽ để thiết kế quy trình lắp ráp, liên kết các chi tiết thành cụm máy hoặc sản phẩm hoàn chỉnh"),
          ("D", "Bôi trơn dầu mỡ định kì cho thiết bị")],
         "C", "Lắp ráp là tổ hợp các chi tiết máy thành thiết bị hoàn chỉnh theo bản vẽ lắp."),
        (5, "Công việc chính của bộ phận bảo dưỡng, sửa chữa thiết bị cơ khí là gì?",
         [("A", "Thiết kế bản vẽ sơ đồ động học máy"),
          ("B", "Chăm sóc, kiểm tra, chẩn đoán trạng thái kỹ thuật, ngăn ngừa sự cố, sửa chữa hư hỏng nhằm duy trì sự hoạt động ổn định của máy móc"),
          ("C", "Chế tạo khuôn đúc và khuôn rèn dập"),
          ("D", "Đo đạc kiểm tra phôi kim loại")],
         "B", "Bảo dưỡng sửa chữa nhằm duy trì độ tin cậy, an toàn và tuổi thọ làm việc của thiết bị."),
        (6, "Nghề nghiệp nào sau đây thường thực hiện công việc thiết kế sản phẩm cơ khí?",
         [("A", "Kĩ sư cơ khí, kĩ sư cơ điện tử làm việc tại phòng kĩ thuật, R&D"),
          ("B", "Kĩ sư điện lực làm việc tại trạm biến áp"),
          ("C", "Thợ hàn áp lực làm việc tại công trường"),
          ("D", "Thợ tiện làm việc tại xưởng máy công cụ")],
         "A", "Kỹ sư cơ khí, kỹ sư cơ điện tử phụ trách thiết kế sản phẩm."),
        (7, "Nghề nghiệp nào sau đây thực hiện công việc gia công cơ khí?",
         [("A", "Thợ tiện, thợ phay, thợ mài, thợ hàn, thợ rèn dập"),
          ("B", "Kĩ sư quản trị kinh doanh xuất nhập khẩu"),
          ("C", "Chuyên viên pháp chế doanh nghiệp"),
          ("D", "Kĩ sư trắc địa địa chất")],
         "A", "Thợ cơ khí chuyên môn hóa theo các phương pháp gia công: tiện, phay, hàn,..."),
        (8, "Nhiệm vụ của người làm công tác bảo dưỡng, sửa chữa thiết bị cơ khí đòi hỏi phải:",
         [("A", "Nắm vững nguyên lí hoạt động, cấu tạo máy, chẩn đoán được hư hỏng và thay thế chi tiết hỏng"),
          ("B", "Chỉ cần biết lau chùi bên ngoài máy"),
          ("C", "Thiết kế ra các cỗ máy hoàn toàn mới"),
          ("D", "Quảng cáo bán máy cho khách hàng")],
         "A", "Bảo dưỡng sửa chữa đòi hỏi hiểu sâu về kết cấu, cơ cấu động học và hệ thống bôi trơn, truyền động."),
        (9, "Nghề nghiệp nào sau đây KHÔNG thuộc nhóm công việc gia công cơ khí?",
         [("A", "Thợ cắt gọt kim loại (tiện, phay)"), ("B", "Thợ hàn kim loại"), ("C", "Thợ mỏ khai khoáng"), ("D", "Thợ rèn dập nóng")],
         "C", "Thợ mỏ thuộc ngành công nghiệp khai khoáng."),
        (10, "Mục đích quan trọng nhất của công tác bảo dưỡng định kỳ thiết bị cơ khí là:",
         [("A", "Kéo dài tuổi thọ của máy móc và ngăn ngừa tai nạn, hỏng hóc đột xuất"),
          ("B", "Thay đổi hoàn toàn công năng của máy móc"),
          ("C", "Giúp máy móc có giá trị bán lại cao hơn"),
          ("D", "Làm đẹp hình thức bên ngoài của nhà xưởng")],
         "A", "Bảo dưỡng định kỳ duy trì trạng thái làm việc tốt nhất và tránh gián đoạn sản xuất."),
        (11, "Người thiết kế, chế tạo, thử nghiệm, vận hành và quản lý hệ thống máy móc được gọi là:",
         [("A", "Kĩ sư xây dựng dân dụng"), ("B", "Kĩ sư cơ khí"), ("C", "Kĩ sư điện gia dụng"), ("D", "Kĩ thuật viên tin học")],
         "B", "Kỹ sư cơ khí đảm nhận toàn diện từ thiết kế đến quản lý công nghệ."),
        (12, "Người thực hiện việc gia công cắt gọt kim loại trên máy công cụ cần được đào tạo trình độ:",
         [("A", "Công nhân kỹ thuật hoặc trung cấp nghề cơ khí chế tạo"),
          ("B", "Bác sĩ chuyên khoa kỹ thuật"),
          ("C", "Thạc sĩ triết học kỹ thuật"),
          ("D", "Cử nhân luật kinh tế")],
         "A", "Công nhân kỹ thuật hoặc thợ cơ khí được đào tạo nghề thực hành bài bản."),
        (13, "Thiết bị phần mềm hỗ trợ nào hiện nay được các kỹ sư cơ khí sử dụng phổ biến nhất trong thiết kế?",
         [("A", "Phần mềm đồ họa 3D CAD/CAM (SolidWorks, AutoCAD, Inventor, NX)"),
          ("B", "Phần mềm gõ văn bản thông thường Word"),
          ("C", "Phần mềm bảng tính kế toán Excel"),
          ("D", "Phần mềm nghe nhạc đa phương tiện")],
         "A", "CAD/CAM là công cụ không thể thiếu của kỹ sư thiết kế cơ khí hiện đại."),
        (14, "Môi trường làm việc chủ yếu của thợ lắp ráp cơ khí là:",
         [("A", "Phân xưởng sản xuất, lắp ráp của nhà máy, xí nghiệp chế tạo"),
          ("B", "Phòng thu âm phát thanh"),
          ("C", "Ngân hàng thương mại"),
          ("D", "Vườn ươm giống nông nghiệp")],
         "A", "Lắp ráp cơ khí diễn ra tại dây chuyền, phân xưởng lắp ráp."),
        (15, "Công việc 'Kiểm tra độ rơ của ổ trục và bổ sung dầu mỡ bôi trơn cho máy tiện định kỳ' thuộc về nhóm nghề nào?",
         [("A", "Thiết kế sản phẩm cơ khí"), ("B", "Bảo dưỡng, sửa chữa thiết bị cơ khí"), ("C", "Gia công đúc chi tiết"), ("D", "Kiểm toán tài chính cơ khí")],
         "B", "Đây là công việc đặc trưng của bảo dưỡng thiết bị cơ khí."),
        (16, "Công việc 'Sử dụng máy phay CNC để gia công rãnh then trên trục động cơ' thuộc về nhóm nghề nào?",
         [("A", "Gia công cơ khí"), ("B", "Thiết kế bao bì cơ khí"), ("C", "Lắp ráp đóng gói"), ("D", "Vận tải cơ khí")],
         "A", "Gia công cơ khí bằng máy cắt gọt CNC."),
        (17, "Công việc 'Ghép nối trục khuỷu, piston và thanh truyền vào thân động cơ theo đúng khe hở kỹ thuật' thuộc về nhóm nghề nào?",
         [("A", "Lắp ráp sản phẩm cơ khí"), ("B", "Rèn phôi dập nóng"), ("C", "Gia công tia lửa điện"), ("D", "Thiết kế mẫu")],
         "A", "Tổ hợp các chi tiết thành cụm máy là công việc lắp ráp."),
        (18, "Phẩm chất quan trọng hàng đầu của người làm việc trong ngành cơ khí chế tạo là:",
         [("A", "Tính cẩn thận, tỉ mỉ, tuân thủ kỷ luật an toàn lao động và quy chuẩn kỹ thuật"),
          ("B", "Thích làm việc tự do, không theo bản vẽ"),
          ("C", "Chỉ chú trọng tốc độ, bỏ qua dung sai kích thước"),
          ("D", "Không cần kiến thức toán học")],
         "A", "Cơ khí đòi hỏi độ chính xác milimet và an toàn tuyệt đối."),
        (19, "Ngành cơ điện tử (Mechatronics) là ngành giao thoa giữa cơ khí chế tạo với các ngành nào?",
         [("A", "Điện tử, tự động hóa và công nghệ thông tin"),
          ("B", "Văn học và ngôn ngữ học"),
          ("C", "Sinh học phân tử và dược phẩm"),
          ("D", "Khai khoáng và địa chất")],
         "A", "Cơ điện tử kết hợp cơ khí chính xác, điều khiển điện tử và lập trình thông minh."),
        (20, "Để làm việc tốt ở vị trí kỹ sư thiết kế cơ khí, ngoài kiến thức chuyên môn cần có kỹ năng nào?",
         [("A", "Đọc hiểu bản vẽ, tư duy không gian 3D, sử dụng phần mềm CAD và ngoại ngữ chuyên ngành"),
          ("B", "Kỹ năng pha chế đồ uống"),
          ("C", "Kỹ năng trồng hoa cây cảnh"),
          ("D", "Kỹ năng may mặc trang phục")],
         "A", "Kỹ sư thiết kế cần tư duy hình học không gian, thành thạo CAD và đọc tài liệu kỹ thuật.")
    ]
    for num, stem, opts, ans, exp in b2_mcq:
        all_questions.append(create_question(f"cn11_b2_mcq_{num:02d}", len(all_questions) + 1, sec2, "single_choice", 0.25, stem, options=opts, correct_opt=ans, explanation=exp))

    b2_tf = [
        (1, "Khi nói về các nhóm công việc trong lĩnh vực cơ khí chế tạo, phát biểu sau đúng hay sai?",
         [("a", "Thiết kế sản phẩm cơ khí sử dụng phần mềm CAD như AutoCAD, SolidWorks để mô phỏng và lập bản vẽ.", True),
          ("b", "Người thực hiện gia công cơ khí chỉ cần làm việc tại văn phòng điều hòa, không cần tiếp xúc với máy công cụ.", False),
          ("c", "Kỹ sư cơ khí có thể đảm nhận vai trò thiết kế, quản lý chất lượng và giám sát quy trình sản xuất.", True),
          ("d", "Lắp ráp cơ khí là công đoạn đầu tiên trước khi chế tạo phôi và gia công chi tiết.", False)],
         "Gia công tiếp xúc trực tiếp với máy móc tại xưởng. Lắp ráp là công đoạn sau khi các chi tiết đã được gia công hoàn chỉnh."),
        (2, "Khi nói về nhóm nghề bảo dưỡng và sửa chữa thiết bị cơ khí, phát biểu sau đúng hay sai?",
         [("a", "Bảo dưỡng cơ khí bao gồm kiểm tra độ mài mòn, bôi trơn, siết chặt và căn chỉnh máy.", True),
          ("b", "Sửa chữa thiết bị chỉ tiến hành khi máy móc đã hỏng hoàn toàn và ngừng hoạt động vĩnh viễn.", False),
          ("c", "Người bảo dưỡng cần có kỹ năng chẩn đoán lỗi, đọc sơ đồ mạch thủy lực và khí nén.", True),
          ("d", "Mục tiêu của bảo dưỡng là nâng cao độ tin cậy và hạn chế tối đa thời gian dừng máy ngoài kế hoạch.", True)],
         "Bảo dưỡng phòng ngừa giúp phát hiện lỗi trước khi máy hỏng nặng."),
        (3, "Khi nói về yêu cầu đối với người lao động ngành cơ khí chế tạo, phát biểu sau đúng hay sai?",
         [("a", "Cần có sức khỏe tốt, tác phong công nghiệp và ý thức tuân thủ quy định bảo hộ lao động.", True),
          ("b", "Không cần hiểu biết về dung sai lắp ghép và tiêu chuẩn kỹ thuật nhà nước.", False),
          ("c", "Cần có khả năng làm việc nhóm và kỹ năng giải quyết sự cố kỹ thuật.", True),
          ("d", "Người lao động được phép tự ý thay đổi kết cấu máy móc mà không cần phê duyệt của kỹ sư thiết kế.", False)],
         "Dung sai và tiêu chuẩn là bắt buộc. Mọi thay đổi kết cấu phải được thẩm định kỹ thuật.")
    ]
    for num, stem, stmts, exp in b2_tf:
        all_questions.append(create_question(f"cn11_b2_tf_{num:02d}", len(all_questions) + 1, sec2, "true_false_cluster", 1.0, stem, statements=stmts, explanation=exp))

    # ----------------------------------------------------
    # BÀI 3: TỔNG QUAN VỀ VẬT LIỆU CƠ KHÍ
    # ----------------------------------------------------
    sec3 = "Bài 3: Tổng quan về vật liệu cơ khí"
    b3_mcq = [
        (1, "Vật liệu cơ khí là gì?",
         [("A", "Các loại vật liệu được sử dụng trong ngành cơ khí để tạo nên các sản phẩm cơ khí"),
          ("B", "Tất cả các chất rắn có trong tự nhiên"),
          ("C", "Các loại nhiên liệu dùng để đốt lò nung"),
          ("D", "Các loại hóa chất tẩy rửa bề mặt")],
         "A", "Vật liệu cơ khí là vật liệu được dùng trong sản xuất cơ khí."),
        (2, "Vật liệu cơ khí cần đáp ứng những yêu cầu cơ bản nào?",
         [("A", "Yêu cầu về tính sử dụng, tính công nghệ và tính kinh tế"),
          ("B", "Chỉ cần tính thẩm mỹ"),
          ("C", "Chỉ cần giá rẻ nhất"),
          ("D", "Chỉ cần nặng nhất có thể")],
         "A", "3 nhóm yêu cầu trụ cột: Tính sử dụng, Tính công nghệ, Tính kinh tế."),
        (3, "Căn cứ vào cấu tạo và tính chất, vật liệu cơ khí được chia làm mấy nhóm chính?",
         [("A", "2 nhóm"), ("B", "3 nhóm"), ("C", "4 nhóm"), ("D", "5 nhóm")],
         "B", "3 nhóm: Kim loại & hợp kim; Phi kim loại; Vật liệu mới."),
        (4, "Căn cứ vào cấu tạo và tính chất, vật liệu cơ khí được chia thành 3 nhóm cụ thể là:",
         [("A", "Vật liệu kim loại & hợp kim, vật liệu phi kim loại, vật liệu mới"),
          ("B", "Vật liệu kim loại, vật liệu hữu cơ, vật liệu khoáng sản"),
          ("C", "Vật liệu rắn, vật liệu lỏng, vật liệu khí"),
          ("D", "Vật liệu tự nhiên, vật liệu nhân tạo, vật liệu tái sinh")],
         "A", "Phân loại chuẩn theo chương trình GDPT 2018."),
        (5, "Nhóm vật liệu nào hiện nay vẫn là vật liệu được sử dụng chủ yếu nhất trong sản xuất cơ khí?",
         [("A", "Vật liệu kim loại và hợp kim"), ("B", "Vật liệu phi kim loại"), ("C", "Vật liệu mới"), ("D", "Vật liệu composite")],
         "A", "Kim loại và hợp kim chiếm tỉ trọng lớn nhất trong kết cấu máy móc."),
        (6, "Độ bền của vật liệu cơ khí là gì?",
         [("A", "Khả năng chống lại tác dụng của ngoại lực mà không bị phá hủy"),
          ("B", "Khả năng bị biến dạng khi đun nóng"),
          ("C", "Khả năng truyền nhiệt nhanh chóng"),
          ("D", "Khả năng không bị gỉ sét trong nước")],
         "A", "Độ bền đặc trưng cho khả năng chịu tải trọng phá hủy của vật liệu."),
        (7, "Độ dẻo của vật liệu cơ khí thể hiện qua khả năng nào?",
         [("A", "Khả năng bị biến dạng dẻo dưới tác dụng của ngoại lực mà không bị nứt, vỡ"),
          ("B", "Khả năng chống lại sự mài mòn"),
          ("C", "Khả năng hút ẩm từ không khí"),
          ("D", "Khả năng dẫn điện tốt")],
         "A", "Độ dẻo cho phép vật liệu dát mỏng, uốn cong hoặc kéo sợi mà không đứt gãy."),
        (8, "Độ cứng của vật liệu cơ khí là gì?",
         [("A", "Khả năng chống lại sự biến dạng dẻo của bề mặt khi có vật cứng hơn ấn vào"),
          ("B", "Khối lượng của vật liệu trên một đơn vị thể tích"),
          ("C", "Nhiệt độ mà tại đó vật liệu bắt đầu chảy lỏng"),
          ("D", "Khả năng chịu va đập")],
         "A", "Độ cứng đo khả năng chống lún, chống trầy xước bề mặt."),
        (9, "Các tính chất cơ học (cơ tính) của vật liệu cơ khí bao gồm:",
         [("A", "Độ bền, độ dẻo, độ cứng, độ dai va đập"),
          ("B", "Tính dẫn nhiệt, tính dẫn điện, khối lượng riêng"),
          ("C", "Tính chịu axit, tính chịu kiềm, tính oxy hóa"),
          ("D", "Tính đúc, tính hàn, tính rèn, tính cắt gọt")],
         "A", "Cơ tính bao gồm độ bền, độ dẻo, độ cứng và độ dai va đập."),
        (10, "Các tính chất vật lý của vật liệu cơ khí bao gồm:",
         [("A", "Nhiệt độ nóng chảy, khối lượng riêng, tính dẫn điện, tính dẫn nhiệt, tính giãn nở nhiệt"),
          ("B", "Độ cứng Brinell và giới hạn bền kéo"),
          ("C", "Khả năng chống ăn mòn hóa học"),
          ("D", "Khả năng gia công trên máy phay")],
         "A", "Nhiệt độ nóng chảy, khối lượng riêng, dẫn nhiệt, dẫn điện là tính chất vật lý."),
        (11, "Tính chất hóa học của vật liệu cơ khí thể hiện ở:",
         [("A", "Khả năng chống ăn mòn và oxy hóa trong môi trường làm việc"),
          ("B", "Khả năng dẫn điện tốt khi nối vào mạch điện"),
          ("C", "Khả năng biến dạng đàn hồi"),
          ("D", "Khả năng uốn cong không gãy")],
         "A", "Tính chất hóa học liên quan đến phản ứng với môi trường oxy hóa, axit, muối."),
        (12, "Tính công nghệ của vật liệu cơ khí bao gồm các đặc tính nào?",
         [("A", "Tính đúc, tính hàn, tính rèn (biến dạng nóng/nguội), tính gia công cắt gọt"),
          ("B", "Tính kinh tế và lợi nhuận bán hàng"),
          ("C", "Màu sắc bề mặt và độ bóng bẩy"),
          ("D", "Khả năng dẫn điện cao")],
         "A", "Tính công nghệ quyết định khả năng gia công chế tạo chi tiết từ vật liệu đó."),
        (13, "Kim loại nào sau đây có tính dẫn điện và dẫn nhiệt tốt nhất trong các kim loại thông dụng?",
         [("A", "Đồng (và Bạc)"), ("B", "Sắt"), ("C", "Gang"), ("D", "Chì")],
         "A", "Đồng có độ dẫn điện và dẫn nhiệt rất cao, chỉ sau bạc."),
        (14, "Vật liệu nào sau đây thuộc nhóm vật liệu phi kim loại?",
         [("A", "Chất dẻo (nhựa), cao su, gốm sứ"), ("B", "Thép carbon"), ("C", "Hợp kim nhôm"), ("D", "Gang cầu")],
         "A", "Chất dẻo, cao su và gốm sứ là vật liệu phi kim."),
        (15, "Nhôm và hợp kim của nhôm có ưu điểm nổi bật nào về tính chất vật lý?",
         [("A", "Khối lượng riêng nhỏ (nhẹ) và khả năng dẫn nhiệt, dẫn điện tốt"),
          ("B", "Nhiệt độ nóng chảy rất cao trên 3000 độ C"),
          ("C", "Độ cứng cao hơn kim cương"),
          ("D", "Rất nặng và dễ gỉ sét trong không khí")],
         "A", "Nhôm có khối lượng riêng nhẹ (~2.7 g/cm3), bền trong khí quyển nhờ màng Al2O3."),
        (16, "Inox (thép không gỉ) là một loại vật liệu thuộc nhóm nào?",
         [("A", "Vật liệu kim loại và hợp kim (thép hợp kim chứa Cr, Ni)"),
          ("B", "Vật liệu phi kim loại"),
          ("C", "Vật liệu nano tinh khiết"),
          ("D", "Chất dẻo nhiệt rắn")],
         "A", "Inox là thép hợp kim có khả năng chống ăn mòn cao nhờ thành phần Cr và Ni."),
        (17, "Vật liệu dùng để chế tạo vỏ máy bay cần ưu tiên tính chất nào hàng đầu?",
         [("A", "Khối lượng riêng nhẹ kết hợp độ bền cao và chống mỏi tốt"),
          ("B", "Càng nặng càng tốt để đầm gió"),
          ("C", "Dễ nóng chảy ở nhiệt độ thấp"),
          ("D", "Dẫn điện cực mạnh")],
         "A", "Vỏ máy bay dùng hợp kim nhôm (duralumin) hoặc composite sợi carbon siêu nhẹ, siêu bền."),
        (18, "Vật liệu dùng để chế tạo lưỡi dao cắt gọt kim loại cần có tính chất nào vượt trội?",
         [("A", "Độ cứng cao, chịu nhiệt và chống mài mòn tốt ở nhiệt độ cao"),
          ("B", "Độ dẻo cực cao, dễ uốn cong"),
          ("C", "Tính dẫn nhiệt kém nhất có thể"),
          ("D", "Độ xốp cao")],
         "A", "Dụng cụ cắt gọt đòi hỏi độ cứng cao hơn phôi và giữ được độ cứng khi ma sát sinh nhiệt."),
        (19, "Vật liệu chế tạo dây mayso điện trở trong nồi cơm điện, lò sưởi cần tính chất gì?",
         [("A", "Điện trở suất cao, chịu được nhiệt độ cao và không bị oxy hóa ở nhiệt độ cao"),
          ("B", "Dẫn điện tốt như đồng siêu dẫn"),
          ("C", "Dễ chảy ở 100 độ C"),
          ("D", "Độ dẻo như cao su")],
         "A", "Dây điện trở (nichrome) có điện trở suất lớn và chịu nhiệt độ cao không bị oxy hóa."),
        (20, "Vật liệu chế tạo thân vỏ lốp xe ô tô bắt buộc phải làm từ vật liệu nào?",
         [("A", "Cao su kết hợp lớp bố thép / sợi tổng hợp"),
          ("B", "Gang xám đúc nguyên khối"),
          ("C", "Gỗ tự nhiên sấy khô"),
          ("D", "Nhôm lá dát mỏng")],
         "A", "Lốp xe cần tính đàn hồi, giảm chấn và bám đường của cao su kết hợp khung cốt thép.")
    ]
    for num, stem, opts, ans, exp in b3_mcq:
        all_questions.append(create_question(f"cn11_b3_mcq_{num:02d}", len(all_questions) + 1, sec3, "single_choice", 0.25, stem, options=opts, correct_opt=ans, explanation=exp))

    b3_tf = [
        (1, "Khi nói về các yêu cầu chung đối với vật liệu cơ khí, phát biểu sau đúng hay sai?",
         [("a", "Tính sử dụng bảo đảm vật liệu đáp ứng đầy đủ điều kiện làm việc của chi tiết máy.", True),
          ("b", "Tính công nghệ cho biết vật liệu có dễ gia công bằng các phương pháp đúc, hàn, gia công cắt gọt hay không.", True),
          ("c", "Tính kinh tế đòi hỏi luôn chọn vật liệu đắt tiền nhất để bảo đảm độ bền.", False),
          ("d", "Lựa chọn vật liệu hợp lý giúp giảm giá thành sản phẩm mà vẫn đạt chất lượng kỹ thuật.", True)],
         "Tính kinh tế hướng tới chi phí hợp lý nhất, không lãng phí vật liệu đắt tiền nếu không cần thiết."),
        (2, "Khi so sánh các nhóm vật liệu cơ khí, phát biểu sau đúng hay sai?",
         [("a", "Vật liệu kim loại và hợp kim thường có khả năng chịu tải trọng và chịu nhiệt tốt hơn chất dẻo thông thường.", True),
          ("b", "Chất dẻo có ưu điểm nổi bật là nhẹ, cách điện, cách nhiệt và không bị gỉ sét.", True),
          ("c", "Vật liệu mới không thể thay thế vật liệu kim loại trong bất kỳ ứng dụng nào.", False),
          ("d", "Vật liệu composite kết hợp các ưu điểm của cả vật liệu cốt và vật liệu nền.", True)],
         "Vật liệu mới (composite, nano, FGM) đang thay thế kim loại trong nhiều lĩnh vực kỹ thuật cao.")
    ]
    for num, stem, stmts, exp in b3_tf:
        all_questions.append(create_question(f"cn11_b3_tf_{num:02d}", len(all_questions) + 1, sec3, "true_false_cluster", 1.0, stem, statements=stmts, explanation=exp))

    # ----------------------------------------------------
    # BÀI 4: NHẬN BIẾT TÍNH CHẤT CƠ BẢN CỦA KIM LOẠI VÀ HỢP KIM
    # ----------------------------------------------------
    sec4 = "Bài 4: Nhận biết tính chất kim loại và hợp kim"
    b4_mcq = [
        (1, "Vật liệu kim loại và hợp kim được chia thành 2 nhóm lớn cơ bản là:",
         [("A", "Kim loại đen và kim loại màu"), ("B", "Kim loại nặng và kim loại nhẹ"), ("C", "Kim loại quý và kim loại rẻ tiền"), ("D", "Kim loại dẻo và kim loại giòn")],
         "A", "Phân loại tiêu chuẩn: Kim loại đen (sắt, gang, thép) và Kim loại màu (nhôm, đồng, titan,...)."),
        (2, "Kim loại đen là hợp kim của nguyên tố nào là thành phần chủ yếu?",
         [("A", "Sắt (Fe) và Carbon (C)"), ("B", "Đồng (Cu) và Thiếc (Sn)"), ("C", "Nhôm (Al) và Silic (Si)"), ("D", "Niken (Ni) và Crom (Cr)")],
         "A", "Kim loại đen là sắt và các hợp kim của sắt với carbon."),
        (3, "Hợp kim là gì?",
         [("A", "Vật liệu kim loại chứa từ hai nguyên tố trở lên, trong đó có ít nhất một nguyên tố kim loại chủ đạo"),
          ("B", "Hỗn hợp cơ học của các hạt cát và đá"),
          ("C", "Hợp chất hữu cơ cao phân tử"),
          ("D", "Kim loại hoàn toàn tinh khiết 100%")],
         "A", "Hợp kim là sự kết hợp kim loại với các nguyên tố khác để cải thiện cơ tính."),
        (4, "Căn cứ vào hàm lượng carbon, kim loại đen được phân chia thành 2 loại là:",
         [("A", "Thép (C <= 2.14%) và Gang (C > 2.14%)"),
          ("B", "Sắt non và sắt già"),
          ("C", "Đồng đỏ và đồng thau"),
          ("D", "Nhôm dẻo và nhôm đúc")],
         "A", "Thép có hàm lượng C <= 2.14%, Gang có hàm lượng C > 2.14%."),
        (5, "Đặc tính nổi bật của gang so với thép là:",
         [("A", "Tính đúc tốt, độ cứng cao nhưng giòn, chịu va đập kém"),
          ("B", "Độ dẻo rất cao, dễ rèn và kéo sợi mỏng"),
          ("C", "Tính hàn tuyệt vời, không nứt khi hàn"),
          ("D", "Không dẫn nhiệt và không dẫn điện")],
         "A", "Gang đúc rất tốt, chịu nén tốt nhưng giòn và chịu uốn, va đập kém."),
        (6, "Thép có tính chất cơ học ưu việt hơn gang ở điểm nào?",
         [("A", "Độ bền, độ dẻo, độ dai va đập cao, dễ uốn, rèn và dập"),
          ("B", "Nhiệt độ nóng chảy thấp hơn nhiều so với gang"),
          ("C", "Giòn hơn gang rất nhiều"),
          ("D", "Không thể hàn được")],
         "A", "Thép có độ dẻo và độ dai cao, dễ gia công áp lực (rèn, dập, cán)."),
        (7, "Kim loại nào sau đây thuộc nhóm kim loại màu?",
         [("A", "Nhôm (Al), đồng (Cu), niken (Ni), titan (Ti)"),
          ("B", "Gang xám"),
          ("C", "Thép carbon CT3"),
          ("D", "Sắt nguyên chất")],
         "A", "Tất cả kim loại không phải sắt và hợp kim sắt đều là kim loại màu."),
        (8, "Phương pháp nhận biết kim loại đơn giản bằng cách quan sát màu sắc bề mặt cho thấy:",
         [("A", "Đồng có màu đỏ hoặc vàng ánh đỏ; nhôm có màu trắng bạc; gang có mặt gãy xám tối"),
          ("B", "Tất cả các kim loại đều có màu đen kịt"),
          ("C", "Nhôm có màu vàng rực như vàng 24K"),
          ("D", "Thép có màu xanh lục")],
         "A", "Quan sát màu sắc và mặt gãy là phương pháp cảm quan nhanh chóng."),
        (9, "Khi dùng búa đập thử để kiểm tra tính dẻo và tính giòn của mẫu thử kim loại:",
         [("A", "Mẫu vật liệu dẻo (nhôm, đồng, thép mềm) sẽ bị bẹp, biến dạng; mẫu giòn (gang) dễ bị nứt hoặc vỡ vụn"),
          ("B", "Mẫu gang sẽ dạt mỏng như tờ giấy"),
          ("C", "Mẫu đồng sẽ vỡ vụn thành bột"),
          ("D", "Mọi kim loại đều phản ứng giống hệt nhau")],
         "A", "Thử nghiệm cơ tính đơn giản bằng búa phân biệt tính dẻo và tính giòn."),
        (10, "Kim loại màu nào có khả năng chống ăn mòn hóa học cao trong khí quyển nhờ lớp màng oxit tự nhiên bảo vệ?",
         [("A", "Nhôm (Al)"), ("B", "Sắt (Fe)"), ("C", "Thép carbon thường"), ("D", "Gang trắng")],
         "A", "Lớp màng Al2O3 mỏng, mịn và bền vững ngăn oxy xâm nhập sâu vào bên trong."),
        (11, "Đồng và hợp kim của đồng được sử dụng rộng rãi để chế tạo chi tiết nào trong cơ khí và điện tử?",
         [("A", "Lõi dây dẫn điện, bạc lót, bánh vít, chi tiết trao đổi nhiệt"),
          ("B", "Vỏ máy bay siêu âm"),
          ("C", "Lưỡi dao máy tiện cắt gọt thép cứng"),
          ("D", "Đá mài mòn")],
         "A", "Đồng dẫn điện tốt, hệ số ma sát thấp nên làm bạc lót trượt rất tốt."),
        (12, "Tại sao thân máy tiện, vỏ động cơ cỡ lớn thường được chế tạo bằng gang xám?",
         [("A", "Gang xám đúc tốt, giảm rung động tốt và giá thành tương đối rẻ"),
          ("B", "Gang xám rất nhẹ và nổi được trên nước"),
          ("C", "Gang xám uốn cong được nhiều lần"),
          ("D", "Gang xám có màu sắc sặc sỡ")],
         "A", "Gang xám có tính giảm chấn, khử rung động vượt trội, rất thích hợp làm bệ máy."),
        (13, "Thép hợp kim là loại thép được bổ sung thêm các nguyên tố nào nhằm nâng cao cơ tính và tính chống gỉ?",
         [("A", "Crom (Cr), Niken (Ni), Mangan (Mn), Molipden (Mo), Vonfram (W)"),
          ("B", "Cát thạch anh và lưu huỳnh"),
          ("C", "Gỗ và tro rơm"),
          ("D", "Đất sét và vôi sống")],
         "A", "Các nguyên tố hợp kim hóa Cr, Ni, Mo, W tạo ra thép không gỉ, thép gió, thép chịu nhiệt."),
        (14, "Phương pháp xác định khối lượng riêng của kim loại được thực hiện bằng cách:",
         [("A", "Đo khối lượng bằng cân và đo thể tích bằng bình chia độ hoặc hình học, sau đó tính D = m / V"),
          ("B", "Đốt cháy mẫu và đo nhiệt độ ngọn lửa"),
          ("C", "Ngâm mẫu trong nước muối 30 ngày"),
          ("D", "Đập búa xem có phát ra tia lửa không")],
         "A", "D = m / V là công thức đo khối lượng riêng thực nghiệm chuẩn."),
        (15, "Nhận định nào sau đây là ĐÚNG khi so sánh khối lượng riêng của nhôm và thép?",
         [("A", "Khối lượng riêng của nhôm (~2.7 g/cm3) chỉ bằng khoảng 1/3 của thép (~7.8 g/cm3)"),
          ("B", "Nhôm nặng gấp 3 lần thép"),
          ("C", "Nhôm và thép có khối lượng riêng hoàn toàn bằng nhau"),
          ("D", "Thép nhẹ hơn nhôm rất nhiều")],
         "A", "Nhôm nhẹ bằng xấp xỉ 1/3 thép, là kim loại nhẹ tiêu biểu.")
    ]
    for num, stem, opts, ans, exp in b4_mcq:
        all_questions.append(create_question(f"cn11_b4_mcq_{num:02d}", len(all_questions) + 1, sec4, "single_choice", 0.25, stem, options=opts, correct_opt=ans, explanation=exp))

    b4_tf = [
        (1, "Khi nói về kim loại đen (gang và thép), phát biểu sau đúng hay sai?",
         [("a", "Thép có hàm lượng carbon nhỏ hơn hoặc bằng 2.14%.", True),
          ("b", "Gang có hàm lượng carbon lớn hơn 2.14%.", True),
          ("c", "Gang có tính dẻo cao hơn thép và dễ rèn thành thanh dài hơn thép.", False),
          ("d", "Thép hợp kim có khả năng chống ăn mòn và độ bền cao hơn thép carbon thông thường.", True)],
         "Gang giòn, không rèn được; thép có độ dẻo cao hơn nhiều và rèn cán rất tốt."),
        (2, "Khi nói về các phương pháp nhận biết tính chất của kim loại và hợp kim, phát biểu sau đúng hay sai?",
         [("a", "Quan sát mặt gãy: mặt gãy của gang có màu xám tối và thô nhám hạt tinh thể.", True),
          ("b", "Đồng có khối lượng riêng nhẹ hơn nhôm rất nhiều.", False),
          ("c", "Thử tính cứng bằng cách dùng vật cứng hơn ấn hoặc vạch lên bề mặt mẫu thử.", True),
          ("d", "Tất cả các kim loại màu đều có từ tính mạnh và bị nam châm hút chặt.", False)],
         "Đồng nặng (~8.9 g/cm3) hơn nhôm (~2.7 g/cm3). Kim loại màu không có từ tính (không bị nam châm hút).")
    ]
    for num, stem, stmts, exp in b4_tf:
        all_questions.append(create_question(f"cn11_b4_tf_{num:02d}", len(all_questions) + 1, sec4, "true_false_cluster", 1.0, stem, statements=stmts, explanation=exp))

    # ----------------------------------------------------
    # BÀI 5: VẬT LIỆU PHI KIM LOẠI
    # ----------------------------------------------------
    sec5 = "Bài 5: Vật liệu phi kim loại"
    b5_mcq = [
        (1, "Vật liệu phi kim loại thông dụng trong ngành cơ khí gồm những nhóm nào?",
         [("A", "Chất dẻo (nhựa) và cao su"), ("B", "Sắt và gang"), ("C", "Đồng và nhôm"), ("D", "Hợp kim titan")],
         "A", "Hai nhóm vật liệu phi kim chủ yếu trong cơ khí là chất dẻo và cao su."),
        (2, "Ưu điểm chung nổi bật của vật liệu phi kim loại so với kim loại là gì?",
         [("A", "Khối lượng riêng nhỏ (nhẹ), cách điện, cách nhiệt tốt, bền vững với hóa chất và không bị gỉ"),
          ("B", "Chịu nhiệt độ cực cao trên 2000 độ C"),
          ("C", "Dẫn điện mạnh hơn bạc"),
          ("D", "Độ cứng bề mặt cao hơn kim cương")],
         "A", "Phi kim nhẹ, chống ăn mòn và cách điện, cách nhiệt tuyệt vời."),
        (3, "Chất dẻo (Plastic) được chia thành 2 nhóm chính dựa trên tính chất nhiệt là:",
         [("A", "Nhựa nhiệt dẻo và nhựa nhiệt rắn"), ("B", "Nhựa cứng và nhựa mềm"), ("C", "Nhựa tự nhiên và nhựa hóa học"), ("D", "Nhựa trong suốt và nhựa đục")],
         "A", "Phân loại chất dẻo: Nhựa nhiệt dẻo (Thermoplastic) và Nhựa nhiệt rắn (Thermoset)."),
        (4, "Đặc tính nổi bật của chất dẻo nhiệt dẻo là gì?",
         [("A", "Nóng chảy khi đun nóng và đóng rắn lại khi để nguội, có thể tái sinh nhiều lần"),
          ("B", "Khi đun nóng không chảy mà bị cháy thành than ngay"),
          ("C", "Không bao giờ bị biến dạng ở bất kỳ nhiệt độ nào"),
          ("D", "Dẫn điện rất tốt")],
         "A", "Nhựa nhiệt dẻo có mạch polymer thẳng, liên kết yếu nên tái chế được."),
        (5, "Đặc tính nổi bật của chất dẻo nhiệt rắn là gì?",
         [("A", "Sau khi gia nhiệt định hình lần đầu sẽ đóng rắn vĩnh viễn nhờ liên kết lưới không gian, không nóng chảy lại mà bị phân hủy"),
          ("B", "Có thể nung chảy và đúc lại hàng trăm lần"),
          ("C", "Mềm dẻo như bún ở nhiệt độ phòng"),
          ("D", "Dễ tan hoàn toàn trong nước lạnh")],
         "A", "Nhựa nhiệt rắn có cấu trúc không gian 3 chiều, không tái sinh được."),
        (6, "Loại nhựa nào sau đây thuộc nhóm nhựa nhiệt dẻo thông dụng?",
         [("A", "PE (Polyethylene), PP (Polypropylene), PVC (Polyvinyl chloride)"),
          ("B", "Nhựa Bakelite (phenol-formaldehyde)"),
          ("C", "Nhựa Epoxy liên kết chéo"),
          ("D", "Nhựa Polyester không no đúc khuôn")],
         "A", "PE, PP, PVC, ABS, PS là nhựa nhiệt dẻo."),
        (7, "Loại nhựa nào thường dùng làm vỏ cách điện phích cắm, tay cầm nồi chảo chịu nhiệt vì không bị nóng chảy?",
         [("A", "Nhựa nhiệt rắn (Bakelite, Melamine)"), ("B", "Nhựa PE mềm"), ("C", "Cao su sống chưa lưu hóa"), ("D", "Nhựa sáp parafin")],
         "A", "Tay cầm nồi chảo cần nhựa nhiệt rắn chịu nhiệt độ cao không mềm lún."),
        (8, "Cao su có đặc tính cơ học nổi bật nhất là gì?",
         [("A", "Tính đàn hồi rất cao (độ giãn dài có thể đạt 700% - 800%) và khả năng giảm chấn, giảm rung động tuyệt vời"),
          ("B", "Độ cứng cao nhất trong các chất"),
          ("C", "Dễ giòn vỡ vụn khi va chạm nhẹ"),
          ("D", "Dẫn nhiệt nhanh như kim loại")],
         "A", "Độ đàn hồi cực đại và hấp thụ xung lực là đặc tính cốt lõi của cao su."),
        (9, "Dựa vào nguồn gốc, cao su được phân thành mấy loại?",
         [("A", "2 loại: Cao su tự nhiên và Cao su nhân tạo (tổng hợp)"),
          ("B", "3 loại: Cao su cứng, cao su lỏng, cao su khí"),
          ("C", "4 loại: Cao su đỏ, vàng, trắng, đen"),
          ("D", "Chỉ có duy nhất cao su tự nhiên trồng từ cây")],
         "A", "Cao su tự nhiên (mủ cây hevea) và Cao su tổng hợp (từ sản phẩm hóa dầu)."),
        (10, "Sản phẩm nào sau đây được làm chủ yếu từ cao su nhờ tính đàn hồi và giảm chấn?",
         [("A", "Lốp xe, đệm giảm chấn động cơ, phớt chặn dầu, ống mềm dẫn chất lỏng"),
          ("B", "Piston động cơ đốt trong"),
          ("C", "Trục khuỷu máy nén khí"),
          ("D", "Bánh răng hộp số")],
         "A", "Lốp xe, ống dẫn mềm, gioăng đệm làm việc nhờ tính đàn hồi cao của cao su."),
        (11, "Nhược điểm chung của vật liệu phi kim loại là gì?",
         [("A", "Độ bền nhiệt độ và độ cứng cơ học thấp hơn nhiều so với kim loại; dễ bị lão hóa dưới ánh nắng và nhiệt"),
          ("B", "Quá nặng nề"),
          ("C", "Dễ bị gỉ sét mục nát trong không khí ẩm"),
          ("D", "Giá thành luôn đắt gấp 100 lần kim loại quý")],
         "A", "Chất dẻo và cao su có nhiệt độ làm việc thấp (< 150-250 độ C) và bị lão hóa."),
        (12, "Hiện tượng lão hóa của cao su và chất dẻo biểu hiện qua điều gì?",
         [("A", "Vật liệu bị cứng lại, nứt nẻ, giòn vỡ hoặc chảy nhão, suy giảm tính đàn hồi dưới tác dụng của oxy, nhiệt, tia tử ngoại"),
          ("B", "Vật liệu biến thành kim loại sắt"),
          ("C", "Vật liệu phát sáng trong bóng đêm"),
          ("D", "Vật liệu tăng độ dẻo lên gấp đôi")],
         "A", "Lão hóa là sự đứt gãy mạch polymer do tia UV, nhiệt độ và oxy hóa."),
        (13, "Ống dẫn nước hàn nhiệt PPR dùng trong cấp thoát nước sinh hoạt thuộc nhóm vật liệu nào?",
         [("A", "Nhựa nhiệt dẻo (Polypropylene Random)"), ("B", "Kim loại gang xám"), ("C", "Nhựa nhiệt rắn Bakelite"), ("D", "Hợp kim chì")],
         "A", "Ống PPR là nhựa nhiệt dẻo, hàn nhiệt nối ống rất thuận tiện."),
        (14, "Phương pháp phân biệt đơn giản nhựa nhiệt dẻo và nhựa nhiệt rắn là:",
         [("A", "Dùng mỏ hàn nóng chạm vào mẫu: nhựa nhiệt dẻo sẽ mềm và chảy dính; nhựa nhiệt rắn không chảy mà bốc khói cháy khét"),
          ("B", "Thả vào nước xem có chìm không"),
          ("C", "Gõ búa xem có tiếng chuông không"),
          ("D", "Nếm thử mùi vị")],
         "A", "Thử nhiệt phân biệt rõ rệt tính chất nóng chảy của 2 loại nhựa."),
        (15, "Tại sao các bánh răng nhựa (PA, POM) ngày càng được sử dụng nhiều trong các thiết bị chính xác như máy in, đồng hồ?",
         [("A", "Trọng lượng nhẹ, chạy êm, tự bôi trơn, không ồn và không cần bôi dầu mỡ thường xuyên"),
          ("B", "Truyền được công suất hàng ngàn mã lực"),
          ("C", "Chịu được nhiệt độ nung 1500 độ C"),
          ("D", "Dẫn điện tốt")],
         "A", "Bánh răng kỹ thuật bằng nhựa POM/PA chạy rất êm, sạch và tự giảm ma sát.")
    ]
    for num, stem, opts, ans, exp in b5_mcq:
        all_questions.append(create_question(f"cn11_b5_mcq_{num:02d}", len(all_questions) + 1, sec5, "single_choice", 0.25, stem, options=opts, correct_opt=ans, explanation=exp))

    b5_tf = [
        (1, "Khi nói về chất dẻo nhiệt dẻo và chất dẻo nhiệt rắn, phát biểu sau đúng hay sai?",
         [("a", "Nhựa nhiệt dẻo có khả năng tái chế bằng cách nấu chảy lại nhiều lần.", True),
          ("b", "Nhựa nhiệt rắn có thể tái sinh thành sản phẩm mới dễ dàng như nhựa nhiệt dẻo.", False),
          ("c", "Ống nước PVC và chai nhựa PET thuộc nhóm nhựa nhiệt dẻo.", True),
          ("d", "Vỏ ổ cắm điện làm bằng nhựa nhiệt rắn chịu nhiệt tốt và cách điện an toàn.", True)],
         "Nhựa nhiệt rắn không thể tái chế bằng cách nung chảy vì cấu trúc không gian bị cháy phân hủy."),
        (2, "Khi nói về tính chất và ứng dụng của cao su, phát biểu sau đúng hay sai?",
         [("a", "Cao su tự nhiên được thu hoạch từ nhựa cây cao su.", True),
          ("b", "Cao su tổng hợp có thể được sản xuất với các tính chất đặc biệt như chịu dầu mỡ, chịu nhiệt cao.", True),
          ("c", "Cao su dẫn điện rất tốt nên thường được dùng làm lõi dây cáp điện.", False),
          ("d", "Lưu hóa cao su với lưu huỳnh giúp tăng độ bền, độ đàn hồi và tính chịu nhiệt của cao su.", True)],
         "Cao su là chất cách điện rất tốt, dùng làm vỏ bọc bảo vệ cách điện.")
    ]
    for num, stem, stmts, exp in b5_tf:
        all_questions.append(create_question(f"cn11_b5_tf_{num:02d}", len(all_questions) + 1, sec5, "true_false_cluster", 1.0, stem, statements=stmts, explanation=exp))

    # ----------------------------------------------------
    # BÀI 6: VẬT LIỆU MỚI
    # ----------------------------------------------------
    sec6 = "Bài 6: Vật liệu mới"
    b6_mcq = [
        (1, "Vật liệu mới trong cơ khí là gì?",
         [("A", "Các loại vật liệu mới xuất hiện hoặc được cải tiến đột phá, có tính năng vượt trội so với vật liệu truyền thống"),
          ("B", "Tất cả các kim loại sắt vụn tái chế"),
          ("C", "Gỗ vụn ép lại thành bàn ghế"),
          ("D", "Đất đá tự nhiên mới khai thác")],
         "A", "Vật liệu mới sở hữu các cơ tính và tính năng đặc biệt vượt trội."),
        (2, "Vật liệu nano là vật liệu có kích thước cấu trúc hạt hoặc màng nằm trong khoảng nào?",
         [("A", "Từ 1 nanomet (nm) đến 100 nanomet (nm)"),
          ("B", "Từ 1 milimet (mm) đến 10 milimet (mm)"),
          ("C", "Từ 1 centimet (cm) đến 1 mét (m)"),
          ("D", "Lớn hơn 1 micromet")],
         "A", "Kích thước nano chuẩn quy ước từ 1 đến 100 nm."),
        (3, "Tại sao vật liệu nano lại có những tính chất vật lý và hóa học đặc biệt khác lạ so với vật liệu cùng loại ở kích thước lớn?",
         [("A", "Do tỉ số diện tích bề mặt trên thể tích cực lớn và sự xuất hiện của các hiệu ứng lượng tử bề mặt"),
          ("B", "Do vật liệu nano nặng hơn gấp ngàn lần"),
          ("C", "Do vật liệu nano không có nguyên tử"),
          ("D", "Do vật liệu nano chỉ tồn tại ở nhiệt độ âm tuyệt đối")],
         "A", "Hiệu ứng bề mặt và hiệu ứng lượng tử kích thước nano tạo nên cơ tính vượt bậc."),
        (4, "Vật liệu composite được định nghĩa là gì?",
         [("A", "Vật liệu tổ hợp từ hai hay nhiều thành phần vật liệu khác nhau, gồm thành phần cốt và thành phần nền, không hòa tan vào nhau"),
          ("B", "Một kim loại tinh khiết được nung chảy"),
          ("C", "Dung dịch muối hòa tan trong nước"),
          ("D", "Khí gas nén lỏng")],
         "A", "Composite gồm cốt (chịu lực) và nền (liên kết, bảo vệ cốt)."),
        (5, "Trong vật liệu composite, thành phần cốt (chất gia cường) có vai trò gì?",
         [("A", "Bảo đảm cho composite có độ bền cơ học, độ cứng và khả năng chịu tải trọng cao"),
          ("B", "Làm dung môi hòa tan các hạt nhựa"),
          ("C", "Làm cho composite dễ bị mục rữa"),
          ("D", "Làm composite dẫn nhiệt nhanh")],
         "A", "Cốt (sợi thủy tinh, sợi carbon, sợi aramid) đóng vai trò chịu lực chính."),
        (6, "Trong vật liệu composite, thành phần nền (matrix) có vai trò gì?",
         [("A", "Liên kết các thành phần cốt lại với nhau, truyền tải ứng suất và bảo vệ cốt khỏi tác động môi trường"),
          ("B", "Tạo ra các vết nứt để thoát nhiệt"),
          ("C", "Làm cho vật liệu trở nên dễ vỡ"),
          ("D", "Hút ẩm từ không khí")],
         "A", "Nền (nhựa polymer, kim loại, gốm) giữ các sợi cốt cố định và bảo vệ cốt."),
        (7, "Ưu điểm vượt trội của vật liệu composite cốt sợi carbon (CFRP) là gì?",
         [("A", "Độ bền kéo cực cao trong khi khối lượng riêng rất nhẹ, chống ăn mòn và chống mỏi tuyệt vời"),
          ("B", "Rất nặng và dễ gỉ sét"),
          ("C", "Giá thành rẻ nhất thế giới, rẻ hơn đất cát"),
          ("D", "Dễ hòa tan trong nước mưa")],
         "A", "Sợi carbon có tỷ lệ độ bền/trọng lượng thuộc hàng cao nhất hiện nay."),
        (8, "Vật liệu có cơ tính biến thiên (FGM - Functionally Graded Material) là gì?",
         [("A", "Vật liệu composite tiên tiến có thành phần và cấu trúc thay đổi liên tục trong không gian để đáp ứng các yêu cầu cơ lý khác nhau ở từng vị trí"),
          ("B", "Vật liệu bị hỏng liên tục khi làm việc"),
          ("C", "Vật liệu chỉ sử dụng một lần duy nhất rồi vứt bỏ"),
          ("D", "Vật liệu đổi màu theo cảm xúc người dùng")],
         "A", "FGM có thành phần biến đổi liên tục từ bề mặt vào lõi."),
        (9, "Ứng dụng tiêu biểu của vật liệu có cơ tính biến thiên (FGM) là:",
         [("A", "Mũi tên lửa, tấm chắn nhiệt tàu con thoi (mặt ngoài chịu nhiệt cực cao, mặt trong chịu lực bền dai)"),
          ("B", "Làm lạt buộc giò chả"),
          ("C", "Làm phấn viết bảng"),
          ("D", "Làm ruột bút chì")],
         "A", "FGM tối ưu hóa giữa lớp gốm chịu nhiệt bề mặt và lớp kim loại bền dai bên trong."),
        (10, "Hợp kim nhớ hình (Shape Memory Alloy - SMA) có tính năng độc đáo nào?",
         [("A", "Có khả năng tự phục hồi lại hình dạng ban đầu sau khi bị biến dạng dẻo khi được gia nhiệt đến nhiệt độ nhất định"),
          ("B", "Ghi nhớ được giọng nói của chủ nhân"),
          ("C", "Chụp lại được hình ảnh xung quanh"),
          ("D", "Tự động tăng gấp đôi kích thước mãi mãi")],
         "A", "Hiệu ứng nhớ hình giúp kim loại trở lại hình dáng ban đầu qua chuyển pha nhiệt."),
        (11, "Hợp kim nhớ hình nổi tiếng và được ứng dụng rộng rãi nhất hiện nay là:",
         [("A", "Hợp kim Nitinol (Nickel - Titanium)"), ("B", "Hợp kim Gang xám"), ("C", "Thép xây dựng CT3"), ("D", "Hợp kim Chì - Thiếc")],
         "A", "Nitinol (Ni-Ti) là hợp kim nhớ hình tiêu biểu trong y tế và hàng không."),
        (12, "Ứng dụng trong y tế rất nổi tiếng của hợp kim nhớ hình Nitinol là gì?",
         [("A", "Chế tạo ống nong mạch vành tim (Stent), dây cung chỉnh nha thẩm mỹ"),
          ("B", "Chế tạo kim tiêm dùng một lần"),
          ("C", "Chế tạo giường bệnh nhân thông thường"),
          ("D", "Chế tạo bông băng y tế")],
         "A", "Stent Nitinol tự bung nở khi vào thân nhiệt cơ thể để mở rộng mạch máu tắc."),
        (13, "Vật liệu composite sợi thủy tinh (FRP) thường được ứng dụng để chế tạo sản phẩm nào?",
         [("A", "Thân vỏ tàu thuyền, bồn chứa hóa chất, cánh quạt tuabin gió, mũ bảo hiểm"),
          ("B", "Lõi dây truyền tải điện cao thế"),
          ("C", "Trục khuỷu động cơ xe tải nặng"),
          ("D", "Lò xo giảm xóc")],
         "A", "FRP rất bền hóa chất, nhẹ, chịu nước mặn nên làm vỏ xuồng và bồn bể."),
        (14, "Vật liệu phủ nano chống bám dính, chống bám nước (hiệu ứng lá sen) được ứng dụng ở đâu?",
         [("A", "Sơn phủ kính ô tô, bề mặt pin mặt trời, vải chống thấm tự làm sạch"),
          ("B", "Bánh răng máy tiện"),
          ("C", "Búa đập đá"),
          ("D", "Mỏ neo tàu biển")],
         "A", "Lớp phủ kị nước nano giúp kính và pin mặt trời không đọng nước và tự làm sạch."),
        (15, "Nhận định nào sau đây là ĐÚNG khi nói về xu hướng phát triển của vật liệu cơ khí trong tương lai?",
         [("A", "Hướng tới vật liệu siêu nhẹ, siêu bền, thông minh, tiết kiệm năng lượng và thân thiện với môi trường"),
          ("B", "Quay trở lại chỉ dùng gang thô và gỗ tự nhiên"),
          ("C", "Ngừng nghiên cứu vật liệu mới vì vật liệu cũ đã hoàn hảo"),
          ("D", "Chỉ sử dụng vật liệu có giá thành đắt nhất")],
         "A", "Vật liệu tương lai hướng tới xanh, nhẹ, thông minh và tuần hoàn tái sinh.")
    ]
    for num, stem, opts, ans, exp in b6_mcq:
        all_questions.append(create_question(f"cn11_b6_mcq_{num:02d}", len(all_questions) + 1, sec6, "single_choice", 0.25, stem, options=opts, correct_opt=ans, explanation=exp))

    b6_tf = [
        (1, "Khi nói về vật liệu nano, phát biểu sau đúng hay sai?",
         [("a", "Hạt nano có kích thước từ 1 nm đến 100 nm.", True),
          ("b", "Vật liệu nano có tỷ lệ diện tích bề mặt trên thể tích lớn, giúp tăng hoạt tính phản ứng.", True),
          ("c", "Vật liệu nano có độ bền cơ học luôn kém hơn vật liệu khối truyền thống.", False),
          ("d", "Ống nano carbon (CNT) có độ bền kéo cao gấp nhiều lần thép và có tính dẫn điện tốt.", True)],
         "Ống nano carbon có cơ tính siêu việt, độ bền gấp hàng trăm lần thép."),
        (2, "Khi nói về vật liệu composite và hợp kim nhớ hình, phát biểu sau đúng hay sai?",
         [("a", "Vật liệu composite gồm ít nhất hai thành phần không hòa tan vào nhau là cốt và nền.", True),
          ("b", "Cốt trong composite đóng vai trò tạo liên kết và bảo vệ nền khỏi môi trường bên ngoài.", False),
          ("c", "Hợp kim Nitinol có thể phục hồi lại hình dáng ban đầu khi được cung cấp nhiệt thích hợp.", True),
          ("d", "Stent mạch vành tim làm bằng hợp kim nhớ hình có thể tự bung ra ở nhiệt độ cơ thể người.", True)],
         "Cốt chịu lực, nền mới là thành phần liên kết và bảo vệ cốt.")
    ]
    for num, stem, stmts, exp in b6_tf:
        all_questions.append(create_question(f"cn11_b6_tf_{num:02d}", len(all_questions) + 1, sec6, "true_false_cluster", 1.0, stem, statements=stmts, explanation=exp))

    # Total score calculation:
    total_score = sum(q["points"] for q in all_questions)
    
    exam_contract = {
        "schema_version": "2.0.0",
        "exam_id": "exam_cong_nghe_11_tong_hop",
        "exam_version": 1,
        "subject_id": "CONG_NGHE_11",
        "subject_name": "Công Nghệ 11 (Cơ Khí)",
        "grade_level": 11,
        "title": "Đề Cương Ôn Tập Toàn Diện Công Nghệ 11 – Cơ Khí Chế Tạo (Bài 1 – Bài 6)",
        "published_at": "2026-11-10T12:00:00.000Z",
        "status": "published",
        "time_limit": 2700, # 45 minutes
        "grading_policy": {
            "policy_id": "thpt_national_2025_standard",
            "total_max_score": round(total_score, 2),
            "single_choice_default_points": 0.25,
            "true_false_cluster_scale": {
                "1": 0.1,
                "2": 0.25,
                "3": 0.5,
                "4": 1.0
            },
            "multi_select_mode": "partial_with_penalty",
            "short_answer_case_sensitive": False,
            "short_answer_normalize_comma_decimal": True,
            "negative_marking_factor": 0,
            "rounding_decimals": 2
        },
        "attempt_policy": {
            "max_attempts": 99,
            "allow_resume_on_disconnect": True,
            "grace_period_seconds": 120,
            "auto_submit_on_timeout": True,
            "require_session_token": True,
            "allow_review_after_submit": True
        },
        "randomization_policy": {
            "shuffle_questions_within_section": True,
            "shuffle_options": True,
            "preserve_section_order": False,
            "deterministic_seed_strategy": "hmac_session_student"
        },
        "questions": all_questions,
        "assets_manifest": []
    }
    
    with open("data/cong-nghe-11-tong-hop.json", "w", encoding="utf-8") as f:
        json.dump(exam_contract, f, ensure_ascii=False, indent=2)
    print(f"Successfully generated data/cong-nghe-11-tong-hop.json with {len(all_questions)} questions ({round(total_score, 2)} pts)")

    # Also build individual lesson exams for modular study
    lessons = [
        ("cn11_bai_1", "Công Nghệ 11 – Bài 1: Khái Quát Về Cơ Khí Chế Tạo", sec1),
        ("cn11_bai_2", "Công Nghệ 11 – Bài 2: Ngành Nghề Cơ Khí Chế Tạo", sec2),
        ("cn11_bai_3", "Công Nghệ 11 – Bài 3: Tổng Quan Vật Liệu Cơ Khí", sec3),
        ("cn11_bai_4", "Công Nghệ 11 – Bài 4: Nhận Biết Kim Loại & Hợp Kim", sec4),
        ("cn11_bai_5", "Công Nghệ 11 – Bài 5: Vật Liệu Phi Kim Loại", sec5),
        ("cn11_bai_6", "Công Nghệ 11 – Bài 6: Vật Liệu Mới Tiên Tiến", sec6)
    ]
    
    for l_id, l_title, l_sec in lessons:
        l_qs = [q for q in all_questions if q["section"] == l_sec]
        l_score = sum(q["points"] for q in l_qs)
        l_exam = dict(exam_contract)
        l_exam["exam_id"] = f"exam_{l_id}"
        l_exam["title"] = l_title
        l_exam["questions"] = l_qs
        l_exam["grading_policy"] = dict(exam_contract["grading_policy"])
        l_exam["grading_policy"]["total_max_score"] = round(l_score, 2)
        l_exam["time_limit"] = 900 # 15 minutes per lesson
        with open(f"data/{l_id}.json", "w", encoding="utf-8") as f:
            json.dump(l_exam, f, ensure_ascii=False, indent=2)
        print(f"Generated data/{l_id}.json with {len(l_qs)} questions ({round(l_score, 2)} pts)")

if __name__ == "__main__":
    build_cong_nghe_exams()
