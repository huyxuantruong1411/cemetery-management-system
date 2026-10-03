"""g04_g05_g06_plots_reservations_ownerships

Revision ID: 0005_g04_g05_g06_plots
Revises: 0004_g03_catalog
Create Date: 2026-10-03 14:15:00.000000

Gaps closed:
- G04: Anti-double booking with plot_reservations and filtered unique index on ACTIVE state
- G05: Ownership chain preservation with plot_ownerships
- G06: Filtered unique index on plot_slots(current_deceased_id) to prevent duplicate burial
- Plot metadata additions: orientation, notes
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_g04_g05_g06_plots"
down_revision: Union[str, None] = "0004_g03_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add metadata columns to plots
    op.add_column("plots", sa.Column("orientation", sa.Unicode(50), nullable=True))
    op.add_column("plots", sa.Column("notes", sa.UnicodeText(), nullable=True))

    # 2. Table plot_reservations (G04: Anti-double booking)
    op.create_table(
        "plot_reservations",
        sa.Column("reservation_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plot_id", sa.Integer(), nullable=False),
        sa.Column("reserved_by", sa.Integer(), nullable=False),
        sa.Column("customer_name", sa.Unicode(100), nullable=True),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("state", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("reserved_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("notes", sa.Unicode(500), nullable=True),
        sa.ForeignKeyConstraint(["plot_id"], ["plots.plot_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reserved_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("reservation_id"),
        sa.CheckConstraint(
            "state IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED')",
            name="CK_plot_reservations_state",
        ),
    )

    # Filtered unique index: Only 1 ACTIVE reservation per plot
    op.execute(
        "CREATE UNIQUE INDEX UQ_plot_reservations_active ON plot_reservations(plot_id) WHERE state = 'ACTIVE'"
    )

    # 3. Table plot_ownerships (G05: Chain of ownership history)
    op.create_table(
        "plot_ownerships",
        sa.Column("ownership_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plot_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("basis_contract_id", sa.Integer(), nullable=True),
        sa.Column("valid_from", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.Column("valid_to", sa.DateTime(), nullable=True),
        sa.Column("transfer_reason", sa.Unicode(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.ForeignKeyConstraint(["plot_id"], ["plots.plot_id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.customer_id"]),
        sa.ForeignKeyConstraint(["basis_contract_id"], ["contracts.contract_id"]),
        sa.PrimaryKeyConstraint("ownership_id"),
    )

    # 4. G06: Filtered unique index on plot_slots(current_deceased_id)
    op.execute(
        "CREATE UNIQUE INDEX UQ_plot_slots_deceased ON plot_slots(current_deceased_id) WHERE current_deceased_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS UQ_plot_slots_deceased ON plot_slots")
    op.drop_table("plot_ownerships")
    op.execute("DROP INDEX IF EXISTS UQ_plot_reservations_active ON plot_reservations")
    op.drop_table("plot_reservations")
    op.drop_column("plots", "notes")
    op.drop_column("plots", "orientation")
