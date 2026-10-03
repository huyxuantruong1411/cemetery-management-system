# Nhật Ký Thực Thi Dự Án (Project Execution State)

**Dự án:** Hệ thống Quản lý Nghĩa trang Tư nhân  
**Ngày cập nhật:** 03/10/2026  
**Kế hoạch thực thi:** [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)

---

## 1. Trạng thái tổng quan

- **Milestone hiện tại:** Hoàn tất **M00** (Khảo sát, công cụ và quyết định kiến trúc) -> Chuyển sang **M01** (Scaffold, runtime và storage).
- **Trạng thái CSDL:**
  - Máy chủ: `DESKTOP-HKIPI1M`
  - CSDL: `QL_NghiaTrang`
  - 37 bảng nghiệp vụ + 2 triggers đã được đối chiếu chi tiết trong [`docs/db-baseline.json`](../db-baseline.json).
  - Không chạy lại script phá hủy CSDL `docs/source/lab4-sql.sql`.
- **Hạ tầng lưu trữ:**
  - Toàn bộ dữ liệu MinIO cục bộ sẽ lưu tại `backend/runtime/minio/data` trên ổ D (còn >87GB trống).
- **Bộ công cụ cốt lõi:**
  - Backend: Quản lý bằng `uv`, Python 3.12, SQLAlchemy 2.x + pyodbc + ODBC Driver 18.
  - Web: Quản lý bằng `pnpm`, React + TypeScript + Vite + Tailwind CSS + shadcn/ui.
  - Mobile: Flutter 3.41.6 (Dart 3.11.4) Android.

---

## 2. Bảng theo dõi tiến độ Milestones (M00 - M14)

| Milestone | Tên Milestone | Trạng thái | Tag Git dự kiến | Ghi chú & Bằng chứng |
|---|---|---|---|---|
| **M00** | Khảo sát, công cụ & quyết định kiến trúc | **ĐẠT (Done)** | `v0.1.0-baseline` | Đã kiểm tra preflight, cài đặt ODBC 18, introspect CSDL (37 bảng), rà soát repo Manga, lập ADR-001, Gap Register, Toolchain Lock, AGENTS.md, Rules & Skills. |
| **M01** | Scaffold, runtime và storage | **Sắp thực hiện** | `v0.2.0-foundation` | Khởi tạo cấu trúc monorepo (`backend`, `web`, `mobile`), dựng FastAPI readiness/liveness, MinIO bind mount trên ổ D, shell web & flutter. |
| **M02** | Baseline migration, auth & phân quyền | Chưa bắt đầu | `v0.3.0-auth` | Baseline Alembic, session revoke G01, RBAC 4 vai trò, test bypass trigger. |
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

## 3. Các quyết định kỹ thuật đã chốt tại M00

1. **CSDL MSSQL:** Giữ nguyên 37 bảng hiện có trên `DESKTOP-HKIPI1M`. Không tái tạo bằng `lab4-sql.sql`.
2. **ODBC Driver 18:** Đã cài đặt qua winget bản `18.6.2.1` x64/32-bit; kết nối kiểm thử bằng `uv run --with pyodbc python` trả về kết quả 38 bảng hoàn toàn chuẩn xác.
3. **Ổ đĩa lưu trữ:** Lưu trữ toàn bộ file runtime của MinIO tại `backend/runtime/minio/data` trên ổ D để tiết kiệm dung lượng ổ C.
4. **Package Managers:** Bắt buộc tuân thủ dùng `uv` cho backend Python và `pnpm` cho web React.
