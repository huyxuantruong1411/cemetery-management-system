from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.contracts.schemas import (
    AnnexActivateRequest,
    AnnexSubmitSigningRequest,
    BurialAnnexCreate,
    ContractActivateRequest,
    ContractBriefResponse,
    ContractCancelRequest,
    ContractDetailResponse,
    ContractSubmitSigningRequest,
    CremationContractCreate,
    ExhumationContractCreate,
    LandPurchaseContractCreate,
    TransferContractCreate,
)
from app.modules.contracts.service import ContractService

router = APIRouter(prefix="/contracts", tags=["Contracts: Land Purchase & Lifecycle"])


# ==============================================================================
# Contract Creation Endpoints
# ==============================================================================
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


@router.post(
    "/exhumation",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng cải táng / cất bốc (G20)",
)
def create_exhumation_contract(
    data: ExhumationContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lập hợp đồng cải táng / cất bốc di cốt:
    - Bắt buộc kiểm tra quyền sở hữu của thân nhân đứng tên.
    - Thực thi tuyệt đối quy tắc Kim Tĩnh Bất Biến (chặn cải táng ô mộ Kim Tĩnh đã kiên cố).
    - Kiểm tra slot huyệt và thông tin người quá cố chính xác.
    """
    contract = ContractService.create_exhumation_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract.contract_id)


@router.post(
    "/transfer",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng chuyển nhượng quyền sử dụng ô mộ (G18)",
)
def create_transfer_contract(
    data: TransferContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lập hợp đồng chuyển nhượng quyền sử dụng đất nghĩa trang:
    - Xác minh bên chuyển nhượng là chủ sở hữu hợp pháp.
    - Bắt buộc toàn bộ slot huyệt trong ô mộ phải trống (chưa có người an táng).
    - Chặn tuyệt đối chuyển nhượng ô mộ Kim Tĩnh đã khóa vĩnh viễn.
    """
    contract = ContractService.create_transfer_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract.contract_id)


@router.post(
    "/cremation",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng dịch vụ hỏa táng (G20)",
)
def create_cremation_contract(
    data: CremationContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lập hợp đồng dịch vụ hỏa táng độc lập:
    - Bắt buộc người quá cố phải có giấy báo tử đã được phê duyệt xác minh hợp lệ (G08).
    - Thiết lập ngày thực hiện, gói dịch vụ và tùy chọn lưu tro cốt.
    """
    contract = ContractService.create_cremation_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract.contract_id)


# ==============================================================================
# Contract Query Endpoints
# ==============================================================================
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
    status_filter: Optional[str] = Query(
        None, description="Bí danh lọc theo trạng thái"
    ),
    customer_id: Optional[int] = Query(None, description="Lọc theo khách hàng"),
    search: Optional[str] = Query(
        None, description="Tìm kiếm theo mã HĐ, tên khách hàng, SĐT, mã ô mộ"
    ),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    eff_status = status or status_filter
    return ContractService.list_contracts(
        db,
        contract_type=contract_type,
        status_filter=eff_status,
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


# ==============================================================================
# Contract Lifecycle Actions
# ==============================================================================
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
    Kích hoạt hợp đồng toàn vẹn ACID:
    - Chuyển trạng thái sang ACTIVE, lưu file scan đã ký từ MinIO.
    - Với LAND_PURCHASE: chuyển ô mộ sang OWNED_EMPTY, ghi nhận quyền sở hữu, chuyển giữ chỗ sang CONVERTED.
    - Với EXHUMATION: giải phóng slot huyệt về EMPTY, ghi nhận lịch sử cải táng, cập nhật ô mộ.
    - Với TRANSFER: đóng chuỗi sở hữu cũ, cấp quyền sở hữu mới cho bên mua, cập nhật owner_id.
    - Với CREMATION: kích hoạt dịch vụ hỏa táng.
    - Tự động sinh nghĩa vụ công nợ và phát sinh Transactional Outbox Event.
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


# ==============================================================================
# Contract Annex Endpoints (Burial, Care, Construction - G10)
# ==============================================================================
@router.post(
    "/{contract_id}/annexes/burial",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập phụ lục an táng người quá cố (G10)",
)
def create_burial_annex(
    contract_id: int,
    data: BurialAnnexCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lập phụ lục an táng cho hợp đồng mua đất:
    - Bắt buộc người quá cố phải có giấy báo tử đã được duyệt (G08).
    - Chặn an táng đồng thời 1 người ở 2 slot khác nhau.
    - Slot huyệt phải còn trống và thuộc đúng ô mộ của hợp đồng.
    - Kiểm tra ô mộ không bị khóa vĩnh viễn (Kim Tĩnh Immutability).
    """
    ContractService.create_burial_annex(db, contract_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id)


@router.post(
    "/annexes/{annex_id}/submit-signing",
    summary="Chuyển phụ lục hợp đồng sang trạng thái chờ ký",
)
def submit_annex_for_signing(
    annex_id: int,
    data: Optional[AnnexSubmitSigningRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = data.notes if data else None
    annex = ContractService.submit_annex_for_signing(db, annex_id, notes, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, annex.contract_id)


@router.post(
    "/annexes/{annex_id}/activate",
    summary="Kích hoạt phụ lục an táng sau khi ký và nạp bản scan",
)
def activate_burial_annex(
    annex_id: int,
    data: AnnexActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kích hoạt phụ lục an táng toàn vẹn ACID:
    - Kiểm tra lại tính hợp lệ của giấy báo tử.
    - Chuyển slot huyệt sang OCCUPIED và gán current_deceased_id.
    - Chuyển ô mộ sang OCCUPIED. Nếu an táng Kim Tĩnh: tự động khóa vĩnh viễn (is_kim_tinh=1, is_locked=1).
    - Ghi nhận lịch sử an táng (BurialHistory) kèm proof file MinIO và user thực hiện.
    - Tự động sinh công nợ phát sinh và phát sinh Transactional Outbox Event.
    """
    annex = ContractService.activate_burial_annex(db, annex_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, annex.contract_id)
