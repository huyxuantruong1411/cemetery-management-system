from collections.abc import Callable

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.service import AuthService

security_bearer = HTTPBearer(auto_error=False)


# =============================================================================
# DEPENDENCY XÁC THỰC DANH TÍNH TỪ JWT BEARER (G01)
# =============================================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    [DEPENDENCY KIỂM TRA & XÁC THỰC DANH TÍNH NGƯỜI DÙNG - JWT BEARER]
    
    Quy trình kiểm tra an ninh đa tầng:
    1. Kiểm tra header Authorization: Bắt buộc phải có định dạng 'Bearer <token>'.
    2. Giải mã và thẩm định chữ ký số JWT (decode_access_token):
       - Bắt ExpiredSignatureError nếu token đã hết hạn 30 phút.
       - Bắt InvalidTokenError nếu token bị giả mạo hoặc chữ ký không khớp secret key.
    3. Trích xuất claims: sub (mã user_id) và auth_version.
    4. Kiểm tra tài khoản trong CSDL: Phải tồn tại và đang hoạt động (is_active == True).
    5. CƠ CHẾ THU HỒI TOKEN TỨC THÌ (G01 - IMMEDIATE REVOCATION GATE):
       So sánh auth_version trong payload JWT với auth_version thực tế trong CSDL của User:
       - Nếu khớp: Token hợp lệ, cấp quyền xử lý request.
       - Nếu không khớp (token_auth_version != user.auth_version): Token này thuộc về thế hệ cũ
         (đã bị thu hồi do đổi mật khẩu, đổi vai trò, hoặc đăng xuất từ xa).
         -> Lập tức ném HTTP 401 Unauthorized, triệt tiêu hoàn toàn rủi ro lộ token!
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu xác thực tài khoản (thiếu Bearer token)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token xác thực không hợp lệ",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user_id_str = payload.get("sub")
    token_auth_version = payload.get("auth_version")

    if not user_id_str or token_auth_version is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không chứa đủ thông tin định danh",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mã người dùng không hợp lệ",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa",
        )

    # G01: Immediate revocation check - So sánh phiên bản xác thực chống token cũ
    if token_auth_version != user.auth_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã bị thu hồi do đổi quyền, đổi mật khẩu hoặc đăng xuất.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# =============================================================================
# DEPENDENCY PHÂN QUYỀN RBAC CHI TIẾT THEO HÀNH ĐỘNG
# =============================================================================

def require_permission(resource: str, action: str) -> Callable[[User], User]:
    """
    [DEPENDENCY FACTORY KIỂM SOÁT QUYỀN HẠN CHI TIẾT - RESOURCE:ACTION]
    
    Nguyên lý phân quyền:
    - Định danh quyền dưới dạng chuỗi chuẩn: '{resource}:{action}'
      (Ví dụ: 'plots:reserve', 'contracts:approve', 'finance:pay', 'care:close').
    - Đặc quyền Quản trị tối cao (ADMIN Bypass):
      Nếu người dùng sở hữu vai trò 'ADMIN', tự động được phép truy cập mọi tài nguyên.
    - Đối với các vai trò khác (STAFF, CARETAKER, ACCOUNTANT...):
      Tổng hợp toàn bộ tập quyền của người dùng (user_perms).
      Nếu quyền hạn yêu cầu không nằm trong tập quyền -> Ném HTTP 403 Forbidden.
    """
    permission_code = f"{resource}:{action}"

    def _permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = [r.role_name for r in current_user.roles]
        # Quản trị viên tối cao tự động bỏ qua mọi kiểm tra quyền chi tiết
        if "ADMIN" in user_roles:
            return current_user

        user_perms = AuthService.get_user_permissions(current_user)
        if permission_code not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Từ chối: Bạn không có quyền '{permission_code}'.",
            )
        return current_user

    return _permission_checker


def require_role(*role_names: str) -> Callable[[User], User]:
    """
    [DEPENDENCY FACTORY KIỂM TRA VAI TRÒ NGƯỜI DÙNG - ROLE-BASED ACCESS CONTROL]
    
    Kiểm tra người dùng có nắm giữ ít nhất một trong các vai trò được chỉ định hay không.
    Vai trò 'ADMIN' luôn có quyền truy cập mặc định.
    """
    def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = [r.role_name for r in current_user.roles]
        if "ADMIN" in user_roles:
            return current_user

        if not any(r in role_names for r in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Từ chối truy cập: Yêu cầu vai trò {', '.join(role_names)}",
            )
        return current_user

    return _role_checker
