"""Seed script for Customers, Deceased Profiles, and Death Certificates (M06)

Populates realistic synthetic data:
- Customers (Thân nhân) with citizen_id (CCCD) and date_of_birth (G07)
- Deceased Profiles with birth_date_precision (EXACT, YEAR_ONLY) (G07)
- Death Certificates with verified_by audit trail (G08)
- Customer-Deceased relationships (Cha con, Mẹ con, ...)
- Slot assignment for realistic memorial demonstration
"""

# ruff: noqa: E402

import sys
from datetime import date, datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.modules.auth.models import User
from app.modules.plots.models import Plot, PlotSlot
from app.modules.profiles.models import (
    Customer,
    CustomerDeceasedRelation,
    DeathCertificate,
    DeceasedProfile,
)


def seed_profiles():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        admin = db.execute(select(User).where(User.username == "admin")).unique().scalar_one_or_none()
        admin_id = admin.user_id if admin else 1

        print("[INFO] Seeding Customers...")
        customers_data = [
            {
                "code": "KH-2026-0001",
                "name": "Nguyễn Văn An",
                "cccd": "079085001234",
                "phone": "0901234567",
                "email": "nguyenvanan@gmail.com",
                "address": "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                "dob": date(1985, 4, 12),
            },
            {
                "code": "KH-2026-0002",
                "name": "Trần Thị Bích Loan",
                "cccd": "079188005678",
                "phone": "0918765432",
                "email": "bichloan.tran@outlook.com",
                "address": "45 Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh",
                "dob": date(1988, 11, 20),
            },
            {
                "code": "KH-2026-0003",
                "name": "Phạm Hoàng Nam",
                "cccd": "079075009988",
                "phone": "0989112233",
                "email": "nam.pham@gmail.com",
                "address": "78 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
                "dob": date(1975, 6, 15),
            },
        ]

        cust_map = {}
        for c in customers_data:
            cust = db.execute(select(Customer).where(Customer.citizen_id == c["cccd"])).unique().scalar_one_or_none()
            if not cust:
                cust = Customer(
                    customer_code=c["code"],
                    full_name=c["name"],
                    citizen_id=c["cccd"],
                    phone_number=c["phone"],
                    email=c["email"],
                    address=c["address"],
                    date_of_birth=c["dob"],
                    created_at=now,
                    updated_at=now,
                )
                db.add(cust)
                db.flush()
                print(f"  + Tạo khách hàng: {cust.customer_code} - {cust.full_name}")
            else:
                cust_map[c["code"]] = cust
                print(f"  * Khách hàng đã tồn tại: {cust.customer_code} - {cust.full_name}")
            cust_map[c["code"]] = cust

        print("[INFO] Seeding Deceased Profiles (G07 & G08)...")
        deceased_data = [
            {
                "code": "NM-2024-0001",
                "name": "Cụ Nguyễn Văn Phúc",
                "gender": "MALE",
                "dob": None,  # G07: Chỉ nhớ năm sinh, không ép ngày 01/01
                "dod": date(2024, 3, 15),
                "birth_year": 1940,
                "precision": "YEAR_ONLY",
                "hometown": "Bến Tre",
                "religion": "Phật giáo",
                "customer_code": "KH-2026-0001",
                "relation": "Cha ruột",
                "is_primary": True,
                "cert_num": "GTT-2024-0129",
                "cert_auth": "UBND Phường Bến Nghé, Quận 1",
                "cert_date": date(2024, 3, 16),
                "is_verified": True,
            },
            {
                "code": "NM-2025-0002",
                "name": "Cụ bà Lê Thị Mai",
                "gender": "FEMALE",
                "dob": date(1945, 8, 22),
                "dod": date(2025, 1, 10),
                "birth_year": 1945,
                "precision": "EXACT",
                "hometown": "Long An",
                "religion": "Không",
                "customer_code": "KH-2026-0002",
                "relation": "Mẹ ruột",
                "is_primary": True,
                "cert_num": "GTT-2025-0045",
                "cert_auth": "UBND Phường 15, Quận Bình Thạnh",
                "cert_date": date(2025, 1, 11),
                "is_verified": True,
            },
            {
                "code": "NM-2026-0003",
                "name": "Ông Phạm Quốc Bảo",
                "gender": "MALE",
                "dob": date(1955, 2, 14),
                "dod": date(2026, 2, 28),
                "birth_year": 1955,
                "precision": "EXACT",
                "hometown": "Hà Nội",
                "religion": "Công giáo",
                "customer_code": "KH-2026-0003",
                "relation": "Anh ruột",
                "is_primary": True,
                "cert_num": "GTT-2026-0988",
                "cert_auth": "UBND Phường Đa Kao, Quận 1",
                "cert_date": date(2026, 3, 1),
                "is_verified": False,  # G08: Hồ sơ mới chưa thẩm định
            },
        ]

        dec_map = {}
        for d in deceased_data:
            dec = db.execute(select(DeceasedProfile).where(DeceasedProfile.deceased_code == d["code"])).unique().scalar_one_or_none()
            if not dec:
                dec = DeceasedProfile(
                    deceased_code=d["code"],
                    full_name=d["name"],
                    gender=d["gender"],
                    date_of_birth=d["dob"],
                    date_of_death=d["dod"],
                    birth_year=d["birth_year"],
                    birth_date_precision=d["precision"],
                    hometown=d["hometown"],
                    religion=d["religion"],
                    has_death_certificate=True,
                    created_at=now,
                    updated_at=now,
                )
                db.add(dec)
                db.flush()
                print(f"  + Tạo người mất: {dec.deceased_code} - {dec.full_name} ({dec.birth_date_precision})")

                # Add death certificate
                cert = DeathCertificate(
                    deceased_id=dec.deceased_id,
                    certificate_number=d["cert_num"],
                    issuing_authority=d["cert_auth"],
                    issue_date=d["cert_date"],
                    scan_file_url=f"/runtime/certificates/{dec.deceased_code}.pdf",
                    is_verified=d["is_verified"],
                    verified_at=now if d["is_verified"] else None,
                    verified_by=admin_id if d["is_verified"] else None,
                    rejection_reason=None if d["is_verified"] else "Đang chờ đối chiếu bản chính",
                )
                db.add(cert)

                # Add relation
                cust = cust_map.get(d["customer_code"])
                if cust:
                    rel = CustomerDeceasedRelation(
                        customer_id=cust.customer_id,
                        deceased_id=dec.deceased_id,
                        relationship_type=d["relation"],
                        is_primary_contact=d["is_primary"],
                    )
                    db.add(rel)
            else:
                print(f"  * Người mất đã tồn tại: {dec.deceased_code} - {dec.full_name}")

            dec_map[d["code"]] = dec

        # Assign Cụ Nguyễn Văn Phúc (NM-2024-0001) to slot 1 of A-H01-02
        plot_p = db.execute(select(Plot).where(Plot.plot_code == "A-H01-02")).unique().scalar_one_or_none()
        phuc = dec_map.get("NM-2024-0001")
        if plot_p and phuc:
            slot = db.execute(
                select(PlotSlot).where(PlotSlot.plot_id == plot_p.plot_id, PlotSlot.slot_number == 1)
            ).scalar_one_or_none()
            if slot and slot.current_deceased_id is None:
                slot.current_deceased_id = phuc.deceased_id
                slot.status = "OCCUPIED"
                plot_p.status = "OCCUPIED"
                print(f"  -> Da an tang Cu Nguyen Van Phuc vao o {plot_p.plot_code} - Slot 1")

        db.commit()
        print("[SUCCESS] Seeding Profiles & Death Certificates hoan tat 100%!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Loi khi seed profiles: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_profiles()
