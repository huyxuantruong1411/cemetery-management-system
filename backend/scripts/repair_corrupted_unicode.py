import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, ".")

from app.db.session import engine
from sqlalchemy import text

def repair():
    print("=== BAT DAU REPAIR CORRUPTED UNICODE ===")
    with engine.begin() as conn:
        # 1. care_packages: default_tasks_json
        print("Fixing care_packages...")
        conn.execute(text("""
            UPDATE care_packages
            SET default_tasks_json = N'["Dọn cỏ dại quanh khuôn viên", "Lau sạch bia mộ", "Thắp hương ngày rằm"]'
            WHERE package_code = 'GOI-CS-THANG'
               OR default_tasks_json LIKE N'%khuôn viên%' 
               OR default_tasks_json LIKE N'%khun%' 
               OR CHARINDEX('?', default_tasks_json) > 0
        """))

        # 2. care_checklist_items: task_description
        print("Fixing care_checklist_items...")
        conn.execute(text("""
            UPDATE care_checklist_items
            SET task_description = N'Dọn dẹp khuôn viên'
            WHERE task_description LIKE N'%khuôn viên%' OR task_description LIKE N'%khun%'
        """))
        conn.execute(text("""
            UPDATE care_checklist_items
            SET task_description = N'Lau chùi bia mộ'
            WHERE task_description LIKE N'%Lau chùi%' OR task_description LIKE N'%Lau chi%'
        """))
        conn.execute(text("""
            UPDATE care_checklist_items
            SET task_description = N'Thắp hương ngày rằm'
            WHERE task_description LIKE N'%huong%' OR task_description LIKE N'%hương%'
        """))

        # 3. cremation_contracts: urn_storage_option
        print("Fixing cremation_contracts...")
        conn.execute(text("""
            UPDATE cremation_contracts
            SET urn_storage_option = N'Lưu tháp cốt Địa Tạng'
            WHERE urn_storage_option LIKE N'%tháp%' OR urn_storage_option LIKE N'%thp%' OR CHARINDEX('?', urn_storage_option) > 0
        """))

        # 4. exhumation_contracts: reason
        print("Fixing exhumation_contracts...")
        conn.execute(text("""
            UPDATE exhumation_contracts
            SET reason = N'Di dời về quê hương'
            WHERE reason LIKE N'%quê%' OR reason LIKE N'%dời%' OR CHARINDEX('?', reason) > 0
        """))

        # 5. burial_annexes: construction_notes
        print("Fixing burial_annexes...")
        conn.execute(text("""
            UPDATE burial_annexes
            SET construction_notes = N'Xây kim tĩnh đúc bê tông cốt thép'
            WHERE construction_notes LIKE N'%bê tông%' OR construction_notes LIKE N'%kim tinh%' OR CHARINDEX('?', construction_notes) > 0
        """))

        # 6. burial_histories: notes
        print("Fixing burial_histories...")
        conn.execute(text("""
            UPDATE burial_histories
            SET notes = REPLACE(notes, 'Di d?i v? quê huong', N'Di dời về quê hương')
            WHERE notes LIKE N'%quê huong%' OR CHARINDEX('?', notes) > 0
        """))

        # 7. audit_logs: post_change_values
        print("Fixing audit_logs...")
        conn.execute(text("""
            UPDATE audit_logs
            SET post_change_values = REPLACE(post_change_values, 'Khách hàng d?i ý mu?n chuy?n sang m? gia t?c', N'Khách hàng đổi ý muốn chuyển sang mộ gia tộc')
            WHERE CHARINDEX('?', post_change_values) > 0
        """))

    print("=== REPAIR HOAN TAT ===")

if __name__ == "__main__":
    repair()
