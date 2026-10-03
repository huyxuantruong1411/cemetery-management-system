from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.documents.service import DocumentService
from app.modules.finance.models import Receivable
from app.modules.jobs.models import OutboxEvent
from app.modules.plots.models import Plot, PlotOwnership, PlotReservation, PlotType, Row
from app.modules.profiles.models import Customer

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


@pytest.fixture
def auth_headers():
    return get_auth_headers("marketing")


@pytest.fixture
def clean_fixtures():
    """Ensure clean test customer and plot fixtures."""
    db = SessionLocal()
    try:
        # Create or fetch test customer
        cust = db.query(Customer).filter(Customer.citizen_id == "079099999888").first()
        if not cust:
            cust = Customer(
                customer_code="KH-M07-TEST",
                full_name="Trần Thị Hợp Đồng",
                citizen_id="079099999888",
                phone_number="0918889999",
                address="789 Đường Thử Nghiệm, TP.HCM",
            )
            db.add(cust)
            db.commit()
            db.refresh(cust)

        # Create or fetch test plot
        plot = db.query(Plot).filter(Plot.plot_code == "M07-A1-99").first()
        if not plot:
            row = db.query(Row).first()
            pt = db.query(PlotType).first()
            plot = Plot(
                plot_code="M07-A1-99",
                row_id=row.row_id,
                type_id=pt.type_id,
                status="EMPTY_UNSOLD",
                is_kim_tinh=False,
                is_locked=False,
            )
            db.add(plot)
            db.commit()
            db.refresh(plot)
        else:
            # Reset plot if dirty
            plot.status = "EMPTY_UNSOLD"
            db.query(PlotReservation).filter(PlotReservation.plot_id == plot.plot_id).delete()
            db.commit()

        yield cust.customer_id, plot.plot_id
    finally:
        db.close()


def test_create_land_purchase_contract_draft(auth_headers, clean_fixtures):
    customer_id, plot_id = clean_fixtures

    payload = {
        "customer_id": customer_id,
        "plot_id": plot_id,
        "land_unit_price": 45000000.0,
        "notes": "Hợp đồng thử nghiệm M07",
    }
    response = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["contract_code"].startswith("HD-MD-")
    assert data["contract_type"] == "LAND_PURCHASE"
    assert data["status"] == "DRAFT"
    assert float(data["total_amount"]) == 45000000.0
    assert data["customer"]["customer_id"] == customer_id

    # Verify plot status transitioned to RESERVED and reservation created
    db = SessionLocal()
    try:
        p = db.query(Plot).filter(Plot.plot_id == plot_id).first()
        assert p.status == "RESERVED"

        res = (
            db.query(PlotReservation)
            .filter(PlotReservation.plot_id == plot_id, PlotReservation.state == "ACTIVE")
            .first()
        )
        assert res is not None
        assert res.contract_id == data["contract_id"]
    finally:
        db.close()


def test_anti_double_booking_same_plot_conflict(auth_headers, clean_fixtures):
    customer_id, plot_id = clean_fixtures

    # First purchase creates contract and reservation
    payload1 = {
        "customer_id": customer_id,
        "plot_id": plot_id,
        "land_unit_price": 45000000.0,
    }
    res1 = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json=payload1,
        headers=auth_headers,
    )
    assert res1.status_code == 201

    # Second concurrent purchase attempt for the same plot must raise 409 Conflict
    payload2 = {
        "customer_id": customer_id,
        "plot_id": plot_id,
        "land_unit_price": 50000000.0,
    }
    res2 = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json=payload2,
        headers=auth_headers,
    )
    assert res2.status_code == 409
    assert "không khả dụng" in res2.json()["detail"] or "giữ chỗ" in res2.json()["detail"]


def test_submit_contract_for_signing_and_generate_pdf(auth_headers, clean_fixtures):
    customer_id, plot_id = clean_fixtures

    # Create draft
    create_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json={"customer_id": customer_id, "plot_id": plot_id},
        headers=auth_headers,
    )
    contract_id = create_res.json()["contract_id"]

    # Submit for signing
    submit_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/submit-signing",
        headers=auth_headers,
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "PENDING_SIGN"

    # Download PDF
    pdf_res = client.get(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/pdf",
        headers=auth_headers,
    )
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")


def test_activate_contract_full_acid_transaction(auth_headers, clean_fixtures):
    customer_id, plot_id = clean_fixtures

    # 1. Create draft contract
    create_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json={"customer_id": customer_id, "plot_id": plot_id, "land_unit_price": 60000000.0},
        headers=auth_headers,
    )
    contract_id = create_res.json()["contract_id"]

    # 2. Submit for signing
    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/submit-signing",
        headers=auth_headers,
    )

    # 3. Create dummy signed scan file object in MinIO / DB
    db = SessionLocal()
    marketing_user = db.query(User).filter(User.username == "marketing").first()
    dummy_pdf_content = b"%PDF-1.4 Fake signed contract scan content for testing M07."
    scan_file = DocumentService.upload_file(
        db=db,
        file_name="signed_contract_scan.pdf",
        content=dummy_pdf_content,
        user_id=marketing_user.user_id,
    )
    file_id = scan_file.file_id
    db.close()

    # 4. Activate contract
    activate_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        json={
            "signed_scan_file_id": file_id,
            "signed_at": "2026-10-03",
            "activation_notes": "Đã đối chiếu chữ ký thân nhân trên bản scan gốc.",
        },
        headers=auth_headers,
    )
    assert activate_res.status_code == 200, activate_res.text
    act_data = activate_res.json()

    assert act_data["status"] == "ACTIVE"
    assert act_data["signed_scan_file_id"] == file_id
    assert act_data["signed_at"] == "2026-10-03"
    assert act_data["activated_at"] is not None

    # 5. Verify DB state integrity
    db = SessionLocal()
    try:
        # Check plot is OWNED_EMPTY
        p = db.query(Plot).filter(Plot.plot_id == plot_id).first()
        assert p.status == "OWNED_EMPTY"
        assert p.owner_id == customer_id

        # Check reservation is CONVERTED
        res = db.query(PlotReservation).filter(PlotReservation.contract_id == contract_id).first()
        assert res.state == "CONVERTED"

        # Check ownership history is recorded (G05)
        ownership = (
            db.query(PlotOwnership)
            .filter(
                PlotOwnership.basis_contract_id == contract_id,
                PlotOwnership.customer_id == customer_id,
            )
            .first()
        )
        assert ownership is not None
        assert ownership.plot_id == plot_id

        # Check financial receivable is created (G14)
        rec = db.query(Receivable).filter(Receivable.contract_id == contract_id).first()
        assert rec is not None
        assert rec.customer_id == customer_id
        assert rec.original_amount == Decimal("60000000.00")
        assert rec.final_payable_amount == Decimal("60000000.00")
        assert rec.status == "UNPAID"

        # Check outbox event (G17)
        outbox = (
            db.query(OutboxEvent)
            .filter(
                OutboxEvent.aggregate_id == str(contract_id),
                OutboxEvent.event_type == "CONTRACT_ACTIVATED",
            )
            .first()
        )
        assert outbox is not None
        assert outbox.state == "PENDING"
    finally:
        db.close()


def test_activate_idempotency(auth_headers, clean_fixtures):
    customer_id, plot_id = clean_fixtures

    # Create & submit
    create_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json={"customer_id": customer_id, "plot_id": plot_id},
        headers=auth_headers,
    )
    contract_id = create_res.json()["contract_id"]
    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/submit-signing", headers=auth_headers
    )

    db = SessionLocal()
    marketing_user = db.query(User).filter(User.username == "marketing").first()
    scan_file = DocumentService.upload_file(
        db=db,
        file_name="scan_idempotency.pdf",
        content=b"%PDF-1.4 Idempotency scan test.",
        user_id=marketing_user.user_id,
    )
    file_id = scan_file.file_id
    db.close()

    # First activation
    act1 = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        json={"signed_scan_file_id": file_id},
        headers=auth_headers,
    )
    assert act1.status_code == 200

    # Second activation (idempotent call)
    act2 = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        json={"signed_scan_file_id": file_id},
        headers=auth_headers,
    )
    assert act2.status_code == 200
    assert act2.json()["status"] == "ACTIVE"

    # Verify no duplicate receivables or ownerships were created
    db = SessionLocal()
    try:
        rec_count = db.query(Receivable).filter(Receivable.contract_id == contract_id).count()
        assert rec_count == 1

        ownership_count = (
            db.query(PlotOwnership).filter(PlotOwnership.basis_contract_id == contract_id).count()
        )
        assert ownership_count == 1
    finally:
        db.close()


def test_cancel_draft_contract_releases_plot(auth_headers, clean_fixtures):
    customer_id, plot_id = clean_fixtures

    create_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        json={"customer_id": customer_id, "plot_id": plot_id},
        headers=auth_headers,
    )
    contract_id = create_res.json()["contract_id"]

    # Cancel contract
    cancel_res = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/cancel",
        json={"reason": "Khách hàng đổi ý muốn chuyển sang mộ gia tộc"},
        headers=auth_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Plot must be released back to EMPTY_UNSOLD
    db = SessionLocal()
    try:
        p = db.query(Plot).filter(Plot.plot_id == plot_id).first()
        assert p.status == "EMPTY_UNSOLD"

        res = db.query(PlotReservation).filter(PlotReservation.contract_id == contract_id).first()
        assert res.state == "CANCELLED"
    finally:
        db.close()
