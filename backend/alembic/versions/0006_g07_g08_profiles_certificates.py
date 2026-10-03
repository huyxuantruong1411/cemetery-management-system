"""g07_g08_profiles_certificates

Revision ID: 0006_g07_g08_profiles
Revises: 0005_g04_g05_g06_plots
Create Date: 2026-10-03 15:35:00.000000

Gaps closed:
- G07: Add date_of_birth to customers; add birth_year and birth_date_precision to deceased_profiles
- G08: Update death_certificates default verification from 1 to 0, add verified_by FK, rejection_reason, file_id FK
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_g07_g08_profiles"
down_revision: Union[str, None] = "0005_g04_g05_g06_plots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. G07: Add date_of_birth to customers
    op.add_column("customers", sa.Column("date_of_birth", sa.Date(), nullable=True))

    # 2. G07: Add birth_year and birth_date_precision to deceased_profiles
    op.add_column("deceased_profiles", sa.Column("birth_year", sa.Integer(), nullable=True))
    op.add_column(
        "deceased_profiles",
        sa.Column(
            "birth_date_precision",
            sa.String(20),
            nullable=False,
            server_default="EXACT",
        ),
    )
    op.create_check_constraint(
        "CK_deceased_birth_precision",
        "deceased_profiles",
        "birth_date_precision IN ('EXACT', 'YEAR_ONLY', 'UNKNOWN')",
    )

    # 3. G08: Modify death_certificates
    # Make scan_file_url nullable
    op.alter_column(
        "death_certificates",
        "scan_file_url",
        existing_type=sa.String(500),
        nullable=True,
    )

    # Add verified_by (FK to users)
    op.add_column(
        "death_certificates",
        sa.Column("verified_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "FK_death_cert_verified_by",
        "death_certificates",
        "users",
        ["verified_by"],
        ["user_id"],
        ondelete="SET NULL",
    )

    # Add rejection_reason
    op.add_column(
        "death_certificates",
        sa.Column("rejection_reason", sa.Unicode(255), nullable=True),
    )

    # Add file_id (FK to file_objects)
    op.add_column(
        "death_certificates",
        sa.Column("file_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "FK_death_cert_file_id",
        "death_certificates",
        "file_objects",
        ["file_id"],
        ["file_id"],
        ondelete="SET NULL",
    )

    # Add notes
    op.add_column(
        "death_certificates",
        sa.Column("notes", sa.UnicodeText(), nullable=True),
    )

    # Alter verified_at to nullable and drop default constraint
    op.execute("""
        IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_death_cert_verified_at')
        BEGIN
            ALTER TABLE death_certificates DROP CONSTRAINT DF_death_cert_verified_at;
        END
    """)
    op.alter_column(
        "death_certificates",
        "verified_at",
        existing_type=sa.DateTime(),
        nullable=True,
    )

    # Alter is_verified default to 0
    op.execute("""
        IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_death_cert_verified')
        BEGIN
            ALTER TABLE death_certificates DROP CONSTRAINT DF_death_cert_verified;
        END
        ALTER TABLE death_certificates ADD CONSTRAINT DF_death_cert_verified DEFAULT 0 FOR is_verified;
    """)


def downgrade() -> None:
    # Downgrade death_certificates
    op.drop_constraint("FK_death_cert_file_id", "death_certificates", type_="foreignkey")
    op.drop_column("death_certificates", "file_id")
    op.drop_constraint("FK_death_cert_verified_by", "death_certificates", type_="foreignkey")
    op.drop_column("death_certificates", "verified_by")
    op.drop_column("death_certificates", "rejection_reason")
    op.drop_column("death_certificates", "notes")

    # Restore is_verified default to 1
    op.execute("""
        IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_death_cert_verified')
        BEGIN
            ALTER TABLE death_certificates DROP CONSTRAINT DF_death_cert_verified;
        END
        ALTER TABLE death_certificates ADD CONSTRAINT DF_death_cert_verified DEFAULT 1 FOR is_verified;
    """)

    # Downgrade deceased_profiles
    op.drop_constraint("CK_deceased_birth_precision", "deceased_profiles", type_="check")
    op.drop_column("deceased_profiles", "birth_date_precision")
    op.drop_column("deceased_profiles", "birth_year")

    # Downgrade customers
    op.drop_column("customers", "date_of_birth")
