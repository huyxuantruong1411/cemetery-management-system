# Nhật Ký Thực Thi Dự Án (Project Execution State)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày cập nhật:** 03/10/2026  
**Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)

---

## 1. Trạng thái tổng quan

- **Milestone hiện tại:** Hoàn tất **M02** (Baseline migration, auth và phân quyền) -> Chuẩn bị **M03** (Tệp, job/outbox và chứng từ nền).
- **Trạng thái CSDL:**
  - Máy chủ: `DESKTOP-HKIPI1M`
  - CSDL chính: `QL_NghiaTrang`
  - CSDL kiểm thử: `QL_NghiaTrang_Test` (bảo vệ tuyệt đối CSDL chính)
  - Đã backup an toàn: `backend/runtime/backups/sql/QL_NghiaTrang_M02_baseline.bak`
  - Alembic Head: `0002_g01_auth_sessions_and_version` (đã áp dụng trên cả DB chính và DB test).
  - 37 bảng nghiệp vụ + bảng mới `auth_sessions` và cột `users.auth_version` (G01).
  - Kết nối native qua pyodbc và `ODBC Driver 18 for SQL Server` hoạt động 100%.
- **Hạ tầng lưu trữ:**
  - MinIO Docker Container (`elestio/minio:latest`) đang chạy trên máy.
  - Bind mount trực tiếp vào `D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data` trên ổ D.
- **Bộ công cụ & Chất lượng mã nguồn:**
  - Backend: Python 3.12 (`uv`). 12 tests passed (6 auth + 2 triggers + 4 health/storage), ruff clean.
  - Web: React 19 + TypeScript + Vite (`pnpm`). Build thành công trong 206ms, 0 lint errors.
  - Mobile: Flutter 3.41.6 / Dart 3.11.4 Android. Analyze 0 issues, test passed.
  - Tiêu chuẩn Quality Gate (`scripts/quality-gate.ps1`) đạt 100% trên cả 3 phân hệ.

---

## 2. Bảng theo dõi tiến độ Milestones (M00 - M14)

| Milestone | Tên Milestone | Trạng thái | Tag Git | Ghi chú & Bằng chứng |
|---|---|---|---|---|
| **M00** | Khảo sát, công cụ & quyết định kiến trúc | **ĐẠT (Done)** | `v0.1.0-baseline` | Preflight, ODBC 18, introspect CSDL (37 bảng), rà soát Manga, ADR-001, Gap Register, Toolchain Lock, AGENTS.md, Rules & Skills. |
| **M01** | Scaffold, runtime và storage | **ĐẠT (Done)** | `v0.2.0-foundation` | Monorepo hoàn chỉnh (`backend`, `web`, `mobile`, `scripts`). FastAPI readiness/liveness, MinIO bind mount ổ D bền vững, Web & Flutter shell 4 trạng thái. |
| **M02** | Baseline migration, auth & phân quyền | **ĐẠT (Done)** | `v0.3.0-auth` | Backup CSDL, Alembic baseline + G01 migration, 37 SQLAlchemy models, trigger bypass (`implicit_returning=False`), Argon2 + JWT + RFC 6819 rotation, RBAC 4 vai trò, Web & Flutter Auth E2E. |
| **M03** | Tệp, job/outbox & chứng từ nền | **Sắp thực hiện** | `v0.4.0-documents` | G02/G17, upload stream MinIO, PDF rendering tiếng Việt, outbox worker. |
| **M04** | Design system & cấu hình nền | Chưa bắt đầu | `v0.5.0-design-catalog` | Bảng giá G03, gói chăm sóc, template hợp đồng, UI components. |
| **M05** | Không gian, ô mộ, slot và bản đồ | Chưa bắt đầu | `v0.6.0-plots` | G04/G06, bản đồ Leaflet, quản lý khu/hàng/ô/slot, chống trùng giữ chỗ. |
| **M06** | Khách hàng, người mất & giấy báo tử | Chưa bắt đầu | `v0.7.0-profiles` | G07/G08, quản lý hồ sơ thân nhân, xác minh giấy báo tử. |
| **M07** | Luồng mua đất -> ký ngoài -> kích hoạt | Chưa bắt đầu | `v0.8.0-land-contracts` | G09, HĐ mua đất, giữ chỗ transaction-safe, scan và kích hoạt, sinh nợ. |
| **M08** | An táng, Kim Tĩnh, cải táng, chuyển nhượng | Chưa bắt đầu | `v0.9.0-domain-lifecycle` | G10/G18/G20, khóa Kim Tĩnh bất biến, chuyển nhượng, an táng, cải táng. |
| **M09** | Quản lý thi công thực địa | Chưa bắt đầu | `v0.10.0-construction` | G11/G13, checklist công trình, bằng chứng ảnh, phân công thợ. |
| **M10** | Chăm sóc định kỳ & mobile offline | Chưa bắt đầu | `v0.11.0-care` | G12, sinh lịch định kỳ, Quản trang đóng ca, offline queue retry. |
| **M11** | Công nợ, thu tiền, chiết khấu, biên lai | Chưa bắt đầu | `v0.12.0-finance` | G14-G16, Idempotency payment, tính nợ trigger-aware, biên lai PDF. |
| **M12** | Báo cáo, tra cứu công khai & audit | Chưa bắt đầu | `v0.13.0-feature-complete` | 4 báo cáo thống kê, cổng tra cứu không lộ PII, audit log viewer. |
| **M13** | Kiểm thử hệ thống, UX & khôi phục | Chưa bắt đầu | `v1.0.0-rc.1` | Regression toàn diện, test tải, backup/restore CSDL + S3 đối soát. |
| **M14** | Bàn giao và phát hành | Chưa bắt đầu | `v1.0.0` | Scripts vận hành, tài liệu bàn giao, APK thử nghiệm, release manifest. |

---

## 3. Bằng chứng nghiệm thu Milestone M02

### 3.1. CSDL & Alembic Migration
- Backup thành công: `backend/runtime/backups/sql/QL_NghiaTrang_M02_baseline.bak`
- Database kiểm thử: `QL_NghiaTrang_Test`
- Revisions:
  - `0001_baseline_37_tables.py`
  - `0002_g01_auth_sessions_and_version.py` (đã apply cả 2 DB)
- Triggers SQL Server:
  - Bảng `plots` có trigger `trg_plots_enforce_kim_tinh_immutability`
  - Bảng `payments` có trigger `trg_payments_sync_receivable_balance`
  - Đã cấu hình `__table_args__ = {"implicit_returning": False}` trên cả hai model SQLAlchemy.
  - Test `test_insert_plot_with_trigger` và `test_insert_payment_with_trigger` PASSED 100%.

### 3.2. Xác thực & Phân quyền (RBAC)
- 4 Vai trò chuẩn: `ADMIN`, `MARKETING`, `ACCOUNTANT`, `CARETAKER`.
- 21 Quyền hạn chuẩn đã seed idempotent qua `scripts/seed_rbac.py`.
- Bảo mật RFC 6819: Xoay vòng Refresh token, phát hiện tái sử dụng token (Token Reuse Detection) lập tức thu hồi toàn bộ session family.
- Lỗ hổng G01: Thu hồi tức thì (Immediate Revocation) khi tăng `auth_version` làm vô hiệu hóa toàn bộ access token đang lưu hành (trả 401 Unauthorized ngay lập tức).
- RBAC Scope Dependency: Kiểm tra quyền hạn `require_permission(resource, action)`, từ chối 403 Forbidden nếu không đủ quyền, `ADMIN` có quyền toàn năng.

### 3.3. Web & Mobile Integration
- **Web:** Đăng nhập, lưu refresh token, tự động khôi phục phiên, modal chọn nhanh vai trò, menu phân hệ động theo quyền hạn, hiển thị active permissions tag cloud. Browser subagent E2E test xác minh luồng đăng nhập đổi vai trò thành công 100%.
- **Mobile:** `UserModel`, `AuthState`, `AuthNotifier` tích hợp Riverpod 3.x, dialog đăng nhập nhanh, AppBar hiển thị vai trò và quyền hạn.

### 3.4. Kiểm thử chất lượng (Quality Gate)
- Backend: `uv run ruff check .` (All checks passed), `uv run pytest` (12/12 passed).
- Web: `pnpm lint` (0 errors), `pnpm build` (built in 206ms).
- Mobile: `flutter analyze` (No issues found), `flutter test` (All tests passed).
