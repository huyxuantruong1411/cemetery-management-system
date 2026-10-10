# Nhật Ký Thực Thi Dự Án (Project Execution State)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày cập nhật:** 04/10/2026  
**Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)

---

## 1. Trạng thái tổng quan

- **Milestone hiện tại:** Đợt Cải Tiến Giao Diện Theo Actor (Kế hoạch `02_PLAN_ANTIGRAVITY_CAI_THIEN_GIAO_DIEN.md`).
  - **UI-M00 (Baseline & Traceability):** ĐẠT (Done).
  - **Làm sạch UI triển khai thực tế (Section 5.4):** ĐẠT (Done) -> Gỡ bỏ toàn bộ test UI, demo accounts/passwords trên web & mobile, loại bỏ dev health grid và RBAC permissions tag cloud, làm sạch worker triggers/demo PDF, chuyển đổi giao diện công khai P01 sang cổng thông tin tôn nghiêm.
  - **UI-M01 -> UI-M10:** Đang chuẩn bị / chưa hoàn tất trọn vẹn.
- **Trạng thái CSDL:**
  - Máy chủ: `DESKTOP-HKIPI1M`
  - CSDL chính: `QL_NghiaTrang`
  - CSDL kiểm thử: `QL_NghiaTrang_Test` (bảo vệ tuyệt đối CSDL chính)
  - Đã backup an toàn: `backend/runtime/backups/sql/QL_NghiaTrang_M02_baseline.bak`
  - Alembic Head: `0012_g17_report_exports` (đã áp dụng trên cả DB chính và DB test).
  - 37 bảng nghiệp vụ + 12 bảng mở rộng: `auth_sessions` (G01), `file_objects` (G02), `document_versions` (G02), `background_jobs` (G17), `outbox_events` (G17), `contract_templates` (G03), `plot_reservations` (G04), `plot_ownerships` (G05), `construction_task_evidences` (G11), `staff_unavailability` (G13), `idempotency_requests` (G15), `report_exports` (G17) + Mở rộng G12 trên `care_schedules` + Mở rộng G14/G16 trên `receivables`, `discount_records`, `invoices` + Sequence `seq_contract_number` (G09) + Sequence `seq_annex_number` (G10/G18/G20) + Sequence `seq_payment_number` (G15) + Sequence `seq_report_export_number` (G17).
  - Kết nối native qua pyodbc và `ODBC Driver 18 for SQL Server` hoạt động 100%.
- **Hạ tầng lưu trữ:**
  - MinIO Docker Container (`elestio/minio:latest`) đang chạy trên máy.
  - Bind mount trực tiếp vào `D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data` trên ổ D.
- **Bộ công cụ & Chất lượng mã nguồn:**
  - Backend: Python 3.12 (`uv`). 82 tests passed (9 reports/audit + 7 finance + 7 care + 7 construction + 7 lifecycle + 6 contracts + 7 profiles + 6 plots + 6 auth + 6 catalog + 6 documents + 2 jobs + 2 triggers + 4 health/storage), ruff check/format clean.
  - Web: React 19 + TypeScript + Vite (`pnpm`). Build thành công trong 265ms, 0 lint errors.
  - Mobile: Flutter 3.41.6 / Dart 3.11.4 Android. Analyze 0 issues, 14/14 tests passed.
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
| **M06** | Khách hàng, người mất & giấy báo tử | **ĐẠT (Done)** | `v0.7.0-profiles` | G07/G08, quản lý hồ sơ thân nhân, kiểm tra trùng CCCD (409), độ chính xác năm sinh EXACT/YEAR_ONLY, quy trình xác minh giấy báo tử kèm file MinIO, cổng tra cứu công khai Zero PII. |
| **M07** | Luồng mua đất -> ký ngoài -> kích hoạt | **ĐẠT (Done)** | `v0.8.0-land-contracts` | G09, HĐ mua đất, Sequence số HĐ, khóa ô mộ chống double booking, kích hoạt ACID 6 bước (HĐ -> ACTIVE, ô mộ -> OWNED_EMPTY, reservation -> CONVERTED, ownership history, receivable công nợ, outbox event), Web Wizard 4 bước, Flutter Hợp Đồng tab, 45 tests backend, 8 tests mobile. |
| **M08** | An táng, Kim Tĩnh, cải táng, chuyển nhượng | **ĐẠT (Done)** | `v0.9.0-domain-lifecycle` | G10/G18/G20, khóa Kim Tĩnh bất biến (Trigger 51000/51001), phụ lục an táng, kiểm tra giấy báo tử G08, cải táng giải phóng slot, chuyển nhượng quyền sở hữu G05, HĐ hỏa táng độc lập G18. |
| **M09** | Quản lý thi công thực địa | **ĐẠT (Done)** | `v0.10.0-construction` | G11/G13, checklist công trình, bằng chứng ảnh MinIO READY, phân công thợ kiểm tra xung đột lịch nghỉ, nghiệm thu an toàn không đổi trạng thái an táng. |
| **M10** | Chăm sóc định kỳ & mobile offline | **ĐẠT (Done)** | `v0.11.0-care` | G12, sinh lịch định kỳ idempotent, neo ngày cuối tháng, Quản trang checklist, minh chứng ảnh MinIO, đóng ca G12 gate. |
| **M11** | Công nợ, thu tiền, chiết khấu, biên lai | **ĐẠT (Done)** | `v0.12.0-finance` | G14-G16, ràng buộc XOR nguồn thu, Idempotency payment chống trùng, chiết khấu chuẩn hóa, xuất biên lai PDF tiếng Việt UTF-8 MinIO. |
| **M12** | Báo cáo, tra cứu công khai & audit | **ĐẠT (Done)** | `v0.13.0-feature-complete` | 4 báo cáo thống kê chuyên sâu (Doanh thu, Lấp đầy, Hợp đồng, Vận hành), phòng chống Excel Formula Injection, xuất PDF/XLSX MinIO, audit log viewer & redact sensitive secrets, tra cứu người mất công khai kèm dẫn đường Google Maps. |
| **M13** | Kiểm thử hệ thống, UX & khôi phục | Chưa bắt đầu | `v1.0.0-rc.1` | Regression toàn diện, test tải, backup/restore CSDL + S3 đối soát. |
| **M14** | Bàn giao và phát hành | Chưa bắt đầu | `v1.0.0` | Scripts vận hành, tài liệu bàn giao, APK thử nghiệm, release manifest. |

### 2.1. Đợt Cải Tiến Giao Diện & Phân Quyền Theo Actor (UI-M00 - UI-M10)

| Milestone | Tên Milestone | Trạng thái | Gợi ý Commit / Tag | Ghi chú & Bằng chứng |
|---|---|---|---|---|
| **UI-M00** | Baseline, 39 UC, policy, quyết định, fixture an toàn | **ĐẠT (Done)** | `docs(ui): establish lab actor traceability` | Nhánh `ui/lab-actor-alignment`, baseline.md, traceability.csv, actor-policy.md, route-inventory.md, decisions.md, api-ui-contracts.md, acceptance.md. |
| **UI-M01** | Ma trận capability và hợp đồng dữ liệu API/File ACL | Đang thực hiện | `fix(auth): enforce actor and resource access` | Siết chặt role permissions, loại bỏ admin bypass invariant, tạo Work Basis DTO, Finance Basis DTO. |
| **UI-M02** | Design system, routing và cổng công khai (Public Portal) | Chưa bắt đầu | `feat(ui): add public portal and role workspaces` | Cổng công khai P01-P04 Zero PII, bố cục 4 Actor workspaces, URL router. |
| **UI-M03** | Hồ sơ, 4 loại HĐ, 3 loại phụ lục, in/ký ngoài/scan | Chưa bắt đầu | `feat(contracts): complete actor based legal journeys` | M01-M10 hoàn chỉnh luồng pháp lý. |
| **UI-M04** | Nhiều quản trang, nhân sự đa tầng, lịch khả dụng | Chưa bắt đầu | `feat(operations): separate supervisors and executors` | Q10, phân tách supervisor vs work party, xử lý xung đột. |
| **UI-M05** | Thi công thực địa đầy đủ checklist, bằng chứng, tiến độ | Chưa bắt đầu | `feat(construction): complete coordination workflow` | Q01-Q05, tách nghiệm thu thi công khỏi an táng. |
| **UI-M06** | Chăm sóc mộ định kỳ, xung đột ca & kết quả công khai | Chưa bắt đầu | `feat(care): complete scheduling and public results` | Q06-Q08 -> P03, quy trình publication Zero PII. |
| **UI-M07** | Không gian ô mộ, Kim Tĩnh & Flutter hiện trường | Chưa bắt đầu | `feat(field): align plot and mobile workflows` | S02, S03, Q09, mobile đồng bộ API thật. |
| **UI-M08** | Sếp, tài khoản, phân quyền, bảng giá & báo cáo | Chưa bắt đầu | `feat(admin): complete management workspace` | S01-S09, A01-A03 quản trị hệ thống. |
| **UI-M09** | Kế toán, thu tiền, biên lai, chiết khấu & báo cáo tài chính | Chưa bắt đầu | `feat(finance): complete accountant journeys` | K01-K06 kiểm soát nợ và dòng tiền. |
| **UI-M10** | Kiểm thử chấp nhận AT01-AT30, UAT 39 UC, hoàn tất bàn giao | Chưa bắt đầu | `test(ui): verify lab actor journeys` | Nghiệm thu toàn diện 39 UC. |

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

---

## 7. Bằng chứng nghiệm thu Milestone M06 (Hồ Sơ Khách Hàng, Người Mất & Giấy Báo Tử)

### 7.1. CSDL & Alembic Migration (G07, G08)
- **Revision:** `0006_g07_g08_profiles_certificates.py`
  - Đã nâng cấp thành công trên cả `QL_NghiaTrang_Test` và `QL_NghiaTrang` trên `DESKTOP-HKIPI1M`.
  - Mở rộng bảng `customers`: Thêm cột `date_of_birth` (DATE, nullable).
  - Mở rộng bảng `deceased_profiles`: Thêm `birth_year` (INTEGER, nullable) và `birth_date_precision` (VARCHAR(10), giá trị: 'EXACT', 'YEAR_ONLY', 'UNKNOWN'). Đảm bảo không bịa đặt ngày tháng "01/01" khi chỉ biết năm sinh (G07).
  - Cải tiến bảng `death_certificates` (G08):
    - Đổi giá trị mặc định của `is_verified` từ 1 thành 0 (chưa xác minh).
    - Cột `verified_at` cho phép `NULL`.
    - Thêm `verified_by` (FK đến `users(user_id)`).
    - Thêm `rejection_reason` (NVARCHAR(255)) để ghi nhận lý do từ chối giấy báo tử không hợp lệ.
    - Thêm `file_id` (VARCHAR(64), FK đến `file_objects(file_id)`) liên kết trực tiếp với MinIO S3 object storage.
    - Thêm `notes` (NVARCHAR(MAX)).

### 7.2. Nghiệp Vụ Backend & Ràng Buộc Miền (ProfileService)
- **Kiểm soát trùng lặp CCCD/CMND:** Khi tạo khách hàng mới, kiểm tra tính duy nhất của số CCCD trên hệ thống. Nếu trùng, ném lỗi chuẩn `409 Conflict: Số CCCD/CMND đã tồn tại`.
- **Ràng buộc thời gian sống (G07 Invariant):** Pydantic model validator kiểm tra nghiêm ngặt `date_of_birth <= date_of_death` và `birth_year <= date_of_death.year`.
- **Quy trình Phê duyệt Giấy báo tử (G08 Pre-Burial Verification):**
  - Cung cấp hàm nghiệp vụ `verify_certificate(cert_id, is_verified, verifier_user_id, rejection_reason)` cập nhật thời điểm và người duyệt.
  - Cung cấp hàm tiền điều kiện an táng `check_death_certificate_verified(deceased_id)` làm chốt chặn bảo mật (Server Invariant) trước khi an táng ô mộ.
- **Cổng Tra cứu Công Khai Tuyệt Đối Bảo Mật PII (G19 & ADR-001):**
  - Endpoint `/api/v1/profiles/public/memorials?q=` cho phép thân nhân và khách viếng tra cứu vị trí ô mộ, hàng, khu vực, năm sinh/năm mất và thông điệp tưởng niệm.
  - Tuyệt đối KHÔNG trả về số CCCD, số điện thoại, địa chỉ thân nhân hay bản scan giấy báo tử trên cổng công khai.
- **Bộ dữ liệu mẫu Synthetic Seed:** Script `backend/scripts/seed_profiles.py` nạp 3 khách hàng, 3 người quá cố (với cả 2 độ chính xác EXACT và YEAR_ONLY), 3 giấy báo tử (đã duyệt, chờ duyệt, từ chối) và phân bổ huyệt mộ mẫu.

### 7.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Hồ Sơ & Tưởng Niệm"** (`ProfileModule.tsx`) với 3 chế độ xem:
  - **Quản lý Thân Nhân (Khách Hàng):** Danh sách khách hàng, tìm kiếm đa tiêu chí (tên, CCCD, SĐT), modal thêm mới khách hàng có kiểm tra CCCD, hiển thị các tag người quá cố có quan hệ thân nhân kèm huy hiệu "★ Đại diện".
  - **Hồ Sơ Người Quá Cố & Giấy Báo Tử:** Hiển thị thẻ người mất với độ chính xác năm sinh (G07), banner trạng thái giấy báo tử 4 màu (Đã duyệt / Chờ duyệt / Bị từ chối / Chưa nộp). Nút duyệt nhanh hoặc từ chối kèm nhập lý do từ chối.
  - **Cổng Tra Cứu Tưởng Niệm Công Khai:** Giao diện trang trọng, tông màu xanh ngọc - vàng cát tôn nghiêm, thanh tìm kiếm nhanh kèm các tag gợi ý (Nguyễn, Trần, Lê, A1), thẻ tưởng niệm hiển thị vị trí an táng chuẩn xác kèm huy hiệu Kim Tĩnh mạ vàng.
- Xử lý trọn vẹn 4 trạng thái giao diện: Loading spinner, Normal list, Empty data với CTA "Thử từ khóa khác" / "Làm mới", và Error state với nút thử lại.

### 7.4. Ứng Dụng Di Động (Flutter Android)
- Tích hợp tab **"Hồ Sơ & Tra Cứu"** trên BottomNavigationBar (`mobile/lib/main.dart`):
  - Sub-tab 1: **Tra Cứu Tưởng Niệm** (Công khai không cần đăng nhập). Hỗ trợ tìm kiếm nhanh họ tên hoặc mã mộ, hiển thị thông tin an táng, năm sinh/mất, vị trí hàng/lô/khu vực ngoài trời, cam kết bảo mật Zero PII.
  - Sub-tab 2: **Thân Nhân (KH)** (Yêu cầu đăng nhập nghiệp vụ). Hiển thị danh sách khách hàng, số CCCD, liên kết thân nhân và người đại diện gia đình.
  - Sub-tab 3: **Quá Cố & Giấy Báo Tử** (Yêu cầu đăng nhập nghiệp vụ). Hiển thị độ chính xác ngày sinh (EXACT vs YEAR_ONLY - G07), vị trí slot an táng và trạng thái phê duyệt giấy báo tử (G08).
- Áp dụng `SingleChildScrollView` trên các card xác thực và trạng thái rỗng, đảm bảo không bao giờ bị lỗi tràn viền (RenderFlex overflow) trên mọi kích thước màn hình.
- Bổ sung 2 widget tests chuyên biệt cho M06 trong `mobile/test/widget_test.dart`.

### 7.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt 39/39 bài kiểm thử (100% passed, bao gồm 7 test cases mới cho M06). `uv run ruff check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất trong 241ms.
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt 7/7 tests passed.
- Bộ kiểm định chất lượng toàn diện `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 8. Bằng chứng nghiệm thu Milestone M07 (Hợp Đồng Mua Đất -> Ký Ngoài -> Kích Hoạt ACID)

### 8.1. CSDL & Alembic Migration (G09)
- **Revision:** `0007_g09_contracts_workflow.py`
  - Đã nâng cấp thành công trên cả `QL_NghiaTrang_Test` và `QL_NghiaTrang` trên `DESKTOP-HKIPI1M`.
  - Tạo Database Sequence `seq_contract_number` (bắt đầu từ 1001) phục vụ sinh mã số hợp đồng tuần tự chống xung đột race-condition: `HD-MD-YYYY-NNNN`.
  - Mở rộng bảng `contracts`:
    - `signed_at` (DATE, nullable): Ngày ký thực tế trên bản giấy có chữ ký thân nhân.
    - `activated_at` (DATETIME2, nullable): Thời điểm kích hoạt giao dịch trên hệ thống.
    - `activated_by` (INT, FK đến `users(user_id)`).
    - `activation_notes` (NVARCHAR(MAX)).
    - `template_id` (INT, FK đến `contract_templates(template_id)`).
    - `template_version` (INT).
    - `signed_scan_file_id` (VARCHAR(64), FK đến `file_objects(file_id)`).
    - `notes` (NVARCHAR(MAX)).
  - Bổ sung FK `contract_id` trên `plot_reservations` để liên kết chính xác vòng đời giữ chỗ phát sinh từ hợp đồng.

### 8.2. Nghiệp Vụ Backend & Ràng Buộc Miền (ContractService)
- **Khóa hàng Chống Double-Booking (G04 & G09 Concurrency Guard):**
  - Khi lập hợp đồng mua đất, hệ thống thực hiện `with_for_update()` khóa tức thời ô mộ, kiểm tra trạng thái khả dụng `EMPTY_UNSOLD` và kiểm tra `plot_reservations` đang `ACTIVE`. Nếu ô mộ đang được giữ hoặc không khả dụng, ném lỗi chuẩn `409 Conflict`.
- **Snapshot Đơn Giá Tự Động (G03/G09 Price Snapshot):**
  - Tự động tra cứu biểu giá niêm yết đang có hiệu lực (`effective_from_date <= today <= effective_to_date`) từ bảng `price_lists` và `price_items` tương ứng với loại mộ của ô đất, hoặc áp dụng đơn giá thỏa thuận đặc biệt.
- **Quy Trình Chuyển Đổi Ký Ngoài (G09 Signing Workflow):**
  - Chuyển trạng thái hợp đồng sang `PENDING_SIGN` để xuất in văn bản trình thân nhân ký kết.
  - Xuất bản in hợp đồng PDF định dạng tiếng Việt UTF-8 (Arial) chuẩn mực pháp lý via ReportLab.
- **Kích Hoạt Hợp Đồng Toàn Vẹn ACID 6 Bước (G09 Activation Invariant):**
  - Thực hiện trong 1 transaction ACID duy nhất khi thân nhân đã nộp bản scan hợp đồng có chữ ký:
    1. Cập nhật hợp đồng: `status = 'ACTIVE'`, lưu `signed_scan_file_id`, `signed_at`, `activated_at`, `activated_by`.
    2. Cập nhật ô mộ: `status = 'OWNED_EMPTY'` (Đất trống đã có chủ sở hữu), gán `owner_id = customer_id`.
    3. Cập nhật giữ chỗ: Chuyển `plot_reservations.state = 'CONVERTED'`.
    4. Ghi nhận chuỗi lịch sử quyền sở hữu: Tạo bản ghi `PlotOwnership` (G05).
    5. Tự động sinh nghĩa vụ tài chính: Tạo bản ghi `Receivable` (G14) trạng thái `UNPAID` với hạn thanh toán 30 ngày.
    6. Phát sinh sự kiện Outbox: Tạo `OutboxEvent` (`CONTRACT_ACTIVATED`) (G17) và ghi `AuditLog`.
- **Tính Bất Biến & Idempotency:**
  - Lặp lại lời gọi `activate_contract` khi hợp đồng đã `ACTIVE` trả về ngay kết quả mà không sinh thêm trùng lặp công nợ hay lịch sử sở hữu.
  - Hủy hợp đồng dự thảo (`cancel_contract`): Giải phóng ô mộ trở về `EMPTY_UNSOLD`, chuyển giữ chỗ sang `CANCELLED`.

### 8.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Hợp Đồng & Khách Hàng"** (`ContractModule.tsx`):
  - **KPI Dashboard Cards:** Thống kê tổng hợp đồng, hợp đồng đang hiệu lực, hợp đồng chờ ký kết/dự thảo, tổng doanh thu hiệu lực.
  - **Bảng Danh Sách Hợp Đồng:** Tìm kiếm đa tiêu chí (mã HĐ, tên KH, SĐT, mã ô), bộ lọc trạng thái (Tất cả, Dự thảo, Chờ ký, Hiệu lực, Đã hủy), chip trạng thái trực quan, nút xem chi tiết và tải nhanh PDF.
  - **4-Step Land Purchase Wizard Modal:**
    - Bước 1: Tra cứu & chọn khách hàng đứng tên.
    - Bước 2: Chọn ô mộ trống khả dụng (lọc theo khu vực, kiểm tra trạng thái tức thời).
    - Bước 3: Thiết lập đơn giá đất (áp dụng tự động theo bảng giá niêm yết hoặc thỏa thuận) và điều khoản thỏa thuận.
    - Bước 4: Tóm tắt rà soát toàn bộ thông tin hợp đồng và xác nhận phát hành dự thảo.
  - **Modal Chi Tiết Hợp Đồng & Thao Tác Nghiệp Vụ:**
    - Hiển thị thẻ khách hàng, thẻ ô mộ, bảng công nợ tài chính (Receivable), lịch sử phê duyệt.
    - Các nút hành động nghiệp vụ theo vai trò: In hợp đồng PDF UTF-8, Chuyển chờ ký, Kích hoạt hợp đồng kèm upload file scan MinIO, Hủy dự thảo giải phóng ô đất.
  - Xử lý trọn vẹn 4 trạng thái giao diện: Loading, Normal, Empty với CTA, Error với nút thử lại.

### 8.4. Ứng Dụng Di Động (Flutter Android)
- Bổ sung tab **"Hợp Đồng"** thứ 5 trên BottomNavigationBar (`mobile/lib/main.dart`):
  - Tra cứu danh sách hợp đồng thực địa kèm thanh tìm kiếm và các chip lọc trạng thái (`Tất cả`, `Dự thảo`, `Chờ ký`, `Hiệu lực`, `Đã hủy`).
  - Thẻ hợp đồng hiển thị mã HĐ, tên khách hàng, SĐT, mã ô mộ, giá trị tiền tệ VND định dạng chuẩn và chip màu trạng thái.
  - Modal Bottom Sheet hiển thị chi tiết hợp đồng cho cán bộ kinh doanh / quản trang thực địa: loại hợp đồng, vị trí đất, số tiền, ngày ký, ngày kích hoạt.
  - Xử lý đầy đủ 4 trạng thái giao diện (Loading, Normal, Empty, Error).
  - Bổ sung widget test `CemeteryMobileApp contracts tab authenticated displays contracts list and opens detail sheet test` trong `mobile/test/widget_test.dart`.

### 8.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt 45/45 bài kiểm thử (100% passed, bao gồm 6 test cases mới cho M07). `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất trong 249ms.
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt 8/8 tests passed.
- Toàn bộ bộ kiểm tra chất lượng tự động `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 9. Bằng chứng nghiệm thu Milestone M08 (Vòng Đời An Táng, Kim Tĩnh Bất Biến, Cải Táng, Chuyển Nhượng & Hỏa Táng Độc Lập)

### 9.1. CSDL & Alembic Migration (G10, G18, G20)
- **Revision:** `0008_g10_g18_g20_lifecycle_annexes.py`
  - Đã nâng cấp thành công trên cả `QL_NghiaTrang_Test` và CSDL thực tế `QL_NghiaTrang` trên `DESKTOP-HKIPI1M`.
  - Tạo Database Sequence `seq_annex_number` (bắt đầu từ 1001) phục vụ sinh số phụ lục tuần tự: `PL-AT-YYYY-NNNN`.
  - Tạo bảng `contract_annexes` (G10): Lưu thông tin phụ lục hợp đồng (`annex_id`, `contract_id`, `annex_number`, `annex_type`, `annex_date`, `status`, `total_amount`, `signed_at`, `signed_scan_file_id`, `activated_at`, `activated_by`).
  - Tạo bảng `burial_annex_details` (G10): Chi tiết an táng gắn với phụ lục (`annex_id`, `slot_id`, `deceased_id`, `is_kim_tinh`, `burial_depth_m`, `notes`).
  - Tạo bảng `exhumation_details` (G20): Chi tiết cải táng gắn với hợp đồng (`contract_id`, `plot_id`, `slot_id`, `deceased_id`, `exhumation_date`, `reason`, `destination_cemetery`, `reburial_type`, `is_completed`).
  - Tạo bảng `transfer_details` (G20): Chi tiết chuyển nhượng quyền sử dụng đất (`contract_id`, `plot_id`, `prior_owner_id`, `new_owner_id`, `transfer_fee`, `reason`, `is_completed`).
  - Tạo bảng `cremation_details` (G18): Chi tiết dịch vụ hỏa táng độc lập (`contract_id`, `deceased_id`, `cremation_date`, `urn_type`, `ashes_disposition`, `urn_storage_location`, `notes`).
  - Mở rộng model ORM `Plot`: bổ sung trường `is_locked` (Boolean).

### 9.2. Nghiệp Vụ Backend & Ràng Buộc Miền (Lifecycle & Domain Invariants)
- **Quy tắc Kim Tĩnh Bất Biến (Server Invariant & DB Triggers):**
  - Khi kích hoạt an táng Kim Tĩnh (`is_kim_tinh = True`), ô mộ được khóa vĩnh viễn mức CSDL (`is_kim_tinh = True`, `is_locked = True`).
  - Trigger `trg_plots_enforce_kim_tinh_immutability` trên MSSQL kiên quyết chặn:
    - Mọi hành vi hạ cờ khóa (`is_locked` 1 -> 0, lỗi 51001: *"Khong the mo khoa o mo Kim Tinh"*).
    - Mọi hành vi cải táng ô Kim Tĩnh (`status = 'UNDER_EXHUMATION'`, lỗi 51000: *"Khong duoc phep cai tang o mo Kim Tinh"*).
  - Tầng Service và Frontend tự động chặn và cảnh báo không cho phép lập cải táng hay chuyển nhượng trên ô Kim Tĩnh.
- **Kiểm soát Giấy Báo Tử Bắt Buộc (G08 Pre-Burial Verification):**
  - Mọi yêu cầu tạo phụ lục an táng hoặc hợp đồng hỏa táng đều kiểm tra điều kiện tiên quyết: `ProfileService.check_death_certificate_verified(db, deceased_id) == True`. Nếu chưa duyệt hoặc bị từ chối, ném lỗi `400 Bad Request`.
- **Ràng Buộc Duy Nhất Slot Cho Người Quá Cố (Slot Occupancy Invariant):**
  - Một người quá cố không được phép an táng đồng thời tại 2 slot khác nhau (`409 Conflict: Nguoi mat da duoc an tang o vi tri khac`).
- **Cải Táng & Giải Phóng Slot (G20 Exhumation Workflow):**
  - Khi hoàn tất hợp đồng cải táng (`complete_exhumation_contract`):
    - Slot huyệt được dọn sạch và hoàn trả: `status = 'EMPTY'`, `current_deceased_id = NULL`, `burial_date = NULL`.
    - Ô mộ cập nhật trạng thái tương ứng: nếu còn người mất ở slot khác -> `OCCUPIED`, nếu không còn ai -> `OWNED_EMPTY`.
    - Ô đất vẫn bảo lưu chủ sở hữu hợp pháp (`owner_id` không đổi).
- **Chuyển Nhượng Quyền Sở Hữu Toàn Vẹn ACID (G20 Transfer Chain & G05):**
  - Chỉ cho phép chuyển nhượng trên ô mộ `OWNED_EMPTY`, không có người an táng và không phải Kim Tĩnh.
  - Khi hoàn tất chuyển nhượng (`complete_transfer_contract`):
    - Đóng bản ghi sở hữu cũ (`valid_to = now`, `is_current = False`).
    - Tạo bản ghi sở hữu mới cho bên nhận chuyển nhượng (`PlotOwnership`).
    - Cập nhật ô mộ: `owner_id = buyer_id`.
    - Sinh nghĩa vụ tài chính phí chuyển nhượng (`Receivable`).
    - Phát sinh `OutboxEvent` (`TRANSFER_COMPLETED`).
- **Hợp Đồng Hỏa Táng Độc Lập (G18 Standalone Cremation):**
  - Tạo hợp đồng hỏa táng độc lập không cần mua đất nghĩa trang, kiểm tra giấy báo tử, cập nhật chi tiết xử lý tro cốt (`urn_storage_location`, `ashes_disposition`).
- **Kích Hoạt Phụ Lục An Táng Kèm Tệp Scan MinIO:**
  - Kích hoạt phụ lục an táng: cập nhật slot sang `OCCUPIED`, gán `current_deceased_id`, ngày an táng, và ô mộ sang `OCCUPIED`. Nếu là Kim Tĩnh -> khóa vĩnh viễn `is_kim_tinh = True, is_locked = True`.
  - Sinh nghĩa vụ tài chính cho phụ lục và phát `OutboxEvent` (`BURIAL_ANNEX_ACTIVATED`).

### 9.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Hợp Đồng & Phụ Lục Vòng Đời"** (`ContractModule.tsx`):
  - Bảng chính hiển thị 5 loại hợp đồng với các badge chuyên biệt: `Mua Đất`, `Cải Táng`, `Chuyển Nhượng`, `Hỏa Táng`, `Dịch Vụ`.
  - Thanh công cụ bổ sung 4 nút tạo mới nghiệp vụ: `+ Mua Đất`, `+ Cải Táng`, `+ Chuyển Nhượng`, `+ Hỏa Táng`.
  - Modal Chi Tiết Hợp Đồng hiển thị thẻ chuyên biệt cho từng loại hợp đồng: Thẻ cải táng (slot, người mất, lý do, nghĩa trang đến), Thẻ chuyển nhượng (bên chuyển, bên nhận, phí chuyển nhượng), Thẻ hỏa táng (ngày hỏa táng, xử lý tro cốt).
  - Mục **"Phụ Lục Hợp Đồng (Contract Annexes)"**: danh sách phụ lục đã lập, hiển thị số phụ lục, số tiền, ngày lập, badge Kim Tĩnh mạ vàng, nút tải file scan có chữ ký từ MinIO, nút "Trình Ký", và nút "Kích Hoạt Phụ Lục".
  - 5 Modals nghiệp vụ tương tác cao:
    - `BurialAnnexModal`: Chọn slot trống, người mất đã duyệt giấy báo tử (G08), tùy chọn Kim Tĩnh kèm cảnh báo không thể hoàn tác.
    - `AnnexActivateModal`: Tải lên bản scan phụ lục có chữ ký lưu trực tiếp MinIO.
    - `ExhumationModal`: Chọn ô mộ không phải Kim Tĩnh, slot có người mất, nhập nghĩa trang di dời và hình thức cải táng.
    - `TransferModal`: Chọn ô đất trống có chủ sở hữu, người mua mới, phí chuyển nhượng và lý do.
    - `CremationModal`: Chọn người mất đã duyệt giấy báo tử, cơ sở hỏa táng và nơi lưu tro cốt.

### 9.4. Ứng Dụng Di Động (Flutter Android)
- Cập nhật phân hệ **"Hợp Đồng"** trong `mobile/lib/main.dart`:
  - Hàm helper `_getContractTypeName` và `_getContractTypeShort` hỗ trợ đầy đủ 5 phân loại hợp đồng.
  - Thẻ hợp đồng trên danh sách thực địa hiển thị chip phụ loại hợp đồng (`Mua Đất`, `Cải Táng`, `Chuyển Nhượng`, `Hỏa Táng`, `Dịch Vụ`) bên cạnh trạng thái hiệu lực.
  - Bottom sheet chi tiết hợp đồng hiển thị tên loại hợp đồng được bản địa hóa tiếng Việt trang nghiêm.
  - Bộ kiểm thử widget (`mobile/test/widget_test.dart`) chạy vượt qua 100% với 8 tests.

### 9.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt 52/52 bài kiểm thử (100% passed, bao gồm 7 test cases chuyên sâu trong `test_lifecycle.py`). `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất trong 265ms (0 build errors).
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt 8/8 tests passed.
- Toàn bộ bộ kiểm tra chất lượng tự động `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 10. Bằng chứng nghiệm thu Milestone M09 (Quản lý thi công thực địa, Task Evidence & Lịch công tác)

### 10.1. CSDL & Migration (G11 & G13)
- Migration: `0009_g11_g13_construction_evidence_scheduling.py`
  - Đã apply thành công trên cả 2 CSDL: `QL_NghiaTrang` và `QL_NghiaTrang_Test`.
  - Mở rộng bảng `construction_tasks`: `is_required` (G11), `sort_order`, `assignee_user_id`, `start_date`, `due_date`, `completed_by`.
  - Bổ sung `notes` cho `construction_orders`.
  - Tạo mới bảng `construction_task_evidences` (G11): lưu ảnh hiện trường nghiệm thu, liên kết `file_objects(file_id)` trên MinIO, `users(user_id)`.
  - Tạo mới bảng `staff_unavailability` (G13): theo dõi lịch nghỉ phép, công tác của nhân sự thi công.

### 10.2. Quy Tắc Miền Nghiệp Vụ & Server-side Invariants
- **Gate Invariant 1 (Annex Active Check):** Không thể tạo lệnh thi công từ phụ lục chưa được kích hoạt (`annex.status != 'ACTIVE'` trả về `400 Bad Request`).
- **Gate Invariant 2 (G11 MinIO Ready Evidence):** Chỉ chấp nhận minh chứng ảnh ở trạng thái `READY`. Tệp ở trạng thái `STAGING`, `UPLOADING` hoặc `QUARANTINED` bị từ chối lập tức.
- **Gate Invariant 3 (G11 Required Tasks Incomplete Block):** Nếu còn hạng mục bắt buộc (`is_required == True` và chưa `DONE`), tiến độ không thể đạt 100% (bị chặn tối đa ở 99%) và lệnh hoàn tất thi công bị hủy bỏ (`400 Bad Request`).
- **Gate Invariant 4 (Crucial Domain Rule - Trạng thái an táng không bị thay đổi tự động):** Hoàn tất công trình thi công KHÔNG BAO GIỜ tự ý đổi trạng thái ô mộ hoặc slot sang `OCCUPIED`. Nếu ô mộ đang là `UNDER_CONSTRUCTION`, ô sẽ hoàn trả về `OWNED_EMPTY` (nếu chưa có người an táng) hoặc `OCCUPIED` (nếu đã có người an táng từ trước).
- **Gate Invariant 5 (G13 Conflict Warning):** Giao việc hoặc lập lệnh trùng thời gian nhân viên nghỉ phép/bận sẽ phát sinh cảnh báo xung đột lịch trực quan.

### 10.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Thi Công Thực Địa"** (`ConstructionModule.tsx`):
  - Tab riêng biệt trên thanh điều hướng với icon công trình, yêu cầu quyền `construction:read`.
  - Bảng lệnh thi công kèm 4 thẻ KPI tóm tắt (Tổng lệnh, Đang làm, Chờ duyệt, Hoàn tất).
  - Modal chi tiết lệnh: sắp xếp thứ tự hạng mục (`sort_order`), cập nhật trạng thái `TODO` -> `DOING` -> `DONE`.
  - Modal tải lên minh chứng hiện trường (G11) đẩy trực tiếp vào MinIO và kiểm tra mã SHA-256.
  - Phân hệ quản lý lịch nghỉ / bận của nhân viên (G13) với cảnh báo xung đột thời gian thực.
  - Xử lý trọn vẹn 4 trạng thái giao diện chuẩn: `Loading`, `Normal`, `Empty Data` (kèm CTA), `Error` (kèm nút Thử lại).

### 10.4. Ứng Dụng Di Động (Flutter Android)
- Tích hợp phân hệ **"Thi Công"** (`mobile/lib/main.dart`):
  - Tab thứ 6 trong thanh điều hướng dưới cùng với biểu tượng `Icons.handyman`.
  - Danh sách lệnh thi công có badge trạng thái, thanh tiến độ % công việc, huy hiệu cảnh báo minh chứng bắt buộc `G11 Minh chứng`.
  - Bottom sheet chi tiết lệnh: danh sách checklist nhiệm vụ, đánh dấu hạng mục bắt buộc, hiển thị số lượng ảnh minh chứng kèm theo.
  - Bộ kiểm thử widget (`mobile/test/widget_test.dart`) bổ sung 2 test cases mới cho phân hệ thi công, nâng tổng số test lên 10/10 passed 100%.

### 10.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt **59/59 bài kiểm thử** (100% passed, bao gồm 7 test cases chuyên sâu trong `test_construction.py`). `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất sạch sẽ trong 261ms (0 build errors).
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt **10/10 tests passed**.
- Bộ kiểm tra chất lượng tự động `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 11. Bằng chứng nghiệm thu Milestone M10 (Chăm Sóc Định Kỳ & Mobile Quản Trang)

### 11.1. CSDL & Migration (G12)
- Migration: `0010_g12_care_schedules_period_evidence.py`
  - Đã apply thành công trên cả 2 CSDL: `QL_NghiaTrang` và `QL_NghiaTrang_Test`.
  - Mở rộng bảng `care_schedules`: `period_key` (String 50, định dạng `YYYY-Mmm`), `notes` (NVARCHAR MAX), `completed_by_id` (ForeignKey `users.user_id`).
  - Tạo Unique Constraint `uq_care_schedule_annex_period` trên cặp `(care_annex_id, period_key)` đảm bảo tính bất biến (idempotent) khi chạy bộ sinh lịch định kỳ nhiều lần.
  - Mở rộng bảng `care_checklist_items`: `is_required` (Boolean, default 1), `sort_order` (Integer, default 0).
  - Mở rộng bảng `care_media_evidences`: `file_id` (String 64, ForeignKey `file_objects.file_id`), `uploaded_by_user_id` (ForeignKey `users.user_id`).

### 11.2. Quy Tắc Miền Nghiệp Vụ & Server-side Invariants
- **Quy tắc neo ngày cuối tháng (End-of-Month Anchor Rule):** Hợp đồng bắt đầu vào ngày 31, khi sinh lịch cho tháng 2 (28/29 ngày) hoặc tháng 4/6/9/11 (30 ngày) sẽ tự động neo vào ngày cuối tháng, nhưng vẫn bảo toàn mốc ngày 31 cho các tháng có 31 ngày (tháng 3, tháng 5...).
- **Tính bất biến khi sinh lịch định kỳ (Idempotent Generator):** API `POST /api/v1/care/schedules/generate` có thể chạy nhiều lần cho cùng một tháng mà không sinh trùng lịch công việc, trả về chính xác số ca được sinh mới và số ca bị bỏ qua (skipped count).
- **Cảnh báo xung đột lịch công tác (G13):** Khi phân công ca chăm sóc cho nhân viên (`/care/schedules/{id}/assign`), hệ thống tự động đối chiếu với bảng `staff_unavailability` và trả về cờ `has_conflict` kèm lý do chi tiết nếu nhân viên đang nghỉ phép.
- **Cổng nghiệm thu đóng ca (G12 Gate Invariants):**
  - **Gate Invariant 1 (Required Tasks):** Nghiêm cấm đóng ca nếu còn bất kỳ hạng mục công việc nào được đánh dấu `is_required == True` mà chưa hoàn tất (`400 Bad Request` nêu rõ tên các hạng mục còn thiếu).
  - **Gate Invariant 2 (Photo Evidence):** Bắt buộc phải có ít nhất 1 ảnh minh chứng hiện trường ở trạng thái `READY` trên MinIO (`400 Bad Request` nếu thiếu ảnh).
  - **Trạng thái đóng ca:** Chuyển trạng thái ca sang `CLOSED` (tuân thủ CHECK constraint `CK_cs_status` của CSDL gốc), cập nhật `closed_at`, `completed_by_id`, phát sinh Outbox event `CARE_SCHEDULE_CLOSED` và ghi `AuditLog`.

### 11.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Chăm Sóc Mộ Phần"** (`CareModule.tsx`):
  - Tích hợp trực tiếp vào thanh điều hướng chính `activeTab === 'care'`.
  - 6 thẻ KPI thống kê trực quan: Tổng ca, Chờ chỉ định, Đã chỉ định, Đang thực hiện, Đã đóng ca (G12), Quá hạn.
  - Thanh lọc theo kỳ (`YYYY-Mmm`), trạng thái và ô tìm kiếm tức thời theo mã mộ, khu, nhân viên.
  - Modal sinh lịch định kỳ theo tháng/năm tự động.
  - Drawer chi tiết ca chăm sóc: giao việc cho nhân viên, checklist tương tác với huy hiệu [Bắt buộc], thư viện ảnh hiện trường MinIO, nút nghiệm thu đóng ca với hướng dẫn điều kiện G12.
  - Đáp ứng trọn vẹn 4 trạng thái giao diện: `Loading`, `Normal`, `Empty Data` (kèm CTA sinh lịch), `Error`.

### 11.4. Ứng Dụng Di Động (Flutter Android)
- Tích hợp phân hệ **"Chăm Sóc"** (`mobile/lib/main.dart`):
  - Tab thứ 7 trên BottomNavigationBar với biểu tượng `Icons.cleaning_services`.
  - Thẻ tóm tắt KPI 4 chỉ số và danh sách ca chăm sóc định kỳ với mã ô mộ, gói dịch vụ, tiến độ việc/ảnh.
  - Bottom sheet chi tiết ca: kiểm tra checklist việc cần làm, đánh dấu [Bắt buộc], ghi nhận hiện trạng.
  - Bộ kiểm thử widget (`mobile/test/widget_test.dart`) bổ sung 2 test cases mới cho phân hệ chăm sóc, nâng tổng số test lên **12/12 tests passed**.

### 11.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt **66/66 bài kiểm thử** (100% passed, bao gồm 7 test cases chuyên sâu trong `test_care.py`). `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất sạch sẽ trong 259ms.
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt **12/12 tests passed**.
- Bộ kiểm tra chất lượng tự động `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 12. Bằng chứng nghiệm thu Milestone M11 (Kế Toán Công Nợ, Thu Tiền, Chiết Khấu & Biên Lai)

### 12.1. CSDL & Migration (G14, G15, G16)
- Migration: `0011_g14_g15_g16_finance_receivables.py`
  - Đã apply thành công trên cả 2 CSDL: `QL_NghiaTrang` và `QL_NghiaTrang_Test`.
  - Điều chỉnh dữ liệu di sản (reconciliation): `UPDATE receivables SET contract_id = NULL WHERE annex_id IS NOT NULL AND contract_id IS NOT NULL` để giải tỏa xung đột dữ liệu cũ.
  - Thay thế ràng buộc OR cũ bằng ràng buộc XOR chuẩn hóa (G14) `ck_receivable_source_xor` trên bảng `receivables`:
    `CONSTRAINT ck_receivable_source_xor CHECK ((contract_id IS NOT NULL AND annex_id IS NULL) OR (contract_id IS NULL AND annex_id IS NOT NULL))`.
  - Bổ sung ràng buộc số học trên `receivables`:
    - `ck_receivable_discount_le_original`: `discount_amount <= original_amount`.
    - `ck_receivable_final_calc`: `final_payable_amount = (original_amount - discount_amount)`.
  - Bổ sung các cột: `notes`, `created_by_user_id`, `installment_no` vào `receivables`.
  - Tạo các chỉ mục duy nhất có điều kiện (filtered unique indices):
    - `uq_receivable_contract_installment` trên `(contract_id, installment_no)` WHERE `contract_id IS NOT NULL`.
    - `uq_receivable_annex_installment` trên `(annex_id, installment_no)` WHERE `annex_id IS NOT NULL`.
  - Điều chỉnh cột `discount_records.discount_value` sang `DECIMAL(15,2)` và thêm ràng buộc khoảng giá trị `ck_disc_value_range` (G16).
  - Tạo bảng `idempotency_requests` (G15) với index duy nhất `uq_idempotency_actor_op_key` trên `(user_id, operation_type, idempotency_key)`.
  - Bổ sung `file_id`, `notes`, `created_by_user_id` vào `invoices`.
  - Tạo Sequence `seq_payment_number` sinh mã phiếu thu `PT-YYYYMM-NNNN`.

### 12.2. Quy Tắc Miền Nghiệp Vụ & Server-side Invariants
- **Ràng buộc XOR nguồn công nợ (G14 Source Invariant):** Khoản phải thu chỉ thuộc về Hợp đồng chính (khi mua đất) hoặc Phụ lục (khi xây dựng, an táng, chăm sóc). Không thể cùng lúc vừa gắn hợp đồng vừa gắn phụ lục.
- **Thanh toán lũy kế chống trùng (G15 Idempotent Payment Invariant):**
  - Mọi request thu tiền gửi kèm `Idempotency-Key` (header hoặc body).
  - Nếu request trùng lặp được gửi đến, hệ thống trả về kết quả đã thực hiện trước đó (HTTP 200) thay vì ném lỗi hoặc ghi nhận trùng tiền.
  - Sử dụng khóa dòng `with_for_update` trên MSSQL để bảo vệ số dư nợ còn lại trong môi trường chịu tải cao.
  - Kiểm tra điều kiện: `amount <= remaining_balance` (chặn vượt quá số nợ với lỗi `400 Bad Request`).
  - Trigger `trg_payments_sync_receivable_balance` trên SQL Server tự động cập nhật `paid_amount` và trạng thái `PAID` / `PARTIALLY_PAID`.
- **Quản trị chiết khấu chuẩn hóa (G16 Discount Invariant):**
  - Hỗ trợ chiết khấu theo tỷ lệ phần trăm (`PERCENTAGE`) hoặc số tiền cố định (`FIXED_AMOUNT`).
  - Chặn chiết khấu vượt giá trị niêm yết ban đầu.
  - Chặn chiết khấu làm số dư nợ âm sau khi khách hàng đã thanh toán một phần (`final_payable_amount < paid_amount`).
  - Đảm bảo tính nhất quán số học: `final_payable_amount = original_amount - discount_amount`.
- **Tự động xuất biên lai PDF chuẩn tiếng Việt UTF-8:**
  - Tích hợp hàm chuyển đổi số tiền thành chữ tiếng Việt (`number_to_vietnamese_words`) có unit test độc lập.
  - Xuất file PDF biên lai thu tiền với font Arial Unicode tiếng Việt, bảng chi tiết công nợ, số tiền bằng số và bằng chữ, mã QR VietQR và chữ ký điện tử.
  - Tải biên lai PDF lên MinIO, băm mã SHA-256, chuyển trạng thái `READY` và liên kết với hóa đơn `invoices`.
  - Phát sinh Outbox event `PAYMENT_RECORDED` và ghi nhật ký kiểm toán `AuditLog`.

### 12.3. Giao Diện Web (React 19 + TypeScript)
- Phân hệ **"Kế Toán & Công Nợ"** (`FinanceModule.tsx`):
  - Tích hợp trực tiếp vào thanh điều hướng chính `activeTab === 'finance'`.
  - 4 thẻ KPI tài chính thống kê thời gian thực: Tổng phải thu, Đã thu thực tế, Còn nợ tồn đọng, Tổng chiết khấu.
  - Bộ lọc công nợ theo trạng thái (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`) và ô tìm kiếm tức thời theo mã HĐ, phụ lục, ghi chú.
  - Modal ghi nhận thu tiền (Payment Modal): nhập số tiền, phương thức (Tiền mặt, Chuyển khoản, Thẻ), hỗ trợ nút thanh toán toàn bộ (Auto-fill remaining balance), tự động tải biên lai PDF sau khi thanh toán thành công.
  - Modal áp dụng chiết khấu (Discount Modal): chọn loại tỷ lệ % hoặc số tiền cố định, live preview số tiền giảm và số dư sau chiết khấu.
  - Drawer chi tiết công nợ: xem lịch sử các lượt thu tiền kèm nút tải biên lai PDF, lịch sử chiết khấu, thông tin nguồn phát sinh (G14 XOR) và số tiền bằng chữ.
  - Xử lý trọn vẹn 4 trạng thái giao diện: `Loading`, `Normal`, `Empty Data`, `Error` (kèm nút Thử lại).

### 12.4. Ứng Dụng Di Động (Flutter Android)
- Tích hợp phân hệ **"Tài Chính"** (`mobile/lib/main.dart`):
  - Tab thứ 8 trên BottomNavigationBar với biểu tượng `Icons.payments`.
  - 3 thẻ KPI tóm tắt: Tổng phải thu, Đã thu, Còn nợ tồn.
  - Thanh tìm kiếm và bộ lọc trạng thái công nợ.
  - Danh sách khoản phải thu: hiển thị nguồn HĐ/phụ lục, đợt thu, số tiền phải thu, còn nợ và số lượt thu.
  - Bottom sheet chi tiết công nợ: bảng kê chi tiết số tiền gốc, chiết khấu, phải thu, đã thu, số dư nợ, ghi chú và các nguyên tắc quản trị tài chính (G14, G15, G16).
  - Bộ kiểm thử widget (`mobile/test/widget_test.dart`) bổ sung 2 test cases mới cho phân hệ tài chính, nâng tổng số test lên **14/14 tests passed 100%**.

### 12.5. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt **73/73 bài kiểm thử** (100% passed, bao gồm 7 test cases chuyên sâu trong `test_finance.py`). `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất sạch sẽ trong 305ms.
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt **14/14 tests passed**.
- Tiêu chuẩn Quality Gate `scripts/quality-gate.ps1` ĐẠT 100%.

---

## 13. Bằng chứng nghiệm thu Milestone M12 (Báo Cáo Quản Trị, Tra Cứu Công Khai & Hoàn Thiện Audit)

### 13.1. CSDL & Migration (G17)
- Migration: `0012_g17_report_exports.py`
  - Đã apply thành công trên cả 2 CSDL: `QL_NghiaTrang` và `QL_NghiaTrang_Test`.
  - Tạo Sequence `seq_report_export_number` bắt đầu từ 1001 phục vụ sinh mã số tệp xuất khẩu `EXP-YYYYMM-NNNN`.
  - Tạo bảng `report_exports` lưu trữ siêu dữ liệu phiên xuất báo cáo bền vững:
    - Cột khóa: `export_id`, `export_code`, `report_type`, `export_format` (PDF/XLSX), `status` (PENDING, PROCESSING, COMPLETED, FAILED), `requester_id`, `filter_snapshot_json`, `file_id`, `record_count`, `error_message`, `expires_at`, `created_at`, `completed_at`.
    - Ràng buộc toàn vẹn: Khóa ngoại `file_id` tham chiếu `file_objects(file_id)`, `requester_id` tham chiếu `users(user_id)`.
    - Chỉ mục tra cứu: `ix_report_exports_requester`, `ix_report_exports_status`.

### 13.2. Báo Cáo Nghiệp Vụ & Server-side Invariants
- **Báo cáo Doanh thu Thực tế (Realized Revenue Report - UC-7.1):**
  - Tính toán dựa trên dòng tiền thực thu từ bảng `payments` (`paid_amount`, `paid_at`), loại trừ hoàn toàn các khoản nợ tiềm năng chưa thu.
  - Phân tích đa chiều: theo phương thức thanh toán (`CASH`, `BANK_TRANSFER`, `CARD`), theo loại nguồn (Hợp đồng đất `LAND_PURCHASE` / Phụ lục `BURIAL`, `CONSTRUCTION`, `CARE`).
- **Báo cáo Lấp đầy & Mộ phần (Occupancy Report - UC-7.2):**
  - Thống kê tỷ lệ lấp đầy chính xác: tính toán dựa trên tổng số mộ và slot huyệt, xử lý ngoại lệ an toàn cho các khu chưa có mộ (`empty zone protection`), phân định rõ ràng các trạng thái `AVAILABLE`, `RESERVED`, `OCCUPIED` (Kim Tĩnh / thường).
- **Báo cáo Hợp đồng & Phụ lục (Contracts & Annexes Report - UC-7.3):**
  - Tách bạch cấu trúc Hợp đồng và Phụ lục, xử lý bài toán chống nhân đôi doanh số (double-counting) khi join dữ liệu quan hệ 1-N.
  - Thống kê số lượng theo loại hợp đồng, trạng thái hiệu lực (`ACTIVE`, `PENDING_SCAN`, `EXPIRED`, `CANCELLED`).
- **Báo cáo Vận hành Hiện trường (Operations Report - UC-7.4):**
  - Giám sát tiến độ thi công công trình và các ca chăm sóc mộ phần định kỳ, đo lường tỷ lệ đúng hạn (SLA) và phát hiện các đơn quá hạn (`overdue`).
- **Phòng chống tấn công Excel Formula Injection:**
  - Áp dụng hàm khử trùng ô dữ liệu `sanitize_excel_cell` trên toàn bộ văn bản đầu vào trước khi ghi file `.xlsx`.
  - Trung hòa tất cả các ký tự khởi đầu công thức nguy hiểm (`=`, `+`, `-`, `@`, `\t`, `\r`) bằng dấu nháy đơn (`'`).
- **Xuất file Bền vững MinIO (PDF / XLSX - UC-7.5):**
  - Tích hợp động cơ sinh báo cáo PDF tiếng Việt UTF-8 font Arial (`ReportLab`) kèm KPI summary cards và bảng dữ liệu chuyên nghiệp.
  - Tích hợp động cơ sinh Excel (`openpyxl`) định dạng bảng tính kế toán chuẩn.
  - Tải file trực tiếp lên MinIO bucket `ql-nghiatrang-documents`, băm mã SHA-256 toàn vẹn, phân quyền tải về nghiêm ngặt (chỉ tài khoản yêu cầu hoặc ADMIN mới có quyền tải file xuất).

### 13.3. Hoàn Thiện Nhật Ký Kiểm Toán (Audit Log Viewer - UC-8.7)
- Cơ chế truy vấn nhật ký kiểm toán hệ thống `audit_logs` chỉ đọc (Read-only, không cung cấp endpoint chỉnh sửa hay xóa log).
- Thống kê KPI kiểm toán thời gian thực: Tổng sự kiện ghi nhận, phân bổ theo hành động (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `REVOKE`), tỷ lệ thành công/thất bại.
- Cơ chế đệ quy làm mờ dữ liệu nhạy cảm (`redact_sensitive_json`): tự động phát hiện và thay thế các trường bí mật (`password`, `access_token`, `refresh_token`, `secret`, `hash`) bằng chuỗi `***REDACTED***`.

### 13.4. Tra Cứu Công Khai & Dẫn Đường Tọa Độ (Public Memorial - UC-1.4, UC-1.5)
- Cổng tra cứu người quá cố công cộng không yêu cầu đăng nhập, bảo vệ thông tin cá nhân (Zero PII - không trả CCCD, thân nhân, số điện thoại, hợp đồng).
- Trả về thông tin họ tên, năm sinh, năm mất, tên khu/dãy/mã ô mộ đã được phê duyệt an táng.
- Bổ sung thông tin dẫn đường vị trí:
  - Tọa độ GPS đã duyệt (`latitude`, `longitude`).
  - Hướng dẫn điều hướng trực quan (`navigation_guidance`).
  - Đường dẫn Google Maps vệ tinh trực tiếp (`maps_url` dạng `https://www.google.com/maps?q={lat},{lng}`) kèm cơ chế dự phòng an toàn khi ô mộ chưa cập nhật tọa độ GPS.

### 13.5. Giao Diện Web (React 19 + TypeScript)
- **Module Báo Cáo Thống Kê (`ReportsModule.tsx`):**
  - 4 tiểu phân hệ chuyển đổi mượt mà: Doanh thu, Lấp đầy & Mộ phần, Hợp đồng & Phụ lục, Vận hành.
  - 4 thẻ KPI thống kê cao cấp với tỷ lệ tăng trưởng và phân bổ.
  - Bộ lọc khoảng ngày động, nút Xuất báo cáo (Export Modal) tùy chọn định dạng PDF hoặc Excel.
  - Tự động tải blob an toàn về máy tính người dùng.
- **Module Nhật Ký Kiểm Toán (`AuditModule.tsx`):**
  - Thanh tìm kiếm và bộ lọc hành động, đối tượng tác động, mã định danh.
  - 4 thẻ KPI kiểm toán trực quan.
  - Bảng dữ liệu nhật ký phân trang với huy hiệu màu theo hành động.
  - Drawer chi tiết sự kiện hiển thị diff dữ liệu Before / After đã được khử dữ liệu bí mật (`***REDACTED***`).
- **Nâng cấp Phân hệ Hồ sơ (`ProfileModule.tsx`):**
  - Tích hợp huy hiệu tọa độ GPS, chỉ dẫn đường đi và nút mở Google Maps trực tiếp trong thẻ kết quả tra cứu công khai.
- **Điều Hướng Ứng Dụng (`App.tsx`):**
  - Bổ sung tab "Báo Cáo Thống Kê" (quyền `reports:read`) và "Nhật Ký Kiểm Toán" (quyền `audit:read`).
  - Xử lý trọn vẹn 4 trạng thái giao diện: `Loading`, `Normal`, `Empty Data`, `Error`.

### 13.6. Ứng Dụng Di Động (Flutter Android)
- Cập nhật model `MemorialLookupModel` trong `mobile/lib/main.dart` tiếp nhận `latitude`, `longitude`, `navigationGuidance`, `mapsUrl`.
- Nâng cấp giao diện Memorial Card hiển thị huy hiệu GPS, chỉ dẫn đường đi tới ô mộ và URL bản đồ.
- Bổ sung kiểm thử trong `mobile/test/widget_test.dart` xác minh hiển thị dẫn đường và GPS không cần đăng nhập.

### 13.7. Kiểm Thử & Tiêu Chuẩn Quality Gate
- **Backend:** `uv run pytest` đạt **82/82 bài kiểm thử** (100% passed, bao gồm 9 test cases chuyên sâu trong `test_reports_audit.py`). `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
- **Web:** `pnpm lint` 0 errors, `pnpm build` hoàn tất sạch sẽ trong 265ms.
- **Mobile:** `flutter analyze` 0 issues, `flutter test` đạt **14/14 tests passed 100%**.
- Kịch bản kiểm định chất lượng tự động `scripts/quality-gate.ps1` ĐẠT 100% cả 3 phân hệ.








