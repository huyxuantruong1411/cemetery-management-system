import hashlib
import json
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.contracts.models import Contract, ContractAnnex
from app.modules.documents.models import FileObject
from app.modules.documents.service import DocumentService
from app.modules.finance.currency_words import number_to_vietnamese_words
from app.modules.finance.models import (
    DiscountRecord,
    IdempotencyRequest,
    Invoice,
    Payment,
    Receivable,
)
from app.modules.finance.schemas import (
    DiscountApplyRequest,
    DiscountResponse,
    FinanceSummaryResponse,
    InvoiceResponse,
    PaymentRecordRequest,
    PaymentResponse,
    ReceivableCreate,
    ReceivableResponse,
)
from app.modules.jobs.service import OutboxService
from app.modules.profiles.models import Customer
from app.services.pdf_service import PDFService


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class FinanceService:
    @classmethod
    def _to_receivable_response(cls, r: Receivable) -> ReceivableResponse:
        contract_code = r.contract.contract_code if r.contract else None
        annex_code = r.annex.annex_code if r.annex else None
        customer_name = r.customer.full_name if r.customer else None
        customer_phone = r.customer.phone_number if r.customer else None

        remaining = max(Decimal("0.00"), r.final_payable_amount - r.total_paid_amount)

        discounts = [
            DiscountResponse(
                discount_id=d.discount_id,
                receivable_id=d.receivable_id,
                discount_type=d.discount_type,
                discount_value=d.discount_value,
                calculated_amount=d.calculated_amount,
                justification_reason=d.justification_reason,
                approved_by_user_id=d.approved_by_user_id,
                applied_at=d.applied_at,
            )
            for d in r.discounts
        ]

        payments = []
        for p in r.payments:
            inv_res = None
            if p.invoice:
                inv_res = InvoiceResponse(
                    invoice_id=p.invoice.invoice_id,
                    invoice_number=p.invoice.invoice_number,
                    payment_id=p.invoice.payment_id,
                    issued_date=p.invoice.issued_date,
                    total_amount_in_words=p.invoice.total_amount_in_words,
                    pdf_file_url=p.invoice.pdf_file_url,
                    file_id=p.invoice.file_id,
                    notes=p.invoice.notes,
                )
            payments.append(
                PaymentResponse(
                    payment_id=p.payment_id,
                    receivable_id=p.receivable_id,
                    paid_amount=p.paid_amount,
                    payment_method=p.payment_method,
                    transaction_reference=p.transaction_reference,
                    paid_at=p.paid_at,
                    recorded_by_user_id=p.recorded_by_user_id,
                    recorder_name=p.recorder.full_name if p.recorder else None,
                    invoice=inv_res,
                )
            )

        return ReceivableResponse(
            receivable_id=r.receivable_id,
            contract_id=r.contract_id,
            contract_code=contract_code,
            annex_id=r.annex_id,
            annex_code=annex_code,
            customer_id=r.customer_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            original_amount=r.original_amount,
            discount_amount=r.discount_amount,
            final_payable_amount=r.final_payable_amount,
            total_paid_amount=r.total_paid_amount,
            remaining_balance=remaining,
            status=r.status,
            due_date=r.due_date,
            notes=r.notes,
            installment_no=r.installment_no,
            created_at=r.created_at,
            discounts=discounts,
            payments=payments,
        )

    @classmethod
    def get_receivables(
        cls,
        db: Session,
        status_filter: str | None = None,
        customer_id: int | None = None,
        contract_id: int | None = None,
        annex_id: int | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ReceivableResponse]:
        query = db.query(Receivable)

        if status_filter:
            query = query.filter(Receivable.status == status_filter)
        if customer_id:
            query = query.filter(Receivable.customer_id == customer_id)
        if contract_id:
            query = query.filter(Receivable.contract_id == contract_id)
        if annex_id:
            query = query.filter(Receivable.annex_id == annex_id)

        if search:
            search_pattern = f"%{search}%"
            query = (
                query.join(Receivable.customer)
                .outerjoin(Receivable.contract)
                .outerjoin(Receivable.annex)
                .filter(
                    (Customer.full_name.ilike(search_pattern))
                    | (Customer.phone_number.ilike(search_pattern))
                    | (Contract.contract_code.ilike(search_pattern))
                    | (ContractAnnex.annex_code.ilike(search_pattern))
                )
            )

        receivables = (
            query.order_by(Receivable.due_date.asc(), Receivable.receivable_id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [cls._to_receivable_response(r) for r in receivables]

    @classmethod
    def get_receivable_by_id(cls, db: Session, receivable_id: int) -> ReceivableResponse:
        receivable = db.query(Receivable).filter(Receivable.receivable_id == receivable_id).first()
        if not receivable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khoản thu mã {receivable_id}",
            )
        return cls._to_receivable_response(receivable)

    @classmethod
    def create_receivable(
        cls,
        db: Session,
        payload: ReceivableCreate,
        user_id: int,
    ) -> ReceivableResponse:
        # 1. Validate XOR source (G14)
        if (payload.contract_id is not None and payload.annex_id is not None) or (
            payload.contract_id is None and payload.annex_id is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Khoản thu phải gắn với đúng một nguồn: hoặc hợp đồng chính, hoặc phụ lục.",
            )

        # 2. Validate customer
        cust = db.query(Customer).filter(Customer.customer_id == payload.customer_id).first()
        if not cust:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khách hàng mã {payload.customer_id}",
            )

        # 3. Check idempotency on (contract_id, installment_no) or (annex_id, installment_no)
        if payload.contract_id:
            contract = (
                db.query(Contract).filter(Contract.contract_id == payload.contract_id).first()
            )
            if not contract:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy hợp đồng mã {payload.contract_id}",
                )
            existing = (
                db.query(Receivable)
                .filter(
                    Receivable.contract_id == payload.contract_id,
                    Receivable.installment_no == payload.installment_no,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Khoản thu đợt {payload.installment_no} cho hợp đồng {contract.contract_code} đã tồn tại.",
                )

        if payload.annex_id:
            annex = (
                db.query(ContractAnnex).filter(ContractAnnex.annex_id == payload.annex_id).first()
            )
            if not annex:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy phụ lục mã {payload.annex_id}",
                )
            existing = (
                db.query(Receivable)
                .filter(
                    Receivable.annex_id == payload.annex_id,
                    Receivable.installment_no == payload.installment_no,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Khoản thu đợt {payload.installment_no} cho phụ lục {annex.annex_code} đã tồn tại.",
                )

        now = _utc_now_naive()
        receivable = Receivable(
            contract_id=payload.contract_id,
            annex_id=payload.annex_id,
            customer_id=payload.customer_id,
            original_amount=payload.original_amount,
            discount_amount=Decimal("0.00"),
            final_payable_amount=payload.original_amount,
            total_paid_amount=Decimal("0.00"),
            status="UNPAID",
            due_date=payload.due_date,
            notes=payload.notes,
            created_by_user_id=user_id,
            installment_no=payload.installment_no,
            created_at=now,
        )

        db.add(receivable)
        db.commit()
        db.refresh(receivable)

        audit = AuditLog(
            user_id=user_id,
            action_type="CREATE",
            target_entity="receivables",
            target_id=str(receivable.receivable_id),
            post_change_values=json.dumps(
                {
                    "original_amount": str(receivable.original_amount),
                    "contract_id": receivable.contract_id,
                    "annex_id": receivable.annex_id,
                    "customer_id": receivable.customer_id,
                }
            ),
        )
        db.add(audit)
        db.commit()

        OutboxService.publish_event(
            db=db,
            aggregate_type="RECEIVABLE",
            aggregate_id=str(receivable.receivable_id),
            event_type="RECEIVABLE_CREATED",
            payload={
                "receivable_id": receivable.receivable_id,
                "customer_id": receivable.customer_id,
                "amount": str(receivable.original_amount),
                "due_date": receivable.due_date.isoformat(),
            },
        )

        return cls._to_receivable_response(receivable)

    @classmethod
    def apply_discount(
        cls,
        db: Session,
        receivable_id: int,
        payload: DiscountApplyRequest,
        user_id: int,
    ) -> ReceivableResponse:
        """Apply a single official discount to a receivable (G16). Ensures remaining debt is non-negative."""
        # Row-level lock on receivable
        receivable = (
            db.query(Receivable)
            .filter(Receivable.receivable_id == receivable_id)
            .with_for_update()
            .first()
        )
        if not receivable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khoản thu mã {receivable_id}",
            )

        if receivable.status in ("PAID", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Khoản thu đang ở trạng thái {receivable.status}, không được phép áp dụng chiết khấu.",
            )

        if receivable.discounts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Khoản thu này đã được áp dụng chiết khấu trước đó. Mỗi khoản thu chỉ chấp nhận một chiết khấu chính thức.",
            )

        # Calculate discount amount
        if payload.discount_type == "PERCENTAGE":
            calc = (receivable.original_amount * payload.discount_value / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            calc = min(payload.discount_value, receivable.original_amount).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        new_final = receivable.original_amount - calc

        # Invariant: Discount after partial payment must not make final payable amount less than total paid amount
        if new_final < receivable.total_paid_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Giá trị chiết khấu ({calc:,.0f} đ) làm số tiền phải thu ({new_final:,.0f} đ) "
                    f"nhỏ hơn số tiền khách hàng đã thanh toán ({receivable.total_paid_amount:,.0f} đ)."
                ),
            )

        now = _utc_now_naive()
        discount_record = DiscountRecord(
            receivable_id=receivable.receivable_id,
            discount_type=payload.discount_type,
            discount_value=payload.discount_value,
            calculated_amount=calc,
            justification_reason=payload.justification_reason,
            approved_by_user_id=user_id,
            applied_at=now,
        )
        db.add(discount_record)

        # Update receivable amounts and recompute status
        receivable.discount_amount = calc
        receivable.final_payable_amount = new_final

        if receivable.total_paid_amount >= receivable.final_payable_amount:
            receivable.status = "PAID"
        elif receivable.total_paid_amount > 0:
            receivable.status = "PARTIALLY_PAID"
        else:
            receivable.status = "UNPAID"

        db.commit()
        db.refresh(receivable)

        audit = AuditLog(
            user_id=user_id,
            action_type="DISCOUNT_APPLY",
            target_entity="receivables",
            target_id=str(receivable.receivable_id),
            post_change_values=json.dumps(
                {
                    "discount_type": payload.discount_type,
                    "discount_value": str(payload.discount_value),
                    "calculated_amount": str(calc),
                    "final_payable_amount": str(new_final),
                    "reason": payload.justification_reason,
                }
            ),
        )
        db.add(audit)
        db.commit()

        OutboxService.publish_event(
            db=db,
            aggregate_type="RECEIVABLE",
            aggregate_id=str(receivable.receivable_id),
            event_type="DISCOUNT_APPLIED",
            payload={
                "receivable_id": receivable.receivable_id,
                "discount_id": discount_record.discount_id,
                "discount_amount": str(calc),
                "final_payable_amount": str(new_final),
            },
        )

        return cls._to_receivable_response(receivable)

    @classmethod
    def record_payment(
        cls,
        db: Session,
        receivable_id: int,
        payload: PaymentRecordRequest,
        user_id: int,
        idempotency_key: str | None = None,
    ) -> PaymentResponse:
        """Record an append-only payment, trigger-synced receivable balance, and auto-generate invoice (G15)."""
        idem_key = idempotency_key or payload.idempotency_key
        norm_amount = Decimal(str(payload.paid_amount)).quantize(Decimal("0.01"))
        norm_ref = (payload.transaction_reference or "").strip()
        norm_method = (payload.payment_method or "").strip().upper()
        req_hash = hashlib.sha256(
            f"{receivable_id}_{norm_amount}_{norm_method}_{norm_ref}_{idem_key}".encode()
        ).hexdigest()

        # 1. Lock and validate receivable BEFORE registering in-progress idempotency
        receivable = (
            db.query(Receivable)
            .filter(Receivable.receivable_id == receivable_id)
            .with_for_update()
            .first()
        )
        if not receivable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khoản thu mã {receivable_id}",
            )

        if receivable.status == "PAID":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Khoản thu này đã được thanh toán toàn bộ trước đó.",
            )

        if receivable.status == "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Khoản thu này đã bị hủy, không thể tiếp nhận thanh toán.",
            )

        remaining_debt = receivable.final_payable_amount - receivable.total_paid_amount
        if payload.paid_amount > remaining_debt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Số tiền thanh toán ({payload.paid_amount:,.0f} đ) vượt quá "
                    f"dư nợ hiện tại ({remaining_debt:,.0f} đ)."
                ),
            )

        # 2. Check idempotency request
        if idem_key:
            existing_req = (
                db.query(IdempotencyRequest)
                .filter(
                    IdempotencyRequest.actor_user_id == user_id,
                    IdempotencyRequest.operation == "PAYMENT_RECORD",
                    IdempotencyRequest.idempotency_key == idem_key,
                )
                .first()
            )
            if existing_req:
                if existing_req.request_hash and existing_req.request_hash != req_hash:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Xung đột khóa chống trùng: Tham số thanh toán không khớp với yêu cầu trước đó sử dụng cùng Idempotency Key.",
                    )
                if existing_req.status == "COMPLETED" and existing_req.response_body:
                    cached_data = json.loads(existing_req.response_body)
                    return PaymentResponse(**cached_data)
                elif existing_req.status == "IN_PROGRESS":
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Giao dịch thanh toán đang được xử lý song song. Vui lòng thử lại sau.",
                    )

            # Register in-progress idempotency record
            idem_record = IdempotencyRequest(
                request_id=hashlib.sha256(
                    f"{user_id}_{idem_key}_{_utc_now_naive()}".encode()
                ).hexdigest()[:64],
                actor_user_id=user_id,
                operation="PAYMENT_RECORD",
                idempotency_key=idem_key,
                request_hash=req_hash,
                status="IN_PROGRESS",
                created_at=_utc_now_naive(),
            )
            db.add(idem_record)
            db.commit()

        now = _utc_now_naive()
        payment = Payment(
            receivable_id=receivable.receivable_id,
            paid_amount=payload.paid_amount,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
            paid_at=now,
            recorded_by_user_id=user_id,
        )
        db.add(payment)
        # Commit to let MSSQL trigger trg_payments_sync_receivable_balance update receivable
        db.commit()

        # Retrieve generated payment_id
        saved_payment = (
            db.query(Payment)
            .filter(
                Payment.receivable_id == receivable.receivable_id,
                Payment.paid_amount == payload.paid_amount,
                Payment.recorded_by_user_id == user_id,
            )
            .order_by(Payment.payment_id.desc())
            .first()
        )
        payment_id = saved_payment.payment_id if saved_payment else payment.payment_id

        # Refresh receivable to see trigger changes
        db.refresh(receivable)

        recorder = db.query(User).filter(User.user_id == user_id).first()
        recorder_name = recorder.full_name if recorder else "Nhân viên thu ngân"

        # 2. Auto-generate receipt / invoice PDF (Fault isolated)
        inv_res = None
        invoice_number = None
        try:
            invoice_number = cls._generate_receipt_number(db)
            amount_words = number_to_vietnamese_words(payload.paid_amount)

            source_code = (
                receivable.contract.contract_code
                if receivable.contract
                else (
                    receivable.annex.annex_code
                    if receivable.annex
                    else f"REC-{receivable.receivable_id}"
                )
            )
            reason_content = f"Thanh toán đợt {receivable.installment_no} - " + (
                "Hợp đồng mua đất" if receivable.contract else "Phụ lục dịch vụ nghĩa trang"
            )

            method_labels = {
                "CASH": "Tiền mặt",
                "BANK_TRANSFER": "Chuyển khoản ngân hàng",
                "VIET_QR": "Mã QR / VietQR",
            }

            pdf_bytes = PDFService.generate_receipt_pdf(
                invoice_number=invoice_number,
                customer_name=receivable.customer.full_name,
                customer_phone=receivable.customer.phone_number,
                customer_address=receivable.customer.address or "",
                reason_content=reason_content,
                source_code=source_code,
                paid_amount_str=f"{payload.paid_amount:,.0f} VNĐ",
                total_amount_in_words=amount_words,
                payment_method_str=method_labels.get(
                    payload.payment_method, payload.payment_method
                ),
                transaction_reference=payload.transaction_reference,
                recorder_name=recorder_name,
                issued_date=now,
            )

            file_obj = DocumentService.upload_file(
                db=db,
                file_name=f"BienLai_{invoice_number}.pdf",
                content=pdf_bytes,
                user_id=user_id,
            )

            invoice = Invoice(
                invoice_number=invoice_number,
                payment_id=payment_id,
                issued_date=now,
                total_amount_in_words=amount_words,
                pdf_file_url=f"/api/v1/documents/{file_obj.file_id}/download",
                file_id=file_obj.file_id,
                created_by_user_id=user_id,
            )
            db.add(invoice)
            db.commit()
            db.refresh(invoice)

            inv_res = InvoiceResponse(
                invoice_id=invoice.invoice_id,
                invoice_number=invoice.invoice_number,
                payment_id=invoice.payment_id,
                issued_date=invoice.issued_date,
                total_amount_in_words=invoice.total_amount_in_words,
                pdf_file_url=invoice.pdf_file_url,
                file_id=invoice.file_id,
                notes=invoice.notes,
            )
        except Exception:
            db.rollback()
            inv_res = None

        # 3. Construct response
        response = PaymentResponse(
            payment_id=payment_id,
            receivable_id=receivable.receivable_id,
            paid_amount=payload.paid_amount,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
            paid_at=now,
            recorded_by_user_id=user_id,
            recorder_name=recorder_name,
            invoice=inv_res,
        )

        # 4. Mark idempotency complete
        if idem_key:
            idem = (
                db.query(IdempotencyRequest)
                .filter(
                    IdempotencyRequest.actor_user_id == user_id,
                    IdempotencyRequest.operation == "PAYMENT_RECORD",
                    IdempotencyRequest.idempotency_key == idem_key,
                )
                .first()
            )
            if idem:
                idem.status = "COMPLETED"
                idem.response_code = 200
                idem.response_body = response.model_dump_json()
                db.commit()

        # 5. Audit & Outbox
        audit = AuditLog(
            user_id=user_id,
            action_type="PAYMENT_RECORD",
            target_entity="payments",
            target_id=str(payment_id),
            post_change_values=json.dumps(
                {
                    "receivable_id": receivable.receivable_id,
                    "paid_amount": str(payload.paid_amount),
                    "payment_method": payload.payment_method,
                    "invoice_number": invoice_number,
                    "new_receivable_status": receivable.status,
                }
            ),
        )
        db.add(audit)
        db.commit()

        OutboxService.publish_event(
            db=db,
            aggregate_type="PAYMENT",
            aggregate_id=str(payment_id),
            event_type="PAYMENT_RECORDED",
            payload={
                "payment_id": payment_id,
                "receivable_id": receivable.receivable_id,
                "paid_amount": str(payload.paid_amount),
                "invoice_number": invoice_number,
                "receivable_status": receivable.status,
            },
        )

        return response

    @classmethod
    def _generate_receipt_number(cls, db: Session) -> str:
        now = datetime.now()
        prefix = f"REC-{now.strftime('%Y%m')}-"
        last_inv = (
            db.query(Invoice.invoice_number)
            .filter(Invoice.invoice_number.like(f"{prefix}%"))
            .order_by(Invoice.invoice_id.desc())
            .first()
        )
        if last_inv and last_inv[0]:
            try:
                seq = int(last_inv[0].split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    @classmethod
    def get_summary(cls, db: Session) -> FinanceSummaryResponse:
        """Dashboard statistics calculated directly from payments and receivables (G14, M11)."""
        today = date.today()

        total_rec = db.query(
            func.coalesce(func.sum(Receivable.final_payable_amount), Decimal("0.00"))
        ).scalar()
        total_collected = db.query(
            func.coalesce(func.sum(Payment.paid_amount), Decimal("0.00"))
        ).scalar()
        total_discount = db.query(
            func.coalesce(func.sum(Receivable.discount_amount), Decimal("0.00"))
        ).scalar()

        # Outstanding = sum of (final_payable_amount - total_paid_amount) for UNPAID or PARTIALLY_PAID
        active_rec = (
            db.query(Receivable).filter(Receivable.status.in_(["UNPAID", "PARTIALLY_PAID"])).all()
        )
        total_outstanding = sum(
            (r.final_payable_amount - r.total_paid_amount for r in active_rec),
            Decimal("0.00"),
        )

        count_unpaid = db.query(Receivable).filter(Receivable.status == "UNPAID").count()
        count_partially = db.query(Receivable).filter(Receivable.status == "PARTIALLY_PAID").count()
        count_paid = db.query(Receivable).filter(Receivable.status == "PAID").count()
        count_overdue = (
            db.query(Receivable)
            .filter(
                Receivable.due_date < today,
                Receivable.status.in_(["UNPAID", "PARTIALLY_PAID"]),
            )
            .count()
        )

        return FinanceSummaryResponse(
            total_receivables_amount=total_rec,
            total_collected_amount=total_collected,
            total_outstanding_amount=total_outstanding,
            total_discounts_amount=total_discount,
            count_unpaid=count_unpaid,
            count_partially_paid=count_partially,
            count_paid=count_paid,
            count_overdue=count_overdue,
        )

    @classmethod
    def regenerate_invoice(cls, db: Session, payment_id: int, user_id: int) -> InvoiceResponse:
        payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy giao dịch thanh toán {payment_id}",
            )
        if payment.invoice:
            inv = payment.invoice
            file_obj = db.get(FileObject, inv.file_id) if inv.file_id else None
            if file_obj and file_obj.state == "READY":
                return InvoiceResponse(
                    invoice_id=inv.invoice_id,
                    invoice_number=inv.invoice_number,
                    payment_id=inv.payment_id,
                    issued_date=inv.issued_date,
                    total_amount_in_words=inv.total_amount_in_words,
                    pdf_file_url=inv.pdf_file_url,
                    file_id=inv.file_id,
                    notes=inv.notes,
                )

        receivable = payment.receivable
        now = _utc_now_naive()
        invoice_number = (
            payment.invoice.invoice_number if payment.invoice else cls._generate_receipt_number(db)
        )
        amount_words = number_to_vietnamese_words(payment.paid_amount)
        source_code = (
            receivable.contract.contract_code
            if receivable.contract
            else (
                receivable.annex.annex_code
                if receivable.annex
                else f"REC-{receivable.receivable_id}"
            )
        )
        reason_content = f"Thanh toán đợt {receivable.installment_no} - " + (
            "Hợp đồng mua đất" if receivable.contract else "Phụ lục dịch vụ nghĩa trang"
        )
        recorder = db.query(User).filter(User.user_id == user_id).first()
        recorder_name = recorder.full_name if recorder else "Nhân viên thu ngân"

        method_labels = {
            "CASH": "Tiền mặt",
            "BANK_TRANSFER": "Chuyển khoản ngân hàng",
            "VIET_QR": "Mã QR / VietQR",
        }

        pdf_bytes = PDFService.generate_receipt_pdf(
            invoice_number=invoice_number,
            customer_name=receivable.customer.full_name,
            customer_phone=receivable.customer.phone_number,
            customer_address=receivable.customer.address or "",
            reason_content=reason_content,
            source_code=source_code,
            paid_amount_str=f"{payment.paid_amount:,.0f} VNĐ",
            total_amount_in_words=amount_words,
            payment_method_str=method_labels.get(payment.payment_method, payment.payment_method),
            transaction_reference=payment.transaction_reference,
            recorder_name=recorder_name,
            issued_date=now,
        )

        file_obj = DocumentService.upload_file(
            db=db,
            file_name=f"BienLai_{invoice_number}.pdf",
            content=pdf_bytes,
            user_id=user_id,
        )

        if payment.invoice:
            invoice = payment.invoice
            invoice.file_id = file_obj.file_id
            invoice.pdf_file_url = f"/api/v1/documents/{file_obj.file_id}/download"
            invoice.total_amount_in_words = amount_words
        else:
            invoice = Invoice(
                invoice_number=invoice_number,
                payment_id=payment.payment_id,
                issued_date=now,
                total_amount_in_words=amount_words,
                pdf_file_url=f"/api/v1/documents/{file_obj.file_id}/download",
                file_id=file_obj.file_id,
                created_by_user_id=user_id,
            )
            db.add(invoice)
        db.commit()
        db.refresh(invoice)

        return InvoiceResponse(
            invoice_id=invoice.invoice_id,
            invoice_number=invoice.invoice_number,
            payment_id=invoice.payment_id,
            issued_date=invoice.issued_date,
            total_amount_in_words=invoice.total_amount_in_words,
            pdf_file_url=invoice.pdf_file_url,
            file_id=invoice.file_id,
            notes=invoice.notes,
        )

    @classmethod
    def get_finance_bases(cls, db: Session) -> list[dict]:
        """Fetch billing and obligation bases for Accountant (EX-02 / FinanceBasis)."""
        from app.modules.contracts.models import (
            Contract,
            ContractAnnex,
            LandPurchaseContract,
            TransferContract,
        )

        results = []
        # Contracts
        contracts = (
            db.query(Contract)
            .options(
                joinedload(Contract.customer),
                joinedload(Contract.land_purchase).joinedload(LandPurchaseContract.plot),
                joinedload(Contract.transfer).joinedload(TransferContract.plot),
            )
            .filter(Contract.status.in_(["ACTIVE", "SIGNED", "PENDING_ACTIVATION"]))
            .order_by(Contract.created_at.desc())
            .all()
        )
        contract_ids = [c.contract_id for c in contracts]
        contract_recs = {
            r.contract_id: r
            for r in db.query(Receivable).filter(Receivable.contract_id.in_(contract_ids)).all()
        } if contract_ids else {}

        for c in contracts:
            plot_code = None
            if c.land_purchase and c.land_purchase.plot:
                plot_code = c.land_purchase.plot.plot_code
            elif c.transfer and c.transfer.plot:
                plot_code = c.transfer.plot.plot_code

            rec = contract_recs.get(c.contract_id)
            paid = rec.total_paid_amount if rec else Decimal("0.00")
            bal = (rec.final_payable_amount - rec.total_paid_amount) if rec else c.total_amount
            due = rec.due_date if rec else None

            results.append({
                "contract_id": c.contract_id,
                "contract_code": c.contract_code,
                "contract_type": c.contract_type,
                "annex_id": None,
                "annex_code": None,
                "source_type": "CONTRACT",
                "status": c.status,
                "signed_at": c.signed_at,
                "payer_name": c.customer.full_name if c.customer else None,
                "payer_phone": c.customer.phone_number if c.customer else None,
                "plot_code": plot_code,
                "total_amount": c.total_amount,
                "paid_amount": paid,
                "balance": bal,
                "due_date": due,
                "service_description": {"LAND_PURCHASE": "Mua quyền sử dụng đất", "TRANSFER": "Chuyển nhượng", "EXHUMATION": "Cải táng", "CREMATION": "Hỏa táng"}.get(c.contract_type, "Hợp đồng dịch vụ"),
            })

        # Annexes
        annexes = (
            db.query(ContractAnnex)
            .options(
                joinedload(ContractAnnex.contract).joinedload(Contract.customer),
                joinedload(ContractAnnex.burial),
                joinedload(ContractAnnex.care),
                joinedload(ContractAnnex.construction),
            )
            .filter(ContractAnnex.status.in_(["ACTIVE", "SIGNED"]))
            .order_by(ContractAnnex.created_at.desc())
            .all()
        )
        annex_ids = [a.annex_id for a in annexes]
        annex_recs = {
            r.annex_id: r
            for r in db.query(Receivable).filter(Receivable.annex_id.in_(annex_ids)).all()
        } if annex_ids else {}

        for a in annexes:
            if a.additional_amount > 0:
                rec = annex_recs.get(a.annex_id)
                paid = rec.total_paid_amount if rec else Decimal("0.00")
                bal = (rec.final_payable_amount - rec.total_paid_amount) if rec else a.additional_amount
                due = rec.due_date if rec else a.valid_from

                results.append({
                    "contract_id": a.contract_id,
                    "contract_code": a.contract.contract_code if a.contract else "",
                    "contract_type": a.contract.contract_type if a.contract else "",
                    "annex_id": a.annex_id,
                    "annex_code": a.annex_code,
                    "source_type": "ANNEX",
                    "status": a.status,
                    "signed_at": a.signed_at,
                    "payer_name": a.contract.customer.full_name if (a.contract and a.contract.customer) else None,
                    "payer_phone": a.contract.customer.phone_number if (a.contract and a.contract.customer) else None,
                    "plot_code": None,
                    "total_amount": a.additional_amount,
                    "paid_amount": paid,
                    "balance": bal,
                    "due_date": due,
                    "service_description": {"BURIAL": "An táng", "CARE": "Chăm sóc mộ phần", "CONSTRUCTION": "Xây dựng mộ"}.get(a.annex_type, "Dịch vụ bổ sung"),
                })
        return results
