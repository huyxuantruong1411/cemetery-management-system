from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.modules.jobs.models import BackgroundJob, OutboxEvent
from app.modules.jobs.service import OutboxService

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_enqueue_and_process_pdf_job():
    """Verify enqueuing a background job, claiming it, and processing the PDF generation."""
    token = get_admin_token()

    # 1. Enqueue PDF generation job
    enqueue_resp = client.post(
        "/api/v1/jobs/generate-pdf",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "contract_code": "HD_ASYNC_999",
            "contract_type": "LAND_PURCHASE",
            "customer_name": "Lê Văn Hùng",
            "customer_phone": "0987654321",
            "customer_citizen_id": "079200009999",
            "plot_code": "B2-10",
            "total_amount": "200,000,000",
        },
    )
    assert enqueue_resp.status_code == 202, enqueue_resp.text
    job_data = enqueue_resp.json()
    job_id = job_data["job_id"]
    assert job_data["state"] == "PENDING"
    assert job_data["job_type"] == "GENERATE_PDF_CONTRACT"

    # 2. Check job status while pending
    status_resp = client.get(
        f"/api/v1/jobs/{job_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["state"] == "PENDING"

    # 3. Simulate worker processing the job
    process_resp = client.post(
        f"/api/v1/jobs/{job_id}/process",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert process_resp.status_code == 200, process_resp.text
    completed_data = process_resp.json()
    assert completed_data["state"] == "COMPLETED"
    assert "file_id" in completed_data["result"]

    # 4. Cleanup job
    db = SessionLocal()
    try:
        db.query(BackgroundJob).filter(BackgroundJob.job_id == job_id).delete()
        db.commit()
    finally:
        db.close()


def test_outbox_publish_and_process():
    """Verify outbox event publishing within transaction and state transition to PROCESSED."""
    db = SessionLocal()
    event = None
    try:
        # Publish event
        event = OutboxService.publish_event(
            db=db,
            aggregate_type="CONTRACT",
            aggregate_id="HD_TEST_OUTBOX",
            event_type="CONTRACT_ACTIVATED",
            payload={"contract_id": 999, "plot_id": 12, "amount": 150000000},
        )
        db.commit()
        db.refresh(event)
        assert event.event_id is not None
        assert event.state == "PENDING"

        # Query pending
        pending = OutboxService.get_pending_events(db)
        found = [e for e in pending if e.event_id == event.event_id]
        assert len(found) == 1

        # Mark processed
        OutboxService.mark_event_processed(db, event.event_id)
        db.refresh(event)
        assert event.state == "PROCESSED"
        assert event.processed_at is not None

    finally:
        if event and event.event_id:
            db.query(OutboxEvent).filter(OutboxEvent.event_id == event.event_id).delete()
            db.commit()
        db.close()
