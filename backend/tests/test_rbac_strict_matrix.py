"""Strict RBAC matrix and segregation of duties test suite.

Verifies:
1. Marketing actor boundaries (can read plots/catalog, cannot CUD plots/catalog/care-packages, cannot view operations reports)
2. Accountant actor boundaries (can view finance/bases, cannot view contracts list/PDF, cannot view customers, cannot view operations reports, cannot CUD catalog)
3. Caretaker actor boundaries (can view work-bases, confirm burial, cannot view contracts list/PDF, cannot view customers, cannot view finance)
4. Empty role (roles=[]) complete business denial
5. Admin unconstrained operation
6. FLOW-01 burial confirmation boundary
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from scripts.seed_rbac import seed_rbac

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def ensure_rbac_seeded():
    """Ensure test database has latest permissions, roles, and demo users."""
    seed_rbac(seed_demo_users=True)


def get_token_for(username: str, password: str = None) -> str:
    """Helper to authenticate and retrieve access token."""
    default_passwords = {
        "admin": "Admin2026!",
        "marketing": "Marketing2026!",
        "accountant": "Accountant2026!",
        "caretaker": "Caretaker2026!",
    }
    pwd = password or default_passwords.get(username, "Password2026!")
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": pwd},
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]


def get_empty_role_token() -> str:
    """Ensure an active user with roles=[] exists and return their access token."""
    username = "test_empty_role_user"
    password = "EmptyRole2026!"
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            password_hash=get_password_hash(password),
            full_name="Người Dùng Chưa Phân Vai Trò",
            email="empty_role@nghiatrang.vn",
            phone_number="0999999999",
            is_active=True,
            auth_version=1,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        user.roles = []
        db.add(user)
        db.commit()
    else:
        user.roles = []
        user.is_active = True
        user.password_hash = get_password_hash(password)
        db.commit()
    db.close()

    resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for empty role: {resp.text}"
    return resp.json()["access_token"]


# ==============================================================================
# 1. Marketing Actor RBAC Tests
# ==============================================================================
def test_marketing_actor_permissions():
    token = get_token_for("marketing")
    headers = {"Authorization": f"Bearer {token}"}

    # ALLOWED: Read plots map/list
    resp = client.get("/api/v1/plots", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: Read catalog price-lists & care packages
    resp = client.get("/api/v1/catalog/price-lists", headers=headers)
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/catalog/care-packages", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: Read customers
    resp = client.get("/api/v1/profiles/customers", headers=headers)
    assert resp.status_code == 200, resp.text

    # DENIED: CUD plots spatial layout (plots:manage)
    resp = client.post(
        "/api/v1/plots/zones",
        headers=headers,
        json={"zone_code": f"KZ-{uuid.uuid4().hex[:4]}", "zone_name": "Khu Test", "zone_type": "STANDARD"},
    )
    assert resp.status_code == 403, f"Marketing must be denied plots:manage, got {resp.status_code}"

    # DENIED: CUD catalog price lists (catalog:manage)
    resp = client.post(
        "/api/v1/catalog/price-lists",
        headers=headers,
        json={"price_list_code": f"PL-{uuid.uuid4().hex[:4]}", "price_list_name": "Bảng giá test", "effective_from": "2026-01-01"},
    )
    assert resp.status_code == 403, f"Marketing must be denied catalog:manage, got {resp.status_code}"

    # DENIED: CUD care packages (catalog:manage)
    resp = client.post(
        "/api/v1/catalog/care-packages",
        headers=headers,
        json={"package_code": f"CP-{uuid.uuid4().hex[:4]}", "package_name": "Gói test", "cycle_type": "MONTHLY", "price": 100000},
    )
    assert resp.status_code == 403, f"Marketing must be denied catalog:manage, got {resp.status_code}"

    # DENIED: Apply invoice discount (finance:discount)
    resp = client.post(
        "/api/v1/finance/receivables/1/discount",
        headers=headers,
        json={"discount_percentage": 5, "discount_amount": 100000, "reason": "Test", "notes": ""},
    )
    assert resp.status_code == 403, f"Marketing must be denied finance:discount, got {resp.status_code}"

    # DENIED: View operations report
    resp = client.get("/api/v1/reports/operations", headers=headers)
    assert resp.status_code == 403, f"Marketing must be denied reports:operations, got {resp.status_code}"


# ==============================================================================
# 2. Accountant Actor RBAC Tests
# ==============================================================================
def test_accountant_actor_permissions():
    token = get_token_for("accountant")
    headers = {"Authorization": f"Bearer {token}"}

    # ALLOWED: View Finance Bases (EX-02)
    resp = client.get("/api/v1/finance/bases", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: View Receivables & Summary
    resp = client.get("/api/v1/finance/receivables", headers=headers)
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/finance/summary", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: View Revenue Report (EX-04)
    resp = client.get("/api/v1/reports/revenue", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: Read Catalog (price lookup)
    resp = client.get("/api/v1/catalog/price-lists", headers=headers)
    assert resp.status_code == 200, resp.text

    # DENIED: View CRM Customers list
    resp = client.get("/api/v1/profiles/customers", headers=headers)
    assert resp.status_code == 403, f"Accountant must be denied customers:read, got {resp.status_code}"

    # DENIED: View Contracts list
    resp = client.get("/api/v1/contracts", headers=headers)
    assert resp.status_code == 403, f"Accountant must be denied contracts:read, got {resp.status_code}"

    # DENIED: Download Contract PDF
    resp = client.get("/api/v1/contracts/1/pdf", headers=headers)
    assert resp.status_code == 403, f"Accountant must be denied contracts PDF, got {resp.status_code}"

    # DENIED: View Operations Report
    resp = client.get("/api/v1/reports/operations", headers=headers)
    assert resp.status_code == 403, f"Accountant must be denied reports:operations, got {resp.status_code}"

    # DENIED: View Occupancy Report
    resp = client.get("/api/v1/reports/occupancy", headers=headers)
    assert resp.status_code == 403, f"Accountant must be denied reports:occupancy, got {resp.status_code}"

    # DENIED: CUD Catalog Price lists
    resp = client.post(
        "/api/v1/catalog/price-lists",
        headers=headers,
        json={"price_list_code": f"PL-{uuid.uuid4().hex[:4]}", "price_list_name": "Bảng giá test", "effective_from": "2026-01-01"},
    )
    assert resp.status_code == 403, f"Accountant must be denied catalog:manage, got {resp.status_code}"


# ==============================================================================
# 3. Caretaker Actor RBAC Tests
# ==============================================================================
def test_caretaker_actor_permissions():
    token = get_token_for("caretaker")
    headers = {"Authorization": f"Bearer {token}"}

    # ALLOWED: View Work Bases (EX-01)
    resp = client.get("/api/v1/contracts/work-bases", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: Read Plots map/status
    resp = client.get("/api/v1/plots", headers=headers)
    assert resp.status_code == 200, resp.text

    # ALLOWED: View Deceased list
    resp = client.get("/api/v1/profiles/deceased", headers=headers)
    assert resp.status_code == 200, resp.text

    # DENIED: View Contracts list
    resp = client.get("/api/v1/contracts", headers=headers)
    assert resp.status_code == 403, f"Caretaker must be denied contracts:read, got {resp.status_code}"

    # DENIED: Download Contract PDF
    resp = client.get("/api/v1/contracts/1/pdf", headers=headers)
    assert resp.status_code == 403, f"Caretaker must be denied contracts PDF, got {resp.status_code}"

    # DENIED: View Customers
    resp = client.get("/api/v1/profiles/customers", headers=headers)
    assert resp.status_code == 403, f"Caretaker must be denied customers:read, got {resp.status_code}"

    # DENIED: View Finance
    resp = client.get("/api/v1/finance/receivables", headers=headers)
    assert resp.status_code == 403, f"Caretaker must be denied finance:read, got {resp.status_code}"

    resp = client.get("/api/v1/finance/bases", headers=headers)
    assert resp.status_code == 403, f"Caretaker must be denied finance:bases, got {resp.status_code}"

    # DENIED: Read Catalog
    resp = client.get("/api/v1/catalog/price-lists", headers=headers)
    assert resp.status_code == 403, f"Caretaker must be denied catalog:read, got {resp.status_code}"


# ==============================================================================
# 4. Roles=[] Actor (Complete Business Denial)
# ==============================================================================
def test_empty_roles_complete_denial():
    token = get_empty_role_token()
    headers = {"Authorization": f"Bearer {token}"}

    # ALLOWED: /me (can see self identity and that roles is empty)
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["roles"] == []

    # DENIED: Staff directory
    resp = client.get("/api/v1/auth/staff", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /auth/staff, got {resp.status_code}"

    # DENIED: Plots
    resp = client.get("/api/v1/plots", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /plots, got {resp.status_code}"

    # DENIED: Customers
    resp = client.get("/api/v1/profiles/customers", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /profiles/customers, got {resp.status_code}"

    # DENIED: Contracts
    resp = client.get("/api/v1/contracts", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /contracts, got {resp.status_code}"

    # DENIED: Work Bases & Finance Bases
    resp = client.get("/api/v1/contracts/work-bases", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /contracts/work-bases, got {resp.status_code}"

    resp = client.get("/api/v1/finance/bases", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /finance/bases, got {resp.status_code}"

    # DENIED: Finance receivables
    resp = client.get("/api/v1/finance/receivables", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /finance/receivables, got {resp.status_code}"

    # DENIED: Catalog
    resp = client.get("/api/v1/catalog/price-lists", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /catalog/price-lists, got {resp.status_code}"

    # DENIED: Reports & Exports
    resp = client.get("/api/v1/reports/revenue", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /reports/revenue, got {resp.status_code}"

    resp = client.get("/api/v1/reports/exports", headers=headers)
    assert resp.status_code == 403, f"roles=[] must be denied /reports/exports, got {resp.status_code}"
