from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Task Evidence Schemas (G11)
# ---------------------------------------------------------------------------


class ConstructionTaskEvidenceBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    evidence_id: int
    task_id: int
    file_id: str
    caption: Optional[str] = None
    uploaded_at: datetime
    uploaded_by: int
    uploader_name: Optional[str] = None
    file_name: Optional[str] = None
    download_url: Optional[str] = None


class ConstructionTaskEvidenceCreate(BaseModel):
    file_id: str = Field(..., description="MinIO file_id from DocumentService")
    caption: Optional[str] = Field(None, max_length=255)


# ---------------------------------------------------------------------------
# Construction Task Schemas (G11)
# ---------------------------------------------------------------------------


class ConstructionTaskBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    order_id: int
    task_name: str
    assigned_team_or_contractor: Optional[str] = None
    assignee_user_id: Optional[int] = None
    assignee_name: Optional[str] = None
    is_required: bool = True
    sort_order: int = 1
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: str = "TODO"
    proof_media_url: Optional[str] = None
    field_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[int] = None
    completed_by_name: Optional[str] = None
    evidences: List[ConstructionTaskEvidenceBrief] = []


class ConstructionTaskCreate(BaseModel):
    task_name: str = Field(..., min_length=2, max_length=150)
    assigned_team_or_contractor: Optional[str] = Field(None, max_length=100)
    assignee_user_id: Optional[int] = None
    is_required: bool = True
    sort_order: int = 1
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    field_notes: Optional[str] = None


class ConstructionTaskUpdate(BaseModel):
    task_name: Optional[str] = Field(None, min_length=2, max_length=150)
    assigned_team_or_contractor: Optional[str] = Field(None, max_length=100)
    assignee_user_id: Optional[int] = None
    is_required: Optional[bool] = None
    sort_order: Optional[int] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    field_notes: Optional[str] = None


class ConstructionTaskCompleteRequest(BaseModel):
    field_notes: Optional[str] = None
    proof_media_url: Optional[str] = None


class TaskOrderItem(BaseModel):
    task_id: int
    sort_order: int


class ConstructionTaskReorderRequest(BaseModel):
    orders: List[TaskOrderItem]


# ---------------------------------------------------------------------------
# Construction Order Schemas
# ---------------------------------------------------------------------------


class ConstructionOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: int
    annex_id: int
    plot_id: int
    plot_code: Optional[str] = None
    zone_name: Optional[str] = None
    supervisor_id: int
    supervisor_name: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: date
    actual_end_date: Optional[date] = None
    overall_progress: Decimal = Decimal("0.00")
    status: str = "PENDING"
    is_overdue: bool = False
    notes: Optional[str] = None
    created_at: datetime
    tasks: List[ConstructionTaskBrief] = []
    total_tasks: int = 0
    completed_tasks: int = 0
    required_tasks: int = 0
    completed_required_tasks: int = 0


class ConstructionOrderCreate(BaseModel):
    annex_id: int
    plot_id: int
    supervisor_id: int
    start_date: Optional[date] = None
    expected_end_date: date
    notes: Optional[str] = None
    custom_tasks: Optional[List[ConstructionTaskCreate]] = None


class ConstructionOrderUpdate(BaseModel):
    supervisor_id: Optional[int] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ConstructionOrderCompleteRequest(BaseModel):
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Staff Unavailability Schemas (G13)
# ---------------------------------------------------------------------------


class StaffUnavailabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    unavailability_id: int
    user_id: int
    user_name: Optional[str] = None
    start_date: date
    end_date: date
    reason: Optional[str] = None
    created_at: datetime


class StaffUnavailabilityCreate(BaseModel):
    user_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = Field(None, max_length=255)


class StaffConflictCheckResponse(BaseModel):
    has_conflict: bool
    conflicts: List[StaffUnavailabilityResponse] = []
    warning_message: Optional[str] = None
