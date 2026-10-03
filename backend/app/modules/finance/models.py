from datetime import datetime, timezone

from sqlalchemy import (
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


class Receivable(Base):
    __tablename__ = "receivables"

    receivable_id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=True)
    annex_id = Column(Integer, ForeignKey("contract_annexes.annex_id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    original_amount = Column(Numeric(15, 2), nullable=False)
    discount_amount = Column(Numeric(15, 2), nullable=False, default=0)
    final_payable_amount = Column(Numeric(15, 2), nullable=False)
    total_paid_amount = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="UNPAID")
    due_date = Column(Date, nullable=False)
    notes = Column(UnicodeText, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    installment_no = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    contract = relationship("Contract", backref="receivables", foreign_keys=[contract_id])
    annex = relationship("ContractAnnex", backref="receivables", foreign_keys=[annex_id])
    customer = relationship("Customer", backref="receivables", foreign_keys=[customer_id])
    creator = relationship("User", foreign_keys=[created_by_user_id])
    payments = relationship(
        "Payment", back_populates="receivable", order_by="Payment.paid_at.desc()"
    )
    discounts = relationship("DiscountRecord", back_populates="receivable")


class DiscountRecord(Base):
    __tablename__ = "discount_records"

    discount_id = Column(Integer, primary_key=True, autoincrement=True)
    receivable_id = Column(
        Integer, ForeignKey("receivables.receivable_id", ondelete="CASCADE"), nullable=False
    )
    discount_type = Column(String(20), nullable=False)  # 'PERCENTAGE' or 'FIXED_AMOUNT'
    discount_value = Column(Numeric(15, 2), nullable=False)
    calculated_amount = Column(Numeric(15, 2), nullable=False)
    justification_reason = Column(UnicodeText, nullable=False)
    approved_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    applied_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    receivable = relationship("Receivable", back_populates="discounts")
    approver = relationship("User", foreign_keys=[approved_by_user_id])


class Payment(Base):
    __tablename__ = "payments"

    # CRITICAL: Table has trigger trg_payments_sync_receivable_balance
    # SQLAlchemy default OUTPUT INSERTED fails on MSSQL tables with triggers.
    __table_args__ = {"implicit_returning": False}

    payment_id = Column(Integer, primary_key=True, autoincrement=True)
    receivable_id = Column(Integer, ForeignKey("receivables.receivable_id"), nullable=False)
    paid_amount = Column(Numeric(15, 2), nullable=False)
    payment_method = Column(String(20), nullable=False)  # 'CASH', 'BANK_TRANSFER', 'VIET_QR'
    transaction_reference = Column(Unicode(100), nullable=True)
    paid_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    recorded_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    receivable = relationship("Receivable", back_populates="payments")
    recorder = relationship("User", foreign_keys=[recorded_by_user_id])
    invoice = relationship("Invoice", back_populates="payment", uselist=False)


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    payment_id = Column(Integer, ForeignKey("payments.payment_id"), unique=True, nullable=False)
    issued_date = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    total_amount_in_words = Column(Unicode(255), nullable=False)
    pdf_file_url = Column(String(500), nullable=True)
    file_id = Column(String(64), ForeignKey("file_objects.file_id"), nullable=True)
    notes = Column(UnicodeText, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    payment = relationship("Payment", back_populates="invoice")
    file_object = relationship("FileObject", foreign_keys=[file_id])
    creator = relationship("User", foreign_keys=[created_by_user_id])


class IdempotencyRequest(Base):
    __tablename__ = "idempotency_requests"

    request_id = Column(String(64), primary_key=True)
    actor_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    operation = Column(String(50), nullable=False)
    idempotency_key = Column(String(100), nullable=False)
    request_hash = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="IN_PROGRESS")
    response_code = Column(Integer, nullable=True)
    response_body = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
