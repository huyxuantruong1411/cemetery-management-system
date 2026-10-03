from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FileObjectResponse(BaseModel):
    file_id: str
    bucket_name: str
    object_key: str
    version_id: str | None = None
    file_name: str
    mime_type: str
    file_size_bytes: int
    sha256_hash: str
    state: str
    uploaded_by_user_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentVersionResponse(BaseModel):
    document_id: int
    document_type: str
    contract_id: int | None = None
    annex_id: int | None = None
    certificate_id: int | None = None
    version_no: int
    file_id: str
    notes: str | None = None
    verified_by_user_id: int | None = None
    verified_at: datetime | None = None
    created_at: datetime
    file: FileObjectResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class LinkDocumentRequest(BaseModel):
    file_id: str = Field(..., description="ID của tệp đã tải lên")
    document_type: str = Field(..., description="SIGNED_CONTRACT, SIGNED_ANNEX, DEATH_CERTIFICATE, EVIDENCE_PHOTO, RECEIPT")
    contract_id: int | None = None
    annex_id: int | None = None
    certificate_id: int | None = None
    notes: str | None = None
