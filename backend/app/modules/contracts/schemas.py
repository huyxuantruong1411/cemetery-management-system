from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

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


class ExhumationDetailBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    slot_id: Optional[int] = None
    current_deceased_id: int
    deceased_name: Optional[str] = None
    plot_code: Optional[str] = None
    slot_number: Optional[int] = None
    exhumation_date: date
    exhumation_fee: Decimal
    reason: Optional[str] = None


class TransferDetailBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    plot_code: Optional[str] = None
    seller_id: int
    seller_name: Optional[str] = None
    buyer_id: int
    buyer_name: Optional[str] = None
    commission_fee: Decimal
    transfer_reason: Optional[str] = None


class CremationDetailBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    deceased_id: int
    deceased_name: Optional[str] = None
    cremation_date: date
    package_service_code: str
    urn_storage_option: Optional[str] = None
    service_fee: Decimal


class BurialAnnexDetailBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    deceased_id: int
    deceased_name: Optional[str] = None
    plot_id: int
    plot_code: Optional[str] = None
    slot_id: int
    slot_number: Optional[int] = None
    burial_date: date
    is_kim_tinh: bool
    construction_notes: Optional[str] = None


class ContractAnnexResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    annex_id: int
    annex_code: str
    contract_id: int
    annex_type: str  # BURIAL, CARE, CONSTRUCTION
    status: str
    additional_amount: Decimal
    signed_scan_file_id: Optional[str] = None
    signed_scan_url: Optional[str] = None
    signed_at: Optional[date] = None
    activated_at: Optional[datetime] = None
    activated_by: Optional[int] = None
    activator_name: Optional[str] = None
    activation_notes: Optional[str] = None
    valid_from: date
    valid_to: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    burial: Optional[BurialAnnexDetailBrief] = None


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


class ExhumationContractCreate(BaseModel):
    customer_id: int = Field(
        ..., description="ID của khách hàng/thân nhân đứng tên yêu cầu cải táng"
    )
    plot_id: int = Field(..., description="ID của ô mộ cần cải táng")
    slot_id: int = Field(..., description="ID của slot huyệt cần cất bốc")
    current_deceased_id: int = Field(..., description="ID của người quá cố đang an táng trong slot")
    exhumation_date: date = Field(..., description="Ngày dự kiến cải táng")
    exhumation_fee: Optional[Decimal] = Field(
        Decimal("0.00"), ge=0, description="Phí dịch vụ cải táng/cất bốc"
    )
    reason: Optional[str] = Field(None, max_length=255, description="Lý do cải táng")
    template_id: Optional[int] = Field(None, description="Mẫu hợp đồng áp dụng")
    notes: Optional[str] = Field(None, max_length=1000)


class TransferContractCreate(BaseModel):
    seller_id: int = Field(..., description="ID khách hàng chuyển nhượng (chủ sở hữu hiện tại)")
    buyer_id: int = Field(..., description="ID khách hàng nhận chuyển nhượng mới")
    plot_id: int = Field(..., description="ID của ô mộ cần chuyển nhượng")
    commission_fee: Optional[Decimal] = Field(
        Decimal("0.00"), ge=0, description="Phí hoa hồng / phí thủ tục chuyển nhượng"
    )
    transfer_reason: Optional[str] = Field(None, max_length=500, description="Lý do chuyển nhượng")
    template_id: Optional[int] = Field(None, description="Mẫu hợp đồng áp dụng")
    notes: Optional[str] = Field(None, max_length=1000)


class CremationContractCreate(BaseModel):
    customer_id: int = Field(..., description="ID khách hàng đại diện đăng ký hỏa táng")
    deceased_id: int = Field(..., description="ID người quá cố (bắt buộc có giấy báo tử đã duyệt)")
    cremation_date: date = Field(..., description="Ngày tiến hành hỏa táng")
    package_service_code: str = Field(..., max_length=50, description="Gói dịch vụ hỏa táng")
    urn_storage_option: Optional[str] = Field(
        None, max_length=100, description="Tùy chọn lưu tro cốt"
    )
    service_fee: Optional[Decimal] = Field(
        Decimal("0.00"), ge=0, description="Phí dịch vụ hỏa táng"
    )
    template_id: Optional[int] = Field(None, description="Mẫu hợp đồng áp dụng")
    notes: Optional[str] = Field(None, max_length=1000)


class BurialAnnexCreate(BaseModel):
    deceased_id: int = Field(
        ..., description="ID người quá cố an táng (phải có giấy báo tử đã duyệt)"
    )
    slot_id: int = Field(..., description="ID slot huyệt an táng trong ô mộ của hợp đồng")
    burial_date: date = Field(..., description="Ngày an táng")
    is_kim_tinh: bool = Field(
        False, description="Đánh dấu an táng hình thức Kim Tĩnh (khóa vĩnh viễn)"
    )
    additional_amount: Optional[Decimal] = Field(
        Decimal("0.00"), ge=0, description="Phí dịch vụ an táng phát sinh"
    )
    construction_notes: Optional[str] = Field(
        None, max_length=1000, description="Ghi chú thi công kim tĩnh"
    )
    notes: Optional[str] = Field(None, max_length=1000)


class AnnexSubmitSigningRequest(BaseModel):
    notes: Optional[str] = None


class AnnexActivateRequest(BaseModel):
    signed_scan_file_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="File ID của bản scan phụ lục đã ký trên MinIO",
    )
    signed_at: Optional[date] = Field(None, description="Ngày ký thực tế trên văn bản")
    activation_notes: Optional[str] = Field(None, max_length=1000)


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
    exhumation: Optional[ExhumationDetailBrief] = None
    transfer: Optional[TransferDetailBrief] = None
    cremation: Optional[CremationDetailBrief] = None
    plot: Optional[PlotBrief] = None
    receivable: Optional[ReceivableBrief] = None
    annexes: List[ContractAnnexResponse] = []
