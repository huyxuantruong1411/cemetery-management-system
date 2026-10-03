# Hệ Thống Quản Lý Nghĩa Trang Tư Nhân (Cemetery Management System)

Phần mềm quản trị nghiệp vụ, không gian địa lý, vòng đời mộ phần, quy trình tâm linh, thi công thực địa và kế toán tài chính dành cho các đơn vị quản lý và vận hành công viên nghĩa trang tư nhân.

Hệ thống được phát triển theo kiến trúc hướng miền (Domain-Driven Design - DDD) trên mô hình Monorepo đồng nhất: Backend FastAPI (Python), Cơ sở dữ liệu Microsoft SQL Server 2022, Hệ thống lưu trữ đối tượng MinIO S3, Web Quản trị React 19 / TypeScript và Ứng dụng Di động Hiện trường Flutter Android.

Repository chính thức: [https://github.com/huyxuantruong1411/cemetery-management-system.git](https://github.com/huyxuantruong1411/cemetery-management-system.git)

---

## 1. Giới thiệu tổng quan

Công tác quản lý nghĩa trang tư nhân đòi hỏi sự kết hợp chặt chẽ giữa tính tôn nghiêm tâm linh, thủ tục pháp lý minh bạch và kỷ luật vận hành chuẩn xác. Hệ thống giải quyết trọn vẹn chuỗi giá trị:

- **Bảo tồn tính tôn nghiêm và pháp lý:** Thực thi chốt chặn bắt buộc về giấy báo tử (`Death Certificate Gate`) trước khi an táng hoặc hỏa táng. Quy tắc **Kim Tĩnh Bất Biến** bảo vệ vĩnh viễn cấu trúc huyệt mộ đã xây dựng kiên cố mức CSDL.
- **Quản trị dòng tiền minh bạch:** Toàn bộ dữ liệu tiền tệ được tính toán theo kiểu số học chính xác `DECIMAL(15,2)`, ngăn chặn triệt để sai số dấu phẩy động. Các khoản phải thu được phân định nguồn rõ ràng (Hợp đồng hoặc Phụ lục), giao dịch thanh toán lũy kế chống trùng lặp (Idempotent) và tự động xuất biên lai PDF chuẩn tiếng Việt UTF-8.
- **Số hóa không gian nghĩa trang (GIS):** Trực quan hóa các phân khu, dãy, lô và slot huyệt mộ thông qua bản đồ số Leaflet tương tác cao, quản lý trạng thái động từ giữ chỗ đặt cọc đến an táng thực tế.
- **Giám sát hiện trường thời gian thực:** Quản lý lệnh thi công xây dựng mộ phần và các ca chăm sóc định kỳ theo danh mục việc cần làm (Checklist), nghiệm thu chặt chẽ kèm hình ảnh minh chứng lưu trữ an toàn trên MinIO có mã kiểm tra SHA-256.
- **Bảo vệ quyền riêng tư (Zero PII):** Cổng tra cứu thông tin người quá cố công cộng cho phép thân nhân tìm kiếm vị trí phần mộ mà không làm lộ các dữ liệu định danh cá nhân nhạy cảm (CCCD, số điện thoại, hợp đồng tài chính).

---

## 2. Kiến trúc hệ thống

Dự án áp dụng mô hình phân tầng chặt chẽ với nguyên tắc: Mọi ràng buộc nghiệp vụ, bảo mật, phân quyền và kiểm soát toàn vẹn giao dịch ACID đều được thực thi tại Máy chủ (Server-side Enforcement). Các ứng dụng Web và Mobile hoạt động như cổng giao tiếp hiển thị và gửi lệnh (Command/Query Separation).

### 2.1. Sơ đồ kiến trúc tổng thể

```mermaid
graph TB
    subgraph Clients["TẦNG GIAO DIỆN NGƯỜI DÙNG (CLIENTS)"]
        WebAdmin["Web Quản Trị & Điều Hành<br/>(React 19 + TypeScript + Vite + Leaflet GIS)"]
        MobileApp["Mobile Quản Trang & Hiện Trường<br/>(Flutter + Dart + Riverpod + Offline Queue)"]
    end

    subgraph Gateway["TẦNG DỊCH VỤ ỨNG DỤNG (FASTAPI BACKEND)"]
        APIGateway["FastAPI REST Engine (Python 3.12, uv)"]
        AuthModule["Xác Thực JWT & Phiên RFC 6819<br/>Phân Quyền RBAC Scope"]
        
        subgraph DomainServices["Các Phân Hệ Nghiệp Vụ Cốt Lõi"]
            PlotsSvc["Quản Lý Ô Mộ & GIS"]
            ProfilesSvc["Hồ Sơ & Giấy Báo Tử"]
            ContractsSvc["Hợp Đồng & Phụ Lục"]
            ConstructionSvc["Thi Công & Nghiệm Thu"]
            CareSvc["Chăm Sóc Mộ Phần"]
            FinanceSvc["Công Nợ & Biên Lai Thu"]
            DocSvc["Tệp MinIO & Báo Cáo PDF/Excel"]
        end
        
        OutboxWorker["Outbox Event Engine & Audit Logger"]
    end

    subgraph DataStorage["TẦNG DỮ LIỆU & LƯU TRỮ HẠ TẦNG"]
        MSSQL[("Microsoft SQL Server 2022<br/>ODBC Driver 18<br/>Triggers, Sequences & Foreign Keys")]
        MinIOStorage[("MinIO Object Storage (S3 API)<br/>Lưu trữ tệp ngoài ổ C (Ổ D)<br/>Kiểm tra Magic Bytes & SHA-256")]
    end

    WebAdmin -->|"HTTPS / JSON / JWT"| APIGateway
    MobileApp -->|"HTTPS / JSON / JWT"| APIGateway
    APIGateway --> AuthModule
    AuthModule --> DomainServices
    DomainServices --> OutboxWorker
    DomainServices -->|"SQLAlchemy 2.x Session (ACID)"| MSSQL
    DomainServices -->|"Băm SHA-256 / Stream Binary"| MinIOStorage
    OutboxWorker -->|"Ghi nhận sự kiện Outbox"| MSSQL
```

### 2.2. Mô hình quan hệ thực thể nghiệp vụ (Domain ERD)

```mermaid
erDiagram
    USERS ||--o{ AUTH_SESSIONS : "duy trì phiên"
    USERS ||--o{ AUDIT_LOGS : "thực hiện hành động"

    CUSTOMERS ||--o{ LAND_PURCHASE_CONTRACTS : "ký hợp đồng"
    DECEASED_PROFILES ||--o| DEATH_CERTIFICATES : "xác thực giấy tờ"
    CUSTOMERS ||--o{ DECEASED_PROFILES : "thân nhân liên hệ"

    ZONES ||--o{ PLOTS : "chứa các lô mộ"
    PLOTS ||--o{ PLOT_SLOTS : "chia các slot an táng"
    PLOTS ||--o{ PLOT_OWNERSHIPS : "lịch sử chủ sở hữu"
    PLOTS ||--o{ PLOT_RESERVATIONS : "giữ chỗ đặt cọc"

    LAND_PURCHASE_CONTRACTS ||--|| PLOTS : "mua quyền sử dụng"
    LAND_PURCHASE_CONTRACTS ||--o{ CONTRACT_ANNEXES : "phát sinh phụ lục"

    CONTRACT_ANNEXES ||--o| BURIAL_ANNEX_DETAILS : "an táng vào slot"
    CONTRACT_ANNEXES ||--o| EXHUMATION_DETAILS : "cải táng di dời"
    CONTRACT_ANNEXES ||--o| TRANSFER_DETAILS : "chuyển nhượng lô trống"
    CONTRACT_ANNEXES ||--o| CREMATION_DETAILS : "hỏa táng độc lập"

    CONTRACT_ANNEXES ||--o{ CONSTRUCTION_ORDERS : "lập lệnh thi công"
    CONSTRUCTION_ORDERS ||--o{ CONSTRUCTION_TASKS : "hạng mục checklist"
    CONSTRUCTION_TASKS ||--o{ CONSTRUCTION_TASK_EVIDENCES : "ảnh minh chứng"

    CONTRACT_ANNEXES ||--o{ CARE_SCHEDULES : "lịch chăm sóc định kỳ"
    CARE_SCHEDULES ||--o{ CARE_CHECKLIST_ITEMS : "công việc chăm sóc"
    CARE_SCHEDULES ||--o{ CARE_MEDIA_EVIDENCES : "ảnh nghiệm thu ca"

    LAND_PURCHASE_CONTRACTS ||--o{ RECEIVABLES : "phải thu hợp đồng"
    CONTRACT_ANNEXES ||--o{ RECEIVABLES : "phải thu phụ lục"

    RECEIVABLES ||--o{ PAYMENTS : "phiếu thu tiền lũy kế"
    RECEIVABLES ||--o{ DISCOUNT_RECORDS : "chiết khấu áp dụng"
    RECEIVABLES ||--o{ INVOICES : "hóa đơn biên lai xuất"

    FILE_OBJECTS ||--o{ CONSTRUCTION_TASK_EVIDENCES : "tệp ảnh hiện trường"
    FILE_OBJECTS ||--o{ CARE_MEDIA_EVIDENCES : "tệp ảnh chăm sóc"
    FILE_OBJECTS ||--o{ DEATH_CERTIFICATES : "bản scan chứng tử"
    FILE_OBJECTS ||--o{ INVOICES : "tệp PDF biên lai"
```

---

## 3. Các ràng buộc miền cốt lõi (Domain Invariants)

Hệ thống thiết lập các chốt chặn nghiêm ngặt đa tầng (CSDL Triggers, Constraints, SQLAlchemy ORM và FastAPI Services):

| Mã Invariant | Tên Ràng Buộc Miền | Cơ Chế Kiểm Soát Kỹ Thuật |
|---|---|---|
| **Kim Tĩnh Bất Biến** | Khóa vĩnh viễn mộ phần Kim Tĩnh | Một khi ô mộ được an táng theo hình thức Kim Tĩnh, cờ `is_kim_tinh = 1` và `is_locked = 1`. MSSQL Trigger `trg_plots_enforce_kim_tinh_immutability` chặn mọi hành vi UPDATE đổi cờ `is_locked` (Lỗi 51001), cải táng (Lỗi 51000) hoặc chuyển nhượng. |
| **G01** | Thu Hồi Phiên Tức Thì (RFC 6819) | Khi đăng xuất hoặc quản trị viên thu hồi quyền hạn, trường `auth_version` của tài khoản tăng lên, lập tức làm vô hiệu hóa toàn bộ Access Token của phiên làm việc đó (trả mã lỗi 401 Unauthorized ngay lập tức). |
| **G08** | Kiểm Soát Giấy Báo Tử Bắt Buộc | Tuyệt đối không cho phép kích hoạt phụ lục an táng hoặc hợp đồng hỏa táng khi người quá cố chưa có Giấy báo tử ở trạng thái `VERIFIED` kèm file scan MinIO hợp lệ. |
| **G09** | Khóa Trùng Bán & Giữ Chỗ Đất | Ngăn chặn hành vi hai nhân viên kinh doanh cùng bán hoặc giữ chỗ một ô mộ cùng thời điểm bằng khóa dòng CSDL `with_for_update` kết hợp Sequence sinh số hợp đồng `seq_contract_number`. |
| **G11** | Nghiệm Thu Thi Công Kèm Minh Chứng | Mọi hạng mục bắt buộc (`is_required`) trong công trình phải có ảnh hiện trường ở trạng thái `READY` trên MinIO trước khi chuyển sang `DONE`. Tiến độ bị chặn ở mức tối đa 99% nếu còn hạng mục bắt buộc chưa hoàn thành. |
| **G12** | Nghiệm Thu Đóng Ca Chăm Sóc | Chặn chuyển trạng thái lịch chăm sóc sang `CLOSED` nếu còn bất kỳ công việc bắt buộc nào chưa xong hoặc thiếu ảnh chụp nghiệm thu sau chăm sóc ở trạng thái `READY`. |
| **Bảo Toàn Trạng Thái An Táng** | Giữ nguyên hiện trạng sau xây dựng | Hoàn tất nghiệm thu thi công công trình KHÔNG BAO GIỜ tự ý đổi trạng thái ô mộ hoặc slot sang `OCCUPIED`. Ô mộ `UNDER_CONSTRUCTION` chỉ hoàn trả về `OWNED_EMPTY` (chưa có người mất) hoặc `OCCUPIED` (nếu đã có người an táng từ trước). |
| **G13** | Tránh Xung Đột Lịch Làm Việc | Khi phân công thợ thi công hoặc nhân viên chăm sóc hiện trường, hệ thống tự động đối chiếu với bảng `staff_unavailability` để phát hiện và cảnh báo trùng lịch nghỉ phép. |
| **G14** | Phân Định Nguồn Công Nợ (XOR Source) | Một khoản công nợ (`receivables`) chỉ được phép bắt nguồn từ duy nhất Hợp đồng chính HOẶC Phụ lục hợp đồng. Ràng buộc CSDL `ck_receivable_source_xor` bảo vệ: `(contract_id IS NOT NULL AND annex_id IS NULL) OR (contract_id IS NULL AND annex_id IS NOT NULL)`. |
| **G15** | Thu Tiền Lũy Kế & Chống Trùng Lặp | Ghi nhận thanh toán là bản ghi chỉ thêm (`append-only`). Chặn trùng giao dịch tuyệt đối dựa trên bảng `idempotency_requests` với cặp khóa duy nhất `(actor_id, operation_key)`. Số tiền thu không vượt quá số dư nợ còn lại. |
| **G16** | Chuẩn Hóa Chiết Khấu & Chặn Nợ Âm | Chiết khấu được phê duyệt theo chính sách chuẩn hóa, kiểm tra ràng buộc `discount_amount <= original_amount` và `final_payable_amount = original_amount - discount_amount`. Ngăn chặn mọi hành vi áp chiết khấu gây nợ âm sau khi khách đã thanh toán một phần (`final_payable_amount >= paid_amount`). |
| **Toàn Vẹn Số Học Tiền Tệ** | Cấm dùng số thực (Float) | Toàn bộ các giá trị tài chính sử dụng kiểu `DECIMAL(15,2)` trong SQL Server và lớp `Decimal` (`ROUND_HALF_UP`) trong Python. |

---

## 4. Quy trình nghiệp vụ cốt lõi

### 4.1. Vòng đời ô mộ và slot an táng

```mermaid
stateDiagram-v2
    [*] --> EMPTY_UNSOLD: Khởi tạo danh mục quy hoạch lô đất
    EMPTY_UNSOLD --> RESERVED: Giữ chỗ đặt cọc (Tối đa 7 ngày)
    RESERVED --> EMPTY_UNSOLD: Hết hạn cọc / Hủy đặt chỗ
    RESERVED --> OWNED_EMPTY: Kích hoạt hợp đồng mua đất thành công
    EMPTY_UNSOLD --> OWNED_EMPTY: Mua trực tiếp không qua đặt cọc
    
    OWNED_EMPTY --> UNDER_CONSTRUCTION: Lập lệnh thi công xây dựng kim tĩnh / mộ phần
    UNDER_CONSTRUCTION --> OWNED_EMPTY: Nghiệm thu hoàn tất xây dựng (Chưa an táng)
    
    OWNED_EMPTY --> OCCUPIED: Kích hoạt phụ lục an táng (Đã kiểm tra Giấy báo tử G08)
    UNDER_CONSTRUCTION --> OCCUPIED: Hoàn tất thi công trên ô mộ đã an táng từ trước
    
    state OCCUPIED {
        [*] --> Thuong: Mộ đất truyền thống
        [*] --> KimTinh: Kim Tĩnh kiên cố
        KimTinh --> LockedPermanent: Khóa vĩnh viễn (Trigger 51000/51001)
    }
    
    Thuong --> EXHUMED: Cải táng di dời (Giải phóng slot huyệt)
    EXHUMED --> OWNED_EMPTY: Slot trống hoàn toàn, quyền sử dụng đất giữ nguyên
    
    OWNED_EMPTY --> TRANSFERRED: Chuyển nhượng quyền sử dụng đất
    TRANSFERRED --> OWNED_EMPTY: Cập nhật chủ sở hữu mới (Chỉ áp dụng ô trống)
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
    API-->>App: Khởi tạo lệnh thi công thành công

    NV->>App: Tải ảnh minh chứng hiện trường (Đào móng / Bê tông)
    App->>API: POST /api/v1/documents/upload
    API->>S3: Stream tệp, băm SHA-256, chuyển trạng thái READY
    S3-->>API: file_id hợp lệ
    App->>API: POST /api/v1/construction/tasks/{task_id}/evidence
    API->>DB: Lưu bản ghi construction_task_evidences

    NV->>App: Cập nhật hạng mục sang DONE
    App->>API: PATCH /api/v1/construction/tasks/{task_id}
    API->>DB: Kiểm tra ảnh READY nếu task.is_required == True
    DB-->>API: Hợp lệ, cập nhật trạng thái hạng mục

    NV->>App: Nghiệm thu hoàn thành công trình
    App->>API: POST /api/v1/construction/orders/{order_id}/complete
    API->>DB: Kiểm tra: còn task bắt buộc chưa DONE -> Chặn lỗi 400
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
    API-->>App: Sinh thành công các ca chăm sóc không trùng lặp

    NV->>App: Nhận lịch ca trực & thực hiện việc hiện trường
    NV->>App: Đánh dấu hoàn thành checklist (Lau dọn, cắm hoa, thắp hương)
    App->>API: PATCH /api/v1/care/checklist/{item_id}
    API->>DB: Cập nhật is_done = True, completed_at, ghi chú

    NV->>App: Chụp ảnh hiện trường minh chứng hoàn tất
    App->>API: POST /api/v1/documents/upload
    API->>S3: Lưu tệp MinIO, tính SHA-256, chuyển trạng thái READY
    S3-->>API: file_id minh chứng
    App->>API: POST /api/v1/care/schedules/{schedule_id}/evidence
    API->>DB: Lưu care_media_evidences (loại AFTER_CARE)

    NV->>App: Gửi yêu cầu nghiệm thu đóng ca
    App->>API: POST /api/v1/care/schedules/{schedule_id}/close
    API->>DB: Kiểm tra invariant G12: Còn task is_required chưa xong hoặc thiếu ảnh READY?
    alt Thiếu điều kiện G12
        API-->>App: Lỗi 400 (Từ chối đóng ca do thiếu minh chứng hoặc việc bắt buộc)
    else Đủ điều kiện G12
        API->>DB: Đổi status = 'CLOSED', ghi nhận completed_by_id & completed_at
        API->>DB: Ghi OutboxEvent ('care.schedule.closed') & AuditLog
        API-->>App: Đóng ca thành công, hoàn tất nghĩa vụ chăm sóc
    end
```

### 4.4. Luồng kế toán công nợ, thu tiền lũy kế và xuất biên lai PDF (M11)

```mermaid
sequenceDiagram
    autonumber
    actor KT as Kế Toán / Thu Ngân
    participant App as Web / Mobile App
    participant API as FastAPI Finance Engine
    participant DB as SQL Server 2022
    participant S3 as MinIO Object Storage

    Note over KT,API: Ghi nhận thu tiền Idempotent & Tự động xuất biên lai
    KT->>App: Nhập phiếu thu (Số tiền, phương thức, Idempotency-Key)
    App->>API: POST /api/v1/finance/receivables/{id}/payments
    API->>DB: Kiểm tra IdempotencyRequest(user_id, 'payment', key)
    alt Đã tồn tại giao dịch trùng lặp
        DB-->>API: Trả về kết quả giao dịch trước đó (HTTP 200)
    else Giao dịch mới
        API->>DB: Khóa dòng khoản phải thu (with_for_update)
        API->>DB: Kiểm tra: amount <= remaining_balance (Lỗi 400 nếu vượt nợ)
        API->>DB: Sinh số phiếu thu PT-YYYYMM-NNNN từ Sequence
        API->>DB: Ghi bản ghi payments (Trigger CSDL tự đồng bộ paid_amount)
        API->>API: Tạo biên lai PDF tiếng Việt UTF-8 (ReportLab font Arial)
        API->>S3: Upload biên lai PDF lên MinIO, băm SHA-256, chuyển READY
        API->>DB: Tạo invoices & liên kết file_id biên lai
        API->>DB: Ghi OutboxEvent ('payment.recorded') & AuditLog
        API-->>App: Trả về Payment DTO kèm file_id biên lai PDF
    end
    App->>API: GET /api/v1/finance/payments/{payment_id}/receipt
    API-->>App: Stream tệp PDF biên lai thu tiền chính thức
```

---

## 5. Cấu trúc thư mục Monorepo

```
cemetery-management-system/
├── backend/                       # Nền tảng FastAPI backend (Python 3.12, uv)
│   ├── alembic/                   # Kịch bản di trú schema CSDL tăng dần (0001 -> 0012)
│   ├── app/
│   │   ├── core/                  # Cấu hình môi trường, bảo mật JWT, DB session, MinIO
│   │   ├── modules/               # Các phân hệ nghiệp vụ độc lập:
│   │   │   ├── auth/              # Xác thực, RBAC, quản lý phiên RFC 6819 (G01)
│   │   │   ├── catalog/           # Bảng giá, danh mục dịch vụ, gói chăm sóc (M04)
│   │   │   ├── plots/             # Bản đồ ô mộ, slot huyệt, khóa Kim Tĩnh (M05)
│   │   │   ├── profiles/          # Khách hàng, người mất, duyệt giấy báo tử (M06)
│   │   │   ├── contracts/         # Hợp đồng đất, an táng, cải táng, chuyển nhượng (M07-M08)
│   │   │   ├── construction/      # Quản lý thi công, checklist, bằng chứng ảnh (M09)
│   │   │   ├── care/              # Chăm sóc định kỳ, nghiệm thu đóng ca G12 (M10)
│   │   │   ├── finance/           # Công nợ XOR, thanh toán idempotent, chiết khấu, biên lai (M11)
│   │   │   ├── reports/           # 4 báo cáo thống kê, phòng chống formula injection, MinIO (M12)
│   │   │   ├── audit/             # Nhật ký kiểm toán chỉ đọc, redact sensitive secrets (M12)
│   │   │   ├── documents/         # Quản lý tệp MinIO, PDF tiếng Việt, báo cáo Excel (M03)
│   │   │   └── system/            # Health check, version, outbox, audit logs
│   │   ├── services/              # Dịch vụ hạ tầng: PDF ReportLab, Excel, Outbox
│   │   └── main.py                # Cấu hình FastAPI entry point & CORS
│   ├── runtime/                   # Dữ liệu cục bộ (MinIO data, logs, backups ngoài ổ C)
│   └── tests/                     # Bộ kiểm thử tự động toàn diện (82 test cases)
├── web/                           # Ứng dụng điều hành Web (React 19, TypeScript, pnpm)
│   ├── src/
│   │   ├── components/            # Giao diện nghiệp vụ: GIS Map, Hợp đồng, Thi công, Chăm sóc, Tài chính, Báo cáo, Kiểm toán
│   │   ├── context/               # Quản lý phiên xác thực AuthContext
│   │   ├── services/              # API Client tương tác với FastAPI
│   │   └── types/                 # TypeScript interfaces chuẩn hóa
│   └── package.json
├── mobile/                        # Ứng dụng di động hiện trường (Flutter 3.x, Dart 3.x)
│   ├── lib/                       # Giao diện Quản trang: Bản đồ mộ, Hợp đồng, Thi công, Chăm sóc, Tài chính
│   └── test/                      # Bộ kiểm thử Widget và luồng nghiệp vụ thực địa (14 tests)
├── docs/                          # Tài liệu kiến trúc và kế hoạch thực thi chi tiết
│   ├── EXECUTION_PLAN.md          # Kế hoạch chi tiết 15 cột mốc (M00 -> M14)
│   └── execution/STATE.md         # Nhật ký bằng chứng nghiệm thu từng cột mốc
└── scripts/                       # Kịch bản tự động hóa và cổng kiểm định chất lượng (Quality Gate)
```

---

## 6. Công nghệ sử dụng

| Phân hệ | Công nghệ chủ đạo | Công cụ quản lý | Ghi chú kỹ thuật |
|---|---|---|---|
| **Backend API** | Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2 | `uv` | Bất đồng bộ, MSSQL dialect, trigger bypass `implicit_returning=False`. |
| **Cơ sở dữ liệu** | Microsoft SQL Server 2022 | Native ODBC 18 | Phân định CSDL chính (`QL_NghiaTrang`) và kiểm thử (`QL_NghiaTrang_Test`). |
| **Di trú CSDL** | Alembic (0001 -> 0012) | `uv run alembic` | Quản lý schema tăng dần, tuyệt đối bảo tồn dữ liệu gốc, không DROP DATABASE. |
| **Lưu trữ đối tượng** | MinIO (S3 compatible) | Docker container | Bind mount trực tiếp vào `backend/runtime/minio/data` trên ổ D. |
| **Tài liệu PDF** | ReportLab với Font Arial Unicode | Python built-in | Xuất hợp đồng và biên lai thu tiền tiếng Việt UTF-8 chuẩn xác. |
| **Web Frontend** | React 19, TypeScript, Vite, Leaflet GIS | `pnpm` | Giao diện điều hành 4 trạng thái, bản đồ số ô mộ, xuất Excel/PDF. |
| **Mobile App** | Flutter 3.41.6, Dart 3.11.4 | Flutter SDK | Hỗ trợ 4 trạng thái giao diện ngoài trời, Riverpod state management. |
| **Kiểm tra chất lượng** | Ruff, Pytest, Oxlint, TypeScript compiler | Script tự động | Kịch bản `scripts/quality-gate.ps1` kiểm tra đồng bộ cả 3 phân hệ. |

---

## 7. Hướng dẫn cài đặt và khởi chạy

### 7.1. Yêu cầu môi trường

- Hệ điều hành: Windows 10/11 hoặc Linux
- Python: Phiên bản >= 3.12 (Khuyến nghị sử dụng trình quản lý `uv`)
- Node.js: Phiên bản >= 20.x, cài đặt trình quản lý gói `pnpm`
- Flutter SDK: Phiên bản stable (>= 3.27)
- Microsoft SQL Server 2022 kèm ODBC Driver 18 for SQL Server
- Docker Desktop (chạy MinIO container)

### 7.2. Thiết lập Backend

1. Di chuyển vào thư mục backend và cài đặt môi trường ảo:
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
   JWT_SECRET_KEY=your_secure_random_key_here
   ```

3. Áp dụng toàn bộ migrations lên bản mới nhất:
   ```powershell
   uv run alembic upgrade head
   ```

4. Khởi chạy máy chủ phát triển FastAPI:
   ```powershell
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

Tài liệu tương tác Swagger UI có sẵn tại: `http://localhost:8000/docs`

### 7.3. Thiết lập Web Frontend

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

### 7.4. Thiết lập Mobile App

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

## 8. Đảm bảo chất lượng (Quality Gate)

Dự án duy trì kỷ luật kiểm định tự động nghiêm ngặt trước mỗi commit và phát hành phiên bản. Để chạy toàn bộ kiểm tra chất lượng trên cả 3 phân hệ:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/quality-gate.ps1
```

Kết quả nghiệm thu tự động:
- **Backend:** `uv run ruff check .` và `uv run ruff format --check .` (0 lỗi cảnh báo), `uv run pytest` (**82/82 bài kiểm thử đạt 100%**).
- **Web Frontend:** `pnpm lint` (0 lỗi) và `pnpm build` (biên dịch TypeScript và đóng gói Vite sạch sẽ trong 265ms).
- **Mobile App:** `flutter analyze` (0 lỗi cảnh báo) và `flutter test` (**14/14 bài kiểm thử đạt 100%**).

---

## 9. Tiến độ thực thi dự án (Milestone Delivery)

| Milestone | Phân hệ / Nghiệp vụ | Phiên bản | Trạng thái |
|---|---|---|---|
| **M00** | Khảo sát, kiến trúc, kiểm tra ODBC 18 & baseline CSDL | `v0.1.0-baseline` | Hoàn thành |
| **M01** | Khởi tạo Monorepo, cấu hình MinIO ổ D, Shell 4 trạng thái | `v0.2.0-foundation` | Hoàn thành |
| **M02** | Baseline migration, SQLAlchemy ORM, RBAC & RFC 6819 | `v0.3.0-auth` | Hoàn thành |
| **M03** | Quản lý tệp MinIO, Magic Bytes, xuất PDF tiếng Việt UTF-8, Outbox | `v0.4.0-documents` | Hoàn thành |
| **M04** | Danh mục bảng giá dịch vụ, gói chăm sóc, biểu mẫu hợp đồng | `v0.5.0-design-catalog` | Hoàn thành |
| **M05** | Bản đồ GIS Leaflet, quản lý ô mộ, slot huyệt, khóa Kim Tĩnh | `v0.6.0-plots` | Hoàn thành |
| **M06** | Hồ sơ khách hàng, người quá cố, thẩm tra giấy báo tử | `v0.7.0-profiles` | Hoàn thành |
| **M07** | Quy trình hợp đồng mua đất, Sequence số HĐ, kích hoạt ACID | `v0.8.0-land-contracts` | Hoàn thành |
| **M08** | Vòng đời an táng, khóa Kim Tĩnh vĩnh viễn, cải táng, chuyển nhượng | `v0.9.0-domain-lifecycle` | Hoàn thành |
| **M09** | Quản lý thi công thực địa, checklist nhiệm vụ, bằng chứng ảnh MinIO | `v0.10.0-construction` | Hoàn thành |
| **M10** | Chăm sóc định kỳ mộ phần, đóng ca quản trang, hàng đợi offline | `v0.11.0-care` | Hoàn thành |
| **M11** | Kế toán công nợ XOR, thu tiền idempotent, chiết khấu, biên lai PDF | `v0.12.0-finance` | Hoàn thành |
| **M12** | Báo cáo quản trị, cổng tra cứu thông tin công khai Zero PII | `v0.13.0-feature-complete` | Hoàn thành |
| **M13** | Kiểm thử tải, bảo mật, đối soát phục hồi CSDL và S3 | `v1.0.0-rc.1` | Kế hoạch |
| **M14** | Đóng gói bản phát hành chính thức, tài liệu bàn giao vận hành | `v1.0.0` | Kế hoạch |

---

## 10. Bảo mật & Chính sách tuân thủ dữ liệu

1. **Tuyệt đối không lưu trữ khóa bí mật:** Các tệp `.env`, khóa ký số, mật khẩu CSDL không bao giờ được commit lên repository mã nguồn.
2. **Bảo vệ dữ liệu cá nhân:** Số định danh cá nhân (CCCD), số điện thoại và thông tin tài chính của khách hàng chỉ hiển thị cho nhân sự được cấp quyền tương ứng thông qua phân quyền RBAC.
3. **Cổng tra cứu công khai (Zero PII):** Giao diện tra cứu mộ phần dành cho cộng đồng chỉ hiển thị thông tin người quá cố (họ tên, năm sinh, năm mất) và tọa độ vị trí phần mộ, tuyệt đối không tiết lộ thông tin người mua, chi phí hay hợp đồng liên quan.
4. **Toàn vẹn tệp và lưu trữ:** Mọi tệp lưu trữ trên MinIO đều được kiểm tra chữ ký nhị phân đầu tệp (Magic Bytes) và băm mã SHA-256 để đảm bảo tính xác thực và chống giả mạo tài liệu.
