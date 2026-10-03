# Hệ thống Quản lý Nghĩa trang Tư nhân (Cemetery Management System)

Phần mềm hoạch định, quản lý nghiệp vụ và vận hành nghĩa trang tư nhân toàn diện, đáp ứng tiêu chuẩn nghiêm ngặt về quản trị không gian địa lý, vòng đời mộ phần, an táng tâm linh, thi công thực địa và kế toán công nợ.

---

## 1. Giới thiệu tổng quan

Hệ thống Quản lý Nghĩa trang Tư nhân là giải pháp monorepo cấp doanh nghiệp, được thiết kế theo kiến trúc hướng miền (Domain-Driven Design - DDD). Hệ thống đồng bộ hóa luồng thông tin nghiệp vụ từ văn phòng kinh doanh, bộ phận kế toán đến đội ngũ quản trang và kỹ sư thi công hiện trường.

Các quy chuẩn then chốt:
- **Tôn nghiêm và bất biến:** Thực thi các ràng buộc pháp lý và tâm linh (Kim Tĩnh bất biến, kiểm soát giấy báo tử bắt buộc trước khi an táng hoặc hỏa táng).
- **Ngăn ngừa tranh chấp:** Kiểm soát dòng giao dịch ACID, khóa dòng (Row-level locking) chống trùng ô mộ, tính toán công nợ theo số học chính xác `DECIMAL(15,2)`.
- **Minh chứng hiện trường chuẩn hóa:** Nghiệm thu thi công theo danh mục công việc (Checklist) kèm ảnh chụp hiện trường lưu trữ bảo mật trên MinIO với mã kiểm tra SHA-256.
- **Bảo mật và riêng tư:** Phân quyền theo vai trò (RBAC), kiểm soát phiên theo chuẩn RFC 6819, cơ chế tra cứu người quá cố công khai không để lộ thông tin định danh cá nhân (Zero PII).

---

## 2. Kiến trúc hệ thống

Dự án áp dụng mô hình kiến trúc Monorepo phân tách rõ ràng giữa giao diện người dùng, cổng giao tiếp API và hạ tầng dữ liệu.

```mermaid
graph TB
    subgraph Clients["Tầng Giao Diện (Clients)"]
        WebClient["Web Admin & Portal<br/>(React 19 + TypeScript + Vite + Leaflet)"]
        MobileClient["Mobile Quản Trang<br/>(Flutter + Riverpod + Offline Queue)"]
    end

    subgraph Gateway["Tầng Dịch Vụ Ứng Dụng (FastAPI Gateway)"]
        API["FastAPI REST Engine (Python 3.12)"]
        AuthMiddleware["Xác Thực JWT & RFC 6819<br/>RBAC Permission Scope"]
        AuditService["Audit Log & Outbox Event Engine"]
    end

    subgraph Storage["Tầng Lưu Trữ & Hạ Tầng Dữ Liệu"]
        MSSQL[("Microsoft SQL Server 2022<br/>ODBC Driver 18<br/>Triggers & Alembic Migrations")]
        MinIO[("MinIO Object Storage<br/>S3 API / Bind Mount Ổ D<br/>Bảo mật SHA-256")]
    end

    WebClient -->|HTTPS / JSON / JWT| API
    MobileClient -->|HTTPS / JSON / JWT| API
    API --> AuthMiddleware
    AuthMiddleware --> AuditService
    AuditService -->|SQLAlchemy 2.x ACID| MSSQL
    AuditService -->|Streaming Upload / Preview| MinIO
```

### Thành phần cấu trúc thư mục

```
QL-NghiaTrang/
├── backend/                  # Nền tảng FastAPI backend (Python 3.12, uv)
│   ├── alembic/              # Kịch bản di trú schema CSDL tăng dần (0001 -> 0009)
│   ├── app/
│   │   ├── core/             # Cấu hình, bảo mật JWT, database session, MinIO client
│   │   ├── modules/          # Các phân hệ nghiệp vụ độc lập:
│   │   │   ├── auth/         # Xác thực, RBAC, kiểm soát phiên (G01)
│   │   │   ├── catalog/      # Bảng giá, danh mục dịch vụ, gói chăm sóc (M04)
│   │   │   ├── plots/        # Không gian nghĩa trang, ô mộ, slot, GIS (M05)
│   │   │   ├── profiles/     # Thân nhân, người mất, giấy báo tử (M06)
│   │   │   ├── contracts/    # Hợp đồng đất, an táng, cải táng, chuyển nhượng (M07-M08)
│   │   │   ├── construction/ # Quản lý thi công, checklist, bằng chứng ảnh (M09)
│   │   │   ├── documents/    # Tệp MinIO, PDF tiếng Việt, báo cáo Excel (M03)
│   │   │   └── system/       # Health check, version, audit logs
│   ├── runtime/              # Dữ liệu cục bộ (MinIO data, logs, backups - ngoài ổ C)
│   └── tests/                # Bộ kiểm thử tự động toàn diện (59 test suites)
├── web/                      # Ứng dụng điều hành Web (React 19, TypeScript, pnpm)
│   ├── src/
│   │   ├── components/       # Các phân hệ UI: Map GIS, Hợp đồng, Thi công, Hồ sơ
│   │   ├── context/          # Quản lý phiên làm việc AuthContext
│   │   └── services/         # Client gọi REST API
├── mobile/                   # Ứng dụng hiện trường (Flutter 3.x, Dart 3.x)
│   ├── lib/                  # Giao diện Quản trang, Sơ đồ ô mộ, Danh mục, Thi công
│   └── test/                 # Bộ kiểm thử widget và luồng nghiệp vụ thực địa
├── docs/                     # Tài liệu thiết kế kiến trúc, kế hoạch thực thi, nhật ký
│   ├── EXECUTION_PLAN.md     # Kế hoạch chi tiết 15 cột mốc (M00 -> M14)
│   └── execution/STATE.md    # Nhật ký bằng chứng nghiệm thu từng cột mốc
└── scripts/                  # Kịch bản tự động hóa, kiểm tra chất lượng (Quality Gate)
```

---

## 3. Ràng buộc miền cốt lõi (Domain Invariants)

Hệ thống được thiết kế với các chốt chặn mức Server và CSDL để đảm bảo tính toàn vẹn tuyệt đối:

| Mã Invariant | Quy định miền | Cơ chế kiểm soát kỹ thuật |
|---|---|---|
| **Kim Tĩnh Bất Biến** | Một khi ô mộ an táng theo hình thức Kim Tĩnh, ô bị khóa vĩnh viễn mức CSDL. Nghiêm cấm cải táng, đổi cấu trúc, hạ cờ hoặc chuyển nhượng. | MSSQL Trigger `trg_plots_enforce_kim_tinh_immutability` chặn mọi UPDATE `is_locked` (Lỗi 51001) hoặc cải táng (Lỗi 51000). Service ném lỗi 400. |
| **G01 - Thu Hồi Tức Thì** | Khi thu hồi quyền hạn hoặc đăng xuất, toàn bộ Access Token của phiên phải bị vô hiệu hóa ngay lập tức. | Kiểm tra `auth_version` trên `auth_sessions`. Khi người dùng đăng xuất hoặc bị quản trị viên khóa, session bị thu hồi và token cũ bị từ chối 401 ngay lập tức. |
| **G08 - Kiểm Soát Giấy Báo Tử** | Tuyệt đối không cho phép tạo phụ lục an táng hoặc hợp đồng hỏa táng khi chưa có giấy báo tử đã được duyệt. | Hàm `check_death_certificate_verified` kiểm tra trạng thái `VERIFIED` kèm file scan MinIO. Nếu chưa duyệt, trả về lỗi 400. |
| **G09 - Chống Trùng Giữ Chỗ** | Ngăn chặn hành vi hai nhân viên kinh doanh cùng bán hoặc giữ chỗ một ô mộ cùng thời điểm. | Sử dụng khóa dòng SQLAlchemy `with_for_update` kết hợp khóa phụ lục `active_contract_id`. |
| **G11 - Nghiệm Thu Thi Công** | Mọi hạng mục bắt buộc (`is_required`) trong công trình phải có ảnh hiện trường ở trạng thái `READY` trước khi chuyển sang `DONE`. Tiến độ bị chặn ở mức 99% nếu còn hạng mục bắt buộc chưa hoàn thành. | Kiểm tra bảng `construction_task_evidences` liên kết `file_objects.state == 'READY'`. |
| **G12 - Nghiệm Thu Đóng Ca Chăm Sóc** | Chặn nghiệm thu đóng ca chăm sóc (`CLOSED`) nếu còn bất kỳ công việc bắt buộc (`is_required`) nào chưa hoàn tất hoặc thiếu ảnh hiện trường minh chứng ở trạng thái `READY`. | Kiểm tra toàn bộ checklist items và liên kết ảnh `file_objects.state == 'READY'` trước khi chuyển trạng thái lịch sang `CLOSED`. |
| **Bảo Toàn Trạng Thái An Táng** | Nghiệm thu và hoàn tất thi công KHÔNG BAO GIỜ tự ý đổi trạng thái ô mộ hoặc slot sang `OCCUPIED`. | Ô mộ `UNDER_CONSTRUCTION` chỉ hoàn trả về `OWNED_EMPTY` (chưa có người mất) hoặc `OCCUPIED` (nếu đã có người an táng từ trước). |
| **G13 - Tránh Xung Đột Lịch** | Phân công thợ thi công hoặc lập kế hoạch hiện trường phải kiểm tra lịch vắng mặt/nghỉ phép. | Bảng `staff_unavailability` phát hiện và trả về cảnh báo xung đột lịch làm việc. |
| **Chính Xác Tiền Tệ** | Cấm sử dụng kiểu số thực (Float) trong tính toán tài chính. | Toàn bộ tiền tệ dùng `DECIMAL(15,2)` trong SQL và `Decimal` (`ROUND_HALF_UP`) trong Python. |

---

## 4. Quy trình nghiệp vụ cốt lõi

### 4.1. Vòng đời ô mộ và slot an táng

```mermaid
stateDiagram-v2
    [*] --> EMPTY_UNSOLD: Khởi tạo danh mục lô đất
    EMPTY_UNSOLD --> RESERVED: Giữ chỗ đặt cọc (Tối đa 7 ngày)
    RESERVED --> EMPTY_UNSOLD: Hết hạn cọc / Hủy giữ chỗ
    RESERVED --> OWNED_EMPTY: Kích hoạt hợp đồng mua đất
    EMPTY_UNSOLD --> OWNED_EMPTY: Mua trực tiếp không qua cọc
    
    OWNED_EMPTY --> UNDER_CONSTRUCTION: Lập lệnh xây dựng kim tĩnh / mộ phần
    UNDER_CONSTRUCTION --> OWNED_EMPTY: Hoàn tất thi công (Chưa an táng)
    
    OWNED_EMPTY --> OCCUPIED: Kích hoạt phụ lục an táng (Đã duyệt giấy báo tử)
    UNDER_CONSTRUCTION --> OCCUPIED: Hoàn tất thi công trên ô đã có mộ trước đó
    
    state OCCUPIED {
        [*] --> Thuong: Mộ đất truyền thống
        [*] --> KimTinh: Kim Tĩnh kiên cố
        KimTinh --> LockedPermanent: Khóa vĩnh viễn (Trigger 51000/51001)
    }
    
    Thuong --> EXHUMED: Cải táng di dời (Giải phóng slot)
    EXHUMED --> OWNED_EMPTY: Slot trống hoàn toàn, đất vẫn thuộc chủ cũ
    
    OWNED_EMPTY --> TRANSFERRED: Chuyển nhượng quyền sử dụng đất
    TRANSFERRED --> OWNED_EMPTY: Đổi chủ sở hữu mới (Chỉ áp dụng ô trống)
```

### 4.2. Luồng thi công thực địa và kiểm định minh chứng (M09)

```mermaid
sequenceDiagram
    autonumber
    actor NV as Kỹ Sư / Quản Trang
    participant App as Web / Mobile App
    participant API as FastAPI Construction Engine
    participant DB as SQL Server 2022
    participant S3 as MinIO Object Storage

    NV->>App: Lập lệnh thi công từ Phụ lục đã kích hoạt
    App->>API: POST /api/v1/construction/orders
    API->>DB: Kiểm tra annex.status == 'ACTIVE' & staff_unavailability
    DB-->>API: Phù hợp, sinh mã CT-YYYYMM-NNNN
    API-->>App: Lệnh thi công khởi tạo thành công

    NV->>App: Tải ảnh minh chứng hiện trường (Đào móng / Bê tông)
    App->>API: POST /api/v1/documents/upload
    API->>S3: Stream tệp, băm SHA-256, chuyển trạng thái READY
    S3-->>API: file_id hợp lệ
    App->>API: POST /api/v1/construction/tasks/{task_id}/evidence
    API->>DB: Lưu construction_task_evidences

    NV->>App: Cập nhật trạng thái hạng mục sang DONE
    App->>API: PATCH /api/v1/construction/tasks/{task_id}
    API->>DB: Kiểm tra ảnh READY nếu task.is_required == True
    DB-->>API: Hợp lệ, cập nhật trạng thái hạng mục

    NV->>App: Nghiệm thu hoàn thành công trình
    App->>API: POST /api/v1/construction/orders/{order_id}/complete
    API->>DB: Kiểm tra: còn task bắt buộc chưa DONE -> Chặn 400
    API->>DB: Đổi order.status = 'COMPLETED', plot hoàn trả OWNED_EMPTY / OCCUPIED
    API->>DB: Ghi OutboxEvent & AuditLog
    API-->>App: Nghiệm thu thành công, công trình bàn giao
```

### 4.3. Luồng chăm sóc định kỳ và nghiệm thu đóng ca G12 (M10)

```mermaid
sequenceDiagram
    autonumber
    actor NV as Quản Trang Hiện Trường
    participant App as Web / Mobile App
    participant API as FastAPI Care Engine
    participant DB as SQL Server 2022
    participant S3 as MinIO Object Storage

    Note over API,DB: Tự động sinh lịch định kỳ (Anchor Day bảo toàn cuối tháng)
    App->>API: POST /api/v1/care/schedules/generate?period_key=2026-Oct
    API->>DB: Truy vấn hợp đồng chăm sóc ACTIVE & kiểm tra Unique uq_care_schedule_annex_period
    DB-->>API: Tạo mới care_schedules + nạp mẫu checklist từ gói dịch vụ
    API-->>App: Sinh thành công N lịch định kỳ không trùng lặp

    NV->>App: Nhận lịch ca trực & thực hiện việc hiện trường
    NV->>App: Đánh dấu hoàn thành checklist (Lau dọn, cắm hoa, thắp hương)
    App->>API: PATCH /api/v1/care/checklist/{item_id}
    API->>DB: Cập nhật is_done = True, completed_at, notes

    NV->>App: Chụp ảnh hiện trường minh chứng hoàn tất
    App->>API: POST /api/v1/documents/upload
    API->>S3: Lưu tệp MinIO, tính SHA-256, chuyển READY
    S3-->>API: file_id minh chứng
    App->>API: POST /api/v1/care/schedules/{schedule_id}/evidence
    API->>DB: Lưu care_media_evidences (loại AFTER_CARE)

    NV->>App: Gửi yêu cầu nghiệm thu đóng ca
    App->>API: POST /api/v1/care/schedules/{schedule_id}/close
    API->>DB: Kiểm tra invariant G12: Còn task is_required chưa xong hoặc thiếu ảnh READY?
    alt Thiếu điều kiện G12
        API-->>App: Lỗi 400 (Từ chối đóng ca do thiếu minh chứng hoặc công việc bắt buộc)
    else Đủ điều kiện G12
        API->>DB: Đổi status = 'CLOSED', ghi nhận completed_by_id & completed_at
        API->>DB: Ghi OutboxEvent ('care.schedule.closed') & AuditLog
        API-->>App: Đóng ca thành công, sẵn sàng gửi báo cáo cho thân nhân
    end
```

---

## 5. Công nghệ sử dụng

| Phân hệ | Công nghệ chủ đạo | Công cụ quản lý | Ghi chú kỹ thuật |
|---|---|---|---|
| **Backend API** | Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2 | `uv` | Chạy bất đồng bộ, hỗ trợ MSSQL dialect, trigger bypass `implicit_returning=False`. |
| **Cơ sở dữ liệu** | Microsoft SQL Server 2022 | Native ODBC 18 | Phân định CSDL chính (`QL_NghiaTrang`) và kiểm thử (`QL_NghiaTrang_Test`). |
| **Di trú CSDL** | Alembic | `uv run alembic` | Quản lý schema tăng dần, tuyệt đối không chạy script phá hủy dữ liệu. |
| **Lưu trữ đối tượng** | MinIO (S3 compatible) | Docker container | Bind mount trực tiếp vào `backend/runtime/minio/data` trên ổ D. |
| **Web Frontend** | React 19, TypeScript, Vite, Leaflet GIS | `pnpm` | Giao diện điều hành chuyên sâu, Leaflet bản đồ số ô mộ, xuất Excel/PDF. |
| **Mobile App** | Flutter 3.41.6, Dart 3.11.4 | Flutter SDK | Hỗ trợ 4 trạng thái giao diện ngoài trời, Riverpod state management. |
| **Chất lượng code** | Ruff, Pytest, ESLint, TypeScript compiler | Scripts tự động | Kịch bản `scripts/quality-gate.ps1` kiểm tra toàn bộ 3 phân hệ. |

---

## 6. Hướng dẫn cài đặt và khởi chạy

### 6.1. Yêu cầu môi trường

- Hệ điều hành: Windows 10/11 hoặc Linux
- Python: Phiên bản >= 3.12 (Khuyến nghị cài đặt qua `uv`)
- Node.js: Phiên bản >= 20.x, cài đặt `pnpm`
- Flutter SDK: Phiên bản stable (>= 3.27)
- Microsoft SQL Server 2022 với ODBC Driver 18 for SQL Server
- Docker Desktop (chạy MinIO container)

### 6.2. Thiết lập Backend

1. Di chuyển vào thư mục backend và tạo môi trường ảo:
   ```powershell
   cd backend
   uv sync
   ```

2. Cấu hình tệp môi trường `backend/.env` (tạo từ `.env.example`):
   ```env
   DATABASE_URL=mssql+pyodbc://sa:YourPassword@127.0.0.1:1433/QL_NghiaTrang?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
   TEST_DATABASE_URL=mssql+pyodbc://sa:YourPassword@127.0.0.1:1433/QL_NghiaTrang_Test?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
   MINIO_ENDPOINT=127.0.0.1:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET_DOCUMENTS=ql-nghiatrang-documents
   JWT_SECRET_KEY=your_secure_random_key
   ```

3. Chạy di trú schema CSDL lên bản mới nhất:
   ```powershell
   uv run alembic upgrade head
   ```

4. Khởi chạy máy chủ phát triển FastAPI:
   ```powershell
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

Tài liệu API Swagger tương tác có sẵn tại: `http://localhost:8000/docs`

### 6.3. Thiết lập Web Frontend

1. Cài đặt các gói phụ thuộc:
   ```powershell
   cd web
   pnpm install
   ```

2. Khởi chạy dev server:
   ```powershell
   pnpm dev
   ```

Cổng thông tin web quản trị truy cập tại: `http://localhost:5173`

### 6.4. Thiết lập Mobile App

1. Lấy gói phụ thuộc Flutter:
   ```powershell
   cd mobile
   flutter pub get
   ```

2. Kiểm tra chất lượng mã nguồn:
   ```powershell
   flutter analyze
   flutter test
   ```

3. Khởi chạy ứng dụng (giả lập hoặc thiết bị thật):
   ```powershell
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
   ```

---

## 7. Đảm bảo chất lượng (Quality Gate)

Dự án thiết lập quy trình kiểm định chất lượng tự động nghiêm ngặt trước mỗi commit hoặc phát hành phiên bản. Để thực thi toàn bộ kiểm thử trên cả 3 phân hệ:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/quality-gate.ps1
```

Quy chuẩn kiểm tra bao gồm:
- **Backend:** `uv run ruff check .` (linter không có lỗi) và `uv run pytest` (**66/66 bài kiểm thử đạt 100%**).
- **Web Frontend:** `pnpm lint` (0 lỗi) và `pnpm build` (biên dịch TypeScript và đóng gói Vite sạch sẽ).
- **Mobile App:** `flutter analyze` (0 lỗi cảnh báo) và `flutter test` (**12/12 bài kiểm thử đạt 100%**).

---

## 8. Tiến độ dự án (Milestone Delivery)

| Milestone | Phân hệ / Nghiệp vụ | Phiên bản | Trạng thái |
|---|---|---|---|
| M00 | Khảo sát, kiến trúc, kiểm tra ODBC 18 & baseline CSDL | `v0.1.0-baseline` | Hoàn thành |
| M01 | Khởi tạo Monorepo, cấu hình MinIO ổ D, Shell 4 trạng thái | `v0.2.0-foundation` | Hoàn thành |
| M02 | Baseline migration, SQLAlchemy ORM, RBAC & RFC 6819 | `v0.3.0-auth` | Hoàn thành |
| M03 | Quản lý tệp MinIO, Magic Bytes, xuất PDF tiếng Việt UTF-8, Outbox | `v0.4.0-documents` | Hoàn thành |
| M04 | Danh mục bảng giá dịch vụ, gói chăm sóc, biểu mẫu hợp đồng | `v0.5.0-design-catalog` | Hoàn thành |
| M05 | Bản đồ GIS Leaflet, quản lý ô mộ, slot huyệt, khóa Kim Tĩnh | `v0.6.0-plots` | Hoàn thành |
| M06 | Hồ sơ khách hàng, người quá cố, thẩm tra giấy báo tử | `v0.7.0-profiles` | Hoàn thành |
| M07 | Quy trình hợp đồng mua đất, Sequence số HĐ, kích hoạt ACID | `v0.8.0-land-contracts` | Hoàn thành |
| M08 | Vòng đời an táng, khóa Kim Tĩnh vĩnh viễn, cải táng, chuyển nhượng | `v0.9.0-domain-lifecycle` | Hoàn thành |
| M09 | Quản lý thi công thực địa, checklist nhiệm vụ, bằng chứng ảnh MinIO | `v0.10.0-construction` | Hoàn thành |
| M10 | Chăm sóc định kỳ mộ phần, đóng ca quản trang, hàng đợi offline | `v0.11.0-care` | Hoàn thành |
| M11 | Kế toán công nợ, thu tiền, chiết khấu hóa đơn, biên lai tài chính | `v0.12.0-finance` | Đang triển khai |
| M12 | Báo cáo quản trị, cổng tra cứu thông tin công khai Zero PII | `v0.13.0-feature-complete` | Kế hoạch |
| M13 | Kiểm thử tải, bảo mật, đối soát phục hồi CSDL và S3 | `v1.0.0-rc.1` | Kế hoạch |
| M14 | Đóng gói bản phát hành chính thức, tài liệu bàn giao vận hành | `v1.0.0` | Kế hoạch |

---

## 9. Giấy phép & Bảo mật

Phần mềm được phát triển cho mục đích quản lý nghĩa trang tư nhân với các cam kết bảo mật:
- Tuyệt đối không lưu trữ hoặc commit tệp bí mật (`.env`, khóa ký số, mật khẩu).
- Dữ liệu định danh cá nhân (CCCD, hồ sơ thân nhân) được bảo vệ phân quyền nghiêm ngặt.
- Cổng tra cứu công khai che giấu thông tin nhạy cảm của thân nhân, chỉ hiển thị thông tin người mất và vị trí mộ phần.
