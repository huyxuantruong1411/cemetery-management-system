from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_NAME: str = "Hệ thống Quản lý Nghĩa trang Tư nhân"
    APP_VERSION: str = "0.2.0"
    APP_ENV: str = "development"
    APP_TIMEZONE: str = "Asia/Ho_Chi_Minh"
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Database (MSSQL)
    DB_SERVER: str = "DESKTOP-HKIPI1M"
    DB_NAME: str = "QL_NghiaTrang"
    DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    DB_AUTH: str = "windows"
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None
    DB_ENCRYPT: str = "yes"
    DB_TRUST_SERVER_CERTIFICATE: str = "yes"

    # Storage (MinIO / S3)
    STORAGE_ENDPOINT: str = "http://127.0.0.1:9000"
    STORAGE_ACCESS_KEY: str = "admin_local"
    STORAGE_SECRET_KEY: str = "NghiaTrangSecret2026!"
    STORAGE_BUCKET: str = "nghiatrang-private"
    STORAGE_REGION: str = "us-east-1"
    RUNTIME_DIR: str = "./runtime"

    # Security
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production-cemetery-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    def get_database_url(self) -> URL:
        if self.DB_AUTH.lower() == "windows":
            odbc_connect = (
                f"DRIVER={{{self.DB_DRIVER}}};"
                f"SERVER={self.DB_SERVER};"
                f"DATABASE={self.DB_NAME};"
                f"Trusted_Connection=yes;"
                f"Encrypt={self.DB_ENCRYPT};"
                f"TrustServerCertificate={self.DB_TRUST_SERVER_CERTIFICATE};"
            )
            return URL.create("mssql+pyodbc", query={"odbc_connect": odbc_connect})
        else:
            odbc_connect = (
                f"DRIVER={{{self.DB_DRIVER}}};"
                f"SERVER={self.DB_SERVER};"
                f"DATABASE={self.DB_NAME};"
                f"UID={self.DB_USER};"
                f"PWD={self.DB_PASSWORD};"
                f"Encrypt={self.DB_ENCRYPT};"
                f"TrustServerCertificate={self.DB_TRUST_SERVER_CERTIFICATE};"
            )
            return URL.create("mssql+pyodbc", query={"odbc_connect": odbc_connect})


settings = Settings()
