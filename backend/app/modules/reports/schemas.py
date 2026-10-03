from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ==============================================================================
# 1. Revenue Report Schemas (UC-7.1)
# ==============================================================================
class RevenuePeriodItem(BaseModel):
    period: str
    total_amount: Decimal
    transaction_count: int
    average_amount: Decimal


class RevenueMethodItem(BaseModel):
    method: str
    total_amount: Decimal
    count: int
    percentage: float


class RevenueDrillDownItem(BaseModel):
    payment_id: int
    payment_no: str
    payment_date: str
    amount: Decimal
    payment_method: str
    source_type: str  # CONTRACT or ANNEX
    source_code: str
    customer_name: Optional[str] = None
    notes: Optional[str] = None


class RevenueReportResponse(BaseModel):
    total_revenue: Decimal
    total_transactions: int
    average_transaction_value: Decimal
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    by_period: List[RevenuePeriodItem] = []
    by_method: List[RevenueMethodItem] = []
    drilldown_items: List[RevenueDrillDownItem] = []


# ==============================================================================
# 2. Occupancy & Plot Report Schemas (UC-7.2)
# ==============================================================================
class ZoneOccupancyItem(BaseModel):
    zone_id: int
    zone_code: str
    zone_name: str
    total_plots: int
    empty_plots: int
    reserved_plots: int
    owned_empty_plots: int
    under_construction_plots: int
    occupied_plots: int
    kim_tinh_plots: int
    occupancy_rate: float
    total_slots: int
    occupied_slots: int
    slot_occupancy_rate: float


class OccupancyReportResponse(BaseModel):
    total_plots: int
    total_empty: int
    total_reserved: int
    total_owned_empty: int
    total_under_construction: int
    total_occupied: int
    total_kim_tinh: int
    overall_occupancy_rate: float
    total_slots: int
    occupied_slots: int
    slot_occupancy_rate: float
    zones: List[ZoneOccupancyItem] = []


# ==============================================================================
# 3. Contracts & Annexes Report Schemas (UC-7.3)
# ==============================================================================
class ContractStatusItem(BaseModel):
    status: str
    count: int
    total_value: Decimal


class AnnexTypeItem(BaseModel):
    annex_type: str
    count: int
    total_value: Decimal


class ExpiringCareItem(BaseModel):
    annex_id: int
    annex_code: str
    customer_name: str
    plot_code: str
    end_date: str
    days_remaining: int


class ContractReportResponse(BaseModel):
    total_land_contracts: int
    total_land_value: Decimal
    total_annexes: int
    total_annex_value: Decimal
    by_contract_status: List[ContractStatusItem] = []
    by_annex_type: List[AnnexTypeItem] = []
    expiring_care_annexes: List[ExpiringCareItem] = []


# ==============================================================================
# 4. Operations (Construction & Care) Report Schemas (UC-7.4)
# ==============================================================================
class ConstructionStats(BaseModel):
    total_orders: int
    pending_count: int
    in_progress_count: int
    completed_count: int
    cancelled_count: int
    overdue_count: int
    completion_rate: float
    avg_duration_days: float


class CareStats(BaseModel):
    total_schedules: int
    scheduled_count: int
    assigned_count: int
    in_progress_count: int
    closed_count: int
    overdue_count: int
    close_rate: float
    required_tasks_completed_rate: float
    evidence_compliance_rate: float


class OperationsReportResponse(BaseModel):
    construction: ConstructionStats
    care: CareStats


# ==============================================================================
# 5. Persistent Report Export Schemas (UC-7.5 & G17)
# ==============================================================================
class ReportExportRequest(BaseModel):
    report_type: str = Field(..., description="REVENUE, OCCUPANCY, CONTRACTS, OPERATIONS")
    export_format: str = Field(..., description="PDF, XLSX")
    filter_params: Dict[str, Any] = Field(default_factory=dict)


class ReportExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    export_id: int
    export_code: str
    report_type: str
    export_format: str
    status: str
    file_id: Optional[str] = None
    record_count: int = 0
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
