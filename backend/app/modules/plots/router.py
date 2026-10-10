from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import User
from app.modules.plots.schemas import (
    PlotCreate,
    PlotDetailResponse,
    PlotListResponse,
    PlotMessageResponse,
    PlotReservationResponse,
    PlotReserveRequest,
    PlotStatsResponse,
    PlotTypeCreate,
    PlotTypeResponse,
    PlotTypeUpdate,
    PlotUpdate,
    RowCreate,
    RowResponse,
    RowUpdate,
    ZoneCreate,
    ZoneResponse,
    ZoneUpdate,
)
from app.modules.plots.service import PlotService

router = APIRouter(prefix="/plots", tags=["Plots, Zones, Slots & Maps"])


# =============================================================================
# 1. Statistics
# =============================================================================
@router.get("/stats", response_model=PlotStatsResponse)
def get_plot_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy thống kê số lượng ô mộ theo trạng thái, số mộ Kim Tĩnh và số mộ đã khóa."""
    return PlotService.get_stats(db)


# =============================================================================
# 2. Zones (Khu Mộ)
# =============================================================================
@router.get("/zones", response_model=List[ZoneResponse])
def get_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách tất cả các khu mộ trong nghĩa trang."""
    return PlotService.list_zones(db)


@router.post(
    "/zones",
    response_model=ZoneResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def create_zone(
    data: ZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo mới một khu vực mộ (yêu cầu quyền plots:write)."""
    return PlotService.create_zone(db, data)


@router.put(
    "/zones/{zone_id}",
    response_model=ZoneResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def update_zone(
    zone_id: int,
    data: ZoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật thông tin khu mộ."""
    return PlotService.update_zone(db, zone_id, data)


@router.delete(
    "/zones/{zone_id}",
    response_model=PlotMessageResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def delete_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa khu mộ (yêu cầu quyền plots:write, chỉ xóa được khi không chứa hàng mộ)."""
    return PlotService.delete_zone(db, zone_id)


# =============================================================================
# 3. Rows (Hàng Mộ)
# =============================================================================
@router.get("/rows", response_model=List[RowResponse])
def get_rows(
    zone_id: Optional[int] = Query(None, description="Lọc theo ID khu vực"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các hàng mộ (có thể lọc theo khu vực)."""
    return PlotService.list_rows(db, zone_id=zone_id)


@router.post(
    "/rows",
    response_model=RowResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def create_row(
    data: RowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo mới một hàng mộ trong khu vực."""
    return PlotService.create_row(db, data)


@router.put(
    "/rows/{row_id}",
    response_model=RowResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def update_row(
    row_id: int,
    data: RowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật thông tin hàng mộ."""
    return PlotService.update_row(db, row_id, data)


@router.delete(
    "/rows/{row_id}",
    response_model=PlotMessageResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def delete_row(
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa hàng mộ (yêu cầu quyền plots:write, chỉ xóa được khi không chứa ô mộ)."""
    return PlotService.delete_row(db, row_id)


# =============================================================================
# 4. Plot Types (Loại Mộ & Cấu Hình Slot)
# =============================================================================
@router.get("/types", response_model=List[PlotTypeResponse])
def get_plot_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh mục các loại mộ và quy cách kích thước, dung lượng slot."""
    return PlotService.list_plot_types(db)


@router.post(
    "/types",
    response_model=PlotTypeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def create_plot_type(
    data: PlotTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo mới loại mộ kèm số lượng slot mặc định."""
    return PlotService.create_plot_type(db, data)


@router.put(
    "/types/{type_id}",
    response_model=PlotTypeResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def update_plot_type(
    type_id: int,
    data: PlotTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật thông số loại mộ."""
    return PlotService.update_plot_type(db, type_id, data)


@router.delete(
    "/types/{type_id}",
    response_model=PlotMessageResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def delete_plot_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa loại mộ (yêu cầu quyền plots:write, chỉ xóa được khi không có ô mộ nào sử dụng)."""
    return PlotService.delete_plot_type(db, type_id)


# =============================================================================
# 5. Plots (Ô Mộ, Bản Đồ & Trạng Thái)
# =============================================================================
@router.get("", response_model=List[PlotListResponse])
def get_plots(
    zone_id: Optional[int] = Query(None, description="Lọc theo khu vực"),
    row_id: Optional[int] = Query(None, description="Lọc theo hàng"),
    type_id: Optional[int] = Query(None, description="Lọc theo loại mộ"),
    status: Optional[str] = Query(
        None, description="Lọc theo trạng thái (EMPTY_UNSOLD, RESERVED, OCCUPIED...)"
    ),
    is_kim_tinh: Optional[bool] = Query(None, description="Lọc mộ kết cấu Kim Tĩnh"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo mã ô mộ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tra cứu danh sách ô mộ kèm thông tin tọa độ GPS và trạng thái giữ chỗ."""
    return PlotService.list_plots(
        db,
        zone_id=zone_id,
        row_id=row_id,
        type_id=type_id,
        status_filter=status,
        is_kim_tinh=is_kim_tinh,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{plot_id}", response_model=PlotDetailResponse)
def get_plot_detail(
    plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xem chi tiết đầy đủ một ô mộ kèm các slot con, thông tin Kim Tĩnh và giữ chỗ."""
    return PlotService.get_plot(db, plot_id)


@router.post(
    "",
    response_model=PlotDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def create_plot(
    data: PlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo ô mộ mới (Tự động sinh các slot 1..N theo cấu hình loại mộ trong một transaction)."""
    return PlotService.create_plot(db, data)


@router.put(
    "/{plot_id}",
    response_model=PlotDetailResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def update_plot(
    plot_id: int,
    data: PlotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật tọa độ GPS, hướng mộ, ghi chú. Thực thi Quy tắc Bất biến Kim Tĩnh."""
    return PlotService.update_plot(db, plot_id, data)


@router.delete(
    "/{plot_id}",
    response_model=PlotMessageResponse,
    dependencies=[Depends(require_permission("plots", "write"))],
)
def delete_plot(
    plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa ô mộ (yêu cầu quyền plots:write, chỉ xóa được khi ô chưa bán, không có giao dịch và không phải Kim Tĩnh)."""
    return PlotService.delete_plot(db, plot_id)


# =============================================================================
# 6. Anti-Double Booking Reservation (G04)
# =============================================================================
@router.post(
    "/{plot_id}/reserve",
    response_model=PlotReservationResponse,
    dependencies=[Depends(require_permission("contracts", "write"))],
)
def reserve_plot(
    plot_id: int,
    req: PlotReserveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Giữ chỗ ô đất độc quyền (Anti-Double Booking Concurrency).
    Khóa dòng MSSQL đảm bảo nếu 2 nhân viên cùng gửi yêu cầu: 1 người thành công, 1 người nhận 409 Conflict.
    """
    return PlotService.reserve_plot(db, plot_id, current_user.user_id, req)


@router.post(
    "/{plot_id}/cancel-reservation",
    dependencies=[Depends(require_permission("contracts", "write"))],
)
def cancel_reservation(
    plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hủy lệnh giữ chỗ ô đất và trả ô về trạng thái EMPTY_UNSOLD."""
    return PlotService.cancel_reservation(db, plot_id, current_user.user_id)
