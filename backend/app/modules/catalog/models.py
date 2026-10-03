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
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class PriceList(Base):
    __tablename__ = "price_lists"

    price_list_id = Column(Integer, primary_key=True, autoincrement=True)
    price_list_name = Column(String(100), nullable=False)
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
    item_name = Column(String(150), nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=False)
    unit = Column(String(30), nullable=False)

    price_list = relationship("PriceList", back_populates="items")
