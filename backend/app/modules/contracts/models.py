from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Unicode,
    UnicodeText,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class Contract(Base):
    __tablename__ = "contracts"

    contract_id = Column(Integer, primary_key=True, autoincrement=True)
    contract_code = Column(String(50), unique=True, nullable=False)
    contract_type = Column(
        String(30), nullable=False
    )  # LAND_PURCHASE, EXHUMATION, CREMATION, TRANSFER
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    status = Column(
        String(20), nullable=False, default="DRAFT"
    )  # DRAFT, PENDING_SIGN, ACTIVE, CANCELLED, TRANSFERRED
    total_amount = Column(Numeric(15, 2), nullable=False)
    signed_scan_url = Column(String(500), nullable=True)
    signed_scan_file_id = Column(String(64), ForeignKey("file_objects.file_id"), nullable=True)
    signed_at = Column(Date, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    activated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    activation_notes = Column(UnicodeText, nullable=True)
    template_id = Column(Integer, ForeignKey("contract_templates.template_id"), nullable=True)
    template_version = Column(Integer, nullable=True)
    notes = Column(UnicodeText, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer", back_populates="contracts")
    annexes = relationship("ContractAnnex", back_populates="contract", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by_user_id])
    activator = relationship("User", foreign_keys=[activated_by])
    template = relationship("ContractTemplate", foreign_keys=[template_id])
    scan_file = relationship("FileObject", foreign_keys=[signed_scan_file_id])
    reservation = relationship("PlotReservation", back_populates="contract", uselist=False)

    # Subtypes (TPT)
    land_purchase = relationship(
        "LandPurchaseContract",
        back_populates="contract",
        uselist=False,
        cascade="all, delete-orphan",
    )
    exhumation = relationship(
        "ExhumationContract", back_populates="contract", uselist=False, cascade="all, delete-orphan"
    )
    cremation = relationship(
        "CremationContract", back_populates="contract", uselist=False, cascade="all, delete-orphan"
    )
    transfer = relationship(
        "TransferContract", back_populates="contract", uselist=False, cascade="all, delete-orphan"
    )


class LandPurchaseContract(Base):
    __tablename__ = "land_purchase_contracts"

    contract_id = Column(
        Integer, ForeignKey("contracts.contract_id", ondelete="CASCADE"), primary_key=True
    )
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    land_unit_price = Column(Numeric(15, 2), nullable=False)

    contract = relationship("Contract", back_populates="land_purchase")


class ExhumationContract(Base):
    __tablename__ = "exhumation_contracts"

    contract_id = Column(
        Integer, ForeignKey("contracts.contract_id", ondelete="CASCADE"), primary_key=True
    )
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("plot_slots.slot_id"), nullable=True)
    current_deceased_id = Column(
        Integer, ForeignKey("deceased_profiles.deceased_id"), nullable=False
    )
    exhumation_date = Column(Date, nullable=False)
    exhumation_fee = Column(Numeric(15, 2), nullable=False)
    reason = Column(String(255), nullable=True)

    contract = relationship("Contract", back_populates="exhumation")
    plot = relationship("Plot", foreign_keys=[plot_id])
    slot = relationship("PlotSlot", foreign_keys=[slot_id])
    deceased = relationship("DeceasedProfile", foreign_keys=[current_deceased_id])


class CremationContract(Base):
    __tablename__ = "cremation_contracts"

    contract_id = Column(
        Integer, ForeignKey("contracts.contract_id", ondelete="CASCADE"), primary_key=True
    )
    deceased_id = Column(Integer, ForeignKey("deceased_profiles.deceased_id"), nullable=False)
    cremation_date = Column(Date, nullable=False)
    package_service_code = Column(String(50), nullable=False)
    urn_storage_option = Column(String(100), nullable=True)
    service_fee = Column(Numeric(15, 2), nullable=False)

    contract = relationship("Contract", back_populates="cremation")
    deceased = relationship("DeceasedProfile", foreign_keys=[deceased_id])


class TransferContract(Base):
    __tablename__ = "transfer_contracts"

    contract_id = Column(
        Integer, ForeignKey("contracts.contract_id", ondelete="CASCADE"), primary_key=True
    )
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    commission_fee = Column(Numeric(15, 2), nullable=False)
    transfer_reason = Column(Unicode(500), nullable=True)

    contract = relationship("Contract", back_populates="transfer")
    plot = relationship("Plot", foreign_keys=[plot_id])
    seller = relationship("Customer", foreign_keys=[seller_id])
    buyer = relationship("Customer", foreign_keys=[buyer_id])


class ContractAnnex(Base):
    __tablename__ = "contract_annexes"

    annex_id = Column(Integer, primary_key=True, autoincrement=True)
    annex_code = Column(String(50), unique=True, nullable=False)
    contract_id = Column(
        Integer, ForeignKey("contracts.contract_id", ondelete="CASCADE"), nullable=False
    )
    annex_type = Column(String(30), nullable=False)  # BURIAL, CARE, CONSTRUCTION
    status = Column(String(20), nullable=False, default="DRAFT")
    additional_amount = Column(Numeric(15, 2), nullable=False, default=0)
    signed_scan_url = Column(String(500), nullable=True)
    signed_scan_file_id = Column(String(64), ForeignKey("file_objects.file_id"), nullable=True)
    signed_at = Column(Date, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    activated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    activation_notes = Column(UnicodeText, nullable=True)
    notes = Column(UnicodeText, nullable=True)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    contract = relationship("Contract", back_populates="annexes")
    activator = relationship("User", foreign_keys=[activated_by])
    scan_file = relationship("FileObject", foreign_keys=[signed_scan_file_id])

    burial = relationship(
        "BurialAnnex", back_populates="annex", uselist=False, cascade="all, delete-orphan"
    )
    care = relationship(
        "CareAnnex", back_populates="annex", uselist=False, cascade="all, delete-orphan"
    )
    construction = relationship(
        "ConstructionAnnex", back_populates="annex", uselist=False, cascade="all, delete-orphan"
    )


class BurialAnnex(Base):
    __tablename__ = "burial_annexes"

    annex_id = Column(
        Integer, ForeignKey("contract_annexes.annex_id", ondelete="CASCADE"), primary_key=True
    )
    deceased_id = Column(Integer, ForeignKey("deceased_profiles.deceased_id"), nullable=False)
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("plot_slots.slot_id"), nullable=False)
    burial_date = Column(Date, nullable=False)
    is_kim_tinh = Column(Boolean, nullable=False, default=False)
    construction_notes = Column(Text, nullable=True)

    annex = relationship("ContractAnnex", back_populates="burial")
    plot = relationship("Plot", foreign_keys=[plot_id])
    slot = relationship("PlotSlot", foreign_keys=[slot_id])
    deceased = relationship("DeceasedProfile", foreign_keys=[deceased_id])


class CareAnnex(Base):
    __tablename__ = "care_annexes"

    annex_id = Column(
        Integer, ForeignKey("contract_annexes.annex_id", ondelete="CASCADE"), primary_key=True
    )
    package_id = Column(Integer, ForeignKey("care_packages.package_id"), nullable=False)
    cycle_months = Column(Integer, nullable=False)
    recurring_price = Column(Numeric(15, 2), nullable=False)

    annex = relationship("ContractAnnex", back_populates="care")


class ConstructionAnnex(Base):
    __tablename__ = "construction_annexes"

    annex_id = Column(
        Integer, ForeignKey("contract_annexes.annex_id", ondelete="CASCADE"), primary_key=True
    )
    plot_id = Column(Integer, ForeignKey("plots.plot_id"), nullable=False)
    estimated_start_date = Column(Date, nullable=False)
    estimated_end_date = Column(Date, nullable=False)
    checklist_specifications = Column(Text, nullable=True)

    annex = relationship("ContractAnnex", back_populates="construction")


class ContractTemplate(Base):
    __tablename__ = "contract_templates"

    template_id = Column(Integer, primary_key=True, autoincrement=True)
    template_code = Column(String(50), unique=True, nullable=False)
    contract_type = Column(String(30), nullable=False)
    template_name = Column(Unicode(150), nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    content_html = Column(UnicodeText, nullable=False)
    required_documents_json = Column(UnicodeText, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
