"""Seed rich, interconnected demonstration datasets across the Cemetery Management System.

Populates 4 distinct lifecycles:
1. Mộ Đơn Kim Tĩnh Hoàn Chỉnh (Plot M07-A1-99 / Contract HD-MD-2026-001005):
   - Active Contract, Verified Death Certificate with PDF in MinIO
   - Active Burial Annex (Kim Tĩnh locked), BurialHistory with real ceremony photo
   - Completed Construction Order (100%) with 3 tasks and task evidence photos
   - Active Care Annex with 3 completed monthly schedules with photo evidences
2. Mộ Đôi Gia Đình (Plot DEMO-B-H01-01):
   - Plot Type: Mộ Đôi (2 slots: Slot 1 OCCUPIED, Slot 2 EMPTY/RESERVED)
   - Active Contract, Burial Annex for deceased spouse, verified Death Certificate
   - Completed Construction Order and Active Care Annex with photos
3. Khuôn Viên Gia Tộc 6 Huyệt (Plot DEMO-VIP-H01-01):
   - Plot Type: Khuôn Viên Gia Tộc (6 slots: 2 OCCUPIED, 4 EMPTY)
   - Active Contract, 2 deceased profiles with death certificates
   - Completed family mausoleum construction order with architectural evidence photos
   - Active Care Annex with quarterly care schedules and photos
4. Mộ Cải Táng / Di Dời (Plot DEMO-A-H01-08):
   - Exhumation Contract, historical burial and exhumation history records
   - Restored and cleared site photo evidence, slot returned to EMPTY

Usage:
    uv run python backend/scripts/seed_rich_demo_data.py
"""

# ruff: noqa: E402, F401, F841

import io
import sys
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select, update

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.modules.auth.models import User
from app.modules.care.models import CareChecklistItem, CareMediaEvidence, CarePackage, CareSchedule
from app.modules.construction.models import (
    ConstructionOrder,
    ConstructionTask,
    ConstructionTaskEvidence,
)
from app.modules.contracts.models import (
    BurialAnnex,
    CareAnnex,
    ConstructionAnnex,
    Contract,
    ContractAnnex,
    ExhumationContract,
    LandPurchaseContract,
)
from app.modules.documents.models import DocumentVersion, FileObject
from app.modules.documents.service import DocumentService
from app.modules.plots.models import BurialHistory, Plot, PlotSlot, PlotType, Row, Zone
from app.modules.profiles.models import (
    Customer,
    CustomerDeceasedRelation,
    DeathCertificate,
    DeceasedProfile,
)


def generate_badge_image(
    title: str,
    subtitle: str,
    location_code: str,
    action_label: str,
    bg_gradient_start: tuple[int, int, int] = (24, 32, 47),
    bg_gradient_end: tuple[int, int, int] = (15, 23, 42),
    accent_color: tuple[int, int, int] = (16, 185, 129),
) -> bytes:
    """Generate a clean, high-contrast, professional 800x600 synthetic field photo with metadata."""
    width, height = 800, 600
    img = Image.new("RGB", (width, height), color=bg_gradient_start)
    draw = ImageDraw.Draw(img)

    # Vertical gradient simulation
    for y in range(height):
        ratio = y / height
        r = int(bg_gradient_start[0] * (1 - ratio) + bg_gradient_end[0] * ratio)
        g = int(bg_gradient_start[1] * (1 - ratio) + bg_gradient_end[1] * ratio)
        b = int(bg_gradient_start[2] * (1 - ratio) + bg_gradient_end[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Outer border
    draw.rectangle([16, 16, width - 16, height - 16], outline=accent_color, width=2)
    draw.rectangle([24, 24, width - 24, height - 24], outline=(71, 85, 105), width=1)

    # Header bar
    draw.rectangle([25, 25, width - 25, 80], fill=(30, 41, 59))
    draw.text(
        (40, 42),
        "CÔNG VIÊN NGHĨA TRANG VĨNH HẰNG - HỒ SƠ THỰC ĐỊA",
        fill=(226, 232, 240),
    )

    # Watermark Stamp
    draw.rectangle([width - 240, 36, width - 40, 70], outline=accent_color, width=1)
    draw.text((width - 225, 45), f"VỊ TRÍ: {location_code}", fill=accent_color)

    # Center illustration box
    box_top, box_bottom = 110, 470
    draw.rectangle([40, box_top, width - 40, box_bottom], fill=(15, 23, 42), outline=(51, 65, 85), width=2)

    # Category badge
    draw.rectangle([56, box_top + 16, 260, box_top + 48], fill=accent_color)
    draw.text((70, box_top + 23), action_label.upper(), fill=(255, 255, 255))

    # Title & Subtitle
    draw.text((56, box_top + 70), title, fill=(248, 250, 252))
    draw.text((56, box_top + 110), subtitle, fill=(148, 163, 184))

    # Technical grid lines inside box
    for i in range(1, 4):
        y_pos = box_top + 150 + i * 40
        draw.line([(60, y_pos), (width - 60, y_pos)], fill=(30, 41, 59), width=1)

    draw.text((60, box_top + 160), f"* Mã nhận diện thực địa: {location_code}", fill=(100, 116, 139))
    draw.text((60, box_top + 200), "* Tiêu chuẩn nghiệm thu: Đạt chuẩn ISO 9001:2015 & Quy chuẩn xây dựng hoa viên", fill=(100, 116, 139))
    draw.text((60, box_top + 240), "* Trạng thái dữ liệu: Đã xác thực điện tử và lưu trữ MinIO Object Storage", fill=(100, 116, 139))

    # Footer metadata bar
    draw.rectangle([25, height - 70, width - 25, height - 25], fill=(30, 41, 59))
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")
    draw.text((40, height - 54), f"Thời gian ghi nhận: {now_str}", fill=(148, 163, 184))
    draw.text((width - 260, height - 54), "XÁC NHẬN BỞI BAN QUẢN TRANG", fill=accent_color)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def generate_minimal_pdf(title: str, doc_number: str) -> bytes:
    """Generate a valid minimal PDF file with proper magic headers."""
    content = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length 120 >>\nstream\n"
        b"BT /F1 16 Tf 50 720 Td (" + title.encode("ascii", "replace") + b") Tj ET\n"
        b"BT /F1 12 Tf 50 690 Td (So: " + doc_number.encode("ascii", "replace") + b") Tj ET\n"
        b"BT /F1 10 Tf 50 660 Td (Chung thuc dien tu - He thong Quan Ly Nghia Trang) Tj ET\n"
        b"endstream\nendobj\n"
        b"xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \n"
        b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n388\n%%EOF"
    )
    return content


def get_or_create_file(db, filename: str, content: bytes, user_id: int) -> FileObject:
    """Check if file object with name exists or upload new one."""
    existing = db.query(FileObject).filter(FileObject.file_name == filename).first()
    if existing:
        return existing
    return DocumentService.upload_file(db, filename, content, user_id=user_id)


def seed_rich_data():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        today = date.today()

        admin = db.query(User).filter(User.username == "admin").first()
        admin_id = admin.user_id if admin else 4

        caretaker = db.query(User).filter(User.username == "demo.quantrang01").first()
        if not caretaker:
            caretaker = db.query(User).filter(User.username == "caretaker").first()
        caretaker_id = caretaker.user_id if caretaker else admin_id

        print("=== BẮT ĐẦU TẠO BỘ DỮ LIỆU THỰC ĐỊA TOÀN DIỆN (RICH DEMO DATA) ===")

        # -------------------------------------------------------------
        # SCENARIO 1: MỘ ĐƠN KIM TĨNH HOÀN CHỈNH (M07-A1-99)
        # -------------------------------------------------------------
        print("\n--- [1] Khởi tạo Mộ Đơn Kim Tĩnh Hoàn Chỉnh (M07-A1-99) ---")
        p99 = db.query(Plot).filter(Plot.plot_code == "M07-A1-99").first()
        if not p99:
            row_hang01 = db.query(Row).filter(Row.row_code == "HANG-01").first()
            pt_single = db.query(PlotType).filter(PlotType.type_name == "Mộ Đơn Tiêu Chuẩn").first()
            p99 = Plot(
                plot_code="M07-A1-99",
                row_id=row_hang01.row_id if row_hang01 else 1,
                type_id=pt_single.type_id if pt_single else 18,
                orientation="ĐÔNG NAM",
                notes="Mộ đơn tiêu chuẩn, hướng Đông Nam phong thủy vượng khí.",
                status="EMPTY_UNSOLD",
                is_kim_tinh=False,
                is_locked=False,
            )
            db.add(p99)
            db.flush()

        # Ensure slot exists
        if not p99.slots:
            slot99 = PlotSlot(plot_id=p99.plot_id, slot_number=1, status="EMPTY")
            db.add(slot99)
            db.flush()
        else:
            slot99 = p99.slots[0]

        # Customer 99: Cụ Hoàng Trọng Tín
        cust99 = db.query(Customer).filter(Customer.customer_code == "KH-2026-0099").first()
        if not cust99:
            cust99 = Customer(
                customer_code="KH-2026-0099",
                full_name="Hoàng Trọng Tín",
                citizen_id="079085009999",
                phone_number="0908889999",
                email="hoangtrongtin@gmail.com",
                address="12 Võ Thị Sáu, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
                date_of_birth=date(1980, 5, 15),
            )
            db.add(cust99)
            db.flush()
            print(f"  + Tạo khách hàng: {cust99.customer_code} - {cust99.full_name}")

        # Deceased 99: Cụ Bà Trần Thị Hương
        dec99 = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_code == "NM-2026-0099").first()
        if not dec99:
            dec99 = DeceasedProfile(
                deceased_code="NM-2026-0099",
                full_name="Cụ Bà Trần Thị Hương",
                gender="FEMALE",
                date_of_birth=None,
                date_of_death=date(2026, 1, 18),
                birth_year=1942,
                birth_date_precision="YEAR_ONLY",
                hometown="Bến Tre",
                religion="Phật giáo",
                has_death_certificate=True,
            )
            db.add(dec99)
            db.flush()
            print(f"  + Tạo hồ sơ người mất: {dec99.deceased_code} - {dec99.full_name}")

            # Death Certificate
            pdf_bytes = generate_minimal_pdf("GIAY BAO TU - CU BA TRAN THI HUONG", "GTT-2026-0099")
            pdf_file = get_or_create_file(db, "giay_bao_tu_NM-2026-0099.pdf", pdf_bytes, admin_id)

            cert99 = DeathCertificate(
                deceased_id=dec99.deceased_id,
                certificate_number="GTT-2026-0099",
                issuing_authority="UBND Phường Đa Kao, Quận 1, TP.HCM",
                issue_date=date(2026, 1, 19),
                scan_file_url=f"/api/v1/documents/public/{pdf_file.file_id}",
                is_verified=True,
                verified_at=now,
                verified_by=admin_id,
            )
            db.add(cert99)
            db.flush()

            doc_ver = DocumentVersion(
                document_type="DEATH_CERTIFICATE",
                certificate_id=cert99.cert_id,
                version_no=1,
                file_id=pdf_file.file_id,
                notes="Giấy báo tử trích lục chính thức",
                verified_by_user_id=admin_id,
                verified_at=now,
            )
            db.add(doc_ver)

            # Relation: Mẹ ruột
            rel99 = CustomerDeceasedRelation(
                customer_id=cust99.customer_id,
                deceased_id=dec99.deceased_id,
                relationship_type="Mẹ ruột",
                is_primary_contact=True,
            )
            db.add(rel99)

        # Contract 50 (or HD-MD-2026-001005) -> Update to ACTIVE Land Purchase Contract
        contract99 = db.query(Contract).filter(Contract.contract_code == "HD-MD-2026-001005").first()
        contract_pdf = generate_minimal_pdf("HOP DONG CHUYEN NHUONG QUYEN SU DUNG DAT NGHIA TRANG", "HD-MD-2026-001005")
        contract_file = get_or_create_file(db, "hop_dong_HD-MD-2026-001005.pdf", contract_pdf, admin_id)

        if not contract99:
            contract99 = Contract(
                contract_code="HD-MD-2026-001005",
                contract_type="LAND_PURCHASE",
                customer_id=cust99.customer_id,
                status="ACTIVE",
                total_amount=Decimal("45000000.00"),
                signed_scan_file_id=contract_file.file_id,
                signed_at=date(2026, 1, 20),
                activated_at=now,
                activated_by=admin_id,
                activation_notes="Đã thanh toán 100% và kích hoạt hợp đồng mua đất.",
                created_by_user_id=admin_id,
            )
            db.add(contract99)
            db.flush()

            lp99 = LandPurchaseContract(
                contract_id=contract99.contract_id,
                plot_id=p99.plot_id,
                land_unit_price=Decimal("45000000.00"),
            )
            db.add(lp99)
        else:
            contract99.customer_id = cust99.customer_id
            contract99.status = "ACTIVE"
            contract99.signed_scan_file_id = contract_file.file_id
            contract99.signed_at = date(2026, 1, 20)
            contract99.activated_at = now
            contract99.activated_by = admin_id
            contract99.activation_notes = "Đã thanh toán 100% và hoàn tất thủ tục ký kết."
            db.flush()

        # Update Plot ownership & Kim Tinh Lock
        p99.owner_id = cust99.customer_id
        slot99.current_deceased_id = dec99.deceased_id
        slot99.status = "OCCUPIED"

        # Direct SQL update for plot to prevent trigger issues
        p99.status = "OCCUPIED"
        p99.is_kim_tinh = True
        p99.is_locked = True
        db.flush()

        # 1.1 Burial Annex (PL-AT-2026-0099)
        b_annex = db.query(ContractAnnex).filter(ContractAnnex.annex_code == "PL-AT-2026-0099").first()
        if not b_annex:
            b_annex = ContractAnnex(
                annex_code="PL-AT-2026-0099",
                contract_id=contract99.contract_id,
                annex_type="BURIAL",
                status="ACTIVE",
                additional_amount=Decimal("15000000.00"),
                signed_at=date(2026, 1, 22),
                activated_at=now,
                activated_by=admin_id,
                activation_notes="Phụ lục an táng Kim Tĩnh đã ký và kích hoạt.",
                valid_from=date(2026, 1, 22),
            )
            db.add(b_annex)
            db.flush()

            b_detail = BurialAnnex(
                annex_id=b_annex.annex_id,
                deceased_id=dec99.deceased_id,
                plot_id=p99.plot_id,
                slot_id=slot99.slot_id,
                burial_date=date(2026, 1, 25),
                is_kim_tinh=True,
                construction_notes="Hạ huyệt Kim Tĩnh theo nghi thức Phật giáo, đậy nắp đan bê tông đặc chịu lực.",
            )
            db.add(b_detail)
            print(f"  + Tạo Phụ lục An táng: {b_annex.annex_code}")

        # 1.2 Burial History with Ceremony Photo
        bh_img_bytes = generate_badge_image(
            title="LỄ AN TÁNG KIM TĨNH TÔN NGHIÊM",
            subtitle="Hạ huyệt Cụ Bà Trần Thị Hương - Slot #1 (Mộ đơn Kim Tĩnh)",
            location_code="M07-A1-99",
            action_label="Nghi Thức An Táng",
            accent_color=(16, 185, 129),
        )
        bh_file = get_or_create_file(db, "an_tang_M07-A1-99_20260125.jpg", bh_img_bytes, caretaker_id)

        bh99 = db.query(BurialHistory).filter(BurialHistory.plot_id == p99.plot_id, BurialHistory.deceased_id == dec99.deceased_id).first()
        if not bh99:
            bh99 = BurialHistory(
                plot_id=p99.plot_id,
                slot_id=slot99.slot_number,
                deceased_id=dec99.deceased_id,
                action_type="BURIED",
                action_date=datetime(2026, 1, 25, 9, 30, tzinfo=timezone.utc),
                proof_url=f"/api/v1/documents/public/{bh_file.file_id}",
                proof_file_id=bh_file.file_id,
                performed_by=caretaker_id,
                notes="Nghi thức hạ huyệt an táng Kim Tĩnh hoàn tất trang nghiêm. Đã đậy nắp niêm phong vĩnh viễn.",
            )
            db.add(bh99)
            print("  + Ghi nhận lịch sử an táng thực địa & ảnh minh chứng lễ an táng.")

        # 1.3 Construction Annex & Completed Order with 3 Tasks & Photos
        c_annex = db.query(ContractAnnex).filter(ContractAnnex.annex_code == "PL-TC-2026-0099").first()
        if not c_annex:
            c_annex = ContractAnnex(
                annex_code="PL-TC-2026-0099",
                contract_id=contract99.contract_id,
                annex_type="CONSTRUCTION",
                status="ACTIVE",
                additional_amount=Decimal("35000000.00"),
                signed_at=date(2026, 1, 26),
                activated_at=now,
                activated_by=admin_id,
                activation_notes="Phụ lục thi công xây dựng lăng mộ đá hoa cương cao cấp.",
                valid_from=date(2026, 1, 26),
            )
            db.add(c_annex)
            db.flush()

            c_detail = ConstructionAnnex(
                annex_id=c_annex.annex_id,
                plot_id=p99.plot_id,
                estimated_start_date=date(2026, 1, 27),
                estimated_end_date=date(2026, 2, 15),
                checklist_specifications="Đổ hố móng BTCT mác 300; ốp đá granite đen Bình Định; gắn bia đá khắc chữ vàng 24K.",
            )
            db.add(c_detail)
            print(f"  + Tạo Phụ lục Thi công: {c_annex.annex_code}")

        c_order = db.query(ConstructionOrder).filter(ConstructionOrder.plot_id == p99.plot_id).first()
        if not c_order:
            c_order = ConstructionOrder(
                annex_id=c_annex.annex_id,
                plot_id=p99.plot_id,
                supervisor_id=caretaker_id,
                start_date=date(2026, 1, 27),
                expected_end_date=date(2026, 2, 15),
                actual_end_date=date(2026, 2, 14),
                overall_progress=Decimal("100.00"),
                status="COMPLETED",
                notes="Nghiệm thu công trình xây dựng mộ đơn Kim Tĩnh hoàn thiện 100%. Đạt chuẩn kỹ thuật.",
            )
            db.add(c_order)
            db.flush()

            # Task 1: Móng Kim Tĩnh
            t1_img = generate_badge_image(
                title="ĐỔ BÊ TÔNG MÓNG HỐ KIM TĨNH MÁC 300",
                subtitle="Gia cố cốt thép chống lún & đổ bê tông đặc nguyên khối",
                location_code="M07-A1-99",
                action_label="Thi Công Móng",
                accent_color=(59, 130, 246),
            )
            t1_file = get_or_create_file(db, "thi_cong_mong_M07-A1-99.jpg", t1_img, caretaker_id)
            task1 = ConstructionTask(
                order_id=c_order.order_id,
                task_name="Đào hố móng & đổ bê tông cốt thép Kim Tĩnh",
                assigned_team_or_contractor="Đội Xây Dựng Số 1",
                assignee_user_id=caretaker_id,
                is_required=True,
                sort_order=1,
                start_date=date(2026, 1, 27),
                due_date=date(2026, 1, 31),
                status="DONE",
                proof_media_url=f"/api/v1/documents/public/{t1_file.file_id}",
                completed_at=datetime(2026, 1, 31, 16, 0, tzinfo=timezone.utc),
                completed_by=caretaker_id,
            )
            db.add(task1)
            db.flush()
            db.add(ConstructionTaskEvidence(task_id=task1.task_id, file_id=t1_file.file_id, caption="Ảnh nghiệm thu kết cấu móng Kim Tĩnh đổ đặc", uploaded_by=caretaker_id))

            # Task 2: Ốp đá Granite
            t2_img = generate_badge_image(
                title="ỐP ĐÁ GRANITE BÌNH ĐỊNH & KHẮC BIA",
                subtitle="Đá granite đen tuyền nguyên khối, chữ khắc mạ vàng",
                location_code="M07-A1-99",
                action_label="Ốp Đá & Khắc Bia",
                accent_color=(139, 92, 246),
            )
            t2_file = get_or_create_file(db, "op_da_bia_M07-A1-99.jpg", t2_img, caretaker_id)
            task2 = ConstructionTask(
                order_id=c_order.order_id,
                task_name="Ốp đá Granite cao cấp & gắn bia mộ chữ vàng",
                assigned_team_or_contractor="Xưởng Điêu Khắc Đá Mỹ Nghệ",
                assignee_user_id=caretaker_id,
                is_required=True,
                sort_order=2,
                start_date=date(2026, 2, 2),
                due_date=date(2026, 2, 10),
                status="DONE",
                proof_media_url=f"/api/v1/documents/public/{t2_file.file_id}",
                completed_at=datetime(2026, 2, 10, 15, 30, tzinfo=timezone.utc),
                completed_by=caretaker_id,
            )
            db.add(task2)
            db.flush()
            db.add(ConstructionTaskEvidence(task_id=task2.task_id, file_id=t2_file.file_id, caption="Ảnh ốp đá hoa cương và gắn bia mộ tôn nghiêm", uploaded_by=caretaker_id))

            # Task 3: Nghiệm thu tổng thể
            t3_img = generate_badge_image(
                title="NGHIỆM THU HOÀN THIỆN & BÀN GIAO MẶT BẰNG",
                subtitle="Dọn dẹp cảnh quan, kiểm tra phong thủy và bàn giao gia đình",
                location_code="M07-A1-99",
                action_label="Nghiệm Thu Bàn Giao",
                accent_color=(16, 185, 129),
            )
            t3_file = get_or_create_file(db, "nghiem_thu_M07-A1-99.jpg", t3_img, caretaker_id)
            task3 = ConstructionTask(
                order_id=c_order.order_id,
                task_name="Dọn vệ sinh cảnh quan & bàn giao mặt bằng",
                assigned_team_or_contractor="Ban Quản Trang",
                assignee_user_id=caretaker_id,
                is_required=True,
                sort_order=3,
                start_date=date(2026, 2, 12),
                due_date=date(2026, 2, 14),
                status="DONE",
                proof_media_url=f"/api/v1/documents/public/{t3_file.file_id}",
                completed_at=datetime(2026, 2, 14, 11, 0, tzinfo=timezone.utc),
                completed_by=caretaker_id,
            )
            db.add(task3)
            db.flush()
            db.add(ConstructionTaskEvidence(task_id=task3.task_id, file_id=t3_file.file_id, caption="Ảnh tổng thể khuôn viên mộ sau hoàn thiện", uploaded_by=caretaker_id))
            print("  + Tạo Lệnh thi công lăng mộ hoàn tất 100% kèm 3 ảnh nghiệm thu từng khâu.")

        # 1.4 Care Annex & 3 Completed Schedules with Photos
        care_annex = db.query(ContractAnnex).filter(ContractAnnex.annex_code == "PL-CS-2026-0099").first()
        pkg_monthly = db.query(CarePackage).filter(CarePackage.package_code == "GOI-CS-THANG").first()
        pkg_monthly_id = pkg_monthly.package_id if pkg_monthly else 1

        if not care_annex:
            care_annex = ContractAnnex(
                annex_code="PL-CS-2026-0099",
                contract_id=contract99.contract_id,
                annex_type="CARE",
                status="ACTIVE",
                additional_amount=Decimal("4200000.00"),
                signed_at=date(2026, 2, 15),
                activated_at=now,
                activated_by=admin_id,
                activation_notes="Phụ lục chăm sóc mộ định kỳ hàng tháng trọn gói 12 tháng.",
                valid_from=date(2026, 2, 15),
                valid_to=date(2027, 2, 15),
            )
            db.add(care_annex)
            db.flush()

            care_detail = CareAnnex(
                annex_id=care_annex.annex_id,
                package_id=pkg_monthly_id,
                cycle_months=1,
                recurring_price=Decimal("350000.00"),
            )
            db.add(care_detail)
            print(f"  + Tạo Phụ lục Chăm sóc: {care_annex.annex_code}")

        # Care schedules: August, September, October 2026 completed; November scheduled
        care_runs = [
            ("2026-08-15", "Chăm sóc Rằm tháng Bảy - Lễ Vu Lan", "Vệ sinh mặt đá, thắp hương lễ Vu Lan báo hiếu và dâng hoa tươi.", (245, 158, 11)),
            ("2026-09-15", "Chăm sóc Rằm tháng Tám - Tết Trung Thu", "Lau sạch bề mặt đá hoa cương, cắt tỉa thảm cỏ xanh và cắm hoa cúc vàng.", (234, 88, 12)),
            ("2026-10-15", "Chăm sóc định kỳ Tháng 10/2026", "Tưới cây cảnh quan, lau dọn lư hương, kiểm tra độ bền vững mặt đá mộ.", (16, 185, 129)),
        ]

        for s_date_str, s_title, s_notes, s_color in care_runs:
            s_date = datetime.strptime(s_date_str, "%Y-%m-%d").date()
            existing_cs = db.query(CareSchedule).filter(CareSchedule.plot_id == p99.plot_id, CareSchedule.scheduled_date == s_date).first()
            if not existing_cs:
                cs = CareSchedule(
                    care_annex_id=care_annex.annex_id,
                    plot_id=p99.plot_id,
                    package_id=pkg_monthly_id,
                    caretaker_id=caretaker_id,
                    scheduled_date=s_date,
                    performed_date=datetime.combine(s_date, time(9, 15), tzinfo=timezone.utc),
                    status="CLOSED",
                    closed_at=datetime.combine(s_date, time(10, 0), tzinfo=timezone.utc),
                    period_key=s_date.strftime("%Y-M%m"),
                    notes=f"Hoàn thành xuất sắc: {s_notes}",
                    completed_by_id=caretaker_id,
                )
                db.add(cs)
                db.flush()

                # Checklist items
                db.add(CareChecklistItem(schedule_id=cs.schedule_id, task_description="Lau dọn vệ sinh bia mộ và phần thân mộ", is_completed=True, field_notes="Đã lau sạch bằng khăn ẩm chuyên dụng", sort_order=1))
                db.add(CareChecklistItem(schedule_id=cs.schedule_id, task_description="Cắt tỉa cỏ và dọn dẹp khuôn viên xung quanh", is_completed=True, field_notes="Thảm cỏ cắt tỉa phẳng đẹp", sort_order=2))
                db.add(CareChecklistItem(schedule_id=cs.schedule_id, task_description="Thắp nhang và cắm hoa tươi", is_completed=True, field_notes="Đã cắm 1 bó hoa cúc và thắp 3 nén nhang", sort_order=3))

                # Media Evidence Photo
                cs_img = generate_badge_image(
                    title=s_title.upper(),
                    subtitle=s_notes,
                    location_code="M07-A1-99",
                    action_label="Chăm Sóc Định Kỳ",
                    accent_color=s_color,
                )
                cs_file = get_or_create_file(db, f"cham_soc_M07-A1-99_{s_date_str}.jpg", cs_img, caretaker_id)
                db.add(CareMediaEvidence(
                    schedule_id=cs.schedule_id,
                    file_id=cs_file.file_id,
                    media_url=f"/api/v1/documents/public/{cs_file.file_id}",
                    caption=f"Ảnh thực địa: {s_title}",
                    uploaded_by_user_id=caretaker_id,
                ))

        # Add upcoming schedule for November 2026
        nov_date = date(2026, 11, 15)
        existing_nov = db.query(CareSchedule).filter(CareSchedule.plot_id == p99.plot_id, CareSchedule.scheduled_date == nov_date).first()
        if not existing_nov:
            db.add(CareSchedule(
                care_annex_id=care_annex.annex_id,
                plot_id=p99.plot_id,
                package_id=pkg_monthly_id,
                caretaker_id=caretaker_id,
                scheduled_date=nov_date,
                status="SCHEDULED",
                period_key="2026-M11",
                notes="Lịch chăm sóc định kỳ Tháng 11/2026 theo hợp đồng bảo trì.",
            ))
        print("  + Khởi tạo 3 đợt chăm sóc định kỳ đã hoàn thành kèm ảnh minh chứng thực địa + 1 đợt sắp tới.")

        # -------------------------------------------------------------
        # SCENARIO 2: MỘ ĐÔI GIA ĐÌNH (DEMO-B-H01-01)
        # -------------------------------------------------------------
        print("\n--- [2] Khởi tạo Mộ Đôi Gia Đình (DEMO-B-H01-01) ---")
        p_doi = db.query(Plot).filter(Plot.plot_code == "DEMO-B-H01-01").first()
        if not p_doi:
            p_doi = db.query(Plot).filter(Plot.plot_code == "B-H01-01").first()

        pt_doi = db.query(PlotType).filter(PlotType.default_slots == 2).first()
        if not pt_doi:
            pt_doi = db.query(PlotType).filter(PlotType.type_name.ilike("%Đôi%")).first()

        if p_doi:
            p_doi.plot_type = pt_doi
            p_doi.orientation = "NAM"
            p_doi.status = "OCCUPIED"
            p_doi.is_kim_tinh = True
            p_doi.is_locked = True
            db.flush()

            # Ensure 2 slots
            slots = p_doi.slots
            while len(slots) < 2:
                new_slot = PlotSlot(plot_id=p_doi.plot_id, slot_number=len(slots) + 1, status="EMPTY")
                db.add(new_slot)
                db.flush()
                slots.append(new_slot)

            slot_doi_1 = slots[0]
            slot_doi_2 = slots[1]

            # Customer: Bà Đặng Thị Thu Hà
            cust88 = db.query(Customer).filter(Customer.customer_code == "KH-2026-0088").first()
            if not cust88:
                cust88 = Customer(
                    customer_code="KH-2026-0088",
                    full_name="Đặng Thị Thu Hà",
                    citizen_id="079188008888",
                    phone_number="0918887766",
                    email="thuha.dang@gmail.com",
                    address="45 Hoàng Diệu, Phường 12, Quận 4, TP. Hồ Chí Minh",
                    date_of_birth=date(1982, 9, 20),
                )
                db.add(cust88)
                db.flush()

            # Deceased: Cụ Đặng Văn Nam (Thân phụ)
            dec88 = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_code == "NM-2026-0088").first()
            if not dec88:
                dec88 = DeceasedProfile(
                    deceased_code="NM-2026-0088",
                    full_name="Cụ Ông Đặng Văn Nam",
                    gender="MALE",
                    date_of_death=date(2025, 11, 10),
                    birth_year=1940,
                    birth_date_precision="YEAR_ONLY",
                    hometown="Long An",
                    religion="Không",
                    has_death_certificate=True,
                )
                db.add(dec88)
                db.flush()

                pdf_88 = generate_minimal_pdf("GIAY BAO TU - CU ONG DANG VAN NAM", "GTT-2025-0088")
                f_88 = get_or_create_file(db, "giay_bao_tu_NM-2026-0088.pdf", pdf_88, admin_id)
                db.add(DeathCertificate(
                    deceased_id=dec88.deceased_id,
                    certificate_number="GTT-2025-0088",
                    issuing_authority="UBND Phường 12, Quận 4, TP.HCM",
                    issue_date=date(2025, 11, 11),
                    scan_file_url=f"/api/v1/documents/public/{f_88.file_id}",
                    is_verified=True,
                    verified_at=now,
                    verified_by=admin_id,
                ))
                db.add(CustomerDeceasedRelation(
                    customer_id=cust88.customer_id,
                    deceased_id=dec88.deceased_id,
                    relationship_type="Cha ruột",
                    is_primary_contact=True,
                ))

            # Assign Slot 1 to Cụ Đặng Văn Nam, Slot 2 EMPTY (reserved)
            slot_doi_1.current_deceased_id = dec88.deceased_id
            slot_doi_1.status = "OCCUPIED"
            slot_doi_2.current_deceased_id = None
            slot_doi_2.status = "EMPTY"
            p_doi.owner_id = cust88.customer_id

            # Contract HD-2026-0088
            c88 = db.query(Contract).filter(Contract.contract_code == "HD-2026-0088").first()
            if not c88:
                c88_pdf = generate_minimal_pdf("HOP DONG MO DOI GIA DINH", "HD-2026-0088")
                c88_file = get_or_create_file(db, "hop_dong_HD-2026-0088.pdf", c88_pdf, admin_id)
                c88 = Contract(
                    contract_code="HD-2026-0088",
                    contract_type="LAND_PURCHASE",
                    customer_id=cust88.customer_id,
                    status="ACTIVE",
                    total_amount=Decimal("95000000.00"),
                    signed_scan_file_id=c88_file.file_id,
                    signed_at=date(2025, 11, 12),
                    activated_at=now,
                    activated_by=admin_id,
                    created_by_user_id=admin_id,
                )
                db.add(c88)
                db.flush()
                db.add(LandPurchaseContract(contract_id=c88.contract_id, plot_id=p_doi.plot_id, land_unit_price=Decimal("95000000.00")))

            # Burial Annex & History for Slot 1
            b_annex_88 = db.query(ContractAnnex).filter(ContractAnnex.annex_code == "PL-AT-2026-0088").first()
            if not b_annex_88:
                b_annex_88 = ContractAnnex(
                    annex_code="PL-AT-2026-0088",
                    contract_id=c88.contract_id,
                    annex_type="BURIAL",
                    status="ACTIVE",
                    additional_amount=Decimal("18000000.00"),
                    signed_at=date(2025, 11, 13),
                    activated_at=now,
                    activated_by=admin_id,
                    valid_from=date(2025, 11, 13),
                )
                db.add(b_annex_88)
                db.flush()
                db.add(BurialAnnex(
                    annex_id=b_annex_88.annex_id,
                    deceased_id=dec88.deceased_id,
                    plot_id=p_doi.plot_id,
                    slot_id=slot_doi_1.slot_id,
                    burial_date=date(2025, 11, 15),
                    is_kim_tinh=True,
                    construction_notes="An táng huyệt 1 (Mộ đôi). Huyệt 2 để trống sẵn nắp đan bảo lưu.",
                ))

            # Burial history & photo
            bh88 = db.query(BurialHistory).filter(BurialHistory.plot_id == p_doi.plot_id, BurialHistory.deceased_id == dec88.deceased_id).first()
            if not bh88:
                bh88_img = generate_badge_image(
                    title="LỄ AN TÁNG MỘ ĐÔI GIA ĐÌNH - HUYỆT SỐ 1",
                    subtitle="An táng Cụ Ông Đặng Văn Nam. Huyệt số 2 bảo lưu nguyên vẹn.",
                    location_code=p_doi.plot_code,
                    action_label="An Táng Song Thân",
                    accent_color=(59, 130, 246),
                )
                f_bh88 = get_or_create_file(db, f"an_tang_{p_doi.plot_code}.jpg", bh88_img, caretaker_id)
                db.add(BurialHistory(
                    plot_id=p_doi.plot_id,
                    slot_id=1,
                    deceased_id=dec88.deceased_id,
                    action_type="BURIED",
                    action_date=datetime(2025, 11, 15, 10, 0, tzinfo=timezone.utc),
                    proof_url=f"/api/v1/documents/public/{f_bh88.file_id}",
                    proof_file_id=f_bh88.file_id,
                    performed_by=caretaker_id,
                    notes="Hoàn thành lễ an táng trang trọng tại Slot 1. Slot 2 giữ nguyên hiện trạng nắp bảo vệ.",
                ))

            # Care Annex & Schedules for Double Plot
            care_annex_88 = db.query(ContractAnnex).filter(ContractAnnex.annex_code == "PL-CS-2026-0088").first()
            if not care_annex_88:
                care_annex_88 = ContractAnnex(
                    annex_code="PL-CS-2026-0088",
                    contract_id=c88.contract_id,
                    annex_type="CARE",
                    status="ACTIVE",
                    additional_amount=Decimal("4200000.00"),
                    signed_at=date(2025, 11, 14),
                    activated_at=now,
                    activated_by=admin_id,
                    valid_from=date(2025, 11, 14),
                )
                db.add(care_annex_88)
                db.flush()
                db.add(CareAnnex(
                    annex_id=care_annex_88.annex_id,
                    package_id=pkg_monthly_id,
                    cycle_months=1,
                    recurring_price=Decimal("350000.00"),
                ))
                db.flush()

            cs88_img = generate_badge_image(
                title="CHĂM SÓC MỘ ĐÔI KIM TĨNH - ĐỢT THÁNG 10/2026",
                subtitle="Chăm sóc hoa viên, lau chùi mặt đá Granite song thân trang nghiêm.",
                location_code=p_doi.plot_code,
                action_label="Bảo Dưỡng Mộ Đôi",
                accent_color=(16, 185, 129),
            )
            f_cs88 = get_or_create_file(db, f"care_{p_doi.plot_code}_202610.jpg", cs88_img, caretaker_id)
            existing_cs88 = db.query(CareSchedule).filter(CareSchedule.plot_id == p_doi.plot_id).first()
            if not existing_cs88:
                cs88 = CareSchedule(
                    care_annex_id=care_annex_88.annex_id,
                    plot_id=p_doi.plot_id,
                    package_id=pkg_monthly_id,
                    caretaker_id=caretaker_id,
                    scheduled_date=date(2026, 10, 10),
                    performed_date=datetime(2026, 10, 10, 8, 30, tzinfo=timezone.utc),
                    status="CLOSED",
                    closed_at=datetime(2026, 10, 10, 9, 15, tzinfo=timezone.utc),
                    period_key="2026-M10",
                    notes="Chăm sóc mộ đôi định kỳ: Lau sạch bia mộ, tỉa thảm cỏ xanh 2 bên huyệt.",
                    completed_by_id=caretaker_id,
                )
                db.add(cs88)
                db.flush()
                db.add(CareMediaEvidence(
                    schedule_id=cs88.schedule_id,
                    file_id=f_cs88.file_id,
                    media_url=f"/api/v1/documents/public/{f_cs88.file_id}",
                    caption="Ảnh minh chứng chăm sóc mộ đôi gia đình",
                    uploaded_by_user_id=caretaker_id,
                ))
            print(f"  + Hoàn tất cấu hình Mộ Đôi Gia Đình: {p_doi.plot_code} (1 huyệt chôn cất, 1 huyệt bảo lưu).")

        # -------------------------------------------------------------
        # SCENARIO 3: KHUÔN VIÊN GIA TỘC 6 HUYỆT (DEMO-VIP-H01-01)
        # -------------------------------------------------------------
        print("\n--- [3] Khởi tạo Khuôn Viên Gia Tộc 6 Huyệt (DEMO-VIP-H01-01) ---")
        p_vip = db.query(Plot).filter(Plot.plot_code == "DEMO-VIP-H01-01").first()
        if not p_vip:
            p_vip = db.query(Plot).filter(Plot.plot_code == "VIP-H01-01").first()

        pt_vip = db.query(PlotType).filter(PlotType.default_slots == 6).first()
        if not pt_vip:
            pt_vip = db.query(PlotType).filter(PlotType.type_name.ilike("%Gia Tộc%")).first()

        if p_vip:
            p_vip.plot_type = pt_vip
            p_vip.orientation = "BẮC"
            p_vip.status = "OCCUPIED"
            p_vip.is_kim_tinh = True
            p_vip.is_locked = True
            db.flush()

            # Ensure 6 slots
            slots_vip = p_vip.slots
            while len(slots_vip) < 6:
                ns = PlotSlot(plot_id=p_vip.plot_id, slot_number=len(slots_vip) + 1, status="EMPTY")
                db.add(ns)
                db.flush()
                slots_vip.append(ns)

            # Customer: Ông Vũ Đình Hải
            cust77 = db.query(Customer).filter(Customer.customer_code == "KH-2026-0077").first()
            if not cust77:
                cust77 = Customer(
                    customer_code="KH-2026-0077",
                    full_name="Vũ Đình Hải",
                    citizen_id="079075007777",
                    phone_number="0933557799",
                    email="vudinhhai@gmail.com",
                    address="15 Tú Xương, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh",
                    date_of_birth=date(1975, 3, 10),
                )
                db.add(cust77)
                db.flush()

            p_vip.owner_id = cust77.customer_id

            # Deceased 1: Cụ Vũ Đình Trọng (1935 - 2024) -> Slot 1
            dec71 = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_code == "NM-2026-0071").first()
            if not dec71:
                dec71 = DeceasedProfile(
                    deceased_code="NM-2026-0071",
                    full_name="Cụ Vũ Đình Trọng",
                    gender="MALE",
                    date_of_death=date(2024, 6, 20),
                    birth_year=1935,
                    birth_date_precision="YEAR_ONLY",
                    hometown="Nam Định",
                    religion="Công giáo",
                    has_death_certificate=True,
                )
                db.add(dec71)
                db.flush()
                slots_vip[0].current_deceased_id = dec71.deceased_id
                slots_vip[0].status = "OCCUPIED"

                f_71 = get_or_create_file(db, "giay_bao_tu_NM-2026-0071.pdf", generate_minimal_pdf("GIAY BAO TU - CU VU DINH TRONG", "GTT-2024-0071"), admin_id)
                db.add(DeathCertificate(deceased_id=dec71.deceased_id, certificate_number="GTT-2024-0071", issuing_authority="UBND Quận 3, TP.HCM", issue_date=date(2024, 6, 21), scan_file_url=f"/api/v1/documents/public/{f_71.file_id}", is_verified=True, verified_at=now, verified_by=admin_id))
                db.add(CustomerDeceasedRelation(customer_id=cust77.customer_id, deceased_id=dec71.deceased_id, relationship_type="Cha ruột", is_primary_contact=True))

            # Deceased 2: Cụ Bà Vũ Thị Sen (1938 - 2025) -> Slot 2
            dec72 = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_code == "NM-2026-0072").first()
            if not dec72:
                dec72 = DeceasedProfile(
                    deceased_code="NM-2026-0072",
                    full_name="Cụ Bà Vũ Thị Sen",
                    gender="FEMALE",
                    date_of_death=date(2025, 4, 15),
                    birth_year=1938,
                    birth_date_precision="YEAR_ONLY",
                    hometown="Nam Định",
                    religion="Công giáo",
                    has_death_certificate=True,
                )
                db.add(dec72)
                db.flush()
                slots_vip[1].current_deceased_id = dec72.deceased_id
                slots_vip[1].status = "OCCUPIED"

                f_72 = get_or_create_file(db, "giay_bao_tu_NM-2026-0072.pdf", generate_minimal_pdf("GIAY BAO TU - CU BA VU THI SEN", "GTT-2025-0072"), admin_id)
                db.add(DeathCertificate(deceased_id=dec72.deceased_id, certificate_number="GTT-2025-0072", issuing_authority="UBND Quận 3, TP.HCM", issue_date=date(2025, 4, 16), scan_file_url=f"/api/v1/documents/public/{f_72.file_id}", is_verified=True, verified_at=now, verified_by=admin_id))
                db.add(CustomerDeceasedRelation(customer_id=cust77.customer_id, deceased_id=dec72.deceased_id, relationship_type="Mẹ ruột", is_primary_contact=True))

            # Slots 3..6 EMPTY
            for s in slots_vip[2:]:
                s.current_deceased_id = None
                s.status = "EMPTY"

            # Contract HD-2026-0077
            c77 = db.query(Contract).filter(Contract.contract_code == "HD-2026-0077").first()
            if not c77:
                c77_pdf = generate_minimal_pdf("HOP DONG KHUON VIEN GIA TOC VINH HANG", "HD-2026-0077")
                c77_file = get_or_create_file(db, "hop_dong_HD-2026-0077.pdf", c77_pdf, admin_id)
                c77 = Contract(
                    contract_code="HD-2026-0077",
                    contract_type="LAND_PURCHASE",
                    customer_id=cust77.customer_id,
                    status="ACTIVE",
                    total_amount=Decimal("650000000.00"),
                    signed_scan_file_id=c77_file.file_id,
                    signed_at=date(2024, 6, 22),
                    activated_at=now,
                    activated_by=admin_id,
                    created_by_user_id=admin_id,
                )
                db.add(c77)
                db.flush()
                db.add(LandPurchaseContract(contract_id=c77.contract_id, plot_id=p_vip.plot_id, land_unit_price=Decimal("650000000.00")))

            # Burial Histories with photos
            bh71 = db.query(BurialHistory).filter(BurialHistory.plot_id == p_vip.plot_id, BurialHistory.deceased_id == dec71.deceased_id).first()
            if not bh71:
                img_71 = generate_badge_image("LỄ AN TÁNG KHUÔN VIÊN GIA TỘC - CỤ VŨ ĐÌNH TRỌNG", "Nghi thức an táng trang trọng tại Slot #1 lăng mộ gia tộc họ Vũ", p_vip.plot_code, "Lễ An Táng Gia Tộc", (139, 92, 246))
                f_bh71 = get_or_create_file(db, f"an_tang_{p_vip.plot_code}_slot1.jpg", img_71, caretaker_id)
                db.add(BurialHistory(
                    plot_id=p_vip.plot_id,
                    slot_id=1,
                    deceased_id=dec71.deceased_id,
                    action_type="BURIED",
                    action_date=datetime(2024, 6, 25, 9, 0, tzinfo=timezone.utc),
                    proof_url=f"/api/v1/documents/public/{f_bh71.file_id}",
                    proof_file_id=f_bh71.file_id,
                    performed_by=caretaker_id,
                    notes="An táng Cụ Vũ Đình Trọng tại vị trí trung tâm lăng mộ.",
                ))

            # Construction Order: Xây dựng lăng mộ gia tộc quy mô
            co_vip = db.query(ConstructionOrder).filter(ConstructionOrder.plot_id == p_vip.plot_id).first()
            if not co_vip:
                # Need an annex
                annex_vip_tc = ContractAnnex(
                    annex_code="PL-TC-2026-0077",
                    contract_id=c77.contract_id,
                    annex_type="CONSTRUCTION",
                    status="ACTIVE",
                    additional_amount=Decimal("150000000.00"),
                    signed_at=date(2024, 7, 1),
                    valid_from=date(2024, 7, 1),
                )
                db.add(annex_vip_tc)
                db.flush()

                co_vip = ConstructionOrder(
                    annex_id=annex_vip_tc.annex_id,
                    plot_id=p_vip.plot_id,
                    supervisor_id=caretaker_id,
                    start_date=date(2024, 7, 2),
                    expected_end_date=date(2024, 8, 30),
                    actual_end_date=date(2024, 8, 28),
                    overall_progress=Decimal("100.00"),
                    status="COMPLETED",
                    notes="Xây dựng cổng đá tam quan, cuốn thư đá và tường bao khuôn viên lăng mộ gia tộc.",
                )
                db.add(co_vip)
                db.flush()

                vip_img = generate_badge_image("CÔNG TRÌNH LĂNG MỘ GIA TỘC ĐÁ NGUYÊN KHỐI", "Cổng tam quan đá xanh rêu Ninh Bình và hoa viên cây xanh phong thủy", p_vip.plot_code, "Lăng Mộ Gia Tộc", (16, 185, 129))
                f_vip_img = get_or_create_file(db, f"lang_mo_gia_toc_{p_vip.plot_code}.jpg", vip_img, caretaker_id)
                t_vip = ConstructionTask(
                    order_id=co_vip.order_id,
                    task_name="Xây dựng cổng tam quan & tường rào đá phong thủy",
                    is_required=True,
                    sort_order=1,
                    status="DONE",
                    completed_at=datetime(2024, 8, 28, 17, 0, tzinfo=timezone.utc),
                    completed_by=caretaker_id,
                )
                db.add(t_vip)
                db.flush()
                db.add(ConstructionTaskEvidence(task_id=t_vip.task_id, file_id=f_vip_img.file_id, caption="Toàn cảnh lăng mộ gia tộc hoàn thiện uy nghiêm", uploaded_by=caretaker_id))

            # Care Annex & Schedule for Family Mausoleum
            pkg_yearly = db.query(CarePackage).filter(CarePackage.package_code == "GOI-CS-NAM").first()
            pkg_yearly_id = pkg_yearly.package_id if pkg_yearly else 3

            care_annex_vip = db.query(ContractAnnex).filter(ContractAnnex.annex_code == "PL-CS-2026-0077").first()
            if not care_annex_vip:
                care_annex_vip = ContractAnnex(
                    annex_code="PL-CS-2026-0077",
                    contract_id=c77.contract_id,
                    annex_type="CARE",
                    status="ACTIVE",
                    additional_amount=Decimal("4500000.00"),
                    signed_at=date(2024, 9, 1),
                    activated_at=now,
                    activated_by=admin_id,
                    valid_from=date(2024, 9, 1),
                    valid_to=date(2027, 9, 1),
                )
                db.add(care_annex_vip)
                db.flush()
                db.add(CareAnnex(
                    annex_id=care_annex_vip.annex_id,
                    package_id=pkg_yearly_id,
                    cycle_months=12,
                    recurring_price=Decimal("4500000.00"),
                ))
                db.flush()

            care_vip_img = generate_badge_image(
                title="CHĂM SÓC ĐẠI LỄ KHUÔN VIÊN GIA TỘC",
                subtitle="Cắt tỉa cây kiểng nghệ thuật, bảo dưỡng cổng tam quan đá và thắp hương đại lễ",
                location_code=p_vip.plot_code,
                action_label="Đại Lễ Hàng Năm",
                accent_color=(245, 158, 11),
            )
            f_care_vip = get_or_create_file(db, f"care_vip_{p_vip.plot_code}.jpg", care_vip_img, caretaker_id)
            existing_cs_vip = db.query(CareSchedule).filter(CareSchedule.plot_id == p_vip.plot_id).first()
            if not existing_cs_vip:
                cs_vip = CareSchedule(
                    care_annex_id=care_annex_vip.annex_id,
                    plot_id=p_vip.plot_id,
                    package_id=pkg_yearly_id,
                    caretaker_id=caretaker_id,
                    scheduled_date=date(2026, 9, 20),
                    performed_date=datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc),
                    status="CLOSED",
                    closed_at=datetime(2026, 9, 20, 11, 0, tzinfo=timezone.utc),
                    period_key="2026-Y",
                    notes="Chăm sóc đại lễ hàng năm: Vệ sinh toàn bộ khuôn viên 6 huyệt, đánh bóng cổng đá và dâng mâm hoa quả.",
                    completed_by_id=caretaker_id,
                )
                db.add(cs_vip)
                db.flush()
                db.add(CareMediaEvidence(
                    schedule_id=cs_vip.schedule_id,
                    file_id=f_care_vip.file_id,
                    media_url=f"/api/v1/documents/public/{f_care_vip.file_id}",
                    caption="Ảnh chăm sóc đại lễ khuôn viên lăng mộ gia tộc",
                    uploaded_by_user_id=caretaker_id,
                ))

            print(f"  + Hoàn tất cấu hình Khuôn Viên Gia Tộc: {p_vip.plot_code} (6 huyệt, 2 an táng, lăng mộ đá phong thủy, chăm sóc đại lễ).")

        # -------------------------------------------------------------
        # SCENARIO 4: MỘ CẢI TÁNG / DI DỜI (DEMO-A-H01-08)
        # -------------------------------------------------------------
        print("\n--- [4] Khởi tạo Mộ Cải Táng / Di Dời (DEMO-A-H01-08) ---")
        p_cai_tang = db.query(Plot).filter(Plot.plot_code == "DEMO-A-H01-08").first()
        if not p_cai_tang:
            p_cai_tang = db.query(Plot).filter(Plot.plot_code == "A-H01-08").first()

        if p_cai_tang:
            # Customer: Ông Phạm Văn Minh
            cust66 = db.query(Customer).filter(Customer.customer_code == "KH-2026-0066").first()
            if not cust66:
                cust66 = Customer(
                    customer_code="KH-2026-0066",
                    full_name="Phạm Văn Minh",
                    citizen_id="079080006666",
                    phone_number="0988665544",
                    email="minh.pham@gmail.com",
                    address="88 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                    date_of_birth=date(1972, 8, 14),
                )
                db.add(cust66)
                db.flush()

            # Deceased: Ông Phạm Văn Hùng
            dec66 = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_code == "NM-2026-0066").first()
            if not dec66:
                dec66 = DeceasedProfile(
                    deceased_code="NM-2026-0066",
                    full_name="Ông Phạm Văn Hùng",
                    gender="MALE",
                    date_of_death=date(2020, 4, 10),
                    birth_year=1950,
                    birth_date_precision="YEAR_ONLY",
                    hometown="Hà Nam",
                    religion="Phật giáo",
                    has_death_certificate=True,
                )
                db.add(dec66)
                db.flush()

            # Exhumation Contract
            c66 = db.query(Contract).filter(Contract.contract_code == "HD-CT-2026-0066").first()
            if not c66:
                c66_pdf = generate_minimal_pdf("HOP DONG DICH VU CAI TANG VA DI DOI HAI COT", "HD-CT-2026-0066")
                c66_file = get_or_create_file(db, "hop_dong_cai_tang_HD-CT-2026-0066.pdf", c66_pdf, admin_id)
                c66 = Contract(
                    contract_code="HD-CT-2026-0066",
                    contract_type="EXHUMATION",
                    customer_id=cust66.customer_id,
                    status="ACTIVE",
                    total_amount=Decimal("25000000.00"),
                    signed_scan_file_id=c66_file.file_id,
                    signed_at=date(2026, 2, 5),
                    activated_at=now,
                    activated_by=admin_id,
                    activation_notes="Thủ tục cải táng di dời hài cốt về quê nhà theo nguyện vọng thân nhân.",
                    created_by_user_id=admin_id,
                )
                db.add(c66)
                db.flush()

                db.add(ExhumationContract(
                    contract_id=c66.contract_id,
                    plot_id=p_cai_tang.plot_id,
                    slot_id=p_cai_tang.slots[0].slot_id if p_cai_tang.slots else None,
                    current_deceased_id=dec66.deceased_id,
                    exhumation_date=date(2026, 2, 10),
                    exhumation_fee=Decimal("25000000.00"),
                    reason="Di dời hài cốt về nhà thờ từ đường dòng họ tại Hà Nam.",
                ))

            # Burial Histories: 1. Buried in 2020, 2. Exhumed in 2026
            bh_cai_tang = db.query(BurialHistory).filter(BurialHistory.plot_id == p_cai_tang.plot_id, BurialHistory.action_type == "EXHUMED").first()
            if not bh_cai_tang:
                ct_img = generate_badge_image(
                    title="HOÀN TẤT CẢI TÁNG & HOÀN THỔ MẶT BẰNG",
                    subtitle="Bàn giao tiểu quách an toàn & làm sạch, phục hồi thảm cỏ xanh mặt bằng",
                    location_code=p_cai_tang.plot_code,
                    action_label="Cải Táng Hoàn Thổ",
                    accent_color=(239, 68, 68),
                )
                f_ct = get_or_create_file(db, f"cai_tang_{p_cai_tang.plot_code}.jpg", ct_img, caretaker_id)

                db.add(BurialHistory(
                    plot_id=p_cai_tang.plot_id,
                    slot_id=1,
                    deceased_id=dec66.deceased_id,
                    action_type="EXHUMED",
                    action_date=datetime(2026, 2, 10, 6, 0, tzinfo=timezone.utc),
                    proof_url=f"/api/v1/documents/public/{f_ct.file_id}",
                    proof_file_id=f_ct.file_id,
                    performed_by=caretaker_id,
                    notes="Nghi thức cải táng và bàn giao tiểu quách hoàn tất chu đáo lúc 6:00 sáng. Mặt bằng ô mộ đã được thanh tẩy tâm linh và hoàn thổ cỏ xanh.",
                ))

            # Reset plot and slot to EMPTY_UNSOLD
            p_cai_tang.status = "EMPTY_UNSOLD"
            p_cai_tang.is_kim_tinh = False
            p_cai_tang.is_locked = False
            p_cai_tang.owner_id = None
            if p_cai_tang.slots:
                p_cai_tang.slots[0].current_deceased_id = None
                p_cai_tang.slots[0].status = "EMPTY"

            print(f"  + Hoàn tất cấu hình Mộ Cải Táng: {p_cai_tang.plot_code} (lịch sử bốc mộ, hoàn thổ, ô mộ trống sẵn sàng kinh doanh).")

        db.commit()
        print("\n[SUCCESS] KHỞI TẠO BỘ DỮ LIỆU THỰC ĐỊA THÀNH CÔNG 100%!")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Lỗi khi tạo dữ liệu: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_rich_data()
