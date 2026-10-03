from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Unicode,
    UnicodeText,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, autoincrement=True)
    customer_code = Column(String(50), unique=True, nullable=False)
    full_name = Column(Unicode(100), nullable=False)
    citizen_id = Column(String(20), unique=True, nullable=False)
    phone_number = Column(String(20), nullable=False)
    email = Column(String(100), nullable=True)
    address = Column(Unicode(255), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    relations = relationship("CustomerDeceasedRelation", back_populates="customer", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="customer")


class DeceasedProfile(Base):
    __tablename__ = "deceased_profiles"

    deceased_id = Column(Integer, primary_key=True, autoincrement=True)
    deceased_code = Column(String(50), unique=True, nullable=False)
    full_name = Column(Unicode(100), nullable=False)
    gender = Column(String(10), nullable=False)  # 'MALE', 'FEMALE', 'OTHER'
    date_of_birth = Column(Date, nullable=True)
    date_of_death = Column(Date, nullable=False)
    birth_year = Column(Integer, nullable=True)
    birth_date_precision = Column(String(20), nullable=False, default="EXACT")  # 'EXACT', 'YEAR_ONLY', 'UNKNOWN'
    hometown = Column(Unicode(255), nullable=True)
    religion = Column(Unicode(50), nullable=True)
    has_death_certificate = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    death_certificate = relationship("DeathCertificate", back_populates="deceased", uselist=False, cascade="all, delete-orphan")
    relations = relationship("CustomerDeceasedRelation", back_populates="deceased", cascade="all, delete-orphan")
    current_slot = relationship(
        "PlotSlot",
        primaryjoin="DeceasedProfile.deceased_id == foreign(PlotSlot.current_deceased_id)",
        uselist=False,
    )


class DeathCertificate(Base):
    __tablename__ = "death_certificates"

    cert_id = Column(Integer, primary_key=True, autoincrement=True)
    deceased_id = Column(
        Integer,
        ForeignKey("deceased_profiles.deceased_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    certificate_number = Column(Unicode(50), nullable=False)
    issuing_authority = Column(Unicode(150), nullable=False)
    issue_date = Column(Date, nullable=False)
    scan_file_url = Column(String(500), nullable=True)
    file_id = Column(String(64), ForeignKey("file_objects.file_id", ondelete="SET NULL"), nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    rejection_reason = Column(Unicode(255), nullable=True)
    notes = Column(UnicodeText, nullable=True)

    deceased = relationship("DeceasedProfile", back_populates="death_certificate")
    verifier = relationship("User", foreign_keys=[verified_by])
    file_object = relationship("FileObject", foreign_keys=[file_id])


class CustomerDeceasedRelation(Base):
    __tablename__ = "customer_deceased_relations"

    relation_id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(
        Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False
    )
    deceased_id = Column(
        Integer, ForeignKey("deceased_profiles.deceased_id", ondelete="CASCADE"), nullable=False
    )
    relationship_type = Column(Unicode(50), nullable=False)
    is_primary_contact = Column(Boolean, nullable=False, default=False)

    customer = relationship("Customer", back_populates="relations")
    deceased = relationship("DeceasedProfile", back_populates="relations")
