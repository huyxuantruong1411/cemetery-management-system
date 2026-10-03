"""g11_g13_construction_evidence_scheduling

Revision ID: 0009_g11_g13_construction
Revises: 0008_g10_g18_g20_lifecycle
Create Date: 2026-10-03 18:00:00.000000

Gaps closed:
- G11: Construction tasks with is_required flag, sort_order, internal assignee,
       due dates, and multi-photo evidence table (construction_task_evidences).
- G13: Staff unavailability tracking table (staff_unavailability) for conflict warnings.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009_g11_g13_construction"
down_revision: Union[str, None] = "0008_g10_g18_g20_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add G11 columns to construction_tasks
    op.add_column(
        "construction_tasks",
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "construction_tasks",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "construction_tasks",
        sa.Column("assignee_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "construction_tasks",
        sa.Column("start_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "construction_tasks",
        sa.Column("due_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "construction_tasks",
        sa.Column("completed_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "FK_construction_tasks_assignee",
        "construction_tasks",
        "users",
        ["assignee_user_id"],
        ["user_id"],
    )
    op.create_foreign_key(
        "FK_construction_tasks_completed_by",
        "construction_tasks",
        "users",
        ["completed_by"],
        ["user_id"],
    )

    # 2. Add notes column to construction_orders
    op.add_column(
        "construction_orders",
        sa.Column("notes", sa.UnicodeText(), nullable=True),
    )

    # 3. Create construction_task_evidences (G11)
    op.create_table(
        "construction_task_evidences",
        sa.Column("evidence_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("construction_tasks.task_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "file_id",
            sa.String(length=64),
            sa.ForeignKey("file_objects.file_id"),
            nullable=False,
        ),
        sa.Column("caption", sa.Unicode(length=255), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("GETDATE()"),
        ),
        sa.Column(
            "uploaded_by",
            sa.Integer(),
            sa.ForeignKey("users.user_id"),
            nullable=False,
        ),
    )

    # 4. Create staff_unavailability (G13)
    op.create_table(
        "staff_unavailability",
        sa.Column("unavailability_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Unicode(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("GETDATE()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("staff_unavailability")
    op.drop_table("construction_task_evidences")

    op.drop_column("construction_orders", "notes")

    op.drop_constraint(
        "FK_construction_tasks_completed_by", "construction_tasks", type_="foreignkey"
    )
    op.drop_constraint("FK_construction_tasks_assignee", "construction_tasks", type_="foreignkey")
    op.drop_column("construction_tasks", "completed_by")
    op.drop_column("construction_tasks", "due_date")
    op.drop_column("construction_tasks", "start_date")
    op.drop_column("construction_tasks", "assignee_user_id")
    op.drop_column("construction_tasks", "sort_order")
    op.drop_column("construction_tasks", "is_required")
