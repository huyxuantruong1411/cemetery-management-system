# Khóa Phiên Bản Công Cụ và Môi Trường (Toolchain Lock)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày lập:** 03/10/2026  
**Máy chủ phát triển:** `DESKTOP-HKIPI1M` (Windows 11 x64)

---

## 1. Công cụ hệ thống (Đã kiểm chứng thực tế tại Preflight M00)

| Công cụ / Nền tảng | Phiên bản thực tế | Trạng thái / Đường dẫn kiểm chứng |
|---|---|---|
| **Hệ điều hành** | Windows 11 (build x64) | `DESKTOP-HKIPI1M` |
| **Git for Windows** | `2.51.0.windows.1` | Native CLI trên PATH |
| **uv (Python Package Manager)** | `0.11.11` | Khởi chạy native; quản lý venv và dependencies backend |
| **Python** | `3.12.13` (CPython x64) | Quản lý bởi uv: `C:\Users\Huy\AppData\Roaming\uv\python\cpython-3.12-windows-x86_64-none\python.exe` |
| **Node.js** | `v24.11.1` | Khởi chạy native trên PATH |
| **npm** | `11.6.2` | Kèm theo Node.js |
| **pnpm** | `12.4.2` | Trình quản lý package chính cho web frontend |
| **Flutter** | `3.41.6` (channel stable) | Kèm DevTools 2.54.2 |
| **Dart** | `3.11.4` | Tích hợp trong Flutter SDK |
| **Docker Engine** | `28.5.1` (build e180ab8) | Docker Desktop trên Windows |
| **Docker Compose** | `v2.40.2-desktop.1` | Dùng để chạy MinIO cục bộ |
| **SQL Server** | `16.0.1000.6` (MSSQL 2022) | Instance `MSSQLSERVER` đang chạy trên máy |
| **Microsoft ODBC Driver 18** | `18.6.2.1` (x64 & 32-bit) | Dùng cho kết nối Python pyodbc backend |
| **Microsoft ODBC Driver 17** | `17.11.1.1` (x64 & 32-bit) | Tương thích CLI `sqlcmd.exe` |
| **sqlcmd** | `16.0.1000.6 NT` | `C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE` |

---

## 2. Pinned Dependencies dự kiến cho Backend (`pyproject.toml`)

- `fastapi>=0.115.0,<0.116.0`
- `uvicorn[standard]>=0.32.0,<0.33.0`
- `pydantic>=2.10.0,<2.11.0`
- `pydantic-settings>=2.6.0,<2.7.0`
- `sqlalchemy>=2.0.36,<2.1.0`
- `pyodbc>=5.2.0,<5.3.0`
- `alembic>=1.14.0,<1.15.0`
- `pyjwt[crypto]>=2.10.0,<2.11.0`
- `pwdlib[argon2]>=0.2.0,<0.3.0`
- `boto3>=1.35.0,<1.36.0`
- `python-multipart>=0.0.18,<0.0.19`
- `jinja2>=3.1.4,<3.2.0`
- `playwright>=1.49.0,<1.50.0`
- `openpyxl>=3.1.5,<3.2.0`
- Dev/Test:
  - `pytest>=8.3.0,<8.4.0`
  - `pytest-asyncio>=0.24.0,<0.25.0`
  - `httpx>=0.28.0,<0.29.0`
  - `ruff>=0.8.0,<0.9.0`

---

## 3. Pinned Dependencies dự kiến cho Web (`package.json`)

- `react`: `^19.0.0` hoặc `^18.3.1` (theo template Vite)
- `vite`: `^6.0.0`
- `typescript`: `^5.6.0`
- `tailwindcss`: `^3.4.16`
- `@tanstack/react-query`: `^5.62.0`
- `react-hook-form`: `^7.54.0`
- `zod`: `^3.24.0`
- `lucide-react`: `^0.468.0`
- `leaflet`: `^1.9.4` & `@types/leaflet`: `^1.9.14`

---

## 4. Pinned Image MinIO cho Local Dev (`compose.yaml`)

- Image: `quay.io/minio/minio:RELEASE.2024-11-07T00-52-28Z` (hoặc `minio/minio:RELEASE.2024-11-07T00-52-28Z`)
- Data Mount: `./runtime/minio/data:/data` (Bind mount bắt buộc nằm trên ổ D, bên dưới `backend/runtime`)
