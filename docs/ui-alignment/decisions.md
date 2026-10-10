# Quyết Định Thiết Kế Nghiệp Vụ & Kỹ Thuật (Architecture & Domain Decisions D01–D12)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Mục tiêu:** Ghi nhận căn cứ, phương án lựa chọn và tác động kiểm thử của 12 quyết định then chốt D01–D12.

---

### D01: Quy trình ký hợp đồng ngoại tuyến (Offline Paper Signing Workflow)
- **Căn cứ:** Lab1 mô tả duyệt trực tuyến, nhưng Lab2 (UC-3.2, UC-3.3) và Lab3 (Seq 3.2, 3.3) yêu cầu ký giấy ngoài đời thực vì giá trị pháp lý đất nghĩa trang.
- **Phương án chọn:** Lập HĐ nháp → Xuất bản in PDF → Các bên ký tay ngoài đời thực → Marketing tải bản scan lên hệ thống MinIO (`READY`) → Kiểm tra tính hợp lệ → Chuyển trạng thái `ACTIVE`.
- **Nghiệm thu:** Không có nút "Ký số tự động" hay "Phê duyệt online". Bản scan lỗi hoặc thiếu thì không thể `ACTIVE`.

---

### D02: Bốn loại hợp đồng và ba loại phụ lục chuẩn mực
- **Căn cứ:** Lab2, Lab4 và schema CSDL (`contracts`, `contract_annexes`).
- **Phương án chọn:**
  - 4 loại hợp đồng: `LAND_PURCHASE` (Mua đất), `EXHUMATION` (Cải táng), `CREMATION` (Hỏa táng), `TRANSFER` (Chuyển nhượng).
  - 3 loại phụ lục: `BURIAL` (An táng), `CONSTRUCTION` (Thi công xây dựng), `CARE` (Chăm sóc định kỳ).
- **Quy tắc:** Hỏa táng không yêu cầu ô mộ; Mua đất không yêu cầu người mất; An táng luôn là phụ lục của ô đất có chủ.

---

### D03: Chính sách tra cứu công khai Zero PII (Public Memorial Privacy Policy)
- **Căn cứ:** Quyền riêng tư của thân nhân người mất và Luật An toàn thông tin mạng.
- **Phương án chọn:** Khách vãng lai không cần đăng nhập chỉ tìm được thông tin người mất đã công bố (Họ tên, Năm sinh/Năm mất, Quê quán, Mã ô mộ, Dẫn đường GPS đã xác minh).
- **Nghiệm thu:** Tuyệt đối không trả về CCCD, SĐT, địa chỉ thân nhân, giá tiền hoặc hợp đồng trong bất kỳ response public nào.

---

### D04: Mô hình nhân sự đa tầng (Supervisor vs. Work Party Model)
- **Căn cứ:** Lab2 (UC-4.2, UC-5.3) và thực tế vận hành nghĩa trang: Quản trang là người điều phối/giám sát, còn người trực tiếp đào huyệt, xây mộ, quét dọn có thể là nhân viên nội bộ, tổ đội hoặc nhà thầu thuê ngoài.
- **Phương án chọn:** Tách rõ 4 vai trò trách nhiệm trong công việc:
  1. `assigned_by`: Người giao việc (lấy tự động từ phiên Quản trang điều phối).
  2. `supervisor_id`: Quản trang phụ trách giám sát chất lượng.
  3. `work_party`: Đầu mối thực hiện (Cá nhân / Tổ đội / Nhà thầu ngoài - không bắt buộc có tài khoản hệ thống).
  4. `confirmed_by`: Quản trang nghiệm thu/đóng ca (lấy từ phiên xác nhận, có thể khác người làm).

---

### D05: Chu kỳ dịch vụ chăm sóc & Tính toán lịch định kỳ (Recurrence & Periodicity)
- **Căn cứ:** UC-5.2 quy định chu kỳ Ngày / Tuần / Tháng / Quý / Năm.
- **Phương án chọn:** Server tính toán ngày chăm sóc chính xác, neo ngày cuối tháng (ví dụ 31/01 -> 28/02). Kiểm tra trùng lịch và ngày nghỉ trước khi tạo bản ghi ca chăm sóc.

---

### D06: Tách bạch hoàn thành thi công và an táng (Separation of Construction & Burial)
- **Căn cứ:** Sơ đồ Lab3 có bước dẫn sang an táng sau khi xây xong bia, nhưng về mặt pháp lý hai việc này độc lập.
- **Phương án chọn:** Nghiệm thu thi công chỉ chuyển trạng thái công trình sang `COMPLETED`. Ô đất vẫn giữ trạng thái `OWNED_EMPTY` (hoặc đang an táng). Việc chuyển sang `OCCUPIED` chỉ xảy ra khi có xác nhận an táng từ phụ lục `BURIAL` kèm giấy báo tử hợp lệ.

---

### D07: Điều chỉnh tiến độ thi công có kiểm soát (Audited Progress Adjustment)
- **Căn cứ:** UC-4.4 về xử lý vướng mắc thực địa (thời tiết, vật liệu).
- **Phương án chọn:** Cho phép Quản trang điều chỉnh ngày dự kiến hoàn thành nhưng bắt buộc nhập lý do thay đổi. Hệ thống lưu vết audit (`progress_adjustments`), không tự ý sửa thời hạn pháp lý trên hợp đồng gốc của Marketing.

---

### D08: Xử lý hai xung đột cốt lõi (Conflict & Immutability Guarantees)
- **Căn cứ:** Tranh chấp đồng thời khi giữ chỗ mua đất và tính tôn nghiêm của mộ Kim Tĩnh.
- **Phương án chọn:**
  - Tranh chấp giữ chỗ: Dùng khóa dòng cơ sở dữ liệu (`with_for_update` / isolation) và Filtered Unique Index trên reservation `ACTIVE`.
  - Kim Tĩnh bất biến: Khóa vĩnh viễn ở cấp ô mộ bằng Trigger SQL Server (`trg_plots_enforce_kim_tinh_immutability`) và chặn ở Service layer.

---

### D09: Quyền hạn ADMIN và giới hạn Invariant (No Invariant Bypass for Admin)
- **Căn cứ:** Đảm bảo toàn vẹn dữ liệu pháp lý và tôn giáo.
- **Phương án chọn:** Role `ADMIN` có thể xem mọi báo cáo và quản lý tài khoản, nhưng không được bỏ qua các quy tắc nghiệp vụ cốt lõi (không an táng thiếu giấy báo tử, không xóa mộ Kim Tĩnh).

---

### D10: Quy trình công bố kết quả chăm sóc cho thân nhân (Care Result Publication)
- **Căn cứ:** Lab2 và Lab3 quy định thân nhân được xem kết quả chăm sóc, nhưng ảnh hiện trường có thể chứa thông tin nhạy cảm.
- **Phương án chọn:** Phân tách rõ 2 trạng thái: Ca chăm sóc `CLOSED` (kỹ thuật hoàn thành) và Bản cập nhật `PUBLISHED` (đã duyệt công bố, Zero PII).

---

### D11: Chuyển nhượng quyền sở hữu ô mộ (Plot Ownership Transfer Lifecycle)
- **Căn cứ:** Sau khi ký hợp đồng chuyển nhượng `TRANSFER`, chủ mới được công nhận là người sở hữu hợp pháp.
- **Phương án chọn:** Hệ thống tạo bản ghi `plot_ownerships` mới cho chủ mới, đóng quyền của chủ cũ; chủ mới có quyền lập phụ lục an táng/thi công mà không phải mua đất lần hai.

---

### D12: Kiểm soát thu tiền & chính sách chiết khấu (Finance Safeguards & Discounts)
- **Căn cứ:** Bảo toàn dòng tiền, chống thất thoát và sai lệch kế toán.
- **Phương án chọn:**
  - Tiền tệ dùng `DECIMAL(15,2)` trong SQL và Python `Decimal`.
  - Chống thu trùng bằng `idempotency_key`.
  - Chặn thu vượt quá số dư nợ còn lại.
  - Chiết khấu chỉ áp dụng khi có mã phê duyệt và trong hạn mức cho phép.
