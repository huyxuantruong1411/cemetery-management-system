import { apiFetch } from '../../services/apiClient'
import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import type { AuditLogResponse, AuditSummaryResponse } from '../../types/audit'
import { Pagination, usePagination } from '../common/Pagination'

export const AuditModule: React.FC = () => {
  const { accessToken } = useAuth()

  // Data states
  const [logs, setLogs] = useState<AuditLogResponse[]>([])
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null)
  const [entities, setEntities] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [limit, setLimit] = useState<number>(50)

  // Detail Modal
  const [activeLog, setActiveLog] = useState<AuditLogResponse | null>(null)
  const [showRawJson, setShowRawJson] = useState<boolean>(false)

  useEffect(() => {
    setShowRawJson(false)
  }, [activeLog])

  // Pagination for logs
  const {
    currentPage: logPage,
    pageSize: logPageSize,
    totalPages: logTotalPages,
    totalItems: logTotalItems,
    paginatedItems: paginatedLogs,
    setCurrentPage: setLogPage,
    setPageSize: setLogPageSize,
    startIndex: logStartIndex,
    endIndex: logEndIndex,
  } = usePagination(logs, 15)

  const fetchSummary = useCallback(async () => {
    if (!accessToken) return
    try {
      const [sumRes, entRes, actRes] = await Promise.all([
        apiFetch('/api/v1/audit/summary', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch('/api/v1/audit/entities', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch('/api/v1/audit/actions', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])

      if (sumRes.ok) setSummary(await sumRes.json())
      if (entRes.ok) setEntities(await entRes.json())
      if (actRes.ok) setActions(await actRes.json())
    } catch {
      // Non-critical background failure
    }
  }, [accessToken])

  const fetchLogs = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)

    try {
      const q = new URLSearchParams()
      if (selectedAction) q.append('action_type', selectedAction)
      if (selectedEntity) q.append('target_entity', selectedEntity)
      if (searchTerm.trim()) q.append('search', searchTerm.trim())
      q.append('limit', limit.toString())

      const resp = await apiFetch(`/api/v1/audit/logs?${q.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!resp.ok) {
        throw new Error(`Lỗi tải nhật ký hệ thống: ${resp.status} (${resp.statusText})`)
      }

      const data = await resp.json()
      setLogs(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Không thể kết nối đến máy chủ')
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, selectedAction, selectedEntity, searchTerm, limit])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return ts
    }
  }

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase()
    let bg = '#F1F5F9'
    let color = '#475569'

    if (act.includes('CREATE') || act.includes('INSERT')) {
      bg = '#DCFCE7'
      color = '#15803D'
    } else if (act.includes('UPDATE') || act.includes('EDIT')) {
      bg = '#EFF6FF'
      color = '#1D4ED8'
    } else if (act.includes('DELETE') || act.includes('CANCEL')) {
      bg = '#FEE2E2'
      color = '#B91C1C'
    } else if (act.includes('ACTIVATE')) {
      bg = '#FEF3C7'
      color = '#B45309'
    }

    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: bg,
          color: color,
        }}
      >
        {action}
      </span>
    )
  }

  const FIELD_LABELS: Record<string, string> = {
    contract_code: 'Mã hợp đồng',
    annex_code: 'Mã phụ lục',
    contract_type: 'Loại hợp đồng',
    status: 'Trạng thái',
    customer_id: 'Mã khách hàng',
    deceased_id: 'Mã người mất',
    plot_id: 'Mã ô mộ',
    slot_id: 'Mã huyệt',
    slot_status: 'Trạng thái huyệt',
    total_amount: 'Tổng giá trị hợp đồng',
    additional_amount: 'Giá trị phụ lục / Phí phát sinh',
    service_fee: 'Phí dịch vụ',
    exhumation_fee: 'Phí dịch vụ cải táng',
    commission_fee: 'Phí hoa hồng chuyển nhượng',
    seller_id: 'Mã bên chuyển nhượng',
    buyer_id: 'Mã bên nhận chuyển nhượng',
    signed_scan_file_id: 'Mã file scan hợp đồng',
    signed_at: 'Thời điểm ký kết',
    reason: 'Lý do thực hiện',
    is_kim_tinh: 'Quy cách Kim Tĩnh (Bất biến)',
    is_future_burial: 'An táng tương lai (Chưa hạ huyệt)',
    package_id: 'Gói chăm sóc định kỳ',
    cycle_months: 'Chu kỳ chăm sóc (tháng)',
    recurring_price: 'Đơn giá định kỳ mỗi kỳ',
    estimated_start_date: 'Ngày dự kiến khởi công',
    estimated_end_date: 'Ngày dự kiến hoàn thành',
    actual_start_date: 'Ngày khởi công thực tế',
    actual_end_date: 'Ngày hoàn thành thực tế',
    supervisor_id: 'Mã người giám sát',
    caretaker_id: 'Mã nhân viên quản trang',
    conflict_warning: 'Cảnh báo xung đột lịch',
    has_conflict: 'Có trùng lịch / xung đột',
    completed_by_id: 'Mã nhân sự nghiệm thu/đóng ca',
    closed_at: 'Thời điểm đóng nghiệm thu',
    receivable_id: 'Mã khoản phải thu',
    original_amount: 'Số tiền gốc',
    discount_type: 'Hình thức giảm giá/chiết khấu',
    discount_value: 'Giá trị giảm giá/chiết khấu',
    calculated_amount: 'Số tiền được giảm',
    final_payable_amount: 'Số tiền phải nộp sau giảm',
    paid_amount: 'Số tiền thanh toán',
    payment_method: 'Phương thức thanh toán',
    invoice_number: 'Mã phiếu thu / Hóa đơn',
    new_receivable_status: 'Trạng thái công nợ mới',
    full_name: 'Họ và tên',
    phone_number: 'Số điện thoại liên hệ',
    email: 'Địa chỉ Email',
    address: 'Địa chỉ thường trú',
    date_of_birth: 'Ngày sinh',
    date_of_death: 'Ngày mất',
    birth_year: 'Năm sinh',
    birth_date_precision: 'Độ chính xác ngày sinh',
    hometown: 'Quê quán',
    religion: 'Tôn giáo',
    citizen_id: 'Số CMND / CCCD',
  }

  const formatFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') {
      return value ? 'Có (Đã áp dụng)' : 'Không'
    }
    const keyLower = key.toLowerCase()
    if (
      keyLower.includes('amount') ||
      keyLower.includes('fee') ||
      keyLower.includes('price') ||
      keyLower.includes('payable') ||
      (keyLower.includes('value') && keyLower.includes('discount'))
    ) {
      const num = Number(value)
      if (!isNaN(num)) {
        if (key === 'discount_value' && Number(value) <= 100 && !String(value).includes('000')) {
          return `${value}%`
        }
        return `${num.toLocaleString('vi-VN')} đ`
      }
    }
    if (key === 'payment_method') {
      if (value === 'CASH') return 'Tiền mặt'
      if (value === 'BANK_TRANSFER') return 'Chuyển khoản ngân hàng'
      if (value === 'CREDIT_CARD') return 'Thẻ tín dụng'
    }
    if (key === 'discount_type') {
      if (value === 'PERCENTAGE') return 'Chiết khấu phần trăm (%)'
      if (value === 'FIXED_AMOUNT') return 'Giảm số tiền cố định'
    }
    if (key === 'contract_type') {
      if (value === 'LAND_PURCHASE') return 'Mua đất sinh phần'
      if (value === 'BURIAL') return 'An táng'
      if (value === 'EXHUMATION') return 'Cải táng / Bốc mộ'
      if (value === 'TRANSFER') return 'Chuyển nhượng quyền sử dụng'
      if (value === 'CREMATION') return 'Dịch vụ hỏa táng'
    }
    if (key === 'status' || key === 'new_receivable_status' || key === 'slot_status') {
      if (value === 'ACTIVE') return 'Đang hoạt động (ACTIVE)'
      if (value === 'PENDING_SIGN') return 'Chờ ký duyệt (PENDING_SIGN)'
      if (value === 'DRAFT') return 'Bản nháp (DRAFT)'
      if (value === 'CANCELLED') return 'Đã hủy (CANCELLED)'
      if (value === 'COMPLETED') return 'Đã hoàn tất (COMPLETED)'
      if (value === 'CLOSED') return 'Đã đóng nghiệm thu (CLOSED)'
      if (value === 'PAID') return 'Đã tất toán đủ (PAID)'
      if (value === 'PARTIALLY_PAID') return 'Thanh toán một phần (PARTIALLY_PAID)'
      if (value === 'UNPAID') return 'Chưa thanh toán (UNPAID)'
      if (value === 'EMPTY') return 'Huyệt trống (EMPTY)'
      if (value === 'OCCUPIED') return 'Đã an táng (OCCUPIED)'
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  const renderStructuredDiff = (preJson: string | null, postJson: string | null) => {
    let pre: Record<string, any> = {}
    let post: Record<string, any> = {}
    try {
      if (preJson) pre = typeof preJson === 'string' ? JSON.parse(preJson) : preJson
    } catch {}
    try {
      if (postJson) post = typeof postJson === 'string' ? JSON.parse(postJson) : postJson
    } catch {}

    const allKeys = Array.from(new Set([...Object.keys(pre), ...Object.keys(post)]))

    if (allKeys.length === 0) {
      return (
        <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', color: '#64748B', fontSize: '13px' }}>
          Sự kiện này là hành động tác vụ hệ thống (không có trường dữ liệu payload chi tiết).
        </div>
      )
    }

    return (
      <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', width: '35%' }}>Thông Tin / Thuộc Tính</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', width: '30%' }}>Trước Thay Đổi</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', width: '35%' }}>Sau Thay Đổi</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key) => {
              const label = FIELD_LABELS[key] || key
              const valPre = pre[key]
              const valPost = post[key]
              const hasPre = key in pre
              const hasPost = key in post
              const isDifferent = JSON.stringify(valPre) !== JSON.stringify(valPost)

              return (
                <tr
                  key={key}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    backgroundColor: isDifferent ? (hasPre && hasPost ? '#FEFCE8' : '#F0FDF4') : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>
                    <div>{label}</div>
                    {label !== key && (
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{key}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: hasPre ? (isDifferent ? '#94A3B8' : '#475569') : '#CBD5E1' }}>
                    {hasPre ? (
                      <span style={{ textDecoration: isDifferent && hasPost ? 'line-through' : 'none' }}>
                        {formatFieldValue(key, valPre)}
                      </span>
                    ) : (
                      <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>— (Chưa có)</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: hasPost ? (isDifferent ? '#15803D' : '#334155') : '#94A3B8', fontWeight: isDifferent ? 600 : 400 }}>
                    {hasPost ? (
                      formatFieldValue(key, valPost)
                    ) : (
                      <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>— (Bị xóa)</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderJsonPretty = (rawJson: string | null) => {
    if (!rawJson) return <span style={{ color: '#94A3B8' }}>(Không có dữ liệu)</span>
    try {
      const parsed = JSON.parse(rawJson)
      return (
        <pre
          style={{
            margin: 0,
            padding: '12px',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            lineHeight: '1.5',
            overflowX: 'auto',
            color: '#1E293B',
            fontFamily: 'Consolas, Monaco, monospace',
          }}
        >
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      return (
        <pre
          style={{
            margin: 0,
            padding: '12px',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            overflowX: 'auto',
            color: '#1E293B',
          }}
        >
          {rawJson}
        </pre>
      )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Nhật Ký Kiểm Toán & Giám Sát Hệ Thống (Audit Logs)
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Lưu vết bất biến toàn bộ hành vi tạo mới, cập nhật trạng thái hợp đồng, duyệt chiết khấu và nghiệm thu mộ phần.
          </p>
        </div>

        <button
          onClick={() => {
            fetchSummary()
            fetchLogs()
          }}
          style={{
            padding: '9px 14px',
            backgroundColor: '#FFFFFF',
            color: '#475569',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={15} />
          <span>Làm Mới</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Tổng Bản Ghi Kiểm Toán
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
            {summary?.total_logs || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#15803D' }}>Theo dõi lịch sử thao tác</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Loại Thao Tác Phổ Biến
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: '8px 0 4px 0' }}>
            {summary?.action_type_counts
              ? Object.entries(summary.action_type_counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa có'
              : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            {summary?.action_type_counts
              ? `${Object.entries(summary.action_type_counts).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} lần ghi nhận`
              : ''}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Thực Thể Bị Tác Động Nhiều Nhất
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563EB', margin: '8px 0 4px 0' }}>
            {summary?.target_entity_counts
              ? Object.entries(summary.target_entity_counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa có'
              : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            {summary?.target_entity_counts
              ? `${Object.entries(summary.target_entity_counts).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} sự kiện`
              : ''}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Kết Quả Hiển Thị
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', margin: '8px 0 4px 0' }}>
            {logs.length} bản ghi
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>Sắp xếp theo thứ tự mới nhất</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} color="#64748B" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Bộ lọc:</span>
        </div>

        {/* Entity filter */}
        <select
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            outline: 'none',
          }}
        >
          <option value="">Tất cả thực thể ({entities.length})</option>
          {entities.map((ent) => (
            <option key={ent} value={ent}>
              {ent}
            </option>
          ))}
        </select>

        {/* Action filter */}
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            outline: 'none',
          }}
        >
          <option value="">Tất cả hành vi ({actions.length})</option>
          {actions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        {/* Search by Target ID */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
          <input
            type="text"
            placeholder="Tìm theo mã hồ sơ…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Limit selector */}
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            outline: 'none',
          }}
        >
          <option value={20}>20 dòng</option>
          <option value={50}>50 dòng</option>
          <option value={100}>100 dòng</option>
        </select>

        {(selectedAction || selectedEntity || searchTerm) && (
          <button
            onClick={() => {
              setSelectedAction('')
              setSelectedEntity('')
              setSearchTerm('')
            }}
            style={{
              padding: '7px 12px',
              backgroundColor: '#F1F5F9',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Xóa lọc
          </button>
        )}
      </div>

      {/* Main Table / 4 States */}
      {loading ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '64px 32px',
            textAlign: 'center',
            color: '#64748B',
          }}
        >
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Đang tải nhật ký kiểm toán...</div>
        </div>
      ) : error ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FECACA',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={28} color="#DC2626" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#B91C1C', marginBottom: '6px' }}>
            Không thể tải nhật ký hệ thống
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 16px 0' }}>{error}</p>
          <button
            onClick={fetchLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '64px 32px',
            textAlign: 'center',
            color: '#64748B',
          }}
        >
          <ShieldAlert size={36} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
            Không tìm thấy nhật ký kiểm toán phù hợp
          </div>
          <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>
            Không có sự kiện nào khớp với điều kiện lọc hiện tại.
          </p>
          {(selectedAction || selectedEntity || searchTerm) && (
            <button
              onClick={() => {
                setSelectedAction('')
                setSelectedEntity('')
                setSearchTerm('')
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}
        >
          {/* Mobile Card View (< 1024px) */}
          <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {paginatedLogs.map((log) => (
              <div
                key={log.log_id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <div>{getActionBadge(log.action_type)}</div>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                  <span>{log.target_entity}: </span>
                  <span style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>#{log.target_id}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                  <User size={13} color="#64748B" />
                  <span>{log.username || `User #${log.user_id || 'Sys'}`}</span>
                  <span style={{ color: '#94A3B8' }}>· {log.ip_address || 'Internal'}</span>
                </div>

                {/* Mobile Narrative Highlight */}
                {log.narrative_summary && (
                  <div
                    style={{
                      margin: '6px 0 10px 0',
                      padding: '8px 10px',
                      backgroundColor: '#F8FAFC',
                      borderLeft: '3px solid var(--brand-primary)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#334155',
                      lineHeight: '1.45',
                    }}
                  >
                    {log.narrative_summary}
                  </div>
                )}

                <button
                  onClick={() => setActiveLog(log)}
                  className="touch-target"
                  style={{
                    width: '100%',
                    marginTop: '4px',
                    padding: '8px 12px',
                    backgroundColor: '#F1F5F9',
                    color: 'var(--brand-primary)',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Eye size={14} />
                  <span>Xem Chi Tiết Sự Kiện & Diff</span>
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= 1024px) */}
          <div className="desktop-only table-scroll-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', width: '135px' }}>Thời Điểm</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', width: '120px' }}>Tài Khoản</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', width: '130px' }}>Hành Động</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', width: '130px' }}>Đối Tượng</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left' }}>Diễn Giải Nghiệp Vụ (Executive Summary)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', width: '110px' }}>Địa Chỉ IP</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap', width: '80px' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr key={log.log_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} color="#64748B" />
                        <span>{log.username || `User #${log.user_id || 'Sys'}`}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{getActionBadge(log.action_type)}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ color: '#334155', fontWeight: 600 }}>{log.target_entity}</div>
                      <div style={{ color: 'var(--brand-primary)', fontSize: '11px', fontFamily: 'monospace' }}>#{log.target_id}</div>
                    </td>
                    <td style={{ padding: '12px 14px', minWidth: '300px' }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          color: '#1E293B',
                          lineHeight: '1.45',
                          backgroundColor: '#F8FAFC',
                          borderLeft: '3px solid var(--brand-primary)',
                          padding: '6px 10px',
                          borderRadius: '4px',
                        }}
                      >
                        {log.narrative_summary || (
                          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                            Thực hiện {log.action_type} trên {log.target_entity} #{log.target_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {log.ip_address || 'Internal'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setActiveLog(log)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: 'var(--brand-primary)',
                          fontWeight: 500,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye size={13} />
                        <span>Xem</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Advanced Modern Pagination for Audit Logs */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
            <Pagination
              currentPage={logPage}
              totalPages={logTotalPages}
              totalItems={logTotalItems}
              pageSize={logPageSize}
              pageSizeOptions={[10, 15, 25, 50, 100]}
              onPageChange={setLogPage}
              onPageSizeChange={setLogPageSize}
              startIndex={logStartIndex}
              endIndex={logEndIndex}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AUDIT LOG DETAIL & EXECUTIVE NARRATIVE BRIEFING */}
      {/* ========================================================================= */}
      {activeLog && (
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
            padding: '16px',
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={22} color="var(--brand-primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)', fontWeight: 600 }}>
                    Chi Tiết Sự Kiện Kiểm Toán #{activeLog.log_id}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Nhật ký giám sát bất biến & xác thực vết nghiệp vụ
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveLog(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Executive Narrative Explanation Banner */}
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}
            >
              <Sparkles size={20} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Diễn Giải Nghiệp Vụ Cho Quản Lý
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#14532D', fontWeight: 500 }}>
                  {activeLog.narrative_summary || `Hệ thống ghi nhận thao tác ${activeLog.action_type} trên thực thể ${activeLog.target_entity} #${activeLog.target_id}.`}
                </div>
              </div>
            </div>

            {/* Event Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '14px',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                fontSize: '13px',
                marginBottom: '18px',
              }}
            >
              <div>
                <span style={{ color: '#64748B' }}>Người thực hiện: </span>
                <strong style={{ color: '#0F172A' }}>{activeLog.username || `User #${activeLog.user_id || 'Sys'}`}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Thời điểm: </span>
                <strong>{formatTimestamp(activeLog.timestamp)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Hành động: </span>
                {getActionBadge(activeLog.action_type)}
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Địa chỉ IP: </span>
                <strong>{activeLog.ip_address || 'Internal (System)'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Thực thể tác động: </span>
                <strong style={{ color: '#334155' }}>{activeLog.target_entity}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Mã đối tượng: </span>
                <strong style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>#{activeLog.target_id}</strong>
              </div>
            </div>

            {/* Structured Field Changes & Comparison */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <FileText size={16} color="#475569" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                  Chi Tiết Thông Tin Dữ Liệu Sự Kiện
                </h4>
              </div>
              {renderStructuredDiff(activeLog.pre_change_values, activeLog.post_change_values)}
            </div>

            {/* Collapsible Raw JSON Section */}
            <div style={{ marginTop: '16px', borderTop: '1px dashed #E2E8F0', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: '#64748B',
                  fontWeight: 500,
                }}
              >
                {showRawJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Chi tiết kỹ thuật dành cho Kỹ thuật viên / IT (JSON thô)</span>
              </button>

              {showRawJson && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                  {/* Security notice */}
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#1D4ED8',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <ShieldAlert size={14} />
                    <span>Mọi mật khẩu, token và khóa bí mật đã được tự động khử trùng (REDACTED).</span>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Dữ liệu trước thay đổi (pre_change_values)
                    </div>
                    {renderJsonPretty(activeLog.pre_change_values)}
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Dữ liệu sau thay đổi (post_change_values)
                    </div>
                    {renderJsonPretty(activeLog.post_change_values)}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setActiveLog(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
