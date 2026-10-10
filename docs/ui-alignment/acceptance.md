# Tiêu Chí Chấp Nhận & Kịch Bản Kiểm Thử (Acceptance Test Scenarios AT01–AT30)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Mục tiêu:** 30 kịch bản kiểm thử chấp nhận toàn diện (Acceptance Tests AT01–AT30) bảo đảm mọi Actor được kiểm chứng tính đúng đắn.

---

## Danh mục 30 Kịch Bản Chấp Nhận Bắt Buộc

| Mã kịch bản | Tên kịch bản & Đối tượng | Tiêu chí đạt (Acceptance Criteria) | Kết quả kiểm chứng |
|---|---|---|:---:|
| **AT01** | Khách truy cập lần đầu | Vào trang chủ P01; không thấy health SQL/MinIO, không thấy RBAC permissions; không có API nội bộ bị gọi. | PASSED |
| **AT02** | Khách tìm kiếm người mất | Tìm theo họ tên, quê quán, mã ô mộ; phân biệt người trùng tên; không lộ CCCD, SĐT thân nhân hay giá tiền. | PASSED |
| **AT03** | Khách xem bản đồ & dẫn đường | Mở bản đồ P03; dẫn đường chỉ khi có GPS xác minh; không bịa tọa độ khi chưa có. | PASSED |
| **AT04** | Đăng nhập đúng trang mặc định | 4 role (Admin, Marketing, Caretaker, Accountant) vào đúng Workspace; menu chỉ hiển thị mục được phép. | PASSED |
| **AT05** | Quản trang truy cập hợp đồng/tiền | Quản trang gọi API contract detail, PDF, hoặc doanh thu bị trả về `403 Forbidden`; work-basis đọc bình thường. | PASSED |
| **AT06** | Kế toán truy cập bảng giá/báo cáo mộ | Kế toán bị từ chối sửa giá hoặc xem báo cáo lấp đầy đất; xem và xuất báo cáo tài chính thành công. | PASSED |
| **AT07** | Marketing thao tác thi công/chăm sóc | Marketing không có nút/quyền nghiệm thu thi công hoặc đóng ca chăm sóc; chỉ xem tiến độ hồ sơ. | PASSED |
| **AT08** | Đổi vai trò & thu hồi phiên | Khi tài khoản bị đổi quyền hoặc đăng xuất, token cũ bị thu hồi tức thì (`401 Unauthorized`), không dùng lại được. | PASSED |
| **AT09** | Hồ sơ thân nhân & người mất | Kiểm tra trùng CCCD; năm sinh không bị bịa thành ngày 01/01; giấy báo tử lưu MinIO hợp lệ. | PASSED |
| **AT10** | Lập 4 loại hợp đồng | Wizard chỉ hỏi đúng trường của từng loại HĐ; hỏa táng không bắt chọn ô; mua đất không bắt có người mất. | PASSED |
| **AT11** | Quy trình in, ký và kích hoạt HĐ | In bản giấy → ký ngoài đời → upload bản scan MinIO → kích hoạt; không kích hoạt được nếu thiếu scan. | PASSED |
| **AT12** | Lập 3 loại phụ lục | Phụ lục an táng, thi công, chăm sóc gắn đúng HĐ gốc; kiểm tra điều kiện chủ quyền hợp lệ. | PASSED |
| **AT13** | Quản trang lập checklist thi công | Tiếp nhận từ căn cứ; thêm/sửa/xóa/sắp xếp thứ tự các hạng mục kỹ thuật bắt buộc. | PASSED |
| **AT14** | Phân công đa tầng thi công | Quản trang phân công cho người nội bộ, tổ đội hoặc nhà thầu ngoài (không cần account); lưu rõ 4 vai trò. | PASSED |
| **AT15** | Kiểm tra xung đột lịch thực địa | Chặn phân công ca chăm sóc khi trùng lịch; cảnh báo và lưu lý do khi trùng lịch thi công. | PASSED |
| **AT16** | Nghiệm thu thi công & tiến độ | Đủ 100% việc bắt buộc và ảnh hiện trường mới được hoàn thành; điều chỉnh tiến độ có lý do; không tự an táng. | PASSED |
| **AT17** | Sinh lịch chăm sóc định kỳ | Sinh lịch theo chu kỳ (Ngày/Tuần/Tháng/Quý/Năm); neo cuối tháng; chống sinh lịch trùng lặp. | PASSED |
| **AT18** | Giao ca chăm sóc mộ | Giao ca chăm sóc chuyển trạng thái `ASSIGNED`; lưu vết phân công chính xác. | PASSED |
| **AT19** | Đóng ca chăm sóc & công bố | Quản trang xác nhận hoàn thành ca; duyệt bản công khai Zero PII cho cổng thân nhân xem. | PASSED |
| **AT20** | Thu hồi kết quả chăm sóc | Thu hồi bản công bố làm cổng thân nhân lập tức không xem được ảnh đó nữa; lưu audit log. | PASSED |
| **AT21** | Xử lý xung đột đồng thời | Hai quản trang cùng cập nhật một ca/lệnh nhận cảnh báo xung đột (Concurrency Conflict), không ghi đè dữ liệu. | PASSED |
| **AT22** | Nghiệm thu an táng & Kim Tĩnh | Kiểm tra giấy báo tử; an táng thành công kích hoạt khóa Kim Tĩnh bất biến; chặn mọi can thiệp sửa đổi sau đó. | PASSED |
| **AT23** | Quản trị tài khoản & bảng giá | Sếp tạo/khóa tài khoản; cập nhật bảng giá phiên bản mới mà không làm thay đổi giá đã ký trong lịch sử. | PASSED |
| **AT24** | Thu tiền & quản lý công nợ | Ghi nhận thu tiền dùng Decimal chính xác; `idempotency_key` chống trùng; sinh số biên lai duy nhất. | PASSED |
| **AT25** | Chiết khấu & chặn thu vượt | Chặn thu tiền vượt quá số nợ; áp dụng chiết khấu đúng hạn mức và mã phê duyệt. | PASSED |
| **AT26** | Xuất báo cáo thống kê | 4 nhóm báo cáo hiển thị đúng số liệu thực; xuất file PDF/XLSX nền an toàn chống formula injection. | PASSED |
| **AT27** | Phân trang danh sách lớn | Phân trang server-side tải mượt mà trên 100/500 bản ghi; bộ lọc và tìm kiếm chính xác. | PASSED |
| **AT28** | Tích hợp Flutter hiện trường | Flutter gọi API thật lấy chi tiết công việc; thực hiện phân công, tick việc, chụp ảnh và đóng ca đồng bộ với web. | PASSED |
| **AT29** | Xử lý mạng yếu & ảnh ngoại tuyến | Flutter lưu nháp tác vụ khi mất kết nối; retry upload ảnh an toàn khi có mạng trở lại. | PASSED |
| **AT30** | Trải nghiệm người dùng (UX) & WCAG | Đủ 4 trạng thái Loading/Normal/Empty/Error; độ tương phản đạt chuẩn; phông chữ tôn nghiêm, thanh thoát. | PASSED |
