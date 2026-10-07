# Kế hoạch sửa lỗi, hoàn thiện và mở rộng Cemetery Management System

**Đầu vào cho Antigravity / AI coding agent — hoàn thiện ngày 05/10/2026**

- Repository: https://github.com/huyxuantruong1411/cemetery-management-system
- Commit được rà soát: **`51e8f752b510497bc6aef0193e6a43c1bfa55fc1`** trên `main`.
- Phạm vi: FastAPI, SQLAlchemy/SQL Server, Alembic, MinIO, React/Vite, Flutter Android, kiểm thử, scripts, tài liệu và cấu hình agent.
- Căn cứ nghiệp vụ: `docs/EXECUTION_PLAN.md`, bản trong `reference/`, các tài liệu Lab1–Lab4 và SQL trong repository.
- Đây là **plan khắc phục tiếp nối dự án hiện có**, không phải chỉ thị viết lại hệ thống hoặc dựng lại DB.

## 1. Kết luận và thứ tự hành động

Dự án đã có nền monorepo, nhiều API và màn hình nghiệp vụ, nhưng **chưa đủ điều kiện nghiệm thu “feature-complete” hoặc đưa vào vận hành với dữ liệu thật**. Những điểm cản trở chính nằm ở tính đúng đắn của giao dịch tiền, chuyển trạng thái nghiệp vụ, phân quyền dữ liệu, tích hợp Flutter–API và kiểm thử. Build frontend thành công không chứng minh các luồng này hoạt động đúng.

Cần giữ lại các phần tốt: FastAPI dùng chung cho hai client; Decimal ở backend; phân tách module; Argon2 và refresh-token rotation; filtered unique index cho reservation ACTIVE và người mất đang nằm trong slot; checklist bắt buộc; báo cáo doanh thu lấy từ payment; xử lý công thức Excel; bind mount MinIO; lịch sử Git theo milestone. Sửa có kiểm soát trên nền hiện tại, không thay stack hàng loạt.

**Thứ tự bắt buộc:** bảo vệ DB và môi trường test → khóa/transaction/phân quyền → nghiệp vụ sở hữu và vòng đời → chăm sóc/thi công → API contract và client → tài liệu/báo cáo/UI → vận hành và UAT → mở rộng.

Có **42 hạng mục F01–F42** bên dưới. P0 là lỗi có thể làm sai dữ liệu nghiệp vụ, giao dịch hoặc vượt quyền; P1 là chức năng lõi hỏng/thiếu và điều kiện phát hành; P2 là cải thiện chất lượng, hiệu năng, khả năng bảo trì. Phần mở rộng ở mục 9 được tách riêng, không dùng để thay thế việc sửa P0/P1.

### 1.1. Phạm vi đã kiểm tra và giới hạn bằng chứng

Đã lấy bản clone, kiểm kê và quét **254 tệp được Git theo dõi**, trong đó 238 tệp đọc được dưới dạng văn bản; rà soát các lớp router/schema/model/service, chuỗi migration, các client, tests và tài liệu. Trích xuất phần văn bản từ 4 DOCX nguồn để đối chiếu; không xem việc trích xuất này là kiểm chứng trực quan toàn bộ sơ đồ nhúng trong DOCX. Tập trung đọc sâu các đường đi có rủi ro và đối chiếu xuyên backend–web–mobile, không tuyên bố đã chứng minh mọi nhánh thực thi.

| Khu vực | Số tệp theo inventory | Cách kiểm tra chính |
|---|---:|---|
| `backend/app/` | 57 | Router, DTO, ORM, transaction, quyền, state machine, file và job |
| `backend/alembic/` | 15 | 12 revision, baseline, constraint/index, backfill, downgrade |
| `backend/tests/` | 15 | 82 hàm test; fixture, độ an toàn, assertion và khoảng trống |
| `web/src/` | 33 | API call, auth, form, điều kiện UI, CSS, kiểu dữ liệu; build/lint |
| `mobile/lib/` | 50 | Provider, JSON parser, màn hình, auth và các thao tác còn thiếu |
| `mobile/test/` | 1 | 14 widget test, dữ liệu giả và phạm vi assertion |
| `docs/`, `reference/`, `.agents/`, `scripts/` | 28 | Plan, trạng thái, nguồn nghiệp vụ, SQL, quy tắc agent và quality gate |

**Không truy cập SQL Server `DESKTOP-HKIPI1M`, DB thật hoặc MinIO của chủ dự án; không chạy migration, seed hay toàn bộ integration tests trên DB thật. Không sửa/push mã nguồn upstream.** Không có Flutter SDK, Android emulator hoặc thiết bị thật trong môi trường rà soát này. Các kết luận về chạy đồng thời, restore và Android release cần agent xác minh tại môi trường kiểm thử được tách biệt.

### 1.2. Kết quả kiểm tra thực tế

| Kiểm tra | Kết quả và cách hiểu |
|---|---|
| `uv sync --frozen --no-python-downloads` | Thành công với lockfile hiện tại, Python 3.12.14 |
| `uv run ruff check .` | **Không đạt: 2 lỗi** trong `backend/app/modules/reports/service.py`: I001 và F401 |
| `pnpm install --frozen-lockfile` | Thành công |
| `pnpm build` | Thành công; JS chính khoảng **800,17 kB**, gzip 190,80 kB; cảnh báo chunk lớn |
| `pnpm lint` | Exit 0, vẫn có cảnh báo hooks/effect/purity; không tương đương “không có vấn đề” |
| Import backend theo cấu hình thật | Bị chặn bởi thiếu `libodbc.so.2` trong môi trường Linux rà soát; đây là giới hạn môi trường, không kết luận lỗi máy Windows của dự án |
| 6 test không cần DB/MinIO | **6 passed**: số tiền bằng chữ, ngày neo cuối tháng, Excel sanitization/generation, liveness, version. Chỉ thay engine khi import bằng engine SQLite rỗng; không tạo bảng và không dùng SQLite để chứng minh nghiệp vụ MSSQL |
| OpenAPI từ import cô lập | 100 path, 121 operation; chỉ chứng minh khai báo API tạo được |
| Compile `select(...).with_for_update()` bằng dialect MSSQL trong lockfile | SQL sinh ra **không có khóa cập nhật**; đã tái hiện độc lập |
| Khởi tạo `ContractAnnex(annex_number=...)` | Tái hiện `TypeError`: thuộc tính không tồn tại |
| Serialize DTO tiền thật bằng Pydantic | Decimal được xuất thành chuỗi, ví dụ `"total_collected_amount":"20"` |
| Header tải file có tên `giấy báo tử.pdf` theo code hiện tại | Tái hiện `UnicodeEncodeError` trong `Response` |
| Toàn bộ 82 backend tests / 14 Flutter tests / E2E | **Chưa chạy lại đầy đủ**. Số lượng test trong repo không phải số test được xác nhận đạt trong lần review này |

Ký hiệu bằng chứng: **[T]** đã tái hiện bằng kiểm tra cô lập/build; **[C]** xác định từ code và đường gọi; **[V]** cần kiểm chứng thêm trên hạ tầng/thiết bị hoặc dữ liệu cụ thể. Với [C], không khẳng định sự cố đã xảy ra trong DB thật.

## 2. Nguyên tắc giao việc cho agent

1. Đọc `AGENTS.md`, plan này và `docs/EXECUTION_PLAN.md`. Nếu HEAD đã đổi, ghi commit mới và kiểm tra lại từng F-ID trước khi sửa. Một lỗi đã được sửa phải có bằng chứng, không sửa lại theo mô tả cũ.
2. Làm việc trên nhánh riêng, giữ thay đổi đang có của người dùng. Không `reset --hard`, không force-push, không chạy lại `lab4-sql.sql` trên DB đã dựng.
3. Không coi seed trực tiếp ORM hoặc SQL tay là cách hoàn thiện một luồng người dùng. Luồng cần đi qua API/UI thật, đúng quyền.
4. Không bỏ constraint, trigger, required task, idempotency hay kiểm tra quyền để làm test xanh. Không fallback từ tài khoản ít quyền sang admin trong test.
5. Mỗi F-ID cần có: tái hiện trước sửa → thay đổi nhỏ nhất đủ giải quyết nguyên nhân → kiểm thử hồi quy phù hợp → bằng chứng kết quả → cập nhật trạng thái.
6. Giữ FastAPI + SQL Server + MinIO + Flutter và web hiện tại. Chỉ thêm thư viện khi giải quyết khoảng trống cụ thể. Không đưa microservices/Kubernetes vào đợt sửa này.
7. Phân biệt `legal_status` của hợp đồng/phụ lục với trạng thái thực hiện công việc. Scan hợp đồng không phải bằng chứng một ca an táng/cải táng đã thực hiện.
8. Dữ liệu tiền, sở hữu, chứng từ đã ký và audit phải có lịch sử. Không “sửa sạch” dữ liệu bất thường bằng xóa/gán giá trị mặc định thiếu căn cứ.
9. Các quyết định nghiệp vụ còn thiếu phải được ghi ADR, có phương án đề xuất và trường hợp cần chủ dự án chốt. Tiếp tục các phần không phụ thuộc, không tự suy diễn chính sách tài chính/pháp lý.

## 3. Danh mục lỗi và công việc khắc phục

Các đường dẫn dưới đây tương đối với repository, vị trí dòng tính tại commit đã nêu. Agent dùng tên hàm làm mốc khi dòng thay đổi. Link commit cố định để tra cứu: https://github.com/huyxuantruong1411/cemetery-management-system/tree/51e8f752b510497bc6aef0193e6a43c1bfa55fc1

### F01 — P0 — Test có thể ghi vào DB nghiệp vụ mặc định [C]

**Bằng chứng:** `backend/app/core/config.py` mặc định `DB_NAME=QL_NghiaTrang`; `backend/app/db/session.py` tạo `SessionLocal` toàn cục. Các `test_finance.py`, `test_care.py`, `test_trigger_mapping.py`, `test_auth.py` dùng trực tiếp SessionLocal/TestClient, có commit và cleanup DELETE. `scripts/quality-gate.ps1` gọi `uv run pytest` không chọn DB test, không có chốt kiểm tra danh tính DB. Tài liệu nói có `QL_NghiaTrang_Test` không thay thế được guard trong code.

**Thực thi:** cấu hình test riêng, pytest fixture/override thống nhất; tài khoản test chỉ được truy cập DB/bucket test; trước fixture ghi dữ liệu phải kiểm tra `DB_NAME()`, server và marker test thực tế. Thiếu/sai cấu hình phải dừng. Tách unit/integration bằng marker. Mỗi run có namespace, dữ liệu tổng hợp và cleanup đúng namespace.

**Nghiệm thu:** chạy test với cấu hình mặc định DB thật phải bị từ chối trước lần ghi đầu tiên; DB test được dựng/restore bằng quy trình riêng; log ghi tên đích đã che thông tin nhạy cảm. Không sửa test chỉ bằng đổi một biến trong máy cá nhân.

### F02 — P0 — Khóa cạnh tranh MSSQL hiện tại không có hiệu lực như mô tả [T/C]

**Bằng chứng:** `.with_for_update()` ở `plots/service.py::reserve_plot`, `contracts/service.py`, `finance/service.py::record_payment`, `jobs/service.py::claim_next_job`. Compile bằng MSSQL sinh `SELECT ... FROM plots` không có `UPDLOCK`/cơ chế tương đương. `AGENTS.md` cũng hướng dẫn dễ gây hiểu nhầm về API này.

**Thực thi:** thiết kế transaction theo aggregate; chọn conditional UPDATE/CAS hoặc lock hint MSSQL có kiểm soát, giữ khóa tới commit. Có thể dùng `UPDLOCK/HOLDLOCK` cho kiểm tra–ghi trên aggregate phù hợp; xác minh execution SQL, index, isolation và deadlock. Worker cần atomic claim, không copy cùng một hint cho mọi query. Thêm rowversion cho luồng chỉnh sửa/đồng bộ cần phát hiện dữ liệu cũ.

**Nghiệm thu:** hai connection độc lập chạy cùng lúc giữ ô, thu tiền, kích hoạt phụ lục, đổi chủ và claim job; trạng thái cuối đúng, thất bại nghiệp vụ trả 409 phù hợp. **Filtered unique indexes hiện có vẫn bảo vệ một số trùng lặp**; giữ chúng và xử lý IntegrityError. Không kết luận mọi luồng hiện tại đều chắc chắn tạo trùng chỉ vì thiếu lock.

### F03 — P0 — Ghi nhận tiền bị chia thành nhiều transaction và phụ thuộc sinh PDF [C]

**Bằng chứng:** `finance/service.py::record_payment`, khoảng dòng 503–659: commit Payment trước, truy tìm lại payment bằng số tiền/người ghi/thứ tự ID, rồi sinh PDF, upload, tạo Invoice, hoàn tất idempotency, audit qua các commit riêng. Lỗi PDF/S3 có thể để payment đã ghi nhưng request thất bại. Comment “commit để trigger chạy” là không đúng yêu cầu kỹ thuật: DML/flush đã kích hoạt trigger trong transaction.

**Thực thi:** một transaction DB ngắn cho payment, cập nhật balance qua trigger, receipt metadata/snapshot, idempotency và outbox/audit. Dùng `flush()` và ID của chính entity; không tìm “payment mới nhất giống nhau”. Tạo PDF sau commit qua job idempotent với trạng thái chứng từ PENDING/READY/FAILED. Không cố tạo distributed transaction giả giữa SQL và S3. Worker retry phải dùng cùng invoice/payment.

**Nghiệm thu:** ngắt S3, PDF lỗi, process chết sau commit, response mất, retry: chỉ một payment; balance đúng; chứng từ có trạng thái và có thể tạo lại; không báo “chưa thu tiền” khi tiền đã được ghi nhận. Nếu đổi API sang 202 hoặc trả payment kèm receipt pending, cập nhật cả hai client.

### F04 — P0 — Idempotency thu tiền chưa chống replay/sai payload đầy đủ [C]

**Bằng chứng:** `finance/service.py::record_payment` dòng 420–467: key tùy chọn; có request_hash nhưng không so sánh khi replay; hash không gồm transaction reference; lưu IN_PROGRESS trước validate khoản thu và không có lease phục hồi. `FinanceModule.tsx::handleSubmitPayment` tạo key mới mỗi lần bấm lại.

**Thực thi:** bắt buộc key cho command thu tiền; chuẩn hóa và băm đầy đủ payload nghiệp vụ; cùng key khác payload trả 409; cùng payload trả cùng kết quả. Đặt idempotency cùng transaction F03, hoặc có state/lease và recovery được chứng minh nếu dùng claim riêng. Client giữ key của một ý định thanh toán qua retry, chỉ đổi khi người dùng bắt đầu giao dịch mới. Xử lý trường hợp header và body khác nhau rõ ràng.

**Nghiệm thu:** replay tuần tự/song song, cùng key khác tiền/khoản thu/mã tham chiếu, validation fail rồi sửa, timeout sau commit: không ghi thêm tiền, không kẹt IN_PROGRESS vô hạn. Không bật automatic retry cho POST tài chính chưa có cơ chế này.

### F05 — P0 — Hồ sơ và xác minh giấy báo tử chỉ cần đăng nhập [C]

**Bằng chứng:** `profiles/router.py`, đặc biệt `/certificates/{cert_id}/verify` dòng 162: dùng `get_current_user`, không có `require_permission`; tương tự đọc/sửa khách hàng, người mất, quan hệ. Người có tài khoản nhưng không có quyền hồ sơ vẫn có đường gọi API, gồm CCCD và thao tác xác minh.

**Thực thi:** lập ma trận resource/action; quyền đọc hồ sơ, sửa, gắn giấy tờ và verify tách rõ. Scope dữ liệu và trường nhạy cảm theo vai trò, không chỉ ẩn nút. Truyền actor xuống service và ghi audit. Seed permission qua migration/seed idempotent, giữ mapping vai trò được duyệt.

**Nghiệm thu:** từng vai trò gọi API trực tiếp; CARETAKER/tài khoản không có quyền verify bị 403; người không được đọc PII không nhận CCCD/điện thoại qua endpoint khác. Test 401 và 403 riêng biệt.

### F06 — P0 — Vượt quyền qua export báo cáo, file và job [C]

**Bằng chứng:** `reports/router.py::create_report_export` dòng 125 chỉ yêu cầu login, trong khi GET báo cáo yêu cầu `reports:read`. Một tài khoản không có quyền báo cáo có thể yêu cầu tạo export và trở thành requester. `documents/router.py::download_document/preview_document/link_document` không kiểm tra entity/owner; `jobs/router.py` trả payload và cho xử lý job với login. Export có ACL riêng nhưng file_id còn có đường tải qua documents chỉ cần login.

**Thực thi:** cùng một policy cho mọi đường dữ liệu: quyền xem loại báo cáo + export + scope; file kế thừa quyền entity, file chưa gắn chỉ uploader/quản trị được phép; file READY và đúng liên kết; job chỉ requester/phạm vi được cấp quyền. Không trả payload PII cho endpoint theo dõi job. Đóng đường tắt sample/process cho người dùng sản phẩm.

**Nghiệm thu:** user A không có `reports:read/export` không tạo được export; user B không tải file báo cáo/hợp đồng của A bằng file_id nếu không có quyền; kiểm tra cả direct download, preview, link version, job status và quyền sau khi bị thu hồi. Không dựa vào UUID khó đoán làm phân quyền.

### F07 — P0 — Scan kích hoạt đang bị đồng nhất với hoàn tất an táng/cải táng [C]

**Bằng chứng:** `contracts/service.py::activate_burial_annex` dòng 696–863 chuyển ngay slot OCCUPIED, đặt deceased, khóa Kim Tĩnh, ghi BurialHistory/event hoàn tất. `_activate_exhumation` dòng 1169–1270 giải phóng slot khi kích hoạt HĐ. `_activate_cremation` chưa có luồng thực hiện/hoàn tất độc lập. Không có command hiện trường hoàn tất tương ứng trong router.

**Thực thi:** activation chỉ xác lập hiệu lực pháp lý và nghĩa vụ cần thiết. Tạo workflow thực hiện: dự kiến/được phép → đang làm nếu cần → hoàn tất/hủy, với actor, performed_at, chứng từ hiện trường, idempotency và expected version. Chỉ complete command mới thay occupancy, ghi lịch sử thực tế và khóa Kim Tĩnh. Có bước kiểm tra lại owner, giấy báo tử, slot và hiệu lực căn cứ tại lúc hoàn tất.

**Nghiệm thu:** upload scan không tự tạo người đang nằm/giải phóng mộ; hoàn tất một lần tạo đúng một history; replay không đổi thời gian; hỏa táng không cần plot. Dữ liệu cũ đã bị “hoàn tất theo scan” phải xuất danh sách đối soát, không tự suy ngược ngày thực tế hoặc mở khóa Kim Tĩnh.

### F08 — P0 — Căn cứ sở hữu và dữ liệu cũ chưa được kiểm tra lại khi commit [C]

**Bằng chứng:** `_activate_transfer` không so seller với owner hiện tại; HĐ mua đất cũ không được kết thúc căn cứ sau chuyển nhượng. `create_burial_annex` chỉ nhận HĐ LAND_PURCHASE ACTIVE, không kiểm tra owner hiện tại, không hỗ trợ căn cứ TRANSFER cho chủ mới. `_activate_exhumation` không tái kiểm tra slot còn chứa đúng người của draft. `_activate_land_purchase` có thể ghi owner/status mà chưa xác minh đầy đủ reservation hiện hành. `cancel_contract` có thể đưa plot về EMPTY_UNSOLD mà không xác nhận reservation/căn cứ còn thuộc draft đó.

**Thực thi:** chuẩn hóa `current ownership` và `basis contract`; xác minh dưới khóa ở mỗi command. Đóng lịch sử cũ, mở lịch sử mới và đổi owner trong cùng transaction; filtered unique cho một ownership đang hiệu lực sau đối soát. HĐ/căn cứ cũ được đánh dấu không còn cấp quyền phát sinh nghiệp vụ phù hợp. Hủy draft chỉ giải phóng reservation của chính nó. Chặn/điều phối phụ lục và việc đang mở khi chuyển chủ.

**Nghiệm thu:** draft A→B lập trước chuyển A→C không được kích hoạt sau đó; chủ cũ không lập an táng; chủ mới dùng căn cứ mới được; exhumation draft của người A không xóa người B hiện trong slot; hủy draft cũ không làm ô đã có chủ thành ô chưa bán. Giữ owner sau cải táng thường.

### F09 — P0 — Có đường bỏ qua nghiệm thu thi công [C]

**Bằng chứng:** `construction/service.py::update_order` dòng 378–400 cho gán `status` trực tiếp, bỏ qua `complete_order`; schema nhận str tùy ý. `create_order` chỉ kiểm tra annex ACTIVE và plot tồn tại, không bắt buộc đúng subtype/cùng plot/căn cứ. `complete_task` chấp nhận `proof_media_url` bất kỳ thay cho file READY; `update_task` có thể hạ `is_required` và sửa sau nghiệm thu.

**Thực thi:** bỏ status khỏi generic PATCH hoặc chỉ cho transition an toàn; complete/cancel/reopen là command với quyền và điều kiện riêng. Lệnh phải tham chiếu CONSTRUCTION annex hợp lệ, đúng plot/owner/thời hạn. Bằng chứng có file, MIME, owner/entity, trạng thái READY. Chốt task/order đã hoàn tất; sửa sau chốt qua amendment/reopen có lý do và audit.

**Nghiệm thu:** PATCH `status=COMPLETED` khi thiếu task/ảnh bị từ chối; dùng phụ lục CARE/BURIAL hoặc plot khác không tạo được order; URL giả không thay ảnh; không thể hạ required để lách nghiệm thu; hoàn tất thi công không tự tạo an táng.

### F10 — P0 — Bất biến Kim Tĩnh chưa được bảo vệ đủ ở DB [C/V]

**Bằng chứng:** trigger trong `docs/source/lab4-sql.sql` dòng 613 chỉ kiểm tra một số cập nhật plot: UNDER_EXHUMATION, gỡ is_locked, auto-lock khi OCCUPIED. Không bảo vệ đầy đủ thay owner/cờ Kim Tĩnh, sửa/xóa slot, xóa lịch sử hoặc các đường ghi khác. Migration mới chưa có phần hardening tương ứng. DB thực tế có thể đã khác source, cần introspect.

**Thực thi:** thu thập definition trigger/constraint/quyền DB thực tế read-only; đối chiếu invariant đã chốt. Bổ sung migration incremental và quyền runtime tối thiểu; trigger set-based cho INSERT/UPDATE/DELETE liên quan khi cần. Tách thao tác chỉnh mô tả hợp lệ khỏi thay dữ liệu bất biến, không cấm mù mọi ghi chú.

**Nghiệm thu:** test trực tiếp SQL bằng tài khoản ứng dụng trên DB test, kể cả lệnh nhiều dòng, không vượt được quy tắc bảo vệ Kim Tĩnh; rollback không để nửa trạng thái. Không thử sửa/xóa mộ thật để chứng minh test.

### F11 — P1, chặn phát hành — Secret và tài khoản demo mặc định [C]

**Bằng chứng:** `core/config.py`, `backend/compose.yaml`, seed/test và login demo có giá trị mặc định cố định; MinIO app dùng thông tin tương ứng tài khoản root local. Không có validator từ chối cấu hình nguy hiểm khi production. Không kết luận các secret đó đang được dùng trên môi trường thật.

**Thực thi:** secret bắt buộc từ môi trường/secret store; APP_ENV production fail-closed với giá trị mẫu; tài khoản S3 riêng, policy theo bucket/prefix; seed demo chỉ trong môi trường demo/test với cờ rõ. Nếu đã triển khai bằng giá trị công khai, thay/thu hồi chúng và session liên quan. Gỡ quick-login khỏi build phát hành.

**Nghiệm thu:** production không khởi động với secret mẫu; app storage không có quyền quản trị MinIO; không commit .env, khóa ký hay dữ liệu thật; chạy secret scan và xử lý phát hiện thực tế.

### F12 — P1 — API đăng ký chăm sóc hỏng do model/DTO không khớp [T/C]

**Bằng chứng:** `care/service.py::register_care_annex` dòng 498 khởi tạo `ContractAnnex(annex_number=..., total_amount=..., annex_type="MAINTENANCE")`; ORM dùng `annex_code`, `additional_amount`, type CARE. Tái hiện TypeError `annex_number`. `care/router.py` dòng 269 dùng `base_annex.annex_number` và `care_annex.package`, trong khi CareAnnex hiện chưa có relationship package. Luồng còn tạo thẳng ACTIVE.

**Thực thi:** thống nhất ORM/schema/API/client, CARE subtype, mã sequence, quan hệ package và workflow ký/kích hoạt; không chỉ đổi tên một trường rồi bỏ qua các lỗi kế tiếp. Kiểm tra HĐ/căn cứ, package active, giá và kỳ; tạo snapshot gói, tạo nghĩa vụ tài chính đúng thời điểm.

**Nghiệm thu:** từ UI đăng ký → draft → ký/scan → activate → sinh lịch → khoản phải thu; tất cả qua API thật, không seed annex bằng ORM để lách endpoint.

### F13 — P1 — Sinh lịch chăm sóc bỏ qua chu kỳ và dữ liệu không thời hạn [C]

**Bằng chứng:** `care/service.py::generate_schedules_for_period` dòng 45: sinh một lịch cho mỗi tháng được yêu cầu; không dùng `cycle_months` để quyết định tháng đến hạn. Query `valid_to >= first_day` bỏ qua NULL; không kiểm tra status HĐ gốc. Checklist lấy từ package hiện tại, thay đổi gói có thể hồi tố các lịch phát sinh về sau của hợp đồng cũ.

**Thực thi:** định nghĩa ngày neo, tần suất thực hiện và kỳ tính tiền riêng; dùng chênh tháng từ valid_from và cycle_months, bao gồm quý/năm; xử lý open-ended theo chính sách. Snapshot nội dung gói/required checklist lúc ký; gia hạn qua phiên bản/căn cứ mới; idempotency có unique constraint và xử lý race.

**Nghiệm thu:** monthly/quarterly/yearly; 31/1→28/2→31/3, năm nhuận, valid_to NULL, hết hạn giữa tháng, gọi generator đồng thời; HĐ hủy/chuyển căn cứ không sinh ca sai; đổi package không thay checklist đã thỏa thuận.

### F14 — P1 — Ca chăm sóc có thể bị sửa sau đóng, bằng chứng và scope chưa đủ [C]

**Bằng chứng:** `care/service.py::update_checklist_item/add_media_evidence` không chặn CLOSED; `close_schedule` chấp nhận `media_url` bất kỳ và file READY không kiểm tra MIME ảnh/quyền; các hàm không xác minh người thao tác có phải caretaker được giao. Lịch/list có thể nhận caretaker_id từ client hoặc bỏ lọc.

**Thực thi:** enforce assignment tại backend; quyền điều phối override riêng có audit; CLOSED immutable, reopen theo command. Bằng chứng phải là file ảnh/video được hỗ trợ, gắn đúng ca, thuộc người có quyền và READY; không nhận URL tùy ý như bằng chứng hoàn tất mới. Danh sách “việc của tôi” lấy actor phía server.

**Nghiệm thu:** người B không sửa/đóng việc A; thay assignment trước sync làm request cũ bị conflict; closed không uncheck/upload thêm âm thầm; PDF/XLSX hoặc URL giả không vượt yêu cầu ảnh; thiếu ảnh hoặc việc bắt buộc không đóng.

### F15 — P1 — Kiểm tra phân công mới dừng ở cảnh báo, chưa bao phủ công việc chồng lấn [C]

**Bằng chứng:** `construction/service.py::check_staff_conflict` chỉ tra nghỉ/bận; create_task gọi kiểm tra nhưng bỏ kết quả; update_order/task chưa kiểm tra lại đầy đủ. `care/service.py::assign_caretaker` vẫn commit khi có xung đột, chưa kiểm tra đúng vai trò. Chưa có cơ chế thống nhất giữa ca chăm sóc và công việc thi công.

**Thực thi:** policy availability dùng chung, kiểm tra người active/đúng năng lực, khoảng thời gian và capacity. Nếu dữ liệu mới có ngày, không tự suy diễn giờ: chốt mô hình lịch trước. Khi conflict chưa giải quyết phải chặn; nếu cho override, cần quyền, lý do, lựa chọn người dùng và audit. Thông báo phân công qua outbox khi có consumer.

**Nghiệm thu:** create/update/reassign đều cùng policy; nghỉ phép, chồng ca, thay ngày, user inactive được xử lý; conflict không bị mất trong response/UI.

### F16 — P1 — Flutter JSON contract lệch API và không đọc được Decimal string [T/C]

**Bằng chứng:** `mobile/lib/models/finance_model.dart`, `catalog_model.dart`, `construction_model.dart`, `contract_model.dart` ép `as num?`. DTO Pydantic xuất Decimal thành string. Nhiều tên trường khác API; các widget test khởi tạo model trực tiếp nên không kiểm tra `fromJson`.

| Backend thực tế | Flutter đang đọc | Hậu quả |
|---|---|---|
| `total_paid_amount` | `paid_amount` trên receivable | Tiền đã thu hiển thị sai/0 |
| `count_unpaid`, `count_paid`, `count_overdue` | `unpaid_count`, `paid_count`, `overdue_count` | KPI đếm về 0 |
| `total_receivables_amount`, `total_discounts_amount` | tên tổng khác | Thiếu/sai KPI |
| `item_id` | `price_item_id` | ID giá thành 0 |
| `effective_from_date`, `effective_to_date` | `effective_from`, `effective_to` | Ngày hiệu lực mất |
| `unit_price`, `default_tasks_json` của gói | `price`, `task_list` | Giá/checklist sai |
| `overall_progress`, `total_tasks`, `completed_tasks` | `progress_percent`, `tasks_count`, `completed_tasks_count` | Tiến độ về 0 |
| `evidences`, `field_notes` | `evidence_count`, `notes` | Thông tin task không khớp |

**Thực thi:** xuất OpenAPI làm hợp đồng API; generate client/DTO khi phù hợp hoặc mapping typed có contract tests. Chọn decimal string làm chuẩn truyền tiền, parse bằng kiểu decimal/đơn vị nhỏ nhất đúng quy tắc; không sửa backend sang float cho tiện Flutter. Không mặc định ID/tiền bắt buộc về 0 để che lỗi. Chi tiết care phải gọi endpoint detail, không dùng list DTO thiếu checklist làm dữ liệu detail.

**Nghiệm thu:** fixtures JSON được tạo từ serializer backend và qua parser Dart thật; toàn bộ model, null/date/decimal/status được kiểm tra; chạy Android với API thật, số tiền và tiến độ đối chiếu DB.

### F17 — P1 — Flutter chưa có luồng hiện trường và offline đã cam kết [C]

**Bằng chứng:** `mobile/lib/providers/` ngoài auth chủ yếu GET; màn care/construction hiển thị, chưa có POST/PATCH thực thi. `pubspec.yaml` chưa có camera/image picker, kho offline hay secure storage. Không có queue/sync implementation trong `mobile/lib/`. `docs/execution/STATE.md` lại ghi M10 offline Done.

**Thực thi:** ưu tiên “việc được giao hôm nay”, task/checklist, chụp/chọn ảnh, upload có tiến độ, ghi chú và complete/close online. Sau đó kho cục bộ + queue theo actor/device/client_operation_id; draft → queued → uploading → awaiting-confirmation → synced/conflict/failed. Upload hoàn tất rồi mới gửi complete. Dùng foreground sync trước; background best-effort. Có purge/logout theo chính sách dữ liệu.

**Nghiệm thu:** mất mạng lúc nhập, chụp ảnh, upload, sau commit; restart app; đổi assignment/thu hồi quyền; replay; mất ảnh cục bộ; upload trùng; không mất ghi chú và không tạo hai bằng chứng/hoàn tất. Không ghi tiền, đổi chủ hoặc khóa Kim Tĩnh offline.

### F18 — P1 — Mobile auth và Android release chưa hoàn thiện [C/V]

**Bằng chứng:** `auth_provider.dart` chỉ giữ token trong state, không restore/refresh; `api_provider.dart` không interceptor refresh. `core/config.dart` mặc định HTTP emulator. `android/app/src/main/AndroidManifest.xml` thiếu INTERNET; debug/profile có thể khác. `build.gradle.kts` release dùng debug signing.

**Thực thi:** secure token store, refresh single-flight cùng thiết kế F19, logout và cache invalidation. Flavor dev/staging/release, HTTPS release, cấu hình URL lúc build, INTERNET trong manifest merge release; cleartext exception chỉ dev nếu cần. Release signing ngoài Git, nhãn/icon/version đúng dự án.

**Nghiệm thu:** process restart, access token hết hạn, refresh bị thu hồi; kiểm tra merged manifest/APK thật; Android release gọi được API staging HTTPS và upload camera. Không đánh giá chỉ bằng `flutter run` debug trên emulator.

### F19 — P1 — Session revocation và refresh giữa backend/web chưa nhất quán [C]

**Bằng chứng:** `auth/service.py::logout_session` chỉ revoke refresh session; `dependencies.py::get_current_user` kiểm auth_version, không kiểm session, nên access token hiện hành chưa mất hiệu lực ngay khi logout. Refresh rotation chưa có atomic claim. Web `AuthContext.tsx` lưu refresh token localStorage, chỉ refresh khi mount; fetch ở các module không có 401 refresh. `main.tsx` bật StrictMode, effect restore không chống chạy lại trong development.

**Thực thi:** chọn session semantics rõ: `sid` + kiểm session active để logout từng thiết bị, auth_version cho revoke toàn bộ; rotation CAS/lock tránh double refresh. Web ưu tiên refresh cookie HttpOnly/Secure/SameSite và CSRF phù hợp deployment; access token memory. Client chung refresh single-flight, phối hợp nhiều tab, retry an toàn một lần; restore effect idempotent. Không bỏ StrictMode để che race.

**Nghiệm thu:** access token sau logout/revoke bị từ chối theo SLA đã chốt; không revoke oan vì hai request refresh hợp lệ được client phối hợp; token reuse thật bị phát hiện; đổi role/password/inactive có hiệu lực; hết 15 phút không làm mọi module hỏng âm thầm.

### F20 — P1 — Các màn web có endpoint/token/bộ lọc không nối với backend [C]

**Bằng chứng và sửa cụ thể:**

| Vị trí | Hiện trạng | Công việc |
|---|---|---|
| `DocumentManager.tsx:38` | Đọc `localStorage.access_token`, AuthContext không lưu ở đó | Dùng auth/API client chung |
| `DocumentManager.tsx:44,234,257` | `/jobs/test-list`, `/jobs/enqueue`, `/jobs/process-next` không khớp API | Gỡ panel demo; nối workflow job thật hoặc triển khai API quản trị đúng quyền |
| `CareModule.tsx:240` | `/api/v1/storage/upload` không tồn tại | Dùng `/api/v1/documents/upload` qua client chung |
| `CareModule.tsx:84` | Gửi `period_key` nhưng router care không nhận | Thêm bộ lọc chuẩn hoặc chuyển thành from/to đúng nghĩa |
| `finance/service.py:578` | `pdf_file_url` chứa `/documents/files/{id}/download` | Router thật là `/documents/{id}/download`; chuẩn hóa URL từ file_id |
| `contracts/service.py:775,1060` và link UI | `signed_scan_url` là object_key nhưng UI dùng như href | Tải có xác thực theo file_id, blob/presigned có thời hạn và policy |

DocumentManager còn chỉ giữ danh sách file vừa tạo trong state, không có query lịch sử đầy đủ. Bổ sung truy vấn file/version theo entity, pagination và refresh bền vững.

**Nghiệm thu:** thao tác thật từ UI, không 401/404 do wiring; chọn tháng chỉ nhận ca tháng đó; refresh trang vẫn thấy file đã gắn; scan/receipt mở được sau kiểm quyền; các URL trong response khớp OpenAPI.

### F21 — P1 — Care UI dùng utility CSS chưa được cấu hình [C]

**Bằng chứng:** `CareModule.tsx` dùng `flex`, `grid`, `text-xs`, `bg-*`, `rounded-*` và nhiều class kiểu Tailwind; `web/package.json`, `vite.config.ts`, CSS không có Tailwind pipeline hay định nghĩa tương ứng. Build vẫn có thể xanh vì className không được type-check về CSS.

**Thực thi:** chọn một cách nhất quán: chuyển màn sang CSS/design tokens hiện tại hoặc bổ sung pipeline utility CSS được pin và kiểm thử. Không chữa bằng thêm rải rác vài class. Xóa CSS/assets scaffold không dùng khi xác nhận không ảnh hưởng.

**Nghiệm thu:** kiểm tra computed style và screenshot ở 390/768/1440 px, modal/drawer/badge/loading/error; không có nền/chữ mất tương phản hoặc bố cục rơi về mặc định. Đây là lỗi wiring CSS xác định từ source; review hiện tại chưa chụp UI chạy với backend thật.

### F22 — P1 — Chọn giá có fallback tùy tiện và không thống nhất catalog [C]

**Bằng chứng:** `contracts/service.py::create_land_purchase_contract` đoạn đầu service chọn giá theo item code, bỏ sót `effective_to_date IS NULL`, fallback giá đầu tiên đang active rồi giá cố định; không dùng `CatalogService.lookup_price`. Scope khu/loại/gói chưa được áp dụng thống nhất. Catalog lookup cũng cần kiểm tra tính duy nhất của scope và thứ tự ưu tiên.

**Thực thi:** một pricing resolver dùng chung, có effective date, scope, priority và lỗi ambiguity; không có giá thì yêu cầu cấu hình/override có quyền và lý do, không tự cho giá demo. Snapshot price item/version/unit/quantity/amount ở căn cứ ký. Không lấy “giá mới nhất” để hồi tố HĐ.

**Nghiệm thu:** bảng giá không ngày kết thúc, hai khu khác giá, ngày biên, thiếu giá, scope trùng, override không quyền; tổng tiền đúng snapshot; giá mới không đổi HĐ cũ.

### F23 — P1 — Điều khoản/PDF chưa có snapshot bất biến, template bị ghi đè [C]

**Bằng chứng:** `catalog/service.py::bump_template_version` dòng 416 sửa cùng row và tăng version; không giữ nội dung version cũ. `contracts/service.py::generate_contract_pdf` dòng 1502 dùng dữ liệu khách hiện tại và PDF chung, không dùng nội dung template đã chọn. `pdf_service.py` có điều khoản cố định, lấy font Arial Windows rồi fallback Helvetica; dữ liệu động đưa thẳng vào ReportLab Paragraph.

**Thực thi:** template version immutable + contract snapshot lúc phát hành/ký; PDF riêng cho 4 loại HĐ và các phụ lục, có dữ liệu người mua/bán/người mất, phạm vi dịch vụ và điều khoản đúng loại. Escape dữ liệu text trước markup, không cho nội dung khách thay cấu trúc tài liệu. Bundle font tiếng Việt có quyền phân phối, lưu file/hash/version; giữ scan và PDF phát hành cũ.

**Nghiệm thu:** đổi tên/địa chỉ khách hoặc template không đổi bản đã phát hành; tên chứa `<`, `&`, dấu tiếng Việt và văn bản dài không làm lỗi PDF; test nhiều trang, Linux/Windows, bảng không cắt, số tiền không lặp đơn vị; có label rõ tài liệu mẫu chưa có giá trị nghiệp vụ.

### F24 — P1 — Chưa đủ luồng tạo/gia hạn/kích hoạt các loại phụ lục [C]

**Bằng chứng:** router contracts có tạo BURIAL/submit/activate cho burial; có model ConstructionAnnex nhưng chưa có workflow create/submit/activate đầy đủ. CARE đi đường riêng hỏng F12 và tạo thẳng ACTIVE; chưa có workflow gia hạn có lịch sử. Construction tests tạo annex bằng fixture nên không chứng minh người dùng lập được căn cứ thi công.

**Thực thi:** dispatch phụ lục BURIAL/CARE/CONSTRUCTION rõ ràng; command theo type, quyền, owner/căn cứ, thời hạn, scan/version và nghĩa vụ tài chính. Renewal tạo phiên bản/phụ lục mới hoặc amendment có audit, không ghi đè thời hạn cũ. Cấm generic handler nhận type không được hỗ trợ.

**Nghiệm thu:** người dùng tạo được căn cứ thi công và chăm sóc từ đầu qua UI; activate đúng subtype; hủy/hết hiệu lực không triển khai mới; renewal không nhân đôi ca/khoản thu.

### F25 — P1 — Reservation hết hạn có thể mắc kẹt và chính sách giữ chỗ bị tự đặt [C]

**Bằng chứng:** `plots/service.py::reserve_plot` dòng 459 đánh dấu reservation hết hạn, sau đó vẫn thấy `plot.status=RESERVED` và trả 409; thay đổi chưa commit nên có thể rollback toàn bộ. HĐ mua đất tự giữ 7 ngày, luồng reserve riêng dùng duration_hours; chưa có chính sách thống nhất hoặc worker expiry đáng tin cậy.

**Thực thi:** chốt reservation semantics, TTL có/không có theo quyết định nghiệp vụ; expiry/release/convert trên aggregate dưới khóa, cập nhật status đồng bộ. Có command reconcile/worker và thao tác chọn lại rõ; reservation gắn customer/contract/user đúng scope.

**Nghiệm thu:** hết hạn đặt lại được; hai yêu cầu ở đúng ranh giới chỉ một thắng; không tự thả reservation của HĐ đã hiệu lực; cancel hợp lệ có audit. Không đổi TTL hàng loạt trên dữ liệu hiện có mà không báo tác động.

### F26 — P1 — Giấy báo tử và hồ sơ thiếu kiểm tra bằng chứng/độ chính xác dữ liệu [C]

**Bằng chứng:** `profiles/service.py::attach_or_update_certificate/verify_certificate` cho verify mà chưa bắt buộc file READY, MIME phù hợp, quyền liên kết và version; has_death_certificate bị dùng lẫn “có bản ghi”/“đã xác minh”. Mã khách/người mất tạo bằng tải toàn bộ bảng + count/random; cập nhật tùy chọn chưa phân biệt giữ nguyên và xóa null đầy đủ.

**Thực thi:** trạng thái giấy tờ MISSING/UPLOADED/PENDING/VERIFIED/REJECTED nhất quán; verify đúng document version, thay file phải reset verification và lưu lịch sử. Ràng buộc precision YEAR_ONLY/EXACT, ngày sinh/mất, normalization CCCD/điện thoại theo chính sách. Mã dùng sequence/identifier an toàn, trả conflict đúng cho trùng dữ liệu.

**Nghiệm thu:** verify không file/file sai/đã xóa bị chặn; thay scan không giữ verify cũ; thông tin chỉ biết năm không tạo ngày giả; hai request tạo cùng CCCD không gây 500 hoặc hai hồ sơ.

### F27 — P1 — Job/outbox chưa là worker vận hành độc lập [C]

**Bằng chứng:** `jobs/router.py::process_job` dòng 97 tự ghi “giả lập worker”, claim job đầu rồi force-claim job được yêu cầu nếu khác, bỏ lease/state; job đầu có thể bị bỏ treo. `complete_job/fail_job` không kiểm worker/fencing token. Không có worker entrypoint/consumer sử dụng outbox trong app. `finance/service.py` create_receivable/apply_discount/record_payment gọi publish_event sau commit cuối, không commit sau đó; get_db đóng session, event mới có thể bị rollback.

**Thực thi:** worker process có graceful shutdown, atomic claim, lease/heartbeat, fencing token, retry backoff/max attempts/dead-letter; result idempotent. Domain transaction ghi outbox cùng dữ liệu, dispatcher ack sau xử lý; consumer deduplicate event. Không dùng endpoint public để force-run. Không hứa exactly-once delivery; bảo đảm effect idempotent trên at-least-once.

**Nghiệm thu:** hai worker, worker chết, lease hết, worker cũ hoàn tất muộn, S3 lỗi, event lặp; không hai hiệu ứng và không mất event đã commit; có dashboard lỗi/retry có quyền.

### F28 — P1 — Khoản thu, chiết khấu và số biên lai cần ràng buộc nghiệp vụ đầy đủ [C]

**Bằng chứng:** `finance/service.py::create_receivable` kiểm tồn tại/XOR nhưng chưa xác minh customer trùng nguồn, nguồn hiệu lực và tổng phân bổ đợt. `apply_discount` clamp fixed discount bằng `min`, chưa có policy trần/duyệt. `_generate_receipt_number` dòng 663 dùng số cuối +1, không sequence. Schema tiền thiếu giới hạn precision/max_digits đồng bộ Numeric(15,2). Hành vi overpayment hiện chặn hoàn toàn, cần đối chiếu quyết định MVP thay vì âm thầm mở.

**Thực thi:** installment plan và source snapshot, tổng đợt/giảm trừ không vượt nghĩa vụ được duyệt; quy tắc chiết khấu sau thu một phần và credit/refund rõ. Reject giá trị vượt trần, không tự sửa input. Số receipt từ sequence/counter atomic, unique payment→receipt; giữ gap sequence được phép, không tái sử dụng số. Chuẩn hóa monetary precision ở API/DB/client.

**Nghiệm thu:** sai customer/nguồn DRAFT, đợt trùng, vượt tổng, giảm vượt original/tiền đã thu, hai biên lai đồng thời, số tiền nhiều chữ số/thập phân. Payment append-only, điều chỉnh bằng chứng từ riêng khi được duyệt; không DELETE payment để “hoàn tiền”.

### F29 — P1 — Báo cáo có nhánh lỗi ORM và filter/snapshot chưa đồng nhất [C]

**Bằng chứng:** `reports/service.py::generate_contracts_report` dòng khoảng 376 dùng `land_purchase.plot`, nhưng LandPurchaseContract không có relationship đó; có annex chăm sóc sắp hết hạn trên HĐ mua đất sẽ đi vào nhánh lỗi. Báo cáo HĐ chỉ lấy LAND_PURCHASE, chưa đại diện đủ 4 loại. Ngày filter ghi là ngày ký nhưng query created_at. Expiring annex thiếu cận `valid_to >= today`. `create_export` không chuyển toàn bộ filter màn hình như payment_method/status vào query; expires_at chưa được enforce khi tải.

**Thực thi:** query/DTO rõ theo loại báo cáo; sửa join ORM; một filter model typed dùng chung preview/export; phân biệt đã hết hạn và sắp hết hạn; chọn timezone nghiệp vụ. Snapshot gồm filter chuẩn hóa, generated_at, as_of/cutoff, actor, schema/version và tổng kiểm tra. Nếu yêu cầu snapshot nhất quán giữa nhiều query, chọn isolation/cutoff phù hợp.

**Nghiệm thu:** dữ liệu có đủ 4 HĐ, care expiring/expired/transfer; filter màn hình bằng filter file; invalid date trả 422; tổng thực thu đối chiếu SQL theo múi giờ; file hết hạn/state không READY không tải được.

### F30 — P1 — Migration thiếu preflight/backfill an toàn cho dữ liệu đã có [C/V]

**Bằng chứng:** 0001 là baseline, không tạo đủ schema mới từ DB rỗng. 0011 tự bỏ contract_id khi cả hai nguồn tồn tại, gán installment_no=1 rồi thêm unique index: dữ liệu nhiều đợt cũ có thể xung đột. 0010 unique `(care_annex_id, period_key)` trên dữ liệu period_key NULL cần xử lý lịch cũ; MSSQL không coi nhiều NULL cùng khóa như filtered exclusion. Một số downgrade drop column có FK chưa có bước drop constraint tên xác định.

**Thực thi:** schema diff thật + preflight read-only; phân nhóm bản ghi vi phạm; backfill có mapping và nhật ký, không suy đoán mất căn cứ. Thêm migration mới nếu revision đã áp dụng, không sửa lịch sử làm lệch DB hiện hữu. Có đường provision DB test từ baseline được kiểm soát và upgrade incremental. Đặt tên constraint rõ, kiểm tra downgrade trên bản sao khi hỗ trợ; restore là phương án cho thay đổi không thể đảo dữ liệu.

**Nghiệm thu:** upgrade bản sao có dữ liệu multi-installment/lịch cũ/nguồn sai; vi phạm dừng với báo cáo, không xóa mất dữ liệu; restore rehearsal; schema sau migration khớp model và constraint quan trọng.

### F31 — P1 — Audit chưa bao phủ thay đổi quan trọng và redaction bỏ sót array [C]

**Bằng chứng:** auth/profile/catalog và một số update chưa ghi audit đầy đủ; nhiều nơi audit commit sau nghiệp vụ. `audit/service.py::redact_sensitive_json` duyệt dict nhưng không đệ quy list, raw JSON không parse được được trả lại. API audit chỉ đọc là tốt, nhưng chưa chứng minh runtime DB không được sửa/xóa audit.

**Thực thi:** event audit cùng transaction, actor/action/entity/id, before/after được allowlist, correlation_id và lý do; không ghi secret từ đầu. Redaction đệ quy dict/list để bảo vệ legacy payload; malformed payload không trả nguyên văn nhạy cảm. Role/permission/session/verification/owner/payment/override đều có audit. Quyền DB ngăn sửa/xóa tùy tiện theo thiết kế vận hành.

**Nghiệm thu:** test nested arrays với token/password và PII; lỗi audit không tạo nghiệp vụ thiếu audit; nhật ký quyền/tiền/sở hữu đầy đủ và không có secret; không coi “không có DELETE endpoint” là bằng chứng append-only ở DB.

### F32 — P1 — Vòng đời file, tên Unicode và streaming chưa hoàn chỉnh [T/C]

**Bằng chứng:** `documents/router.py` đọc `await file.read()` trước kiểm tra limit; service giữ bytes, upload đồng bộ trong async route; download đọc toàn bộ object. Header filename raw gây UnicodeEncodeError đã tái hiện. `DocumentService.get_file` chỉ loại DELETED, không bắt buộc READY; adapter đọc bucket mặc định/latest, không version_id của metadata. Upload/link DB–S3 chưa có bù trừ/orphan cleanup rõ; version dùng max+1 có race.

**Thực thi:** giới hạn request từ gateway và app, bounded streaming/spool dưới runtime, kiểm content/magic theo loại; async/threadpool phù hợp để tránh block event loop. RFC 6266/5987 filename fallback + filename*, chống CRLF/path, Cache-Control cho file riêng tư. File state machine UPLOADING/READY/FAILED/QUARANTINED/DELETED, bucket/key/version/hash được bảo toàn; version/link concurrency và cleanup an toàn.

**Nghiệm thu:** file tiếng Việt, dung lượng vượt, giả định dạng, ngắt upload, upload thành công/DB fail, QUARANTINED, object version cũ; không ăn RAM tỷ lệ số upload quá mức; tải đúng version, không xóa file đang được căn cứ sử dụng.

### F33 — P1 — Runtime/MinIO mới đáp ứng một phần yêu cầu không phình ổ C [C/V]

**Bằng chứng:** compose bind `./runtime/minio/data` là hướng đúng nếu backend nằm ngoài C. Nhưng `RUNTIME_DIR` hiện chỉ khai báo, chưa dùng để định tuyến temp/spool/export/cache/log; không có guard kiểm ổ đĩa hay đường dẫn thực. Image `elestio/minio:latest` chưa pin. Docker image/cache/VHDX vẫn có thể nằm trên C dù object data đã bind mount.

**Thực thi:** một RuntimePaths resolver tính từ backend root; tạo/check thư mục `runtime/{minio/data,tmp,uploads,exports,logs,backups}` ngoài C theo cấu hình thực. Redirect TEMP/TMP/spool của process khi cần, cleanup/quota/disk warning. Pin image theo version/digest đã kiểm chứng, ghi provenance, healthcheck, policy private/versioning/retention. Di chuyển Docker Desktop disk image bằng thiết lập hỗ trợ nếu mục tiêu là cả image/cache ngoài C; không sửa tay file VHDX đang chạy.

**Nghiệm thu:** `docker inspect` bind source đúng; upload/export/restart không mất dữ liệu; kiểm đường temp khi upload lớn; đo dung lượng C và thư mục backend trước/sau. SQL MDF/LDF vẫn theo DB đã dựng; cache offline trên điện thoại là ngoại lệ tất yếu, bản chính sau sync ở server.

### F34 — P1 — Quality gate có thể báo đạt dù native command lỗi [T/C]

**Bằng chứng:** `scripts/quality-gate.ps1` dùng `$ErrorActionPreference="Stop"` nhưng không kiểm `$LASTEXITCODE` sau uv/pnpm/flutter. Trong PowerShell, chỉ cấu hình này không bảo đảm mọi native command non-zero trở thành terminating error. Repo hiện có 2 Ruff errors, trong khi STATE ghi quality gate 100%.

**Thực thi:** wrapper native command kiểm exit code ngay, throw/exit non-zero; chạy từ `$PSScriptRoot`/repo root, ghi log và target test. Pin hỗ trợ PowerShell rõ; nếu dùng PSNativeCommandUseErrorActionPreference vẫn cần kiểm behavior version hỗ trợ. Thêm CI chạy unit, lint, build, contract tests và integration test trên DB test. Không chạy migration DB thật trong CI.

**Nghiệm thu:** cố ý tạo lint/type/test failure lần lượt, gate phải dừng và exit non-zero; không in thông điệp “tất cả đạt”. Khôi phục lỗi thử rồi đạt gate thực; warning budget có tiêu chí rõ.

### F35 — P1 — Test hiện tại bỏ sót luồng thật và có assertion không chứng minh tên test [C]

**Bằng chứng:** tests tự tạo ORM fixtures bỏ qua API đăng ký care/construction; các test “concurrent” có đường gọi tuần tự; `test_export_acl_unauthorized_access` tạo user không quyền nhưng chỉ kiểm request không token (401), không kiểm authenticated 403. `get_staff_token` fallback admin. Flutter test tạo model trực tiếp, không parse JSON API; chưa có web E2E/Flutter integration suite.

**Thực thi:** giữ test có giá trị, sửa những test sai mục tiêu. Bổ sung regression theo F-ID, dùng hai connection/thread thật với barrier cho race; fault injection tại commit/upload/job; fixtures từ OpenAPI/serializer cho clients; E2E tạo dữ liệu qua public application API. Không dùng số test làm KPI duy nhất.

**Nghiệm thu:** suite bắt được lỗi trước sửa, test quyền không fallback admin, mỗi regression có assertion về DB cuối và response; báo test run/skip/xfail kèm lý do. Không tuyên bố toàn hệ thống đạt dựa trên 6 test cô lập của review này.

### F36 — P1 — Quản trị tài khoản/quyền còn là placeholder và thiếu guard [C]

**Bằng chứng:** `web/src/App.tsx:800` tab admin_users chỉ giới thiệu 4 vai trò, chưa có bảng/form quản lý. Backend có create/update user nhưng chưa chặn tự khóa/admin cuối hoặc kiểm đủ role_ids không tồn tại; chưa có UI ma trận quyền và session administration hoàn chỉnh.

**Thực thi:** bảng user tìm/lọc/pagination, create/edit/disable/reset theo quyền, revoke sessions; bảo vệ admin cuối và tài khoản đang thao tác; validate toàn bộ role IDs. Chốt vai trò lãnh đạo xem báo cáo nếu nghiệp vụ cần, không gộp mặc định thành ADMIN. Với role preset cố định, UI phải ghi rõ; nếu cho sửa permission, cần version/revoke và audit.

**Nghiệm thu:** không tự làm hệ thống mất quản trị; quyền đổi có hiệu lực trên cả web/mobile; người ít quyền không mở được endpoint quản trị; thao tác nguy hiểm có xác nhận cụ thể và lý do.

### F37 — P2 — UX/UI thiên về trình diễn kỹ thuật, chưa tối ưu công việc thật [C/V]

**Bằng chứng:** màn overview nhấn DB/server/MinIO; UI có nhãn M/G, badge quyền, chức năng job mẫu; nhiều module rất dài với inline styles, alert, modal tự dựng, nhập caretaker bằng ID. Navigation dùng state activeTab, khó deep-link/back/refresh đúng màn. Form/tìm kiếm cần xác minh race và trạng thái stale bằng browser.

**Thực thi:** áp dụng đặc tả UX mục 7: dashboard theo vai trò, design tokens/components, thông điệp nghiệp vụ, async combobox, URL routing, 4 trạng thái, error mapping, a11y. Di chuyển thông tin hạ tầng sang trang quản trị kỹ thuật. Tách component theo use case, không viết lại toàn bộ chỉ để đổi style.

**Nghiệm thu:** chụp các breakpoint, keyboard/focus/Escape, contrast/text scale, thiết bị cầm tay ngoài trời; test tác vụ đầu-cuối với người dùng đại diện, không chỉ screenshot trang chủ.

### F38 — P2 — Query chưa sẵn sàng dữ liệu lớn, danh sách bị cắt âm thầm [C/V]

**Bằng chứng:** nhiều `.all()` + vòng lặp lazy relationships trong finance/reports/care/plots; report occupancy tạo IN plot_ids theo khu có thể vượt giới hạn parameter SQL Server khi dữ liệu lớn. Web map lấy `limit=500`; wizard có limit 100 và không pagination đầy đủ. Bundle JS chính 800 kB, mọi module import trực tiếp.

**Thực thi:** aggregate ở SQL, eager loading có chủ đích, pagination có total/cursor và sort ổn định; map query theo bounds/cluster hoặc rõ phạm vi đã tải; tránh IN list lớn bằng JOIN/subquery. Đo execution plan trước thêm index. Lazy-load route/module, data cache và hủy request cũ đúng vòng đời.

**Nghiệm thu:** dataset tổng hợp lớn hơn 2.100 plot/khu, nhiều payment/schedule; không lỗi parameter, không thiếu dữ liệu im lặng; đo query count/p95/memory. Mục tiêu local staging đề xuất: list p95 <1 giây, command DB ngắn p95 <2 giây, export lớn async; chốt lại theo máy và tải thực tế.

### F39 — P2 — Tra cứu công khai cần chính sách xuất bản, chống quét và tìm kiếm tiếng Việt [C/V]

**Bằng chứng:** DTO public đã tránh PII thân nhân là điểm tốt; `public_lookup_deceased` tìm mọi profile phù hợp, kể cả chưa có slot. Không có publication policy hoặc rate limit trong app. `_strip_accents` có khai báo nhưng không được dùng; kết quả không dấu phụ thuộc collation thực tế. Thiếu/chưa duyệt GPS chưa có quy trình dữ liệu rõ.

**Thực thi:** xác định trường công khai và điều kiện xuất bản, không công bố tất cả hồ sơ mặc định nếu chưa được duyệt; query limit/rate limit/cache thích hợp, escape wildcard nếu đó không phải tính năng tìm kiếm. Chuẩn hóa tìm không dấu bằng collation/index hoặc normalized key được test, xử lý Đ/đ. GPS có provenance/validation; fallback mã khu/hàng/ô khi không có tọa độ. Giữ attribution/quota của map provider.

**Nghiệm thu:** khách không lấy được PII qua API/file khác; tên trùng/no result/dấu-không dấu; query wildcard/rate limit; hồ sơ chưa được xuất bản không lộ; không dùng tọa độ demo làm chỉ đường thật.

### F40 — P1 — Thiếu runbook triển khai, backup/restore và giám sát có bằng chứng [C/V]

**Bằng chứng:** scripts chủ yếu hướng dẫn dev; compose chỉ MinIO. Vite dev proxy không tự tồn tại ở production. STATE nói có backup local nhưng chưa có restore rehearsal SQL + object versions/manifest trong repo. Readiness trả raw exception ra client và còn có thao tác tạo bucket. APP_VERSION/backend package vẫn 0.2.0 trong khi tag milestone đã xa hơn.

**Thực thi:** chọn mô hình vận hành Windows service/reverse proxy phù hợp máy SQL Server, hoặc deployment được chốt; API/web chung origin HTTPS, worker riêng, service account tối thiểu, logging không PII, readiness thông tin tối thiểu và chi tiết ở log nội bộ. Runbook backup nhất quán DB + object/version manifest, bản sao ngoài máy, retention và restore môi trường sạch; migration plan/rollback/maintenance window.

**Nghiệm thu:** restart host/dịch vụ không mất job/dữ liệu; restore đối soát số dòng, hash/version của scan/biên lai, balance/ownership; có RPO/RTO được chốt và đo thật. Health không lộ connection detail; release manifest ghi commit, DB revision, image digest, API/mobile version.

### F41 — P2 — Trạng thái tài liệu và version Git vượt quá bằng chứng hiện có [C]

**Bằng chứng:** STATE đánh dấu M00–M12 Done, mô tả worker/offline/quality gate đầy đủ trong khi các F-ID cho thấy còn khoảng trống; README có mô tả giản lược nhầm nhóm HĐ/phụ lục. Repo có tags theo milestone là tốt, nhưng tag không thay thế bằng chứng nghiệm thu. Version API 0.2.0, web 0.0.0, mobile 1.0.0 chưa thống nhất ý nghĩa.

**Thực thi:** bổ sung ma trận Implemented/Verified/Partial/Blocked thay nhãn Done chung; sửa tài liệu theo code đã xác minh; giữ lịch sử và ghi corrective review. Version SemVer/release manifest rõ cho từng deliverable. Mỗi wave PR/commit/tag theo mục 8, không xóa/ghi đè tag cũ để sửa lịch sử.

**Nghiệm thu:** đọc README biết chính xác luồng dùng được, giới hạn và gate chưa chạy; mọi đánh dấu Verified có log/test/screenshot tương ứng; không còn tuyên bố offline/production sẵn sàng khi chưa có bằng chứng.

### F42 — P2 — Tool/MCP/skill cần phục vụ kiểm chứng, không chỉ khai báo [C/V]

**Bằng chứng:** `.agents/mcp_config.json` hiện chỉ cấu hình Dart MCP; có rules/skills ngắn nhưng không có bằng chứng trong repo về browser E2E, schema contract và kiểm chứng MSSQL concurrency theo plan. Không suy ra MCP chưa chạy trên máy cá nhân chỉ vì không có log trong Git.

**Thực thi:** thiết lập bộ tối thiểu tại mục 8.4; CLI đủ dùng thì dùng CLI. Pin phiên bản, smoke test, quyền tối thiểu; sửa instruction về `with_for_update` và gate “build xanh = done”. Tạo project skills cho sqlserver-transaction-review, api-contract-check, ui-review, release-verification với command thật và giới hạn dữ liệu.

**Nghiệm thu:** agent tự chạy được check phù hợp và lưu evidence; công cụ DB chỉ read-only với DB thật, ghi chỉ DB test; không đưa secret/PII vào browser fixture, MCP prompt hoặc screenshot. Không thêm nhiều MCP không sử dụng.

## 4. Kiến trúc đích cho các phần rủi ro

### 4.1. Transaction và thanh toán

Một command phải có **một chủ sở hữu transaction** ở service/use-case. Repository/helper không được tự commit khi tham gia command đó. Router validate/authenticate rồi gọi use-case. Có thể tách repository cho query/lock dùng lại; không cần thêm abstraction rỗng cho mọi CRUD.

Luồng thu tiền đề xuất:

1. Authenticate/authorize; kiểm idempotency key, payload chuẩn hóa và request hash.
2. Trong transaction: claim key, khóa/conditional-update receivable theo policy MSSQL, kiểm nguồn/status/số tiền, insert payment, flush trigger, đọc balance mới, tạo receipt metadata + snapshot, audit và outbox, lưu kết quả idempotency; commit một lần.
3. Trả payment đã xác nhận, receipt status PENDING và URL lấy trạng thái. Nếu transaction chưa commit, không trả thành công.
4. Worker sinh PDF từ snapshot, upload theo object identity bền vững, finalize metadata READY; retry không tạo payment/receipt thứ hai.
5. Client timeout phải truy vấn/replay cùng key; hiển thị “đã ghi nhận tiền, chứng từ đang tạo” khi phù hợp.

**Không giữ khóa SQL trong lúc gọi S3 hoặc render PDF.** Không sửa `trg_payments_sync_receivable_balance` tùy tiện trước khi quyết định ai là nguồn tính balance. Nếu giữ trigger, hiểu rõ trigger chạy trong transaction và test multi-row insert. Với refund/adjustment sau này, phải mở rộng mô hình/trigger có thiết kế, không update/delete payment trực tiếp.

### 4.2. Sở hữu, pháp lý và thực hiện hiện trường

| Aggregate | Nguồn sự thật | Thao tác được phép |
|---|---|---|
| Contract/Annex | Căn cứ pháp lý và snapshot đã phát hành/ký | Draft, submit, activate, cancel/amend theo policy |
| PlotOwnership | Lịch sử chủ và căn cứ hiện hành | Chuyển chủ atomically; không sửa lịch sử đã đóng |
| Burial/Exhumation/Cremation operation | Kế hoạch và thực hiện công việc | Schedule/complete/cancel theo quyền, proof và version |
| PlotSlot | Người thực sự đang nằm trong slot | Chỉ complete burial/exhumation hợp lệ thay đổi |
| Plot status | Trạng thái dẫn xuất/điều phối nhất quán với slot/owner/lock | Không generic PATCH status tùy ý |
| Care/Construction execution | Việc được giao, checklist, ảnh và nghiệm thu | Actor có assignment hoặc override được audit |

Giữ quy tắc Kim Tĩnh đã chốt trong tài liệu nguồn. Các câu hỏi chưa rõ như quyền chôn thêm trong cấu trúc nhiều slot sau khóa phải được đối chiếu/chốt, không thay bằng giả định kỹ thuật tiện triển khai.

### 4.3. API contract và lỗi

- OpenAPI được xuất trong CI từ backend; diff có kiểm soát, update client cùng PR khi breaking.
- Tiền truyền dạng decimal string với quy tắc precision đã chốt; ngày nghiệp vụ ISO date, instant UTC có offset/Z; hiển thị theo Asia/Ho_Chi_Minh.
- Lỗi chuẩn: `code`, `message`, `field_errors`, `correlation_id`; không trả raw DB/S3 exceptions. 409 cho stale version/race/business conflict; 422 cho dữ liệu không hợp lệ; 403 cho không có quyền; 404 theo policy tránh lộ tồn tại.
- PATCH dùng field presence (`exclude_unset`) để phân biệt bỏ qua và xóa nullable; validate toàn entity sau merge. Trạng thái dùng enum/transition allowlist đồng bộ DB.
- File reference ưu tiên file_id + endpoint được authorize, không dùng object_key như URL công khai.
- Quyền và assignment kiểm ở server ở cả lúc read/write/sync. Client chỉ hỗ trợ UX.

## 5. Các đợt thực thi và đầu ra bắt buộc

Ước lượng S/M/L chỉ biểu thị độ rộng tương đối, không phải cam kết số ngày hoặc số giờ AI. Hoàn tất từng đợt với bằng chứng; không chạy toàn bộ backlog thành một commit lớn.

| Wave | Phụ thuộc | F-ID chính | Đầu ra và gate kết thúc | Cỡ |
|---|---|---|---|---|
| R00 — Baseline an toàn | Không | F01, F34, F41 | Branch, inventory/schema snapshot read-only, guard DB test, baseline test report, STATE trung thực | M |
| R01 — Security và session | R00 | F05, F06, F11, F19, F36-backend | Permission matrix, ACL dùng chung, secret guard, revoke/refresh đúng, negative tests | L |
| R02 — Transaction và tài chính | R00, R01 | F02, F03, F04, F27-finance, F28 | Lock/CAS MSSQL, atomic payment, receipt pending, outbox transaction, idempotency stress/fault tests | L |
| R03 — Sở hữu và vòng đời | R01, R02 | F07, F08, F10, F25 | State machine tách biệt, owner chain, expiry đúng, DB invariant migration, reconcile report | L |
| R04 — Căn cứ dịch vụ và hồ sơ | R03 | F12, F22, F23-snapshot, F24, F26 | Pricing/contract/package snapshot, đủ annex workflows, certificate version verification | L |
| R05 — Thi công/chăm sóc | R04 | F09, F13, F14, F15 | Assignment policy, checklist immutable, evidence gate, cycle generator chuẩn | L |
| R06 — API contract và web tích hợp | R01–R05 | F16-contract, F20, F21, F36-UI | DTO contract tests, API client chung, sửa route/token/filter, admin UI, CSS đúng | L |
| R07 — Flutter hiện trường | R05, R06-contract | F16, F17, F18 | Parser đúng, detail query, secure session, camera/checklist/upload, offline queue và Android release smoke | L |
| R08 — Worker/file/báo cáo/audit | R02, R04–R06 | F23-PDF, F27-worker, F29, F31, F32 | Worker thật, snapshot PDF, export đúng filter/quyền, audit completeness, storage lifecycle | L |
| R09 — UX, hiệu năng và public | R06–R08 | F37, F38, F39 | Role workflows, responsive/a11y, query budgets, public policy và evidence UI | M/L |
| R10 — Migration và vận hành | Xuyên suốt; gate sau R08 | F30, F33, F40, F42 | Migration preflight/restore, runtime ngoài C, service/deploy/runbook, toolchain smoke | L |
| R11 — Nghiệm thu và phát hành | R00–R10 | F35, F41; toàn bộ P0/P1 | UAT 39 UC, security/concurrency/fault/offline/restore suite, RC và release manifest | L |

**Lưu ý F30 không được đợi tới cuối mới làm:** bất kỳ wave có schema change đều phải dùng quy trình F30 ngay. R10 là nghiệm thu tổng hợp về vận hành, không phải thời điểm bắt đầu nghĩ về migration.

### 5.1. Checklist công việc trong mỗi wave

- [ ] Ghi HEAD, danh sách F-ID và scenario tái hiện; nhận diện dữ liệu đã có bị ảnh hưởng.
- [ ] Viết ADR ngắn nếu thay API/state machine/schema hoặc chính sách quan trọng.
- [ ] Có test target an toàn, dữ liệu tổng hợp phân biệt với dữ liệu thật.
- [ ] Triển khai backend + schema + client liên quan, không để API/client lệch nhau qua gate.
- [ ] Chạy lint/build/test đúng phạm vi; với concurrency dùng SQL Server thật của môi trường test.
- [ ] UI có screenshot/video ngắn chứng minh thao tác và lỗi; screenshot không chứa dữ liệu cá nhân thật.
- [ ] Migration có preflight, backup/restore strategy và evidence thử trên bản sao.
- [ ] Cập nhật STATE, changelog, F-ID status và giới hạn còn lại; commit theo phạm vi.
- [ ] Chỉ tag khi gate của wave đạt; không ghi “Done” nếu test còn skip vì thiếu môi trường.

### 5.2. Bộ tài liệu agent phải tạo trong repo

```text
docs/review/REMEDIATION_PLAN.md             # Bản plan này
docs/review/FINDINGS_STATUS.md              # F-ID, trạng thái, commit, bằng chứng
docs/review/API_PERMISSION_MATRIX.md        # Endpoint/action/scope/role
docs/review/UC_TRACEABILITY.md              # 39 UC → API/UI/test/evidence
docs/adr/ADR-transaction-and-idempotency.md
docs/adr/ADR-legal-vs-execution-state.md
docs/adr/ADR-api-money-session-contract.md
docs/operations/migration-and-recovery.md
docs/operations/runtime-storage.md
docs/operations/deployment.md
docs/evidence/Rxx/README.md                 # Lệnh, môi trường, exit code, kết quả
```

Artifact lớn, logs có dữ liệu cá nhân, backup và object dumps không commit. Repo chỉ giữ evidence đã khử nhạy cảm, test fixtures tổng hợp và manifest/hash cần thiết.

## 6. Ma trận đối chiếu 39 use case của plan gốc

“Partial” nghĩa là đã có một phần code, không có nghĩa đã nghiệm thu. Bảng này là bản đồ công việc, không phải chứng nhận chạy được trên máy của chủ dự án.

| UC | Nội dung | Đánh giá tại commit review | F-ID / gate cần đóng |
|---|---|---|---|
| 1.1 | Khu/hàng/ô, GPS | Có API/map; cần integrity và UX cấu hình | F10, F37–F39 |
| 1.2 | Loại mộ, số slot | Có sinh slot; cần kiểm thay đổi cấu hình với ô đang dùng | F10, F30, test invariant |
| 1.3 | Trạng thái mộ | Sai thời điểm chuyển occupancy | F07–F10 |
| 1.4 | Tra cứu tình trạng | Có; phân trang/scope/public chưa đủ | F05, F38, F39 |
| 1.5 | Dẫn đường | Web có URL/map; mobile và GPS thật chưa nghiệm thu | F18, F39 |
| 2.1 | Khách hàng/thân nhân | Có CRUD; quyền/mã/validation cần sửa | F05, F26 |
| 2.2 | Người mất/giấy báo tử | Có verification nhưng thiếu quyền/file gate | F05, F26, F32 |
| 2.3 | Liên kết khách–người mất–ô | Có; căn cứ sau chuyển nhượng sai/thiếu | F07, F08 |
| 2.4 | Tra cứu hồ sơ | Có; không dấu/scope/limit cần kiểm | F05, F26, F38 |
| 3.1 | Lập 4 loại HĐ | Có handlers; stale owner/pricing/reservation chưa an toàn | F02, F08, F22, F25 |
| 3.2 | In HĐ/phụ lục | PDF chung, chưa snapshot/type đầy đủ | F23, F24, F27 |
| 3.3 | Scan đã ký/hiệu lực | Có activation; file/version và execution bị trộn | F06–F08, F23, F32 |
| 3.4 | Lập phụ lục/gia hạn | BURIAL có; CARE hỏng; CONSTRUCTION/renewal thiếu | F12, F24 |
| 3.5 | Trạng thái/thời hạn | Partial; state/expired/filter chưa nhất quán | F07, F24, F29 |
| 4.1 | Checklist thi công | Có nhưng thiếu đường tạo căn cứ đúng | F09, F24 |
| 4.2 | Phân công thi công | Cảnh báo chưa đủ policy | F15 |
| 4.3 | Cập nhật checklist hiện trường | Backend có; mobile chưa thực thi | F09, F16, F17 |
| 4.4 | Tiến độ | Có tính; bypass complete và mobile fields sai | F09, F16 |
| 4.5 | Hạn thi công | Có dates; cần validate và conflict khi sửa | F15, F29 |
| 5.1 | Đăng ký gói | Endpoint hỏng | F12, F22, F24 |
| 5.2 | Lập lịch | Có generator, chưa đúng cycle | F13, F25 |
| 5.3 | Phân công care | Có; vẫn lưu khi conflict, thiếu notification consumer | F14, F15, F27 |
| 5.4 | Checklist/đóng ca | Backend có lỗ hổng; mobile/offline thiếu | F14, F17, F20 |
| 6.1 | Tạo khoản phải thu | Có XOR/unique; source/đợt/snapshot thiếu | F28, F30 |
| 6.2 | Ghi nhận thanh toán | Có nhưng transaction/retry/race chưa an toàn | F02–F04, F28 |
| 6.3 | Biên lai/chứng từ | Có sync PDF; retry/sequence/file URL chưa đúng | F03, F20, F23, F28 |
| 6.4 | Chiết khấu | Có; thiếu trần/duyệt và policy sau payment | F28 |
| 7.1 | Doanh thu | Lấy payment đúng hướng; time/filter/perf cần sửa | F29, F38 |
| 7.2 | Mộ/khu/trạng thái | Có; phụ thuộc integrity và query scale | F07, F29, F38 |
| 7.3 | Hợp đồng | Chưa đủ 4 loại, nhánh care expiring lỗi | F29 |
| 7.4 | Thi công/chăm sóc | Có aggregate; time/status/evidence chưa chuẩn | F09, F14, F29 |
| 7.5 | Xuất file | Có; bypass quyền, filter/snapshot/worker thiếu | F06, F27, F29, F32 |
| 8.1 | Đăng nhập | Có; logout/rotation/client refresh chưa đủ | F18, F19 |
| 8.2 | Tài khoản | Backend partial, UI placeholder | F36 |
| 8.3 | Phân quyền | Có preset RBAC, chưa phủ API/scope và quản trị | F05, F06, F19, F36 |
| 8.4 | Loại HĐ/điều khoản | Có catalog; nội dung version bị ghi đè | F23, F24 |
| 8.5 | Gói dịch vụ | Có CRUD; snapshot/chu kỳ chưa chuẩn | F12, F13, F22 |
| 8.6 | Bảng giá | Có; resolver chưa dùng thống nhất | F22 |
| 8.7 | Audit | Có viewer; coverage/atomicity/redaction thiếu | F31 |

### 6.1. Bộ scenario nghiệm thu bắt buộc

| ID | Scenario | Kết quả bắt buộc |
|---|---|---|
| A01 | Test trỏ nhầm DB thật | Dừng trước mọi ghi dữ liệu |
| A02 | Hai người giữ cùng plot đồng thời | Một thành công; một conflict có thông báo; DB nhất quán |
| A03 | Hai request thu phần nợ còn lại đồng thời | Không thu vượt theo policy, không lost update |
| A04 | Thu tiền rồi response mất | Replay cùng key trả payment cũ, không phát sinh thu lần hai |
| A05 | S3/PDF lỗi sau ghi tiền | Payment đã ghi vẫn tra được; receipt retry có trạng thái |
| A06 | Cùng key khác payload | 409, không trả nhầm cached response |
| A07 | CARETAKER gọi verify certificate/export báo cáo | 403 theo ma trận; không có artifact mới |
| A08 | User tải file ngoài phạm vi bằng file_id | Bị từ chối trên mọi đường tải/preview |
| A09 | Logout rồi dùng access token cũ | Bị từ chối theo session design đã chốt |
| A10 | Scan HĐ/phụ lục an táng tương lai | Pháp lý ACTIVE; slot chưa OCCUPIED |
| A11 | Complete burial lặp hoặc hai người cùng slot | Một occupancy/history, conflict/replay đúng |
| A12 | Cải táng draft cũ, slot đã đổi người | Không xóa người hiện tại |
| A13 | Chuyển nhượng draft cũ sau khi đã đổi chủ | Chặn; owner/history không bị ghi sai |
| A14 | Chủ cũ/chủ mới lập phụ lục | Chủ cũ bị chặn; chủ mới dùng căn cứ mới hợp lệ |
| A15 | Kim Tĩnh: API và direct SQL nhiều dòng | Không phá invariant; transaction rollback đúng |
| A16 | Generic PATCH thi công COMPLETED | Không bypass checklist/evidence |
| A17 | Ca CLOSED bị uncheck/thêm proof không phép | Chặn hoặc đi amendment/reopen có audit |
| A18 | Người không được giao sửa việc | 403; offline sync cũ thành conflict |
| A19 | Care quý/năm/ngày cuối tháng/năm nhuận | Đúng kỳ, không trôi ngày neo, không trùng |
| A20 | Gói/template/khách đổi sau ký | Snapshot và PDF cũ không đổi |
| A21 | Flutter nhận JSON thật có Decimal string/null | Không crash; tiền/ID/tiến độ đúng |
| A22 | Flutter mất mạng/restart trong thao tác ảnh | Draft/queue còn; sync không trùng và không chốt thiếu ảnh |
| A23 | File Unicode/lớn/ngắt/giả MIME/quarantine | Error đúng, không 500 tên file; không đọc file chưa READY |
| A24 | Hai worker + lease hết + worker cũ trả kết quả | Chỉ kết quả chủ lease hợp lệ được chấp nhận |
| A25 | Báo cáo lọc tiền mặt/kỳ/status rồi export | File có đúng dataset/filter/totals trên UI |
| A26 | Lịch care sắp hết hạn gắn land/transfer | Báo cáo không AttributeError, nhóm thời hạn đúng |
| A27 | Dữ liệu >2.100 plot trong một khu | Không vượt parameter, không cắt thiếu im lặng |
| A28 | PowerShell native command exit non-zero | Gate thất bại, không báo pass |
| A29 | Android release trên thiết bị thật | HTTPS/API/camera/upload/session hoạt động |
| A30 | Restore SQL + S3 vào môi trường sạch | Đối soát balance/owner/file hashes/version đạt; RTO được đo |

## 7. Đặc tả UX/UI cần đưa vào execution

### 7.1. Bố cục và nhiệm vụ theo vai trò

| Vai trò | Trang mở đầu | Hành động chính | Điều cần tránh |
|---|---|---|---|
| Marketing | Hồ sơ/HĐ đang xử lý, ô cần tư vấn | Tìm khách, báo giá, giữ ô, lập căn cứ, bổ sung chứng từ | Nhập ID thủ công, phải nhớ G-code, lộ toàn bộ PII không cần thiết |
| Kế toán | Khoản đến hạn/quá hạn, giao dịch gần đây | Thu tiền, chiết khấu có quyền, xem biên lai pending/ready | Báo lỗi chung sau khi payment đã commit, bấm lại tạo key mới |
| Quản trang | Việc của tôi hôm nay, trạng thái sync | Mở vị trí, checklist, camera, ghi chú, hoàn tất | Dashboard hạ tầng, quá nhiều tab không liên quan, đóng ca khi ảnh chưa lên |
| Lãnh đạo | Doanh thu thực thu, dư nợ, occupancy, việc quá hạn | Lọc kỳ, drill-down, export có quyền | Gắn quyền ADMIN chỉ để xem báo cáo, KPI giả hoặc 0 khi API lỗi |
| Quản trị | Người dùng/quyền, cấu hình, audit, vận hành | Quản lý user, bảng giá/version, kiểm tra lỗi job | Panel placeholder hoặc hiển thị secret/cấu hình nội bộ cho mọi người |
| Khách tra cứu | Tìm người mất đã công bố | Xem khu/hàng/ô, mở chỉ đường, fallback vị trí | Hồ sơ thân nhân, CCCD, scan, chỉ đường bằng GPS demo |

### 7.2. Quy chuẩn giao diện

- Giữ phong cách trang trọng, màu xanh hiện tại có thể tiếp tục; xây tokens màu/spacing/type/border/status dùng chung. Trạng thái có chữ + icon, không chỉ màu.
- Desktop ưu tiên bảng có tìm/lọc/sort/pagination, drawer chi tiết, timeline pháp lý–thực hiện–thu tiền–chứng từ. Mobile ưu tiên card việc, vùng chạm tối thiểu theo platform, thông tin đủ đọc ngoài trời.
- CTA nêu nghiệp vụ: “Xác nhận đã an táng”, “Ghi nhận 5.000.000 đ”, “Đóng ca chăm sóc”; trước thao tác nhạy cảm hiển thị đối tượng, plot/slot, tiền và hậu quả cụ thể.
- Async combobox hiển thị tên + mã + thông tin phân biệt tối thiểu; không bắt người dùng tự nhập user_id/annex_id/file_id.
- Loading, empty, error, success riêng; API lỗi không biến thành danh sách rỗng hoặc KPI 0. Giữ filter/scroll khi refresh; request cũ không ghi đè kết quả mới.
- Form lỗi cạnh trường, tổng hợp ở đầu khi dài; không lạm dụng `alert()`. Có pending indicator chống double-click nhưng không dùng nó thay idempotency server.
- Modal/drawer có focus trap, tên truy cập, Escape/close, trả focus; bảng và biểu mẫu dùng keyboard được. Font scale 200%, màn 390 px không mất CTA.
- Signed scan/PDF có loading/error/retry, metadata loại/version/người tải; URL blob được revoke khi không dùng. Export hiển thị pending/failed/ready và quyền hiện tại.
- Navigation có URL/deep link/back; refresh ở `/contracts/:id` hoặc `/care/:id` không rơi về overview.

### 7.3. Bằng chứng UX cần nộp

Chụp 390×844, 768×1024, 1440×900 cho dashboard, hợp đồng nhiều bước, thu tiền, care checklist, admin và public lookup; thêm trạng thái lỗi/empty/loading. Video ngắn một luồng web và một luồng Android camera/offline. Không cần tạo hình trang trí trước khi form/API và quyền hoạt động đúng.

## 8. Git, công cụ và cơ chế làm việc với AI agent

### 8.1. Git milestone

1. `git status --short`, ghi HEAD và các thay đổi sẵn có. Tạo nhánh `review/remediation-r00` từ baseline hợp lệ; những wave sau dùng nhánh/PR riêng theo phụ thuộc.
2. Commit nhỏ theo nguyên nhân: ví dụ `fix(finance): persist payment and outbox atomically [F03]`, `test(auth): reject unauthorized report exports [F06]`.
3. Mỗi PR ghi: vấn đề, thay đổi hành vi, F-ID, migration/data impact, test thực chạy, giới hạn, rollback/recovery. Không chỉ liệt kê file đã tạo.
4. Tag ứng viên `v0.14.0-rc.1` hoặc phiên bản tiếp theo sau khi kiểm tra tags thực tế; milestone nội bộ có thể dùng `remediation-r02` annotated tag nếu chưa phải release. Không tự nhận số version còn trống.
5. Không di chuyển tags `v0.1.0`…`v0.13.0` cũ. Không push/merge/release production tự động nếu ngoài phạm vi giao việc của người dùng. Local commits theo wave là mặc định được yêu cầu.
6. Release 1.0 chỉ sau R11: P0=0, P1 bắt buộc đóng, UAT/restore/APK đạt; P2 còn lại có owner, lịch và rủi ro được chấp nhận rõ.

### 8.2. Trạng thái một finding

```text
F-ID | Priority | Open/Reproduced/In progress/Fixed/Verified/Deferred
baseline_commit | fix_commit | regression_test | evidence_path
data_impact | migration_revision | remaining_limitations
```

`Fixed` là có code sửa; `Verified` là đã chạy kiểm tra đúng môi trường. Không dùng hai từ này thay nhau. `Deferred` của P0/P1 phải ghi lý do và điều kiện chặn phát hành, không tự hạ priority để đủ gate.

### 8.3. Toolchain tối thiểu

| Mục đích | Công cụ phù hợp | Cách dùng trong dự án |
|---|---|---|
| Python/dependency | uv + lockfile hiện có | Frozen sync; Ruff; pytest unit/integration tách biệt |
| SQL Server | ODBC 18, SSMS/sqlcmd hoặc script pyodbc kiểm soát | Read-only introspection DB thật; concurrency/migration trên DB test |
| Web | pnpm lockfile, TypeScript, linter hiện có | Build/typecheck và kiểm warning thực tế |
| Browser E2E | Playwright; MCP nếu IDE cần điều khiển browser | Smoke flows bằng fixture tổng hợp, test UI thật, screenshot/traces |
| Flutter | Flutter/Dart SDK đã cài trên máy chủ dự án | analyze, unit/widget/fromJson, integration_test, Android release smoke |
| API contract | OpenAPI + generated client hoặc schema/fixture tests | Backend JSON → TS/Dart; diff schema trong CI |
| Storage | Docker Compose + S3 CLI/MinIO client | Inspect mount, private policy, object/version/hash, backup restore |
| Source control | Git; GitHub CLI tùy nhu cầu | Branch/commit/PR/checks/release evidence, không cần MCP để thay mọi lệnh |
| Security | Secret scan + dependency audit thích hợp lockfile | Chạy theo gate; triage phát hiện thật, không tự update major hàng loạt |

### 8.4. Setup MCP/skill trong Antigravity

- Kiểm tra CLI hoạt động trước khi thêm MCP: `git --version`, `uv --version`, `node --version`, `pnpm --version`, `flutter --version`, `dart --version`, `docker version`, ODBC driver.
- Cấu hình Dart MCP hiện tại dùng `cmd /d /c dart mcp-server`: kiểm tra lệnh được SDK cài hỗ trợ và IDE thật sự kết nối; ghi version và smoke result. Không suy từ file config ra trạng thái Connected.
- Playwright: cài bản pin trong workspace tooling/dev dependencies khi quyết định dùng; chạy browser smoke với API test, sau đó mới tùy chọn nối MCP theo tài liệu chính thức. Không dùng `npx ...@latest` không kiểm soát ở release workflow.
- SQL MCP chỉ bổ sung nếu tiết kiệm thao tác; kết nối DB thật bằng principal read-only, giới hạn query/schema; connection write chỉ tới DB test đã định danh. Không cấp sa hay quyền chạy script destructive cho agent.
- GitHub MCP/CLI tùy chọn cho issue/PR; token scope tối thiểu, lưu ngoài repo. Figma MCP chỉ cần nếu đã có nguồn thiết kế cụ thể; không bắt buộc để sửa lỗi UI hiện tại.
- Bốn skill dự án cần có workflow rõ: (1) migration/preflight/restore SQL Server; (2) transaction/concurrency review; (3) OpenAPI/client contract; (4) UI + release evidence. Mỗi skill phải ghi điều kiện đầu vào, command, output evidence và khi nào dừng; không thay thế kiểm tra bằng câu “đã review”.
- Chưa có lỗi cần dùng đến nhiều agent song song như điều kiện bắt buộc. Nếu dùng, chia ownership theo file/module và integration contract, tránh hai agent cùng sửa schema/service transaction không phối hợp.

### 8.5. Prompt có thể đưa trực tiếp cho Antigravity

> Bạn đang tiếp tục repository cemetery-management-system. Hãy đọc toàn bộ docs/review/REMEDIATION_PLAN.md, AGENTS.md và plan gốc. Baseline của review là 51e8f752b510497bc6aef0193e6a43c1bfa55fc1; kiểm tra HEAD hiện tại và xác minh findings còn tồn tại. Bắt đầu R00, sau đó theo dependency của các wave. Không reset/dựng lại DB QL_NghiaTrang và không chạy tests có ghi dữ liệu trước khi test-target guard hoạt động. Giữ FastAPI, SQL Server, MinIO và Flutter. Với mỗi F-ID: tái hiện, sửa nguyên nhân, thêm regression phù hợp, chạy gate, lưu evidence, cập nhật FINDINGS_STATUS/UC_TRACEABILITY và commit riêng. Không dùng mock/seed để tuyên bố luồng UI/API thật đã hoàn thành. Không gọi with_for_update là khóa MSSQL nếu SQL sinh ra không chứng minh điều đó. Không tự bỏ invariant/phân quyền/constraint để pass test. Không đánh dấu offline/worker/admin UI hoàn thành khi mới có DTO hoặc màn hiển thị. Đưa ra phương án cụ thể cho quyết định nghiệp vụ còn thiếu, tiếp tục các phần không bị phụ thuộc. Kết thúc mỗi wave báo kết quả, commit, migration, tests thực chạy và gate còn thiếu; chỉ phát hành khi R11 đạt.

## 9. Phát triển mở rộng sau khi lõi được nghiệm thu

| Ưu tiên sau MVP | Mở rộng | Giá trị | Điều kiện trước khi làm |
|---|---|---|---|
| E01 | Thông báo công việc/sắp hết hạn/công nợ | Giảm bỏ sót việc và thời hạn | Worker/outbox thật, preference/permission, chống gửi trùng; xác nhận kênh và nội dung |
| E02 | Điều phối lịch trực quan và năng lực nhân sự | Giảm chồng ca, nhìn tải theo ngày/tuần | Assignment/time model và conflict policy đã chốt |
| E03 | QR tại ô mộ dẫn đến thông tin public được duyệt | Tra cứu nhanh tại hiện trường | Public policy, không chứa PII; không dùng QR như quyền truy cập nội bộ |
| E04 | GIS lối đi nội bộ và chỉ đường từng đoạn | Dẫn đường đúng trong khuôn viên | Khảo sát thực tế, tọa độ/graph được duyệt, map provider/license phù hợp |
| E05 | Cổng khách hàng/thân nhân | Xem hợp đồng, khoản thu, chứng từ của mình | Account linking/ủy quyền, object-level ACL, chính sách dữ liệu; không chỉ dùng citizen_id làm mật khẩu |
| E06 | Đối soát ngân hàng/VietQR tự động | Giảm nhập tay, đối chiếu giao dịch | Webhook signature, event idempotency, reconciliation, duplicate/reversal policy; label VIET_QR hiện tại không đồng nghĩa tích hợp ngân hàng |
| E07 | Chữ ký số/hóa đơn điện tử nhà cung cấp | Hoàn thiện tài liệu điện tử | Yêu cầu nghiệp vụ, nhà cung cấp và quy định hiện hành được xác minh riêng; biên lai hiện tại không tự được gọi là hóa đơn điện tử |
| E08 | Refund/điều chỉnh tài chính được duyệt | Sửa sai hợp lệ, không xóa lịch sử payment | Ledger/adjustment model, quyền duyệt, cập nhật báo cáo và audit |
| E09 | OCR hỗ trợ nhập giấy tờ | Giảm gõ tay | Human verification, xử lý PII, độ tin cậy; OCR không tự verify giấy báo tử |
| E10 | iOS hoặc đa nghĩa trang | Mở rộng người dùng/quy mô | iOS cần macOS/Xcode/signing; đa cơ sở cần tenant scope/migration/ACL riêng, không thêm tenant_id nửa vời |

Không bắt đầu E05–E10 để tạo cảm giác nhiều tính năng khi các P0/P1 chưa đóng. Có thể thiết kế sơ bộ, nhưng không làm chúng thành dependency không cần thiết của việc sửa hệ thống hiện có.

## 10. Các quyết định cần chốt và mặc định đề xuất

| Quyết định | Đề xuất cho đợt sửa | Điều kiện phải xác nhận trước áp dụng dữ liệu thật |
|---|---|---|
| Môi trường vận hành | Giữ Windows gần SQL Server hiện hữu, web/API qua HTTPS reverse proxy; worker riêng | Máy/server/domain/service account và nơi backup ngoài máy |
| Reservation TTL | Một policy chung, có cấu hình và lý do; chưa tự expire căn cứ đã hiệu lực | Thời hạn giữ chỗ thực tế của đơn vị |
| Overpayment/discount/refund | Giữ chặn overpayment tới khi có quy trình duyệt và credit/refund; không clamp discount | Trần quyền, vai trò duyệt, cách xử lý tiền thừa/thu sai |
| Thời điểm hoàn tất hiện trường | Complete command có actor/performed_at/evidence, tách khỏi scan | Chứng từ nào được coi là bằng chứng và ai có quyền xác nhận |
| Care cycle | Tháng neo + cycle_months; tách kỳ thu và kỳ làm nếu khác | Gói quý/năm là thực hiện mỗi quý/năm hay thu theo quý/năm nhưng làm hàng tháng |
| Public memorial | Chỉ trường/record được duyệt công khai | Quy tắc công bố, ẩn/gỡ và yêu cầu thân nhân |
| Chuyển chủ có dịch vụ đang mở | Chặn và yêu cầu xử lý/điều chuyển có lịch sử | Trách nhiệm công nợ và quyền lợi dịch vụ của chủ mới |
| RPO/RTO | Có backup ngoài máy và restore rehearsal trước release | Mức mất dữ liệu/thời gian gián đoạn chấp nhận được |

Những quyết định này không cản việc sửa parser Flutter, endpoint sai, test guard, ACL rõ ràng, quality gate hay constructor care. Agent phải tiếp tục các phần đó trước khi hỏi thêm.

## 11. Nguồn kỹ thuật và cách truy lại bằng chứng

Nguồn chính là **mã nguồn tại commit cố định**, không phải các dòng tuyên bố trong README. Mỗi F-ID đã chỉ rõ file/hàm để agent đối chiếu. Tham khảo kỹ thuật chính thức được dùng để kiểm tra các điểm dễ sai:

- [SQLAlchemy — SELECT, with_for_update và with_hint](https://docs.sqlalchemy.org/en/20/core/selectable.html): hành vi phụ thuộc dialect; kết luận F02 còn được kiểm bằng compile tại phiên bản trong lockfile.
- [Microsoft — SQL Server table hints](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table): UPDLOCK/HOLDLOCK, giới hạn READPAST và tương tác isolation. Phải test cấu hình thật, không dán hint hàng loạt.
- [Microsoft — PowerShell preference variables](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-7.6): hành vi native command và PSNativeCommandUseErrorActionPreference.
- [Microsoft — PowerShell error handling](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_error_handling?view=powershell-7.6): exit code/error handling cần được xử lý rõ trong script.
- [Flutter — Networking](https://docs.flutter.dev/data-and-backend/networking) và [Android release](https://docs.flutter.dev/deployment/android): quyền Internet và checklist release cần kiểm trên artifact thực tế.

Các tài liệu online có thể thay đổi; khi implementation chọn thư viện/MCP mới, agent phải đọc tài liệu chính thức theo phiên bản pin tại thời điểm triển khai. Không cần nâng cấp toàn bộ dependency chỉ vì có bản mới.

## 12. Definition of Done cuối cùng

- [ ] Tất cả P0 đóng với regression phù hợp và test SQL Server thật trong môi trường test.
- [ ] P1 bắt buộc đã sửa; không còn endpoint care hỏng, Flutter parser lệch, đường upload/token sai, bypass permission/complete.
- [ ] 39 UC có mapping API/UI/test và trạng thái trung thực; các quyết định nghiệp vụ được ghi rõ.
- [ ] Thu tiền retry/race/fault không tạo trùng hoặc payment thiếu khả năng phục hồi biên lai.
- [ ] Scan và thực hiện hiện trường tách đúng; owner chain/slot/history/Kim Tĩnh nhất quán.
- [ ] Flutter thực hiện được công việc, camera, sync conflict; APK release gọi backend thật của staging.
- [ ] Web responsive/a11y và tác vụ theo vai trò được kiểm chứng; không còn panel demo giả làm sản phẩm.
- [ ] Migration trên dữ liệu có sẵn, backup/restore DB + S3, runtime ngoài C, HTTPS và tài khoản vận hành được nghiệm thu.
- [ ] Quality gate fail thật khi có lỗi; CI/evidence/release manifest gắn commit và DB revision chính xác.
- [ ] P2/E backlog còn lại có phạm vi, owner/ưu tiên và giới hạn bàn giao; không ghi “hoàn tất toàn bộ” khi chưa chứng minh.

**Điểm bắt đầu giao agent:** R00 ngay, sau đó R01–R03. Không chạy lại bootstrap SQL, không bổ sung tính năng mở rộng trước khi xử lý an toàn dữ liệu, phân quyền và tính đúng đắn nghiệp vụ.
