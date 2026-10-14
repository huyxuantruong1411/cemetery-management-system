import os

# CRITICAL: Force test environment before any app modules or database engines are imported
os.environ["DB_NAME"] = "QL_NghiaTrang_Test"

import pytest  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.session import engine  # noqa: E402

# Ensure settings and engine are explicitly targeted to the test database
settings.DB_NAME = "QL_NghiaTrang_Test"


@pytest.fixture(scope="session", autouse=True)
def guard_test_database():
    """Ensure tests NEVER run against production/main database.

    Protects QL_NghiaTrang against accidental writes.
    """
    assert settings.DB_NAME in ("QL_NghiaTrang_Test", "QL_NghiaTrang_test", "test"), (
        f"CRITICAL SAFETY GUARD: Test suite attempted to run against '{settings.DB_NAME}'! "
        "Tests must ONLY be executed against 'QL_NghiaTrang_Test'. "
        "Set DB_NAME=QL_NghiaTrang_Test before running tests."
    )
    # Also verify engine connection string contains QL_NghiaTrang_Test
    url_str = str(engine.url)
    assert "QL_NghiaTrang_Test" in url_str or "test" in url_str.lower(), (
        f"CRITICAL SAFETY GUARD: Engine bound to non-test URL: {url_str}"
    )
    with engine.connect() as conn:
        actual_db = conn.exec_driver_sql("SELECT DB_NAME()").scalar()
        assert actual_db in ("QL_NghiaTrang_Test", "QL_NghiaTrang_test", "test"), (
            f"CRITICAL SAFETY GUARD: Physical SQL Server connection is connected to database '{actual_db}'! "
            "Tests must ONLY be executed against 'QL_NghiaTrang_Test'."
        )
