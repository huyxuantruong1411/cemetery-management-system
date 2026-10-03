"""g02_g17_files_documents_jobs_outbox

Revision ID: 0003_g02_g17
Revises: 0002_g01_auth
Create Date: 2026-10-03 13:30:00.000000

Implements:
- G02: File objects and document versions with SHA-256 and metadata.
- G17: Background jobs and outbox events for durable asynchronous processing.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_g02_g17"
down_revision: Union[str, None] = "0002_g01_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. file_objects table
    op.create_table(
        "file_objects",
        sa.Column("file_id", sa.String(length=64), primary_key=True),
        sa.Column("bucket_name", sa.String(length=100), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("version_id", sa.String(length=100), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "state", sa.String(length=20), nullable=False, server_default=sa.text("'STAGING'")
        ),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")
        ),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.user_id"]),
        sa.UniqueConstraint("object_key"),
        sa.CheckConstraint(
            "state IN ('STAGING', 'READY', 'QUARANTINED', 'DELETED')",
            name="chk_file_objects_state",
        ),
    )
    op.create_index("ix_file_objects_state", "file_objects", ["state"])
    op.create_index("ix_file_objects_sha256", "file_objects", ["sha256_hash"])

    # 2. document_versions table
    op.create_table(
        "document_versions",
        sa.Column("document_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=True),
        sa.Column("annex_id", sa.Integer(), nullable=True),
        sa.Column("certificate_id", sa.Integer(), nullable=True),
        sa.Column("version_no", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("file_id", sa.String(length=64), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("verified_by_user_id", sa.Integer(), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")
        ),
        sa.ForeignKeyConstraint(["contract_id"], ["contracts.contract_id"]),
        sa.ForeignKeyConstraint(["annex_id"], ["contract_annexes.annex_id"]),
        sa.ForeignKeyConstraint(["certificate_id"], ["death_certificates.cert_id"]),
        sa.ForeignKeyConstraint(["file_id"], ["file_objects.file_id"]),
        sa.ForeignKeyConstraint(["verified_by_user_id"], ["users.user_id"]),
    )
    op.create_index("ix_document_versions_contract_id", "document_versions", ["contract_id"])
    op.create_index("ix_document_versions_annex_id", "document_versions", ["annex_id"])
    op.create_index("ix_document_versions_file_id", "document_versions", ["file_id"])

    # 3. background_jobs table
    op.create_table(
        "background_jobs",
        sa.Column("job_id", sa.String(length=64), primary_key=True),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column(
            "state", sa.String(length=20), nullable=False, server_default=sa.text("'PENDING'")
        ),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("3")),
        sa.Column("lease_until", sa.DateTime(), nullable=True),
        sa.Column("claimed_by_worker", sa.String(length=100), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "state IN ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED')",
            name="chk_background_jobs_state",
        ),
    )
    op.create_index("ix_background_jobs_state_lease", "background_jobs", ["state", "lease_until"])

    # 4. outbox_events table
    op.create_table(
        "outbox_events",
        sa.Column("event_id", sa.String(length=64), primary_key=True),
        sa.Column("aggregate_type", sa.String(length=50), nullable=False),
        sa.Column("aggregate_id", sa.String(length=100), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column(
            "state", sa.String(length=20), nullable=False, server_default=sa.text("'PENDING'")
        ),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("SYSUTCDATETIME()")
        ),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "state IN ('PENDING', 'PROCESSED', 'FAILED')",
            name="chk_outbox_events_state",
        ),
    )
    op.create_index("ix_outbox_events_state", "outbox_events", ["state"])


def downgrade() -> None:
    op.drop_index("ix_outbox_events_state", table_name="outbox_events")
    op.drop_table("outbox_events")

    op.drop_index("ix_background_jobs_state_lease", table_name="background_jobs")
    op.drop_table("background_jobs")

    op.drop_index("ix_document_versions_file_id", table_name="document_versions")
    op.drop_index("ix_document_versions_annex_id", table_name="document_versions")
    op.drop_index("ix_document_versions_contract_id", table_name="document_versions")
    op.drop_table("document_versions")

    op.drop_index("ix_file_objects_sha256", table_name="file_objects")
    op.drop_index("ix_file_objects_state", table_name="file_objects")
    op.drop_table("file_objects")
