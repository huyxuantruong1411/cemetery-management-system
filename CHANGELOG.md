# Nhật Ký Thay Đổi Dự Án (Changelog)

Tất cả những thay đổi quan trọng trong hệ thống Quản lý Nghĩa trang Tư nhân được ghi nhận tại đây theo định dạng [Keep a Changelog](https://keepachangelog.com/).

---

## [0.9.0-domain-lifecycle] - 2026-10-03 (M08)

### Added
- **CSDL & Alembic Migration (G10, G18, G20):**
  - Migration `0008_g10_g18_g20_lifecycle_annexes.py`:
    - Tạo Database Sequence `seq_annex_number` (bắt đầu từ 1001) phục vụ sinh số phụ lục tuần tự: `PL-AT-YYYY-NNNN`.
    - Tạo bảng `contract_annexes` (G10): quản lý vòng đời phụ lục hợp đồng (`BURIAL_ATTACHMENT`, `MAINTENANCE`, `UPGRADE`).
    - Tạo bảng `burial_annex_details` (G10): chi tiết an táng, slot, người mất, cờ Kim Tĩnh, độ sâu an táng.
    - Tạo bảng `exhumation_details` (G20): chi tiết cải táng di dời, slot, người mất, nghĩa trang tiếp nhận, hình thức cải táng.
    - Tạo bảng `transfer_details` (G20): chi tiết chuyển nhượng quyền sử dụng đất, bên chuyển nhượng, bên nhận chuyển nhượng, phí chuyển nhượng.
    - Tạo bảng `cremation_details` (G18): chi tiết dịch vụ hỏa táng độc lập, người mất, xử lý và nơi lưu giữ tro cốt.
    - Mở rộng model ORM `Plot`: bổ sung trường `is_locked` (Boolean) tương thích với trigger CSDL.
- **Nghiệp Vụ Backend & Ràng Buộc Miền (Lifecycle & Domain Invariants):**
  - **Quy tắc Kim Tĩnh Bất Biến (Server Invariant & MSSQL Triggers):**
    - Kích hoạt an táng Kim Tĩnh khóa vĩnh viễn ô mộ mức CSDL (`is_kim_tinh = True`, `is_locked = True`).
    - Trigger `trg_plots_enforce_kim_tinh_immutability` chặn mọi thao tác mở khóa (Lỗi 51001) hoặc cải táng (Lỗi 51000).
    - Tầng nghiệp vụ và giao diện từ chối tạo cải táng hoặc chuyển nhượng trên ô Kim Tĩnh.
  - **Kiểm Soát Giấy Báo Tử Bắt Buộc (G08 Pre-Burial Verification):**
    - Chốt chặn `check_death_certificate_verified` bắt buộc giấy báo tử của người quá cố phải được duyệt trước khi tạo phụ lục an táng hoặc hợp đồng hỏa táng.
  - **Ràng Buộc Duy Nhất Slot Cho Người Mất:**
    - Ngăn chặn một người quá cố bị an táng đồng thời tại nhiều hơn một vị trí (`409 Conflict`).
  - **Quy Trình Cải Táng & Giải Phóng Slot (G20):**
    - Hoàn tất cải táng: giải phóng slot về `EMPTY`, ô mộ chuyển về `OWNED_EMPTY` (hoặc `OCCUPIED` nếu còn slot khác), bảo toàn quyền sở hữu của thân nhân.
  - **Quy Trình Chuyển Nhượng Quyền Sở Hữu (G20 & G05):**
    - Đóng quyền sở hữu cũ (`valid_to = now`), tạo bản ghi sở hữu mới cho người nhận, cập nhật `plot.owner_id`, phát sinh nghĩa vụ tài chính phí chuyển nhượng.
  - **Hợp Đồng Hỏa Táng Độc Lập (G18):**
    - Cung cấp dịch vụ hỏa táng độc lập không gắn với mua đất, lưu vết chi tiết xử lý tro cốt.
  - **Kích Hoạt Phụ Lục An Táng Kèm MinIO Scan:**
    - Lưu file scan có chữ ký, cập nhật slot `OCCUPIED`, cập nhật ô mộ `OCCUPIED`, khóa Kim Tĩnh nếu có, sinh khoản phải thu tài chính và sự kiện Outbox.
- **Web Frontend (React 19 + TypeScript):**
  - Cập nhật `ContractModule.tsx`:
    - Bổ sung huy hiệu phân loại hợp đồng (`Mua Đất`, `Cải Táng`, `Chuyển Nhượng`, `Hỏa Táng`, `Dịch Vụ`).
    - Bổ sung 4 nút tác vụ trên toolbar: `+ Mua Đất`, `+ Cải Táng`, `+ Chuyển Nhượng`, `+ Hỏa Táng`.
    - Thẻ Subtype trong modal chi tiết hiển thị thông tin chuyên biệt cho từng loại hợp đồng.
    - Danh mục Phụ Lục Hợp Đồng với huy hiệu Kim Tĩnh, liên kết tải bản scan MinIO, nút "Trình Ký", và nút "Kích Hoạt Phụ Lục".
    - 5 Modals nghiệp vụ mới: `BurialAnnexModal`, `AnnexActivateModal`, `ExhumationModal`, `TransferModal`, `CremationModal`.
- **Mobile App (Flutter Android):**
  - Cập nhật `mobile/lib/main.dart`:
    - Thêm chip phân loại hợp đồng trên danh sách thực địa.
    - Bản địa hóa tên loại hợp đồng trong Bottom Sheet chi tiết.
- **Kiểm Thử & Đảm Bảo Chất Lượng:**
  - 52 backend tests (`uv run pytest`) passed 100% (7 test cases mới trong `test_lifecycle.py`).
  - `uv run ruff check .` và `uv run ruff format --check .` All checks passed!
  - Web `pnpm lint` 0 errors, `pnpm build` passed trong 265ms.
  - Mobile `flutter analyze` 0 issues, `flutter test` (8/8 passed).
  - Tiêu chuẩn Quality Gate `scripts/quality-gate.ps1` ĐẠT 100%.

---

## [0.8.0-land-contracts] - 2026-10-03 (M07)

### Added
- **CSDL & Alembic Migration (G09):**
  - Migration `0007_g09_contracts_workflow.py`:
    - Tạo Database Sequence `seq_contract_number` (khởi đầu từ 1001) phục vụ sinh mã hợp đồng tuần tự chống race condition: `HD-MD-YYYY-NNNN`.
    - Mở rộng bảng `contracts`: `signed_at` (DATE), `activated_at` (DATETIME2), `activated_by` (FK đến `users`), `activation_notes` (NVARCHAR(MAX)), `template_id` (FK đến `contract_templates`), `template_version` (INT), `signed_scan_file_id` (VARCHAR(64), FK đến `file_objects`), `notes` (NVARCHAR(MAX)).
    - Bổ sung FK `contract_id` trên `plot_reservations` để liên kết chính xác vòng đời giữ chỗ phát sinh từ hợp đồng.
- **Nghiệp Vụ Backend & Ràng Buộc Miền (ContractService):**
  - Khóa hàng chống double-booking (`with_for_update()`): Kiểm tra ô mộ `EMPTY_UNSOLD` và từ chối xung đột giữ chỗ tức thời với `409 Conflict`.
  - Snapshot đơn giá đất tự động từ biểu giá niêm yết đang có hiệu lực (`price_lists` & `price_items`), bảo toàn tính toàn vẹn giá tại thời điểm ký kết.
  - Quy trình gửi ký (`submit_for_signing`): Chuyển trạng thái hợp đồng sang `PENDING_SIGN` để xuất in văn bản trình thân nhân.
  - Xuất bản in hợp đồng PDF chuẩn pháp lý tiếng Việt UTF-8 (Arial) via ReportLab.
  - Kích hoạt hợp đồng toàn vẹn ACID 6 bước (`activate_contract`):
    1. Cập nhật hợp đồng: `status = 'ACTIVE'`, ghi nhận `signed_scan_file_id`, ngày ký và người duyệt.
    2. Cập nhật ô mộ: `status = 'OWNED_EMPTY'` và `owner_id = customer_id`.
    3. Cập nhật giữ chỗ: `plot_reservations.state = 'CONVERTED'`.
    4. Ghi nhận chuỗi lịch sử quyền sở hữu: Tạo bản ghi `PlotOwnership` (G05).
    5. Tự động sinh nghĩa vụ tài chính: Tạo bản ghi `Receivable` (G14) trạng thái `UNPAID` với hạn nợ 30 ngày.
    6. Phát sinh sự kiện Outbox `CONTRACT_ACTIVATED` (G17) và ghi `AuditLog`.
  - Cơ chế Idempotent activation chống trùng lặp tác dụng phụ khi gọi lặp lại.
  - Hủy hợp đồng nháp (`cancel_contract`): Giải phóng ô mộ về `EMPTY_UNSOLD`, hủy giữ chỗ.
- **Web Frontend (React 19 + TypeScript):**
  - Phân hệ **"Hợp Đồng & Khách Hàng"** (`ContractModule.tsx`):
    - KPI Cards thống kê số lượng hợp đồng, hợp đồng hiệu lực, chờ ký kết, doanh thu hiệu lực.
    - Thanh công cụ tìm kiếm và lọc trạng thái linh hoạt.
    - 4-Step Land Purchase Wizard Modal: 1. Chọn KH -> 2. Chọn ô mộ trống -> 3. Định giá đất & điều khoản -> 4. Rà soát & phát hành dự thảo.
    - Modal chi tiết hợp đồng & thanh công cụ thao tác: In PDF, Chuyển chờ ký, Kích hoạt hợp đồng kèm upload scan MinIO, Hủy dự thảo.
    - Xử lý trọn vẹn 4 trạng thái giao diện: Loading, Normal, Empty với CTA, Error với retry.
- **Mobile App (Flutter Android):**
  - Bổ sung tab **"Hợp Đồng"** thứ 5 trên BottomNavigationBar.
  - Tra cứu danh sách hợp đồng kèm tìm kiếm tức thời và bộ lọc chip trạng thái.
  - Thẻ hợp đồng với định dạng tiền VND chuẩn mực và chip trạng thái trực quan.
  - Bottom sheet chi tiết hợp đồng cho nhân viên thực địa.
  - Bổ sung widget test chuyên biệt cho hợp đồng trong `widget_test.dart`.
- **Kiểm Thử & Đảm Bảo Chất Lượng:**
  - 45 backend tests (`uv run pytest`) passed 100%. `uv run ruff check .` và `uv run ruff format --check .` clean.
  - Web `pnpm lint` 0 errors, `pnpm build` passed trong 249ms.
  - Mobile `flutter analyze` 0 issues, `flutter test` (8/8 passed).
  - Tiêu chuẩn Quality Gate `scripts/quality-gate.ps1` ĐẠT 100%.

---

## [0.7.0-profiles] - 2026-10-03 (M06)

### Added
- **CSDL & Alembic Migration (G07, G08):**
  - Migration `0006_g07_g08_profiles_certificates.py`:
    - Thêm `customers.date_of_birth` (DATE).
    - Thêm `deceased_profiles.birth_year` (INTEGER) và `deceased_profiles.birth_date_precision` ('EXACT', 'YEAR_ONLY', 'UNKNOWN'). Đảm bảo tính trung thực dữ liệu, không bịa đặt ngày tháng khi chỉ biết năm sinh (G07).
    - Mở rộng `death_certificates`: chuyển mặc định `is_verified` về 0, cho phép `verified_at` NULL, thêm `verified_by` (FK đến `users`), `rejection_reason` (NVARCHAR(255)), `file_id` (VARCHAR(64), FK đến `file_objects`), `notes` (NVARCHAR(MAX)).
  - Cập nhật SQLAlchemy ORM models tại `backend/app/modules/profiles/models.py`, chuẩn hóa `Unicode` và `UnicodeText` chống lỗi tiếng Việt.
- **Nghiệp Vụ Backend & Ràng Buộc Miền (ProfileService):**
  - Chống trùng lặp số CCCD/CMND khi tạo khách hàng (`409 Conflict`).
  - Xác thực độ chính xác ngày sinh và ràng buộc thời gian sống: `date_of_birth <= date_of_death` và `birth_year <= date_of_death.year`.
  - Quy trình phê duyệt Giấy báo tử (G08 Pre-Burial Verification): `verify_certificate` ghi nhận kiểm tra hồ sơ trước an táng, `check_death_certificate_verified` làm chốt chặn bảo mật domain invariant.
  - Cổng tra cứu công khai tuyệt đối không lộ PII (G19 & ADR-001): `/api/v1/profiles/public/memorials?q=` chỉ trả về thông tin tưởng niệm và vị trí ô mộ, tuyệt đối không lộ CCCD, SĐT, hay giấy tờ cá nhân.
  - Script seed dữ liệu mẫu: `backend/scripts/seed_profiles.py` nạp 3 khách hàng, 3 người quá cố, 3 giấy báo tử và liên kết huyệt mộ.
- **Web Frontend (React 19 + TypeScript):**
  - Phân hệ **"Hồ Sơ & Tưởng Niệm"** (`ProfileModule.tsx`):
    - Sub-view Thân Nhân: Tra cứu, thêm mới, xem liên kết người quá cố và huy hiệu đại diện gia đình.
    - Sub-view Quá Cố & Giấy Báo Tử: Thẻ người mất với nhãn độ chính xác năm sinh, banner trạng thái giấy báo tử 4 màu, duyệt/từ chối giấy báo tử nhanh.
    - Sub-view Tra Cứu Tưởng Niệm Công Khai: Thiết kế tôn nghiêm, tông xanh ngọc - vàng cát, tag tìm kiếm mẫu, thẻ an táng kèm huy hiệu Kim Tĩnh.
- **Mobile App (Flutter Android):**
  - Tích hợp tab **"Hồ Sơ & Tra Cứu"** trên BottomNavigationBar với 3 sub-tab: Tra Cứu Tưởng Niệm (không cần đăng nhập), Thân Nhân (KH), Quá Cố & Giấy Báo Tử.
  - Chống tràn giao diện với `SingleChildScrollView` trên các card xác thực và trạng thái rỗng.
  - 2 widget tests chuyên biệt cho M06.
- **Kiểm Thử & Đảm Bảo Chất Lượng:**
  - 39 backend tests (`uv run pytest`) passed 100%. `uv run ruff check .` clean.
  - Web `pnpm lint` 0 errors, `pnpm build` passed trong 241ms.
  - Mobile `flutter analyze` 0 issues, `flutter test` (7/7 passed).
  - Tiêu chuẩn Quality Gate `scripts/quality-gate.ps1` ĐẠT 100%.

---

## [0.6.0-plots] - 2026-10-03 (M05)

### Added
- **CSDL & Alembic Migration (G04, G05, G06):**
  - Migration `0005_g04_g05_g06_plots_reservations.py`:
    - Thêm cột `orientation` (NVARCHAR(50)) và `notes` (NVARCHAR(MAX)) vào bảng `plots`.
    - Tạo bảng `plot_reservations` (G04) quản lý vòng đời giữ chỗ kèm chỉ mục lọc duy nhất: `UQ_plot_reservations_active ON plot_reservations(plot_id) WHERE state = 'ACTIVE'`.
    - Tạo bảng `plot_ownerships` (G05) theo dõi chuỗi lịch sử quyền sở hữu qua các giao dịch chuyển nhượng.
    - Tạo chỉ mục lọc duy nhất trên `plot_slots(current_deceased_id) WHERE current_deceased_id IS NOT NULL` (G06).
  - Cập nhật SQLAlchemy ORM models tại `backend/app/modules/plots/models.py`, bảo tồn `implicit_returning=False` trên `Plot` để tương thích trigger bảo toàn Kim Tĩnh của CSDL.
- **Nghiệp Vụ Backend & Ràng Buộc Miền (PlotService):**
  - Ràng buộc Kim Tĩnh bất biến: Chặn tuyệt đối việc gỡ bỏ cờ Kim Tĩnh hoặc chỉnh sửa ô mộ đã bị khóa Kim Tĩnh.
  - Tự động sinh slot huyệt trong 1 transaction ACID: Khi tạo ô mộ với `default_slots = N`, tự động sinh 1..N `PlotSlot` (`slot_number` 1..N, trạng thái ban đầu `EMPTY`).
  - Khóa hàng chống trùng giữ chỗ (G04 Anti-Double Booking Guard): Sử dụng `with_for_update()` trên MSSQL, kiểm tra trạng thái ô và từ chối tranh chấp với mã lỗi `409 Conflict`.
  - Quản lý hủy & hết hạn giữ chỗ: Tự động hoàn trả trạng thái ô mộ về `EMPTY_UNSOLD`, xử lý tương thích múi giờ offset-naive và offset-aware.
  - Script seed idempotent: `backend/scripts/seed_plots.py` nạp 3 khu vực (Khu A, Khu B, Khu VIP), 6 hàng mộ, 3 loại mộ và 11 ô mộ thực tế kèm tọa độ GPS và slot tự động.
- **API Endpoints:**
  - Tra cứu danh sách ô mộ đa tiêu chí: `/api/v1/plots?zone_id=&status=&is_kim_tinh=&search=`
  - Chi tiết ô mộ kèm slot: `/api/v1/plots/{plot_id}`
  - Tạo mới ô mộ (tự động sinh slot): `POST /api/v1/plots`
  - Đặt giữ chỗ ô mộ (anti-double booking): `POST /api/v1/plots/{plot_id}/reserve`
  - Hủy giữ chỗ ô mộ: `POST /api/v1/plots/{plot_id}/cancel-reservation`
- **Web Frontend (React 19 + TypeScript + Leaflet GIS):**
  - Phân hệ **"Sơ Đồ Ô Mộ"** (`PlotMapModule.tsx`):
    - Bản đồ không gian tương tác Leaflet 1.9, marker SVG định dạng theo trạng thái màu sắc.
    - Huy hiệu khiên bảo vệ `🛡️` cho ô Kim Tĩnh và ổ khóa `🔒` cho ô đã khóa.
    - Chuyển đổi giữa chế độ Bản đồ và chế độ Lưới trực quan.
    - Bộ lọc đa chiều (khu vực, trạng thái, Kim Tĩnh, tìm kiếm mã mộ).
    - Drawer hiển thị chi tiết ô mộ, tọa độ GPS, danh sách slot và người mất.
    - Modal đặt giữ chỗ với xử lý thông báo xung đột `409 Conflict`.
- **Mobile App (Flutter Android):**
  - Thêm tab **"Sơ Đồ Ô Mộ"** trên BottomNavigationBar.
  - Tra cứu danh sách ô mộ theo khu vực, tìm kiếm nhanh mã ô mộ.
  - Hiển thị huy hiệu Kim Tĩnh và trạng thái ô mộ.
  - Bottom Sheet xem chi tiết ô mộ phục vụ kiểm tra thực địa.
  - Bổ sung 2 widget tests cho Sơ Đồ Ô Mộ (unauthenticated prompt & authenticated detail rendering).
- **Kiểm Thử & Đảm Bảo Chất Lượng:**
  - 32 backend tests (`uv run pytest`) passed 100%. `uv run ruff check .` clean.
  - Web `pnpm lint` 0 errors, `pnpm build` passed trong 234ms.
  - Mobile `flutter analyze` 0 issues, `flutter test` (5/5 passed).
  - Tiêu chuẩn Quality Gate `scripts/quality-gate.ps1` ĐẠT 100%.

---

## [0.5.0-design-catalog] - 2026-10-03 (M04)

### Added
- **CSDL & Alembic Migration (G03):**
  - Migration `0004_g03_catalog_pricing_templates.py`:
    - Tạo bảng `contract_templates` với 4 loại hợp đồng chuẩn (`LAND_PURCHASE`, `EXHUMATION`, `CREMATION`, `TRANSFER`) và phụ lục `CARE_ANNEX`.
    - Mở rộng bảng `price_items` với 4 cột phạm vi: `zone_id`, `plot_type_id`, `package_id`, `service_code` có khóa ngoại `SET NULL`.
  - SQLAlchemy models mapped tại `backend/app/modules/catalog/models.py` và `backend/app/modules/contracts/models.py`, chuẩn hóa `Unicode` và `UnicodeText` chống lỗi font tiếng Việt trên SQL Server.
- **Dịch vụ Nghiệp Vụ Bảng Giá & Danh Mục (Backend):**
  - `CatalogService`: Kiểm tra chống trùng lặp khoảng thời gian hiệu lực (`check_price_list_overlap`), tra cứu đơn giá tức thời theo scope (`lookup_price`), từ chối gói chăm sóc ngừng kích hoạt, bump version mẫu hợp đồng không hồi tố (`bump_template_version`).
  - Script seed idempotent: `backend/scripts/seed_catalog.py` nạp bảng giá niêm yết 2026, 4 khoản mục giá mẫu, 3 gói chăm sóc định kỳ và 4 mẫu hợp đồng pháp lý chuẩn.
- **API Endpoints:**
  - CRUD bảng giá: `/api/v1/catalog/price-lists`, `/price-lists/{id}`
  - CRUD khoản mục: `/api/v1/catalog/price-items`, `/price-items/{id}`
  - Tra cứu mô phỏng đơn giá: `/api/v1/catalog/lookup-price`
  - CRUD gói chăm sóc: `/api/v1/catalog/care-packages`, `/care-packages/{id}`
  - CRUD mẫu hợp đồng: `/api/v1/catalog/contract-templates`, `/contract-templates/{id}/bump-version`
- **Web Frontend (React 19 + TypeScript):**
  - Phân hệ **"Bảng Giá & Danh Mục"** (`CatalogModule.tsx`): 5 giao diện trực quan (Bảng giá & khoản mục, Gói chăm sóc định kỳ, Mẫu hợp đồng pháp lý, Bộ mô phỏng tra cứu đơn giá thời gian thực, Design System Gallery).
  - Tích hợp 4 trạng thái chuẩn, hiển thị tiền tệ định dạng VNĐ trang nghiêm `#24594D`.
- **Mobile App (Flutter Android):**
  - Tích hợp tab **"Bảng Giá & Gói CS"** trong `mobile/lib/main.dart` với BottomNavigationBar: phân biệt quyền truy cập, hiển thị chi tiết khoản mục giá tiền VNĐ rõ ràng, danh sách công việc chăm sóc dạng chip badges.
  - Xử lý trọn vẹn 4 trạng thái (Loading, Normal, Empty, Error kèm Thử lại).
  - 3 widget tests tự động kiểm thử smoke test, unauthenticated prompt và authenticated data render đạt 100%.
- **Kiểm Thử & Đảm Bảo Chất Lượng:**
  - 26 backend tests (`uv run pytest`) passed 100%. `uv run ruff check .` clean.
  - `pnpm lint` 0 errors, `pnpm build` (206ms) passed.
  - `flutter analyze` 0 issues, `flutter test` (3/3 passed).
  - Bộ kiểm định chất lượng toàn diện `scripts/quality-gate.ps1` ĐẠT 100%.

---

## [0.4.0-documents] - 2026-10-03 (M03)

### Added
- **CSDL & Alembic Migration (G02 & G17):**
  - Migration `0003_g02_g17_files_documents_jobs_outbox.py` bổ sung 4 bảng: `file_objects`, `document_versions`, `background_jobs`, `outbox_events`.
  - Hỗ trợ lưu trữ siêu dữ liệu tệp MinIO, lịch sử phiên bản tài liệu (hợp đồng, phụ lục, giấy báo tử), hàng đợi tác vụ nền có lease lock và outbox events.
  - SQLAlchemy models mapped tại `backend/app/modules/documents/models.py` và `backend/app/modules/jobs/models.py`.
- **Dịch vụ Quản lý Tệp & Chứng từ (Backend):**
  - `DocumentService`: Kiểm tra an toàn chữ ký tệp Magic Bytes (%PDF-, PNG, JPEG, XLSX), streaming upload trực tiếp vào MinIO bucket trên ổ D, tính mã SHA-256 song song, preview & download kèm xác thực JWT.
  - `PDFService`: Công cụ biên dịch tài liệu PDF ReportLab chuẩn tiếng Việt UTF-8 sử dụng font hệ thống `Arial`, sinh mẫu hợp đồng hoàn chỉnh kèm bảng thông tin và khung chữ ký hai bên.
  - `ExcelService`: Công cụ xuất báo cáo bảng tính `.xlsx` chuyên nghiệp với `openpyxl`, thiết lập kiểu bảng, căn lề và màu thương hiệu trang nghiêm `#24594D`.
  - `BackgroundJobService`: Xử lý công việc ngầm với cơ chế lease claiming (`lease_until`), hỗ trợ nhiều worker chạy đồng thời không bị tranh chấp.
- **API Endpoints:**
  - `/api/v1/documents/upload`: Tải lên tệp có kiểm tra Magic Bytes và lưu MinIO.
  - `/api/v1/documents/{file_id}/download` & `/preview`: Tải về và xem trước tệp có xác thực.
  - `/api/v1/documents/versions`: Liên kết tệp vào hợp đồng/chứng từ và tự động đánh số phiên bản (`version_no`).
  - `/api/v1/documents/sample-contract-pdf`: Tạo mẫu PDF hợp đồng tiếng Việt và lưu MinIO.
  - `/api/v1/jobs/enqueue`, `/status/{job_id}`, `/process-next`: Quản trị hàng đợi tác vụ nền.
- **Web Frontend (React 19 + TypeScript):**
  - Phân hệ **"Hồ Sơ Chứng Từ & MinIO"** (`DocumentManager.tsx`):
    - Tải tệp lên kèm xác thực định dạng tức thời.
    - 1-click tạo mẫu PDF tiếng Việt chuẩn MinIO.
    - Cửa sổ Preview Modal tương tác xem trước PDF và ảnh.
    - Hộp thoại liên kết hồ sơ chứng từ và đánh số phiên bản tự động.
    - Bảng giám sát tác vụ nền (Background Jobs Queue Monitor) kiểm thử worker step.
- **Kiểm Thử & Đảm Bảo Chất Lượng:**
  - 20 bài kiểm thử backend (`uv run pytest`) đạt 100%.
  - `uv run ruff check .` All checks passed!
  - `pnpm lint` 0 errors, `pnpm build` (200ms) thành công.
  - `flutter analyze` 0 issues, `flutter test` vượt qua hoàn toàn.

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
