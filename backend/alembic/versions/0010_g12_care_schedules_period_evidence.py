"""g12_care_schedules_period_evidence

Revision ID: 0010_g12_care_schedules
Revises: 0009_g11_g13_construction
Create Date: 2026-10-04 01:00:00.000000

Gaps closed:
- G12: Recurring care schedules generation idempotency (period_key),
       checklist required tasks flag, sort_order, photo evidence file_id link,
       and completion tracking.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010_g12_care_schedules"
down_revision: Union[str, None] = "0009_g11_g13_construction"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Expand care_schedules
    op.add_column(
        "care_schedules",
        sa.Column("period_key", sa.String(50), nullable=True),
    )
    op.add_column(
        "care_schedules",
        sa.Column("notes", sa.UnicodeText(), nullable=True),
    )
    op.add_column(
        "care_schedules",
        sa.Column("completed_by_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
    )

    # Unique constraint on (care_annex_id, period_key) for generator idempotency
    op.create_unique_constraint(
        "uq_care_schedule_annex_period",
        "care_schedules",
        ["care_annex_id", "period_key"],
    )

    # 2. Expand care_checklist_items
    op.add_column(
        "care_checklist_items",
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "care_checklist_items",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    # 3. Expand care_media_evidences
    op.add_column(
        "care_media_evidences",
        sa.Column(
            "file_id", sa.String(length=64), sa.ForeignKey("file_objects.file_id"), nullable=True
        ),
    )
    op.add_column(
        "care_media_evidences",
        sa.Column(
            "uploaded_by_user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True
        ),
    )


def downgrade() -> None:
    # Downgrade care_media_evidences
    op.drop_column("care_media_evidences", "uploaded_by_user_id")
    op.drop_column("care_media_evidences", "file_id")

    # Downgrade care_checklist_items
    op.drop_column("care_checklist_items", "sort_order")
    op.drop_column("care_checklist_items", "is_required")

    # Downgrade care_schedules
    op.drop_constraint("uq_care_schedule_annex_period", "care_schedules", type_="unique")
    op.drop_column("care_schedules", "completed_by_id")
    op.drop_column("care_schedules", "notes")
    op.drop_column("care_schedules", "period_key")
