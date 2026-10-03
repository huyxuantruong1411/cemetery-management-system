# Quality Gate Script: Kiểm tra toàn diện chất lượng code trước commit/tag
$ErrorActionPreference = "Stop"

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   TIÊU CHUẨN CHẤT LƯỢNG (QUALITY GATE)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Backend Lint & Test
Write-Host "`n[1/3] Backend (Python / uv)..." -ForegroundColor Yellow
Push-Location backend
try {
    Write-Host "-> uv run ruff check ."
    uv run ruff check .
    Write-Host "-> uv run pytest"
    uv run pytest
    Write-Host "=> Backend checks PASSED!" -ForegroundColor Green
} finally {
    Pop-Location
}

# 2. Web Lint & Build
Write-Host "`n[2/3] Web Frontend (React / Vite / pnpm)..." -ForegroundColor Yellow
Push-Location web
try {
    Write-Host "-> pnpm lint"
    pnpm lint
    Write-Host "-> pnpm build"
    pnpm build
    Write-Host "=> Web checks PASSED!" -ForegroundColor Green
} finally {
    Pop-Location
}

# 3. Mobile Analyze & Test
Write-Host "`n[3/3] Mobile App (Flutter / Dart)..." -ForegroundColor Yellow
Push-Location mobile
try {
    Write-Host "-> flutter analyze"
    flutter analyze
    Write-Host "-> flutter test"
    flutter test
    Write-Host "=> Mobile checks PASSED!" -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  TẤT CẢ TIÊU CHUẨN ĐÃ ĐẠT! SẴN SÀNG COMMIT VÀ GẮN TAG." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
