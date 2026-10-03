from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.get_database_url(),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    hide_parameters=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_readiness() -> tuple[bool, str]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
            return True, "Database connected"
    except Exception as e:
        return False, f"Database error: {str(e)}"
