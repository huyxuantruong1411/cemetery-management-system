# TÀI LIỆU KỊCH BẢN TEST NGHIỆP VỤ TOÀN DIỆN (BUSINESS TEST SCENARIOS)
## HỆ THỐNG QUẢN LÝ NGHĨA TRANG TƯ NHÂN

> **Căn cứ tài liệu phân tích thiết kế:**  
> - `reference/lab1.docx`: Đặc tả yêu cầu người dùng, khảo sát thực tế và phân vai Actor.  
> - `reference/Lab2-TruongXuanHuy-2324802010044.docx`: Đặc tả 39 Use Cases (UC-1.1 đến UC-8.7) và sơ đồ hoạt động (Activity Diagrams).  
> - `reference/Lab3-TruongXuanHuy-2324802010044.docx`: 10 Sơ đồ tuần tự (Sequence Diagrams) và Sơ đồ lớp (Class Diagrams).  
> - `reference/lab4-TruongXuanHuy-2324802010044.docx` & `lab4-sql.sql`: Mô hình quan hệ CSDL và ràng buộc toàn vẹn Kim Tĩnh.  
>  
> **Mục tiêu:** Chuyển đổi toàn bộ quy trình phân tích từ tài liệu thành các kịch bản kiểm thử thuần túy nghiệp vụ (Pure Business Scenarios) theo vòng đời thực tế của khách hàng, thân nhân và nhân viên, nhằm phát hiện các sai sót logic, rò rỉ quyền hạn và vi phạm bất biến nghiệp vụ.

---

## MA TRẬN MỐI QUAN HỆ ACTOR & PHÂN HỆ NGHIỆP VỤ

| Actor | Quyền hạn & Trách nhiệm chính | Điểm tương tác trên hệ thống |
| :--- | :--- | :--- |
| **Thân Nhân / Khách Ngoài (Guest)** | Tra cứu thông tin tưởng niệm người quá cố, chỉ đường GPS tới ô mộ, xem nhật ký viếng/chăm sóc đã duyệt. Tuyệt đối không xem PII (CCCD, SĐT, hợp đồng, giấy báo tử). | Cổng Tra Cứu Tưởng Niệm (Mobile & Web) |
| **Nhân Viên Kinh Doanh (Sales)** | Tiếp đón khách hàng, tra cứu ô mộ trống, đặt cọc giữ chỗ chống tranh chấp 30 phút, lập 4 loại hợp đồng (Mua đất, Cải táng, Hỏa táng, Chuyển nhượng), tải lên bản scan hợp đồng đã ký. | Phân hệ Ô Mộ, Khách Hàng, Hợp Đồng |
| **Kế Toán Viên (Accountant)** | Tiếp nhận khoản phải thu phát sinh từ hợp đồng/phụ lục, ghi nhận thanh toán (tiền mặt/chuyển khoản/VietQR), áp dụng chiết khấu, xuất hóa đơn/biên lai điện tử có sinh PDF ký số lưu MinIO và đọc số tiền bằng chữ tiếng Việt. | Phân hệ Tài Chính & Hóa Đơn |
| **Quản Trang Hiện Trường (Field Officer)** | Quản lý mặt bằng phân khu, tiếp nhận phụ lục an táng, kiểm tra giấy báo tử bắt buộc, lập checklist thi công, giám sát thợ, nghiệm thu công trình bằng ảnh MinIO, thực hiện hạ huyệt và kích hoạt khóa vĩnh viễn Kim Tĩnh. | Phân hệ Bản Đồ, Hồ Sơ Quá Cố, Thi Công |
| **Nhân Viên Chăm Sóc (Care Staff)** | Nhận lịch phân công chăm sóc định kỳ (tháng/quý/năm), thực hiện checklist thực địa (dọn cỏ, lau bia, thắp nhang), chụp ảnh hiện trường gửi thân nhân qua MinIO. | Phân hệ Chăm Sóc Mộ |
| **Ban Giám Đốc / Quản Trị (Admin/Director)** | Quản lý bảng giá, gói dịch vụ, cấu hình biểu mẫu hợp đồng, phân quyền tài khoản RBAC, giám sát nhật ký kiểm toán (Audit Logs) và xem báo cáo tài chính/tỷ lệ lấp đầy. | Phân hệ Danh Mục, Quản Trị, Audit Log, Báo Cáo |

---

## DANH SÁCH 7 KỊCH BẢN KIỂM THỬ NGHIỆP VỤ TOÀN CHU TRÌNH (END-TO-END BUSINESS CYCLES)

---

### KỊCH BẢN 1: CHU TRÌNH BÁN ĐẤT MỘ ĐỘC LẬP & KÍCH HOẠT QUYỀN SỞ HỮU
*(Ánh xạ Use Case: UC-1.3, UC-1.4, UC-2.1, UC-3.1 Case A, UC-3.3, UC-6.1, UC-6.2, UC-6.3 - Sơ đồ tuần tự 1, 2, 3, 10)*

- **Bối cảnh thực tế:** Một khách hàng mới tinh đến văn phòng nghĩa trang, gặp Nhân viên Kinh Doanh để tìm hiểu và chọn mua trước một phần đất mộ cho gia đình (chưa có người mất).
- **Chu trình thao tác nghiệp vụ:**
  1. **Bước 1 (Tiếp khách & Khảo sát ô mộ):**
     - Nhân viên Kinh Doanh mở Sơ đồ Quy hoạch, lọc các ô mộ có trạng thái `EMPTY` tại Khu Gia Đình / Khu Tiêu Chuẩn.
     - Khách hàng chọn ô đất (ví dụ mã `A1-02`).
  2. **Bước 2 (Giữ chỗ độc quyền 30 phút - Anti-Double Booking):**
     - Nhân viên nhấn "Đặt cọc / Giữ chỗ" cho khách. Hệ thống chuyển trạng thái ô sang `RESERVED` với hạn định 30 phút.
     - *Kiểm tra nghiệp vụ:* Nếu nhân viên kinh doanh khác cùng lúc cố tình đặt chỗ ô này, hệ thống phải từ chối ngay lập tức và báo ô đã được giữ chỗ.
  3. **Bước 3 (Đăng ký hồ sơ khách hàng mới):**
     - Nhân viên tạo hồ sơ thân nhân với CCCD, họ tên, số điện thoại, địa chỉ thường trú hợp lệ.
  4. **Bước 4 (Khởi tạo Hợp đồng Mua Đất - HD-MD):**
     - Nhân viên chọn loại hợp đồng `LAND_PURCHASE`.
     - Hệ thống tự động áp bảng giá niêm yết (Đơn giá đất x Diện tích ô mộ), tính tổng giá trị hợp đồng.
     - Hợp đồng lưu ở trạng thái `DRAFT` (Chờ ký).
  5. **Bước 5 (Ký kết ngoài thực tế & Tải scan hợp đồng lên MinIO):**
     - Khách hàng ký văn bản giấy.
     - Nhân viên quét (scan) tệp PDF hợp đồng đã ký và tải lên hệ thống.
     - Tệp scan được lưu trữ an toàn trên MinIO S3 (`nghiatrang-private/contracts/...`).
     - Hợp đồng chuyển sang trạng thái `ACTIVE` (Có hiệu lực). Ô đất chuyển sang trạng thái `ASSIGNED` (Đã có chủ sở hữu).
  6. **Bước 6 (Kế toán phát hành Khoản Phải Thu & Thu tiền nhiều đợt):**
     - Hệ thống sinh bản ghi Phải thu (`receivables`) liên kết với hợp đồng.
     - **Đợt 1 (Đặt cọc 30%):** Kế toán viên ghi nhận thanh toán tiền mặt/chuyển khoản 30%. Khoản phải thu chuyển sang trạng thái `PARTIAL` (Thanh toán một phần), số dư nợ giảm chính xác theo quy tắc `ROUND_HALF_UP`.
     - **Đợt 2 (Thanh toán 70% còn lại):** Khách hàng chuyển khoản VietQR số tiền còn lại.
     - Kế toán ghi nhận giao dịch kèm mã tham chiếu ngân hàng. Khoản thu chuyển sang `PAID` (Đã hoàn tất), dư nợ bằng `0.00`.
  7. **Bước 7 (Kế toán xuất Hóa đơn / Phiếu thu điện tử):**
     - Hệ thống tự sinh số hóa đơn chuẩn `REC-YYYYMM-XXXX`.
     - Đọc chính xác tổng tiền bằng chữ tiếng Việt (ví dụ: *"Ba mươi lăm triệu đồng chẵn"*).
     - Xuất file PDF phiếu thu lưu MinIO và trả đường dẫn xem/tải về cho khách hàng.
  8. **Bước 8 (Xác lập quyền sở hữu):**
     - Ô đất ghi nhận chính thức `current_owner_id = customer_id`.
     - Ghi nhận lịch sử kiểm toán `audit_logs` cho toàn bộ chu trình.

---

### KỊCH BẢN 2: CHU TRÌNH AN TÁNG TRÊN ĐẤT ĐÃ MUA & KHÓA VĨNH VIỄN KIM TĨNH
*(Ánh xạ Use Case: UC-2.2, UC-2.3, UC-3.4, UC-4.1, UC-4.3, UC-4.4 - Sơ đồ tuần tự 4, 8; Ràng buộc Kim Tĩnh DB Trigger 51000)*

- **Bối cảnh thực tế:** Gia đình khách hàng có người thân qua đời, mang Giấy báo tử đến văn phòng yêu cầu tổ chức an táng tại ô mộ đã mua trước đó theo hình thức đúc khối Kim Tĩnh bê tông cốt thép.
- **Chu trình thao tác nghiệp vụ:**
  1. **Bước 1 (Xuất trình & Thẩm định Giấy Báo Tử - Bắt buộc):**
     - Thân nhân xuất trình Giấy báo tử hoặc Trích lục khai tử từ cơ quan y tế / UBND.
     - Quản trang / Nhân viên nhập hồ sơ Người quá cố (`deceased_profiles`): Họ tên, ngày sinh, ngày mất, quê quán, số Giấy báo tử, ngày cấp, nơi cấp.
     - Tải tệp ảnh chụp Giấy báo tử lên MinIO lưu trữ hồ sơ pháp lý.
     - *Kiểm tra nghiệp vụ:* Nếu chưa nhập Giấy báo tử mà cố tình lập lịch an táng, hệ thống bắt buộc chặn với lỗi `DEATH_CERTIFICATE_REQUIRED`.
  2. **Bước 2 (Lập Phụ Lục An Táng - Burial Annex):**
     - Nhân viên lập phụ lục an táng đính kèm vào Hợp đồng Mua đất của gia đình.
     - Chọn hình thức mai táng: `KIM_TINH` (Đúc khối bê tông cốt thép vĩnh cửu).
     - Ngày giờ hạ huyệt được ấn định. Phụ lục lưu trữ và sinh lệnh thi công.
  3. **Bước 3 (Quản trang lập Checklist thi công & Phân công giám sát):**
     - Quản trang mở Phân hệ Thi Công, lập danh sách hạng mục:
       - Hạng mục 1: Đào huyệt đúng kích thước quy hoạch.
       - Hạng mục 2: Đúc đáy và thành Kim Tĩnh bê tông cốt thép mác cao.
       - Hạng mục 3: Vệ sinh lòng huyệt và chuẩn bị tấm đan đậy nắp.
     - Phân công giám sát viên hiện trường và đội thợ thi công.
  4. **Bước 4 (Cập nhật tiến độ & Nghiệm thu hình ảnh MinIO):**
     - Thợ hoàn thành từng hạng mục, quản trang kiểm tra thực địa, đánh dấu `COMPLETED` và tải ảnh chụp nghiệm thu lên MinIO.
     - Tiến độ thi công đạt 100%. Lệnh thi công chuyển trạng thái `ACCEPTED`.
  5. **Bước 5 (Nghi thức Hạ huyệt & KHÓA VĨNH VIỄN KIM TĨNH):**
     - Quản trang xác nhận hoàn tất an táng.
     - Ô mộ chuyển trạng thái sang `OCCUPIED` (Đang sử dụng), cập nhật cờ `is_permanent_vault = TRUE` và `burial_type = 'KIM_TINH'`.
     - *Kiểm tra bất biến vĩnh cửu (Invariants):*
       - CSDL kích hoạt Trigger `trg_prevent_kim_tinh_modification`.
       - Mọi hành vi cố tình hạ cờ `is_permanent_vault`, đổi `burial_type`, sửa đổi kích thước ô đất, giải phóng ô đất hoặc yêu cầu cải táng đều bị SQL Server ROLLBACK và văng lỗi `51000: 'Ô mộ Kim Tĩnh là kết cấu vĩnh cửu, nghiêm cấm mọi hành vi sửa đổi, cải táng hoặc tái sử dụng'`.

---

### KỊCH BẢN 3: CHU TRÌNH ĐĂNG KÝ GÓI CHĂM SÓC ĐỊNH KỲ & NGHIỆM THU THỰC ĐỊA
*(Ánh xạ Use Case: UC-5.1, UC-5.2, UC-5.3, UC-5.4, UC-6.1, UC-6.2 - Sơ đồ tuần tự 9)*

- **Bối cảnh thực tế:** Thân nhân sau khi an táng muốn đăng ký dịch vụ chăm sóc phần mộ định kỳ (Gói Chăm Sóc Hàng Tháng / Theo Quý) để ban quản lý nghĩa trang quét dọn, tỉa cây và thắp hương ngày rằm, mùng một.
- **Chu trình thao tác nghiệp vụ:**
  1. **Bước 1 (Đăng ký Gói Chăm Sóc):**
     - Thân nhân chọn gói: `GOI-CS-THANG` (Gói Chăm Sóc Mộ Định Kỳ Hàng Tháng - Cơ Bản, đơn giá 350,000 VNĐ/kỳ) hoặc `GOI-CS-NAM` (Gói VIP).
     - Nhân viên lập phụ lục dịch vụ chăm sóc với thời hạn 12 tháng.
  2. **Bước 2 (Kế toán thu phí dịch vụ):**
     - Hệ thống sinh khoản thu dịch vụ định kỳ.
     - Kế toán ghi nhận thanh toán và xuất hóa đơn dịch vụ chăm sóc.
  3. **Bước 3 (Tự động sinh Lịch Chăm Sóc Định Kỳ - Care Schedule):**
     - Hệ thống tự động tạo các kỳ chăm sóc hàng tháng cho ô mộ (ví dụ kỳ `2026-M11`, `2026-M12`).
     - Tự động nạp danh sách công việc chuẩn từ cấu hình gói:
       - `[1] Dọn cỏ dại và thu gom rác quanh khuôn viên mộ`
       - `[2] Lau sạch bia đá hoa cương và bề mặt mộ`
       - `[3] Thắp hương vào ngày rằm (15) và mùng một (01) âm lịch`
       - `[4] Chụp ảnh hiện trạng gửi gia đình qua ứng dụng`
  4. **Bước 4 (Phân công Quản trang & Kiểm tra xung đột lịch trực):**
     - Trưởng ban quản trang phân công nhân viên thực địa phụ trách.
     - Hệ thống kiểm tra xem nhân viên có trùng lịch nghỉ/bận không.
  5. **Bước 5 (Nhân viên thực hiện checklist & Nghiệm thu ảnh MinIO):**
     - Nhân viên dùng ứng dụng di động đến thực địa ô mộ.
     - Thực hiện từng công việc, chụp ảnh kết quả tải trực tiếp lên MinIO.
     - Đánh dấu hoàn thành toàn bộ checklist.
  6. **Bước 6 (Nghiệm thu đóng ca & Thân nhân xem kết quả):**
     - Quản trang trưởng phê duyệt hoàn thành kỳ chăm sóc (`STATUS = COMPLETED`).
     - Báo cáo hình ảnh được mở cho thân nhân tra cứu trên ứng dụng di động.

---

### KỊCH BẢN 4: CHU TRÌNH CẢI TÁNG / BỐC MỘ & KIỂM TRA QUY TẮC PHÁP LÝ
*(Ánh xạ Use Case: UC-3.1 Case B, UC-1.3, UC-2.3 - Sơ đồ tuần tự 5, 6; Chặn Mộ Kim Tĩnh & Xác thực Chính Chủ)*

- **Bối cảnh thực tế:** Gia đình có nguyện vọng cải táng (bốc mộ) đưa hài cốt về quê hương hoặc di dời sang địa điểm khác.
- **Chu trình thao tác nghiệp vụ:**
  - **Trường hợp 4A (Kiểm tra Chặn Mộ Kim Tĩnh - Negative Test Bắt Buộc):**
    - Thân nhân yêu cầu cải táng trên ô mộ an táng theo hình thức Kim Tĩnh (`A1-01`).
    - Nhân viên kinh doanh chọn chức năng "Lập Hợp Đồng Cải Táng" (`EXHUMATION`).
    - *Xử lý hệ thống:* Hệ thống truy vấn CSDL, phát hiện cờ `is_permanent_vault = TRUE` hoặc `burial_type = 'KIM_TINH'`.
    - **Kết quả mong đợi:** Hệ thống TỪ CHỐI NGAY LẬP TỨC với thông báo lỗi: *"Mộ kết cấu Kim Tĩnh vĩnh viễn, không thể lập thủ tục bóc mộ/cải táng."* Không một hợp đồng nào được phép khởi tạo.
  - **Trường hợp 4B (Kiểm tra Chính Chủ Sở Hữu - Security Boundary):**
    - Người đến yêu cầu cải táng không phải là người đứng tên chủ sở hữu trên hợp đồng mua đất ban đầu.
    - *Xử lý hệ thống:* Hệ thống đối chiếu `customer_id` với `current_owner_id` của ô đất.
    - **Kết quả mong đợi:** Hệ thống TỪ CHỐI với thông báo: *"Chỉ chính chủ sở hữu hợp pháp của ô đất mới có quyền yêu cầu cải táng."*
  - **Trường hợp 4C (Cải táng hợp lệ trên Mộ Đất Thông Thường):**
    - Ô mộ an táng theo hình thức Mộ Đất Thường (`EARTH_BURIAL`, không phải Kim Tĩnh), chính chủ yêu cầu.
    - Nhân viên lập Hợp đồng Cải táng (`HD-CT`).
    - Kế toán thu phí bốc mộ & dọn dẹp mặt bằng.
    - Đội quản trang thực hiện bốc mộ theo ngày giờ đã đăng ký, chụp ảnh lưu trữ biên bản bàn giao hài cốt.
    - Hoàn tất cải táng: Hồ sơ người mất chuyển trạng thái `EXHUMED`.
    - Ô đất được dọn dẹp sạch sẽ và chuyển trạng thái về `ASSIGNED` (Đất trống đã có chủ) để gia đình tiếp tục sử dụng về sau.

---

### KỊCH BẢN 5: CHU TRÌNH CHUYỂN NHƯỢNG QUYỀN SỬ DỤNG ĐẤT MỘ
*(Ánh xạ Use Case: UC-3.1 Case D, UC-2.1 - Sơ đồ tuần tự 7)*

- **Bối cảnh thực tế:** Chủ đất (Bên chuyển nhượng) chưa có nhu cầu sử dụng ô đất mộ đã mua, muốn chuyển nhượng lại quyền sử dụng cho một khách hàng khác (Bên nhận chuyển nhượng).
- **Chu trình thao tác nghiệp vụ:**
  - **Trường hợp 5A (Chặn chuyển nhượng đất đang có mộ an táng):**
    - Chủ đất muốn chuyển nhượng ô đất đang an táng người mất (`STATUS = OCCUPIED`).
    - **Kết quả mong đợi:** Hệ thống TỪ CHỐI: *"Ô đất đang có mộ an táng, không đủ điều kiện chuyển nhượng. Yêu cầu hoàn tất cải táng trước nếu muốn chuyển nhượng."*
  - **Trường hợp 5B (Chuyển nhượng đất trống hợp lệ):**
    - Ô đất đang ở trạng thái Trống (`ASSIGNED`, chưa an táng người mất).
    - Nhân viên kiểm tra giấy tờ tùy thân của cả Bên chuyển nhượng và Bên nhận chuyển nhượng.
    - Khởi tạo Hợp đồng Chuyển nhượng (`TRANSFER`).
    - Tải bản scan Văn bản thỏa thuận chuyển nhượng có xác nhận pháp lý lên MinIO.
    - Kế toán thu phí thủ tục chuyển nhượng theo quy định.
    - Hệ thống cập nhật: `current_owner_id` của ô đất được chuyển sang Khách hàng mới.
    - Lưu vết toàn bộ lịch sử chuyển nhượng trong `audit_logs` để chống khiếu nại, tranh chấp tài sản.

---

### KỊCH BẢN 6: CHU TRÌNH HỎA TÁNG ĐỘC LẬP (KHÔNG GÁN Ô ĐẤT)
*(Ánh xạ Use Case: UC-3.1 Case C, UC-6.1, UC-6.2 - Hợp đồng Hỏa táng)*

- **Bối cảnh thực tế:** Khách hàng chỉ có nhu cầu sử dụng dịch vụ hỏa thiêu thi hài và gửi tro cốt vào Tháp Cốt Địa Tạng, không mua đất an táng tại nghĩa trang.
- **Chu trình thao tác nghiệp vụ:**
  1. Thân nhân xuất trình Giấy báo tử của người mất.
  2. Nhân viên lập Hợp đồng Hỏa táng (`CREMATION`).
  3. Lựa chọn các dịch vụ đi kèm: Áo quan hỏa táng, dịch vụ thiêu, hũ đựng tro cốt, vị trí lưu tháp cốt (`Lưu tháp cốt Địa Tạng`).
  4. Hệ thống KHÔNG yêu cầu chọn ô đất nghĩa trang và KHÔNG khóa giữ chỗ bất kỳ ô đất nào.
  5. Kế toán thu tiền dịch vụ hỏa táng và xuất hóa đơn điện tử kèm PDF lưu MinIO.
  6. Ban hỏa táng tiếp nhận thi hài, tiến hành hỏa táng đúng giờ và bàn giao hũ tro cốt có biên bản giao nhận.

---

### KỊCH BẢN 7: CHU TRÌNH TRA CỨU CÔNG KHAI CỦA THÂN NHÂN (ZERO PII BOUNDARY)
*(Ánh xạ Use Case: UC-1.4, UC-1.5, UC-2.4 - Bảo vệ thông tin thân nhân theo luật)*

- **Bối cảnh thực tế:** Thân nhân ở xa, bạn bè hoặc người đi viếng sử dụng điện thoại di động hoặc máy tính bảng để tìm mộ người đã khuất vào dịp lễ Tết, ngày giỗ, thanh minh.
- **Chu trình thao tác nghiệp vụ:**
  1. Người dùng mở ứng dụng nghĩa trang mà KHÔNG CẦN ĐĂNG NHẬP (Chế độ Khách).
  2. Nhập từ khóa tìm kiếm: Họ tên người mất (ví dụ: *"Nguyễn Văn Tiên"*), năm mất, hoặc mã ô mộ.
  3. **Kết quả hiển thị công khai (Chỉ thông tin tôn nghiêm & tưởng niệm):**
     - Họ tên người mất, năm sinh, năm mất, quê quán.
     - Vị trí phân khu và mã ô mộ (ví dụ: `Khu A, Hàng 1, Ô A1-01`).
     - Tọa độ GPS và tính năng chỉ đường tới đúng vị trí mộ.
     - Lịch sử chăm sóc, ảnh hoa viếng đã được ban quản lý phê duyệt.
  4. **RÀNG BUỘC BẢO MẬT BẮT BUỘC (ZERO PII):**
     - Tuyệt đối KHÔNG hiển thị: Số điện thoại thân nhân, số CCCD, địa chỉ nhà riêng, giá tiền mua mộ, nội dung hợp đồng, file giấy báo tử.
     - Không cho phép chỉnh sửa dữ liệu, không cho phép truy cập danh sách khách hàng hoặc bản đồ quy hoạch nội bộ.

---

## TỔNG HỢP DANH SÁCH TEST CASES NGHIỆP VỤ (TEST MATRIX)

| Mã Test | Tên Kịch Bản Nghiệp Vụ | Dữ Liệu Đầu Vào | Kỳ Vọng Nghiệp Vụ | Trạng Thái Hệ Thống |
| :--- | :--- | :--- | :--- | :--- |
| **TC-BIZ-01** | Bán đất: Giữ chỗ ô mộ chống tranh chấp 30 phút | Ô `A1-02` (EMPTY) | Chuyển `RESERVED`, nhân viên khác thao tác cùng lúc bị từ chối | Đã kiểm chứng |
| **TC-BIZ-02** | Bán đất: HĐ Mua đất độc lập & Ký kết MinIO | KH mới, HĐ mua đất | HĐ `ACTIVE`, ô đất chuyển sang `ASSIGNED`, gắn `owner_id` | Đã kiểm chứng |
| **TC-BIZ-03** | Tài chính: Thu tiền 2 đợt (Partial -> Full) & Hóa đơn | Khoản thu 35M, thu 10.5M rồi thu 24.5M | Trạng thái `PARTIAL` rồi `PAID`, dư nợ = 0, đọc số tiền bằng chữ tiếng Việt | Đã kiểm chứng |
| **TC-BIZ-04** | An táng: Bắt buộc Giấy báo tử | Đăng ký an táng thiếu giấy chứng tử | Bị chặn với lỗi nghiệp vụ `DEATH_CERTIFICATE_REQUIRED` | Đã kiểm chứng |
| **TC-BIZ-05** | An táng: Checklist thi công & Nghiệm thu MinIO | Phụ lục an táng, 3 công việc | Tiến độ 100%, ảnh nghiệm thu lưu MinIO | Đã kiểm chứng |
| **TC-BIZ-06** | Bất biến: Khóa Kim Tĩnh vĩnh viễn (Trigger 51000) | Ô Kim Tĩnh `A1-01` | Chặn mọi hành vi sửa kết cấu, xóa, cải táng, văng lỗi 51000 | Đã kiểm chứng |
| **TC-BIZ-07** | Chăm sóc: Đăng ký gói & Sinh lịch định kỳ | Gói Tháng 350k | Sinh lịch định kỳ, nạp đúng 4 task mẫu tiếng Việt chuẩn | Đã kiểm chứng |
| **TC-BIZ-08** | Chăm sóc: Đóng ca & Nghiệm thu ảnh thực địa | Checklist hoàn tất | Quản trang duyệt đóng ca, ảnh xuất hiện trên cổng tra cứu | Đã kiểm chứng |
| **TC-BIZ-09** | Cải táng: Chặn mộ Kim Tĩnh | Yêu cầu cải táng trên ô Kim Tĩnh | Hệ thống từ chối ngay: "Mộ Kim Tĩnh vĩnh viễn, không thể cải táng" | Đã kiểm chứng |
| **TC-BIZ-10** | Cải táng: Chặn người không phải chính chủ | Thân nhân không đứng tên chủ đất | Hệ thống từ chối: "Chỉ chính chủ sở hữu mới có quyền yêu cầu" | Đã kiểm chứng |
| **TC-BIZ-11** | Chuyển nhượng: Chặn ô đất đang có mộ an táng | Ô đất `OCCUPIED` | Hệ thống từ chối: "Ô đất đang có mộ, không đủ điều kiện chuyển nhượng" | Đã kiểm chứng |
| **TC-BIZ-12** | Hỏa táng: HĐ hỏa táng độc lập không giữ đất | Đăng ký hỏa táng + Tháp Địa Tạng | HĐ hợp lệ, không gán ô đất, thu tiền xuất hóa đơn đầy đủ | Đã kiểm chứng |
| **TC-BIZ-13** | Tra cứu: Khách vãng lai Zero PII | Tra cứu "Nguyễn Văn Tiên" | Trả về vị trí mộ + GPS, chặn 100% CCCD/SĐT/Hợp đồng/Giấy báo tử | Đã kiểm chứng |
