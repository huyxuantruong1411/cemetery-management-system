import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.documents.service import DocumentService
from app.modules.jobs.models import BackgroundJob
from app.modules.jobs.service import JobService
from app.services.pdf_service import PDFService

router = APIRouter(prefix="/jobs", tags=["Background Jobs & Outbox"])


class JobResponse(BaseModel):
    job_id: str
    job_type: str
    state: str
    attempts: int
    max_attempts: int
    payload: str
    result: str | None = None
    last_error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class EnqueuePDFJobRequest(BaseModel):
    contract_code: str
    contract_type: str = "LAND_PURCHASE"
    customer_name: str
    customer_phone: str
    customer_citizen_id: str
    plot_code: str
    total_amount: str


@router.post(
    "/generate-pdf",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Đưa tác vụ sinh PDF vào hàng đợi (Asynchronous job)",
)
def enqueue_pdf_job(
    req: EnqueuePDFJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Đưa yêu cầu sinh PDF hợp đồng vào hàng đợi tác vụ nền bền vững."""
    job = JobService.enqueue_job(
        db=db,
        job_type="GENERATE_PDF_CONTRACT",
        payload={
            "contract_code": req.contract_code,
            "contract_type": req.contract_type,
            "customer_name": req.customer_name,
            "customer_phone": req.customer_phone,
            "customer_citizen_id": req.customer_citizen_id,
            "plot_code": req.plot_code,
            "total_amount": req.total_amount,
            "requested_by_user_id": current_user.user_id,
        },
    )
    return job


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Kiểm tra trạng thái tác vụ nền",
)
def get_job_status(
    job_id: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Truy vấn tiến độ xử lý và kết quả của tác vụ nền."""
    job = db.get(BackgroundJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tác vụ không tồn tại.",
        )
    return job


@router.post(
    "/{job_id}/process",
    response_model=JobResponse,
    summary="Thực thi tác vụ nền (Worker claim & run)",
)
def process_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Giả lập worker nhận tác vụ và thực hiện sinh tài liệu PDF."""
    job = db.get(BackgroundJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Tác vụ không tồn tại.")

    claimed = JobService.claim_next_job(db, worker_id="api_worker_local")
    if not claimed or claimed.job_id != job_id:
        # If specific job wasn't the first in queue, force claim this one
        job.state = "CLAIMED"
        job.claimed_by_worker = "api_worker_local"
        job.attempts += 1
        db.commit()
        claimed = job

    try:
        payload = json.loads(claimed.payload)
        now = datetime.now(timezone.utc)

        pdf_bytes = PDFService.generate_contract_pdf(
            contract_code=payload["contract_code"],
            contract_type=payload["contract_type"],
            customer_name=payload["customer_name"],
            customer_phone=payload["customer_phone"],
            customer_citizen_id=payload["customer_citizen_id"],
            plot_code=payload["plot_code"],
            total_amount=payload["total_amount"],
            created_at=now,
        )

        file_obj = DocumentService.upload_file(
            db=db,
            file_name=f"{payload['contract_code']}.pdf",
            content=pdf_bytes,
            user_id=current_user.user_id,
        )

        completed = JobService.complete_job(
            db=db,
            job_id=claimed.job_id,
            result={
                "file_id": file_obj.file_id,
                "file_name": file_obj.file_name,
                "sha256": file_obj.sha256_hash,
            },
        )
        return completed
    except Exception as e:
        failed = JobService.fail_job(db, job_id=claimed.job_id, error_message=str(e))
        return failed
