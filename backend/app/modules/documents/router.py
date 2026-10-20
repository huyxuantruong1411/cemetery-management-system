from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    Security,
    UploadFile,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, security_bearer
from app.modules.auth.models import User
from app.modules.documents.schemas import (
    DocumentVersionResponse,
    FileObjectResponse,
    LinkDocumentRequest,
)
from app.modules.documents.service import DocumentService
from app.services.pdf_service import PDFService

router = APIRouter(prefix="/documents", tags=["Documents & Files"])


def _resolve_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    raw_token = (credentials.credentials if credentials else None) or token
    if not raw_token:
        return None
    try:
        payload = decode_access_token(raw_token)
        user_id_str = payload.get("sub")
        token_auth_version = payload.get("auth_version")
        if user_id_str and token_auth_version is not None:
            user = db.query(User).filter(User.user_id == int(user_id_str)).first()
            if user and user.is_active and user.auth_version == token_auth_version:
                return user
    except Exception:
        pass
    return None


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Tải xuống tệp chứng từ (chỉ dành cho người dùng đã xác thực)."""
    file_obj, content = DocumentService.get_file(db, file_id, user=current_user)
    safe_ascii = file_obj.file_name.encode("ascii", "ignore").decode() or "document"
    encoded_name = quote(file_obj.file_name)
    return Response(
        content=content,
        media_type=file_obj.mime_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_ascii}\"; filename*=UTF-8''{encoded_name}",
            "X-SHA256": file_obj.sha256_hash,
        },
    )


@router.get(
    "/{file_id}/preview",
    summary="Xem trước tệp (Inline preview)",
)
def preview_document(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Xem trực tiếp tệp PDF hoặc hình ảnh trên trình duyệt (chỉ dành cho người dùng đã xác thực)."""
    file_obj, content = DocumentService.get_file(db, file_id, user=current_user)
    safe_ascii = file_obj.file_name.encode("ascii", "ignore").decode() or "document"
    encoded_name = quote(file_obj.file_name)
    return Response(
        content=content,
        media_type=file_obj.mime_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{safe_ascii}\"; filename*=UTF-8''{encoded_name}",
            "X-SHA256": file_obj.sha256_hash,
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.api_route(
    "/public/{file_id}",
    methods=["GET", "HEAD"],
    summary="Xem trực tiếp tệp media minh chứng công khai",
)
def get_public_media(
    file_id: str,
    db: Session = Depends(get_db),
) -> Response:
    """Cho phép tải hoặc xem trực tiếp các tệp ảnh minh chứng thi công/chăm sóc phục vụ cổng thông tin công khai."""
    file_obj, content = DocumentService.get_file(db, file_id, user=None)
    safe_ascii = file_obj.file_name.encode("ascii", "ignore").decode() or "media"
    encoded_name = quote(file_obj.file_name)
    return Response(
        content=content,
        media_type=file_obj.mime_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{safe_ascii}\"; filename*=UTF-8''{encoded_name}",
            "X-SHA256": file_obj.sha256_hash,
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get(
    "/versions",
    response_model=list[DocumentVersionResponse],
    summary="Lấy danh sách các phiên bản tài liệu đính kèm",
)
def list_document_versions(
    contract_id: int | None = None,
    annex_id: int | None = None,
    certificate_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentVersionResponse]:
    """Trả về danh sách tài liệu scan / đính kèm liên kết với Hợp đồng, Phụ lục hoặc Giấy báo tử."""
    from sqlalchemy.orm import joinedload

    from app.modules.contracts.models import Contract, ContractAnnex
    from app.modules.documents.models import DocumentVersion, FileObject
    from app.modules.profiles.models import DeathCertificate

    q = db.query(DocumentVersion).options(joinedload(DocumentVersion.file))
    if contract_id is not None:
        q = q.filter(DocumentVersion.contract_id == contract_id)
    if annex_id is not None:
        q = q.filter(DocumentVersion.annex_id == annex_id)
    if certificate_id is not None:
        q = q.filter(DocumentVersion.certificate_id == certificate_id)

    versions = q.order_by(DocumentVersion.version_no.desc()).all()
    results = list(versions)

    existing_file_ids = {v.file_id for v in versions}

    if contract_id is not None:
        contract = db.get(Contract, contract_id)
        if contract and contract.signed_scan_file_id and contract.signed_scan_file_id not in existing_file_ids:
            file_obj = db.get(FileObject, contract.signed_scan_file_id)
            if file_obj:
                existing_file_ids.add(contract.signed_scan_file_id)
                results.append(
                    DocumentVersion(
                        document_id=-1,
                        document_type="SIGNED_CONTRACT",
                        contract_id=contract_id,
                        version_no=1,
                        file_id=contract.signed_scan_file_id,
                        notes="Bản scan hợp đồng có chữ ký (Kích hoạt hiệu lực)",
                        verified_at=contract.activated_at,
                        created_at=contract.activated_at or contract.created_at,
                        file=file_obj,
                    )
                )
        if contract and contract.annexes:
            for an in contract.annexes:
                if an.signed_scan_file_id and an.signed_scan_file_id not in existing_file_ids:
                    file_obj = db.get(FileObject, an.signed_scan_file_id)
                    if file_obj:
                        existing_file_ids.add(an.signed_scan_file_id)
                        results.append(
                            DocumentVersion(
                                document_id=-100 - an.annex_id,
                                document_type="SIGNED_ANNEX",
                                contract_id=contract_id,
                                annex_id=an.annex_id,
                                version_no=1,
                                file_id=an.signed_scan_file_id,
                                notes=f"Bản scan phụ lục #{an.annex_id} ({an.annex_type})",
                                verified_at=an.activated_at,
                                created_at=an.activated_at or an.created_at,
                                file=file_obj,
                            )
                        )

    if annex_id is not None:
        annex = db.get(ContractAnnex, annex_id)
        if annex and annex.signed_scan_file_id and annex.signed_scan_file_id not in existing_file_ids:
            file_obj = db.get(FileObject, annex.signed_scan_file_id)
            if file_obj:
                results.append(
                    DocumentVersion(
                        document_id=-2,
                        document_type="SIGNED_ANNEX",
                        annex_id=annex_id,
                        version_no=1,
                        file_id=annex.signed_scan_file_id,
                        notes="Bản scan phụ lục có chữ ký (Kích hoạt hiệu lực)",
                        verified_at=annex.activated_at,
                        created_at=annex.activated_at or annex.created_at,
                        file=file_obj,
                    )
                )

    if certificate_id is not None:
        cert = db.get(DeathCertificate, certificate_id)
        if cert and cert.file_id and cert.file_id not in existing_file_ids:
            file_obj = db.get(FileObject, cert.file_id)
            if file_obj:
                results.append(
                    DocumentVersion(
                        document_id=-3,
                        document_type="DEATH_CERTIFICATE",
                        certificate_id=certificate_id,
                        version_no=1,
                        file_id=cert.file_id,
                        notes=f"Giấy báo tử số {cert.certificate_number} do {cert.issuing_authority} cấp",
                        verified_at=cert.verified_at,
                        created_at=cert.created_at,
                        file=file_obj,
                    )
                )

    return results


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
        user=current_user,
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
