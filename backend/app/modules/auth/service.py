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

# =============================================================================
# MODULE XÁC THỰC, PHÂN QUYỀN & BẢO MẬT PHIÊN (AUTH SERVICE)
# =============================================================================
# Module này là xương sống bảo mật của toàn bộ hệ thống nghĩa trang:
# 1. Cơ chế Token Kép (Dual-Token Pattern - RFC 6749 & RFC 6819):
#    - Access Token: JWT thời hạn ngắn (30 phút), chứa claims (sub, username, auth_version, roles, permissions).
#    - Refresh Token: Chuỗi ngẫu nhiên dài hạn (30 ngày), lưu dạng băm SHA-256 trong CSDL (AuthSession).
# 2. Xoay vòng Refresh Token & Phát hiện Tái sử dụng (Refresh Token Rotation & Reuse Detection):
#    - Mỗi lần làm mới session, refresh token cũ bị thu hồi và sinh token mới trong cùng family_id.
#    - Nếu phát hiện token đã thu hồi bị gửi lại -> Phát hiện rò rỉ token, hủy toàn bộ family ngay lập tức!
# 3. Thu hồi phiên tức thì qua Auth Version (Instant Revocation via auth_version - G01):
#    - Khắc phục nhược điểm của JWT stateless: Khi đổi mật khẩu, đổi quyền, hoặc đăng xuất tất cả,
#      hệ thống tăng auth_version của User lên 1 đơn vị. Mọi access token cũ mang auth_version cũ
#      bị từ chối ngay lập tức ở tầng dependency (get_current_user) mà không cần chờ hết hạn.
# 4. Phân quyền đa tầng RBAC (Role-Based Access Control):
#    - Gộp toàn bộ quyền {resource}:{action} từ các vai trò (Role) của người dùng.
#    - Vai trò ADMIN có đặc quyền vượt qua toàn bộ các cổng kiểm tra quyền.
# =============================================================================

def _utc_now_naive() -> datetime:
    """Trả về thời gian UTC dạng offset-naive tương thích hoàn toàn với MSSQL DATETIME2."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AuthService:
    @staticmethod
    def get_user_permissions(user: User) -> set[str]:
        """
        Tổng hợp toàn bộ các mã quyền hạn ({resource}:{action}) từ tất cả vai trò được gán cho User.
        Ví dụ: {'plots:view', 'plots:reserve', 'contracts:approve', 'finance:pay'}.
        """
        perms: set[str] = set()
        for role in user.roles:
            for p in role.permissions:
                perms.add(f"{p.resource}:{p.action}")
        return perms

    @classmethod
    def authenticate_user(cls, db: Session, username: str, password: str) -> User:
        """
        Xác thực thông tin đăng nhập của người dùng.
        - Tìm người dùng theo username.
        - Thẩm định mật khẩu băm bcrypt an toàn (verify_password).
        - Kiểm tra trạng thái kích hoạt (is_active): Chặn tài khoản đã bị vô hiệu hóa.
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
        """
        [KHỞI TẠO PHIÊN ĐĂNG NHẬP MỚI - DUAL TOKEN CREATION]
        
        Quy trình xử lý:
        1. Sinh refresh token thô ngẫu nhiên (cryptographically secure).
        2. Băm refresh token bằng SHA-256 trước khi lưu vào bảng AuthSession (bảo mật tuyệt đối,
           dù CSDL có bị lộ thì kẻ tấn công cũng không thể giả mạo refresh token).
        3. Khởi tạo một họ phiên làm việc (family_id) duy nhất đại diện cho chuỗi token này.
        4. Gộp vai trò và quyền hạn chi tiết của người dùng.
        5. Đóng gói Access Token JWT có mang theo auth_version hiện tại của User.
        """
        raw_refresh_token = generate_refresh_token()
        hashed_refresh = hash_refresh_token(raw_refresh_token)
        now = _utc_now_naive()
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        # Lưu bản ghi phiên trong CSDL
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

        # Sinh access token chứa claims danh tính, auth_version và quyền hạn
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
        """
        [XOAY VÒNG REFRESH TOKEN & PHÁT HIỆN TÁI SỬ DỤNG - RFC 6819]
        
        Cơ chế phòng thủ chuyên sâu:
        1. Băm token gửi lên và tra cứu trong AuthSession.
        2. PHÁT HIỆN TÁI SỬ DỤNG (Token Reuse Detection):
           Nếu refresh token đã bị thu hồi (session.is_revoked == True) mà lại được gửi lên,
           hệ thống xác định ngay lập tức token đã bị kẻ tấn công đánh cắp.
           Hành động: Thu hồi toàn bộ mọi token thuộc họ family_id này, chặn đứng kẻ tấn công.
        3. Kiểm tra hạn sử dụng và trạng thái kích hoạt của User.
        4. Xoay vòng (Rotation): Đánh dấu token hiện tại là is_revoked = True,
           sinh ra refresh token mới thuộc cùng family_id.
        5. Cấp phát Access Token mới kèm auth_version và quyền cập nhật nhất.
        """
        hashed = hash_refresh_token(raw_refresh_token)
        session = db.query(AuthSession).filter(AuthSession.refresh_token_hash == hashed).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # PHÁT HIỆN TÁI SỬ DỤNG TOKEN (TOKEN REUSE ATTACK PREVENTION)
        if session.is_revoked:
            # Ngay lập tức hủy toàn bộ các phiên trong cùng họ family_id để bảo vệ tài khoản
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

        # Xoay vòng token: Đóng phiên hiện tại, mở phiên mới trong cùng một họ family_id
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
        """Đăng xuất một phiên làm việc cụ thể bằng cách thu hồi refresh token tương ứng."""
        hashed = hash_refresh_token(raw_refresh_token)
        session = db.query(AuthSession).filter(AuthSession.refresh_token_hash == hashed).first()
        if session:
            session.is_revoked = True
            session.last_used_at = _utc_now_naive()
            db.commit()

    @classmethod
    def revoke_all_user_sessions(cls, db: Session, user_id: int) -> None:
        """
        [ĐĂNG XUẤT TOÀN DIỆN & THU HỒI TOKEN TỨC THÌ - G01]
        
        Quy trình xử lý:
        1. Tăng auth_version của User thêm 1 đơn vị.
        2. Toàn bộ access token đang lưu hành trên mọi thiết bị sẽ bị vô hiệu hóa ngay lập tức
           khi gửi request tiếp theo tới hệ thống.
        3. Thu hồi (is_revoked=True) toàn bộ các bản ghi refresh token còn hoạt động trong CSDL.
        """
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

    # =========================================================================
    # QUẢN TRỊ NGƯỜI DÙNG & ĐỔI MẬT KHẨU (USER MANAGEMENT)
    # =========================================================================

    @classmethod
    def create_user(cls, db: Session, req: UserCreateRequest) -> User:
        """
        Tạo mới tài khoản người dùng/nhân viên trong hệ thống.
        - Kiểm tra tính duy nhất của username và email.
        - Băm mật khẩu bằng hàm get_password_hash (bcrypt).
        - Khởi tạo auth_version = 1 đại diện cho thế hệ token đầu tiên.
        - Gán danh sách vai trò (roles) được chỉ định.
        """
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
        """
        Cập nhật thông tin cá nhân, trạng thái kích hoạt hoặc phân quyền người dùng.
        
        Cơ chế bảo mật vô hiệu hóa phiên tức thì (Security Invariant):
        - Nếu có bất kỳ sự thay đổi nào về:
          1. Quyền hạn/vai trò (roles_changed)
          2. Tài khoản bị vô hiệu hóa/khóa (user.is_active = False)
          3. Đổi/reset mật khẩu (password_changed)
        - Hệ thống TỰ ĐỘNG TĂNG auth_version += 1 và thu hồi toàn bộ AuthSession trong CSDL.
        - Hệ quả: Kẻ gian hoặc nhân viên bị hạ quyền/đuổi việc sẽ bị đá văng khỏi toàn bộ
          các thiết bị ngay lập tức, không thể dùng JWT cũ để thực hiện thao tác trái phép!
        """
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

        password_changed = False
        if req.password:
            user.password_hash = get_password_hash(req.password)
            password_changed = True

        # Tăng auth_version và thu hồi session để vô hiệu hóa token cũ ngay lập tức
        if roles_changed or (status_changed and not user.is_active) or password_changed:
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
        """
        Đổi mật khẩu người dùng với cơ chế bảo vệ phiên an toàn:
        - Thẩm định mật khẩu hiện tại (old_password).
        - Băm và lưu mật khẩu mới (new_password).
        - Tăng auth_version += 1 và thu hồi toàn bộ session đang mở trên các trình duyệt/thiết bị khác.
        """
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

        # Thu hồi toàn bộ phiên đăng nhập cũ
        db.query(AuthSession).filter(
            AuthSession.user_id == user_id,
            AuthSession.is_revoked == False,  # noqa: E712
        ).update({"is_revoked": True})

        db.commit()
