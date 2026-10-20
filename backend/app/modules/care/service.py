import calendar
import json
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.care.models import (
    CareAnnex,
    CareChecklistItem,
    CareMediaEvidence,
    CarePackage,
    CareSchedule,
)
from app.modules.care.schemas import (
    CareAnnexRegisterRequest,
    CareChecklistItemBrief,
    CareChecklistItemCreate,
    CareMediaEvidenceBrief,
    CareScheduleDetail,
)
from app.modules.construction.models import StaffUnavailability
from app.modules.contracts.models import Contract, ContractAnnex
from app.modules.documents.models import FileObject
from app.modules.jobs.service import OutboxService
from app.modules.plots.models import Plot, Row

# =============================================================================
# MODULE QUẢN LÝ DỊCH VỤ CHĂM SÓC MỘ PHẦN ĐỊNH KỲ (CARE SERVICE)
# =============================================================================
# Module này quản lý toàn diện quy trình cung cấp dịch vụ chăm sóc mộ định kỳ:
# 1. Hợp đồng & Phụ lục chăm sóc (Care Annex): Gắn với hợp đồng mua đất hoặc chuyển nhượng.
# 2. Sinh lịch định kỳ tự động (Batch Schedule Generation - G12):
#    - Tự động sinh lịch chăm sóc hàng tháng cho các phụ lục đang ACTIVE.
#    - Đảm bảo tính Idempotent: Chạy nhiều lần trong cùng 1 kỳ không sinh trùng lặp.
#    - Quy tắc neo ngày cuối tháng (End-of-Month Anchor): Xử lý chuẩn xác các tháng có 28, 29, 30, 31 ngày.
# 3. Phân công nhân sự & Kiểm tra xung đột (Staff Allocation & Conflict Prevention - G13):
#    - Ngăn chặn phân công nhân viên quản trang khi có lịch nghỉ/bận (StaffUnavailability).
# 4. Cổng nghiệm thu đóng ca nghiêm ngặt (Quality Gate G12 - R06):
#    - Bắt buộc hoàn tất 100% các hạng mục checklist bắt buộc (is_required=True).
#    - Bắt buộc có ít nhất 1 ảnh minh chứng hiện trường ở trạng thái 'READY' trên MinIO.
#    - Đóng băng vĩnh viễn dữ liệu sau khi đóng ca để bảo toàn tính toàn vẹn pháp lý.
# =============================================================================


class CareService:
    @staticmethod
    def calculate_anchored_date(year: int, month: int, anchor_day: int) -> date:
        """
        [QUY TẮC NEO NGÀY CUỐI THÁNG - END-OF-MONTH ANCHOR RULE (G12)]
        
        Nghiệp vụ:
        - Khách hàng ký phụ lục chăm sóc ngày 31/01.
        - Vào tháng 2 (chỉ có 28 hoặc 29 ngày), hệ thống tự động lùi về ngày cuối tháng (28 hoặc 29).
        - Tuy nhiên, sang tháng 3 (có 31 ngày), hệ thống vẫn giữ nguyên ngày neo gốc là 31,
          chứ không bị trôi vĩnh viễn về ngày 28.
        """
        max_day = calendar.monthrange(year, month)[1]
        target_day = min(anchor_day, max_day)
        return date(year, month, target_day)

    @classmethod
    def generate_schedules_for_period(
        cls,
        db: Session,
        year: int,
        month: int,
        care_annex_id: Optional[int] = None,
    ) -> Tuple[str, int, int, List[CareSchedule]]:
        """
        [SINH LỊCH CHĂM SÓC ĐỊNH KỲ TỰ ĐỘNG - G12]
        
        Quy trình xử lý:
        1. Xác định kỳ chăm sóc dạng chuỗi (period_key = 'YYYY-Mmm', ví dụ: '2026-M03').
        2. Quét toàn bộ Phụ lục Chăm sóc (CareAnnex) có phụ lục cha đang ở trạng thái 'ACTIVE'
           và khoảng thời gian hiệu lực bao trùm tháng cần sinh lịch.
        3. Kiểm tra tính Idempotent: Nếu lịch của phụ lục trong kỳ này đã được sinh trước đó,
           bỏ qua không tạo lại (chạy lại 10 lần cũng ra cùng 1 kết quả).
        4. Tính ngày chăm sóc dự kiến theo thuật toán neo ngày cuối tháng (calculate_anchored_date).
        5. Sao chép danh sách công việc tiêu chuẩn từ Gói chăm sóc (CarePackage) sang
           các hạng mục checklist chi tiết của ca làm việc (CareChecklistItem).
        """
        period_key = f"{year:04d}-M{month:02d}"
        first_day_of_month = date(year, month, 1)
        last_day_of_month = date(year, month, calendar.monthrange(year, month)[1])

        # 1. Truy vấn các phụ lục chăm sóc ACTIVE có thời hạn bao trùm tháng này
        query = (
            db.query(CareAnnex)
            .join(ContractAnnex, CareAnnex.annex_id == ContractAnnex.annex_id)
            .join(Contract, ContractAnnex.contract_id == Contract.contract_id)
            .filter(
                ContractAnnex.status == "ACTIVE",
                ContractAnnex.valid_from <= last_day_of_month,
                ContractAnnex.valid_to >= first_day_of_month,
            )
        )
        if care_annex_id:
            query = query.filter(CareAnnex.annex_id == care_annex_id)

        care_annexes = query.all()

        generated_schedules: List[CareSchedule] = []
        skipped_count = 0

        for ca in care_annexes:
            annex = ca.annex
            contract = annex.contract
            plot_id = None
            if contract.land_purchase:
                plot_id = contract.land_purchase.plot_id
            elif contract.transfer:
                plot_id = contract.transfer.plot_id

            # Nếu không tìm thấy ô đất liên kết với hợp đồng -> bỏ qua
            if not plot_id:
                skipped_count += 1
                continue

            # 2. Kiểm tra Idempotency: Không sinh trùng lặp lịch trong cùng một kỳ chăm sóc
            existing = (
                db.query(CareSchedule)
                .filter(
                    CareSchedule.care_annex_id == ca.annex_id,
                    CareSchedule.period_key == period_key,
                )
                .first()
            )
            if existing:
                skipped_count += 1
                continue

            # 3. Tính ngày chăm sóc định kỳ theo quy tắc neo ngày cuối tháng
            anchor_day = annex.valid_from.day
            scheduled_date = cls.calculate_anchored_date(year, month, anchor_day)

            # Ràng buộc: Ngày chăm sóc phải nằm nghiêm ngặt trong khoảng hiệu lực của phụ lục
            if scheduled_date < annex.valid_from or scheduled_date > annex.valid_to:
                skipped_count += 1
                continue

            # 4. Lấy danh sách đầu việc mặc định từ gói dịch vụ (hoặc dùng template chuẩn nếu thiếu)
            pkg = db.query(CarePackage).filter(CarePackage.package_id == ca.package_id).first()
            tasks_list = []
            if pkg and pkg.default_tasks_json:
                try:
                    tasks_list = json.loads(pkg.default_tasks_json)
                except Exception:
                    tasks_list = []

            if not tasks_list:
                tasks_list = [
                    "Dọn cỏ dại và rác xung quanh khuôn viên",
                    "Lau chùi bia mộ và bát nhang",
                    "Thắp hương hoa định kỳ",
                    "Kiểm tra hiện trạng đá ốp và vết nứt kết cấu",
                ]

            # 5. Khởi tạo bản ghi ca chăm sóc ở trạng thái SCHEDULED (chờ phân công/thực hiện)
            schedule = CareSchedule(
                care_annex_id=ca.annex_id,
                plot_id=plot_id,
                package_id=ca.package_id,
                caretaker_id=None,
                scheduled_date=scheduled_date,
                status="SCHEDULED",
                period_key=period_key,
                notes=f"Kỳ chăm sóc {period_key} theo gói {pkg.package_name if pkg else 'Tiêu chuẩn'}",
            )
            db.add(schedule)
            db.flush()

            # 6. Khởi tạo danh sách các hạng mục kiểm tra chi tiết (Checklist Items)
            for idx, task_name in enumerate(tasks_list):
                item = CareChecklistItem(
                    schedule_id=schedule.schedule_id,
                    task_description=task_name,
                    is_required=True,  # Mặc định các công việc trong gói là bắt buộc
                    sort_order=idx + 1,
                    is_completed=False,
                )
                db.add(item)

            generated_schedules.append(schedule)

        db.commit()
        return period_key, len(generated_schedules), skipped_count, generated_schedules

    # =======================================================================
    # PHÂN CÔNG QUẢN TRANG & CHỐNG TRÙNG LỊCH (G13)
    # =======================================================================

    @staticmethod
    def assign_caretaker(
        db: Session,
        schedule_id: int,
        caretaker_id: int,
        current_user_id: int,
    ) -> Tuple[CareSchedule, bool, Optional[str]]:
        """
        Phân công nhân viên quản trang thực hiện ca chăm sóc mộ.
        
        Kiểm tra nghiệp vụ nghiêm ngặt:
        1. Ca chăm sóc đã đóng (CLOSED) thì bị đóng băng, cấm đổi nhân sự.
        2. Khóa dòng User trên SQL Server: Sử dụng WITH (UPDLOCK, HOLDLOCK) để tránh tranh chấp dữ liệu.
        3. Phân quyền (RBAC): Chỉ nhân sự có vai trò CARETAKER hoặc ADMIN mới được phân công.
        4. Kiểm tra xung đột lịch công tác (G13 Conflict Check):
           Tra cứu bảng StaffUnavailability xem nhân viên có đăng ký nghỉ phép hoặc bận công tác
           trùng vào ngày chăm sóc (scheduled_date) hay không. Nếu trùng -> Ném HTTP 409 Conflict.
        5. Ghi Audit Log hành động phân công.
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        if schedule.status == "CLOSED":
            raise HTTPException(status_code=400, detail="Ca đã đóng, không thể đổi người phụ trách.")

        # Khóa dòng chống xung đột đồng thời khi cập nhật trạng thái nhân viên
        user = (
            db.query(User)
            .with_hint(User, "WITH (UPDLOCK, HOLDLOCK)", dialect_name="mssql")
            .filter(User.user_id == caretaker_id, User.is_active == True)  # noqa: E712
            .first()
        )
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên quản trang")
        if not any(r.role_name in ("CARETAKER", "ADMIN") for r in user.roles):
            raise HTTPException(status_code=400, detail="Hãy chọn nhân viên quản trang để phân công.")

        # G13 Conflict Warning Check: Ngăn chặn phân công người đang nghỉ phép/bận
        conflict = (
            db.query(StaffUnavailability)
            .filter(
                StaffUnavailability.user_id == caretaker_id,
                StaffUnavailability.start_date <= schedule.scheduled_date,
                StaffUnavailability.end_date >= schedule.scheduled_date,
            )
            .first()
        )

        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Xung đột lịch làm việc: Nhân viên {user.full_name} có lịch nghỉ/bận từ {conflict.start_date} đến {conflict.end_date} (Lý do: {conflict.reason})",
            )

        schedule.caretaker_id = caretaker_id
        db.commit()
        db.refresh(schedule)

        # Ghi vết kiểm toán (Audit Log)
        audit = AuditLog(
            user_id=current_user_id,
            action_type="ASSIGN_CARETAKER",
            target_entity="care_schedules",
            target_id=str(schedule.schedule_id),
            post_change_values=json.dumps({"caretaker_id": caretaker_id, "has_conflict": False}),
        )
        db.add(audit)
        db.commit()

        return schedule, False, None

    # =======================================================================
    # CHECKLIST CÔNG VIỆC HIỆN TRƯỜNG & MINH CHỨNG HÌNH ẢNH
    # =======================================================================

    @staticmethod
    def update_checklist_item(
        db: Session,
        item_id: int,
        is_completed: Optional[bool],
        field_notes: Optional[str],
        user_id: int,
    ) -> CareChecklistItem:
        """
        Cập nhật trạng thái một đầu việc trong danh sách kiểm tra (Checklist).
        
        Quy tắc:
        - Ca đã đóng (CLOSED) thì cấm sửa đổi checklist.
        - Khi nhân viên bắt đầu tick công việc, nếu ca đang SCHEDULED -> tự động đổi sang IN_PROGRESS.
        """
        item = db.query(CareChecklistItem).filter(CareChecklistItem.item_id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Không tìm thấy hạng mục công việc")

        schedule = item.schedule
        if schedule and schedule.status == "CLOSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ca đã đóng, không thể sửa danh sách công việc.",
            )

        if is_completed is not None:
            item.is_completed = is_completed
        if field_notes is not None:
            item.field_notes = field_notes

        # Tự động chuyển ca sang IN_PROGRESS khi có tương tác đầu tiên
        if schedule and schedule.status == "SCHEDULED":
            schedule.status = "IN_PROGRESS"

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def add_checklist_item(
        db: Session,
        schedule_id: int,
        data: CareChecklistItemCreate,
        user_id: int,
    ) -> CareChecklistItem:
        """
        Quản trang tạo thêm đầu việc phát sinh vào danh sách kiểm tra (Checklist) của ca chăm sóc.
        - Đánh dấu is_custom = True để phân biệt với các đầu việc tiêu chuẩn theo phụ lục khách hàng.
        - Ca đã đóng (CLOSED, COMPLETED) hoặc đã hủy (CANCELLED) thì không thể thêm mới.
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ca chăm sóc")

        if schedule.status in ("CLOSED", "COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ca chăm sóc đang ở trạng thái {schedule.status}, không thể thêm công việc mới.",
            )

        max_order = (
            db.query(func.coalesce(func.max(CareChecklistItem.sort_order), 0))
            .filter(CareChecklistItem.schedule_id == schedule_id)
            .scalar()
            or 0
        )

        item = CareChecklistItem(
            schedule_id=schedule_id,
            task_description=data.task_description.strip(),
            is_completed=False,
            field_notes=data.field_notes,
            is_required=data.is_required,
            sort_order=max_order + 1,
            is_custom=True,
        )
        db.add(item)
        if schedule.status == "SCHEDULED":
            schedule.status = "IN_PROGRESS"

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete_checklist_item(
        db: Session,
        schedule_id: int,
        item_id: int,
        user_id: int,
    ) -> None:
        """
        Xóa một đầu việc trong danh sách kiểm tra (Checklist).

        RÀNG BUỘC NGHIỆP VỤ BẮT BUỘC:
        - Quản trang chỉ được phép xóa các đầu việc do quản trang tự tạo thêm (is_custom = True).
        - TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA các đầu việc tiêu chuẩn được đổ từ phụ lục hợp đồng của khách hàng (is_custom = False).
        - Ca đã đóng (CLOSED) không được phép xóa công việc.
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ca chăm sóc")

        if schedule.status in ("CLOSED", "COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ca chăm sóc đang ở trạng thái {schedule.status}, không thể xóa công việc.",
            )

        item = (
            db.query(CareChecklistItem)
            .filter(
                CareChecklistItem.item_id == item_id,
                CareChecklistItem.schedule_id == schedule_id,
            )
            .first()
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy hạng mục công việc trong ca chăm sóc này",
            )

        # Chốt chặn nghiệp vụ bất biến: Không xóa công việc theo phụ lục khách hàng
        if not item.is_custom:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không được phép xóa hạng mục công việc tiêu chuẩn thuộc phụ lục của khách hàng. Quản trang chỉ có thể xóa các hạng mục do quản trang tự tạo thêm.",
            )

        db.delete(item)
        db.commit()


    @staticmethod
    def add_media_evidence(
        db: Session,
        schedule_id: int,
        file_id: Optional[str],
        media_url: Optional[str],
        caption: Optional[str],
        user_id: int,
    ) -> CareMediaEvidence:
        """
        Tải lên và đính kèm ảnh minh chứng hiện trường ca chăm sóc mộ.
        
        Kiểm tra tính toàn vẹn và bảo mật:
        - Ca chăm sóc đã CLOSED thì không cho phép bổ sung ảnh mới.
        - Tệp phải tồn tại trong bảng FileObject và đã ở trạng thái 'READY' (đã upload xong lên MinIO).
        - MIME type bắt buộc phải là hình ảnh (JPEG, PNG, WEBP).
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        if schedule.status == "CLOSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ca chăm sóc đã đóng, không thể thêm ảnh minh chứng mới.",
            )

        if not file_id:
            raise HTTPException(
                status_code=400,
                detail="Vui lòng tải lên ảnh minh chứng.",
            )

        # Gate Check: Kiểm tra tệp lưu trữ trên MinIO
        file_obj = db.query(FileObject).filter(FileObject.file_id == file_id).first()
        if not file_obj:
            raise HTTPException(status_code=404, detail="Không tìm thấy tệp lưu trữ")
        if file_obj.state != "READY":
            raise HTTPException(
                status_code=400,
                detail="Ảnh chưa tải lên xong. Vui lòng thử lại.",
            )
        if not file_obj.mime_type or not file_obj.mime_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ảnh minh chứng chăm sóc phải là tệp hình ảnh hợp lệ (JPEG, PNG, WEBP).",
            )

        evidence = CareMediaEvidence(
            schedule_id=schedule_id,
            file_id=file_id,
            media_url=media_url or f"/api/v1/documents/{file_id}/preview",
            caption=caption,
            uploaded_by_user_id=user_id,
            uploaded_at=datetime.now(timezone.utc),
        )
        db.add(evidence)

        if schedule.status == "SCHEDULED":
            schedule.status = "IN_PROGRESS"

        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def delete_media_evidence(
        db: Session,
        schedule_id: int,
        evidence_id: int,
        user_id: int,
    ) -> None:
        """
        Xóa ảnh minh chứng hiện trường (có cơ chế đóng băng chống gian lận).
        
        Quy tắc bất biến:
        - Một khi ca chăm sóc đã đóng ('CLOSED'), toàn bộ hình ảnh minh chứng bị khóa vĩnh viễn,
          ngăn ngừa tuyệt đối việc thay thế hoặc tiêu hủy hồ sơ bàn giao với gia đình.
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        # Đóng băng minh chứng khi ca chăm sóc đã hoàn tất
        if schedule.status == "CLOSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ca chăm sóc này đã được xác nhận hoàn tất/đóng ca. Toàn bộ ảnh minh chứng đã bị khóa vĩnh viễn, không thể chỉnh sửa hoặc xóa.",
            )

        evidence = (
            db.query(CareMediaEvidence)
            .filter(
                CareMediaEvidence.evidence_id == evidence_id,
                CareMediaEvidence.schedule_id == schedule_id,
            )
            .first()
        )
        if not evidence:
            raise HTTPException(status_code=404, detail="Ảnh minh chứng không tồn tại")

        db.delete(evidence)
        db.commit()

    # =======================================================================
    # CỔNG NGHIỆM THU ĐÓNG CA CHĂM SÓC (QUALITY GATE G12)
    # =======================================================================

    @staticmethod
    def close_schedule(
        db: Session,
        schedule_id: int,
        field_notes: Optional[str],
        current_user_id: int,
    ) -> CareSchedule:
        """
        [CỔNG KIỂM SOÁT ĐÓNG CA CHĂM SÓC - QUALITY GATE G12]
        
        Điều kiện tiên quyết bắt buộc để đóng ca (Chặn 100% nếu thiếu):
        1. Invariant 1 (Checklist Gate): Tất cả hạng mục bắt buộc (is_required=True)
           phải được đánh dấu hoàn tất (is_completed=True).
        2. Invariant 2 (Media Evidence Gate): Bắt buộc phải có ít nhất 1 ảnh minh chứng
           ở trạng thái 'READY' với MIME type bắt đầu bằng 'image/'.
        3. Cập nhật trạng thái ca sang 'CLOSED', ghi nhận ngày thực hiện và người đóng ca.
        4. Phát sự kiện Outbox Event 'CARE_SCHEDULE_CLOSED' phục vụ hệ thống báo cáo và thông báo.
        5. Ghi vết Audit Log.
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        # Idempotency: Ca đã đóng thì trả về luôn
        if schedule.status == "CLOSED":
            return schedule

        # G12 Gate Invariant 1: Kiểm tra các hạng mục bắt buộc chưa hoàn tất
        incomplete_required = [
            it.task_description
            for it in schedule.checklist_items
            if it.is_required and not it.is_completed
        ]
        if incomplete_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể đóng ca: Còn {len(incomplete_required)} hạng mục bắt buộc chưa hoàn tất ({', '.join(incomplete_required)})",
            )

        # G12 Gate Invariant 2: Kiểm tra ảnh minh chứng hợp lệ (phải READY và là ảnh)
        valid_evidence_count = 0
        for ev in schedule.media_evidences:
            if ev.file_id:
                fo = db.query(FileObject).filter(FileObject.file_id == ev.file_id).first()
                if (
                    fo
                    and fo.state == "READY"
                    and fo.mime_type
                    and fo.mime_type.startswith("image/")
                ):
                    valid_evidence_count += 1

        if valid_evidence_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cần ít nhất một ảnh minh chứng hiện trường trước khi đóng ca.",
            )

        now = datetime.now(timezone.utc)
        schedule.status = "CLOSED"
        schedule.closed_at = now
        schedule.performed_date = now
        schedule.completed_by_id = current_user_id
        if field_notes:
            schedule.notes = f"{schedule.notes or ''}\n[Đóng ca]: {field_notes}".strip()

        db.commit()
        db.refresh(schedule)

        # Phát sự kiện Outbox (G17)
        OutboxService.publish_event(
            db=db,
            aggregate_type="CARE_SCHEDULE",
            aggregate_id=str(schedule.schedule_id),
            event_type="CARE_SCHEDULE_CLOSED",
            payload={
                "schedule_id": schedule.schedule_id,
                "care_annex_id": schedule.care_annex_id,
                "plot_id": schedule.plot_id,
                "period_key": schedule.period_key,
                "closed_at": schedule.closed_at.isoformat(),
                "completed_by_id": current_user_id,
            },
        )

        # Ghi vết kiểm toán (Audit Log)
        audit = AuditLog(
            user_id=current_user_id,
            action_type="CLOSE_CARE_SCHEDULE",
            target_entity="care_schedules",
            target_id=str(schedule.schedule_id),
            post_change_values=json.dumps(
                {
                    "status": "CLOSED",
                    "closed_at": schedule.closed_at.isoformat(),
                    "completed_by_id": current_user_id,
                }
            ),
        )
        db.add(audit)
        db.commit()

        return schedule

    # =======================================================================
    # TRUY VẤN DANH SÁCH & CHI TIẾT CA CHĂM SÓC
    # =======================================================================

    @staticmethod
    def list_schedules(
        db: Session,
        plot_id: Optional[int] = None,
        caretaker_id: Optional[int] = None,
        status: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        period_key: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[CareSchedule]:
        """
        Truy vấn danh sách lịch chăm sóc mộ theo bộ lọc đa tiêu chí.
        
        Kỹ thuật tối ưu hóa CSDL (Performance Optimization):
        - Sử dụng joinedload để nạp sớm dữ liệu phân cấp: Plot -> Row -> Zone, CarePackage, Caretaker.
        - Sử dụng selectinload để nạp trước tập danh sách con: checklist_items, media_evidences.
        - Triệt tiêu hoàn toàn vấn đề N+1 query thường gặp trong SQLAlchemy ORM.
        """
        query = db.query(CareSchedule).options(
            joinedload(CareSchedule.plot).joinedload(Plot.row).joinedload(Row.zone),
            joinedload(CareSchedule.package),
            joinedload(CareSchedule.caretaker),
            selectinload(CareSchedule.checklist_items),
            selectinload(CareSchedule.media_evidences),
        )
        if plot_id:
            query = query.filter(CareSchedule.plot_id == plot_id)
        if caretaker_id:
            query = query.filter(CareSchedule.caretaker_id == caretaker_id)
        if status and status != "ALL":
            query = query.filter(CareSchedule.status == status)
        if period_key:
            query = query.filter(CareSchedule.period_key == period_key)
        if from_date:
            query = query.filter(CareSchedule.scheduled_date >= from_date)
        if to_date:
            query = query.filter(CareSchedule.scheduled_date <= to_date)

        return (
            query.order_by(CareSchedule.scheduled_date.asc(), CareSchedule.schedule_id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_schedule_detail(db: Session, schedule_id: int) -> CareScheduleDetail:
        """
        Xem chi tiết toàn diện một ca chăm sóc mộ.
        
        Tính năng nghiệp vụ:
        - Tổng hợp số lượng công việc (tasks_count), số việc đã hoàn thành (completed_tasks_count).
        - Kiểm tra xung đột lịch thời gian thực (Real-time Conflict Checking) với StaffUnavailability.
          Nếu nhân viên có lịch nghỉ trùng ca, trả về cờ has_conflict=True kèm lý do để hiển thị cảnh báo đỏ trên UI.
        - Trả về danh sách checklist và media minh chứng đầy đủ URL và người upload.
        """
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        # Kiểm tra xung đột lịch làm việc theo thời gian thực
        has_conflict = False
        conflict_reason = None
        if schedule.caretaker_id and schedule.scheduled_date:
            conflict = (
                db.query(StaffUnavailability)
                .filter(
                    StaffUnavailability.user_id == schedule.caretaker_id,
                    StaffUnavailability.start_date <= schedule.scheduled_date,
                    StaffUnavailability.end_date >= schedule.scheduled_date,
                )
                .first()
            )
            if conflict:
                has_conflict = True
                conflict_reason = f"Trùng lịch nghỉ/bận từ {conflict.start_date} đến {conflict.end_date} (Lý do: {conflict.reason})"

        tasks_count = len(schedule.checklist_items)
        completed_tasks_count = sum(1 for it in schedule.checklist_items if it.is_completed)
        evidence_count = len(schedule.media_evidences)

        return CareScheduleDetail(
            schedule_id=schedule.schedule_id,
            care_annex_id=schedule.care_annex_id,
            plot_id=schedule.plot_id,
            plot_code=schedule.plot.plot_code if schedule.plot else None,
            zone_name=schedule.plot.row.zone.zone_name
            if schedule.plot and schedule.plot.row and schedule.plot.row.zone
            else None,
            package_id=schedule.package_id,
            package_name=schedule.package.package_name if schedule.package else None,
            caretaker_id=schedule.caretaker_id,
            caretaker_name=schedule.caretaker.full_name if schedule.caretaker else None,
            scheduled_date=schedule.scheduled_date,
            performed_date=schedule.performed_date,
            status=schedule.status,
            period_key=schedule.period_key,
            notes=schedule.notes,
            closed_at=schedule.closed_at,
            created_at=schedule.created_at,
            tasks_count=tasks_count,
            completed_tasks_count=completed_tasks_count,
            evidence_count=evidence_count,
            checklist_items=[
                CareChecklistItemBrief.model_validate(it) for it in schedule.checklist_items
            ],
            media_evidences=[
                CareMediaEvidenceBrief(
                    evidence_id=ev.evidence_id,
                    schedule_id=ev.schedule_id,
                    file_id=ev.file_id,
                    media_url=ev.media_url,
                    caption=ev.caption,
                    uploaded_at=ev.uploaded_at,
                    uploaded_by_user_id=ev.uploaded_by_user_id,
                    uploaded_by_name=ev.uploaded_by.full_name if ev.uploaded_by else None,
                )
                for ev in schedule.media_evidences
            ],
            has_conflict=has_conflict,
            conflict_reason=conflict_reason,
        )

    # =======================================================================
    # ĐĂNG KÝ PHỤ LỤC CHĂM SÓC MỘ PHẦN (CARE ANNEX REGISTRATION)
    # =======================================================================

    @staticmethod
    def register_care_annex(
        db: Session,
        data: CareAnnexRegisterRequest,
        current_user_id: int,
    ) -> CareAnnex:
        """
        Đăng ký Phụ lục Hợp đồng Dịch vụ Chăm sóc Mộ phần (Care Annex).
        
        Quy tắc nghiệp vụ:
        - Hợp đồng gốc bắt buộc phải ở trạng thái 'ACTIVE'.
        - Hợp đồng gốc bắt buộc phải thuộc loại 'LAND_PURCHASE' (mua đất) hoặc 'TRANSFER' (chuyển nhượng).
        - Gói dịch vụ chăm sóc (CarePackage) phải tồn tại trong danh mục hệ thống.
        - Đánh số phụ lục tự động: {contract_code}-CS{count + 1:02d}.
        - Khởi tạo đồng thời bản ghi cha ContractAnnex (chứa ngày hiệu lực, giá định kỳ)
          và bản ghi con CareAnnex (chứa chu kỳ chăm sóc, mã gói dịch vụ).
        """
        contract = db.query(Contract).filter(Contract.contract_id == data.contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Không tìm thấy hợp đồng gốc")
        if contract.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Hợp đồng gốc phải ở trạng thái ACTIVE mới được lập phụ lục chăm sóc",
            )
        if contract.contract_type not in ("LAND_PURCHASE", "TRANSFER"):
            raise HTTPException(
                status_code=400,
                detail="Phụ lục chăm sóc chỉ có thể gắn vào hợp đồng mua bán đất hoặc hợp đồng chuyển nhượng.",
            )

        pkg = db.query(CarePackage).filter(CarePackage.package_id == data.package_id).first()
        if not pkg:
            raise HTTPException(status_code=404, detail="Không tìm thấy gói chăm sóc")

        # Đếm số lượng phụ lục hiện có của hợp đồng để sinh số thứ tự phụ lục mới
        count = (
            db.query(func.count(ContractAnnex.annex_id))
            .filter(ContractAnnex.contract_id == data.contract_id)
            .scalar()
            or 0
        )
        annex_number = f"{contract.contract_code}-CS{count + 1:02d}"

        # 1. Khởi tạo bản ghi phụ lục hợp đồng chung (ContractAnnex)
        base_annex = ContractAnnex(
            contract_id=data.contract_id,
            annex_code=annex_number,
            annex_type="CARE",
            status="ACTIVE",
            additional_amount=data.recurring_price,
            valid_from=data.valid_from,
            valid_to=data.valid_to,
            notes=data.notes,
        )
        db.add(base_annex)
        db.flush()

        # 2. Khởi tạo bản ghi chi tiết phụ lục chăm sóc (CareAnnex) liên kết 1-1
        care_annex = CareAnnex(
            annex_id=base_annex.annex_id,
            package_id=data.package_id,
            cycle_months=data.cycle_months,
            recurring_price=data.recurring_price,
        )
        db.add(care_annex)
        db.commit()
        db.refresh(care_annex)
        return care_annex
