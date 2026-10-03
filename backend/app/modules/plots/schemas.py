from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Zone Schemas
# =============================================================================
class ZoneBase(BaseModel):
    zone_code: str = Field(..., max_length=20, description="Mã khu vực (ví dụ: KHU-A, KHU-VIP)")
    zone_name: str = Field(
        ..., max_length=100, description="Tên khu vực (ví dụ: Khu An Lạc, Khu Vĩnh Hằng)"
    )
    total_rows: int = Field(0, ge=0, description="Tổng số hàng mộ trong khu")
    description: Optional[str] = Field(None, max_length=255)


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    zone_name: Optional[str] = Field(None, max_length=100)
    total_rows: Optional[int] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=255)


class ZoneResponse(ZoneBase):
    zone_id: int

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Row Schemas
# =============================================================================
class RowBase(BaseModel):
    zone_id: int
    row_code: str = Field(..., max_length=20, description="Mã hàng mộ (ví dụ: HANG-01, HANG-02)")
    total_plots: int = Field(0, ge=0, description="Tổng số ô mộ trong hàng")


class RowCreate(RowBase):
    pass


class RowUpdate(BaseModel):
    total_plots: Optional[int] = Field(None, ge=0)


class RowResponse(RowBase):
    row_id: int

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Plot Type Schemas
# =============================================================================
class PlotTypeBase(BaseModel):
    type_name: str = Field(
        ..., max_length=100, description="Tên loại mộ (ví dụ: Mộ đơn tiêu chuẩn, Mộ đôi gia tộc)"
    )
    default_slots: int = Field(..., gt=0, description="Số lượng slot an táng mặc định")
    length: Decimal = Field(..., gt=0, description="Chiều dài ô mộ (m)")
    width: Decimal = Field(..., gt=0, description="Chiều rộng ô mộ (m)")
    description: Optional[str] = Field(None, max_length=255)


class PlotTypeCreate(PlotTypeBase):
    pass


class PlotTypeUpdate(BaseModel):
    type_name: Optional[str] = Field(None, max_length=100)
    default_slots: Optional[int] = Field(None, gt=0)
    length: Optional[Decimal] = Field(None, gt=0)
    width: Optional[Decimal] = Field(None, gt=0)
    description: Optional[str] = Field(None, max_length=255)


class PlotTypeResponse(PlotTypeBase):
    type_id: int

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Slot Schemas
# =============================================================================
class PlotSlotResponse(BaseModel):
    slot_id: int
    plot_id: int
    slot_number: int
    status: str
    current_deceased_id: Optional[int] = None
    deceased_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Reservation Schemas (G04)
# =============================================================================
class PlotReserveRequest(BaseModel):
    customer_name: Optional[str] = Field(
        None, max_length=100, description="Họ tên khách hàng giữ chỗ"
    )
    customer_phone: Optional[str] = Field(None, max_length=20, description="Số điện thoại liên hệ")
    duration_hours: int = Field(
        48, ge=1, le=720, description="Thời hạn giữ chỗ tính theo giờ (mặc định 48h)"
    )
    notes: Optional[str] = Field(None, max_length=500, description="Ghi chú giữ chỗ")


class PlotReservationResponse(BaseModel):
    reservation_id: int
    plot_id: int
    reserved_by: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    state: str
    reserved_at: datetime
    expires_at: datetime
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Plot Schemas
# =============================================================================
class PlotBase(BaseModel):
    plot_code: str = Field(..., max_length=50, description="Mã số ô mộ (ví dụ: A-H01-P01)")
    row_id: int
    type_id: int
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    orientation: Optional[str] = Field(
        None, max_length=50, description="Hướng mộ (ĐÔNG, TÂY, NAM, BẮC,...)"
    )
    notes: Optional[str] = None
    is_kim_tinh: bool = Field(False, description="Cờ đánh dấu kết cấu huyệt mộ Kim Tĩnh kiên cố")


class PlotCreate(PlotBase):
    pass


class PlotUpdate(BaseModel):
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    orientation: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    # Kim Tĩnh can only be turned ON, never turned off once set
    is_kim_tinh: Optional[bool] = None


class PlotListResponse(BaseModel):
    plot_id: int
    plot_code: str
    row_id: int
    row_code: str
    zone_id: int
    zone_code: str
    zone_name: str
    type_id: int
    type_name: str
    default_slots: int
    status: str
    is_kim_tinh: bool
    is_locked: bool
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    orientation: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    active_reservation: Optional[PlotReservationResponse] = None

    model_config = ConfigDict(from_attributes=True)


class PlotDetailResponse(PlotListResponse):
    slots: List[PlotSlotResponse] = []
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None


# =============================================================================
# Quick Filter & Stats Schemas
# =============================================================================
class PlotStatsResponse(BaseModel):
    total_plots: int
    empty_unsold: int
    reserved: int
    owned_empty: int
    under_construction: int
    occupied: int
    under_exhumation: int
    kim_tinh_count: int
    locked_count: int
