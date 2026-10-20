"""add_care_checklist_is_custom

Revision ID: 0014_care_checklist_custom
Revises: 0013_fix_kim_tinh_data
Create Date: 2026-10-20 21:30:00.000000

Business Requirements:
- Quản trang có chức năng tạo checklist phát sinh ngoài thực địa (is_custom = True).
- Chặn tuyệt đối hành vi xóa checklist tiêu chuẩn đổ từ phụ lục hợp đồng khách hàng (is_custom = False).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014_care_checklist_custom"
down_revision: Union[str, None] = "0013_fix_kim_tinh_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Thêm cột is_custom vào care_checklist_items, mặc định là False (0) cho các bản ghi hiện có
    op.add_column(
        "care_checklist_items",
        sa.Column(
            "is_custom",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("care_checklist_items", "is_custom")
