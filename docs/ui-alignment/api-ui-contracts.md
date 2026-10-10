# Hợp Đồng Dữ Liệu API & Giao Diện (API & UI Data Contracts)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Mục tiêu:** Quy định cấu trúc DTO, phân trang, xử lý lỗi nghiệp vụ và kiểm soát truy cập tệp tin (File ACL) giữa FastAPI Backend và Web/Mobile Frontend.

---

## 1. Chuẩn hóa cấu trúc lỗi nghiệp vụ (Business Error Response Contract)

Mọi phản hồi lỗi (4xx, 5xx) từ API phải tuân thủ schema JSON thống nhất:

```json
{
  "code": "ERROR_BUSINESS_CODE",
  "detail": "Thông điệp mô tả lỗi chi tiết dành cho người dùng tiếng Việt",
  "field": "tên_trường_lỗi_nếu_có",
  "context": {
    "resource_id": 123,
    "current_status": "PENDING"
  }
}
```

Các mã lỗi tiêu biểu:
- `KIM_TINH_LOCKED`: Ô mộ đã khóa Kim Tĩnh bất biến, cấm mọi thao tác sửa đổi.
- `DEATH_CERTIFICATE_MISSING`: Thiếu giấy báo tử hợp lệ, không thể xác nhận an táng.
- `RESERVATION_CONFLICT`: Ô mộ đang được giữ chỗ bởi giao dịch khác.
- `TASK_INCOMPLETE`: Chưa hoàn thành đủ checklist bắt buộc hoặc thiếu ảnh bằng chứng.
- `PAYMENT_EXCEEDS_BALANCE`: Số tiền thu vượt quá số nợ còn lại.
- `FORBIDDEN_ACTOR_ACCESS`: Vai trò không có quyền truy cập tài nguyên này.

---

## 2. Chuẩn hóa phân trang & danh sách (Pagination Standard)

Mọi endpoint danh sách nội bộ áp dụng cơ chế phân trang tiêu chuẩn:

```
GET /api/v1/{resource}?page=1&size=20&search=keyword&status=ACTIVE
```

Cấu trúc JSON phản hồi:
```json
{
  "items": [],
  "total": 142,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

---

## 3. Danh mục API & DTO theo ngữ cảnh (Contextual API Contracts)

### 3.1. Phân hệ Cổng thông tin công khai (Public Portal)
- `GET /api/v1/profiles/public/memorials?q={query}&year={year}&town={town}&page=1&size=20`
  - **Trả về:** Danh sách người mất đã công bố (Zero PII).
- `GET /api/v1/plots/public/{plot_code}`
  - **Trả về:** Thông tin ô mộ công khai (mã ô, phân khu, hàng, số huyệt, trạng thái công bố).
- `GET /api/v1/plots/public/{plot_code}/route`
  - **Trả về:** Tọa độ Google Maps / Leaflet nếu `is_gps_verified == true`.
- `GET /api/v1/care/public/{plot_code}`
  - **Trả về:** Lịch sử chăm sóc đã được duyệt công bố (`PUBLISHED`).

### 3.2. Phân hệ Tác nghiệp Quản trang (Caretaker Operations)
- `GET /api/v1/construction/work-basis`
  - **Trả về:** Danh sách các phụ lục thi công/an táng đủ điều kiện tiếp nhận (không có thông tin giá tiền hay CCCD).
- `POST /api/v1/construction/orders`
  - **Payload:** Tạo lệnh thi công kèm checklist các hạng mục từ căn cứ.
- `POST /api/v1/construction/tasks/{task_id}/assign`
  - **Payload:** `{ "work_party_type": "PERSON|TEAM|EXTERNAL", "party_name": "Tên thợ/tổ", "supervisor_id": 2, "planned_start": "...", "planned_end": "..." }`
- `POST /api/v1/construction/orders/{order_id}/complete`
  - **Payload:** Nghiệm thu thi công sau khi kiểm tra 100% việc bắt buộc và ảnh hiện trường MinIO.
- `GET /api/v1/workforce` & `POST /api/v1/workforce`
  - **Quản lý danh bạ:** Thợ thi công, tổ xây dựng, nhà thầu ngoài.

### 3.3. Phân hệ Marketing & Hợp đồng (Marketing Journeys)
- `POST /api/v1/contracts`
  - **Payload:** Tạo hợp đồng mới theo 1 trong 4 loại (`LAND_PURCHASE`, `EXHUMATION`, `CREMATION`, `TRANSFER`).
- `GET /api/v1/contracts/{id}/print`
  - **Trả về:** DTO dữ liệu để in bản mẫu giấy tờ.
- `POST /api/v1/contracts/{id}/scan`
  - **Payload:** Tải lên bản scan đã ký ngoài đời (`file_id` từ MinIO).
- `POST /api/v1/contracts/{id}/activate`
  - **Hành động:** Kích hoạt hợp đồng sang `ACTIVE` và chuyển trạng thái ô mộ sang `OWNED_EMPTY`.
- `POST /api/v1/contracts/{id}/annexes`
  - **Payload:** Lập phụ lục (`BURIAL`, `CONSTRUCTION`, `CARE`).

### 3.4. Phân hệ Kế toán & Công nợ (Finance Operations)
- `GET /api/v1/finance/receivables`
  - **Trả về:** Danh sách nghĩa vụ nợ kèm hợp đồng/phụ lục căn cứ.
- `POST /api/v1/finance/payments`
  - **Headers:** `Idempotency-Key: {uuid}`
  - **Payload:** `{ "receivable_id": 1, "amount": "120000000.00", "payment_method": "BANK_TRANSFER|CASH", "reference_code": "..." }`
- `GET /api/v1/finance/receipts/{id}/pdf`
  - **Trả về:** Stream PDF biên lai có số phiếu duy nhất từ sequence.

---

## 4. Kiểm soát quyền tệp tin (File Access Control / ACL)

1. **Hợp đồng & Phụ lục ký:** Chỉ tài khoản có `contracts:read` hoặc `contracts:manage` mới được tải/xem.
2. **Giấy báo tử:** Chỉ Marketing và Sếp được tải bản scan gốc. Quản trang chỉ nhận cờ trạng thái `VERIFIED`.
3. **Biên lai tài chính:** Chỉ Kế toán và Sếp được tải bản in PDF.
4. **Bằng chứng thi công / chăm sóc:**
   - Ảnh gốc nội bộ: Chỉ lưu hành giữa Quản trang, Marketing (tiến độ) và Sếp.
   - Ảnh công khai: Chỉ derivative hoặc ảnh đã được Quản trang gắn nhãn `PUBLISHED` mới được trả cho cổng thân nhân.
