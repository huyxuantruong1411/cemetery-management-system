"""g10_g18_g20_lifecycle_annexes

Revision ID: 0008_g10_g18_g20_lifecycle
Revises: 0007_g09_contracts
Create Date: 2026-10-03 17:00:00.000000

Gaps closed:
- G10: Contract Annex workflow (BURIAL, CARE, CONSTRUCTION) with activation, signed scan file FK,
       and SQL Server sequence for annex numbering (seq_annex_number).
- G18: Plot ownership transfer contract workflow with historical chain tracking and Kim Tinh invariants.
- G20: Cremation contracts and exhumation contracts with slot-level tracking.
- BurialHistories evidence linkage to MinIO file_objects and performed_by user.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008_g10_g18_g20_lifecycle"
down_revision: Union[str, None] = "0007_g09_contracts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create SQL Server sequence for transaction-safe contract annex numbering
    op.execute(
        """
        IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'seq_annex_number')
        BEGIN
            CREATE SEQUENCE seq_annex_number START WITH 1001 INCREMENT BY 1;
        END
        """
    )

    # 2. Add G10 workflow columns to contract_annexes
    op.add_column(
        "contract_annexes", sa.Column("signed_scan_file_id", sa.String(length=64), nullable=True)
    )
    op.add_column("contract_annexes", sa.Column("signed_at", sa.Date(), nullable=True))
    op.add_column("contract_annexes", sa.Column("activated_at", sa.DateTime(), nullable=True))
    op.add_column("contract_annexes", sa.Column("activated_by", sa.Integer(), nullable=True))
    op.add_column(
        "contract_annexes", sa.Column("activation_notes", sa.UnicodeText(), nullable=True)
    )
    op.add_column("contract_annexes", sa.Column("notes", sa.UnicodeText(), nullable=True))

    op.create_foreign_key(
        "FK_contract_annexes_scan_file",
        "contract_annexes",
        "file_objects",
        ["signed_scan_file_id"],
        ["file_id"],
    )
    op.create_foreign_key(
        "FK_contract_annexes_activated_by",
        "contract_annexes",
        "users",
        ["activated_by"],
        ["user_id"],
    )

    # 3. Add evidence and operator columns to burial_histories
    op.add_column(
        "burial_histories", sa.Column("proof_file_id", sa.String(length=64), nullable=True)
    )
    op.add_column("burial_histories", sa.Column("performed_by", sa.Integer(), nullable=True))

    op.create_foreign_key(
        "FK_burial_histories_proof_file",
        "burial_histories",
        "file_objects",
        ["proof_file_id"],
        ["file_id"],
    )
    op.create_foreign_key(
        "FK_burial_histories_performed_by",
        "burial_histories",
        "users",
        ["performed_by"],
        ["user_id"],
    )

    # 4. Add slot_id to exhumation_contracts
    op.add_column("exhumation_contracts", sa.Column("slot_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "FK_exhumation_contracts_slot",
        "exhumation_contracts",
        "plot_slots",
        ["slot_id"],
        ["slot_id"],
    )

    # 5. Add transfer_reason to transfer_contracts
    op.add_column(
        "transfer_contracts", sa.Column("transfer_reason", sa.Unicode(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("transfer_contracts", "transfer_reason")

    op.drop_constraint("FK_exhumation_contracts_slot", "exhumation_contracts", type_="foreignkey")
    op.drop_column("exhumation_contracts", "slot_id")

    op.drop_constraint("FK_burial_histories_performed_by", "burial_histories", type_="foreignkey")
    op.drop_constraint("FK_burial_histories_proof_file", "burial_histories", type_="foreignkey")
    op.drop_column("burial_histories", "performed_by")
    op.drop_column("burial_histories", "proof_file_id")

    op.drop_constraint("FK_contract_annexes_activated_by", "contract_annexes", type_="foreignkey")
    op.drop_constraint("FK_contract_annexes_scan_file", "contract_annexes", type_="foreignkey")
    op.drop_column("contract_annexes", "notes")
    op.drop_column("contract_annexes", "activation_notes")
    op.drop_column("contract_annexes", "activated_by")
    op.drop_column("contract_annexes", "activated_at")
    op.drop_column("contract_annexes", "signed_at")
    op.drop_column("contract_annexes", "signed_scan_file_id")

    op.execute(
        """
        IF EXISTS (SELECT * FROM sys.sequences WHERE name = 'seq_annex_number')
        BEGIN
            DROP SEQUENCE seq_annex_number;
        END
        """
    )
