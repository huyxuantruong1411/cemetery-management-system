import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, ".")
from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    tables = conn.execute(text("""
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE DATA_TYPE IN ('nvarchar', 'varchar', 'text', 'ntext')
        AND TABLE_NAME NOT LIKE 'sys%' AND TABLE_NAME NOT LIKE 'alembic%'
    """)).fetchall()
    for t, c in tables:
        try:
            res = conn.execute(text(f"SELECT COUNT(*) FROM [{t}] WHERE [{c}] LIKE '%[?]%' OR [{c}] LIKE '%Ð%' OR [{c}] LIKE '%Co B?n%'")).scalar()
            if res and res > 0:
                print(f"Table [{t}].[{c}] has {res} corrupted rows")
                samples = conn.execute(text(f"SELECT TOP 3 [{c}] FROM [{t}] WHERE [{c}] LIKE '%[?]%' OR [{c}] LIKE '%Ð%' OR [{c}] LIKE '%Co B?n%'")).fetchall()
                for s in samples:
                    print(f"   -> {s[0]}")
        except Exception as e:
            pass
