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
      // Step 1: Upload file to MinIO staging
      const formData = new FormData()
      formData.append('file', evidenceFile)

      const uploadRes = await fetch('/api/v1/storage/upload', {
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

      // Step 2: Attach to care schedule evidence
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
      // Refresh detail
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
      showNotification('Đã đóng ca chăm sóc thành công (G12 gate đã xác thực)')
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
  // Filtering & KPIs
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
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center space-x-2 transition-all ${
            notification.isError
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
          }`}
        >
          {notification.isError ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold text-slate-100">
              Quản lý Dịch vụ Chăm sóc Định kỳ
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
              M10 G12 Ready
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Lịch chăm sóc khuôn viên mộ, phân công ca thực địa, checklist bắt buộc và minh chứng hình ảnh
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchSchedules()}
            disabled={loading}
            className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {canManageCare && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg shadow-sm flex items-center space-x-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Sinh Lịch Kỳ Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs text-slate-400">Tổng ca trong kỳ</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{kpis.total}</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs text-amber-400">Chờ chỉ định</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{kpis.scheduled}</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs text-blue-400">Đã chỉ định</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{kpis.assigned}</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs text-indigo-400">Đang thực hiện</div>
          <div className="text-2xl font-bold text-indigo-300 mt-1">{kpis.inProgress}</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs text-emerald-400">Đã đóng ca (G12)</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{kpis.closed}</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs text-rose-400">Quá hạn</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{kpis.overdue}</div>
        </div>
      </div>

      {/* Filter & Period Bar */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Period selector */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Kỳ:</span>
            <input
              type="text"
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              placeholder="YYYY-Mmm (vd: 2026-M10)"
              className="bg-transparent text-sm text-slate-200 outline-none w-28 font-mono"
            />
          </div>

          {/* Status buttons */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
            {['ALL', 'SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === st
                    ? 'bg-slate-700 text-slate-100 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL'
                  ? 'Tất cả'
                  : st === 'SCHEDULED'
                  ? 'Chờ chỉ định'
                  : st === 'ASSIGNED'
                  ? 'Đã giao'
                  : st === 'IN_PROGRESS'
                  ? 'Đang làm'
                  : 'Đã đóng ca'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã mộ, khu, nhân viên..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* 4 UI States */}
      {loading ? (
        <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <div className="text-slate-300 font-medium">Đang tải lịch chăm sóc định kỳ...</div>
          <div className="text-xs text-slate-500 mt-1">Hệ thống đang truy xuất dữ liệu từ cơ sở dữ liệu</div>
        </div>
      ) : error ? (
        <div className="bg-rose-950/20 border border-rose-800/50 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <div className="text-rose-200 font-medium">{error}</div>
          <button
            onClick={() => fetchSchedules()}
            className="mt-4 px-4 py-2 bg-rose-900 hover:bg-rose-800 text-rose-100 text-xs font-medium rounded-lg transition-colors"
          >
            Thử lại kết nối
          </button>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-slate-800/20 border border-dashed border-slate-700 rounded-xl p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <div className="text-slate-300 font-medium text-base">Chưa có lịch chăm sóc trong kỳ này</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Không tìm thấy ca chăm sóc nào cho bộ lọc hiện tại. Quản trị viên có thể kích hoạt sinh lịch tự động dựa trên các phụ lục dịch vụ đang hiệu lực.
          </p>
          {canManageCare && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg shadow transition-colors inline-flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Sinh Lịch Ngay Cho Kỳ {currentPeriod}</span>
            </button>
          )}
        </div>
      ) : (
        /* Normal Table View */
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-700 text-xs text-slate-400 uppercase font-medium">
                  <th className="py-3 px-4">Mã Ca / Kỳ</th>
                  <th className="py-3 px-4">Khu / Ô Mộ</th>
                  <th className="py-3 px-4">Gói Dịch Vụ</th>
                  <th className="py-3 px-4">Ngày Thực Hiện</th>
                  <th className="py-3 px-4">Người Phụ Trách</th>
                  <th className="py-3 px-4">Tiến Độ / Ảnh</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {filteredSchedules.map((item) => (
                  <tr
                    key={item.schedule_id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => openScheduleDetail(item.schedule_id)}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-cyan-300">
                      <div>#{item.schedule_id}</div>
                      <div className="text-xs text-slate-500 font-sans">{item.period_key}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200 flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.plot_code || `Plot #${item.plot_id}`}</span>
                      </div>
                      <div className="text-xs text-slate-500">{item.zone_name || 'Khu chung'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-200">{item.package_name || `Gói #${item.package_id}`}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <div className="flex items-center space-x-1 text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.scheduled_date}</span>
                      </div>
                      {item.closed_at && (
                        <div className="text-emerald-400 text-[11px] mt-0.5">
                          Đóng: {new Date(item.closed_at).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {item.caretaker_name ? (
                        <div className="flex items-center space-x-1 text-slate-200">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.caretaker_name}</span>
                        </div>
                      ) : (
                        <span className="text-amber-400 italic">Chưa phân công</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-slate-300">
                          {item.completed_tasks_count}/{item.tasks_count} việc
                        </span>
                        <span className="flex items-center space-x-1 text-slate-400">
                          <Camera className="w-3.5 h-3.5" />
                          <span>{item.evidence_count}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          item.status === 'CLOSED'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                            : item.status === 'IN_PROGRESS'
                            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50'
                            : item.status === 'ASSIGNED'
                            ? 'bg-blue-950/60 text-blue-300 border-blue-700/50'
                            : item.status === 'OVERDUE'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-700/50'
                            : 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                        }`}
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
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openScheduleDetail(item.schedule_id)
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Detail Modal / Drawer */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  <ListTodo className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                    <span>Ca chăm sóc #{selectedSchedule?.schedule_id}</span>
                    <span className="text-xs font-mono text-cyan-400">({selectedSchedule?.period_key})</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Mộ: {selectedSchedule?.plot_code} • {selectedSchedule?.package_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-6">
              {detailLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  <div className="text-xs text-slate-400">Đang tải chi tiết ca chăm sóc...</div>
                </div>
              ) : selectedSchedule ? (
                <>
                  {/* Status & G13 Conflict alert */}
                  {selectedSchedule.has_conflict && (
                    <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start space-x-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-200">
                        <div className="font-semibold">Cảnh báo trùng lịch công tác (G13):</div>
                        <div>{selectedSchedule.conflict_reason}</div>
                      </div>
                    </div>
                  )}

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-800/40 p-3.5 rounded-lg border border-slate-700/60 text-xs">
                    <div>
                      <span className="text-slate-400">Ngày quy định:</span>
                      <div className="font-mono text-slate-200 font-medium mt-0.5">
                        {selectedSchedule.scheduled_date}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Trạng thái:</span>
                      <div className="mt-0.5 font-medium text-cyan-300">{selectedSchedule.status}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Nhân viên phụ trách:</span>
                      <div className="font-medium text-slate-200 mt-0.5">
                        {selectedSchedule.caretaker_name || 'Chưa phân công'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Đóng ca lúc:</span>
                      <div className="font-mono text-slate-200 mt-0.5">
                        {selectedSchedule.closed_at
                          ? new Date(selectedSchedule.closed_at).toLocaleString('vi-VN')
                          : 'Chưa hoàn tất'}
                      </div>
                    </div>
                  </div>

                  {/* Caretaker Assignment */}
                  {canManageCare && selectedSchedule.status !== 'CLOSED' && (
                    <div className="bg-slate-800/30 p-3.5 rounded-lg border border-slate-700/50 flex items-center justify-between gap-3">
                      <div className="text-xs">
                        <span className="font-medium text-slate-200">Chỉ định / đổi nhân viên:</span>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Nhập User ID nhân viên chăm sóc thực địa
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={caretakerInputId}
                          onChange={(e) => setCaretakerInputId(e.target.value)}
                          placeholder="User ID"
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                        />
                        <button
                          onClick={handleAssignCaretaker}
                          disabled={assignLoading || !caretakerInputId}
                          className="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                        >
                          {assignLoading ? 'Lưu...' : 'Giao việc'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Checklist Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                        <ListTodo className="w-4 h-4 text-cyan-400" />
                        <span>Danh mục công việc (Checklist)</span>
                      </h3>
                      <span className="text-xs text-slate-400">
                        Đã làm: {selectedSchedule.completed_tasks_count}/{selectedSchedule.checklist_items.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {selectedSchedule.checklist_items.map((task) => (
                        <div
                          key={task.item_id}
                          className={`p-3 rounded-lg border flex items-start justify-between gap-3 transition-colors ${
                            task.is_completed
                              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                              : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={task.is_completed}
                              onChange={() => handleToggleChecklistItem(task)}
                              disabled={selectedSchedule.status === 'CLOSED'}
                              className="mt-0.5 w-4 h-4 rounded text-cyan-600 focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-600 cursor-pointer disabled:opacity-50"
                            />
                            <div>
                              <div className="text-xs font-medium flex items-center space-x-2">
                                <span className={task.is_completed ? 'line-through opacity-80' : ''}>
                                  {task.task_description}
                                </span>
                                {task.is_required && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800/60">
                                    Bắt buộc
                                  </span>
                                )}
                              </div>
                              {task.field_notes && (
                                <div className="text-[11px] text-slate-400 mt-1 italic">
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
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                        <Camera className="w-4 h-4 text-cyan-400" />
                        <span>Minh chứng hình ảnh ({selectedSchedule.media_evidences.length})</span>
                      </h3>
                      {selectedSchedule.status !== 'CLOSED' && (
                        <button
                          onClick={() => setIsEvidenceModalOpen(true)}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded flex items-center space-x-1.5 transition-colors"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Chụp / Tải ảnh</span>
                        </button>
                      )}
                    </div>

                    {selectedSchedule.media_evidences.length === 0 ? (
                      <div className="p-4 bg-slate-800/20 border border-dashed border-slate-700 rounded-lg text-center text-xs text-slate-500">
                        Chưa có ảnh minh chứng hiện trường. Cần ít nhất 1 ảnh để đủ điều kiện đóng ca (G12).
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedSchedule.media_evidences.map((ev) => (
                          <div
                            key={ev.evidence_id}
                            className="bg-slate-800/60 border border-slate-700/60 rounded-lg overflow-hidden group"
                          >
                            <div className="h-28 bg-slate-900 flex items-center justify-center relative">
                              <Camera className="w-8 h-8 text-slate-600" />
                              <div className="absolute inset-0 bg-cyan-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[11px] text-cyan-200 font-mono">
                                  {ev.file_id || 'Photo'}
                                </span>
                              </div>
                            </div>
                            <div className="p-2 text-xs">
                              <div className="font-medium text-slate-200 truncate" title={ev.caption || ''}>
                                {ev.caption || 'Ảnh hiện trường'}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
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
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Đóng
              </button>

              {selectedSchedule && selectedSchedule.status !== 'CLOSED' && (
                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác nhận & Đóng ca chăm sóc</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Period Generator Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleGeneratePeriod}
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Sinh Lịch Chăm Sóc Định Kỳ</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-400">
                Hệ thống sẽ quét toàn bộ hợp đồng dịch vụ chăm sóc đang có hiệu lực trong tháng và tạo lịch công việc tương ứng. Áp dụng quy tắc neo ngày cuối tháng và đảm bảo tính bất biến (idempotent).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Năm</label>
                  <input
                    type="number"
                    value={genYear}
                    onChange={(e) => setGenYear(Number(e.target.value))}
                    min={2020}
                    max={2050}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tháng (1 - 12)</label>
                  <input
                    type="number"
                    value={genMonth}
                    onChange={(e) => setGenMonth(Number(e.target.value))}
                    min={1}
                    max={12}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={genLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {genLoading ? 'Đang xử lý...' : 'Bắt đầu sinh lịch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleUploadEvidence}
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Đính Kèm Ảnh Hiện Trường</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Chọn tệp ảnh</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-cyan-900 file:text-cyan-200 hover:file:bg-cyan-800 cursor-pointer"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Mô tả / Chú thích ảnh</label>
                <input
                  type="text"
                  value={evidenceCaption}
                  onChange={(e) => setEvidenceCaption(e.target.value)}
                  placeholder="Vd: Đã dọn cỏ và lau bia mộ tươm tất..."
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={evidenceUploading || !evidenceFile}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {evidenceUploading ? 'Đang tải lên...' : 'Tải lên MinIO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleCloseShift}
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Nghiệm Thu & Đóng Ca Chăm Sóc</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-cyan-200">
                <div className="font-semibold mb-1">Kiểm tra điều kiện G12:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-cyan-300">
                  <li>Toàn bộ hạng mục đánh dấu [Bắt buộc] phải được hoàn thành.</li>
                  <li>Phải có ít nhất 1 ảnh minh chứng trạng thái READY trong MinIO.</li>
                </ul>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Nhận xét / Ghi chú đóng ca (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ghi nhận hiện trạng sau khi chăm sóc, các lưu ý nếu có..."
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 text-xs"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={closingShift}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors disabled:opacity-50"
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
