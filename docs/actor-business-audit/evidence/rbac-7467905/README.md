# Bằng chứng review 7467905 — 16/10/2026

Kết luận và đầu việc: [PLAN-RBAC-MAP-7467905.md](../../PLAN-RBAC-MAP-7467905.md). Đây là bằng chứng của một đợt kiểm tra tập trung, không phải báo cáo tất cả route/UC đã đạt.

| Tệp | Nội dung / giới hạn |
|---|---|
| `browser.json` | UI ba actor trên desktop và các GET qua backend mới, dữ liệu nghiệp vụ chính chỉ đọc. `markers: 0` là phép đếm DOM sớm, không dùng kết luận map không render. GET `/audit` trong log là đường thử sai (404); kiểm tra đúng `/audit/logs` ở `no-role.json`. |
| `observed-http.csv` | 48 GET đúng đường dẫn từ browser + 74 bước probe Test = 122 lượt; loại đường `/audit` sai. Không phải 122 endpoint khác nhau. |
| `probes.json` | Probe JWT thật, dữ liệu Test synthetic, MinIO thật; service commit vào savepoint và rollback transaction ngoài. Không chứng minh commit bền vững/concurrency. Payload chỉ lưu cấu trúc hoặc cờ kiểm tra, giá trị tiền 123.45 là fixture. |
| `no-role.json` | 13 lượt: user synthetic role rỗng và kiểm audit đúng route cho ba actor. |
| `routes.csv` | 130 khai báo route được phân tích từ mã, gồm dependency/signature; không phải toàn bộ đã gọi qua HTTP. |
| `lab2-actors.json` | Bảng actor của 39 UC con trích từ DOCX Lab2, dùng đối chiếu mã UC. |
| `map-data.json` | Truy vấn tọa độ/đếm DB; có thông tin cơ cấu và tọa độ seed hiện hữu. Không xác nhận bất kỳ tọa độ nào là GPS khảo sát. |
| `map-concept-check.json` | Mẫu HTML: 384 phần tử ô, tìm kiếm/empty, viewport 1440/768/390 và lỗi JS trong ca thử. Không thay UAT của ứng dụng. |
| `cleanup.json` | Đối soát synthetic rows, số hàng nghiệp vụ chính, quyền, revision và object MinIO. Không phải so sánh toàn bộ dữ liệu từng byte. |
| `cleanup-recovery.json` | Ghi việc helper cleanup lần đầu gọi sai SDK; hai object được kiểm không có binding rồi dọn, helper sửa và chạy lại. Tổng bốn object phát sinh đều đã xóa. |
| `screens/` | Ảnh giao diện thực ba actor và hai ảnh mẫu map. UI mở được modal không tự chứng minh server cho ghi; đối chiếu probes. |

Backend kiểm tra dùng HEAD 7467905 trên cổng 8002; Vite riêng tự chọn 5174 vì 5173 đang có dịch vụ của người dùng. MinIO của dự án chạy trên 9000. Không chạy bootstrap, không reset DB, không seed lại role trên DB chính. Các dữ liệu đọc chính được kiểm đếm trước/sau; đăng nhập có thể ghi auth session/audit và identity/sequence Test có thể tăng dù rollback.
