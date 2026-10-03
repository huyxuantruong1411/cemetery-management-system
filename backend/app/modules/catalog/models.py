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
    Unicode,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class PriceList(Base):
    __tablename__ = "price_lists"

    price_list_id = Column(Integer, primary_key=True, autoincrement=True)
    price_list_name = Column(Unicode(200), nullable=False)
    effective_from_date = Column(Date, nullable=False)
    effective_to_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    items = relationship("PriceItem", back_populates="price_list", cascade="all, delete-orphan")


class PriceItem(Base):
    __tablename__ = "price_items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    price_list_id = Column(
        Integer, ForeignKey("price_lists.price_list_id", ondelete="CASCADE"), nullable=False
    )
    item_code = Column(String(50), nullable=False)
    item_name = Column(Unicode(300), nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=False)
    unit = Column(Unicode(60), nullable=False)

    # G03 Scope fields
    zone_id = Column(Integer, ForeignKey("zones.zone_id", ondelete="SET NULL"), nullable=True)
    plot_type_id = Column(Integer, ForeignKey("plot_types.type_id", ondelete="SET NULL"), nullable=True)
    package_id = Column(Integer, ForeignKey("care_packages.package_id", ondelete="SET NULL"), nullable=True)
    service_code = Column(String(50), nullable=True)

    price_list = relationship("PriceList", back_populates="items")
    zone = relationship("Zone")
    plot_type = relationship("PlotType")
    package = relationship("CarePackage")
