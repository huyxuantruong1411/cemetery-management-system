from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DiscountApplyRequest(BaseModel):
    discount_type: Literal["PERCENTAGE", "FIXED_AMOUNT"]
    discount_value: Decimal = Field(..., gt=0, description="Giá trị chiết khấu (% hoặc số tiền)")
    justification_reason: str = Field(
        ..., min_length=5, max_length=1000, description="Lý do giảm trừ bắt buộc"
    )

    @model_validator(mode="after")
    def validate_discount_value(self):
        if self.discount_type == "PERCENTAGE" and (
            self.discount_value <= 0 or self.discount_value > 100
        ):
            raise ValueError("Chiết khấu theo phần trăm phải nằm trong khoảng (0, 100]")
        if self.discount_type == "FIXED_AMOUNT" and self.discount_value <= 0:
            raise ValueError("Số tiền chiết khấu cố định phải lớn hơn 0")
        return self


class DiscountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    discount_id: int
    receivable_id: int
    discount_type: str
    discount_value: Decimal
    calculated_amount: Decimal
    justification_reason: str
    approved_by_user_id: int
    applied_at: datetime


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: int
    invoice_number: str
    payment_id: int
    issued_date: datetime
    total_amount_in_words: str
    pdf_file_url: str | None = None
    file_id: str | None = None
    notes: str | None = None


class PaymentRecordRequest(BaseModel):
    paid_amount: Decimal = Field(..., gt=0, description="Số tiền thanh toán phải > 0")
    payment_method: Literal["CASH", "BANK_TRANSFER", "VIET_QR"]
    transaction_reference: str | None = Field(
        None, max_length=100, description="Mã giao dịch ngân hàng / tham chiếu"
    )
    idempotency_key: str | None = Field(
        None, max_length=100, description="Khóa chống trùng giao dịch"
    )


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payment_id: int
    receivable_id: int
    paid_amount: Decimal
    payment_method: str
    transaction_reference: str | None = None
    paid_at: datetime
    recorded_by_user_id: int
    recorder_name: str | None = None
    invoice: InvoiceResponse | None = None


class ReceivableCreate(BaseModel):
    contract_id: int | None = None
    annex_id: int | None = None
    customer_id: int
    original_amount: Decimal = Field(..., ge=0)
    due_date: date
    notes: str | None = None
    installment_no: int = Field(1, ge=1)

    @model_validator(mode="after")
    def validate_xor_source(self):
        if (self.contract_id is None and self.annex_id is None) or (
            self.contract_id is not None and self.annex_id is not None
        ):
            raise ValueError(
                "Khoản thu phải gắn với đúng một nguồn: hoặc hợp đồng chính, hoặc phụ lục."
            )
        return self


class ReceivableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    receivable_id: int
    contract_id: int | None = None
    contract_code: str | None = None
    annex_id: int | None = None
    annex_code: str | None = None
    customer_id: int
    customer_name: str | None = None
    customer_phone: str | None = None
    original_amount: Decimal
    discount_amount: Decimal
    final_payable_amount: Decimal
    total_paid_amount: Decimal
    remaining_balance: Decimal
    status: str
    due_date: date
    notes: str | None = None
    installment_no: int = 1
    created_at: datetime
    discounts: list[DiscountResponse] = []
    payments: list[PaymentResponse] = []


class FinanceSummaryResponse(BaseModel):
    total_receivables_amount: Decimal
    total_collected_amount: Decimal
    total_outstanding_amount: Decimal
    total_discounts_amount: Decimal
    count_unpaid: int
    count_partially_paid: int
    count_paid: int
    count_overdue: int
