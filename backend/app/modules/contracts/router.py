from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import User
from app.modules.contracts.models import BurialAnnex
from app.modules.contracts.schemas import (
    AnnexActivateRequest,
    AnnexSubmitSigningRequest,
    BurialAnnexCreate,
    BurialConfirmationResponse,
    CareAnnexCreate,
    ConfirmBurialRequest,
    ConstructionAnnexCreate,
    ContractActivateRequest,
    ContractBriefResponse,
    ContractCancelRequest,
    ContractDetailResponse,
    ContractSubmitSigningRequest,
    CremationContractCreate,
    ExhumationContractCreate,
    LandPurchaseContractCreate,
    TransferContractCreate,
    WorkBasisResponse,
)
from app.modules.contracts.service import ContractService
from app.modules.plots.models import Plot, PlotSlot

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
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Tạo hợp đồng mua đất nghĩa trang mới.
    Tự động áp dụng cơ chế khóa hàng (Anti-double booking - G04), giữ chỗ ô mộ trong 7 ngày,
    và snapshot đơn giá đất từ bảng giá niêm yết hiện hành.
    """
    contract = ContractService.create_land_purchase_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(
        db, contract.contract_id, current_user=current_user
    )


@router.post(
    "/exhumation",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng cải táng / cất bốc (G20)",
)
def create_exhumation_contract(
    data: ExhumationContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Lập hợp đồng cải táng / cất bốc di cốt:
    - Bắt buộc kiểm tra quyền sở hữu của thân nhân đứng tên.
    - Thực thi tuyệt đối quy tắc Kim Tĩnh Bất Biến (chặn cải táng ô mộ Kim Tĩnh đã kiên cố).
    - Kiểm tra slot huyệt và thông tin người quá cố chính xác.
    """
    contract = ContractService.create_exhumation_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(
        db, contract.contract_id, current_user=current_user
    )


@router.post(
    "/transfer",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng chuyển nhượng quyền sử dụng ô mộ (G18)",
)
def create_transfer_contract(
    data: TransferContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Lập hợp đồng chuyển nhượng quyền sử dụng đất nghĩa trang:
    - Xác minh bên chuyển nhượng là chủ sở hữu hợp pháp.
    - Bắt buộc toàn bộ slot huyệt trong ô mộ phải trống (chưa có người an táng).
    - Chặn tuyệt đối chuyển nhượng ô mộ Kim Tĩnh đã khóa vĩnh viễn.
    """
    contract = ContractService.create_transfer_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(
        db, contract.contract_id, current_user=current_user
    )


@router.post(
    "/cremation",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập hợp đồng dịch vụ hỏa táng (G20)",
)
def create_cremation_contract(
    data: CremationContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Lập hợp đồng dịch vụ hỏa táng độc lập:
    - Bắt buộc người quá cố phải có giấy báo tử đã được phê duyệt xác minh hợp lệ (G08).
    - Thiết lập ngày thực hiện, gói dịch vụ và tùy chọn lưu tro cốt.
    """
    contract = ContractService.create_cremation_contract(db, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(
        db, contract.contract_id, current_user=current_user
    )


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
    status_filter: Optional[str] = Query(None, description="Bí danh lọc theo trạng thái"),
    customer_id: Optional[int] = Query(None, description="Lọc theo khách hàng"),
    search: Optional[str] = Query(
        None, description="Tìm kiếm theo mã HĐ, tên khách hàng, SĐT, mã ô mộ"
    ),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "read")),
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
    "/work-bases",
    response_model=List[WorkBasisResponse],
    summary="Danh sách Căn Cứ Công Việc cho Quản trang (EX-01 / WorkBasis)",
)
def get_work_bases(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("plots", "read")),
):
    """
    Cung cấp danh sách căn cứ công việc (WorkBasis) cho Quản trang và Marketing:
    Bao gồm mã phụ lục, loại việc, ô/huyệt, người mất tối thiểu, ngày hẹn và tiến độ.
    Tuyệt đối không kéo theo CCCD, địa chỉ, số tiền/công nợ hay scan hợp đồng.
    """
    user_roles = [r.role_name.upper() for r in (current_user.roles or [])]
    if not any(r in ("CARETAKER", "ADMIN", "MARKETING") for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập Căn Cứ Công Việc.",
        )
    return ContractService.get_work_bases(db, status_filter=status_filter)


@router.get(
    "/{contract_id}",
    response_model=ContractDetailResponse,
    summary="Xem chi tiết hồ sơ hợp đồng",
)
def get_contract_detail(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "read")),
):
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


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
    current_user: User = Depends(require_permission("contracts", "write")),
):
    template_id = data.template_id if data else None
    notes = data.notes if data else None
    ContractService.submit_for_signing(db, contract_id, template_id, notes, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


@router.post(
    "/{contract_id}/activate",
    response_model=ContractDetailResponse,
    summary="Kích hoạt hợp đồng sau khi khách đã ký và nạp bản scan",
)
def activate_contract(
    contract_id: int,
    data: ContractActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "activate")),
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
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


@router.post(
    "/{contract_id}/cancel",
    response_model=ContractDetailResponse,
    summary="Hủy hợp đồng nháp và giải phóng giữ chỗ ô mộ",
)
def cancel_contract(
    contract_id: int,
    data: ContractCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    ContractService.cancel_contract(db, contract_id, data.reason, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


@router.get(
    "/{contract_id}/pdf",
    summary="Xuất bản in hợp đồng dạng tệp PDF tiếng Việt",
)
def download_contract_pdf(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "read")),
):
    user_roles = [r.role_name.upper() for r in (current_user.roles or [])]
    if ("CARETAKER" in user_roles or "ACCOUNTANT" in user_roles) and "ADMIN" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền tải văn bản hợp đồng pháp lý đầy đủ. Vui lòng tham khảo Căn Cứ Công Việc hoặc Căn Cứ Tài Chính.",
        )
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
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Lập phụ lục an táng cho hợp đồng mua đất hoặc chuyển nhượng:
    - Bắt buộc người quá cố phải có giấy báo tử đã được duyệt (G08).
    - Chặn an táng đồng thời 1 người ở 2 slot khác nhau.
    - Slot huyệt phải còn trống và thuộc đúng ô mộ của hợp đồng.
    - Kiểm tra ô mộ không bị khóa vĩnh viễn (Kim Tĩnh Immutability).
    """
    ContractService.create_burial_annex(db, contract_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


@router.post(
    "/{contract_id}/annexes/care",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập phụ lục dịch vụ chăm sóc cho hợp đồng",
)
def create_care_annex(
    contract_id: int,
    data: CareAnnexCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Lập phụ lục dịch vụ chăm sóc định kỳ cho hợp đồng mua đất hoặc chuyển nhượng.
    """
    ContractService.create_care_annex(db, contract_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


@router.post(
    "/{contract_id}/annexes/construction",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lập phụ lục thi công xây dựng / cải tạo cho hợp đồng",
)
def create_construction_annex(
    contract_id: int,
    data: ConstructionAnnexCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    """
    Lập phụ lục thi công xây dựng kim tĩnh, lăng mộ, ốp đá cho hợp đồng mua đất hoặc chuyển nhượng.
    """
    ContractService.create_construction_annex(db, contract_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, contract_id, current_user=current_user)


@router.post(
    "/annexes/{annex_id}/submit-signing",
    summary="Chuyển phụ lục hợp đồng sang trạng thái chờ ký",
)
def submit_annex_for_signing(
    annex_id: int,
    data: Optional[AnnexSubmitSigningRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "write")),
):
    notes = data.notes if data else None
    annex = ContractService.submit_annex_for_signing(db, annex_id, notes, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, annex.contract_id, current_user=current_user)


@router.post(
    "/annexes/{annex_id}/activate",
    summary="Kích hoạt phụ lục an táng sau khi ký và nạp bản scan",
)
def activate_burial_annex(
    annex_id: int,
    data: AnnexActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contracts", "activate")),
):
    """
    Kích hoạt phụ lục an táng toàn vẹn ACID:
    - Kiểm tra lại tính hợp lệ của giấy báo tử.
    - Nếu an táng tương lai: giữ slot huyệt ở trạng thái RESERVED.
    - Tự động sinh công nợ phát sinh và phát sinh Transactional Outbox Event.
    """
    annex = ContractService.activate_burial_annex(db, annex_id, data, current_user.user_id)
    return ContractService.get_contract_detail_dto(db, annex.contract_id, current_user=current_user)


@router.post(
    "/annexes/{annex_id}/confirm-burial",
    response_model=BurialConfirmationResponse,
    summary="Xác nhận an táng thực địa trên mộ phần (Caretaker)",
    dependencies=[Depends(require_permission("plots", "confirm_burial"))],
)
def confirm_burial(
    annex_id: int,
    body: Optional[ConfirmBurialRequest] = None,
    proof_file_id: Optional[str] = Query(None, description="Tệp ảnh minh chứng an táng thực tế"),
    notes: Optional[str] = Query(None, description="Ghi chú xác nhận hiện trường"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Xác nhận an táng thực địa độc lập với kích hoạt pháp lý (FLOW-01 / R05 / BA-09 / BA-14):
    - Dành cho Quản trang xác nhận sau khi thực tế hạ huyệt.
    - Cập nhật slot huyệt thành OCCUPIED và gán deceased_id.
    - Chuyển ô mộ thành OCCUPIED. Nếu an táng Kim Tĩnh: khóa vĩnh viễn (is_kim_tinh=1, is_locked=1).
    - Ghi nhận BurialHistory và Transactional Outbox Event.
    """
    user_roles = [r.role_name.upper() for r in (current_user.roles or [])]
    if "CARETAKER" not in user_roles and "ADMIN" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trang hoặc Quản trị viên mới có quyền xác nhận an táng thực địa.",
        )
    effective_proof_file_id = (
        body.proof_file_id if body and body.proof_file_id else None
    ) or proof_file_id
    effective_notes = (body.notes if body and body.notes else None) or notes
    annex = ContractService.confirm_burial(
        db,
        annex_id,
        current_user.user_id,
        proof_file_id=effective_proof_file_id,
        notes=effective_notes,
    )
    burial = db.query(BurialAnnex).filter(BurialAnnex.annex_id == annex.annex_id).first()
    plot = db.query(Plot).filter(Plot.plot_id == burial.plot_id).first()
    slot = db.query(PlotSlot).filter(PlotSlot.slot_id == burial.slot_id).first()
    return BurialConfirmationResponse(
        annex_id=annex.annex_id,
        annex_code=annex.annex_code,
        contract_id=annex.contract_id,
        plot_id=plot.plot_id,
        plot_code=plot.plot_code,
        slot_id=slot.slot_id,
        slot_number=slot.slot_number,
        deceased_id=burial.deceased_id,
        is_kim_tinh=plot.is_kim_tinh,
        is_locked=plot.is_locked,
        plot_status=plot.status,
        slot_status=slot.status,
        message="Xác nhận an táng thực địa hoàn tất thành công. Ô mộ và slot đã được cập nhật.",
        confirmed_at=datetime.now(timezone.utc),
    )
