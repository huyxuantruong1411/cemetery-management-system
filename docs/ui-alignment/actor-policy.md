# Chính Sách Phân Quyền Theo Actor (Actor Policy & Access Control Matrix)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Baseline kiểm chứng:** 7467905
- **Mục tiêu:** Định nghĩa quyền đọc/ghi, phạm vi tài nguyên (Resource Scope), DTO Allowlist và danh sách hành vi cấm tuyệt đối (Deny Policy) cho các nhóm Actor: Marketing, Kế toán, Quản trang, Public và Tài khoản role rỗng.
- **Nguyên tắc bất biến:** Server-side Enforcement — Frontend chỉ render giao diện và gửi command; FastAPI backend chịu trách nhiệm 100% kiểm tra quyền và lọc dữ liệu. Mặc định từ chối (Default Deny) mọi quyền ngoài phạm vi được phân công.

---

## 1. Ma trận chức năng, dữ liệu và thao tác theo Actor

| Chức năng | Marketing | Kế toán | Quản trang | Public / thân nhân | Sếp (ADMIN) |
|---|---|---|---|---|---|
| **Khu/hàng/ô, loại mộ, slot** | Đọc lựa chọn/bản đồ phục vụ giao dịch (`plots:read`); không cấu hình C/U/D | Chỉ mã ô liên quan nghĩa vụ thu trong FinanceBasis | Đọc sơ đồ hiện trường (`plots:read`); không cấu hình C/U/D | Bản công bố tối thiểu qua cổng tra cứu | Toàn quyền quy hoạch C/U/D (`plots:manage`) |
| **Khách hàng/thân nhân, người mất, quan hệ** | C/R/U và liên kết theo UC (`customers:*`, `deceased:*`); xác minh đúng luồng | Không vào danh bạ; chỉ người trả/liên hệ cần thu trong FinanceBasis | Không vào danh bạ; chỉ thông tin nhận diện phần mộ/công việc trong WorkBasis | Tra cứu thông tin tưởng niệm được công bố Zero PII | Toàn quyền kiểm soát (`customers:*`, `deceased:*`) |
| **Hợp đồng/phụ lục** | Tạo/sửa bản nháp, in, nạp bản ký, kích hoạt (`contracts:*`); hủy bằng command | Không vào module pháp lý; đọc căn cứ khoản phải thu qua FinanceBasis | Không vào module pháp lý; đọc căn cứ công việc qua WorkBasis | Không truy cập nội bộ | Toàn quyền giám sát & quản trị |
| **Đăng ký chăm sóc** | Đăng ký/gia hạn qua phụ lục; chọn gói có hiệu lực (`contracts:write`, `catalog:read`) | Nhận nghĩa vụ tài chính phát sinh | Nhận phạm vi, chu kỳ, thời hạn đã bàn giao | Xem kết quả được công bố | Toàn quyền giám sát |
| **Thi công, ca chăm sóc** | Chỉ xem tóm tắt tiến độ/kết quả của hồ sơ dịch vụ liên quan (`construction:read`) | Không điều phối | Lập checklist/lịch, phân công, cập nhật, ảnh minh chứng, đóng ca (`construction:*`, `care:*`) | Không điều phối | Giám sát vận hành |
| **Trạng thái an táng thực địa** | Không xác nhận thay Quản trang | Không thao tác | Xác nhận bằng command hiện trường có căn cứ hợp lệ (`plots:confirm_burial`); không sửa status tùy ý | Không thao tác | Xác nhận dự phòng khi cần; không bypass Kim Tĩnh |
| **Thu tiền, chiết khấu, biên lai** | Không vào sổ tài chính; chỉ xem trạng thái thanh toán của hồ sơ | Tạo khoản thu hợp lệ, ghi nhận thanh toán, chiết khấu theo policy, xuất/tạo lại biên lai (`finance:*`) | Không truy cập tài chính | Thanh toán ngoài hệ thống | Giám sát & phê duyệt chính sách |
| **Báo cáo** | Không báo cáo doanh nghiệp | Xem/xuất doanh thu (`reports:revenue`) | Không báo cáo doanh nghiệp; xem số việc trong workspace riêng | Không truy cập | Toàn bộ 4 loại báo cáo doanh nghiệp (`reports:read`) |
| **Gói mẫu, mẫu HĐ, bảng giá** | Chọn dữ liệu có hiệu lực (`catalog:read`); không C/U/D cấu hình | Đọc snapshot giá của nghĩa vụ (`catalog:read`); không C/U/D cấu hình | Nhận yêu cầu kỹ thuật snapshot (`catalog:read`); không C/U/D cấu hình | Chỉ nội dung công bố nếu có | Toàn quyền cấu hình bảng giá, gói, mẫu HĐ (`catalog:manage`) |
| **Tài khoản, phân quyền, audit** | Không truy cập | Không truy cập | Không truy cập; danh sách thợ là lookup điều phối riêng | Không truy cập | Toàn quyền quản trị tài khoản, quyền và nhật ký kiểm toán |

---

## 2. Đặc tả các ngoại lệ phối hợp liên phân hệ (Projections EX-01 ... EX-06)

Các ngoại lệ phối hợp phải được hiện thực bằng endpoint/projection chuyên biệt, allowlist trường dữ liệu chặt chẽ; không tái sử dụng DTO đầy đủ rồi che trường ở client.

### EX-01 — WorkBasis DTO (Dành cho Quản trang)
- **Mục đích:** Cung cấp thông tin cần thiết để điều phối thi công, thực hiện chăm sóc mộ và xác nhận an táng ngoài hiện trường.
- **Dữ liệu cho phép (Allowlist):**
  - `annex_id`, `annex_code`, `annex_type` (`BURIAL`, `CARE`, `CONSTRUCTION`, `EXHUMATION`)
  - `contract_id`, `contract_code`
  - `status` (`ACTIVE`, `PENDING_ACTIVATION`, `COMPLETED`)
  - `signed_at`, `target_date`, `due_date`
  - `plot_id`, `plot_code`, `zone_code`, `slot_number`
  - `deceased_id`, `deceased_name` (chỉ dùng nhận diện phần mộ/khắc bia)
  - `service_summary`, `checklist_requirements`
  - `is_burial_confirmed`, `burial_date`
- **Dữ liệu tuyệt đối cấm (Deny / Strip):**
  - Toàn bộ hồ sơ khách, số CCCD, địa chỉ nhà, số điện thoại khách hàng.
  - Số tiền, công nợ, giá gói dịch vụ, thông tin chiết khấu.
  - Bản scan/PDF hợp đồng pháp lý, bản scan giấy báo tử.

### EX-02 — FinanceBasis DTO (Dành cho Kế toán)
- **Mục đích:** Cung cấp căn cứ hợp lệ để lập khoản phải thu, theo dõi thanh toán và xuất biên lai mà không mở toàn bộ hồ sơ pháp lý.
- **Dữ liệu cho phép (Allowlist):**
  - `contract_id`, `contract_code`, `contract_type`
  - `annex_id`, `annex_code`, `annex_type`
  - `source_type` (`CONTRACT`, `ANNEX`)
  - `status`, `signed_at`
  - `payer_name`, `payer_phone` (thông tin cần thiết để xuất chứng từ và liên hệ thanh toán)
  - `plot_code`, `zone_code`
  - `total_amount`, `paid_amount`, `remaining_balance`, `due_date`
  - `service_description`
- **Dữ liệu tuyệt đối cấm (Deny / Strip):**
  - Danh bạ khách hàng toàn hệ thống, CCCD, địa chỉ nhà không liên quan chứng từ.
  - Hồ sơ người mất, giấy báo tử.
  - Toàn văn điều khoản hợp đồng và bản scan/PDF hợp đồng.

### EX-03 — Tiến độ thi công/chăm sóc (Dành cho Marketing)
- **Mục đích:** Cho phép nhân viên kinh doanh theo dõi tiến độ và xem ảnh kết quả để cập nhật cho khách hàng.
- **Dữ liệu cho phép (Allowlist):**
  - Mã đơn việc, trạng thái tiến độ (`PENDING`, `IN_PROGRESS`, `COMPLETED`), ngày hẹn bàn giao.
  - Ảnh minh chứng đã duyệt công bố hoặc gắn liền trực tiếp với hợp đồng/phụ lục mà khách hàng đó ký.
- **Dữ liệu tuyệt đối cấm (Deny / Strip):**
  - Toàn bộ danh sách công việc của nghĩa trang, lịch nghỉ/vắng mặt của nhân sự, evidence của các công việc không liên quan.
  - Quyền phân công thợ, sửa checklist hoặc đóng ca.

### EX-04 — Lookup Bán hàng & Dịch vụ (Dành cho Marketing / Quản trang)
- **Mục đích:** Tra cứu bảng giá niêm yết, gói chăm sóc và mẫu hợp đồng hiệu lực để tư vấn và lập giao dịch.
- **Dữ liệu cho phép (Allowlist):**
  - Danh sách bảng giá, khoản mục giá đang `is_active = True`.
  - Danh sách gói chăm sóc đang `is_active = True`.
  - Danh sách mẫu hợp đồng đang hiệu lực (`is_active = True`).
- **Dữ liệu tuyệt đối cấm (Deny / Strip):**
  - Màn hình cấu hình, thêm/sửa/xóa bảng giá, sửa đơn giá, tạo gói mẫu, bump version hợp đồng.

### EX-05 — Danh bạ người thực hiện (Staff Lookup cho Điều phối)
- **Mục đích:** Lấy danh sách nhân viên đủ điều kiện để phân công ca chăm sóc hoặc giám sát thi công.
- **Dữ liệu cho phép (Allowlist):**
  - `user_id`, `username`, `full_name`, `roles` của nhân viên đang hoạt động (`is_active = True`).
- **Dữ liệu tuyệt đối cấm (Deny / Strip):**
  - Danh bạ quản trị, mật khẩu, permissions chi tiết, phiên đăng nhập hoặc tài khoản đã bị vô hiệu hóa.

### EX-06 — DTO Công bố Công khai (Public Portal)
- **Mục đích:** Tra cứu thông tin tưởng niệm người quá cố và chỉ đường tôn nghiêm.
- **Dữ liệu cho phép (Allowlist):**
  - `deceased_full_name`, `birth_year`, `date_of_death`, `hometown`.
  - `plot_code`, `row_code`, `zone_code`.
  - Tọa độ GPS đã được xác minh (`gps_verified = True`) phục vụ dẫn đường.
  - Ảnh chăm sóc đã duyệt công bố Zero PII.
- **Dữ liệu tuyệt đối cấm (Deny / Strip):**
  - Mọi thông tin thân nhân/chủ hộ (CCCD, SĐT, địa chỉ), giá tiền, hợp đồng, chứng từ gốc chưa công bố.

---

## 3. Chính sách tài khoản Role Rỗng (roles = [])

1. **Từ chối mặc định:** Tài khoản có phiên đăng nhập hợp lệ nhưng danh sách vai trò rỗng (`roles = []`) bị từ chối truy cập toàn bộ các route nghiệp vụ nội bộ (trả về `403 Forbidden`).
2. **Quyền duy nhất được phép:** Xem thông tin phiên của chính mình (`GET /api/v1/auth/me`), làm mới token (`POST /api/v1/auth/refresh`), và đăng xuất (`POST /api/v1/auth/logout`).
3. **Giao diện Web:** Hiển thị thông báo tài khoản chưa được cấp quyền kèm nút Đăng xuất; không fallback vào Hồ sơ hay bất kỳ module nội bộ nào; không thực hiện fetch API nghiệp vụ.
