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
    Unicode,
    UnicodeText,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ConstructionOrder(Base):
    __tablename__ = "construction_orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    annex_id = Column(Integer, ForeignKey("contract_annexes.annex_id"), nullable=False)
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    supervisor_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    start_date = Column(Date, nullable=True)
    expected_end_date = Column(Date, nullable=False)
    actual_end_date = Column(Date, nullable=True)
    overall_progress = Column(Numeric(5, 2), nullable=False, default=0)
    status = Column(
        String(30), nullable=False, default="PENDING"
    )  # PENDING, IN_PROGRESS, COMPLETED, CANCELLED, OVERDUE
    notes = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    tasks = relationship(
        "ConstructionTask",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="ConstructionTask.sort_order",
    )
    plot = relationship("Plot", foreign_keys=[plot_id])
    annex = relationship("ContractAnnex", foreign_keys=[annex_id])
    supervisor = relationship("User", foreign_keys=[supervisor_id])


class ConstructionTask(Base):
    __tablename__ = "construction_tasks"

    task_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(
        Integer, ForeignKey("construction_orders.order_id", ondelete="CASCADE"), nullable=False
    )
    task_name = Column(Unicode(150), nullable=False)
    assigned_team_or_contractor = Column(Unicode(100), nullable=True)
    assignee_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    is_required = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=1)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(
        String(20), nullable=False, default="TODO"
    )  # Allowed in CK_ct_status: TODO, DOING, DONE
    proof_media_url = Column(String(500), nullable=True)
    field_notes = Column(UnicodeText, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    order = relationship("ConstructionOrder", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_user_id])
    completer = relationship("User", foreign_keys=[completed_by])
    evidences = relationship(
        "ConstructionTaskEvidence",
        back_populates="task",
        cascade="all, delete-orphan",
    )


class ConstructionTaskEvidence(Base):
    __tablename__ = "construction_task_evidences"

    evidence_id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(
        Integer,
        ForeignKey("construction_tasks.task_id", ondelete="CASCADE"),
        nullable=False,
    )
    file_id = Column(
        String(64),
        ForeignKey("file_objects.file_id"),
        nullable=False,
    )
    caption = Column(Unicode(255), nullable=True)
    uploaded_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    uploaded_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    task = relationship("ConstructionTask", back_populates="evidences")
    file_object = relationship("FileObject", foreign_keys=[file_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])


class StaffUnavailability(Base):
    __tablename__ = "staff_unavailability"

    unavailability_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Unicode(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
