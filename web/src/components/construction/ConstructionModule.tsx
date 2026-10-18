import type { WorkBasisItem } from '../contracts/WorkBasisView'
import { apiFetch } from '../../services/apiClient'
import { PlotDirectionsButton } from '../plots/PlotDirectionsButton'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Hammer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  FileCheck,
  Calendar,
  User as UserIcon,
  MapPin,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { useNotificationModal } from '../../context/NotificationModalContext'
import type {
  ConstructionOrderResponse,
  ConstructionTaskBrief,
  StaffUnavailabilityResponse,
} from '../../types/construction'
import { Pagination, usePagination } from '../common/Pagination'

export const ConstructionModule: React.FC = () => {
  const { accessToken: token, user, hasPermission } = useAuth()
  const { confirm } = useNotificationModal()

  // Main state
  const [orders, setOrders] = useState<ConstructionOrderResponse[]>([])
  const [unavailabilities, setUnavailabilities] = useState<StaffUnavailabilityResponse[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<Array<{ user_id: number; username: string; full_name: string; roles: string[] }>>([])

  // Sub-view and filters
  const [activeSubView, setActiveSubView] = useState<'ORDERS' | 'SCHEDULING'>('ORDERS')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'id_desc' | 'id_asc' | 'start_desc' | 'start_asc' | 'target_asc' | 'target_desc'>('id_desc')

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState<ConstructionOrderResponse | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false)
  const [workBases, setWorkBases] = useState<WorkBasisItem[]>([])
  const [basesLoading, setBasesLoading] = useState(false)
  const [basisReload, setBasisReload] = useState(0)
  const [basisError, setBasisError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false)
  const [evidenceTaskId, setEvidenceTaskId] = useState<number | null>(null)
  const [isUnavailModalOpen, setIsUnavailModalOpen] = useState<boolean>(false)

  // Form states - Create Order
  const [createForm, setCreateForm] = useState({
    annex_id: '',
    plot_id: '',
    supervisor_id: user?.user_id?.toString() || '1',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    notes: '',
  })
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  // Form states - Evidence upload
  const [evidenceCaption, setEvidenceCaption] = useState<string>('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceUploadLoading, setEvidenceUploadLoading] = useState<boolean>(false)

  // Form states - Staff Unavailability
  const [unavailForm, setUnavailForm] = useState({
    user_id: user?.user_id?.toString() || '1',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    reason: 'Nghỉ phép thường niên',
  })

  // Feedback message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setActionError(msg)
      setTimeout(() => setActionError(null), 5000)
    } else {
      setActionSuccess(msg)
      setTimeout(() => setActionSuccess(null), 4000)
    }
  }

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch('/api/v1/construction/orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể tải danh sách lệnh thi công')
      }
      const data = await res.json()
      setOrders(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchUnavailabilities = useCallback(async () => {
    if (!token) return
    try {
      const res = await apiFetch('/api/v1/construction/unavailability', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUnavailabilities(data)
      }
    } catch {
      // Ignored non-critical
    }
  }, [token])

  useEffect(() => {
    fetchOrders()
    fetchUnavailabilities()
  }, [fetchOrders, fetchUnavailabilities])

  useEffect(() => {
    if (!token) return
    apiFetch('/api/v1/auth/staff', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setStaffList(data))
      .catch(() => {})
  }, [token])

  // Check conflict when creating order
  useEffect(() => {
    if (!token || !createForm.supervisor_id || !createForm.start_date || !createForm.expected_end_date) return
    const check = async () => {
      try {
        const res = await apiFetch(
          `/api/v1/construction/staff-conflict-check?user_id=${createForm.supervisor_id}&start_date=${createForm.start_date}&end_date=${createForm.expected_end_date}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.has_conflict) {
            setConflictWarning(data.warning_message)
          } else {
            setConflictWarning(null)
          }
        }
      } catch {
        // ignore
      }
    }
    check()
  }, [createForm.supervisor_id, createForm.start_date, createForm.expected_end_date, token])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isCreateModalOpen || !token) return
    const controller = new AbortController()
    setBasisError('')
    setBasesLoading(true)
    apiFetch('/api/v1/contracts/work-bases?status=ACTIVE', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error('Chưa tải được công việc được bàn giao.'); return res.json() })
      .then((items: WorkBasisItem[]) => setWorkBases(items.filter(item => ['BURIAL', 'CONSTRUCTION'].includes(item.annex_type) && item.plot_id)))
      .catch(err => { if (!controller.signal.aborted) setBasisError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setBasesLoading(false) })
    return () => controller.abort()
  }, [isCreateModalOpen, token, basisReload])

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    try {
      const res = await apiFetch('/api/v1/construction/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          annex_id: parseInt(createForm.annex_id),
          plot_id: parseInt(createForm.plot_id),
          supervisor_id: parseInt(createForm.supervisor_id),
          start_date: createForm.start_date,
          expected_end_date: createForm.expected_end_date,
          notes: createForm.notes,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Tạo lệnh thi công thất bại')
      }
      setIsCreateModalOpen(false)
      showNotification('Đã tạo thành công lệnh thi công mới!')
      fetchOrders()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Có lỗi xảy ra', true)
    }
  }

  const handleCompleteTask = async (task: ConstructionTaskBrief) => {
    if (!token || !selectedOrder) return
    try {
      const res = await apiFetch(`/api/v1/construction/tasks/${task.task_id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          field_notes: `Hoàn tất bởi ${user?.full_name || 'Quản trang'} lúc ${new Date().toLocaleTimeString('vi-VN')}`,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể hoàn thành công việc')
      }
      showNotification(`Đã hoàn thành công việc '${task.task_name}'!`)
      // Refresh order detail
      const updatedOrderRes = await apiFetch(`/api/v1/construction/orders/${selectedOrder.order_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (updatedOrderRes.ok) {
        const updated = await updatedOrderRes.json()
        setSelectedOrder(updated)
      }
      fetchOrders()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Có lỗi xảy ra', true)
    }
  }

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !evidenceTaskId || !evidenceFile) return
    try {
      setEvidenceUploadLoading(true)
      // Step 1: Upload file to MinIO
      const formData = new FormData()
      formData.append('file', evidenceFile)
      const uploadRes = await apiFetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Tải tệp lên máy chủ thất bại')
      }
      const fileData = await uploadRes.json()
      const fileId = fileData.file_id

      // Step 2: Attach evidence to task
      const attachRes = await apiFetch(`/api/v1/construction/tasks/${evidenceTaskId}/evidences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_id: fileId,
          caption: evidenceCaption || 'Ảnh nghiệm thu thực địa',
        }),
      })
      if (!attachRes.ok) {
        const errJson = await attachRes.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể liên kết bằng chứng vào công việc')
      }

      showNotification('Đã tải lên và đính kèm bằng chứng nghiệm thu thành công!')
      setIsEvidenceModalOpen(false)
      setEvidenceFile(null)
      setEvidenceCaption('')

      // Refresh order detail
      if (selectedOrder) {
        const updatedOrderRes = await apiFetch(`/api/v1/construction/orders/${selectedOrder.order_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (updatedOrderRes.ok) {
          const updated = await updatedOrderRes.json()
          setSelectedOrder(updated)
        }
      }
      fetchOrders()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Có lỗi khi đính kèm ảnh', true)
    } finally {
      setEvidenceUploadLoading(false)
    }
  }

  const handleReorderTasks = async (taskIndex: number, direction: 'UP' | 'DOWN') => {
    if (!selectedOrder || !token) return
    const tasks = [...selectedOrder.tasks].sort((a, b) => a.sort_order - b.sort_order)
    const targetIndex = direction === 'UP' ? taskIndex - 1 : taskIndex + 1
    if (targetIndex < 0 || targetIndex >= tasks.length) return

    // Swap sort orders
    const currentSort = tasks[taskIndex].sort_order
    const targetSort = tasks[targetIndex].sort_order

    const payload = {
      orders: [
        { task_id: tasks[taskIndex].task_id, sort_order: targetSort },
        { task_id: tasks[targetIndex].task_id, sort_order: currentSort },
      ],
    }

    try {
      const res = await apiFetch(`/api/v1/construction/orders/${selectedOrder.order_id}/reorder-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Không thể thay đổi thứ tự công việc')
      const updatedTasks = await res.json()
      setSelectedOrder({ ...selectedOrder, tasks: updatedTasks })
      showNotification('Đã cập nhật thứ tự công việc checklist')
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi sắp xếp', true)
    }
  }

  const handleCompleteOrder = async (orderId: number) => {
    if (!token) return
    const confirmed = await confirm({
      title: 'Xác nhận nghiệm thu công trình',
      message: 'Xác nhận nghiệm thu toàn bộ công trình? Lưu ý: Nghiệm thu công trình không tự ý an táng hay thay đổi người mất.',
      confirmText: 'Xác nhận nghiệm thu',
      cancelText: 'Quay lại',
    })
    if (!confirmed) return
    try {
      const res = await apiFetch(`/api/v1/construction/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: `Nghiệm thu đạt chuẩn kỹ thuật xây dựng và an toàn bởi ${user?.full_name || 'Quản lý'}`,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể hoàn tất nghiệm thu lệnh thi công')
      }
      showNotification('Nghiệm thu hoàn tất lệnh thi công! Trạng thái ô mộ đã được bảo toàn.')
      setIsDetailModalOpen(false)
      fetchOrders()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi nghiệm thu', true)
    }
  }

  const handleCreateUnavailability = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    try {
      const res = await apiFetch('/api/v1/construction/unavailability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: parseInt(unavailForm.user_id),
          start_date: unavailForm.start_date,
          end_date: unavailForm.end_date,
          reason: unavailForm.reason,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể đăng ký lịch bận/nghỉ')
      }
      showNotification('Đã lưu lịch nghỉ phép nhân viên!')
      setIsUnavailModalOpen(false)
      fetchUnavailabilities()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi đăng ký lịch nghỉ', true)
    }
  }

  const handleDeleteUnavailability = async (id: number) => {
    if (!token) return
    const confirmed = await confirm({
      title: 'Xóa lịch nghỉ phép',
      message: 'Xác nhận xóa bản ghi lịch nghỉ này khỏi hệ thống phân công?',
      confirmText: 'Xóa bản ghi',
      cancelText: 'Quay lại',
      isDestructive: true,
    })
    if (!confirmed) return
    try {
      const res = await apiFetch(`/api/v1/construction/unavailability/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Không thể xóa bản ghi')
      showNotification('Đã xóa bản ghi lịch nghỉ.')
      fetchUnavailabilities()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Lỗi xóa', true)
    }
  }

  // ---------------------------------------------------------------------------
  // Filtering & Stats
  // ---------------------------------------------------------------------------

  const filteredOrders = orders
    .filter((o) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'OVERDUE' ? o.is_overdue : o.status === statusFilter)
      const matchesSearch =
        !searchQuery ||
        o.plot_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.supervisor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.order_id.toString().includes(searchQuery)
      return matchesStatus && matchesSearch
    })
    .sort((a, b) => {
      if (sortBy === 'start_desc') {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0
        return dateB - dateA
      }
      if (sortBy === 'start_asc') {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0
        return dateA - dateB
      }
      if (sortBy === 'target_asc') {
        const dateA = a.expected_end_date ? new Date(a.expected_end_date).getTime() : 0
        const dateB = b.expected_end_date ? new Date(b.expected_end_date).getTime() : 0
        return dateA - dateB
      }
      if (sortBy === 'target_desc') {
        const dateA = a.expected_end_date ? new Date(a.expected_end_date).getTime() : 0
        const dateB = b.expected_end_date ? new Date(b.expected_end_date).getTime() : 0
        return dateB - dateA
      }
      if (sortBy === 'id_asc') return a.order_id - b.order_id
      return b.order_id - a.order_id
    })

  const ordersPagination = usePagination(filteredOrders, { initialPageSize: 10 })

  const totalOrders = orders.length
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length
  const inProgressOrders = orders.filter((o) => o.status === 'IN_PROGRESS').length
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length
  const overdueOrders = orders.filter((o) => o.is_overdue).length

  // Helper for status badge
  const renderStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== 'COMPLETED') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '9999px',
            border: '1px solid #FCA5A5',
          }}
        >
          <AlertTriangle size={12} />
          QUÁ HẠN
        </span>
      )
    }

    switch (status) {
      case 'PENDING':
        return (
          <span
            style={{
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '9999px',
              border: '1px solid #FCD34D',
            }}
          >
            Đang Chờ
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span
            style={{
              backgroundColor: '#DBEAFE',
              color: '#1D4ED8',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '9999px',
              border: '1px solid #93C5FD',
            }}
          >
            Đang Thi Công
          </span>
        )
      case 'COMPLETED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#D1FAE5',
              color: '#065F46',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '9999px',
              border: '1px solid #6EE7B7',
            }}
          >
            <CheckCircle2 size={12} />
            Đã Nghiệm Thu
          </span>
        )
      default:
        return (
          <span
            style={{
              backgroundColor: '#F1F5F9',
              color: '#475569',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '9999px',
            }}
          >
            {status}
          </span>
        )
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      {/* Toast Notifications */}
      {actionSuccess && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#065F46',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
          }}
        >
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: 'rgba(36, 89, 77, 0.1)',
                color: 'var(--brand-primary)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Thi Công & Xây Dựng
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Theo dõi thi công và nghiệm thu
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-secondary)', margin: 0 }}>
            Quản Lý Thi Công Thực Địa
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Điều phối kế hoạch, phân công giám sát, checklist từng bước và lưu trữ bằng chứng ảnh nghiệm thu thực địa
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              fetchOrders()
              fetchUnavailabilities()
            }}
            style={{
              padding: '9px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} />
            <span>Làm Mới</span>
          </button>

          {hasPermission('construction:write') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                padding: '9px 18px',
                backgroundColor: 'var(--brand-primary)',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(36, 89, 77, 0.2)',
              }}
            >
              <Plus size={16} />
              <span>+ Lập Lệnh Thi Công</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '20px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: '2px',
        }}
      >
        <button
          onClick={() => setActiveSubView('ORDERS')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubView === 'ORDERS' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubView === 'ORDERS' ? 'var(--brand-primary)' : '#64748B',
            fontWeight: activeSubView === 'ORDERS' ? 600 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <Hammer size={16} />
          <span>Lệnh Thi Công Thực Địa ({totalOrders})</span>
        </button>

        <button
          onClick={() => setActiveSubView('SCHEDULING')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubView === 'SCHEDULING' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubView === 'SCHEDULING' ? 'var(--brand-primary)' : '#64748B',
            fontWeight: activeSubView === 'SCHEDULING' ? 600 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <Calendar size={16} />
          <span>Lịch Nghỉ & Xung Đột Nhân Sự ({unavailabilities.length})</span>
        </button>
      </div>

      {/* VIEW 1: ORDERS */}
      {activeSubView === 'ORDERS' && (
        <>
          {/* KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(36, 89, 77, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-primary)',
                }}
              >
                <Hammer size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Tổng Số Lệnh</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--brand-secondary)' }}>
                  {totalOrders}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#B45309',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Đang Chờ Khởi Công</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#B45309' }}>{pendingOrders}</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#DBEAFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1D4ED8',
                }}
              >
                <Hammer size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Đang Thi Công</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1D4ED8' }}>{inProgressOrders}</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#D1FAE5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#065F46',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Đã Nghiệm Thu</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#065F46' }}>{completedOrders}</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Cảnh Báo Quá Hạn</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#DC2626' }}>{overdueOrders}</div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '14px 20px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Lọc trạng thái:</span>
              {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: statusFilter === s ? '1px solid var(--brand-primary)' : '1px solid #E2E8F0',
                    backgroundColor: statusFilter === s ? 'rgba(36, 89, 77, 0.08)' : '#F8FAFC',
                    color: statusFilter === s ? 'var(--brand-primary)' : '#64748B',
                    fontSize: '12px',
                    fontWeight: statusFilter === s ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {s === 'ALL'
                    ? 'Tất Cả'
                    : s === 'PENDING'
                      ? 'Đang Chờ'
                      : s === 'IN_PROGRESS'
                        ? 'Đang Thi Công'
                        : s === 'COMPLETED'
                          ? 'Đã Nghiệm Thu'
                          : 'Quá Hạn'}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: 'absolute', left: '10px', top: '10px' }}
              />
              <input
                type="text"
                placeholder="Tìm mã ô, giám sát, số lệnh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpDown size={14} color="#64748B" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12px',
                  color: '#1E293B',
                  outline: 'none',
                  fontWeight: 500,
                }}
              >
                <option value="id_desc">Lệnh mới nhất trước</option>
                <option value="id_asc">Lệnh cũ nhất trước</option>
                <option value="start_desc">Ngày bắt đầu mới nhất</option>
                <option value="start_asc">Ngày bắt đầu cũ nhất</option>
                <option value="target_asc">Hạn hoàn thành gần nhất</option>
                <option value="target_desc">Hạn hoàn thành xa nhất</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                padding: '48px',
                textAlign: 'center',
                border: '1px solid #E2E8F0',
              }}
            >
              <RefreshCw
                size={32}
                color="var(--brand-primary)"
                style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}
              />
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--brand-secondary)' }}>
                Đang nạp dữ liệu lệnh thi công...
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: '10px',
                padding: '32px',
                textAlign: 'center',
                border: '1px solid #F87171',
              }}
            >
              <AlertTriangle size={32} color="#DC2626" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#991B1B' }}>
                Không thể tải danh sách lệnh thi công
              </div>
              <p style={{ fontSize: '13px', color: '#B91C1C', margin: '6px 0 16px 0' }}>{error}</p>
              <button
                onClick={fetchOrders}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Thử Lại
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredOrders.length === 0 && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                padding: '48px 32px',
                textAlign: 'center',
                border: '1px solid #E2E8F0',
              }}
            >
              <Hammer size={40} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--brand-secondary)' }}>
                Chưa có lệnh thi công nào
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 20px 0' }}>
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                  : 'Hãy lập lệnh thi công mới từ phụ lục hợp đồng đã kích hoạt.'}
              </p>
              {hasPermission('construction:write') && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Lập Lệnh Thi Công Mới
                </button>
              )}
            </div>
          )}

          {/* Normal Table State / Dual-View */}
          {!loading && !error && filteredOrders.length > 0 && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
              }}
            >
              {/* Mobile Card View (< 1024px) */}
              <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
                {ordersPagination.pagedItems.map((order) => {
                  const progressNum = parseFloat(order.overall_progress.toString())
                  return (
                    <div
                      key={order.order_id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                          #TC-{order.order_id.toString().padStart(4, '0')}
                        </div>
                        <div>{renderStatusBadge(order.status, order.is_overdue)}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--brand-secondary)', fontWeight: 600, marginBottom: '4px' }}>
                        <MapPin size={14} color="#64748B" />
                        <span>{order.plot_code || `Ô mộ #${order.plot_id}`}</span><PlotDirectionsButton plotId={order.plot_id} plotCode={order.plot_code} />
                        {order.zone_name && <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 400 }}>({order.zone_name})</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                        <UserIcon size={13} color="#64748B" />
                        <span>Giám sát: {order.supervisor_name || `ID ${order.supervisor_id}`}</span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                        <span>Bắt đầu: {order.start_date || 'Chưa định'}</span> |{' '}
                        <span style={{ color: order.is_overdue ? '#DC2626' : '#64748B', fontWeight: order.is_overdue ? 600 : 400 }}>
                          Hạn: {order.expected_end_date}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 600, color: '#1E293B' }}>Tiến độ: {progressNum}%</span>
                          <span style={{ color: '#64748B' }}>{order.completed_tasks}/{order.total_tasks} việc</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${progressNum}%`,
                              height: '100%',
                              backgroundColor: progressNum === 100 ? '#059669' : 'var(--brand-primary)',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedOrder(order)
                          setIsDetailModalOpen(true)
                        }}
                        className="touch-target"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          color: 'var(--brand-primary)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <Hammer size={14} />
                        Chi Tiết & Checklist
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View (>= 1024px) */}
              <div className="desktop-only table-scroll-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        MÃ LỆNH
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        Ô MỘ / KHU VỰC
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        GIÁM SÁT VIÊN
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        THỜI GIAN THI CÔNG
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        TIẾN ĐỘ THỰC TẾ
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
                    {ordersPagination.pagedItems.map((order) => {
                      const progressNum = parseFloat(order.overall_progress.toString())
                      return (
                        <tr
                          key={order.order_id}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                            #TC-{order.order_id.toString().padStart(4, '0')}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <MapPin size={14} color="#64748B" />
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-secondary)' }}>
                                {order.plot_code || `Ô mộ #${order.plot_id}`}
                              </span>
                            </div>
                            <PlotDirectionsButton plotId={order.plot_id} plotCode={order.plot_code} />
                            {order.zone_name && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                {order.zone_name}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <UserIcon size={14} color="#64748B" />
                              <span style={{ fontSize: '13px', color: '#1E293B' }}>
                                {order.supervisor_name || `ID ${order.supervisor_id}`}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569' }}>
                            <div>Bắt đầu: {order.start_date || 'Chưa định'}</div>
                            <div style={{ color: order.is_overdue ? '#DC2626' : '#64748B', fontWeight: order.is_overdue ? 600 : 400 }}>
                              Hạn chót: {order.expected_end_date}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', width: '180px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#1E293B' }}>{progressNum}%</span>
                              <span style={{ color: '#64748B' }}>
                                {order.completed_tasks}/{order.total_tasks} việc
                              </span>
                            </div>
                            <div
                              style={{
                                width: '100%',
                                height: '8px',
                                backgroundColor: '#E2E8F0',
                                borderRadius: '4px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${progressNum}%`,
                                  height: '100%',
                                  backgroundColor: progressNum === 100 ? '#059669' : 'var(--brand-primary)',
                                  borderRadius: '4px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {renderStatusBadge(order.status, order.is_overdue)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedOrder(order)
                                setIsDetailModalOpen(true)
                              }}
                              style={{
                                padding: '6px 14px',
                                backgroundColor: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                borderRadius: '6px',
                                color: 'var(--brand-primary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Chi Tiết & Checklist
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={ordersPagination.currentPage}
                totalPages={ordersPagination.totalPages}
                pageSize={ordersPagination.pageSize}
                totalItems={ordersPagination.totalItems}
                onPageChange={ordersPagination.handlePageChange}
                onPageSizeChange={ordersPagination.handlePageSizeChange}
              />
            </div>
          )}
        </>
      )}

      {/* VIEW 2: SCHEDULING (G13) */}
      {activeSubView === 'SCHEDULING' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--brand-secondary)' }}>
                Danh Sách Lịch Nghỉ Phép & Lịch Bận Của Nhân Viên
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                Hệ thống tự động đối chiếu và cảnh báo xung đột lịch làm việc khi phân công quản trang thi công hoặc ca chăm sóc
              </p>
            </div>
            {hasPermission('construction:write') && (
              <button
                onClick={() => setIsUnavailModalOpen(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={15} />
                <span>+ Đăng Ký Lịch Bận</span>
              </button>
            )}
          </div>

          {unavailabilities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
              <Calendar size={36} color="#CBD5E1" style={{ margin: '0 auto 8px auto' }} />
              <div>Tất cả nhân viên đang sẵn sàng trực công trình (không có lịch nghỉ).</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontSize: '12px', color: '#475569' }}>NHÂN VIÊN</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', color: '#475569' }}>TỪ NGÀY</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', color: '#475569' }}>ĐẾN NGÀY</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', color: '#475569' }}>LÝ DO</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', color: '#475569', textAlign: 'right' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {unavailabilities.map((u) => (
                  <tr key={u.unavailability_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600 }}>
                      {u.user_name || `User #${u.user_id}`}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569' }}>{u.start_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569' }}>{u.end_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748B' }}>{u.reason || '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {hasPermission('construction:write') && (
                        <button
                          onClick={() => handleDeleteUnavailability(u.unavailability_id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#FEE2E2',
                            border: '1px solid #FCA5A5',
                            borderRadius: '4px',
                            color: '#DC2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: ORDER DETAIL & CHECKLIST (G11) */}
      {/* ------------------------------------------------------------------- */}
      {isDetailModalOpen && selectedOrder && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--brand-secondary)' }}>
                    Lệnh Thi Công #TC-{selectedOrder.order_id.toString().padStart(4, '0')}
                  </h3>
                  {renderStatusBadge(selectedOrder.status, selectedOrder.is_overdue)}
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  Ô Mộ: <strong>{selectedOrder.plot_code || selectedOrder.plot_id}</strong> | Giám Sát:{' '}
                  <strong>{selectedOrder.supervisor_name || selectedOrder.supervisor_id}</strong> | Hạn:{' '}
                  <strong>{selectedOrder.expected_end_date}</strong>
                  <PlotDirectionsButton plotId={selectedOrder.plot_id} plotCode={selectedOrder.plot_code} />
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Progress Summary */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    Tiến độ hoàn thành: {parseFloat(selectedOrder.overall_progress.toString())}%
                  </span>
                  <span style={{ fontSize: '13px', color: '#64748B' }}>
                    {selectedOrder.completed_required_tasks}/{selectedOrder.required_tasks} việc bắt buộc đã hoàn tất
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${parseFloat(selectedOrder.overall_progress.toString())}%`,
                      height: '100%',
                      backgroundColor:
                        parseFloat(selectedOrder.overall_progress.toString()) === 100
                          ? '#059669'
                          : 'var(--brand-primary)',
                      borderRadius: '5px',
                    }}
                  />
                </div>
                {selectedOrder.required_tasks > selectedOrder.completed_required_tasks && (
                  <div style={{ fontSize: '12px', color: '#B45309', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={13} />
                    <span>Quy tắc nghiệm thu: Cần hoàn tất 100% công việc bắt buộc (có ảnh minh chứng đầy đủ) trước khi nghiệm thu đóng lệnh.</span>
                  </div>
                )}
              </div>

              {/* Checklist Tasks List */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--brand-secondary)' }}>
                    Danh Mục Công Việc Thi Công (Checklist)
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Sử dụng các nút mũi tên để sắp xếp lại thứ tự công việc
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedOrder.tasks
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((task, idx) => (
                      <div
                        key={task.task_id}
                        style={{
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '14px 16px',
                          backgroundColor: task.status === 'DONE' ? '#F0FDF4' : '#FFFFFF',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            {/* Sort Controls */}
                            {hasPermission('construction:write') && selectedOrder.status !== 'COMPLETED' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', flexShrink: 0 }}>
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleReorderTasks(idx, 'UP')}
                                  style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: idx === 0 ? 'default' : 'pointer',
                                    opacity: idx === 0 ? 0.3 : 1,
                                    padding: 0,
                                  }}
                                >
                                  <ArrowUp size={14} color="#64748B" />
                                </button>
                                <button
                                  disabled={idx === selectedOrder.tasks.length - 1}
                                  onClick={() => handleReorderTasks(idx, 'DOWN')}
                                  style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: idx === selectedOrder.tasks.length - 1 ? 'default' : 'pointer',
                                    opacity: idx === selectedOrder.tasks.length - 1 ? 0.3 : 1,
                                    padding: 0,
                                  }}
                                >
                                  <ArrowDown size={14} color="#64748B" />
                                </button>
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand-secondary)' }}>
                                  {task.sort_order}. {task.task_name}
                                </span>
                                {task.is_required ? (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: '#FEE2E2',
                                      color: '#DC2626',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    BẮT BUỘC
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: '#F1F5F9',
                                      color: '#64748B',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    TÙY CHỌN
                                  </span>
                                )}
                                {task.status === 'DONE' ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: '#059669',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <CheckCircle2 size={13} />
                                    Đã Xong
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    Chưa Xong
                                  </span>
                                )}
                              </div>

                              {task.field_notes && (
                                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                  Ghi chú thực địa: {task.field_notes}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Task Action Buttons */}
                          {task.status !== 'DONE' && (hasPermission('construction:write') || hasPermission('construction:execute')) && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px dashed #E2E8F0' }}>
                              {hasPermission('construction:write') && (
                                <button
                                  onClick={() => {
                                    setEvidenceTaskId(task.task_id)
                                    setIsEvidenceModalOpen(true)
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#EFF6FF',
                                    border: '1px solid #BFDBFE',
                                    borderRadius: '6px',
                                    color: '#2563EB',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <UploadCloud size={13} />
                                  <span>+ Đính kèm ảnh</span>
                                </button>
                              )}

                              {hasPermission('construction:execute') && (
                                <button
                                  onClick={() => handleCompleteTask(task)}
                                  style={{
                                    padding: '6px 14px',
                                    backgroundColor: 'var(--brand-primary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#FFFFFF',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Hoàn Tất</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Evidences Attached to this Task */}
                        {task.evidences && task.evidences.length > 0 && (
                          <div
                            style={{
                              marginTop: '10px',
                              paddingTop: '8px',
                              borderTop: '1px dashed #E2E8F0',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', alignSelf: 'center' }}>
                              Hình ảnh minh chứng ({task.evidences.length}):
                            </span>
                            {task.evidences.map((ev) => (
                              <a
                                key={ev.evidence_id}
                                href={ev.download_url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: '11px',
                                  color: '#2563EB',
                                  backgroundColor: '#EFF6FF',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #BFDBFE',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <FileCheck size={12} />
                                <span>{ev.caption || ev.file_name || `Ảnh #${ev.evidence_id}`}</span>
                                <ExternalLink size={10} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div style={{ marginBottom: '20px', fontSize: '13px', color: '#475569', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '6px' }}>
                  <strong>Ghi chú lệnh thi công:</strong>
                  <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{selectedOrder.notes}</div>
                </div>
              )}
            </div>

            {/* Modal Footer / Acceptance Action */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                * Nghiệm thu công trình xác nhận hoàn thiện xây lắp, hoàn toàn độc lập với nghi thức an táng người mất.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>

                {hasPermission('construction:execute') && selectedOrder.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleCompleteOrder(selectedOrder.order_id)}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: '#059669',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Nghiệm Thu Toàn Bộ Công Trình</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: CREATE CONSTRUCTION ORDER */}
      {/* ------------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
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
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--brand-secondary)' }}>
                Lập Lệnh Thi Công Mới
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: '20px' }}>
              {/* Conflict Warning Banner (G13) */}
              {conflictWarning && (
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#92400E',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Cảnh báo phân công nhân sự:</strong>
                    <div style={{ marginTop: '2px' }}>{conflictWarning}</div>
                  </div>
                </div>
              )}

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Công việc được bàn giao *
                  </label>
                  <select required disabled={basesLoading} value={createForm.annex_id} onChange={e => {
                    const basis = workBases.find(item => item.annex_id === Number(e.target.value))
                    setCreateForm({ ...createForm, annex_id: e.target.value, plot_id: basis?.plot_id?.toString() || '' })
                  }} style={{ width: '100%', minHeight: '48px' }}>
                    <option value="">{basesLoading ? 'Đang tải công việc…' : 'Chọn công việc đã bàn giao'}</option>
                    {workBases.map(item => <option key={item.annex_id} value={item.annex_id}>{item.annex_code} · {item.plot_code}</option>)}
                  </select>
                  {basisError && <p role="alert">{basisError} <button type="button" onClick={() => setBasisReload(n => n + 1)}>Thử lại</button></p>}
                  {!basesLoading && !basisError && !workBases.length && <p>Chưa có công việc được bàn giao. <button type="button" onClick={() => setBasisReload(n => n + 1)}>Tải lại</button></p>}

                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Ô mộ
                  </label>
                  <input readOnly value={workBases.find(item => item.annex_id === Number(createForm.annex_id))?.plot_code || ''} placeholder="Chọn công việc để xem ô mộ" style={{ width: '100%', minHeight: '48px' }} />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Giám Sát Viên Chịu Trách Nhiệm *
                </label>
                <select
                  required
                  value={createForm.supervisor_id}
                  onChange={(e) => setCreateForm({ ...createForm, supervisor_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="">-- Chọn giám sát viên --</option>
                  {staffList.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Ngày Bắt Đầu Dự Kiến
                  </label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Hạn Chót Hoàn Thành *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.expected_end_date}
                    onChange={(e) => setCreateForm({ ...createForm, expected_end_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ghi Chú Yêu Cầu Thi Công
                </label>
                <textarea
                  rows={2}
                  placeholder="Yêu cầu riêng về vật liệu đá, phong thủy, hướng đặt..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', resize: 'none' }}
                />
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '16px', fontSize: '11px', color: '#64748B' }}>
                ✓ Hệ thống sẽ tự động khởi tạo 5 công việc chuẩn (Khảo sát, Móng lót, Hố kim tĩnh, Ốp đá hoa cương, Nghiệm thu bàn giao).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', backgroundColor: 'var(--brand-primary)', border: 'none', borderRadius: '6px', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Khởi Tạo Lệnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: UPLOAD & ATTACH EVIDENCE (G11) */}
      {/* ------------------------------------------------------------------- */}
      {isEvidenceModalOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--brand-secondary)' }}>
                Tải Lên Bằng Chứng Ảnh Nghiệm Thu
              </h3>
              <button
                onClick={() => setIsEvidenceModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadEvidence} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Chọn Tệp Ảnh Thực Địa (.jpg, .jpeg, .png) *
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mô Tả / Chú Thích Bằng Chứng *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Ảnh đổ bê tông móng kim tĩnh ngày 15/10"
                  value={evidenceCaption}
                  onChange={(e) => setEvidenceCaption(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={evidenceUploadLoading}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: 'var(--brand-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: evidenceUploadLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {evidenceUploadLoading ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Đang Tải...</span>
                    </>
                  ) : (
                    <span>Tải Lên & Đính Kèm</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 4: CREATE STAFF UNAVAILABILITY (G13) */}
      {/* ------------------------------------------------------------------- */}
      {isUnavailModalOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--brand-secondary)' }}>
                Đăng Ký Lịch Nghỉ / Bận Của Nhân Viên
              </h3>
              <button
                onClick={() => setIsUnavailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUnavailability} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nhân Viên Đăng Ký Vắng Mặt *
                </label>
                <select
                  required
                  value={unavailForm.user_id}
                  onChange={(e) => setUnavailForm({ ...unavailForm, user_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {staffList.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Từ Ngày *
                  </label>
                  <input
                    type="date"
                    required
                    value={unavailForm.start_date}
                    onChange={(e) => setUnavailForm({ ...unavailForm, start_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Đến Ngày *
                  </label>
                  <input
                    type="date"
                    required
                    value={unavailForm.end_date}
                    onChange={(e) => setUnavailForm({ ...unavailForm, end_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Lý Do Nghỉ / Bận
                </label>
                <input
                  type="text"
                  placeholder="Nghỉ phép năm, ốm, công tác ngoài..."
                  value={unavailForm.reason}
                  onChange={(e) => setUnavailForm({ ...unavailForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsUnavailModalOpen(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', backgroundColor: 'var(--brand-primary)', border: 'none', borderRadius: '6px', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Lưu Lịch Bận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default ConstructionModule
