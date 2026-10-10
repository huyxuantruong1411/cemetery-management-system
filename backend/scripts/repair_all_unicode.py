import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, ".")

from app.db.session import engine
from sqlalchemy import text

def repair():
    print("=== BAT DAU SUA LOI HIEN THI TIENG VIET TRONG CSDL ===")
    with engine.begin() as conn:
        # 1. care_packages
        print("1. Dang sua care_packages...")
        conn.execute(text("""
            UPDATE care_packages
            SET package_name = N'Gói Chăm Sóc Mộ Định Kỳ Hàng Tháng (Cơ Bản)',
                default_tasks_json = N'["Dọn cỏ dại và thu gom rác quanh khuôn viên mộ", "Lau sạch bia đá hoa cương và bề mặt mộ", "Thắp hương vào ngày rằm (15) và mùng một (01) âm lịch hàng tháng", "Chụp ảnh hiện trạng gửi gia đình qua ứng dụng di động"]'
            WHERE package_code = 'GOI-CS-THANG'
        """))
        conn.execute(text("""
            UPDATE care_packages
            SET package_name = N'Gói Chăm Sóc & Hoa Viên Theo Quý (Nâng Cao)',
                default_tasks_json = N'["Toàn bộ các hạng mục chăm sóc định kỳ hàng tháng", "Cắt tỉa, tạo tán cây cảnh và thay hoa tươi tại bồn hoa khuôn viên", "Đánh bóng bia đá granite và vệ sinh mạch nối kim tĩnh", "Dâng mâm quả lễ vào các ngày sóc vọng và lễ tiết"]'
            WHERE package_code = 'GOI-CS-QUY'
        """))
        conn.execute(text("""
            UPDATE care_packages
            SET package_name = N'Gói Chăm Sóc Toàn Diện & Đại Lễ Hàng Năm (VIP)',
                default_tasks_json = N'["Toàn bộ các hạng mục chăm sóc theo tháng và theo quý", "Tổng vệ sinh và bảo dưỡng kết cấu đá khuôn viên trước Tết Nguyên Đán", "Phục hồi chữ khắc nhũ vàng / thếp vàng trên bia mộ khi có dấu hiệu phai mờ", "Tổ chức cúng giỗ gia tiên và đại lễ Vu Lan Báo Hiếu", "Báo cáo nghiệm thu hình ảnh 360 độ lưu trữ hệ thống MinIO"]'
            WHERE package_code = 'GOI-CS-NAM'
        """))
        conn.execute(text("""
            UPDATE care_packages
            SET package_name = N'Gói Chăm Sóc Toàn Diện'
            WHERE package_name LIKE N'%Gói Cham Sóc Toàn Di?n%' OR package_name LIKE N'%Gói Cham Sóc%'
        """))
        conn.execute(text("""
            UPDATE care_packages
            SET default_tasks_json = N'["Dọn dẹp khuôn viên", "Lau chùi bia mộ", "Thắp hương ngày rằm"]'
            WHERE default_tasks_json LIKE N'%D?n d?p%' OR default_tasks_json LIKE N'%khun%'
        """))

        # 2. care_checklist_items
        print("2. Dang sua care_checklist_items...")
        conn.execute(text("""
            UPDATE care_checklist_items
            SET task_description = N'Dọn dẹp khuôn viên'
            WHERE task_description LIKE N'%D?n d?p%' OR task_description LIKE N'%Dn dp%'
        """))
        conn.execute(text("""
            UPDATE care_checklist_items
            SET task_description = N'Lau chùi bia mộ'
            WHERE task_description LIKE N'%Lau chùi bia%' OR task_description LIKE N'%Lau chi bia%'
        """))
        conn.execute(text("""
            UPDATE care_checklist_items
            SET task_description = N'Thắp hương ngày rằm'
            WHERE task_description LIKE N'%Th?p huong%' OR task_description LIKE N'%Thp huong%'
        """))
        conn.execute(text("""
            UPDATE care_checklist_items
            SET field_notes = N'Đã làm sạch cỏ dại'
            WHERE field_notes LIKE N'%làm s?ch%' OR field_notes LIKE N'%Ðã làm s?ch%' OR field_notes LIKE N'%ã làm sch%'
        """))

        # 3. care_schedules
        print("3. Dang sua care_schedules...")
        conn.execute(text("""
            UPDATE care_schedules
            SET notes = REPLACE(REPLACE(notes, 'K? cham sóc', N'Kỳ chăm sóc'), 'Gói Cham Sóc Toàn Di?n', N'Gói Chăm Sóc Toàn Diện')
            WHERE notes LIKE '%K? cham sóc%' OR notes LIKE '%Gói Cham Sóc%'
        """))
        conn.execute(text("""
            UPDATE care_schedules
            SET notes = REPLACE(REPLACE(REPLACE(REPLACE(notes, 'Ðóng ca', N'Đóng ca'), 'ki?m tra', N'kiểm tra'), 'th?p nhang', N'thắp nhang'), 'tuom t?t', N'tươm tất')
            WHERE notes LIKE '%tuom%' OR notes LIKE '%ki?m tra%' OR notes LIKE '%Ðóng ca%'
        """))

        # 4. exhumation_contracts
        print("4. Dang sua exhumation_contracts...")
        conn.execute(text("""
            UPDATE exhumation_contracts
            SET reason = N'Di dời về quê hương'
            WHERE reason LIKE N'%Di d?i v? quê huong%' OR reason LIKE N'%Di di%'
        """))

        # 5. cremation_contracts
        print("5. Dang sua cremation_contracts...")
        conn.execute(text("""
            UPDATE cremation_contracts
            SET urn_storage_option = N'Lưu tháp cốt Địa Tạng'
            WHERE urn_storage_option LIKE N'%Luu tháp%' OR urn_storage_option LIKE N'%Ð?a T?ng%' OR urn_storage_option LIKE N'%?a Tng%'
        """))

        # 6. burial_annexes
        print("6. Dang sua burial_annexes...")
        conn.execute(text("""
            UPDATE burial_annexes
            SET construction_notes = N'Xây kim tĩnh đúc bê tông cốt thép'
            WHERE construction_notes LIKE N'%bê tông c?t thép%' OR construction_notes LIKE N'%kim tinh%' OR construction_notes LIKE N'%ct thép%'
        """))

        # 7. burial_histories
        print("7. Dang sua burial_histories...")
        conn.execute(text("""
            UPDATE burial_histories
            SET notes = REPLACE(notes, 'Di d?i v? quê huong', N'Di dời về quê hương')
            WHERE notes LIKE '%Di d?i v? quê huong%'
        """))

        # 8. audit_logs
        print("8. Dang sua audit_logs...")
        conn.execute(text("""
            UPDATE audit_logs
            SET post_change_values = REPLACE(post_change_values, 'Khách hàng d?i ý mu?n chuy?n sang m? gia t?c', N'Khách hàng đổi ý muốn chuyển sang mộ gia tộc')
            WHERE post_change_values LIKE '%d?i ý mu?n%'
        """))
        conn.execute(text("""
            UPDATE audit_logs
            SET post_change_values = REPLACE(post_change_values, 'Qu?n Trang Th?c \\u00d0?a', N'Quản Trang Thực Địa')
            WHERE post_change_values LIKE '%Qu?n Trang%'
        """))
        conn.execute(text("""
            UPDATE audit_logs
            SET post_change_values = REPLACE(post_change_values, 'Qu?n Trang Th?c Ð?a', N'Quản Trang Thực Địa')
            WHERE post_change_values LIKE '%Qu?n Trang%'
        """))

        # 9. idempotency_requests
        print("9. Dang sua idempotency_requests...")
        conn.execute(text("""
            UPDATE idempotency_requests
            SET response_body = REPLACE(REPLACE(response_body, 'Qu?n Tr? Viên H? Th?ng', N'Quản Trị Viên Hệ Thống'), 'K? Toán Viên', N'Kế Toán Viên')
            WHERE response_body LIKE '%Qu?n Tr?%' OR response_body LIKE '%K? Toán%'
        """))

    print("=== HOAN TAT SUA LOI TIENG VIET TRONG CSDL ===")

if __name__ == "__main__":
    repair()
