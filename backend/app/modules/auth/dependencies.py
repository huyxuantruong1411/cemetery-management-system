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


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the current authenticated user from Bearer JWT.

    Enforces:
    - Token validity and expiration
    - User active status
    - G01: Immediate revocation via matching auth_version
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

    # G01: Immediate revocation check
    if token_auth_version != user.auth_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã bị thu hồi do đổi quyền, đổi mật khẩu hoặc đăng xuất.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_permission(resource: str, action: str) -> Callable[[User], User]:
    """Dependency factory checking if the authenticated user has {resource}:{action} permission.

    The 'ADMIN' role automatically bypasses all permission checks.
    """
    permission_code = f"{resource}:{action}"

    def _permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = [r.role_name for r in current_user.roles]
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
    """Dependency factory checking if user has at least one of the specified roles."""

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
