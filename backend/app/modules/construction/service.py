import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.construction.models import (
    ConstructionOrder,
    ConstructionTask,
    ConstructionTaskEvidence,
    StaffUnavailability,
)
from app.modules.construction.schemas import (
    ConstructionOrderCreate,
    ConstructionOrderResponse,
    ConstructionOrderUpdate,
    ConstructionTaskBrief,
    ConstructionTaskCreate,
    ConstructionTaskEvidenceBrief,
    ConstructionTaskUpdate,
    StaffConflictCheckResponse,
    StaffUnavailabilityCreate,
    StaffUnavailabilityResponse,
    TaskOrderItem,
)
from app.modules.contracts.models import ContractAnnex
from app.modules.documents.models import FileObject
from app.modules.jobs.service import OutboxService
from app.modules.plots.models import Plot, PlotSlot


class ConstructionService:
    @staticmethod
    def _to_evidence_brief(ev: ConstructionTaskEvidence) -> ConstructionTaskEvidenceBrief:
        uploader_name = ev.uploader.full_name if ev.uploader else None
        file_name = ev.file_object.file_name if ev.file_object else None
        download_url = f"/api/v1/documents/{ev.file_id}/download"
        return ConstructionTaskEvidenceBrief(
            evidence_id=ev.evidence_id,
            task_id=ev.task_id,
            file_id=ev.file_id,
            caption=ev.caption,
            uploaded_at=ev.uploaded_at,
            uploaded_by=ev.uploaded_by,
            uploader_name=uploader_name,
            file_name=file_name,
            download_url=download_url,
        )

    @staticmethod
    def _to_task_brief(task: ConstructionTask) -> ConstructionTaskBrief:
        assignee_name = task.assignee.full_name if task.assignee else None
        completed_by_name = task.completer.full_name if task.completer else None
        evidences = [ConstructionService._to_evidence_brief(ev) for ev in task.evidences]
        return ConstructionTaskBrief(
            task_id=task.task_id,
            order_id=task.order_id,
            task_name=task.task_name,
            assigned_team_or_contractor=task.assigned_team_or_contractor,
            assignee_user_id=task.assignee_user_id,
            assignee_name=assignee_name,
            is_required=task.is_required,
            sort_order=task.sort_order,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status,
            proof_media_url=task.proof_media_url,
            field_notes=task.field_notes,
            completed_at=task.completed_at,
            completed_by=task.completed_by,
            completed_by_name=completed_by_name,
            evidences=evidences,
        )

    @staticmethod
    def _to_order_response(order: ConstructionOrder) -> ConstructionOrderResponse:
        plot_code = order.plot.plot_code if order.plot else None
        zone_name = (
            order.plot.row.zone.zone_name
            if (order.plot and order.plot.row and order.plot.row.zone)
            else None
        )
        supervisor_name = order.supervisor.full_name if order.supervisor else None

        tasks = [ConstructionService._to_task_brief(t) for t in order.tasks]
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == "DONE")
        required_tasks = sum(1 for t in tasks if t.is_required)
        completed_required_tasks = sum(1 for t in tasks if t.is_required and t.status == "DONE")

        today = date.today()
        is_overdue = bool(
            order.status in ("PENDING", "IN_PROGRESS") and order.expected_end_date < today
        )

        return ConstructionOrderResponse(
            order_id=order.order_id,
            annex_id=order.annex_id,
            plot_id=order.plot_id,
            plot_code=plot_code,
            zone_name=zone_name,
            supervisor_id=order.supervisor_id,
            supervisor_name=supervisor_name,
            start_date=order.start_date,
            expected_end_date=order.expected_end_date,
            actual_end_date=order.actual_end_date,
            overall_progress=order.overall_progress,
            status="OVERDUE" if (is_overdue and order.status == "IN_PROGRESS") else order.status,
            is_overdue=is_overdue,
            notes=order.notes,
            created_at=order.created_at,
            tasks=tasks,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            required_tasks=required_tasks,
            completed_required_tasks=completed_required_tasks,
        )

    # -----------------------------------------------------------------------
    # Staff Unavailability & Scheduling Conflicts (G13)
    # -----------------------------------------------------------------------

    @staticmethod
    def list_unavailability(
        db: Session, user_id: Optional[int] = None
    ) -> List[StaffUnavailabilityResponse]:
        query = db.query(StaffUnavailability)
        if user_id:
            query = query.filter(StaffUnavailability.user_id == user_id)
        records = query.order_by(StaffUnavailability.start_date.desc()).all()
        return [
            StaffUnavailabilityResponse(
                unavailability_id=r.unavailability_id,
                user_id=r.user_id,
                user_name=r.user.full_name if r.user else None,
                start_date=r.start_date,
                end_date=r.end_date,
                reason=r.reason,
                created_at=r.created_at,
            )
            for r in records
        ]

    @staticmethod
    def create_unavailability(
        db: Session, data: StaffUnavailabilityCreate
    ) -> StaffUnavailabilityResponse:
        user = db.query(User).filter(User.user_id == data.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Nhân viên không tồn tại")

        if data.start_date > data.end_date:
            raise HTTPException(
                status_code=400, detail="Ngày bắt đầu nghỉ không được sau ngày kết thúc"
            )

        unav = StaffUnavailability(
            user_id=data.user_id,
            start_date=data.start_date,
            end_date=data.end_date,
            reason=data.reason,
        )
        db.add(unav)
        db.commit()
        db.refresh(unav)
        return StaffUnavailabilityResponse(
            unavailability_id=unav.unavailability_id,
            user_id=unav.user_id,
            user_name=user.full_name,
            start_date=unav.start_date,
            end_date=unav.end_date,
            reason=unav.reason,
            created_at=unav.created_at,
        )

    @staticmethod
    def delete_unavailability(db: Session, unavailability_id: int) -> None:
        unav = (
            db.query(StaffUnavailability)
            .filter(StaffUnavailability.unavailability_id == unavailability_id)
            .first()
        )
        if not unav:
            raise HTTPException(status_code=404, detail="Bản ghi nghỉ phép không tồn tại")
        db.delete(unav)
        db.commit()

    @staticmethod
    def check_staff_conflict(
        db: Session, user_id: int, start_date: date, end_date: date
    ) -> StaffConflictCheckResponse:
        """Checks if a staff member has overlapping unavailability."""
        conflicts = (
            db.query(StaffUnavailability)
            .filter(
                StaffUnavailability.user_id == user_id,
                StaffUnavailability.start_date <= end_date,
                StaffUnavailability.end_date >= start_date,
            )
            .all()
        )
        if not conflicts:
            return StaffConflictCheckResponse(has_conflict=False, conflicts=[])

        user = db.query(User).filter(User.user_id == user_id).first()
        user_name = user.full_name if user else f"ID {user_id}"
        warning_msg = (
            f"Cảnh báo xung đột: Nhân viên {user_name} có lịch nghỉ/bận từ "
            f"{conflicts[0].start_date.strftime('%d/%m/%Y')} đến {conflicts[0].end_date.strftime('%d/%m/%Y')} "
            f"(Lý do: {conflicts[0].reason or 'Không ghi chú'})."
        )
        return StaffConflictCheckResponse(
            has_conflict=True,
            conflicts=[
                StaffUnavailabilityResponse(
                    unavailability_id=c.unavailability_id,
                    user_id=c.user_id,
                    user_name=user_name,
                    start_date=c.start_date,
                    end_date=c.end_date,
                    reason=c.reason,
                    created_at=c.created_at,
                )
                for c in conflicts
            ],
            warning_message=warning_msg,
        )

    # -----------------------------------------------------------------------
    # Construction Order Management
    # -----------------------------------------------------------------------

    @staticmethod
    def list_orders(
        db: Session,
        status_filter: Optional[str] = None,
        plot_id: Optional[int] = None,
        supervisor_id: Optional[int] = None,
    ) -> List[ConstructionOrderResponse]:
        query = db.query(ConstructionOrder)
        if status_filter:
            if status_filter.upper() == "OVERDUE":
                query = query.filter(
                    ConstructionOrder.status.in_(("PENDING", "IN_PROGRESS")),
                    ConstructionOrder.expected_end_date < date.today(),
                )
            else:
                query = query.filter(ConstructionOrder.status == status_filter.upper())
        if plot_id:
            query = query.filter(ConstructionOrder.plot_id == plot_id)
        if supervisor_id:
            query = query.filter(ConstructionOrder.supervisor_id == supervisor_id)

        orders = query.order_by(ConstructionOrder.created_at.desc()).all()
        return [ConstructionService._to_order_response(o) for o in orders]

    @staticmethod
    def get_order_by_id(db: Session, order_id: int) -> ConstructionOrderResponse:
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh thi công")
        return ConstructionService._to_order_response(order)

    @staticmethod
    def create_order(
        db: Session, data: ConstructionOrderCreate, creator_user_id: int
    ) -> ConstructionOrderResponse:
        # 1. Validate Annex is ACTIVE (Gate: hủy/chưa ACTIVE phụ lục không triển khai)
        annex = db.query(ContractAnnex).filter(ContractAnnex.annex_id == data.annex_id).first()
        if not annex:
            raise HTTPException(status_code=404, detail="Phụ lục hợp đồng không tồn tại")
        if annex.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail=f"Phụ lục hợp đồng chưa được kích hoạt (trạng thái hiện tại: {annex.status}). Chỉ phụ lục ACTIVE mới được triển khai thi công.",
            )

        # 2. Validate Plot
        plot = db.query(Plot).filter(Plot.plot_id == data.plot_id).first()
        if not plot:
            raise HTTPException(status_code=404, detail="Ô mộ không tồn tại")

        # 3. Validate Supervisor
        supervisor = db.query(User).filter(User.user_id == data.supervisor_id).first()
        if not supervisor:
            raise HTTPException(status_code=404, detail="Giám sát viên (User) không tồn tại")

        # 4. Check supervisor conflict (G13)
        start_d = data.start_date or date.today()
        conflict_res = ConstructionService.check_staff_conflict(
            db, data.supervisor_id, start_d, data.expected_end_date
        )

        # 5. Create Order
        order = ConstructionOrder(
            annex_id=data.annex_id,
            plot_id=data.plot_id,
            supervisor_id=data.supervisor_id,
            start_date=data.start_date or date.today(),
            expected_end_date=data.expected_end_date,
            overall_progress=Decimal("0.00"),
            status="PENDING",
            notes=data.notes,
        )
        db.add(order)
        db.flush()

        # Update plot status to UNDER_CONSTRUCTION if plot is currently OWNED_EMPTY
        if plot.status == "OWNED_EMPTY":
            plot.status = "UNDER_CONSTRUCTION"

        # 6. Generate Tasks (Default or Custom)
        if data.custom_tasks and len(data.custom_tasks) > 0:
            for ct in data.custom_tasks:
                task = ConstructionTask(
                    order_id=order.order_id,
                    task_name=ct.task_name,
                    assigned_team_or_contractor=ct.assigned_team_or_contractor,
                    assignee_user_id=ct.assignee_user_id,
                    is_required=ct.is_required,
                    sort_order=ct.sort_order,
                    start_date=ct.start_date,
                    due_date=ct.due_date,
                    status="TODO",
                    field_notes=ct.field_notes,
                )
                db.add(task)
        else:
            # Default 5 standard construction tasks (G11)
            standard_tasks = [
                ("Khảo sát & định vị khuôn viên ô mộ", True, 1),
                ("Đào móng & đổ bê tông lót nền", True, 2),
                ("Xây tường gạch & hố kim tĩnh (nếu có)", True, 3),
                ("Ốp đá hoa cương & lắp đặt bia mộ", True, 4),
                ("Dọn dẹp vệ sinh & nghiệm thu bàn giao", True, 5),
            ]
            for t_name, req, s_order in standard_tasks:
                task = ConstructionTask(
                    order_id=order.order_id,
                    task_name=t_name,
                    assigned_team_or_contractor=None,
                    assignee_user_id=data.supervisor_id,
                    is_required=req,
                    sort_order=s_order,
                    start_date=start_d,
                    due_date=data.expected_end_date,
                    status="TODO",
                )
                db.add(task)

        # Audit log
        audit = AuditLog(
            user_id=creator_user_id,
            action_type="CREATE",
            target_entity="ConstructionOrder",
            target_id=str(order.order_id),
            post_change_values=json.dumps(
                {
                    "annex_id": data.annex_id,
                    "plot_id": data.plot_id,
                    "supervisor_id": data.supervisor_id,
                    "conflict_warning": (
                        conflict_res.warning_message if conflict_res.has_conflict else None
                    ),
                }
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(order)
        return ConstructionService._to_order_response(order)

    @staticmethod
    def update_order(
        db: Session, order_id: int, data: ConstructionOrderUpdate, actor_user_id: int
    ) -> ConstructionOrderResponse:
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh thi công")

        if data.supervisor_id is not None:
            supervisor = db.query(User).filter(User.user_id == data.supervisor_id).first()
            if not supervisor:
                raise HTTPException(status_code=404, detail="Giám sát viên không tồn tại")
            order.supervisor_id = data.supervisor_id

        if data.start_date is not None:
            order.start_date = data.start_date
        if data.expected_end_date is not None:
            order.expected_end_date = data.expected_end_date
        if data.notes is not None:
            order.notes = data.notes
        if data.status is not None:
            order.status = data.status.upper()

        db.commit()
        db.refresh(order)
        return ConstructionService._to_order_response(order)

    @staticmethod
    def complete_order(
        db: Session, order_id: int, notes: Optional[str], actor_user_id: int
    ) -> ConstructionOrderResponse:
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh thi công")

        if order.status == "COMPLETED":
            return ConstructionService._to_order_response(order)

        # Gate Check: thiếu required task chặn 100%
        uncompleted_required = [t for t in order.tasks if t.is_required and t.status != "DONE"]
        if uncompleted_required:
            names = ", ".join(f"'{t.task_name}'" for t in uncompleted_required)
            raise HTTPException(
                status_code=400,
                detail=f"Không thể hoàn thành lệnh thi công: vẫn còn {len(uncompleted_required)} công việc bắt buộc chưa hoàn tất: {names}.",
            )

        # Check all attached evidences are READY
        for t in order.tasks:
            for ev in t.evidences:
                if ev.file_object and ev.file_object.state != "READY":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Tệp bằng chứng '{ev.file_id}' thuộc công việc '{t.task_name}' chưa ở trạng thái READY (trạng thái: {ev.file_object.state}).",
                    )

        # Mark completed
        order.status = "COMPLETED"
        order.actual_end_date = date.today()
        order.overall_progress = Decimal("100.00")
        if notes:
            order.notes = (order.notes or "") + f"\n[Nghiệm thu {date.today()}]: {notes}"

        # CRITICAL DOMAIN INVARIANT: "order hoàn thành không tự đổi trạng thái an táng"
        # If plot is UNDER_CONSTRUCTION, revert to OWNED_EMPTY if no deceased is buried, or OCCUPIED if there are already buried deceased.
        plot = order.plot
        if plot and plot.status == "UNDER_CONSTRUCTION":
            occupied_slots = (
                db.query(PlotSlot)
                .filter(PlotSlot.plot_id == plot.plot_id, PlotSlot.status == "OCCUPIED")
                .count()
            )
            if occupied_slots > 0:
                plot.status = "OCCUPIED"
            else:
                plot.status = "OWNED_EMPTY"

        # Emit Outbox Event (G17)
        OutboxService.publish_event(
            db=db,
            aggregate_type="CONSTRUCTION_ORDER",
            aggregate_id=str(order.order_id),
            event_type="CONSTRUCTION_COMPLETED",
            payload={
                "order_id": order.order_id,
                "annex_id": order.annex_id,
                "plot_id": order.plot_id,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "actual_end_date": str(order.actual_end_date),
            },
        )

        # Audit Log
        audit = AuditLog(
            user_id=actor_user_id,
            action_type="COMPLETE",
            target_entity="ConstructionOrder",
            target_id=str(order.order_id),
            post_change_values=json.dumps({"actual_end_date": str(order.actual_end_date)}),
        )
        db.add(audit)
        db.commit()
        db.refresh(order)
        return ConstructionService._to_order_response(order)

    # -----------------------------------------------------------------------
    # Construction Tasks Management (G11)
    # -----------------------------------------------------------------------

    @staticmethod
    def create_task(
        db: Session, order_id: int, data: ConstructionTaskCreate, actor_user_id: int
    ) -> ConstructionTaskBrief:
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Lệnh thi công không tồn tại")

        # G13 Conflict check if assignee provided
        if data.assignee_user_id and data.start_date and data.due_date:
            ConstructionService.check_staff_conflict(
                db, data.assignee_user_id, data.start_date, data.due_date
            )

        task = ConstructionTask(
            order_id=order_id,
            task_name=data.task_name,
            assigned_team_or_contractor=data.assigned_team_or_contractor,
            assignee_user_id=data.assignee_user_id,
            is_required=data.is_required,
            sort_order=data.sort_order,
            start_date=data.start_date,
            due_date=data.due_date,
            status="TODO",
            field_notes=data.field_notes,
        )
        db.add(task)
        db.flush()

        ConstructionService._recalculate_progress(db, order)
        db.commit()
        db.refresh(task)
        return ConstructionService._to_task_brief(task)

    @staticmethod
    def update_task(
        db: Session, task_id: int, data: ConstructionTaskUpdate, actor_user_id: int
    ) -> ConstructionTaskBrief:
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        if data.task_name is not None:
            task.task_name = data.task_name
        if data.assigned_team_or_contractor is not None:
            task.assigned_team_or_contractor = data.assigned_team_or_contractor
        if data.assignee_user_id is not None:
            task.assignee_user_id = data.assignee_user_id
        if data.is_required is not None:
            task.is_required = data.is_required
        if data.sort_order is not None:
            task.sort_order = data.sort_order
        if data.start_date is not None:
            task.start_date = data.start_date
        if data.due_date is not None:
            task.due_date = data.due_date
        if data.field_notes is not None:
            task.field_notes = data.field_notes

        ConstructionService._recalculate_progress(db, task.order)
        db.commit()
        db.refresh(task)
        return ConstructionService._to_task_brief(task)

    @staticmethod
    def complete_task(
        db: Session,
        task_id: int,
        field_notes: Optional[str],
        proof_media_url: Optional[str],
        completer_user_id: int,
    ) -> ConstructionTaskBrief:
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        if task.status == "DONE":
            return ConstructionService._to_task_brief(task)

        # Gate Check: required task must have ready evidence
        # (ảnh phải READY trước chốt; thiếu required task chặn 100%)
        if task.is_required:
            valid_evidence = False
            # Check attached task evidences
            for ev in task.evidences:
                if ev.file_object and ev.file_object.state == "READY":
                    valid_evidence = True
                    break
            # Fallback to proof_media_url if provided
            if not valid_evidence and proof_media_url:
                valid_evidence = True

            if not valid_evidence:
                raise HTTPException(
                    status_code=400,
                    detail="Công việc bắt buộc (is_required=True) phải có ít nhất 1 ảnh/chứng từ nghiệm thu ở trạng thái READY trước khi hoàn thành.",
                )

        task.status = "DONE"
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by = completer_user_id
        if field_notes:
            task.field_notes = field_notes
        if proof_media_url:
            task.proof_media_url = proof_media_url

        # Transition order to IN_PROGRESS if currently PENDING
        if task.order.status == "PENDING":
            task.order.status = "IN_PROGRESS"

        ConstructionService._recalculate_progress(db, task.order)
        db.commit()
        db.refresh(task)
        return ConstructionService._to_task_brief(task)

    @staticmethod
    def add_task_evidence(
        db: Session,
        task_id: int,
        file_id: str,
        caption: Optional[str],
        uploader_user_id: int,
    ) -> ConstructionTaskEvidenceBrief:
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        # Gate Check: file must exist and be READY (ảnh phải READY trước chốt)
        file_obj = db.query(FileObject).filter(FileObject.file_id == file_id).first()
        if not file_obj:
            raise HTTPException(
                status_code=404, detail=f"Không tìm thấy tệp mã '{file_id}' trong hệ thống MinIO"
            )
        if file_obj.state != "READY":
            raise HTTPException(
                status_code=400,
                detail=f"Tệp bằng chứng '{file_id}' chưa ở trạng thái READY (trạng thái: {file_obj.state}). Vui lòng hoàn tất tải lên tệp trước.",
            )

        evidence = ConstructionTaskEvidence(
            task_id=task_id,
            file_id=file_id,
            caption=caption,
            uploaded_by=uploader_user_id,
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        return ConstructionService._to_evidence_brief(evidence)

    @staticmethod
    def reorder_tasks(
        db: Session, order_id: int, orders: List[TaskOrderItem]
    ) -> List[ConstructionTaskBrief]:
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Lệnh thi công không tồn tại")

        order_map = {item.task_id: item.sort_order for item in orders}
        for task in order.tasks:
            if task.task_id in order_map:
                task.sort_order = order_map[task.task_id]

        db.commit()
        db.refresh(order)
        return [ConstructionService._to_task_brief(t) for t in order.tasks]

    # -----------------------------------------------------------------------
    # Helper: Recalculate Progress (Gate: thiếu required task chặn 100%)
    # -----------------------------------------------------------------------

    @staticmethod
    def _recalculate_progress(db: Session, order: ConstructionOrder) -> None:
        tasks = order.tasks
        if not tasks:
            order.overall_progress = Decimal("0.00")
            return

        total_cnt = len(tasks)
        completed_cnt = sum(1 for t in tasks if t.status == "DONE")
        uncompleted_required = any(t.is_required and t.status != "DONE" for t in tasks)

        raw_progress = (Decimal(completed_cnt) / Decimal(total_cnt)) * Decimal("100.00")
        raw_progress = raw_progress.quantize(Decimal("0.01"))

        # Gate Check: If any required task is not completed, progress cannot reach 100%
        if uncompleted_required and raw_progress >= Decimal("100.00"):
            raw_progress = Decimal("99.00")

        order.overall_progress = raw_progress
        db.flush()
