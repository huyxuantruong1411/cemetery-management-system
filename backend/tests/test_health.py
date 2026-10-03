from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_live():
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "live"
    assert "timestamp" in data
    assert "Hệ thống Quản lý Nghĩa trang" in data["app"]


def test_health_ready():
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "Database connected"
    assert data["storage"] == "Storage connected"


def test_version():
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "0.2.0"
    assert data["environment"] == "development"
