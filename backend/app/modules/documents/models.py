from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class FileObject(Base):
    __tablename__ = "file_objects"

    file_id = Column(String(64), primary_key=True)
    bucket_name = Column(String(100), nullable=False)
    object_key = Column(String(255), unique=True, nullable=False)
    version_id = Column(String(100), nullable=True)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    state = Column(
        String(20), nullable=False, default="STAGING"
    )  # STAGING, READY, QUARANTINED, DELETED
    uploaded_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    uploaded_by = relationship("User")
    documents = relationship("DocumentVersion", back_populates="file", cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    document_id = Column(Integer, primary_key=True, autoincrement=True)
    document_type = Column(
        String(50), nullable=False
    )  # SIGNED_CONTRACT, SIGNED_ANNEX, DEATH_CERTIFICATE, etc.
    contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=True)
    annex_id = Column(Integer, ForeignKey("contract_annexes.annex_id"), nullable=True)
    certificate_id = Column(Integer, ForeignKey("death_certificates.cert_id"), nullable=True)
    version_no = Column(Integer, nullable=False, default=1)
    file_id = Column(String(64), ForeignKey("file_objects.file_id"), nullable=False)
    notes = Column(String(255), nullable=True)
    verified_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    file = relationship("FileObject", back_populates="documents")
    contract = relationship("Contract")
    annex = relationship("ContractAnnex")
    certificate = relationship("DeathCertificate")
    verified_by = relationship("User")
