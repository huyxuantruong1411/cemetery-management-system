# Rà soát kết quả thực thi commit 3cfc146

Ngày rà soát: 13–14/10/2026. Ngày chốt báo cáo: 14/10/2026.

**Kết luận: chưa đủ điều kiện nghiệm thu toàn bộ plan.** Có những sửa đổi đúng và bộ kiểm thử hiện có đạt 89/89, nhưng vẫn tái hiện được lỗi phân quyền, giấy báo tử, nghiệm thu, định giá và thanh toán. Không dùng trạng thái “hoàn tất trọn vẹn” hoặc “UI-M01 Done” cho commit này.

Phạm vi là backend hỗ trợ **web/**, giao diện web desktop và trình duyệt trên điện thoại; không rà soát ứng dụng Flutter. Đây là báo cáo kiểm chứng, không phải một bản sửa mã nguồn ứng dụng.

## 1. Căn cứ và cách kiểm chứng

- Đối chiếu kết quả agent trong bản trao đổi do người dùng cung cấp với diff từ **4053b106da8ae6d7a5ce850f5cedf673e504f879** đến **3cfc146**.
- Giữ tiêu chí của [PLAN.md](PLAN.md), [actor-policy.md](../ui-alignment/actor-policy.md) và [đặc tả nghiệp vụ](../../reference/DAC_TA_NGHIEP_VU_HE_THONG_QUAN_LY_NGHIA_TRANG.md). Những lời khẳng định hoàn tất trong báo cáo agent là nội dung cần kiểm chứng.
- Có 24 file mã nguồn/test thay đổi trong backend/app, backend/tests và web/src. Không có migration mới, không có thay đổi seed quyền và không có thay đổi FinanceModule.
- Chạy backend mới từ HEAD trên cổng 8002 để tránh dùng tiến trình 8000 có thể đang giữ mã cũ. Trình duyệt mở Vite 5173 và chuyển tiếp request API tới backend mới. Không thay phản hồi nghiệp vụ ở các ca bình thường.
- Đăng nhập thật bằng các tài khoản actor đã có; không giả lập quyền qua dependency override. Trên CSDL chính chỉ đọc nghiệp vụ; đăng nhập có thể ghi session/audit theo cơ chế của ứng dụng.
- Các probe có ghi dùng **QL_NghiaTrang_Test**, xác minh bằng SELECT DB_NAME(), dữ liệu gắn nhãn SYNTHETIC và transaction ngoài rollback. Service vẫn commit vào savepoint; hết ca rollback transaction ngoài. Vì vậy đây **không phải** bằng chứng commit bền vững hoặc tranh chấp giữa hai connection độc lập.
- Có sao lưu COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY cho Test trước khi chạy suite: backend/runtime/backups/QL_NghiaTrang_Test_before_recheck_3cfc146.bak. Không bootstrap, không DROP DATABASE, không sửa schema trong lần rà soát này.
- File upload, PDF, biên lai và export dùng MinIO thật. Tạo 9 object và đã xóa đủ 9 object của probe. Ca lỗi phát sinh biên lai chủ động gây lỗi ở storage adapter trong Test, không tắt MinIO dùng chung.
- UI được kiểm tra tập trung ở 1440×900, 390×844 và màn hình thấp 390×320. Chưa chạy lại toàn bộ ma trận mọi màn hình, tablet 768×1024, keyboard và mạng yếu sau sửa; không tuyên bố responsive toàn hệ thống đã đạt.

### Bằng chứng mới

| Tệp | Nội dung |
|---|---|
| [probes.json](evidence/recheck-3cfc146/probes.json) | 59 bước request theo actor, HTTP status và hậu điều kiện của các ca nghiệp vụ |
| [price.json](evidence/recheck-3cfc146/price.json) | Giá mộ đơn bị dùng cho hợp đồng mộ đôi |
| [ui.json](evidence/recheck-3cfc146/ui.json) | Login, map, chăm sóc, nhân sự và lỗi/phục hồi public; ca public dùng kết quả đo lại có HTTP 200 |
| [pytest.txt](evidence/recheck-3cfc146/pytest.txt) | 89 passed, 6 warnings, 21.84s |
| [cleanup.json](evidence/recheck-3cfc146/cleanup.json) | Số bản ghi chính, revision, quyền không đổi; không còn các hàng RECHECK-% được kiểm tra |
| [screens](evidence/recheck-3cfc146/screens) | Ảnh chụp web tại viewport hẹp |

Các ID tài nguyên trong probes.json là ID của fixture Test đã rollback; **không** dùng lại các ID đó để gọi thao tác trên CSDL chính. Khi tái hiện, agent phải tạo fixture Test mới. Bộ 89 test có cách tạo/dọn fixture riêng; không khẳng định mọi bảng Test giữ nguyên số hàng. Đếm hàng trước/sau là kiểm tra nhanh, không phải đối chiếu toàn bộ dữ liệu theo từng byte.

### Quality gate được kiểm tra lại

| Lệnh | Kết quả | Giới hạn kết luận |
|---|---|---|
| uv run pytest, với DB_NAME được đặt thành QL_NghiaTrang_Test trước khi khởi chạy | 89 passed, 6 warnings | Bộ test hiện có; chưa bao phủ đầy đủ các tiêu chí KT01–KT39 |
| uv run ruff check app/ tests/ | Đạt, không lỗi | Kiểm tra tĩnh |
| pnpm lint | Exit 0, còn warnings | Không đồng nghĩa giao diện/actor flow đạt |
| pnpm build | Thành công, còn cảnh báo bundle lớn | Không chứng minh responsive, ACL hoặc nghiệp vụ đúng |

Warnings pytest gồm deprecation Starlette/httpx và cảnh báo cleanup DELETE ở test tài chính. Không nên đổi assertion nghiệp vụ chỉ để giữ số test xanh. Ví dụ test_assign_caretaker_with_conflict_warning đang chấp nhận lưu phân công có xung đột, trái KT19 trong plan được giao.

## 2. Những sửa đổi đã xác nhận có tác dụng

Chỉ đóng các ca cụ thể dưới đây; không suy rộng thành đóng toàn bộ nhóm BA tương ứng.

| Ca | Kết quả kiểm chứng |
|---|---|
| Quản trang/Kế toán tạo khách hoặc gửi hợp đồng chờ ký | Trả 403 theo permission; lỗi quyền ghi cũ đã được chặn ở các route thử |
| Danh sách nhân sự | Cả 4 actor đăng nhập nhận 200, 24 nhân sự; hết lỗi cú pháp SQL Server ở endpoint này |
| Phân công chăm sóc bằng POST | Hết 405; POST và PATCH đều đến service |
| Chăm sóc chỉ gửi media_url | Trả 400; không còn nhận URL thuần ở đường thêm minh chứng mới |
| Sửa checklist/thêm minh chứng sau CLOSED | Đều trả 400 ở các route đã thử |
| Dùng phụ lục CARE tạo lệnh thi công | Trả 400 |
| PUT lệnh thành COMPLETED khi còn 5 việc bắt buộc TODO | Trả 400; đã nối qua điều kiện nghiệm thu |
| Quản trang xuất REVENUE hoặc tải biên lai qua Documents | Trả 403 trong các ca thử |
| Cùng payment key nhưng đổi số tiền | Trả 409 |
| Storage lỗi khi tạo biên lai | Payment trả 201, invoice=null; sau đó gọi regenerate-invoice nhận 200 và tải PDF thành công |
| Public API lỗi 503 | Shell vẫn hiện, có thông báo lỗi, không có pageerror/crash trắng |
| Leaflet | Có 1 map lúc mở và sau chuyển module rồi quay lại; body 390px không tràn ngang trong ca đo |
| Login màn hình 390×320 | Cuộn tới nút submit được; Escape đóng được |

Các thay đổi tra cứu mã ô/hàng, audit cập nhật hồ sơ, kiểm tra quan hệ khi xóa ô và truyền filter báo cáo có trong diff. Tuy nhiên lần này chưa kiểm chứng đủ mọi nhánh để đóng BA-26/29/30/31.

## 3. Lỗi cần sửa và tiêu chí kiểm tra lại

Ưu tiên P0/P1/P2 dưới đây kế thừa mức ưu tiên của plan: P0 chặn nghiệm thu nghiệp vụ/quyền, P1 cần hoàn thiện hành trình, P2 hỗ trợ chất lượng và bằng chứng. Một số lỗi đã có từ baseline, một số là nhánh còn hở của bản sửa; ghi rõ để không quy tất cả là hồi quy mới.

### R01 — P0 — Che CCCD không chạy với User thực tế; DTO vẫn quá rộng

**BA-02; bản sửa chưa đạt.** Quản trang GET chi tiết hợp đồng trả 200, CCCD synthetic nguyên vẹn, có địa chỉ và tổng giá trị; GET PDF pháp lý cũng trả 200. Theo actor-policy, Quản trang phải dùng WorkBasis, không nhận hợp đồng đầy đủ.

**Vị trí:** contracts/service.py:1596 đọc getattr(current_user, "role", None), trong khi auth/models.py:74 định nghĩa quan hệ User.roles. Sửa mỗi điều kiện role vẫn chưa loại được toàn bộ giá/scan và quan hệ thừa.

**Thực hiện:** tạo projection WorkBasis/FinanceBasis/LegalContractDetail theo allowlist và scope phía server; từ chối endpoint pháp lý với actor không được phép. Nav, selector và detail của Quản trang phải chuyển sang căn cứ công việc. Không dùng CSS để giấu dữ liệu đã trả về.

**Nghiệm thu:** JWT thật của từng actor gọi list/search/detail/PDF; Quản trang bị 403 ở route pháp lý, đọc được WorkBasis cần thiết nhưng response không chứa CCCD, giá, scan. Chụp giao diện căn cứ trên desktop và 390px.

### R02 — P0 — Documents còn vượt quyền đối với bản ký và liên kết phiên bản

**BA-04; bản sửa mới che một phần invoice/report.** Marketing upload PDF và gắn SIGNED_CONTRACT; Quản trang tải file đó nhận 200, rồi POST /documents/versions gắn phiên bản pháp lý nhận 201, dù không có contracts:write.

**Vị trí:** documents/service.py:102 chỉ kiểm Invoice và ReportExport; link_document_version:166 không kiểm quyền ghi đối tượng cha. documents/router.py cũng cần cùng policy.

**Thực hiện:** một bộ authorize dùng chung cho preview/download/link-version, xác minh parent, purpose, trạng thái và scope. File chưa liên kết phải có chính sách uploader/phiên upload rõ ràng; mặc định không mở cho mọi tài khoản. Bảo vệ cả scan giấy báo tử, phụ lục, hợp đồng và bằng chứng.

**Nghiệm thu:** Quản trang không tải/gắn legal scan; Kế toán không tải giấy báo tử; người được phép vẫn upload/xem đúng tài nguyên. Thử cả endpoint nghiệp vụ và endpoint file chung; lỗi 403 có UI tiếng Việt, không mất draft.

### R03 — P0 — Quyền export theo loại còn sai và generic download bỏ qua owner

**BA-03/04; bản sửa chưa đạt.** Quản trang xuất CONTRACTS/OCCUPANCY/OPERATIONS nhận 201 và tải 200; Marketing xuất REVENUE nhận 201; Kế toán xuất OCCUPANCY nhận 201. OPERATIONS chưa được giới hạn phạm vi Quản trang. Export doanh thu do Kế toán tạo: Marketing tải qua /reports/exports/{id}/download bị 403, nhưng /documents/{file_id}/download lại 200.

**Vị trí:** reports/service.py:553 dùng bất kỳ permission có resource=finance để cho xuất doanh thu; nhánh CONTRACTS cũng rộng, OCCUPANCY/OPERATIONS không có kiểm tra tương ứng. documents/service.py:139 đặt kiểm owner ở elif, nên REVENUE đi qua nhánh quyền tài chính mà bỏ kiểm owner.

**Thực hiện:** capability riêng cho từng loại báo cáo, chung một query/scope giữa xem/xuất/tải; dùng cùng ACL ở Documents. Seed/migration quyền tăng dần cho DB hiện hữu, không chỉ thay điều kiện router.

**Nghiệm thu:** ma trận actor × loại báo cáo × xem/xuất/tải, cả ID khác người tạo. Marketing không có REVENUE; occupancy/contracts theo quyền Sếp trong policy; Quản trang chỉ operations đúng phạm vi được cấp. UI chỉ hiện tab/action có quyền.

### R04 — P0 — Giấy báo tử không có file vẫn được xác minh và dùng an táng

**BA-08; bản sửa chỉ kiểm khi có file_id.** Tạo deceased với metadata giấy báo tử nhưng không có file_id nhận 201; helper kiểm giấy trả true; tạo BURIAL nhận 201 và kích hoạt bằng bản ký MinIO thật nhận 200.

**Vị trí:** profiles/service.py:266–283, 470–505, 560–574. Nhánh if cert.file_id bỏ qua kiểm file khi giá trị rỗng rồi return True.

**Thực hiện:** cho phép lưu hồ sơ nháp thiếu giấy nhưng không đánh dấu VERIFIED; command xác minh phải kiểm file READY, binding đúng người/giấy, người và thời điểm xác minh. Kiểm lại tại kích hoạt và xác nhận an táng, kể cả ADMIN. Phân biệt đủ metadata với đủ chứng từ.

**Nghiệm thu:** thiếu file, UPLOADING/FAILED, file mất trong storage, file sai parent/purpose đều không vượt gate; hồ sơ nháp vẫn lưu được và UI có CTA bổ sung giấy rồi quay lại tác vụ.

### R05 — P0 — Ký phụ lục vẫn tự coi là đã an táng thực tế

**BA-09/14; còn từ baseline.** Probe đặt burial_date=2026-11-12, chưa có xác nhận Quản trang. Marketing kích hoạt pháp lý làm slot và plot chuyển ngay OCCUPIED.

**Vị trí:** contracts/service.py:748, đặc biệt 834–837. Không thể đóng luồng chỉ bằng việc siết contracts:activate.

**Thực hiện:** tách trạng thái pháp lý ACTIVE khỏi execution; queue bàn giao, command Quản trang xác nhận thực tế, chứng từ/checklist/bằng chứng và transaction cập nhật slot/history/khóa Kim Tĩnh. Áp dụng tương tự cải táng và các dịch vụ cần bàn giao; không suy diễn ngày thực hiện từ ngày ký.

**Nghiệm thu:** ký ngày hôm nay cho lịch tương lai không chiếm slot như đã an táng; chỉ actor/command thực địa hợp lệ mới cập nhật occupancy. Test cạnh tranh, 1 người/2 slot và Kim Tĩnh qua connection riêng. UI hiển thị “Đã ký/Chờ thực hiện/Đã thực hiện” tách biệt.

### R06 — P0 — Thi công vẫn nghiệm thu bằng URL không tồn tại

**BA-16; chặn PUT trực tiếp chưa đủ.** Sau khi PUT COMPLETED bị 400 vì còn TODO, gọi /construction/tasks/{id}/complete cho từng việc với proof_media_url=https://example.invalid/SYNTHETIC-NO-FILE.jpg đều nhận 200. Gọi complete order nhận 200, COMPLETED, **0 bản ghi evidence**. Sau đó thêm evidence vào task của order đã hoàn tất vẫn nhận 201.

**Vị trí:** construction/service.py:596–635 chấp nhận URL fallback; complete_order:438–466 chỉ duyệt những evidence đã có, không buộc phải có bằng chứng hợp lệ. add_task_evidence:647 thiếu chặn parent COMPLETED.

**Thực hiện:** tập trung gate cho task/order ở service, yêu cầu bằng chứng phù hợp theo hạng mục, file READY đúng parent/purpose và có object; bỏ đường tắt URL. Chặn mọi mutation task/checklist/evidence/assignment khi parent đã đóng theo policy.

**Nghiệm thu:** URL giả, 0 evidence, PDF pháp lý dùng thay ảnh, file thiếu và thêm/sửa sau hoàn tất đều bị từ chối. UI upload theo hạng mục, cho xem trạng thái và lý do chưa thể nghiệm thu; desktop/mobile dùng cùng luật.

### R07 — P0 — Ca chăm sóc nhận PDF pháp lý làm ảnh minh chứng

**BA-20; bản sửa CLOSED và URL mới đã có tác dụng nhưng gate vẫn hở.** Dùng file_id của bản ký PDF không thuộc ca để POST evidence nhận 201; close ca nhận 200/CLOSED.

**Vị trí:** care/service.py:266–283 chỉ kiểm FileObject.state. close_schedule:326–331 vẫn có nhánh tính media_url cũ là bằng chứng hợp lệ.

**Thực hiện:** metadata/binding/purpose và loại tệp phải được kiểm ở server; không nhận file pháp lý ngoài ca. Định nghĩa cách xử lý evidence URL cũ chưa xác minh; không tự coi hợp lệ. Giữ nguyên các guard CLOSED đã sửa.

**Nghiệm thu:** PDF bản ký, file của ca khác, URL cũ không kiểm chứng không đủ đóng ca; ảnh hợp lệ READY đúng ca đóng được; lỗi upload có retry mà không nhân đôi minh chứng.

### R08 — P1 — Phân công có xung đột vẫn được lưu, trái KT19

**BA-18; hành vi cũ còn nguyên.** Tạo StaffUnavailability bao phủ ngày ca; PATCH assign trả 200/has_conflict=true nhưng assignee_saved=true, trạng thái SCHEDULED.

**Vị trí:** care/service.py:162–211 commit caretaker_id dù conflict. backend/tests/test_care.py:238–276 đang kiểm tra hành vi cảnh báo này là thành công.

**Thực hiện:** thực hiện yêu cầu KT19: phát hiện xung đột trước mutation, trả lỗi nghiệp vụ rõ ràng, giữ assignment trước đó. Đưa kiểm tra vào transaction phù hợp cho trường hợp hai người cùng phân công. “Cảnh báo nhưng vẫn lưu” trong báo cáo agent không phải quyết định nghiệp vụ đã được người dùng chấp thuận.

**Nghiệm thu:** nghỉ/bận/ca trùng/user khóa và hai request đồng thời; assignment mới không được lưu khi conflict. Selector cho đổi người/ngày, hiển thị lý do tại chỗ; cập nhật test theo yêu cầu này.

### R09 — P1 — Mở UI Quản trang đồng thời mở điều phối cho Marketing

**BA-06/07; phạm vi UI bị mở rộng ngoài ý định.** Marketing thật thấy nút “Sinh Lịch Kỳ Mới” như Quản trang; PATCH assign cũng trả 200. Seed hiện hữu có care:write cho Marketing.

**Vị trí:** CareModule.tsx:352–355 dùng care:write chung; care/router.py generate/assign cũng dùng scope đó. Đăng ký dịch vụ và điều phối hiện trường là hai quyền khác nhau.

**Thực hiện:** tách quyền đăng ký phụ lục/gói khỏi coordinate/execute; migrate seed quyền và dùng capability đã xác định cho UI lẫn API. Không bỏ quyền Marketing đăng ký dịch vụ cần cho pháp lý.

**Nghiệm thu:** Marketing làm đầy đủ đăng ký/ký/bàn giao nhưng không sinh lịch/phân công/đóng ca; Quản trang thao tác đúng phạm vi. Kiểm JWT thật với dữ liệu quyền DB, không chỉ mock role.

### R10 — P0 — Bỏ giá 50 triệu nhưng còn lấy giá của loại mộ khác

**BA-36; bản sửa chưa đạt.** Trong Test chỉ để một bảng giá hiệu lực có GIA-DAT-DON=123.45 (giá synthetic). Tạo mộ đôi có default_slots=2 và gửi hợp đồng không truyền đơn giá: nhận 201, total_amount=123.45.

**Vị trí:** contracts/service.py:146–197, đặc biệt nhánh item_code.like("GIA-DAT%").first(). Các nhánh trước cũng chưa giải quyết đầy đủ khu, service_code và nhiều mức giá trùng phạm vi.

**Thực hiện:** resolver có thứ tự ưu tiên scope rõ ràng, xác định duy nhất giá đất hiệu lực; thiếu/không rõ giá phải dừng, không lấy dòng bất kỳ. Lưu snapshot nguồn giá, dùng Decimal; quyền nhập giá tay phải theo policy.

**Nghiệm thu:** chỉ có giá mộ đơn không tạo tự động giá mộ đôi; sai khu/dịch vụ/hết hạn/trùng scope đều có kết quả đúng được định nghĩa. Wizard hiển thị nguồn giá hoặc CTA cấu hình theo quyền, giữ các bước đã nhập.

### R11 — P0 — Idempotency vẫn bỏ sót payload và để key kẹt

**BA-22; thêm request_hash mới chặn một phần.** Cùng key đổi số tiền bị 409, nhưng đổi transaction_reference A→B vẫn trả 201 với reference A. Gửi payment cho receivable không tồn tại trả 404; retry cùng key trả 409 “đang xử lý song song” vì key vẫn IN_PROGRESS.

**Vị trí:** finance/service.py:421–423 hash bỏ transaction_reference, Decimal chưa chuẩn hóa; 454–469 commit IN_PROGRESS trước validate. FinanceModule.tsx:152 tạo key mới mỗi submit.

**Thực hiện:** command key bắt buộc, bền qua retry; canonical payload bao gồm trường có ý nghĩa nghiệp vụ và chuẩn Decimal. Định nghĩa lỗi có thể retry/kết thúc, lease/reconciliation cho command dở; commit payment/balance/idempotency/audit theo ranh giới transaction đã thiết kế. Không thêm key mới khi chưa biết kết quả key cũ.

**Nghiệm thu:** same key/same payload trả cùng payment; khác reference bị 409; lỗi validate không làm key kẹt vô hạn. Mất response sau commit rồi bấm thử lại chỉ thu một lần. Kiểm hai connection đồng thời trên SQL Server; suite savepoint hiện tại chưa chứng minh được điều này.

### R12 — P1 — API tạo lại biên lai chưa được nối vào hành trình Kế toán

**BA-23/24/35; backend đã cải thiện, UI chưa theo response mới.** Probe lỗi storage trả 201/invoice=null; regenerate rồi download hoạt động. Nhưng FinanceModule không gọi regenerate-invoice, không có receipt status/retry. Nhánh thành công vẫn luôn hiện nút “Tải Về Biên Lai (PDF)” ngay cả invoice=null.

**Vị trí:** FinanceModule.tsx:948–1010 và lịch sử thanh toán; finance/service.py:740–751 trả ngay invoice hiện có, chưa giải quyết trường hợp metadata còn nhưng file đã hỏng/mất. Quan sát nút ở màn hình danh sách không thay thế kiểm toàn bộ modal; kết luận thiếu integration dựa thêm trên mã nguồn.

**Thực hiện:** trả và hiển thị riêng payment status/receipt status; “Đã ghi tiền, biên lai chưa sẵn sàng” và action tạo lại theo payment_id, có loading/error/retry. Chỉ cho tải khi sẵn sàng; retry receipt không gửi lại lệnh thu. Thiết kế đồng thời ở modal thành công và lịch sử.

**Nghiệm thu:** storage lỗi → vẫn thấy giao dịch đã ghi → tạo lại từ web → tải được PDF, số payment không đổi. Hai lần tạo lại đồng thời và file đã mất phải có xử lý nhất quán; modal 390px/viewport thấp không che nút chính.

### R13 — P1 — Public vẫn giữ banner lỗi sau khi tìm lại thành công

**BA-27; hết crash nhưng recovery chưa đúng.** Cho search trả 503, rồi khôi phục API thật và bấm Tìm Kiếm với cùng chuỗi: HTTP 200, 20 kết quả, nhưng banner “SYNTHETIC RECHECK 503” vẫn hiện.

**Vị trí:** ProfileModule.tsx:2090–2110 không clear error ở đường tìm thủ công thành công; đường debounce có logic khác.

**Thực hiện:** dùng chung một hàm query/state machine cho debounce và submit, bỏ kết quả cũ/race đúng cách, xóa lỗi đã hồi phục. Thông báo Error phải có Thử lại, Empty khác Error; không cần đổi toàn bộ trang.

**Nghiệm thu:** 503→retry 200 cùng query phải hết banner; 200→rỗng hiện Empty; gõ nhanh không bị response cũ ghi đè. Xem [ảnh sau phục hồi](evidence/recheck-3cfc146/screens/public-recovered.png).

### R14 — P1 — Sửa Login chưa hoàn thành dialog/menu dùng bàn phím

**BA-33/34; một phần đã tốt hơn.** 390×320: submit login tới được và Escape đóng. Tuy nhiên không có phần tử role=dialog trong login; drawer mobile mở rồi Escape vẫn không đóng. Chưa có bằng chứng đủ cho focus trap/restore focus/inert và các modal còn lại.

**Vị trí:** LoginModal.tsx:54 trở đi; shell/sidebar và các modal theo BA-33. Không chỉ thêm max-height riêng từng modal.

**Thực hiện:** primitive dialog/drawer dùng chung có tên truy cập, focus ban đầu, focus trap, restore focus, Escape, khóa cuộn nền; body cuộn/footer không chồng. Tách toolbar khi hẹp, vùng chạm theo chuẩn dự án 48px; giữ token và ngôn ngữ giao diện hiện có.

**Nghiệm thu:** 1440×900, 768×1024, 390×844, 390×320 và zoom 200%; Tab/Shift+Tab/Escape với menu và modal nghiệp vụ. Không làm body tràn hoặc nhốt focus ngoài vùng đang mở. Các luồng mới ở R01/R05/R12 phải được kiểm cùng đợt.

### R15 — P2 — Bằng chứng và trạng thái “Done” vượt phạm vi đã thực hiện

**BA-37.** Commit đưa plan/bằng chứng baseline vào Git, nhưng không có bộ kết quả nghiệm thu mới theo 39 UC/KT01–KT39. Guard mới hữu ích cho pytest bình thường, không thể “ngăn 100% mọi test hoặc thao tác ngoài ý muốn”: fixture chỉ nằm trong tests/conftest.py và kiểm chuỗi URL rộng, không xác minh DB thực tế của connection.

**Thực hiện:** bảo vệ test trước mọi setup ghi bằng DB_NAME() exact allowlist, không log credential từ URL. Tách suite thường, concurrency, storage lỗi và browser acceptance; mỗi ca gắn commit/revision/actor/viewport/outcome. Thay các tuyên bố tuyệt đối bằng phạm vi đã chứng minh.

**Nghiệm thu:** sai DB phải dừng trước fixture ghi; đủ kết quả actual cho các tiêu chí tương ứng. Không đóng toàn bộ BA chỉ vì đã sửa một điều kiện hoặc 89 test cũ xanh. Các quyết định Cxx chưa chốt trong plan tiếp tục ghi rõ, không tự đổi chính sách.

## 4. Đối chiếu đủ 37 nhóm của plan

“Có sửa/một phần” không phải nghiệm thu trọn nhóm. “Chưa có thay đổi” chỉ ra phạm vi còn trong plan, không khẳng định đã tái chạy mọi ca cũ. Dùng Rxx ở trên cùng chi tiết/KT/Wxx trong PLAN.md để triển khai tiếp.

| BA | Trạng thái sau 3cfc146 | Phần cần theo tiếp |
|---|---|---|
| BA-01 | Một phần; các ca quyền ghi thử đã chặn | Scope/ACL nhất quán, quyền thực tế trong DB, actor matrix đầy đủ |
| BA-02 | Chưa đạt; tái hiện | R01, allowlist WorkBasis/FinanceBasis |
| BA-03 | Chưa đạt; tái hiện | R03 |
| BA-04 | Chưa đạt; tái hiện | R02/R03 |
| BA-05 | Lỗi endpoint nhân sự đã hết | Chưa đóng toàn bộ eligibility/selector Error và retry |
| BA-06 | POST và Quản trang đã mở; scope chưa đạt | R09, đi hết phân công từ UI |
| BA-07 | Chưa có sửa quyền cấu hình đầy đủ | Capability/seed, phân tách cấu hình và tác nghiệp |
| BA-08 | Chưa đạt; tái hiện | R04 |
| BA-09 | Chưa có sửa; tái hiện | R05 |
| BA-10 | Chưa có thay đổi giải quyết đầy đủ | Kiểm lại chủ/giữ chỗ tại activate/execute; chạy KT tương ứng |
| BA-11 | Chưa được chứng minh | Hai connection SQL Server thật, khóa/constraint; không suy từ savepoint |
| BA-12 | Chưa đạt; care tạo ACTIVE trực tiếp | Probe đăng ký care không signed scan trả 201/ACTIVE; còn PL thi công/gia hạn và vòng ký |
| BA-13 | Chưa có thay đổi giải quyết | Template/version/PDF/signed snapshot |
| BA-14 | Chưa có thay đổi giải quyết | Hàng đợi bàn giao, hoàn thành thực địa/hỏa táng, R05 |
| BA-15 | Một phần; CARE làm căn cứ đã bị chặn | Scope/chủ/hiệu lực/Kim Tĩnh, eligible selector và policy số lệnh |
| BA-16 | Chưa đạt; tái hiện đường vòng | R06 |
| BA-17 | Chưa có thay đổi giải quyết | Nhân công ngoài/tổ đội/checklist/tiến độ và UI điều phối |
| BA-18 | Chưa đạt; tái hiện | R08; không đổi thành cảnh báo cho qua |
| BA-19 | Chưa có thay đổi giải quyết | Tần suất, thời hạn, snapshot thỏa thuận và kỳ biên |
| BA-20 | Một phần; CLOSED đã chặn các route thử | Minh chứng còn sai purpose/parent, R07 |
| BA-21 | Chưa có thay đổi giải quyết | Duyệt/công bố kết quả chăm sóc cho thân nhân |
| BA-22 | Một phần; đổi amount đã bị 409 | R11, key/payload/retry/concurrency |
| BA-23 | Một phần; lỗi storage và regenerate API chạy | R12; transaction, durability, receipt status và UI |
| BA-24 | Chưa có thay đổi giải quyết UI/quyền | Nguồn khoản thu, installment, giảm giá theo đúng quyền |
| BA-25 | Chưa có thay đổi giải quyết | Phân trang server/total/search; không đếm trên tập 100 bản ghi cắt |
| BA-26 | Có thay đổi CODE | Đã join ô/hàng; cần kiểm mã, tên trùng, permission và phân trang thực tế |
| BA-27 | Hết crash; chưa đạt recovery | R13 |
| BA-28 | Ca hiển thị/chuyển tab thử đã đạt | Kiểm lại reflow/filter/resize và trạng thái lỗi bản đồ theo plan |
| BA-29 | Có thay đổi CODE | Đã sửa truy vấn phụ thuộc; cần đủ lịch sử/slot/TPT và test xóa bị chặn |
| BA-30 | Có audit backend; UI chưa hoàn tất | Edit flow đủ trường, validation, before/after/actor thực tế |
| BA-31 | Có truyền filter CODE | Đối soát nội dung PDF/XLSX với UI, mọi loại/filter/phạm vi và ngày |
| BA-32 | Chưa có thay đổi giải quyết đầy đủ | Đổi quyền, khóa user, refresh/revoke session, audit xuyên actor |
| BA-33 | Một phần | R14; các modal nghiệp vụ vẫn cần kiểm |
| BA-34 | Chưa có thay đổi giải quyết đầy đủ | Điều hướng, route/back, copy nghiệp vụ và drawer |
| BA-35 | Chưa có giải pháp thống nhất | Upload/download có auth, draft/retry, receipt phục hồi R12 |
| BA-36 | Chưa đạt; tái hiện | R10 |
| BA-37 | Có guard và test xanh; chưa đủ bằng chứng | R15; ghi nhận đúng trạng thái thay vì Done toàn bộ |

## 5. Thứ tự sửa tiếp và bàn giao

1. **Quyền và dữ liệu:** R01–R03, R09; W01/W02 của plan. Chốt capability/DTO và migration quyền trước khi đổi màn hình. Không làm Quản trang mất căn cứ cần dùng khi chặn legal detail.
2. **Chứng từ và trạng thái thực địa:** R04–R08, BA-10/11/12/14/19; W03–W06. Thiết kế transaction, execution và bảng dữ liệu nếu cần bằng Alembic tăng dần. Giữ quy tắc Kim Tĩnh và lịch sử; không tự suy diễn dữ liệu cũ là đã nghiệm thu.
3. **Tài chính và giá:** R10–R12, BA-24/25; W07. Chốt API kết quả payment/receipt trước khi nối modal, retry và lịch sử. Bắt buộc có test lỗi sau commit và concurrency trên Test.
4. **Hoàn thiện web:** R13/R14 và backlog UI, public, file, report còn lại; W08/W09. Giữ palette/font/design tokens. Mỗi màn hình có Loading/Normal/Empty có CTA/Error có Thử lại; responsive kiểm theo viewport đã nêu.
5. **Nghiệm thu có bằng chứng:** R15/W10. Ghi trạng thái từng BA và UC/KT, kết quả pass/fail/deferred cùng lý do. Không gộp các mục chưa kiểm vào “đã hoàn tất”.

Không cần làm lại các ca đã sửa đúng ở mục 2; giữ chúng làm regression tests. Khi bổ sung một gate, phải thử mọi đường ghi có thể vượt gate đó, không chỉ nút chính. Với mỗi thay đổi API ảnh hưởng web, bàn giao đồng thời contract, UI, test và ảnh ở desktop/mobile; kiểm ngược actor không có quyền.

### Prompt có thể giao cho agent thực thi

> Rà soát commit 3cfc146 bằng docs/actor-business-audit/REVIEW-3cfc146.md và tiếp tục PLAN.md gốc. Báo cáo hiện tại chưa cho phép đóng toàn bộ plan. Ưu tiên R01–R12; giữ các sửa đúng ở mục 2. Tạo fixture SYNTHETIC trên QL_NghiaTrang_Test, xác minh DB thực trước khi ghi, tuyệt đối không bootstrap/drop CSDL. Dùng capability và projection server-side, Alembic tăng dần nếu đổi schema/quyền, Decimal cho tiền và bảo toàn Kim Tĩnh. Nối đầy đủ các thay đổi nghiệp vụ vào web/, gồm responsive desktop/tablet/mobile, modal thấp và bốn trạng thái. Viết kiểm thử cho ca lỗi đã tái hiện, retry sau commit và tranh chấp SQL Server thực; không đổi tiêu chí để làm test xanh. Bàn giao ledger 37 BA + 39 UC/KT, commit/revision/actor/viewport, ảnh và kết quả test. Các quyết định Cxx còn mở phải được ghi riêng, không tự bịa chính sách. Cập nhật STATE.md theo kết quả đã chứng minh.

## 6. Trạng thái của lần review này

Chỉ thêm tài liệu/bằng chứng và hiệu chỉnh trạng thái nghiệm thu trong STATE.md. Không sửa mã nguồn ứng dụng, không commit/push. Các probe và bản sao lưu nằm trên ổ D; những ID/sequence Test đã cấp có thể tạo khoảng trống dù transaction rollback, không phải mất dữ liệu nghiệp vụ.
