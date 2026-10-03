import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.care.models import CareAnnex, CarePackage, CareSchedule
from app.modules.care.service import CareService
from app.modules.construction.models import StaffUnavailability
from app.modules.contracts.models import Contract, ContractAnnex, LandPurchaseContract
from app.modules.documents.models import FileObject
from app.modules.plots.models import Plot, PlotSlot, PlotType, Row, Zone
from app.modules.profiles.models import Customer

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def get_caretaker_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "caretaker", "password": "Caretaker2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def create_care_test_fixture(db: Session, anchor_day: int = 15):
    suffix = uuid.uuid4().hex[:6]

    zone = Zone(zone_code=f"ZC_{suffix}", zone_name="Khu Chăm Sóc Test")
    db.add(zone)
    db.flush()

    row = Row(zone_id=zone.zone_id, row_code=f"RC_{suffix}")
    db.add(row)
    db.flush()

    plot_type = PlotType(
        type_name=f"Type_{suffix}",
        length=Decimal("2.50"),
        width=Decimal("1.50"),
        default_slots=1,
    )
    db.add(plot_type)
    db.flush()

    plot = Plot(
        row_id=row.row_id,
        type_id=plot_type.type_id,
        plot_code=f"PC_{suffix}",
        status="OCCUPIED",
        is_kim_tinh=False,
        is_locked=False,
    )
    db.add(plot)
    db.flush()

    slot = PlotSlot(plot_id=plot.plot_id, slot_number=1, status="OCCUPIED")
    db.add(slot)
    db.flush()

    customer = Customer(
        customer_code=f"KHC_{suffix}",
        full_name="Nguyễn Văn Chăm Sóc",
        citizen_id=f"001{suffix[:9]}",
        phone_number="0988776655",
        address="123 Đường Số 1, TP.HCM",
    )
    db.add(customer)
    db.flush()

    admin_user = db.query(User).filter(User.username == "admin").first()
    creator_id = admin_user.user_id if admin_user else 1

    contract = Contract(
        contract_code=f"HDC_{suffix}",
        contract_type="LAND_PURCHASE",
        status="ACTIVE",
        customer_id=customer.customer_id,
        created_by_user_id=creator_id,
        total_amount=Decimal("100000000.00"),
        signed_at=date(2026, 1, 1),
        activated_at=datetime.now(timezone.utc),
    )
    db.add(contract)
    db.flush()

    land_contract = LandPurchaseContract(
        contract_id=contract.contract_id,
        plot_id=plot.plot_id,
        land_unit_price=Decimal("100000000.00"),
    )
    db.add(land_contract)
    db.flush()

    # Care package
    package = CarePackage(
        package_code=f"PKG_{suffix}",
        package_name="Gói Chăm Sóc Toàn Diện",
        cycle_type="MONTHLY",
        default_tasks_json='["Dọn dẹp khuôn viên", "Lau chùi bia mộ", "Thắp hương rằm"]',
        unit_price=Decimal("500000.00"),
        is_active=True,
    )
    db.add(package)
    db.flush()

    # Contract annex for care
    valid_from = date(2026, 1, anchor_day)
    valid_to = date(2026, 12, 31)

    annex = ContractAnnex(
        contract_id=contract.contract_id,
        annex_code=f"PLC_{suffix}",
        annex_type="CARE",
        status="ACTIVE",
        additional_amount=Decimal("6000000.00"),
        valid_from=valid_from,
        valid_to=valid_to,
        notes="Hợp đồng dịch vụ chăm sóc 1 năm",
    )
    db.add(annex)
    db.flush()

    care_annex = CareAnnex(
        annex_id=annex.annex_id,
        package_id=package.package_id,
        cycle_months=1,
        recurring_price=Decimal("500000.00"),
    )
    db.add(care_annex)
    db.commit()

    return {
        "plot": plot,
        "contract": contract,
        "package": package,
        "annex": annex,
        "care_annex": care_annex,
    }


def test_calculate_anchored_date_end_of_month_rule():
    # 31st January anchor: In February 2026 (28 days), should return Feb 28
    feb_date = CareService.calculate_anchored_date(year=2026, month=2, anchor_day=31)
    assert feb_date == date(2026, 2, 28)

    # In March 2026 (31 days), original anchor 31 is preserved!
    mar_date = CareService.calculate_anchored_date(year=2026, month=3, anchor_day=31)
    assert mar_date == date(2026, 3, 31)

    # In April 2026 (30 days), returns April 30
    apr_date = CareService.calculate_anchored_date(year=2026, month=4, anchor_day=31)
    assert apr_date == date(2026, 4, 30)

    # Standard day (15th) remains 15th across all months
    assert CareService.calculate_anchored_date(year=2026, month=2, anchor_day=15) == date(
        2026, 2, 15
    )


def test_generate_care_schedules_idempotent():
    db = SessionLocal()
    try:
        fixture = create_care_test_fixture(db, anchor_day=20)
        annex_id = fixture["care_annex"].annex_id

        admin_token = get_admin_token()

        # Run generator 1st time
        resp1 = client.post(
            "/api/v1/care/schedules/generate",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"year": 2026, "month": 5, "care_annex_id": annex_id},
        )
        assert resp1.status_code == 200, resp1.text
        data1 = resp1.json()
        assert data1["period_key"] == "2026-M05"
        assert data1["generated_count"] == 1
        assert data1["skipped_count"] == 0

        # Verify created schedule
        sched = (
            db.query(CareSchedule)
            .filter(CareSchedule.care_annex_id == annex_id, CareSchedule.period_key == "2026-M05")
            .first()
        )
        assert sched is not None
        assert sched.scheduled_date == date(2026, 5, 20)
        assert len(sched.checklist_items) == 3

        # Run generator 2nd time for the same period (IDEMPOTENCY TEST)
        resp2 = client.post(
            "/api/v1/care/schedules/generate",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"year": 2026, "month": 5, "care_annex_id": annex_id},
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["generated_count"] == 0
        assert data2["skipped_count"] >= 1

        # Run generator 3rd time
        resp3 = client.post(
            "/api/v1/care/schedules/generate",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"year": 2026, "month": 5, "care_annex_id": annex_id},
        )
        assert resp3.status_code == 200
        data3 = resp3.json()
        assert data3["generated_count"] == 0
        assert data3["skipped_count"] >= 1

        # Exactly 1 schedule exists in database
        count = (
            db.query(CareSchedule)
            .filter(CareSchedule.care_annex_id == annex_id, CareSchedule.period_key == "2026-M05")
            .count()
        )
        assert count == 1
    finally:
        db.close()


def test_assign_caretaker_with_conflict_warning():
    db = SessionLocal()
    try:
        fixture = create_care_test_fixture(db, anchor_day=10)
        annex_id = fixture["care_annex"].annex_id

        # Generate schedule for October 2026
        period_key, gen_count, _, schedules = CareService.generate_schedules_for_period(
            db=db, year=2026, month=10, care_annex_id=annex_id
        )
        assert gen_count == 1
        schedule = schedules[0]

        caretaker = db.query(User).filter(User.username == "caretaker").first()
        assert caretaker is not None

        # Add staff unavailability overlapping the scheduled date
        unavail = StaffUnavailability(
            user_id=caretaker.user_id,
            start_date=date(2026, 10, 8),
            end_date=date(2026, 10, 12),
            reason="Nghỉ phép gia đình",
        )
        db.add(unavail)
        db.commit()

        admin_token = get_admin_token()

        # Assign caretaker during unavailability
        resp = client.patch(
            f"/api/v1/care/schedules/{schedule.schedule_id}/assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"caretaker_id": caretaker.user_id},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["caretaker_id"] == caretaker.user_id
        assert data["has_conflict"] is True
        assert "Nghỉ phép gia đình" in data["conflict_reason"]
    finally:
        db.close()


def test_checklist_item_update():
    db = SessionLocal()
    try:
        fixture = create_care_test_fixture(db, anchor_day=12)
        annex_id = fixture["care_annex"].annex_id

        CareService.generate_schedules_for_period(
            db=db, year=2026, month=11, care_annex_id=annex_id
        )
        sched = (
            db.query(CareSchedule)
            .filter(CareSchedule.care_annex_id == annex_id, CareSchedule.period_key == "2026-M11")
            .first()
        )
        item = sched.checklist_items[0]

        caretaker_token = get_caretaker_token()

        # Update checklist item
        resp = client.patch(
            f"/api/v1/care/checklist-items/{item.item_id}",
            headers={"Authorization": f"Bearer {caretaker_token}"},
            json={"is_completed": True, "field_notes": "Đã làm sạch cỏ dại"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["is_completed"] is True
        assert data["field_notes"] == "Đã làm sạch cỏ dại"

        # Verify schedule moved to IN_PROGRESS
        db.refresh(sched)
        assert sched.status == "IN_PROGRESS"
    finally:
        db.close()


def test_close_schedule_gate_rejection_missing_task():
    db = SessionLocal()
    try:
        fixture = create_care_test_fixture(db, anchor_day=5)
        annex_id = fixture["care_annex"].annex_id

        CareService.generate_schedules_for_period(db=db, year=2026, month=6, care_annex_id=annex_id)
        sched = (
            db.query(CareSchedule)
            .filter(CareSchedule.care_annex_id == annex_id, CareSchedule.period_key == "2026-M06")
            .first()
        )

        caretaker_token = get_caretaker_token()

        # Try to close schedule while tasks are incomplete
        resp = client.post(
            f"/api/v1/care/schedules/{sched.schedule_id}/close",
            headers={"Authorization": f"Bearer {caretaker_token}"},
            json={"field_notes": "Xin đóng ca sớm"},
        )
        assert resp.status_code == 400
        assert "hạng mục bắt buộc chưa hoàn tất" in resp.json()["detail"]
    finally:
        db.close()


def test_close_schedule_gate_rejection_missing_evidence():
    db = SessionLocal()
    try:
        fixture = create_care_test_fixture(db, anchor_day=8)
        annex_id = fixture["care_annex"].annex_id

        CareService.generate_schedules_for_period(db=db, year=2026, month=7, care_annex_id=annex_id)
        sched = (
            db.query(CareSchedule)
            .filter(CareSchedule.care_annex_id == annex_id, CareSchedule.period_key == "2026-M07")
            .first()
        )

        # Mark all checklist items as completed
        for it in sched.checklist_items:
            it.is_completed = True
        db.commit()

        caretaker_token = get_caretaker_token()

        # Try to close schedule without any photo evidence
        resp = client.post(
            f"/api/v1/care/schedules/{sched.schedule_id}/close",
            headers={"Authorization": f"Bearer {caretaker_token}"},
            json={"field_notes": "Tất cả công việc đã làm xong"},
        )
        assert resp.status_code == 400
        assert "ảnh minh chứng hiện trường hợp lệ" in resp.json()["detail"]
    finally:
        db.close()


def test_close_schedule_success_with_ready_evidence():
    db = SessionLocal()
    try:
        fixture = create_care_test_fixture(db, anchor_day=14)
        annex_id = fixture["care_annex"].annex_id

        CareService.generate_schedules_for_period(db=db, year=2026, month=8, care_annex_id=annex_id)
        sched = (
            db.query(CareSchedule)
            .filter(CareSchedule.care_annex_id == annex_id, CareSchedule.period_key == "2026-M08")
            .first()
        )

        # Complete all tasks
        for it in sched.checklist_items:
            it.is_completed = True
        db.commit()

        # Create READY FileObject in MinIO mock
        file_obj = FileObject(
            file_id=f"f_care_{uuid.uuid4().hex[:12]}",
            bucket_name="nghiatrang-private",
            object_key=f"care/{sched.schedule_id}/evidence.jpg",
            file_name="mo_phan_sau_don.jpg",
            file_size_bytes=102400,
            mime_type="image/jpeg",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            state="READY",
        )
        db.add(file_obj)
        db.commit()

        caretaker_token = get_caretaker_token()

        # Upload evidence to schedule
        ev_resp = client.post(
            f"/api/v1/care/schedules/{sched.schedule_id}/evidence",
            headers={"Authorization": f"Bearer {caretaker_token}"},
            json={"file_id": file_obj.file_id, "caption": "Ảnh mộ phần sau khi dọn sạch"},
        )
        assert ev_resp.status_code == 201, ev_resp.text

        # Now close schedule - SHOULD SUCCEED!
        close_resp = client.post(
            f"/api/v1/care/schedules/{sched.schedule_id}/close",
            headers={"Authorization": f"Bearer {caretaker_token}"},
            json={"field_notes": "Hoàn thành kiểm tra và thắp nhang tươm tất"},
        )
        assert close_resp.status_code == 200, close_resp.text
        data = close_resp.json()
        assert data["status"] == "CLOSED"
        assert data["closed_at"] is not None
        assert "Hoàn thành kiểm tra" in data["notes"]
    finally:
        db.close()
