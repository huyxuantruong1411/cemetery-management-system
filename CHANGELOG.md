# Nhật Ký Thay Đổi Dự Án (Changelog)

Tất cả những thay đổi quan trọng trong hệ thống Quản lý Nghĩa trang Tư nhân được ghi nhận tại đây theo định dạng [Keep a Changelog](https://keepachangelog.com/).

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
