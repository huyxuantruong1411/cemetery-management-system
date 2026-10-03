from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class CarePackage(Base):
    __tablename__ = "care_packages"

    package_id = Column(Integer, primary_key=True, autoincrement=True)
    package_code = Column(String(50), unique=True, nullable=False)
    package_name = Column(String(100), nullable=False)
    cycle_type = Column(String(20), nullable=False)  # MONTHLY, QUARTERLY, YEARLY
    default_tasks_json = Column(Text, nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)


class CareSchedule(Base):
    __tablename__ = "care_schedules"

    schedule_id = Column(Integer, primary_key=True, autoincrement=True)
    care_annex_id = Column(Integer, ForeignKey("care_annexes.annex_id"), nullable=False)
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    package_id = Column(Integer, ForeignKey("care_packages.package_id"), nullable=False)
    caretaker_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    scheduled_date = Column(Date, nullable=False)
    performed_date = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="SCHEDULED")
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    checklist_items = relationship(
        "CareChecklistItem", back_populates="schedule", cascade="all, delete-orphan"
    )
    media_evidences = relationship(
        "CareMediaEvidence", back_populates="schedule", cascade="all, delete-orphan"
    )


class CareChecklistItem(Base):
    __tablename__ = "care_checklist_items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(
        Integer, ForeignKey("care_schedules.schedule_id", ondelete="CASCADE"), nullable=False
    )
    task_description = Column(String(255), nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    field_notes = Column(Text, nullable=True)

    schedule = relationship("CareSchedule", back_populates="checklist_items")


class CareMediaEvidence(Base):
    __tablename__ = "care_media_evidences"

    evidence_id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(
        Integer, ForeignKey("care_schedules.schedule_id", ondelete="CASCADE"), nullable=False
    )
    media_url = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    caption = Column(String(255), nullable=True)

    schedule = relationship("CareSchedule", back_populates="media_evidences")
