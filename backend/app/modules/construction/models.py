from datetime import datetime, timezone

from sqlalchemy import (
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


class ConstructionOrder(Base):
    __tablename__ = "construction_orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    annex_id = Column(Integer, ForeignKey("contract_annexes.annex_id"), nullable=False)
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    supervisor_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    start_date = Column(Date, nullable=False)
    expected_end_date = Column(Date, nullable=False)
    actual_end_date = Column(Date, nullable=True)
    overall_progress = Column(Numeric(5, 2), nullable=False, default=0)
    status = Column(String(30), nullable=False, default="PENDING")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    tasks = relationship("ConstructionTask", back_populates="order", cascade="all, delete-orphan")


class ConstructionTask(Base):
    __tablename__ = "construction_tasks"

    task_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(
        Integer, ForeignKey("construction_orders.order_id", ondelete="CASCADE"), nullable=False
    )
    task_name = Column(String(150), nullable=False)
    assigned_team_or_contractor = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="NOT_STARTED")
    proof_media_url = Column(String(500), nullable=True)
    field_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    order = relationship("ConstructionOrder", back_populates="tasks")
