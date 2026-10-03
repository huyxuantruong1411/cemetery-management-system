# Danh mục tài liệu nguồn (Source Inventory)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày lập:** 03/10/2026  
**Thư mục lưu trữ nguồn:** `docs/source/`

---

## 1. Bảng đối chiếu tệp nguồn

| Mã | Tên tệp | Kích thước | SHA-256 | Nội dung tóm lược | Vai trò trong hệ thống |
|---|---|---|---|---|---|
| **D1** | `lab1.docx` | 1,085,731 bytes | `6FD0AE69A39DC3A3B4B4D8D321D8F2F0E85DB6989FCAA5E6017DAC8C6FFF1040` | Mô tả bài toán nghiệp vụ, danh sách tác nhân (Admin, Marketing, Kế toán, Quản trang, Thân nhân/Khách hàng), các nhóm chức năng dự kiến và 1 sơ đồ use case tổng quan. | Bối cảnh ban đầu, mục tiêu và định hướng dự án |
| **D2** | `Lab2-TruongXuanHuy-2324802010044.docx` | 1,218,004 bytes | `F7D57D6A9878D1FF516322452CD1768C737B36D8F8F460BD26A02E711A9A13A7` | Đặc tả chi tiết 8 phân hệ, 39 use case (UC-1.1 đến UC-8.7), 8 sơ đồ use case phân hệ, 11 sơ đồ hoạt động (Activity Diagrams), quy tắc nghiệp vụ, luồng ngoại lệ, phân quyền, yêu cầu phi chức năng (NFR). | **Nguồn sự thật về nghiệp vụ (Single Source of Business Truth)** |
| **D3** | `Lab3-TruongXuanHuy-2324802010044.docx` | 745,406 bytes | `FF3C36EC1F688885E0A2A3290A74D580DFC6C51F5C8A444E29F7F5FD86645D11` | 10 sơ đồ tuần tự (Sequence Diagrams) cho các ca nghiệp vụ chính, 7 sơ đồ lớp (Class Diagrams) phân hệ. | Hướng dẫn luồng xử lý controller/service/repository, chuyển trạng thái và quan hệ nghiệp vụ |
| **D4** | `lab4-TruongXuanHuy-2324802010044.docx` | 209,060 bytes | `E9BB50A81D61F210CFDA94B426B4FE6754DEF3DDEA6F96507B00E8F32CB1FA1A` | Mô tả từ điển dữ liệu, quan hệ bảng, các ràng buộc toàn vẹn và 7 hình ERD nhúng dạng EMF. | Thiết kế cấu trúc dữ liệu logic |
| **D5** | `lab4-sql.sql` | 33,499 bytes | `3ADEA7DA84F7DAB8ADC097F9C52565109ADC3F53194125C9124073434DA722CD` | Kịch bản DDL vật lý 37 bảng SQL Server, các khóa chính PK, khóa ngoại FK, ràng buộc CHECK, UNIQUE, DEFAULT, 2 trigger nghiệp vụ (`trg_plots_enforce_kim_tinh_immutability`, `trg_payments_sync_receivable_balance`). | **Baseline vật lý** (đã triển khai trên database máy chủ) |

---

## 2. Thứ tự ưu tiên giải quyết xung đột nghiệp vụ

Khi phát sinh khác biệt giữa các tài liệu, hệ thống áp dụng nguyên tắc ưu tiên sau:
1. **Yêu cầu chỉ đạo trực tiếp từ chủ dự án.**
2. **Hiện trạng CSDL vật lý thực tế trên máy chủ (`QL_NghiaTrang` trên `DESKTOP-HKIPI1M`).**
3. **Kịch bản gốc D5 (`lab4-sql.sql`) để đối chiếu schema drift.**
4. **Đặc tả nghiệp vụ chi tiết D2 (`Lab2`) làm chuẩn cho business rules và quy trình.**
5. **Thiết kế D3 (sơ đồ tuần tự/lớp) & D4 (từ điển dữ liệu) hỗ trợ kiến trúc.**
6. **Bối cảnh tổng quan D1 (`Lab1`).**

---

## 3. Cảnh báo an toàn dữ liệu
- Tệp `docs/source/lab4-sql.sql` có chứa các câu lệnh nguy hiểm:
  `ALTER DATABASE QL_NghiaTrang SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE QL_NghiaTrang;`
- **TUYỆT ĐỐI KHÔNG CHẠY LẠI** tệp này lên database đang hoạt động. Mọi thay đổi cấu trúc đều phải thông qua migration tăng dần có kiểm soát (Alembic).
