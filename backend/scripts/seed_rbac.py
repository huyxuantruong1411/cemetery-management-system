"""Idempotent seed script for RBAC roles, permissions, and initial admin account.

Usage:
    uv run python scripts/seed_rbac.py
    uv run python scripts/seed_rbac.py --admin-user admin --admin-pass ...
"""

import argparse
import os
import sys
from datetime import datetime, timezone

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.modules.auth.models import Permission, Role, User

PERMISSIONS = [
    # Users & Auth
    ("users", "read", "users:read"),
    ("users", "write", "users:write"),
    # Plots & Spatial
    ("plots", "read", "plots:read"),
    ("plots", "write", "plots:write"),
    ("plots", "lock", "plots:lock"),
    # Customers & Profiles
    ("customers", "read", "customers:read"),
    ("customers", "write", "customers:write"),
    # Contracts & Annexes
    ("contracts", "read", "contracts:read"),
    ("contracts", "write", "contracts:write"),
    ("contracts", "activate", "contracts:activate"),
    # Construction
    ("construction", "read", "construction:read"),
    ("construction", "write", "construction:write"),
    ("construction", "execute", "construction:execute"),
    # Care
    ("care", "read", "care:read"),
    ("care", "write", "care:write"),
    ("care", "execute", "care:execute"),
    # Finance
    ("finance", "read", "finance:read"),
    ("finance", "write", "finance:write"),
    ("finance", "collect", "finance:collect"),
    # Reports & Audit
    ("reports", "read", "reports:read"),
    ("audit", "read", "audit:read"),
]

ROLE_CONFIGS = {
    "ADMIN": {
        "description": "Quản trị viên toàn quyền hệ thống",
        "permissions": [p[2] for p in PERMISSIONS],  # All permissions
    },
    "MARKETING": {
        "description": "Nhân viên kinh doanh & tiếp thị (khách hàng, hợp đồng, tư vấn)",
        "permissions": [
            "plots:read",
            "plots:write",
            "customers:read",
            "customers:write",
            "contracts:read",
            "contracts:write",
            "contracts:activate",
            "care:read",
            "care:write",
            "construction:read",
            "finance:read",
            "reports:read",
        ],
    },
    "ACCOUNTANT": {
        "description": "Nhân viên kế toán (công nợ, thu tiền, chiết khấu, hóa đơn)",
        "permissions": [
            "finance:read",
            "finance:write",
            "finance:collect",
            "contracts:read",
            "customers:read",
            "reports:read",
        ],
    },
    "CARETAKER": {
        "description": "Quản trang thực địa (thi công, chăm sóc, nghiệm thu an táng)",
        "permissions": [
            "plots:read",
            "plots:lock",
            "construction:read",
            "construction:write",
            "construction:execute",
            "care:read",
            "care:write",
            "care:execute",
            "contracts:read",
            "customers:read",
        ],
    },
}


def seed_rbac(
    admin_user: str | None = None,
    admin_pass: str | None = None,
    admin_email: str | None = None,
    seed_demo_users: bool = False,
) -> None:
    db = SessionLocal()
    try:
        print("[+] Bắt đầu seed Permissions...")
        perm_map: dict[str, Permission] = {}
        for resource, action, code in PERMISSIONS:
            perm = db.query(Permission).filter(Permission.permission_code == code).first()
            if not perm:
                perm = Permission(
                    permission_code=code,
                    resource=resource,
                    action=action,
                )
                db.add(perm)
                db.flush()
                print(f"  + Tạo permission: {code}")
            perm_map[code] = perm

        print("[+] Bắt đầu seed Roles và gán Permissions...")
        role_map: dict[str, Role] = {}
        for role_name, config in ROLE_CONFIGS.items():
            role = db.query(Role).filter(Role.role_name == role_name).first()
            if not role:
                role = Role(
                    role_name=role_name,
                    description=config["description"],
                )
                db.add(role)
                db.flush()
                print(f"  + Tạo role: {role_name}")
            else:
                role.description = config["description"]

            # Assign permissions
            target_perms = [perm_map[code] for code in config["permissions"] if code in perm_map]
            role.permissions = target_perms
            role_map[role_name] = role

        db.commit()
        print("[+] Hoàn tất seed Roles và Permissions thành công!")

        # Create or update initial admin if provided
        username = admin_user or os.getenv("INITIAL_ADMIN_USERNAME")
        password = admin_pass or os.getenv("INITIAL_ADMIN_PASSWORD")
        email = admin_email or os.getenv("INITIAL_ADMIN_EMAIL", "admin@nghiatrang.vn")

        if username and password:
            print(f"[+] Kiểm tra tài khoản admin '{username}'...")
            admin = db.query(User).filter(User.username == username).first()
            admin_role = role_map.get("ADMIN")
            if not admin:
                admin = User(
                    username=username,
                    password_hash=get_password_hash(password),
                    full_name="Quản Trị Viên Hệ Thống",
                    email=email,
                    phone_number="0900000000",
                    is_active=True,
                    auth_version=1,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                if admin_role:
                    admin.roles = [admin_role]
                db.add(admin)
                db.commit()
                print(f"  + Tạo thành công tài khoản quản trị '{username}'!")
            else:
                print(f"  + Cập nhật thành công tài khoản quản trị '{username}'!")

        if seed_demo_users:
            print("[+] Bắt đầu seed các tài khoản demo (4 vai trò)...")
            demo_accounts = [
                ("admin", "Admin2026!", "Quản Trị Viên Hệ Thống", "admin@nghiatrang.vn", "ADMIN"),
                (
                    "marketing",
                    "Marketing2026!",
                    "Chuyên Viên Kinh Doanh",
                    "marketing@nghiatrang.vn",
                    "MARKETING",
                ),
                (
                    "accountant",
                    "Accountant2026!",
                    "Kế Toán Viên",
                    "accountant@nghiatrang.vn",
                    "ACCOUNTANT",
                ),
                (
                    "caretaker",
                    "Caretaker2026!",
                    "Quản Trang Thực Địa",
                    "caretaker@nghiatrang.vn",
                    "CARETAKER",
                ),
            ]
            for u_name, u_pass, u_full, u_mail, u_role in demo_accounts:
                target_user = db.query(User).filter(User.username == u_name).first()
                role_obj = role_map.get(u_role)
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                if not target_user:
                    target_user = User(
                        username=u_name,
                        password_hash=get_password_hash(u_pass),
                        full_name=u_full,
                        email=u_mail,
                        phone_number="0901234567",
                        is_active=True,
                        auth_version=1,
                        created_at=now_utc,
                        updated_at=now_utc,
                    )
                    if role_obj:
                        target_user.roles = [role_obj]
                    db.add(target_user)
                    print(f"  + Tạo tài khoản demo: {u_name} ({u_role})")
                else:
                    target_user.password_hash = get_password_hash(u_pass)
                    target_user.is_active = True
                    if role_obj and role_obj not in target_user.roles:
                        target_user.roles = [role_obj]
                    print(f"  + Cập nhật tài khoản demo: {u_name} ({u_role})")
            db.commit()

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed RBAC roles and permissions")
    parser.add_argument("--admin-user", help="Username cho tài khoản admin khởi tạo")
    parser.add_argument("--admin-pass", help="Mật khẩu cho tài khoản admin khởi tạo")
    parser.add_argument("--admin-email", help="Email cho tài khoản admin khởi tạo")
    parser.add_argument(
        "--seed-demo-users", action="store_true", help="Tạo bộ tài khoản demo cho 4 vai trò"
    )
    args = parser.parse_args()

    seed_rbac(args.admin_user, args.admin_pass, args.admin_email, args.seed_demo_users)
