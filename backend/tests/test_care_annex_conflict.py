import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.care.models import CarePackage
from app.modules.contracts.models import Contract, ContractAnnex
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


def test_care_annex_conflict_extension_mode():
    """
    Test:
    When a contract already has an ACTIVE care annex valid until 2027-01-01,
    creating a new care annex with no valid_from automatically resolves conflict
    by extending from 2027-01-02 to 2028-01-01.
    """
    db = SessionLocal()
    token = get_admin_token()
    try:
        uid = uuid.uuid4().hex[:6]
        admin = db.query(User).filter(User.username == "admin").first()

        pkg = db.query(CarePackage).filter(CarePackage.is_active == True).first()
        if not pkg:
            pkg = CarePackage(
                package_code=f"CP_{uid}",
                package_name=f"Gói Thử Nghiệm {uid}",
                unit_price=Decimal("1200000.00"),
                cycle_months=12,
                is_active=True,
            )
            db.add(pkg)
            db.flush()

        customer = Customer(
            customer_code=f"KH_CS_{uid}",
            full_name=f"Khách Chăm Sóc {uid}",
            citizen_id=f"0791{uid}",
            phone_number=f"0933{uid}",
            address="Hồ Chí Minh",
        )
        db.add(customer)
        db.flush()

        contract = Contract(
            contract_code=f"HD_CS_{uid}",
            contract_type="LAND_PURCHASE",
            customer_id=customer.customer_id,
            total_amount=Decimal("150000000"),
            status="ACTIVE",
            created_by_user_id=admin.user_id,
        )
        db.add(contract)
        db.flush()

        # Existing active care annex valid for next 6 months
        active_expiry = date.today() + timedelta(days=180)
        annex1 = ContractAnnex(
            contract_id=contract.contract_id,
            annex_code=f"PL_CS1_{uid}",
            annex_type="CARE",
            valid_from=date.today() - timedelta(days=30),
            valid_to=active_expiry,
            status="ACTIVE",
            additional_amount=Decimal("0.00"),
        )
        db.add(annex1)
        db.commit()

        # Register new Care Annex on same contract (e.g. customer wants another 12 months)
        resp = client.post(
            f"/api/v1/contracts/{contract.contract_id}/annexes/care",
            json={
                "package_id": pkg.package_id,
                "cycle_months": 12,
                "recurring_price": 1200000,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        annexes = data.get("annexes", [])
        new_annex = next((a for a in annexes if a["status"] == "DRAFT" and a["annex_type"] == "CARE"), None)
        assert new_annex is not None

        # The new annex valid_from MUST start seamlessly on active_expiry + 1 day
        expected_from = (active_expiry + timedelta(days=1)).isoformat()
        assert new_annex["valid_from"] == expected_from
        assert "Gia hạn nối tiếp chu kỳ" in (new_annex.get("notes") or "")

    finally:
        db.close()
