---
name: sqlserver-migration
description: Use when modifying the database schema, creating Alembic migrations, or updating ORM mappings for SQL Server.
---
# SQL Server Migration Safety Guidelines

1. **Safety Preconditions:**
   - NEVER run `docs/source/lab4-sql.sql` or scripts containing `DROP DATABASE`.
   - Before applying schema changes, create a backup or verify against a dedicated test database.
   - Separate runtime credentials (DML only) from migration credentials (DDL).

2. **MSSQL-Specific Considerations:**
   - **Trigger & OUTPUT INSERTED Conflict:** Tables with triggers (`plots`, `payments`) cause errors with SQLAlchemy's default `OUTPUT INSERTED`. Always configure `implicit_returning=False` on corresponding model classes.
   - **Triggers Must Have:** `SET NOCOUNT ON;` and must handle multi-row operations properly.
   - **Collation & Search:** Database uses `SQL_Latin1_General_CP1_CI_AS`. Accent-insensitive searches should be tested explicitly.
   - **Incremental Additions:** Add nullable columns first -> backfill data -> add NOT NULL/foreign key constraints.

3. **Verification Checklist:**
   - Run `backend/scripts/introspect_db.py` to compare schema before and after.
   - Test rollback/downgrade logic or document forward-only repair strategy.
   - Update `docs/db-gap-register.md` to reflect newly closed gaps.
