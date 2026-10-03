import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.modules.jobs.models import BackgroundJob, OutboxEvent


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class JobService:
    @classmethod
    def enqueue_job(
        cls,
        db: Session,
        job_type: str,
        payload: dict[str, Any],
        max_attempts: int = 3,
    ) -> BackgroundJob:
        """Enqueue a new durable background job."""
        job = BackgroundJob(
            job_id=uuid.uuid4().hex,
            job_type=job_type,
            payload=json.dumps(payload, ensure_ascii=False),
            result=None,
            state="PENDING",
            attempts=0,
            max_attempts=max_attempts,
            lease_until=None,
            claimed_by_worker=None,
            last_error=None,
            created_at=_utc_now_naive(),
            completed_at=None,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @classmethod
    def claim_next_job(
        cls,
        db: Session,
        worker_id: str,
        lease_seconds: int = 60,
    ) -> BackgroundJob | None:
        """Safely claim the next pending or expired lease job for execution."""
        now = _utc_now_naive()

        # Find eligible job: PENDING or CLAIMED with expired lease
        job = (
            db.query(BackgroundJob)
            .filter(
                (BackgroundJob.state == "PENDING")
                | ((BackgroundJob.state == "CLAIMED") & (BackgroundJob.lease_until < now))
            )
            .order_by(BackgroundJob.created_at.asc())
            .with_for_update()
            .first()
        )

        if not job:
            return None

        job.state = "CLAIMED"
        job.claimed_by_worker = worker_id
        job.lease_until = now + timedelta(seconds=lease_seconds)
        job.attempts += 1
        db.commit()
        db.refresh(job)
        return job

    @classmethod
    def complete_job(
        cls,
        db: Session,
        job_id: str,
        result: dict[str, Any] | None = None,
    ) -> BackgroundJob:
        """Mark job as successfully COMPLETED with optional result JSON."""
        job = db.get(BackgroundJob, job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.state = "COMPLETED"
        if result is not None:
            job.result = json.dumps(result, ensure_ascii=False)
        job.completed_at = _utc_now_naive()
        job.lease_until = None
        db.commit()
        db.refresh(job)
        return job

    @classmethod
    def fail_job(
        cls,
        db: Session,
        job_id: str,
        error_message: str,
    ) -> BackgroundJob:
        """Record job error and either retry or mark as FAILED."""
        job = db.get(BackgroundJob, job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.last_error = error_message[:1000]
        job.lease_until = None

        if job.attempts >= job.max_attempts:
            job.state = "FAILED"
            job.completed_at = _utc_now_naive()
        else:
            job.state = "PENDING"  # Allow retry by worker

        db.commit()
        db.refresh(job)
        return job


class OutboxService:
    @classmethod
    def publish_event(
        cls,
        db: Session,
        aggregate_type: str,
        aggregate_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> OutboxEvent:
        """Record an outbox event within the same database transaction as the business operation."""
        event = OutboxEvent(
            event_id=uuid.uuid4().hex,
            aggregate_type=aggregate_type,
            aggregate_id=str(aggregate_id),
            event_type=event_type,
            payload=json.dumps(payload, ensure_ascii=False),
            state="PENDING",
            retry_count=0,
            created_at=_utc_now_naive(),
            processed_at=None,
        )
        db.add(event)
        # Note: Do not commit here so the caller transaction controls atomicity
        return event

    @classmethod
    def get_pending_events(cls, db: Session, limit: int = 20) -> list[OutboxEvent]:
        """Fetch pending outbox events for asynchronous dispatching."""
        return (
            db.query(OutboxEvent)
            .filter(OutboxEvent.state == "PENDING")
            .order_by(OutboxEvent.created_at.asc())
            .limit(limit)
            .all()
        )

    @classmethod
    def mark_event_processed(cls, db: Session, event_id: str) -> None:
        """Mark outbox event as PROCESSED."""
        event = db.get(OutboxEvent, event_id)
        if event:
            event.state = "PROCESSED"
            event.processed_at = _utc_now_naive()
            db.commit()
