# Nhật Ký Thực Thi Dự Án (Project Execution State)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày cập nhật:** 03/10/2026  
**Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)

---

## 1. Trạng thái tổng quan

- **Milestone hiện tại:** Hoàn tất **M01** (Scaffold, runtime và storage) -> Chuẩn bị **M02** (Baseline migration, auth và phân quyền).
- **Trạng thái CSDL:**
  - Máy chủ: `DESKTOP-HKIPI1M`
  - CSDL: `QL_NghiaTrang`
  - 37 bảng nghiệp vụ + 2 triggers đã được đối chiếu chi tiết trong [`docs/db-baseline.json`](../db-baseline.json).
  - Kết nối native qua pyodbc và `ODBC Driver 18 for SQL Server` hoạt động 100%.
- **Hạ tầng lưu trữ:**
  - MinIO Docker Container (`elestio/minio:latest`) đang chạy trên máy.
  - Bind mount trực tiếp vào `D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data` trên ổ D.
  - Đã kiểm chứng tính bền vững dữ liệu: Upload -> Restart MinIO container -> Tải lại -> Kiểm tra SHA-256 khớp 100%.
- **Bộ công cụ & Chất lượng mã nguồn:**
  - Backend: Python 3.12, quản lý bằng `uv` (`pyproject.toml`, `uv.lock`). 4 tests passed, ruff clean.
  - Web: React 19 + TypeScript + Vite, quản lý bằng `pnpm` (`pnpm-lock.yaml`). Build thành công trong 549ms, 0 lint errors.
  - Mobile: Flutter 3.41.6 / Dart 3.11.4 Android, Riverpod, Dio, GoRouter. Analyze 0 issues, test passed.
  - Tiêu chuẩn Quality Gate (`scripts/quality-gate.ps1`) đạt 100% trên cả 3 phân hệ.

---

## 2. Bảng theo dõi tiến độ Milestones (M00 - M14)

| Milestone | Tên Milestone | Trạng thái | Tag Git | Ghi chú & Bằng chứng |
|---|---|---|---|---|
| **M00** | Khảo sát, công cụ & quyết định kiến trúc | **ĐẠT (Done)** | `v0.1.0-baseline` | Đã kiểm tra preflight, cài đặt ODBC 18, introspect CSDL (37 bảng), rà soát repo Manga, lập ADR-001, Gap Register, Toolchain Lock, AGENTS.md, Rules & Skills. |
| **M01** | Scaffold, runtime và storage | **ĐẠT (Done)** | `v0.2.0-foundation` | Monorepo hoàn chỉnh (`backend`, `web`, `mobile`, `scripts`). FastAPI readiness/liveness kiểm tra SQL + MinIO; MinIO bind mount ổ D bền vững; Web & Flutter shell 4 trạng thái; Quality gate 3 tier đạt. |
| **M02** | Baseline migration, auth & phân quyền | **Sắp thực hiện** | `v0.3.0-auth` | Baseline Alembic, session revoke G01, RBAC 4 vai trò, test bypass trigger. |
| **M03** | Tệp, job/outbox & chứng từ nền | Chưa bắt đầu | `v0.4.0-documents` | G02/G17, upload stream MinIO, PDF rendering tiếng Việt, outbox worker. |
| **M04** | Design system & cấu hình nền | Chưa bắt đầu | `v0.5.0-design-catalog` | Bảng giá G03, gói chăm sóc, template hợp đồng, UI components. |
| **M05** | Không gian, ô mộ, slot và bản đồ | Chưa bắt đầu | `v0.6.0-plots` | G04/G06, bản đồ Leaflet, quản lý khu/hàng/ô/slot, chống trùng giữ chỗ. |
| **M06** | Khách hàng, người mất & giấy báo tử | Chưa bắt đầu | `v0.7.0-profiles` | G07/G08, quản lý hồ sơ thân nhân, xác minh giấy báo tử. |
| **M07** | Luồng mua đất -> ký ngoài -> kích hoạt | Chưa bắt đầu | `v0.8.0-land-contracts` | G09, HĐ mua đất, giữ chỗ transaction-safe, scan và kích hoạt, sinh nợ. |
| **M08** | An táng, Kim Tĩnh, cải táng, chuyển nhượng | Chưa bắt đầu | `v0.9.0-domain-lifecycle` | G10/G18/G20, khóa Kim Tĩnh bất biến, chuyển nhượng, an táng, cải táng. |
| **M09** | Quản lý thi công thực địa | Chưa bắt đầu | `v0.10.0-construction` | G11/G13, checklist công trình, bằng chứng ảnh, phân công thợ. |
| **M10** | Chăm sóc định kỳ & mobile offline | Chưa bắt đầu | `v0.11.0-care` | G12, sinh lịch định kỳ, Quản trang đóng ca, offline queue retry. |
| **M11** | Công nợ, thu tiền, chiết khấu, biên lai | Chưa bắt đầu | `v0.12.0-finance` | G14-G16, Idempotency payment, tính nợ trigger-aware, biên lai PDF. |
| **M12** | Báo cáo, tra cứu công khai & audit | Chưa bắt đầu | `v0.13.0-feature-complete` | 4 báo cáo thống kê, cổng tra cứu không lộ PII, audit log viewer. |
| **M13** | Kiểm thử hệ thống, UX & khôi phục | Chưa bắt đầu | `v1.0.0-rc.1` | Regression toàn diện, test tải, backup/restore CSDL + S3 đối soát. |
| **M14** | Bàn giao và phát hành | Chưa bắt đầu | `v1.0.0` | Scripts vận hành, tài liệu bàn giao, APK thử nghiệm, release manifest. |

---

## 3. Bằng chứng nghiệm thu Milestone M01

- **Liveness & Readiness Endpoint:**
  - `GET /api/v1/health/live` -> 200 OK (`{"status":"live"}`)
  - `GET /api/v1/health/ready` -> 200 OK (`{"status":"ready","database":"Database connected","storage":"Storage connected"}`)
  - `GET /api/v1/version` -> 200 OK (`{"app_name":"Hệ thống Quản lý Nghĩa trang Tư nhân","version":"0.2.0","environment":"development"}`)
- **MinIO Storage Bind-Mount & Data Integrity:**
  - Container: `ql_nghiatrang_minio`
  - Mount Source: `D:\work\TH-PTTK\QL-NghiaTrang\backend\runtime\minio\data`
  - Mount Destination: `/data`
  - Persistence Check: Upload -> Restart MinIO container -> Download -> SHA-256 `1454bf8b1f5fefe4b7aecb496fac63a5bc1b2a976fafc5849883532d5b05c441` khớp hoàn hảo.
- **Tiêu chuẩn UI 4 trạng thái:**
  - Web và Flutter đều xử lý đầy đủ 4 trạng thái: Loading (shimmer/spinner), Normal (thẻ trạng thái API, MSSQL, MinIO), Empty Data, Error (kèm nút Thử lại).
