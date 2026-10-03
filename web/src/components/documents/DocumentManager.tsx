import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Clock,
  Layers,
  FileCheck,
  HardDrive,
} from 'lucide-react'
import type { BackgroundJob, DocumentVersion, FileObject } from '../../types/document'

export const DocumentManager: React.FC = () => {
  const [files, setFiles] = useState<FileObject[]>([])
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [uploading, setUploading] = useState<boolean>(false)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mime: string; url: string } | null>(null)

  // Link version dialog state
  const [selectedFileForVersion, setSelectedFileForVersion] = useState<FileObject | null>(null)
  const [versionDocType, setVersionDocType] = useState<string>('SIGNED_CONTRACT')
  const [versionContractId, setVersionContractId] = useState<string>('')
  const [versionNotes, setVersionNotes] = useState<string>('')
  const [versionSubmitting, setVersionSubmitting] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const getAuthToken = () => localStorage.getItem('access_token') || ''

  // Load documents and jobs
  const refreshData = async () => {
    const token = getAuthToken()
    try {
      const jobRes = await fetch('/api/v1/jobs/test-list', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)

      if (jobRes && jobRes.ok) {
        const jobData = await jobRes.json()
        setJobs(jobData)
      }
    } catch {
      // Ignore network errors on initial polling
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadSuccess(null)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || `Lỗi tải lên: ${res.statusText}`)
      }

      const newFile: FileObject = await res.json()
      setFiles((prev) => [newFile, ...prev])
      setUploadSuccess(`Tải lên thành công: ${newFile.file_name} (${(newFile.file_size_bytes / 1024).toFixed(1)} KB)`)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      if (err instanceof Error) {
        setUploadError(err.message)
      } else {
        setUploadError('Tải lên thất bại')
      }
    } finally {
      setUploading(false)
    }
  }

  // Generate Sample Vietnamese PDF
  const handleGenerateSamplePDF = async () => {
    setUploading(true)
    setUploadSuccess(null)
    setUploadError(null)

    try {
      const res = await fetch('/api/v1/documents/sample-contract-pdf', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || `Lỗi tạo PDF: ${res.statusText}`)
      }

      const generatedFile: FileObject = await res.json()
      setFiles((prev) => [generatedFile, ...prev])
      setUploadSuccess(`Đã xuất PDF Tiếng Việt chuẩn MinIO: ${generatedFile.file_name}`)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setUploadError(err.message)
      }
    } finally {
      setUploading(false)
    }
  }

  // Preview file in modal
  const handlePreview = async (file: FileObject) => {
    try {
      const res = await fetch(`/api/v1/documents/${file.file_id}/preview`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Không thể xem trước tệp: ${res.statusText}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewFile({
        id: file.file_id,
        name: file.file_name,
        mime: file.mime_type,
        url,
      })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi xem trước')
    }
  }

  // Close preview and revoke object URL
  const handleClosePreview = () => {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
  }

  // Authenticated file download
  const handleDownload = async (file: FileObject) => {
    try {
      const res = await fetch(`/api/v1/documents/${file.file_id}/download`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      })

      if (!res.ok) throw new Error('Không thể tải tệp')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tải xuống thất bại')
    }
  }

  // Link file to document version
  const handleLinkVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFileForVersion) return

    setVersionSubmitting(true)
    try {
      const res = await fetch('/api/v1/documents/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          file_id: selectedFileForVersion.file_id,
          document_type: versionDocType,
          contract_id: versionContractId ? parseInt(versionContractId, 10) : undefined,
          notes: versionNotes || undefined,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể tạo phiên bản chứng từ')
      }

      const newVer: DocumentVersion = await res.json()
      setVersions((prev) => [newVer, ...prev])
      setSelectedFileForVersion(null)
      setVersionNotes('')
      setVersionContractId('')
      setUploadSuccess(`Đã lưu Phiên bản #${newVer.version_no} cho hồ sơ chứng từ!`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi liên kết phiên bản')
    } finally {
      setVersionSubmitting(false)
    }
  }

  // Trigger demo background job
  const handleEnqueueJob = async (jobType: string) => {
    try {
      const res = await fetch('/api/v1/jobs/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          job_type: jobType,
          payload: { target: 'contract_export', timestamp: new Date().toISOString() },
        }),
      })

      if (!res.ok) throw new Error('Không thể thêm job vào hàng đợi')
      const job: BackgroundJob = await res.json()
      setJobs((prev) => [job, ...prev])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi tạo job')
    }
  }

  // Process a worker step
  const handleProcessJobWorker = async () => {
    try {
      const res = await fetch('/api/v1/jobs/process-next', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      })
      if (!res.ok) throw new Error('Không thể xử lý job')
      const result = await res.json()
      alert(result.message || 'Worker đã chạy thành công')
      refreshData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi thực thi worker')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px 28px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(36, 89, 77, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCheck size={22} color="var(--brand-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Quản Trị Hồ Sơ Chứng Từ & Lưu Trữ MinIO (M03)
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
                Hỗ trợ tải lên kiểm tra Magic Bytes, mã băm SHA-256 chống giả mạo, tạo PDF Tiếng Việt & Quản lý phiên bản
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleGenerateSamplePDF}
            disabled={uploading}
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            <FileText size={16} />
            <span>Tạo PDF Mẫu Hợp Đồng Tiếng Việt</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              backgroundColor: '#FFFFFF',
              color: 'var(--brand-primary)',
              border: '1px solid var(--brand-primary)',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            <Upload size={16} />
            <span>Tải Lên Chứng Từ</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Notifications */}
      {uploadSuccess && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid #BBF7D0',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {uploadError && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid #FECACA',
          }}
        >
          <AlertTriangle size={18} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* File List Grid */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Danh Sách Tệp Đã Tải Lên & Tạo Mới ({files.length})
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Lưu trữ: MinIO S3 (Bucket: ql-nghiatrang-documents / drive D:)
          </span>
        </div>

        {files.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px dashed #CBD5E1',
            }}
          >
            <FileText size={40} color="#94A3B8" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Chưa có tệp tài liệu nào trong phiên làm việc này
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px auto' }}>
              Nhấn "Tải Lên Chứng Từ" để tải file PDF/Ảnh hoặc nhấn "Tạo PDF Mẫu Hợp Đồng Tiếng Việt" để hệ thống tự động biên dịch văn bản UTF-8 và lưu vào MinIO.
            </p>
            <button
              onClick={handleGenerateSamplePDF}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tạo Thử PDF Ngay
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '10px 14px' }}>Tên Tệp</th>
                  <th style={{ padding: '10px 14px' }}>Định Dạng</th>
                  <th style={{ padding: '10px 14px' }}>Dung Lượng</th>
                  <th style={{ padding: '10px 14px' }}>Mã Băm SHA-256</th>
                  <th style={{ padding: '10px 14px' }}>Trạng Thái</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.file_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1E293B' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="var(--brand-primary)" />
                        <span>{file.file_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>{file.mime_type}</td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>
                      {(file.file_size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#475569' }}>
                      <span title={file.sha256_hash}>
                        {file.sha256_hash.substring(0, 16)}...
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                        }}
                      >
                        {file.state}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => handlePreview(file)}
                          style={{
                            backgroundColor: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: '#1E293B',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                          }}
                          title="Xem trước"
                        >
                          <Eye size={14} />
                          <span>Xem</span>
                        </button>

                        <button
                          onClick={() => handleDownload(file)}
                          style={{
                            backgroundColor: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: '#1E293B',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                          }}
                          title="Tải về"
                        >
                          <Download size={14} />
                          <span>Tải</span>
                        </button>

                        <button
                          onClick={() => setSelectedFileForVersion(file)}
                          style={{
                            backgroundColor: 'rgba(36, 89, 77, 0.1)',
                            border: '1px solid rgba(36, 89, 77, 0.3)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: 'var(--brand-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                          title="Liên kết hồ sơ & Đánh số phiên bản"
                        >
                          <Layers size={14} />
                          <span>Đánh Version</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Versions Registry Section */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Layers size={18} color="var(--brand-primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            Lịch Sử Phiên Bản Chứng Từ Đã Liên Kết ({versions.length})
          </h3>
        </div>

        {versions.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Chưa có phiên bản chứng từ nào được liên kết. Bạn có thể chọn bất kỳ tệp nào phía trên và nhấn "Đánh Version" để liên kết hợp đồng/giấy chứng tử.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '10px 14px' }}>Version #</th>
                  <th style={{ padding: '10px 14px' }}>Loại Tài Liệu</th>
                  <th style={{ padding: '10px 14px' }}>Hợp Đồng ID</th>
                  <th style={{ padding: '10px 14px' }}>Ghi Chú</th>
                  <th style={{ padding: '10px 14px' }}>Mã Tệp (File ID)</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver) => (
                  <tr key={ver.version_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#FEF3C7',
                          color: '#B45309',
                        }}
                      >
                        v{ver.version_no}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ver.document_type}</td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>{ver.contract_id || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>{ver.notes || '—'}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#64748B' }}>
                      {ver.file_id.substring(0, 18)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Background Jobs & Outbox Queue Monitor */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Hàng Đợi Công Việc Ngầm (Background Jobs & Outbox)
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleEnqueueJob('CONTRACT_PDF_GEN')}
              style={{
                backgroundColor: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1E293B',
                cursor: 'pointer',
              }}
            >
              + Đẩy Job Mẫu (PDF Gen)
            </button>
            <button
              onClick={handleProcessJobWorker}
              style={{
                backgroundColor: 'rgba(36, 89, 77, 0.1)',
                border: '1px solid rgba(36, 89, 77, 0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--brand-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Play size={13} />
              <span>Chạy 1 Bước Worker</span>
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Hàng đợi hiện đang trống. Nhấn "+ Đẩy Job Mẫu" để kiểm tra cơ chế lease lock và outbox event (G17).
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '10px 14px' }}>Mã Job</th>
                  <th style={{ padding: '10px 14px' }}>Loại Công Việc</th>
                  <th style={{ padding: '10px 14px' }}>Trạng Thái</th>
                  <th style={{ padding: '10px 14px' }}>Số Lần Thử</th>
                  <th style={{ padding: '10px 14px' }}>Thời Điểm Khởi Tạo</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.job_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '11px' }}>
                      {j.job_id.substring(0, 16)}...
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{j.job_type}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor:
                            j.status === 'COMPLETED'
                              ? '#DCFCE7'
                              : j.status === 'CLAIMED'
                              ? '#E0F2FE'
                              : j.status === 'FAILED'
                              ? '#FEE2E2'
                              : '#FEF3C7',
                          color:
                            j.status === 'COMPLETED'
                              ? '#15803D'
                              : j.status === 'CLAIMED'
                              ? '#0369A1'
                              : j.status === 'FAILED'
                              ? '#DC2626'
                              : '#B45309',
                        }}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>
                      {j.retry_count} / {j.max_retries}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>
                      {new Date(j.created_at).toLocaleTimeString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Preview File */}
      {previewFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '900px',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--brand-primary)" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>{previewFile.name}</span>
              </div>
              <button
                onClick={handleClosePreview}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, backgroundColor: '#525659', position: 'relative' }}>
              {previewFile.mime.startsWith('image/') ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
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
                  <p>Định dạng {previewFile.mime} không hỗ trợ hiển thị trực tiếp.</p>
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    style={{
                      backgroundColor: 'var(--brand-primary)',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    Tải về máy để xem
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link Version Dialog */}
      {selectedFileForVersion && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Liên Kết Chứng Từ & Đánh Số Phiên Bản
              </h3>
              <button
                onClick={() => setSelectedFileForVersion(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
              Tệp được chọn: <strong>{selectedFileForVersion.file_name}</strong>
            </div>

            <form onSubmit={handleLinkVersion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#334155' }}>
                  Loại Chứng Từ
                </label>
                <select
                  value={versionDocType}
                  onChange={(e) => setVersionDocType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                >
                  <option value="SIGNED_CONTRACT">SIGNED_CONTRACT (Hợp Đồng Đã Ký Quét Scan)</option>
                  <option value="DEATH_CERTIFICATE">DEATH_CERTIFICATE (Giấy Báo Tử Pháp Lý)</option>
                  <option value="ANNEX">ANNEX (Phụ Lục Hợp Đồng An Táng)</option>
                  <option value="IDENTITY_CARD">IDENTITY_CARD (CCCD / Giấy Tờ Tùy Thân)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#334155' }}>
                  Mã ID Hợp Đồng (Nếu có)
                </label>
                <input
                  type="number"
                  placeholder="Ví dụ: 1"
                  value={versionContractId}
                  onChange={(e) => setVersionContractId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#334155' }}>
                  Ghi Chú Phiên Bản
                </label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Bản scan có đầy đủ chữ ký công chứng lần 1"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedFileForVersion(null)}
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={versionSubmitting}
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: versionSubmitting ? 'not-allowed' : 'pointer',
                    opacity: versionSubmitting ? 0.7 : 1,
                  }}
                >
                  {versionSubmitting ? 'Đang lưu...' : 'Xác Nhận Đánh Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
