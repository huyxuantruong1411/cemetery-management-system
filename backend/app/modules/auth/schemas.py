from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Tên đăng nhập")
    password: str = Field(..., min_length=6, description="Mật khẩu")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Thời gian sống của access token (giây)")


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Refresh token chuỗi dài")


class RoleSummary(BaseModel):
    role_id: int
    role_name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PermissionSummary(BaseModel):
    permission_id: int
    permission_code: str
    resource: str
    action: str

    model_config = ConfigDict(from_attributes=True)


class RoleDetailResponse(BaseModel):
    role_id: int
    role_name: str
    description: str | None = None
    permissions: list[PermissionSummary] = []

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(BaseModel):
    user_id: int
    username: str
    full_name: str
    email: str
    phone_number: str | None = None
    is_active: bool
    auth_version: int
    roles: list[RoleSummary] = []
    permissions: list[str] = []

    model_config = ConfigDict(from_attributes=True)


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone_number: str | None = Field(None, max_length=20)
    role_ids: list[int] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None
    phone_number: str | None = Field(None, max_length=20)
    is_active: bool | None = None
    role_ids: list[int] | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class MessageResponse(BaseModel):
    message: str
