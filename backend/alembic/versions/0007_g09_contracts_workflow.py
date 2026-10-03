"""g09_contracts_workflow

Revision ID: 0007_g09_contracts
Revises: 0006_g07_g08_profiles
Create Date: 2026-10-03 16:00:00.000000

Gaps closed:
- G09: Contract signing date, activation timestamp, template version, signed scan file FK,
       and SQL Server sequence for contract numbering.
- Contract-Reservation linkage via plot_reservations.contract_id.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_g09_contracts"
down_revision: Union[str, None] = "0006_g07_g08_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create SQL Server sequence for transaction-safe contract code generation
    op.execute(
        """
        IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'seq_contract_number')
        BEGIN
            CREATE SEQUENCE seq_contract_number START WITH 1001 INCREMENT BY 1;
        END
        """
    )

    # 2. Add G09 columns to contracts table
    op.add_column("contracts", sa.Column("signed_at", sa.Date(), nullable=True))
    op.add_column("contracts", sa.Column("activated_at", sa.DateTime(), nullable=True))
    op.add_column("contracts", sa.Column("activated_by", sa.Integer(), nullable=True))
    op.add_column("contracts", sa.Column("activation_notes", sa.UnicodeText(), nullable=True))
    op.add_column("contracts", sa.Column("template_id", sa.Integer(), nullable=True))
    op.add_column("contracts", sa.Column("template_version", sa.Integer(), nullable=True))
    op.add_column(
        "contracts", sa.Column("signed_scan_file_id", sa.String(length=64), nullable=True)
    )
    op.add_column("contracts", sa.Column("notes", sa.UnicodeText(), nullable=True))

    # Add foreign keys for contracts
    op.create_foreign_key(
        "FK_contracts_activated_by_users",
        "contracts",
        "users",
        ["activated_by"],
        ["user_id"],
    )
    op.create_foreign_key(
        "FK_contracts_template_id_templates",
        "contracts",
        "contract_templates",
        ["template_id"],
        ["template_id"],
    )
    op.create_foreign_key(
        "FK_contracts_scan_file_id_files",
        "contracts",
        "file_objects",
        ["signed_scan_file_id"],
        ["file_id"],
    )

    # 3. Add contract_id FK to plot_reservations
    op.add_column("plot_reservations", sa.Column("contract_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "FK_plot_reservations_contracts",
        "plot_reservations",
        "contracts",
        ["contract_id"],
        ["contract_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Drop FK and column from plot_reservations
    op.drop_constraint("FK_plot_reservations_contracts", "plot_reservations", type_="foreignkey")
    op.drop_column("plot_reservations", "contract_id")

    # Drop FKs and columns from contracts
    op.drop_constraint("FK_contracts_scan_file_id_files", "contracts", type_="foreignkey")
    op.drop_constraint("FK_contracts_template_id_templates", "contracts", type_="foreignkey")
    op.drop_constraint("FK_contracts_activated_by_users", "contracts", type_="foreignkey")

    op.drop_column("contracts", "notes")
    op.drop_column("contracts", "signed_scan_file_id")
    op.drop_column("contracts", "template_version")
    op.drop_column("contracts", "template_id")
    op.drop_column("contracts", "activation_notes")
    op.drop_column("contracts", "activated_by")
    op.drop_column("contracts", "activated_at")
    op.drop_column("contracts", "signed_at")

    # Drop sequence
    op.execute(
        """
        IF EXISTS (SELECT * FROM sys.sequences WHERE name = 'seq_contract_number')
        BEGIN
            DROP SEQUENCE seq_contract_number;
        END
        """
    )
