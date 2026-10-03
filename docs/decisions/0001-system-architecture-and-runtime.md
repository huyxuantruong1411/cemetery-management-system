# ADR-001: Kiến Trúc Hệ Thống và Thiết Lập Môi Trường Vận Hành (System Architecture & Runtime)

**Trạng thái:** Đã chấp thuận (Accepted)  
**Ngày:** 03/10/2026  
**Người quyết định:** Chủ dự án & Coding Agent

---

## 1. Bối cảnh (Context)
Dự án "Quản lý nghĩa trang tư nhân" bao gồm 8 phân hệ nghiệp vụ phức tạp với yêu cầu kiểm soát giao dịch chặt chẽ giữa ô mộ, hợp đồng pháp lý, tiến độ thi công thực địa và thu chi tài chính.
- Hệ thống cần phục vụ 2 nhóm client:
  1. Giao diện Web nội bộ cho 4 vai trò (Quản trị viên/Sếp, Nhân viên Marketing, Kế toán, Quản trang) và cổng tra cứu công khai.
  2. Ứng dụng di động Flutter (Android) cho Quản trang thao tác ngoài hiện trường (chụp ảnh, nghiệm thu, đồng bộ khi có mạng) và tra cứu nhanh.
- Cơ sở dữ liệu Microsoft SQL Server 2022 đã được tạo sẵn trên máy chủ `DESKTOP-HKIPI1M` với 37 bảng nghiệp vụ và 2 triggers. Kịch bản SQL gốc chứa lệnh `DROP DATABASE` cực kỳ nguy hiểm.
- Dung lượng ổ C hạn chế (~22GB free), trong khi ổ D còn dồi dào (>87GB free). Cần tránh làm đầy ổ C bởi dữ liệu tệp (MinIO), cache và container logs.

---

## 2. Quyết định kiến trúc (Decisions)

### 2.1. Mô hình Monorepo và Modular Monolith
- Chọn mô hình **Modular Monolith**: Một ứng dụng backend FastAPI duy nhất chia thành các module nghiệp vụ độc lập (`auth`, `catalog`, `plots`, `profiles`, `contracts`, `construction`, `care`, `finance`, `reports`, `audit`).
- Cấu trúc thư mục dự án:
  - `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, worker nền, lưu trữ MinIO adapter.
  - `web/`: Ứng dụng React + TypeScript + Vite + Tailwind CSS + shadcn/ui.
  - `mobile/`: Ứng dụng Flutter Android.
  - `packages/`: Client API sinh tự động từ OpenAPI specs.
  - `docs/`: Tài liệu kế hoạch, thiết kế, quyết định kiến trúc, bằng chứng kiểm thử và runbooks.
  - `scripts/`: Bộ công cụ tự động hóa kiểm tra môi trường, khởi động dev, migration và quality gate.

### 2.2. Backend & Quản lý Thư viện
- **FastAPI** (Python 3.12) chạy native trên Windows.
- Sử dụng **`uv`** làm trình quản lý dependency và virtualenv (`pyproject.toml`, `uv.lock`). Không dùng pip chay hay requirements.txt.
- **SQLAlchemy 2.x** kết hợp **pyodbc** và **Microsoft ODBC Driver 18 for SQL Server** với Windows Authentication (`Trusted_Connection=yes;TrustServerCertificate=yes`).
- Tắt `implicit_returning` trên các model có bảng chứa trigger (`plots`, `payments`) để tương thích trọn vẹn với MSSQL.
- Tiến trình migration độc lập với runtime bằng **Alembic**.

### 2.3. Lưu trữ Tệp MinIO trên ổ D
- Khởi chạy MinIO container qua Docker Compose phục vụ môi trường phát triển cục bộ.
- Bắt buộc cấu hình bind mount đưa toàn bộ thư mục dữ liệu MinIO về:
  `./runtime/minio/data` nằm dưới thư mục `backend/` trên ổ đĩa D (`D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data`).
- Mọi thao tác tải lên/tải xuống tệp đều đi qua API FastAPI có kiểm tra quyền và mã hóa định danh, không cấp quyền truy cập công khai trực tiếp tới MinIO bucket.

### 2.4. Frontend Web & Quản lý Package
- Sử dụng **`pnpm`** cho toàn bộ các tác vụ cài đặt thư viện và build web.
- UI dựa trên **Tailwind CSS**, thư viện thành phần **shadcn/ui**, icon **Lucide**, bản đồ **Leaflet**.
- Xử lý biểu mẫu với **React Hook Form + Zod**, server state với **TanStack Query**.
- Đảm bảo 100% màn hình xử lý đầy đủ 4 trạng thái: Đang tải (Loading), Dữ liệu bình thường (Normal), Dữ liệu rỗng kèm CTA (Empty), Lỗi kèm nút thử lại (Error).

### 2.5. Xử lý Tiền tệ và Toàn vẹn Dữ liệu
- Toàn bộ giá trị tiền tệ VND lưu trữ trong CSDL bằng `DECIMAL(15,2)` và tính toán trong Python bằng thư viện chuẩn `Decimal` (`ROUND_HALF_UP`). Tuyệt đối không dùng số thực `Float`.
- Nguyên tắc bất biến nghiệp vụ:
  - Khóa Kim Tĩnh vĩnh viễn mức CSDL và service ngay sau khi nghiệm thu an táng, ngăn chặn mọi can thiệp sửa đổi cấu trúc, cải táng, chuyển nhượng.
  - Chống đặt trùng ô đất (Anti-double booking) bằng reservation độc quyền khi lập hợp đồng nháp.
  - Giấy báo tử phải được xác minh trước khi cho phép kích hoạt phụ lục an táng.
  - Ghi nhận thanh toán có cơ chế Idempotency-Key chống thu trùng nợ khi mạng chập chờn.

---

## 3. Hệ quả và Giám sát (Consequences)
- **Tích cực:** Tận dụng tối đa CSDL đã dựng sẵn, bảo vệ dữ liệu hiện có; giảm thiểu tối đa rủi ro tràn ổ C; tốc độ build và dev cực nhanh với `uv` và `pnpm`; đảm bảo giao diện web và mobile đồng nhất nghiệp vụ.
- **Rủi ro & Biện pháp khắc phục:**
  - Bảng có trigger cần test cẩn thận với SQLAlchemy.
  - Cần duy trì Docker Desktop chạy nền để phục vụ MinIO cục bộ.
