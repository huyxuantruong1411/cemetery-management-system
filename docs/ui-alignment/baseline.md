# Ghi Nhận Baseline Kỹ Thuật & Môi Trường (Baseline Record)

- **Dự án:** Cemetery Management System (Hệ thống Quản lý Nghĩa trang Tư nhân)
- **Thời điểm rà soát:** 10/10/2026
- **Baseline Git Commit:** `9abf52098d91e767e9a1032567de6f5066429f90`
- **Nhánh thực thi:** `ui/lab-actor-alignment`
- **Mục tiêu:** Cải tiến giao diện và phân quyền theo chuẩn Actor và Lab1–Lab4 (theo `02_PLAN_ANTIGRAVITY_CAI_THIEN_GIAO_DIEN.md`)

---

## 1. Phiên bản công cụ phát triển (Toolchain Versions)

| Công cụ | Phiên bản thực tế | Trạng thái | Ghi chú |
|---|---|---|---|
| **OS** | Windows 11 / PowerShell | Khả dụng | Chạy trực tiếp native trên máy trạm |
| **Python** | 3.12.14 | Khả dụng | Quản lý độc quyền qua `uv` |
| **uv** | 0.11.11 | Khả dụng | Khóa môi trường bằng `uv.lock` |
| **Node.js** | v24.11.1 | Khả dụng | Quản lý gói web |
| **pnpm** | 12.4.2 | Khả dụng | Khóa môi trường bằng `pnpm-lock.yaml` |
| **Flutter** | 3.41.6 (channel stable) | Khả dụng | Quản lý gói mobile |
| **Dart** | 3.11.4 | Khả dụng | Dart SDK kèm Flutter |
| **SQL Server** | MSSQL on `DESKTOP-HKIPI1M` | Sẵn sàng | Driver: `ODBC Driver 18 for SQL Server` |
| **MinIO** | Docker container (`elestio/minio:latest`) | Sẵn sàng | Bind mount: `backend/runtime/minio/data` trên ổ D |

---

## 2. Trạng thái kiểm tra tĩnh và chất lượng mã nguồn hiện tại

1. **Backend (`backend/`):**
   - `uv run ruff check .` : **All checks passed!** (0 errors, 0 warnings).
   - Alembic revisions: 12 revisions hiện có, migration head là `0012_g17_report_exports`.
   - Cơ sở dữ liệu: 37 bảng nghiệp vụ + 12 bảng mở rộng đã được đồng bộ an toàn.
   - Trigger bảo vệ: `trg_plots_enforce_kim_tinh_immutability` và `trg_payments_sync_receivable_balance`.
2. **Web (`web/`):**
   - `pnpm lint` : 0 errors, 32 warnings (react hooks & pure components warnings).
   - `pnpm build` : Thành công (`dist/` tạo xong trong 15.58s).
3. **Mobile (`mobile/`):**
   - `flutter analyze` : **No issues found!** (ran in 7.1s).

---

## 3. Các phát hiện kiến trúc & giao diện cần giải quyết (UI01–UI26)

- **UI01:** Trang chủ lộ bảng trạng thái kỹ thuật (SQL Server / MinIO connection status) và RBAC Active Permissions cho khách vãng lai.
- **UI02:** Khách vãng lai thiếu cổng thông tin doanh nghiệp, tra cứu mộ và xem kết quả chăm sóc đã công bố.
- **UI03:** Điều hướng web dùng state `activeTab` đơn cấp thay vì URL routing có thể bookmark / reload / deep link.
- **UI04:** Quản trang được xem toàn bộ hợp đồng, báo cáo doanh thu, khách hàng và giá trị tiền.
- **UI05:** ADMIN bypass toàn bộ guard ở tầng auth dependency, kể cả các thao tác trái logic nghiệp vụ.
- **UI06:** Marketing thiếu luồng chuẩn bị hồ sơ → lập 4 loại HĐ → in bản giấy → ký ngoài hệ thống → đính kèm bản scan → kích hoạt.
- **UI07:** Chưa có DTO chuyên biệt phân quyền: API trả full model cho mọi vai trò rồi dùng frontend để ẩn trường.
- **UI08:** Quản trang bị gán mặc định là người trực tiếp làm tất cả công việc; thiếu phân tách giữa Quản trang phân công, Quản trang giám sát, và Người/Tổ/Nhà thầu bên ngoài thực hiện.
- **UI09:** Tài liệu hợp đồng PDF và chứng tử không được kiểm soát quyền chặt chẽ theo hồ sơ gốc.
- **UI10:** Kết quả chăm sóc mộ chưa có quy trình xét duyệt công bố (Zero PII, không lộ mặt người/biển số/giấy tờ nội bộ) cho thân nhân xem.

---

## 4. Danh sách tài liệu kiểm chứng đã thiết lập

1. [`traceability.csv`](traceability.csv): 39 hàng Use Case bám sát Lab1–Lab4.
2. [`actor-policy.md`](actor-policy.md): Ma trận phân quyền 5 nhóm Actor và chính sách Deny.
3. [`route-inventory.md`](route-inventory.md): Danh mục Routes Web & Mobile theo Actor.
4. [`decisions.md`](decisions.md): 12 quyết định kỹ thuật / nghiệp vụ D01–D12.
5. [`api-ui-contracts.md`](api-ui-contracts.md): Hợp đồng DTO & API theo ngữ cảnh vai trò.
6. [`acceptance.md`](acceptance.md): Bộ kịch bản nghiệm thu AT01–AT30.
