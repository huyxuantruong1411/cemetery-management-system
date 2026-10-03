export interface FileObject {
  file_id: string
  bucket_name: string
  object_key: string
  file_name: string
  mime_type: string
  file_size_bytes: number
  sha256_hash: string
  state: 'UPLOADING' | 'READY' | 'QUARANTINED' | 'DELETED'
  created_at: string
}

export interface DocumentVersion {
  version_id: number
  document_type: string
  version_no: number
  file_id: string
  contract_id?: number | null
  annex_id?: number | null
  certificate_id?: number | null
  notes?: string | null
  created_by_user_id?: number | null
  created_at: string
}

export interface BackgroundJob {
  job_id: string
  job_type: string
  payload_json: string
  status: 'PENDING' | 'CLAIMED' | 'COMPLETED' | 'FAILED'
  retry_count: number
  max_retries: number
  error_message?: string | null
  lease_until?: string | null
  created_at: string
  updated_at: string
}
