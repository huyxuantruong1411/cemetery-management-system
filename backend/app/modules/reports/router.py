from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import User
from app.modules.reports.schemas import (
    ContractReportResponse,
    OccupancyReportResponse,
    OperationsReportResponse,
    ReportExportRequest,
    ReportExportResponse,
    RevenueReportResponse,
)
from app.modules.reports.service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports & Executive Dashboards (M12)"])


# =============================================================================
# 1. Revenue Report (UC-7.1)
# =============================================================================
@router.get("/revenue", response_model=RevenueReportResponse, summary="Báo cáo doanh thu thực thu")
def get_revenue_report(
    start_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    payment_method: Optional[str] = Query(
        None, description="Phương thức thanh toán: CASH, BANK_TRANSFER, CARD"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports", "read")),
) -> RevenueReportResponse:
    """
    Báo cáo doanh thu chuẩn kế toán dựa trên tổng thực thu của bảng payments.
    Hỗ trợ drill-down chi tiết từng phiếu thu và nhóm theo thời gian, phương thức.
    """
    return ReportService.generate_revenue_report(
        db=db,
        start_date=start_date,
        end_date=end_date,
        payment_method=payment_method,
    )


# =============================================================================
# 2. Occupancy & Plot Report (UC-7.2)
# =============================================================================
@router.get(
    "/occupancy", response_model=OccupancyReportResponse, summary="Báo cáo tỷ lệ lấp đầy & mộ phần"
)
def get_occupancy_report(
    zone_id: Optional[int] = Query(None, description="Lọc theo mã khu vực khuôn viên"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports", "read")),
) -> OccupancyReportResponse:
    """
    Báo cáo tổng hợp số ô mộ và slot theo từng khu vực và toàn nghĩa trang.
    Tỷ lệ lấp đầy được tính trên mẫu số ô mộ quy hoạch; khu rỗng không chia cho 0.
    """
    return ReportService.generate_occupancy_report(db=db, zone_id=zone_id)


# =============================================================================
# 3. Contracts & Annexes Report (UC-7.3)
# =============================================================================
@router.get(
    "/contracts", response_model=ContractReportResponse, summary="Báo cáo hợp đồng & phụ lục"
)
def get_contracts_report(
    start_date: Optional[date] = Query(None, description="Ngày ký bắt đầu (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Ngày ký kết thúc (YYYY-MM-DD)"),
    status: Optional[str] = Query(
        None, description="Trạng thái HĐ: DRAFT, SIGNED, ACTIVE, COMPLETED, CANCELLED"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports", "read")),
) -> ContractReportResponse:
    """
    Báo cáo phân loại hợp đồng đất và phụ lục dịch vụ.
    Tách biệt nguồn doanh thu, ngăn ngừa double count khi join giữa HĐ và phụ lục.
    Liệt kê các phụ lục chăm sóc sắp hết hạn trong 60 ngày tới.
    """
    return ReportService.generate_contracts_report(
        db=db,
        start_date=start_date,
        end_date=end_date,
        status_filter=status,
    )


# =============================================================================
# 4. Operations Report (UC-7.4)
# =============================================================================
@router.get(
    "/operations",
    response_model=OperationsReportResponse,
    summary="Báo cáo vận hành thi công & chăm sóc",
)
def get_operations_report(
    start_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports", "read")),
) -> OperationsReportResponse:
    """
    Báo cáo tiến độ và hiệu suất vận hành hiện trường:
    - Thi công: tỷ lệ hoàn thành, số công trình quá hạn, thời gian thi công trung bình.
    - Chăm sóc: tỷ lệ đóng ca, tỷ lệ hoàn tất việc bắt buộc và tuân thủ ảnh minh chứng.
    """
    return ReportService.generate_operations_report(
        db=db,
        start_date=start_date,
        end_date=end_date,
    )


# =============================================================================
# 5. Persistent Report Export & Download (UC-7.5 & G17)
# =============================================================================
@router.post(
    "/export",
    response_model=ReportExportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Khởi tạo yêu cầu xuất báo cáo (PDF/XLSX)",
)
def create_report_export(
    req: ReportExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportExportResponse:
    """
    Tạo snapshot báo cáo, xuất file PDF hoặc XLSX lưu trên MinIO với mã kiểm tra SHA-256.
    Áp dụng cơ chế chống formula injection đối với bảng tính Excel.
    """
    return ReportService.create_export(db=db, user=current_user, req=req)


@router.get(
    "/exports", response_model=List[ReportExportResponse], summary="Danh sách lịch sử xuất báo cáo"
)
def list_report_exports(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ReportExportResponse]:
    """Danh sách các bản xuất báo cáo (người dùng thông thường chỉ thấy của mình, admin thấy tất cả)."""
    return ReportService.list_exports(db=db, user=current_user, limit=limit)


@router.get("/exports/{export_id}/download", summary="Tải tệp báo cáo đã xuất")
def download_report_export(
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tải file báo cáo với cơ chế phân quyền ACL nghiêm ngặt:
    Từ chối 403 Forbidden nếu người dùng không phải người tạo hoặc không có quyền quản trị.
    """
    content, content_type, filename = ReportService.download_export(
        db=db,
        user=current_user,
        export_id=export_id,
    )
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
