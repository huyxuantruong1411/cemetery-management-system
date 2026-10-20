# Từ điển UI Web và luồng code

**Ngày đối chiếu source:** 21/10/2026  
**Commit được rà:** `aa724b5`  
**Phạm vi:** Backend FastAPI trong `backend/app/` và web React/TypeScript trong `web/src/`; không bao gồm Flutter/mobile.  
**Mục đích:** tra cứu theo đúng tên nút, tab, tiêu đề, trường nhập, thông báo hoặc component; lần từ cha UI xuống handler frontend, request, router, permission, service, dữ liệu và kết quả.

## Cách tra cứu và ranh giới kiểm kê

Mỗi mục có mã ổn định dạng UI-...; Ctrl+F được bằng tên tiếng Việt hiển thị, tên component, handler, endpoint, mã use case hoặc từ khóa nghiệp vụ. Cây UI biểu diễn cách một màn hình mở tab, tab mở danh sách/chi tiết, nút mở hộp thoại và nút gửi form. Các hàng lặp theo dữ liệu (mỗi ô mộ, từng hợp đồng, từng tài khoản) được mô tả một lần theo mẫu component; dữ liệu động không phải nhãn UI riêng.

Kiểm kê bao quát 10 module nội bộ đang được mount trong App, hai trang công khai, đăng nhập, các dialog/form chính, thao tác quan trọng và component dùng chung có ảnh hưởng tới nghiệp vụ. Source `web/src` hiện có 46 file và `backend/app` có 57 file. Tệp ảnh, SVG mẫu, package bên ngoài, Flutter, dữ liệu sinh ra theo từng dòng bảng và mọi chuỗi do dữ liệu người dùng nhập không phải mục UI cố định. Vì vậy tài liệu bao phủ các điểm vào/chức năng hiển thị được khai báo trong source, không liệt kê từng giá trị dữ liệu có thể phát sinh vô hạn.

Các đoạn được gắn nhãn **Quyền hiển thị** mô tả gate thực tế ở web; quyền API vẫn được kiểm tra độc lập ở backend. Chúng không chứng minh quyền đã seed trong CSDL hiện hành. Mỗi kết luận là đọc source tĩnh; không thay cho đăng nhập và bấm thử trên từng tài khoản/dịch vụ.

~~~mermaid
flowchart LR
  A[Actor / URL / quyền UI] --> B[App.tsx: điều hướng và mount]
  B --> C[Component: state, form, handler]
  C --> D[apiFetch: token, refresh, gửi HTTP]
  D --> E[FastAPI router: schema + permission]
  E --> F[Service: quy tắc nghiệp vụ + transaction]
  F --> G[SQLAlchemy model / SQL Server]
  F --> H[Documents / MinIO / PDF / export khi có]
  G --> I[DTO trả về]
  H --> I
  I --> C
~~~

## Cây màn hình cấp cao

~~~text
App
├─ Khách chưa đăng nhập
│  ├─ Trang Chủ & Giới Thiệu
│  └─ Tra Cứu Phần Mộ → trang tưởng niệm công khai / dòng thời gian / dẫn đường
├─ Cán bộ đã đăng nhập — sidebar lọc theo hasPermission()
│  ├─ Sơ Đồ Ô Mộ & Bản Đồ → Sơ đồ minh họa | Bản đồ vị trí | Danh sách theo khu | Danh mục
│  ├─ Thân Nhân & Người Mất → Thân Nhân | Người Quá Cố & Giấy Báo Tử | Liên Kết Hồ Sơ | Cổng công khai
│  ├─ Hợp Đồng & Khách Hàng → danh sách / chi tiết / wizard giao dịch / phụ lục / ký ngoài và scan
│  ├─ Chăm Sóc Mộ Phần → Lịch Chăm Sóc Thực Địa | Công việc được bàn giao | chi tiết / phân công / checklist / ảnh / đóng ca
│  ├─ Thi Công Thực Địa → danh sách lệnh / chi tiết / checklist / ảnh / nghiệm thu / lịch bận
│  ├─ Công Nợ & Thu Tiền → Khoản thu theo hợp đồng | Công nợ & thanh toán
│  ├─ Bảng Giá & Gói Dịch Vụ → Bảng Giá | Gói Chăm Sóc | Mẫu Hợp Đồng | Tra Cứu Giá
│  ├─ Quản Trị Người Dùng → Danh Sách Tài Khoản | Ma Trận Phân Quyền Vai Trò
│  ├─ Báo Cáo Thống Kê → Doanh thu | Lấp đầy | Hợp đồng | Vận hành | Xuất file
│  └─ Nhật Ký Kiểm Toán → lọc sự kiện / xem bản kể / xem chi tiết và diff
└─ Dùng chung: đăng nhập, đổi mật khẩu, phân trang, xác nhận/thông báo, tệp và ảnh minh chứng
~~~

## UI-00 — App shell, điều hướng và quyền vào module

**Từ khóa:** Trang Chủ & Giới Thiệu; Tra Cứu Phần Mộ; Sơ Đồ Ô Mộ & Bản Đồ; Thân Nhân & Người Mất; Hợp Đồng & Khách Hàng; Chăm Sóc Mộ Phần; Thi Công Thực Địa; Công Nợ & Thu Tiền; Bảng Giá & Gói Dịch Vụ; Quản Trị Người Dùng; Báo Cáo Thống Kê; Nhật Ký Kiểm Toán; mở danh mục; đóng danh mục; đăng xuất.

**Cha → con:** App → Sidebar/Drawer → một tab module; trên màn hình hẹp nút menu mở drawer, chọn module thì đóng drawer.

**Hiển thị:** khách chưa xác thực chỉ thấy Trang Chủ & Giới Thiệu và Tra Cứu Phần Mộ. Cán bộ thấy từng liên kết theo `hasPermission()` trong App.tsx. Màn module còn được mount bằng gate tương ứng ở cuối App.tsx. Không dùng việc mục menu bị ẩn làm cơ chế bảo vệ API.

**Luồng code:** `App()` bọc `ErrorBoundary`, `AuthProvider`, `NotificationModalProvider`, sau đó mount `MainApp()`. `MainApp` lấy `user`, `accessToken`, `logout`, `hasPermission` từ `useAuth`; `handleSelectTab()` đổi `activeTab` và đóng menu. Khi user vừa vào, effect chọn tab mặc định theo permission hiện có; effect resize tự đóng drawer khi viewport desktop; effect thứ hai khóa cuộn body khi drawer mở; phím Escape đóng drawer. Render sidebar và nội dung đều kiểm tra permission để tránh mount module sai quyền. Header hiển thị hotline/phiên bảo mật; nút đăng nhập mở LoginModal; nút đăng xuất gọi AuthContext.

**File/hàm:** [App.tsx#L108](../web/src/App.tsx#L108) `MainApp`; [App.tsx#L150](../web/src/App.tsx#L150) chọn tab mặc định; [App.tsx#L300](../web/src/App.tsx#L300) menu công khai; [App.tsx#L340](../web/src/App.tsx#L340) menu nội bộ; [App.tsx#L1020](../web/src/App.tsx#L1020) mount module; [AuthContext.tsx#L33](../web/src/context/AuthContext.tsx#L33); [useAuth.ts#L4](../web/src/context/useAuth.ts#L4); [apiClient.ts#L46](../web/src/services/apiClient.ts#L46).

**Các gate cần nhớ khi giải thích:** `catalog` cần `catalog:manage` để hiện/mount, dù một số GET catalog chỉ cần `catalog:read`; người chỉ đọc vì thế không thấy màn hình web hiện tại. `audit` đang hiện/mount theo `users:read` trong App, trong khi `/api/v1/audit/*` yêu cầu `audit:read`; nếu role chỉ có users:read thì vào trang được nhưng API trả 403. Hai điểm này được ghi là UI/API gate không đồng nhất, không kết luận endpoint bỏ kiểm quyền.

## UI-01 — Trang công khai và tìm kiếm tưởng niệm

### UI-01.1 — “Trang Chủ & Giới Thiệu”

**Từ khóa:** Cổng Dành Cho Thân Nhân; Tra Cứu Phần Mộ Ngay; Dịch Vụ Chăm Sóc Phần Mộ; Cổng Dành Cho Cán Bộ Quản Lý; Mở cổng tra cứu; Đăng nhập hệ thống; hotline.

**Cha → con:** App công khai → thẻ giới thiệu/tiện ích → Tra Cứu Phần Mộ hoặc Đăng nhập hệ thống.

**Luồng code:** đây là trang nội dung trong `App.tsx`, không gọi API để đọc hồ sơ. Nút tra cứu đổi `activeTab` sang `public_memorial`; nút cán bộ mở LoginModal. Các đoạn mô tả dịch vụ/hotline là thông tin giao diện cố định, không phải gói dịch vụ hoặc hợp đồng được tạo trong database.

**File/hàm:** [App.tsx#L695](../web/src/App.tsx#L695) nhánh trang chủ; [App.tsx#L714](../web/src/App.tsx#L714) CTA tra cứu; [App.tsx#L734](../web/src/App.tsx#L734) đăng nhập; [LoginModal.tsx#L10](../web/src/components/auth/LoginModal.tsx#L10).

### UI-01.2 — “Tra Cứu Phần Mộ” / “Cổng Tra Cứu Phần Mộ Tưởng Niệm”

**Từ khóa:** Nhập họ tên hoặc mã người quá cố; Nguyễn Văn Phúc; NM-2024; Gợi ý; Mở Google Maps chỉ đường; Xem Nhật Ký Hoạt Động & Ảnh Minh Chứng; Nhật Ký Thi Công, An Táng & Chăm Sóc Ô Mộ; tên người mất; mã ô.

**Cha → con:** Sidebar/CTA → ProfileModule ở chế độ không token → ô tìm kiếm → kết quả công khai → chi tiết tưởng niệm → timeline/bằng chứng và link bản đồ.

**Luồng code:** ProfileModule nhận không có `token`, chuyển sang nhánh public. Nhập và gửi từ khóa gọi GET `/api/v1/profiles/public/memorials?q=...`; chọn một kết quả có thể tải timeline qua GET `/api/v1/plots/public/{plot_identifier}/timeline`. Phần public response được lọc ở `ProfileService` để trả trường được công bố, không phải dữ liệu hồ sơ nội bộ. Google Maps link được dựng từ vị trí hợp lệ; nhấn link mở dịch vụ bản đồ bên ngoài. Nếu kết quả chưa có tọa độ/map URL thì nút dẫn đường không thể đưa ra vị trí chính xác. Ảnh/tệp công khai được lấy qua public media route phù hợp, không mở quyền file riêng tư chỉ vì có link trong timeline.

**File/hàm:** [ProfileModule.tsx#L43](../web/src/components/profiles/ProfileModule.tsx#L43) nhận token; [ProfileModule.tsx#L118](../web/src/components/profiles/ProfileModule.tsx#L118) mở timeline; [ProfileModule.tsx#L628](../web/src/components/profiles/ProfileModule.tsx#L628) tải kết quả; [ProfileModule.tsx#L2226](../web/src/components/profiles/ProfileModule.tsx#L2226) nhánh UI public; [profiles/router.py#L32](../backend/app/modules/profiles/router.py#L32) → [profiles/service.py#L704](../backend/app/modules/profiles/service.py#L704) tra cứu người mất; [plots/router.py#L338](../backend/app/modules/plots/router.py#L338) → [plots/service.py#L862](../backend/app/modules/plots/service.py#L862) dòng thời gian ô; [documents/router.py#L135](../backend/app/modules/documents/router.py#L135) ảnh công khai.

## UI-02 — Đăng nhập, refresh phiên và đăng xuất

### UI-02.1 — “Đăng Nhập Hệ Thống”

**Từ khóa:** Đăng nhập cán bộ; Đăng nhập hệ thống; Nhập tên đăng nhập; Nhập mật khẩu; Đang xác thực; LoginModal; authApi.login; POST /auth/login.

**Cha → con:** App header/CTA → modal đăng nhập → form username/password → nút Đăng nhập → trang đầu theo permission.

**Luồng code:** `LoginModal.handleSubmit` chặn submit mặc định, đặt trạng thái loading, gọi `authApi.login()`, hiển thị lỗi ngay trong dialog nếu request thất bại và gọi callback đóng modal khi thành công. `AuthProvider` ghi nhận user/access token và khởi tạo phiên; sau đó App effect chọn module đầu tiên mà user có quyền đọc/thực hiện. Backend router nhận POST login, `AuthService.authenticate_user()` kiểm tra user/password, tạo phiên và token; dependency xác thực request kế tiếp đọc token, xác nhận user active và phiên chưa bị thu hồi. Không lấy tên role hiển thị ở UI làm chốt cấp quyền.

**File/hàm:** [LoginModal.tsx#L33](../web/src/components/auth/LoginModal.tsx#L33), [LoginModal.tsx#L164](../web/src/components/auth/LoginModal.tsx#L164); [authApi.ts#L3](../web/src/services/authApi.ts#L3); [AuthContext.tsx#L33](../web/src/context/AuthContext.tsx#L33); [auth/router.py#L52](../backend/app/modules/auth/router.py#L52); [auth/service.py#L61](../backend/app/modules/auth/service.py#L61); [auth/dependencies.py#L20](../backend/app/modules/auth/dependencies.py#L20).

### UI-02.2 — “Đăng Xuất” / hết hạn phiên

**Từ khóa:** Đăng Xuất; Đăng Xuất Khỏi Hệ Thống; refresh token; SESSION_EVENT; clearSession; logout; auth_version.

**Luồng code:** nút gọi `AuthContext.logout()`, xóa trạng thái giao diện và token/refresh-session local theo client. `apiFetch` xử lý 401 bằng refresh phiên một lần khi được phép; nếu refresh thất bại hoặc session generation đã đổi thì xóa phiên và báo các component về trạng thái chưa xác thực. Backend logout/revoke làm token/session mất hiệu lực cho request kế tiếp. Đây là luồng khác với chỉ chuyển về trang chủ.

**File/hàm:** [App.tsx#L553](../web/src/App.tsx#L553), [App.tsx#L572](../web/src/App.tsx#L572), [AuthContext.tsx#L31](../web/src/context/AuthContext.tsx#L31), [apiClient.ts#L35](../web/src/services/apiClient.ts#L35), [apiClient.ts#L51](../web/src/services/apiClient.ts#L51), [apiClient.ts#L64](../web/src/services/apiClient.ts#L64), [auth/router.py#L79](../backend/app/modules/auth/router.py#L79).

## UI-03 — “Sơ Đồ Ô Mộ & Bản Đồ”

**Từ khóa:** Vị trí ô mộ; Sơ đồ minh họa; Bản đồ vị trí; Danh sách theo khu; Danh Mục Khu Vực & Loại Mộ; Tìm theo mã ô mộ; khu/hàng/loại mộ; giữ chỗ; GIS; Lat/Long; ô mộ mô phỏng.

**Quyền vào:** App mount khi có `plots:read`. Các thao tác ghi cuối cùng cần permission ở endpoint; trong PlotMapModule, không phải mọi nút con đều được ẩn theo `plots:manage`. Khi giải thích quyền thao tác cụ thể, đọc gate trong router và ghi nhận nếu UI mở hành động rồi API mới từ chối.

### UI-03.1 — Tab “Sơ đồ minh họa”

**Cha → con:** Sơ Đồ Ô Mộ & Bản Đồ → Sơ đồ minh họa → nhập mã/ lọc khu, trạng thái, loại → chọn một ô → chi tiết ô.

**Luồng code:** `SimulatedPlotMap` sinh lưới mô phỏng trên client bằng `generateSimulatedPlots()`, không đọc hay ghi mộ thật trong SQL. Lọc và tìm chạy trên danh sách mô phỏng; click ô gọi `handleSelectPlot()` để mở panel chi tiết; `handleFocusPlot()` di chuyển camera SVG đến ô được chọn. Đây là hình minh họa vị trí tương đối, mã thường có tiền tố DEMO; không dùng tọa độ giả để tạo chỉ đường Google Maps. Tìm chuỗi `DEMO-B-H03-05`, `Phóng Tới Ô & Tuyến Đi Bộ` hoặc `Google Maps bị tắt cho ô mô phỏng` để phân biệt nhánh này với GIS dữ liệu thật.

**File/hàm:** [PlotMapModule.tsx#L1084](../web/src/components/plots/PlotMapModule.tsx#L1084); [SimulatedPlotMap.tsx#L40](../web/src/components/plots/SimulatedPlotMap.tsx#L40), [SimulatedPlotMap.tsx#L119](../web/src/components/plots/SimulatedPlotMap.tsx#L119), [SimulatedPlotMap.tsx#L123](../web/src/components/plots/SimulatedPlotMap.tsx#L123).

### UI-03.2 — Tab “Bản đồ vị trí” / Leaflet GIS

**Cha → con:** sơ đồ module → Bản đồ vị trí → thanh công cụ nền → marker ô mộ → popup/chi tiết → Xem tất cả hoặc focus ô.

**Luồng code:** `PlotMapModule.fetchData()` tải khu/hàng/loại/thống kê và `loadPlots()` phân trang API ô mộ. `GeographicPlotMap` chỉ đặt marker cho bản ghi có tọa độ hợp lệ; toolbar đếm `located / plots`, `fit()` đưa toàn bộ marker vào viewport. Nền phố là tile OpenStreetMap bên ngoài; khi tile lỗi thì thông báo và nút “Thử lại” cho phép bật lại nền đường phố, còn dữ liệu marker vẫn đến từ tọa độ bản ghi. `Sơ đồ minh họa` và GIS là hai nguồn hiển thị khác nhau: marker GIS không được suy ra từ nền bản đồ.

**Tên UI:** “Nền đường phố”, “Nền đơn giản”, “Xem tất cả”, “Thử lại”, “ô có vị trí”, các nhãn trạng thái mộ.  
**File/hàm:** [PlotMapModule.tsx#L150](../web/src/components/plots/PlotMapModule.tsx#L150), [PlotMapModule.tsx#L158](../web/src/components/plots/PlotMapModule.tsx#L158), [GeographicPlotMap.tsx#L112](../web/src/components/plots/GeographicPlotMap.tsx#L112), [GeographicPlotMap.tsx#L114](../web/src/components/plots/GeographicPlotMap.tsx#L114), [plots/router.py#L218](../backend/app/modules/plots/router.py#L218) → [plots/service.py#L328](../backend/app/modules/plots/service.py#L328) `list_plots`.

### UI-03.3 — “Danh sách theo khu”, bộ lọc và chọn ô mộ

**Từ khóa:** Tìm theo mã ô mộ; tổng số ô mộ; Đất trống chưa bán; Đang tạm giữ chỗ; Đã an táng; Không tìm thấy ô mộ nào; lọc khu/trạng thái/loại.

**Luồng code:** bộ lọc state tạo query cho danh sách ô; `fetchData` gọi các endpoint `/api/v1/plots*`; khi click bản ghi `handleSelectPlot()` cập nhật ô đang chọn và `fetchPlotDetail()` lấy DTO chi tiết. Danh sách, SVG mô phỏng và Leaflet dùng các component render riêng nhưng lựa chọn chi tiết thật quay về `PlotDetailResponse` từ API. Các thẻ tổng quan là số liệu `get_plot_stats`, không tự tính từ các ô đang nằm trên màn hình hiện tại.

**File/hàm:** [PlotMapModule.tsx#L150](../web/src/components/plots/PlotMapModule.tsx#L150), [PlotMapModule.tsx#L199](../web/src/components/plots/PlotMapModule.tsx#L199), [PlotMapModule.tsx#L214](../web/src/components/plots/PlotMapModule.tsx#L214), [PlotMapModule.tsx#L1269](../web/src/components/plots/PlotMapModule.tsx#L1269), [plots/router.py#L218](../backend/app/modules/plots/router.py#L218), [plots/router.py#L249](../backend/app/modules/plots/router.py#L249).

### UI-03.4 — Chi tiết ô và “Tạm Giữ Chỗ Cho Khách”

**Từ khóa:** mã ô; Mộ Kim tĩnh; Đang giữ chỗ; Dẫn Đường Tới Mộ (Google Maps); Tạm Giữ Chỗ Cho Khách; Chỉnh Sửa Thông Tin Ô Mộ; Xóa Ô Mộ Này.

**Luồng code:** mở detail dùng plot id để GET `/plots/{id}`; thao tác giữ chỗ mở form hỏi tên/số điện thoại/ghi chú rồi POST `/plots/{id}/reserve`. Cancel reservation đi qua confirm chung rồi POST `/cancel-reservation`. API gọi PlotService, nơi kiểm trạng thái, khóa dòng và cập nhật reservation; giao diện không tự chuyển trạng thái hợp pháp bằng dropdown. Sửa/xóa ô đi qua PUT/DELETE riêng và service chặn các invariant của ô đã gắn dữ liệu/an táng.

**File/hàm:** [PlotMapModule.tsx#L199](../web/src/components/plots/PlotMapModule.tsx#L199), [PlotMapModule.tsx#L239](../web/src/components/plots/PlotMapModule.tsx#L239), [PlotMapModule.tsx#L287](../web/src/components/plots/PlotMapModule.tsx#L287), [plots/router.py#L260](../backend/app/modules/plots/router.py#L260), [plots/router.py#L307](../backend/app/modules/plots/router.py#L307), [plots/service.py#L703](../backend/app/modules/plots/service.py#L703) `reserve_plot`.

### UI-03.5 — “Danh Mục Khu Vực & Loại Mộ” và “Thêm Ô Mộ Mới”

**Từ khóa:** Khu Vực; Hàng Mộ; Loại Mộ; Thêm Ô Mộ Mới; thêm/sửa/xóa khu; thêm/sửa/xóa hàng; loại mộ; số slot; tọa độ.

**Luồng code:** danh mục chứa ba nhóm dữ liệu khu, hàng, loại mộ cùng form ô. `handleSaveZone`, `handleSaveRow`, `handleSavePlotType`, `handleSavePlot` phân biệt tạo mới hay sửa bằng trạng thái modal rồi POST/PUT endpoint tương ứng; thao tác xóa chọn route theo entity trong `handleConfirmDelete`. Tạo ô mới gửi plot code, row/type, GPS và cấu hình vào PlotService; server tạo slot con theo `default_slots`. Nút sinh hàng/ô hàng loạt gọi lần lượt POST rows/plots cho các mã được tạo ở frontend; phải hiểu đây là vòng lặp gọi nhiều request, không phải một lệnh SQL bulk nguyên tử. Kiểm tra quyền manage phải lần ở plots/router, không dựa việc nút xuất hiện.

**Các modal:** “Giữ Chỗ Ô Đất Độc Quyền”; “Quản Lý Quy Hoạch Không Gian & Danh Mục Kích Thước”; “Sinh Dãy Hàng Nhanh Hàng Loạt”; “Sinh Ô Mộ Nhanh Hàng Loạt”; form khu/hàng/loại/ô; xác nhận xóa.  
**File/hàm:** [PlotMapModule.tsx#L442](../web/src/components/plots/PlotMapModule.tsx#L442), [PlotMapModule.tsx#L487](../web/src/components/plots/PlotMapModule.tsx#L487), [PlotMapModule.tsx#L531](../web/src/components/plots/PlotMapModule.tsx#L531), [PlotMapModule.tsx#L577](../web/src/components/plots/PlotMapModule.tsx#L577), [PlotMapModule.tsx#L645](../web/src/components/plots/PlotMapModule.tsx#L645), [PlotMapModule.tsx#L680](../web/src/components/plots/PlotMapModule.tsx#L680), [PlotMapModule.tsx#L730](../web/src/components/plots/PlotMapModule.tsx#L730), [plots/router.py#L49](../backend/app/modules/plots/router.py#L49), [plots/service.py#L429](../backend/app/modules/plots/service.py#L429) `get_plot`.

### UI-03.6 — Nút “Vị trí” / mở đường tới ô

**Cha → con:** một ô trên hồ sơ, lệnh thi công hoặc ca chăm sóc → nút Vị trí → panel bản đồ/vị trí → “Mở Google Maps chỉ đường”.

**Luồng code:** `PlotDirectionsButton` nhận `plotId` hoặc `plotCode`, tải plot detail, kiểm tra lat/long trước khi dựng bản đồ và link Google Maps. Trong ca/lệnh, shortcut giúp mở đúng vị trí từ bản ghi công việc mà không cần quay lại tab khác. Với các marker, route bên ngoài chỉ là điều hướng tới tọa độ; không quyết định quyền hay trạng thái ô.

**File/hàm:** [PlotDirectionsButton.tsx#L20](../web/src/components/plots/PlotDirectionsButton.tsx#L20), [PlotDirectionsButton.tsx#L48](../web/src/components/plots/PlotDirectionsButton.tsx#L48), [PlotDirectionsButton.tsx#L103](../web/src/components/plots/PlotDirectionsButton.tsx#L103); nơi component được gắn trong hồ sơ/lệnh/ca; chi tiết nghiệp vụ tại [UC-1.5](USECASE_CODE_TRACEABILITY.md#uc-15--dẫn-đường-tới-mộ).

## UI-04 — “Thân Nhân & Người Mất” / ProfileModule

**Quyền vào:** App yêu cầu `customers:read`; component nhận `currentUserRoles` nhưng quyền ghi phải được bảo đảm bằng các router `customers:write`/`deceased:write` tương ứng.

### UI-04.1 — Tabs “Thân Nhân (Khách Hàng)”, “Người Quá Cố & Giấy Báo Tử”, “Liên Kết Hồ Sơ”

**Từ khóa:** Hồ Sơ Khách Hàng & Người Quá Cố; tìm tên/mã KH/CCCD/SĐT; tìm hồ sơ người mất; quan hệ thân nhân; xóa lọc; phân trang.

**Luồng code:** mỗi tab đổi state `activeTab` trong cùng component, nhưng mỗi bảng gọi endpoint và filter riêng: `loadCustomers()` → `/profiles/customers`, `loadDeceased()` → `/profiles/deceased`, `loadRelations()` → `/profiles/relations`. Search/sort/pagination chỉ điều khiển truy vấn hoặc phân trang ở frontend theo endpoint. Chi tiết từng khách/người mất mở panel riêng; link quan hệ không đồng nghĩa người thân sở hữu ô.

**File/hàm:** [ProfileModule.tsx#L183](../web/src/components/profiles/ProfileModule.tsx#L183), [ProfileModule.tsx#L203](../web/src/components/profiles/ProfileModule.tsx#L203), [ProfileModule.tsx#L223](../web/src/components/profiles/ProfileModule.tsx#L223), [ProfileModule.tsx#L682](../web/src/components/profiles/ProfileModule.tsx#L682), [ProfileModule.tsx#L700](../web/src/components/profiles/ProfileModule.tsx#L700), [ProfileModule.tsx#L718](../web/src/components/profiles/ProfileModule.tsx#L718), [profiles/router.py#L51](../backend/app/modules/profiles/router.py#L51), [profiles/router.py#L114](../backend/app/modules/profiles/router.py#L114), [profiles/router.py#L187](../backend/app/modules/profiles/router.py#L187).

### UI-04.2 — “Thêm khách hàng”, xem và sửa khách hàng

**Từ khóa:** CCCD; Số điện thoại; email; địa chỉ; “Không tìm thấy khách hàng nào”; “Thêm khách hàng nhanh” (ở wizard hợp đồng).

**Luồng code:** form khách hàng thu thập thông tin định danh/liên hệ; `handleCreateCustomer()` validate cơ bản ở browser rồi POST `/profiles/customers`; response thêm vào danh sách/đóng modal. Chi tiết khách hàng hiện chỉ GET/đọc. Backend có PUT `/profiles/customers/{id}` và `ProfileService.update_customer()`, nhưng trong ProfileModule không thấy handler, submit form hoặc lời gọi PUT; thao tác cập nhật chưa có UI web. Các handler tạo/liên kết hiện tại không được ẩn theo `customers:write`, nên người chỉ có quyền đọc có thể thấy nút ghi rồi backend từ chối POST nếu thiếu scope. Đây là thiếu chức năng UI và gate quyền theo thao tác, không phải bằng chứng API cho phép ghi.

**File/hàm:** [ProfileModule.tsx#L353](../web/src/components/profiles/ProfileModule.tsx#L353), [ProfileModule.tsx#L3430](../web/src/components/profiles/ProfileModule.tsx#L3430), [ProfileModule.tsx#L3455](../web/src/components/profiles/ProfileModule.tsx#L3455); API có [profiles/router.py#L51](../backend/app/modules/profiles/router.py#L51) POST và [profiles/router.py#L82](../backend/app/modules/profiles/router.py#L82) PUT cùng [profiles/service.py#L72](../backend/app/modules/profiles/service.py#L72) create và [profiles/service.py#L122](../backend/app/modules/profiles/service.py#L122) update, nhưng PUT không được gọi từ ProfileModule.

### UI-04.3 — “Thêm hồ sơ người mất”, giấy báo tử và xác minh

**Từ khóa:** Người Quá Cố & Giấy Báo Tử; ngày sinh/ngày mất; năm sinh không rõ ngày; Tải scan; Giấy Báo Tử; Xác minh; attach_death_certificate; verify_death_certificate.

**Luồng code:** `handleCreateDeceased()` POST hồ sơ người mất. Nếu đính kèm chứng từ, frontend trước upload multipart `/documents/upload`, lấy `file_id`, rồi POST `/profiles/deceased/{id}/certificate`; sau khi gắn có thể liên kết version hồ sơ. Nút thành công hiện ghi “Đã lưu và xác thực bản scan giấy báo tử thành công!”. Service `attach_or_update_certificate()` thực tế tự đặt `is_verified=True`, `verified_by` bằng user đang upload khi tệp ở trạng thái READY. Backend có POST `/profiles/certificates/{cert_id}/verify` riêng để approve/reject có lý do, nhưng không tìm thấy lời gọi route đó trong ProfileModule. `ContractService.confirm_burial()` kiểm tra trạng thái giấy một lần nữa trước khi ghi nhận an táng. Vì thế UI đang gộp thao tác tải scan với xác thực; đây là khác biệt cần nói rõ khi so với quy trình duyệt pháp lý thủ công. Form hiện tại mở các control ghi trong component; endpoint kiểm permission tại server.

**File/hàm:** [ProfileModule.tsx#L398](../web/src/components/profiles/ProfileModule.tsx#L398), [ProfileModule.tsx#L438](../web/src/components/profiles/ProfileModule.tsx#L438), [ProfileModule.tsx#L4321](../web/src/components/profiles/ProfileModule.tsx#L4321), [ProfileModule.tsx#L4042](../web/src/components/profiles/ProfileModule.tsx#L4042), [profiles/router.py#L96](../backend/app/modules/profiles/router.py#L96), [profiles/router.py#L151](../backend/app/modules/profiles/router.py#L151), [profiles/router.py#L167](../backend/app/modules/profiles/router.py#L167), [profiles/service.py#L537](../backend/app/modules/profiles/service.py#L537), [profiles/service.py#L607](../backend/app/modules/profiles/service.py#L607), [contracts/service.py#L1331](../backend/app/modules/contracts/service.py#L1331).

### UI-04.4 — “Liên Kết Hồ Sơ”, “Thêm liên kết”, “Gỡ liên kết”

**Luồng code:** form chọn một Customer, một DeceasedProfile và loại quan hệ/người liên hệ chính; submit gọi POST `/profiles/relations`, xóa qua DELETE `/profiles/relations/{id}`. Service giữ quan hệ N–N. Liên kết khách với người mất không tự gắn người đó vào một slot; slot chỉ được ghi qua phụ lục/an táng.

**File/hàm:** [ProfileModule.tsx#L243](../web/src/components/profiles/ProfileModule.tsx#L243), [ProfileModule.tsx#L256](../web/src/components/profiles/ProfileModule.tsx#L256), [ProfileModule.tsx#L313](../web/src/components/profiles/ProfileModule.tsx#L313), [ProfileModule.tsx#L4754](../web/src/components/profiles/ProfileModule.tsx#L4754), [profiles/router.py#L187](../backend/app/modules/profiles/router.py#L187), [profiles/router.py#L198](../backend/app/modules/profiles/router.py#L198), [profiles/router.py#L210](../backend/app/modules/profiles/router.py#L210).

### UI-04.5 — “Dòng thời gian”, “Mở Google Maps chỉ đường” và kết quả public

**Luồng code:** tab public nội bộ/cổng public tìm hồ sơ theo tên/mã; chọn hồ sơ hoặc ô thì xem các sự kiện đã công bố cùng minh chứng và link dẫn đường. `public/memorials` và `plots/public/{plot_identifier}/timeline` là API GET công khai, service dựng DTO đã lọc. Tìm công khai không được biến thành đường đọc CCCD, địa chỉ, hợp đồng, khoản nợ hoặc hồ sơ scan. 

**File/hàm:** [ProfileModule.tsx#L614](../web/src/components/profiles/ProfileModule.tsx#L614), [ProfileModule.tsx#L2267](../web/src/components/profiles/ProfileModule.tsx#L2267), [ProfileModule.tsx#L2849](../web/src/components/profiles/ProfileModule.tsx#L2849), [profiles/router.py#L32](../backend/app/modules/profiles/router.py#L32) → [profiles/service.py#L704](../backend/app/modules/profiles/service.py#L704) `public_lookup_deceased`.

## UI-05 — “Hợp Đồng & Khách Hàng” / ContractModule

**Quyền vào:** App yêu cầu `contracts:read`. Nút ghi trong ContractModule hiện dùng biến `canManage` tính theo role ở component; server lại dựa `contracts:write`/`contracts:activate`. Khi quyền được cấu hình khác role hard-code, nút có thể lệch với API. CARETAKER không được coi tab này là căn cứ nhận việc; dùng WorkBasis giới hạn dữ liệu.

### UI-05.1 — “Danh sách hợp đồng”, KPI, tìm/lọc và mở chi tiết

**Từ khóa:** Tổng Hợp Đồng; Đang Hiệu Lực; Chờ Ký / Dự Thảo; Doanh Thu Hiệu Lực; Tìm theo mã HĐ, tên KH, SĐT, mã ô; trạng thái; loại hợp đồng.

**Luồng code:** `fetchContracts()` gửi filter/search đến GET `/api/v1/contracts`; click một dòng gọi `fetchContractDetail(id)` GET `/contracts/{id}`. KPI là giá trị tính từ tập hợp response đã tải, còn chi tiết hiển thị hợp đồng, các subtype, phụ lục và thông tin tài chính theo DTO. Bảng search chỉ giúp tìm bản ghi; backend vẫn kiểm `contracts:read`.

**File/hàm:** [ContractModule.tsx#L359](../web/src/components/contracts/ContractModule.tsx#L359), [ContractModule.tsx#L388](../web/src/components/contracts/ContractModule.tsx#L388), [ContractModule.tsx#L1457](../web/src/components/contracts/ContractModule.tsx#L1457), [contracts/router.py#L132](../backend/app/modules/contracts/router.py#L132), [contracts/router.py#L190](../backend/app/modules/contracts/router.py#L190).

### UI-05.2 — “+ Mua Đất” → wizard “Tạo Hợp Đồng Mua Đất”

**Cha → con:** toolbar hợp đồng → + Mua Đất → chọn khách, ô/slot, giá/ngày và điều khoản → “Xác Nhận & Tạo Dự Thảo” → chi tiết hợp đồng.

**Luồng code:** `handleOpenWizard()` khởi tạo state modal, tải gợi ý khách và ô còn trống. Submit dựng body và POST `/contracts/land-purchase`; router validate Pydantic và `contracts:write`; `ContractService.create_land_purchase_contract()` kiểm tra plot đủ điều kiện rồi khóa dòng trong SQL Server để tránh hai giao dịch cùng giữ ô, tạo contract draft/subtype/reservation trong transaction. Giá lấy từ catalog theo ngày; contract lưu snapshot giá để thay bảng giá sau này không đổi giao dịch cũ. “Tạo dự thảo” chưa có nghĩa đã ký hoặc kích hoạt.

**File/hàm:** [ContractModule.tsx#L460](../web/src/components/contracts/ContractModule.tsx#L460), [ContractModule.tsx#L473](../web/src/components/contracts/ContractModule.tsx#L473), [ContractModule.tsx#L495](../web/src/components/contracts/ContractModule.tsx#L495), [ContractModule.tsx#L2022](../web/src/components/contracts/ContractModule.tsx#L2022), [contracts/router.py#L39](../backend/app/modules/contracts/router.py#L39) → [contracts/service.py#L134](../backend/app/modules/contracts/service.py#L134) `create_land_purchase_contract`.

### UI-05.3 — “+ Cải Táng”, “+ Chuyển Nhượng”, “+ Hỏa Táng”

**Luồng code:** mỗi nút mở form riêng vì dữ liệu và điều kiện đầu vào khác nhau. Cải táng tìm người mất/ô đã an táng; chuyển nhượng chọn bên nhận và ô chuyển quyền; hỏa táng chọn người mất và gói/dịch vụ. Submit gọi endpoint transaction type tương ứng, router kiểm permission, service kiểm trạng thái ô/hợp đồng/slot/quan hệ và tạo subtype hợp đồng. Đây không phải ba nút đổi trạng thái trực tiếp; command nghiệp vụ tạo hồ sơ có căn cứ.

**Tên form/chuỗi tìm:** Hồ Sơ Cải Táng; Hợp Đồng Chuyển Nhượng Quyền Sử Dụng; Hợp Đồng Hỏa Táng Trọn Gói; Chọn ô mộ đã an táng; Chọn ô mộ để chuyển nhượng; Tạo Dự Thảo.  
**File:** [ContractModule.tsx#L1018](../web/src/components/contracts/ContractModule.tsx#L1018), [ContractModule.tsx#L1124](../web/src/components/contracts/ContractModule.tsx#L1124), [ContractModule.tsx#L1212](../web/src/components/contracts/ContractModule.tsx#L1212), [contracts/router.py#L61](../backend/app/modules/contracts/router.py#L61), [contracts/router.py#L84](../backend/app/modules/contracts/router.py#L84), [contracts/router.py#L107](../backend/app/modules/contracts/router.py#L107).

### UI-05.4 — Chi tiết hợp đồng: in, chờ ký, kích hoạt, hủy

**Từ khóa:** In Hợp Đồng (PDF); Chuyển Chờ Ký; Kích Hoạt (Kèm File Scan); Hủy Dự Thảo; Xác Nhận Kích Hoạt; Tải scan.

**Luồng code:** tải PDF gọi GET `/contracts/{id}/pdf`; chuyển trạng thái gọi POST `/submit-signing`; kích hoạt hợp đồng dùng 2 request theo thứ tự: POST `/documents/upload` lấy file id, rồi POST `/contracts/{id}/activate` gắn scan và chạy transition. Nếu upload thành công nhưng activate lỗi, hệ thống không được coi hợp đồng là ACTIVE. Hủy dự thảo gọi POST `/cancel`, ghi lý do và backend từ chối trạng thái không hợp lệ. `ContractService` sau kích hoạt có thể cập nhật owner/trạng thái plot, lập khoản phải thu và audit/outbox.

**File/hàm:** [ContractModule.tsx#L521](../web/src/components/contracts/ContractModule.tsx#L521), [ContractModule.tsx#L549](../web/src/components/contracts/ContractModule.tsx#L549), [ContractModule.tsx#L570](../web/src/components/contracts/ContractModule.tsx#L570), [ContractModule.tsx#L624](../web/src/components/contracts/ContractModule.tsx#L624), [contracts/router.py#L206](../backend/app/modules/contracts/router.py#L206), [contracts/router.py#L223](../backend/app/modules/contracts/router.py#L223), [contracts/router.py#L247](../backend/app/modules/contracts/router.py#L247), [contracts/service.py#L1714](../backend/app/modules/contracts/service.py#L1714) nộp ký và [contracts/service.py#L1767](../backend/app/modules/contracts/service.py#L1767) kích hoạt.

### UI-05.5 — “+ Phụ Lục An Táng / Chăm Sóc / Thi Công”

**Luồng code:** các nút nằm trong hợp đồng chi tiết, khởi tạo form theo loại annex. An táng chọn người mất, ô/slot và loại an táng; chăm sóc lấy gói đang active; thi công cho phép nhập checklist, thứ tự, điều kiện. Ba submit gọi ba endpoint `/annexes/{burial|care|construction}` khác nhau. Sau đó annex vẫn qua bước chuyển chờ ký, tải scan và kích hoạt riêng. Không đồng nhất “đã tạo draft annex” với “đã nhận việc ở hiện trường”.

**Chuỗi UI:** + Phụ Lục An Táng; + Phụ Lục Chăm Sóc; + Phụ Lục Thi Công; Thêm hạng mục; Tạo Dự Thảo Phụ Lục; Xác Nhận Kích Hoạt Phụ Lục.  
**File/hàm:** [ContractModule.tsx#L668](../web/src/components/contracts/ContractModule.tsx#L668), [ContractModule.tsx#L708](../web/src/components/contracts/ContractModule.tsx#L708), [ContractModule.tsx#L794](../web/src/components/contracts/ContractModule.tsx#L794), [ContractModule.tsx#L819](../web/src/components/contracts/ContractModule.tsx#L819), [ContractModule.tsx#L856](../web/src/components/contracts/ContractModule.tsx#L856), [ContractModule.tsx#L889](../web/src/components/contracts/ContractModule.tsx#L889), [contracts/router.py#L291](../backend/app/modules/contracts/router.py#L291), [contracts/router.py#L314](../backend/app/modules/contracts/router.py#L314), [contracts/router.py#L333](../backend/app/modules/contracts/router.py#L333).

### UI-05.6 — “+ Thêm Khách Hàng Nhanh”

**Luồng code:** modal con trong wizard dùng lại Customer form để người làm hợp đồng không rời quy trình. `handleQuickCreateCustomer()` POST `/profiles/customers`; khi thành công chọn customer mới vào state wizard. Đây vẫn là thao tác tạo hồ sơ khách hàng, nên phải có `customers:write` backend; không được xem nó như quyền ngầm có được chỉ vì actor được vào contracts.

**File/hàm:** [ContractModule.tsx#L746](../web/src/components/contracts/ContractModule.tsx#L746), [ContractModule.tsx#L2126](../web/src/components/contracts/ContractModule.tsx#L2126), [profiles/router.py#L51](../backend/app/modules/profiles/router.py#L51).

## UI-06 — “Thi Công Thực Địa” / ConstructionModule

### UI-06.1 — Danh sách lệnh và “Lập Lệnh Thi Công”

**Từ khóa:** lệnh thi công; tìm mã ô/giám sát/số lệnh; Lọc trạng thái; hạn hoàn thành; Lập Lệnh Thi Công; work-bases; phụ lục.

**Luồng code:** component tải GET `/construction/orders`, danh sách nhân viên `/auth/staff` và danh sách căn cứ `GET /contracts/work-bases?status=ACTIVE`. Chọn căn cứ đưa dữ liệu phụ lục cần thi công vào form. `handleCreateOrder()` gửi POST `/construction/orders`; router yêu cầu `construction:write`; service xác minh annex đang active và loại phù hợp, dựng ConstructionOrder cùng checklist tasks từ căn cứ/mẫu nhập. Bộ lọc/sort ảnh hưởng danh sách hiển thị, không sửa tình trạng hợp đồng.

**File/hàm:** [ConstructionModule.tsx#L114](../web/src/components/construction/ConstructionModule.tsx#L114), [ConstructionModule.tsx#L157](../web/src/components/construction/ConstructionModule.tsx#L157), [ConstructionModule.tsx#L198](../web/src/components/construction/ConstructionModule.tsx#L198), [ConstructionModule.tsx#L206](../web/src/components/construction/ConstructionModule.tsx#L206), [ConstructionModule.tsx#L804](../web/src/components/construction/ConstructionModule.tsx#L804), [construction/router.py#L105](../backend/app/modules/construction/router.py#L105), [construction/router.py#L140](../backend/app/modules/construction/router.py#L140), [construction/service.py#L320](../backend/app/modules/construction/service.py#L320) `create_order`.

### UI-06.2 — Chi tiết lệnh, phân công và “Đăng Ký Lịch Bận”

**Luồng code:** chọn lệnh tải GET `/construction/orders/{id}`; phân công giám sát/assignee nằm trong cập nhật lệnh/task; danh sách staff từ `/auth/staff`. Trước khi tạo lệnh, frontend hỏi `/construction/staff-conflict-check` cho khoảng ngày được chọn. Quản lý lịch bận mở “Đăng Ký Lịch Bận” và POST `/construction/unavailability`; xóa lịch dùng DELETE cùng resource và confirm. Service kiểm ngày, nhân viên và xung đột đã được biểu diễn; kiểm tra lịch nghỉ không nên được mô tả thành bộ lập lịch toàn cục nếu chưa có bằng chứng.

**File/hàm:** [ConstructionModule.tsx#L135](../web/src/components/construction/ConstructionModule.tsx#L135), [ConstructionModule.tsx#L170](../web/src/components/construction/ConstructionModule.tsx#L170), [ConstructionModule.tsx#L484](../web/src/components/construction/ConstructionModule.tsx#L484), [ConstructionModule.tsx#L513](../web/src/components/construction/ConstructionModule.tsx#L513), [construction/router.py#L36](../backend/app/modules/construction/router.py#L36), [construction/router.py#L49](../backend/app/modules/construction/router.py#L49), [construction/service.py#L223](../backend/app/modules/construction/service.py#L223) `check_staff_conflict`.

### UI-06.3 — Checklist: “Đính kèm ảnh”, “Hoàn Tất”, “Nghiệm Thu Toàn Bộ Công Trình”

**Luồng code:** thao tác hoàn tất một task gọi POST `/construction/tasks/{id}/complete`; upload ảnh trước tiên POST `/documents/upload`, sau đó POST `/construction/tasks/{id}/evidences` gắn file; xóa ảnh có endpoint delete riêng; đổi thứ tự checklist POST `/orders/{id}/reorder-tasks`. Nghiệm thu order gọi POST `/orders/{id}/complete`. Backend kiểm task bắt buộc và evidence đã READY trước khi cho đóng; tính tiến độ ở service. Không dùng nút hoàn tất task như lệnh đóng toàn lệnh.

**File/hàm:** [ConstructionModule.tsx#L281](../web/src/components/construction/ConstructionModule.tsx#L281), [ConstructionModule.tsx#L357](../web/src/components/construction/ConstructionModule.tsx#L357), [ConstructionModule.tsx#L417](../web/src/components/construction/ConstructionModule.tsx#L417), [ConstructionModule.tsx#L452](../web/src/components/construction/ConstructionModule.tsx#L452), [construction/router.py#L239](../backend/app/modules/construction/router.py#L239), [construction/router.py#L261](../backend/app/modules/construction/router.py#L261), [construction/router.py#L282](../backend/app/modules/construction/router.py#L282), [construction/service.py#L758](../backend/app/modules/construction/service.py#L758) `complete_task`.

## UI-07 — “Chăm Sóc Mộ Phần” / CareModule

### UI-07.1 — Danh sách ca, lọc và “Sinh Lịch Kỳ Mới”

**Từ khóa:** Kỳ; YYYY-Mmm; Tìm mã mộ, khu, nhân viên; trạng thái; Sắp xếp; Sinh Lịch Kỳ Mới; Sinh Lịch Chăm Sóc Định Kỳ.

**Luồng code:** `fetchSchedules()` tạo query từ status/period rồi GET `/care/schedules`; nút kỳ mới mở form năm/tháng, `handleGeneratePeriod()` POST `/care/schedules/generate`. CareService chọn phụ lục chăm sóc active, tạo lịch/checklist cho kỳ, bỏ qua kỳ đã tồn tại để request chạy lại không nhân đôi. Response hiện số ca tạo/bỏ qua, đổi period filter và tải lại. Việc generate kỳ là điều phối viên theo quyền `care:write` ở route, không phải bất cứ ai xem danh sách cũng nên nhìn thấy nút.

**File/hàm:** [CareModule.tsx#L97](../web/src/components/care/CareModule.tsx#L97), [CareModule.tsx#L160](../web/src/components/care/CareModule.tsx#L160), [CareModule.tsx#L537](../web/src/components/care/CareModule.tsx#L537), [care/router.py#L30](../backend/app/modules/care/router.py#L30), [care/router.py#L111](../backend/app/modules/care/router.py#L111), [care/service.py#L67](../backend/app/modules/care/service.py#L67) `generate_schedules_for_period`.

### UI-07.2 — Mở ca, “Phân công nhân viên”, dẫn đường

**Luồng code:** click một ca gọi `openScheduleDetail(id)` → GET `/care/schedules/{id}`; chọn người từ `/auth/staff`; submit gọi POST `/schedules/{id}/assign`. Backend kiểm ca chưa đóng, user active có role CARETAKER/ADMIN, kiểm bảng nhân viên nghỉ/bận; xung đột trả 409. Panel chi tiết có nút vị trí lấy `plot_id`/mã ô và render PlotDirectionsButton; đây là shortcut từ ca đến tọa độ và Google Maps.

**File/hàm:** [CareModule.tsx#L127](../web/src/components/care/CareModule.tsx#L127), [CareModule.tsx#L135](../web/src/components/care/CareModule.tsx#L135), [CareModule.tsx#L194](../web/src/components/care/CareModule.tsx#L194), [care/router.py#L88](../backend/app/modules/care/router.py#L88), [care/router.py#L168](../backend/app/modules/care/router.py#L168), [care/service.py#L198](../backend/app/modules/care/service.py#L198) `assign_caretaker`, [PlotDirectionsButton.tsx#L20](../web/src/components/plots/PlotDirectionsButton.tsx#L20).

### UI-07.3 — Checklist chuẩn và “Thêm việc phát sinh ngoài thực địa”

**Từ khóa:** Danh mục công việc (Checklist); Thêm việc phát sinh ngoài thực địa; Nhập mô tả việc phát sinh; Xác Nhận Xóa Công Việc Phát Sinh; is_custom; không xóa việc theo phụ lục.

**Luồng code:** tick task gọi PATCH `/care/checklist-items/{item_id}`; service cập nhật completion, cấm sửa ca CLOSED và tự chuyển SCHEDULED thành IN_PROGRESS khi có thao tác đầu tiên. Form thêm đầu việc gọi POST `/care/schedules/{id}/checklist-items`; service trim mô tả, đánh dấu `is_custom=True`, thêm sort_order và không cho thêm nếu ca đã đóng/hủy. Xóa mở hộp confirm rồi DELETE cùng collection; frontend và service đều từ chối xóa item chuẩn (`is_custom=False`) lấy từ phụ lục khách hàng. Migration 0014 bổ sung cột boolean mặc định false cho dữ liệu cũ để giữ đúng phân biệt.

**File/hàm:** [CareModule.tsx#L225](../web/src/components/care/CareModule.tsx#L225), [CareModule.tsx#L261](../web/src/components/care/CareModule.tsx#L261), [CareModule.tsx#L302](../web/src/components/care/CareModule.tsx#L302), [CareModule.tsx#L1751](../web/src/components/care/CareModule.tsx#L1751), [care/router.py#L188](../backend/app/modules/care/router.py#L188), [care/router.py#L210](../backend/app/modules/care/router.py#L210), [care/router.py#L232](../backend/app/modules/care/router.py#L232), [care/service.py#L274](../backend/app/modules/care/service.py#L274), [care/service.py#L313](../backend/app/modules/care/service.py#L313), [0014_add_care_checklist_is_custom.py#L1](../backend/alembic/versions/0014_add_care_checklist_is_custom.py#L1).

### UI-07.4 — “Đính Kèm Ảnh Hiện Trường”, “Xác nhận & Đóng ca chăm sóc”

**Luồng code:** form ảnh nhận file/caption, POST `/documents/upload`, lấy `file_id`, sau đó POST `/care/schedules/{id}/evidence`; delete ảnh chỉ được cho phép theo route/service khi ca còn mở và permission phù hợp. Form nghiệm thu gọi POST `/schedules/{id}/close` với ghi chú. Service kiểm tra đủ task bắt buộc và có ảnh READY trước khi CLOSED, gán người/thời điểm hoàn tất, audit và outbox. Các dòng giải thích điều kiện ở hộp thoại là hướng dẫn thao tác; chốt chặn thực tế nằm ở server.

**File/hàm:** [CareModule.tsx#L343](../web/src/components/care/CareModule.tsx#L343), [CareModule.tsx#L394](../web/src/components/care/CareModule.tsx#L394), [CareModule.tsx#L2120](../web/src/components/care/CareModule.tsx#L2120), [CareModule.tsx#L2270](../web/src/components/care/CareModule.tsx#L2270), [care/router.py#L254](../backend/app/modules/care/router.py#L254), [care/router.py#L287](../backend/app/modules/care/router.py#L287), [care/router.py#L307](../backend/app/modules/care/router.py#L307), [care/service.py#L409](../backend/app/modules/care/service.py#L409).

### UI-07.5 — Tab “Công việc được bàn giao” / WorkBasisView

**Từ khóa:** Công việc được bàn giao; Lịch Chăm Sóc Thực Địa; Xác Nhận Hạ Huyệt; phụ lục an táng/chăm sóc/thi công; mã ô mộ; hạn công việc; WorkBasis; EX-01.

**Hiển thị:** tab nằm trong Chăm Sóc Mộ Phần; CareModule chỉ được mount khi App thấy `care:execute`. `GET /contracts/work-bases` lại yêu cầu `plots:read`, sau đó router chỉ cho role CARETAKER, ADMIN, MARKETING. Nếu actor có care:execute nhưng thiếu plots:read thì tab sẽ hiện nhưng tải danh sách bị 403. Phần code comment gọi schema là EX-01/WorkBasis; nhãn người dùng nhìn thấy chỉ là “Công việc được bàn giao”, không cần biết mã kỹ thuật.

**Luồng code:** WorkBasisView gọi GET `/api/v1/contracts/work-bases`; router/service gom các phụ lục đang ACTIVE hoặc PENDING_ACTIVATION và chuyển thành DTO tối thiểu gồm loại việc, mã hợp đồng/phụ lục, khách hàng liên quan, người mất, khu/ô/slot, ngày hẹn và tóm tắt dịch vụ. Router kiểm role thêm sau permission; response không lấy CCCD, địa chỉ, giá/công nợ hoặc scan hợp đồng. Mỗi dòng có PlotDirectionsButton để mở vị trí. Chỉ nút “Xác Nhận Hạ Huyệt” xuất hiện khi có `plots:confirm_burial`, annex là BURIAL, đang ACTIVE và chưa xác nhận. Submit upload ảnh chứng minh (nếu có) rồi POST `/contracts/annexes/{annex_id}/confirm-burial`; service xác minh giấy báo tử/slot/plot/scan và các bất biến trước khi đánh dấu ô/slot đã an táng, audit và khóa Kim Tĩnh khi phù hợp.

**File/hàm:** [CareModule.tsx#L622](../web/src/components/care/CareModule.tsx#L622), [CareModule.tsx#L643](../web/src/components/care/CareModule.tsx#L643), [CareModule.tsx#L667](../web/src/components/care/CareModule.tsx#L667), [WorkBasisView.tsx#L103](../web/src/components/contracts/WorkBasisView.tsx#L103), [WorkBasisView.tsx#L137](../web/src/components/contracts/WorkBasisView.tsx#L137), [WorkBasisView.tsx#L481](../web/src/components/contracts/WorkBasisView.tsx#L481), [WorkBasisView.tsx#L693](../web/src/components/contracts/WorkBasisView.tsx#L693), [contracts/router.py#L167](../backend/app/modules/contracts/router.py#L167), [contracts/service.py#L1480](../backend/app/modules/contracts/service.py#L1480), [contracts/router.py#L387](../backend/app/modules/contracts/router.py#L387), [contracts/service.py#L1331](../backend/app/modules/contracts/service.py#L1331).

## UI-08 — “Công Nợ & Thu Tiền” / FinanceModule

### UI-08.1 — Tabs “Khoản thu theo hợp đồng” và “Công nợ & thanh toán”

**Từ khóa:** Căn cứ thu tiền; khoản thu theo hợp đồng; sổ cái; công nợ; tìm theo mã HĐ/tên người nộp/SĐT/mã ô; trạng thái nợ.

**Luồng code:** tab đầu mount `FinanceBasisView`, gọi GET `/finance/bases` để hiển thị nguồn hợp đồng/phụ lục, người nộp, hạn/số dư và nút chọn khoản. Khi chọn, parent đưa contract/annex code vào ô tìm kiếm, xóa filter status và đổi tab sang `ledger`. Tab ledger tải summary và danh sách receivables qua hai GET API; bảng lọc trạng thái/sắp xếp ở component. “Căn cứ thu” đọc theo nguồn nghiệp vụ, còn ledger là các nghĩa vụ phải thu/payment đã ghi.

**File/hàm:** [FinanceModule.tsx#L95](../web/src/components/finance/FinanceModule.tsx#L95), [FinanceModule.tsx#L548](../web/src/components/finance/FinanceModule.tsx#L548), [FinanceModule.tsx#L569](../web/src/components/finance/FinanceModule.tsx#L569), [FinanceBasisView.tsx#L77](../web/src/components/finance/FinanceBasisView.tsx#L77), [finance/router.py#L98](../backend/app/modules/finance/router.py#L98), [finance/service.py#L942](../backend/app/modules/finance/service.py#L942).

### UI-08.2 — “Ghi nhận thanh toán”

**Luồng code:** chọn một khoản thu mở modal payment với số tiền, phương thức, mã giao dịch/ghi chú. `handleSubmitPayment()` POST `/finance/receivables/{id}/payments`; router bắt buộc finance write/collect; FinanceService chuyển số nhập sang Decimal, khóa khoản phải thu, kiểm tra số đã thu/số còn lại/trạng thái, idempotency key; tạo Payment và Invoice/receipt. Sau thành công refresh list/KPI và hiển thị chứng từ. Không tin tổng tiền do browser gửi thay cho tính toán server.

**Từ khóa UI:** Ghi nhận thanh toán; Chuyển khoản ngân hàng; Tiền mặt tại quầy; VietQR; Mã biên lai; Tải biên lai PDF.  
**File/hàm:** [FinanceModule.tsx#L140](../web/src/components/finance/FinanceModule.tsx#L140), [FinanceModule.tsx#L150](../web/src/components/finance/FinanceModule.tsx#L150), [FinanceModule.tsx#L1203](../web/src/components/finance/FinanceModule.tsx#L1203), [finance/router.py#L118](../backend/app/modules/finance/router.py#L118) → [finance/service.py#L489](../backend/app/modules/finance/service.py#L489) `record_payment`.

### UI-08.3 — “Áp Dụng Chiết Khấu Cho Khoản Này” / sửa mức giảm

**Luồng code:** nút chỉ nên hiện khi UI permission `finance:discount`; form chọn phần trăm hay số tiền, nhập giá trị/lý do; submit POST `/finance/receivables/{id}/discount`. Backend khóa khoản thu và kiểm chưa tất toán, tính bằng Decimal + ROUND_HALF_UP, cập nhật phải thu cuối cùng, lưu lý do/approved_by, audit/outbox. UI xem preview số giảm/số còn phải nộp, nhưng đây không phải quy trình duyệt hai người độc lập.

**File/hàm:** [FinanceModule.tsx#L210](../web/src/components/finance/FinanceModule.tsx#L210), [FinanceModule.tsx#L226](../web/src/components/finance/FinanceModule.tsx#L226), [FinanceModule.tsx#L259](../web/src/components/finance/FinanceModule.tsx#L259), [FinanceModule.tsx#L1536](../web/src/components/finance/FinanceModule.tsx#L1536), [finance/router.py#L103](../backend/app/modules/finance/router.py#L103) → [finance/service.py#L348](../backend/app/modules/finance/service.py#L348) `apply_discount`.

### UI-08.4 — Xem biên lai, “Tải PDF” và “Tạo lại biên lai”

**Luồng code:** download GET `/finance/payments/{payment_id}/receipt/download` lấy file PDF; nếu Invoice chưa có PDF thì `handleRegenerateInvoice()` POST `/regenerate-invoice` tạo lại thông qua PDF/job/storage path. Thanh toán đã commit không bị rollback vì lỗi render PDF; UI hiển thị trường hợp tiền đã ghi nhưng tệp chứng từ chờ tạo, cho phép thử lại. Tên Invoice trong ORM không tự khẳng định đây là hóa đơn thuế điện tử tích hợp cơ quan thuế.

**File/hàm:** [FinanceModule.tsx#L284](../web/src/components/finance/FinanceModule.tsx#L284), [FinanceModule.tsx#L309](../web/src/components/finance/FinanceModule.tsx#L309), [finance/router.py#L141](../backend/app/modules/finance/router.py#L141), [finance/router.py#L198](../backend/app/modules/finance/router.py#L198), [finance/service.py#L840](../backend/app/modules/finance/service.py#L840), [pdf_service.py#L221](../backend/app/services/pdf_service.py#L221).

## UI-09 — “Bảng Giá & Gói Dịch Vụ” / CatalogModule

**Quyền hiển thị:** App hiện gate cả menu/module bằng `catalog:manage`. Backend GET cho bảng giá/gói/lookup/template dùng `catalog:read`; mọi mutation dùng `catalog:manage`. Vì vậy UI hiện không mở chế độ chỉ đọc riêng cho actor chỉ có catalog:read.

### UI-09.1 — Tab “1. Bảng Giá & Khoản Mục” → “Các Bảng Giá” → “Tạo Mới”

**Tên chính xác theo ví dụ tra cứu:** trang “Các Bảng Giá” → nút “Tạo Mới” → modal “Tạo Bảng Giá Dịch Vụ Mới” → form tên bảng, ngày bắt đầu/kết thúc, trạng thái/kết thúc bảng trước → nút “Tạo Bảng Giá”.  
**Từ khóa:** Bảng Giá & Khoản Mục; Các Bảng Giá; Tạo Mới; Tạo Bảng Giá Dịch Vụ Mới; Tạo Bảng Giá; effective_from_date; effective_to_date; auto-close previous.

**Luồng code:** click nút reset state các trường form rồi set `activeModal='new_price_list'`. Submit `handleCreatePriceList()` POST `/api/v1/catalog/price-lists`. Router yêu cầu `catalog:manage`, nhận schema PriceListCreate; service kiểm tra khoảng hiệu lực active có giao nhau với bảng khác (G03), tạo PriceList; option tự đóng bảng trước gọi command đóng phù hợp. Response được thêm bằng `loadAllData()` và thông báo thành công. Đây là ví dụ một nút mở dialog rồi dialog có lệnh POST.

**File/hàm:** [CatalogModule.tsx#L149](../web/src/components/catalog/CatalogModule.tsx#L149) tải danh mục, [CatalogModule.tsx#L220](../web/src/components/catalog/CatalogModule.tsx#L220) submit, [CatalogModule.tsx#L922](../web/src/components/catalog/CatalogModule.tsx#L922) heading, [CatalogModule.tsx#L936](../web/src/components/catalog/CatalogModule.tsx#L936) mở modal, [CatalogModule.tsx#L953](../web/src/components/catalog/CatalogModule.tsx#L953) nhãn nút “Tạo Mới”, [CatalogModule.tsx#L1921](../web/src/components/catalog/CatalogModule.tsx#L1921) tiêu đề modal, [CatalogModule.tsx#L1988](../web/src/components/catalog/CatalogModule.tsx#L1988) nút submit; [catalog/router.py#L63](../backend/app/modules/catalog/router.py#L63) → [catalog/service.py#L59](../backend/app/modules/catalog/service.py#L59) kiểm tra giao ngày → [catalog/service.py#L115](../backend/app/modules/catalog/service.py#L115) tạo bảng giá.

### UI-09.2 — “Sửa Bảng Giá”, “Đóng Hiệu Lực”, “Sao Chép”, xóa bảng

**Luồng code:** mỗi action trên card hoặc bảng đang chọn đặt đối tượng vào state rồi mở modal/confirm riêng. PUT `/price-lists/{id}` cập nhật; POST `/{id}/close` đặt hạn hoặc đóng vô thời hạn; POST `/{id}/clone` sao chép header và toàn bộ items sang bảng mới; DELETE xóa khi service cho phép. Router áp catalog:manage cho từng mutation. Sau response, component tải lại dữ liệu để chi tiết và danh sách không dùng cache cũ.

**Từ khóa:** Chỉnh Sửa Bảng Giá; Xác Nhận Đóng; Đóng Hiệu Lực Bảng Giá; Sao Chép Bảng Giá; Sao Chép & Tạo Mới; Xóa bảng giá.  
**File/hàm:** [CatalogModule.tsx#L261](../web/src/components/catalog/CatalogModule.tsx#L261), [CatalogModule.tsx#L297](../web/src/components/catalog/CatalogModule.tsx#L297), [CatalogModule.tsx#L334](../web/src/components/catalog/CatalogModule.tsx#L334), [CatalogModule.tsx#L366](../web/src/components/catalog/CatalogModule.tsx#L366), [catalog/router.py#L78](../backend/app/modules/catalog/router.py#L78), [catalog/router.py#L93](../backend/app/modules/catalog/router.py#L93), [catalog/router.py#L108](../backend/app/modules/catalog/router.py#L108), [catalog/router.py#L124](../backend/app/modules/catalog/router.py#L124).

### UI-09.3 — “+ Khoản Mục Mới”, sửa và xóa khoản mục

**Luồng code:** chọn bảng giá trước; “+ Khoản Mục Mới” mở modal với mã/tên/đơn giá/đơn vị/phạm vi (khu, loại mộ, gói, mã dịch vụ). Submit POST `/catalog/price-items`; edit dùng PUT theo item id; delete dùng DELETE sau confirm. `CatalogService` chuyển tiền sang Decimal, gắn scope và ngăn thiếu/không hợp lệ theo schema/service. `lookup_price()` chọn mức giá theo scope/ngày; hợp đồng snapshot kết quả tại lúc phát sinh.

**Từ khóa:** Khoản Mục Mới; Thêm Khoản Mục Giá Mới; Lưu Khoản Mục; Mã dịch vụ gắn kết; đơn giá; Tìm kiếm khoản mục theo mã/tên.  
**File/hàm:** [CatalogModule.tsx#L396](../web/src/components/catalog/CatalogModule.tsx#L396), [CatalogModule.tsx#L439](../web/src/components/catalog/CatalogModule.tsx#L439), [CatalogModule.tsx#L468](../web/src/components/catalog/CatalogModule.tsx#L468), [CatalogModule.tsx#L1163](../web/src/components/catalog/CatalogModule.tsx#L1163), [catalog/router.py#L141](../backend/app/modules/catalog/router.py#L141), [catalog/router.py#L156](../backend/app/modules/catalog/router.py#L156), [catalog/router.py#L171](../backend/app/modules/catalog/router.py#L171), [catalog/service.py#L263](../backend/app/modules/catalog/service.py#L263), [catalog/service.py#L349](../backend/app/modules/catalog/service.py#L349).

### UI-09.4 — Tab “2. Gói Chăm Sóc Định Kỳ”

**Từ khóa:** Thêm Gói Mới; Thêm Gói Chăm Sóc Định Kỳ Mới; Sửa; Đang kích hoạt gói; cycle_type; danh sách công việc; đơn giá; xóa gói.

**Luồng code:** create modal lấy package code/name, chu kỳ, giá, checklist template; submit POST `/catalog/care-packages`. Sửa PUT cùng collection item; bật/tắt active cũng là update; xóa DELETE nhưng service chặn nếu package đã liên kết CareAnnex hoặc CareSchedule, và đề nghị ngừng active để bảo toàn lịch sử. `CareService.generate_schedules_for_period()` lấy checklist mẫu làm bản sao cho lịch mới, nên sửa package hiện tại không viết lại ca đã sinh.

**File/hàm:** [CatalogModule.tsx#L497](../web/src/components/catalog/CatalogModule.tsx#L497), [CatalogModule.tsx#L517](../web/src/components/catalog/CatalogModule.tsx#L517), [CatalogModule.tsx#L566](../web/src/components/catalog/CatalogModule.tsx#L566), [CatalogModule.tsx#L597](../web/src/components/catalog/CatalogModule.tsx#L597), [CatalogModule.tsx#L1375](../web/src/components/catalog/CatalogModule.tsx#L1375), [CatalogModule.tsx#L2325](../web/src/components/catalog/CatalogModule.tsx#L2325), [catalog/router.py#L233](../backend/app/modules/catalog/router.py#L233), [catalog/service.py#L470](../backend/app/modules/catalog/service.py#L470), [catalog/service.py#L515](../backend/app/modules/catalog/service.py#L515).

### UI-09.5 — Tab “3. Mẫu Hợp Đồng 4 Loại” và “4. Tra Cứu Giá Tức Thời”

**Luồng code:** danh sách mẫu tải GET `/catalog/contract-templates`; “Xem Điều Khoản” mở dialog xem nội dung. “Nâng Phiên Bản (Bump)” hiện dùng prompt trình duyệt để nhập content rồi PUT `/contract-templates/{id}`; service tăng version không hồi tố. Backend có POST tạo template nhưng UI hiện tại chưa thấy form tạo mới mẫu. Tab giá mô phỏng nhận ngày/scope rồi POST `/catalog/lookup-price`, service chọn item active khớp phạm vi ưu tiên và ngày hiệu lực; kết quả chỉ là tra cứu, không tạo hợp đồng/khoản thu.

**Tên UI:** Mẫu Hợp Đồng 4 Loại; Xem Điều Khoản; Nâng Phiên Bản (Bump); Công Cụ Mô Phỏng Tra Cứu Đơn Giá Tức Thời; Ngày áp dụng định giá; Tra Cứu Bảng Giá.  
**File/hàm:** [CatalogModule.tsx#L626](../web/src/components/catalog/CatalogModule.tsx#L626), [CatalogModule.tsx#L1675](../web/src/components/catalog/CatalogModule.tsx#L1675), [CatalogModule.tsx#L1747](../web/src/components/catalog/CatalogModule.tsx#L1747), [CatalogModule.tsx#L1838](../web/src/components/catalog/CatalogModule.tsx#L1838), [CatalogModule.tsx#L193](../web/src/components/catalog/CatalogModule.tsx#L193), [catalog/router.py#L188](../backend/app/modules/catalog/router.py#L188), [catalog/router.py#L308](../backend/app/modules/catalog/router.py#L308), [catalog/service.py#L349](../backend/app/modules/catalog/service.py#L349), [catalog/service.py#L614](../backend/app/modules/catalog/service.py#L614).

## UI-10 — “Báo Cáo Thống Kê” / ReportsModule

**Hiển thị:** App vào module nếu có `reports:read` hoặc `reports:revenue`; ReportsModule chỉ mở tab doanh thu cho actor chỉ có capability doanh thu. Các report khác phụ thuộc check capability backend, không tự cấp do tabs tồn tại.

### UI-10.1 — Tabs báo cáo và khoảng ngày

**Tên UI:** Doanh Thu Thực Thu; Tỷ Lệ Lấp Đầy & Mộ Phần; Hợp Đồng & Phụ Lục; Vận Hành: Thi Công & Chăm Sóc; Từ; Đến; Làm Mới.  
**Luồng code:** đổi tab đổi `activeTab`; `fetchReport()` dựng query ngày và GET `/api/v1/reports/{activeTab}`. Router yêu cầu quyền nền và `ReportService.check_report_capability()` kiểm loại báo cáo; service tính doanh thu từ Payment, lấp đầy từ Plot/Slot, hợp đồng từ Contract/Annex, vận hành từ Construction/Care. Bộ lọc date chỉ tác động request của report đang chọn.

**File/hàm:** [ReportsModule.tsx#L28](../web/src/components/reports/ReportsModule.tsx#L28), [ReportsModule.tsx#L121](../web/src/components/reports/ReportsModule.tsx#L121), [ReportsModule.tsx#L377](../web/src/components/reports/ReportsModule.tsx#L377), [ReportsModule.tsx#L398](../web/src/components/reports/ReportsModule.tsx#L398), [reports/router.py#L43](../backend/app/modules/reports/router.py#L43), [reports/service.py#L46](../backend/app/modules/reports/service.py#L46), [reports/service.py#L176](../backend/app/modules/reports/service.py#L176), [reports/service.py#L283](../backend/app/modules/reports/service.py#L283), [reports/service.py#L409](../backend/app/modules/reports/service.py#L409).

### UI-10.2 — “Xuất Báo Cáo (PDF / XLSX)”

**Luồng code:** nút chọn report type theo tab active rồi mở export dialog; form chọn định dạng Excel/PDF gọi POST `/reports/export`; service kiểm capability/format, dựng export snapshot, file service lưu kết quả và metadata; UI polling/list export rồi tải `/reports/exports/{id}/download`. Export là job/file riêng với report đang xem; không tính lại quyền chỉ từ việc người dùng nhìn thấy nút.

**Từ khóa:** Xuất Báo Cáo (PDF / XLSX); Excel (.XLSX); Adobe PDF (.PDF); Tải Tệp Ngay; Đang tạo tệp.  
**File/hàm:** [ReportsModule.tsx#L164](../web/src/components/reports/ReportsModule.tsx#L164), [ReportsModule.tsx#L251](../web/src/components/reports/ReportsModule.tsx#L251), [ReportsModule.tsx#L1245](../web/src/components/reports/ReportsModule.tsx#L1245), [reports/router.py#L157](../backend/app/modules/reports/router.py#L157), [reports/router.py#L180](../backend/app/modules/reports/router.py#L180), [reports/router.py#L197](../backend/app/modules/reports/router.py#L197), [reports/service.py#L543](../backend/app/modules/reports/service.py#L543).

## UI-11 — “Quản Trị Người Dùng” / UserManagementModule

### UI-11.1 — “Danh Sách Tài Khoản”, search/lọc và tạo người dùng

**Từ khóa:** Quản Trị Người Dùng & Phân Quyền (RBAC); Thêm Tài Khoản Mới; username; vai trò; trạng thái; ACTIVE/LOCKED; chọn role.

**Luồng code:** `fetchUsersAndRoles()` đồng thời GET `/auth/users` và `/auth/roles`; form tạo POST `/auth/users` với username, password khởi tạo, tên, email/điện thoại, role IDs. Router kiểm `users:write`; service hash password, tạo user, gắn user_roles và không lưu mật khẩu rõ. Sửa account gọi PUT `/auth/users/{id}`; toggle active cũng cập nhật account để vô hiệu hóa đăng nhập. Reset password gọi endpoint riêng, không hiển thị mật khẩu hiện tại.

**File/hàm:** [UserManagementModule.tsx#L90](../web/src/components/admin/UserManagementModule.tsx#L90), [UserManagementModule.tsx#L128](../web/src/components/admin/UserManagementModule.tsx#L128), [UserManagementModule.tsx#L177](../web/src/components/admin/UserManagementModule.tsx#L177), [UserManagementModule.tsx#L210](../web/src/components/admin/UserManagementModule.tsx#L210), [UserManagementModule.tsx#L250](../web/src/components/admin/UserManagementModule.tsx#L250), [auth/router.py#L148](../backend/app/modules/auth/router.py#L148), [auth/router.py#L178](../backend/app/modules/auth/router.py#L178), [auth/service.py#L271](../backend/app/modules/auth/service.py#L271) `create_user`.

### UI-11.2 — “Ma Trận Phân Quyền Vai Trò”

**Luồng code:** tab đổi từ danh sách users sang render role/permission data đã tải qua GET `/auth/roles`. UI là bảng xem mapping permission của role. Trong source hiện tại không có toggle/save handler để Sếp thay đổi role_permissions; API cũng chỉ đọc roles. Chọn role khi tạo/sửa user là gán người vào vai trò có sẵn, không chỉnh ma trận quyền của vai trò.

**File/hàm:** [UserManagementModule.tsx#L449](../web/src/components/admin/UserManagementModule.tsx#L449), [UserManagementModule.tsx#L471](../web/src/components/admin/UserManagementModule.tsx#L471), [UserManagementModule.tsx#L90](../web/src/components/admin/UserManagementModule.tsx#L90), [auth/router.py#L232](../backend/app/modules/auth/router.py#L232), [auth/service.py#L49](../backend/app/modules/auth/service.py#L49) `get_user_permissions`. Xem đối chiếu use case [UC-8.3](USECASE_CODE_TRACEABILITY.md#uc-83--phân-quyền).

## UI-12 — “Nhật Ký Kiểm Toán” / AuditModule

**Từ khóa:** tổng số sự kiện; hành động nhiều nhất; thực thể nhiều nhất; Bộ lọc; Tất cả thực thể; Tất cả hành vi; Tìm theo mã hồ sơ; Xem Chi Tiết Sự Kiện & Diff; Chi tiết kỹ thuật; JSON thô; narrative_summary.

**Luồng code:** `fetchSummary()` tải summary/entities/actions đồng thời; `fetchLogs()` dựng query filter trang/ngày/user/action/entity/id rồi GET `/audit/logs`. AuditService truy vấn log, chuẩn hóa câu kể người dùng đọc được (`narrative_summary`), tạo nhãn trường và redact trước/sau cho dữ liệu nhạy cảm. Click sự kiện mở dialog chi tiết gồm actor/thời điểm/hành động/đối tượng, diff đã định dạng; phần “Chi tiết kỹ thuật dành cho Kỹ thuật viên / IT (JSON thô)” là phần mở rộng tùy chọn. Endpoint chỉ đọc, không cung cấp sửa/xóa log. Công cụ phân tích source không xác nhận mọi service ghi đủ before/after; cần lần `AuditLog` ở từng lệnh ghi.

**File/hàm:** [AuditModule.tsx#L60](../web/src/components/audit/AuditModule.tsx#L60), [AuditModule.tsx#L77](../web/src/components/audit/AuditModule.tsx#L77), [AuditModule.tsx#L171](../web/src/components/audit/AuditModule.tsx#L171), [AuditModule.tsx#L229](../web/src/components/audit/AuditModule.tsx#L229), [AuditModule.tsx#L422](../web/src/components/audit/AuditModule.tsx#L422), [AuditModule.tsx#L954](../web/src/components/audit/AuditModule.tsx#L954), [audit/router.py#L16](../backend/app/modules/audit/router.py#L16), [audit/service.py#L101](../backend/app/modules/audit/service.py#L101), [audit/service.py#L318](../backend/app/modules/audit/service.py#L318).

## UI-13 — Component dùng chung tác động tới nhiều màn

### UI-13.1 — Upload/xem/tải tệp và ảnh minh chứng

**Tên/chuỗi UI:** Tải lên; Tải tệp về máy; Xem trực tiếp tệp; Đính Kèm Ảnh Minh Chứng Thực Địa; đóng preview; phiên bản hồ sơ.  
**Luồng code:** các component form dùng `apiFetch('/documents/upload')` multipart để nhận file id; màn nghiệp vụ gọi endpoint link evidence/certificate/contract riêng. `DocumentAttachmentList` tải danh sách, preview, download, gắn version; `DocumentManager` thực hiện thao tác version/link. Backend `DocumentService` kiểm MIME/nội dung, metadata và quyền truy cập đối tượng; MinIO adapter lưu object private; mọi lần tải đi qua router có quyền. Một file đã upload chưa có nghĩa đã gắn vào nghiệp vụ hoặc READY để nghiệm thu.

**File:** [DocumentAttachmentList.tsx#L255](../web/src/components/documents/DocumentAttachmentList.tsx#L255), [DocumentAttachmentList.tsx#L276](../web/src/components/documents/DocumentAttachmentList.tsx#L276), [DocumentAttachmentList.tsx#L420](../web/src/components/documents/DocumentAttachmentList.tsx#L420), [DocumentManager.tsx#L423](../web/src/components/documents/DocumentManager.tsx#L423), [documents/router.py#L55](../backend/app/modules/documents/router.py#L55), [documents/service.py#L52](../backend/app/modules/documents/service.py#L52), [minio_adapter.py](../backend/app/storage/minio_adapter.py).

### UI-13.2 — “Đính Kèm Ảnh Minh Chứng Thực Địa” / gallery

**Luồng code:** từ công việc mở form upload, chọn tệp và caption; `MediaEvidenceGallery` gọi callback phụ thuộc module cha. Module cha upload, link đến task/schedule và cập nhật danh sách. Viewer hỗ trợ mở ảnh, phím trái/phải/Escape, zoom, pan và gesture touch; các thao tác viewer không ghi vào server trừ upload/xóa callback. Yêu cầu ảnh READY để đóng công việc được kiểm tra ở service nghiệp vụ.

**File/hàm:** [MediaEvidenceGallery.tsx#L44](../web/src/components/common/MediaEvidenceGallery.tsx#L44), [MediaEvidenceGallery.tsx#L92](../web/src/components/common/MediaEvidenceGallery.tsx#L92), [MediaEvidenceGallery.tsx#L146](../web/src/components/common/MediaEvidenceGallery.tsx#L146), [MediaEvidenceGallery.tsx#L157](../web/src/components/common/MediaEvidenceGallery.tsx#L157), [MediaEvidenceGallery.tsx#L226](../web/src/components/common/MediaEvidenceGallery.tsx#L226).

### UI-13.3 — Pagination, dialog xác nhận/thông báo và ErrorBoundary

**Luồng code:** `Pagination` nhận current page, total items và callback từ module cha; nút đầu/trước/sau/cuối hoặc jump chỉ thay query/state list. `NotificationModalContext` cung cấp `confirm`, `modalAlert`, notification; thao tác destructive chờ confirm trước request. `ErrorBoundary` bắt lỗi render để tránh crash toàn trang; không thay xử lý lỗi HTTP. Các màn module phải giữ loading/normal/empty/error và nút retry theo AGENTS.md.

**Từ khóa:** Trang đầu; Trang trước; Trang sau; Trang cuối; Đến; Hủy; Xác nhận; Thử lại; Không thể tải dữ liệu.  
**File:** [Pagination.tsx#L132](../web/src/components/common/Pagination.tsx#L132), [Pagination.tsx#L169](../web/src/components/common/Pagination.tsx#L169), [NotificationModalContext.tsx#L26](../web/src/context/NotificationModalContext.tsx#L26), [NotificationModalContext.tsx#L153](../web/src/context/NotificationModalContext.tsx#L153), [ErrorBoundary.tsx#L81](../web/src/components/common/ErrorBoundary.tsx#L81).

## UI-14 — Điểm tra nhanh từ câu hỏi sang tài liệu

| Nếu câu hỏi người dùng nhắc đến | Mở mục này trước | Sau đó lần tiếp xuống |
|---|---|---|
| “Tạo Bảng Giá Dịch Vụ Mới” hoặc nút “Tạo Mới” | UI-09.1 | CatalogModule → handleCreatePriceList → POST /catalog/price-lists → CatalogService.create_price_list |
| “Thêm khoản mục giá” | UI-09.3 | CatalogModule → handleAddPriceItem → catalog router → CatalogService.add_price_item |
| “Thêm/xóa việc phát sinh trong ca chăm sóc” | UI-07.3 | CareModule → handleCreateCustomTask/handleDeleteCustomTask → care router/service → migration 0014 |
| “Không click được mộ / chỉ 4 marker” | UI-03.1–03.3 | SimulatedPlotMap là dữ liệu sinh client; GeographicPlotMap lấy API + lat/long; kiểm records có tọa độ |
| “Tại sao nhận 401/403?” | UI-00 và mục quyền trong USECASE_CODE_TRACEABILITY | so gate App → quyền router → role/permission seed thực tế |
| “Nút của actor xuất hiện dù API từ chối” | UI-00 và mục module tương ứng | xác định gate component đang dùng role hay permission; server vẫn là quyết định cuối |
| “Tại sao bấm tải scan chưa kích hoạt hợp đồng?” | UI-05.4 | upload file → nhận file_id → POST activate → ContractService transition |
| “Đóng ca chăm sóc cần gì?” | UI-07.4 | checklist/ảnh upload → evidence READY → CareService.close_schedule |
| “Tiền đã ghi nhưng PDF chưa có” | UI-08.4 | transaction payment → invoice/job/PDF → regenerate endpoint |

## Bản đồ các file frontend được rà

| Nhóm UI | File nguồn chính |
|---|---|
| App và phiên | `web/src/main.tsx`, `web/src/App.tsx`, `web/src/context/*`, `web/src/services/apiClient.ts`, `web/src/services/authApi.ts` |
| Ô mộ và vị trí | `web/src/components/plots/PlotMapModule.tsx`, `SimulatedPlotMap.tsx`, `GeographicPlotMap.tsx`, `PlotDirectionsButton.tsx`, `plotCoordinates.ts` |
| Khách hàng và public | `web/src/components/profiles/ProfileModule.tsx` |
| Hợp đồng/chứng từ | `web/src/components/contracts/ContractModule.tsx`, `WorkBasisView.tsx`, `web/src/components/documents/*` |
| Thi công/chăm sóc | `web/src/components/construction/ConstructionModule.tsx`, `web/src/components/care/CareModule.tsx`, `web/src/components/common/MediaEvidenceGallery.tsx` |
| Tài chính/danh mục | `web/src/components/finance/FinanceModule.tsx`, `FinanceBasisView.tsx`, `web/src/components/catalog/CatalogModule.tsx` |
| Quản trị/báo cáo/audit | `web/src/components/admin/UserManagementModule.tsx`, `web/src/components/reports/ReportsModule.tsx`, `web/src/components/audit/AuditModule.tsx` |
| Trạng thái chung và responsive | `web/src/components/common/ErrorBoundary.tsx`, `Pagination.tsx`, `web/src/App.css`, `web/src/index.css` |

Để tra đầy đủ 39 use case, actor thiết kế, chênh lệch và ví dụ code backend/web, mở [USECASE_CODE_TRACEABILITY.md](USECASE_CODE_TRACEABILITY.md). Tài liệu này mô tả tên UI thật và đường chạy được khai báo trong component, kể cả khi hiện còn thiếu gate riêng hoặc backend có quyền hẹp hơn giao diện.
