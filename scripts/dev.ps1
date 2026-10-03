# Development Environment Orchestrator
$ErrorActionPreference = "Stop"

Write-Host "`n=== KHỞI ĐỘNG HỆ THỐNG MÔI TRƯỜNG PHÁT TRIỂN (DEV) ===" -ForegroundColor Cyan

# 1. Đảm bảo MinIO Storage đang chạy
Write-Host "-> Đang kiểm tra MinIO Docker Container..." -ForegroundColor Yellow
docker compose -f backend/compose.yaml up -d minio
$minioId = docker compose -f backend/compose.yaml ps -q minio
Write-Host "MinIO đang chạy (Container ID: $minioId)" -ForegroundColor Green
Write-Host "MinIO S3 Endpoint: http://127.0.0.1:9000 (Console: http://127.0.0.1:9001)" -ForegroundColor Gray

# 2. Hướng dẫn chạy các thành phần
Write-Host "`n-> Hướng dẫn chạy các phân hệ đồng thời:" -ForegroundColor Cyan
Write-Host "1. Khởi động Backend API (FastAPI):" -ForegroundColor White
Write-Host "   cd backend; uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -ForegroundColor Gray
Write-Host "   -> API Swagger UI: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "   -> Readiness URL: http://127.0.0.1:8000/api/v1/health/ready" -ForegroundColor Green

Write-Host "`n2. Khởi động Web Frontend (React + Vite):" -ForegroundColor White
Write-Host "   cd web; pnpm dev" -ForegroundColor Gray
Write-Host "   -> Web UI: http://localhost:5173" -ForegroundColor Green

Write-Host "`n3. Khởi động Mobile App (Flutter Android):" -ForegroundColor White
Write-Host "   cd mobile; flutter run -d <device-id> --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1" -ForegroundColor Gray
