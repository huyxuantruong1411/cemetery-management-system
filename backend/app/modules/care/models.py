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
    Unicode,
    UnicodeText,
)
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.modules.contracts.models import CareAnnex  # noqa: F401


class CarePackage(Base):
    __tablename__ = "care_packages"

    package_id = Column(Integer, primary_key=True, autoincrement=True)
    package_code = Column(String(50), unique=True, nullable=False)
    package_name = Column(Unicode(100), nullable=False)
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
    status = Column(
        String(20), nullable=False, default="SCHEDULED"
    )  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, OVERDUE
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # G12 extensions
    period_key = Column(String(50), nullable=True)  # e.g., '2026-M10'
    notes = Column(UnicodeText, nullable=True)
    completed_by_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    checklist_items = relationship(
        "CareChecklistItem",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="CareChecklistItem.sort_order",
    )
    media_evidences = relationship(
        "CareMediaEvidence", back_populates="schedule", cascade="all, delete-orphan"
    )
    plot = relationship("Plot")
    package = relationship("CarePackage")
    caretaker = relationship("User", foreign_keys=[caretaker_id])
    completed_by = relationship("User", foreign_keys=[completed_by_id])
    care_annex = relationship("CareAnnex")


class CareChecklistItem(Base):
    __tablename__ = "care_checklist_items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(
        Integer, ForeignKey("care_schedules.schedule_id", ondelete="CASCADE"), nullable=False
    )
    task_description = Column(Unicode(255), nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    field_notes = Column(UnicodeText, nullable=True)

    # G12 extensions
    is_required = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    schedule = relationship("CareSchedule", back_populates="checklist_items")


class CareMediaEvidence(Base):
    __tablename__ = "care_media_evidences"

    evidence_id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(
        Integer, ForeignKey("care_schedules.schedule_id", ondelete="CASCADE"), nullable=False
    )
    media_url = Column(String(500), nullable=True)
    uploaded_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    caption = Column(Unicode(255), nullable=True)

    # G12 extensions
    file_id = Column(String(64), ForeignKey("file_objects.file_id"), nullable=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    schedule = relationship("CareSchedule", back_populates="media_evidences")
    file_object = relationship("FileObject")
    uploaded_by = relationship("User")
