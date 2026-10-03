from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.profiles.schemas import (
    CustomerCreate,
    CustomerRelationBrief,
    CustomerResponse,
    CustomerUpdate,
    DeathCertificateCreate,
    DeathCertificateResponse,
    DeathCertificateVerifyRequest,
    DeceasedProfileCreate,
    DeceasedProfileResponse,
    DeceasedProfileUpdate,
    DeceasedPublicLookupResponse,
    RelationCreate,
)
from app.modules.profiles.service import ProfileService

router = APIRouter(prefix="/profiles", tags=["Profiles: Customers, Deceased & Death Certificates"])


# =============================================================================
# 1. Public Memorial Lookup (Zero PII - G19 & ADR-001)
# =============================================================================
@router.get("/public/memorials", response_model=List[DeceasedPublicLookupResponse])
def public_memorial_lookup(
    q: str = Query(..., min_length=2, description="Tên hoặc mã người quá cố để tra cứu nơi an táng"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Cổng tra cứu công khai thông tin nơi an táng của người quá cố.
    BẢO VỆ TUYỆT ĐỐI QUYỀN RIÊNG TƯ (Zero PII Leakage):
    Không trả về số CCCD, số điện thoại, địa chỉ thân nhân hay giấy báo tử.
    """
    return ProfileService.public_lookup_deceased(db, q, limit=limit)


# =============================================================================
# 2. Customers Endpoints
# =============================================================================
@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo mới hồ sơ khách hàng. Kiểm tra nghiêm ngặt trùng CCCD (409 Conflict)."""
    return ProfileService.create_customer(db, data)


@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None, description="Tìm theo tên, mã KH, CCCD, SĐT"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Danh sách khách hàng (yêu cầu quyền nhân viên)."""
    return ProfileService.list_customers(db, search=search, limit=limit)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chi tiết hồ sơ khách hàng kèm danh sách người mất có liên hệ."""
    return ProfileService.get_customer(db, customer_id)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật thông tin khách hàng."""
    return ProfileService.update_customer(db, customer_id, data)


# =============================================================================
# 3. Deceased Profiles Endpoints (G07)
# =============================================================================
@router.post("/deceased", response_model=DeceasedProfileResponse, status_code=status.HTTP_201_CREATED)
def create_deceased_profile(
    data: DeceasedProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tạo hồ sơ người mất (G07).
    Ràng buộc:
    - ngày sinh <= ngày mất
    - năm sinh <= năm mất
    - nếu chỉ biết năm sinh: lưu birth_year và birth_date_precision='YEAR_ONLY', không bịa ngày 01/01.
    """
    return ProfileService.create_deceased_profile(db, data, user_id=current_user.user_id)


@router.get("/deceased", response_model=List[DeceasedProfileResponse])
def list_deceased_profiles(
    search: Optional[str] = Query(None, description="Tìm theo họ tên, mã người mất, quê quán"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Danh sách hồ sơ người mất nội bộ."""
    return ProfileService.list_deceased_profiles(db, search=search, limit=limit)


@router.get("/deceased/{deceased_id}", response_model=DeceasedProfileResponse)
def get_deceased_profile(
    deceased_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chi tiết hồ sơ người mất kèm giấy báo tử, thân nhân và vị trí ô mộ/slot huyệt đã an táng."""
    return ProfileService.get_deceased_profile(db, deceased_id)


@router.put("/deceased/{deceased_id}", response_model=DeceasedProfileResponse)
def update_deceased_profile(
    deceased_id: int,
    data: DeceasedProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật thông tin người mất."""
    return ProfileService.update_deceased_profile(db, deceased_id, data)


# =============================================================================
# 4. Death Certificate & Verification Workflow (G08)
# =============================================================================
@router.post("/deceased/{deceased_id}/certificate", response_model=DeathCertificateResponse)
def attach_death_certificate(
    deceased_id: int,
    data: DeathCertificateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Đính kèm hoặc cập nhật giấy báo tử cho người mất (G08).
    Trạng thái ban đầu: is_verified = False. Mọi thay đổi đều đưa về chưa xác minh để đảm bảo tính pháp lý.
    """
    return ProfileService.attach_or_update_certificate(db, deceased_id, data)


@router.post("/certificates/{cert_id}/verify", response_model=DeathCertificateResponse)
def verify_death_certificate(
    cert_id: int,
    data: DeathCertificateVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Xác minh hoặc từ chối giấy báo tử (G08).
    Ghi nhận nhân sự thẩm định thực tế (verified_by) và thời điểm xác minh.
    Là điều kiện tiên quyết bắt buộc trước khi kích hoạt phụ lục an táng.
    """
    return ProfileService.verify_certificate(db, cert_id, data, verifier_user_id=current_user.user_id)


# =============================================================================
# 5. Customer - Deceased Relations
# =============================================================================
@router.post("/relations", response_model=CustomerRelationBrief, status_code=status.HTTP_201_CREATED)
def link_customer_to_deceased(
    data: RelationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thiết lập mối quan hệ giữa khách hàng và người mất."""
    return ProfileService.link_relation(db, data)


@router.delete("/relations/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_customer_deceased_relation(
    relation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa liên kết thân nhân."""
    ProfileService.remove_relation(db, relation_id)
    return None
