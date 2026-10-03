from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Checklist Item Schemas
# ---------------------------------------------------------------------------
class CareChecklistItemBase(BaseModel):
    task_description: str = Field(..., max_length=255)
    is_required: bool = True
    sort_order: int = 0
    is_completed: bool = False
    field_notes: Optional[str] = None


class CareChecklistItemBrief(CareChecklistItemBase):
    item_id: int
    schedule_id: int

    model_config = ConfigDict(from_attributes=True)


class CareChecklistItemUpdate(BaseModel):
    is_completed: Optional[bool] = None
    field_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Media Evidence Schemas
# ---------------------------------------------------------------------------
class CareMediaEvidenceCreate(BaseModel):
    file_id: Optional[str] = None
    media_url: Optional[str] = None
    caption: Optional[str] = Field(None, max_length=255)


class CareMediaEvidenceBrief(BaseModel):
    evidence_id: int
    schedule_id: int
    file_id: Optional[str] = None
    media_url: Optional[str] = None
    caption: Optional[str] = None
    uploaded_at: datetime
    uploaded_by_user_id: Optional[int] = None
    uploaded_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Care Schedule Schemas
# ---------------------------------------------------------------------------
class CareScheduleCreate(BaseModel):
    care_annex_id: int
    plot_id: int
    package_id: int
    caretaker_id: Optional[int] = None
    scheduled_date: date
    period_key: Optional[str] = None
    notes: Optional[str] = None


class CareScheduleAssign(BaseModel):
    caretaker_id: int


class CareScheduleClose(BaseModel):
    field_notes: Optional[str] = None


class CareScheduleGenerateRequest(BaseModel):
    year: int = Field(..., ge=2020, le=2050)
    month: int = Field(..., ge=1, le=12)
    care_annex_id: Optional[int] = None  # If None, generate for all active care annexes


class CareScheduleGenerateResponse(BaseModel):
    period_key: str
    generated_count: int
    skipped_count: int
    schedules: List["CareScheduleBrief"]


class CareScheduleBrief(BaseModel):
    schedule_id: int
    care_annex_id: int
    plot_id: int
    plot_code: Optional[str] = None
    zone_name: Optional[str] = None
    package_id: int
    package_name: Optional[str] = None
    caretaker_id: Optional[int] = None
    caretaker_name: Optional[str] = None
    scheduled_date: date
    performed_date: Optional[datetime] = None
    status: str
    period_key: Optional[str] = None
    notes: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    tasks_count: int = 0
    completed_tasks_count: int = 0
    evidence_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CareScheduleDetail(CareScheduleBrief):
    checklist_items: List[CareChecklistItemBrief] = []
    media_evidences: List[CareMediaEvidenceBrief] = []
    has_conflict: bool = False
    conflict_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Care Annex Registration
# ---------------------------------------------------------------------------
class CareAnnexRegisterRequest(BaseModel):
    contract_id: int
    package_id: int
    cycle_months: int = Field(1, ge=1, le=60)
    recurring_price: Decimal = Field(..., ge=0)
    valid_from: date
    valid_to: date
    notes: Optional[str] = None


class CareAnnexResponse(BaseModel):
    annex_id: int
    contract_id: int
    annex_number: str
    package_id: int
    package_name: Optional[str] = None
    cycle_months: int
    recurring_price: Decimal
    status: str
    valid_from: date
    valid_to: date

    model_config = ConfigDict(from_attributes=True)
