import sys
from sqlalchemy import text
from app.db.session import engine

def main():
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET full_name = N'Quản Trị Viên Hệ Thống' WHERE username = 'admin'"))
        conn.execute(text("UPDATE users SET full_name = N'Chuyên Viên Kinh Doanh' WHERE username = 'marketing'"))
        conn.execute(text("UPDATE users SET full_name = N'Kế Toán Viên' WHERE username = 'accountant'"))
        conn.execute(text("UPDATE users SET full_name = N'Quản Trang Thực Địa' WHERE username = 'caretaker'"))
        
        conn.execute(text("UPDATE roles SET description = N'Quản trị viên toàn quyền hệ thống' WHERE role_name = 'ADMIN'"))
        conn.execute(text("UPDATE roles SET description = N'Nhân viên kinh doanh & tiếp thị (khách hàng, hợp đồng, tư vấn)' WHERE role_name = 'MARKETING'"))
        conn.execute(text("UPDATE roles SET description = N'Nhân viên kế toán (công nợ, thu tiền, chiết khấu, hóa đơn)' WHERE role_name = 'ACCOUNTANT'"))
        conn.execute(text("UPDATE roles SET description = N'Quản trang thực địa (thi công, chăm sóc, nghiệm thu an táng)' WHERE role_name = 'CARETAKER'"))

    print("Successfully repaired Unicode in users and roles!")

    with engine.connect() as conn:
        users = conn.execute(text("SELECT username, full_name FROM users WHERE username IN ('admin', 'marketing', 'accountant', 'caretaker')")).fetchall()
        for u in users:
            print(f"User: {u[0]} -> {u[1]}")

if __name__ == "__main__":
    main()
