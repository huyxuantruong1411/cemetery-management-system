from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
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


class Zone(Base):
    __tablename__ = "zones"

    zone_id = Column(Integer, primary_key=True, autoincrement=True)
    zone_code = Column(String(20), unique=True, nullable=False)
    zone_name = Column(Unicode(100), nullable=False)
    total_rows = Column(Integer, nullable=False, default=0)
    description = Column(Unicode(255), nullable=True)

    rows = relationship("Row", back_populates="zone", cascade="all, delete-orphan")


class Row(Base):
    __tablename__ = "rows"

    row_id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(Integer, ForeignKey("zones.zone_id", ondelete="CASCADE"), nullable=False)
    row_code = Column(String(20), nullable=False)
    total_plots = Column(Integer, nullable=False, default=0)

    zone = relationship("Zone", back_populates="rows")
    plots = relationship("Plot", back_populates="row")


class PlotType(Base):
    __tablename__ = "plot_types"

    type_id = Column(Integer, primary_key=True, autoincrement=True)
    type_name = Column(Unicode(100), nullable=False)
    default_slots = Column(Integer, nullable=False, default=1)
    length = Column(Numeric(5, 2), nullable=False)
    width = Column(Numeric(5, 2), nullable=False)
    description = Column(Unicode(255), nullable=True)

    plots = relationship("Plot", back_populates="plot_type")


class Plot(Base):
    __tablename__ = "plots"

    # CRITICAL: Table has trigger trg_plots_enforce_kim_tinh_immutability
    # SQLAlchemy default OUTPUT INSERTED fails on MSSQL tables with triggers.
    __table_args__ = {"implicit_returning": False}

    plot_id = Column(Integer, primary_key=True, autoincrement=True)
    plot_code = Column(String(50), unique=True, nullable=False)
    row_id = Column(Integer, ForeignKey("rows.row_id"), nullable=False)
    type_id = Column(Integer, ForeignKey("plot_types.type_id"), nullable=False)
    owner_id = Column(Integer, nullable=True)  # FK to customers.customer_id
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    orientation = Column(Unicode(50), nullable=True)  # e.g., 'ĐÔNG', 'TÂY', 'NAM', 'BẮC'
    notes = Column(UnicodeText, nullable=True)
    status = Column(String(30), nullable=False, default="EMPTY_UNSOLD")
    is_kim_tinh = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    row = relationship("Row", back_populates="plots")
    plot_type = relationship("PlotType", back_populates="plots")
    slots = relationship("PlotSlot", back_populates="plot", cascade="all, delete-orphan", order_by="PlotSlot.slot_number")
    reservations = relationship("PlotReservation", back_populates="plot", cascade="all, delete-orphan")
    ownerships = relationship("PlotOwnership", back_populates="plot")
    burial_histories = relationship("BurialHistory", back_populates="plot")


class PlotSlot(Base):
    __tablename__ = "plot_slots"

    slot_id = Column(Integer, primary_key=True, autoincrement=True)
    plot_id = Column(Integer, ForeignKey("plots.plot_id", ondelete="CASCADE"), nullable=False)
    slot_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="EMPTY")
    current_deceased_id = Column(Integer, nullable=True)  # FK to deceased_profiles.deceased_id

    plot = relationship("Plot", back_populates="slots")


class PlotReservation(Base):
    __tablename__ = "plot_reservations"

    reservation_id = Column(Integer, primary_key=True, autoincrement=True)
    plot_id = Column(Integer, ForeignKey("plots.plot_id", ondelete="CASCADE"), nullable=False)
    reserved_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    customer_name = Column(Unicode(100), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    state = Column(String(20), nullable=False, default="ACTIVE")  # 'ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED'
    reserved_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    notes = Column(Unicode(500), nullable=True)

    plot = relationship("Plot", back_populates="reservations")


class PlotOwnership(Base):
    __tablename__ = "plot_ownerships"

    ownership_id = Column(Integer, primary_key=True, autoincrement=True)
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    basis_contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=True)
    valid_from = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    valid_to = Column(DateTime, nullable=True)
    transfer_reason = Column(Unicode(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    plot = relationship("Plot", back_populates="ownerships")


class BurialHistory(Base):
    __tablename__ = "burial_histories"

    history_id = Column(Integer, primary_key=True, autoincrement=True)
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    slot_id = Column(Integer, nullable=True)
    deceased_id = Column(Integer, nullable=False)
    action_type = Column(String(20), nullable=False)  # 'BURIED', 'EXHUMED'
    action_date = Column(DateTime, nullable=False)
    proof_url = Column(String(500), nullable=True)
    notes = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    plot = relationship("Plot", back_populates="burial_histories")
