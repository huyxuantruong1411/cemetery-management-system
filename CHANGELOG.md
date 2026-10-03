# Nhật Ký Thay Đổi Dự Án (Changelog)

Tất cả những thay đổi quan trọng trong hệ thống Quản lý Nghĩa trang Tư nhân được ghi nhận tại đây theo định dạng [Keep a Changelog](https://keepachangelog.com/).

---

## [0.3.0-auth] - 2026-10-03 (M02)

### Added
- **CSDL & Alembic Migration:**
  - Tạo bản sao lưu CSDL vật lý an toàn tại `backend/runtime/backups/sql/QL_NghiaTrang_M02_baseline.bak`.
  - Dựng CSDL kiểm thử độc lập `QL_NghiaTrang_Test`.
  - Khởi tạo cấu hình Alembic trong `backend/alembic/`.
  - Migration `0001_baseline_37_tables.py` làm mốc baseline 37 bảng.
  - Migration `0002_g01_auth_sessions_and_version.py` bổ sung bảng `auth_sessions` và cột `users.auth_version` giải quyết lỗ hổng G01.
  - Ánh xạ 100% trung thực 37 bảng vào SQLAlchemy 2.0 ORM models trong 9 module nghiệp vụ (`backend/app/modules/*/models.py`).
  - Xử lý tương thích triệt để với trigger SQL Server bằng `__table_args__ = {"implicit_returning": False}` trên các bảng `plots` và `payments`.
- **Backend Xác Thực & Phân Quyền (RBAC):**
  - Băm mật khẩu Argon2id an toàn bằng thư viện `pwdlib[argon2]`.
  - Cấp phát và xác thực JWT Bearer tokens (access token thời hạn 15 phút).
  - Quản lý phiên đa thiết bị theo họ phiên (`family_id`) và xoay vòng refresh token an toàn theo chuẩn RFC 6819.
  - Cơ chế thu hồi quyền tức thì (G01 Immediate Revocation) qua `users.auth_version`.
  - Dependency phân quyền `require_permission(resource, action)` và `require_role(role_name)`.
  - Các endpoint xác thực và quản trị tài khoản tại `/api/v1/auth/`: `/login`, `/refresh`, `/logout`, `/me`, `/change-password`, `/revoke-all`, `/users`, `/roles`.
  - Script seed idempotent `backend/scripts/seed_rbac.py` khởi tạo 4 vai trò chuẩn (`ADMIN`, `MARKETING`, `ACCOUNTANT`, `CARETAKER`), 21 quyền hạn và 4 tài khoản demo.
  - Bộ test tự động `tests/test_auth.py` (6 tests) và `tests/test_trigger_mapping.py` (2 tests) vượt qua 100%.
- **Web Frontend (React + TypeScript):**
  - Khởi tạo `authApi`, `AuthContext`, `useAuth` hook hỗ trợ lưu trữ phiên và tự động khôi phục.
  - Modal đăng nhập `LoginModal` với tính năng chọn nhanh 4 vai trò demo.
  - Thanh menu điều hướng động hiển thị các phân hệ theo quyền hạn người dùng.
  - Thẻ hiển thị danh sách quyền hạn thực tế (Active Permissions) trong giao diện.
  - Kiểm thử E2E tự động qua browser subagent đạt 100%.
- **Mobile App (Flutter Android):**
  - Mô hình `UserModel`, `AuthState`, và `AuthNotifier` tích hợp Riverpod 3.x.
  - Hộp thoại đăng nhập nhanh hỗ trợ chọn vai trò (đặc biệt là Quản trang `CARETAKER`).
  - AppBar và thẻ trạng thái hiển thị tên người dùng và huy hiệu vai trò.
  - Vượt qua `flutter analyze` 0 issues và widget tests.

---

## [0.2.0-foundation] - 2026-10-03 (M01)

### Added
- **Backend FastAPI:**
  - Khởi tạo cấu trúc Modular Monolith quản lý bằng `uv` với `pyproject.toml` và `uv.lock`.
  - Cấu hình settings với `pydantic-settings`, nạp `.env` và dựng chuỗi kết nối MSSQL chuẩn pyodbc ODBC Driver 18.
  - Tích hợp SQLAlchemy 2.x sessionmaker và engine có `pool_pre_ping=True`, `hide_parameters=True`.
  - Endpoint `/api/v1/health/live`, `/api/v1/health/ready` (kiểm tra đồng thời MSSQL và MinIO), `/api/v1/version`.
  - Tích hợp adapter MinIO (`boto3`) tự động tạo bucket private `nghiatrang-private`.
  - Bộ test tự động `tests/test_health.py` và `tests/test_storage.py` (kiểm thử chu kỳ upload/get/stat/sha256).
- **Lưu trữ MinIO cục bộ (Docker Compose):**
  - Cấu hình `backend/compose.yaml` sử dụng image `elestio/minio:latest`.
  - Ràng buộc bind mount chặt chẽ toàn bộ dữ liệu vào `backend/runtime/minio/data` trên ổ D, tiết kiệm dung lượng ổ C.
  - Kiểm chứng tính toàn vẹn dữ liệu qua bài test restart container và đối soát SHA-256.
- **Web Frontend (React + Vite + TypeScript):**
  - Khởi tạo dự án bằng `pnpm` và template `react-ts`.
  - Cấu hình Vite proxy chuyển tiếp các request `/api` sang backend `http://127.0.0.1:8000`.
  - Thiết lập bảng mã màu trang nghiêm (`#24594D`, `#F7F8F5`, `#1F2933`) và typography trong `index.css`.
  - Giao diện `App.tsx` xử lý trọn vẹn 4 trạng thái (`Loading`, `Normal`, `Empty`, `Error` kèm nút Thử lại) và giám sát hạ tầng.
- **Mobile App (Flutter Android):**
  - Khởi tạo ứng dụng Flutter Android trong `mobile/`.
  - Bổ sung `dio`, `flutter_riverpod`, `go_router`.
  - Thiết lập theme tôn nghiêm, client Dio kết nối tới backend qua `--dart-define=API_BASE_URL`.
  - Màn hình `DashboardShellScreen` xử lý trọn vẹn 4 trạng thái, các nút bấm thao tác một tay >= 48px.
  - Widget test tự động kiểm thử trạng thái giao diện với Riverpod overrides.
- **Bộ Scripts Tự Động Hóa:**
  - `scripts/doctor.ps1`: Chẩn đoán toàn diện dung lượng ổ đĩa, công cụ CLI, driver ODBC, CSDL MSSQL và MinIO.
  - `scripts/dev.ps1`: Hướng dẫn và khởi chạy đồng thời các dịch vụ dev.
  - `scripts/quality-gate.ps1`: Chạy kiểm tra chất lượng tự động 3 tầng (Backend ruff/pytest, Web oxlint/build, Mobile analyze/test).

---

## [0.1.0-baseline] - 2026-10-03 (M00)

### Added
- Khởi tạo cấu trúc dự án monorepo với Git trên nhánh `main`.
- Lưu trữ 5 tài liệu nguồn nghiệp vụ (D1-D5) và kế hoạch thực thi tại `docs/source/` và `docs/EXECUTION_PLAN.md`.
- Trích xuất toàn diện metadata CSDL vật lý (37 bảng, 2 triggers) vào `docs/db-baseline.json`.
- Thiết lập sổ đăng ký khoảng trống thiết kế và mở rộng `docs/db-gap-register.md` (G01 đến G20).
- Thiết lập khóa phiên bản công cụ `docs/toolchain-lock.md` và đánh giá kiến trúc từ repo tham khảo `docs/reference-tooling-review.md`.
- Ghi nhận quyết định kiến trúc `docs/decisions/0001-system-architecture-and-runtime.md` (ADR-001).
- Khởi tạo quy chuẩn agent: `AGENTS.md`, `.agents/rules/project.md`, và 4 skills nghiệp vụ (`cemetery-domain`, `sqlserver-migration`, `professional-ui-review`, `milestone-delivery`).
- Cài đặt và kiểm chứng `Microsoft ODBC Driver 18 for SQL Server` (v18.6.2.1) qua winget và kiểm tra kết nối với Python pyodbc qua `uv`.
- Thiết lập `.gitignore` bảo vệ nghiêm ngặt runtime MinIO, secrets, virtualenv và build artifacts.
