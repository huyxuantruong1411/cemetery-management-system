from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ==============================================================================
# Nested DTOs
# ==============================================================================
class CustomerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    customer_code: str
    full_name: str
    citizen_id: str
    phone_number: str
    address: str
    date_of_birth: Optional[date] = None


class PlotBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    plot_code: str
    zone_code: str
    zone_name: str
    row_code: str
    type_name: str
    status: str
    is_kim_tinh: bool
    is_locked: bool
    orientation: Optional[str] = None


class LandPurchaseDetailBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    land_unit_price: Decimal
    plot: Optional[PlotBrief] = None


class ReceivableBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    receivable_id: int
    contract_id: int
    original_amount: Decimal
    discount_amount: Decimal
    final_payable_amount: Decimal
    total_paid_amount: Decimal
    status: str
    due_date: date


# ==============================================================================
# Request DTOs
# ==============================================================================
class LandPurchaseContractCreate(BaseModel):
    customer_id: int = Field(..., description="ID của khách hàng đứng tên mua đất")
    plot_id: int = Field(..., description="ID của ô mộ cần mua")
    land_unit_price: Optional[Decimal] = Field(
        None, ge=0, description="Đơn giá đất chốt (nếu bỏ trống sẽ tự tra cứu từ bảng giá)"
    )
    template_id: Optional[int] = Field(None, description="Mẫu hợp đồng áp dụng")
    notes: Optional[str] = Field(None, max_length=1000)


class LandPurchaseContractUpdate(BaseModel):
    land_unit_price: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)


class ContractSubmitSigningRequest(BaseModel):
    template_id: Optional[int] = None
    notes: Optional[str] = None


class ContractActivateRequest(BaseModel):
    signed_scan_file_id: str = Field(
        ..., min_length=1, max_length=64, description="File ID của bản scan đã ký trên MinIO"
    )
    signed_at: Optional[date] = Field(None, description="Ngày ký thực tế ghi trên bản giấy")
    activation_notes: Optional[str] = Field(None, max_length=1000)


class ContractCancelRequest(BaseModel):
    reason: str = Field(..., min_length=2, max_length=500, description="Lý do hủy hợp đồng nháp")


# ==============================================================================
# Response DTOs
# ==============================================================================
class ContractBriefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contract_id: int
    contract_code: str
    contract_type: str
    status: str
    total_amount: Decimal
    customer_id: int
    customer_name: str
    customer_phone: str
    plot_id: Optional[int] = None
    plot_code: Optional[str] = None
    zone_name: Optional[str] = None
    signed_at: Optional[date] = None
    activated_at: Optional[datetime] = None
    created_at: datetime


class ContractDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contract_id: int
    contract_code: str
    contract_type: str
    status: str
    total_amount: Decimal
    signed_at: Optional[date] = None
    activated_at: Optional[datetime] = None
    activated_by: Optional[int] = None
    activator_name: Optional[str] = None
    activation_notes: Optional[str] = None
    template_id: Optional[int] = None
    template_version: Optional[int] = None
    signed_scan_file_id: Optional[str] = None
    signed_scan_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    customer: Optional[CustomerBrief] = None
    land_purchase: Optional[LandPurchaseDetailBrief] = None
    plot: Optional[PlotBrief] = None
    receivable: Optional[ReceivableBrief] = None
