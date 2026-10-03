import hashlib
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

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
    def get_file(cls, db: Session, file_id: str) -> tuple[FileObject, bytes]:
        """Fetch FileObject record and download object content from MinIO."""
        file_obj = db.get(FileObject, file_id)
        if not file_obj or file_obj.state == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tệp tài liệu không tồn tại hoặc đã bị xóa.",
            )

        content, _ = storage_adapter.get_object(file_obj.object_key)
        return file_obj, content

    @classmethod
    def link_document_version(
        cls,
        db: Session,
        req: LinkDocumentRequest,
        user_id: int | None = None,
    ) -> DocumentVersion:
        """Attach a FileObject to a Contract, Annex, or DeathCertificate with automatic version numbering."""
        parents = [req.contract_id, req.annex_id, req.certificate_id]
        provided = [p for p in parents if p is not None]
        if len(provided) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chứng từ phải liên kết chính xác với một đối tượng (Hợp đồng, Phụ lục hoặc Giấy báo tử).",
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
