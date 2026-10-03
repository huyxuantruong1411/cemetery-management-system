"""g17_report_exports

Revision ID: 0012_g17_report_exports
Revises: 0011_g14_g15_g16_finance
Create Date: 2026-10-04 02:00:00.000000

Gaps closed:
- G17 / M12: Report exports table with requester ACL, filter snapshot,
             MinIO file FK, status, format, and expiration.
- Sequence seq_report_export_number for export codes EXP-YYYYMM-NNNN.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.schema import CreateSequence, DropSequence
from sqlalchemy.schema import Sequence as DbSequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012_g17_report_exports"
down_revision: Union[str, None] = "0011_g14_g15_g16_finance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Sequence for Export Code
    export_seq = DbSequence("seq_report_export_number", start=1001, increment=1)
    try:
        op.execute(CreateSequence(export_seq))
    except Exception:
        pass

    # 2. Create report_exports table
    op.create_table(
        "report_exports",
        sa.Column("export_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("export_code", sa.String(length=50), nullable=False),
        sa.Column("report_type", sa.String(length=50), nullable=False),
        sa.Column("export_format", sa.String(length=10), nullable=False),
        sa.Column("filter_snapshot", sa.Text(), nullable=True),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("record_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("export_id", name="pk_report_exports"),
        sa.ForeignKeyConstraint(
            ["requester_id"],
            ["users.user_id"],
            name="fk_report_exports_requester",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["file_objects.file_id"],
            name="fk_report_exports_file",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("export_code", name="uq_report_exports_code"),
        sa.CheckConstraint(
            "report_type IN ('REVENUE', 'OCCUPANCY', 'CONTRACTS', 'OPERATIONS')",
            name="ck_report_exports_type",
        ),
        sa.CheckConstraint(
            "export_format IN ('PDF', 'XLSX')",
            name="ck_report_exports_format",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'COMPLETED', 'FAILED')",
            name="ck_report_exports_status",
        ),
    )

    op.create_index(
        "ix_report_exports_requester",
        "report_exports",
        ["requester_id", "created_at"],
    )
    op.create_index(
        "ix_report_exports_status",
        "report_exports",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_report_exports_status", table_name="report_exports")
    op.drop_index("ix_report_exports_requester", table_name="report_exports")
    op.drop_table("report_exports")

    export_seq = DbSequence("seq_report_export_number")
    try:
        op.execute(DropSequence(export_seq))
    except Exception:
        pass
