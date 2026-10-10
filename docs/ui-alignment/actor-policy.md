# Chính Sách Phân Quyền Theo Actor (Actor Policy & Access Control Matrix)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Mục tiêu:** Định nghĩa quyền đọc/ghi, phạm vi tài nguyên (Resource Scope), DTO Allowlist và danh sách hành vi cấm tuyệt đối (Deny Policy) cho 5 nhóm Actor.
- **Nguyên tắc bất biến:** Server-side Enforcement — Frontend chỉ render giao diện và gửi command; FastAPI backend chịu trách nhiệm 100% kiểm tra quyền và lọc dữ liệu.

---

## 1. Ma trận quyền hạn theo Actor (Actor Capability Matrix)

| Nhóm Capability | Mô tả | Public | Quản trang (CARETAKER) | Marketing (MARKETING) | Kế toán (ACCOUNTANT) | Sếp (ADMIN) |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `memorial:public_lookup` | Tra cứu mộ công khai, thông tin người mất đã công bố | **CHO PHÉP** | CHO PHÉP | CHO PHÉP | CHO PHÉP | CHO PHÉP |
| `memorial:public_care_read` | Xem kết quả chăm sóc đã được duyệt công bố | **CHO PHÉP** | CHO PHÉP | CHO PHÉP | CHO PHÉP | CHO PHÉP |
| `work_basis:read` | Đọc căn cứ thi công/chăm sóc (chỉ phạm vi, không giá) | TỪ CHỐI | **CHO PHÉP** | CHO PHÉP | TỪ CHỐI | CHO PHÉP |
| `construction:coordinate` | Lập checklist, phân công, kiểm tra, nghiệm thu thi công | TỪ CHỐI | **CHO PHÉP** | TỪ CHỐI | TỪ CHỐI | Giám sát |
| `care:coordinate` | Lập lịch, điều phối thợ, kiểm tra, đóng ca chăm sóc | TỪ CHỐI | **CHO PHÉP** | TỪ CHỐI | TỪ CHỐI | Giám sát |
| `workforce:manage` | Quản lý danh bạ thợ/tổ đội/nhà thầu ngoài | TỪ CHỐI | **CHO PHÉP** | TỪ CHỐI | TỪ CHỐI | CHO PHÉP |
| `plots:burial_verify` | Nghiệm thu an táng, xác nhận giấy báo tử & khóa Kim Tĩnh | TỪ CHỐI | **CHO PHÉP** | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI (không bypass) |
| `customers:manage` | Tiếp nhận, tạo/sửa hồ sơ thân nhân và CCCD | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | Xem cơ bản | CHO PHÉP |
| `deceased:manage` | Lập hồ sơ người mất, tiếp nhận giấy báo tử MinIO | TỪ CHỐI | Xem trạng thái | **CHO PHÉP** | TỪ CHỐI | CHO PHÉP |
| `contracts:manage` | Lập 4 loại HĐ, in bản giấy, kích hoạt sau ký | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | TỪ CHỐI | Xem giám sát |
| `annexes:manage` | Lập 3 loại phụ lục (An táng, Thi công, Chăm sóc) | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | TỪ CHỐI | Xem giám sát |
| `finance_basis:read` | Đọc nguồn nghĩa vụ tài chính từ HĐ/PL ACTIVE | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | CHO PHÉP |
| `finance:collect` | Ghi nhận thu tiền, xuất biên lai, quản lý công nợ | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | Xem giám sát |
| `finance:discount` | Áp dụng ưu đãi/chiết khấu theo hạn mức/phê duyệt | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | Phê duyệt |
| `reports:revenue_read` | Báo cáo doanh thu và dòng tiền thực tế | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** | **CHO PHÉP** |
| `reports:occupancy_read` | Báo cáo tỷ lệ lấp đầy phân khu đất | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |
| `reports:contracts_read` | Báo cáo tình hình ký kết hợp đồng | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |
| `reports:operations_read` | Báo cáo vận hành thi công & chăm sóc | TỪ CHỐI | Xem phạm vi | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |
| `catalog:manage` | Quản lý bảng giá, gói chăm sóc, loại mộ | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |
| `spatial:manage` | Quy hoạch phân khu/hàng/ô, cập nhật GPS | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |
| `accounts:manage` | Tạo/khóa tài khoản, phân quyền vai trò | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |
| `audit:read` | Xem nhật ký kiểm toán hệ thống | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | TỪ CHỐI | **CHO PHÉP** |

---

## 2. Quy định Allowlist DTO theo Actor (Contextual DTO Allowlist)

### 2.1. Public Memorial DTO (Cổng Thân Nhân / Khách)
- **Cho phép (Allowlist):**
  - `public_code` (Mã công khai, ví dụ: `A-H01-04-P`)
  - `deceased_full_name` (Họ tên người mất)
  - `birth_year` / `date_of_birth` (Năm sinh hoặc ngày sinh theo cờ chính xác)
  - `date_of_death` (Ngày mất)
  - `hometown` (Quê quán)
  - `plot_code` (Mã ô mộ), `row_code`, `zone_code`
  - `gps_latitude`, `gps_longitude` (Chỉ khi đã được Sếp xác minh `is_gps_verified = true`)
  - `care_public_updates`: Danh sách các đợt chăm sóc đã được duyệt công bố (`performed_at`, `summary_tasks`, `public_photo_url`).
- **Tuyệt đối cấm (Deny / Strip):**
  - Số CCCD, số điện thoại, địa chỉ của thân nhân/khách hàng.
  - Số tiền, hợp đồng, công nợ, giá gói dịch vụ.
  - Tên/SĐT của thợ thi công hoặc quản trang thực hiện ca.
  - Hình ảnh nội bộ chưa kiểm duyệt (giấy tờ chứng tử, ảnh có mặt người/biển số xe).

### 2.2. Work Basis DTO (Dành cho Quản Trang)
- **Cho phép (Allowlist):**
  - `basis_code` (Mã căn cứ: ví dụ `PL-TC-018`, `PL-AT-020`)
  - `work_type` (`CONSTRUCTION`, `CARE`, `BURIAL`, `EXHUMATION`)
  - `plot_code`, `slot_number`
  - `deceased_name`, `birth_year`, `date_of_death` (Chỉ dùng để đối chiếu thi công bia/khắc tên)
  - `scope_items` / `checklist`: Danh sách các hạng mục kỹ thuật cần thi công hoặc chăm sóc
  - `target_date`, `due_date`
  - `certificate_status` (`VERIFIED` / `MISSING` - cờ kiểm tra, không kèm scan)
- **Tuyệt đối cấm (Deny / Strip):**
  - Giá trị hợp đồng, số tiền thu, chiết khấu, phương thức thanh toán.
  - Bản scan hợp đồng PDF hoặc biên lai thu tiền.
  - Số CCCD, nơi công tác của khách hàng.

### 2.3. Finance Basis DTO (Dành cho Kế Toán)
- **Cho phép (Allowlist):**
  - `receivable_id`, `receivable_code`
  - `contract_id`, `contract_number`, `annex_id`, `annex_number`
  - `customer_name`, `customer_phone` (để liên hệ chứng từ)
  - `total_amount`, `paid_amount`, `remaining_balance`
  - `due_date`, `payment_status`
- **Tuyệt đối cấm (Deny / Strip):**
  - Bản scan giấy báo tử của người mất.
  - Ảnh thi công hiện trường hoặc nhật ký kỹ thuật của quản trang.
  - Lịch trình phân công nhân sự nội bộ.

---

## 3. Chính sách cấm nghiêm ngặt (Strict Deny Policies)

1. **Deny Admin Invariant Bypass:**
   - Quản trị viên (`ADMIN`) có thể có quyền trên mọi route quản trị, nhưng **KHÔNG ĐƯỢC PHÉP** bypass các bất biến nghiệp vụ:
     - Không thể an táng nếu thiếu giấy báo tử hợp lệ.
     - Không thể xóa, cải táng, sửa cấu trúc hoặc an táng thêm vào ô mộ đã khóa Kim Tĩnh.
     - Không thể ghi nhận thu tiền với giá trị âm hoặc vượt quá số nợ còn lại mà không có đối soát.
2. **Deny Caretaker Financial Access:**
   - Quản trang gọi trực tiếp `/api/v1/contracts/{id}`, `/api/v1/contracts/{id}/pdf`, `/api/v1/finance/receivables`, `/api/v1/reports/revenue` phải bị trả về `403 Forbidden` ngay lập tức.
3. **Deny Public PII Leaks:**
   - Mọi request không có Bearer token nội bộ khi gọi endpoint tra cứu công khai tuyệt đối không bao giờ nhận được bất kỳ trường nào liên quan đến người sống (thân nhân, khách hàng) hoặc giá cả.
4. **Deny Marketing Operational Closure:**
   - Nhân viên Marketing không được phép nghiệm thu thi công hoặc đóng ca chăm sóc mộ. Thao tác này độc quyền thuộc về Quản trang.
