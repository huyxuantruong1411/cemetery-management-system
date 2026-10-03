import uuid
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.documents.service import DocumentService
from app.modules.jobs.models import OutboxEvent
from app.modules.plots.models import (
    BurialHistory,
    Plot,
    PlotOwnership,
    PlotReservation,
    PlotSlot,
    PlotType,
    Row,
)
from app.modules.profiles.models import Customer, DeathCertificate, DeceasedProfile

client = TestClient(app)


def get_auth_headers(role: str = "marketing") -> dict:
    if role == "marketing":
        resp = client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={"username": "marketing", "password": "Marketing2026!"},
        )
    else:
        resp = client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={"username": "admin", "password": "Admin2026!"},
        )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_admin_user_id() -> int:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        return user.user_id if user else 1
    finally:
        db.close()


@pytest.fixture
def auth_headers():
    return get_auth_headers("admin")


@pytest.fixture
def sample_scan_file():
    """Upload a mock scanned document to MinIO for test activation."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        dummy_pdf_content = b"%PDF-1.4 Fake signed contract scan content for testing M08."
        scan_file = DocumentService.upload_file(
            db=db,
            file_name="signed_lifecycle_scan.pdf",
            content=dummy_pdf_content,
            user_id=user.user_id,
        )
        return scan_file.file_id
    finally:
        db.close()


@pytest.fixture
def lifecycle_fixtures():
    """Create test customers, deceased profiles, and pristine plots with slots."""
    db = SessionLocal()
    try:
        suffix = str(uuid.uuid4())[:8]

        # 1. Customer A (Seller/Owner)
        cust_a = Customer(
            customer_code=f"KH-M08-A-{suffix}",
            full_name="Nguyễn Văn Chủ Mộ",
            citizen_id=f"079{suffix}",
            phone_number="0901112222",
            address="123 Đất Thánh, TP.HCM",
        )
        db.add(cust_a)

        # 2. Customer B (Buyer)
        cust_b = Customer(
            customer_code=f"KH-M08-B-{suffix}",
            full_name="Lê Thị Người Mua",
            citizen_id=f"080{suffix}",
            phone_number="0903334444",
            address="456 Hương Lộ, TP.HCM",
        )
        db.add(cust_b)

        # 3. Deceased 1 (unverified cert initially)
        dec_1 = DeceasedProfile(
            deceased_code=f"CD-M08-01-{suffix}",
            full_name="Nguyễn Cụ Thân Sinh",
            gender="MALE",
            date_of_death=date(2026, 1, 15),
            birth_year=1945,
            birth_date_precision="YEAR_ONLY",
            has_death_certificate=False,
        )
        db.add(dec_1)

        # 4. Deceased 2 (for cremation)
        dec_2 = DeceasedProfile(
            deceased_code=f"CD-M08-02-{suffix}",
            full_name="Trần Cụ Bà",
            gender="FEMALE",
            date_of_death=date(2026, 2, 20),
            birth_year=1948,
            birth_date_precision="YEAR_ONLY",
            has_death_certificate=False,
        )
        db.add(dec_2)

        # 5. Row and PlotType
        row = db.query(Row).first()
        pt = db.query(PlotType).first()

        # Plot 1: for Kim Tĩnh test
        plot_kim_tinh = Plot(
            plot_code=f"KT-{suffix}",
            row_id=row.row_id,
            type_id=pt.type_id,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
        )
        db.add(plot_kim_tinh)
        db.flush()
        slot1 = PlotSlot(plot_id=plot_kim_tinh.plot_id, slot_number=1, status="EMPTY")
        db.add(slot1)

        # Plot 2: for Standard Burial -> Exhumation -> Transfer test
        plot_std = Plot(
            plot_code=f"STD-{suffix}",
            row_id=row.row_id,
            type_id=pt.type_id,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
        )
        db.add(plot_std)
        db.flush()
        slot2 = PlotSlot(plot_id=plot_std.plot_id, slot_number=1, status="EMPTY")
        db.add(slot2)

        db.commit()
        db.refresh(cust_a)
        db.refresh(cust_b)
        db.refresh(dec_1)
        db.refresh(dec_2)
        db.refresh(plot_kim_tinh)
        db.refresh(plot_std)

        yield {
            "cust_a_id": cust_a.customer_id,
            "cust_b_id": cust_b.customer_id,
            "dec_1_id": dec_1.deceased_id,
            "dec_2_id": dec_2.deceased_id,
            "plot_kt_id": plot_kim_tinh.plot_id,
            "plot_std_id": plot_std.plot_id,
        }
    finally:
        db.close()


def test_burial_annex_requires_verified_death_certificate(
    auth_headers, lifecycle_fixtures, sample_scan_file
):
    """G08 & G10: Burial Annex cannot be created or activated without verified death certificate."""
    f = lifecycle_fixtures
    db = SessionLocal()

    # 1. Purchase land for Plot KT
    contract_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json={
            "customer_id": f["cust_a_id"],
            "plot_id": f["plot_kt_id"],
            "land_unit_price": 50000000.0,
        },
        headers=auth_headers,
    )
    assert contract_res.status_code == 201
    contract_id = contract_res.json()["contract_id"]

    # Activate contract
    act_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        json={"signed_scan_file_id": sample_scan_file, "signed_at": "2026-10-03"},
        headers=auth_headers,
    )
    assert act_res.status_code == 200

    slot = db.query(PlotSlot).filter(PlotSlot.plot_id == f["plot_kt_id"]).first()

    # 2. Ensure dec_1 has NO verified certificate -> Rejected 400
    db.query(DeathCertificate).filter(DeathCertificate.deceased_id == f["dec_1_id"]).delete()
    dec_1_obj = (
        db.query(DeceasedProfile).filter(DeceasedProfile.deceased_id == f["dec_1_id"]).first()
    )
    dec_1_obj.has_death_certificate = False
    db.commit()

    annex_payload = {
        "deceased_id": f["dec_1_id"],
        "slot_id": slot.slot_id,
        "burial_date": "2026-10-10",
        "is_kim_tinh": True,
        "additional_amount": 10000000.0,
        "construction_notes": "Xây kim tĩnh đúc bê tông cốt thép",
    }
    reject_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/annexes/burial",
        json=annex_payload,
        headers=auth_headers,
    )
    assert reject_res.status_code == 400
    assert "chưa có giấy báo tử được xác minh" in reject_res.json()["detail"]

    # 3. Attach and verify death certificate
    cert = DeathCertificate(
        deceased_id=f["dec_1_id"],
        certificate_number="GBT-TEST-001",
        issuing_authority="UBND Phường 1",
        issue_date=date(2026, 1, 16),
        is_verified=True,
        verified_at=datetime.now(timezone.utc).replace(tzinfo=None),
        verified_by=get_admin_user_id(),
    )
    db.add(cert)
    db.commit()
    db.close()

    # 4. Retry creating burial annex -> Success
    success_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/annexes/burial",
        json=annex_payload,
        headers=auth_headers,
    )
    assert success_res.status_code == 201
    data = success_res.json()
    assert len(data["annexes"]) >= 1
    annex = data["annexes"][-1]
    assert annex["annex_type"] == "BURIAL"
    assert annex["status"] == "DRAFT"
    assert annex["burial"]["is_kim_tinh"] is True


def test_kim_tinh_burial_activation_permanently_locks_plot(
    auth_headers, lifecycle_fixtures, sample_scan_file
):
    """Server Invariant: Once Kim Tĩnh burial activates, plot is permanently locked at DB & service level."""
    f = lifecycle_fixtures
    db = SessionLocal()
    try:
        # Ensure dec_1 has verified death cert
        cert = DeathCertificate(
            deceased_id=f["dec_1_id"],
            certificate_number=f"GBT-KT-{uuid.uuid4().hex[:6]}",
            issuing_authority="UBND Phường 1",
            issue_date=date(2026, 1, 16),
            is_verified=True,
            verified_at=datetime.now(timezone.utc).replace(tzinfo=None),
            verified_by=get_admin_user_id(),
        )
        db.add(cert)
        db.commit()

        # 1. Purchase land for Plot KT
        contract_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/land-purchase",
            json={
                "customer_id": f["cust_a_id"],
                "plot_id": f["plot_kt_id"],
                "land_unit_price": 50000000.0,
            },
            headers=auth_headers,
        )
        assert contract_res.status_code == 201
        contract_id = contract_res.json()["contract_id"]

        # 2. Activate contract
        act_contract_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
            json={"signed_scan_file_id": sample_scan_file, "signed_at": "2026-10-03"},
            headers=auth_headers,
        )
        assert act_contract_res.status_code == 200

        plot = db.query(Plot).filter(Plot.plot_id == f["plot_kt_id"]).first()
        slot = db.query(PlotSlot).filter(PlotSlot.plot_id == f["plot_kt_id"]).first()

        # 3. Create burial annex
        annex_payload = {
            "deceased_id": f["dec_1_id"],
            "slot_id": slot.slot_id,
            "burial_date": "2026-10-10",
            "is_kim_tinh": True,
            "additional_amount": 10000000.0,
            "construction_notes": "Xây kim tĩnh đúc bê tông cốt thép",
        }
        annex_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/{contract_id}/annexes/burial",
            json=annex_payload,
            headers=auth_headers,
        )
        assert annex_res.status_code == 201
        annex_id = annex_res.json()["annexes"][-1]["annex_id"]

        # 4. Activate the burial annex
        act_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/annexes/{annex_id}/activate",
            json={
                "signed_scan_file_id": sample_scan_file,
                "signed_at": "2026-10-03",
                "activation_notes": "Đã chôn cất kim tĩnh hoàn tất",
            },
            headers=auth_headers,
        )
        assert act_res.status_code == 200

        # Verify DB state
        db.refresh(plot)
        db.refresh(slot)
        assert plot.is_kim_tinh is True
        assert plot.is_locked is True
        assert plot.status == "OCCUPIED"
        assert slot.status == "OCCUPIED"
        assert slot.current_deceased_id == f["dec_1_id"]

        # Verify BurialHistory
        history = (
            db.query(BurialHistory)
            .filter(BurialHistory.plot_id == plot.plot_id, BurialHistory.action_type == "BURIED")
            .first()
        )
        assert history is not None
        assert history.deceased_id == f["dec_1_id"]
        assert history.proof_file_id == sample_scan_file

        # Verify Outbox event
        outbox = (
            db.query(OutboxEvent)
            .filter(
                OutboxEvent.aggregate_id == str(annex_id),
                OutboxEvent.event_type == "BURIAL_COMPLETED",
            )
            .first()
        )
        assert outbox is not None
    finally:
        db.close()


def test_kim_tinh_immutability_blocks_exhumation_and_transfer(auth_headers, lifecycle_fixtures):
    """BR-KIMTINH: Locked Kim Tinh plot permanently rejects exhumation, transfer, and additional burial."""
    f = lifecycle_fixtures
    db = SessionLocal()
    try:
        plot_kt = db.query(Plot).filter(Plot.plot_id == f["plot_kt_id"]).first()
        plot_kt.owner_id = f["cust_a_id"]
        plot_kt.is_kim_tinh = True
        plot_kt.is_locked = True
        db.commit()
    finally:
        db.close()

    # 1. Attempt Exhumation on Kim Tĩnh Plot -> 409 Conflict
    ex_payload = {
        "customer_id": f["cust_a_id"],
        "plot_id": f["plot_kt_id"],
        "slot_id": 1,
        "current_deceased_id": f["dec_1_id"],
        "exhumation_date": "2026-11-01",
        "exhumation_fee": 15000000.0,
        "reason": "Xin cải táng",
    }
    ex_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/exhumation",
        json=ex_payload,
        headers=auth_headers,
    )
    assert ex_res.status_code == 409
    assert "Kim Tĩnh" in ex_res.json()["detail"]

    # 2. Attempt Transfer on Kim Tĩnh Plot -> 409 Conflict
    tr_payload = {
        "seller_id": f["cust_a_id"],
        "buyer_id": f["cust_b_id"],
        "plot_id": f["plot_kt_id"],
        "commission_fee": 5000000.0,
        "transfer_reason": "Chuyển nhượng đất",
    }
    tr_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/transfer",
        json=tr_payload,
        headers=auth_headers,
    )
    assert tr_res.status_code == 409
    assert "Kim Tĩnh" in tr_res.json()["detail"]


def test_concurrent_burial_same_deceased_blocked(auth_headers, lifecycle_fixtures):
    """Slot Occupancy Invariant: 1 deceased person cannot be buried concurrently in 2 slots."""
    f = lifecycle_fixtures
    db = SessionLocal()
    try:
        # Ensure dec_1 has verified death cert
        cert = (
            db.query(DeathCertificate).filter(DeathCertificate.deceased_id == f["dec_1_id"]).first()
        )
        if not cert:
            cert = DeathCertificate(
                deceased_id=f["dec_1_id"],
                certificate_number="GBT-TEST-001",
                issuing_authority="UBND Phường 1",
                issue_date=date(2026, 1, 16),
                is_verified=True,
                verified_at=datetime.now(timezone.utc).replace(tzinfo=None),
                verified_by=get_admin_user_id(),
            )
            db.add(cert)
        else:
            cert.is_verified = True

        # Ensure dec_1 is occupied in plot_kt slot
        slot1 = db.query(PlotSlot).filter(PlotSlot.plot_id == f["plot_kt_id"]).first()
        slot1.status = "OCCUPIED"
        slot1.current_deceased_id = f["dec_1_id"]

        # Ensure plot_std is ready for land purchase
        plot_std_obj = db.query(Plot).filter(Plot.plot_id == f["plot_std_id"]).first()
        plot_std_obj.status = "EMPTY_UNSOLD"
        db.query(PlotReservation).filter(PlotReservation.plot_id == f["plot_std_id"]).delete()
        db.commit()

        # Create and activate land purchase for plot_std
        contract_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/land-purchase",
            json={
                "customer_id": f["cust_a_id"],
                "plot_id": f["plot_std_id"],
                "land_unit_price": 40000000.0,
            },
            headers=auth_headers,
        )
        assert contract_res.status_code == 201
        c_id = contract_res.json()["contract_id"]

        from app.modules.contracts.models import Contract

        c = db.query(Contract).filter(Contract.contract_id == c_id).first()
        c.status = "ACTIVE"
        db.commit()

        slot2 = db.query(PlotSlot).filter(PlotSlot.plot_id == f["plot_std_id"]).first()

        annex_payload = {
            "deceased_id": f["dec_1_id"],
            "slot_id": slot2.slot_id,
            "burial_date": "2026-10-15",
            "is_kim_tinh": False,
        }
        res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/{c_id}/annexes/burial",
            json=annex_payload,
            headers=auth_headers,
        )
        assert res.status_code == 400
        assert "an táng đồng thời" in res.json()["detail"]
    finally:
        db.close()


def test_standard_exhumation_frees_slot_and_restores_owned_empty(
    auth_headers, lifecycle_fixtures, sample_scan_file
):
    """Standard (non-Kim Tinh) plot allows exhumation, frees the slot and transitions plot to OWNED_EMPTY."""
    f = lifecycle_fixtures
    db = SessionLocal()
    try:
        suffix3 = uuid.uuid4().hex[:6]
        # 1. Create a 3rd deceased with verified death cert
        dec_3 = DeceasedProfile(
            deceased_code=f"CD-M08-03-{suffix3}",
            full_name="Hoàng Cụ Ông",
            gender="MALE",
            date_of_death=date(2026, 3, 1),
            birth_year=1950,
            birth_date_precision="YEAR_ONLY",
            has_death_certificate=True,
        )
        db.add(dec_3)
        db.flush()

        cert = DeathCertificate(
            deceased_id=dec_3.deceased_id,
            certificate_number=f"GBT-TEST-003-{suffix3}",
            issuing_authority="UBND Phường 2",
            issue_date=date(2026, 3, 2),
            is_verified=True,
            verified_at=datetime.now(timezone.utc).replace(tzinfo=None),
            verified_by=get_admin_user_id(),
        )
        db.add(cert)

        # Bury dec_3 into plot_std slot
        slot = db.query(PlotSlot).filter(PlotSlot.plot_id == f["plot_std_id"]).first()
        slot.status = "OCCUPIED"
        slot.current_deceased_id = dec_3.deceased_id

        plot = db.query(Plot).filter(Plot.plot_id == f["plot_std_id"]).first()
        plot.status = "OCCUPIED"
        plot.owner_id = f["cust_a_id"]
        plot.is_kim_tinh = False
        plot.is_locked = False
        db.commit()

        # 2. Non-owner trying to exhume -> 403 Forbidden
        bad_ex_payload = {
            "customer_id": f["cust_b_id"],  # cust_b is NOT owner
            "plot_id": plot.plot_id,
            "slot_id": slot.slot_id,
            "current_deceased_id": dec_3.deceased_id,
            "exhumation_date": "2026-12-01",
            "exhumation_fee": 12000000.0,
            "reason": "Di dời hài cốt",
        }
        bad_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/exhumation",
            json=bad_ex_payload,
            headers=auth_headers,
        )
        assert bad_res.status_code == 403

        # 3. Owner cust_a creates exhumation contract -> Success
        valid_ex_payload = {
            "customer_id": f["cust_a_id"],
            "plot_id": plot.plot_id,
            "slot_id": slot.slot_id,
            "current_deceased_id": dec_3.deceased_id,
            "exhumation_date": "2026-12-01",
            "exhumation_fee": 12000000.0,
            "reason": "Di dời về quê hương",
        }
        create_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/exhumation",
            json=valid_ex_payload,
            headers=auth_headers,
        )
        assert create_res.status_code == 201
        ex_contract_id = create_res.json()["contract_id"]

        # 4. Activate exhumation contract
        act_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/{ex_contract_id}/activate",
            json={"signed_scan_file_id": sample_scan_file, "signed_at": "2026-10-03"},
            headers=auth_headers,
        )
        assert act_res.status_code == 200

        # 5. Check slot is freed and plot is OWNED_EMPTY
        db.refresh(slot)
        db.refresh(plot)
        assert slot.status == "EMPTY"
        assert slot.current_deceased_id is None
        assert plot.status == "OWNED_EMPTY"
        assert plot.owner_id == f["cust_a_id"]  # Ownership preserved!

        # Check BurialHistory EXHUMED
        history = (
            db.query(BurialHistory)
            .filter(BurialHistory.plot_id == plot.plot_id, BurialHistory.action_type == "EXHUMED")
            .first()
        )
        assert history is not None
        assert history.deceased_id == dec_3.deceased_id

        # Check OutboxEvent
        outbox = (
            db.query(OutboxEvent)
            .filter(
                OutboxEvent.aggregate_id == str(ex_contract_id),
                OutboxEvent.event_type == "EXHUMATION_COMPLETED",
            )
            .first()
        )
        assert outbox is not None
    finally:
        db.close()


def test_ownership_transfer_workflow_and_chain(auth_headers, lifecycle_fixtures, sample_scan_file):
    """G18: Ownership Transfer closes prior ownership and grants new ownership with full audit chain."""
    f = lifecycle_fixtures
    db = SessionLocal()
    try:
        plot = db.query(Plot).filter(Plot.plot_id == f["plot_std_id"]).first()
        plot.status = "OWNED_EMPTY"
        plot.owner_id = f["cust_a_id"]
        for s in plot.slots:
            s.status = "EMPTY"
            s.current_deceased_id = None
        db.commit()

        # Initial ownership record
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        prior_own = PlotOwnership(
            plot_id=plot.plot_id,
            customer_id=f["cust_a_id"],
            valid_from=now,
            valid_to=None,
            transfer_reason="Sở hữu ban đầu",
            created_at=now,
        )
        db.add(prior_own)
        db.commit()

        # 1. Create Transfer Contract (Seller A -> Buyer B)
        tr_payload = {
            "seller_id": f["cust_a_id"],
            "buyer_id": f["cust_b_id"],
            "plot_id": plot.plot_id,
            "commission_fee": 3000000.0,
            "transfer_reason": "Chuyển nhượng quyền sử dụng đất nghĩa trang",
        }
        tr_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/transfer",
            json=tr_payload,
            headers=auth_headers,
        )
        assert tr_res.status_code == 201
        tr_contract_id = tr_res.json()["contract_id"]

        # 2. Activate Transfer Contract
        act_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/{tr_contract_id}/activate",
            json={"signed_scan_file_id": sample_scan_file, "signed_at": "2026-10-03"},
            headers=auth_headers,
        )
        assert act_res.status_code == 200

        # 3. Verify Ownership chain
        db.refresh(plot)
        assert plot.owner_id == f["cust_b_id"]  # Owner updated to buyer!

        db.refresh(prior_own)
        assert prior_own.valid_to is not None  # Prior closed!

        new_own = (
            db.query(PlotOwnership)
            .filter(
                PlotOwnership.plot_id == plot.plot_id,
                PlotOwnership.customer_id == f["cust_b_id"],
                PlotOwnership.valid_to.is_(None),
            )
            .first()
        )
        assert new_own is not None
        assert new_own.basis_contract_id == tr_contract_id

        # Verify Outbox
        outbox = (
            db.query(OutboxEvent)
            .filter(
                OutboxEvent.aggregate_id == str(tr_contract_id),
                OutboxEvent.event_type == "PLOT_TRANSFERRED",
            )
            .first()
        )
        assert outbox is not None
    finally:
        db.close()


def test_cremation_contract_requires_death_cert_and_activates(
    auth_headers, lifecycle_fixtures, sample_scan_file
):
    """G20: Cremation contract requires verified death certificate and activates cleanly."""
    f = lifecycle_fixtures
    db = SessionLocal()
    try:
        # 1. Ensure dec_2 has unverified cert -> 400
        db.query(DeathCertificate).filter(DeathCertificate.deceased_id == f["dec_2_id"]).delete()
        dec_2_obj = (
            db.query(DeceasedProfile).filter(DeceasedProfile.deceased_id == f["dec_2_id"]).first()
        )
        dec_2_obj.has_death_certificate = False
        db.commit()

        cre_payload = {
            "customer_id": f["cust_a_id"],
            "deceased_id": f["dec_2_id"],
            "cremation_date": "2026-10-20",
            "package_service_code": "HOA_TANG_VIP",
            "urn_storage_option": "Lưu tháp cốt Địa Tạng",
            "service_fee": 8500000.0,
            "notes": "Hợp đồng hỏa táng trọn gói",
        }
        rej_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/cremation",
            json=cre_payload,
            headers=auth_headers,
        )
        assert rej_res.status_code == 400
        assert "chưa có giấy báo tử được xác minh" in rej_res.json()["detail"]

        # 2. Verify dec_2 death certificate
        cert2 = DeathCertificate(
            deceased_id=f["dec_2_id"],
            certificate_number="GBT-TEST-002",
            issuing_authority="UBND Phường 3",
            issue_date=date(2026, 2, 21),
            is_verified=True,
            verified_at=datetime.now(timezone.utc).replace(tzinfo=None),
            verified_by=get_admin_user_id(),
        )
        db.add(cert2)
        db.commit()

        # 3. Create cremation contract -> Success
        create_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/cremation",
            json=cre_payload,
            headers=auth_headers,
        )
        assert create_res.status_code == 201
        contract_id = create_res.json()["contract_id"]

        # 4. Activate cremation contract
        act_res = client.post(
            f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
            json={"signed_scan_file_id": sample_scan_file, "signed_at": "2026-10-03"},
            headers=auth_headers,
        )
        assert act_res.status_code == 200
        assert act_res.json()["status"] == "ACTIVE"

        # Verify Outbox
        outbox = (
            db.query(OutboxEvent)
            .filter(
                OutboxEvent.aggregate_id == str(contract_id),
                OutboxEvent.event_type == "CREMATION_ACTIVATED",
            )
            .first()
        )
        assert outbox is not None
    finally:
        db.close()
