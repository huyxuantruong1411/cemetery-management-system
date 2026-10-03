import uuid

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.modules.plots.models import Plot, PlotType, Row

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_list_zones_and_rows():
    """Verify zones and rows can be queried with correct counts."""
    token = get_admin_token()

    # List zones
    resp = client.get(
        "/api/v1/plots/zones",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    assert len(zones) >= 3
    zone_codes = [z["zone_code"] for z in zones]
    assert "KHU-A" in zone_codes
    assert "KHU-B" in zone_codes
    assert "KHU-VIP" in zone_codes

    # List rows
    resp_rows = client.get(
        "/api/v1/plots/rows",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_rows.status_code == 200, resp_rows.text
    rows = resp_rows.json()
    assert len(rows) >= 6


def test_plot_slot_auto_generation_in_acid_transaction():
    """Verify G04: creating a plot automatically generates 1..N slots in the same ACID transaction."""
    token = get_admin_token()

    db = SessionLocal()
    row = db.query(Row).first()
    # Find double slot plot type (default_slots = 2)
    pt_double = db.query(PlotType).filter(PlotType.default_slots == 2).first()
    db.close()

    assert row is not None
    assert pt_double is not None

    unique_code = f"TEST-P-{uuid.uuid4().hex[:6].upper()}"
    create_resp = client.post(
        "/api/v1/plots",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "plot_code": unique_code,
            "row_id": row.row_id,
            "type_id": pt_double.type_id,
            "latitude": 10.925500,
            "longitude": 106.825500,
            "orientation": "ĐÔNG",
            "is_kim_tinh": True,
            "notes": "Ô mộ thử nghiệm auto generation",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    plot_data = create_resp.json()
    assert plot_data["plot_code"] == unique_code
    assert plot_data["status"] == "EMPTY_UNSOLD"
    assert plot_data["is_kim_tinh"] is True

    # Check automatically generated slots
    slots = plot_data["slots"]
    assert len(slots) == 2, f"Expected 2 slots, got {len(slots)}"
    assert slots[0]["slot_number"] == 1
    assert slots[0]["status"] == "EMPTY"
    assert slots[1]["slot_number"] == 2
    assert slots[1]["status"] == "EMPTY"


def test_kim_tinh_immutability_reject_disabling():
    """Verify Kim Tĩnh Immutability: once is_kim_tinh is True, turning it False is strictly forbidden."""
    token = get_admin_token()

    db = SessionLocal()
    kt_plot = db.query(Plot).filter(Plot.is_kim_tinh == True).first()  # noqa: E712
    db.close()
    assert kt_plot is not None

    update_resp = client.put(
        f"/api/v1/plots/{kt_plot.plot_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "is_kim_tinh": False,
        },
    )
    assert update_resp.status_code == 400
    assert "QUY TẮC BẤT BIẾN KIM TĨNH" in update_resp.json()["detail"]


def test_kim_tinh_locked_immutability():
    """Verify Kim Tĩnh Immutability: once a Kim Tĩnh plot is locked, all modifications are rejected."""
    token = get_admin_token()

    db = SessionLocal()
    row = db.query(Row).first()
    pt = db.query(PlotType).filter(PlotType.default_slots == 2).first()
    assert row is not None and pt is not None

    # Create a dedicated Kim Tĩnh plot that is locked
    locked_code = f"KT-LOCKED-{uuid.uuid4().hex[:6].upper()}"
    p = Plot(
        plot_code=locked_code,
        row_id=row.row_id,
        type_id=pt.type_id,
        status="EMPTY_UNSOLD",
        is_kim_tinh=True,
        is_locked=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    plot_id = p.plot_id
    db.close()

    # Attempt to update should be rejected by server-side Kim Tĩnh guard
    update_resp = client.put(
        f"/api/v1/plots/{plot_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "notes": "Cố tình sửa đổi mộ đã khóa vĩnh viễn",
        },
    )
    assert update_resp.status_code == 400
    assert "khóa vĩnh viễn" in update_resp.json()["detail"]


def test_anti_double_booking_reservation_success_and_conflict():
    """Verify G04: Anti-double booking ensures exclusive reservation, returning 409 on conflict."""
    token = get_admin_token()

    db = SessionLocal()
    # Find an EMPTY_UNSOLD plot
    empty_plot = db.query(Plot).filter(Plot.status == "EMPTY_UNSOLD").first()
    assert empty_plot is not None
    plot_id = empty_plot.plot_id
    db.close()

    # 1. First reservation succeeds
    res_resp = client.post(
        f"/api/v1/plots/{plot_id}/reserve",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "customer_name": "Nguyễn Hoàng Nam",
            "customer_phone": "0987654321",
            "duration_hours": 24,
            "notes": "Giữ chỗ tham quan thực địa",
        },
    )
    assert res_resp.status_code == 200, res_resp.text
    res_data = res_resp.json()
    assert res_data["state"] == "ACTIVE"
    assert res_data["customer_name"] == "Nguyễn Hoàng Nam"

    # Verify plot status changed to RESERVED
    detail_resp = client.get(
        f"/api/v1/plots/{plot_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "RESERVED"
    assert detail_resp.json()["active_reservation"] is not None

    # 2. Second concurrent reservation on the same plot must raise 409 CONFLICT!
    conflict_resp = client.post(
        f"/api/v1/plots/{plot_id}/reserve",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "customer_name": "Lê Văn Tám",
            "customer_phone": "0912345678",
            "duration_hours": 48,
        },
    )
    assert conflict_resp.status_code == 409
    assert "người giữ chỗ" in conflict_resp.json()["detail"] or "Tạm giữ chỗ" in conflict_resp.json()["detail"]

    # 3. Cancel the reservation -> plot returns to EMPTY_UNSOLD
    cancel_resp = client.post(
        f"/api/v1/plots/{plot_id}/cancel-reservation",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "EMPTY_UNSOLD"

    # Check status again
    detail_resp2 = client.get(
        f"/api/v1/plots/{plot_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp2.json()["status"] == "EMPTY_UNSOLD"
    assert detail_resp2.json()["active_reservation"] is None


def test_plot_statistics_endpoint():
    """Verify plot statistics endpoint aggregates counts accurately."""
    token = get_admin_token()

    resp = client.get(
        "/api/v1/plots/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    stats = resp.json()
    assert stats["total_plots"] >= 10
    assert stats["empty_unsold"] >= 1
    assert stats["kim_tinh_count"] >= 3
