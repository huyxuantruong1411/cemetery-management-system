"""baseline_37_tables

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-03 12:05:00.000000

Baseline migration representing the existing 37 tables and 2 triggers
in database QL_NghiaTrang as introspected in docs/db-baseline.json.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline tables already exist in SQL Server.
    # No DDL executed for baseline stamp.
    pass


def downgrade() -> None:
    pass
