import calendar
import json
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

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
    CareMediaEvidenceBrief,
    CareScheduleDetail,
)
from app.modules.construction.models import StaffUnavailability
from app.modules.contracts.models import Contract, ContractAnnex
from app.modules.documents.models import FileObject
from app.modules.jobs.service import OutboxService


class CareService:
    @staticmethod
    def calculate_anchored_date(year: int, month: int, anchor_day: int) -> date:
        """
        G12 End-of-month anchor rule:
        If anchor_day exceeds the days in target month (e.g. 31st in Feb),
        fall back to last day of that month (28 or 29), but preserve original
        anchor_day for subsequent months (e.g. March still gets 31st).
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
        Generates recurring care schedules for a given month and year.
        Idempotent: running 3 times for the same month produces the same schedules.
        """
        period_key = f"{year:04d}-M{month:02d}"
        first_day_of_month = date(year, month, 1)
        last_day_of_month = date(year, month, calendar.monthrange(year, month)[1])

        # Query active care annexes overlapping with target month
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

            if not plot_id:
                skipped_count += 1
                continue

            # Idempotency check: schedule for this period already exists
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

            # Calculate scheduled date with End-of-month rule
            anchor_day = annex.valid_from.day
            scheduled_date = cls.calculate_anchored_date(year, month, anchor_day)

            # Ensure date is strictly within annex validity window
            if scheduled_date < annex.valid_from or scheduled_date > annex.valid_to:
                skipped_count += 1
                continue

            # Fetch package default tasks
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

            # Create schedule
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

            # Create checklist items
            for idx, task_name in enumerate(tasks_list):
                item = CareChecklistItem(
                    schedule_id=schedule.schedule_id,
                    task_description=task_name,
                    is_required=True,  # Default tasks are mandatory for completion
                    sort_order=idx + 1,
                    is_completed=False,
                )
                db.add(item)

            generated_schedules.append(schedule)

        db.commit()
        return period_key, len(generated_schedules), skipped_count, generated_schedules

    @staticmethod
    def assign_caretaker(
        db: Session,
        schedule_id: int,
        caretaker_id: int,
        current_user_id: int,
    ) -> Tuple[CareSchedule, bool, Optional[str]]:
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        user = db.query(User).filter(User.user_id == caretaker_id, User.is_active == True).first()  # noqa: E712
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên quản trang")

        # G13 Conflict Warning Check
        conflict = (
            db.query(StaffUnavailability)
            .filter(
                StaffUnavailability.user_id == caretaker_id,
                StaffUnavailability.start_date <= schedule.scheduled_date,
                StaffUnavailability.end_date >= schedule.scheduled_date,
            )
            .first()
        )

        has_conflict = conflict is not None
        conflict_msg = (
            f"Nhân viên {user.full_name} có lịch nghỉ/bận từ {conflict.start_date} đến {conflict.end_date} (Lý do: {conflict.reason})"
            if conflict
            else None
        )

        schedule.caretaker_id = caretaker_id
        db.commit()
        db.refresh(schedule)

        # Audit
        audit = AuditLog(
            user_id=current_user_id,
            action_type="ASSIGN_CARETAKER",
            target_entity="care_schedules",
            target_id=str(schedule.schedule_id),
            post_change_values=json.dumps(
                {"caretaker_id": caretaker_id, "has_conflict": has_conflict}
            ),
        )
        db.add(audit)
        db.commit()

        return schedule, has_conflict, conflict_msg

    @staticmethod
    def update_checklist_item(
        db: Session,
        item_id: int,
        is_completed: Optional[bool],
        field_notes: Optional[str],
        user_id: int,
    ) -> CareChecklistItem:
        item = db.query(CareChecklistItem).filter(CareChecklistItem.item_id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Không tìm thấy hạng mục công việc")

        if is_completed is not None:
            item.is_completed = is_completed
        if field_notes is not None:
            item.field_notes = field_notes

        schedule = item.schedule
        if schedule and schedule.status == "SCHEDULED":
            schedule.status = "IN_PROGRESS"

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def add_media_evidence(
        db: Session,
        schedule_id: int,
        file_id: Optional[str],
        media_url: Optional[str],
        caption: Optional[str],
        user_id: int,
    ) -> CareMediaEvidence:
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        if not file_id and not media_url:
            raise HTTPException(
                status_code=400, detail="Bắt buộc phải cung cấp file_id hoặc media_url"
            )

        if file_id:
            file_obj = db.query(FileObject).filter(FileObject.file_id == file_id).first()
            if not file_obj:
                raise HTTPException(status_code=404, detail="Không tìm thấy tệp lưu trữ")
            if file_obj.state != "READY":
                raise HTTPException(
                    status_code=400,
                    detail=f"Tệp minh chứng chưa sẵn sàng (trạng thái: {file_obj.state}). Chỉ chấp nhận tệp READY.",
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
    def close_schedule(
        db: Session,
        schedule_id: int,
        field_notes: Optional[str],
        current_user_id: int,
    ) -> CareSchedule:
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

        if schedule.status == "CLOSED":
            return schedule

        # G12 Gate Invariant 1: Check required checklist items
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

        # G12 Gate Invariant 2: Check photo evidence
        valid_evidence_count = 0
        for ev in schedule.media_evidences:
            if ev.file_id:
                fo = db.query(FileObject).filter(FileObject.file_id == ev.file_id).first()
                if fo and fo.state == "READY":
                    valid_evidence_count += 1
            elif ev.media_url:
                valid_evidence_count += 1

        if valid_evidence_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể đóng ca: Bắt buộc phải có ít nhất 1 ảnh minh chứng hiện trường hợp lệ (READY)",
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

        # Publish Outbox event
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

        # Audit
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
        query = db.query(CareSchedule)
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
        schedule = db.query(CareSchedule).filter(CareSchedule.schedule_id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch chăm sóc")

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

    @staticmethod
    def register_care_annex(
        db: Session,
        data: CareAnnexRegisterRequest,
        current_user_id: int,
    ) -> CareAnnex:
        contract = db.query(Contract).filter(Contract.contract_id == data.contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Không tìm thấy hợp đồng gốc")
        if contract.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Hợp đồng gốc phải ở trạng thái ACTIVE mới được lập phụ lục chăm sóc",
            )

        pkg = db.query(CarePackage).filter(CarePackage.package_id == data.package_id).first()
        if not pkg:
            raise HTTPException(status_code=404, detail="Không tìm thấy gói chăm sóc")

        # Sequence or count for annex number
        count = (
            db.query(func.count(ContractAnnex.annex_id))
            .filter(ContractAnnex.contract_id == data.contract_id)
            .scalar()
            or 0
        )
        annex_number = f"{contract.contract_code}-CS{count + 1:02d}"

        # Create contract annex
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
