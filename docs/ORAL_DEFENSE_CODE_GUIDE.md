# Cẩm nang cấu trúc mã nguồn và ôn vấn đáp

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày khảo sát:** 20/10/2026  
**Phạm vi:** Source hiện có trong `backend`, `web`, `mobile`, migrations, scripts, tests, tài liệu và cấu hình của repo. Không tính thư viện cài đặt, file build, cache hoặc dữ liệu runtime.

Tài liệu này ưu tiên code hiện tại trong repo. Tên file và nội dung trong `README`, ADR, kế hoạch, prototype có thể nói về kiến trúc mục tiêu; khi khác source đang chạy, phần **“Đối chiếu thiết kế với hiện trạng”** ở cuối ghi rõ để tránh nhầm trong vấn đáp.

Lượt kiểm kê source/config chính ghi nhận: `backend/app` 57 file, `backend/alembic/versions` 13 migration, `backend/scripts` 14 file, `backend/tests` 19 file, `web/src` 46 file, `mobile/lib` 50 file. Các ảnh bằng chứng, file Word/SQL đầu vào, lockfiles và tài nguyên Android cũng đã được phân loại bên dưới.

## 1. Cách giới thiệu hệ thống trong 1 phút

Đây là monorepo gồm ba ứng dụng: API FastAPI, web React/TypeScript và app Android Flutter. API chia theo phân hệ nghiệp vụ; các router nhận HTTP và kiểm quyền, Pydantic schema định hình dữ liệu, service thực hiện quy tắc nghiệp vụ và truy vấn SQLAlchemy models. SQL Server lưu trạng thái giao dịch, MinIO lưu nội dung file. Web và mobile gọi chung API; quyền và điều kiện chuyển trạng thái phải được kiểm tra ở server. Các luồng tiêu biểu là tạo hợp đồng giữ ô, xác minh giấy báo tử rồi xác nhận an táng tại hiện trường, phân công/đóng việc và ghi nhận thanh toán.

## 2. Sơ đồ kiến trúc thực tế

```mermaid
flowchart LR
    subgraph Clients[Ứng dụng người dùng]
        WEB[Web React 19 / TypeScript<br/>web/src]
        MOB[Android Flutter / Dart<br/>mobile/lib]
    end

    subgraph API[FastAPI modular monolith<br/>backend/app]
        MAIN[main.py<br/>CORS, health, router registry]
        AUTH[auth dependencies<br/>JWT, user, RBAC]
        ROUTER[Router + Pydantic schema]
        SERVICE[Service nghiệp vụ<br/>SQLAlchemy query + commit]
        COMMON[PDF / Excel / MinIO adapter]
        OUTBOX[jobs / outbox]
    end

    DB[(SQL Server<br/>ORM tables, constraints, triggers)]
    S3[(MinIO<br/>file objects, PDFs, evidence)]

    WEB -->|HTTP JSON + Bearer| MAIN
    MOB -->|HTTP JSON + Bearer| MAIN
    MAIN --> ROUTER
    ROUTER --> AUTH
    AUTH --> DB
    ROUTER --> SERVICE
    SERVICE --> DB
    SERVICE --> COMMON
    COMMON --> S3
    SERVICE --> OUTBOX
    OUTBOX --> DB
```

Luồng xử lý một lệnh:

```mermaid
sequenceDiagram
    actor N as Nhân viên
    participant UI as Web / Flutter
    participant R as FastAPI router
    participant A as Auth dependency
    participant S as Service
    participant D as SQL Server
    participant F as MinIO (nếu có file)
    N->>UI: Chọn thao tác và nhập dữ liệu
    UI->>R: HTTP request + access token
    R->>A: Kiểm token, trạng thái tài khoản, quyền
    A->>D: Đọc user/role/quyền cần thiết
    D-->>A: Tài khoản và phạm vi quyền
    A-->>R: Cho phép hoặc dừng với 401/403
    R->>S: Gọi hàm nghiệp vụ với schema đã validate
    S->>D: Đọc, kiểm tra invariant, ghi dữ liệu
    opt Tệp/chứng từ
        S->>F: Đọc hoặc ghi object
        F-->>S: Object key / nội dung
    end
    S->>D: Commit thay đổi, audit hoặc outbox theo luồng
    S-->>R: DTO / lỗi nghiệp vụ
    R-->>UI: JSON / status code
```

### Mỗi lớp chịu trách nhiệm gì?

| Phần | Nằm ở đâu | Vai trò thực tế |
|---|---|---|
| Điểm khởi động API | `backend/app/main.py` | Tạo FastAPI, CORS, đăng ký router, health/readiness/version. |
| Xác thực và quyền | `backend/app/modules/auth/dependencies.py` | Đọc Bearer JWT, xác minh user còn hoạt động và `auth_version`, tạo dependency kiểm permission/role. |
| HTTP và quyền route | `backend/app/modules/*/router.py` | Định nghĩa URL, method, schema đầu vào/đầu ra, status code và `Depends(...)`. |
| Validate/DTO | `backend/app/modules/*/schemas.py` | Pydantic kiểm kiểu/giá trị request và định dạng response. Một số module khai báo response/schema ngay trong router. |
| Nghiệp vụ và truy vấn | `backend/app/modules/*/service.py` | Kiểm trạng thái, quyền tài nguyên khi cần, tính toán, query ORM, audit/outbox và commit. |
| ORM / bảng SQL | `backend/app/modules/*/models.py` | Ánh xạ SQLAlchemy tới các bảng và quan hệ. |
| Tệp | `backend/app/storage/minio_adapter.py`, `modules/documents` | Adapter S3 và nghiệp vụ upload/download/file ACL. |
| Database session | `backend/app/db/session.py` | Engine SQLAlchemy, `SessionLocal`, dependency `get_db()`. |

**Điểm cấu trúc cần nhớ:** source hiện không có `repository.py` riêng. Service truy vấn `db.query(...)` trực tiếp. Vì vậy khi trình bày, nói rõ “router → service → SQLAlchemy model/session”, không mô tả repository như một lớp đã tồn tại.

## 3. Bản đồ thư mục cấp dự án

```text
QL-NghiaTrang/
├── backend/       API Python, ORM, migrations, scripts và test
├── web/           Web nội bộ + cổng công khai React/TypeScript
├── mobile/        Ứng dụng Android Flutter
├── docs/          Kế hoạch, chính sách, kiểm chứng và hướng dẫn
├── reference/     Đặc tả nghiệp vụ, Lab, prototype và kế hoạch đầu vào
├── scripts/       Lệnh hỗ trợ phát triển / kiểm tra toàn repo
├── .agents/       Quy tắc và skill dành cho coding agent
├── AGENTS.md      Quy ước làm việc, kiến trúc và bất biến nghiệp vụ
├── README.md      Mô tả tổng quan do dự án duy trì
└── CHANGELOG.md   Nhật ký các thay đổi theo phiên bản
```

## 4. Danh mục file theo thành phần

Phần dưới giải thích file source/config quan trọng. Với các module backend tuân theo mẫu, từng file vẫn được ghi riêng để tiện tra cứu khi mở code.

### 4.1 Backend — điểm khởi động và cấu hình chung

| File | Giải thích |
|---|---|
| `backend/app/main.py` | Tạo ứng dụng FastAPI; cấu hình CORS; đăng ký 12 router; health sống (`live`), readiness kiểm SQL Server + MinIO, thông tin version và root endpoint. Đây là nơi lần đầu kiểm tra API được ghép ra sao. |
| `backend/app/core/config.py` | Đọc cấu hình môi trường qua `pydantic-settings`, gồm tên ứng dụng, API prefix, JWT, kết nối database, CORS, MinIO. Không ghi giá trị bí mật thật vào tài liệu; dùng `.env.example` làm mẫu. |
| `backend/app/core/security.py` | Hàm băm/kiểm mật khẩu Argon2, tạo/giải mã JWT, sinh refresh token ngẫu nhiên và băm refresh token trước khi lưu. |
| `backend/app/db/session.py` | Khởi tạo SQLAlchemy engine/session; `get_db()` cấp session cho request rồi đóng; `check_database_readiness()` chạy `SELECT 1`. |
| `backend/app/db/base.py` | Import tất cả ORM model để `Base.metadata` được đăng ký đầy đủ; Alembic dùng metadata này. Không chứa nghiệp vụ. |
| `backend/app/services/pdf_service.py` | Tạo PDF nghiệp vụ như hợp đồng/biên lai bằng ReportLab. |
| `backend/app/services/excel_service.py` | Tạo file Excel báo cáo bằng openpyxl. |
| `backend/app/storage/minio_adapter.py` | Kết nối MinIO theo S3 API, kiểm tra readiness và thao tác object; module documents gọi adapter thay vì giao diện truy cập bucket trực tiếp. |

### 4.2 Backend — các phân hệ nghiệp vụ

| Phân hệ | File | Trách nhiệm |
|---|---|---|
| **audit** | `backend/app/modules/audit/models.py` | ORM nhật ký thay đổi. |
|  | `backend/app/modules/audit/router.py` | Route đọc nhật ký, tổng hợp, lọc entity/action; giới hạn quyền quản trị ở route/dependency. |
|  | `backend/app/modules/audit/schemas.py` | DTO bản ghi và số liệu tổng hợp kiểm toán. |
|  | `backend/app/modules/audit/service.py` | Truy vấn nhật ký, tổng hợp; `redact_sensitive_json()` loại thông tin nhạy cảm khỏi nội dung log trả về. |
| **auth** | `backend/app/modules/auth/models.py` | ORM `User`, `Role`, `Permission`, `AuthSession` và các liên kết. |
|  | `backend/app/modules/auth/router.py` | Login, refresh/logout, `/me`, đổi mật khẩu/thu hồi phiên, quản lý user/role và staff lookup. |
|  | `backend/app/modules/auth/schemas.py` | Request/response đăng nhập, token, user, role, tạo/cập nhật tài khoản, hồ sơ nhân sự rút gọn. |
|  | `backend/app/modules/auth/service.py` | Xác minh mật khẩu, tổng hợp quyền, quản lý vòng đời refresh session và CRUD user. |
|  | `backend/app/modules/auth/dependencies.py` | `get_current_user`, `require_permission`, `require_role`; là cổng bảo vệ route nội bộ. |
| **care** | `backend/app/modules/care/models.py` | ORM gói chăm sóc, lịch/ca, checklist, ảnh minh chứng. |
|  | `backend/app/modules/care/router.py` | API lịch, sinh kỳ, phân công, checklist, evidence, đóng ca và phụ lục chăm sóc. |
|  | `backend/app/modules/care/schemas.py` | DTO lịch, checklist, gán người, minh chứng, yêu cầu đóng ca/generate. |
|  | `backend/app/modules/care/service.py` | Tính lịch neo ngày cuối tháng, tạo lịch idempotent, kiểm xung đột, thao tác checklist/evidence, gate đóng ca. |
| **catalog** | `backend/app/modules/catalog/models.py` | ORM bảng giá, khoản mục giá và quan hệ. |
|  | `backend/app/modules/catalog/router.py` | API xem/lookup và quản trị bảng giá, gói chăm sóc, mẫu hợp đồng. GET dùng quyền đọc; thay đổi cấu hình yêu cầu quyền quản lý. |
|  | `backend/app/modules/catalog/schemas.py` | DTO/request cho giá, hiệu lực, gói chăm sóc, checklist gói và mẫu hợp đồng. |
|  | `backend/app/modules/catalog/service.py` | Kiểm khoảng hiệu lực chồng lấn, tra giá phù hợp, quản lý gói và version mẫu hợp đồng. |
| **construction** | `backend/app/modules/construction/models.py` | ORM lệnh thi công, checklist task, tệp evidence, lịch nghỉ/vắng nhân viên. |
|  | `backend/app/modules/construction/router.py` | API lệnh, task, hoàn tất, evidence, lịch bận và kiểm xung đột. |
|  | `backend/app/modules/construction/schemas.py` | DTO/request cho lệnh, checklist, evidence, phân công, lịch bận và conflict. |
|  | `backend/app/modules/construction/service.py` | Tạo lệnh từ phụ lục đã hiệu lực, chọn checklist, kiểm nhân sự/lịch, cập nhật tiến độ, nghiệm thu. |
| **contracts** | `backend/app/modules/contracts/models.py` | ORM hợp đồng nhiều loại, phụ lục và chi tiết riêng như mua đất/an táng/chăm sóc/thi công/cải táng/chuyển nhượng/hỏa táng. |
|  | `backend/app/modules/contracts/router.py` | API lập/xem/đổi trạng thái hợp đồng, PDF, phụ lục, căn cứ bàn giao và xác nhận an táng. |
|  | `backend/app/modules/contracts/schemas.py` | Request/DTO cho các loại hợp đồng/phụ lục, danh sách/chi tiết, WorkBasis và lệnh xác nhận an táng. |
|  | `backend/app/modules/contracts/service.py` | Quy tắc giữ ô, snapshot giá, trạng thái ký/kích hoạt, kiểm giấy báo tử, phụ lục, command an táng và DTO. |
| **documents** | `backend/app/modules/documents/models.py` | ORM `FileObject` và phiên bản/liên kết tài liệu. |
|  | `backend/app/modules/documents/router.py` | Upload, download, preview, media công khai, liên kết tài liệu và PDF hợp đồng mẫu. |
|  | `backend/app/modules/documents/schemas.py` | DTO file, version và yêu cầu liên kết vào hồ sơ. |
|  | `backend/app/modules/documents/service.py` | Kiểm loại file/magic bytes/dung lượng, SHA-256, MinIO, liên kết và kiểm quyền tải xuống. |
| **finance** | `backend/app/modules/finance/models.py` | ORM khoản phải thu, chiết khấu, thanh toán, biên lai/hóa đơn, khóa idempotency. Tiền dùng kiểu Decimal/NUMERIC thay vì float. |
|  | `backend/app/modules/finance/router.py` | Summary, khoản thu, FinanceBasis, thu tiền, chiết khấu, receipt/download. Permission gắn tại endpoint. |
|  | `backend/app/modules/finance/schemas.py` | Request/DTO khoản thu, chiết khấu, payment, invoice, FinanceBasis; validate nguồn công nợ dạng XOR. |
|  | `backend/app/modules/finance/service.py` | Tạo khoản thu, áp chiết khấu, ghi payment idempotent, tổng hợp công nợ, biên lai và FinanceBasis. |
|  | `backend/app/modules/finance/currency_words.py` | Chuyển số tiền thành chữ tiếng Việt để in trên biên lai. |
| **jobs** | `backend/app/modules/jobs/models.py` | ORM background job và outbox event. |
|  | `backend/app/modules/jobs/router.py` | API enqueue, xem trạng thái và xử lý job; một số request/response đặt ngay trong router thay vì file schema riêng. |
|  | `backend/app/modules/jobs/service.py` | Enqueue, claim, complete/fail tác vụ và ghi/đọc/đánh dấu sự kiện outbox. |
| **plots** | `backend/app/modules/plots/models.py` | ORM khu, hàng, loại mộ, ô, huyệt, giữ chỗ, lịch sử chủ sở hữu và an táng. |
|  | `backend/app/modules/plots/router.py` | API đọc/bảo trì khu/hàng/loại/ô, giữ chỗ, thống kê và timeline công khai. |
|  | `backend/app/modules/plots/schemas.py` | Request/DTO cho quy hoạch, ô/huyệt, reservation, thống kê và timeline. |
|  | `backend/app/modules/plots/service.py` | Tra cứu, lọc/ẩn bớt dữ liệu theo actor, CRUD, invariant Kim Tĩnh, giữ/hủy chỗ và timeline. |
| **profiles** | `backend/app/modules/profiles/models.py` | ORM thân nhân/khách hàng, hồ sơ người mất, giấy báo tử và quan hệ giữa họ. |
|  | `backend/app/modules/profiles/router.py` | API hồ sơ nội bộ, quan hệ, giấy báo tử/verify và tra cứu tưởng niệm công khai. |
|  | `backend/app/modules/profiles/schemas.py` | DTO/request với kiểm tra ngày sinh, ngày cấp giấy, giới tính, độ chính xác năm sinh và bản công khai. |
|  | `backend/app/modules/profiles/service.py` | CRUD hồ sơ, liên kết thân nhân, kiểm giấy báo tử, tìm kiếm công khai theo DTO tối thiểu. |
| **reports** | `backend/app/modules/reports/models.py` | ORM lịch sử export báo cáo. |
|  | `backend/app/modules/reports/router.py` | Route báo cáo doanh thu, lấp đầy, hợp đồng, vận hành và export/download. |
|  | `backend/app/modules/reports/schemas.py` | DTO các báo cáo và yêu cầu/theo dõi file export. |
|  | `backend/app/modules/reports/service.py` | Truy vấn số liệu, kiểm capability, dựng PDF/XLSX/export và quản lý file kết quả. |

### 4.3 Migrations, cấu hình, scripts và test backend

| Nhóm | File | Vai trò |
|---|---|---|
| Alembic | `backend/alembic.ini` | Cấu hình CLI logging và đường dẫn migration. |
|  | `backend/alembic/env.py` | Nạp `Base.metadata`, kết nối settings và chạy migration offline/online. |
|  | `backend/alembic/script.py.mako` | Template sinh migration mới. |
|  | `backend/alembic/README` | Ghi chú Alembic mặc định. |
| Migration | `0001_baseline_37_tables.py` | Đánh dấu baseline DB 37 bảng đã tồn tại; `upgrade()` rỗng, không dựng lại DB. |
|  | `0002_g01_auth_sessions_and_version.py` | Bổ sung phiên đăng nhập và version thu hồi quyền. |
|  | `0003_g02_g17_files_documents_jobs_outbox.py` | Cấu trúc file, phiên bản tài liệu, job và outbox nền. |
|  | `0004_g03_catalog_pricing_templates.py` | Danh mục, bảng giá và mẫu hợp đồng. |
|  | `0005_g04_g05_g06_plots_reservations.py` | Quy hoạch, reservation và lịch sử sở hữu ô mộ. |
|  | `0006_g07_g08_profiles_certificates.py` | Hồ sơ và giấy báo tử. |
|  | `0007_g09_contracts_workflow.py` | Luồng hợp đồng, số hợp đồng và nghiệp vụ kích hoạt. |
|  | `0008_g10_g18_g20_lifecycle_annexes.py` | Phụ lục an táng, cải táng, chuyển nhượng, hỏa táng. |
|  | `0009_g11_g13_construction_evidence_scheduling.py` | Thi công, checklist/evidence và khả dụng nhân viên. |
|  | `0010_g12_care_schedules_period_evidence.py` | Lịch chăm sóc theo kỳ và bằng chứng. |
|  | `0011_g14_g15_g16_finance_receivables.py` | Khoản phải thu, payment/idempotency và chiết khấu. |
|  | `0012_g17_report_exports.py` | Theo dõi xuất báo cáo. |
|  | `0013_fix_kim_tinh_plot_types_and_unoccupied_flags.py` | Migration chỉnh dữ liệu/loại mộ và cờ khóa cho trạng thái chưa an táng. |
| Cấu hình | `backend/.env.example` | Tên các biến cấu hình mẫu; không phải file chứa credentials triển khai. |
|  | `backend/pyproject.toml` | Khai báo Python >=3.12, dependencies, Ruff và pytest. |
|  | `backend/uv.lock` | Khóa phiên bản dependency Python để cài nhất quán. |
|  | `backend/compose.yaml` | Định nghĩa MinIO container, port localhost và bind mount `backend/runtime/minio/data`. |
| Scripts | `backend/scripts/introspect_db.py` | Đọc metadata/schema DB để so sánh hiện trạng. |
|  | `backend/scripts/seed_demo_workspace.py` | Seed nhân sự/ô demo; mặc định dry-run, cần `--apply` để ghi. Kiểm DB và backup theo hướng dẫn trong script. |
|  | `backend/scripts/seed_rbac.py` | Khởi tạo/sửa role và permission demo. |
|  | `backend/scripts/seed_catalog.py` | Dữ liệu danh mục/bảng giá. |
|  | `backend/scripts/seed_plots.py` | Tạo dữ liệu khu/hàng/ô demo. |
|  | `backend/scripts/seed_profiles.py` | Tạo hồ sơ demo. |
|  | `backend/scripts/seed_rich_demo_data.py` | Seed dữ liệu demo liên kết phong phú; cần đọc kỹ trước khi dùng với DB thật. |
|  | `backend/scripts/check_schedule_146.py` | Script kiểm tra lịch/fixture được chọn. |
|  | `backend/scripts/fix_missing_slots.py` | Công cụ sửa slot thiếu; là script có thể ghi DB. |
|  | `backend/scripts/scan_corrupted_unicode.py` | Chẩn đoán chuỗi Unicode lỗi. |
|  | `backend/scripts/repair_unicode.py` | Sửa chuỗi Unicode theo logic trong script; tác động dữ liệu nếu chạy. |
|  | `backend/scripts/repair_corrupted_unicode.py` | Script sửa dữ liệu Unicode lỗi. |
|  | `backend/scripts/repair_all_unicode.py` | Biến thể sửa Unicode trên phạm vi rộng. |
|  | `backend/scripts/deep_clean_unicode.py` | Làm sạch Unicode chuyên sâu; cần hiểu phạm vi trước khi chạy. |
| Tests | `backend/tests/conftest.py` | Cưỡng chế `DB_NAME=QL_NghiaTrang_Test` và xác minh database vật lý trước test. |
|  | `test_auth.py` | Login, refresh, logout, user/permission. |
|  | `test_catalog.py` | Bảng giá, gói và template. |
|  | `test_plots.py` | CRUD/lọc ô, giữ chỗ và bất biến Kim Tĩnh. |
|  | `test_profiles.py` | Khách hàng, người mất, giấy báo tử, quan hệ. |
|  | `test_contracts.py` | Hợp đồng và các nhánh phụ lục. |
|  | `test_lifecycle.py` | Vòng đời mua/an táng/cải táng/chuyển nhượng và bất biến. |
|  | `test_construction.py` | Lệnh thi công, checklist, evidence và nhân sự. |
|  | `test_care.py` | Lịch, checklist, evidence và đóng ca. |
|  | `test_finance.py` | Khoản thu, discount, payment, idempotency và biên lai. |
|  | `test_documents.py` | Upload, link file và kiểm quyền tài liệu. |
|  | `test_storage.py` | Tích hợp adapter/object storage. |
|  | `test_reports_audit.py` | Báo cáo/export và audit. |
|  | `test_jobs.py` | Queue/job/outbox. |
|  | `test_health.py` | Health/readiness API. |
|  | `test_trigger_mapping.py` | Tương thích mapping ORM với trigger SQL Server. |
|  | `test_rbac_strict_matrix.py` | Kiểm ma trận quyền actor. |
|  | `test_workspace_fixes.py` | Regression cho các sửa đổi phân quyền, lookup, seed và nghiệp vụ mới đây. |
|  | `test_business_lifecycle_e2e.py` | Kịch bản xuyên nhiều phân hệ từ hồ sơ đến giao dịch. |

> `backend/` còn `README.md` mô tả cách chạy API, và `alembic/versions/` là source thay đổi schema. Không chạy bootstrap SQL trong docs/source; database đang có cần migration tăng dần.

### 4.4 Web React — điểm vào, auth, giao diện và kiểu dữ liệu

| File | Giải thích |
|---|---|
| `web/src/main.tsx` | Mount React root trong `StrictMode`. |
| `web/src/App.tsx` | App root, gắn ErrorBoundary/AuthProvider/NotificationModalProvider; shell chính, sidebar/mobile drawer, role/capability navigation và mount module theo actor. |
| `web/src/App.css` | CSS còn lại từ scaffold; không thấy được import trong source hiện hành. |
| `web/src/index.css` | Style/toàn cục, layout responsive và các component/module CSS. |
| `web/src/context/authContextDef.ts` | Khai báo kiểu/context xác thực dùng chung. |
| `web/src/context/AuthContext.tsx` | Khôi phục session, login/logout, user/access token và kiểm tra quyền ở client. |
| `web/src/context/useAuth.ts` | Hook consumer để component lấy auth context. |
| `web/src/context/NotificationModalContext.tsx` | Context/modal thông báo và xác nhận dùng xuyên module. |
| `web/src/services/authApi.ts` | Hàm gọi login/me/refresh/logout và endpoint tài khoản. |
| `web/src/services/apiClient.ts` | `apiFetch`: gắn access token, gom refresh đồng thời, retry một lần khi 401; 403 không được thử lại. |
| `web/src/components/common/ErrorBoundary.tsx` | Chặn lỗi render lan ra toàn ứng dụng và hiển thị trạng thái lỗi. |
| `web/src/components/common/Pagination.tsx` | Điều khiển phân trang tái sử dụng. |
| `web/src/components/common/MediaEvidenceGallery.tsx` | Hiển thị ảnh/tệp minh chứng. |
| `web/src/components/auth/LoginModal.tsx` | Biểu mẫu đăng nhập. |
| `web/src/components/admin/UserManagementModule.tsx` | UI quản trị tài khoản/vai trò. |
| `web/src/components/audit/AuditModule.tsx` | UI xem nhật ký hoạt động. |
| `web/src/components/catalog/CatalogModule.tsx` | UI danh mục và cấu hình/tra cứu bảng giá, gói, mẫu theo capability. |
| `web/src/components/plots/PlotMapModule.tsx` | Điều phối dữ liệu, bộ lọc, tab GIS/ma trận, chi tiết và thao tác khu/hàng/ô. |
| `web/src/components/plots/GeographicPlotMap.tsx` | Leaflet hiển thị tọa độ lat/long, trạng thái ô, marker trùng tọa độ và chọn ô. |
| `web/src/components/plots/plotCoordinates.ts` | Chuyển/kiểm tra tọa độ từ DTO plot để dùng ở map. |
| `web/src/components/plots/PlotDirectionsButton.tsx` | Shortcut vị trí từ công việc; nạp plot và mở map tập trung vào ô cần tìm. |
| `web/src/components/plots/SimulatedPlotMap.tsx` | Ma trận SVG minh họa hàng/ô; đây là hình sơ đồ nội bộ, không phải nền bản đồ lat/long. |
| `web/src/components/profiles/ProfileModule.tsx` | UI hồ sơ thân nhân/người mất/quan hệ/giấy tờ. |
| `web/src/components/contracts/ContractModule.tsx` | Wizard và danh sách hợp đồng/phụ lục, ký, upload, activate, PDF. |
| `web/src/components/contracts/WorkBasisView.tsx` | Danh sách căn cứ công việc bàn giao cho Quản trang, xác nhận an táng và file minh chứng. |
| `web/src/components/construction/ConstructionModule.tsx` | Điều phối lệnh thi công, người giám sát, task/evidence và nghiệm thu. |
| `web/src/components/care/CareModule.tsx` | Điều phối lịch chăm sóc, phân công, checklist, ảnh và đóng ca. |
| `web/src/components/finance/FinanceModule.tsx` | Shell công nợ/thu tiền, tab dữ liệu và điều hướng. |
| `web/src/components/finance/FinanceBasisView.tsx` | Căn cứ khoản thu được phép xem cho Kế toán, kết nối sang sổ công nợ. |
| `web/src/components/reports/ReportsModule.tsx` | UI báo cáo theo quyền và yêu cầu tải export. |
| `web/src/components/documents/DocumentManager.tsx` | Upload, danh sách/preview/tải file và gắn file vào hồ sơ. |
| `web/src/components/documents/DocumentAttachmentList.tsx` | Danh sách attachment gọn trong hồ sơ. |
| `web/src/types/auth.ts` | Kiểu User, Role, Permission và token/auth DTO. |
| `web/src/types/audit.ts` | Kiểu audit DTO. |
| `web/src/types/care.ts` | Kiểu lịch/checklist/evidence chăm sóc. |
| `web/src/types/catalog.ts` | Kiểu bảng giá/gói/template. |
| `web/src/types/construction.ts` | Kiểu lệnh/task/evidence thi công. |
| `web/src/types/contracts.ts` | Kiểu hợp đồng/phụ lục/WorkBasis. |
| `web/src/types/document.ts` | Kiểu file và attachment. |
| `web/src/types/finance.ts` | Kiểu khoản thu/payment/invoice/report basis. |
| `web/src/types/plots.ts` | Kiểu khu/hàng/ô/slot/tọa độ/map DTO. |
| `web/src/types/profiles.ts` | Kiểu khách hàng/người mất/giấy báo tử. |
| `web/src/types/reports.ts` | Kiểu payload báo cáo và export. |
| `web/src/assets/hero.png` | Asset trong source; không thấy reference/import hiện hành. |
| `web/src/assets/react.svg`, `web/src/assets/vite.svg` | Asset khởi đầu từ Vite/template; không thấy reference/import hiện hành. |

Các file cấu hình web: `web/package.json` khai báo script và dependencies; `web/pnpm-lock.yaml` khóa phiên bản; `web/index.html` host React root; `web/vite.config.ts` dev server/proxy/allowed host; `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.node.json` thiết lập TypeScript; `web/public/favicon.svg`, `web/public/icons.svg` icon tĩnh. `web/README.md` có hướng dẫn chạy web.

### 4.5 Mobile Flutter — điểm vào, state, DTO và màn hình

| Nhóm / file | Giải thích |
|---|---|
| `mobile/lib/main.dart` | Tạo `ProviderScope`, `MaterialApp`, theme, dashboard và export các thành phần chính cho test/consumer. |
| `mobile/lib/core/config.dart` | Đọc `API_BASE_URL` cấu hình build/run. |
| `mobile/lib/core/theme.dart` | Theme Material dùng chung. |
| `mobile/lib/core/widgets/custom_filter_chip.dart` | Chip lọc tái sử dụng. |
| `mobile/lib/core/widgets/detail_row.dart` | Dòng nhãn/giá trị chi tiết. |
| `mobile/lib/core/widgets/kpi_card.dart` | Thẻ số liệu. |
| `mobile/lib/core/widgets/unauthenticated_card.dart` | Trạng thái cần đăng nhập/chưa xác thực. |
| `mobile/lib/providers/api_provider.dart` | Cung cấp Dio có base URL và timeout. |
| `mobile/lib/providers/auth_provider.dart` | Riverpod `AuthNotifier`: đăng nhập, nạp `/auth/me`, giữ session state và logout. |
| `mobile/lib/providers/system_provider.dart` | State/dữ liệu tổng quan hệ thống. |
| `mobile/lib/providers/catalog_provider.dart` | Nạp danh mục/gói/bảng giá. |
| `mobile/lib/providers/plots_provider.dart` | Nạp sơ đồ/ô và thao tác liên quan. |
| `mobile/lib/providers/profiles_provider.dart` | Gọi hồ sơ khách hàng/người mất. |
| `mobile/lib/providers/contracts_provider.dart` | Gọi danh sách/chi tiết hợp đồng. |
| `mobile/lib/providers/construction_provider.dart` | Gọi lệnh thi công và cập nhật công việc. |
| `mobile/lib/providers/care_provider.dart` | Gọi lịch và checklist chăm sóc. |
| `mobile/lib/providers/finance_provider.dart` | Gọi công nợ/thu tiền theo màn hình mobile. |
| `mobile/lib/models/auth_model.dart` | DTO user, role và auth state. |
| `mobile/lib/models/system_model.dart` | DTO thống kê/tổng quan. |
| `mobile/lib/models/catalog_model.dart` | DTO danh mục. |
| `mobile/lib/models/plot_model.dart` | DTO khu/hàng/ô/huyệt. |
| `mobile/lib/models/profile_model.dart` | DTO khách/người mất. |
| `mobile/lib/models/contract_model.dart` | DTO hợp đồng. |
| `mobile/lib/models/construction_model.dart` | DTO công việc thi công. |
| `mobile/lib/models/care_model.dart` | DTO lịch/chăm sóc. |
| `mobile/lib/models/finance_model.dart` | DTO công nợ và khoản thu. |
| `mobile/lib/screens/dashboard_screen.dart` | Điều hướng chính, trạng thái đăng nhập và các tab. |
| `mobile/lib/screens/dialogs/login_dialog.dart` | UI đăng nhập. |
| `mobile/lib/screens/home/home_tab.dart` | Trang tổng quan. |
| `mobile/lib/screens/catalog/catalog_tab.dart` | Tab danh mục. |
| `mobile/lib/screens/catalog/price_lists_view.dart` | Danh sách bảng giá. |
| `mobile/lib/screens/catalog/care_packages_view.dart` | Danh sách gói chăm sóc. |
| `mobile/lib/screens/plots/plots_tab.dart` | Danh sách/sơ đồ ô mộ trên app. |
| `mobile/lib/screens/plots/plot_detail_sheet.dart` | Chi tiết một ô mộ dạng bottom sheet. |
| `mobile/lib/screens/profiles/profiles_tab.dart` | Tab hồ sơ. |
| `mobile/lib/screens/profiles/customers_view.dart` | UI khách hàng/thân nhân. |
| `mobile/lib/screens/profiles/deceased_profiles_view.dart` | UI người mất. |
| `mobile/lib/screens/profiles/public_memorial_view.dart` | Tra cứu tưởng niệm công khai. |
| `mobile/lib/screens/contracts/contracts_tab.dart` | Danh sách hợp đồng. |
| `mobile/lib/screens/contracts/contract_card.dart` | Thẻ hợp đồng. |
| `mobile/lib/screens/contracts/contract_detail_sheet.dart` | Chi tiết hợp đồng dạng sheet. |
| `mobile/lib/screens/construction/construction_tab.dart` | Tab lệnh thi công. |
| `mobile/lib/screens/construction/construction_order_card.dart` | Thẻ lệnh thi công. |
| `mobile/lib/screens/construction/construction_detail_sheet.dart` | Chi tiết lệnh/task. |
| `mobile/lib/screens/care/care_tab.dart` | Tab lịch chăm sóc. |
| `mobile/lib/screens/care/care_schedule_card.dart` | Thẻ ca chăm sóc. |
| `mobile/lib/screens/care/care_schedule_sheet.dart` | Chi tiết ca và checklist thao tác. |
| `mobile/lib/screens/finance/finance_tab.dart` | Tab công nợ. |
| `mobile/lib/screens/finance/receivable_card.dart` | Thẻ khoản phải thu. |
| `mobile/lib/screens/finance/receivable_detail_sheet.dart` | Chi tiết khoản thu. |

Cấu hình Flutter: `mobile/pubspec.yaml` khai báo Flutter, Dio, Riverpod, go_router và lint; `mobile/pubspec.lock` khóa gói; `mobile/analysis_options.yaml` bật lint; `mobile/test/widget_test.dart` là widget test. `mobile/README.md` hướng dẫn app. Android native nằm trong `mobile/android`: Gradle project/build, manifest debug/main/profile, `MainActivity.kt`, launcher icons và splash/theme resources.

Các file Android cụ thể: `mobile/android/settings.gradle.kts` chọn module/plugin; `mobile/android/build.gradle.kts` cấu hình build cấp project; `mobile/android/gradle.properties` tham số Gradle; `mobile/android/gradle/wrapper/gradle-wrapper.properties` phiên bản Gradle wrapper; `mobile/android/app/build.gradle.kts` cấu hình app/signing/build; `mobile/android/app/src/main/kotlin/com/cemetery/qlnghiatrang/mobile/MainActivity.kt` entry point Android; `mobile/android/app/src/{main,debug,profile}/AndroidManifest.xml` metadata/quyền theo build mode; `mobile/android/app/src/main/res/drawable*/launch_background.xml` splash; `mobile/android/app/src/main/res/values*/styles.xml` style hệ thống; `mobile/android/app/src/main/res/mipmap-*/ic_launcher.png` icon theo mật độ màn hình.

### 4.6 Tài liệu và tài nguyên thiết kế trong repo

| Đường dẫn | Nội dung để dùng khi ôn vấn đáp |
|---|---|
| `AGENTS.md` | Nguyên tắc code: DB an toàn/migration, Kim Tĩnh, server-side RBAC, dữ liệu giả, Decimal, MinIO trên D và trạng thái UI. |
| `docs/decisions/0001-system-architecture-and-runtime.md` | Lý do chọn monorepo, SQL Server, MinIO, client và quy tắc vận hành; đọc cùng phần đối chiếu hiện trạng ở cuối tài liệu này. |
| `docs/EXECUTION_PLAN.md`, `docs/execution/STATE.md` | Kế hoạch và trạng thái milestone; STATE là ghi chú tiến độ, không thay code source. |
| `docs/db-baseline.json`, `docs/db-gap-register.md` | Baseline schema DB đã khảo sát và khoảng cách so với thiết kế. |
| `docs/source-inventory.md` | Nguồn Lab1–Lab4/SQL, hash và thứ tự ưu tiên tài liệu khi có xung đột. |
| `docs/BUSINESS_TEST_SCENARIOS.md` | Kịch bản nghiệp vụ xuyên phân hệ. |
| `docs/ui-alignment/actor-policy.md` | Ma trận quyền actor và allowlist dữ liệu giữa phân hệ. |
| `docs/ui-alignment/route-inventory.md`, `api-ui-contracts.md`, `acceptance.md`, `baseline.md`, `decisions.md`, `traceability.csv` | Rà soát route/UI, hợp đồng API, chuẩn chấp nhận, baseline và truy vết actor/UC. |
| `docs/ui-alignment/02_PLAN_ANTIGRAVITY_CAI_THIEN_GIAO_DIEN.md`, `docs/WEB_RESPONSIVE_UX_PLAN.md` | Các kế hoạch UI/responsive; kế hoạch không đồng nghĩa toàn bộ đã triển khai. |
| `docs/actor-business-audit/PLAN.md`, `PLAN-RBAC-MAP-7467905.md`, `REVIEW-3cfc146.md`, `FIXES-20261018.md` | Kế hoạch audit, phát hiện review, sửa đổi phân quyền/bản đồ gần nhất. |
| `docs/actor-business-audit/AUTHORIZATION-MATRIX-7467905.csv` và `docs/actor-business-audit/evidence/` | Bằng chứng kiểm chứng: probe/API/UI/ảnh; dùng để truy nguồn phát hiện, không phải source runtime. |
| `docs/execution/evidence/` | Ảnh và kết quả JSON các lượt kiểm trình duyệt/số liệu. |
| `docs/source/` và `reference/` | Lab1–Lab4, SQL và tài liệu nghiệp vụ đầu vào. Đặc tả `.md` trong `reference/` giúp hiểu yêu cầu; `lab4-sql.sql` là DDL lịch sử nguy hiểm, không chạy. |
| `reference/*prototype*.html`, `reference/Giao_dien_*.html` | Prototype/mockup giao diện, không phải code đang render. |
| `scripts/dev.ps1` | Hướng dẫn khởi động MinIO, backend, web, mobile. |
| `scripts/doctor.ps1` | Chẩn đoán công cụ, DB, MinIO và đề xuất quality gate. |
| `scripts/quality-gate.ps1` | Ghép Ruff/Pytest, lint/build web, analyze/test Flutter. Chạy chỉ khi chủ động muốn thực hiện đủ kiểm tra môi trường. |
| `.agents/rules/project.md`, `.agents/skills/*/SKILL.md` | Quy tắc/skill phục vụ coding agent, không nằm trong runtime ứng dụng. |

Tệp nguồn/đầu vào trong `reference/` được chia như sau: `DAC_TA_NGHIEP_VU_HE_THONG_QUAN_LY_NGHIA_TRANG.md` là đặc tả nghiệp vụ hệ thống; `lab1.docx` bài toán/actor; `Lab2-TruongXuanHuy-2324802010044.docx` use case và quy tắc chi tiết; `Lab3-TruongXuanHuy-2324802010044.docx` sơ đồ tuần tự/lớp; `lab4-TruongXuanHuy-2324802010044.docx` ERD/từ điển dữ liệu; `lab4-sql.sql` DDL SQL Server; `02_PLAN_ANTIGRAVITY_CAI_THIEN_GIAO_DIEN.md`, `EXECUTION_PLAN_QL_NGHIA_TRANG_ANTIGRAVITY.md` và `REMEDIATION_PLAN_CEMETERY_MANAGEMENT_SYSTEM.md` là kế hoạch thực thi; `plan01.docx` là bản kế hoạch Word; `cemetery_ui_prototype.html`, `Giao_dien_Quan_ly_Nghia_trang.html`, `Giao_dien_Quan_ly_Nghia_trang (1).html` là prototype giao diện. Bản Lab được sao lưu trong `docs/source/`; xem `docs/source-inventory.md` khi cần biết độ ưu tiên và hash của nguồn.

## 5. Ba luồng backend nên trình bày được

### 5.1 Đăng nhập và kiểm quyền

Ví dụ đăng nhập qua `POST /api/v1/auth/login`:

1. `auth/router.py::login` nhận `LoginRequest` đã được Pydantic validate, gọi `AuthService.authenticate_user()` rồi `create_session()`.
2. `authenticate_user()` tìm username trong SQL Server, kiểm mật khẩu Argon2 và chặn user inactive.
3. `create_session()` sinh refresh token ngẫu nhiên, lưu **hash** trong `auth_sessions`, gom role/permission, tạo access JWT ngắn hạn.
4. Client nhận access + refresh token. Web gọi qua `apiFetch`; khi có 401 thì chỉ gom một refresh request đồng thời và retry request một lần. 403 không được refresh.
5. Ở mọi route được bảo vệ, `get_current_user()` decode JWT, đọc lại User từ DB, kiểm active và so sánh `auth_version`. Đổi quyền/mật khẩu có thể làm token cũ mất hiệu lực.
6. `require_permission("finance", "write")` tạo dependency yêu cầu `finance:write`. ADMIN được bypass; các role còn lại phải có permission tương ứng.

| Đoạn code | File/vị trí | Ý nghĩa khi giải thích |
|---|---|---|
| Route login | `backend/app/modules/auth/router.py:57` | Router mỏng: nhận request, cấp DB session, gọi service. |
| Authenticate / tạo session / rotate | `backend/app/modules/auth/service.py:40`, `:60`, `:99` | Nghiệp vụ xác thực và vòng đời refresh token. |
| Verify JWT/password | `backend/app/core/security.py:17`, `:49` | Hash mật khẩu tách khỏi HTTP layer; token ký bằng secret. |
| User và permission check | `backend/app/modules/auth/dependencies.py:16`, `:94` | Mọi module dùng chung dependency, không tự đọc header rải rác. |
| Session client | `web/src/context/AuthContext.tsx`, `web/src/services/apiClient.ts` | UI giữ trạng thái đăng nhập và tự khôi phục access token khi 401. |

**Câu trả lời ngắn:** “Frontend có thể ẩn menu theo permission để actor không thấy chức năng không liên quan, nhưng server vẫn kiểm JWT và permission trong từng API. Vì vậy gọi API trực tiếp không vượt qua được RBAC.”

### 5.2 Hợp đồng mua đất → giữ ô → kích hoạt phụ lục → xác nhận an táng

```mermaid
sequenceDiagram
    actor M as Marketing
    actor Q as Quản trang
    participant UI as Web
    participant API as contracts router/service
    participant DB as SQL Server
    M->>UI: Chọn khách, ô, giá và lập hợp đồng
    UI->>API: POST /contracts/land-purchase
    API->>DB: Tìm khách; nạp ô; kiểm trạng thái/giữ chỗ; tìm giá hiệu lực
    API->>DB: Tạo Contract DRAFT + LandPurchaseContract + Reservation
    API->>DB: Ghi AuditLog; commit
    M->>UI: Nộp scan đã ký và kích hoạt
    UI->>API: POST /contracts/{id}/activate
    API->>DB: Kiểm file READY, trạng thái, kiểm tra điều kiện domain
    API->>DB: ACTIVE + khoản phải thu/outbox/audit theo luồng
    Q->>UI: Xác nhận an táng tại hiện trường
    UI->>API: POST /contracts/annexes/{id}/confirm-burial
    API->>DB: Kiểm annex ACTIVE, giấy báo tử VERIFIED, plot/slot hợp lệ
    API->>DB: OCCUPIED + burial history; khóa vĩnh viễn nếu Kim Tĩnh
    API->>DB: Outbox + audit; commit
```

**Tạo hợp đồng mua đất (`ContractService.create_land_purchase_contract`)** — `backend/app/modules/contracts/service.py:104`:

- Kiểm khách hàng tồn tại, nạp plot với `.with_for_update()`, chỉ nhận plot `EMPTY_UNSOLD` hoặc `RESERVED`.
- Nếu đã có giữ chỗ, đối chiếu người giữ với nhân viên/khách; giữ chỗ do hợp đồng khác chiếm hoặc khách khác đặt thì trả `409 Conflict`.
- `LandPurchaseContractCreate.land_unit_price` cho phép bỏ trống; khi bỏ trống hoặc gửi giá `<= 0`, service tra khoản giá hiệu lực trong `PriceList` theo loại ô/số slot. Nếu request gửi giá dương thì code hiện dùng trực tiếp giá đó làm snapshot. Vì vậy không nên nói API luôn bắt buộc giá niêm yết; đây là điểm cần đối chiếu thêm với policy giá và quyền nghiệp vụ.
- Tạo `Contract` trạng thái `DRAFT`, `LandPurchaseContract`, và reservation 7 ngày; đổi plot sang `RESERVED`; ghi audit rồi commit.
- `db.flush()` ở giữa để lấy `contract_id` trước khi tạo bản ghi phụ thuộc; `db.commit()` chốt thay đổi.

**Kích hoạt pháp lý khác với thao tác hiện trường.** `activate_burial_annex()` ở `contracts/service.py:958` kiểm điều kiện pháp lý và file scan, ghi trạng thái phụ lục/thu phải thu. Code có comment nói việc đổi slot/plot sang `OCCUPIED` và khóa Kim Tĩnh phải đợi command hiện trường. Quản trang gọi `confirm_burial()` ở `:1234`: kiểm annex ACTIVE, giấy báo tử VERIFIED, plot chưa khóa, slot thuộc plot; sau đó cập nhật slot/plot, thêm `BurialHistory`, `OutboxEvent`, `AuditLog`, rồi commit. Khi hình thức là Kim Tĩnh, set `is_kim_tinh=True` và `is_locked=True`.

**Vì sao cần nhiều lớp bảo vệ Kim Tĩnh?** `plots/service.py::update_plot` từ chối gỡ cờ/chỉnh sửa khi locked; hợp đồng chặn cải táng/chuyển nhượng; ORM tắt `implicit_returning` ở bảng có trigger; SQL Server trigger là lớp cuối ngăn request/script ngoài service sửa trái luật. Bất biến nghiệp vụ không nên chỉ nằm ở nút frontend.

### 5.3 Kế toán ghi nhận khoản thanh toán

Endpoint `POST /api/v1/finance/receivables/{id}/payments` ở `finance/router.py:125` yêu cầu `finance:write`, validate `PaymentRecordRequest` rồi gọi `FinanceService.record_payment()` (`finance/service.py:446`).

1. Chuẩn hóa số tiền bằng `Decimal`, chuẩn hóa phương thức/mã giao dịch, tạo hash đại diện request.
2. Nạp khoản phải thu và gọi `.with_for_update()`; từ chối khoản không còn nợ hoặc đã hủy, và từ chối số tiền vượt số dư.
3. Khi request có khóa idempotency, tìm theo nhân viên + operation + key. Cùng key nhưng nội dung khác trả 409; request đã hoàn tất thì trả lại response đã lưu; request đang chạy thì báo xung đột. Service nhận key là optional, nên cần xác minh client/route luôn gửi key nếu muốn bảo đảm retry chống ghi trùng.
4. Thêm `Payment` kiểu append-only. Commit để SQL Server trigger `trg_payments_sync_receivable_balance` cập nhật tổng đã thu/số dư; sau đó đọc lại receivable.
5. Tạo số biên lai, đổi tiền ra chữ, sinh PDF, upload vào MinIO, tạo `Invoice` nếu khâu tệp thành công. Nếu tạo file lỗi, payment vẫn đã commit và response có thể không có invoice; có endpoint `regenerate-invoice` để phục hồi.
6. Đánh dấu request idempotency hoàn tất và lưu response, ghi audit và phát outbox event.

**Điểm phân tích sâu:** SQL và MinIO không cùng một transaction phân tán. Mã ghi payment trước, sau đó thử sinh biên lai trong `try/except`; do vậy không nên khẳng định “payment + PDF luôn atomic”. Thiết kế dùng khả năng phục hồi biên lai để xử lý trường hợp payment thành công nhưng storage tạm lỗi.

Mã cần nhớ:

```python
norm_amount = Decimal(str(payload.paid_amount)).quantize(Decimal("0.01"))
receivable = (
    db.query(Receivable)
    .filter(Receivable.receivable_id == receivable_id)
    .with_for_update()
    .first()
)
remaining_debt = receivable.final_payable_amount - receivable.total_paid_amount
if payload.paid_amount > remaining_debt:
    raise HTTPException(status_code=400, detail="Số tiền vượt dư nợ")
```

Đây là phần rút gọn từ `backend/app/modules/finance/service.py:456-496`; kiểm tra khóa trùng tiếp theo nằm ở `:498-537`.

### 5.4 Phân công thi công và nghiệm thu

- `ConstructionService.create_order()` (`construction/service.py:291`) nhận phụ lục đang `ACTIVE` loại `CONSTRUCTION` hoặc `BURIAL`, kiểm `plot_id` trùng với plot trong annex.
- Người giám sát và người nhận việc phải là nhân sự thực địa hợp lệ; kiểm lịch bận trong khoảng ngày. Nếu conflict thì trả 409 trước khi tạo order.
- Tạo order `PENDING`, đổi plot `OWNED_EMPTY` thành `UNDER_CONSTRUCTION`, rồi sinh task từ checklist của phụ lục hoặc checklist mặc định. Ghi audit và commit.
- `complete_task()` kiểm evidence READY trước khi chốt task. `complete_order()` (`:488`) kiểm task bắt buộc DONE và evidence READY; nếu thiếu thì không nghiệm thu.
- Khi hoàn thành, plot chỉ đổi từ `UNDER_CONSTRUCTION` về `OWNED_EMPTY` nếu chưa có slot occupied, hoặc `OCCUPIED` nếu đã có người an táng. Hoàn tất xây dựng không tự tạo sự kiện an táng.

### 5.5 Chăm sóc định kỳ và đóng ca

- `CareService.calculate_anchored_date()`/`generate_schedules_for_period()` tính ca theo chu kỳ gói và giữ neo ngày cuối tháng; khóa unique/idempotency tránh sinh trùng cùng kỳ.
- Quản trang cập nhật checklist và gắn ảnh qua `documents/upload` rồi attach vào schedule.
- `close_schedule()` (`care/service.py:339`) không cho đóng nếu còn checklist bắt buộc chưa xong hoặc không có ít nhất một file `READY` có MIME ảnh.
- Khi đạt gate, set `CLOSED`, thời gian/người hoàn thành, commit. Sau đó code phát outbox và audit. Lưu ý đọc thứ tự commit thực tế khi giải thích: ở flow này các bước event/audit được gọi sau commit trạng thái.

### 5.6 Upload file và kiểm quyền

`DocumentService.upload_file()` (`documents/service.py:52`) kiểm giới hạn dung lượng, nhận diện MIME từ nội dung/đuôi file, SHA-256, tạo key không trùng, upload object vào MinIO và tạo `FileObject` trạng thái `READY` trong SQL Server. File database lưu metadata; binary lưu object storage.

Khi download, service kiểm tra file còn tồn tại và liên kết của nó. Biên lai/export nhạy cảm yêu cầu actor có quyền tương ứng. Cổng công khai dùng endpoint/DTO riêng; không nên lấy file private rồi chỉ ẩn link ở client.

## 6. Bảng tra cứu nhanh 8 phân hệ backend

| Module | Nghiệp vụ chính | Entity/khái niệm nên nhắc | Điểm bảo vệ |
|---|---|---|---|
| `auth` | Tài khoản, session, vai trò | User, Role, Permission, AuthSession | JWT, `auth_version`, password hash, permission dependency. |
| `catalog` | Giá và gói | PriceList, PriceItem, CarePackage, ContractTemplate | Hiệu lực ngày, tránh khoảng giá chồng. |
| `plots` | Không gian và ô mộ | Zone, Row, Plot, PlotSlot, Reservation, Ownership | Trạng thái, giữ chỗ, Kim Tĩnh, dữ liệu theo actor. |
| `profiles` | Thân nhân/người mất | Customer, DeceasedProfile, DeathCertificate, Relation | PII, xác minh chứng từ, public DTO tối thiểu. |
| `contracts` | Giao dịch pháp lý | Contract, Annex, các bảng detail theo loại | Giữ ô, ký/activate, death-certificate gate, command hiện trường. |
| `construction` | Thi công | Order, Task, Evidence, StaffUnavailability | Nhân sự phù hợp, lịch, evidence và nghiệm thu. |
| `care` | Dịch vụ định kỳ | CarePackage, Schedule, Checklist, Evidence | Sinh ca theo kỳ, phân công, ảnh, gate đóng ca. |
| `finance` | Công nợ và thanh toán | Receivable, Payment, Discount, Invoice, IdempotencyRequest | Decimal, nguồn XOR, thu không quá nợ, chống ghi trùng. |

`documents`, `reports`, `audit`, `jobs` là các phân hệ nền liên kết nhiều domain: lưu tệp; đọc/xuất tổng hợp; truy vết; xử lý job/event.

## 7. Những khác biệt giữa mô tả thiết kế và source cần trả lời trung thực

| Mô tả thường gặp | Hiện trạng thấy trong repo | Cách trả lời an toàn |
|---|---|---|
| Có đủ `router → service → repository` | Các module hiện query ORM trực tiếp trong `service.py`; chưa có lớp `repository.py`. | “Phân tầng router/service/model có, repository chưa được tách; đây là điểm có thể refactor nếu cần test/query reuse tốt hơn.” |
| Web dùng Tailwind, shadcn, React Query, React Hook Form/Zod | `web/package.json` hiện khai báo React, Vite, TypeScript, Leaflet, Lucide và lint/type tooling; không thấy các thư viện kể trên. UI hiện dùng component/CSS trong source. | Nêu công nghệ có trong package hiện tại; không đọc danh sách trong ADR như dependency đã cài. |
| Mobile có offline queue/đồng bộ offline | Source mobile dùng Dio và Riverpod; không thấy package persistent queue/database trong `pubspec.yaml`, cũng không thấy implementation offline queue trong `mobile/lib`. | “Đây là mục tiêu/ghi chú thiết kế; source app hiện tại chủ yếu gọi API online, offline queue chưa thấy triển khai.” |
| Mọi thay đổi nghiệp vụ và outbox luôn một transaction | Tùy service: một số code tạo outbox trước commit, nhưng care/payment có các bước commit riêng rồi mới publish event/audit. MinIO cũng nằm ngoài SQL transaction. | Nêu thứ tự cụ thể ở luồng đang nói; không khẳng định tất cả đều atomic. |
| `0001_baseline` tạo 37 bảng | File migration baseline chỉ `pass`; comment nói DB đã tồn tại. | Đây là stamp/baseline phản ánh schema hiện hữu; các thay đổi sau đi qua migration tăng dần. |
| README là bằng chứng triển khai hoàn chỉnh | README/ADR mô tả mục tiêu và tổng quan; chi tiết phải xác nhận trong `app`, `web/src`, `mobile/lib`, migration và tests. | Phân biệt “thiết kế nói” và “source hiện làm”. |

Các quy tắc an toàn khi trình bày:

- Không nói đã có repository layer, queue offline, hoặc transaction xuyên SQL–MinIO nếu không chỉ được file thực thi.
- Nói frontend ẩn control theo quyền là UX; security enforcement thực nằm ở backend router/service.
- Mô tả dữ liệu demo là synthetic; không gọi tọa độ giả là GPS khảo sát thật.
- Không nói chạy bootstrap DB; `docs/source/lab4-sql.sql` chứa thao tác phá hủy DB. Dùng Alembic migration tăng dần.
- Nếu hỏi test, dẫn `backend/tests/conftest.py`: test buộc vào `QL_NghiaTrang_Test` và kiểm database vật lý trước khi chạy.

## 8. Câu hỏi vấn đáp có thể gặp

**Vì sao có cả access token lẫn refresh token?** Access token ngắn hạn dùng cho API; refresh token sống lâu hơn để đổi cặp token. Server lưu hash của refresh token, xoay token khi refresh và có thể thu hồi session.

**401 và 403 khác nhau thế nào?** 401 là token thiếu/sai/hết hạn/đã thu hồi; 403 là đã xác thực nhưng không đủ quyền hoặc tài khoản bị cấm truy cập.

**Tại sao xác nhận an táng tách khỏi kích hoạt phụ lục?** Ký/kích hoạt là hoàn thành bước pháp lý. Chỉ sau thao tác thực địa, Quản trang mới xác nhận người và huyệt đã được an táng; lúc đó hệ thống cập nhật occupancy và nếu là Kim Tĩnh thì khóa ô.

**Vì sao không dùng float cho tiền?** Float nhị phân có thể biểu diễn gần đúng; Decimal/NUMERIC giữ độ chính xác để đối chiếu khoản nợ, thanh toán và chiết khấu.

**File ở đâu, dữ liệu gì nằm ở SQL?** Binary đi MinIO; SQL lưu `FileObject` metadata, object key, hash, loại, kích thước và các quan hệ đến hồ sơ.

**Làm sao tránh thu tiền hai lần khi client retry?** Gửi idempotency key; service nhận diện cùng actor/operation/key, kiểm hash request, trả response cũ nếu đã hoàn thành và 409 nếu payload mâu thuẫn/đang xử lý. SQL trigger đồng bộ số dư từ payment đã lưu.

**Tại sao vẫn cần kiểm quyền ở API khi menu đã ẩn?** Client có thể bị chỉnh sửa hoặc gọi thẳng API. Quyền hiển thị chỉ giúp UX; API phải từ chối request không có permission.

**Phân biệt sơ đồ SVG và bản đồ GIS?** SVG là ma trận minh họa hàng/cột, phù hợp xem bố cục nội khu. Leaflet dùng lat/long để đặt marker/rectangle địa lý; nền OSM chỉ là tile hiển thị, còn trạng thái/mã ô đến từ API.

## 9. Cách mở code và lần tiếp khi ôn

1. Bắt đầu ở `backend/app/main.py`, lần từ `include_router` tới route cụ thể.
2. Đọc `router.py` để thấy HTTP contract và permission dependency.
3. Mở schema để hiểu dữ liệu vào/ra; sau đó mở service để đọc các nhánh lỗi, truy vấn, trạng thái và commit.
4. Mở `models.py` để nối field/relationship với bảng; nếu có invariant DB thì tra migration/schema baseline/trigger mapping.
5. Tìm client tương ứng trong `web/src/components` hoặc `mobile/lib/screens`, rồi provider/service để thấy request đi lên API.
6. Đọc test phân hệ tương ứng để xem tình huống hợp lệ, bị từ chối và trạng thái lỗi mong đợi.

Các con số file được khảo sát theo source hiện có, không bao gồm dependencies/build/runtime. Test/lint/build không được chạy thêm trong lượt lập cẩm nang này; khi cần nghiệm thu kỹ thuật, chạy quality gate theo đúng hướng dẫn và đảm bảo DB test/MinIO đã sẵn sàng.
