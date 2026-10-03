import uuid
from datetime import date

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.modules.profiles.service import ProfileService

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_create_customer_success():
    """Verify customer creation with date_of_birth (G07) and auto-generated customer_code."""
    token = get_admin_token()
    unique_suffix = str(uuid.uuid4())[:8]
    cccd = f"079099{unique_suffix[:6]}"

    payload = {
        "full_name": f"Nguyễn Thị Test {unique_suffix}",
        "citizen_id": cccd,
        "phone_number": "0912345678",
        "email": f"test_{unique_suffix}@example.com",
        "address": "456 CMT8, Quận 3, TP.HCM",
        "date_of_birth": "1990-05-15",
    }

    resp = client.post(
        "/api/v1/profiles/customers",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["customer_id"] > 0
    assert data["customer_code"].startswith("KH-")
    assert data["full_name"] == payload["full_name"]
    assert data["citizen_id"] == cccd
    assert data["date_of_birth"] == "1990-05-15"


def test_create_customer_duplicate_cccd_rejected():
    """Verify duplicate citizen_id (CCCD) is rejected with 409 Conflict."""
    token = get_admin_token()
    unique_suffix = str(uuid.uuid4())[:8]
    cccd = f"079088{unique_suffix[:6]}"

    payload = {
        "full_name": "Khách hàng Một",
        "citizen_id": cccd,
        "phone_number": "0900000001",
        "address": "Địa chỉ Một",
    }
    resp1 = client.post(
        "/api/v1/profiles/customers",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp1.status_code == 201, resp1.text

    # Second creation with identical CCCD
    payload2 = {
        "full_name": "Khách hàng Hai (Trùng CCCD)",
        "citizen_id": cccd,
        "phone_number": "0900000002",
        "address": "Địa chỉ Hai",
    }
    resp2 = client.post(
        "/api/v1/profiles/customers",
        json=payload2,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 409, resp2.text
    assert "đã tồn tại" in resp2.json()["detail"]


def test_deceased_dob_validation_invariants():
    """Verify that date_of_birth > date_of_death and birth_year > date_of_death.year are rejected."""
    token = get_admin_token()

    # Case 1: date_of_birth after date_of_death
    invalid_payload_1 = {
        "full_name": "Người Mất Nghịch Lý 1",
        "gender": "MALE",
        "date_of_birth": "2025-01-01",
        "date_of_death": "2020-01-01",
        "birth_date_precision": "EXACT",
    }
    resp1 = client.post(
        "/api/v1/profiles/deceased",
        json=invalid_payload_1,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp1.status_code == 422 or resp1.status_code == 400

    # Case 2: birth_year after year of death
    invalid_payload_2 = {
        "full_name": "Người Mất Nghịch Lý 2",
        "gender": "MALE",
        "date_of_death": "2020-05-10",
        "birth_year": 2022,
        "birth_date_precision": "YEAR_ONLY",
    }
    resp2 = client.post(
        "/api/v1/profiles/deceased",
        json=invalid_payload_2,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 422 or resp2.status_code == 400


def test_deceased_year_only_precision_g07():
    """
    Verify G07 precision: when relative only remembers year of birth (e.g., 1938),
    system stores birth_year=1938, birth_date_precision='YEAR_ONLY' and DOES NOT fake date_of_birth='1938-01-01'.
    """
    token = get_admin_token()
    unique_suffix = str(uuid.uuid4())[:8]

    payload = {
        "full_name": f"Cụ Già Test {unique_suffix}",
        "gender": "FEMALE",
        "date_of_death": "2023-11-20",
        "birth_year": 1938,
        "birth_date_precision": "YEAR_ONLY",
        "hometown": "Nam Định",
        "religion": "Phật giáo",
    }

    resp = client.post(
        "/api/v1/profiles/deceased",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["deceased_code"].startswith("NM-")
    assert data["birth_year"] == 1938
    assert data["birth_date_precision"] == "YEAR_ONLY"
    assert data["date_of_birth"] is None, "Hệ thống tuyệt đối không được tự bịa ngày 01/01 khi chỉ biết năm sinh!"


def test_death_certificate_verification_workflow_g08():
    """
    Verify G08 workflow:
    1. New certificate is initially unverified (is_verified=False, verified_by=None, verified_at=None).
    2. ProfileService.check_death_certificate_verified returns False.
    3. Verification sets is_verified=True, records verified_by and verified_at timestamp.
    4. ProfileService.check_death_certificate_verified returns True.
    5. Rejection sets is_verified=False and records rejection_reason.
    """
    token = get_admin_token()
    unique_suffix = str(uuid.uuid4())[:8]

    # Create deceased profile
    dec_resp = client.post(
        "/api/v1/profiles/deceased",
        json={
            "full_name": f"Người Mất Có Giấy Chứng Tử {unique_suffix}",
            "gender": "MALE",
            "date_of_death": "2026-01-15",
            "birth_year": 1960,
            "birth_date_precision": "YEAR_ONLY",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dec_resp.status_code == 201, dec_resp.text
    deceased_id = dec_resp.json()["deceased_id"]

    # Attach certificate
    cert_payload = {
        "certificate_number": f"GTT-{unique_suffix}",
        "issuing_authority": "UBND Phường 10, Quận 10",
        "issue_date": str(date(2026, 1, 16)),
        "notes": "Bản quét gốc có dấu đỏ",
    }
    cert_resp = client.post(
        f"/api/v1/profiles/deceased/{deceased_id}/certificate",
        json=cert_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cert_resp.status_code == 200, cert_resp.text
    cert_data = cert_resp.json()
    cert_id = cert_data["cert_id"]
    assert cert_data["is_verified"] is False, "G08: Giấy báo tử mới đính kèm phải có trạng thái chưa xác minh!"
    assert cert_data["verified_at"] is None
    assert cert_data["verified_by"] is None

    # Check domain invariant helper
    db = SessionLocal()
    try:
        is_verified = ProfileService.check_death_certificate_verified(db, deceased_id)
        assert is_verified is False, "Chưa xác minh thì không thể kích hoạt an táng!"
    finally:
        db.close()

    # Verify certificate
    verify_resp = client.post(
        f"/api/v1/profiles/certificates/{cert_id}/verify",
        json={"is_verified": True, "notes": "Đã đối chiếu sổ đăng ký khai tử bản gốc"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert verify_resp.status_code == 200, verify_resp.text
    verified_data = verify_resp.json()
    assert verified_data["is_verified"] is True
    assert verified_data["verified_at"] is not None
    assert verified_data["verified_by"] is not None

    db = SessionLocal()
    try:
        is_verified = ProfileService.check_death_certificate_verified(db, deceased_id)
        assert is_verified is True, "Đã xác minh phải trả về True để cho phép an táng!"
    finally:
        db.close()

    # Reject / revoke certificate
    reject_resp = client.post(
        f"/api/v1/profiles/certificates/{cert_id}/verify",
        json={"is_verified": False, "rejection_reason": "Mộc đỏ bị mờ, yêu cầu nộp bản sao trích lục"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reject_resp.status_code == 200, reject_resp.text
    rejected_data = reject_resp.json()
    assert rejected_data["is_verified"] is False
    assert rejected_data["rejection_reason"] == "Mộc đỏ bị mờ, yêu cầu nộp bản sao trích lục"


def test_public_lookup_zero_pii_g19():
    """
    Verify Public Memorial Search:
    - Does NOT require authentication.
    - Returns deceased memorial information (name, year of birth/death, grave plot).
    - ABSOLUTELY ZERO PII (no citizen_id, no phone numbers, no address, no death certificates).
    """
    # Public lookup without any token
    resp = client.get("/api/v1/profiles/public/memorials?q=Nguyễn Văn Phúc")
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert len(results) >= 1

    item = results[0]
    assert "deceased_code" in item
    assert "full_name" in item
    assert item["full_name"] == "Cụ Nguyễn Văn Phúc"
    assert item["year_of_birth"] == 1940
    assert item["plot_code"] == "A-H01-02"

    # PII Leakage Check: verify forbidden fields are absent
    forbidden_pii = ["citizen_id", "phone_number", "email", "address", "certificate_number", "scan_file_url"]
    for field in forbidden_pii:
        assert field not in item, f"RÒ RỈ THÔNG TIN NHẠY CẢM: Cổng công khai chứa trường {field}!"


def test_customer_deceased_relation_link():
    """Verify establishing and querying customer-deceased relationship."""
    token = get_admin_token()
    unique_suffix = str(uuid.uuid4())[:8]

    # Create customer
    c_resp = client.post(
        "/api/v1/profiles/customers",
        json={
            "full_name": f"Bác Ba Test {unique_suffix}",
            "citizen_id": f"079077{unique_suffix[:6]}",
            "phone_number": "0933333333",
            "address": "Vũng Tàu",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    customer_id = c_resp.json()["customer_id"]

    # Create deceased
    d_resp = client.post(
        "/api/v1/profiles/deceased",
        json={
            "full_name": f"Cháu Bé Test {unique_suffix}",
            "gender": "FEMALE",
            "date_of_death": "2025-10-01",
            "birth_year": 2000,
            "birth_date_precision": "YEAR_ONLY",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    deceased_id = d_resp.json()["deceased_id"]

    # Link relation
    link_resp = client.post(
        "/api/v1/profiles/relations",
        json={
            "customer_id": customer_id,
            "deceased_id": deceased_id,
            "relationship_type": "Bác ruột",
            "is_primary_contact": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert link_resp.status_code == 201, link_resp.text
    link_data = link_resp.json()
    assert link_data["relationship_type"] == "Bác ruột"
    assert link_data["is_primary_contact"] is True

    # Verify customer detail reflects the link
    detail_resp = client.get(
        f"/api/v1/profiles/customers/{customer_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert len(detail_data["relations"]) == 1
    assert detail_data["relations"][0]["deceased_id"] == deceased_id
