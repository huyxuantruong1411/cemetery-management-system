# Danh Mục Route & Phân Hệ (Route Inventory & Workspace Architecture)

- **Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân
- **Mục tiêu:** Thống kê đầy đủ cấu trúc URL trên Web và Mobile, đảm bảo mỗi Actor có trang mặc định và không gian làm việc độc lập.

---

## 1. Không gian công khai & Khách vãng lai (Public Portal)

| Mã màn hình | Route Web | Route Flutter | Trang mặc định | Capabilities | API phụ thuộc |
|---|---|---|:---:|---|---|
| **P01** | `/` | `/` | **Mặc định** | `memorial:public_lookup` | `GET /api/v1/profiles/public/memorials`, `GET /api/v1/plots/public/map` |
| **P02** | `/tra-cuu` | `/tra-cuu` | Không | `memorial:public_lookup` | `GET /api/v1/profiles/public/memorials` |
| **P03** | `/phan-mo/:publicId` | `/phan-mo/:publicId` | Không | `memorial:public_lookup` | `GET /api/v1/plots/public/{id}`, `GET /api/v1/care/public/{id}` |
| **P04** | `/huong-dan` | `/huong-dan` | Không | `public:read` | Thông tin tĩnh |
| **A01** | `/nhan-vien/dang-nhap` | `/dang-nhap` | Không | `auth:login` | `POST /api/v1/auth/login` |

---

## 2. Bàn làm việc Quản trang (Caretaker Workspace)

| Mã màn hình | Route Web | Route Flutter | Trang mặc định | Capabilities | API phụ thuộc |
|---|---|---|:---:|---|---|
| **Q01** | `/noi-bo/quan-trang` | `/field/dashboard` | **Mặc định** | `work_basis:read` | `GET /api/v1/construction/orders`, `GET /api/v1/care/schedules` |
| **Q02** | `/noi-bo/quan-trang/thi-cong/tiep-nhan` | `/field/construction/intake` | Không | `construction:coordinate` | `GET /api/v1/construction/work-basis`, `POST /api/v1/construction/orders` |
| **Q03** | `/noi-bo/quan-trang/thi-cong/:id/checklist` | `/field/construction/:id/checklist` | Không | `construction:coordinate` | `PUT /api/v1/construction/orders/{id}/tasks` |
| **Q04** | `/noi-bo/quan-trang/thi-cong/:id/phan-cong` | `/field/construction/:id/assign` | Không | `construction:coordinate` | `POST /api/v1/construction/tasks/{id}/assign` |
| **Q05** | `/noi-bo/quan-trang/thi-cong/:id/tien-do` | `/field/construction/:id/progress` | Không | `construction:coordinate` | `GET /api/v1/construction/orders/{id}`, `POST /verify` |
| **Q06** | `/noi-bo/quan-trang/cham-soc/lap-lich` | `/field/care/schedule` | Không | `care:coordinate` | `POST /api/v1/care/schedules/generate` |
| **Q07** | `/noi-bo/quan-trang/cham-soc/phan-cong` | `/field/care/assign` | Không | `care:coordinate` | `PATCH /api/v1/care/schedules/{id}/assign` |
| **Q08** | `/noi-bo/quan-trang/cham-soc/:id/dong-ca` | `/field/care/:id/close` | Không | `care:coordinate` | `POST /api/v1/care/schedules/{id}/close` |
| **Q09** | `/noi-bo/quan-trang/an-tang/xac-nhan` | `/field/burial/verify` | Không | `plots:burial_verify` | `POST /api/v1/plots/burial/confirm` |
| **Q10** | `/noi-bo/quan-trang/danh-ba-nhan-su` | `/field/workforce` | Không | `workforce:manage` | `GET /api/v1/workforce`, `POST /api/v1/workforce` |

---

## 3. Bàn làm việc Marketing & Kinh doanh (Marketing Workspace)

| Mã màn hình | Route Web | Route Flutter | Trang mặc định | Capabilities | API phụ thuộc |
|---|---|---|:---:|---|---|
| **M01** | `/noi-bo/marketing` | `/marketing/dashboard` | **Mặc định** | `customers:read`, `contracts:read` | `GET /api/v1/contracts/summary`, `GET /api/v1/customers` |
| **M02** | `/noi-bo/marketing/khach-hang` | `/marketing/customers` | Không | `customers:manage` | `GET /api/v1/customers`, `POST /api/v1/customers` |
| **M03** | `/noi-bo/marketing/nguoi-mat` | `/marketing/deceased` | Không | `deceased:manage` | `GET /api/v1/deceased`, `POST /api/v1/deceased` |
| **M04** | `/noi-bo/marketing/hop-dong` | `/marketing/contracts` | Không | `contracts:manage` | `GET /api/v1/contracts` |
| **M05** | `/noi-bo/marketing/hop-dong/tao-moi` | `/marketing/contracts/create` | Không | `contracts:manage` | `POST /api/v1/contracts` (4 loại) |
| **M06** | `/noi-bo/marketing/hop-dong/:id/in` | `/marketing/contracts/:id/print` | Không | `contracts:manage` | `GET /api/v1/contracts/{id}/print` |
| **M07** | `/noi-bo/marketing/hop-dong/:id/kich-hoat` | `/marketing/contracts/:id/activate` | Không | `contracts:manage` | `POST /api/v1/contracts/{id}/activate` |
| **M08** | `/noi-bo/marketing/hop-dong/:id/phu-luc` | `/marketing/contracts/:id/annex` | Không | `annexes:manage` | `POST /api/v1/contracts/{id}/annexes` |
| **M09** | `/noi-bo/marketing/hop-dong/:id/tien-do` | `/marketing/contracts/:id/progress` | Không | `contracts:read` | `GET /api/v1/contracts/{id}/progress` |
| **M10** | `/noi-bo/marketing/cham-soc/dang-ky` | `/marketing/care/register` | Không | `annexes:manage` | `POST /api/v1/contracts/{id}/annexes/care` |

---

## 4. Bàn làm việc Kế toán (Accountant Workspace)

| Mã màn hình | Route Web | Route Flutter | Trang mặc định | Capabilities | API phụ thuộc |
|---|---|---|:---:|---|---|
| **K01** | `/noi-bo/ke-toan` | `/finance/dashboard` | **Mặc định** | `finance_basis:read` | `GET /api/v1/finance/receivables`, `GET /api/v1/finance/summary` |
| **K02** | `/noi-bo/ke-toan/cong-no` | `/finance/receivables` | Không | `finance_basis:read` | `GET /api/v1/finance/receivables`, `POST /receivables` |
| **K03** | `/noi-bo/ke-toan/thu-tien` | `/finance/payments` | Không | `finance:collect` | `POST /api/v1/finance/payments` |
| **K04** | `/noi-bo/ke-toan/chiet-khau` | `/finance/discounts` | Không | `finance:discount` | `POST /api/v1/finance/discounts` |
| **K05** | `/noi-bo/ke-toan/bien-lai/:id` | `/finance/receipts/:id` | Không | `finance:collect` | `GET /api/v1/finance/receipts/{id}/pdf` |
| **K06** | `/noi-bo/ke-toan/bao-cao-doanh-thu` | `/finance/reports` | Không | `reports:revenue_read` | `GET /api/v1/reports/revenue`, `POST /export` |

---

## 5. Bàn làm việc Ban Quản trị / Sếp (Management Workspace)

| Mã màn hình | Route Web | Route Flutter | Trang mặc định | Capabilities | API phụ thuộc |
|---|---|---|:---:|---|---|
| **S01** | `/noi-bo/quan-ly` | `/admin/dashboard` | **Mặc định** | `audit:read`, `reports:revenue_read` | `GET /api/v1/reports/summary`, `GET /api/v1/audit/recent` |
| **S02** | `/noi-bo/quan-ly/quy-hoach` | `/admin/spatial` | Không | `spatial:manage` | `GET /api/v1/plots/tree`, `POST /api/v1/plots` |
| **S03** | `/noi-bo/quan-ly/ban-do-gps` | `/admin/map` | Không | `spatial:manage` | `GET /api/v1/plots/gis`, `PUT /api/v1/plots/{id}/gps` |
| **S04** | `/noi-bo/quan-ly/hop-dong-giam-sat` | `/admin/contracts` | Không | `contracts:read` | `GET /api/v1/contracts`, `GET /annexes` |
| **S05** | `/noi-bo/quan-ly/bao-cao-thong-ke` | `/admin/reports` | Không | `reports:all` | 4 endpoints báo cáo & xuất file MinIO |
| **S06** | `/noi-bo/quan-ly/tai-khoan` | `/admin/users` | Không | `accounts:manage` | `GET /api/v1/users`, `POST /api/v1/users` |
| **S07** | `/noi-bo/quan-ly/phan-quyen` | `/admin/roles` | Không | `accounts:manage` | `POST /api/v1/users/{id}/roles` |
| **S08** | `/noi-bo/quan-ly/danh-muc-bang-gia` | `/admin/catalog` | Không | `catalog:manage` | CRUD bảng giá, loại mộ, gói chăm sóc |
| **S09** | `/noi-bo/quan-ly/nhat-ky-kiem-toan` | `/admin/audit` | Không | `audit:read` | `GET /api/v1/audit` |

---

## 6. Màn hình bổ trợ dùng chung (Shared Common Screens)

- **A01:** `/nhan-vien/dang-nhap` (Đăng nhập Bearer JWT cho nhân sự nội bộ).
- **A02:** `/noi-bo/tai-khoan` (Thông tin cá nhân & đổi mật khẩu).
- **A03:** `/noi-bo/thong-bao` (Trung tâm thông báo & nhắc việc theo vai trò).
