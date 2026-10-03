from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.contracts.schemas import (
    ContractActivateRequest,
    ContractBriefResponse,
    ContractCancelRequest,
    ContractDetailResponse,
    ContractSubmitSigningRequest,
    LandPurchaseContractCreate,
)
from app.modules.contracts.service import ContractService

router = APIRouter(prefix="/contracts", tags=["Contracts: Land Purchase & Lifecycle"])


@router.post(
    "/land-purchase",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng mua bán đất an táng mới",
)
def create_land_purchase_contract(
    data: LandPurchaseContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tạo hợp đồng mua đất nghĩa trang mới.
    Tự động áp dụng cơ chế khóa hàng (Anti-double booking - G04), giữ chỗ ô mộ trong 7 ngày,
    và snapshot đơn giá đất từ bảng giá niêm yết hiện hành.
    """
    contract = ContractService.create_land_purchase_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract.contract_id)


@router.get(
    "",
    response_model=List[ContractBriefResponse],
    summary="Tra cứu danh sách hợp đồng",
)
def list_contracts(
    contract_type: Optional[str] = Query(
        None, description="Lọc theo loại: LAND_PURCHASE, EXHUMATION, CREMATION, TRANSFER"
    ),
    status: Optional[str] = Query(
        None, description="Lọc theo trạng thái: DRAFT, PENDING_SIGN, ACTIVE, CANCELLED"
    ),
    customer_id: Optional[int] = Query(None, description="Lọc theo khách hàng"),
    search: Optional[str] = Query(
        None, description="Tìm kiếm theo mã HĐ, tên khách hàng, SĐT, mã ô mộ"
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ContractService.list_contracts(
        db,
        contract_type=contract_type,
        status_filter=status,
        customer_id=customer_id,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{contract_id}",
    response_model=ContractDetailResponse,
    summary="Xem chi tiết hồ sơ hợp đồng",
)
def get_contract_detail(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ContractService.get_contract_detail_dto(db, contract_id)


@router.post(
    "/{contract_id}/submit-signing",
    response_model=ContractDetailResponse,
    summary="Chuyển hợp đồng nháp sang trạng thái chờ ký",
)
def submit_contract_for_signing(
    contract_id: int,
    data: Optional[ContractSubmitSigningRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template_id = data.template_id if data else None
    notes = data.notes if data else None
    ContractService.submit_for_signing(db, contract_id, template_id, notes, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id)


@router.post(
    "/{contract_id}/activate",
    response_model=ContractDetailResponse,
    summary="Kích hoạt hợp đồng sau khi khách đã ký và nạp bản scan",
)
def activate_contract(
    contract_id: int,
    data: ContractActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kích hoạt hợp đồng sau khi đối chiếu bản scan đã ký (G09):
    - Đổi trạng thái sang ACTIVE và chuyển giữ chỗ sang CONVERTED.
    - Cập nhật ô mộ sang SOLD_RESERVED và ghi nhận lịch sử sở hữu (G05).
    - Tự động sinh nghĩa vụ tài chính trong receivables (G14).
    - Phát sinh sự kiện Transactional Outbox (G17).
    """
    ContractService.activate_contract(db, contract_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id)


@router.post(
    "/{contract_id}/cancel",
    response_model=ContractDetailResponse,
    summary="Hủy hợp đồng nháp và giải phóng giữ chỗ ô mộ",
)
def cancel_contract(
    contract_id: int,
    data: ContractCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ContractService.cancel_contract(db, contract_id, data.reason, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id)


@router.get(
    "/{contract_id}/pdf",
    summary="Xuất bản in hợp đồng dạng tệp PDF tiếng Việt",
)
def download_contract_pdf(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pdf_bytes = ContractService.generate_contract_pdf(db, contract_id)
    contract = ContractService.get_contract(db, contract_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{contract.contract_code}.pdf"',
        },
    )
