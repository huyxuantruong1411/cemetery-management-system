"""g03_catalog_pricing_templates

Revision ID: 0004_g03_catalog
Revises: 0003_g02_g17
Create Date: 2026-10-03 14:00:00.000000

Implements:
- G03: Contract templates with versioning, required documents, and standard contract types.
- G03: Price items scope mapping (zone_id, plot_type_id, package_id, service_code) and non-retroactive snapshotting.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_g03_catalog"
down_revision: Union[str, None] = "0003_g02_g17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. contract_templates table
    op.create_table(
        "contract_templates",
        sa.Column("template_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("template_code", sa.String(length=50), nullable=False),
        sa.Column("contract_type", sa.String(length=30), nullable=False),
        sa.Column("template_name", sa.Unicode(length=150), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("content_html", sa.UnicodeText(), nullable=False),
        sa.Column("required_documents_json", sa.UnicodeText(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.UniqueConstraint("template_code", name="uq_contract_templates_code"),
        sa.CheckConstraint(
            "contract_type IN ('LAND_PURCHASE', 'EXHUMATION', 'CREMATION', 'TRANSFER', 'CARE_ANNEX')",
            name="chk_contract_templates_type",
        ),
    )

    # 2. Add scope columns to price_items
    op.add_column("price_items", sa.Column("zone_id", sa.Integer(), nullable=True))
    op.add_column("price_items", sa.Column("plot_type_id", sa.Integer(), nullable=True))
    op.add_column("price_items", sa.Column("package_id", sa.Integer(), nullable=True))
    op.add_column("price_items", sa.Column("service_code", sa.String(length=50), nullable=True))

    op.create_foreign_key(
        "fk_price_items_zone",
        "price_items",
        "zones",
        ["zone_id"],
        ["zone_id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_price_items_plot_type",
        "price_items",
        "plot_types",
        ["plot_type_id"],
        ["type_id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_price_items_package",
        "price_items",
        "care_packages",
        ["package_id"],
        ["package_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # 1. Drop foreign keys and columns on price_items
    op.drop_constraint("fk_price_items_package", "price_items", type_="foreignkey")
    op.drop_constraint("fk_price_items_plot_type", "price_items", type_="foreignkey")
    op.drop_constraint("fk_price_items_zone", "price_items", type_="foreignkey")

    op.drop_column("price_items", "service_code")
    op.drop_column("price_items", "package_id")
    op.drop_column("price_items", "plot_type_id")
    op.drop_column("price_items", "zone_id")

    # 2. Drop contract_templates
    op.drop_table("contract_templates")
