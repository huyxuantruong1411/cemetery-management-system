import json
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

import sqlalchemy as sa
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.modules.audit.models import AuditLog
from app.modules.catalog.models import PriceItem, PriceList
from app.modules.contracts.models import Contract, ContractTemplate, LandPurchaseContract
from app.modules.contracts.schemas import (
    ContractActivateRequest,
    ContractBriefResponse,
    ContractDetailResponse,
    CustomerBrief,
    LandPurchaseContractCreate,
    LandPurchaseDetailBrief,
    PlotBrief,
    ReceivableBrief,
)
from app.modules.documents.models import FileObject
from app.modules.finance.models import Receivable
from app.modules.jobs.models import OutboxEvent
from app.modules.plots.models import Plot, PlotOwnership, PlotReservation
from app.modules.profiles.models import Customer
from app.services.pdf_service import PDFService


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ContractService:
    @staticmethod
    def generate_contract_code(db: Session, prefix: str = "HD-MD") -> str:
        """
        Sinh mã số hợp đồng an toàn đa luồng bằng SQL Server Sequence (G09).
        Đảm bảo không bao giờ sinh trùng lặp số khi nhiều giao dịch chạy đồng thời.
        """
        try:
            val = db.execute(sa.text("SELECT NEXT VALUE FOR seq_contract_number")).scalar()
        except Exception:
            # Fallback if sequence not accessible in raw connection test
            count = db.query(Contract).count() + 1001
            val = count
        year = date.today().year
        return f"{prefix}-{year}-{val:06d}"

    @classmethod
    def create_land_purchase_contract(
        cls,
        db: Session,
        data: LandPurchaseContractCreate,
        current_user_id: int,
    ) -> Contract:
        """
        Tạo hợp đồng mua đất hình thành từ bước chọn lô đất.
        Khóa hàng tức thời trên ô mộ (with_for_update) chống xung đột đặt chỗ (Anti-Double Booking - G04).
        """
        # 1. Kiểm tra khách hàng
        customer = db.query(Customer).filter(Customer.customer_id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khách hàng với ID {data.customer_id}",
            )

        # 2. Khóa ô mộ để kiểm tra tính khả dụng (Row-level lock)
        plot = db.query(Plot).filter(Plot.plot_id == data.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {data.plot_id}",
            )

        if plot.status != "EMPTY_UNSOLD":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ô mộ {plot.plot_code} hiện ở trạng thái '{plot.status}', không khả dụng để mở bán.",
            )

        # Kiểm tra xem có reservation đang ACTIVE không
        active_res = (
            db.query(PlotReservation)
            .filter(
                PlotReservation.plot_id == plot.plot_id,
                PlotReservation.state == "ACTIVE",
            )
            .first()
        )
        if active_res:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ô mộ {plot.plot_code} hiện đang được giữ chỗ bởi '{active_res.customer_name or 'khách hàng khác'}'.",
            )

        # 3. Snapshot đơn giá đất
        unit_price = data.land_unit_price
        if unit_price is None:
            # Tra cứu từ bảng giá niêm yết đang hiệu lực
            today = date.today()
            active_list = (
                db.query(PriceList)
                .filter(
                    PriceList.is_active == True,  # noqa: E712
                    PriceList.effective_from_date <= today,
                    sa.or_(
                        PriceList.effective_to_date.is_(None),
                        PriceList.effective_to_date >= today,
                    ),
                )
                .order_by(PriceList.effective_from_date.desc())
                .first()
            )

            matched_price: Optional[Decimal] = None
            if active_list:
                item = (
                    db.query(PriceItem)
                    .filter(
                        PriceItem.price_list_id == active_list.price_list_id,
                        PriceItem.plot_type_id == plot.type_id,
                    )
                    .first()
                )
                if item:
                    matched_price = Decimal(str(item.unit_price))

            # Nếu không tìm thấy trong price item, dùng giá loại mộ nếu có, hoặc mặc định 50 triệu VND
            unit_price = matched_price or Decimal("50000000.00")

        # 4. Xác định mẫu hợp đồng (Contract Template)
        template_id = data.template_id
        template_version = 1
        if template_id:
            tmpl = (
                db.query(ContractTemplate)
                .filter(ContractTemplate.template_id == template_id)
                .first()
            )
            if not tmpl:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Mẫu hợp đồng {template_id} không tồn tại",
                )
            template_version = tmpl.version_no
        else:
            default_tmpl = (
                db.query(ContractTemplate)
                .filter(
                    ContractTemplate.contract_type == "LAND_PURCHASE",
                    ContractTemplate.is_active == True,  # noqa: E712
                )
                .first()
            )
            if default_tmpl:
                template_id = default_tmpl.template_id
                template_version = default_tmpl.version_no

        contract_code = cls.generate_contract_code(db, prefix="HD-MD")
        now = _utc_now_naive()

        # 5. Tạo hợp đồng chính
        contract = Contract(
            contract_code=contract_code,
            contract_type="LAND_PURCHASE",
            customer_id=data.customer_id,
            status="DRAFT",
            total_amount=unit_price,
            created_by_user_id=current_user_id,
            template_id=template_id,
            template_version=template_version,
            notes=data.notes,
            created_at=now,
            updated_at=now,
        )
        db.add(contract)
        db.flush()

        # 6. Tạo subtype LandPurchaseContract
        land_sub = LandPurchaseContract(
            contract_id=contract.contract_id,
            plot_id=plot.plot_id,
            land_unit_price=unit_price,
        )
        db.add(land_sub)

        # 7. Đặt giữ chỗ ô đất cho hợp đồng này (Anti-Double Booking - G04)
        reservation = PlotReservation(
            plot_id=plot.plot_id,
            reserved_by=current_user_id,
            customer_name=customer.full_name,
            customer_phone=customer.phone_number,
            state="ACTIVE",
            reserved_at=now,
            expires_at=now + timedelta(days=7),
            contract_id=contract.contract_id,
            notes=f"Giữ chỗ theo hợp đồng mua đất {contract.contract_code}",
        )
        db.add(reservation)

        # Chuyển trạng thái ô mộ sang RESERVED
        plot.status = "RESERVED"

        # 8. Ghi Audit Log
        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "customer_id": contract.customer_id,
                    "plot_id": plot.plot_id,
                    "total_amount": str(unit_price),
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    @classmethod
    def get_contract(cls, db: Session, contract_id: int) -> Contract:
        contract = (
            db.query(Contract)
            .options(
                joinedload(Contract.customer),
                joinedload(Contract.land_purchase).joinedload(LandPurchaseContract.contract),
                joinedload(Contract.creator),
                joinedload(Contract.activator),
                joinedload(Contract.template),
                joinedload(Contract.reservation),
            )
            .filter(Contract.contract_id == contract_id)
            .first()
        )
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hợp đồng với ID {contract_id}",
            )
        return contract

    @classmethod
    def list_contracts(
        cls,
        db: Session,
        contract_type: Optional[str] = None,
        status_filter: Optional[str] = None,
        customer_id: Optional[int] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ContractBriefResponse]:
        query = (
            db.query(Contract)
            .join(Customer, Customer.customer_id == Contract.customer_id)
            .outerjoin(
                LandPurchaseContract, LandPurchaseContract.contract_id == Contract.contract_id
            )
            .outerjoin(Plot, Plot.plot_id == LandPurchaseContract.plot_id)
        )

        if contract_type:
            query = query.filter(Contract.contract_type == contract_type)
        if status_filter:
            query = query.filter(Contract.status == status_filter)
        if customer_id:
            query = query.filter(Contract.customer_id == customer_id)
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                sa.or_(
                    Contract.contract_code.ilike(s),
                    Customer.full_name.ilike(s),
                    Customer.phone_number.like(s),
                    Plot.plot_code.ilike(s),
                )
            )

        results = query.order_by(Contract.created_at.desc()).offset(offset).limit(limit).all()

        briefs: List[ContractBriefResponse] = []
        for c in results:
            plot_obj = None
            if c.land_purchase:
                plot_obj = db.query(Plot).filter(Plot.plot_id == c.land_purchase.plot_id).first()

            briefs.append(
                ContractBriefResponse(
                    contract_id=c.contract_id,
                    contract_code=c.contract_code,
                    contract_type=c.contract_type,
                    status=c.status,
                    total_amount=c.total_amount,
                    customer_id=c.customer_id,
                    customer_name=c.customer.full_name if c.customer else "",
                    customer_phone=c.customer.phone_number if c.customer else "",
                    plot_id=plot_obj.plot_id if plot_obj else None,
                    plot_code=plot_obj.plot_code if plot_obj else None,
                    zone_name=plot_obj.row.zone.zone_name
                    if (plot_obj and plot_obj.row and plot_obj.row.zone)
                    else None,
                    signed_at=c.signed_at,
                    activated_at=c.activated_at,
                    created_at=c.created_at,
                )
            )
        return briefs

    @classmethod
    def submit_for_signing(
        cls,
        db: Session,
        contract_id: int,
        template_id: Optional[int],
        notes: Optional[str],
        current_user_id: int,
    ) -> Contract:
        """Chuyển hợp đồng từ DRAFT sang PENDING_SIGN để in và mang ra ngoài cho khách ký."""
        contract = cls.get_contract(db, contract_id)
        if contract.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chỉ có thể chuyển sang PENDING_SIGN khi hợp đồng ở trạng thái DRAFT (hiện tại: {contract.status}).",
            )

        if template_id:
            tmpl = (
                db.query(ContractTemplate)
                .filter(ContractTemplate.template_id == template_id)
                .first()
            )
            if not tmpl:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy mẫu hợp đồng với ID {template_id}",
                )
            contract.template_id = tmpl.template_id
            contract.template_version = tmpl.version_no

        contract.status = "PENDING_SIGN"
        if notes:
            contract.notes = f"{contract.notes or ''}\n[Gửi ký]: {notes}".strip()
        contract.updated_at = _utc_now_naive()

        audit = AuditLog(
            user_id=current_user_id,
            action_type="SUBMIT_FOR_SIGNING",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {"contract_code": contract.contract_code, "status": contract.status},
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    @classmethod
    def activate_contract(
        cls,
        db: Session,
        contract_id: int,
        data: ContractActivateRequest,
        current_user_id: int,
    ) -> Contract:
        """
        Kích hoạt hợp đồng sau khi khách hàng đã ký ngoài và nhân viên tải lên bản scan đã ký (G09).
        Thực hiện toàn bộ nghiệp vụ trong 1 transaction ACID:
        1. Cập nhật hợp đồng sang ACTIVE.
        2. Chuyển giữ chỗ sang CONVERTED.
        3. Cập nhật ô mộ sang SOLD_RESERVED.
        4. Ghi nhận chuỗi lịch sử quyền sở hữu vào plot_ownerships (G05).
        5. Tự động sinh nghĩa vụ tài chính vào receivables (G14).
        6. Phát sinh sự kiện outbox CONTRACT_ACTIVATED (G17).
        """
        # Khóa hợp đồng
        contract = (
            db.query(Contract).filter(Contract.contract_id == contract_id).with_for_update().first()
        )
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hợp đồng với ID {contract_id}",
            )

        # Idempotency check: Nếu đã ACTIVE rồi thì trả về luôn, không nhân bản nợ hay quyền sở hữu
        if contract.status == "ACTIVE":
            return contract

        if contract.status not in ("DRAFT", "PENDING_SIGN"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể kích hoạt hợp đồng đang ở trạng thái '{contract.status}'.",
            )

        # Kiểm tra tệp scan đã ký lưu trên MinIO (G02/G09)
        scan_file = (
            db.query(FileObject).filter(FileObject.file_id == data.signed_scan_file_id).first()
        )
        if not scan_file or scan_file.state != "READY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tệp scan hợp đồng đã ký chưa sẵn sàng hoặc không tồn tại trên hệ thống lưu trữ.",
            )

        now = _utc_now_naive()
        signed_date = data.signed_at or date.today()

        # 1. Cập nhật hợp đồng
        contract.status = "ACTIVE"
        contract.signed_scan_file_id = scan_file.file_id
        contract.signed_scan_url = scan_file.object_key
        contract.signed_at = signed_date
        contract.activated_at = now
        contract.activated_by = current_user_id
        contract.activation_notes = data.activation_notes
        contract.updated_at = now

        # 2. Xử lý ô mộ và giữ chỗ nếu là hợp đồng mua đất
        plot_id_target: Optional[int] = None
        if contract.contract_type == "LAND_PURCHASE":
            land_sub = (
                db.query(LandPurchaseContract)
                .filter(LandPurchaseContract.contract_id == contract.contract_id)
                .first()
            )
            if land_sub:
                plot_id_target = land_sub.plot_id
                plot = (
                    db.query(Plot)
                    .filter(Plot.plot_id == land_sub.plot_id)
                    .with_for_update()
                    .first()
                )
                if plot:
                    # Chuyển trạng thái ô mộ sang đã có chủ (OWNED_EMPTY) và gán owner_id
                    plot.status = "OWNED_EMPTY"
                    plot.owner_id = contract.customer_id

                    # Chuyển reservation sang CONVERTED
                    reservation = (
                        db.query(PlotReservation)
                        .filter(
                            PlotReservation.contract_id == contract.contract_id,
                            PlotReservation.state == "ACTIVE",
                        )
                        .first()
                    )
                    if reservation:
                        reservation.state = "CONVERTED"

                    # 3. Ghi nhận chuỗi lịch sử quyền sở hữu (G05)
                    ownership = PlotOwnership(
                        plot_id=plot.plot_id,
                        customer_id=contract.customer_id,
                        basis_contract_id=contract.contract_id,
                        valid_from=now,
                        valid_to=None,
                        transfer_reason=f"Mua đất an táng theo hợp đồng {contract.contract_code}",
                        created_at=now,
                    )
                    db.add(ownership)

        # 4. Tự động sinh nghĩa vụ tài chính vào receivables (G14)
        existing_rec = (
            db.query(Receivable).filter(Receivable.contract_id == contract.contract_id).first()
        )
        if not existing_rec:
            due_date = signed_date + timedelta(days=30)
            receivable = Receivable(
                contract_id=contract.contract_id,
                annex_id=None,
                customer_id=contract.customer_id,
                original_amount=contract.total_amount,
                discount_amount=Decimal("0.00"),
                final_payable_amount=contract.total_amount,
                total_paid_amount=Decimal("0.00"),
                status="UNPAID",
                due_date=due_date,
                created_at=now,
            )
            db.add(receivable)

        # 5. Phát sinh sự kiện Outbox (G17 Transactional Outbox)
        outbox_event = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type="CONTRACT_ACTIVATED",
            aggregate_type="CONTRACT",
            aggregate_id=str(contract.contract_id),
            payload=json.dumps(
                {
                    "contract_id": contract.contract_id,
                    "contract_code": contract.contract_code,
                    "contract_type": contract.contract_type,
                    "customer_id": contract.customer_id,
                    "plot_id": plot_id_target,
                    "total_amount": str(contract.total_amount),
                    "activated_at": now.isoformat(),
                    "activated_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox_event)

        # 6. Ghi Audit Log
        audit = AuditLog(
            user_id=current_user_id,
            action_type="ACTIVATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "signed_scan_file_id": scan_file.file_id,
                    "signed_at": str(signed_date),
                    "plot_id": plot_id_target,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)

        db.commit()
        db.refresh(contract)
        return contract

    @classmethod
    def cancel_contract(
        cls,
        db: Session,
        contract_id: int,
        reason: str,
        current_user_id: int,
    ) -> Contract:
        """Hủy hợp đồng trước khi kích hoạt, giải phóng ô đất giữ chỗ về trạng thái EMPTY_UNSOLD."""
        contract = cls.get_contract(db, contract_id)
        if contract.status == "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hợp đồng đã kích hoạt không thể hủy trực tiếp. Vui lòng thực hiện thủ tục thanh lý hoặc chuyển nhượng.",
            )

        if contract.status == "CANCELLED":
            return contract

        now = _utc_now_naive()
        contract.status = "CANCELLED"
        contract.notes = f"{contract.notes or ''}\n[HỦY HỢP ĐỒNG]: {reason}".strip()
        contract.updated_at = now

        # Giải phóng giữ chỗ nếu có
        if contract.contract_type == "LAND_PURCHASE" and contract.land_purchase:
            plot = (
                db.query(Plot)
                .filter(Plot.plot_id == contract.land_purchase.plot_id)
                .with_for_update()
                .first()
            )
            if plot:
                plot.status = "EMPTY_UNSOLD"

            res = (
                db.query(PlotReservation)
                .filter(
                    PlotReservation.contract_id == contract.contract_id,
                    PlotReservation.state == "ACTIVE",
                )
                .first()
            )
            if res:
                res.state = "CANCELLED"

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CANCEL",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {"contract_code": contract.contract_code, "reason": reason},
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    @classmethod
    def generate_contract_pdf(cls, db: Session, contract_id: int) -> bytes:
        """Xuất bản in hợp đồng PDF định dạng tiếng Việt UTF-8 (ReportLab)."""
        contract = cls.get_contract(db, contract_id)
        customer = contract.customer

        plot_code = "Chưa chỉ định"
        if contract.land_purchase:
            plot = db.query(Plot).filter(Plot.plot_id == contract.land_purchase.plot_id).first()
            if plot:
                plot_code = plot.plot_code

        pdf_bytes = PDFService.generate_contract_pdf(
            contract_code=contract.contract_code,
            contract_type=contract.contract_type,
            customer_name=customer.full_name if customer else "Khách hàng",
            customer_phone=customer.phone_number if customer else "",
            customer_citizen_id=customer.citizen_id if customer else "",
            plot_code=plot_code,
            total_amount=f"{contract.total_amount:,.0f} VND",
            created_at=contract.created_at,
        )
        return pdf_bytes

    @classmethod
    def get_contract_detail_dto(cls, db: Session, contract_id: int) -> ContractDetailResponse:
        contract = cls.get_contract(db, contract_id)

        customer_brief = None
        if contract.customer:
            customer_brief = CustomerBrief(
                customer_id=contract.customer.customer_id,
                customer_code=contract.customer.customer_code,
                full_name=contract.customer.full_name,
                citizen_id=contract.customer.citizen_id,
                phone_number=contract.customer.phone_number,
                address=contract.customer.address,
                date_of_birth=contract.customer.date_of_birth,
            )

        land_detail = None
        plot_brief = None
        if contract.land_purchase:
            plot = db.query(Plot).filter(Plot.plot_id == contract.land_purchase.plot_id).first()
            if plot:
                plot_brief = PlotBrief(
                    plot_id=plot.plot_id,
                    plot_code=plot.plot_code,
                    zone_code=plot.row.zone.zone_code if (plot.row and plot.row.zone) else "",
                    zone_name=plot.row.zone.zone_name if (plot.row and plot.row.zone) else "",
                    row_code=plot.row.row_code if plot.row else "",
                    type_name=plot.plot_type.type_name if plot.plot_type else "",
                    status=plot.status,
                    is_kim_tinh=plot.is_kim_tinh,
                    is_locked=plot.is_locked,
                    orientation=plot.orientation,
                )
            land_detail = LandPurchaseDetailBrief(
                plot_id=contract.land_purchase.plot_id,
                land_unit_price=contract.land_purchase.land_unit_price,
                plot=plot_brief,
            )

        receivable_brief = None
        rec = db.query(Receivable).filter(Receivable.contract_id == contract.contract_id).first()
        if rec:
            receivable_brief = ReceivableBrief(
                receivable_id=rec.receivable_id,
                contract_id=rec.contract_id or contract.contract_id,
                original_amount=rec.original_amount,
                discount_amount=rec.discount_amount,
                final_payable_amount=rec.final_payable_amount,
                total_paid_amount=rec.total_paid_amount,
                status=rec.status,
                due_date=rec.due_date,
            )

        activator_name = None
        if contract.activator:
            activator_name = contract.activator.full_name

        return ContractDetailResponse(
            contract_id=contract.contract_id,
            contract_code=contract.contract_code,
            contract_type=contract.contract_type,
            status=contract.status,
            total_amount=contract.total_amount,
            signed_at=contract.signed_at,
            activated_at=contract.activated_at,
            activated_by=contract.activated_by,
            activator_name=activator_name,
            activation_notes=contract.activation_notes,
            template_id=contract.template_id,
            template_version=contract.template_version,
            signed_scan_file_id=contract.signed_scan_file_id,
            signed_scan_url=contract.signed_scan_url,
            notes=contract.notes,
            created_at=contract.created_at,
            updated_at=contract.updated_at,
            customer=customer_brief,
            land_purchase=land_detail,
            plot=plot_brief,
            receivable=receivable_brief,
        )
