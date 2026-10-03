# Sổ Đăng Ký Khoảng Trống và Bổ Sung CSDL (Database Gap Register)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày lập:** 03/10/2026  
**Máy chủ đối chiếu:** `DESKTOP-HKIPI1M` — CSDL: `QL_NghiaTrang`  
**Hiện trạng:** 37 bảng nghiệp vụ + 1 bảng hệ thống (`sysdiagrams`), 2 triggers, 0 bản ghi dữ liệu vận hành.

---

## 1. Kết quả đối chiếu hiện trạng vật lý (Drift Analysis)

Đối chiếu giữa kịch bản DDL `docs/source/lab4-sql.sql` và CSDL thực tế trên SQL Server qua script `backend/scripts/introspect_db.py`:
- **Số bảng:** Khớp hoàn toàn 37/37 bảng nghiệp vụ.
- **Triggers:** Khớp 2 trigger:
  1. `trg_plots_enforce_kim_tinh_immutability` trên bảng `plots` (ngăn thay đổi cờ `is_kim_tinh`, `kim_tinh_locked_at` khi đã khóa).
  2. `trg_payments_sync_receivable_balance` trên bảng `payments` (tự động cộng dồn `total_paid` và cập nhật `payment_status` trên `receivables`).
- **Lưu ý ORM đặc biệt đối với SQL Server:**
  - Hai bảng `plots` và `payments` có triggers. Khi dùng SQLAlchemy, mặc định sẽ sinh `OUTPUT INSERTED` gây lỗi MSSQL. Bắt buộc cấu hình `implicit_returning=False` trên model của 2 bảng này.
  - Phân loại tài khoản: Tài khoản runtime của ứng dụng chỉ có quyền DML (SELECT, INSERT, UPDATE, DELETE). Quyền DDL chỉ cấp riêng cho tiến trình migration (Alembic).

---

## 2. Danh mục các khoảng trống thiết kế và kế hoạch bổ sung (G01 – G20)

Các bảng và cột mở rộng dưới đây là **đề xuất cải tiến cấu trúc theo từng milestone**. Chúng sẽ được thêm vào thông qua các migration Alembic tuần tự, không tạo ồ ạt khi chưa có tính năng tương ứng.

| Mã | Milestone | Vấn đề / Lỗ hổng nghiệp vụ | Giải pháp kỹ thuật bổ sung | Kiểm tra / Nghiệm thu |
|---|---|---|---|---|
| **G01** | M02 | JWT đơn lẻ không thu hồi được ngay khi khóa user hoặc đổi quyền | Thêm bảng `auth_sessions` (user_id FK, refresh_token_hash, session_id, expires_at, revoked_at) và cột `users.auth_version`. | Khóa tài khoản hoặc đổi role thì request kế tiếp dùng token cũ bị từ chối 401 ngay lập tức. |
| **G02** | M03 | Các cột `*_url` chỉ lưu chuỗi đường dẫn đơn, không có metadata, checksum, phiên bản | Thêm bảng `file_objects` (UUID PK, bucket, object_key, SHA-256, MIME, size, state, created_by) và `document_versions` (FK tới contract/annex/certificate, version_no). | Tệp lưu trữ MinIO có đầy đủ audit, phân quyền truy cập theo hồ sơ, không rò rỉ URL tĩnh. |
| **G03** | M04 | Giá không FK chặt chẽ tới loại mộ/khu/gói dịch vụ; loại HĐ chỉ có ràng buộc CHECK chuỗi | Thêm bảng `contract_templates` (4 loại chuẩn: LAND_PURCHASE, BURIAL, EXHUMATION, CREMATION, TRANSFER) và bảng mapping scope bảng giá. Snapshot giá vào hợp đồng khi lập. | Thay đổi bảng giá không làm biến động giá trị hợp đồng đã ký trong quá khứ. |
| **G04** | M05 | Chưa có cơ chế giữ chỗ ô đất độc quyền khi lập hợp đồng nháp | Thêm bảng `plot_reservations` (plot_id FK, contract_id FK, state, expires_at), kèm filtered unique index `WHERE state = 'ACTIVE'`. | 2 nhân viên Marketing chọn cùng 1 ô đồng thời: 1 người thành công, 1 người nhận 409 Conflict. |
| **G05** | M05–M08 | Chỉ lưu chủ sở hữu hiện tại `current_owner_id` trên `plots`, mất lịch sử sau khi chuyển nhượng | Thêm bảng `plot_ownerships` (plot_id FK, customer_id FK, basis_contract_id FK, valid_from, valid_to). | Truy vết toàn vẹn chuỗi sở hữu qua các thời kỳ; ngăn chủ cũ thực hiện các quyền sau chuyển nhượng. |
| **G06** | M05 | CSDL chưa ngăn chặn trường hợp 1 người mất nằm ở 2 slot khác nhau | Thêm filtered unique index: `CREATE UNIQUE INDEX UQ_plot_slots_deceased ON plot_slots(current_deceased_id) WHERE current_deceased_id IS NOT NULL`. | Không thể an táng đồng thời 1 người mất tại 2 ô khác nhau. |
| **G07** | M06 | Thiếu ngày sinh khách hàng; người mất chỉ có năm sinh dẫn đến ép ngày 01/01 giả | Thêm `customers.date_of_birth` (nullable); thêm `deceased_profiles.birth_year` và `birth_date_precision` ('EXACT', 'YEAR_ONLY'). | Không bịa dữ liệu ngày tháng khi thân nhân chỉ nhớ năm sinh; kiểm tra ngày sinh ≤ ngày mất. |
| **G08** | M06 | `death_certificates` có default `is_verified=1`, `verified_at` tự sinh không có người xác minh | Chuyển default `is_verified` về 0, `verified_at` nullable, thêm `verified_by` FK trỏ tới `users`. | Giấy báo tử phải qua kiểm duyệt của nhân sự có thẩm quyền trước khi cho phép kích hoạt an táng. |
| **G09** | M07 | Hợp đồng thiếu timestamp ngày ký thực tế, ngày kích hoạt và số HĐ chuẩn | Thêm `signed_at`, `activated_at`, `template_version`; cấp số HĐ bằng sequence hoặc transaction-safe generator, không dùng `MAX()+1`. | Lịch sử in ấn, đối chiếu ngày ký giấy ngoài đời và ngày scan kích hoạt trên hệ thống. |
| **G10** | M08 | Cải táng không chỉ rõ slot trong ô nhiều slot; lịch sử thiếu actor thực hiện | Thêm `exhumation_contracts.slot_id`; bổ sung `burial_histories.actor_id`, `source_contract_id` / `source_annex_id`. | Sau khi cải táng 1 slot, các slot còn lại giữ nguyên; trạng thái ô chỉ về rỗng khi mọi slot đã trống. |
| **G11** | M09 | Thi công chỉ có 1 URL ảnh tổng, task thiếu cờ bắt buộc, thứ tự và nhân sự | Bổ sung `construction_tasks.is_required`, `sort_order`, `assignee_user_id`, và bảng `construction_task_evidences` (FK task, FK file). | Chưa hoàn thành task bắt buộc thì không thể đánh dấu tiến độ 100%. |
| **G12** | M10 | `care_annexes` thiếu `plot_id`, lịch chăm sóc thiếu chu kỳ `period_key` | Thêm `care_annexes.plot_id`, snapshot gói dịch vụ; thêm `care_schedules.period_key` và unique index `(annex_id, plot_id, period_key)`. | Chạy worker sinh lịch định kỳ nhiều lần không bao giờ bị nhân bản ca chăm sóc trong cùng 1 kỳ. |
| **G13** | M09–M10 | Thiếu lịch nghỉ phép của nhân viên dẫn đến phân công trùng | Thêm bảng `staff_unavailability` (user_id FK, start_date, end_date, reason). | Cảnh báo xung đột lịch trực/nghỉ của quản trang khi điều phối thi công hoặc chăm sóc. |
| **G14** | M11 | Ràng buộc CHECK trên `receivables` có thể chứa cả hợp đồng và phụ lục | Kiểm tra ràng buộc XOR (hoặc hợp đồng chính, hoặc phụ lục); `final_amount = original_amount - discount_amount`. | Khoản thu xác định duy nhất nguồn gốc phát sinh nghĩa vụ tài chính. |
| **G15** | M11 | Trigger payment chỉ xử lý INSERT, thiếu chống ghi nhận thanh toán trùng lặp | Thêm bảng `idempotency_requests` (actor_id, operation, idempotency_key, request_hash, response_json). | Thanh toán qua mạng bị retry không bao giờ ghi nhận nợ 2 lần. |
| **G16** | M11 | `discount_value` DECIMAL(10,2) nhỏ hơn hạn mức tiền lớn; thiếu căn cứ duyệt | Mở rộng kiểu dữ liệu lên `DECIMAL(15,2)`, ràng buộc chiết khấu ≤ số dư nợ còn lại; lưu actor phê duyệt. | Không làm âm số tiền phải thu, chỉ người có thẩm quyền mới được duyệt chiết khấu. |
| **G17** | M03–M12 | Thiếu hàng đợi sự kiện nền và quản lý xuất báo cáo bền vững | Thêm `background_jobs`, `outbox_events`, `notifications`, `report_exports`. | Worker xử lý bất đồng bộ các tác vụ nặng (render PDF, xuất Excel lớn), không nghẽn HTTP request. |
| **G18** | M05, M08 | Kim Tĩnh chưa có bảo vệ đa lớp; bảng `audit_logs` có nguy cơ bị sửa/xóa từ app | Bổ sung ràng buộc mức DB chống sửa/xóa ô mộ Kim Tĩnh đã khóa; phân quyền tài khoản app không có lệnh DELETE/UPDATE trên `audit_logs`. | Tuyệt đối không thể mở khóa Kim Tĩnh qua API hoặc giao diện. |
| **G19** | Theo module | Thiếu kiểm soát xung đột ghi đè đồng thời (concurrency) và cờ duyệt dữ liệu công khai | Thêm cột `rowversion` trên các aggregate nhạy cảm (plots, receivables); thêm cờ `is_public_approved` cho người mất và vị trí mộ. | Chặn race condition khi 2 người cùng cập nhật; không rò rỉ dữ liệu cá nhân ra cổng tra cứu công khai. |
| **G20** | M08 | Hợp đồng hỏa táng/cải táng chưa thể hiện ca thực tế đã diễn ra | Thêm bảng ghi nhận nhật ký thực hiện dịch vụ `service_executions` (contract_id FK, planned_date, completed_at, evidence_file_id). | Hỏa táng không gắn ô mộ vẫn được theo dõi tiến độ và chứng từ nghiệm thu dịch vụ. |
