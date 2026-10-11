# KẾ HOẠCH TÁI CẤU TRÚC RESPONSIVE & NÂNG CẤP UX/UI CHO WEB-APP (PHÙ HỢP THIẾT BỊ DI ĐỘNG)
> **Dự án:** Hệ Thống Quản Lý Nghĩa Trang Tư Nhân (`cemetery-management-system`)  
> **Phạm vi tác động:** Thư mục `web/` (React 19 + TypeScript + Vite + Leaflet GIS + Vanilla CSS)  
> **Tài liệu tham chiếu:** `reference/plan01.docx`, `reference/Lab1 - 4`  
> **Mục tiêu:** Khắc phục triệt để lỗi co ép layout trên di động, xây dựng Responsive Shell chuẩn mực (Off-canvas Drawer, Mobile Header, Hamburger Menu), tối ưu hóa trải nghiệm thực địa cho Quản trang và bảo toàn 100% Domain Invariants.

---

## 1. BỐI CẢNH NGHIỆP VỤ & NGUỒN SỰ THẬT (DOMAIN CONTEXT)

Hệ thống được thiết kế theo các tài liệu phân tích thiết kế (Lab 1, 2, 3, 4) với các nhóm tác nhân và quy tắc nghiệp vụ cốt lõi:

### 1.1. Các tác nhân người dùng (Actors)
- **Sếp / Quản trị viên:** Giám sát dashboard, xem 4 báo cáo thống kê chuyên sâu (Doanh thu, Tỷ lệ lấp đầy, Hợp đồng, Vận hành), quản lý bảng giá nền tảng, kiểm tra nhật ký kiểm toán Audit Log (chỉ đọc).
- **Nhân viên Marketing:** Tiếp nhận thân nhân, quản lý hồ sơ người mất và thẩm tra Giấy báo tử, thiết lập 4 loại hợp đồng (Mua đất, Cải táng, Chuyển nhượng, Hỏa táng), lập phụ lục an táng/chăm sóc, in hợp đồng PDF và tải bản scan đã ký lên hệ thống.
- **Kế toán:** Quản lý công nợ khoản phải thu, ghi nhận thanh toán lũy kế (tiền mặt, chuyển khoản ngân hàng, VietQR), duyệt áp chiết khấu hợp lệ, xuất biên lai thu tiền định dạng PDF.
- **Quản trang / Nhân viên hiện trường:** Thao tác chủ yếu trên thiết bị di động/tablet ngoài trời: tra cứu vị trí mộ, kích hoạt dẫn đường GPS, nhận phân công ca trực, thực hiện checklist thi công và chụp ảnh nghiệm thu, kiểm tra checklist chăm sóc mộ định kỳ và đóng ca chăm sóc.
- **Thân nhân / Khách hàng công cộng:** Tra cứu mộ phần người quá cố trên cổng tưởng niệm không cần đăng nhập (Zero PII - không lộ CCCD, SĐT, hợp đồng), nhận chỉ dẫn vị trí và mở Google Maps dẫn đường.

### 1.2. Các ràng buộc miền cốt lõi (Domain Invariants)
- **Kim Tĩnh Bất Biến:** Mộ kết cấu Kim Tĩnh (`is_kim_tinh = 1`) sau khi an táng sẽ bị khóa vĩnh viễn (`is_locked = 1`) mức CSDL và service. Giao diện phải hiển thị rõ biểu tượng bảo vệ `🛡️` hoặc `🔒`, chặn hoàn toàn mọi hành vi lập hợp đồng cải táng hoặc chuyển nhượng.
- **Chốt chặn Giấy Báo Tử (Death Certificate Gate):** Bắt buộc Giấy báo tử phải ở trạng thái `VERIFIED` kèm file scan MinIO hợp lệ mới cho phép tạo phụ lục an táng hoặc hợp đồng hỏa táng.
- **Nguồn Công Nợ XOR (G14):** Một khoản phải thu chỉ được liên kết với duy nhất Hợp đồng chính HOẶC Phụ lục.
- **Thanh toán Idempotent (G15):** Giao dịch thu tiền không được phép vượt quá số dư nợ còn lại của khoản thu.
- **Chuẩn 4 Trạng Thái Giao Diện:** Mọi màn hình, danh sách và modal đều phải xử lý đủ 4 trạng thái: `Loading` (skeleton loader), `Normal` (dữ liệu đầy đủ), `Empty Data` (thông báo kèm nút CTA), `Error` (thông báo lỗi thân thiện kèm nút Thử lại).

---

## 2. BÁO CÁO RÀ SOÁT LỖI RESPONSIVE HIỆN TẠI (AUDIT REPORT)

Dựa trên hình ảnh chụp màn hình thực tế và mã nguồn hiện tại trong `web/src/`:
1. **Lỗi cấu trúc Layout Shell & Navigation Bar:**
   - Sidebar bị ghim cứng (`width: 260px`, `flexShrink: 0`) chiếm hơn 65% bề rộng màn hình trên thiết bị di động (~375px - 430px).
   - Không có nút Hamburger Menu (☰) trên thanh Header để đóng/mở sidebar.
   - Vùng nội dung chính bị dồn vào khoảng 35% còn lại, khiến tiêu đề "Bản Đồ Số GIS & Quản Lý Ô Mộ" bị bẻ dòng từng từ thành một cột dọc không thể đọc được.
   - Hotline tràn và đè lên tiêu đề trang ở góc trên.
2. **Lỗi nhồi nhét văn bản (Text Overflow & Dumping):**
   - Đoạn văn bản mô tả quy hoạch đất đai và Kim Tĩnh bị ép hẹp, kéo dài hàng chục dòng, choán hết diện tích hiển thị.
   - Thiếu kỹ thuật cắt dòng (`line-clamp`) và rút gọn văn bản.
3. **Lỗi thẻ chỉ số (KPI Stat Cards) và nút bấm:**
   - Nút "Làm mới" bị ép thành khối chữ nhật đứng chật chội.
   - Thẻ thống kê "Tổng số ô mộ" bị cắt cụt thành "Tổng số ô m...", con số 848 bị ép sát mép màn hình.
   - Grid sử dụng số cột cố định, không tự động chuyển thành 1-2 cột trên mobile.
4. **Lỗi bảng dữ liệu (Data Tables):**
   - Bảng 6 - 10 cột thiếu bao bọc `overflow-x: auto` làm phát sinh thanh cuộn ngang toàn trang.
   - Thiếu chế độ Mobile Card View trực quan.
5. **Lỗi Bản đồ Leaflet GIS & Drawer:**
   - Chiều cao bản đồ không tương thích với viewport di động.
   - Drawer chi tiết ô mộ che khuất màn hình và thiếu nút đóng thân thiện với ngón tay.
6. **Lỗi Modals & Form Wizards:**
   - Chiều rộng modal cố định 600px - 800px tràn ra ngoài mép màn hình di động, thiếu định dạng Bottom Sheet.

---

## 3. QUY CHUẨN KIẾN TRÚC RESPONSIVE DESIGN SYSTEM (MOBILE-FIRST)

### 3.1. Hệ thống Breakpoints
- `--breakpoint-sm`: `640px` (Điện thoại ngang / màn hình nhỏ)
- `--breakpoint-md`: `768px` (Tablet đứng)
- `--breakpoint-lg`: `1024px` (Tablet ngang / Laptop - Desktop layout kích hoạt từ đây)
- `--breakpoint-xl`: `1280px` (Desktop chuẩn)

### 3.2. Quy tắc hiển thị Shell Layout
- **Mobile (< 1024px):**
  - Sidebar ẩn hoàn toàn, chuyển thành **Off-canvas Drawer** trượt từ trái ra khi bấm Hamburger (☰), kèm Backdrop overlay làm mờ.
  - Header di động cao `56px` cố định, có nút Hamburger, logo rút gọn "QL NGHĨA TRANG", icon gọi hotline nhanh `1900 8888`.
  - Main Content chiếm 100% bề rộng (`width: 100%`, `min-width: 0`), đệm lề `px-3 py-3` hợp lý.
- **Desktop (≥ 1024px):**
  - Sidebar cố định bên trái (`width: 260px`).
  - Topbar đầy đủ tiêu đề trang, hotline, trạng thái người dùng.

### 3.3. Quy chuẩn Touch UX & Tương tác cảm ứng
- Kích thước chạm tối thiểu: `44px x 44px` (`.touch-target`).
- Khoảng cách an toàn ngón tay giữa các nút tối thiểu `8px`.
- Bảng dữ liệu tự động cho phép cuộn ngang (`.table-scroll-container`) hoặc hiển thị dưới dạng thẻ (Mobile Cards).
- Modals trên mobile chuyển thành Bottom Sheet bo tròn đỉnh, `max-height: 92vh`, sticky header & sticky footer.

---

## 4. LỘ TRÌNH THỰC THI 6 GIAI ĐOẠN

- **Giai đoạn 1:** Tái cấu trúc Shell Layout (`App.tsx`, `index.css`, `App.css`) với Topbar di động, Hamburger menu, Backdrop overlay, và Off-canvas drawer.
- **Giai đoạn 2:** Chuẩn hóa CSS Design System, Responsive Breakpoints & Utilities (`index.css`, `App.css`).
- **Giai đoạn 3:** Tối ưu hóa Sơ Đồ Ô Mộ & Bản Đồ GIS (`PlotMapModule.tsx`).
- **Giai đoạn 4:** Responsive hóa các phân hệ nghiệp vụ cốt lõi (Hợp đồng, Tài chính, Thi công, Chăm sóc, Hồ sơ & Tra cứu, Báo cáo & Audit).
- **Giai đoạn 5:** Tối ưu hóa Modals, Drawers & Form Wizards thành Bottom Sheets.
- **Giai đoạn 6:** Kiểm thử đa màn hình, `pnpm lint`, `pnpm build`, bảo đảm 100% Quality Gate.
