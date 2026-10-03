# Nhật Ký Thực Thi Dự Án (Project Execution State)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày cập nhật:** 03/10/2026  
**Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)

---

## 1. Trạng thái tổng quan

- **Milestone hiện tại:** Hoàn tất **M05** (Không gian, ô mộ, slot và bản đồ) -> Sẵn sàng khởi động **M06** (Hồ sơ khách hàng, người mất, giấy báo tử).
- **Trạng thái CSDL:**
  - Máy chủ: `DESKTOP-HKIPI1M`
  - CSDL chính: `QL_NghiaTrang`
  - CSDL kiểm thử: `QL_NghiaTrang_Test` (bảo vệ tuyệt đối CSDL chính)
  - Đã backup an toàn: `backend/runtime/backups/sql/QL_NghiaTrang_M02_baseline.bak`
  - Alembic Head: `0005_g04_g05_g06_plots_reservations` (đã áp dụng trên cả DB chính và DB test).
  - 37 bảng nghiệp vụ + 8 bảng mở rộng mới: `auth_sessions` (G01), `file_objects` (G02), `document_versions` (G02), `background_jobs` (G17), `outbox_events` (G17), `contract_templates` (G03), `plot_reservations` (G04), `plot_ownerships` (G05).
  - Kết nối native qua pyodbc và `ODBC Driver 18 for SQL Server` hoạt động 100%.
- **Hạ tầng lưu trữ:**
  - MinIO Docker Container (`elestio/minio:latest`) đang chạy trên máy.
  - Bind mount trực tiếp vào `D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data` trên ổ D.
- **Bộ công cụ & Chất lượng mã nguồn:**
  - Backend: Python 3.12 (`uv`). 32 tests passed (6 plots + 6 auth + 6 catalog + 6 documents + 2 jobs + 2 triggers + 4 health/storage), ruff clean.
  - Web: React 19 + TypeScript + Vite (`pnpm`). Build thành công trong 234ms, 0 lint errors.
  - Mobile: Flutter 3.41.6 / Dart 3.11.4 Android. Analyze 0 issues, 5/5 tests passed.
  - Tiêu chuẩn Quality Gate (`scripts/quality-gate.ps1`) đạt 100% trên cả 3 phân hệ.

---

## 2. Bảng theo dõi tiến độ Milestones (M00 - M14)

| Milestone | Tên Milestone | Trạng thái | Tag Git | Ghi chú & Bằng chứng |
|---|---|---|---|---|
| **M00** | Khảo sát, công cụ & quyết định kiến trúc | **ĐẠT (Done)** | `v0.1.0-baseline` | Preflight, ODBC 18, introspect CSDL (37 bảng), rà soát Manga, ADR-001, Gap Register, Toolchain Lock, AGENTS.md, Rules & Skills. |
| **M01** | Scaffold, runtime và storage | **ĐẠT (Done)** | `v0.2.0-foundation` | Monorepo hoàn chỉnh (`backend`, `web`, `mobile`, `scripts`). FastAPI readiness/liveness, MinIO bind mount ổ D bền vững, Web & Flutter shell 4 trạng thái. |
| **M02** | Baseline migration, auth & phân quyền | **ĐẠT (Done)** | `v0.3.0-auth` | Backup CSDL, Alembic baseline + G01 migration, 37 SQLAlchemy models, trigger bypass (`implicit_returning=False`), Argon2 + JWT + RFC 6819 rotation, RBAC 4 vai trò, Web & Flutter Auth E2E. |
| **M03** | Tệp, job/outbox & chứng từ nền | **ĐẠT (Done)** | `v0.4.0-documents` | Migration G02/G17, stream MinIO, kiểm tra Magic Bytes & SHA-256, ReportLab xuất PDF tiếng Việt UTF-8 (Arial), openpyxl Excel, Background Worker lease lock. |
| **M04** | Design system & cấu hình nền | **ĐẠT (Done)** | `v0.5.0-design-catalog` | Migration G03 (`contract_templates`, scope `price_items`), CatalogService chống trùng khoảng thời gian, Web 5 views, Flutter Catalog tab, Quality Gate 100%. |
| **M05** | Không gian, ô mộ, slot và bản đồ | **ĐẠT (Done)** | `v0.6.0-plots` | G04/G05/G06 migration, PlotService khóa Kim Tĩnh bất biến, sinh slot ACID, khóa giữ chỗ chống xung đột row-level, Web Leaflet GIS Map & Drawer, Flutter Sơ Đồ Ô Mộ tab, 32 backend tests, 5 flutter tests, Quality Gate 100%. |
| **M06** | Khách hàng, người mất & giấy báo tử | Sẵn sàng bắt đầu | `v0.7.0-profiles` | G07/G08, quản lý hồ sơ thân nhân, xác minh giấy báo tử trước an táng, chống lộ thông tin PII. |
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

---

## 5. Bằng chứng nghiệm thu Milestone M04 (Design System, Bảng Giá & Danh Mục Nền)

### 5.1. CSDL & Alembic Migration (G03)
- Revision: `0004_g03_catalog_pricing_templates.py`
  - Đã nâng cấp thành công trên cả CSDL kiểm thử `QL_NghiaTrang_Test` và CSDL thực tế `QL_NghiaTrang` trên `DESKTOP-HKIPI1M`.
  - Bảng `contract_templates`: Quản lý 4 mẫu văn bản pháp lý chuẩn (`LAND_PURCHASE`, `EXHUMATION`, `CREMATION`, `TRANSFER`) và phụ lục chăm sóc `CARE_ANNEX`. Ràng buộc `CHECK (template_type IN (...))`. Hỗ trợ versioning tăng tiến (`version_no`).
  - Mở rộng bảng `price_items`: Bổ sung 4 trường phạm vi: `zone_id`, `plot_type_id`, `package_id`, `service_code` với các khóa ngoại `ON DELETE SET NULL`, cho phép định giá linh hoạt theo từng khu vực hoặc gói dịch vụ mà không phá vỡ tính toàn vẹn dữ liệu.
  - Ánh xạ ORM: Các model `PriceItem`, `PriceList`, `CarePackage`, `ContractTemplate` sử dụng chuẩn `Unicode` và `UnicodeText` bảo tồn 100% tiếng Việt có dấu trên MSSQL.

### 5.2. Nghiệp Vụ Backend & Ràng Buộc Miền (CatalogService)
- **Chống trùng lặp thời gian hiệu lực (G03 Invariant):** Hai bảng giá cùng kích hoạt không được phép giao nhau về khoảng ngày hiệu lực `[effective_from, effective_to]`. Kiểm thử tự động `test_create_price_list_overlap_rejected` xác nhận từ chối với lỗi 400 Bad Request.
- **Tra cứu đơn giá tức thời theo Scope:** Hàm `lookup_price` tự động tìm bảng giá hiệu lực tại ngày tra cứu và ưu tiên khớp phạm vi hẹp nhất (khuôn viên khu vực -> loại mộ -> gói dịch vụ).
- **Kiểm soát gói chăm sóc:** Chặn kích hoạt hoặc áp dụng đơn giá cho gói dịch vụ đã bị vô hiệu hóa (`is_active=False`).
- **Nguyên tắc bất biến phiên bản hợp đồng (Non-retroactivity):** Khi cập nhật mẫu hợp đồng, hàm `bump_template_version` đóng phiên bản cũ và sinh phiên bản mới với `version_no + 1`, bảo vệ tuyệt đối tính pháp lý của các hợp đồng đã ký trong quá khứ.

### 5.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Bảng Giá & Danh Mục"** (`CatalogModule.tsx`) với 5 màn hình tương tác:
  1. *Bảng Giá & Khoản Mục:* Hiển thị danh sách bảng giá hiệu lực, mở rộng xem chi tiết từng khoản mục giá, đơn giá VNĐ, phạm vi áp dụng.
  2. *Gói Chăm Sóc Định Kỳ:* Hiển thị các gói cơ bản/cao cấp/đại lễ, chu kỳ thực hiện (hàng tháng, quý, năm) và danh sách công việc kiểm tra (checklist).
  3. *Mẫu Hợp Đồng Pháp Lý:* Quản lý 4 loại hợp đồng chuẩn kèm phụ lục, xem nội dung điều khoản mẫu, nút bump version tăng số phiên bản.
  4. *Bộ Mô Phỏng Tra Cứu Đơn Giá:* Công cụ tra cứu tức thời cho nhân viên kinh doanh theo ngày áp dụng, mã dịch vụ và phạm vi.
  5. *Design System Gallery:* Bảng hướng dẫn phong cách thiết kế tôn nghiêm `#24594D`, typography, các thành phần trạng thái (Empty, Error, Loading).

### 5.4. Ứng Dụng Di Động (Flutter Android)
- Tích hợp tab **"Bảng Giá & Gói CS"** với thanh BottomNavigationBar.
- Điều hướng dựa trên vai trò: Khi chưa đăng nhập, hiển thị thông báo yêu cầu xác thực nhân viên. Khi đã đăng nhập (Marketing, Admin, Accountant), hiển thị đầy đủ danh mục bảng giá và các gói chăm sóc định kỳ với giá tiền VNĐ rõ ràng.
- Xử lý trọn vẹn 4 trạng thái theo quy tắc dự án: `Loading`, `Normal`, `Empty Data` (kèm CTA), `Error` (kèm nút Thử lại).

### 5.5. Kiểm Thử & Quality Gate
- Backend: `uv run pytest` đạt 26/26 bài kiểm thử (100% passed). `uv run ruff check .` All checks passed!
- Web: `pnpm lint` 0 errors, `pnpm build` hoàn tất trong 206ms.
- Mobile: `flutter analyze` 0 issues, `flutter test` đạt 3/3 tests passed.
- Bộ kiểm định chất lượng toàn diện `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 6. Bằng chứng nghiệm thu Milestone M05 (Không Gian, Ô Mộ, Slot và Bản Đồ GIS)

### 6.1. CSDL & Alembic Migration (G04, G05, G06)
- **Revision:** `0005_g04_g05_g06_plots_reservations.py`
  - Đã nâng cấp thành công trên cả `QL_NghiaTrang_Test` và `QL_NghiaTrang` trên `DESKTOP-HKIPI1M`.
  - Mở rộng bảng `plots`: Thêm cột `orientation` (NVARCHAR(50), hướng mộ phong thủy) và `notes` (NVARCHAR(MAX)).
  - Bảng mới `plot_reservations` (G04): Quản lý vòng đời giữ chỗ (`ACTIVE`, `CONVERTED`, `EXPIRED`, `CANCELLED`), mã hợp đồng phát sinh, thời hạn hiệu lực `expires_at`, cùng chỉ mục lọc chống trùng lặp giữ chỗ:
    `CREATE UNIQUE INDEX UQ_plot_reservations_active ON plot_reservations(plot_id) WHERE state = 'ACTIVE'`.
  - Bảng mới `plot_ownerships` (G05): Quản lý chuỗi lịch sử sở hữu ô mộ theo thời gian (`is_current`, `valid_from`, `valid_to`, `transfer_contract_id`), bảo tồn lịch sử pháp lý khi chuyển nhượng.
  - Chỉ mục lọc trên `plot_slots` (G06): Ràng buộc duy nhất trên `current_deceased_id` khi có dữ liệu:
    `CREATE UNIQUE INDEX UQ_plot_slots_current_deceased ON plot_slots(current_deceased_id) WHERE current_deceased_id IS NOT NULL`.
  - Giữ nguyên cấu hình cốt lõi: `implicit_returning=False` trên model `Plot` để tương thích tuyệt đối với trigger bảo toàn Kim Tĩnh của CSDL.

### 6.2. Nghiệp Vụ Backend & Ràng Buộc Miền (PlotService)
- **Quy tắc Kim Tĩnh Bất Biến (Server Invariant):**
  - Mọi thao tác cập nhật ô mộ qua API đều kiểm tra cờ Kim Tĩnh. Nếu ô mộ đã có `is_kim_tinh = True`, hệ thống kiên quyết từ chối mọi yêu cầu hủy cờ Kim Tĩnh (`400 Bad Request: Không thể gỡ bỏ cờ Kim Tĩnh`).
  - Nếu ô mộ đã bị khóa (`is_locked = True`), chặn toàn bộ thay đổi cấu trúc, số slot hoặc thông tin cố định.
- **Tự động sinh Slot trong 1 Transaction ACID (Slot Auto-Generation):**
  - Khi tạo mới một ô mộ với `default_slots = N`, `PlotService` tự động sinh đủ N bản ghi `PlotSlot` (`slot_number` từ 1..N, trạng thái ban đầu `EMPTY`) ngay trong transaction tạo ô mộ, loại bỏ hoàn toàn khả năng ô mộ mồ côi slot.
- **Khóa hàng Chống trùng giữ chỗ (Anti-Double Booking Concurrency Guard G04):**
  - Phương thức `reserve_plot` sử dụng khóa dòng `with_for_update()` của SQLAlchemy trên SQL Server, kiểm tra trạng thái ô mộ và bảng `plot_reservations`.
  - Nếu ô mộ đang có yêu cầu giữ chỗ khác còn hiệu lực hoặc trạng thái ô mộ không phải `EMPTY_UNSOLD`, hệ thống từ chối ngay với lỗi chuẩn `409 Conflict`.
- **Quản lý Vòng đời & Hết hạn Giữ chỗ:**
  - Hỗ trợ hủy giữ chỗ (`cancel_reservation`) hoặc tự động kiểm tra thời hạn hết hạn (`expires_at`), chuyển trạng thái giữ chỗ sang `CANCELLED`/`EXPIRED` và hoàn trả trạng thái ô mộ về `EMPTY_UNSOLD`. Chuẩn hóa múi giờ datetime giữa MSSQL naive và UTC.

### 6.3. Giao Diện Web (React 19 + TypeScript + Leaflet GIS)
- Phân hệ **"Sơ Đồ Ô Mộ"** (`PlotMapModule.tsx`) hoàn chỉnh:
  - Bản đồ tương tác Leaflet 1.9 với tọa độ thực tế nghĩa trang, các marker màu đại diện trực quan cho trạng thái (Xanh: Trống, Vàng: Giữ chỗ, Xanh dương: Đã mua chờ an táng, Tím: Đang xây, Đỏ: Đã chôn, Xám: Đang cải táng).
  - Tích hợp biểu tượng khiên bảo vệ `🛡️` cho ô mộ Kim Tĩnh và biểu tượng ổ khóa `🔒` cho ô mộ đã khóa.
  - Chuyển đổi linh hoạt giữa chế độ Bản đồ (Map View) và chế độ Lưới ô mộ (Grid View).
  - Thanh bộ lọc đa năng: Lọc theo khu vực (Khu A, Khu B, Khu VIP), lọc theo trạng thái, lọc riêng ô Kim Tĩnh, và ô tìm kiếm tức thời theo mã mộ.
  - Drawer trượt hiển thị chi tiết ô mộ: thông tin tọa độ GPS chính xác, loại mộ, hướng phong thủy, chủ sở hữu, danh sách các slot huyệt và thông tin người quá cố trong từng slot.
  - Hộp thoại Giữ chỗ (Reservation Modal) với cơ chế bắt lỗi `409 Conflict` hiển thị cảnh báo tranh chấp giữ chỗ rõ ràng cho người dùng.

### 6.4. Ứng Dụng Di Động (Flutter Android)
- Tích hợp tab **"Sơ Đồ Ô Mộ"** tại BottomNavigationBar (`mobile/lib/main.dart`).
- Tra cứu danh sách ô mộ thực địa theo khu vực (Khu A, Khu B, Khu VIP, Tất cả) kèm thanh tìm kiếm mã mộ tức thời.
- Thẻ ô mộ hiển thị huy hiệu Kim Tĩnh mạ vàng tôn nghiêm, chip trạng thái (Trống / Giữ chỗ / Đã chôn).
- Modal Bottom Sheet hiển thị chi tiết ô mộ phục vụ nhân viên quản trang ngoài hiện trường: tọa độ GPS (kinh độ, vĩ độ), hướng mộ phong thủy, số lượng slot, chủ sở hữu và ghi chú thực địa.
- Xử lý đầy đủ 4 trạng thái chuẩn: Loading shimmer, Normal data list, Empty state với nút làm mới, và Error state.

### 6.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt 32/32 bài kiểm thử (100% passed). `uv run ruff check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` đạt chuẩn hoàn tất trong 234ms.
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt 5/5 tests passed.
- Bộ kiểm định chất lượng toàn diện `scripts/quality-gate.ps1` ĐẠT 100%.



