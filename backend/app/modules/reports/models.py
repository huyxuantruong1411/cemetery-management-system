from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ReportExport(Base):
    """Bảng quản lý các yêu cầu xuất báo cáo bền vững (G17 / M12)."""

    __tablename__ = "report_exports"

    export_id = Column(BigInteger, primary_key=True, autoincrement=True)
    export_code = Column(String(50), nullable=False, unique=True)
    report_type = Column(String(50), nullable=False)  # REVENUE, OCCUPANCY, CONTRACTS, OPERATIONS
    export_format = Column(String(10), nullable=False)  # PDF, XLSX
    filter_snapshot = Column(Text, nullable=True)  # JSON serialized filter parameters
    requester_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    file_id = Column(
        String(64), ForeignKey("file_objects.file_id", ondelete="SET NULL"), nullable=True
    )
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING, COMPLETED, FAILED
    record_count = Column(Integer, nullable=False, default=0)
    file_size_bytes = Column(BigInteger, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)

    # Relationships
    requester = relationship("User", foreign_keys=[requester_id])
    file = relationship("FileObject", foreign_keys=[file_id])
