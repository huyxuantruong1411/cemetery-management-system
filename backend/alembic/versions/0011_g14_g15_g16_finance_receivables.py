"""g14_g15_g16_finance_receivables

Revision ID: 0011_g14_g15_g16_finance
Revises: 0010_g12_care_schedules
Create Date: 2026-10-04 01:20:00.000000

Gaps closed:
- G14: Receivables XOR source constraint (contract vs annex),
       math invariants (final = original - discount, discount <= original),
       notes, creator, installment_no, and idempotency indexes.
- G15: Append-only payments idempotency tracking with idempotency_requests table.
- G16: Discount value expanded to DECIMAL(15,2) with percentage and fixed amount checks.
- Invoices: Linked MinIO file_id, creator user, and notes.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011_g14_g15_g16_finance"
down_revision: Union[str, None] = "0010_g12_care_schedules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Reconcile existing data for G14 XOR invariant:
    # If both contract_id and annex_id are populated, annex_id is the primary specific source.
    op.execute(
        "UPDATE receivables SET contract_id = NULL WHERE annex_id IS NOT NULL AND contract_id IS NOT NULL"
    )

    # 2. Update constraints on receivables
    # Drop legacy OR check constraint
    op.drop_constraint("CK_receivable_source", "receivables", type_="check")

    # Add XOR constraint
    op.create_check_constraint(
        "ck_receivable_source_xor",
        "receivables",
        "(contract_id IS NOT NULL AND annex_id IS NULL) OR (contract_id IS NULL AND annex_id IS NOT NULL)",
    )

    # Math integrity constraints
    op.create_check_constraint(
        "ck_rec_discount_le_original",
        "receivables",
        "discount_amount <= original_amount",
    )
    op.create_check_constraint(
        "ck_rec_final_calc",
        "receivables",
        "final_payable_amount = (original_amount - discount_amount)",
    )

    # Add columns to receivables
    op.add_column("receivables", sa.Column("notes", sa.UnicodeText(), nullable=True))
    op.add_column(
        "receivables",
        sa.Column(
            "created_by_user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True
        ),
    )
    op.add_column(
        "receivables",
        sa.Column("installment_no", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )

    # Idempotency unique filtered indexes for receivables
    op.execute(
        """
        CREATE UNIQUE NONCLUSTERED INDEX uq_receivable_contract_installment 
        ON receivables(contract_id, installment_no) 
        WHERE contract_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE NONCLUSTERED INDEX uq_receivable_annex_installment 
        ON receivables(annex_id, installment_no) 
        WHERE annex_id IS NOT NULL
        """
    )

    # 3. Expand discount_records (G16)
    op.alter_column(
        "discount_records",
        "discount_value",
        type_=sa.Numeric(15, 2),
        existing_type=sa.Numeric(10, 2),
        nullable=False,
    )
    op.create_check_constraint(
        "ck_disc_value_range",
        "discount_records",
        "(discount_type = 'PERCENTAGE' AND discount_value >= 0 AND discount_value <= 100) OR "
        "(discount_type = 'FIXED_AMOUNT' AND discount_value >= 0)",
    )

    # 4. Expand invoices
    op.add_column(
        "invoices",
        sa.Column(
            "file_id", sa.String(length=64), sa.ForeignKey("file_objects.file_id"), nullable=True
        ),
    )
    op.add_column("invoices", sa.Column("notes", sa.UnicodeText(), nullable=True))
    op.add_column(
        "invoices",
        sa.Column(
            "created_by_user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True
        ),
    )

    # 5. Create idempotency_requests table (G15)
    op.create_table(
        "idempotency_requests",
        sa.Column("request_id", sa.String(length=64), primary_key=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("operation", sa.String(length=50), nullable=False),
        sa.Column("idempotency_key", sa.String(length=100), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'IN_PROGRESS'"),
        ),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.UnicodeText(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.CheckConstraint(
            "status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')",
            name="ck_idempotency_status",
        ),
    )
    op.execute(
        """
        CREATE UNIQUE NONCLUSTERED INDEX uq_idempotency_actor_op_key 
        ON idempotency_requests(actor_user_id, operation, idempotency_key)
        """
    )


def downgrade() -> None:
    # 5. Drop idempotency_requests
    op.execute("DROP INDEX IF EXISTS uq_idempotency_actor_op_key ON idempotency_requests")
    op.drop_table("idempotency_requests")

    # 4. Invoices
    op.drop_column("invoices", "created_by_user_id")
    op.drop_column("invoices", "notes")
    op.drop_column("invoices", "file_id")

    # 3. Discount records
    op.drop_constraint("ck_disc_value_range", "discount_records", type_="check")
    op.alter_column(
        "discount_records",
        "discount_value",
        type_=sa.Numeric(10, 2),
        existing_type=sa.Numeric(15, 2),
        nullable=False,
    )

    # 2. Receivables
    op.execute("DROP INDEX IF EXISTS uq_receivable_annex_installment ON receivables")
    op.execute("DROP INDEX IF EXISTS uq_receivable_contract_installment ON receivables")
    op.drop_column("receivables", "installment_no")
    op.drop_column("receivables", "created_by_user_id")
    op.drop_column("receivables", "notes")
    op.drop_constraint("ck_rec_final_calc", "receivables", type_="check")
    op.drop_constraint("ck_rec_discount_le_original", "receivables", type_="check")
    op.drop_constraint("ck_receivable_source_xor", "receivables", type_="check")
    op.create_check_constraint(
        "CK_receivable_source",
        "receivables",
        "contract_id IS NOT NULL OR annex_id IS NOT NULL",
    )
