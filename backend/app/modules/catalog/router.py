from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import User
from app.modules.catalog.schemas import (
    CarePackageCreate,
    CarePackageResponse,
    CarePackageUpdate,
    ContractTemplateCreate,
    ContractTemplateResponse,
    ContractTemplateUpdate,
    PriceItemCreate,
    PriceItemResponse,
    PriceItemUpdate,
    PriceListCreate,
    PriceListResponse,
    PriceListUpdate,
    PriceLookupRequest,
    PriceLookupResponse,
)
from app.modules.catalog.service import CatalogService

router = APIRouter(prefix="/catalog", tags=["Catalog, Pricing & Templates"])


# =============================================================================
# 1. Price Lists
# =============================================================================
@router.get("/price-lists", response_model=List[PriceListResponse])
def get_price_lists(
    active_only: bool = Query(False, description="Chỉ lấy bảng giá đang kích hoạt"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các bảng giá trong hệ thống."""
    return CatalogService.list_price_lists(db, active_only=active_only)


@router.get("/price-lists/{price_list_id}", response_model=PriceListResponse)
def get_price_list_detail(
    price_list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xem chi tiết một bảng giá kèm các khoản mục giá chi tiết."""
    return CatalogService.get_price_list(db, price_list_id)


@router.post(
    "/price-lists",
    response_model=PriceListResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("finance", "write"))],
)
def create_price_list(
    data: PriceListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo bảng giá mới (kiểm tra chống trùng lặp khoảng thời gian hiệu lực - G03)."""
    return CatalogService.create_price_list(db, data)


@router.put(
    "/price-lists/{price_list_id}",
    response_model=PriceListResponse,
    dependencies=[Depends(require_permission("finance", "write"))],
)
def update_price_list(
    price_list_id: int,
    data: PriceListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật thông tin bảng giá / kích hoạt hoặc ngừng kích hoạt."""
    return CatalogService.update_price_list(db, price_list_id, data)


# =============================================================================
# 2. Price Items
# =============================================================================
@router.post(
    "/price-items",
    response_model=PriceItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("finance", "write"))],
)
def add_price_item(
    data: PriceItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thêm khoản mục giá vào bảng giá có phạm vi (zone/plot_type/package/service)."""
    return CatalogService.add_price_item(db, data)


@router.put(
    "/price-items/{item_id}",
    response_model=PriceItemResponse,
    dependencies=[Depends(require_permission("finance", "write"))],
)
def update_price_item(
    item_id: int,
    data: PriceItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật khoản mục giá."""
    return CatalogService.update_price_item(db, item_id, data)


@router.delete(
    "/price-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("finance", "write"))],
)
def delete_price_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa khoản mục giá khỏi bảng giá."""
    CatalogService.delete_price_item(db, item_id)


# =============================================================================
# 3. Price Lookup Simulation
# =============================================================================
@router.post("/lookup-price", response_model=PriceLookupResponse)
def lookup_price(
    req: PriceLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tra cứu đơn giá áp dụng tức thời theo ngày và scope (Khu vực / Loại mộ / Gói chăm sóc)."""
    return CatalogService.lookup_price(db, req)


# =============================================================================
# 4. Care Packages
# =============================================================================
@router.get("/care-packages", response_model=List[CarePackageResponse])
def get_care_packages(
    active_only: bool = Query(False, description="Chỉ lấy gói đang kích hoạt"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các gói dịch vụ chăm sóc định kỳ."""
    return CatalogService.list_care_packages(db, active_only=active_only)


@router.get("/care-packages/{package_id}", response_model=CarePackageResponse)
def get_care_package_detail(
    package_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xem chi tiết một gói chăm sóc."""
    return CatalogService.get_care_package(db, package_id)


@router.post(
    "/care-packages",
    response_model=CarePackageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("care", "write"))],
)
def create_care_package(
    data: CarePackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo gói dịch vụ chăm sóc mới kèm danh mục công việc chuẩn."""
    return CatalogService.create_care_package(db, data)


@router.put(
    "/care-packages/{package_id}",
    response_model=CarePackageResponse,
    dependencies=[Depends(require_permission("care", "write"))],
)
def update_care_package(
    package_id: int,
    data: CarePackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật gói dịch vụ chăm sóc."""
    return CatalogService.update_care_package(db, package_id, data)


# =============================================================================
# 5. Contract Templates
# =============================================================================
@router.get("/contract-templates", response_model=List[ContractTemplateResponse])
def get_contract_templates(
    active_only: bool = Query(False, description="Chỉ lấy mẫu đang hiệu lực"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các bản mẫu hợp đồng chuẩn (LAND_PURCHASE, EXHUMATION, CREMATION, TRANSFER, CARE_ANNEX)."""
    return CatalogService.list_contract_templates(db, active_only=active_only)


@router.get("/contract-templates/{template_id}", response_model=ContractTemplateResponse)
def get_contract_template_detail(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xem chi tiết bản mẫu hợp đồng và các điều khoản."""
    return CatalogService.get_contract_template(db, template_id)


@router.post(
    "/contract-templates",
    response_model=ContractTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("contracts", "write"))],
)
def create_contract_template(
    data: ContractTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo bản mẫu hợp đồng mới với 4 mã nghiệp vụ chuẩn và danh mục hồ sơ bắt buộc."""
    return CatalogService.create_contract_template(db, data)


@router.put(
    "/contract-templates/{template_id}",
    response_model=ContractTemplateResponse,
    dependencies=[Depends(require_permission("contracts", "write"))],
)
def update_contract_template(
    template_id: int,
    data: ContractTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật bản mẫu điều khoản (tự động tăng version_no, không làm thay đổi hợp đồng cũ - Không hồi tố)."""
    return CatalogService.bump_template_version(db, template_id, data)
