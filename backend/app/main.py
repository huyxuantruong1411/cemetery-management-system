from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.config import settings
from app.db.session import check_database_readiness
from app.modules.auth.router import router as auth_router
from app.modules.documents.router import router as documents_router
from app.modules.jobs.router import router as jobs_router
from app.storage.minio_adapter import storage_adapter

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Hệ thống Quản lý Nghĩa trang Tư nhân - API tập trung cho Web và Mobile",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Domain Routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(documents_router, prefix=settings.API_V1_PREFIX)
app.include_router(jobs_router, prefix=settings.API_V1_PREFIX)


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    app: str


class ReadinessResponse(BaseModel):
    status: str
    database: str
    storage: str
    timestamp: str


class VersionResponse(BaseModel):
    app_name: str
    version: str
    environment: str


@app.get(f"{settings.API_V1_PREFIX}/health/live", response_model=HealthResponse)
def health_live():
    """Liveness probe: Trả về trạng thái ứng dụng đang chạy."""
    return HealthResponse(
        status="live",
        timestamp=datetime.now(timezone.utc).isoformat(),
        app=settings.APP_NAME,
    )


@app.get(f"{settings.API_V1_PREFIX}/health/ready", response_model=ReadinessResponse)
def health_ready():
    """Readiness probe: Kiểm tra kết nối SQL Server và MinIO Storage."""
    db_ok, db_msg = check_database_readiness()
    storage_ok, storage_msg = storage_adapter.check_readiness()

    current_time = datetime.now(timezone.utc).isoformat()

    if not db_ok or not storage_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "not_ready",
                "database": db_msg,
                "storage": storage_msg,
                "timestamp": current_time,
            },
        )

    return ReadinessResponse(
        status="ready",
        database=db_msg,
        storage=storage_msg,
        timestamp=current_time,
    )


@app.get(f"{settings.API_V1_PREFIX}/version", response_model=VersionResponse)
def get_version():
    """Phiên bản API hệ thống."""
    return VersionResponse(
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
    )


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX,
    }
