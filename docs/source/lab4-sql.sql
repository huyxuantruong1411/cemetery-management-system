-- ============================================================================
-- HỆ THỐNG QUẢN LÝ NGHĨA TRANG TƯ NHÂN
-- Hệ quản trị CSDL: Microsoft SQL Server (T-SQL / SSMS)
-- Lưu trữ vật lý: D:\work\TH-PTTK\data\
-- ============================================================================

USE master;
GO

-- 1. KIỂM TRA VÀ XÓA DATABASE NẾU ĐÃ TỒN TẠI
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'QL_NghiaTrang')
BEGIN
    ALTER DATABASE QL_NghiaTrang SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE QL_NghiaTrang;
END
GO

-- 2. KHỞI TẠO CSDL VỚI CẤU HÌNH LƯU TRỮ VẬT LÝ CHUYÊN NGHIỆP
CREATE DATABASE QL_NghiaTrang
ON PRIMARY 
(
    NAME = N'QL_NghiaTrang_Data',
    FILENAME = N'D:\work\TH-PTTK\data\QL_NghiaTrang.mdf',
    SIZE = 50MB,                 -- Dung lượng khởi tạo ban đầu cho dữ liệu
    MAXSIZE = UNLIMITED,        -- Cho phép mở rộng linh hoạt theo dữ liệu thực tế
    FILEGROWTH = 16MB           -- Bước tăng trưởng dữ liệu ổn định, chống phân mảnh
)
LOG ON 
(
    NAME = N'QL_NghiaTrang_Log',
    FILENAME = N'D:\work\TH-PTTK\data\QL_NghiaTrang_log.ldf',
    SIZE = 20MB,                 -- Dung lượng file Transaction Log khởi tạo
    MAXSIZE = 2048MB,           -- Giới hạn log tối đa 2GB tránh tràn ổ cứng
    FILEGROWTH = 16MB           -- Bước tăng trưởng log
)
COLLATE SQL_Latin1_General_CP1_CI_AS; -- Tương thích tối ưu cho ứng dụng và tìm kiếm
GO

USE QL_NghiaTrang;
GO

-- ============================================================================
-- PHÂN HỆ 1: QUẢN TRỊ NGƯỜI DÙNG & PHÂN QUYỀN (RBAC)
-- ============================================================================

CREATE TABLE roles (
    role_id INT IDENTITY(1,1) CONSTRAINT PK_roles PRIMARY KEY,
    role_name NVARCHAR(50) NOT NULL CONSTRAINT UQ_roles_name UNIQUE, -- 'ADMIN', 'MARKETING', 'ACCOUNTANT', 'CARETAKER'
    description NVARCHAR(255) NULL
);
GO

CREATE TABLE permissions (
    permission_id INT IDENTITY(1,1) CONSTRAINT PK_permissions PRIMARY KEY,
    permission_code VARCHAR(100) NOT NULL CONSTRAINT UQ_permissions_code UNIQUE,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL
);
GO

CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),
    CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    CONSTRAINT FK_role_permissions_perm FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);
GO

CREATE TABLE users (
    user_id INT IDENTITY(1,1) CONSTRAINT PK_users PRIMARY KEY,
    username VARCHAR(50) NOT NULL CONSTRAINT UQ_users_username UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name NVARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
    phone_number VARCHAR(20) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT 1,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    CONSTRAINT PK_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);
GO

-- ============================================================================
-- PHÂN HỆ 2: BẢNG GIÁ THEO THỜI KỲ (PRICE LIST & ITEMS)
-- ============================================================================

CREATE TABLE price_lists (
    price_list_id INT IDENTITY(1,1) CONSTRAINT PK_price_lists PRIMARY KEY,
    price_list_name NVARCHAR(100) NOT NULL,
    effective_from_date DATE NOT NULL,
    effective_to_date DATE NULL,
    is_active BIT NOT NULL CONSTRAINT DF_price_lists_active DEFAULT 1,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_price_lists_created DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE price_items (
    item_id INT IDENTITY(1,1) CONSTRAINT PK_price_items PRIMARY KEY,
    price_list_id INT NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    item_name NVARCHAR(150) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL CONSTRAINT CK_price_items_price CHECK (unit_price >= 0),
    unit NVARCHAR(30) NOT NULL, -- m2, huyệt, ca, trọn gói...
    CONSTRAINT UQ_price_items_code UNIQUE (price_list_id, item_code),
    CONSTRAINT FK_price_items_list FOREIGN KEY (price_list_id) REFERENCES price_lists(price_list_id) ON DELETE CASCADE
);
GO

-- ============================================================================
-- PHÂN HỆ 3: KHÁCH HÀNG, NGƯỜI MẤT & GIẤY BÁO TỬ
-- ============================================================================

CREATE TABLE customers (
    customer_id INT IDENTITY(1,1) CONSTRAINT PK_customers PRIMARY KEY,
    customer_code VARCHAR(30) NOT NULL CONSTRAINT UQ_customers_code UNIQUE,
    full_name NVARCHAR(100) NOT NULL,
    citizen_id VARCHAR(20) NOT NULL CONSTRAINT UQ_customers_citizen_id UNIQUE, -- CCCD duy nhất
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    address NVARCHAR(255) NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_customers_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_customers_updated DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE deceased_profiles (
    deceased_id INT IDENTITY(1,1) CONSTRAINT PK_deceased_profiles PRIMARY KEY,
    deceased_code VARCHAR(30) NOT NULL CONSTRAINT UQ_deceased_code UNIQUE,
    full_name NVARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL CONSTRAINT CK_deceased_gender CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    date_of_birth DATE NULL,
    date_of_death DATE NOT NULL,
    hometown NVARCHAR(255) NULL,
    religion NVARCHAR(50) NULL,
    has_death_certificate BIT NOT NULL CONSTRAINT DF_deceased_has_cert DEFAULT 0,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_deceased_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_deceased_updated DEFAULT SYSUTCDATETIME()
);
GO

-- Giấy báo tử: Căn cứ pháp lý bắt buộc để duyệt chôn cất
CREATE TABLE death_certificates (
    cert_id INT IDENTITY(1,1) CONSTRAINT PK_death_certificates PRIMARY KEY,
    deceased_id INT NOT NULL CONSTRAINT UQ_death_cert_deceased UNIQUE,
    certificate_number NVARCHAR(50) NOT NULL,
    issuing_authority NVARCHAR(150) NOT NULL,
    issue_date DATE NOT NULL,
    scan_file_url VARCHAR(500) NOT NULL,
    is_verified BIT NOT NULL CONSTRAINT DF_death_cert_verified DEFAULT 1,
    verified_at DATETIME2(3) NOT NULL CONSTRAINT DF_death_cert_verified_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_death_cert_deceased FOREIGN KEY (deceased_id) REFERENCES deceased_profiles(deceased_id)
);
GO

-- Mối liên kết Khách hàng - Người mất
CREATE TABLE customer_deceased_relations (
    relation_id INT IDENTITY(1,1) CONSTRAINT PK_cust_deceased_relations PRIMARY KEY,
    customer_id INT NOT NULL,
    deceased_id INT NOT NULL,
    relationship_type NVARCHAR(50) NOT NULL, -- Cha con, vợ chồng, đại diện thân nhân...
    is_primary_contact BIT NOT NULL CONSTRAINT DF_cust_dec_primary DEFAULT 0,
    CONSTRAINT UQ_cust_deceased UNIQUE (customer_id, deceased_id),
    CONSTRAINT FK_relation_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    CONSTRAINT FK_relation_deceased FOREIGN KEY (deceased_id) REFERENCES deceased_profiles(deceased_id) ON DELETE CASCADE
);
GO

-- ============================================================================
-- PHÂN HỆ 4: KHÔNG GIAN, Ô MỘ & BẢN ĐỒ SỐ (GIS)
-- ============================================================================

CREATE TABLE zones (
    zone_id INT IDENTITY(1,1) CONSTRAINT PK_zones PRIMARY KEY,
    zone_code VARCHAR(20) NOT NULL CONSTRAINT UQ_zones_code UNIQUE,
    zone_name NVARCHAR(100) NOT NULL,
    total_rows INT NOT NULL CONSTRAINT DF_zones_total_rows DEFAULT 0,
    description NVARCHAR(255) NULL
);
GO

CREATE TABLE rows (
    row_id INT IDENTITY(1,1) CONSTRAINT PK_rows PRIMARY KEY,
    zone_id INT NOT NULL,
    row_code VARCHAR(20) NOT NULL,
    total_plots INT NOT NULL CONSTRAINT DF_rows_total_plots DEFAULT 0,
    CONSTRAINT UQ_zone_row UNIQUE (zone_id, row_code),
    CONSTRAINT FK_rows_zone FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE CASCADE
);
GO

CREATE TABLE plot_types (
    type_id INT IDENTITY(1,1) CONSTRAINT PK_plot_types PRIMARY KEY,
    type_name NVARCHAR(100) NOT NULL CONSTRAINT UQ_plot_types_name UNIQUE,
    default_slots INT NOT NULL CONSTRAINT CK_plot_types_slots CHECK (default_slots > 0),
    length DECIMAL(5, 2) NOT NULL,
    width DECIMAL(5, 2) NOT NULL,
    description NVARCHAR(255) NULL
);
GO

CREATE TABLE plots (
    plot_id INT IDENTITY(1,1) CONSTRAINT PK_plots PRIMARY KEY,
    plot_code VARCHAR(30) NOT NULL CONSTRAINT UQ_plots_code UNIQUE,
    row_id INT NOT NULL,
    type_id INT NOT NULL,
    owner_id INT NULL,                      -- Khách hàng đang sở hữu quyền sử dụng đất
    latitude DECIMAL(10, 8) NULL,           -- Tọa độ GPS phục vụ Google Maps/Mobile
    longitude DECIMAL(11, 8) NULL,
    status VARCHAR(30) NOT NULL CONSTRAINT DF_plots_status DEFAULT 'EMPTY_UNSOLD'
        CONSTRAINT CK_plots_status CHECK (status IN (
            'EMPTY_UNSOLD',         -- Đất trống chưa bán
            'RESERVED',             -- Đang tạm giữ chỗ
            'OWNED_EMPTY',          -- Đất trống đã có chủ (chờ an táng hoặc sau cải táng)
            'UNDER_CONSTRUCTION',   -- Đang thi công huyệt/kim tĩnh/xây mộ
            'OCCUPIED',             -- Đã chôn cất (an táng)
            'UNDER_EXHUMATION'      -- Đang tiến hành bóc mộ/cải táng
        )),
    
    -- CÁC CỜ QUY TẮC BẤT BIẾN KIM TĨNH
    is_kim_tinh BIT NOT NULL CONSTRAINT DF_plots_kim_tinh DEFAULT 0,
    is_locked BIT NOT NULL CONSTRAINT DF_plots_locked DEFAULT 0, -- Khóa vĩnh viễn khi Kim Tĩnh đã chôn
    
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_plots_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_plots_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_plots_row FOREIGN KEY (row_id) REFERENCES rows(row_id),
    CONSTRAINT FK_plots_type FOREIGN KEY (type_id) REFERENCES plot_types(type_id),
    CONSTRAINT FK_plots_owner FOREIGN KEY (owner_id) REFERENCES customers(customer_id)
);
GO

CREATE TABLE plot_slots (
    slot_id INT IDENTITY(1,1) CONSTRAINT PK_plot_slots PRIMARY KEY,
    plot_id INT NOT NULL,
    slot_number INT NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_plot_slots_status DEFAULT 'EMPTY'
        CONSTRAINT CK_plot_slots_status CHECK (status IN ('EMPTY', 'OCCUPIED')),
    current_deceased_id INT NULL,
    CONSTRAINT UQ_plot_slot UNIQUE (plot_id, slot_number),
    CONSTRAINT FK_plot_slots_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id) ON DELETE CASCADE,
    CONSTRAINT FK_plot_slots_deceased FOREIGN KEY (current_deceased_id) REFERENCES deceased_profiles(deceased_id)
);
GO

-- Lưu vết lịch sử an táng / bóc mộ (Bảo toàn lịch sử ô đất)
CREATE TABLE burial_histories (
    history_id INT IDENTITY(1,1) CONSTRAINT PK_burial_histories PRIMARY KEY,
    plot_id INT NOT NULL,
    slot_id INT NULL,
    deceased_id INT NOT NULL,
    action_type VARCHAR(20) NOT NULL CONSTRAINT CK_burial_action CHECK (action_type IN ('BURIED', 'EXHUMED')),
    action_date DATE NOT NULL,
    proof_url VARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_burial_histories_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_burial_hist_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
    CONSTRAINT FK_burial_hist_slot FOREIGN KEY (slot_id) REFERENCES plot_slots(slot_id),
    CONSTRAINT FK_burial_hist_deceased FOREIGN KEY (deceased_id) REFERENCES deceased_profiles(deceased_id)
);
GO

-- ============================================================================
-- PHÂN HỆ 5: HỢP ĐỒNG (4 LOẠI CỐT LÕI) & PHỤ LỤC
-- ============================================================================

-- Bảng hợp đồng cha (Base Contract)
CREATE TABLE contracts (
    contract_id INT IDENTITY(1,1) CONSTRAINT PK_contracts PRIMARY KEY,
    contract_code VARCHAR(50) NOT NULL CONSTRAINT UQ_contracts_code UNIQUE,
    contract_type VARCHAR(30) NOT NULL CONSTRAINT CK_contracts_type CHECK (contract_type IN (
        'LAND_PURCHASE', 'EXHUMATION', 'CREMATION', 'TRANSFER'
    )),
    customer_id INT NOT NULL,
    status VARCHAR(30) NOT NULL CONSTRAINT DF_contracts_status DEFAULT 'DRAFT'
        CONSTRAINT CK_contracts_status CHECK (status IN (
            'DRAFT', 'PENDING_SIGN', 'ACTIVE', 'CANCELLED', 'TRANSFERRED'
        )),
    total_amount DECIMAL(15, 2) NOT NULL CONSTRAINT DF_contracts_total DEFAULT 0.00
        CONSTRAINT CK_contracts_total CHECK (total_amount >= 0),
    signed_scan_url VARCHAR(500) NULL, -- Điều kiện bắt buộc để chuyển ACTIVE
    created_by_user_id INT NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_contracts_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_contracts_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_contracts_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT FK_contracts_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);
GO

-- 1. Hợp đồng chuyên biệt: Mua đất nghĩa trang
CREATE TABLE land_purchase_contracts (
    contract_id INT CONSTRAINT PK_land_purchase_contracts PRIMARY KEY,
    plot_id INT NOT NULL,
    land_unit_price DECIMAL(15, 2) NOT NULL,
    CONSTRAINT FK_lpc_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    CONSTRAINT FK_lpc_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
);
GO

-- 2. Hợp đồng chuyên biệt: Cải táng (Bóc mộ)
CREATE TABLE exhumation_contracts (
    contract_id INT CONSTRAINT PK_exhumation_contracts PRIMARY KEY,
    plot_id INT NOT NULL,
    current_deceased_id INT NOT NULL,
    exhumation_date DATE NOT NULL,
    exhumation_fee DECIMAL(15, 2) NOT NULL,
    reason NVARCHAR(MAX) NULL,
    CONSTRAINT FK_exh_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    CONSTRAINT FK_exh_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
    CONSTRAINT FK_exh_deceased FOREIGN KEY (current_deceased_id) REFERENCES deceased_profiles(deceased_id)
);
GO

-- 3. Hợp đồng chuyên biệt: Hỏa táng
CREATE TABLE cremation_contracts (
    contract_id INT CONSTRAINT PK_cremation_contracts PRIMARY KEY,
    deceased_id INT NOT NULL,
    cremation_date DATETIME2(3) NOT NULL,
    package_service_code VARCHAR(50) NOT NULL,
    urn_storage_option NVARCHAR(100) NULL,
    service_fee DECIMAL(15, 2) NOT NULL,
    CONSTRAINT FK_crem_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    CONSTRAINT FK_crem_deceased FOREIGN KEY (deceased_id) REFERENCES deceased_profiles(deceased_id)
);
GO

-- 4. Hợp đồng chuyên biệt: Chuyển nhượng đất nghĩa trang
CREATE TABLE transfer_contracts (
    contract_id INT CONSTRAINT PK_transfer_contracts PRIMARY KEY,
    plot_id INT NOT NULL,
    seller_id INT NOT NULL, -- Chủ cũ
    buyer_id INT NOT NULL,  -- Chủ mới
    commission_fee DECIMAL(15, 2) NOT NULL CONSTRAINT DF_trans_commission DEFAULT 0.00,
    CONSTRAINT CK_diff_transfer_parties CHECK (seller_id <> buyer_id),
    CONSTRAINT FK_trans_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    CONSTRAINT FK_trans_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
    CONSTRAINT FK_trans_seller FOREIGN KEY (seller_id) REFERENCES customers(customer_id),
    CONSTRAINT FK_trans_buyer FOREIGN KEY (buyer_id) REFERENCES customers(customer_id)
);
GO

-- Bảng phụ lục cha (Base Contract Annex)
CREATE TABLE contract_annexes (
    annex_id INT IDENTITY(1,1) CONSTRAINT PK_contract_annexes PRIMARY KEY,
    annex_code VARCHAR(50) NOT NULL CONSTRAINT UQ_annexes_code UNIQUE,
    contract_id INT NOT NULL,
    annex_type VARCHAR(30) NOT NULL CONSTRAINT CK_annexes_type CHECK (annex_type IN (
        'BURIAL', 'CARE', 'CONSTRUCTION'
    )),
    status VARCHAR(30) NOT NULL CONSTRAINT DF_annexes_status DEFAULT 'DRAFT'
        CONSTRAINT CK_annexes_status CHECK (status IN (
            'DRAFT', 'PENDING_SIGN', 'ACTIVE', 'COMPLETED', 'CANCELLED'
        )),
    additional_amount DECIMAL(15, 2) NOT NULL CONSTRAINT DF_annexes_amount DEFAULT 0.00
        CONSTRAINT CK_annexes_amount CHECK (additional_amount >= 0),
    signed_scan_url VARCHAR(500) NULL,
    valid_from DATE NULL,
    valid_to DATE NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_annexes_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_annexes_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_annexes_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE
);
GO

-- Phụ lục chuyên biệt: An táng (Chôn cất trên đất đã mua)
CREATE TABLE burial_annexes (
    annex_id INT CONSTRAINT PK_burial_annexes PRIMARY KEY,
    deceased_id INT NOT NULL,
    plot_id INT NOT NULL,
    slot_id INT NULL,
    burial_date DATETIME2(3) NOT NULL,
    is_kim_tinh BIT NOT NULL CONSTRAINT DF_burial_annex_kim_tinh DEFAULT 0,
    construction_notes NVARCHAR(MAX) NULL,
    CONSTRAINT FK_ba_annex FOREIGN KEY (annex_id) REFERENCES contract_annexes(annex_id) ON DELETE CASCADE,
    CONSTRAINT FK_ba_deceased FOREIGN KEY (deceased_id) REFERENCES deceased_profiles(deceased_id),
    CONSTRAINT FK_ba_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
    CONSTRAINT FK_ba_slot FOREIGN KEY (slot_id) REFERENCES plot_slots(slot_id)
);
GO

-- Phụ lục chuyên biệt: Gói dịch vụ chăm sóc định kỳ
CREATE TABLE care_annexes (
    annex_id INT CONSTRAINT PK_care_annexes PRIMARY KEY,
    package_id INT NOT NULL,
    cycle_months INT NOT NULL CONSTRAINT DF_care_annex_cycle DEFAULT 12,
    recurring_price DECIMAL(15, 2) NOT NULL,
    CONSTRAINT FK_ca_annex FOREIGN KEY (annex_id) REFERENCES contract_annexes(annex_id) ON DELETE CASCADE
);
GO

-- Phụ lục chuyên biệt: Thi công xây dựng mộ
CREATE TABLE construction_annexes (
    annex_id INT CONSTRAINT PK_construction_annexes PRIMARY KEY,
    plot_id INT NOT NULL,
    estimated_start_date DATE NOT NULL,
    estimated_end_date DATE NOT NULL,
    checklist_specifications NVARCHAR(MAX) NULL,
    CONSTRAINT FK_csa_annex FOREIGN KEY (annex_id) REFERENCES contract_annexes(annex_id) ON DELETE CASCADE,
    CONSTRAINT FK_csa_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
);
GO

-- ============================================================================
-- PHÂN HỆ 6: QUẢN LÝ VẬN HÀNH THI CÔNG & CHĂM SÓC
-- ============================================================================

-- Phân hệ thi công
CREATE TABLE construction_orders (
    order_id INT IDENTITY(1,1) CONSTRAINT PK_construction_orders PRIMARY KEY,
    annex_id INT NOT NULL,
    plot_id INT NOT NULL,
    supervisor_id INT NOT NULL, -- Quản trang giám sát
    start_date DATE NULL,
    expected_end_date DATE NOT NULL,
    actual_end_date DATE NULL,
    overall_progress DECIMAL(5, 2) NOT NULL CONSTRAINT DF_co_progress DEFAULT 0.00
        CONSTRAINT CK_co_progress CHECK (overall_progress BETWEEN 0 AND 100),
    status VARCHAR(20) NOT NULL CONSTRAINT DF_co_status DEFAULT 'PENDING'
        CONSTRAINT CK_co_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE')),
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_co_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_co_annex FOREIGN KEY (annex_id) REFERENCES contract_annexes(annex_id) ON DELETE CASCADE,
    CONSTRAINT FK_co_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
    CONSTRAINT FK_co_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(user_id)
);
GO

CREATE TABLE construction_tasks (
    task_id INT IDENTITY(1,1) CONSTRAINT PK_construction_tasks PRIMARY KEY,
    order_id INT NOT NULL,
    task_name NVARCHAR(150) NOT NULL,
    assigned_team_or_contractor NVARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_ct_status DEFAULT 'TODO'
        CONSTRAINT CK_ct_status CHECK (status IN ('TODO', 'DOING', 'DONE')),
    proof_media_url VARCHAR(500) NULL,
    field_notes NVARCHAR(MAX) NULL,
    completed_at DATETIME2(3) NULL,
    CONSTRAINT FK_ct_order FOREIGN KEY (order_id) REFERENCES construction_orders(order_id) ON DELETE CASCADE
);
GO

-- Danh mục gói chăm sóc mộ mẫu
CREATE TABLE care_packages (
    package_id INT IDENTITY(1,1) CONSTRAINT PK_care_packages PRIMARY KEY,
    package_code VARCHAR(30) NOT NULL CONSTRAINT UQ_care_pack_code UNIQUE,
    package_name NVARCHAR(100) NOT NULL,
    cycle_type VARCHAR(20) NOT NULL CONSTRAINT CK_care_cycle CHECK (cycle_type IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
    default_tasks_json NVARCHAR(MAX) NOT NULL CONSTRAINT CK_care_tasks_json CHECK (ISJSON(default_tasks_json) > 0),
    unit_price DECIMAL(15, 2) NOT NULL CONSTRAINT CK_care_price CHECK (unit_price >= 0),
    is_active BIT NOT NULL CONSTRAINT DF_care_pack_active DEFAULT 1
);
GO

-- Bổ sung Khóa ngoại từ care_annexes tới care_packages
ALTER TABLE care_annexes
ADD CONSTRAINT FK_care_annex_package
FOREIGN KEY (package_id) REFERENCES care_packages(package_id);
GO

-- Lịch trình thực hiện ca chăm sóc
CREATE TABLE care_schedules (
    schedule_id INT IDENTITY(1,1) CONSTRAINT PK_care_schedules PRIMARY KEY,
    care_annex_id INT NOT NULL,
    plot_id INT NOT NULL,
    package_id INT NOT NULL,
    caretaker_id INT NULL, -- Nhân viên thực địa phụ trách
    scheduled_date DATE NOT NULL,
    performed_date DATE NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_cs_status DEFAULT 'SCHEDULED'
        CONSTRAINT CK_cs_status CHECK (status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED', 'OVERDUE')),
    closed_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_cs_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cs_annex FOREIGN KEY (care_annex_id) REFERENCES care_annexes(annex_id) ON DELETE CASCADE,
    CONSTRAINT FK_cs_plot FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
    CONSTRAINT FK_cs_package FOREIGN KEY (package_id) REFERENCES care_packages(package_id),
    CONSTRAINT FK_cs_caretaker FOREIGN KEY (caretaker_id) REFERENCES users(user_id)
);
GO

CREATE TABLE care_checklist_items (
    item_id INT IDENTITY(1,1) CONSTRAINT PK_care_checklist_items PRIMARY KEY,
    schedule_id INT NOT NULL,
    task_description NVARCHAR(255) NOT NULL,
    is_completed BIT NOT NULL CONSTRAINT DF_ccl_completed DEFAULT 0,
    field_notes NVARCHAR(MAX) NULL,
    CONSTRAINT FK_ccl_schedule FOREIGN KEY (schedule_id) REFERENCES care_schedules(schedule_id) ON DELETE CASCADE
);
GO

CREATE TABLE care_media_evidences (
    evidence_id INT IDENTITY(1,1) CONSTRAINT PK_care_media_evidences PRIMARY KEY,
    schedule_id INT NOT NULL,
    media_url VARCHAR(500) NOT NULL,
    uploaded_at DATETIME2(3) NOT NULL CONSTRAINT DF_cme_uploaded DEFAULT SYSUTCDATETIME(),
    caption NVARCHAR(255) NULL, -- 'Ảnh toàn cảnh trước khi dọn', 'Ảnh bia mộ sau khi thắp hương'...
    CONSTRAINT FK_cme_schedule FOREIGN KEY (schedule_id) REFERENCES care_schedules(schedule_id) ON DELETE CASCADE
);
GO

-- ============================================================================
-- PHÂN HỆ 7: TÀI CHÍNH, CÔNG NỢ, CHIẾT KHẤU & HÓA ĐƠN
-- ============================================================================

CREATE TABLE receivables (
    receivable_id INT IDENTITY(1,1) CONSTRAINT PK_receivables PRIMARY KEY,
    contract_id INT NULL,
    annex_id INT NULL,
    customer_id INT NOT NULL,
    original_amount DECIMAL(15, 2) NOT NULL CONSTRAINT CK_rec_orig CHECK (original_amount >= 0),
    discount_amount DECIMAL(15, 2) NOT NULL CONSTRAINT DF_rec_discount DEFAULT 0.00
        CONSTRAINT CK_rec_disc CHECK (discount_amount >= 0),
    final_payable_amount DECIMAL(15, 2) NOT NULL CONSTRAINT CK_rec_final CHECK (final_payable_amount >= 0),
    total_paid_amount DECIMAL(15, 2) NOT NULL CONSTRAINT DF_rec_paid DEFAULT 0.00
        CONSTRAINT CK_rec_paid CHECK (total_paid_amount >= 0),
    status VARCHAR(20) NOT NULL CONSTRAINT DF_rec_status DEFAULT 'UNPAID'
        CONSTRAINT CK_rec_status CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
    due_date DATE NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_rec_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_receivable_source CHECK (contract_id IS NOT NULL OR annex_id IS NOT NULL),
    CONSTRAINT FK_rec_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    CONSTRAINT FK_rec_annex FOREIGN KEY (annex_id) REFERENCES contract_annexes(annex_id) ON DELETE NO ACTION,
    CONSTRAINT FK_rec_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
GO

CREATE TABLE discount_records (
    discount_id INT IDENTITY(1,1) CONSTRAINT PK_discount_records PRIMARY KEY,
    receivable_id INT NOT NULL CONSTRAINT UQ_discount_receivable UNIQUE,
    discount_type VARCHAR(20) NOT NULL CONSTRAINT CK_disc_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    discount_value DECIMAL(10, 2) NOT NULL,
    calculated_amount DECIMAL(15, 2) NOT NULL CONSTRAINT CK_disc_calc CHECK (calculated_amount >= 0),
    justification_reason NVARCHAR(MAX) NOT NULL, -- Lý do giảm trừ bắt buộc
    approved_by_user_id INT NOT NULL,
    applied_at DATETIME2(3) NOT NULL CONSTRAINT DF_disc_applied DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_disc_receivable FOREIGN KEY (receivable_id) REFERENCES receivables(receivable_id) ON DELETE CASCADE,
    CONSTRAINT FK_disc_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id)
);
GO

CREATE TABLE payments (
    payment_id INT IDENTITY(1,1) CONSTRAINT PK_payments PRIMARY KEY,
    receivable_id INT NOT NULL,
    paid_amount DECIMAL(15, 2) NOT NULL CONSTRAINT CK_pay_amount CHECK (paid_amount > 0),
    payment_method VARCHAR(20) NOT NULL CONSTRAINT CK_pay_method CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'VIET_QR')),
    transaction_reference VARCHAR(100) NULL,
    paid_at DATETIME2(3) NOT NULL CONSTRAINT DF_pay_paid_at DEFAULT SYSUTCDATETIME(),
    recorded_by_user_id INT NOT NULL,
    CONSTRAINT FK_pay_receivable FOREIGN KEY (receivable_id) REFERENCES receivables(receivable_id),
    CONSTRAINT FK_pay_recorder FOREIGN KEY (recorded_by_user_id) REFERENCES users(user_id)
);
GO

CREATE TABLE invoices (
    invoice_id INT IDENTITY(1,1) CONSTRAINT PK_invoices PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL CONSTRAINT UQ_invoices_number UNIQUE,
    payment_id INT NOT NULL CONSTRAINT UQ_invoices_payment UNIQUE,
    issued_date DATETIME2(3) NOT NULL CONSTRAINT DF_inv_issued DEFAULT SYSUTCDATETIME(),
    total_amount_in_words NVARCHAR(255) NOT NULL,
    pdf_file_url VARCHAR(500) NOT NULL,
    CONSTRAINT FK_inv_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
);
GO

-- ============================================================================
-- PHÂN HỆ 8: NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT LOG - BẤT BIẾN)
-- ============================================================================

CREATE TABLE audit_logs (
    log_id BIGINT IDENTITY(1,1) CONSTRAINT PK_audit_logs PRIMARY KEY,
    user_id INT NULL,
    action_type VARCHAR(50) NOT NULL,   -- 'INSERT', 'UPDATE', 'DELETE', 'SIGN_ACTIVATE'
    target_entity VARCHAR(50) NOT NULL, -- 'plots', 'contracts', 'receivables'
    target_id VARCHAR(50) NOT NULL,
    pre_change_values NVARCHAR(MAX) NULL CONSTRAINT CK_audit_pre_json CHECK (pre_change_values IS NULL OR ISJSON(pre_change_values) > 0),
    post_change_values NVARCHAR(MAX) NULL CONSTRAINT CK_audit_post_json CHECK (post_change_values IS NULL OR ISJSON(post_change_values) > 0),
    ip_address VARCHAR(45) NULL,
    timestamp DATETIME2(3) NOT NULL CONSTRAINT DF_audit_timestamp DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
GO

-- ============================================================================
-- 9. TỐI ƯU TRUY VẤN: INDEXES (BẢN ĐỒ GPS, HỢP ĐỒNG, TÀI CHÍNH)
-- ============================================================================

CREATE NONCLUSTERED INDEX IX_plots_coordinates ON plots(latitude, longitude);
CREATE NONCLUSTERED INDEX IX_plots_status ON plots(status);
CREATE NONCLUSTERED INDEX IX_plots_owner ON plots(owner_id);
CREATE NONCLUSTERED INDEX IX_customers_citizen_id ON customers(citizen_id);
CREATE NONCLUSTERED INDEX IX_customers_phone ON customers(phone_number);
CREATE NONCLUSTERED INDEX IX_deceased_name ON deceased_profiles(full_name);
CREATE NONCLUSTERED INDEX IX_contracts_customer ON contracts(customer_id);
CREATE NONCLUSTERED INDEX IX_contracts_status ON contracts(status);
CREATE NONCLUSTERED INDEX IX_annexes_contract ON contract_annexes(contract_id);
CREATE NONCLUSTERED INDEX IX_annexes_valid_to ON contract_annexes(valid_to);
CREATE NONCLUSTERED INDEX IX_receivables_due ON receivables(due_date, status);
CREATE NONCLUSTERED INDEX IX_care_schedules_date ON care_schedules(scheduled_date, status);
CREATE NONCLUSTERED INDEX IX_audit_logs_target ON audit_logs(target_entity, target_id);
GO

-- ============================================================================
-- 10. TRIGGERS T-SQL XỬ LÝ QUY TẮC NGHIỆP VỤ BẮT BUỘC
-- ============================================================================

-- Trigger 1: BẢO VỆ MỘ KIM TĨNH BẤT BIẾN (Business Rules BR1 - Module 1 & 3)
-- Nghiêm cấm bóc dỡ, cải táng hoặc gỡ bỏ cờ khóa khi mộ Kim Tĩnh đã chôn cất
CREATE OR ALTER TRIGGER trg_plots_enforce_kim_tinh_immutability
ON plots
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra 1: Mộ đang bị khóa (is_locked = 1) mà cố tình đổi sang cải táng
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        JOIN deleted d ON i.plot_id = d.plot_id
        WHERE d.is_locked = 1 AND i.status = 'UNDER_EXHUMATION'
    )
    BEGIN
        THROW 51000, N'LỖI NGHIỆP VỤ [BR-KIMTINH]: Ô mộ xây kết cấu Kim Tĩnh đã kiên cố vĩnh viễn, nghiêm cấm lập thủ tục bóc mộ/cải táng!', 1;
    END

    -- Kiểm tra 2: Mộ đang bị khóa mà cố tình can thiệp gỡ cờ khóa (is_locked chuyển từ 1 về 0)
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        JOIN deleted d ON i.plot_id = d.plot_id
        WHERE d.is_locked = 1 AND i.is_locked = 0
    )
    BEGIN
        THROW 51001, N'LỖI BẢO MẬT: Cơ chế khóa vĩnh viễn của mộ Kim Tĩnh không được phép gỡ bỏ!', 1;
    END

    -- Kiểm tra 3: Tự động kích hoạt is_locked = 1 khi mộ Kim Tĩnh hoàn tất an táng (status = OCCUPIED)
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        WHERE i.is_kim_tinh = 1 AND i.status = 'OCCUPIED' AND i.is_locked = 0
    )
    BEGIN
        UPDATE p
        SET p.is_locked = 1
        FROM plots p
        JOIN inserted i ON p.plot_id = i.plot_id
        WHERE i.is_kim_tinh = 1 AND i.status = 'OCCUPIED';
    END
END;
GO

-- Trigger 2: TỰ ĐỘNG CẤN TRỪ CÔNG NỢ & CẬP NHẬT TRẠNG THÁI KHOẢN THU (Module 6)
CREATE OR ALTER TRIGGER trg_payments_sync_receivable_balance
ON payments
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Cập nhật tổng tiền đã thanh toán và trạng thái nợ của khoản phải thu
    WITH PaymentAgg AS (
        SELECT 
            p.receivable_id, 
            SUM(p.paid_amount) AS total_paid
        FROM payments p
        WHERE p.receivable_id IN (SELECT DISTINCT receivable_id FROM inserted)
        GROUP BY p.receivable_id
    )
    UPDATE r
    SET 
        r.total_paid_amount = pa.total_paid,
        r.status = CASE 
            WHEN pa.total_paid >= r.final_payable_amount THEN 'PAID'
            WHEN pa.total_paid > 0 THEN 'PARTIALLY_PAID'
            ELSE r.status
        END
    FROM receivables r
    JOIN PaymentAgg pa ON r.receivable_id = pa.receivable_id;
END;
GO

PRINT N'=== KHỞI TẠO CƠ SỞ DỮ LIỆU QL_NghiaTrang THÀNH CÔNG TẠI D:\work\TH-PTTK\data\ ===';
GO