# Nhật Ký Thực Thi Dự Án (Project Execution State)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày cập nhật:** 03/10/2026  
**Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)

---

## 1. Trạng thái tổng quan

- **Milestone hiện tại:** Hoàn tất **M03** (Tệp, job/outbox và chứng từ nền) -> Chuẩn bị **M04** (Design system & cấu hình nền).
- **Trạng thái CSDL:**
  - Máy chủ: `DESKTOP-HKIPI1M`
  - CSDL chính: `QL_NghiaTrang`
  - CSDL kiểm thử: `QL_NghiaTrang_Test` (bảo vệ tuyệt đối CSDL chính)
  - Đã backup an toàn: `backend/runtime/backups/sql/QL_NghiaTrang_M02_baseline.bak`
  - Alembic Head: `0003_g02_g17_files_documents_jobs_outbox` (đã áp dụng trên cả DB chính và DB test).
  - 37 bảng nghiệp vụ + 5 bảng mở rộng mới: `auth_sessions` (G01), `file_objects` (G02), `document_versions` (G02), `background_jobs` (G17), `outbox_events` (G17).
  - Kết nối native qua pyodbc và `ODBC Driver 18 for SQL Server` hoạt động 100%.
- **Hạ tầng lưu trữ:**
  - MinIO Docker Container (`elestio/minio:latest`) đang chạy trên máy.
  - Bind mount trực tiếp vào `D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data` trên ổ D.
- **Bộ công cụ & Chất lượng mã nguồn:**
  - Backend: Python 3.12 (`uv`). 20 tests passed (6 auth + 6 documents + 2 jobs + 2 triggers + 4 health/storage), ruff clean.
  - Web: React 19 + TypeScript + Vite (`pnpm`). Build thành công trong 200ms, 0 lint errors.
  - Mobile: Flutter 3.41.6 / Dart 3.11.4 Android. Analyze 0 issues, test passed.
  - Tiêu chuẩn Quality Gate (`scripts/quality-gate.ps1`) đạt 100% trên cả 3 phân hệ.

---

## 2. Bảng theo dõi tiến độ Milestones (M00 - M14)

| Milestone | Tên Milestone | Trạng thái | Tag Git | Ghi chú & Bằng chứng |
|---|---|---|---|---|
| **M00** | Khảo sát, công cụ & quyết định kiến trúc | **ĐẠT (Done)** | `v0.1.0-baseline` | Preflight, ODBC 18, introspect CSDL (37 bảng), rà soát Manga, ADR-001, Gap Register, Toolchain Lock, AGENTS.md, Rules & Skills. |
| **M01** | Scaffold, runtime và storage | **ĐẠT (Done)** | `v0.2.0-foundation` | Monorepo hoàn chỉnh (`backend`, `web`, `mobile`, `scripts`). FastAPI readiness/liveness, MinIO bind mount ổ D bền vững, Web & Flutter shell 4 trạng thái. |
| **M02** | Baseline migration, auth & phân quyền | **ĐẠT (Done)** | `v0.3.0-auth` | Backup CSDL, Alembic baseline + G01 migration, 37 SQLAlchemy models, trigger bypass (`implicit_returning=False`), Argon2 + JWT + RFC 6819 rotation, RBAC 4 vai trò, Web & Flutter Auth E2E. |
| **M03** | Tệp, job/outbox & chứng từ nền | **ĐẠT (Done)** | `v0.4.0-documents` | Migration G02/G17, stream MinIO, kiểm tra Magic Bytes & SHA-256, ReportLab xuất PDF tiếng Việt UTF-8 (Arial), openpyxl Excel, Background Worker lease lock. |
| **M04** | Design system & cấu hình nền | **Đang tiến hành** | `v0.5.0-design-catalog` | Bảng giá G03, gói chăm sóc, template hợp đồng, UI components. |
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

---

## 4. Bằng chứng nghiệm thu Milestone M03 (Tệp, Job/Outbox & Chứng Từ Nền)

### 4.1. CSDL & Alembic Migration (G02 & G17)
- Revision: `0003_g02_g17_files_documents_jobs_outbox.py`
  - Đã nâng cấp thành công trên cả `QL_NghiaTrang_Test` và CSDL thực tế `QL_NghiaTrang`.
  - Bảng `file_objects`: Quản lý siêu dữ liệu tệp lưu trữ trên MinIO (S3 bucket: `ql-nghiatrang-documents`), mã băm SHA-256 toàn vẹn, kích thước byte, mime_type, trạng thái (`UPLOADING`, `READY`, `QUARANTINED`, `DELETED`).
  - Bảng `document_versions`: Quản lý lịch sử phiên bản (`version_no`), liên kết hợp đồng (`contract_id`), phụ lục (`annex_id`), giấy báo tử (`certificate_id`), khóa ngoại `ON DELETE NO ACTION` tránh cascade loop của SQL Server (Error 1785).
  - Bảng `background_jobs`: Hàng đợi tác vụ ngầm hỗ trợ distributed worker locking (`lease_until`, `retry_count`, `max_retries`).
  - Bảng `outbox_events`: Mô hình Transactional Outbox đảm bảo tính tin cậy tuyệt đối giữa ghi CSDL và phát hành sự kiện.

### 4.2. Dịch Vụ Chứng Từ & Kiểm Tra An Toàn (DocumentService)
- **Magic Bytes Validation:** Kiểm tra trực tiếp chữ ký nhị phân đầu tệp (`%PDF-`, PNG header, JPEG SOI, ZIP/XLSX PK header), từ chối ngay lập tức các tệp đổi đuôi giả mạo (400 Bad Request).
- **Streaming Upload MinIO:** Đẩy luồng trực tiếp vào bucket `ql-nghiatrang-documents` trên ổ D, tính toán tức thời mã SHA-256 song song.
- **Xác thực tải về & Xem trước:** Endpoint `/api/v1/documents/{file_id}/download` và `/preview` yêu cầu JWT Bearer Token, trả kèm header bảo vệ toàn vẹn `X-SHA256`.

### 4.3. Xuất Bản PDF & Excel Chuẩn Nghiệp Vụ
- **ReportLab tiếng Việt UTF-8 (`PDFService`):**
  - Tự động đăng ký font `Arial` chuẩn hệ thống Windows (`C:\Windows\Fonts\arial.ttf`), hỗ trợ 100% dấu tiếng Việt và typography trang trọng.
  - Tích hợp tiêu đề quốc hiệu, số hợp đồng, bảng thông tin ô mộ/slot, cam kết pháp lý, khung chữ ký đại diện hai bên và QR code thanh toán chuẩn VietQR.
  - Endpoint `/api/v1/documents/sample-contract-pdf` tạo mẫu và lưu trữ trực tiếp vào MinIO.
- **Excel Report Engine (`ExcelService`):**
  - Sử dụng `openpyxl` tạo bảng tính chuyên nghiệp, định dạng header màu nhận diện thương hiệu nghĩa trang `#24594D`, viền ô mỏng, căn lề và co giãn cột tự động.

### 4.4. Background Jobs & Outbox Worker (`BackgroundJobService`)
- Cơ chế chiếm quyền xử lý phân tán: Sử dụng `lease_until` với thời hạn thuê (lease duration), ngăn chặn xung đột giữa các worker.
- Chuyển trạng thái tin cậy: `PENDING` -> `CLAIMED` -> `COMPLETED` / `FAILED`.

### 4.5. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Hồ Sơ Chứng Từ & MinIO"** tích hợp thanh điều hướng RBAC:
  - Khu vực tải lên hỗ trợ kiểm tra định dạng và báo lỗi trực quan.
  - Nút bấm 1-click tạo PDF mẫu tiếng Việt và lưu thẳng vào MinIO S3.
  - Bảng danh mục tệp hiển thị định dạng, dung lượng, trạng thái READY và mã băm SHA-256 rút gọn kèm chi tiết.
  - Cửa sổ Preview Modal tương tác cao: hiển thị trực tiếp PDF qua iframe hoặc ảnh trực tiếp kèm nút tải về an toàn.
  - Hộp thoại gán hồ sơ chứng từ và đánh số phiên bản tự động (`v1`, `v2`, ...).
  - Bảng giám sát công việc ngầm (Background Jobs Queue Monitor) cho phép enqueue và chạy từng bước kiểm thử worker.

### 4.6. Kiểm Thử Chất Lượng (Quality Gate)
- Backend: `uv run pytest` đạt 20/20 bài kiểm thử (100% passed). `uv run ruff check .` All checks passed!
- Web: `pnpm lint` 0 errors, `pnpm build` hoàn tất trong 200ms.
- Mobile: `flutter analyze` 0 issues, `flutter test` passed.

