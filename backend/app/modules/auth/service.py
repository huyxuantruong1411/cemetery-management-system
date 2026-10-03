import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    get_password_hash,
    hash_refresh_token,
    verify_password,
)
from app.modules.auth.models import AuthSession, Role, User
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    TokenResponse,
    UserCreateRequest,
    UserUpdateRequest,
)


def _utc_now_naive() -> datetime:
    """Return current UTC datetime as offset-naive for SQL Server compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AuthService:
    @staticmethod
    def get_user_permissions(user: User) -> set[str]:
        """Aggregate all permission codes ({resource}:{action}) from all assigned roles."""
        perms: set[str] = set()
        for role in user.roles:
            for p in role.permissions:
                perms.add(f"{p.resource}:{p.action}")
        return perms

    @classmethod
    def authenticate_user(cls, db: Session, username: str, password: str) -> User:
        """Authenticate user by username and password.

        Raises HTTPException if authentication fails.
        """
        user = db.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tên đăng nhập hoặc mật khẩu không chính xác",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
            )
        return user

    @classmethod
    def create_session(cls, db: Session, user: User) -> TokenResponse:
        """Create a new authenticated session family with access token and refresh token."""
        raw_refresh_token = generate_refresh_token()
        hashed_refresh = hash_refresh_token(raw_refresh_token)
        now = _utc_now_naive()
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        session = AuthSession(
            session_id=uuid.uuid4().hex,
            user_id=user.user_id,
            refresh_token_hash=hashed_refresh,
            family_id=uuid.uuid4().hex,
            expires_at=expires_at,
            is_revoked=False,
            created_at=now,
            last_used_at=now,
        )
        db.add(session)
        db.commit()

        roles = [r.role_name for r in user.roles]
        permissions = sorted(list(cls.get_user_permissions(user)))

        access_token = create_access_token(
            subject=user.user_id,
            username=user.username,
            auth_version=user.auth_version,
            roles=roles,
            permissions=permissions,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @classmethod
    def refresh_session(cls, db: Session, raw_refresh_token: str) -> TokenResponse:
        """Rotate refresh token (RFC 6819) and issue a new access token.

        If token reuse is detected, the entire session family is revoked immediately.
        """
        hashed = hash_refresh_token(raw_refresh_token)
        session = db.query(AuthSession).filter(AuthSession.refresh_token_hash == hashed).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Detect token reuse
        if session.is_revoked:
            # Revoke all sessions in this family immediately!
            db.query(AuthSession).filter(AuthSession.family_id == session.family_id).update(
                {"is_revoked": True}
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Phát hiện tái sử dụng token. Phiên làm việc đã bị hủy.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        now = _utc_now_naive()
        if session.expires_at < now:
            session.is_revoked = True
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token đã hết hạn",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = db.get(User, session.user_id)
        if not user or not user.is_active:
            session.is_revoked = True
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản không hoạt động",
            )

        # Rotate: Revoke current session, create next generation in family
        session.is_revoked = True
        session.last_used_at = now

        new_raw_refresh = generate_refresh_token()
        new_hashed = hash_refresh_token(new_raw_refresh)
        new_session = AuthSession(
            session_id=uuid.uuid4().hex,
            user_id=user.user_id,
            refresh_token_hash=new_hashed,
            family_id=session.family_id,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            is_revoked=False,
            created_at=now,
            last_used_at=now,
        )
        db.add(new_session)
        db.commit()

        roles = [r.role_name for r in user.roles]
        permissions = sorted(list(cls.get_user_permissions(user)))

        new_access_token = create_access_token(
            subject=user.user_id,
            username=user.username,
            auth_version=user.auth_version,
            roles=roles,
            permissions=permissions,
        )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_raw_refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @classmethod
    def logout_session(cls, db: Session, raw_refresh_token: str) -> None:
        """Revoke a single session by refresh token."""
        hashed = hash_refresh_token(raw_refresh_token)
        session = db.query(AuthSession).filter(AuthSession.refresh_token_hash == hashed).first()
        if session:
            session.is_revoked = True
            session.last_used_at = _utc_now_naive()
            db.commit()

    @classmethod
    def revoke_all_user_sessions(cls, db: Session, user_id: int) -> None:
        """Bump auth_version and revoke all active sessions for immediate global logout."""
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Người dùng không tồn tại",
            )

        user.auth_version += 1
        user.updated_at = _utc_now_naive()

        db.query(AuthSession).filter(
            AuthSession.user_id == user_id,
            AuthSession.is_revoked == False,  # noqa: E712
        ).update({"is_revoked": True})

        db.commit()

    @classmethod
    def create_user(cls, db: Session, req: UserCreateRequest) -> User:
        """Create a new user with hashed password and assigned roles."""
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tên đăng nhập '{req.username}' đã tồn tại",
            )
        if db.query(User).filter(User.email == str(req.email)).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{req.email}' đã được sử dụng",
            )

        now = _utc_now_naive()
        user = User(
            username=req.username,
            password_hash=get_password_hash(req.password),
            full_name=req.full_name,
            email=str(req.email),
            phone_number=req.phone_number,
            is_active=True,
            auth_version=1,
            created_at=now,
            updated_at=now,
        )

        if req.role_ids:
            roles = db.query(Role).filter(Role.role_id.in_(req.role_ids)).all()
            user.roles = roles

        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def update_user(cls, db: Session, user_id: int, req: UserUpdateRequest) -> User:
        """Update user profile, status, or role assignments."""
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Người dùng không tồn tại",
            )

        if req.email and req.email != user.email:
            existing = (
                db.query(User).filter(User.email == str(req.email), User.user_id != user_id).first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email đã được sử dụng",
                )
            user.email = str(req.email)

        if req.full_name is not None:
            user.full_name = req.full_name
        if req.phone_number is not None:
            user.phone_number = req.phone_number

        roles_changed = False
        if req.role_ids is not None:
            roles = db.query(Role).filter(Role.role_id.in_(req.role_ids)).all()
            user.roles = roles
            roles_changed = True

        status_changed = False
        if req.is_active is not None and req.is_active != user.is_active:
            user.is_active = req.is_active
            status_changed = True

        # If roles changed or user disabled, bump auth_version and revoke sessions immediately
        if roles_changed or (status_changed and not user.is_active):
            user.auth_version += 1
            db.query(AuthSession).filter(
                AuthSession.user_id == user_id,
                AuthSession.is_revoked == False,  # noqa: E712
            ).update({"is_revoked": True})

        user.updated_at = _utc_now_naive()
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def change_password(cls, db: Session, user_id: int, req: ChangePasswordRequest) -> None:
        """Change user password, bump auth_version and revoke existing sessions."""
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Người dùng không tồn tại",
            )

        if not verify_password(req.old_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không chính xác",
            )

        user.password_hash = get_password_hash(req.new_password)
        user.auth_version += 1
        user.updated_at = _utc_now_naive()

        db.query(AuthSession).filter(
            AuthSession.user_id == user_id,
            AuthSession.is_revoked == False,  # noqa: E712
        ).update({"is_revoked": True})

        db.commit()
