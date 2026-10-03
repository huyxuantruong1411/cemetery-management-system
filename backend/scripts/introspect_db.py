import json
import os
import pyodbc

DB_SERVER = os.getenv("DB_SERVER", "DESKTOP-HKIPI1M")
DB_NAME = os.getenv("DB_NAME", "QL_NghiaTrang")
ODBC_CONN_STR = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={DB_SERVER};DATABASE={DB_NAME};"
    f"Trusted_Connection=yes;TrustServerCertificate=yes;"
)

def introspect():
    conn = pyodbc.connect(ODBC_CONN_STR)
    cursor = conn.cursor()

    result = {
        "server": DB_SERVER,
        "database": DB_NAME,
        "tables": {},
        "triggers": [],
    }

    # 1. Tables & row count
    cursor.execute("""
        SELECT t.name, p.rows
        FROM sys.tables t
        INNER JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE p.index_id IN (0, 1) AND t.name != 'sysdiagrams'
        ORDER BY t.name;
    """)
    table_rows = {row[0]: row[1] for row in cursor.fetchall()}

    for table_name, row_count in table_rows.items():
        table_meta = {
            "name": table_name,
            "row_count": row_count,
            "columns": [],
            "primary_keys": [],
            "foreign_keys": [],
            "unique_constraints": [],
            "check_constraints": [],
        }

        # Columns
        cursor.execute("""
            SELECT 
                c.name,
                tp.name AS data_type,
                c.max_length,
                c.precision,
                c.scale,
                c.is_nullable,
                c.is_identity,
                dc.definition AS default_val
            FROM sys.columns c
            JOIN sys.types tp ON c.user_type_id = tp.user_type_id
            LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
            WHERE c.object_id = OBJECT_ID(?)
            ORDER BY c.column_id;
        """, (table_name,))
        for col in cursor.fetchall():
            table_meta["columns"].append({
                "name": col[0],
                "type": col[1],
                "max_length": col[2],
                "precision": col[3],
                "scale": col[4],
                "is_nullable": bool(col[5]),
                "is_identity": bool(col[6]),
                "default": col[7],
            })

        # Primary Keys
        cursor.execute("""
            SELECT col.name
            FROM sys.indexes i
            JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
            WHERE i.object_id = OBJECT_ID(?) AND i.is_primary_key = 1
            ORDER BY ic.key_ordinal;
        """, (table_name,))
        table_meta["primary_keys"] = [r[0] for r in cursor.fetchall()]

        # Foreign Keys
        cursor.execute("""
            SELECT 
                fk.name AS constraint_name,
                c.name AS column_name,
                rt.name AS ref_table,
                rc.name AS ref_column,
                fk.delete_referential_action_desc,
                fk.update_referential_action_desc
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables t ON fk.parent_object_id = t.object_id
            JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
            JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
            JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
            WHERE t.name = ?;
        """, (table_name,))
        for fk in cursor.fetchall():
            table_meta["foreign_keys"].append({
                "name": fk[0],
                "column": fk[1],
                "ref_table": fk[2],
                "ref_column": fk[3],
                "on_delete": fk[4],
                "on_update": fk[5],
            })

        # Check Constraints
        cursor.execute("""
            SELECT cc.name, cc.definition
            FROM sys.check_constraints cc
            WHERE cc.parent_object_id = OBJECT_ID(?);
        """, (table_name,))
        for cc in cursor.fetchall():
            table_meta["check_constraints"].append({
                "name": cc[0],
                "definition": cc[1],
            })

        # Unique Constraints & Indexes
        cursor.execute("""
            SELECT i.name, c.name AS column_name, i.is_unique, i.has_filter, i.filter_definition
            FROM sys.indexes i
            JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.object_id = OBJECT_ID(?) AND i.is_unique = 1 AND i.is_primary_key = 0
            ORDER BY i.name, ic.key_ordinal;
        """, (table_name,))
        for ui in cursor.fetchall():
            table_meta["unique_constraints"].append({
                "index_name": ui[0],
                "column": ui[1],
                "is_unique": bool(ui[2]),
                "has_filter": bool(ui[3]),
                "filter_definition": ui[4],
            })

        result["tables"][table_name] = table_meta

    # Triggers
    cursor.execute("""
        SELECT tr.name AS trigger_name, t.name AS table_name, m.definition
        FROM sys.triggers tr
        JOIN sys.tables t ON tr.parent_id = t.object_id
        JOIN sys.sql_modules m ON tr.object_id = m.object_id;
    """)
    for tr in cursor.fetchall():
        result["triggers"].append({
            "name": tr[0],
            "table": tr[1],
            "definition": tr[2],
        })

    conn.close()
    return result

if __name__ == "__main__":
    os.makedirs("docs", exist_ok=True)
    baseline = introspect()
    out_path = os.path.join("docs", "db-baseline.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(baseline, f, ensure_ascii=False, indent=2)
    print(f"Introspection complete. {len(baseline['tables'])} tables documented in {out_path}.")
