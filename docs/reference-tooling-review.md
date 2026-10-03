# Đánh Giá Bộ Công Cụ và Kiến Trúc từ Repo Tham Khảo (Reference Tooling Review)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Repo tham khảo:** `https://github.com/huyxuantruong1411/Manga-Reviews-Management`  
**Commit đã đối chiếu:** `969c2c69b987c628bc782e7d3501c8051ef798d1` (clone cục bộ tại `D:\work\references\Manga-Reviews-Management`)  
**Ngày lập:** 03/10/2026

---

## 1. Tổng quan khảo sát repo tham khảo

Repo `Manga-Reviews-Management` thể hiện tiêu chuẩn quản trị mã nguồn và agent kỷ luật cao, bao gồm:
1. `AGENTS.md` & `GEMINI.md`: Quy định rõ nguyên tắc thực thi, nguồn sự thật (Code & Tests > Docs), cấm refactor ngầm tùy tiện ("No Phantom Refactoring").
2. `.agents/rules/`: Phân định ranh giới kiến trúc, quản trị công cụ và knowledge graph.
3. `.agents/skills/`: Các skill chuyên biệt như `architecture-guard`, `tdd-workflow`, `ui-ux-design`, `db-migration-safety`, `web-performance-and-a11y`.
4. Quy chuẩn giao diện: Design tokens rõ ràng, sử dụng Tailwind CSS + shadcn/ui, bắt buộc xử lý đầy đủ 4 trạng thái (`Loading`, `Normal`, `Empty`, `Error` kèm retry), mobile-first.

---

## 2. Bảng phân tích: Giữ / Đổi / Bỏ / Thêm mới

| Hạng mục | Trong Repo Tham Khảo | Áp dụng cho Hệ thống Nghĩa Trang | Lý do kỹ thuật |
|---|---|---|---|
| **Cấu trúc Backend** | Router → Service → Repository | **GIỮ NGUYÊN**: Router chỉ nhận request, validate DTO; Service nắm trọn invariants & transaction; Repository truy vấn có tham số | Đảm bảo tính toàn vẹn nghiệp vụ phức tạp của nghĩa trang (Kim Tĩnh, chuyển nhượng, an táng). |
| **Cơ sở dữ liệu** | MongoDB (NoSQL) | **ĐỔI**: Microsoft SQL Server 2022 (MSSQL) với 37 bảng quan hệ, PK, FK, CHECK, UNIQUE và trigger | Nghiệp vụ nghĩa trang đòi hỏi tính toàn vẹn ACID cao, transaction liên bảng (đất - hợp đồng - khoản thu). |
| **Lưu ý ORM** | Beanie / Motor (Async Mongo) | **ĐỔI**: SQLAlchemy 2.x + pyodbc qua `ODBC Driver 18 for SQL Server`. Lưu ý tắt `implicit_returning` với bảng có trigger (`plots`, `payments`) | MSSQL không tương thích lệnh `OUTPUT INSERTED` mặc định của SQLAlchemy khi bảng có trigger. |
| **Quản lý Package Python** | pip / requirements hoặc uv | **GIỮ & CHUẨN HÓA**: Dùng **`uv`** với `pyproject.toml` và `uv.lock`, môi trường CPython 3.12 | Theo yêu cầu của chủ dự án và kế hoạch thực thi; tốc độ cực nhanh, quản lý venv chuẩn xác. |
| **Frontend Web** | React + TypeScript + Vite | **GIỮ NGUYÊN**: Dùng **`pnpm`**, React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query | Tương thích cao, giao diện chuẩn mực, quản lý package nhanh với pnpm. |
| **Ứng dụng Di động** | Chưa có | **THÊM MỚI**: Flutter Android (Dart) dùng chung API FastAPI và schema | Phục vụ Quản trang cập nhật thi công, nghiệm thu hiện trường, chụp ảnh bằng chứng và tra cứu công khai. |
| **Lưu trữ Tệp** | Cloudinary / local URL | **ĐỔI**: MinIO S3 cục bộ với bind mount vào `backend/runtime/minio/data` trên ổ D | Bảo vệ dung lượng ổ C; quản lý tài liệu scan hợp đồng, giấy báo tử và ảnh thi công riêng tư, bảo mật. |
| **Xử lý Tiền tệ** | Float / Number | **ĐỔI BẮT BUỘC**: `DECIMAL(15,2)` trong SQL và Python `Decimal` (`ROUND_HALF_UP`) | Tuyệt đối không dùng Float cho tiền VND tránh sai số làm tròn tài chính. |
| **UI/UX Design** | 4 states (`Loading`, `Normal`, `Empty`, `Error`) | **GIỮ & NÂNG CAO**: Giữ trọn vẹn 4 states, thêm tone màu trang nghiêm nhã nhặn (`#24594D`, `#F7F8F5`), hỗ trợ font tiếng Việt hoàn chỉnh | Phù hợp tính chất trang nghiêm của lĩnh vực nghĩa trang công viên. |

---

## 3. Kết luận và chỉ dẫn hành động
Bộ quy tắc của dự án Nghĩa Trang kế thừa tinh hoa quản trị của repo tham khảo (TDD, kiến trúc 3 tầng, chuẩn UI 4 trạng thái, pnpm/uv), đồng thời điều chỉnh triệt để sang hạ tầng SQL Server MSSQL, MinIO trên ổ D và bổ sung client Flutter.
