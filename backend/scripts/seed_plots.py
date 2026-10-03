"""Seed idempotent plots, zones, rows, plot types and initial slots for Milestone M05.

Usage:
    uv run python scripts/seed_plots.py
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.modules.auth.models import User
from app.modules.plots.models import (
    Plot,
    PlotReservation,
    PlotSlot,
    PlotType,
    Row,
    Zone,
)


def seed_plots():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        print("🌱 Seeding Plot Types...")
        plot_types_data = [
            {
                "type_name": "Mộ Đơn Tiêu Chuẩn",
                "default_slots": 1,
                "length": Decimal("2.50"),
                "width": Decimal("1.20"),
                "description": "Huyệt mộ đơn tiêu chuẩn kích thước 2.5m x 1.2m, thích hợp an táng một lần",
            },
            {
                "type_name": "Mộ Đôi Kim Tĩnh",
                "default_slots": 2,
                "length": Decimal("3.00"),
                "width": Decimal("2.40"),
                "description": "Huyệt mộ đôi kết cấu bê tông cốt thép Kim Tĩnh kiên cố vĩnh cửu",
            },
            {
                "type_name": "Khuôn Viên Gia Tộc",
                "default_slots": 6,
                "length": Decimal("6.00"),
                "width": Decimal("5.00"),
                "description": "Khuôn viên gia tộc quy mô 6 phần mộ gia đình có tường hoa và tiểu cảnh",
            },
        ]

        type_map = {}
        for pt_data in plot_types_data:
            pt = db.query(PlotType).filter(PlotType.type_name == pt_data["type_name"]).first()
            if not pt:
                pt = PlotType(**pt_data)
                db.add(pt)
                db.flush()
                print(f"  + Tạo loại mộ: {pt.type_name} ({pt.default_slots} slots)")
            type_map[pt.type_name] = pt

        print("🌱 Seeding Zones & Rows...")
        zones_data = [
            {
                "zone_code": "KHU-A",
                "zone_name": "Khu Vạn Phúc (Mộ Đơn & Đôi)",
                "description": "Khu vực cảnh quan cây xanh, phong thủy hướng Đông đón ánh nắng sớm",
                "rows": ["HANG-01", "HANG-02", "HANG-03"],
            },
            {
                "zone_code": "KHU-B",
                "zone_name": "Khu An Viên (Kim Tĩnh Cao Cấp)",
                "description": "Khu vực đồi thoải nhìn ra hồ phong thủy, kết cấu nền móng Kim Tĩnh",
                "rows": ["HANG-01", "HANG-02"],
            },
            {
                "zone_code": "KHU-VIP",
                "zone_name": "Khu Gia Tộc Vĩnh Hằng",
                "description": "Khuôn viên cao cấp biệt lập dành cho các dòng họ và gia tộc lớn",
                "rows": ["HANG-01"],
            },
        ]

        row_map = {}
        for z_data in zones_data:
            zone = db.query(Zone).filter(Zone.zone_code == z_data["zone_code"]).first()
            if not zone:
                zone = Zone(
                    zone_code=z_data["zone_code"],
                    zone_name=z_data["zone_name"],
                    total_rows=len(z_data["rows"]),
                    description=z_data["description"],
                )
                db.add(zone)
                db.flush()
                print(f"  + Tạo khu: {zone.zone_code} - {zone.zone_name}")

            for r_code in z_data["rows"]:
                row = (
                    db.query(Row)
                    .filter(Row.zone_id == zone.zone_id, Row.row_code == r_code)
                    .first()
                )
                if not row:
                    row = Row(
                        zone_id=zone.zone_id,
                        row_code=r_code,
                        total_plots=0,
                    )
                    db.add(row)
                    db.flush()
                    print(f"    - Tạo hàng: {zone.zone_code} / {r_code}")
                row_map[f"{zone.zone_code}_{r_code}"] = row

        print("🌱 Seeding Plots with Real Coordinates & Slots...")
        # Base coordinates (Nghĩa trang sinh thái ven TP.HCM / Đồng Nai)
        base_lat = Decimal("10.925000")
        base_lng = Decimal("106.825000")

        plots_spec = [
            # Khu A - Hàng 1: Mộ đơn tiêu chuẩn
            (
                "KHU-A_HANG-01",
                "A-H01-01",
                "Mộ Đơn Tiêu Chuẩn",
                Decimal("0.000100"),
                Decimal("0.000050"),
                "ĐÔNG",
                False,
                "EMPTY_UNSOLD",
            ),
            (
                "KHU-A_HANG-01",
                "A-H01-02",
                "Mộ Đơn Tiêu Chuẩn",
                Decimal("0.000100"),
                Decimal("0.000100"),
                "ĐÔNG",
                False,
                "EMPTY_UNSOLD",
            ),
            (
                "KHU-A_HANG-01",
                "A-H01-03",
                "Mộ Đơn Tiêu Chuẩn",
                Decimal("0.000100"),
                Decimal("0.000150"),
                "ĐÔNG",
                False,
                "RESERVED",
            ),
            (
                "KHU-A_HANG-01",
                "A-H01-04",
                "Mộ Đơn Tiêu Chuẩn",
                Decimal("0.000100"),
                Decimal("0.000200"),
                "ĐÔNG",
                False,
                "EMPTY_UNSOLD",
            ),
            # Khu A - Hàng 2: Mộ đơn
            (
                "KHU-A_HANG-02",
                "A-H02-01",
                "Mộ Đơn Tiêu Chuẩn",
                Decimal("0.000200"),
                Decimal("0.000050"),
                "ĐÔNG",
                False,
                "EMPTY_UNSOLD",
            ),
            (
                "KHU-A_HANG-02",
                "A-H02-02",
                "Mộ Đơn Tiêu Chuẩn",
                Decimal("0.000200"),
                Decimal("0.000100"),
                "ĐÔNG",
                False,
                "EMPTY_UNSOLD",
            ),
            # Khu B - Hàng 1: Mộ đôi Kim Tĩnh
            (
                "KHU-B_HANG-01",
                "B-H01-01",
                "Mộ Đôi Kim Tĩnh",
                Decimal("0.000400"),
                Decimal("0.000050"),
                "NAM",
                True,
                "EMPTY_UNSOLD",
            ),
            (
                "KHU-B_HANG-01",
                "B-H01-02",
                "Mộ Đôi Kim Tĩnh",
                Decimal("0.000400"),
                Decimal("0.000120"),
                "NAM",
                True,
                "EMPTY_UNSOLD",
            ),
            (
                "KHU-B_HANG-01",
                "B-H01-03",
                "Mộ Đôi Kim Tĩnh",
                Decimal("0.000400"),
                Decimal("0.000190"),
                "NAM",
                True,
                "EMPTY_UNSOLD",
            ),
            # Khu VIP - Hàng 1: Khuôn viên gia tộc
            (
                "KHU-VIP_HANG-01",
                "VIP-H01-01",
                "Khuôn Viên Gia Tộc",
                Decimal("0.000700"),
                Decimal("0.000100"),
                "ĐÔNG NAM",
                True,
                "EMPTY_UNSOLD",
            ),
            (
                "KHU-VIP_HANG-01",
                "VIP-H01-02",
                "Khuôn Viên Gia Tộc",
                Decimal("0.000700"),
                Decimal("0.000300"),
                "ĐÔNG NAM",
                True,
                "EMPTY_UNSOLD",
            ),
        ]

        admin_user = db.query(User).filter(User.username == "admin").first()
        admin_id = admin_user.user_id if admin_user else 1

        for r_key, p_code, t_name, lat_offset, lng_offset, orient, is_kt, init_status in plots_spec:
            plot = db.query(Plot).filter(Plot.plot_code == p_code).first()
            row = row_map[r_key]
            pt = type_map[t_name]

            if not plot:
                plot = Plot(
                    plot_code=p_code,
                    row_id=row.row_id,
                    type_id=pt.type_id,
                    latitude=base_lat + lat_offset,
                    longitude=base_lng + lng_offset,
                    orientation=orient,
                    status=init_status,
                    is_kim_tinh=is_kt,
                    is_locked=False,
                    created_at=now,
                    updated_at=now,
                )
                db.add(plot)
                db.flush()

                # Generate slots
                for s_num in range(1, pt.default_slots + 1):
                    slot = PlotSlot(
                        plot_id=plot.plot_id,
                        slot_number=s_num,
                        status="EMPTY",
                        current_deceased_id=None,
                    )
                    db.add(slot)

                # If status is RESERVED, also create the active reservation record
                if init_status == "RESERVED":
                    res = PlotReservation(
                        plot_id=plot.plot_id,
                        reserved_by=admin_id,
                        customer_name="Trần Thị Mai Loan",
                        customer_phone="0918765432",
                        state="ACTIVE",
                        reserved_at=now,
                        expires_at=now + timedelta(hours=48),
                        notes="Khách hàng giữ chỗ chuẩn bị ký hợp đồng mua đất",
                    )
                    db.add(res)

                print(
                    f"  + Tạo ô mộ: {plot.plot_code} ({t_name}, {pt.default_slots} slots, Kim Tĩnh={is_kt})"
                )

        # Sync total_plots for all rows
        for row in row_map.values():
            row.total_plots = db.query(Plot).filter(Plot.row_id == row.row_id).count()

        db.commit()
        print("✅ Khởi tạo dữ liệu ô mộ, khu vực, hàng và slot thành công 100%!")

    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi khởi tạo seed plots: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_plots()
