import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  UploadCloud,
  User as UserIcon,
  MapPin,
  X,
  Sparkles,
  ShieldCheck,
  ListTodo,
  Camera,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import type {
  CareScheduleBrief,
  CareScheduleDetail,
  CareChecklistItemBrief,
} from '../../types/care'
import { Pagination, usePagination } from '../common/Pagination'

export const CareModule: React.FC = () => {
  const { accessToken: token, user, hasPermission } = useAuth()

  // Main state
  const [schedules, setSchedules] = useState<CareScheduleBrief[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & search
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [currentPeriod, setCurrentPeriod] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-M${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Detail drawer / modal
  const [selectedSchedule, setSelectedSchedule] = useState<CareScheduleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false)

  // Generate modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false)
  const [genYear, setGenYear] = useState<number>(new Date().getFullYear())
  const [genMonth, setGenMonth] = useState<number>(new Date().getMonth() + 1)
  const [genLoading, setGenLoading] = useState<boolean>(false)

  // Evidence modal
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false)
  const [evidenceCaption, setEvidenceCaption] = useState<string>('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceUploading, setEvidenceUploading] = useState<boolean>(false)

  // Close shift modal / form
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false)
  const [closeNotes, setCloseNotes] = useState<string>('')
  const [closingShift, setClosingShift] = useState<boolean>(false)

  // Assign caretaker form
  const [caretakerInputId, setCaretakerInputId] = useState<string>('')
  const [assignLoading, setAssignLoading] = useState<boolean>(false)

  // Notifications
  const [notification, setNotification] = useState<{ message: string; isError: boolean } | null>(null)

  const showNotification = (message: string, isError = false) => {
    setNotification({ message, isError })
    setTimeout(() => setNotification(null), 5000)
  }

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchSchedules = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (currentPeriod) params.append('period_key', currentPeriod)

      const res = await fetch(`/api/v1/care/schedules?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Lỗi tải danh sách lịch chăm sóc (${res.status})`)
      }
      const data: CareScheduleBrief[] = await res.json()
      setSchedules(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, currentPeriod])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const openScheduleDetail = async (scheduleId: number) => {
    if (!token) return
    try {
      setDetailLoading(true)
      setIsDetailOpen(true)
      const res = await fetch(`/api/v1/care/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error('Lỗi tải chi tiết ca chăm sóc')
      }
      const data: CareScheduleDetail = await res.json()
      setSelectedSchedule(data)
      setCaretakerInputId(data.caretaker_id?.toString() || '')
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Không thể tải chi tiết', true)
      setIsDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const handleGeneratePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    try {
      setGenLoading(true)
      const res = await fetch('/api/v1/care/schedules/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          year: Number(genYear),
          month: Number(genMonth),
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Không thể tạo lịch chăm sóc kỳ này')
      }
      const result = await res.json()
      showNotification(
        `Kỳ ${result.period_key}: Đã sinh ${result.generated_count} ca mới (bỏ qua ${result.skipped_count} ca đã tồn tại)`
      )
      setIsGenerateModalOpen(false)
      setCurrentPeriod(result.period_key)
      fetchSchedules()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi sinh lịch định kỳ', true)
    } finally {
      setGenLoading(false)
    }
  }

  const handleAssignCaretaker = async () => {
    if (!token || !selectedSchedule || !caretakerInputId) return
    try {
      setAssignLoading(true)
      const res = await fetch(`/api/v1/care/schedules/${selectedSchedule.schedule_id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ caretaker_id: Number(caretakerInputId) }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Lỗi phân công nhân viên')
      }
      const updated: CareScheduleDetail = await res.json()
      setSelectedSchedule(updated)
      if (updated.has_conflict) {
        showNotification(`Phân công thành công kèm cảnh báo: ${updated.conflict_reason}`, true)
      } else {
        showNotification('Đã phân công nhân sự chăm sóc')
      }
      fetchSchedules()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi phân công', true)
    } finally {
      setAssignLoading(false)
    }
  }

  const handleToggleChecklistItem = async (item: CareChecklistItemBrief) => {
    if (!token || !selectedSchedule) return
    const newStatus = !item.is_completed
    try {
      const res = await fetch(`/api/v1/care/checklist-items/${item.item_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_completed: newStatus }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Không thể cập nhật tiến độ')
      }
      const updatedItem: CareChecklistItemBrief = await res.json()
      setSelectedSchedule((prev) => {
        if (!prev) return null
        return {
          ...prev,
          checklist_items: prev.checklist_items.map((i) =>
            i.item_id === updatedItem.item_id ? updatedItem : i
          ),
          completed_tasks_count: prev.checklist_items
            .map((i) => (i.item_id === updatedItem.item_id ? updatedItem : i))
            .filter((i) => i.is_completed).length,
        }
      })
      fetchSchedules()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi cập nhật checklist', true)
    }
  }

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !selectedSchedule || !evidenceFile) return

    try {
      setEvidenceUploading(true)
      const formData = new FormData()
      formData.append('file', evidenceFile)

      const uploadRes = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!uploadRes.ok) {
        const errData = await uploadRes.json()
        throw new Error(errData.detail || 'Tải ảnh lên máy chủ thất bại')
      }
      const uploadData = await uploadRes.json()
      const fileId = uploadData.file_id

      const attachRes = await fetch(`/api/v1/care/schedules/${selectedSchedule.schedule_id}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_id: fileId,
          caption: evidenceCaption || 'Ảnh chụp hiện trường chăm sóc',
        }),
      })

      if (!attachRes.ok) {
        const errData = await attachRes.json()
        throw new Error(errData.detail || 'Lưu minh chứng ca chăm sóc thất bại')
      }

      showNotification('Đã ghi nhận ảnh minh chứng hiện trường')
      setIsEvidenceModalOpen(false)
      setEvidenceFile(null)
      setEvidenceCaption('')
      openScheduleDetail(selectedSchedule.schedule_id)
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi đính kèm ảnh', true)
    } finally {
      setEvidenceUploading(false)
    }
  }

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !selectedSchedule) return

    try {
      setClosingShift(true)
      const res = await fetch(`/api/v1/care/schedules/${selectedSchedule.schedule_id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ field_notes: closeNotes }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Không thể đóng ca chăm sóc')
      }

      const closedSchedule: CareScheduleDetail = await res.json()
      setSelectedSchedule(closedSchedule)
      showNotification('Đã đóng ca chăm sóc và nghiệm thu thành công')
      setIsCloseModalOpen(false)
      setCloseNotes('')
      fetchSchedules()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi đóng ca', true)
    } finally {
      setClosingShift(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Filtering & Pagination
  // ---------------------------------------------------------------------------
  const filteredSchedules = schedules.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.plot_code?.toLowerCase().includes(q) ||
      s.zone_name?.toLowerCase().includes(q) ||
      s.package_name?.toLowerCase().includes(q) ||
      s.caretaker_name?.toLowerCase().includes(q) ||
      s.period_key?.toLowerCase().includes(q)
    )
  })

  const pagination = usePagination<CareScheduleBrief>(filteredSchedules, { initialPageSize: 10 })

  const kpis = {
    total: schedules.length,
    scheduled: schedules.filter((s) => s.status === 'SCHEDULED').length,
    assigned: schedules.filter((s) => s.status === 'ASSIGNED').length,
    inProgress: schedules.filter((s) => s.status === 'IN_PROGRESS').length,
    closed: schedules.filter((s) => s.status === 'CLOSED').length,
    overdue: schedules.filter((s) => s.status === 'OVERDUE').length,
  }

  const canManageCare =
    hasPermission('care:manage') || (user?.roles ? user.roles.some((r) => r.role_name === 'ADMIN') : false)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            backgroundColor: notification.isError ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${notification.isError ? '#F87171' : '#86EFAC'}`,
            color: notification.isError ? '#991B1B' : '#166534',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {notification.isError ? (
            <AlertTriangle size={18} color="#DC2626" />
          ) : (
            <CheckCircle2 size={18} color="#16A34A" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          padding: '20px 24px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--brand-secondary, #1E293B)',
                margin: 0,
              }}
            >
              Quản lý Dịch vụ Chăm sóc Định kỳ
            </h1>
            <span
              style={{
                backgroundColor: 'rgba(36, 89, 77, 0.1)',
                color: 'var(--brand-primary, #24594D)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(36, 89, 77, 0.25)',
              }}
            >
              Dịch Vụ & Thực Địa
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0' }}>
            Lịch chăm sóc khuôn viên mộ, phân công ca thực địa, danh mục công việc và kiểm tra minh chứng nghiệm thu
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchSchedules()}
            disabled={loading}
            style={{
              padding: '9px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s',
            }}
            title="Làm mới danh sách"
          >
            <RefreshCw
              size={15}
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Làm mới</span>
          </button>

          {canManageCare && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              style={{
                padding: '9px 16px',
                backgroundColor: 'var(--brand-primary, #24594D)',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(36, 89, 77, 0.25)',
              }}
            >
              <Sparkles size={16} />
              <span>Sinh Lịch Kỳ Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Tổng ca trong kỳ</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1E293B', marginTop: '4px' }}>
            {kpis.total}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFBEB',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #FDE68A',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 600 }}>Chờ chỉ định</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#B45309', marginTop: '4px' }}>
            {kpis.scheduled}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#EFF6FF',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #BFDBFE',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 600 }}>Đã chỉ định</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1D4ED8', marginTop: '4px' }}>
            {kpis.assigned}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#EEF2FF',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #C7D2FE',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#4338CA', fontWeight: 600 }}>Đang thực hiện</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#4338CA', marginTop: '4px' }}>
            {kpis.inProgress}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ECFDF5',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #A7F3D0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>Đã hoàn tất / Đóng ca</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
            {kpis.closed}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #FECACA',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#B91C1C', fontWeight: 600 }}>Quá hạn</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#B91C1C', marginTop: '4px' }}>
            {kpis.overdue}
          </div>
        </div>
      </div>

      {/* Filter & Period Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Period selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '6px 12px',
            }}
          >
            <Calendar size={15} color="#64748B" />
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Kỳ:</span>
            <input
              type="text"
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              placeholder="YYYY-Mmm (vd: 2026-M10)"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1E293B',
                width: '100px',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Status buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#F1F5F9',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'SCHEDULED', label: 'Chờ chỉ định' },
              { id: 'ASSIGNED', label: 'Đã giao' },
              { id: 'IN_PROGRESS', label: 'Đang làm' },
              { id: 'CLOSED', label: 'Đã đóng ca' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: statusFilter === st.id ? 700 : 500,
                  backgroundColor: statusFilter === st.id ? '#FFFFFF' : 'transparent',
                  color: statusFilter === st.id ? 'var(--brand-primary, #24594D)' : '#64748B',
                  boxShadow: statusFilter === st.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={15}
            color="#94A3B8"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã mộ, khu, nhân viên..."
            style={{
              width: '100%',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '7px 12px 7px 32px',
              fontSize: '13px',
              color: '#1E293B',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* 4 UI States */}
      {loading ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <RefreshCw
            size={32}
            color="var(--brand-primary, #24594D)"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}
          />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
            Đang tải danh sách lịch chăm sóc định kỳ...
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Hệ thống đang đồng bộ dữ liệu từ máy chủ
          </div>
        </div>
      ) : error ? (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={32} color="#DC2626" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#991B1B' }}>{error}</div>
          <button
            onClick={() => fetchSchedules()}
            style={{
              marginTop: '14px',
              padding: '8px 16px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Thử lại kết nối
          </button>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Calendar size={40} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1E293B' }}>
            Chưa có lịch chăm sóc trong kỳ này
          </div>
          <p
            style={{
              fontSize: '13px',
              color: '#64748B',
              maxWidth: '460px',
              margin: '6px auto 20px',
            }}
          >
            Không tìm thấy ca chăm sóc nào cho bộ lọc hiện tại. Quản trị viên có thể kích hoạt sinh lịch tự động dựa trên các hợp đồng dịch vụ đang có hiệu lực.
          </p>
          {canManageCare && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              style={{
                padding: '9px 18px',
                backgroundColor: 'var(--brand-primary, #24594D)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} />
              <span>Sinh Lịch Ngay Cho Kỳ {currentPeriod}</span>
            </button>
          )}
        </div>
      ) : (
        /* Normal Table View */
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    MÃ CA / KỲ
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    KHU / Ô MỘ
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    GÓI DỊCH VỤ
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    NGÀY THỰC HIỆN
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    NGƯỜI PHỤ TRÁCH
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    TIẾN ĐỘ / ẢNH
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    TRẠNG THÁI
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                    THAO TÁC
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagination.pagedItems.map((item) => (
                  <tr
                    key={item.schedule_id}
                    onClick={() => openScheduleDetail(item.schedule_id)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary, #24594D)' }}>
                      <div>#{item.schedule_id}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'sans-serif' }}>{item.period_key}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} color="#64748B" />
                        <span>{item.plot_code || `Plot #${item.plot_id}`}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{item.zone_name || 'Khu chung'}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#1E293B', fontWeight: 500 }}>
                      {item.package_name || `Gói #${item.package_id}`}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                        <Calendar size={13} color="#64748B" />
                        <span>{item.scheduled_date}</span>
                      </div>
                      {item.closed_at && (
                        <div style={{ color: '#059669', fontSize: '11px', marginTop: '2px' }}>
                          Đóng: {new Date(item.closed_at).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                      {item.caretaker_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: 500 }}>
                          <UserIcon size={14} color="#64748B" />
                          <span>{item.caretaker_name}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#B45309', fontStyle: 'italic', fontSize: '12px' }}>Chưa phân công</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span style={{ color: '#334155', fontWeight: 500 }}>
                          {item.completed_tasks_count}/{item.tasks_count} việc
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B' }}>
                          <Camera size={13} />
                          <span>{item.evidence_count}</span>
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            item.status === 'CLOSED'
                              ? '#ECFDF5'
                              : item.status === 'IN_PROGRESS'
                              ? '#EEF2FF'
                              : item.status === 'ASSIGNED'
                              ? '#EFF6FF'
                              : item.status === 'OVERDUE'
                              ? '#FEF2F2'
                              : '#FFFBEB',
                          color:
                            item.status === 'CLOSED'
                              ? '#047857'
                              : item.status === 'IN_PROGRESS'
                              ? '#4338CA'
                              : item.status === 'ASSIGNED'
                              ? '#1D4ED8'
                              : item.status === 'OVERDUE'
                              ? '#B91C1C'
                              : '#B45309',
                          border: `1px solid ${
                            item.status === 'CLOSED'
                              ? '#A7F3D0'
                              : item.status === 'IN_PROGRESS'
                              ? '#C7D2FE'
                              : item.status === 'ASSIGNED'
                              ? '#BFDBFE'
                              : item.status === 'OVERDUE'
                              ? '#FECACA'
                              : '#FDE68A'
                          }`,
                        }}
                      >
                        {item.status === 'CLOSED'
                          ? 'Đã đóng ca'
                          : item.status === 'IN_PROGRESS'
                          ? 'Đang làm'
                          : item.status === 'ASSIGNED'
                          ? 'Đã giao việc'
                          : item.status === 'OVERDUE'
                          ? 'Quá hạn'
                          : 'Chờ giao'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openScheduleDetail(item.schedule_id)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#F1F5F9',
                          color: 'var(--brand-primary, #24594D)',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.handlePageChange}
            onPageSizeChange={pagination.handlePageSizeChange}
          />
        </div>
      )}

      {/* Schedule Detail Modal / Drawer */}
      {isDetailOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(36, 89, 77, 0.1)',
                    color: 'var(--brand-primary, #24594D)',
                  }}
                >
                  <ListTodo size={20} />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1E293B',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>Ca chăm sóc #{selectedSchedule?.schedule_id}</span>
                    <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                      ({selectedSchedule?.period_key})
                    </span>
                  </h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                    Mộ: {selectedSchedule?.plot_code} • {selectedSchedule?.package_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {detailLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <RefreshCw
                    size={28}
                    color="var(--brand-primary, #24594D)"
                    style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }}
                  />
                  <div style={{ fontSize: '13px', color: '#64748B' }}>Đang tải chi tiết ca chăm sóc...</div>
                </div>
              ) : selectedSchedule ? (
                <>
                  {/* Status & Conflict alert */}
                  {selectedSchedule.has_conflict && (
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                      }}
                    >
                      <AlertTriangle size={18} color="#D97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ fontSize: '12px', color: '#92400E' }}>
                        <div style={{ fontWeight: 700 }}>Cảnh báo trùng lịch công tác:</div>
                        <div>{selectedSchedule.conflict_reason}</div>
                      </div>
                    </div>
                  )}

                  {/* Summary Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '12px',
                      backgroundColor: '#F8FAFC',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748B' }}>Ngày quy định:</span>
                      <div style={{ fontFamily: 'monospace', color: '#1E293B', fontWeight: 600, marginTop: '2px' }}>
                        {selectedSchedule.scheduled_date}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Trạng thái:</span>
                      <div style={{ marginTop: '2px', fontWeight: 600, color: 'var(--brand-primary, #24594D)' }}>
                        {selectedSchedule.status}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Nhân viên phụ trách:</span>
                      <div style={{ fontWeight: 600, color: '#1E293B', marginTop: '2px' }}>
                        {selectedSchedule.caretaker_name || 'Chưa phân công'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Đóng ca lúc:</span>
                      <div style={{ fontFamily: 'monospace', color: '#1E293B', marginTop: '2px' }}>
                        {selectedSchedule.closed_at
                          ? new Date(selectedSchedule.closed_at).toLocaleString('vi-VN')
                          : 'Chưa hoàn tất'}
                      </div>
                    </div>
                  </div>

                  {/* Caretaker Assignment */}
                  {canManageCare && selectedSchedule.status !== 'CLOSED' && (
                    <div
                      style={{
                        backgroundColor: '#F8FAFC',
                        padding: '14px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                          Chỉ định / đổi nhân viên phụ trách:
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          Nhập User ID nhân viên thực địa phụ trách ca này
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={caretakerInputId}
                          onChange={(e) => setCaretakerInputId(e.target.value)}
                          placeholder="User ID"
                          style={{
                            width: '100px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: '#1E293B',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={handleAssignCaretaker}
                          disabled={assignLoading || !caretakerInputId}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: 'var(--brand-primary, #24594D)',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: assignLoading || !caretakerInputId ? 0.6 : 1,
                          }}
                        >
                          {assignLoading ? 'Lưu...' : 'Giao việc'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Checklist Section */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h3
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#1E293B',
                          margin: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <ListTodo size={16} color="var(--brand-primary, #24594D)" />
                        <span>Danh mục công việc (Checklist)</span>
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                        Đã làm: {selectedSchedule.completed_tasks_count}/{selectedSchedule.checklist_items.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedSchedule.checklist_items.map((task) => (
                        <div
                          key={task.item_id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: task.is_completed ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                            backgroundColor: task.is_completed ? '#F0FDF4' : '#FFFFFF',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <input
                              type="checkbox"
                              checked={task.is_completed}
                              onChange={() => handleToggleChecklistItem(task)}
                              disabled={selectedSchedule.status === 'CLOSED'}
                              style={{ marginTop: '2px', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  style={{
                                    textDecoration: task.is_completed ? 'line-through' : 'none',
                                    color: task.is_completed ? '#64748B' : '#1E293B',
                                  }}
                                >
                                  {task.task_description}
                                </span>
                                {task.is_required && (
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      backgroundColor: '#FEE2E2',
                                      color: '#B91C1C',
                                      border: '1px solid #FCA5A5',
                                    }}
                                  >
                                    Bắt buộc
                                  </span>
                                )}
                              </div>
                              {task.field_notes && (
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontStyle: 'italic' }}>
                                  Ghi chú: {task.field_notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Photo Evidence Section */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h3
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#1E293B',
                          margin: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Camera size={16} color="var(--brand-primary, #24594D)" />
                        <span>Minh chứng hình ảnh ({selectedSchedule.media_evidences.length})</span>
                      </h3>
                      {selectedSchedule.status !== 'CLOSED' && (
                        <button
                          onClick={() => setIsEvidenceModalOpen(true)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          <UploadCloud size={14} color="var(--brand-primary, #24594D)" />
                          <span>Chụp / Tải ảnh</span>
                        </button>
                      )}
                    </div>

                    {selectedSchedule.media_evidences.length === 0 ? (
                      <div
                        style={{
                          padding: '18px',
                          backgroundColor: '#F8FAFC',
                          border: '1px dashed #CBD5E1',
                          borderRadius: '8px',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: '#64748B',
                        }}
                      >
                        Chưa có ảnh minh chứng hiện trường. Cần ít nhất 1 ảnh để đủ điều kiện đóng ca.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                        {selectedSchedule.media_evidences.map((ev) => (
                          <div
                            key={ev.evidence_id}
                            style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '110px',
                                backgroundColor: '#E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Camera size={28} color="#94A3B8" />
                            </div>
                            <div style={{ padding: '8px 10px', fontSize: '12px' }}>
                              <div style={{ fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ev.caption || 'Ảnh hiện trường'}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                                {new Date(ev.uploaded_at).toLocaleTimeString('vi-VN')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={() => setIsDetailOpen(false)}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Đóng
              </button>

              {selectedSchedule && selectedSchedule.status !== 'CLOSED' && (
                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>Xác nhận & Đóng ca chăm sóc</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Period Generator Modal */}
      {isGenerateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <form
            onSubmit={handleGeneratePeriod}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              width: '100%',
              maxWidth: '440px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1E293B',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={16} color="var(--brand-primary, #24594D)" />
                <span>Sinh Lịch Chăm Sóc Định Kỳ</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <p style={{ color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Hệ thống sẽ quét toàn bộ hợp đồng dịch vụ chăm sóc đang có hiệu lực trong tháng và tạo lịch công việc tương ứng.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Năm</label>
                  <input
                    type="number"
                    value={genYear}
                    onChange={(e) => setGenYear(Number(e.target.value))}
                    min={2020}
                    max={2050}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      color: '#1E293B',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Tháng (1 - 12)</label>
                  <input
                    type="number"
                    value={genMonth}
                    onChange={(e) => setGenMonth(Number(e.target.value))}
                    min={1}
                    max={12}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      color: '#1E293B',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={genLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--brand-primary, #24594D)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: genLoading ? 0.6 : 1,
                }}
              >
                {genLoading ? 'Đang xử lý...' : 'Bắt đầu sinh lịch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {isEvidenceModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <form
            onSubmit={handleUploadEvidence}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              width: '100%',
              maxWidth: '440px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1E293B',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Camera size={16} color="var(--brand-primary, #24594D)" />
                <span>Đính Kèm Ảnh Hiện Trường</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Chọn tệp ảnh
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    fontSize: '12px',
                    color: '#475569',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mô tả / Chú thích ảnh
                </label>
                <input
                  type="text"
                  value={evidenceCaption}
                  onChange={(e) => setEvidenceCaption(e.target.value)}
                  placeholder="Vd: Đã dọn cỏ và lau bia mộ tươm tất..."
                  style={{
                    width: '100%',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: '#1E293B',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(false)}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={evidenceUploading || !evidenceFile}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--brand-primary, #24594D)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: evidenceUploading || !evidenceFile ? 0.6 : 1,
                }}
              >
                {evidenceUploading ? 'Đang tải lên...' : 'Tải lên ảnh'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <form
            onSubmit={handleCloseShift}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              width: '100%',
              maxWidth: '440px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1E293B',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} color="#059669" />
                <span>Nghiệm Thu & Đóng Ca Chăm Sóc</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  color: '#065F46',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Điều kiện hoàn thành ca chăm sóc:</div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px' }}>
                  <li>Toàn bộ hạng mục đánh dấu [Bắt buộc] phải được hoàn thành.</li>
                  <li>Phải có ít nhất 1 ảnh minh chứng trạng thái thực địa trên hệ thống.</li>
                </ul>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Nhận xét / Ghi chú đóng ca (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ghi nhận hiện trạng sau khi chăm sóc, các lưu ý nếu có..."
                  style={{
                    width: '100%',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#1E293B',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={closingShift}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: closingShift ? 0.6 : 1,
                }}
              >
                {closingShift ? 'Đang nghiệm thu...' : 'Xác nhận Đóng ca'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
