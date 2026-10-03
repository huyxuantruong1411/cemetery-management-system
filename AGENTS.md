# Hướng Dẫn Coding Agent & Quản Trị Dự Án (AGENTS.md)

> **Dành cho:** AI Coding Agents & Nhà phát triển  
> **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
> **Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md)  
> **Trạng thái thực thi hiện tại:** [`docs/execution/STATE.md`](docs/execution/STATE.md)

---

## 1. Nguyên tắc cốt lõi & Nguồn sự thật

1. **Bảo toàn CSDL thực tế:** Tuyệt đối không chạy lại script bootstrap `docs/source/lab4-sql.sql` vì chứa lệnh `DROP DATABASE`. CSDL vật lý trên `DESKTOP-HKIPI1M` là tài sản đã được tạo sẵn. Mọi sửa đổi schema phải qua migration Alembic tăng dần.
2. **Quy tắc Kim Tĩnh Bất Biến:** Một khi ô mộ được an táng theo hình thức Kim Tĩnh, ô bị khóa vĩnh viễn mức CSDL và service. Chặn mọi hành vi sửa cấu trúc, hạ cờ, cải táng, chuyển nhượng hoặc an táng thêm.
3. **Thực thi nghiệp vụ trên Server:** Mọi ràng buộc bảo mật, phân quyền (RBAC), kiểm tra giấy báo tử, tính toán nợ và chống trùng giao dịch phải được thực thi tại FastAPI backend. Frontend Web và Mobile chỉ hiển thị và gửi lệnh command.
4. **Không phỏng đoán dữ liệu:** Không bịa đặt tọa độ GPS, họ tên người mất thật, số CCCD hay giá cả. Sử dụng bộ dữ liệu giả lập (synthetic data) có dán nhãn rõ ràng cho mục đích test/demo.
5. **Tiền tệ chuẩn xác:** Toàn bộ giá trị tiền tệ sử dụng `DECIMAL(15,2)` trong SQL và Python `Decimal` (`ROUND_HALF_UP`). Cấm dùng `Float` để tính toán tài chính.
6. **Lưu trữ tệp MinIO trên ổ D:** Toàn bộ dữ liệu MinIO (`backend/runtime/minio/data`), logs, uploads, backups phải nằm trên ổ đĩa dữ liệu ngoài C.

---

## 2. Kiến trúc 3 tầng chuẩn mực

- **Router (`backend/app/modules/*/router.py`):**
  - Nhận HTTP request, kiểm tra xác thực quyền (JWT + permission scope).
  - Validate dữ liệu đầu vào bằng Pydantic v2 schemas.
  - Gọi Service tương ứng và trả về DTO tiêu chuẩn.
- **Service (`backend/app/modules/*/service.py`):**
  - Chứa 100% logic nghiệp vụ, quy tắc chuyển đổi trạng thái và transaction ACID.
  - Đảm bảo tính toàn vẹn (invariants), phát sinh sự kiện outbox và ghi audit logs.
- **Repository (`backend/app/modules/*/repository.py`):**
  - Truy vấn CSDL SQLAlchemy 2.x có tham số hóa chống SQL Injection.
  - Sử dụng khóa dòng MSSQL thích hợp (`with_for_update` / isolation) khi xử lý tranh chấp giữ chỗ hoặc thanh toán.
  - Tắt `implicit_returning` trên các bảng có trigger (`plots`, `payments`).

---

## 3. Công cụ & Quy trình phát triển

- **Backend:** Quản lý bằng **`uv`** (`uv run pytest`, `uv run ruff check .`).
- **Web Frontend:** Quản lý bằng **`pnpm`** (`pnpm dev`, `pnpm build`, `pnpm lint`).
- **Mobile:** Flutter stable (`flutter analyze`, `flutter test`).
- **Giao diện:** Xử lý trọn vẹn 4 trạng thái: `Loading`, `Normal`, `Empty Data` (kèm CTA), `Error` (kèm nút Thử lại). Thiết kế tôn nghiêm, dễ thao tác ngoài trời.
