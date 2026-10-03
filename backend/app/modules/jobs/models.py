from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from app.db.session import Base


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    job_id = Column(String(64), primary_key=True)
    job_type = Column(String(50), nullable=False)
    payload = Column(Text, nullable=False)
    result = Column(Text, nullable=True)
    state = Column(String(20), nullable=False, default="PENDING")  # PENDING, CLAIMED, COMPLETED, FAILED
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    lease_until = Column(DateTime, nullable=True)
    claimed_by_worker = Column(String(100), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    event_id = Column(String(64), primary_key=True)
    aggregate_type = Column(String(50), nullable=False)
    aggregate_id = Column(String(100), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    state = Column(String(20), nullable=False, default="PENDING")  # PENDING, PROCESSED, FAILED
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)
