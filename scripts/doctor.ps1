# Doctor Script: Kiểm tra toàn diện công cụ, CSDL và MinIO
$ErrorActionPreference = "Continue"

Write-Host "`n=== [1/6] KIEM TRA HE DIEU HANH & O DIA DU LIEU ===" -ForegroundColor Cyan
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{Name="FreeGB";Expression={[math]::round($_.Free/1GB,2)}}, @{Name="UsedGB";Expression={[math]::round($_.Used/1GB,2)}} | Format-Table -AutoSize

Write-Host "=== [2/6] KIEM TRA BO CONG CU CLI ===" -ForegroundColor Cyan
Write-Host "Git: " -NoNewline; git --version
Write-Host "Python (uv): " -NoNewline; uv run python --version
Write-Host "uv: " -NoNewline; uv --version
Write-Host "Node: " -NoNewline; node --version
Write-Host "pnpm: " -NoNewline; pnpm --version
Write-Host "Flutter: " -NoNewline; flutter --version | Select-Object -First 1

Write-Host "`n=== [3/6] KIEM TRA DRIVER ODBC SQL SERVER ===" -ForegroundColor Cyan
Get-OdbcDriver | Where-Object Name -Like '*ODBC Driver*' | Select-Object Name, Platform | Format-Table -AutoSize

Write-Host "=== [4/6] KIEM TRA CO SO DU LIEU MSSQL (QL_NghiaTrang) ===" -ForegroundColor Cyan
try {
    $script = @"
import pyodbc
conn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER=DESKTOP-HKIPI1M;DATABASE=QL_NghiaTrang;Trusted_Connection=yes;TrustServerCertificate=yes;')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM sys.tables')
print('Ket noi MSSQL thanh cong! So bang:', cur.fetchone()[0])
conn.close()
"@
    uv run --with pyodbc python -c $script
} catch {
    Write-Host "Loi ket noi CSDL: $_" -ForegroundColor Red
}

Write-Host "`n=== [5/6] KIEM TRA MINIO DOCKER STORAGE BIND-MOUNT ===" -ForegroundColor Cyan
try {
    $minioId = docker compose -f backend/compose.yaml ps -q minio
    if ($minioId) {
        $mounts = docker inspect $minioId --format '{{json .Mounts}}'
        Write-Host "MinIO Container ID: $minioId" -ForegroundColor Green
        Write-Host "Bind Mounts: $mounts" -ForegroundColor Green
        $health = (Invoke-WebRequest http://127.0.0.1:9000/minio/health/live -UseBasicParsing -TimeoutSec 3).StatusCode
        Write-Host "MinIO Health Status: $health" -ForegroundColor Green
    } else {
        Write-Host "MinIO container chua chay. Hay chay 'docker compose -f backend/compose.yaml up -d minio'" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Loi kiem tra MinIO: $_" -ForegroundColor Red
}

Write-Host "`n=== [6/6] KIEM TRA TESTS CAC PHAN HE ===" -ForegroundColor Cyan
Write-Host "Chay 'powershell -ExecutionPolicy Bypass -File scripts/quality-gate.ps1' de kiem tra toan bo chat luong code." -ForegroundColor Cyan
