"""fix_kim_tinh_plot_types_and_unoccupied_flags

Revision ID: 0013_fix_kim_tinh_data
Revises: 0012_g17_report_exports
Create Date: 2026-10-20 00:10:00.000000

Business Invariant Fix:
- Raw cemetery plots and catalog types do NOT have the concept of Kim Tinh before transaction/burial.
- Rename plot type 'Mộ Đôi Kim Tĩnh' -> 'Mộ Đôi Tiêu Chuẩn'.
- Rename zone 'Khu An Viên (Kim Tĩnh Cao Cấp)' -> 'Khu An Viên (Đồi Phong Thủy)'.
- Reset is_kim_tinh = 0 and is_locked = 0 for all unburied plots (status != 'OCCUPIED').
- Kim Tinh is only permanently bound when burial annex is completed/confirmed.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0013_fix_kim_tinh_data"
down_revision: Union[str, None] = "0012_g17_report_exports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update plot types: Rename 'Mộ Đôi Kim Tĩnh' -> 'Mộ Đôi Tiêu Chuẩn'
    op.execute(
        sa.text(
            "UPDATE plot_types "
            "SET type_name = N'Mộ Đôi Tiêu Chuẩn', "
            "    description = N'Huyệt mộ đôi tiêu chuẩn kích thước 3.0m x 2.4m, quy cách 2 vị trí an táng' "
            "WHERE type_name LIKE N'%Kim Tĩnh%' OR type_name LIKE N'%Kim Tinh%'"
        )
    )

    # 2. Update zones: Rename 'Khu An Viên (Kim Tĩnh Cao Cấp)' -> 'Khu An Viên (Đồi Phong Thủy)'
    op.execute(
        sa.text(
            "UPDATE zones "
            "SET zone_name = N'Khu An Viên (Đồi Phong Thủy)', "
            "    description = N'Khu vực đồi thoải nhìn ra hồ phong thủy, cảnh quan tôn nghiêm' "
            "WHERE zone_name LIKE N'%Kim Tĩnh%' OR zone_name LIKE N'%Kim Tinh%'"
        )
    )

    # 3. Reset is_kim_tinh = 0 and is_locked = 0 for any plots that are NOT OCCUPIED.
    # We disable the trigger temporarily during migration to safely clean up test/seed fixtures.
    op.execute(sa.text("DISABLE TRIGGER trg_plots_enforce_kim_tinh_immutability ON plots;"))
    op.execute(
        sa.text(
            "UPDATE plots "
            "SET is_kim_tinh = 0, is_locked = 0 "
            "WHERE status != 'OCCUPIED' AND (is_kim_tinh = 1 OR is_locked = 1);"
        )
    )
    op.execute(sa.text("ENABLE TRIGGER trg_plots_enforce_kim_tinh_immutability ON plots;"))


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE plot_types "
            "SET type_name = N'Mộ Đôi Kim Tĩnh', "
            "    description = N'Huyệt mộ đôi kết cấu bê tông cốt thép Kim Tĩnh kiên cố vĩnh cửu' "
            "WHERE type_id = 19"
        )
    )
    op.execute(
        sa.text(
            "UPDATE zones "
            "SET zone_name = N'Khu An Viên (Kim Tĩnh Cao Cấp)', "
            "    description = N'Khu vực đồi thoải nhìn ra hồ phong thủy, kết cấu nền móng Kim Tĩnh' "
            "WHERE zone_id = 19"
        )
    )
