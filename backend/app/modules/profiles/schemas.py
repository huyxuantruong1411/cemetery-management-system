from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ==============================================================================
# Relation DTOs
# ==============================================================================
class CustomerRelationBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    relation_id: int
    deceased_id: int
    deceased_code: str
    deceased_full_name: str
    relationship_type: str
    is_primary_contact: bool


class DeceasedRelationBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    relation_id: int
    customer_id: int
    customer_code: str
    customer_full_name: str
    citizen_id: str
    phone_number: str
    relationship_type: str
    is_primary_contact: bool


class BurialSlotBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slot_id: int
    plot_id: int
    slot_number: int
    plot_code: str
    zone_code: str
    zone_name: str
    row_code: str
    status: str
    is_kim_tinh: bool


# ==============================================================================
# Customer Schemas
# ==============================================================================
class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    citizen_id: str = Field(..., min_length=9, max_length=20, description="Số CCCD / CMND")
    phone_number: str = Field(..., min_length=8, max_length=20)
    email: EmailStr | None = None
    address: str = Field(..., min_length=2, max_length=255)
    date_of_birth: date | None = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("Ngày sinh không thể lớn hơn ngày hiện tại")
        return v


class CustomerCreate(CustomerBase):
    customer_code: str | None = None


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=100)
    phone_number: str | None = Field(None, min_length=8, max_length=20)
    email: EmailStr | None = None
    address: str | None = Field(None, min_length=2, max_length=255)
    date_of_birth: date | None = None


class CustomerResponse(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    customer_code: str
    created_at: datetime
    updated_at: datetime
    relations: list[CustomerRelationBrief] = []


# ==============================================================================
# Death Certificate Schemas (G08)
# ==============================================================================
class DeathCertificateBase(BaseModel):
    certificate_number: str = Field(..., min_length=2, max_length=50)
    issuing_authority: str = Field(..., min_length=2, max_length=150)
    issue_date: date
    scan_file_url: str | None = None
    file_id: str | None = None
    notes: str | None = None

    @field_validator("issue_date")
    @classmethod
    def validate_issue_date(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Ngày cấp giấy báo tử không thể ở tương lai")
        return v


class DeathCertificateCreate(DeathCertificateBase):
    pass


class DeathCertificateVerifyRequest(BaseModel):
    is_verified: bool
    rejection_reason: str | None = Field(None, max_length=255)
    notes: str | None = None


class DeathCertificateResponse(DeathCertificateBase):
    model_config = ConfigDict(from_attributes=True)

    cert_id: int
    deceased_id: int
    is_verified: bool
    verified_at: datetime | None = None
    verified_by: int | None = None
    verifier_name: str | None = None
    rejection_reason: str | None = None


# ==============================================================================
# Deceased Profile Schemas (G07)
# ==============================================================================
class DeceasedProfileBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    gender: str = Field(..., description="'MALE', 'FEMALE', 'OTHER'")
    date_of_birth: date | None = None
    date_of_death: date
    birth_year: int | None = None
    birth_date_precision: str = Field("EXACT", description="'EXACT', 'YEAR_ONLY', 'UNKNOWN'")
    hometown: str | None = Field(None, max_length=255)
    religion: str | None = Field(None, max_length=50)

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        upper = v.upper()
        if upper not in ("MALE", "FEMALE", "OTHER"):
            raise ValueError("Giới tính phải là 'MALE', 'FEMALE', hoặc 'OTHER'")
        return upper

    @field_validator("birth_date_precision")
    @classmethod
    def validate_precision(cls, v: str) -> str:
        upper = v.upper()
        if upper not in ("EXACT", "YEAR_ONLY", "UNKNOWN"):
            raise ValueError("Độ chính xác ngày sinh phải là 'EXACT', 'YEAR_ONLY', hoặc 'UNKNOWN'")
        return upper


class DeceasedProfileCreate(DeceasedProfileBase):
    deceased_code: str | None = None
    customer_id: int | None = None
    relationship_type: str | None = None
    is_primary_contact: bool = False
    death_certificate: DeathCertificateCreate | None = None

    def model_post_init(self, __context: Any) -> None:
        # G07 Invariant validation
        if self.date_of_birth and self.date_of_death:
            if self.date_of_birth > self.date_of_death:
                raise ValueError("Ngày sinh không thể sau ngày mất")
        if self.birth_year and self.date_of_death:
            if self.birth_year > self.date_of_death.year:
                raise ValueError("Năm sinh không thể lớn hơn năm mất")
        if self.birth_date_precision == "YEAR_ONLY" and not self.birth_year:
            if self.date_of_birth:
                self.birth_year = self.date_of_birth.year
            else:
                raise ValueError("Cần cung cấp năm sinh khi độ chính xác là YEAR_ONLY")


class DeceasedProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=100)
    gender: str | None = None
    date_of_birth: date | None = None
    date_of_death: date | None = None
    birth_year: int | None = None
    birth_date_precision: str | None = None
    hometown: str | None = None
    religion: str | None = None


class DeceasedProfileResponse(DeceasedProfileBase):
    model_config = ConfigDict(from_attributes=True)

    deceased_id: int
    deceased_code: str
    has_death_certificate: bool
    created_at: datetime
    updated_at: datetime
    death_certificate: DeathCertificateResponse | None = None
    relations: list[DeceasedRelationBrief] = []
    burial_slot: BurialSlotBrief | None = None


# ==============================================================================
# Public Lookup DTO (ADR-001 & G19: Zero PII Leakage)
# ==============================================================================
class DeceasedPublicLookupResponse(BaseModel):
    """
    Public lookup response: NEVER returns CCCD/citizen_id, phone, address,
    or death certificate details. Only public cemetery memorial information.
    """

    model_config = ConfigDict(from_attributes=True)

    deceased_code: str
    full_name: str
    year_of_birth: int | None = None
    date_of_death: date
    hometown: str | None = None
    zone_name: str | None = None
    row_code: str | None = None
    plot_code: str | None = None
    slot_number: int | None = None
    is_kim_tinh: bool = False


# ==============================================================================
# Customer - Deceased Relation Link
# ==============================================================================
class RelationCreate(BaseModel):
    customer_id: int
    deceased_id: int
    relationship_type: str = Field(..., min_length=1, max_length=50)
    is_primary_contact: bool = False
