# Kế hoạch khắc phục nghiệp vụ, phân quyền và UX/UI web

Ngày kiểm chứng: **13/10/2026**. Baseline mã nguồn: `4053b106da8ae6d7a5ce850f5cedf673e504f879`.

Đầu ra dành cho AI agent triển khai, bao gồm Antigravity. Phạm vi giao diện là **`web/` trên desktop, tablet và trình duyệt điện thoại**, cùng backend/CSDL cần sửa để các luồng web đúng nghiệp vụ. Không yêu cầu sửa ứng dụng Flutter trong `mobile/`; API dùng chung phải có kế hoạch tương thích.

## 1. Kết luận và cách dùng

Hệ thống có phần lớn màn hình phân hệ, nhưng **chưa đáp ứng trọn vẹn các luồng nghiệp vụ theo đúng actor**. Vấn đề lớn nhất là quyền server/DTO/file chưa thống nhất, trạng thái pháp lý bị dùng thay cho hoàn thành ngoài hiện trường, các đường ghi bỏ qua điều kiện kết thúc, và retry tài chính chưa an toàn. Không thể nghiệm thu chỉ bằng việc ADMIN nhìn thấy đủ màn hình hoặc build/lint thành công.

Plan này chứa **37 nhóm vấn đề BA-01…BA-37**, đối chiếu **39 UC con**, thứ tự thực thi và bộ nghiệm thu. Đây là bản kiểm chứng mới, không phải xác nhận các trạng thái “Done” trong STATE hoặc trong plan cũ. Chỉ các hạng mục được đánh dấu bằng chứng động mới được coi là đã tái hiện. Các sửa chữa dưới đây là việc **cần thực hiện**, không phải việc đã sửa trong đợt audit.

Nguồn nghiệp vụ chính: [đặc tả hợp nhất Lab 1–Lab 4](../../reference/DAC_TA_NGHIEP_VU_HE_THONG_QUAN_LY_NGHIA_TRANG.md), đặc biệt mục 3–8, 9, 12, 13. Bộ DOCX/SQL gốc đã được dùng trong khảo sát trước: [Lab 1](../../reference/lab1.docx), [Lab 2](../../reference/Lab2-TruongXuanHuy-2324802010044.docx), [Lab 3](../../reference/Lab3-TruongXuanHuy-2324802010044.docx), [Lab 4](../../reference/lab4-TruongXuanHuy-2324802010044.docx), [SQL gốc](../../reference/lab4-sql.sql). SQL này **chỉ để đọc**; không được chạy bootstrap có `DROP DATABASE`.

Đặc tả là yêu cầu để đối chiếu, không phải lệnh cho phép tự đổi dữ liệu vận hành. Các mục `[ĐỀ XUẤT]`/`[CẦN CHỐT]` không tự trở thành chính sách đã duyệt. [Actor policy hiện có](../ui-alignment/actor-policy.md) và các tài liệu `docs/ui-alignment/` là đầu vào kỹ thuật để tái sử dụng, cần đối chiếu lại với đặc tả mới. Không tạo thêm một ma trận quyền mâu thuẫn với chúng.

[Plan responsive ngày 11/10](../ui-responsive-audit/PLAN.md) dùng baseline cũ. Hiện menu mobile và nhiều bố cục đã được sửa. Không lấy toàn bộ 37 lỗi của bản cũ gán là lỗi hiện tại. Ảnh sidebar chiếm gần hết màn hình người dùng gửi là chứng cứ lịch sử, không còn là kết quả tái hiện ở baseline này.

### 1.1 Quy ước bằng chứng và mức ưu tiên

| Nhãn | Ý nghĩa |
|---|---|
| UI | Trình duyệt Edge/Playwright, đăng nhập thật bằng actor tương ứng; không mock thành công nghiệp vụ. |
| API | Gọi endpoint thật, JWT của actor thực, FastAPI + SQL Server thật. Các lệnh ghi dùng CSDL Test và rollback. |
| SVC | Gọi service trên SQL Server Test; chưa chứng minh đầy đủ đường UI → HTTP của tình huống đó. |
| CODE | Đọc router/service/model/UI hoặc SQL biên dịch; kết luận về đoạn mã, chưa phải tái hiện E2E. |
| FAULT | Cố ý tạo lỗi có kiểm soát để kiểm tra nhánh lỗi, ghi rõ phạm vi. |
| POLICY | Nguồn chưa quyết định đầy đủ, phải chốt trước khi bật hành vi liên quan. |
| P0 | Chặn nghiệm thu: sai quyền/dữ liệu riêng tư, pháp lý, trạng thái thực địa hoặc tiền. Rủi ro cạnh tranh P0 vẫn phải có test xác nhận trước khi tuyên bố đã xảy ra. |
| P1 | Luồng chính bị thiếu/chặn/sai hoặc thao tác quan trọng không dùng được. |
| P2 | Điều hướng, nội dung, độ rõ ràng và quản lý bằng chứng; thực hiện cùng phân hệ liên quan. |

### 1.2 Phạm vi đã chạy và giới hạn

- Đăng nhập qua form với bốn tài khoản demo có đúng **một** vai trò: MARKETING, CARETAKER, ACCOUNTANT, ADMIN; thêm public không đăng nhập. Không thay actor bằng ADMIN để “cho qua”. Mật khẩu/token không nằm trong báo cáo.
- 32 lượt mở mục điều hướng theo các actor, chụp desktop 1440×900 và mobile 390×844; tổng 64 ảnh ở runtime. Mở thêm 12 trường hợp form/chi tiết/tra cứu; 11 trường hợp ở 1440/768/390/320 px và login ở 390×320. Đây là **độ phủ màn hình**, không phải 39 UC đã chạy E2E thành công.
- Đo chiều rộng body/main sau tải và sau animation. Không thấy tràn ngang toàn trang trong các view normal đã đo ở 390 px; không thấy tràn ngang trong các form/chi tiết được đo 320–1440 px. Vẫn có lỗi chiều cao, focus, quyền và dữ liệu. Chưa kiểm chứng bàn phím ảo/iOS Safari/máy Android vật lý.
- CSDL chính được đọc để xem dữ liệu và UI; có phát sinh phiên đăng nhập theo hoạt động xác thực thông thường. Không ghi hợp đồng, thu tiền, an táng hoặc thay schema trên CSDL chính.
- Các probe ghi chạy trên **`QL_NghiaTrang_Test`**. `Session.commit` chuyển thành `flush` trong transaction ngoài, rollback cuối ca và expire ORM giữa request. Có kiểm chứng business guard, HTTP, trigger trong transaction; **không chứng minh độ bền sau commit thật, race hai kết nối hoặc outbox worker**. Các ca đó bắt buộc ở bước nghiệm thu sau.
- Probe an táng ban đầu dùng metadata `FileObject READY` synthetic, không có object MinIO thật; không được gọi đó là E2E ký/an táng. Probe storage bổ sung đã upload PDF thật, đọc lại byte chính xác, sinh biên lai và xuất PDF/XLSX bằng MinIO thật.
- Chỉ nhánh public 503 dùng mock response lỗi có nhãn synthetic. Nhánh lỗi tạo biên lai dùng fault injection ở storage adapter, không tắt MinIO của người dùng.
- Không chạy nguyên test suite hiện có với cấu hình mặc định vì nhiều test có khả năng ghi DB mặc định. Không coi số test được ghi trong STATE là bằng chứng nghiệm thu đợt này.

### 1.3 MinIO và CSDL Test sau khi tiếp tục

Lúc kiểm tra lại, MinIO `http://127.0.0.1:9000/minio/health/live` trả 200; backend readiness trả 200 với `Database connected`, `Storage connected`. Container `ql_nghiatrang_minio` hoạt động; không dùng container MinIO của dự án khác ở cổng 9010.

Test DB ban đầu là `0010_g12_care_schedules`, thiếu cột tài chính và `report_exports`, trong khi main là `0012_g17_report_exports`. Đã tạo backup COPY_ONLY + CHECKSUM, chạy RESTORE VERIFYONLY, rồi áp dụng **hai migration có sẵn** 0011 và 0012 **chỉ trên Test**. Backup giữ tại `backend/runtime/backups/QL_NghiaTrang_Test_before_actor_audit_20261013.bak` trên ổ D. Không viết migration mới, không downgrade hoặc sửa main. Nếu cần phục hồi Test, dùng backup qua quy trình restore có kiểm soát, không tự chạy downgrade làm mất cột.

Sau probe: Test vẫn có 3 customers, 3 deceased, 11 plots; contracts, care schedules, construction orders, payments và receivables đều 0. Bốn object MinIO do probe tạo đã xóa đúng bucket/key/version của chúng. Migration Test được giữ ở 0012; identity/sequence có thể đã tăng dù transaction rollback. Đây là thay đổi môi trường kiểm thử, **không phải sửa lỗi sản phẩm**.

### 1.4 Chỉ mục bằng chứng

| Tệp | Nội dung và giới hạn |
|---|---|
| [browser.json](evidence/browser.json) | Vai trò/quyền thực tế, nav, phép đo normal, endpoint read matrix, lỗi response; không chứa token. |
| [details.json](evidence/details.json) | Wizard/form/chi tiết ở các viewport; kích thước, field, button, ảnh. Click dòng không tự bảo đảm đã mở detail, cần xem trạng thái view khi tái hiện. |
| [probes.json](evidence/probes.json) | Tạo profile sai actor 201, staff 500, assign POST 405, discount 403, MSSQL compiled SQL. |
| [business-probes.json](evidence/business-probes.json) | Cert không file; pháp lý → OCCUPIED; care conflict/evidence/closed; construction sai căn cứ và bypass hoàn tất. |
| [storage-probes.json](evidence/storage-probes.json) | MinIO thật, báo cáo vượt quyền, bypass ACL file/biên lai, idempotency, filter export, fault receipt; SQL rollback. |
| [edgecases.json](evidence/edgecases.json) | Map không có Leaflet; public 503 trắng root; Escape; login cuộn chuột không tới submit. `loginSubmitVisible=true` là **sau khi script gán scrollTop**, không phải người dùng cuộn được. |
| [test-environment.json](evidence/test-environment.json), [test-final-preflight.json](evidence/test-final-preflight.json) | Revision/count trước–sau và role thực; snapshot cột liên quan. Full introspection giữ trong runtime. |
| [login thấp](evidence/detail-login-short-390.png), [lệnh thi công](evidence/detail-construction-create-390.png), [care detail](evidence/detail-care-detail-390.png) | Ví dụ lỗi chiều cao, input ID thô, nhân sự không tải được, chữ/trạng thái cần cải thiện. |
| [map mobile](evidence/edge-map-390.png), [public lỗi](evidence/edge-public-503-390.png), [home hiện tại](evidence/guest-0-390.png) | So sánh vùng map trống, lỗi trắng trang và responsive hiện tại. |

Script tái hiện local ở `backend/runtime/actor_audit/`: `browser.mjs`, `details.mjs`, `edgecases.mjs`, `probes.py`, `business_probes.py`, `storage_probes.py`, `preflight.py`. Đây là harness audit, **không phải regression suite để chạy mặc định**. Đọc trước, buộc DB Test, sao lưu và thay bằng test fixture chuẩn khi triển khai. Không chạy lại `prepare_test.py` mù quáng vì backup cố định đã tồn tại. File runtime bị gitignore; bằng chứng cần bàn giao đã sao chép vào thư mục này.

## 2. Ma trận actor: yêu cầu so với hệ thống thực tế

| Actor | Công việc đúng theo đặc tả | Quan sát hiện tại | Thiết kế đích |
|---|---|---|---|
| Public / thân nhân | Tra người mất/mộ, phân biệt trùng tên, dẫn đường khi có GPS; kết quả chăm sóc đã được công bố; không cần account | Cổng public hoạt động, không cần login; tìm theo mã ô chưa khớp backend; thiếu care public; API lỗi có thể trắng trang | DTO public allowlist; tìm theo tên/mã vị trí; không trả CCCD, công nợ, bản ký hoặc file nội bộ; trạng thái thiếu GPS rõ ràng |
| MARKETING | Hồ sơ, giấy tờ, 4 HĐ, 3 PL; in/ký ngoài/scan; gia hạn đúng văn bản | Có wizard 4 HĐ nhưng PL thiếu; được finance/read và mọi báo cáo qua reports:read; có quyền cấu hình rộng hơn vai trò | Workspace hồ sơ/pháp lý; capability cho từng command; bản ký có version, trạng thái giấy tờ; chỉ dữ liệu công nợ tối thiểu nếu policy cho phép |
| CARETAKER | Điều phối người/tổ/ngoài, checklist/bằng chứng, xác nhận thực địa; căn cứ công việc tối thiểu | Thấy hồ sơ/HĐ đầy đủ; tạo customer qua API201; thiếu nút điều phối care; staff 500; GET report 403 nhưng export 201 và tải 200 | Workspace công việc/căn cứ không giá; bốn danh tính phân công/giám sát/thực hiện/xác nhận; không mở PDF pháp lý/tài chính qua URL khác |
| ACCOUNTANT | Nguồn khoản thu, công nợ, ghi tiền thực nhận, chiết khấu theo quyền, biên lai, báo cáo tài chính | Thu/biên lai happy path chạy; tạo customer trái vai trò 201; xem đủ báo cáo; discount 403 vì quyền chưa có; thiếu UI tạo khoản phải thu | Workspace khoản thu/thanh toán/chứng từ/báo cáo tài chính; Finance Basis DTO; không chỉnh hồ sơ pháp lý hay cấu hình giá |
| ADMIN / Sếp | Quản trị tài khoản/quyền, không gian/danh mục, tổng hợp báo cáo/audit, giám sát | Đủ menu, matrix role chỉ đọc; backend permission bypass; trạng thái Done không tương ứng toàn bộ nghiệp vụ | Quyền quản trị rõ; các vai nghiệp vụ kiêm nhiệm phải cấp minh bạch theo C16; ADMIN không vượt bất biến Kim Tĩnh/tiền/trạng thái |

Các read matrix thực: bốn actor nội bộ đều đọc được profiles/contracts/plots; Marketing và Kế toán đọc được cả bốn báo cáo. Quản trang bị chặn `/finance`, `/auth/users`, `/audit` đúng ở endpoint nghiệp vụ. **Phải giữ các chặn đúng này**, đồng thời đóng đường vòng qua DTO/file/export.

## 3. Đối chiếu 39 UC con

“Một phần” nghĩa là có màn hình/endpoint nhưng chưa đủ điều kiện nghiệm thu. Bảng là traceability, không tự khẳng định đã chạy mọi nhánh của UC. Mã BA trỏ tới hướng dẫn chi tiết mục 4.

| UC | Chức năng / actor chính | Kết quả tại baseline, loại kiểm chứng | Hạng mục |
|---|---|---|---|
| UC-1.1 | Khu/hàng/ô/GPS — Sếp | Một phần; UI/API read, quyền cấu hình sai; delete path lỗi CODE | BA-07,28,29 |
| UC-1.2 | Loại mộ/số slot — Sếp | Có catalog; thiếu chứng minh sửa cấu trúc an toàn với dữ liệu lịch sử, CODE | BA-07,29 |
| UC-1.3 | Trạng thái mộ — Quản trang | Sai thời điểm: ký PL làm OCCUPIED trước ngày chôn, SVC; thiếu command thực địa | BA-08,09,10,11,14 |
| UC-1.4 | Tra tình trạng mộ — public/nội bộ đúng scope | Một phần; UI/API, giới hạn danh sách và tìm mã ô | BA-02,25,26,27 |
| UC-1.5 | Dẫn đường — public/Quản trang | Có link Maps; map nội bộ không khởi tạo, UI; GPS thực chưa được đo ngoài hiện trường | BA-26,28 |
| UC-2.1 | Hồ sơ thân nhân — Marketing | Tạo được; sai actor cũng tạo 201; thiếu edit UI, UI/API/CODE | BA-01,02,25,30 |
| UC-2.2 | Người mất/giấy báo tử — Marketing | Có form; không file vẫn vượt gate giấy tờ, API/SVC | BA-08,30,35 |
| UC-2.3 | Liên kết hồ sơ — Marketing | Có modal và upsert; không còn coi là hoàn toàn thiếu; cần RBAC/current owner | BA-01,10,30 |
| UC-2.4 | Tra cứu hồ sơ — từng scope | Có tìm kiếm local trên danh sách bị cắt; DTO quá rộng, UI/API | BA-02,25 |
| UC-3.1 | Lập 4 loại HĐ — Marketing | Bốn wizard hiện diện; stale owner/reservation, giá dự phòng, CODE; chưa E2E cả 4 | BA-01,08,10,11,14,36 |
| UC-3.2 | In HĐ/PL — Marketing | PDF HĐ sinh 200; nội dung mẫu/loại/PL chưa đủ, API/CODE | BA-04,13 |
| UC-3.3 | Đính kèm bản ký — Marketing | Upload/read PDF thật chạy; ACL và link scan sai, API/CODE | BA-04,09,13,35 |
| UC-3.4 | PL an táng/thi công/chăm sóc — Marketing | Có BURIAL; care API ACTIVE ngay; thiếu full UI/legal lifecycle các PL, API/SVC/CODE | BA-08,09,12,13 |
| UC-3.5 | Theo dõi trạng thái/thời hạn PL — Marketing | Có hiển thị cơ bản; thiếu gia hạn có version và liên kết công việc, UI/CODE | BA-12,14,25,34 |
| UC-4.1 | Checklist thi công — Quản trang | Tự tạo 5 mục; thiếu full editor; nhận CARE annex khác mộ 201, UI/API | BA-15,17 |
| UC-4.2 | Phân công thi công — Quản trang | Nhân sự 500, input khó dùng; thiếu luồng tổ ngoài đầy đủ, UI/API/CODE | BA-05,17,18 |
| UC-4.3 | Checklist/bằng chứng thi công — Quản trang | Có thao tác nhưng không kín guard và tải file, UI/CODE | BA-16,20,35 |
| UC-4.4 | Tiến độ/nghiệm thu — Quản trang | PUT COMPLETED khi 5 task TODO vẫn 200, API; thiếu điều chỉnh có lý do | BA-16,17 |
| UC-4.5 | Theo dõi hạn/gia hạn — Quản trang→Marketing | Thiếu bàn giao gia hạn pháp lý đầy đủ, CODE | BA-12,14,17 |
| UC-5.1 | Đăng ký gói — Marketing | API201 ACTIVE không scan; thiếu UI đầy đủ, API/CODE | BA-12,19 |
| UC-5.2 | Sinh/đổi lịch — Quản trang | Capability UI thiếu; sinh theo tháng chưa diễn tả tần suất/snapshot, UI/API/CODE | BA-06,19 |
| UC-5.3 | Phân công care — Quản trang | UI POST405 vs PATCH; nghỉ vẫn assign 200, API | BA-05,06,17,18 |
| UC-5.4 | Xác nhận care — Quản trang | Không ảnh bị 400 đúng, nhưng URL giả đủ để close 200; sửa checklist CLOSED200 | BA-20,21,35 |
| UC-6.1 | Khoản phải thu — Kế toán | API có; UI thiếu tạo đợt thu/căn cứ; danh sách bị cắt, UI/CODE | BA-24,25 |
| UC-6.2 | Ghi thanh toán — Kế toán | Thu synthetic 30.00 sinh biên lai thật 201; payload/key và lỗi retry chưa đúng, API/FAULT | BA-11,22,23,24 |
| UC-6.3 | Biên lai — Kế toán | PDF đọc 200 đúng actor; Quản trang đi đường file chung 200; lỗi PDF không có tái tạo, API/CODE | BA-04,23,35 |
| UC-6.4 | Chiết khấu — Kế toán/quyền duyệt | Kế toán 403 do scope chưa seed; chính sách C12 chưa chốt, API/POLICY | BA-24 |
| UC-7.1 | Doanh thu thực thu — Kế toán/Sếp | Có báo cáo payments; quyền quá rộng, export bỏ filter, API/CODE | BA-03,31 |
| UC-7.2 | Thống kê mộ — Sếp | API/UI có; actor ngoài scope vẫn 200; cần bộ dữ liệu nhiều slot kiểm tổng | BA-03,31 |
| UC-7.3 | HĐ/PL — Sếp | Có báo cáo; scope/filter mẫu số cần thống nhất, UI/CODE | BA-03,25,31 |
| UC-7.4 | Vận hành — Sếp; Quản trang chỉ phạm vi công việc | Có báo cáo nhưng quyền chỉ reports:read; chưa tách projection, UI/API | BA-02,03,31 |
| UC-7.5 | Xuất file — theo loại báo cáo | XLSX/PDF thật chạy; vượt quyền, bỏ filter, API | BA-03,04,31 |
| UC-8.1 | Đăng nhập — nội bộ | Bốn actor login được; modal thấp cắt submit; session refresh cần kiểm sâu | BA-32,33 |
| UC-8.2 | Tài khoản — Sếp | Có UI/API; nonadminGET403 đúng; chưa E2E mọi nhánh khóa/thu hồi | BA-32 |
| UC-8.3 | Phân quyền — Sếp | Matrix chỉ đọc, capability lệch seed; chưa thống nhất actor policy | BA-01,06,07,32 |
| UC-8.4 | Loại/mẫu HĐ — Sếp | Có catalog; quyền rộng, mẫu in/version chưa bám dữ liệu, CODE | BA-07,13 |
| UC-8.5 | Gói dịch vụ — Sếp | Có catalog; chưa đóng băng checklist theo bản ký, CODE/API | BA-07,19 |
| UC-8.6 | Bảng giá — Sếp | Có catalog; Kế toán có quyền ghi được; giá fallback không an toàn, CODE | BA-07,36 |
| UC-8.7 | Audit — Sếp | Viewer có và nonadmin 403; chưa chứng minh đủ log/append-only DB, CODE/API | BA-30,32,37 |

## 4. Backlog thực thi chi tiết

Đường dẫn dưới đây tương đối từ repository root. Mỗi hạng mục phải sửa đủ router → service → dữ liệu → UI bị tác động; không đóng issue chỉ bằng ẩn nút. Không thêm “duyệt”/“thanh toán đủ” vào một luồng nếu nguồn không yêu cầu.

### BA-01 — P0 — Quyền ghi hồ sơ và pháp lý chỉ được bảo vệ ở giao diện

**Bằng chứng API/CODE:** CARETAKER và ACCOUNTANT POST `/profiles/customers` trả 201 trên Test. `profiles/router.py` và `contracts/router.py` nhiều command chỉ dùng `get_current_user`; “có đăng nhập” chưa là “được thực hiện nghiệp vụ”. Probe ID không tồn tại trả 404 ở command hợp đồng chỉ chứng minh đã qua authentication, không chứng minh tạo HĐ thành công trái quyền.

**Thực hiện:** lập danh sách mọi command create/update/delete/link/submit/activate/cancel/PDF; đặt capability cụ thể tại router và kiểm scope tài nguyên/current actor ở service. Truyền actor context xuống service thay vì chỉ bỏ tham số ở UI. Đóng quyền ghi của Kế toán/Quản trang vào hồ sơ/pháp lý; cấp kiêm nhiệm rõ ràng theo C16. Migrate permission/role_permission tăng dần, không reseed xóa vai trò đã cấp. Áp dụng một nguồn capability ở `web/src/context/*`, `App.tsx`, ProfileModule, ContractModule.

**Nghiệm thu:** cùng fixture hợp lệ, Marketing thực hiện được; hai actor kia nhận 403, không thay row/audit/outbox. Test đọc ID tồn tại, không tồn tại, đổi ID và gọi trực tiếp API. Giao diện đúng actor không có CTA ghi; trường hợp phiên bị thu hồi quyền hiển thị lý do và giữ dữ liệu nhập an toàn.

### BA-02 — P0 — DTO đọc trả quá nhiều dữ liệu cho actor

**Bằng chứng UI/API/CODE:** Quản trang/Kế toán đọc toàn bộ profiles/contracts; contract detail DTO chứa thông tin khách và tài chính; Quản trang còn sinh PDF hợp đồng 200 trong probe MinIO. `/plots` cũng chỉ yêu cầu đăng nhập ở một số read path. Giấu cột không loại dữ liệu khỏi network payload.

**Thực hiện:** định nghĩa allowlist `PublicMemorial`, `WorkBasis`, `FinanceBasis`, `LegalContractDetail`; tách endpoint hoặc serializer có kiểm scope. WorkBasis chỉ căn cứ, mộ/slot, nội dung kỹ thuật, thời hạn và trạng thái giấy tờ cần thiết, không giá/CCCD/scan. FinanceBasis chỉ nguồn nghĩa vụ thu và liên hệ cần thiết. Không dùng denylist vài field trên DTO pháp lý lớn. Chặn cả search/list/detail/export, relation expansion và file liên quan. Quản trang vào “Căn cứ công việc” thay cho “Hợp đồng đầy đủ”; Kế toán xem “Nguồn khoản thu”.

**Nghiệm thu:** snapshot JSON từng actor không có field cấm kể cả object lồng; số lượng/tổng hợp cũng đúng phạm vi. UI mobile hiển thị mã căn cứ dễ đọc và link công việc liên quan, không sao chép form pháp lý thu nhỏ.

### BA-03 — P0 — Quyền báo cáo và quyền xuất không khớp nhau

**Tái hiện API với MinIO thật:** Quản trang GET `/reports/revenue`403 nhưng POST `/reports/export` với REVENUE/XLSX201, trạng thái COMPLETED, tải qua `/reports/exports/{id}/download`200. Marketing/Kế toán có `reports:read` nên đọc cả 4 nhóm báo cáo. `reports/router.py:create_report_export` chỉ authentication, `ReportService.create_export` không authorize loại báo cáo.

**Thực hiện:** tách quyền đọc/xuất theo loại và data scope; dùng chung authorization cho màn hình, create export, worker, history, download. Job phải lưu actor/scope snapshot nhưng kiểm lại quyền lúc tải; thu hồi quyền không được tải file cũ ngoài phạm vi. Chủ sở hữu bản xuất không đồng nghĩa có quyền tạo báo cáo đó. Nav và export CTA theo cùng capability; Quản trang nếu được xem tổng hợp công việc thì dùng projection đúng scope, không mở báo cáo quản trị.

**Nghiệm thu:** mọi loại PDF/XLSX ×4 actor; người không được đọc không tạo/tải/export lại được, dù biết ID. Kế toán chỉ tài chính; Sếp đúng quyền đầy đủ; lịch sử không lộ filter/tên file ngoài scope. Kết hợp BA-04.

### BA-04 — P0 — Endpoint tài liệu chung vượt ACL nghiệp vụ

**Tái hiện API:** Quản trang tải biên lai qua finance 403 nhưng `/documents/{file_id}/download`200 cùng nội dung. Marketing tải export của Quản trang qua reports 403 nhưng đường documents 200. Quản trang preview bản ký Marketing upload 200. Guest không token 401 là chặn đúng cần giữ. `DocumentService.get_file` không nhận actor; link version chưa authorize đối tượng cha.

**Thực hiện:** thiết kế ownership/binding tài liệu theo contract/annex/certificate/payment/export/evidence, purpose, scope và lifecycle. Upload chưa gắn chỉ uploader trong thời hạn; gắn phải kiểm quyền cả file và parent/type. Đọc/preview/download phải authorize theo parent, không dựa vào UUID khó đoán hoặc bucket private. Một file nhiều binding không được vô tình cấp quyền rộng hơn dữ liệu chứa trong nó. Nếu dùng signed URL, cấp sau authorize, TTL ngắn, không log token; thu hồi quyền/publication có chiến lược hết hạn. Kiểm tra state READY và object tồn tại.

**Nghiệm thu:** ma trận file 5 loại ×actor; đúng vai tải 200, sai vai 403/404 theo quy ước thống nhất; biết file_id cũng không vượt. Người hết quyền và link hết hạn bị từ chối; không liệt kê raw object key ra public. Test bằng file synthetic thật trong MinIO, có cleanup exact key/version.

### BA-05 — P1 — Danh sách nhân sự lỗi SQL Server, form không báo lỗi

**Tái hiện UI/API:** `/auth/staff`500 với các actor; `auth/router.py` dùng `User.is_active.is_(True)`, SQL Server nhận `IS 1` không hợp lệ. Form tạo lệnh thi công chỉ còn lựa chọn placeholder giám sát, không nêu lỗi tải nhân sự.

**Thực hiện:** sửa biểu thức boolean MSSQL tương thích; lọc nhân sự active/đúng capability và trả DTO tối thiểu. Phân biệt account giám sát với nhân sự/tổ ngoài BA-17. Không nuốt fetch error thành `[]`; selector có loading, empty kèm hướng giải quyết, error/thử lại; chọn sai user phải bị server chặn.

**Nghiệm thu:** Test SQL Server thật trả 200, dropdown có actor được phép; user locked/không quyền không chọn được. Simulate 503 hiển thị retry và không cho submit lệnh thiếu người. Desktop/mobile selector không mở rộng vượt màn hình.

### BA-06 — P1 — Capability chăm sóc và HTTP method làm Quản trang không điều phối được

**Bằng chứng UI/API/CODE:** `CareModule.tsx` kiểm `care:manage` (không có trong 21 permission đã seed) hoặc ADMIN; CARETAKER có care:read/write/execute vẫn thiếu CTA quản lý. Hàm assign gọi POST, router khai báo PATCH; probe POST405. Không sửa bằng cấp ADMIN cho Quản trang.

**Thực hiện:** thống nhất capability care register/legal ở Marketing và schedule/coordinate/confirm ở Quản trang; đổi client theo contract PATCH hoặc version API có chủ đích. Tạo typed API client/OpenAPI kiểm method và response; loại hardcode role khi đã có capability. Chuẩn hóa navigation và trạng thái disabled/lý do theo permission của action.

**Nghiệm thu:** Quản trang thật mở sinh lịch/phân công/đóng ca; Marketing đăng ký gói qua pháp lý nhưng không có quyền điều phối chỉ vì `care:write` rộng. Contract test bắt lỗi method 405; test UI phải đi qua nút phân công, không chỉ gọi API. Giữ điều kiện xung đột BA-18.

### BA-07 — P1 — Quyền cấu hình lẫn với quyền tác nghiệp

**CODE/UI:** price item dùng finance:write (Kế toán có); care package dùng care:write (Marketing/Quản trang có); template dùng contracts:write (Marketing có); spatial write của Marketing rộng hơn nghiệp vụ quản trị. Catalog hiển thị hành động không nhất quán permission; Quản trang thấy CTA thêm ô dù backend có thể chặn.

**Thực hiện:** tách catalog/spatial manage của Sếp khỏi capability dùng bảng giá/gói/mẫu. Read danh mục chọn trong form không đồng nghĩa được sửa danh mục. Chuyển UI catalog sang read-only theo scope hoặc bỏ mục không thuộc actor; server vẫn authorize mọi write. Migration quyền phải bảo toàn vai trò tùy chỉnh và ghi trước/sau.

**Nghiệm thu:** ba actor nghiệp vụ đọc được danh mục cần dùng, không PUT/POST/DELETE cấu hình; Sếp được sửa hợp lệ. Giá/mẫu/gói đã ký không bị hồi tố (BA-13/19/36). Không còn nút thao tác chắc chắn 403 trong normal state.

### BA-08 — P0 — Có bản ghi giấy báo tử bị coi là có giấy hợp lệ

**Tái hiện API/SVC:** tạo người mất kèm số giấy/cơ quan/ngày nhưng không `file_id` hoặc URL vẫn 201; `check_death_certificate_verified` trả true và tạo PL an táng được. Helper chỉ kiểm tồn tại; lưu giấy tự đặt is_verified=true nhưng verified_by=None. Chưa kiểm READY/object/file thuộc đúng hồ sơ.

**Thực hiện:** cho phép hồ sơ người mất ở trạng thái chờ bổ sung, nhưng server chặn lưu PL an táng khi chưa đủ giấy hợp lệ theo UC. Có thể giữ workflow một bước “lưu giấy và xác nhận đã kiểm tra” phù hợp giao diện hiện tại; **không tự khôi phục quy trình nhiều bước duyệt đã bị bỏ**. Bước xác nhận cần file thật hợp lệ gắn đúng hồ sơ, actor/thời gian/version, audit. Hợp lệ không chỉ là bool client; thay scan phải tạo version và xem xét hiệu lực xác minh. Rà các gate cremation/burial cùng helper.

**Nghiệm thu:** thiếu file, file NOT_READY/không tồn tại/sai hồ sơ, actor không quyền đều bị chặn; hồ sơ draft vẫn lưu được. Giấy đủ điều kiện cho PL lưu; lưu lại không tạo bản xác minh mơ hồ. UI nêu thiếu mục nào và CTA bổ sung ngay tại người mất/PL, không ghi “đã duyệt” khi chỉ nhập số giấy.

### BA-09 — P0 — Kích hoạt pháp lý bị dùng làm xác nhận an táng/cải táng thực tế

**Tái hiện SVC:** ngày burial dự kiến sau ngày audit 30 ngày, activate PL đã ký làm annex ACTIVE, slot/plot OCCUPIED ngay. Actor là Marketing, proof là scan pháp lý. CODE `_activate_exhumation` cũng giải phóng slot và ghi EXHUMED lúc kích hoạt HĐ.

**Thực hiện:** tách state pháp lý và state execution. Ký → ACTIVE/đủ điều kiện làm việc; command Quản trang xác nhận an táng/cải táng thực tế mới cập nhật history/slot/plot và khóa Kim Tĩnh. Lưu actual_at, confirmer, đúng slot/deceased và evidence được phép; điều kiện ký/giấy tờ/owner/invariants kiểm lại ngay lúc xác nhận. Không yêu cầu đóng đủ công nợ trước ACTIVE nếu không có policy. Không dùng thi công 100% thay chứng cứ hạ huyệt. Không tự “sửa ngược” lịch sử thật đã có; cần report đối soát và migration/repair được xem xét riêng.

**Nghiệm thu:** KT07–KT14: ký và xây xong vẫn chưa BURIED; actual confirm mới đổi trạng thái một lần; cải táng 1 slot giữ owner/slot khác; Kim Tĩnh chặn kể cả ADMIN. UI có timeline riêng “Pháp lý”/“Thực hiện”, nhãn/nút phân biệt rõ, mobile không đặt hai hành động xác nhận cạnh nhau dễ nhầm.

### BA-10 — P0 — Không kiểm lại căn cứ sở hữu/giữ chỗ ở thời điểm quyết định

**CODE:** `_activate_land_purchase` gán owner/status khi tìm được plot mà chưa kiểm chặt reservation còn hiệu lực/đúng HĐ/current owner. `_activate_transfer` có đóng ownership cũ và tạo ownership mới — **phải bảo toàn phần đã đúng này** — nhưng thiếu kiểm seller vẫn là chủ tại lúc activate. HĐ LAND cũ vẫn ACTIVE; `create_burial_annex` dựa LAND ACTIVE mà chưa buộc current owner tương ứng. Hủy/hết hạn giữ chỗ có nhánh dễ để trạng thái plot và reservation lệch nhau.

**Thực hiện:** kiểm lại atomically trạng thái, owner, slot, reservation holder/expiry, tài liệu và basis trước activate/cancel/transfer/field confirm. Chỉ giải phóng reservation thuộc command đó. Ghi ownership chain đầy đủ và xử lý quyền chủ cũ; C06 quyết định căn cứ PL của chủ mới, C07 nghĩa vụ còn tồn sau transfer. Không đổi customer trên HĐ lịch sử để “sửa chủ”; không tự hủy công nợ cũ. Stale UI phải nhận 409 và tải dữ liệu hiện tại.

**Nghiệm thu:** thay owner/expiry giữa draft và activate; hai bản chuyển nhượng nối tiếp; chủ cũ tạo PL; cancel một HĐ khi plot đã thuộc HĐ khác; reservation hết hạn sau retry. Xác nhận ownership lịch sử vốn có vẫn đúng, đúng một record hiện hành; quyền sử dụng căn cứ mới khớp C06.

### BA-11 — P0 (rủi ro CODE) — `with_for_update` chưa chứng minh khóa trên MSSQL

**Bằng chứng:** SQLAlchemy compile SELECT Plot `.with_for_update()` cho dialect MSSQL không tạo `FOR UPDATE` hay `UPDLOCK/HOLDLOCK`. Đây là **rủi ro**, chưa chạy hai transaction đồng thời để khẳng định double booking/thu trùng đã xảy ra. Một số unique/check/trigger có thể chặn từng trường hợp, không thay kiểm chứng aggregate.

**Thực hiện:** chọn isolation/lock hints hoặc update có điều kiện với rowversion tương thích MSSQL; thống nhất thứ tự khóa plot→slots→reservation/ownership và receivable→payment để giảm deadlock. Revalidate deceased không đang ở slot khác tại actual confirm, không chỉ lúc tạo draft. Unique constraints đúng nghiệp vụ làm lớp cuối. Transaction service không commit rải rác; router không chứa business logic.

**Nghiệm thu bắt buộc:** hai kết nối SQL Server độc lập có barrier cho giữ 1 ô, mua/transfer cùng ô, chôn 1 người 2 slot, hai khoản thu sát dư nợ, retry cùng key. Một kết quả hợp lệ hoặc retry có kiểm soát; không âm tiền/trùng quyền/trùng chôn. Kiểm cả timeout/deadlock rollback. Test SQLite hoặc một Session không đủ chứng minh.

### BA-12 — P1 — Thiếu vòng đời đầy đủ của phụ lục chăm sóc/thi công/gia hạn

**UI/API/CODE:** ContractModule chủ yếu có +BURIAL; CareModule điều phối không phải form đăng ký pháp lý. POST `/care/annexes`201 tạo ACTIVE khi chưa có scan. Không có đầy đủ command/UI PL CONSTRUCTION, in từng loại, ký, gia hạn version theo UC-3.4/4.5.

**Thực hiện:** tái sử dụng aggregate Annex với subtype BURIAL/CONSTRUCTION/CARE và command riêng có validator. Marketing chọn current legal basis, scope plot/slot, dịch vụ/gói, điều khoản/kỳ/giá snapshot → draft → in → chờ ký → scan/version → ACTIVE. Chỉ ACTIVE mới sinh nghĩa vụ/lịch/căn cứ thi công đúng policy, idempotent; gia hạn tạo văn bản và quan hệ predecessor/successor, không sửa trực tiếp ngày hết hạn bản ký. Quản trang gửi yêu cầu gia hạn kèm lý do để Marketing xử lý.

**Nghiệm thu:** tạo ba subtype từ UI đúng actor; chưa scan không ACTIVE; subtype/id khác plot bị chặn; cùng activate không nhân đôi nghĩa vụ/ca. Phụ lục cũ vẫn xem/in đúng version sau gia hạn. Mobile wizard chia bước ngắn, có summary trước xác nhận, giữ draft khi back/lỗi mạng.

### BA-13 — P1 — PDF chưa bám nội dung mẫu và phiên bản pháp lý

**API/CODE:** PDF HĐ thật sinh 200, nhưng `ContractService.generate_contract_pdf` truyền trường chung vào PDFService, chưa render đầy đủ template `content_html` đã chọn và điều khoản theo 4 loại. Mẫu chuyển nhượng/hỏa táng/PL cần nội dung chuyên biệt. `bump_template_version` sửa cùng row, chỉ lưu số version không giữ nội dung cũ đầy đủ. Nội dung liên hệ hardcode giữa web/PDF cũng không thống nhất.

**Thực hiện:** lưu immutable template revision + snapshot nội dung/dữ liệu in ở thời điểm chốt; renderer theo subtype và đủ bên ký, đối tượng, dịch vụ, điều khoản, đơn vị, ngày, slot nếu có. Không thêm plot vào cremation khi không có. Version scan gắn đúng revision; in lại hồ sơ cũ không lấy mẫu/giá mới. C21 quyết định quản trị mẫu/kiểu PL; thông tin cơ sở lấy config đã xác nhận, không bịa hotline/địa chỉ.

**Nghiệm thu:** fixture 4 HĐ+3 PL; trích text PDF để đối chiếu trường rồi render kiểm dấu Việt, ngắt trang/chữ ký, bảng dài; so SHA/version khi sửa mẫu và in lại. Desktop/mobile preview có download, zoom/scroll và lỗi/thử lại; không nhét toàn PDF vào cột hẹp.

### BA-14 — P1 — Thiếu bàn giao công việc và kết thúc dịch vụ ngoài pháp lý

**CODE/UI:** chưa có workspace căn cứ tối thiểu và queue thực hiện an táng/cải táng rõ ràng; hỏa táng có HĐ nhưng thiếu chuỗi lịch thực hiện, bàn giao tro cốt/biên bản, hoàn thành theo AD04. Theo dõi hạn PL còn rời rạc, thiếu điều hướng từ quá hạn tới xử lý văn bản.

**Thực hiện:** dùng WorkBasis từ BA-02 và execution của BA-09; queue theo trạng thái/ngày/đúng scope. Thêm lịch, người phụ trách, checklist/bằng chứng/biên bản cần thiết cho từng dịch vụ. Hỏa táng độc lập plot; C20 quyết định actor xác nhận hoàn thành, không đoán. Quá hạn có lý do, CTA yêu cầu gia hạn; Quản trang không tự kéo dài pháp lý. Outbox/notification có handler thật, trạng thái retry và idempotency.

**Nghiệm thu:** Marketing bàn giao ACTIVE, Quản trang thấy đúng phạm vi, giấy chưa đủ không thực hiện; hoàn tất đúng actor sinh một event và lịch sử. Cải táng giữ chủ; cremation không chiếm ô. Tablet/điện thoại ưu tiên việc hôm nay/quá hạn và mã mộ, không đưa full hồ sơ pháp lý vào card.

### BA-15 — P0 — Lệnh thi công nhận sai loại phụ lục và sai mộ

**Tái hiện UI/API:** form hỏi `Mã Phụ Lục` và `Mã Mộ (Plot ID)` dạng số thô; POST construction/orders nhận CARE annex ACTIVE và plot khác vẫn 201, tự tạo 5 task. `ConstructionService.create_order` chưa kiểm đủ subtype/scope của căn cứ.

**Thực hiện:** tạo eligible WorkBasis selector bằng mã PL/mã mộ/tên công việc; chọn căn cứ tự điền scope, không cho sửa plot tùy ý. Service xác nhận đúng loại pháp lý, ACTIVE/chưa hết hiệu lực, scope plot/slot, chủ và điều kiện Kim Tĩnh; loại công việc được phép phải rõ, không coi mọi thi công là xây Kim Tĩnh. C19 quyết định một PL cho phép mấy lệnh; dùng idempotency và constraint theo quyết định đó.

**Nghiệm thu:** CARE/BURIAL không được dùng thay PL thi công khi policy không cho; sai plot/slot, hết hạn, đã dùng vượt policy, sửa ID thủ công đều 400/409. Quản trang chọn bằng thông tin nghiệp vụ ở mobile; không phải nhớ ID database. Giữ lỗi inline và dữ liệu form khi server từ chối.

### BA-16 — P0 — Bỏ qua nghiệm thu bằng cập nhật trạng thái chung

**Tái hiện API:** tạo lệnh 5 task TODO, PUT `/construction/orders/{id}` với `status=COMPLETED` trả 200, progress 0.00, cả 5 task TODO. Các guard tại endpoint complete không bảo vệ đường update tổng quát. Cần rà thêm sửa/thêm task sau hoàn tất.

**Thực hiện:** không nhận status tự do trong generic update. Mọi chuyển trạng thái đi qua một state machine/service; complete kiểm task bắt buộc, bằng chứng đúng file, confirmer và tình trạng pháp lý. Cấm sửa checklist/evidence hồi tố sau completed trừ quy trình reopen/correction được định nghĩa có audit (C14/C18). Sửa tiến độ thủ công không đồng nghĩa nghiệm thu.

**Nghiệm thu:** thử PUT/PATCH/complete, update task cuối cùng, bulk command, gọi lặp và actor sai. Chưa đủ việc/ảnh vẫn chưa complete; đủ điều kiện cho một lần hoàn tất; phần trăm ngoài 0–100 bị chặn. UI tách “Cập nhật tiến độ” và “Nghiệm thu”, trình bày danh sách điều kiện còn thiếu, không chỉ tô xanh 100%.

### BA-17 — P1 — Điều phối chưa biểu diễn đủ người/tổ ngoài, checklist và tiến độ

**UI/CODE:** construction model đã có một số field người/tổ nhưng form chủ yếu chọn supervisor rồi tự tạo 5 task gán cho supervisor. UI chưa nối đủ create/edit/reassign task; care chỉ caretaker_id. Thiếu luồng thực dụng phân biệt người giao, giám sát, người/tổ thực hiện, người xác nhận; thiếu điều chỉnh tiến độ có lý do.

**Thực hiện:** thiết kế work party/danh bạ cá nhân/tổ/nhà thầu ngoài không bắt có account; supervisor/confirmer là user có quyền. Lưu người giao và lịch sử thay người, khoảng thời gian, kỹ năng/phạm vi nếu được chốt. Checklist có thứ tự, required/optional theo C18, assignee, thời gian, bằng chứng; UI thêm/sửa/sắp xếp/phân công có quyền. Điều chỉnh phần trăm nếu UC cho phép phải kèm lý do, actor và snapshot trước/sau; hiển thị riêng tiến độ tính từ checklist. Không hardcode 5 mục cho mọi loại lệnh.

**Nghiệm thu:** Quản trang A giao tổ ngoài, B giám sát, C xác nhận theo quyền; tổ ngoài không phải tạo tài khoản. Mỗi mục có người/tổ, deadline; đổi người giữ lịch sử; đã hoàn tất không sửa lén. Mobile checklist một cột, checkbox/chụp ảnh dễ chạm, thông tin người thực hiện không chen với action.

### BA-18 — P1 — Phân công khi người nhận nghỉ vẫn được lưu

**Tái hiện API:** PATCH care assign trả 200, `has_conflict=true`, caretaker_id đã được lưu dù có StaffUnavailability trùm kỳ; status vẫn SCHEDULED. Construction có nhánh gọi kiểm tra conflict nhưng không sử dụng kết quả để chặn. Chưa kiểm đủ lịch care/construction chồng nhau.

**Thực hiện:** availability service dùng chung, kiểm ngày/giờ, nghỉ và công việc đã giao; định nghĩa đơn vị capacity theo policy có thật. Conflict chưa giải quyết phải trả 409 và không lưu assignment; trả chi tiết tối thiểu phục vụ đổi người/đổi lịch. Thay assignment atomically, chuyển trạng thái đúng state machine. Không mặc định “cảnh báo nhưng cứ lưu” thay UC-5.3.

**Nghiệm thu:** nghỉ, ca trùng, hai người phân công đồng thời, đổi lịch, user locked; không để assignment mới khi conflict. UI thể hiện xung đột ngay tại selector và đưa lựa chọn sửa lịch/chọn người; đóng modal không xóa ngầm assignment cũ.

### BA-19 — P1 — Sinh lịch chưa tách tần suất, thời hạn và thỏa thuận đã ký

**CODE/API:** generate care theo tháng, chưa diễn giải đầy đủ package.cycle_type/cycle_months; task template đọc gói hiện tại khi sinh lịch, dễ làm thay thỏa thuận cũ. Unique care_annex+period giúp chống một kiểu trùng, chưa xử lý nhiều PL trùng ô/kỳ. Đã sinh được lịch synthetic nhưng chưa chứng minh đúng mọi chu kỳ.

**Thực hiện:** chốt C08/C10 trước: tần suất thực hiện ≠ thời hạn hợp đồng ≠ kỳ thanh toán. Lưu snapshot giá/checklist/rule lịch lúc ký; sửa gói chỉ tác động đăng ký mới. Định nghĩa canonical occurrence key (basis, scope, kỳ/lần thực hiện) và quy tắc overlap; job chạy lại idempotent, có reschedule và lịch sử, hết hạn không sinh thêm. Migration cũ cần provenance và report các record không xác định được chu kỳ, không đoán.

**Nghiệm thu:** tháng ngắn/cuối tháng/năm nhuận, chạy lại, dời 1 ca, đổi gói sau ký, hai PL cùng ô/kỳ, gia hạn nối tiếp. UI hiển thị “thực hiện…/hiệu lực…/thu phí…” bằng nhãn riêng và preview số lần, không nhập chuỗi period như cú pháp backend.

### BA-20 — P0 — Bằng chứng không tồn tại vẫn đủ đóng ca, CLOSED vẫn bị sửa

**Tái hiện API:** checklist đủ nhưng không ảnh →400 (guard đúng). Thêm `media_url=https://example.invalid/SYNTHETIC-NOT-A-FILE.jpg` →201; close→200 CLOSED. Sau đó PATCH required checklist false→200. Phép thử đã expire ORM mỗi request; kết quả chặn close ở lần thử đầu do cache đã được loại, không dùng làm bằng chứng đạt.

**Thực hiện:** evidence phải dùng file_id READY, object thật, MIME/kích thước phù hợp, upload/parent/scope được phép và metadata người/thời gian. Không cho URL tùy ý thay bằng chứng upload. Khi close kiểm lại mọi điều kiện trong transaction; mọi command thêm/xóa/đổi evidence/checklist sau CLOSED phải bị chặn hoặc đi correction có policy và audit. Không kiểm đủ ảnh chỉ bằng count row. C18 quyết định số lượng ảnh/việc required, không hardcode ngưỡng tùy ý.

**Nghiệm thu:** nonexistent URL/file, object mất, file PDF thay ảnh, file của mộ khác, user sai, thiếu required đều không close. Đóng hợp lệ rồi sửa checklist/upload/delete/reclose phải nhất quán. UI có thumbnail và trạng thái upload riêng, “đã đóng” chỉ khi server xác nhận, không dựa optimistic checkbox.

### BA-21 — P1 — Thiếu công bố kết quả chăm sóc cho thân nhân

**UI/CODE/POLICY:** cổng public giới thiệu kết quả/lịch sử chăm sóc nhưng API public chủ yếu người mất/vị trí; thiếu projection và luồng publication/notification hoàn chỉnh từ ca đóng. Outbox event tồn tại không chứng minh có handler gửi thông báo hoặc nội dung đã công bố.

**Thực hiện:** chốt C09 về eligibility, approver, redaction, ảnh được phép, thu hồi. Tạo public projection riêng gồm ngày thực hiện, tóm tắt phù hợp, ảnh đã duyệt; không đưa private evidence URL hay nhân sự/giấy tờ nội bộ. Kết quả CLOSED là đầu vào xét công bố, không tự công khai toàn bộ. Outbox handler idempotent, audit publication/revoke, trạng thái thất bại để xử lý lại.

**Nghiệm thu:** ca private không xuất hiện; approved hiện đúng mộ, không PII; revoke không còn truy cập qua link cũ theo TTL đã định; retry event không nhân thông báo. UI public có empty trung tính, không hứa dữ liệu chưa có; card chăm sóc mobile có ảnh tỉ lệ ổn định và tải lỗi/thử lại.

### BA-22 — P0 — Khóa chống trùng thanh toán không được dùng như một command bền vững

**Tái hiện API/CODE:** cùng key nhưng paid_amount 30.00→40.00 vẫn 201 và trả payment cũ 30.00; hash được tính nhưng không so sánh. Gọi khoản không tồn tại 404 rồi retry cùng key→409 IN_PROGRESS. Client tạo key mới mỗi lần submit; backend cho phép thiếu key. Hàm tìm payment vừa tạo bằng amount+actor+sort latest có rủi ro lấy nhầm dưới cạnh tranh.

**Thực hiện:** key bắt buộc và giữ ổn định cho một ý định thu; hash canonical đủ receivable/amount/method/reference, cùng key khác payload→409 riêng. Validate trước khi đăng ký hoặc lưu trạng thái FAILED có retry semantics; xử lý IN_PROGRESS có thời hạn/recovery, không tạo key mới để né lỗi. Lấy payment_id chính xác của insert với cơ chế MSSQL/trigger phù hợp. Amount dùng Decimal/string xuyên boundary, server làm tròn ROUND_HALF_UP; UI không quyết toán bằng Number/float. Serialize receivable transaction theo BA-11.

**Nghiệm thu:** double click, mất response, refresh/retry, cùng key khác khoản nợ/khác số tiền, key cũ sau 400/404/500, hai tab. Một intent có một payment, client phục hồi trạng thái từ server; không mất dữ liệu form hoặc mời người dùng bấm thu lần nữa khi chưa biết kết quả.

### BA-23 — P0 — Ghi tiền và tạo biên lai bị ghép thành một kết quả lỗi mơ hồ

**API/FAULT/CODE:** happy path thu 30.00 sinh invoice/PDF thật, đúng actor tải 200. Fault tại upload receipt cho 500; trong transaction test đã có payment 10.00 nhưng chưa invoice; retry cùng key 409. CODE có commit payment trước render/upload, và chưa có command regenerate receipt. Harness flush/rollback **chưa xác nhận payment bền vững qua connection thứ hai sau lỗi**; cần test đó.

**Thực hiện:** payment là sự kiện tài chính append-only, transaction lưu payment/balance/idempotency/outbox atomically; receipt là kết quả có trạng thái PENDING/READY/FAILED, retry theo payment_id không tạo payment mới. Unique invoice/payment, job idempotent, lưu lỗi có redaction; API trả rõ “đã ghi nhận tiền, biên lai đang xử lý” khi phù hợp. Tạo endpoint regenerate/status/download có finance ACL. Không yêu cầu rollback tiền đã thực nhận chỉ vì MinIO/PDF lỗi. UI lịch sử hiện pending/error + “Tạo lại biên lai”, CTA thu bị chống trùng.

**Nghiệm thu:** MinIO/PDF timeout trước/sau upload, worker retry, mất response; commit thật trên Test và đọc connection khác xác nhận một payment/tổng nợ đúng, cuối cùng một invoice. Biên lai tải/preview khớp amount/method/date/source, tiếng Việt và số tiền bằng chữ. Bốn object audit đã cleanup không dùng làm fixture còn tồn.

### BA-24 — P1 — Luồng Kế toán thiếu thao tác nguồn thu và chiết khấu đúng quyền

**UI/API/CODE/POLICY:** chưa có UI đầy đủ tạo khoản phải thu/đợt từ căn cứ; API có. Kế toán áp discount 403 vì `finance:discount` không được seed. FIXED_AMOUNT dùng min với original có thể âm thầm giảm giá trị yêu cầu thay vì báo vượt; policy trần/base/duyệt C12 chưa chốt. Payment chỉ nhận thời gian server, chưa có quy trình ghi ngày thu thực tế/điều chỉnh theo yêu cầu nếu cần.

**Thực hiện:** form chọn FinanceBasis, khách đúng basis, installment/dues/amount snapshot, tổng các đợt đối soát nghĩa vụ và source XOR. Hiển thị công nợ/phải thu/đã thu/tồn tách biệt; bảng lịch sử append-only, không dùng ảnh chuyển khoản thay xác nhận thực nhận. C12 quyết định quyền nhập/duyệt/mức giảm/base sau đã thu; seed đúng scope, lưu request/approver nếu policy cần. C11/C28 quyết định overpay/giảm về 0; tạm chặn nhánh chưa có quy trình thay vì tự refund/writeoff. Quyền thu dùng capability collect rõ ràng, không lẫn config finance write.

**Nghiệm thu:** chia đợt, thu 3+7 theo KT28, không có basis hoặc sai khách, nguồn kép, giảm thiếu lý do/vượt trần/đã trả đủ, actor sai; số tiền không âm. Mobile hiển thị dư nợ và số thu lớn rõ, nhập tiền không phụ thuộc hover, xác nhận cuối có đủ nguồn/số tiền/phương thức. Không tự sửa nghiệp vụ chỉ để form dễ chạy.

### BA-25 — P1 — Phân trang local trên dữ liệu bị cắt gây mất hồ sơ và tổng sai

**UI/API/CODE:** main có 1081 customers/928 contracts/1027 plots, nhưng web lấy 100 profiles,300 contracts,500 plots rồi tìm/lọc/phân trang local; finance default 50, care/construction 100. Selector HĐ còn lấy 100 plots rồi lọc loại/trạng thái, nên mộ hợp lệ phía sau có thể không chọn được. KPI tính từ subset dễ bị hiểu là tổng toàn hệ thống; “Doanh thu hiệu lực” từ giá trị HĐ không phải tiền thực thu.

**Thực hiện:** chuẩn hóa list envelope `items,total,page/page_size` hoặc cursor+has_more theo nhu cầu; search/filter/sort/pagination phía server, stable order. Selector có endpoint eligible và server search; aggregate endpoint cùng filter/scope. Không tăng limit lên vài nghìn để giải quyết giả. Giữ filter/page trong URL, hủy request cũ, loading skeleton cho dữ liệu trang mới. Đổi nhãn đúng nghĩa “Giá trị hợp đồng” vs “Thực thu”.

**Nghiệm thu:** fixture lớn hơn mọi limit, tìm record ở cuối, filter trả đúng total, page cuối, xóa record cuối, tìm không dấu nếu yêu cầu, actor scope. So dashboard với SQL/aggregate đã kiểm, không cộng toàn cục từ một trang. Mobile card có đủ mã/trạng thái/hành động, phân trang không chen toolbar.

### BA-26 — P1 — Public gợi ý tìm mã mộ nhưng backend chỉ tìm tên/mã người mất

**UI/CODE:** UI gợi ý A1/Khu/mã mộ; `public_lookup_deceased` chỉ ilike full_name/deceased_code, limit 20 không tiếp trang. Kết quả tên trùng/các hồ sơ chưa có vị trí cần phân biệt và kiểm eligibility công bố, không suy luận “mọi deceased được public”.

**Thực hiện:** query public theo tên và mã vị trí đã công bố; join hiện trạng plot/slot đúng, tránh duplicates/history đã cải táng bị hiện như đang chôn. Có định danh để mở memorial detail, ngày mất/năm sinh độ chính xác/zone-row-plot để phân biệt. Sửa gợi ý theo dữ liệu và tìm kiếm thực; phân trang/giới hạn rõ. GPS chưa xác nhận/thiếu thì nêu mã vị trí và hỗ trợ, không tạo tọa độ minh họa như thật.

**Nghiệm thu:** tên trùng, tên không dấu theo quy ước, mã ô/mã khu, trên 20 kết quả, cải táng/chuyển vị trí, hồ sơ chưa công bố; public không PII hay file private. Deep link mở đúng hồ sơ và nút dẫn đường chỉ có khi tọa độ hợp lệ.

### BA-27 — P1 — Lỗi tra cứu làm trắng toàn ứng dụng

**Tái hiện UI/FAULT:** response 503 `{detail:...}`, bấm Tìm Kiếm làm `items.slice is not a function`, `#root` rỗng. Nhánh submit parseJSON/setResults không kiểm res.ok/shape; nhánh debounce có thể xử lý khác và race.

**Thực hiện:** một hàm search dùng typed response validation, AbortController/requestid, error state có retry giữ query; không set error object làm list. ErrorBoundary cho từng workspace, không dùng nó thay xử lý fetch. Formsubmit/Enter/debounce cùng logic, tránh request trùng. Empty khác error, không khuyên tạo hồ sơ khi public không có quyền.

**Nghiệm thu:** 401/403/422/500/503, offline/timeout, JSON sai, query A chậm hơn B; luôn hiện shell/menu/query và CTA retry, không lỗi console chưa xử lý. Đo desktop và mobile, không overlay toàn trang cho lỗi một card.

### BA-28 — P1 — Leaflet không tồn tại trong vùng bản đồ đã render

**Tái hiện UI/CODE:** Quản trang mở map 390, `.plot-map-container` rỗng và số `.leaflet-container=0`. `PlotMapModule` init map theo effect trong khi loading thay DOM; ref/instance không đi cùng lifecycle container, thiếu cleanup/resize đầy đủ. Không quy lỗi này cho MinIO.

**Thực hiện:** component map quản lý mount/unmount độc lập loading; init khi node thật tồn tại, cleanup instance/listeners, cập nhật markers có deps đúng, invalidateSize sau drawer/tab/viewport. Không fetch toàn bộ mộ qua map 100/500 rồi coi là complete; bounds query/cluster hoặc danh sách tương ứng. Loading tiles/offline có fallback sơ đồ/list, thiếu GPS không gắn marker giả.

**Nghiệm thu:** tải đầu, đổi tab rồi quay lại, logout/login, resize 1440→390, mở detail, pan/zoom, chậm API/tile fail; chỉ một map instance, marker tương ứng records, không “container already initialized”. Điện thoại không bị map nuốt cuộn ngoài vùng map; legend gọn và accessible.

### BA-29 — P1 — Xóa ô tham chiếu thuộc tính không có; cần bảo toàn cấu trúc lịch sử

**CODE:** `PlotService.delete_plot` dùng `Contract.plot_id`, trong khi plot nằm ở subtype LAND/EXHUMATION/TRANSFER; đường đủ điều kiện đi tới đó sẽ lỗi AttributeError. Chưa thực hiện delete live để chứng minh HTTP500. Cập nhật loại/số slot cần phân biệt thay template cho ô tương lai và sửa ô đã có dữ liệu.

**Thực hiện:** query toàn bộ các dependency đúng TPT: contract subtypes, annex, slot/history/ownership/reservation/work. Không harddelete ô có lịch sử; archive nếu policy cho phép, báo blockers có link. Sửa loại/template không hạ slot đã dùng hoặc đổi cấu trúc Kim Tĩnh đã khóa; migration số slot kiểm trước/backfill/constraints sau. Giữ implicit_returning=false trên plots có trigger.

**Nghiệm thu:** ô trống không ràng buộc xóa hợp lệ; ô có history/chủ/reservation/annex/slot đang dùng bị chặn có lý do; sửa GPS/metadata theo policy không vô hiệu lock. UI confirm nêu mã ô và ảnh hưởng, không hiển thị thao tác xóa cho actor không quyền.

### BA-30 — P1 — Hồ sơ thiếu luồng chỉnh sửa đầy đủ và dấu vết người sửa

**UI/CODE:** đã có tạo khách/người mất, chỉnh giấy và sửa/liên kết quan hệ; không còn mô tả “chưa có liên kết”. Nhưng không thấy call PUT sửa khách/người mất tương ứng API, và nhiều service profile không nhận actor để ghi audit. Quyền relation không thể thay quyền chủ mộ.

**Thực hiện:** bổ sung detail/edit theo Marketing với prefill/validation/xác nhận khi còn dữ liệu chưa lưu, concurrency version, before/after audit actor/reason khi sửa thông tin pháp lý. Lưu độ chính xác ngày sinh UNKNOWN/YEAR_ONLY/EXACT, không điền ngày tháng giả chỉ để qua required. Chặn duplicate theo rule đã chốt; sửa parent không tự thay customer HĐ đã ký. Quan hệ là liên hệ/thân nhân, current owner lấy ownership.

**Nghiệm thu:** sửa CCCD trùng, tên Việt dài, thiếu ngày sinh/giấy tờ, hai tab sửa, thay quan hệ, record có lịch sử; quyền ghi đúng, audit có trước/sau không secret. Modal mobile cuộn body/cố định CTA theo BA-33, error ở trường cụ thể và giữ bản nhập.

### BA-31 — P1 — File báo cáo không áp dụng cùng bộ lọc màn hình

**Tái hiện API:** fixture chỉ có 1 paymentCASH; export REVENUE filter BANK_TRANSFER vẫn record_count 1. GET revenue với BANK_TRANSFER trả báo cáo rỗng. `create_export` chỉ parse start/end, bỏ filter phương thức/zone/status liên quan; các nhánh PL trong report contract cũng cần đồng bộ lọc.

**Thực hiện:** query model chuẩn theo từng report, validate filter và dùng cùng service snapshot cho UI/export. Lưu filter chuẩn hóa+timezone+scope+as_of trong metadata; file in bộ lọc và thời điểm. Aggregate tại DB tránh join nhân đôi slots/annex/payment; đo actual performance rồi đẩy export lớn qua job bền vững, không khẳng định đạt NFR từ việc có bảng jobs. UI status PENDING/READY/FAILED, lịch sử đúng scope.

**Nghiệm thu:** cùng filter UI/PDF/XLSX khớp count/total, tổ hợp zone/status/date/method; ngày biên múi giờ, ô nhiều slot, Kim Tĩnh nhóm chồng, HĐ chưa thu và đã thu. Query không được phép bị chặn BA-03. Download có feedback và retry không tạo snapshot trùng không cần thiết.

### BA-32 — P1 — Quản trị quyền, phiên và audit chưa có bằng chứng xuyên suốt

**UI/CODE:** role matrix hiện chủ yếu readonly; có gán role user nhưng chưa quản lý permission role đầy đủ theo UC-8.3. Backend có auth_version/thu hồi là nền tốt; UI refresh chủ yếu lúc startup, chưa có HTTP client thống nhất phục hồi 401. Một số write catalog/auth/profile thiếu đường audit nhất quán; viewer read 403 đúng không chứng minh append-only DB.

**Thực hiện:** chốt UC-8.3 quản trị tập quyền hay chỉ gán role preset; nếu là permission editor phải có diff/confirm, audit, version và chống tự khóa quản trị hợp lệ. Refresh single-flight, retry request an toàn; không tự replay command thu/activate không key. Thu hồi quyền cập nhật nav/scope và chặn files/job results. Audit bao phủ thay đổi quan trọng, lọc đúng actor, redact token/password, DB credential runtime không UPDATE/DELETE audit. ADMIN bypass capability không được bypass domain invariant; C16 kiêm nhiệm minh bạch.

**Nghiệm thu:** KT36/37 khóa user/đổi role trong phiên, access/refresh cũ, tab khác, download cũ, chỉnh role trái phép; audit có actor/reason/target/before/after/phạm vi dữ liệu phù hợp. Không claim pass những ca session này trước khi có test thật. Mobile matrix chuyển thành detail permission theo nhóm, không nén bảng rộng đến khó đọc.

### BA-33 — P1 — Modal thấp và tương tác bàn phím chưa dùng được trọn vẹn

**UI:** login 390×320 có card height 294/scrollHeight 372, overflowY hidden; sau cuộn chuột scrollTop vẫn 0, nút submit bottom 360.8 vượt card bottom 307.2 và viewport 320. Escape không đóng login/drawer mobile. Các view capture không có role=dialog; nhiều nút thấp hơn 48 px, label/input chưa nối đầy đủ. Không suy từ body không tràn rằng modal đã đạt.

**Thực hiện:** primitive Dialog/Drawer dùng chung: semantic dialog, aria-modal/name, focus ban đầu/trap/restore, Escape/backdrop theo quy ước, background inert/scrolllock, z-index tokens. Container flex max-height theo 100 dvh/safearea, header/footer không shrink, body min-height 0 overflow auto; mobile có thể full screen sheet. Login giảm decorative header ở height thấp; payment/reports/detail phải dùng primitive chung, không chỉ thêm class cho 1 modal. Label htmlFor/id, aria-describedby cho error, focus trường lỗi đầu tiên; touch>=48 px theo quy ước project, text contrast AA và focus visible.

**Nghiệm thu:** 320×640,390×844,390×320, landscape/tablet/1440, zoom 200%, bàn phím ảo; submit/close luôn tới được bằng touch/keyboard. Tab không lọt ra overlay, Escape/Back restore đúng focus, sticky actions không che input/lỗi validation. Không sửa bằng overflow-x hidden/toàn trang để che lỗi. Cần thêm kiểm tra thủ công trên thiết bị thật, vì viewport thấp không mô phỏng đủ bàn phím ảo.

### BA-34 — P2 — Điều hướng, thuật ngữ và nội dung chưa hỗ trợ tác vụ

**UI/CODE:** App activeTab là state không URL, refresh/back/deeplink/filter chưa bền. Nhãn status/period còn SCHEDULED/2026-M05; ảnh care có chuỗi hỏng dấu như `D?n d?p khuôn viên`. Nhiều hướng dẫn ở form trộn với nội dung chính; form thi công mặc định mô tả Kim Tĩnh cho mọi lệnh. Thông tin liên hệ public/PDF cần nguồn xác nhận.

**Thực hiện:** routing có tên resource/tab/filter/page, back không mất draft, workspace đầu theo actor. Liên kết xuyên phân hệ từ basis→work→evidence và receivable→payment→receipt đúng quyền. Dictionary tiếng Việt thống nhất label/status/date/money; sửa encoding tại nguồn chỉ khi có bản đúng, không đoán thay mọi dấu `?`. Header mỗi trang 1 title+summary ngắn+CTA chính, hướng dẫn phụ đặt gần field/phần hướng dẫn có thể mở rộng; table/card chỉ giữ thông tin ra quyết định. Dùng design tokens hiện có, không thay toàn bộ brand.

**Nghiệm thu:** copy URL mở đúng case đúng actor; back/refresh giữ filter; URL không bypass quyền; tên/ràng buộc Việt không bị cắt/chen; hạng mục không có data có empty CTA phù hợp. Kiểm tra Unicode và nội dung liên hệ với nguồn cấu hình trước phát hành.

### BA-35 — P1 — Link tệp và upload nhiều bước chưa thống nhất, khó phục hồi mạng yếu

**CODE/API:** Annex `signed_scan_url` lưu object_key nhưng ContractModule đưa thẳng vào href; ConstructionModule dùng href `download_url` API private, điều hướng trình duyệt không gắn Bearer token (probe không token 401). **DocumentManager đã có fetch Bearer→BlobURL, cần tái sử dụng phần đúng này**, không gán lỗi cho mọi link. Care/construction upload rồi attach hai request, thiếu trạng thái phục hồi gắn file bền vững.

**Thực hiện:** file client chung fetch có xác thực/blob hoặc short-livedURL sau ACL; không trả object key như URL web. Lưu file_id/purpose/parent và trạng thái pending-upload/uploaded/pending-attach/attached/failed; retry attach idempotent, không upload lại toàn file khi đã có READY. Preview thumbnail qua đường đọc đúng quyền; abort/cleanup Blob URL, progress và retry tại item. Field draft/resume theo NFR mạng yếu, không hứa hoạt động offline đã đồng bộ khi server chưa xác nhận.

**Nghiệm thu:** chọn/chụp ảnh, mất mạng giữa 2 bước, retry/refresh, file quá lớn/sai MIME/virus policy nếu được áp dụng, object mất; không orphan vô tận/nhân ảnh/đóng ca giả. Bản ký/ảnh/biên lai mở được trên mobile, revoke permission bị chặn. CTA upload không đè checklist/footer, preview đóng trả focus.

### BA-36 — P0 — Giá hợp đồng có fallback tùy tiện khi không tìm đúng bảng giá

**CODE:** create_land_purchase tìm `LAND_{type_id}`, rồi lấy một price item active khác, cuối cùng `Decimal("50000000.00")`. Cơ chế này có thể biến thiếu cấu hình thành giá thật, không khớp phạm vi khu/loại/thời gian. Phí một số dịch vụ mặc định 0 cũng cần đối chiếu C26, không mặc định có lỗi vì giá 0 có thể là thỏa thuận được cấp phép.

**Thực hiện:** resolver giá server theo item type/scope/effective date, duy nhất giá hợp lệ hoặc lỗi cấu hình có thể xử lý. Lưu price_item_revision và giá/điều khoản snapshot tại chốt. Giá thỏa thuận/manual override chỉ khi policy cho phép, có actor/lý do/quyền hạn; không fallback một gói khác hoặc số tiền hardcode. UI hiển thị nguồn giá/ngày áp dụng và subtotal do server trả; kiểu Decimal chính xác.

**Nghiệm thu:** thiếu giá, giá hết hạn, scope khác, khoảng hiệu lực chồng, giá 0 có phê duyệt, sửa bảng giá sau ký, request giá client giảm trái phép. HĐ cũ giữ giá cũ, form báo thiếu cấu hình để Marketing liên hệ Sếp, không tự điền giá mẫu. Mọi giá fixture ghi SYNTHETIC, không áp vào dữ liệu thật.

### BA-37 — P2 — Trạng thái tài liệu và môi trường test không đủ làm bằng chứng hoàn tất

**ENV/CODE:** Test 0010 khác main 0012 đã được khắc phục trong đợt audit này, có backup/count. STATE ghi nhiều năng lực đã Done trong khi UI/API còn lỗi. Test business dùng config DB mặc định nguy cơ ghi main nếu không set env. Rollback harness không đủ để chứng minh race/atomicity/worker.

**Thực hiện:** preflight bắt buộc assert DB name thuộc allowlist Test và revision head trước mọi test ghi; dedicated fixtures có label, không dùng dữ liệu thật. Test suite cấu hình explicit, fail-fast nếu default main; storage prefix riêng được theo dõi và cleanup chỉ own objects. CI/integration dùng SQL Server+MinIO thực, unit không thay bằng chứng integration. Cập nhật STATE/db-gap/acceptance theo testcase và commit thực đã đạt, không đóng milestone bằng số lượng test hoặc ảnh ADMIN.

**Nghiệm thu:** test guard từ chối main; không secret token/CCCD trong log/artifact; backup/restore theo quy trình; count dữ liệu trước/sau; regression theo 39 UC và đúng actor. Không cần chạy lại 0011/0012 trên Test hiện tại. Main chỉ được migrate theo đợt triển khai đã sao lưu, không từ audit read-only.

### 4.1 Bản đồ mã nguồn để bắt đầu sửa

Tất cả các file dưới đây tồn tại tại baseline. Dùng tên hàm để tìm vị trí hiện tại; line number có thể đổi khi triển khai. Router chịu trách nhiệm HTTP/quyền/schema; business rule nằm ở service; query/locking nên tập trung repository theo kiến trúc AGENTS, không dồn thêm SQL vào router.

| Nhóm BA | Backend cần mở | Web cần mở |
|---|---|---|
| 01–07,32 | [auth dependencies](../../backend/app/modules/auth/dependencies.py), [auth router/staff](../../backend/app/modules/auth/router.py), các `router.py` theo module | [App](../../web/src/App.tsx), [AuthContext](../../web/src/context/AuthContext.tsx), [UserManagementModule](../../web/src/components/admin/UserManagementModule.tsx), [CatalogModule](../../web/src/components/catalog/CatalogModule.tsx) |
| 04,35 | [documents service](../../backend/app/modules/documents/service.py): `get_file`, `link_document_version`, `upload_file`; [router](../../backend/app/modules/documents/router.py); [MinIO adapter](../../backend/app/storage/minio_adapter.py) | [DocumentManager](../../web/src/components/documents/DocumentManager.tsx) và các link/upload trong Contract/Care/Construction |
| 08,26,27,30 | [profiles service](../../backend/app/modules/profiles/service.py): `check_death_certificate_verified`, `attach_or_update_certificate`, `public_lookup_deceased`; [router](../../backend/app/modules/profiles/router.py) | [ProfileModule](../../web/src/components/profiles/ProfileModule.tsx) |
| 09–14,36 | [contracts service](../../backend/app/modules/contracts/service.py): `create_land_purchase`, `create_burial_annex`, `activate_burial_annex`, `_activate_*`, `generate_contract_pdf`; [router](../../backend/app/modules/contracts/router.py); [PDF service](../../backend/app/services/pdf_service.py) | [ContractModule](../../web/src/components/contracts/ContractModule.tsx) |
| 15–18,20 | [construction service](../../backend/app/modules/construction/service.py): `create_order`, `update_order`, `complete_order`, task/evidence commands; [router](../../backend/app/modules/construction/router.py) | [ConstructionModule](../../web/src/components/construction/ConstructionModule.tsx) |
| 18–21 | [care service](../../backend/app/modules/care/service.py): generate/assign/close/register và evidence/checklist; [router](../../backend/app/modules/care/router.py) | [CareModule](../../web/src/components/care/CareModule.tsx) |
| 22–24 | [finance service](../../backend/app/modules/finance/service.py): `record_payment`, `apply_discount`, create receivable; [router](../../backend/app/modules/finance/router.py); [schemas](../../backend/app/modules/finance/schemas.py) | [FinanceModule](../../web/src/components/finance/FinanceModule.tsx) |
| 03,31 | [reports service](../../backend/app/modules/reports/service.py): `create_export`, `download_export`, `generate_*`; [router](../../backend/app/modules/reports/router.py) | [ReportsModule](../../web/src/components/reports/ReportsModule.tsx) |
| 10,11,28,29 | [plots service](../../backend/app/modules/plots/service.py): `delete_plot`, reservation/slot commands; [models](../../backend/app/modules/plots/models.py) | [PlotMapModule](../../web/src/components/plots/PlotMapModule.tsx) |
| 25,33,34 | List schema/query ở các module, auth/session client contract | [LoginModal](../../web/src/components/auth/LoginModal.tsx), [Pagination](../../web/src/components/common/Pagination.tsx), [index.css](../../web/src/index.css), [App.css](../../web/src/App.css), mọi modal/selector chịu tác động |

## 5. Thiết kế giao diện bắt buộc khi triển khai nghiệp vụ

Giữ nền trắng ngà `#F7F8F5`, chữ `#1F2933`, xanh `#24594D`, màu cảnh báo/lỗi theo token hiện có. Dùng font hỗ trợ dấu Việt. Không thay đổi thương hiệu chỉ để sửa lỗi. Các chi tiết dưới đây là quyết định triển khai có thể thực hiện ngay; các quyền/chính sách chưa chốt ở mục 6 phải giữ trạng thái chưa bật.

### 5.1 Shell và thành phần dùng chung

- Desktop: sidebar và vùng nội dung có `min-width:0`, header ngắn, một CTA chính; action phụ ở menu có nhãn. Mobile: topbar/menu drawer hiện có tiếp tục dùng, bổ sung focus/Escape/inert; không trả về sidebar cố định chiếm chiều rộng.
- Toolbar: search chiếm dòng riêng khi hẹp; filter dùng popover/sheet có tổng số filter đang áp dụng; action wrap theo nhóm có thứ tự. Không ép tất cả nút/filter vào cùng một hàng.
- List: desktop table cho dữ liệu cần so sánh; mobile card giữ mã, tên, trạng thái, ngày/số tiền quan trọng và CTA. Bảng cần so sánh nhiều cột có thể cuộn riêng có nhãn, không làm body tràn. Không thu nhỏ chữ để giữ nguyên bảng desktop.
- Modal: một primitive theo BA-33; chỉ body cuộn, footer không che nội dung; full screen trên màn hình thấp khi cần. Không lồng nhiều modal có footer chồng nhau; chuyển sang bước/detail có back rõ ràng.
- Bốn trạng thái trên từng vùng dữ liệu: Loading có skeleton; Normal; Empty có hướng giải quyết đúng quyền; Error có tiếng Việt và Thử lại. Lỗi selector không biến thành danh sách rỗng. Lỗi một panel không xóa shell.
- Mọi hành động bất đồng bộ phân biệt đang gửi/đã nhận/lỗi/chưa rõ kết quả; khóa submit đúng lúc, không xóa draft. Toast không phải nơi duy nhất chứa thông tin phục hồi payment/giấy tờ quan trọng.
- Nhãn hiển thị dùng nghiệp vụ: mã mộ, mã phụ lục, người phụ trách; không bắt nhập ID số, enum hoặc key kỳ backend. Tiền căn phải, format locale để đọc nhưng payload là chuỗi Decimal; ngày hiển thị thống nhất múi giờ nghiệp vụ.

### 5.2 Các hành trình phải thể hiện trực tiếp trên UI

| Hành trình | Chuỗi màn hình tối thiểu | Điều kiện thiết kế mobile |
|---|---|---|
| Public | Tìm tên/mã → phân biệt kết quả → memorial detail → vị trí/dẫn đường → chăm sóc đã công bố | Một ô tìm kiếm, metadata phân biệt tên trùng, CTA Maps chỉ khi hợp lệ; ảnh tải lỗi không đẩy lệch card |
| Marketing mua đất | Khách → ô đủ điều kiện → giá/căn cứ → kiểm tra → draft/in → chờ ký → upload/version/xác nhận → ACTIVE | Mỗi bước ngắn; summary mã ô/chủ/tiền luôn dễ xem; back giữ dữ liệu; không ép có người mất |
| Marketing PL | Căn cứ hiện hành → loại PL → người mất/giấy hoặc gói/phạm vi → điều khoản → in/ký/scan → bàn giao | Hiển thị trạng thái giấy ngay khi chọn người; link bổ sung quay lại draft; tách giá/thời hạn/tần suất |
| Quản trang | Việc hôm nay/quá hạn → WorkBasis → checklist/phân công → bằng chứng → xác nhận thực tế hoặc nghiệm thu đúng loại | Một cột, tác vụ chính dễ chạm; upload theo từng mục; danh sách còn thiếu trước khi close; không lộ giá/CCCD |
| Kế toán | Nguồn khoản thu → các đợt/dư nợ → xác nhận tiền thực nhận → kết quả payment → biên lai/status/retry | Số tiền và nguồn rõ trước xác nhận; key bền vững; “tạo lại biên lai” khác “thu tiếp” |
| Sếp | Cấu hình/quyền → xem ảnh hưởng/version → xác nhận → audit; báo cáo → filter → export history | Form nhóm trường, lịch sử/version dễ mở; matrix quyền dùng nhóm/detail; bảng tổng có phương án đọc trên màn hình hẹp |

### 5.3 Giao kèo API cần thống nhất trước khi nối UI

Các tên mới dưới đây là **đề xuất contract**, agent có thể đổi tên nhất quán với convention repo; không được ghi trong tài liệu rằng endpoint đã tồn tại.

1. `capabilities` và DTO theo scope từ auth/me; nav/CTA/API dùng cùng định nghĩa. Quyền frontend chỉ để diễn đạt trải nghiệm, service vẫn xác thực command.
2. List/search envelope có total/cursor, stable sort, filter schema; eligible-basis/eligible-plot không tải một trang rồi lọc client.
3. Command pháp lý `submit-signing`, `confirm-signed-version`; command thực địa `confirm-burial`, `confirm-exhumation`, `complete-service` tách nhau. Có command_id/idempotency và expected_version tại aggregate cần bảo vệ.
4. Evidence/document API dùng file_id + purpose + parent binding; response gồm state và hành động được phép, không coi object_key là URL.
5. Payment response trả payment status và receipt status riêng; tra command status theo key; retry receipt theo payment_id. Error 409 phân biệt stale version, conflict nghiệp vụ và key/payload mismatch.
6. Report request có filter typed theo report_type; export là snapshot cùng query/scope, có status/progress/error/retry/download được authorize.
7. Error DTO ổn định gồm code, thông báo tiếng Việt, field_errors và conflict context tối thiểu. Không lộ SQL, stack trace, bucket secret hoặc dữ liệu actor khác.

## 6. Quyết định nghiệp vụ còn mở: không tự bịa chính sách

Không cần dừng toàn bộ kế hoạch để chờ mọi quyết định. Agent triển khai phần độc lập trước, chuẩn bị dữ liệu/màn hình có thể xem xét; giữ nhánh phụ thuộc chưa bật cho tới khi có quyết định đã ghi nhận. Không dùng ADMIN bypass hoặc giá giả để tiếp tục một nhánh chưa có policy.

| Quyết định từ mục 8 đặc tả | Ảnh hưởng / xử lý an toàn trong khi chờ |
|---|---|
| C05 phạm vi Kim Tĩnh/nhiều slot, sửa tọa độ | Bảo toàn quy tắc AGENTS: ô đã an táng Kim Tĩnh khóa vĩnh viễn ở DB/service; không tự nới cho slot trống. Phân biệt sửa metadata trước khóa và sửa cấu trúc sau khóa. |
| C06/C07 căn cứ pháp lý chủ mới và nghĩa vụ cũ | Chặn chủ cũ tạo PL mới; giữ lịch sử và công nợ cũ; chuẩn bị phương án căn cứ kế thừa có truy nguyên, không đổi customer trên HĐ cũ. |
| C08/C10 tần suất, kỳ phí, thời hạn care | Tách field và snapshot; không diễn giải `cycle_months` thành số lần chăm sóc tùy ý. |
| C09 publication care | Không tự công bố ảnh private; cần eligibility/approver/redaction/revoke. Public chỉ hiện dữ liệu đã được phép. |
| C11/C28 thu vượt, số phải trả bằng 0 | Không tự tạo refund/credit hoặc làm âm dư nợ; hiển thị cần xử lý nghiệp vụ và chặn command chưa hỗ trợ. Không khẳng định nguồn gốc cấm thu vượt vĩnh viễn. |
| C12 mức/base chiết khấu và người duyệt | Không tự chọn 10%/20% hoặc cấp quyền rộng cho Kế toán; cấu hình/audit sau khi policy được xác nhận. |
| C14 hủy/reopen/điều chỉnh | Chặn sửa trực tiếp bản đã chốt; thiết kế command correction có lý do và lịch sử, chưa bật hậu quả tiền/pháp lý chưa chốt. |
| C16 Sếp kiêm nhiệm | Tách role quản trị và capability tác nghiệp được cấp có chủ đích; vẫn cấm bypass invariant. |
| C17/C18 danh tính, required checklist, bằng chứng | Cần bốn danh tính; chưa tự đặt số ảnh hoặc cho supervisor mặc định là executor. Cho cấu hình rule đã phê duyệt và snapshot. |
| C19 một PL nhiều lệnh | Chốt trước unique constraint/idempotency theo PL; không vô tình giới hạn một lệnh nếu nghiệp vụ cho nhiều. |
| C20 người xác nhận hỏa táng | Lịch/hồ sơ có thể chuẩn bị, chỉ bật complete sau khi actor được xác định. |
| C21 version mẫu/loại PL | Lưu immutable revision và lịch sử; không thay mẫu cũ khi nâng version. |
| C24 giấy báo tử được xác nhận | Giữ UX một bước nếu đã chủ đích bỏ duyệt thủ công; xác nhận phải có file thật, actor, thời gian và audit. Không coi bool tự bật là kiểm chứng. |
| C26 nguồn giá/phí | Không chọn giá active bất kỳ hay hardcode; thiếu cấu hình phải hiển thị để người có quyền xử lý. |

Các mục C khác của đặc tả vẫn phải đọc khi chạm tới chức năng tương ứng; bảng này không thay toàn bộ mục 8.

## 7. Thứ tự thực thi và gói bàn giao

Làm theo dependency, mỗi gói gồm code/migration nếu cần + UI + test + bằng chứng. Không làm lại toàn bộ CSS trước khi chốt projection/quyền rồi phải dựng giao diện lần nữa. Có thể làm các primitive UI an toàn song song về mặt lịch trình, nhưng một agent phải quản lý migration/API contract để tránh xung đột.

| Gói | Hạng mục | Công việc và file trọng tâm | Điều kiện hoàn thành / phụ thuộc |
|---|---|---|---|
| W00 Baseline & an toàn | BA-37 | Snapshot HEAD/dirty files, DB revision/role/schema, Test guard, fixture synthetic, acceptance ledger. Đọc AGENTS, domain/UI skills, ADR, đặc tả UC. | Không ghi main, không chạy bootstrap; Test+MinIO sẵn; đường dẫn fixture/artifact rõ. Test hiện đã 0012. |
| W01 Quyền và dữ liệu | BA-01…04,07,32 | `auth/dependencies`, seed/migration permissions, router modules, DTO allowlist, documents/report ACL, auth context/nav. | Negative matrix actor+resource+file đạt. Không dựa vào UI để bảo mật. C16 được biểu diễn rõ. |
| W02 Khả dụng UI nền | BA-05,06,27,28,33,34 | Auth staff SQL, typed client/method, Dialog/Drawer, router, error states, Leaflet lifecycle; `web/src/index.css`, `App*`, các module. | Login thấp, navigation mobile, map, lỗi 503 hoạt động; không regression shell đã sửa. W01 cấp capability để chọn CTA đúng. |
| W03 Pháp lý và giá | BA-08,10,12,13,30,36 | Profiles/contracts/catalog schemas-service-repository, immutable template/price/package revisions, PL flows, owner basis. | 4 HĐ/3 PL in/ký/version đúng; gate giấy tờ; không giá fallback; migrate dữ liệu cũ có report. Phụ thuộc W01 và C06/C21/C24/C26 liên quan. |
| W04 Trạng thái thực địa & tranh chấp | BA-09,11,14,29 | Execution commands, ownership/reservation/slot invariants, MSSQL locks/constraints, plot dependency queries, WorkBasis UI. | Hai transaction thật và Kim Tĩnh đạt; ký khác thực hiện; cải táng giữ chủ/slot khác. Phụ thuộc W03; không tự backfill actual event từ signed_at. |
| W05 Thi công | BA-15…17,35 | Construction basis/checklist/assignee/progress/evidence service, workforce schema có policy, UI điều phối/chi tiết. | Không dùng sai PL/sai ô, không bypass complete, tổ ngoài dùng được, cập nhật có audit; W01/W03/W04. |
| W06 Chăm sóc & public | BA-18…21,26,35 | Availability, recurrence/snapshot/unique occurrence, closed guard, publication projection/handler, public search. | Conflict chặn; lịch đúng policy; ảnh thật; closed không hồi tố; public đúng allowlist; W01/W03/W05, chốt C08/C09/C10/C18. |
| W07 Tài chính | BA-22…24,35 | Finance transaction/idempotency/receipt job/discount policy, UI nguồn thu/thanh toán/status biên lai. | Payment commit thật, retry/fault/concurrency, 3+7, receipt regenerate, discount đúng quyền; W01/W03/W04, chốt C11/C12/C28. |
| W08 Dữ liệu lớn & báo cáo | BA-25,31 | Server pagination/search/eligible endpoints, aggregate query, report filters/jobs, table/card/selector clients. | Record ngoài trang đầu tìm/chọn được; UI/export khớp filter và scope; đo NFR; W01 và các DTO cuối của W03–W07. Có thể tách pagination trước. |
| W09 Regression & bàn giao | Tất cả | 39 UC/KT, actor matrix, responsive/error/offline, backup/restore, báo cáo test và residual risks; cập nhật STATE/db-gap/acceptance. | Không P0/P1 còn mở mà gắn Done; policy chưa chốt đánh BLOCKED riêng; bằng chứng đủ không cần ADMIN thay actor. |

### 7.1 Cách xử lý migration và dữ liệu cũ

1. Không rewrite migration 0001–0012 đã dùng. Migration mới tăng dần, đọc schema vật lý trước khi viết; SQL Server trigger trên plots/payments cần `implicit_returning=False`, trigger xử lý multi-row và `SET NOCOUNT ON`.
2. Mở rộng nullable → report/backfill có căn cứ → thêm constraint/index sau khi dữ liệu hợp lệ. Không tự tạo actual burial, verifier, giá, chủ mới hoặc approval cho lịch sử không đủ chứng cứ.
3. Ghi riêng record cần đối soát: ACTIVE care không scan, cert không file/verifier, signed_at bị dùng actual_at, task/evidence không hợp lệ, ownership/slot lệch, receipt thiếu. Chuẩn bị màn hình/quy trình xử lý để người có quyền xác nhận; không chạy sửa hàng loạt đoán nghiệp vụ.
4. File cũ không có binding cần phân loại theo FK nghiệp vụ; file không xác định quyền phải quarantine/deny tạm có hướng khôi phục, không mở public để tránh 404.
5. Migration seed quyền dùng upsert/diff và audit; runtime DML credential không dùng thay migration DDL credential. Tạo backup trước main migration, chạy Test trước, ghi forward repair/rollback strategy cụ thể cho từng migration. Lưu backup/MinIO/log trên ổ D.

### 7.2 Mỗi gói phải nộp gì

- Commit và file đổi; UC/BA/KT đã xử lý; schema/API compatibility impact, migration/repair notes.
- Bảng actor thực × hành động, cả allowed/denied, kèm dữ liệu request đã che thông tin nhạy cảm và HTTP kết quả.
- Ảnh desktop/tablet/mobile normal/empty/error/form validation của màn hình bị đổi; không chỉ ảnh ADMIN và happy path.
- Kết quả test có DB revision, browser, viewport, fixture, thời gian; phân biệt unit/integration/browser/fault/concurrency/manual.
- Cập nhật acceptance ledger: PASS/FAIL/NOT_RUN/BLOCKED_POLICY, không gộp “không kiểm được” vào PASS. Không đóng BA bằng một test chỉ kiểm component có render.

## 8. Bộ nghiệm thu nghiệp vụ theo KT01–KT39

Các KT là yêu cầu chạy **sau sửa**; bảng không phải kết quả tất cả đã chạy. “Đã có bằng chứng lỗi” tham chiếu mục 4 và JSON; các ca chưa chạy phải ghi NOT_RUN trong ledger.

| KT | Kịch bản bắt buộc | BA / gói và cách kiểm |
|---|---|---|
| KT01 | Tên trùng khác ngày/vị trí, không tự gộp | BA-26/30; public+Marketing UI, hai profile synthetic |
| KT02 | Public tra/dẫn đường, không account/PII/file private | BA-02/04/21/26; kiểm DOM và payload/file access |
| KT03 | Thiếu/sai GPS không chỉ đường giả | BA-26/28/29; empty/invalid/verified fixture và UI |
| KT04 | Sửa/xóa cấu trúc/slot có lịch sử | BA-29; service+DB+UI confirm; không chỉ DELETE 404 |
| KT05 | Mua đất không người mất | BA-12/36; Marketing UI 4 bước tới ACTIVE, không ép deceased |
| KT06 | Hai Marketing giữ/mua 1 ô | BA-10/11; hai kết nối MSSQL có barrier, một winner |
| KT07 | Chỉ in/scan lỗi chưa ACTIVE/đổi quyền | BA-12/13/35; PDF/upload fault và state assertion |
| KT08 | Ký mua hợp lệ/retry một nghĩa vụ | BA-10/11/12; UI+API lặp key, count ownership/receivable |
| KT09 | Hồ sơ chờ giấy nhưng PL an táng bị chặn | BA-08; thiếu file/READY/verifier/actor, UI tới API |
| KT10 | Đủ ký/xây 100% chưa hạ huyệt không BURIED | BA-09/16; state assertions ngay sau từng command |
| KT11 | Xác nhận actual đúng slot/lịch sử/evidence | BA-09/14/20; Quản trang UI, file MinIO thật |
| KT12 | Kim Tĩnh chặn cải táng/chuyển/chỉnh/mở khóa, cả ADMIN | BA-09/11/29; API+direct DB với Test credential phù hợp |
| KT13 | Thân nhân không phải chủ không quyền yêu cầu cải táng | BA-10/30; relation khác ownership |
| KT14 | Cải táng 1 slot giữ owner/slot khác | BA-09/14; ô nhiều slot, before/after |
| KT15 | Transfer còn người/sai chủ/buyer=seller | BA-10/11; draft và revalidate lúc activate |
| KT16 | Transfer hợp lệ giữ history/căn cứ chủ mới | BA-10/12; chuỗi hai lần transfer và PL theo C06 |
| KT17 | Cremation không ô, có giấy, không chiếm ô | BA-08/14; Marketing UI, execution theo C20 |
| KT18 | A giao tổ ngoài, B giám sát, đủ 4 danh tính | BA-17; UI/DB audit, không account cho tổ ngoài |
| KT19 | Nghỉ/bận không lưu phân công mới | BA-18; care+construction conflict và concurrent assign |
| KT20 | 100% chưa đủ required không complete | BA-16; thử generic PUT/PATCH/complete/bulk |
| KT21 | Đổi gói/giá không hồi tố bản ký | BA-13/19/36; version snapshot+in lại PDF |
| KT22 | Sinh lại/dời 1 ca không trùng và đúng tần suất | BA-19; kỳ biên/overlap/unique+job retry |
| KT23 | Thiếu ảnh/file lỗi/sai mộ không close | BA-04/20/35; real files và negative binding |
| KT24 | CLOSED→public chỉ phần được công bố | BA-21; approve/revoke+public payload/file |
| KT25 | Mất mạng upload/confirm, retry một kết quả | BA-20/22/35; browser offline, request timeout, idempotency |
| KT26 | Quá hạn chuyển Marketing xử lý văn bản | BA-12/14/17; không Quản trang sửa hiệu lực |
| KT27 | Ảnh chuyển khoản chưa phải tiền thực nhận | BA-24; UI xác nhận và quyền thu, không OCR tự ghi Payment |
| KT28 | Fixture 10 triệu, thu 3 triệu+7 triệu | BA-22/24; PARTIALLY_PAID→PAID, dư 7→0, hai Payment |
| KT29 | Concurrent/retry thu không sai tổng/trùng | BA-11/22; commit thật hai SQL connection, cùng/khác key |
| KT30 | PDF/MinIO lỗi sau payment, tái tạo cùng payment | BA-23; fault+read connection khác+worker retry |
| KT31 | Discount lý do/trần/đã trả đủ theo C12 | BA-24; request+approval role+Decimal check |
| KT32 | Overpay/final 0 theo C11/C28 | BA-24; không âm/mất tiền, BLOCKED_POLICY nếu chưa chốt |
| KT33 | Doanh thu theo tiền thực nhận | BA-25/31; HĐ lớn chưa thu và nhỏ đã thu, UI/export |
| KT34 | Báo cáo nhiều slot/Kim Tĩnh không nhân đôi | BA-31; fixtures mẫu số và nhóm chồng |
| KT35 | Scope báo cáo/HĐ/file theo actor | BA-01…04; cả GET/POST export/generic file/direct URL |
| KT36 | Khóa/thu quyền trong phiên còn sống | BA-32; access/refresh/tab/job/link file cũ |
| KT37 | Audit read/filter đúng, không sửa/xóa secret | BA-30/32; UI+API+runtime DB permissions |
| KT38 | TPT/subtype/slot khác plot bị chặn | BA-12/15/29; API valid schema nhưng invalid domain |
| KT39 | Gia hạn/sửa bản ký giữ version/lịch sử | BA-12/13/14; print old/new, wrong file binding |

### 8.1 Kiểm thử UI bổ sung cho mọi gói

- 1440×900, 768×1024, 390×844, 320×640, 390×320; portrait/landscape và zoom 200%. Test thực tế một Android Chrome và một iOS Safari nếu có thiết bị; ghi NOT_RUN nếu không có, không giả lập viewport rồi gọi là đã kiểm thiết bị thật.
- Đo body scrollWidth, vùng scroll riêng, vị trí header/footer/CTA, content với tên tiếng Việt dài, số tiền nhiều chữ số, thông báo validation dài, danh sách trên 1000 bản ghi.
- Keyboard Tab/ShiftTab/Enter/Escape; focus không lọt drawer/modal; label và error liên kết; button có accessible name; vùng chạm>=48 px theo project. Đo contrast thay vì nhận xét bằng mắt.
- Slow network/offline/401/403/409/422/500/503, stale responses, double click, back/refresh, session revoked; không trắng root hoặc báo thành công giả. Kiểm console lỗi và request thừa.
- Mọi nút hiển thị trong normal state phải thực thi được theo actor hoặc disabled có lý do nghiệp vụ. Không hiển thị CTA rồi chỉ báo 403 như trải nghiệm mặc định.

### 8.2 Lệnh kiểm tra nền và giới hạn

Từ `backend/`, **sau preflight xác minh đúng Test**: `uv run ruff check .`, `uv run pytest` với cấu hình test guard đã sửa. Từ `web/`: `pnpm lint`, `pnpm build`, cùng browser suite do agent bổ sung cho luồng bị đổi. Không mặc định chạy suite hiện tại trên main. Các lệnh này là smoke/quality gate, không thay bộ KT và kiểm UI trên.

Không cần viết test chỉ để kiểm màu/chuỗi CSS tĩnh. Viết test cho invariant, quyền, chuyển trạng thái, lỗi mạng, idempotency và những lỗi UI thật (submit bị che, map mất, root crash). Sau test đạt, mở artifact/screenshot để kiểm nội dung và bố cục; không chỉ đọc exitcode.

## 9. Prompt bàn giao cho AI agent khác

> Hãy triển khai `docs/actor-business-audit/PLAN.md` cho web trong `web/`, bao gồm backend/CSDL cần thiết để đáp ứng các luồng nghiệp vụ theo actor. Đọc đặc tả `reference/DAC_TA_NGHIEP_VU_HE_THONG_QUAN_LY_NGHIA_TRANG.md`, AGENTS.md và các skill domain/UI/migration liên quan trước khi sửa. Baseline audit là `4053b10`; kiểm tra HEAD và dirty files hiện tại, tái hiện trước khi coi một BA còn lỗi. Không chạy SQL bootstrap, không dùng ADMIN thay actor và không sửa Flutter ngoài yêu cầu tương thích API có căn cứ. Bắt đầu W00→W01, ưu tiên P0, sau đó theo dependency W02–W09. Mỗi gói phải có sửa server + UI tương ứng, test đúng actor, bằng chứng desktop/tablet/mobile và negative/fault branches. Giữ những phần responsive đã hoạt động. Dùng CSDL Test được bảo vệ và MinIO thật cho kiểm thử ghi, dữ liệu synthetic có nhãn; không chạy test ghi vào main. Quyết định Cxx chưa chốt phải được ghi rõ và chỉ chặn nhánh phụ thuộc, không tự bịa giá/ngưỡng/quyền/công bố. Không đánh dấu hoàn tất bằng build/lint hoặc tên endpoint; cập nhật ledger 39 UC/KT01–KT39 với PASS/FAIL/NOT_RUN/BLOCKED_POLICY và bằng chứng. Trước bàn giao, đối soát migration/dữ liệu/file cleanup và kiểm không phát sinh chồng lấn giao diện ở web mobile.

## 10. Trạng thái bàn giao audit

- Đã đọc đặc tả, đối chiếu UI/API/service/schema theo actor, kiểm lại MinIO sau khi Docker được bật và bổ sung probe file/biên lai/export thật.
- Đã tạo plan và bằng chứng; **chưa sửa mã sản phẩm**. Hai migration có sẵn chỉ được áp dụng trên Test sau backup, không thay revision main.
- Các phát hiện CODE/race/policy và các KT chưa chạy vẫn cần kiểm chứng trong gói triển khai; không có tuyên bố toàn bộ hệ thống đạt hoặc thất bại ở mọi nhánh.
- Người triển khai không được bỏ qua lỗi nghiệp vụ để chỉ sửa CSS, cũng không được hoàn tất backend rồi bỏ mặc form/card/modal mobile phát sinh từ thay đổi đó.
