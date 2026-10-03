import json
from decimal import Decimal

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.modules.care.models import CarePackage
from app.modules.catalog.models import PriceList
from app.modules.contracts.models import ContractTemplate

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_get_price_lists_and_items():
    """Verify listing price lists and their items."""
    token = get_admin_token()

    resp = client.get(
        "/api/v1/catalog/price-lists",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    lists = resp.json()
    assert len(lists) >= 1
    pl = lists[0]
    assert "Bảng Giá" in pl["price_list_name"]
    assert len(pl["items"]) >= 1


def test_price_list_date_overlap_rejection():
    """Verify G03 date overlap invariant: cannot create two active price lists overlapping in time."""
    token = get_admin_token()

    # Seed list has effective_from_date = 2026-01-01 to None
    # Creating another active price list from 2026-06-01 must be rejected
    overlap_resp = client.post(
        "/api/v1/catalog/price-lists",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "price_list_name": "Bảng Giá Trùng Lặp 2026",
            "effective_from_date": "2026-06-01",
            "effective_to_date": "2026-12-31",
            "is_active": True,
        },
    )
    assert overlap_resp.status_code == 400
    assert "trùng lặp" in overlap_resp.json()["detail"]

    # But creating an inactive price list with overlapping dates is allowed
    inactive_resp = client.post(
        "/api/v1/catalog/price-lists",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "price_list_name": "Bảng Giá Dự Thảo (Chưa Kích Hoạt)",
            "effective_from_date": "2026-06-01",
            "effective_to_date": "2026-12-31",
            "is_active": False,
        },
    )
    assert inactive_resp.status_code == 201
    created_id = inactive_resp.json()["price_list_id"]

    # Cleanup
    db = SessionLocal()
    try:
        db.query(PriceList).filter(PriceList.price_list_id == created_id).delete()
        db.commit()
    finally:
        db.close()


def test_price_lookup_simulation():
    """Verify price lookup finds the correct active price list and item."""
    token = get_admin_token()

    resp = client.post(
        "/api/v1/catalog/lookup-price",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "target_date": "2026-07-15",
            "service_code": "BURIAL",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["matched"] is True
    assert data["item_code"] == "DV-ANTANG"
    assert Decimal(str(data["unit_price"])) == Decimal("6000000.00")


def test_care_packages_crud_and_inactive_rejection():
    """Verify care package creation and inactive check."""
    token = get_admin_token()

    # 1. Create temporary package
    create_resp = client.post(
        "/api/v1/catalog/care-packages",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "package_code": "GOI-TEST-M04",
            "package_name": "Gói Thử Nghiệm M04",
            "cycle_type": "MONTHLY",
            "default_tasks_json": json.dumps(["Lau chùi", "Thắp hương"]),
            "unit_price": 500000.00,
            "is_active": False,  # Inactive
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    pkg = create_resp.json()
    pkg_id = pkg["package_id"]

    # 2. Get detail
    get_resp = client.get(
        f"/api/v1/catalog/care-packages/{pkg_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False

    # Cleanup
    db = SessionLocal()
    try:
        db.query(CarePackage).filter(CarePackage.package_id == pkg_id).delete()
        db.commit()
    finally:
        db.close()


def test_contract_template_version_bump_non_retroactive():
    """Verify contract template version bumping increments version_no without retroactivity."""
    token = get_admin_token()

    # 0. Pre-clean if exists
    db = SessionLocal()
    db.query(ContractTemplate).filter(ContractTemplate.template_code == "HD-TEST-VERSION").delete()
    db.commit()
    db.close()

    # 1. Create a test template v1
    create_resp = client.post(
        "/api/v1/catalog/contract-templates",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "template_code": "HD-TEST-VERSION",
            "contract_type": "LAND_PURCHASE",
            "template_name": "Mẫu Hợp Đồng Test v1",
            "version_no": 1,
            "content_html": "<p>Điều khoản phiên bản 1</p>",
            "required_documents_json": json.dumps(["CITIZEN_ID"]),
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    tmpl_id = create_resp.json()["template_id"]
    assert create_resp.json()["version_no"] == 1

    # 2. Bump version to v2 with updated content
    update_resp = client.put(
        f"/api/v1/catalog/contract-templates/{tmpl_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "content_html": "<p>Điều khoản phiên bản 2 đã cập nhật quy định mới</p>",
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["version_no"] == 2
    assert "phiên bản 2" in update_resp.json()["content_html"]

    # Cleanup
    db = SessionLocal()
    try:
        db.query(ContractTemplate).filter(ContractTemplate.template_id == tmpl_id).delete()
        db.commit()
    finally:
        db.close()


def test_invalid_contract_type_rejected():
    """Verify arbitrary/unhandled contract codes outside the 4 standard types are rejected."""
    token = get_admin_token()

    resp = client.post(
        "/api/v1/catalog/contract-templates",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "template_code": "HD-INVALID",
            "contract_type": "ARBITRARY_TYPE_INVALID",
            "template_name": "Mẫu không hợp lệ",
            "content_html": "<p>Invalid</p>",
            "is_active": True,
        },
    )
    assert resp.status_code == 422  # Pydantic validation error
