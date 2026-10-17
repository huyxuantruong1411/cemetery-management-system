# Hợp Đồng Dữ Liệu API & Giao Diện (API & UI Data Contracts)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Baseline:** 7467905
- **Mục tiêu:** Quy định cấu trúc DTO, phân trang, các endpoint projection (WorkBasis, FinanceBasis), lệnh command thực địa và kiểm soát truy cập tệp tin (File ACL) giữa FastAPI Backend và Web/Mobile Frontend.

---

## 1. Chuẩn hóa cấu trúc lỗi nghiệp vụ (Business Error Response Contract)

Mọi phản hồi lỗi (4xx, 5xx) từ API tuân thủ schema JSON thống nhất:

```json
{
  "detail": "Thông điệp mô tả lỗi chi tiết dành cho người dùng tiếng Việt"
}
```

Các mã HTTP status tiêu chuẩn:
- `401 Unauthorized`: Chưa đăng nhập, thiếu Bearer token, token hết hạn hoặc `auth_version` đã bị thu hồi.
- `403 Forbidden`: Người dùng đã xác thực nhưng vai trò/quyền hạn không thỏa mãn capability yêu cầu, hoặc tài khoản có `roles = []`.
- `404 Not Found`: Không tìm thấy tài nguyên.
- `409 Conflict`: Xung đột dữ liệu hoặc tranh chấp đồng thời (giữ chỗ ô mộ, trùng CCCD, xung đột ca trực, Kim Tĩnh đã khóa).
- `422 Unprocessable Entity`: Dữ liệu đầu vào không hợp lệ theo Pydantic schema.

---

## 2. Danh mục API & DTO theo ngữ cảnh (Contextual API Contracts)

### 2.1. Phân hệ Cổng thông tin công khai (Public Portal - Zero PII)
- `GET /api/v1/profiles/public/memorials?q={query}&limit=20`
  - **Trả về:** Danh sách người mất đã công bố (họ tên, năm sinh, năm mất, quê quán, mã ô mộ, vị trí khu/hàng). Tuyệt đối không chứa CCCD, SĐT hay địa chỉ thân nhân.
- `GET /api/v1/plots/public/{code}`
  - **Trả về:** Thông tin ô mộ công khai tối thiểu.
- `GET /api/v1/plots/public/{code}/route`
  - **Trả về:** Tọa độ GPS chỉ khi đã được xác minh (`gps_verified = true`). Dữ liệu demo mô phỏng không bật liên kết Google Maps ngoài thực địa.

### 2.2. Phân hệ Tác nghiệp Quản trang & Căn Cứ Công Việc (WorkBasis - EX-01)
- `GET /api/v1/contracts/work-bases`
  - **Quyền:** `CARETAKER`, `ADMIN` (yêu cầu `plots:read` hoặc `construction:read` hoặc `care:read`).
  - **Trả về:** Danh sách các căn cứ phụ lục hợp đồng (`BURIAL`, `CARE`, `CONSTRUCTION`, `EXHUMATION`) ở trạng thái có hiệu lực.
  - **DTO Schema (`WorkBasisResponse`):**
    ```json
    {
      "annex_id": 12,
      "annex_code": "PL-AT-0001",
      "contract_id": 5,
      "contract_code": "HD-MD-2026-0001",
      "annex_type": "BURIAL",
      "status": "ACTIVE",
      "signed_at": "2026-10-15",
      "plot_id": 42,
      "plot_code": "A-H01-05",
      "zone_code": "A",
      "slot_number": 1,
      "deceased_id": 10,
      "deceased_name": "Nguyễn Văn A",
      "burial_date": "2026-10-20",
      "is_burial_confirmed": false,
      "service_summary": "An táng hình thức Kim Tĩnh huyệt số 1"
    }
    ```
- `POST /api/v1/contracts/annexes/{annex_id}/confirm-burial`
  - **Quyền:** `CARETAKER`, `ADMIN` (yêu cầu capability `plots:confirm_burial`).
  - **Payload:** `{ "proof_file_id": "file_uuid_ready", "notes": "Đã hạ huyệt và hoàn tất an táng thực địa" }`
  - **Hành động:** Chuyển slot và ô mộ sang `OCCUPIED`. Nếu Kim Tĩnh: khóa vĩnh viễn (`is_kim_tinh = true, is_locked = true`), ghi nhận `BurialHistory` và outbox event `BURIAL_COMPLETED`.

### 2.3. Phân hệ Kế toán & Căn Cứ Tài Chính (FinanceBasis - EX-02)
- `GET /api/v1/finance/bases`
  - **Quyền:** `ACCOUNTANT`, `ADMIN` (yêu cầu `finance:read`).
  - **Trả về:** Danh sách các căn cứ nghĩa vụ tài chính từ Hợp đồng và Phụ lục.
  - **DTO Schema (`FinanceBasisResponse`):**
    ```json
    {
      "contract_id": 5,
      "contract_code": "HD-MD-2026-0001",
      "contract_type": "LAND_PURCHASE",
      "annex_id": 12,
      "annex_code": "PL-AT-0001",
      "source_type": "ANNEX",
      "status": "ACTIVE",
      "signed_at": "2026-10-15",
      "payer_name": "Trần Thị B",
      "payer_phone": "0912345678",
      "plot_code": "A-H01-05",
      "total_amount": 15000000.00,
      "paid_amount": 0.00,
      "balance": 15000000.00,
      "due_date": "2026-10-22",
      "service_description": "Phụ lục an táng ô mộ A-H01-05"
    }
    ```
- `POST /api/v1/finance/receivables/{id}/discount`
  - **Quyền:** `ACCOUNTANT`, `ADMIN` (yêu cầu `finance:discount`).
  - **Payload:** `{ "discount_amount": 500000.00, "reason": "Chính sách ưu đãi mở bán đợt 1", "policy_reference": "QD-2026-CS01" }`
- `POST /api/v1/finance/payments/{payment_id}/regenerate-invoice`
  - **Quyền:** `ACCOUNTANT`, `ADMIN` (yêu cầu `finance:collect`).

### 2.4. Phân hệ Báo cáo Doanh thu (Revenue Report - UC-7.1 / UC-7.5)
- `GET /api/v1/reports/revenue?start_date=...&end_date=...`
  - **Quyền:** `ACCOUNTANT`, `ADMIN` (yêu cầu `reports:revenue`).
- `POST /api/v1/reports/exports`
  - **Quyền:**
    - `REVENUE`: cho phép `ACCOUNTANT`, `ADMIN`.
    - `OCCUPANCY`, `CONTRACTS`, `OPERATIONS`: chỉ dành cho `ADMIN` (yêu cầu `reports:read`).
- `GET /api/v1/reports/exports/{id}/download`
  - **Kiểm soát quyền:** Người yêu cầu tạo bản xuất (`requester_id == user.user_id`) hoặc `ADMIN`.

---

## 3. Kiểm soát quyền truy cập tệp tin (File Access Control / ACL)

1. **Tệp nháp chưa liên kết (Unbound Draft File):**
   - Chỉ chính người tải lên (`file_obj.uploaded_by_user_id == user.user_id`) hoặc `ADMIN` mới có quyền xem trước/tải xuống.
2. **Hợp đồng & Phụ lục ký (Signed Scan / PDF):**
   - Chỉ tài khoản có `contracts:read` (Marketing, Admin) mới được tải/xem. Quản trang và Kế toán bị từ chối 403 Forbidden.
3. **Giấy báo tử (Death Certificate Scan):**
   - Chỉ Marketing và Admin được tải. Quản trang và Kế toán bị từ chối 403 Forbidden.
4. **Biên lai tài chính (Invoice / Receipt PDF):**
   - Chỉ Kế toán và Admin được tải (`finance:read`). Marketing và Quản trang bị từ chối 403 Forbidden.
5. **Báo cáo xuất bản (Report Export File):**
   - File xuất Báo cáo Doanh thu (`REVENUE`): Kế toán và Admin (đúng requester).
   - File xuất Báo cáo Lấp đầy/Hợp đồng/Vận hành (`OCCUPANCY`/`CONTRACTS`/`OPERATIONS`): chỉ Admin.
