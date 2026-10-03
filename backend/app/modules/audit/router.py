from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.schemas import AuditLogResponse, AuditSummaryResponse
from app.modules.audit.service import AuditService
from app.modules.auth.dependencies import require_permission
from app.modules.auth.models import User

router = APIRouter(prefix="/audit", tags=["Audit Log & Governance (M12)"])


@router.get(
    "/logs", response_model=List[AuditLogResponse], summary="Tra cứu nhật ký kiểm toán hệ thống"
)
def list_audit_logs(
    start_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Lọc theo mã người dùng"),
    action_type: Optional[str] = Query(None, description="Lọc theo loại hành động"),
    target_entity: Optional[str] = Query(None, description="Lọc theo thực thể đối tượng"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo ID đối tượng"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit", "read")),
) -> List[AuditLogResponse]:
    """
    Tra cứu nhật ký kiểm toán hệ thống.
    BẢO MẬT & BẤT BIẾN:
    - Toàn bộ thông tin nhạy cảm (passwords, tokens) đều được tự động che giấu ([REDACTED]).
    - Hệ thống KHÔNG CÓ bất kỳ API nào cho phép sửa đổi hoặc xóa bản ghi kiểm toán.
    """
    return AuditService.list_logs(
        db=db,
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
        action_type=action_type,
        target_entity=target_entity,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/summary", response_model=AuditSummaryResponse, summary="Thống kê tổng hợp hoạt động kiểm toán"
)
def get_audit_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit", "read")),
) -> AuditSummaryResponse:
    """Thống kê tổng số lượng nhật ký, phân bổ theo loại hành động và thực thể."""
    return AuditService.get_summary(db=db)


@router.get(
    "/entities", response_model=List[str], summary="Danh sách các thực thể được ghi nhật ký"
)
def get_distinct_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit", "read")),
) -> List[str]:
    """Lấy danh sách các bảng / thực thể có bản ghi kiểm toán để phục vụ bộ lọc."""
    return AuditService.get_distinct_entities(db=db)


@router.get(
    "/actions", response_model=List[str], summary="Danh sách các loại hành động được ghi nhật ký"
)
def get_distinct_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit", "read")),
) -> List[str]:
    """Lấy danh sách các loại hành vi để phục vụ bộ lọc."""
    return AuditService.get_distinct_actions(db=db)
