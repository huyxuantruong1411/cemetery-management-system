from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.auth.models import User
from app.modules.construction.schemas import (
    ConstructionOrderCompleteRequest,
    ConstructionOrderCreate,
    ConstructionOrderResponse,
    ConstructionOrderUpdate,
    ConstructionTaskBrief,
    ConstructionTaskCompleteRequest,
    ConstructionTaskCreate,
    ConstructionTaskEvidenceBrief,
    ConstructionTaskEvidenceCreate,
    ConstructionTaskReorderRequest,
    ConstructionTaskUpdate,
    StaffConflictCheckResponse,
    StaffUnavailabilityCreate,
    StaffUnavailabilityResponse,
)
from app.modules.construction.service import ConstructionService

router = APIRouter(prefix="/construction", tags=["Construction Management (M09 - G11/G13)"])


# ---------------------------------------------------------------------------
# Staff Unavailability & Scheduling Conflicts (G13)
# ---------------------------------------------------------------------------


@router.get(
    "/unavailability",
    response_model=List[StaffUnavailabilityResponse],
    summary="Danh sách lịch bận/nghỉ phép của nhân viên (G13)",
)
def list_staff_unavailability(
    user_id: Optional[int] = Query(None, description="Lọc theo mã nhân viên"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "read")),
):
    return ConstructionService.list_unavailability(db=db, user_id=user_id)


@router.post(
    "/unavailability",
    response_model=StaffUnavailabilityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký lịch bận/nghỉ phép cho nhân viên (G13)",
)
def create_staff_unavailability(
    data: StaffUnavailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.create_unavailability(db=db, data=data)


@router.delete(
    "/unavailability/{unavailability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa lịch bận/nghỉ phép của nhân viên (G13)",
)
def delete_staff_unavailability(
    unavailability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    ConstructionService.delete_unavailability(db=db, unavailability_id=unavailability_id)
    return None


@router.get(
    "/staff-conflict-check",
    response_model=StaffConflictCheckResponse,
    summary="Kiểm tra xung đột lịch làm việc trước khi phân công (G13)",
)
def check_staff_conflict(
    user_id: int = Query(..., description="Mã nhân viên cần kiểm tra"),
    start_date: date = Query(..., description="Ngày bắt đầu công việc"),
    end_date: date = Query(..., description="Ngày kết thúc công việc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "read")),
):
    return ConstructionService.check_staff_conflict(
        db=db, user_id=user_id, start_date=start_date, end_date=end_date
    )


# ---------------------------------------------------------------------------
# Construction Orders Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/orders",
    response_model=List[ConstructionOrderResponse],
    summary="Danh sách lệnh thi công công trình",
)
def list_construction_orders(
    status_filter: Optional[str] = Query(
        None, alias="status", description="PENDING, IN_PROGRESS, COMPLETED, OVERDUE"
    ),
    plot_id: Optional[int] = Query(None, description="Lọc theo ô mộ"),
    supervisor_id: Optional[int] = Query(None, description="Lọc theo giám sát viên"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "read")),
):
    return ConstructionService.list_orders(
        db=db,
        status_filter=status_filter,
        plot_id=plot_id,
        supervisor_id=supervisor_id,
    )


@router.get(
    "/orders/{order_id}",
    response_model=ConstructionOrderResponse,
    summary="Chi tiết lệnh thi công và các công việc (checklist)",
)
def get_construction_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "read")),
):
    return ConstructionService.get_order_by_id(db=db, order_id=order_id)


@router.post(
    "/orders",
    response_model=ConstructionOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới lệnh thi công từ phụ lục hợp đồng ACTIVE",
)
def create_construction_order(
    data: ConstructionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.create_order(db=db, data=data, creator_user_id=current_user.user_id)


@router.put(
    "/orders/{order_id}",
    response_model=ConstructionOrderResponse,
    summary="Cập nhật thông tin lệnh thi công",
)
def update_construction_order(
    order_id: int,
    data: ConstructionOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.update_order(
        db=db, order_id=order_id, data=data, actor_user_id=current_user.user_id
    )


@router.post(
    "/orders/{order_id}/complete",
    response_model=ConstructionOrderResponse,
    summary="Nghiệm thu hoàn tất lệnh thi công (Gate: thiếu required task chặn 100%)",
)
def complete_construction_order(
    order_id: int,
    data: Optional[ConstructionOrderCompleteRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "execute")),
):
    notes = data.notes if data else None
    return ConstructionService.complete_order(
        db=db, order_id=order_id, notes=notes, actor_user_id=current_user.user_id
    )


@router.post(
    "/orders/{order_id}/reorder-tasks",
    response_model=List[ConstructionTaskBrief],
    summary="Sắp xếp lại thứ tự công việc checklist (G11)",
)
def reorder_construction_tasks(
    order_id: int,
    data: ConstructionTaskReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.reorder_tasks(db=db, order_id=order_id, orders=data.orders)


# ---------------------------------------------------------------------------
# Construction Tasks & Evidence Endpoints (G11)
# ---------------------------------------------------------------------------


@router.post(
    "/orders/{order_id}/tasks",
    response_model=ConstructionTaskBrief,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm công việc mới vào lệnh thi công",
)
def create_construction_task(
    order_id: int,
    data: ConstructionTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.create_task(
        db=db, order_id=order_id, data=data, actor_user_id=current_user.user_id
    )


@router.put(
    "/tasks/{task_id}",
    response_model=ConstructionTaskBrief,
    summary="Cập nhật chi tiết công việc thi công",
)
def update_construction_task(
    task_id: int,
    data: ConstructionTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.update_task(
        db=db, task_id=task_id, data=data, actor_user_id=current_user.user_id
    )


@router.post(
    "/tasks/{task_id}/complete",
    response_model=ConstructionTaskBrief,
    summary="Đánh dấu hoàn tất công việc thi công (Gate: ảnh phải READY trước chốt)",
)
def complete_construction_task(
    task_id: int,
    data: Optional[ConstructionTaskCompleteRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "execute")),
):
    field_notes = data.field_notes if data else None
    proof_media_url = data.proof_media_url if data else None
    return ConstructionService.complete_task(
        db=db,
        task_id=task_id,
        field_notes=field_notes,
        proof_media_url=proof_media_url,
        completer_user_id=current_user.user_id,
    )


@router.post(
    "/tasks/{task_id}/evidences",
    response_model=ConstructionTaskEvidenceBrief,
    status_code=status.HTTP_201_CREATED,
    summary="Đính kèm tệp ảnh/video bằng chứng nghiệm thu từ MinIO (G11)",
)
def add_task_evidence(
    task_id: int,
    data: ConstructionTaskEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("construction", "write")),
):
    return ConstructionService.add_task_evidence(
        db=db,
        task_id=task_id,
        file_id=data.file_id,
        caption=data.caption,
        uploader_user_id=current_user.user_id,
    )
