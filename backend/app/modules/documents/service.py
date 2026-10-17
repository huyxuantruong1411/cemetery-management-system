import hashlib
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.documents.models import DocumentVersion, FileObject
from app.modules.documents.schemas import LinkDocumentRequest
from app.storage.minio_adapter import storage_adapter

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

ALLOWED_MAGIC_SIGNATURES = [
    (b"%PDF-", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"PK\x03\x04", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
]


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^\w\.-]", "_", filename, flags=re.UNICODE)
    return cleaned[:100]


class DocumentService:
    @staticmethod
    def detect_mime_type(content: bytes, filename: str) -> str:
        """Validate file content using magic byte signatures to prevent extension spoofing."""
        for magic, mime in ALLOWED_MAGIC_SIGNATURES:
            if content.startswith(magic):
                # Extra check for openxml / xlsx vs zip
                if mime.startswith("application/vnd.openxmlformats"):
                    if not filename.lower().endswith(".xlsx"):
                        continue
                return mime

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận PDF, PNG, JPG, hoặc XLSX.",
        )

    @classmethod
    def upload_file(
        cls,
        db: Session,
        file_name: str,
        content: bytes,
        user_id: int | None = None,
    ) -> FileObject:
        """Validate magic bytes, stream upload to MinIO, and record FileObject with SHA-256."""
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dung lượng tệp vượt quá giới hạn cho phép ({MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB).",
            )

        mime_type = cls.detect_mime_type(content, file_name)
        sha256 = hashlib.sha256(content).hexdigest()
        file_id = uuid.uuid4().hex

        now = _utc_now_naive()
        clean_name = sanitize_filename(file_name)
        object_key = f"documents/{now.year}/{now.month:02d}/{file_id}_{clean_name}"

        # Upload to MinIO
        upload_meta = storage_adapter.put_object(
            object_key=object_key,
            data=content,
            content_type=mime_type,
        )

        file_obj = FileObject(
            file_id=file_id,
            bucket_name=upload_meta["bucket"],
            object_key=object_key,
            version_id=upload_meta.get("version_id"),
            file_name=file_name,
            mime_type=mime_type,
            file_size_bytes=len(content),
            sha256_hash=sha256,
            state="READY",
            uploaded_by_user_id=user_id,
            created_at=now,
            updated_at=now,
        )

        db.add(file_obj)
        db.commit()
        db.refresh(file_obj)
        return file_obj

    @classmethod
    def get_file(
        cls, db: Session, file_id: str, user: User | None = None
    ) -> tuple[FileObject, bytes]:
        """Fetch FileObject record and download object content from MinIO with authorization."""
        file_obj = db.get(FileObject, file_id)
        if not file_obj or file_obj.state == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tệp tài liệu không tồn tại hoặc đã bị xóa.",
            )

        if user:
            is_admin = any(r.role_name.upper() == "ADMIN" for r in (user.roles or []))
            user_roles = [r.role_name.upper() for r in (user.roles or [])]
            if not is_admin:
                # 1. Check if bound to an Invoice (Receipt)
                from app.modules.finance.models import Invoice

                invoice = db.query(Invoice).filter(Invoice.file_id == file_id).first()
                if invoice:
                    has_finance_read = "ACCOUNTANT" in user_roles or any(
                        p.resource == "finance" for r in user.roles for p in r.permissions
                    )
                    if not has_finance_read:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Bạn không có quyền truy cập chứng từ thanh toán/biên lai này.",
                        )

                # 2. Check if bound to a ReportExport (R03)
                from app.modules.reports.models import ReportExport

                report_export = (
                    db.query(ReportExport).filter(ReportExport.file_id == file_id).first()
                )
                if report_export:
                    rtype = report_export.report_type.upper()
                    has_type_access = False
                    if rtype == "REVENUE":
                        has_type_access = "ACCOUNTANT" in user_roles
                    elif rtype in ("OPERATIONS", "OCCUPANCY", "CONTRACTS"):
                        has_type_access = False

                    if not has_type_access:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Bạn không có quyền truy cập tệp xuất báo cáo {rtype}.",
                        )

                    if report_export.requester_id != user.user_id:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Bạn không có quyền truy cập tệp xuất báo cáo của người khác.",
                        )

                # 3. Check if bound to a Contract / Annex signed scan (R02)
                from app.modules.contracts.models import Contract, ContractAnnex

                is_contract_scan = (
                    db.query(Contract).filter(Contract.signed_scan_file_id == file_id).first()
                    is not None
                    or db.query(ContractAnnex)
                    .filter(ContractAnnex.signed_scan_file_id == file_id)
                    .first()
                    is not None
                    or db.query(DocumentVersion)
                    .filter(
                        DocumentVersion.file_id == file_id, DocumentVersion.contract_id.isnot(None)
                    )
                    .first()
                    is not None
                    or db.query(DocumentVersion)
                    .filter(
                        DocumentVersion.file_id == file_id, DocumentVersion.annex_id.isnot(None)
                    )
                    .first()
                    is not None
                )
                if is_contract_scan:
                    if "CARETAKER" in user_roles or "ACCOUNTANT" in user_roles:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Bạn không có quyền truy cập bản scan hợp đồng/phụ lục pháp lý.",
                        )

                # 4. Check if bound to a Death Certificate (R02)
                from app.modules.profiles.models import DeathCertificate

                is_death_cert = (
                    db.query(DeathCertificate).filter(DeathCertificate.file_id == file_id).first()
                    is not None
                    or db.query(DocumentVersion)
                    .filter(
                        DocumentVersion.file_id == file_id,
                        DocumentVersion.certificate_id.isnot(None),
                    )
                    .first()
                    is not None
                )
                if is_death_cert:
                    if "ACCOUNTANT" in user_roles or "CARETAKER" in user_roles:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Bạn không có quyền truy cập bản scan giấy báo tử.",
                        )

                # 5. Check unbound/draft file (R02): only uploader or admin can access
                is_bound = (
                    invoice is not None
                    or report_export is not None
                    or is_contract_scan
                    or is_death_cert
                )
                if not is_bound:
                    from app.modules.care.models import CareMediaEvidence
                    from app.modules.construction.models import ConstructionTaskEvidence

                    is_evidence = (
                        db.query(ConstructionTaskEvidence)
                        .filter(ConstructionTaskEvidence.file_id == file_id)
                        .first()
                        is not None
                        or db.query(CareMediaEvidence)
                        .filter(CareMediaEvidence.file_id == file_id)
                        .first()
                        is not None
                    )
                    if not is_evidence:
                        if file_obj.uploaded_by_user_id != user.user_id:
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Tệp tài liệu chưa được liên kết và không thuộc quyền sở hữu của bạn.",
                            )

        content, _ = storage_adapter.get_object(file_obj.object_key)
        return file_obj, content

    @classmethod
    def link_document_version(
        cls,
        db: Session,
        req: LinkDocumentRequest,
        user_id: int | None = None,
        user: User | None = None,
    ) -> DocumentVersion:
        """Attach a FileObject to a Contract, Annex, or DeathCertificate with automatic version numbering."""
        parents = [req.contract_id, req.annex_id, req.certificate_id]
        provided = [p for p in parents if p is not None]
        if len(provided) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chứng từ phải liên kết chính xác với một đối tượng (Hợp đồng, Phụ lục hoặc Giấy báo tử).",
            )

        if user:
            is_admin = any(r.role_name.upper() == "ADMIN" for r in (user.roles or []))
            user_roles = [r.role_name.upper() for r in (user.roles or [])]
            if not is_admin:
                if req.contract_id is not None or req.annex_id is not None:
                    has_contract_write = "MARKETING" in user_roles or any(
                        p.action == "write" and p.resource == "contracts"
                        for r in user.roles
                        for p in r.permissions
                    )
                    if not has_contract_write:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Bạn không có quyền liên kết tài liệu vào hợp đồng hoặc phụ lục.",
                        )
                elif req.certificate_id is not None:
                    has_customer_write = "MARKETING" in user_roles or any(
                        p.action == "write" and p.resource == "customers"
                        for r in user.roles
                        for p in r.permissions
                    )
                    if not has_customer_write:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Bạn không có quyền liên kết tài liệu vào giấy báo tử.",
                        )

        file_obj = db.get(FileObject, req.file_id)
        if not file_obj or file_obj.state != "READY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tệp nguồn không hợp lệ hoặc chưa sẵn sàng.",
            )

        # Compute next version number for this entity
        query = db.query(func.max(DocumentVersion.version_no)).filter(
            DocumentVersion.document_type == req.document_type
        )
        if req.contract_id is not None:
            query = query.filter(DocumentVersion.contract_id == req.contract_id)
        elif req.annex_id is not None:
            query = query.filter(DocumentVersion.annex_id == req.annex_id)
        elif req.certificate_id is not None:
            query = query.filter(DocumentVersion.certificate_id == req.certificate_id)

        current_max = query.scalar() or 0
        next_version = current_max + 1

        now = _utc_now_naive()
        doc_ver = DocumentVersion(
            document_type=req.document_type,
            contract_id=req.contract_id,
            annex_id=req.annex_id,
            certificate_id=req.certificate_id,
            version_no=next_version,
            file_id=req.file_id,
            notes=req.notes,
            verified_by_user_id=None,
            verified_at=None,
            created_at=now,
        )

        db.add(doc_ver)
        db.commit()
        db.refresh(doc_ver)
        return doc_ver

    @classmethod
    def verify_document_version(
        cls,
        db: Session,
        document_id: int,
        verifier_user_id: int,
    ) -> DocumentVersion:
        """Mark document version as verified by an authorized staff member."""
        doc = db.get(DocumentVersion, document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bản ghi chứng từ không tồn tại.",
            )

        doc.verified_by_user_id = verifier_user_id
        doc.verified_at = _utc_now_naive()
        db.commit()
        db.refresh(doc)
        return doc
