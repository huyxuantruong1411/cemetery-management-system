# Đối chiếu Use Case với luồng code Backend và Web

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
**Khảo sát source:** 20/10/2026
**Phạm vi:** Backend FastAPI và web React/TypeScript trong thư mục backend/ và web/; không bao gồm Flutter/mobile.
**Mục đích:** nối yêu cầu nghiệp vụ với giao diện, API, quyền, service, ORM và kết quả lưu trữ; đồng thời nêu rõ phần chưa có hoặc mới khớp một phần.

## Cách đọc và giới hạn kết luận

Tài liệu phân tích chuẩn có 8 use case cha và 39 use case con ở Mục 9. Tài liệu này ghi cả 47 mã: 8 UC cha được tổng hợp trong bảng phân hệ; 39 UC con được truy vết riêng bên dưới. Một UC cha là nhóm nghiệp vụ, không nhất thiết có endpoint hoặc component riêng.

Thứ tự căn cứ được dùng là: làm rõ trực tiếp của chủ dự án → đặc tả chi tiết trong Markdown/Lab2 → luồng hoạt động → mô hình dữ liệu. Lab1 mô tả bài toán và phạm vi ban đầu. Nếu tên hoặc mã ở Lab1 khác bản hợp nhất, dùng mục ánh xạ ở cuối để tránh hiểu mã cũ thành chức năng mới.

“Có đường code chính” nghĩa là đã tìm thấy giao diện/API/service xử lý phần cốt lõi trong source hiện tại. “Một phần” nghĩa là có code nhưng còn thiếu bước, bộ lọc, quyền hiển thị hoặc phạm vi như tài liệu. “Chưa thấy” nghĩa là chưa tìm thấy đường UI/API riêng cho đúng chức năng được mô tả. Đây là rà soát tĩnh source, không phải nghiệm thu bằng cách đăng nhập mọi tài khoản, thử mọi dữ liệu trong SQL Server hay xác nhận dịch vụ ngoài đang hoạt động. Có code cũng không tự chứng minh dữ liệu thực tế hoặc quyền của từng tài khoản đã được cấu hình đúng.

Vị trí code ghi theo dạng đường dẫn tệp và số dòng, dựa trên source ở ngày khảo sát. Tên hàm là điểm bắt đầu để mở và theo dõi lệnh tiếp theo.

## Sơ đồ đọc luồng thực tế

~~~mermaid
flowchart LR
    A[Actor nội bộ hoặc khách công khai] --> W[Web React: component / form / map]
    W --> C[apiFetch + access token nếu cần]
    C --> R[FastAPI router: URL + Pydantic + permission]
    R -->|thiếu token| U[401]
    R -->|thiếu permission| F[403]
    R --> S[Service: nghiệp vụ + truy vấn SQLAlchemy]
    S --> M[ORM model và SQL Server]
    S --> D[Documents / PDF / MinIO khi có tệp]
    S --> O[Audit log / outbox khi luồng ghi yêu cầu]
    R --> W
~~~

Web thu thập dữ liệu, gọi API, hiển thị kết quả và ẩn/hiện thao tác. Router xác thực request và quyền. Service kiểm tra điều kiện nghiệp vụ rồi thao tác model/session. Nội dung tệp được xử lý qua Documents và MinIO. Source hiện truy vấn SQLAlchemy trực tiếp trong service; không có tầng repository.py riêng dù một số tài liệu kiến trúc mục tiêu có nhắc Repository.

## Quyền actor khai báo trong source

backend/scripts/seed_rbac.py:20-98 định nghĩa bốn role nội bộ và gán permission như sau. Đây là trạng thái mà script sẽ seed nếu được chạy; nó **không chứng minh** role hiện tại trong SQL Server bằng đúng mapping này, vì không truy vấn database trong lần khảo sát này.

| Role source | Quyền được seed | Các giới hạn đáng chú ý |
|---|---|---|
| ADMIN | Toàn bộ permission khai báo; dependency backend còn bypass các permission check cho role ADMIN | ADMIN vẫn phải qua các invariant nghiệp vụ trong service. |
| MARKETING | plots:read; customers:read/write; deceased:read/write; contracts:read/write/activate; catalog:read | Không có finance, care, construction, users, reports hoặc audit trong mapping seed. |
| ACCOUNTANT | finance:read/write/collect/discount; catalog:read; reports:revenue | Không có contracts:read; không có reports:read cho toàn bộ report. |
| CARETAKER | plots:read/lock/confirm_burial; construction:read/write/execute; care:read/write/execute | Không có contracts:read, customers/deceased, finance, catalog/manage, users, reports hoặc audit trong mapping seed. |

**Khoảng trống ánh xạ Actor Sếp:** trong ROLE_CONFIGS chưa có role BOSS/CEO/MANAGER. ADMIN được mô tả là quản trị viên toàn quyền, nhưng không nên tự đồng nhất actor nghiệp vụ “Sếp” với ADMIN. Nếu Sếp không đăng nhập bằng ADMIN thì các use case users:*, catalog:manage, reports đọc tổng quát và audit:read chưa có role seed tương ứng. Cần chốt mapping riêng khi phân quyền; không tự cấp ADMIN cho mọi nhân sự quản lý.

Khách hàng/Thân nhân là actor công khai, không phải role nội bộ. Source có cổng memorial/timeline công khai; không thấy account công khai để lập hợp đồng hoặc ghi nhận thanh toán.

## Bản đồ 8 use case cha

| UC cha | Nghiệp vụ | UC con được truy vết |
|---|---|---|
| UC-1 | Quản lý mộ & bản đồ | UC-1.1 đến UC-1.5 |
| UC-2 | Quản lý khách hàng & người mất | UC-2.1 đến UC-2.4 |
| UC-3 | Quản lý hợp đồng | UC-3.1 đến UC-3.5 |
| UC-4 | Quản lý thi công | UC-4.1 đến UC-4.5 |
| UC-5 | Quản lý chăm sóc | UC-5.1 đến UC-5.4 |
| UC-6 | Quản lý tài chính | UC-6.1 đến UC-6.4 |
| UC-7 | Báo cáo & thống kê | UC-7.1 đến UC-7.5 |
| UC-8 | Quản trị hệ thống | UC-8.1 đến UC-8.7 |

## UC-1 — Quản lý mộ & bản đồ

### UC-1.1 — Quản lý khu/hàng/ô

**Actor thiết kế:** Sếp. **Đánh giá:** Một phần.

**Luồng code:** PlotMapModule tải danh sách khu, hàng, loại mộ, thống kê và các trang ô mộ qua /api/v1/plots/*. Form thêm/sửa gửi mã ô, hàng, loại, vĩ độ/kinh độ đến plots/router.py → PlotService.create_plot() / update_plot() → các model Zone, Row, Plot, PlotSlot. Tạo ô sẽ tự sinh slot theo số slot của loại mộ. GeographicPlotMap.tsx đọc tọa độ để dựng marker và vùng hiển thị trên Leaflet.

**Đối chiếu:** tạo/sửa cấu trúc, lưu tọa độ và hiển thị GIS có đường code. Schema cho phép tọa độ Decimal nhưng chưa thấy validate vị trí nằm trong ranh nghĩa trang; client chỉ kiểm số hữu hạn và phạm vi toàn cầu ở plotCoordinates.ts. Form cũng có giá trị tọa độ mặc định demo, vì vậy cần phân biệt dữ liệu nhập thật và synthetic. UC yêu cầu cây phân cấp và cảnh báo ngoài ranh chưa được xác nhận đầy đủ bằng source.

**Điểm mở source:** web/src/components/plots/PlotMapModule.tsx:150-175, 455-622; web/src/components/plots/GeographicPlotMap.tsx:17-40, 58-100; web/src/components/plots/plotCoordinates.ts:3-6; backend/app/modules/plots/router.py:49-93, 105-150, 218-280; backend/app/modules/plots/service.py:263-351, 428-525; backend/app/modules/plots/schemas.py:136-160.

### UC-1.2 — Quản lý loại mộ & số slot

**Actor thiết kế:** Sếp. **Đánh giá:** Có đường code chính.

**Luồng code:** tab loại mộ trong PlotMapModule gọi GET/POST/PUT/DELETE /api/v1/plots/types. Router bảo vệ thay đổi bằng plots:manage; PlotService CRUD PlotType. Khi tạo ô, PlotService.create_plot() dùng default_slots để sinh slot con trong cùng transaction. Kích thước chiều dài/rộng lưu trong loại mộ và được dùng để vẽ footprint ở mức zoom cao.

**Đối chiếu:** đạt nghiệp vụ cấu hình loại, slot tối đa và kích thước. Trước khi xóa, service kiểm tra quan hệ đang sử dụng; cần xem điều kiện cụ thể trong service nếu được hỏi trường hợp loại đã gắn ô.

**Điểm mở source:** web/src/components/plots/PlotMapModule.tsx:170-173, 535-565; backend/app/modules/plots/router.py:162-206; backend/app/modules/plots/schemas.py:63-88; backend/app/modules/plots/service.py:195-242, 468-476.

### UC-1.3 — Cập nhật trạng thái mộ

**Actor thiết kế:** Quản trang. **Đánh giá:** Một phần; trạng thái đổi qua lệnh nghiệp vụ chứ không sửa tự do.

**Luồng code:** trạng thái ô thay đổi trong các service tương ứng: giữ chỗ ở PlotService.reserve_plot(); kích hoạt mua đất/chuyển quyền ở ContractService; khởi tạo và nghiệm thu lệnh thi công ở ConstructionService; xác nhận an táng ở ContractService.confirm_burial(); cải táng/hủy giao dịch theo command riêng. Giao diện bản đồ hiển thị trạng thái và mở chi tiết.

**Đối chiếu:** đây là mô hình an toàn hơn dropdown đổi bất kỳ trạng thái nào: mỗi trạng thái đến từ sự kiện có điều kiện. Không thấy endpoint chung kiểu “quản trang tự cập nhật status”. Quản trang có command xác nhận an táng với quyền riêng; status pháp lý/kinh doanh khác thuộc luồng hợp đồng và thi công. Quy tắc Kim Tĩnh được khóa ở service sau an táng, nhưng cần kiểm tra từng command khi đánh giá bất biến đầy đủ.

**Điểm mở source:** backend/app/modules/plots/service.py:597-692; backend/app/modules/contracts/service.py:1234-1325, 1653-1800; backend/app/modules/construction/service.py:291-365, 488-560; backend/app/modules/plots/service.py:493-525; UI xác nhận hiện trường: web/src/components/contracts/WorkBasisView.tsx:426.

### UC-1.4 — Tra cứu tình trạng mộ

**Actor thiết kế:** Sếp, Marketing, Quản trang, Khách hàng/Thân nhân. **Đánh giá:** Một phần; có nhiều đường tìm kiếm, chưa phải một màn hình bao trọn mọi tiêu chí.

**Luồng code:** nhân viên tra cứu mã ô/trạng thái/khu trên PlotMapModule → GET /api/v1/plots; service lọc khu, hàng, loại, trạng thái và mã ô. Cổng công khai dùng ProfileModule → GET /api/v1/profiles/public/memorials?q=...; service tìm tên/mã người mất hoặc mã ô/hàng rồi trả về vùng công khai giới hạn. Dòng thời gian ô công khai được tải qua /api/v1/plots/public/{plot_identifier}/timeline.

**Đối chiếu:** khách không cần account cho cổng tra cứu công khai. Tra cứu nội bộ bằng tên khách hàng/thân nhân nằm ở module hồ sơ/quan hệ chứ không phải bộ tìm kiếm map duy nhất. Không đưa CCCD vào tra cứu công khai; spec hợp nhất ưu tiên bảo vệ dữ liệu cá nhân.

**Điểm mở source:** web/src/components/plots/PlotMapModule.tsx:150-202; backend/app/modules/plots/router.py:218-258, 338-348; backend/app/modules/plots/service.py:263-351, 731+; web/src/components/profiles/ProfileModule.tsx:614-651; backend/app/modules/profiles/router.py:32-47; backend/app/modules/profiles/service.py:599-715.

### UC-1.5 — Dẫn đường tới mộ

**Actor thiết kế:** Khách hàng/Thân nhân, Quản trang, dịch vụ bản đồ/GPS. **Đánh giá:** Có đường code chính, phụ thuộc dịch vụ ngoài.

**Luồng code:** nhân viên mở PlotDirectionsButton, component lấy chi tiết ô và tọa độ từ API, vẽ GIS theo nhóm ô trong khu, rồi mở link Google Maps đi bộ tới đích. Cổng công khai tra cứu tưởng niệm trả về maps_url từ tọa độ và giao diện có link mở bản đồ. Leaflet nền phố tải tile trực tiếp từ OpenStreetMap; marker ô mộ lấy lat/long từ API, không suy ra từ vị trí nền.

**Đối chiếu:** thao tác mở dẫn đường đã có. Google Maps/OSM là dịch vụ ngoài và cần mạng; nền OSM không tải được thì GIS có nền dự phòng nhưng định tuyến vẫn phụ thuộc link ngoài. Cần bảo đảm tọa độ dữ liệu demo gắn nhãn và không bị hiểu nhầm là tọa độ nghĩa trang thật.

**Điểm mở source:** web/src/components/plots/PlotDirectionsButton.tsx:20-37, 56-72, 160-195; web/src/components/plots/GeographicPlotMap.tsx:17-40, 58-100; backend/app/modules/profiles/service.py:675-710; web/src/components/profiles/ProfileModule.tsx:2432-2462.

## UC-2 — Quản lý khách hàng & người mất

### UC-2.1 — Quản lý thông tin khách hàng/thân nhân

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Một phần do chênh lệch giữa gate backend và cách ẩn/hiện thao tác trên web.

**Luồng code:** ProfileModule tải khách hàng, chi tiết và quan hệ; tạo/cập nhật gửi /api/v1/profiles/customers và /customers/{id}. Router yêu cầu customers:read hoặc customers:write, sau đó ProfileService kiểm tra dữ liệu, lưu Customer và ghi audit ở các thao tác có hỗ trợ.

**Đối chiếu:** phần CRUD/search có trong source. Tuy nhiên ProfileModule.tsx không dùng hasPermission() để ẩn riêng nút/thao tác ghi; App.tsx chỉ yêu cầu customers:read để vào module. Do đó có thể hiện form/nút cho tài khoản chỉ đọc, rồi backend trả 403. Đây là khác biệt UX/permission, không phải bằng chứng API cho phép ghi.

**Điểm mở source:** web/src/App.tsx:1024; web/src/components/profiles/ProfileModule.tsx:183-229, 353-397; backend/app/modules/profiles/router.py:51-90; backend/app/modules/profiles/service.py:50-143, 164-189.

### UC-2.2 — Quản lý hồ sơ người mất

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Có luồng chính, cần kiểm tra phân quyền giấy báo tử và phần duyệt thực tế.

**Luồng code:** tạo/sửa/tìm hồ sơ đi qua /api/v1/profiles/deceased → ProfileService.create_deceased_profile() / update_deceased_profile(). Tệp giấy báo tử được tải lên Documents/MinIO rồi gắn vào /deceased/{id}/certificate; xác minh đi qua /certificates/{id}/verify. Lúc xác nhận an táng, ContractService.confirm_burial() hỏi lại check_death_certificate_verified(); thiếu giấy hợp lệ thì dừng.

**Đối chiếu:** có chặn quan trọng ở thời điểm an táng, nên nhập hồ sơ chưa đủ để hợp thức hóa sự kiện. API attach/verify giấy hiện dùng customers:write, trong khi tạo/sửa hồ sơ người mất dùng deceased:write; cần đối chiếu ma trận role đang cấp. Web cũng không có gate ghi riêng ở ProfileModule. Quét mã độc như mô tả chỉ được xác nhận nếu tìm thấy triển khai tương ứng trong upload pipeline; không suy ra từ việc có MinIO.

**Điểm mở source:** web/src/components/profiles/ProfileModule.tsx:203-219, 398-505; backend/app/modules/profiles/router.py:96-181; backend/app/modules/profiles/service.py:191-355, 463-580; backend/app/modules/contracts/service.py:1234-1272.

### UC-2.3 — Liên kết khách hàng – người mất – mộ

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Một phần; quan hệ thân nhân và vị trí an táng được biểu diễn qua hai luồng khác nhau.

**Luồng code:** quan hệ khách hàng–người mất được tạo/xóa ở /api/v1/profiles/relations → ProfileService.link_relation() / remove_relation(). Liên kết người mất với ô/huyệt không nằm trên relation đó; nó được tạo khi lập phụ lục an táng qua BurialAnnex/PlotSlot và được hoàn tất khi xác nhận an táng. Màn hình hồ sơ hiển thị quan hệ; màn hình hợp đồng chọn người mất, ô và slot.

**Đối chiếu:** có thể lần được đường ba bên trong dữ liệu nghiệp vụ nhưng không phải form “liên kết ba chiều” nguyên khối. Quan hệ thân nhân tự nó không cấp quyền sử dụng ô hay quyền thực hiện nghiệp vụ. Cần đọc cả hồ sơ, hợp đồng/phụ lục, slot và lịch sử an táng để giải thích.

**Điểm mở source:** web/src/components/profiles/ProfileModule.tsx:223-324; backend/app/modules/profiles/router.py:187-214; backend/app/modules/profiles/service.py:721-778; web/src/components/contracts/ContractModule.tsx:654-724; backend/app/modules/contracts/service.py:595-759, 1234-1325; backend/app/modules/contracts/models.py.

### UC-2.4 — Tra cứu hồ sơ

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Một phần.

**Luồng code:** danh sách khách và người mất có hai truy vấn tìm kiếm riêng; relation cũng có search riêng. Từ ProfileModule, web gửi từ khóa và limit đến /customers, /deceased, /relations; service lọc trên các trường hồ sơ tương ứng.

**Đối chiếu:** tìm theo tên/mã và một số trường liên hệ có đường code. Trong UC, bộ lọc ngày mất và khu mộ được nêu; không thấy một endpoint tìm kiếm tổng hợp hỗ trợ trọn bộ điều kiện đó. Tra cứu người mất công khai chỉ trả trường được phép công khai, không thay thế màn hình nội bộ.

**Điểm mở source:** web/src/components/profiles/ProfileModule.tsx:183-229; backend/app/modules/profiles/router.py:61-76, 114-132, 187-196; backend/app/modules/profiles/service.py:164-189, 414-460, 778-835.

## UC-3 — Quản lý hợp đồng

### UC-3.1 — Lập hợp đồng

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Có đường code chính cho bốn loại giao dịch; quyền hiển thị nút cần rà riêng.

**Luồng code:** ContractModule chọn khách và loại hợp đồng, tải các ô phù hợp, gửi request đến /api/v1/contracts/land-purchase, /exhumation, /transfer hoặc /cremation. contracts/router.py yêu cầu contracts:write; ContractService kiểm tra liên kết hồ sơ, trạng thái ô/slot, giữ chỗ và điều kiện loại giao dịch. Mua đất khóa dòng ô bằng with_for_update(), tạo hợp đồng nháp và reservation; kích hoạt hợp đồng tạo lịch sử sở hữu và khoản phải thu theo nhánh nghiệp vụ.

**Đối chiếu:** source hỗ trợ 4 loại, trong đó TRANSFER không có trong danh sách ba loại ban đầu ở Lab1; bản hợp nhất chọn bốn loại. Quy trình ký là in ngoài hệ thống → scan bản đã ký → kích hoạt, không phải màn hình Sếp duyệt/khách ký số trực tuyến. ContractModule ẩn một số thao tác ghi bằng role hard-code ADMIN/MARKETING (canManage), trong khi backend cho phép dựa trên permission contracts:write/activate. Nếu permission được tùy chỉnh khác seed, giao diện và server có thể không khớp. Tài khoản CARETAKER theo seed không có contracts:read; công việc hiện trường đi qua WorkBasis riêng.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:410-495, 1032-1225; backend/app/modules/contracts/router.py:39-130; backend/app/modules/contracts/service.py:104-295, 299-594, 1653-1800; backend/app/modules/contracts/models.py.

### UC-3.2 — In hợp đồng/phụ lục

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Một phần.

**Luồng code:** nút tải PDF hợp đồng gọi /api/v1/contracts/{id}/pdf; router gọi ContractService.generate_contract_pdf() rồi PDFService dựng nội dung và trả application/pdf. Web tạo blob và tải xuống. Có thêm endpoint tạo PDF mẫu trong Documents.

**Đối chiếu:** bản in hợp đồng chính có đường UI/API. Không thấy nút/route tương ứng để sinh PDF đã điền cho từng phụ lục; phụ lục ký được lưu bằng upload scan riêng. CARETAKER thiếu contracts:read theo mapping seed và API PDF còn chặn role CARETAKER/ACCOUNTANT; hợp đồng đầy đủ không phải tài liệu vận hành dành cho họ. Vì vậy không nên nói “in hợp đồng/phụ lục” đã hoàn tất toàn bộ.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:548-565, 1814-1815; backend/app/modules/contracts/router.py:262-285; backend/app/modules/contracts/service.py:2135-2163; backend/app/services/pdf_service.py; backend/app/modules/documents/router.py:288-315.

### UC-3.3 — Đính kèm hợp đồng/phụ lục đã ký

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Có đường code chính.

**Luồng code:** web upload scan qua Documents, nhận file_id, rồi gọi /contracts/{id}/activate hoặc /contracts/annexes/{id}/activate. Router yêu cầu quyền kích hoạt; service xác nhận file tồn tại/trạng thái phù hợp, ghi file scan lên hợp đồng/phụ lục, chạy nhánh kích hoạt và tạo hiệu ứng nghiệp vụ như đổi owner/trạng thái hoặc khoản phải thu. Upload file đơn thuần chưa tự làm hợp đồng có hiệu lực.

**Đối chiếu:** đúng nguyên tắc “bản scan ký thật mới làm căn cứ kích hoạt”. Khác Lab1 cũ ở chỗ không có online approval/signature. Audit và quyền activate phải được nhìn ở service/role config, không suy ra từ nút upload.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:570-606, 967-1000; backend/app/modules/contracts/router.py:223-245, 352-385; backend/app/modules/contracts/service.py:958-1175, 1653-1732; backend/app/modules/documents/service.py:52-101.

### UC-3.4 — Lập phụ lục hợp đồng

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Có đường code chính cho các loại phụ lục được mô hình hóa; không thấy gia hạn tổng quát riêng.

**Luồng code:** từ chi tiết hợp đồng, Marketing tạo phụ lục an táng, chăm sóc hoặc thi công bằng các endpoint /annexes/burial, /annexes/care, /annexes/construction. Service kiểm tra hợp đồng gốc, loại hợp đồng, trạng thái ACTIVE, ô/huyệt, người mất, package và thời hạn rồi lưu các bảng detail tương ứng. Sau đó người dùng submit ký và kích hoạt qua command riêng.

**Đối chiếu:** các phụ lục nghiệp vụ chính có đường tạo. “Gia hạn” không thấy thành một loại/command riêng thống nhất; một số trường hợp có thể nhập thời hạn mới trên phụ lục dịch vụ. Nút tạo/submit ký phụ lục được ẩn bằng role ADMIN/MARKETING trong ContractModule, còn API dùng contracts:write; cần giữ hai cấu hình đồng bộ. Cần đối chiếu điều khoản cần gia hạn với đúng loại phụ lục, không gọi mọi loại là renewal.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:668-909, 932-1000; backend/app/modules/contracts/router.py:291-385; backend/app/modules/contracts/service.py:595-930.

### UC-3.5 — Theo dõi trạng thái, thời hạn phụ lục

**Actor thiết kế:** Sếp, Marketing. **Đánh giá:** Một phần.

**Luồng code:** danh sách/chi tiết hợp đồng lấy qua GET /api/v1/contracts và /{id}; response detail lồng phụ lục cùng status, ngày hiệu lực. ContractModule lọc/trình bày trạng thái và mở chi tiết. Khi phụ lục thay đổi, trạng thái chạy qua command submit-signing, activate, cancel.

**Đối chiếu quyền:** GET /contracts/{id} yêu cầu contracts:read; CARETAKER theo role seed không có quyền này. Route WorkBasis riêng yêu cầu plots:read và cho phép role CARETAKER, ADMIN, MARKETING; service trả dữ liệu công việc cần thiết, không phải quyền đọc toàn bộ hợp đồng. Nếu gán thêm contracts:read cho CARETAKER, DTO có che CCCD/địa chỉ, giá trị tiền và scan hợp đồng, nhưng còn trả một số tên và số điện thoại; cần rà đúng chính sách dữ liệu trước khi cấp quyền rộng.

**Đối chiếu chức năng:** theo dõi mã, trạng thái và thời hạn nền tảng đã có. Không thấy đầy đủ bộ trạng thái dẫn xuất “sắp hết hạn/hết hạn” và cảnh báo tự động theo ngưỡng như mô tả. Đặc tả cũng ghi một số ngưỡng hạn còn cần chốt; không tự đặt số ngày.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:368-408, 1265-1305; backend/app/modules/contracts/router.py:132-200, 206-260; backend/app/modules/contracts/service.py:1505-1599, 2169-2410.

## UC-4 — Quản lý thi công

### UC-4.1 — Lập checklist thi công

**Actor thiết kế:** Quản trang. **Đánh giá:** Có đường code chính.

**Luồng code:** ConstructionModule tải WorkBasis/hợp đồng, tạo ConstructionOrder từ phụ lục ACTIVE loại CONSTRUCTION hoặc BURIAL. Service đọc checklist cấu hình trong phụ lục; nếu không có thì dùng checklist mặc định, hoặc nhận custom task. Task được lưu trong ConstructionTask; có API thêm/sửa/xóa/sắp xếp.

**Đối chiếu:** checklist có thể tùy chỉnh và sắp xếp. Cần phân biệt mẫu trên phụ lục với checklist đã phát sinh trên lệnh, vì checklist thuộc lệnh thi công thực tế.

**Điểm mở source:** web/src/components/construction/ConstructionModule.tsx:198-253, 435-448; backend/app/modules/construction/router.py:140-232; backend/app/modules/construction/service.py:291-448, 589-667; backend/app/modules/construction/models.py.

### UC-4.2 — Phân công

**Actor thiết kế:** Quản trang. **Đánh giá:** Một phần.

**Luồng code:** component tải nhân sự từ /api/v1/auth/staff; lệnh có supervisor, hạng mục có assignee_user_id hoặc assigned_team_or_contractor; service kiểm tra nhân viên và lịch bận trước khi lưu. Route phân biệt đọc, ghi và thực thi bằng quyền construction:*.

**Đối chiếu:** phân công người/tổ và ngày dự kiến được lưu. Hàm check_staff_conflict hiện đối chiếu bảng lịch nghỉ/bận của nhân viên; chưa thấy kiểm tra trùng với lệnh thi công khác hoặc ca chăm sóc đã giao trong cùng khoảng ngày. Không thấy tích hợp thông báo push đến thiết bị người được giao. Việc gửi đến tài khoản app/mobile không được tính là hoàn tất ở phạm vi web.

**Điểm mở source:** web/src/components/construction/ConstructionModule.tsx:157-198, 253-279, 401-435; backend/app/modules/construction/router.py:49-98, 140-216; backend/app/modules/construction/service.py:202-237, 291-345, 589-667; backend/app/modules/construction/models.py.

### UC-4.3 — Cập nhật checklist

**Actor thiết kế:** Quản trang. **Đánh giá:** Có đường code chính, media hiện tập trung vào ảnh.

**Luồng code:** người thực hiện tải tệp lên Documents, gắn file vào task qua /tasks/{id}/evidences, cập nhật ghi chú rồi gọi /tasks/{id}/complete. Service bắt buộc task bắt buộc có file READY hợp lệ trước khi hoàn thành; sau đó đổi status sang DONE và tính lại tiến độ.

**Đối chiếu:** tick, ghi chú và ảnh nghiệm thu có đường đầy đủ. Source validation evidence hiện yêu cầu image/*; UC nói ảnh/video, nên video chưa được xác nhận hỗ trợ. Tệp tải lên nhưng chưa READY chưa đủ điều kiện hoàn thành.

**Điểm mở source:** web/src/components/construction/ConstructionModule.tsx:293-401; backend/app/modules/construction/router.py:239-280; backend/app/modules/construction/service.py:668-762.

### UC-4.4 — Cập nhật tiến độ

**Actor thiết kế:** Quản trang. **Đánh giá:** Một phần.

**Luồng code:** tiến độ tổng thể được service tính từ số task DONE trong _recalculate_progress(); hoàn tất order đặt 100% sau khi qua kiểm tra task bắt buộc và minh chứng. ConstructionModule hiển thị tiến độ và cập nhật ghi chú/trạng thái qua order/task APIs.

**Đối chiếu:** hệ thống tự tính phần trăm theo checklist, đúng phần chính của UC. Không thấy lệnh riêng cho Quản trang nhập % tùy ý hoặc gửi thông báo tiến độ đến bộ phận khác. Tài liệu yêu cầu cả hai việc đó, nên cần ghi là chưa đủ.

**Điểm mở source:** backend/app/modules/construction/service.py:451-487, 488-585, 822-840; web/src/components/construction/ConstructionModule.tsx:309-344, 462-480.

### UC-4.5 — Theo dõi thời hạn phụ lục

**Actor thiết kế:** Quản trang. **Đánh giá:** Một phần.

**Luồng code:** order lưu start_date, expected_end_date, actual_end_date, status; module thi công tải danh sách/lọc lệnh và hiển thị ngày hạn. Service lấy hạn từ thông tin phụ lục khi tạo lệnh.

**Đối chiếu:** ngày hạn của lệnh có thể được xem và so với trạng thái. Không thấy màn hình theo dõi riêng các phụ lục thi công theo hạn gần nhất, cảnh báo theo màu/ngưỡng hoặc command “gia hạn phụ lục”. Theo dõi order không đồng nghĩa quản trị hạn hợp đồng.

**Điểm mở source:** web/src/components/construction/ConstructionModule.tsx:119-198, 610-642; backend/app/modules/construction/service.py:291-358, 451-487; backend/app/modules/construction/models.py.

## UC-5 — Quản lý chăm sóc

### UC-5.1 — Đăng ký gói chăm sóc

**Actor thiết kế:** Nhân viên Marketing. **Đánh giá:** Có đường code chính.

**Luồng code:** từ chi tiết hợp đồng, ContractModule lấy gói đang hoạt động ở /api/v1/catalog/care-packages?active_only=true, rồi tạo phụ lục chăm sóc. ContractService.create_care_annex() kiểm tra hợp đồng ACTIVE, loại hợp đồng và gói; lưu package, chu kỳ, đơn giá và thời hạn. Mẫu gói do CatalogService quản lý.

**Đối chiếu:** gói được gắn vào phụ lục hợp đồng và tạo căn cứ cho Quản trang. Thông báo tự động đến quản trang chưa thấy tích hợp notification service.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:794-852; backend/app/modules/contracts/service.py:760-840; backend/app/modules/catalog/router.py:158-215; backend/app/modules/catalog/service.py:290-352.

### UC-5.2 — Lập lịch chăm sóc

**Actor thiết kế:** Quản trang. **Đánh giá:** Một phần.

**Luồng code:** web gọi /api/v1/care/schedules/generate theo năm/tháng. CareService.generate_schedules_for_period() chọn phụ lục chăm sóc ACTIVE còn hiệu lực, xác định ô từ hợp đồng, kiểm tra idempotency theo kỳ, lấy checklist mẫu của gói, tạo lịch và các checklist item. Ngày được neo theo ngày bắt đầu phụ lục và điều chỉnh về ngày cuối tháng nếu tháng ngắn hơn.

**Đối chiếu:** tạo lịch tháng và chạy lại không nhân đôi lịch đã có. Code hiện sinh theo kỳ tháng; UC nêu ngày/tuần/tháng/quý trong khi cycle của gói và mốc thời hạn trong tài liệu còn cần chốt. Không nên nói hệ thống hiện đã hỗ trợ mọi loại recurrence.

**Điểm mở source:** web/src/components/care/CareModule.tsx:99-158; backend/app/modules/care/router.py:29-160; backend/app/modules/care/service.py:34-160.

### UC-5.3 — Phân công

**Actor thiết kế:** Quản trang. **Đánh giá:** Một phần; xung đột lịch được chặn, chưa thấy thông báo push.

**Luồng code:** web chọn staff, gửi /schedules/{id}/assign; router yêu cầu quyền ghi. CareService.assign_caretaker() xác nhận lịch chưa đóng, nhân viên active có role CARETAKER, kiểm tra bảng StaffUnavailability và trả 409 nếu trùng; khi lưu có audit.

**Đối chiếu:** gán người và kiểm tra lịch nghỉ/bận có thật trong service. Kiểm tra này chưa so sánh với các ca chăm sóc/thi công khác đã giao cho cùng người, vì vậy chưa chứng minh được chống trùng lịch công việc. Không thấy notification đến thiết bị người được phân công. Phân công theo “tổ” ngoài cũng không rõ được biểu diễn như caretaker user; hiện care schedule gắn caretaker account.

**Điểm mở source:** web/src/components/care/CareModule.tsx:120, 191-220; backend/app/modules/care/router.py:162-185; backend/app/modules/care/service.py:163-218; backend/app/modules/care/models.py.

### UC-5.4 — Xác nhận thực hiện checklist

**Actor thiết kế:** Quản trang. **Đánh giá:** Có đường code chính cho web; đặc tả gốc mô tả thao tác di động, còn Flutter nằm ngoài phạm vi.

**Luồng code:** CareModule mở lịch, cập nhật checklist item, upload ảnh vào Documents rồi gắn evidence, cuối cùng gọi /schedules/{id}/close. Backend chỉ đóng ca nếu tất cả task bắt buộc hoàn thành và có ít nhất một file ảnh READY; ghi người hoàn tất, thời gian, audit và outbox event.

**Đối chiếu:** checklist, ảnh và điều kiện đóng ca được thực thi ở server. Không cần dựa vào giao diện để bảo vệ rule này. Dẫn đường có thể dùng shortcut vị trí trên web, nhưng thao tác hiện trường và camera native không được xác nhận trong web-only scope.

**Điểm mở source:** web/src/components/care/CareModule.tsx:221-318; backend/app/modules/care/router.py:187-280; backend/app/modules/care/service.py:221-337, 339-427.

## UC-6 — Quản lý tài chính

### UC-6.1 — Tạo khoản phải thu

**Actor thiết kế:** Kế toán. **Đánh giá:** Một phần; backend có endpoint nhưng web chủ yếu nhận khoản thu sinh từ giao dịch.

**Luồng code:** service có POST /api/v1/finance/receivables để tạo khoản thủ công, gắn đúng một nguồn hợp đồng hoặc phụ lục, kiểm tra khách và trùng installment, rồi lưu Receivable, audit và outbox. Ngoài ra ContractService tự tạo khoản thu khi kích hoạt hợp đồng/phụ lục. FinanceModule tải danh sách và căn cứ tài chính để kế toán ghi nhận thanh toán.

**Đối chiếu:** nghiệp vụ nguồn khoản phải thu có code. Không thấy FinanceModule gọi POST /receivables để kế toán lập thủ công; luồng phổ biến đang tự sinh khi activate. Endpoint tồn tại không đồng nghĩa web đã mở thao tác đó cho Kế toán.

**Điểm mở source:** backend/app/modules/finance/router.py:77-101; backend/app/modules/finance/service.py:192-313; backend/app/modules/contracts/service.py:2032+; web/src/components/finance/FinanceModule.tsx:108-116; web/src/components/finance/FinanceBasisView.tsx:52+.

### UC-6.2 — Ghi nhận thanh toán

**Actor thiết kế:** Kế toán. **Đánh giá:** Có đường code chính.

**Luồng code:** FinanceModule chọn khoản phải thu, nhập số tiền/phương thức/mã tham chiếu và gọi POST /receivables/{id}/payments. Router yêu cầu finance:write; FinanceService.record_payment() đổi số tiền sang Decimal, khóa dòng khoản phải thu, kiểm tra số dư và trạng thái, chống request trùng bằng idempotency key, thêm payment và tạo chứng từ.

**Đối chiếu:** ghi nhận tiền và chống double submit nằm server-side. Không thể dùng số hiển thị trên client làm nguồn tính công nợ; server đối chiếu số phải thu thực tế.

**Điểm mở source:** web/src/components/finance/FinanceModule.tsx:184-230; backend/app/modules/finance/router.py:118-138; backend/app/modules/finance/service.py:446-538+; backend/app/modules/finance/models.py.

### UC-6.3 — Xuất hóa đơn/biên lai

**Actor thiết kế:** Kế toán. **Đánh giá:** Một phần.

**Luồng code:** khi ghi nhận payment, service tạo Invoice/biên lai và PDF; UI có thể xem dữ liệu chứng từ, tải PDF, hoặc gọi regenerate nếu tệp bị lỗi. Tệp được quản lý qua Documents/MinIO.

**Đối chiếu:** biên lai sau giao dịch và tải PDF có đường code. Không thấy actor chọn giữa hai mẫu “hóa đơn” và “biên lai”, màn preview và gửi email/file trực tiếp như toàn bộ UC mô tả. Cần kiểm tra quy định chứng từ pháp lý riêng; tên Invoice trong model không tự khẳng định giá trị hóa đơn thuế.

**Điểm mở source:** web/src/components/finance/FinanceModule.tsx:287-330; backend/app/modules/finance/router.py:141-217; backend/app/modules/finance/service.py:714-730, 780+; backend/app/services/pdf_service.py; backend/app/modules/documents/service.py.

### UC-6.4 — Áp chiết khấu

**Actor thiết kế:** Kế toán. **Đánh giá:** Có đường code chính cho áp dụng và lưu lý do; quy trình phê duyệt còn là chính sách cần chốt.

**Luồng code:** web chỉ hiển thị nút theo finance:discount, gọi POST /receivables/{id}/discount. Service khóa khoản thu, không cho sửa khoản đã thanh toán/hủy, tính phần trăm hoặc số tiền với Decimal và ROUND_HALF_UP, cập nhật số phải thu, lưu reason/approved_by, audit và outbox.

**Đối chiếu:** áp chiết khấu, tính lại dư nợ và lưu lý do có code. Hiện người có quyền discount đồng thời ghi approved_by_user_id; không thấy workflow duyệt hai người tách biệt. Tài liệu cũng chưa chốt trần, người duyệt, cơ sở tính %, nên không được tuyên bố chính sách phê duyệt đã hoàn thiện.

**Điểm mở source:** web/src/components/finance/FinanceModule.tsx:259-280, 423-430; backend/app/modules/finance/router.py:103-116; backend/app/modules/finance/service.py:316-443.

## UC-7 — Báo cáo & thống kê

### UC-7.1 — Báo cáo doanh thu

**Actor thiết kế:** Sếp, Kế toán. **Đánh giá:** Một phần do quyền và bộ lọc.

**Luồng code:** ReportsModule gửi GET /reports/revenue kèm ngày/phương thức. Router dùng dependency kiểm capability doanh thu; ReportService.generate_revenue_report() cộng các payment thực thu bằng Decimal, nhóm kỳ/phương thức và dựng chi tiết.

**Đối chiếu:** báo cáo doanh thu thực thu có đường code; không tính doanh thu từ tổng giá hợp đồng chưa thu. API hiện có lọc thời gian/phương thức, không thấy lọc khu như UC yêu cầu. Kiểm quyền doanh thu hiện dựa role ACCOUNTANT hoặc ADMIN, nên cần xác nhận Sếp không thuộc ADMIN vẫn được xem theo yêu cầu UC.

**Điểm mở source:** web/src/components/reports/ReportsModule.tsx:133-180, 535+; backend/app/modules/reports/router.py:25-62; backend/app/modules/reports/service.py:46-125, 533-540.

### UC-7.2 — Thống kê phần mộ theo khu/trạng thái

**Actor thiết kế:** Sếp. **Đánh giá:** Một phần.

**Luồng code:** ReportsModule tải occupancy report, có thể truyền zone_id; router yêu cầu reports:read rồi kiểm capability OCCUPANCY; service tổng hợp ô/slot theo khu và tính tỷ lệ. Ngoài báo cáo, PlotService.get_stats() có bộ đếm trạng thái cho màn hình bản đồ.

**Đối chiếu:** có số liệu lấp đầy và lọc khu, nhưng quyền hiện chỉ cho ADMIN ở capability check; chưa thấy lọc theo loại mộ cho UC. Thống kê nhanh của bản đồ không thay cho report đầy đủ.

**Điểm mở source:** web/src/components/reports/ReportsModule.tsx:743-900; backend/app/modules/reports/router.py:68-85; backend/app/modules/reports/service.py:176-282, 533-540; backend/app/modules/plots/service.py:704-729.

### UC-7.3 — Thống kê hợp đồng

**Actor thiết kế:** Sếp. **Đánh giá:** Một phần.

**Luồng code:** UI tải report hợp đồng; GET /reports/contracts nhận ngày bắt đầu/kết thúc và status. Service nhóm số liệu hợp đồng/phụ lục và kỳ hạn chăm sóc sắp hết hạn.

**Đối chiếu:** báo cáo có thống kê/grouping nhưng endpoint không nhận loại hợp đồng làm filter rõ ràng, và capability check hiện từ chối mọi role không phải ADMIN cho CONTRACTS. Do đó Sếp thông thường có thể gặp 403 nếu không mang ADMIN; code UI không chứng minh role được cấp.

**Điểm mở source:** web/src/components/reports/ReportsModule.tsx:902-1095; backend/app/modules/reports/router.py:91-120; backend/app/modules/reports/service.py:283-408, 533-540.

### UC-7.4 — Thống kê thi công/chăm sóc

**Actor thiết kế:** Sếp. **Đánh giá:** Một phần.

**Luồng code:** UI gọi /reports/operations theo khoảng thời gian; service tổng hợp tiến độ lệnh thi công và ca chăm sóc, gồm tỷ lệ hoàn thành/đóng ca và chỉ số quá hạn.

**Đối chiếu:** báo cáo vận hành chính có code. Chưa thấy bộ lọc theo khu vực hoặc nhân viên như UC; capability check chỉ cho ADMIN nên Sếp cần được cấp/ánh xạ đúng nếu không phải ADMIN.

**Điểm mở source:** web/src/components/reports/ReportsModule.tsx:1097-1260; backend/app/modules/reports/router.py:126-151; backend/app/modules/reports/service.py:409-529, 533-540.

### UC-7.5 — Xuất file

**Actor thiết kế:** Sếp, Kế toán. **Đánh giá:** Có pipeline nhưng quyền theo loại report còn hẹp.

**Luồng code:** web POST /reports/export với loại và PDF/XLSX; service kiểm loại, định dạng và capability, dựng snapshot, lưu file MinIO cùng metadata/checksum. UI lấy danh sách export rồi tải qua /exports/{id}/download; service kiểm chủ sở hữu hoặc quyền admin/capability.

**Đối chiếu:** pipeline xuất và tải có code. Hiện check_report_capability() chỉ cho ACCOUNTANT với REVENUE và ADMIN với các loại còn lại; Sếp/Kế toán không mặc nhiên xuất mọi report theo UC. Các route export dùng get_current_user rồi service tự kiểm capability, không cùng pattern reports:read của GET report.

**Điểm mở source:** web/src/components/reports/ReportsModule.tsx:180-210, 1264-1285; backend/app/modules/reports/router.py:157-215+; backend/app/modules/reports/service.py:543-710, 795-850.

## UC-8 — Quản trị hệ thống

### UC-8.1 — Đăng nhập hệ thống

**Actor thiết kế:** Sếp, Marketing, Kế toán, Quản trang. **Đánh giá:** Có đường code chính.

**Luồng code:** LoginModal gọi auth API; AuthContext lưu trạng thái user/token và kiểm tra hasPermission; auth/router.py nhận login/refresh/logout. AuthService.authenticate_user() xác minh tài khoản và mật khẩu; tạo session/access token và refresh token; get_current_user() xác nhận JWT, tài khoản active và auth_version; require_permission() chặn thiếu quyền bằng 403. Admin bypass permission check theo rule hiện tại, còn invariant nghiệp vụ vẫn nằm ở service.

**Đối chiếu:** xác thực và RBAC server-side có đường code. Không xem token hoặc menu web là sự thật duy nhất về quyền; API là chốt cuối.

**Điểm mở source:** web/src/components/auth/LoginModal.tsx; web/src/context/AuthContext.tsx:82-103; web/src/services/apiClient.ts; backend/app/modules/auth/router.py:52-145; backend/app/modules/auth/service.py:31-112; backend/app/modules/auth/dependencies.py:16-114.

### UC-8.2 — Quản lý tài khoản

**Actor thiết kế:** Sếp. **Đánh giá:** Có đường code chính.

**Luồng code:** UserManagementModule tải users và roles; tạo/cập nhật/vô hiệu hóa tài khoản qua /api/v1/auth/users; service hash mật khẩu, lưu thông tin và gán role IDs. Router bảo vệ đọc bằng users:read, ghi bằng users:write.

**Đối chiếu:** tài khoản có thể được tạo, cập nhật, gán role và khóa. Chức năng đổi quyền người dùng bằng gán vai trò khác UC-8.3: nó không thay đổi định nghĩa quyền của chính role.

**Điểm mở source:** web/src/components/admin/UserManagementModule.tsx:90-120, 128-270; backend/app/modules/auth/router.py:148-242; backend/app/modules/auth/service.py:214-304.

### UC-8.3 — Phân quyền

**Actor thiết kế:** Sếp. **Đánh giá:** Chưa thấy chức năng cấu hình ma trận quyền; có đọc role và gán role cho user.

**Luồng code:** /auth/roles chỉ là GET danh sách vai trò/quyền; /auth/users và PUT user cho phép gán role IDs. AuthService.get_user_permissions() hợp nhất permissions của các role; require_permission() kiểm tra từng API.

**Đối chiếu:** không tìm thấy route tạo/sửa role hoặc thêm/bớt permission cho role; UserManagementModule chỉ chọn vai trò khi tạo/cập nhật account. Vì vậy UC mô tả Sếp chỉnh ma trận Xem/Thêm/Sửa/Xóa/Phê duyệt chưa có UI/API riêng trong source rà soát. Quyền thực có thể được seed từ script/migration, nhưng đó không phải màn hình runtime theo UC.

**Điểm mở source:** web/src/components/admin/UserManagementModule.tsx:90-120, 177-204; backend/app/modules/auth/router.py:232-242; backend/app/modules/auth/service.py:31-38, 250-304; backend/app/modules/auth/dependencies.py:94-114; backend/scripts/seed_rbac.py.

### UC-8.4 — Quản lý loại hợp đồng

**Actor thiết kế:** Sếp. **Đánh giá:** Chưa thấy CRUD loại hợp đồng.

**Luồng code hiện có:** loại hợp đồng là discriminator cố định được xử lý trong ContractService và danh sách lựa chọn trong ContractModule. Catalog có CRUD contract-templates, gồm nội dung mẫu, tài liệu yêu cầu và version mẫu.

**Đối chiếu:** mẫu hợp đồng có thể quản lý không đồng nghĩa loại giao dịch có thể thêm/sửa. Không thấy route/model CRUD danh mục ContractType; bốn loại giao dịch được hard-code trong service, schema và web. Theo đặc tả, phần cấu hình loại/điều khoản/yêu cầu bắt buộc chưa đạt đủ UC-8.4.

**Điểm mở source:** web/src/components/contracts/ContractModule.tsx:1503-1506; backend/app/modules/contracts/service.py:104-113, 299-405, 511-579; backend/app/modules/catalog/router.py:219-267; backend/app/modules/catalog/service.py:358-430; backend/app/modules/catalog/models.py.

### UC-8.5 — Quản lý gói dịch vụ

**Actor thiết kế:** Sếp. **Đánh giá:** Có đường code chính.

**Luồng code:** CatalogModule gọi GET/POST/PUT care-packages. Router dùng catalog:read khi xem và catalog:manage khi sửa. CatalogService lưu mã/tên, chu kỳ, JSON task mặc định, giá Decimal và trạng thái active. CareService.generate_schedules_for_period() lấy task của gói để tạo checklist từng kỳ.

**Đối chiếu:** quản lý gói, chu kỳ, checklist mẫu, giá đã có. Nội dung lịch lặp thực tế vẫn chịu giới hạn sinh theo kỳ tháng như UC-5.2; đổi template sau đó không nên được diễn giải là đã sửa checklist quá khứ.

**Điểm mở source:** web/src/components/catalog/CatalogModule.tsx:81-83, 258+; backend/app/modules/catalog/router.py:158-215; backend/app/modules/catalog/service.py:290-352; backend/app/modules/care/service.py:115-160.

### UC-8.6 — Quản lý bảng giá

**Actor thiết kế:** Sếp. **Đánh giá:** Có đường code chính.

**Luồng code:** CatalogModule đọc/ghi price lists và price items. CatalogService kiểm tra ngày hiệu lực chồng lấn, quản lý item, lookup theo loại mộ/dịch vụ và trả giá phù hợp. Khi tạo hợp đồng mua đất, ContractService tra bảng giá active theo ngày rồi snapshot giá vào giao dịch.

**Đối chiếu:** CRUD bảng giá và ngày hiệu lực có code; giá hợp đồng được tra theo thời điểm lập. Cần kiểm tra policy/loại giá thực tế đang seed và quyền role; endpoint yêu cầu catalog:manage.

**Điểm mở source:** web/src/components/catalog/CatalogModule.tsx:81-177; backend/app/modules/catalog/router.py:33-155; backend/app/modules/catalog/service.py:35-288; backend/app/modules/contracts/service.py:164-205.

### UC-8.7 — Kiểm tra Audit Log

**Actor thiết kế:** Sếp. **Đánh giá:** Một phần.

**Luồng code:** AuditModule tải summary, entity/action và danh sách log; API /audit/* bắt buộc audit:read. AuditService lọc theo ngày, user, action, entity và ID; response che thông tin nhạy cảm. API chỉ đọc, không có sửa/xóa log.

**Đối chiếu:** xem/lọc log có nền tảng; không phải mọi thay đổi đều chắc chắn có đủ before/after, vì mỗi service phải chủ động tạo log. Có chỗ App.tsx chỉ dùng users:read để hiện và mount Audit tab, nhưng API lại cần audit:read; nếu role chỉ có users:read thì giao diện mở được nhưng tải dữ liệu sẽ 403. Mapping seed chỉ cấp audit:read cho ADMIN; role Sếp riêng chưa được khai báo.

**Điểm mở source:** web/src/components/audit/AuditModule.tsx:55-100; web/src/App.tsx:482, 1062; backend/app/modules/audit/router.py:16-80; backend/app/modules/audit/service.py:47-150; điểm ghi log cần truy từ service cụ thể.

## Các đoạn code nên trình bày khi vấn đáp

### 1. API kiểm quyền trước khi vào nghiệp vụ

~~~python
def require_permission(resource: str, action: str):
    permission_code = f"{resource}:{action}"

    def _permission_checker(current_user=Depends(get_current_user)):
        user_roles = [r.role_name for r in current_user.roles]
        if "ADMIN" in user_roles:
            return current_user
        user_perms = AuthService.get_user_permissions(current_user)
        if permission_code not in user_perms:
            raise HTTPException(status_code=403, detail="...")
        return current_user
    return _permission_checker
~~~

Trong route, ví dụ Depends(require_permission("finance", "write")) chạy trước body endpoint. Sau đó endpoint gọi service. 401 thường là thiếu/không hợp lệ token; 403 là đã nhận dạng user nhưng thiếu quyền. Quyền của menu không thay thế lớp kiểm tra này.

### 2. Tạo hợp đồng mua đất và chống hai giao dịch chiếm cùng ô

~~~python
plot = (
    db.query(Plot)
    .filter(Plot.plot_id == data.plot_id)
    .with_for_update()
    .first()
)
if plot.status not in ("EMPTY_UNSOLD", "RESERVED"):
    raise HTTPException(status_code=409, detail="Ô mộ không khả dụng")
~~~

Sau khi khóa dòng, service kiểm tra reservation active, xác định giá từ catalog, tạo hợp đồng/reservation và commit. Đây là lý do không nên đặt logic chống đặt trùng chỉ ở frontend: hai người có thể gửi request gần như cùng lúc.

**Vị trí:** backend/app/modules/contracts/service.py:104-205; route và permission ở backend/app/modules/contracts/router.py:39-59.

### 3. An táng là command có xác minh hồ sơ và khóa Kim Tĩnh

~~~python
if annex.status != "ACTIVE":
    raise HTTPException(status_code=400, detail="Phụ lục chưa có hiệu lực")
if not ProfileService.check_death_certificate_verified(db, burial.deceased_id):
    raise HTTPException(status_code=400, detail="Giấy báo tử chưa được xác minh")
slot.status = "OCCUPIED"
slot.current_deceased_id = burial.deceased_id
plot.status = "OCCUPIED"
if burial.is_kim_tinh:
    plot.is_kim_tinh = True
    plot.is_locked = True
~~~

Đoạn này thể hiện ranh giới giữa hợp đồng/phụ lục có hiệu lực và sự kiện đã an táng tại hiện trường. Chỉ khi chạy command xác nhận, slot và ô mới chuyển OCCUPIED; Kim Tĩnh được khóa theo invariant.

**Vị trí:** backend/app/modules/contracts/service.py:1234-1325; route caretaker command ở backend/app/modules/contracts/router.py:387-400.

### 4. Đóng ca chăm sóc qua các điều kiện bắt buộc

~~~python
incomplete_required = [
    item for item in schedule.checklist_items
    if item.is_required and not item.is_completed
]
if incomplete_required:
    raise HTTPException(status_code=400, detail="Còn hạng mục bắt buộc")
if valid_evidence_count == 0:
    raise HTTPException(status_code=400, detail="Cần ảnh minh chứng")
schedule.status = "CLOSED"
~~~

UI có thể báo sớm để người dùng biết, nhưng service mới là nơi đảm bảo task và ảnh READY phải đủ. Sau khi đóng, service ghi thời gian/người xác nhận, audit và outbox.

**Vị trí:** backend/app/modules/care/service.py:339-427.

### 5. Ghi nhận payment với số chính xác và chống gửi lặp

~~~python
norm_amount = Decimal(str(payload.paid_amount)).quantize(Decimal("0.01"))
receivable = (
    db.query(Receivable)
    .filter(Receivable.receivable_id == receivable_id)
    .with_for_update()
    .first()
)
remaining_debt = receivable.final_payable_amount - receivable.total_paid_amount
if payload.paid_amount > remaining_debt:
    raise HTTPException(status_code=400, detail="Vượt dư nợ")
~~~

Sau đoạn này service dùng khóa idempotency để nhận diện request lặp, ghi payment, cập nhật/chốt chứng từ và commit. Khi vấn đáp, phân biệt “khoản phải thu” (nghĩa vụ) và “payment” (tiền đã nhận).

**Vị trí:** backend/app/modules/finance/service.py:446-538+; API backend/app/modules/finance/router.py:118-138.

### 6. Báo cáo doanh thu tính tiền đã thu

ReportService.generate_revenue_report() đọc bảng Payment và cộng paid_amount bằng Decimal; không lấy Contract.total_amount làm doanh thu thực thu. Đây là điểm nghiệp vụ quan trọng: hợp đồng ký chưa chắc đã được khách thanh toán.

**Vị trí:** backend/app/modules/reports/service.py:46-125.

## Các chênh lệch đáng nhớ giữa đặc tả và source

| Mức | Use case | Hiện trạng thấy trong source | Hệ quả khi demo/giải thích |
|---|---|---|---|
| Cao | UC-8.3 | Có đọc roles và gán role cho account, chưa thấy API/UI chỉnh permission matrix | Nói rõ “gán vai trò” có, “cấu hình từng permission của role” chưa thấy. |
| Cao | UC-8.4 | Có mẫu hợp đồng; loại giao dịch là danh sách cố định | Đừng nhầm quản lý mẫu điều khoản với quản lý loại hợp đồng. |
| Cao | UC-7.1–7.5 | Capability check theo role hạn chế doanh thu cho Accountant và các report khác cho ADMIN | Sếp thông thường có thể bị 403; cần đối chiếu role mapping thực tế và sửa capability nếu cần. |
| Cao | UC-2.1/2.2, UC-3.1/3.4 | App mount module theo quyền đọc; ProfileModule không gate thao tác ghi theo permission. ContractModule gate theo tên role ADMIN/MARKETING thay vì kiểm permission cụ thể | Tài khoản chỉ đọc có thể thấy thao tác ghi ở hồ sơ; nếu mapping permission và role UI lệch nhau, người dùng có thể thấy thao tác sai hoặc không thấy thao tác được phép. |
| Cao | UC-8.7 | UI Audit gate users:read, API yêu cầu audit:read | Tài khoản có users:read mà thiếu audit:read có thể mở màn hình rồi gặp 403. |
| Cao | Các UC do Sếp thực hiện | seed_rbac.py không khai báo role Sếp; chỉ ADMIN có users:* và quyền quản trị toàn diện | Không đồng nhất Sếp với ADMIN khi thiết kế role. Cần có mapping quyền cho Sếp hoặc ghi rõ đây là người mang role ADMIN. |
| Vừa | UC-1.1 | Nhập/tạo tọa độ có; chưa thấy kiểm tra geofence nghĩa trang phía server | Giá trị trong phạm vi toàn cầu không có nghĩa là vị trí đúng khu đất. |
| Vừa | UC-1.3 | Status thay qua command nghiệp vụ; không thấy endpoint đổi trạng thái tùy ý | Kiểm tra trạng thái qua luồng hợp đồng, thi công, an táng; không tìm một màn hình đổi mọi status. |
| Vừa | UC-1.4/1.5 | Tra cứu nội bộ và public được tách; GIS/tuyến đường phụ thuộc tọa độ và dịch vụ ngoài | Nếu marker ít hoặc sai chỗ, kiểm coverage tọa độ API và dữ liệu demo trước khi kết luận map không đọc dữ liệu. |
| Vừa | UC-3.2 | PDF hợp đồng chính có; chưa thấy PDF riêng cho phụ lục | Phụ lục scan có thể tải lên/kích hoạt nhưng không đồng nghĩa đã in được từ hệ thống. |
| Vừa | UC-3.5/4.5 | Có trạng thái và ngày hạn; cảnh báo phụ lục sắp/hết hạn và command gia hạn chưa đầy đủ | Không mô tả badge màu như đã tự động cảnh báo nếu chưa thấy code. |
| Vừa | UC-4.2/5.3 | Staff/unavailability/conflict check có; push notification chưa thấy | Phân công được lưu, nhưng “đã gửi notification tới thiết bị” chưa được chứng minh. |
| Vừa | UC-4.3/5.4 | Evidence hiện kiểm tra ảnh READY; thi công không nhận video theo kiểm MIME đang thấy | Mô tả đúng khả năng file đang được service chấp nhận. |
| Vừa | UC-4.4 | Progress được tính từ checklist; không thấy nhập % tùy ý hoặc push tiến độ | Nêu là tiến độ suy ra từ task, không phải trường tự nhập. |
| Vừa | UC-5.2 | Sinh lịch định kỳ theo kỳ tháng, có idempotency | Không khẳng định ngày/tuần/quý recurrence đã được triển khai đầy đủ. |
| Vừa | UC-6.1/6.3 | Endpoint tạo khoản thu có; payment sinh chứng từ; UI không có mọi bước thủ công/preview/chọn mẫu như UC | Tách rõ khả năng backend và thao tác đang có trên web. |
| Vừa | UC-7.1–7.4 | Report API hiện ít bộ lọc hơn UC, capability còn hẹp | Dữ liệu báo cáo có thể đúng phần cốt lõi nhưng trải nghiệm chưa đủ tiêu chí thiết kế. |

## Lab1 và các mã use case lịch sử

Lab1 nêu tám nhóm nghiệp vụ lớn: mộ/bản đồ; khách hàng/người mất; hợp đồng; thi công; chăm sóc; tài chính; báo cáo; quản trị. Các nhóm này tương ứng UC-1 đến UC-8 ở bản hiện tại.

Lab1 có các bước “Sếp duyệt”, “khách xác nhận”, khách thanh toán ngoài hệ thống và ba loại hợp đồng. Bản hợp nhất giải quyết mâu thuẫn: ký giấy bên ngoài rồi upload bản scan và kích hoạt; khách không cần account nội bộ; bốn loại giao dịch bao gồm chuyển nhượng. Do vậy khi trình bày code, không nói có quy trình khách đăng nhập ký hợp đồng hoặc thanh toán online nếu không có source đó.

Các mã ở phiên bản UC cũ được gộp như sau:

| Mã/nhãn cũ | Vị trí tương ứng trong bộ UC hiện tại |
|---|---|
| UC-1.3 Gán/đặt mộ | UC-3.1 lập hợp đồng mua đất, có giữ chỗ và chống đặt trùng |
| UC-1.4 Cập nhật trạng thái mộ | UC-1.3 hiện tại; status cũng đổi theo command hợp đồng/thi công/an táng |
| UC-1.5 Tra cứu tình trạng mộ | UC-1.4 hiện tại |
| UC-1.6 Quản lý tọa độ GPS | UC-1.1 hiện tại |
| UC-1.7 Dẫn đường | UC-1.5 hiện tại |
| UC-6.3 Khách thực hiện thanh toán | Bước bên ngoài hệ thống trong UC-6; nhân viên ghi nhận ở UC-6.2 |
| UC-6.4 Xuất chứng từ | UC-6.3 hiện tại |
| UC-6.5 Chiết khấu | UC-6.4 hiện tại |

Lab2 hiện tại có đủ danh mục 47 UC; Markdown là bản tổng hợp đã đưa vào chỉ dẫn đọc nguồn, mâu thuẫn, quy tắc và các điều còn cần chốt. Không cộng tên cũ thành UC thứ 48 trở đi.

## Trình tự ôn vấn đáp cho từng nghiệp vụ

Với bất kỳ UC nào, có thể trình bày theo thứ tự:

1. **Actor và mục đích:** ai thực hiện, đầu vào nghiệp vụ là gì, kết quả mong muốn là gì.
2. **Giao diện:** mở component nào, người dùng nhập/chọn gì và web gửi URL nào.
3. **Quyền/API:** method route, schema đầu vào, require_permission nào; quyền đặt ở server.
4. **Nghiệp vụ:** service kiểm tra trạng thái/invariant nào, vì sao có thể trả lỗi 400/403/404/409.
5. **Dữ liệu/tác dụng phụ:** model/bảng được đọc ghi; có tệp MinIO, khoản thu, audit hoặc outbox không.
6. **Đối chiếu:** phần nào khớp UC, phần nào thiếu hoặc chỉ là đề xuất/chưa chốt.

Tài liệu code map này có thể đọc kèm với [ORAL_DEFENSE_CODE_GUIDE.md](ORAL_DEFENSE_CODE_GUIDE.md), tài liệu đó giải thích cấu trúc backend/web và file theo module; tài liệu này tập trung nối từng use case với đường chạy source.

## Tài liệu căn cứ

- reference/DAC_TA_NGHIEP_VU_HE_THONG_QUAN_LY_NGHIA_TRANG.md: đặc tả hợp nhất, ưu tiên Mục 0–1, 3–8 và toàn bộ UC tại Mục 9.
- reference/lab1.docx: bài toán, actor và danh sách chức năng ban đầu.
- reference/Lab2-TruongXuanHuy-2324802010044.docx: bảng đặc tả UC và các luồng chi tiết L2.
- AGENTS.md: quy tắc bảo toàn database, xác thực/phân quyền server-side, tiền Decimal và dữ liệu synthetic.

Không chạy script bootstrap SQL hoặc thay đổi database trong quá trình tạo bản đối chiếu này.
