import React, { useCallback, useEffect, useState } from 'react'
import {
  Download,
  Eye,
  FileCheck,
  FileText,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { apiFetch } from '../../services/apiClient'
import { useNotificationModal } from '../../context/NotificationModalContext'

export interface DocumentItem {
  document_id: number
  document_type: string
  version_no: number
  file_id: string
  notes?: string | null
  verified_at?: string | null
  created_at: string
  file?: {
    file_id: string
    file_name: string
    mime_type: string
    file_size_bytes: number
    state?: string
    created_at?: string
  } | null
}

interface DocumentAttachmentListProps {
  contractId?: number
  annexId?: number
  certificateId?: number
  token: string | null
  title?: string
  canUpload?: boolean
  onUploaded?: () => void
}

export const DocumentAttachmentList: React.FC<DocumentAttachmentListProps> = ({
  contractId,
  annexId,
  certificateId,
  token,
  title = 'Danh Sách Bản Scan & Tài Liệu Đính Kèm',
  canUpload = true,
  onUploaded,
}) => {
  const { alert: modalAlert } = useNotificationModal()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Preview State
  const [previewFile, setPreviewFile] = useState<{
    id: string
    name: string
    mime: string
    url: string
  } | null>(null)

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<string>(
    contractId ? 'SIGNED_CONTRACT' : annexId ? 'SIGNED_ANNEX' : 'DEATH_CERTIFICATE'
  )
  const [docNotes, setDocNotes] = useState<string>('')
  const [isUploading, setIsUploading] = useState<boolean>(false)

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDocType = (typeStr: string) => {
    switch (typeStr) {
      case 'SIGNED_CONTRACT':
        return 'Hợp Đồng Đã Ký'
      case 'SIGNED_ANNEX':
        return 'Phụ Lục Đã Ký'
      case 'DEATH_CERTIFICATE':
        return 'Giấy Báo Tử'
      case 'CONTRACT_SCAN':
        return 'Bản Scan HĐ'
      case 'IDENTITY_CARD':
        return 'CCCD / Hộ Chiếu'
      default:
        return typeStr.replace(/_/g, ' ')
    }
  }

  const loadDocuments = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (contractId) params.append('contract_id', contractId.toString())
      if (annexId) params.append('annex_id', annexId.toString())
      if (certificateId) params.append('certificate_id', certificateId.toString())

      const res = await apiFetch(`/api/v1/documents/versions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Lỗi tải danh sách tài liệu: ${res.status}`)
      }
      const data: DocumentItem[] = await res.json()
      setDocuments(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách tài liệu scan')
    } finally {
      setLoading(false)
    }
  }, [token, contractId, annexId, certificateId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Download Handler
  const handleDownload = async (fileId: string, fileName?: string) => {
    if (!token) return
    try {
      const res = await apiFetch(`/api/v1/documents/${fileId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Không thể tải tệp xuống')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || `file_${fileId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: unknown) {
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi khi tải tệp', type: 'error' })
    }
  }

  // Preview Handler
  const handlePreview = async (fileId: string, fileName?: string, mimeType?: string) => {
    if (!token) return
    try {
      const res = await apiFetch(`/api/v1/documents/${fileId}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Không thể tải bản xem trước')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      setPreviewFile({
        id: fileId,
        name: fileName || `Tài liệu #${fileId}`,
        mime: mimeType || blob.type || 'application/pdf',
        url,
      })
    } catch (err: unknown) {
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi xem trước tệp', type: 'error' })
    }
  }

  const handleClosePreview = () => {
    if (previewFile?.url) {
      window.URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
  }

  // Upload & Link Handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !token) {
      await modalAlert({ message: 'Vui lòng chọn tệp tài liệu cần tải lên', type: 'warning' })
      return
    }

    setIsUploading(true)
    try {
      // 1. Upload file
      const formData = new FormData()
      formData.append('file', selectedFile)

      const uploadRes = await apiFetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Tải tệp lên thất bại')
      }

      const fileObj = await uploadRes.json()

      // 2. Link file to version
      const linkPayload: Record<string, unknown> = {
        file_id: fileObj.file_id,
        document_type: docType,
        notes: docNotes.trim() || undefined,
      }
      if (contractId) linkPayload.contract_id = contractId
      if (annexId) linkPayload.annex_id = annexId
      if (certificateId) linkPayload.certificate_id = certificateId

      const linkRes = await apiFetch('/api/v1/documents/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(linkPayload),
      })

      if (!linkRes.ok) {
        const errJson = await linkRes.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể liên kết tài liệu vào hồ sơ')
      }

      await modalAlert({ message: 'Đã tải lên và liên kết tài liệu thành công!', type: 'success' })
      setIsUploadOpen(false)
      setSelectedFile(null)
      setDocNotes('')
      loadDocuments()
      if (onUploaded) onUploaded()
    } catch (err: unknown) {
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi xử lý tài liệu', type: 'error' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCheck size={16} color="var(--brand-primary, #1e3a8a)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
            {title} ({documents.length})
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={loadDocuments}
            title="Làm mới danh sách tệp"
            style={{
              padding: '4px 8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} />
          </button>

          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--brand-primary, #1e3a8a)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Plus size={13} />
              <span>Đính Kèm File Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error */}
      {loading && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
          <RefreshCw size={16} className="spin" style={{ margin: '0 auto 6px' }} />
          Đang nạp hồ sơ scan và tài liệu...
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* Document Items List */}
      {!loading && documents.length === 0 && (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px dashed #CBD5E1',
          }}
        >
          <FileText size={32} style={{ color: '#94A3B8', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>
            Chưa có tài liệu scan hoặc tệp đính kèm nào
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            {canUpload
              ? 'Nhấn nút "Đính Kèm File Scan" ở trên để bổ sung tệp hợp đồng/phụ lục có chữ ký hoặc giấy báo tử scan.'
              : 'Hồ sơ này hiện chưa lưu trữ tệp đính kèm điện tử.'}
          </div>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {documents.map((doc, idx) => {
            const fileName = doc.file?.file_name || `Tệp đính kèm #${doc.file_id}`
            const mime = doc.file?.mime_type || ''
            const isImg = mime.startsWith('image/')
            const fileSize = formatFileSize(doc.file?.file_size_bytes)
            const dateStr = doc.verified_at || doc.created_at

            return (
              <div
                key={`${doc.document_id}-${doc.file_id}-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  padding: '10px 14px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px', flex: 1 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: isImg ? '#EFF6FF' : '#FEF3C7',
                      color: isImg ? '#2563EB' : '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isImg ? <ImageIcon size={18} /> : <FileText size={18} />}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#EEF2FF',
                          color: '#4F46E5',
                        }}
                      >
                        {formatDocType(doc.document_type)}
                      </span>
                      {doc.version_no && (
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          v{doc.version_no}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1E293B',
                        marginTop: '2px',
                        wordBreak: 'break-word',
                      }}
                    >
                      {fileName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                      {fileSize && <span>{fileSize}</span>}
                      {dateStr && <span>• {new Date(dateStr).toLocaleString('vi-VN')}</span>}
                      {doc.notes && <span>• {doc.notes}</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handlePreview(doc.file_id, fileName, mime)}
                    title="Xem trực tiếp tệp"
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '6px',
                      color: '#1D4ED8',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Eye size={13} />
                    <span>Xem</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(doc.file_id, fileName)}
                    title="Tải tệp về máy"
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={13} />
                    <span>Tải Về</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
                Tải Lên Bản Scan / Tài Liệu Đính Kèm
              </h4>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Loại Tài Liệu *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                >
                  <option value="SIGNED_CONTRACT">Bản Scan Hợp Đồng Ký Kết</option>
                  <option value="SIGNED_ANNEX">Bản Scan Phụ Lục Ký Kết</option>
                  <option value="DEATH_CERTIFICATE">Bản Scan Giấy Báo Tử</option>
                  <option value="IDENTITY_CARD">Bản Scan CCCD / CMND Thân Nhân</option>
                  <option value="OTHER">Tài Liệu / Chứng Từ Khác</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Chọn Tệp (PDF, JPG, PNG tối đa 20MB) *
                </label>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '13px',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '6px',
                    backgroundColor: '#F8FAFC',
                  }}
                />
                {selectedFile && (
                  <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px' }}>
                    Đã chọn: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ghi Chú Đính Kèm (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bản scan có đầy đủ chữ ký 2 bên ngày..."
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: 'var(--brand-primary, #1e3a8a)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Đang Tải...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Lưu & Gắn Tài Liệu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '900px',
              width: '100%',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <FileText size={16} color="var(--brand-primary, #1e3a8a)" />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1E293B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {previewFile.name}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleDownload(previewFile.id, previewFile.name)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={13} />
                  <span>Tải Về</span>
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, backgroundColor: '#334155', position: 'relative', overflow: 'hidden' }}>
              {previewFile.mime.startsWith('image/') ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                  }}
                >
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : previewFile.mime === 'application/pdf' ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    gap: '12px',
                  }}
                >
                  <FileText size={48} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Định dạng {previewFile.mime} không hỗ trợ hiển thị trực tiếp.</p>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewFile.id, previewFile.name)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--brand-primary, #1e3a8a)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Tải Về Xem Ngoại Tuyến
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
