from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.documents.schemas import (
    DocumentVersionResponse,
    FileObjectResponse,
    LinkDocumentRequest,
)
from app.modules.documents.service import DocumentService
from app.services.pdf_service import PDFService

router = APIRouter(prefix="/documents", tags=["Documents & Files"])


@router.post(
    "/upload",
    response_model=FileObjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tải lên tệp chứng từ (PDF, PNG, JPG, XLSX)",
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileObjectResponse:
    """Tải lên tệp tin, kiểm tra chữ ký định dạng magic bytes, tính toán băm SHA-256 và lưu trữ MinIO."""
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp rỗng hoặc không có dữ liệu.",
        )

    file_obj = DocumentService.upload_file(
        db=db,
        file_name=file.filename or "upload.bin",
        content=content,
        user_id=current_user.user_id,
    )
    return file_obj


@router.get(
    "/{file_id}/download",
    summary="Tải xuống tệp chứng từ",
)
def download_document(
    file_id: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Tải xuống tệp chứng từ có xác thực người dùng."""
    file_obj, content = DocumentService.get_file(db, file_id)
    return Response(
        content=content,
        media_type=file_obj.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file_obj.file_name}"',
            "X-SHA256": file_obj.sha256_hash,
        },
    )


@router.get(
    "/{file_id}/preview",
    summary="Xem trước tệp (Inline preview)",
)
def preview_document(
    file_id: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Xem trực tiếp tệp PDF hoặc hình ảnh trên trình duyệt."""
    file_obj, content = DocumentService.get_file(db, file_id)
    return Response(
        content=content,
        media_type=file_obj.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{file_obj.file_name}"',
            "X-SHA256": file_obj.sha256_hash,
        },
    )


@router.post(
    "/versions",
    response_model=DocumentVersionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gắn chứng từ vào hồ sơ nghiệp vụ",
)
def link_document(
    req: LinkDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentVersionResponse:
    """Liên kết tệp đã tải lên với Hợp đồng, Phụ lục hoặc Giấy báo tử, tự động tăng số phiên bản."""
    doc_ver = DocumentService.link_document_version(
        db=db,
        req=req,
        user_id=current_user.user_id,
    )
    return doc_ver


@router.post(
    "/sample-contract-pdf",
    response_model=FileObjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sinh tệp PDF hợp đồng mẫu tiếng Việt",
)
def generate_sample_contract_pdf(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileObjectResponse:
    """Sinh tài liệu hợp đồng PDF tiếng Việt chuẩn và lưu trữ vào kho MinIO."""
    now = datetime.now(timezone.utc)
    pdf_bytes = PDFService.generate_contract_pdf(
        contract_code=f"HD-{now.strftime('%Y%m%d%H%M%S')}",
        contract_type="LAND_PURCHASE",
        customer_name="Trần Thị Mai Lan",
        customer_phone="0918765432",
        customer_citizen_id="079198001234",
        plot_code="A1-05",
        total_amount="150,000,000",
        created_at=now,
    )

    file_obj = DocumentService.upload_file(
        db=db,
        file_name=f"HopDong_Mau_{now.strftime('%Y%m%d')}.pdf",
        content=pdf_bytes,
        user_id=current_user.user_id,
    )
    return file_obj
