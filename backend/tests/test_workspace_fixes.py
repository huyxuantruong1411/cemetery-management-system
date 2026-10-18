"""Regression coverage for the actor workspaces and labelled GIS demo data."""

from datetime import date

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import engine, get_db
from app.main import app
from app.modules.auth.models import Role, User
from app.modules.care.models import CareSchedule
from app.modules.care.service import CareService
from app.modules.construction.models import StaffUnavailability
from app.modules.contracts.models import ConstructionAnnex
from app.modules.plots.models import Plot
from scripts.seed_demo_workspace import populate
from tests.test_care import create_care_test_fixture
from tests.test_construction import create_test_active_contract_and_annex


@pytest.fixture
def isolated_db():
    with engine.connect() as connection:
        transaction = connection.begin()
        db = Session(bind=connection, join_transaction_mode="create_savepoint")
        app.dependency_overrides[get_db] = lambda: db
        try:
            yield db
        finally:
            app.dependency_overrides.pop(get_db, None)
            db.close()
            transaction.rollback()


def token(client, actor):
    password = {
        "marketing": "Marketing2026!",
        "accountant": "Accountant2026!",
        "caretaker": "Caretaker2026!",
    }[actor]
    response = client.post("/api/v1/auth/login", json={"username": actor, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_workspace_projections_and_revenue_routes(isolated_db):
    client = TestClient(app)
    accountant = token(client, "accountant")
    for path in ("finance/bases", "reports/revenue"):
        response = client.get(f"/api/v1/{path}", headers=accountant)
        assert response.status_code == 200, response.text
    caretaker = token(client, "caretaker")
    response = client.get("/api/v1/contracts/work-bases", headers=caretaker)
    assert response.status_code == 200, response.text
    for item in response.json():
        assert "annex_type" in item and "target_date" in item
        assert not {"citizen_id", "total_amount", "signed_scan_url"}.intersection(item)
    assert client.get("/api/v1/reports/revenue", headers=caretaker).status_code == 403
    for path in ("profiles/deceased", "profiles/deceased/1", "profiles/customers", "contracts"):
        assert client.get(f"/api/v1/{path}", headers=caretaker).status_code == 403


def test_marketing_cannot_enter_coordination_or_manage_catalog(isolated_db):
    client = TestClient(app)
    marketing = token(client, "marketing")
    for path in ("care/schedules", "construction/orders", "auth/staff"):
        assert client.get(f"/api/v1/{path}", headers=marketing).status_code == 403
    assert (
        client.post("/api/v1/catalog/care-packages", headers=marketing, json={}).status_code == 403
    )
    assert client.get("/api/v1/catalog/care-packages", headers=marketing).status_code == 200


def test_construction_work_basis_uses_existing_model_fields(isolated_db):
    annex, plot, _ = create_test_active_contract_and_annex(isolated_db)
    isolated_db.add(
        ConstructionAnnex(
            annex_id=annex.annex_id,
            plot_id=plot.plot_id,
            estimated_start_date=date(2026, 11, 1),
            estimated_end_date=date(2026, 11, 3),
        )
    )
    isolated_db.flush()
    client = TestClient(app)
    response = client.get("/api/v1/contracts/work-bases", headers=token(client, "caretaker"))
    assert response.status_code == 200, response.text
    item = next(x for x in response.json() if x["annex_id"] == annex.annex_id)
    assert item["plot_id"] == plot.plot_id
    assert item["service_summary"] == "Xây dựng mộ"
    assert item["target_date"] == "2026-11-01"
    assert item["due_date"] == "2026-11-03"


def test_construction_assignment_rejects_other_departments(isolated_db):
    annex, plot, _ = create_test_active_contract_and_annex(isolated_db)
    marketing = isolated_db.query(User).filter_by(username="marketing").one()
    staff = isolated_db.query(User).filter_by(username="demo.quantrang08").one()
    client = TestClient(app)
    headers = token(client, "caretaker")
    command = {
        "annex_id": annex.annex_id,
        "plot_id": plot.plot_id,
        "supervisor_id": marketing.user_id,
        "expected_end_date": "2026-11-30",
    }
    assert (
        client.post("/api/v1/construction/orders", headers=headers, json=command).status_code == 400
    )
    command["supervisor_id"] = staff.user_id
    response = client.post("/api/v1/construction/orders", headers=headers, json=command)
    assert response.status_code == 201, response.text
    order_id = response.json()["order_id"]
    response = client.post(
        f"/api/v1/construction/orders/{order_id}/tasks",
        headers=headers,
        json={"task_name": "Công việc thử nghiệm", "assignee_user_id": marketing.user_id},
    )
    assert response.status_code == 400, response.text


def test_plot_pagination_and_field_projection(isolated_db):
    client = TestClient(app)
    caretaker = token(client, "caretaker")
    first = client.get("/api/v1/plots?limit=500&skip=0", headers=caretaker).json()
    second = client.get("/api/v1/plots?limit=500&skip=500", headers=caretaker).json()
    assert first and second
    assert not {p["plot_id"] for p in first}.intersection(p["plot_id"] for p in second)
    assert any(p["latitude"] is not None for p in second)
    for plot in first + second:
        assert plot["owner_name"] is None and plot["active_reservation"] is None
        assert "is_synthetic" in plot and "plot_width" in plot


def test_demo_seed_is_idempotent_and_preserves_locked_plots_and_admin(isolated_db):
    db = isolated_db
    admin = db.query(Role).filter_by(role_name="ADMIN").one()
    admin_before = sorted(p.permission_code for p in admin.permissions)
    locked_before = {
        p.plot_id: (p.latitude, p.longitude, p.notes, p.status, p.owner_id)
        for p in db.query(Plot).filter(Plot.is_locked == True)  # noqa: E712
    }  # noqa: E712
    populate(db)
    db.flush()
    second, credentials = populate(db)
    assert not credentials
    assert not second["created_plots"] and not second["created_users"]
    assert not second["coordinates"] and not second["created_rows"]
    assert sorted(p.permission_code for p in admin.permissions) == admin_before
    assert {
        p.plot_id: (p.latitude, p.longitude, p.notes, p.status, p.owner_id)
        for p in db.query(Plot).filter(Plot.is_locked == True)  # noqa: E712
    } == locked_before  # noqa: E712
    staff = db.query(User).filter(User.username.like("demo.quantrang%")).all()
    assert len(staff) == 8
    assert all({r.role_name for r in u.roles} == {"CARETAKER"} for u in staff)


def test_assignment_rejects_absent_staff_and_accepts_another_caretaker(isolated_db):
    db = isolated_db
    fixture = create_care_test_fixture(db)
    busy = db.query(User).filter_by(username="demo.quantrang01").one()
    available = db.query(User).filter_by(username="demo.quantrang08").one()
    day = date(2026, 11, 17)
    schedule = CareSchedule(
        care_annex_id=fixture["care_annex"].annex_id,
        plot_id=fixture["plot"].plot_id,
        package_id=fixture["package"].package_id,
        scheduled_date=day,
        period_key="REGRESSION-20261017",
        status="SCHEDULED",
    )
    db.add(schedule)
    db.add(
        StaffUnavailability(
            user_id=busy.user_id, start_date=day, end_date=day, reason="SYNTHETIC regression"
        )
    )
    db.flush()
    with pytest.raises(HTTPException) as error:
        CareService.assign_caretaker(db, schedule.schedule_id, busy.user_id, available.user_id)
    assert error.value.status_code == 409
    assert schedule.caretaker_id is None
    result, conflict, _ = CareService.assign_caretaker(
        db, schedule.schedule_id, available.user_id, available.user_id
    )
    assert not conflict and result.caretaker_id == available.user_id
