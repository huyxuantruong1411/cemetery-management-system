import uuid

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import Role, User
from app.modules.auth.service import AuthService

client = TestClient(app)


def test_login_success_and_me():
    """Verify login with correct credentials returns valid tokens and /me returns user info."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0

    token = data["access_token"]

    # Call /me with Bearer token
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == "admin"
    assert me_data["is_active"] is True
    assert any(r["role_name"] == "ADMIN" for r in me_data["roles"])
    assert "plots:read" in me_data["permissions"]


def test_login_invalid_credentials():
    """Verify login with incorrect password or username returns 401."""
    # Wrong password
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "WrongPassword123!"},
    )
    assert resp.status_code == 401

    # Non-existent user
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "ghost_user_999", "password": "Password123!"},
    )
    assert resp.status_code == 401


def test_refresh_token_rotation_and_reuse_detection():
    """Verify refresh token rotation and anti-theft session family revocation (RFC 6819)."""
    # 1. Login to get initial tokens
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert login_resp.status_code == 200
    r1 = login_resp.json()["refresh_token"]

    # 2. Rotate refresh token
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": r1},
    )
    assert refresh_resp.status_code == 200
    data2 = refresh_resp.json()
    r2 = data2["refresh_token"]
    a2 = data2["access_token"]
    assert r2 != r1

    # New access token works
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {a2}"},
    )
    assert me_resp.status_code == 200

    # 3. Reuse detection: Attempt to reuse r1
    reuse_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": r1},
    )
    assert reuse_resp.status_code == 401
    assert "tái sử dụng" in reuse_resp.json()["detail"].lower()

    # 4. Entire session family revoked: r2 must also be rejected now!
    r2_after_reuse = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": r2},
    )
    assert r2_after_reuse.status_code == 401


def test_immediate_revocation_g01():
    """Verify that bumping auth_version immediately invalidates active access tokens."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    username = f"user_g01_{suffix}"

    try:
        # Create user
        marketing_role = db.query(Role).filter(Role.role_name == "MARKETING").first()
        from app.modules.auth.schemas import UserCreateRequest

        user = AuthService.create_user(
            db,
            UserCreateRequest(
                username=username,
                password="TestPassword123!",
                full_name="Nhân viên G01",
                email=f"{username}@example.com",
                role_ids=[marketing_role.role_id] if marketing_role else [],
            ),
        )

        # Login
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "TestPassword123!"},
        )
        assert login_resp.status_code == 200
        access_token = login_resp.json()["access_token"]

        # Token works initially
        me_resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_resp.status_code == 200

        # Trigger immediate revocation by bumping auth_version
        AuthService.revoke_all_user_sessions(db, user.user_id)

        # Token must be rejected with 401 immediately
        me_revoked = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_revoked.status_code == 401
        assert "thu hồi" in me_revoked.json()["detail"].lower()

    finally:
        # Cleanup
        db.query(User).filter(User.username == username).delete()
        db.commit()
        db.close()


def test_rbac_permission_scope():
    """Verify that users without permission get 403 Forbidden while ADMIN has full access."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    mkt_username = f"mkt_{suffix}"

    try:
        marketing_role = db.query(Role).filter(Role.role_name == "MARKETING").first()
        from app.modules.auth.schemas import UserCreateRequest

        AuthService.create_user(
            db,
            UserCreateRequest(
                username=mkt_username,
                password="TestPassword123!",
                full_name="Nhân viên Marketing Test",
                email=f"{mkt_username}@example.com",
                role_ids=[marketing_role.role_id] if marketing_role else [],
            ),
        )

        # Login as marketing user
        mkt_login = client.post(
            "/api/v1/auth/login",
            json={"username": mkt_username, "password": "TestPassword123!"},
        )
        assert mkt_login.status_code == 200
        mkt_token = mkt_login.json()["access_token"]

        # Marketing accesses /users (requires users:read) -> should get 403 Forbidden!
        mkt_forbidden = client.get(
            "/api/v1/auth/users",
            headers={"Authorization": f"Bearer {mkt_token}"},
        )
        assert mkt_forbidden.status_code == 403
        assert "Từ chối" in mkt_forbidden.json()["detail"]

        # Admin accesses /users -> should succeed with 200 OK!
        admin_login = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin2026!"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        admin_allowed = client.get(
            "/api/v1/auth/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_allowed.status_code == 200
        users_list = admin_allowed.json()
        assert len(users_list) >= 1

    finally:
        db.query(User).filter(User.username == mkt_username).delete()
        db.commit()
        db.close()


def test_logout_session():
    """Verify that logging out revokes the refresh token."""
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    # Logout
    logout_resp = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Refresh with revoked token should fail with 401
    refresh_fail = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_fail.status_code == 401
