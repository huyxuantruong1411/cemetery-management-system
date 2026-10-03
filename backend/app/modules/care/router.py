from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import User
from app.modules.care.schemas import (
    CareAnnexRegisterRequest,
    CareAnnexResponse,
    CareChecklistItemBrief,
    CareChecklistItemUpdate,
    CareMediaEvidenceBrief,
    CareMediaEvidenceCreate,
    CareScheduleAssign,
    CareScheduleBrief,
    CareScheduleClose,
    CareScheduleDetail,
    CareScheduleGenerateRequest,
    CareScheduleGenerateResponse,
)
from app.modules.care.service import CareService

router = APIRouter(prefix="/care", tags=["Care"])


@router.get(
    "/schedules",
    response_model=List[CareScheduleBrief],
    summary="Danh sách lịch chăm sóc định kỳ",
    dependencies=[Depends(require_permission("care", "read"))],
)
def list_schedules(
    plot_id: Optional[int] = Query(None, description="Lọc theo mã ô mộ"),
    caretaker_id: Optional[int] = Query(None, description="Lọc theo nhân viên quản trang"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái ca chăm sóc"),
    from_date: Optional[date] = Query(None, description="Từ ngày"),
    to_date: Optional[date] = Query(None, description="Đến ngày"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    schedules = CareService.list_schedules(
        db=db,
        plot_id=plot_id,
        caretaker_id=caretaker_id,
        status=status,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=limit,
    )
    result = []
    for s in schedules:
        result.append(
            CareScheduleBrief(
                schedule_id=s.schedule_id,
                care_annex_id=s.care_annex_id,
                plot_id=s.plot_id,
                plot_code=s.plot.plot_code if s.plot else None,
                zone_name=s.plot.row.zone.zone_name
                if s.plot and s.plot.row and s.plot.row.zone
                else None,
                package_id=s.package_id,
                package_name=s.package.package_name if s.package else None,
                caretaker_id=s.caretaker_id,
                caretaker_name=s.caretaker.full_name if s.caretaker else None,
                scheduled_date=s.scheduled_date,
                performed_date=s.performed_date,
                status=s.status,
                period_key=s.period_key,
                notes=s.notes,
                closed_at=s.closed_at,
                created_at=s.created_at,
                tasks_count=len(s.checklist_items),
                completed_tasks_count=sum(1 for it in s.checklist_items if it.is_completed),
                evidence_count=len(s.media_evidences),
            )
        )
    return result


@router.get(
    "/schedules/{schedule_id}",
    response_model=CareScheduleDetail,
    summary="Chi tiết lịch chăm sóc, checklist và minh chứng",
    dependencies=[Depends(require_permission("care", "read"))],
)
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
):
    return CareService.get_schedule_detail(db=db, schedule_id=schedule_id)


@router.post(
    "/schedules/generate",
    response_model=CareScheduleGenerateResponse,
    summary="Sinh lịch chăm sóc tự động theo kỳ (Idempotent G12)",
    dependencies=[Depends(require_permission("care", "write"))],
)
def generate_schedules(
    req: CareScheduleGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period_key, generated_count, skipped_count, schedules = (
        CareService.generate_schedules_for_period(
            db=db,
            year=req.year,
            month=req.month,
            care_annex_id=req.care_annex_id,
        )
    )
    briefs = [
        CareScheduleBrief(
            schedule_id=s.schedule_id,
            care_annex_id=s.care_annex_id,
            plot_id=s.plot_id,
            plot_code=s.plot.plot_code if s.plot else None,
            zone_name=s.plot.row.zone.zone_name
            if s.plot and s.plot.row and s.plot.row.zone
            else None,
            package_id=s.package_id,
            package_name=s.package.package_name if s.package else None,
            caretaker_id=s.caretaker_id,
            caretaker_name=s.caretaker.full_name if s.caretaker else None,
            scheduled_date=s.scheduled_date,
            performed_date=s.performed_date,
            status=s.status,
            period_key=s.period_key,
            notes=s.notes,
            closed_at=s.closed_at,
            created_at=s.created_at,
            tasks_count=len(s.checklist_items),
            completed_tasks_count=sum(1 for it in s.checklist_items if it.is_completed),
            evidence_count=len(s.media_evidences),
        )
        for s in schedules
    ]
    return CareScheduleGenerateResponse(
        period_key=period_key,
        generated_count=generated_count,
        skipped_count=skipped_count,
        schedules=briefs,
    )


@router.patch(
    "/schedules/{schedule_id}/assign",
    response_model=CareScheduleDetail,
    summary="Phân công nhân viên quản trang (Kiểm tra xung đột G13)",
    dependencies=[Depends(require_permission("care", "write"))],
)
def assign_caretaker(
    schedule_id: int,
    req: CareScheduleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CareService.assign_caretaker(
        db=db,
        schedule_id=schedule_id,
        caretaker_id=req.caretaker_id,
        current_user_id=current_user.user_id,
    )
    return CareService.get_schedule_detail(db=db, schedule_id=schedule_id)


@router.patch(
    "/checklist-items/{item_id}",
    response_model=CareChecklistItemBrief,
    summary="Cập nhật trạng thái hạng mục công việc trong checklist",
    dependencies=[Depends(require_permission("care", "execute"))],
)
def update_checklist_item(
    item_id: int,
    req: CareChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = CareService.update_checklist_item(
        db=db,
        item_id=item_id,
        is_completed=req.is_completed,
        field_notes=req.field_notes,
        user_id=current_user.user_id,
    )
    return CareChecklistItemBrief.model_validate(item)


@router.post(
    "/schedules/{schedule_id}/evidence",
    response_model=CareMediaEvidenceBrief,
    status_code=status.HTTP_201_CREATED,
    summary="Tải lên / gắn minh chứng ảnh hiện trường (G11/G12)",
    dependencies=[Depends(require_permission("care", "execute"))],
)
def add_evidence(
    schedule_id: int,
    req: CareMediaEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    evidence = CareService.add_media_evidence(
        db=db,
        schedule_id=schedule_id,
        file_id=req.file_id,
        media_url=req.media_url,
        caption=req.caption,
        user_id=current_user.user_id,
    )
    return CareMediaEvidenceBrief(
        evidence_id=evidence.evidence_id,
        schedule_id=evidence.schedule_id,
        file_id=evidence.file_id,
        media_url=evidence.media_url,
        caption=evidence.caption,
        uploaded_at=evidence.uploaded_at,
        uploaded_by_user_id=evidence.uploaded_by_user_id,
        uploaded_by_name=current_user.full_name,
    )


@router.post(
    "/schedules/{schedule_id}/close",
    response_model=CareScheduleDetail,
    summary="Đóng ca chăm sóc (Chốt chặn G12: task bắt buộc & ảnh READY)",
    dependencies=[Depends(require_permission("care", "execute"))],
)
def close_schedule(
    schedule_id: int,
    req: CareScheduleClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CareService.close_schedule(
        db=db,
        schedule_id=schedule_id,
        field_notes=req.field_notes,
        current_user_id=current_user.user_id,
    )
    return CareService.get_schedule_detail(db=db, schedule_id=schedule_id)


@router.post(
    "/annexes",
    response_model=CareAnnexResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký phụ lục chăm sóc mộ phần cho hợp đồng",
    dependencies=[Depends(require_permission("care", "write"))],
)
def register_care_annex(
    req: CareAnnexRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    care_annex = CareService.register_care_annex(
        db=db,
        data=req,
        current_user_id=current_user.user_id,
    )
    base_annex = care_annex.annex
    return CareAnnexResponse(
        annex_id=care_annex.annex_id,
        contract_id=base_annex.contract_id,
        annex_number=base_annex.annex_number,
        package_id=care_annex.package_id,
        package_name=care_annex.package.package_name if care_annex.package else None,
        cycle_months=care_annex.cycle_months,
        recurring_price=care_annex.recurring_price,
        status=base_annex.status,
        valid_from=base_annex.valid_from,
        valid_to=base_annex.valid_to,
    )
