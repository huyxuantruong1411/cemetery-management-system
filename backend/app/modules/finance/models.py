from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class Receivable(Base):
    __tablename__ = "receivables"

    receivable_id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(Integer, nullable=True)
    annex_id = Column(Integer, nullable=True)
    customer_id = Column(Integer, nullable=False)
    original_amount = Column(Numeric(15, 2), nullable=False)
    discount_amount = Column(Numeric(15, 2), nullable=False, default=0)
    final_payable_amount = Column(Numeric(15, 2), nullable=False)
    total_paid_amount = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="UNPAID")
    due_date = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    payments = relationship("Payment", back_populates="receivable")
    discounts = relationship("DiscountRecord", back_populates="receivable")


class DiscountRecord(Base):
    __tablename__ = "discount_records"

    discount_id = Column(Integer, primary_key=True, autoincrement=True)
    receivable_id = Column(
        Integer, ForeignKey("receivables.receivable_id", ondelete="CASCADE"), nullable=False
    )
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)
    calculated_amount = Column(Numeric(15, 2), nullable=False)
    justification_reason = Column(String(255), nullable=False)
    approved_by_user_id = Column(Integer, nullable=True)
    applied_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    receivable = relationship("Receivable", back_populates="discounts")


class Payment(Base):
    __tablename__ = "payments"

    # CRITICAL: Table has trigger trg_payments_sync_receivable_balance
    # SQLAlchemy default OUTPUT INSERTED fails on MSSQL tables with triggers.
    __table_args__ = {"implicit_returning": False}

    payment_id = Column(Integer, primary_key=True, autoincrement=True)
    receivable_id = Column(Integer, ForeignKey("receivables.receivable_id"), nullable=False)
    paid_amount = Column(Numeric(15, 2), nullable=False)
    payment_method = Column(String(20), nullable=False)
    transaction_reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    recorded_by_user_id = Column(Integer, nullable=True)

    receivable = relationship("Receivable", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payment", uselist=False)


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    payment_id = Column(Integer, ForeignKey("payments.payment_id"), unique=True, nullable=False)
    issued_date = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    total_amount_in_words = Column(String(255), nullable=False)
    pdf_file_url = Column(String(500), nullable=True)

    payment = relationship("Payment", back_populates="invoice")
