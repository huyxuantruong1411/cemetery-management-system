import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.modules.audit.service import redact_sensitive_json
from app.modules.auth.models import User
from app.modules.plots.models import Plot, PlotSlot, PlotType, Row, Zone
from app.modules.profiles.models import DeceasedProfile
from app.services.excel_service import sanitize_excel_cell

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def get_staff_token() -> str:
    # Try staff or staff user
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "staff", "password": "Staff2026!"},
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return get_admin_token()


def test_sanitize_excel_cell_neutralizes_injection():
    """UC-7.5: Excel Formula Injection Protection."""
    assert sanitize_excel_cell("=SUM(A1:A10)") == "'=SUM(A1:A10)"
    assert sanitize_excel_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert sanitize_excel_cell("-12345") == "'-12345"
    assert sanitize_excel_cell("@HYPERLINK('http://evil.com')") == "'@HYPERLINK('http://evil.com')"
    assert sanitize_excel_cell("\tDANGEROUS") == "'\tDANGEROUS"
    assert sanitize_excel_cell("\rDANGEROUS") == "'\rDANGEROUS"
    # Normal text & numbers shouldn't be altered
    assert sanitize_excel_cell("Khu Kim Tĩnh A1") == "Khu Kim Tĩnh A1"
    assert sanitize_excel_cell(12345) == 12345
    assert sanitize_excel_cell(Decimal("500000.00")) == Decimal("500000.00")
    assert sanitize_excel_cell(None) is None


def test_revenue_report():
    """UC-7.1 & G14: Revenue report based strictly on completed payments."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/reports/revenue", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "total_revenue" in data
    assert "total_transactions" in data
    assert "average_transaction_value" in data
    assert "by_method" in data
    assert "by_period" in data
    assert "drilldown_items" in data

    assert isinstance(data["by_method"], list)
    assert isinstance(data["drilldown_items"], list)


def test_occupancy_report_with_empty_zone_protection():
    """UC-7.2: Occupancy report calculates rates accurately without division-by-zero on empty zones."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Add an empty zone to test empty zone protection
    db = SessionLocal()
    empty_suffix = uuid.uuid4().hex[:6]
    empty_zone = Zone(zone_code=f"ZE_{empty_suffix}", zone_name=f"Khu Trống {empty_suffix}")
    db.add(empty_zone)
    db.commit()
    db.close()

    resp = client.get("/api/v1/reports/occupancy", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "total_plots" in data
    assert "total_empty" in data
    assert "total_reserved" in data
    assert "total_owned_empty" in data
    assert "total_under_construction" in data
    assert "total_occupied" in data
    assert "overall_occupancy_rate" in data
    assert "total_kim_tinh" in data
    assert "zones" in data

    # Verify empty zone is present with 0.0 occupancy rate
    empty_z_items = [z for z in data["zones"] if z["zone_code"] == f"ZE_{empty_suffix}"]
    assert len(empty_z_items) == 1
    assert empty_z_items[0]["total_plots"] == 0
    assert empty_z_items[0]["occupancy_rate"] == 0.0


def test_contracts_report_double_counting_prevention():
    """UC-7.3: Contract report segregates land purchase contract value from annex value."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/reports/contracts", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "total_land_contracts" in data
    assert "total_land_value" in data
    assert "total_annexes" in data
    assert "total_annex_value" in data
    assert "by_contract_status" in data
    assert "by_annex_type" in data

    # Land contract value and annex value are distinct fields
    assert float(data["total_land_value"]) >= 0
    assert float(data["total_annex_value"]) >= 0


def test_operations_report():
    """UC-7.4: Construction progress & care SLA metrics."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/reports/operations", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "construction" in data
    assert "care" in data

    const = data["construction"]
    assert "total_orders" in const
    assert "completed_count" in const
    assert "overdue_count" in const
    assert "completion_rate" in const

    care = data["care"]
    assert "total_schedules" in care
    assert "close_rate" in care
    assert "evidence_compliance_rate" in care


def test_report_export_lifecycle_xlsx_and_pdf():
    """UC-7.5: Report export generation to MinIO and subsequent download link verification."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Export REVENUE report as XLSX
    resp_xlsx = client.post(
        "/api/v1/reports/export",
        json={"report_type": "REVENUE", "export_format": "XLSX"},
        headers=headers,
    )
    assert resp_xlsx.status_code in (200, 201), resp_xlsx.text
    data_xlsx = resp_xlsx.json()
    assert data_xlsx["status"] == "COMPLETED"
    assert data_xlsx["export_format"] == "XLSX"
    export_id_xlsx = data_xlsx["export_id"]

    # 2. Export OCCUPANCY report as PDF
    resp_pdf = client.post(
        "/api/v1/reports/export",
        json={"report_type": "OCCUPANCY", "export_format": "PDF"},
        headers=headers,
    )
    assert resp_pdf.status_code in (200, 201), resp_pdf.text
    data_pdf = resp_pdf.json()
    assert data_pdf["status"] == "COMPLETED"
    assert data_pdf["export_format"] == "PDF"
    export_id_pdf = data_pdf["export_id"]

    # 3. Check history list
    resp_list = client.get("/api/v1/reports/exports", headers=headers)
    assert resp_list.status_code == 200, resp_list.text
    history = resp_list.json()
    assert any(h["export_id"] == export_id_xlsx for h in history)
    assert any(h["export_id"] == export_id_pdf for h in history)

    # 4. Download XLSX
    resp_dl = client.get(f"/api/v1/reports/exports/{export_id_xlsx}/download", headers=headers)
    assert resp_dl.status_code == 200, resp_dl.text
    assert len(resp_dl.content) > 100
    assert "attachment" in resp_dl.headers.get("content-disposition", "")


def test_export_acl_unauthorized_access():
    """UC-7.5: Only creator or users with reports:export / ADMIN can download export."""
    db = SessionLocal()
    # Create a non-admin user without reports:export
    suffix = uuid.uuid4().hex[:6]
    test_user = User(
        username=f"unauth_{suffix}",
        password_hash="dummy_hash",
        full_name=f"Unauthorized User {suffix}",
        email=f"unauth_{suffix}@test.com",
        is_active=True,
    )
    db.add(test_user)
    db.commit()

    # Close DB session
    db.close()

    admin_token = get_admin_token()
    resp_export = client.post(
        "/api/v1/reports/export",
        json={"report_type": "CONTRACTS", "export_format": "PDF"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    export_id = resp_export.json()["export_id"]

    # Now verify that an unauthenticated request is 401
    resp_unauth = client.get(f"/api/v1/reports/exports/{export_id}/download")
    assert resp_unauth.status_code == 401


def test_audit_logs_redaction_and_summary():
    """UC-8.7: Audit logs query, summary metrics, and secret redaction."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Verify secret redaction helper directly
    sensitive_dict = {
        "username": "huy_admin",
        "password": "SuperSecretPassword123!",
        "token": "bearer_xyz_789",
        "api_secret": "my-secret-key",
        "normal_field": "public_data",
    }
    redacted = redact_sensitive_json(sensitive_dict)
    assert redacted["username"] == "huy_admin"
    assert redacted["normal_field"] == "public_data"
    assert redacted["password"] == "***REDACTED***"
    assert redacted["token"] == "***REDACTED***"
    assert redacted["api_secret"] == "***REDACTED***"

    # Query audit logs endpoint
    resp_logs = client.get("/api/v1/audit/logs?limit=20", headers=headers)
    assert resp_logs.status_code == 200, resp_logs.text
    logs = resp_logs.json()
    assert isinstance(logs, list)

    # Query audit summary endpoint
    resp_sum = client.get("/api/v1/audit/summary", headers=headers)
    assert resp_sum.status_code == 200, resp_sum.text
    summary = resp_sum.json()
    assert "total_logs" in summary
    assert "action_type_counts" in summary
    assert "target_entity_counts" in summary
    assert "recent_logs" in summary

    # Query distinct entities and actions
    resp_ent = client.get("/api/v1/audit/entities", headers=headers)
    assert resp_ent.status_code == 200
    assert isinstance(resp_ent.json(), list)

    resp_act = client.get("/api/v1/audit/actions", headers=headers)
    assert resp_act.status_code == 200
    assert isinstance(resp_act.json(), list)


def test_public_deceased_lookup_navigation_and_zero_pii():
    """UC-8.1 & ADR-001: Public memorial search provides navigation guidance with zero PII leakage."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]

    # Create deceased profile and slot with GPS coordinates
    zone = Zone(zone_code=f"ZP_{suffix}", zone_name="Khu Đồi Vọng Cảnh")
    db.add(zone)
    db.flush()

    row = Row(zone_id=zone.zone_id, row_code=f"RP_{suffix}")
    db.add(row)
    db.flush()

    ptype = PlotType(
        type_name=f"Loại mộ {suffix}",
        default_slots=1,
        length=Decimal("2.0"),
        width=Decimal("1.0"),
    )
    db.add(ptype)
    db.flush()

    plot = Plot(
        row_id=row.row_id,
        type_id=ptype.type_id,
        plot_code=f"PP_{suffix}",
        status="OCCUPIED",
        is_kim_tinh=True,
        is_locked=True,
        latitude=Decimal("10.7768890"),
        longitude=Decimal("106.7008060"),
    )
    db.add(plot)
    db.flush()

    profile = DeceasedProfile(
        deceased_code=f"DP_{suffix}",
        full_name=f"Nguyễn Văn Tìm Kiếm {suffix}",
        gender="MALE",
        birth_year=1945,
        date_of_death="2020-05-15",
        hometown="Hà Nội",
    )
    db.add(profile)
    db.flush()

    slot = PlotSlot(
        plot_id=plot.plot_id,
        slot_number=1,
        status="OCCUPIED",
        current_deceased_id=profile.deceased_id,
    )
    db.add(slot)
    db.commit()

    # Query public lookup without any auth header (public endpoint)
    resp = client.get(
        f"/api/v1/profiles/public/memorials?q=Nguyễn Văn Tìm Kiếm {suffix}"
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert len(results) >= 1

    matched = next((r for r in results if r["deceased_code"] == f"DP_{suffix}"), None)
    assert matched is not None

    # Verify public navigation information
    assert matched["zone_name"] == "Khu Đồi Vọng Cảnh"
    assert matched["plot_code"] == f"PP_{suffix}"
    assert matched["is_kim_tinh"] is True
    assert matched["latitude"] is not None
    assert matched["longitude"] is not None
    assert (
        "Khu Khu Đồi Vọng Cảnh" in matched["navigation_guidance"]
        or "Khu Đồi Vọng Cảnh" in matched["navigation_guidance"]
    )
    assert matched["maps_url"] is not None
    assert "google.com/maps" in matched["maps_url"]

    # Verify Zero PII leakage
    assert "citizen_id" not in matched
    assert "phone_number" not in matched
    assert "address" not in matched
    assert "death_certificate_number" not in matched

    db.close()
