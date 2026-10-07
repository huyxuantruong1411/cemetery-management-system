from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, require_permission
from app.modules.auth.models import User
from app.modules.finance.models import Payment
from app.modules.finance.schemas import (
    DiscountApplyRequest,
    FinanceSummaryResponse,
    InvoiceResponse,
    PaymentRecordRequest,
    PaymentResponse,
    ReceivableCreate,
    ReceivableResponse,
)
from app.modules.finance.service import FinanceService
from app.storage.minio_adapter import storage_adapter

router = APIRouter(prefix="/finance", tags=["Finance"])


@router.get(
    "/summary",
    response_model=FinanceSummaryResponse,
    summary="Thống kê tài chính & công nợ",
    dependencies=[Depends(require_permission("finance", "read"))],
)
def get_finance_summary(db: Session = Depends(get_db)):
    return FinanceService.get_summary(db)


@router.get(
    "/receivables",
    response_model=List[ReceivableResponse],
    summary="Danh sách các khoản phải thu",
    dependencies=[Depends(require_permission("finance", "read"))],
)
def list_receivables(
    status: Optional[str] = Query(
        None, description="Lọc theo trạng thái (UNPAID, PARTIALLY_PAID, PAID, CANCELLED)"
    ),
    customer_id: Optional[int] = Query(None, description="Lọc theo khách hàng"),
    contract_id: Optional[int] = Query(None, description="Lọc theo hợp đồng"),
    annex_id: Optional[int] = Query(None, description="Lọc theo phụ lục"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên khách, SĐT, số HĐ/phụ lục"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return FinanceService.get_receivables(
        db=db,
        status_filter=status,
        customer_id=customer_id,
        contract_id=contract_id,
        annex_id=annex_id,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/receivables/{receivable_id}",
    response_model=ReceivableResponse,
    summary="Chi tiết khoản phải thu",
    dependencies=[Depends(require_permission("finance", "read"))],
)
def get_receivable(receivable_id: int, db: Session = Depends(get_db)):
    return FinanceService.get_receivable_by_id(db, receivable_id)


@router.post(
    "/receivables",
    response_model=ReceivableResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới khoản phải thu thủ công",
    dependencies=[Depends(require_permission("finance", "write"))],
)
def create_receivable(
    payload: ReceivableCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FinanceService.create_receivable(db, payload, current_user.user_id)


@router.post(
    "/receivables/{receivable_id}/discount",
    response_model=ReceivableResponse,
    summary="Áp dụng chiết khấu cho khoản thu (G16)",
    dependencies=[Depends(require_permission("finance", "discount"))],
)
def apply_discount(
    receivable_id: int,
    payload: DiscountApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FinanceService.apply_discount(db, receivable_id, payload, current_user.user_id)


@router.post(
    "/receivables/{receivable_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tiếp nhận thanh toán và tự động xuất biên lai (G15)",
    dependencies=[Depends(require_permission("finance", "write"))],
)
def record_payment(
    receivable_id: int,
    payload: PaymentRecordRequest,
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FinanceService.record_payment(
        db=db,
        receivable_id=receivable_id,
        payload=payload,
        user_id=current_user.user_id,
        idempotency_key=x_idempotency_key,
    )


@router.get(
    "/payments/{payment_id}/receipt",
    response_model=InvoiceResponse,
    summary="Thông tin biên lai thu tiền",
    dependencies=[Depends(require_permission("finance", "read"))],
)
def get_payment_receipt(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment or not payment.invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy biên lai cho giao dịch thanh toán {payment_id}",
        )
    inv = payment.invoice
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


@router.get(
    "/payments/{payment_id}/receipt/download",
    summary="Tải về tệp PDF biên lai thu tiền",
    dependencies=[Depends(require_permission("finance", "read"))],
)
def download_payment_receipt_pdf(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment or not payment.invoice or not payment.invoice.file_object:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tệp biên lai PDF cho thanh toán {payment_id}",
        )
    file_obj = payment.invoice.file_object
    try:
        content, mime_type = storage_adapter.get_object(file_obj.object_key)
        safe_ascii = file_obj.file_name.encode("ascii", "ignore").decode() or "invoice.pdf"
        encoded_name = quote(file_obj.file_name)
        return Response(
            content=content,
            media_type=mime_type or "application/pdf",
            headers={"Content-Disposition": f"inline; filename=\"{safe_ascii}\"; filename*=UTF-8''{encoded_name}"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đọc tệp từ MinIO: {str(e)}",
        ) from e
