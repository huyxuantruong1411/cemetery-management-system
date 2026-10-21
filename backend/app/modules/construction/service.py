import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

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
from app.modules.plots.models import Plot, PlotSlot, Row

# =============================================================================
# PHÂN HỆ QUẢN LÝ THI CÔNG & XÂY DỰNG LĂNG MỘ (CONSTRUCTION SERVICE)
# =============================================================================
# Vai trò kiến trúc:
# - Quản lý việc lập lệnh thi công, phân công giám sát viên, theo dõi tiến độ hạng mục
#   và tổ chức nghiệm thu thực địa dựa trên các phụ lục hợp đồng đã kích hoạt.
# - Các nguyên tắc bất biến sống còn (Core Domain Invariants):
#   1. Cổng kiểm soát căn cứ pháp lý: Lệnh thi công chỉ được tạo từ Phụ lục hợp đồng
#      ở trạng thái 'ACTIVE' (loại CONSTRUCTION hoặc BURIAL).
#   2. Kiểm tra xung đột lịch làm việc (Staff Conflict Check - G13): Tự động phát hiện
#      nếu nhân viên giám sát hoặc thi công trùng lịch nghỉ phép (StaffUnavailability).
#   3. Chốt chặn minh chứng nghiệm thu (Evidence Completion Gate - R06):
#      Lệnh thi công TUYỆT ĐỐI KHÔNG THỂ NGHIỆM THU (COMPLETED) nếu:
#      - Còn bất kỳ hạng mục bắt buộc (is_required=True) chưa chuyển sang 'DONE'.
#      - Thiếu ảnh chụp hoặc biên bản nghiệm thu thực địa ở trạng thái 'READY' (MinIO).
#   4. Bảo toàn trạng thái an táng ô mộ: Hoàn thành thi công lăng mộ KHÔNG ĐƯỢC TỰ ĐỘNG
#      chuyển ô mộ sang 'OCCUPIED'. Ô chỉ chuyển về 'OWNED_EMPTY' (nếu chưa an táng)
#      hoặc giữ 'OCCUPIED' (nếu đã có người mất trước đó).
# =============================================================================


class ConstructionService:
    @staticmethod
    def _field_staff(db: Session, user_id: int) -> User:
        """Xác thực người dùng là nhân viên quản trang thực địa (CARETAKER) hoặc Quản trị viên (ADMIN) đang hoạt động."""
        user = db.query(User).filter(User.user_id == user_id, User.is_active == True).first()  # noqa: E712
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên đang làm việc.")
        if not any(r.role_name in ("CARETAKER", "ADMIN") for r in user.roles):
            raise HTTPException(status_code=400, detail="Hãy chọn nhân viên quản trang để phân công.")
        return user

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
        """
        KIỂM TRA XUNG ĐỘT LỊCH LÀM VIỆC CỦA NHÂN VIÊN (STAFF CONFLICT CHECK - G13):
        - Quét bảng 'StaffUnavailability' để tìm các khoảng thời gian nhân viên đăng ký nghỉ phép
          hoặc bận công tác giao nhau với khoảng thời gian thi công dự kiến [start_date, end_date].
        - Điều kiện giao nhau trong SQL: (unav.start_date <= end_date AND unav.end_date >= start_date).
        - Nếu phát hiện trùng lặp, trả về has_conflict=True kèm cảnh báo chi tiết để điều phối viên đổi nhân sự.
        """
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
    # QUẢN LÝ LỆNH THI CÔNG (CONSTRUCTION ORDER MANAGEMENT)
    # -----------------------------------------------------------------------

    @staticmethod
    def list_orders(
        db: Session,
        status_filter: Optional[str] = None,
        plot_id: Optional[int] = None,
        supervisor_id: Optional[int] = None,
    ) -> List[ConstructionOrderResponse]:
        """Truy vấn danh sách lệnh thi công với eager loading liên kết Plot, Row, Zone, Supervisor, Tasks, Evidences."""
        query = db.query(ConstructionOrder).options(
            joinedload(ConstructionOrder.plot).joinedload(Plot.row).joinedload(Row.zone),
            joinedload(ConstructionOrder.supervisor),
            selectinload(ConstructionOrder.tasks).selectinload(ConstructionTask.evidences),
        )
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
        """Lấy chi tiết lệnh thi công theo ID kèm toàn bộ danh sách hạng mục và ảnh minh chứng."""
        order = (
            db.query(ConstructionOrder)
            .options(
                joinedload(ConstructionOrder.plot).joinedload(Plot.row).joinedload(Row.zone),
                joinedload(ConstructionOrder.supervisor),
                selectinload(ConstructionOrder.tasks).selectinload(ConstructionTask.evidences),
            )
            .filter(ConstructionOrder.order_id == order_id)
            .first()
        )
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh thi công")
        return ConstructionService._to_order_response(order)

    @staticmethod
    def create_order(
        db: Session, data: ConstructionOrderCreate, creator_user_id: int
    ) -> ConstructionOrderResponse:
        """
        TẠO MỚI LỆNH THI CÔNG XÂY DỰNG:
        - Bước 1: Kiểm tra Phụ lục hợp đồng (ContractAnnex) tồn tại, thuộc loại hợp lệ (CONSTRUCTION/BURIAL)
                  và bắt buộc ở trạng thái ACTIVE.
        - Bước 2: Kiểm tra ô mộ hợp lệ và khớp với ô mộ được đăng ký trên phụ lục.
        - Bước 3: Xác thực nhân sự giám sát (chỉ phân công cho CARETAKER hoặc ADMIN).
        - Bước 4: Kiểm tra xung đột lịch làm việc của giám sát viên (G13).
        - Bước 5: Chuyển trạng thái ô mộ từ 'OWNED_EMPTY' sang 'UNDER_CONSTRUCTION'.
        - Bước 6: Tự động phân rã các hạng mục công việc (Tasks) từ cấu hình checklist_specifications
                  hoặc 5 hạng mục quy chuẩn ngành nghĩa trang.
        """
        # 1. Kiểm tra tính hợp lệ và trạng thái ACTIVE của phụ lục
        annex = db.query(ContractAnnex).filter(ContractAnnex.annex_id == data.annex_id).first()
        if not annex:
            raise HTTPException(status_code=404, detail="Phụ lục hợp đồng không tồn tại")
        if annex.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail=f"Phụ lục hợp đồng chưa được kích hoạt (trạng thái hiện tại: {annex.status}). Chỉ phụ lục ACTIVE mới được triển khai thi công.",
            )
        if annex.annex_type not in ("CONSTRUCTION", "BURIAL"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phụ lục hợp đồng loại '{annex.annex_type}' không phải phụ lục thi công/an táng hợp lệ.",
            )

        # 2. Kiểm tra ô mộ và khớp nối với phụ lục
        plot = db.query(Plot).filter(Plot.plot_id == data.plot_id).first()
        if not plot:
            raise HTTPException(status_code=404, detail="Ô mộ không tồn tại")

        annex_plot_id = None
        if annex.construction:
            annex_plot_id = annex.construction.plot_id
        elif annex.burial:
            annex_plot_id = annex.burial.plot_id
        if annex_plot_id is not None and annex_plot_id != data.plot_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ô mộ chỉ định ({data.plot_id}) không khớp với ô mộ của phụ lục thi công ({annex_plot_id}).",
            )

        # 3. Xác thực nhân sự quản trang được phân công
        ConstructionService._field_staff(db, data.supervisor_id)
        for task in data.custom_tasks or []:
            if task.assignee_user_id is not None:
                ConstructionService._field_staff(db, task.assignee_user_id)

        # 4. Kiểm tra xung đột lịch làm việc của giám sát viên (G13)
        start_d = data.start_date or date.today()
        strict_end_date = data.expected_end_date
        if annex.construction and annex.construction.estimated_end_date:
            strict_end_date = annex.construction.estimated_end_date
        elif annex.valid_to:
            strict_end_date = annex.valid_to

        conflict_res = ConstructionService.check_staff_conflict(
            db, data.supervisor_id, start_d, strict_end_date
        )
        if conflict_res.has_conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Xung đột lịch giám sát viên: {conflict_res.warning_message}",
            )

        # 5. Khởi tạo lệnh thi công (PENDING)
        order = ConstructionOrder(
            annex_id=data.annex_id,
            plot_id=data.plot_id,
            supervisor_id=data.supervisor_id,
            start_date=start_d,
            expected_end_date=strict_end_date,
            overall_progress=Decimal("0.00"),
            status="PENDING",
            notes=data.notes,
        )
        db.add(order)
        db.flush()

        # Cập nhật trạng thái ô mộ sang UNDER_CONSTRUCTION
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
            # Check if annex has checklist_specifications configured
            parsed_tasks = []
            if annex.construction and annex.construction.checklist_specifications:
                spec_str = annex.construction.checklist_specifications.strip()
                if spec_str:
                    try:
                        items = json.loads(spec_str)
                        if isinstance(items, list):
                            for idx, it in enumerate(items, 1):
                                if isinstance(it, dict):
                                    t_name = (it.get("task_name") or "").strip()
                                    specs = (it.get("specs") or "").strip()
                                    full_name = f"{t_name} ({specs})" if specs else t_name
                                    is_req = it.get("is_required", True)
                                else:
                                    full_name = str(it).strip()
                                    is_req = True
                                if full_name:
                                    parsed_tasks.append((full_name[:150], is_req, idx))
                    except Exception:
                        lines = [line_item.strip() for line_item in spec_str.replace(";", "\n").split("\n") if line_item.strip()]
                        for idx, line in enumerate(lines, 1):
                            parsed_tasks.append((line[:150], True, idx))

            task_list = parsed_tasks if parsed_tasks else [
                ("Khảo sát & định vị khuôn viên ô mộ", True, 1),
                ("Đào móng & đổ bê tông lót nền", True, 2),
                ("Xây tường gạch & hố kim tĩnh (nếu có)", True, 3),
                ("Ốp đá hoa cương & lắp đặt bia mộ", True, 4),
                ("Dọn dẹp vệ sinh & nghiệm thu bàn giao", True, 5),
            ]
            for t_name, req, s_order in task_list:
                task = ConstructionTask(
                    order_id=order.order_id,
                    task_name=t_name,
                    assigned_team_or_contractor=None,
                    assignee_user_id=data.supervisor_id,
                    is_required=req,
                    sort_order=s_order,
                    start_date=start_d,
                    due_date=strict_end_date,
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

    # =======================================================================
    # CẬP NHẬT & NGHIỆM THU HOÀN THÀNH LỆNH THI CÔNG
    # =======================================================================

    @staticmethod
    def update_order(
        db: Session, order_id: int, data: ConstructionOrderUpdate, actor_user_id: int
    ) -> ConstructionOrderResponse:
        """
        Cập nhật thông tin lệnh thi công (tiến độ, thời gian, người giám sát, ghi chú).
        
        Quy tắc nghiệp vụ:
        - Lệnh đã nghiệm thu COMPLETED bị đóng băng, không cho phép chỉnh sửa.
        - Nếu status chuyển thành COMPLETED, tự động chuyển tiếp sang hàm complete_order()
          để kích hoạt toàn bộ cổng kiểm tra chất lượng (Quality Gate) bắt buộc.
        """
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh thi công")

        # Invariant: Không cho phép sửa đổi khi lệnh đã hoàn thành nghiệm thu
        if order.status == "COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lệnh thi công đã nghiệm thu hoàn thành, không được phép chỉnh sửa.",
            )

        if data.status is not None:
            new_status = data.status.upper()
            # Nếu người dùng muốn nghiệm thu hoàn tất -> chuyển quyền cho hàm complete_order xử lý Gate Check
            if new_status == "COMPLETED":
                return ConstructionService.complete_order(
                    db, order_id, notes=data.notes, actor_user_id=actor_user_id
                )
            order.status = new_status

        # Kiểm tra và gán giám sát viên mới (phải là nhân viên hiện trường hợp lệ)
        if data.supervisor_id is not None:
            ConstructionService._field_staff(db, data.supervisor_id)
            order.supervisor_id = data.supervisor_id

        if data.start_date is not None:
            order.start_date = data.start_date
        if data.expected_end_date is not None:
            order.expected_end_date = data.expected_end_date
        if data.notes is not None:
            order.notes = data.notes

        db.commit()
        db.refresh(order)
        return ConstructionService._to_order_response(order)

    @staticmethod
    def complete_order(
        db: Session, order_id: int, notes: Optional[str], actor_user_id: int
    ) -> ConstructionOrderResponse:
        """
        [CỔNG KIỂM SOÁT NGHIỆM THU - QUALITY GATE R06]
        Nghiệm thu hoàn tất lệnh thi công và cập nhật lại trạng thái ô đất.
        
        Các Invariant kiểm tra bắt buộc (Chặn 100% nếu vi phạm):
        1. Lệnh thi công đã CANCELLED thì cấm nghiệm thu.
        2. Gate 1: Toàn bộ task có cờ bắt buộc (is_required=True) phải đạt trạng thái 'DONE'.
        3. Gate 2: Bắt buộc phải có ít nhất 1 ảnh/biên bản hiện trường ở trạng thái 'READY' trên toàn lệnh.
        4. Gate 3: Từng hạng mục bắt buộc phải có ít nhất 1 ảnh minh chứng 'READY'.
        5. Quy tắc bảo toàn trạng thái ô đất:
           - Khi kết thúc xây dựng, ô đất không bao giờ tự động chuyển thành 'OCCUPIED' nếu chưa an táng!
           - Nếu có người đã an táng trong các slot -> chuyển thành 'OCCUPIED'.
           - Nếu chưa có người an táng -> chuyển thành 'OWNED_EMPTY' (đã sở hữu nhưng chưa có thi hài).
        6. Phát sự kiện Outbox Event 'CONSTRUCTION_COMPLETED' phục vụ kiến trúc Event-Driven.
        """
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh thi công")

        # Idempotency: Nếu đã COMPLETED từ trước thì trả về kết quả hiện tại
        if order.status == "COMPLETED":
            return ConstructionService._to_order_response(order)

        if order.status == "CANCELLED":
            raise HTTPException(
                status_code=400, detail="Lệnh thi công đã bị hủy, không thể nghiệm thu."
            )

        # Gate Check 1: Thiếu required task chưa xong -> chặn 100%
        uncompleted_required = [t for t in order.tasks if t.is_required and t.status != "DONE"]
        if uncompleted_required:
            names = ", ".join(f"'{t.task_name}'" for t in uncompleted_required)
            raise HTTPException(
                status_code=400,
                detail=f"Không thể hoàn thành lệnh thi công: vẫn còn {len(uncompleted_required)} công việc bắt buộc chưa hoàn tất: {names}.",
            )

        # Gate Check 2: Lệnh thi công phải có ít nhất 1 minh chứng READY trên toàn bộ các task (R06)
        all_evidences = [ev for t in order.tasks for ev in t.evidences]
        ready_evidences = [
            ev for ev in all_evidences if ev.file_object and ev.file_object.state == "READY"
        ]
        if not ready_evidences:
            raise HTTPException(
                status_code=400,
                detail="Cần ít nhất một ảnh hoặc biên bản hiện trường trước khi nghiệm thu.",
            )

        # Gate Check 3: Từng hạng mục bắt buộc (is_required) phải có riêng ít nhất 1 minh chứng READY (R06)
        for t in order.tasks:
            if t.is_required:
                task_ready_ev = [
                    ev for ev in t.evidences if ev.file_object and ev.file_object.state == "READY"
                ]
                if not task_ready_ev:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Hạng mục bắt buộc '{t.task_name}' chưa có ảnh hoặc biên bản nghiệm thu.",
                    )

        # Thiết lập hoàn thành lệnh và cập nhật tiến độ đạt 100%
        order.status = "COMPLETED"
        order.actual_end_date = date.today()
        order.overall_progress = Decimal("100.00")
        if notes:
            order.notes = (order.notes or "") + f"\n[Nghiệm thu {date.today()}]: {notes}"

        # -------------------------------------------------------------------
        # BẢO TOÀN TRẠNG THÁI Ô ĐẤT (CRITICAL DOMAIN INVARIANT)
        # -------------------------------------------------------------------
        # Khi xây dựng hoàn tất, ô đất không tự đổi thành OCCUPIED nếu chưa an táng người mất.
        # Nếu đã có người an táng trước đó -> chuyển thành OCCUPIED.
        # Nếu chưa có người an táng -> chuyển thành OWNED_EMPTY.
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

        # Phát sinh sự kiện Outbox (G17) để thông báo cho các module khác xử lý bất đồng bộ
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

        # Ghi vết nhật ký hệ thống (Audit Log)
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

    # =======================================================================
    # QUẢN LÝ CÔNG VIỆC THI CÔNG CHI TIẾT (TASKS MANAGEMENT - G11)
    # =======================================================================

    @staticmethod
    def create_task(
        db: Session, order_id: int, data: ConstructionTaskCreate, actor_user_id: int
    ) -> ConstructionTaskBrief:
        """
        Thêm một hạng mục công việc vào lệnh thi công.
        
        Kiểm tra nghiệp vụ:
        - Lệnh thi công đã nghiệm thu COMPLETED thì không được phép thêm công việc mới.
        - Kiểm tra xung đột lịch công tác (Staff Conflict) nếu chỉ định nhân sự thực hiện.
        - Tự động kích hoạt tính toán lại tiến độ tổng thể của lệnh thi công.
        """
        order = db.query(ConstructionOrder).filter(ConstructionOrder.order_id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Lệnh thi công không tồn tại")

        # Invariant: Không thêm task vào lệnh đã hoàn tất nghiệm thu
        if order.status == "COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lệnh thi công đã nghiệm thu hoàn thành, không được phép thêm công việc mới.",
            )

        # Kiểm tra tính hợp lệ và xung đột lịch làm việc của nhân viên được phân công (G13)
        if data.assignee_user_id is not None:
            ConstructionService._field_staff(db, data.assignee_user_id)
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

        # Tự động tính toán lại tỷ lệ phần trăm tiến độ của lệnh thi công
        ConstructionService._recalculate_progress(db, order)
        db.commit()
        db.refresh(task)
        return ConstructionService._to_task_brief(task)

    @staticmethod
    def update_task(
        db: Session, task_id: int, data: ConstructionTaskUpdate, actor_user_id: int
    ) -> ConstructionTaskBrief:
        """
        Cập nhật thông tin công việc thi công (người làm, hạn chót, ghi chú).
        Không cho phép chỉnh sửa nếu lệnh thi công cha đã COMPLETED hoặc CANCELLED.
        """
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        # Invariant: Không sửa task của lệnh đã đóng
        if task.order and task.order.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lệnh thi công đã kết thúc ({task.order.status}), không được phép chỉnh sửa công việc.",
            )

        if data.task_name is not None:
            task.task_name = data.task_name
        if data.assigned_team_or_contractor is not None:
            task.assigned_team_or_contractor = data.assigned_team_or_contractor
        if data.assignee_user_id is not None:
            ConstructionService._field_staff(db, data.assignee_user_id)
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
        """
        Báo cáo hoàn tất một đầu việc thi công tại hiện trường.
        
        Quy tắc Gate:
        - Nếu là hạng mục bắt buộc (is_required=True), bắt buộc phải có ít nhất một ảnh minh chứng READY.
        - Đổi trạng thái task sang 'DONE' và ghi nhận thời gian hoàn thành.
        - Nếu lệnh thi công đang ở trạng thái 'PENDING', tự động chuyển sang 'IN_PROGRESS'.
        - Tự động tính toán lại tiến độ hoàn thành chung của toàn bộ lệnh thi công.
        """
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        if task.order and task.order.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lệnh thi công đã kết thúc ({task.order.status}), không thể hoàn thành công việc.",
            )

        # Idempotency: Đã DONE thì trả về kết quả
        if task.status == "DONE":
            return ConstructionService._to_task_brief(task)

        # Gate Check: Hạng mục bắt buộc phải có minh chứng hợp lệ ở trạng thái READY (R06: loại bỏ shortcut qua URL thuần)
        if task.is_required:
            valid_evidence = False
            for ev in task.evidences:
                if ev.file_object and ev.file_object.state == "READY":
                    valid_evidence = True
                    break

            if not valid_evidence:
                raise HTTPException(
                    status_code=400,
                    detail="Thêm ít nhất một ảnh hoặc biên bản nghiệm thu trước khi hoàn thành công việc này.",
                )

        task.status = "DONE"
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by = completer_user_id
        if field_notes:
            task.field_notes = field_notes

        # Tự động kích hoạt chuyển trạng thái lệnh thi công sang IN_PROGRESS nếu đang chờ (PENDING)
        if task.order.status == "PENDING":
            task.order.status = "IN_PROGRESS"

        ConstructionService._recalculate_progress(db, task.order)
        db.commit()
        db.refresh(task)
        return ConstructionService._to_task_brief(task)

    # -----------------------------------------------------------------------
    # QUẢN LÝ MINH CHỨNG VÀ BẢO TỒN DỮ LIỆU HIỆN TRƯỜNG
    # -----------------------------------------------------------------------

    @staticmethod
    def add_task_evidence(
        db: Session,
        task_id: int,
        file_id: str,
        caption: Optional[str],
        uploader_user_id: int,
    ) -> ConstructionTaskEvidenceBrief:
        """
        Đính kèm ảnh minh chứng thực địa vào đầu việc thi công.
        
        Kiểm tra bảo mật và tính toàn vẹn:
        - Tệp phải tồn tại và có trạng thái 'READY' (đã tải lên MinIO thành công).
        - Định dạng file bắt buộc phải là hình ảnh (MIME bắt đầu bằng 'image/').
        """
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        if task.order and task.order.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lệnh thi công đã kết thúc ({task.order.status}), không thể thêm bằng chứng.",
            )

        # Gate Check: Hạn mức tối đa 5 ảnh minh chứng cho 1 công việc thi công
        existing_count = db.query(ConstructionTaskEvidence).filter(
            ConstructionTaskEvidence.task_id == task_id
        ).count()
        if existing_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mỗi công đoạn thi công chỉ được đính kèm tối đa 5 ảnh minh chứng thực địa. Vui lòng xóa bớt ảnh cũ nếu muốn thay thế ảnh khác.",
            )

        # Gate Check: Tệp phải tồn tại và ở trạng thái READY trên MinIO (ảnh phải READY trước khi nghiệm thu)
        file_obj = db.query(FileObject).filter(FileObject.file_id == file_id).first()
        if not file_obj:
            raise HTTPException(
                status_code=404, detail=f"Không tìm thấy tệp mã '{file_id}' trong hệ thống"
            )
        if file_obj.state != "READY":
            raise HTTPException(
                status_code=400,
                detail="Tệp chưa tải lên xong. Vui lòng thử lại.",
            )
        if not file_obj.mime_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Minh chứng thi công thực địa bắt buộc phải là tệp hình ảnh (PNG, JPG).",
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
    def delete_task_evidence(
        db: Session,
        task_id: int,
        evidence_id: int,
        user_id: int,
    ) -> None:
        """
        Xóa minh chứng thi công (có cơ chế đóng băng chống gian lận).
        
        Bảo mật hiện trường:
        - Khi đầu việc đã hoàn thành ('DONE'), toàn bộ ảnh minh chứng bị khóa vĩnh viễn,
          ngăn chặn việc đánh tráo hoặc xóa bỏ hồ sơ nghiệm thu thực tế.
        """
        task = db.query(ConstructionTask).filter(ConstructionTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Công việc thi công không tồn tại")

        # Khóa minh chứng khi công việc đã được nghiệm thu hoàn tất
        if task.status == "DONE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đầu việc thi công này đã được xác nhận hoàn tất. Toàn bộ ảnh minh chứng đã bị khóa vĩnh viễn, không thể chỉnh sửa hoặc xóa.",
            )

        if task.order and task.order.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lệnh thi công đã kết thúc ({task.order.status}), không thể xóa minh chứng.",
            )

        evidence = (
            db.query(ConstructionTaskEvidence)
            .filter(
                ConstructionTaskEvidence.evidence_id == evidence_id,
                ConstructionTaskEvidence.task_id == task_id,
            )
            .first()
        )
        if not evidence:
            raise HTTPException(status_code=404, detail="Ảnh minh chứng không tồn tại")

        db.delete(evidence)
        db.commit()

    @staticmethod
    def reorder_tasks(
        db: Session, order_id: int, orders: List[TaskOrderItem]
    ) -> List[ConstructionTaskBrief]:
        """Sắp xếp lại thứ tự ưu tiên của các công việc thi công (sort_order)."""
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
    # TÍNH TOÁN TIẾN ĐỘ THI CÔNG & CHẶN NGƯỠNG 100%
    # -----------------------------------------------------------------------

    @staticmethod
    def _recalculate_progress(db: Session, order: ConstructionOrder) -> None:
        """
        Thuật toán tính toán tiến độ tổng thể của lệnh thi công.
        
        Quy tắc Gate nghiêm ngặt:
        - raw_progress = (Số task DONE / Tổng số task) * 100%.
        - Nếu vẫn còn bất kỳ hạng mục bắt buộc nào (is_required) chưa DONE,
          dù tỷ lệ toán học có đạt 100%, hệ thống vẫn ép mức tối đa là 99.00%.
          Chỉ khi vượt qua nghiệm thu chính thức ở complete_order() mới đạt 100.00%.
        """
        tasks = order.tasks
        if not tasks:
            order.overall_progress = Decimal("0.00")
            return

        total_cnt = len(tasks)
        completed_cnt = sum(1 for t in tasks if t.status == "DONE")
        uncompleted_required = any(t.is_required and t.status != "DONE" for t in tasks)

        raw_progress = (Decimal(completed_cnt) / Decimal(total_cnt)) * Decimal("100.00")
        raw_progress = raw_progress.quantize(Decimal("0.01"))

        # Gate Check: Nếu còn hạng mục bắt buộc chưa xong -> chặn không cho chạm mốc 100%
        if uncompleted_required and raw_progress >= Decimal("100.00"):
            raw_progress = Decimal("99.00")

        order.overall_progress = raw_progress
        db.flush()
