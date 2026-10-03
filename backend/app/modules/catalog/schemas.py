import json
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ===================== Price List & Items =====================
class PriceItemBase(BaseModel):
    item_code: str = Field(..., max_length=50, description="Mã danh mục giá, ví dụ: GIA-DAT-A1")
    item_name: str = Field(..., max_length=150, description="Tên khoản mục giá")
    unit_price: Decimal = Field(
        ..., gt=0, decimal_places=2, description="Đơn giá (VNĐ, DECIMAL(15,2))"
    )
    unit: str = Field(..., max_length=30, description="Đơn vị tính, ví dụ: m2, ô mộ, gói/năm")
    zone_id: Optional[int] = Field(None, description="Scope phân khu (nếu có)")
    plot_type_id: Optional[int] = Field(None, description="Scope loại ô mộ (nếu có)")
    package_id: Optional[int] = Field(None, description="Scope gói chăm sóc (nếu có)")
    service_code: Optional[str] = Field(None, max_length=50, description="Mã dịch vụ gắn kết")


class PriceItemCreate(PriceItemBase):
    price_list_id: int


class PriceItemUpdate(BaseModel):
    item_name: Optional[str] = Field(None, max_length=150)
    unit_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    unit: Optional[str] = Field(None, max_length=30)
    zone_id: Optional[int] = None
    plot_type_id: Optional[int] = None
    package_id: Optional[int] = None
    service_code: Optional[str] = None


class PriceItemResponse(PriceItemBase):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    price_list_id: int


class PriceListBase(BaseModel):
    price_list_name: str = Field(..., max_length=100, description="Tên bảng giá áp dụng")
    effective_from_date: date = Field(..., description="Ngày bắt đầu có hiệu lực")
    effective_to_date: Optional[date] = Field(
        None, description="Ngày kết thúc hiệu lực (None nếu vô thời hạn)"
    )
    is_active: bool = Field(True, description="Trạng thái kích hoạt")

    @field_validator("effective_to_date")
    @classmethod
    def validate_dates(cls, v: Optional[date], info) -> Optional[date]:
        from_date = info.data.get("effective_from_date")
        if v and from_date and v < from_date:
            raise ValueError("Ngày kết thúc hiệu lực không được nhỏ hơn ngày bắt đầu hiệu lực")
        return v


class PriceListCreate(PriceListBase):
    pass


class PriceListUpdate(BaseModel):
    price_list_name: Optional[str] = Field(None, max_length=100)
    effective_from_date: Optional[date] = None
    effective_to_date: Optional[date] = None
    is_active: Optional[bool] = None


class PriceListResponse(PriceListBase):
    model_config = ConfigDict(from_attributes=True)

    price_list_id: int
    created_at: datetime
    items: List[PriceItemResponse] = []


# ===================== Care Packages =====================
class CarePackageBase(BaseModel):
    package_code: str = Field(..., max_length=50, description="Mã gói dịch vụ, ví dụ: GOI-CS-NAM")
    package_name: str = Field(..., max_length=100, description="Tên gói chăm sóc định kỳ")
    cycle_type: str = Field(..., description="Chu kỳ: MONTHLY, QUARTERLY, YEARLY")
    default_tasks_json: str = Field(
        ...,
        description="Danh sách công việc mặc định dạng JSON array",
    )
    unit_price: Decimal = Field(..., gt=0, decimal_places=2, description="Đơn giá gói chăm sóc")
    is_active: bool = Field(True, description="Trạng thái kích hoạt gói")

    @field_validator("cycle_type")
    @classmethod
    def validate_cycle(cls, v: str) -> str:
        valid_cycles = {"MONTHLY", "QUARTERLY", "YEARLY"}
        if v.upper() not in valid_cycles:
            raise ValueError(f"cycle_type phải thuộc {valid_cycles}")
        return v.upper()

    @field_validator("default_tasks_json")
    @classmethod
    def validate_tasks_json(cls, v: str) -> str:
        try:
            parsed = json.loads(v)
            if not isinstance(parsed, list):
                raise ValueError("default_tasks_json phải là một mảng JSON các công việc")
        except json.JSONDecodeError as e:
            raise ValueError("default_tasks_json phải là chuỗi JSON hợp lệ") from e
        return v


class CarePackageCreate(CarePackageBase):
    pass


class CarePackageUpdate(BaseModel):
    package_name: Optional[str] = Field(None, max_length=100)
    cycle_type: Optional[str] = None
    default_tasks_json: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    is_active: Optional[bool] = None


class CarePackageResponse(CarePackageBase):
    model_config = ConfigDict(from_attributes=True)

    package_id: int


# ===================== Contract Templates =====================
VALID_CONTRACT_TYPES = {"LAND_PURCHASE", "EXHUMATION", "CREMATION", "TRANSFER", "CARE_ANNEX"}


class ContractTemplateBase(BaseModel):
    template_code: str = Field(..., max_length=50, description="Mã mẫu hợp đồng")
    contract_type: str = Field(..., description="1 trong 4 loại chuẩn + CARE_ANNEX")
    template_name: str = Field(..., max_length=150, description="Tên bản mẫu hợp đồng / phụ lục")
    version_no: int = Field(1, ge=1, description="Số hiệu phiên bản điều khoản")
    content_html: str = Field(..., description="Nội dung điều khoản HTML / UTF-8 Markdown")
    required_documents_json: Optional[str] = Field(
        None, description='Danh mục hồ sơ bắt buộc đi kèm, ví dụ: ["DEATH_CERTIFICATE"]'
    )
    is_active: bool = Field(True, description="Trạng thái hiệu lực bản mẫu")

    @field_validator("contract_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v.upper() not in VALID_CONTRACT_TYPES:
            raise ValueError(f"contract_type phải thuộc 4 mã chuẩn hợp lệ: {VALID_CONTRACT_TYPES}")
        return v.upper()


class ContractTemplateCreate(ContractTemplateBase):
    pass


class ContractTemplateUpdate(BaseModel):
    template_name: Optional[str] = Field(None, max_length=150)
    content_html: Optional[str] = None
    required_documents_json: Optional[str] = None
    is_active: Optional[bool] = None


class ContractTemplateResponse(ContractTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    template_id: int
    created_at: datetime
    updated_at: datetime


# ===================== Price Lookup Simulation =====================
class PriceLookupRequest(BaseModel):
    target_date: Optional[date] = None
    zone_id: Optional[int] = None
    plot_type_id: Optional[int] = None
    package_id: Optional[int] = None
    service_code: Optional[str] = None


class PriceLookupResponse(BaseModel):
    matched: bool
    price_list_id: Optional[int] = None
    price_list_name: Optional[str] = None
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    unit_price: Optional[Decimal] = None
    unit: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
