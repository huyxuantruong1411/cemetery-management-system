import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, ".")

from app.db.session import engine
from sqlalchemy import text

with engine.begin() as conn:
    logs = conn.execute(text("SELECT log_id, post_change_values FROM audit_logs WHERE post_change_values IS NOT NULL")).fetchall()
    for lid, pcv in logs:
        if "?" in str(pcv) or "\ufffd" in str(pcv):
            cleaned = str(pcv).replace("Khách hàng d?i ý mu?n chuy?n sang m? gia t?c", "Khách hàng đổi ý muốn chuyển sang mộ gia tộc")
            conn.execute(text("UPDATE audit_logs SET post_change_values = :val WHERE log_id = :lid"), {"val": cleaned, "lid": lid})

    # Verify again
    cols = conn.execute(text("""
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE DATA_TYPE IN ('nvarchar', 'varchar', 'text', 'ntext')
        AND TABLE_NAME NOT LIKE 'sys%' AND TABLE_NAME NOT LIKE 'alembic%'
    """)).fetchall()

    found_corrupt = 0
    for table, col in cols:
        try:
            rows = conn.execute(text(f"SELECT [{col}] FROM [{table}]")).fetchall()
            for r in rows:
                val = str(r[0])
                if "?" in val or "\ufffd" in val:
                    found_corrupt += 1
                    print(f"Remaining corrupt in [{table}].[{col}]: {val}")
        except Exception:
            pass

    print(f"Total remaining corrupt fields across DB: {found_corrupt}")
