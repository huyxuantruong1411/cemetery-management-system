from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import Role, User
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RoleDetailResponse,
    TokenResponse,
    UserCreateRequest,
    UserDetailResponse,
    UserUpdateRequest,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Đăng nhập hệ thống",
)
def login(
    req: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Xác thực người dùng bằng username và password, cấp phát access token và refresh token."""
    user = AuthService.authenticate_user(db, req.username, req.password)
    return AuthService.create_session(db, user)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Làm mới token (Refresh token rotation)",
)
def refresh_token(
    req: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Đổi refresh token hiện tại lấy access token mới và refresh token kế tiếp (RFC 6819)."""
    return AuthService.refresh_session(db, req.refresh_token)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Đăng xuất phiên làm việc",
)
def logout(
    req: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Thu hồi refresh token của phiên làm việc hiện tại."""
    AuthService.logout_session(db, req.refresh_token)
    return MessageResponse(message="Đăng xuất thành công")


@router.get(
    "/me",
    response_model=UserDetailResponse,
    summary="Thông tin tài khoản hiện tại",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserDetailResponse:
    """Lấy thông tin tài khoản đang đăng nhập kèm danh sách vai trò và quyền hạn chi tiết."""
    perms = sorted(list(AuthService.get_user_permissions(current_user)))
    return UserDetailResponse(
        user_id=current_user.user_id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        phone_number=current_user.phone_number,
        is_active=current_user.is_active,
        auth_version=current_user.auth_version,
        roles=current_user.roles,
        permissions=perms,
    )


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Đổi mật khẩu người dùng",
)
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Đổi mật khẩu, tăng auth_version và thu hồi toàn bộ phiên đăng nhập cũ."""
    AuthService.change_password(db, current_user.user_id, req)
    return MessageResponse(message="Đổi mật khẩu thành công. Vui lòng đăng nhập lại.")


@router.post(
    "/revoke-all",
    response_model=MessageResponse,
    summary="Thu hồi toàn bộ phiên đăng nhập (Đăng xuất mọi thiết bị)",
)
def revoke_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Tăng auth_version của tài khoản, vô hiệu hóa ngay lập tức mọi access và refresh token."""
    AuthService.revoke_all_user_sessions(db, current_user.user_id)
    return MessageResponse(message="Đã thu hồi toàn bộ phiên làm việc trên mọi thiết bị")


# --- User & Role Administration ---


@router.get(
    "/users",
    response_model=list[UserDetailResponse],
    summary="Danh sách người dùng (Quản trị)",
)
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users", "read")),
) -> list[UserDetailResponse]:
    """Danh sách toàn bộ người dùng trong hệ thống (Yêu cầu quyền users:read)."""
    users = db.query(User).all()
    results: list[UserDetailResponse] = []
    for u in users:
        perms = sorted(list(AuthService.get_user_permissions(u)))
        results.append(
            UserDetailResponse(
                user_id=u.user_id,
                username=u.username,
                full_name=u.full_name,
                email=u.email,
                phone_number=u.phone_number,
                is_active=u.is_active,
                auth_version=u.auth_version,
                roles=u.roles,
                permissions=perms,
            )
        )
    return results


@router.post(
    "/users",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới tài khoản người dùng (Quản trị)",
)
def create_user(
    req: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users", "write")),
) -> UserDetailResponse:
    """Tạo người dùng mới với mật khẩu hash và phân quyền (Yêu cầu quyền users:write)."""
    user = AuthService.create_user(db, req)
    perms = sorted(list(AuthService.get_user_permissions(user)))
    return UserDetailResponse(
        user_id=user.user_id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        phone_number=user.phone_number,
        is_active=user.is_active,
        auth_version=user.auth_version,
        roles=user.roles,
        permissions=perms,
    )


@router.put(
    "/users/{user_id}",
    response_model=UserDetailResponse,
    summary="Cập nhật tài khoản người dùng (Quản trị)",
)
def update_user(
    user_id: int,
    req: UserUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users", "write")),
) -> UserDetailResponse:
    """Cập nhật thông tin, trạng thái hoạt động hoặc phân quyền của người dùng."""
    user = AuthService.update_user(db, user_id, req)
    perms = sorted(list(AuthService.get_user_permissions(user)))
    return UserDetailResponse(
        user_id=user.user_id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        phone_number=user.phone_number,
        is_active=user.is_active,
        auth_version=user.auth_version,
        roles=user.roles,
        permissions=perms,
    )


@router.get(
    "/roles",
    response_model=list[RoleDetailResponse],
    summary="Danh sách vai trò và phân quyền (Quản trị)",
)
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users", "read")),
) -> list[RoleDetailResponse]:
    """Danh sách vai trò cùng các quyền hạn được gán trong hệ thống."""
    return db.query(Role).all()
