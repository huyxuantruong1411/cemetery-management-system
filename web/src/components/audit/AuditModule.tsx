import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
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
        fetch('/api/v1/audit/summary', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/v1/audit/entities', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/v1/audit/actions', { headers: { Authorization: `Bearer ${accessToken}` } }),
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

      const resp = await fetch(`/api/v1/audit/logs?${q.toString()}`, {
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
        setError('Không thể kết nối đến máy chủ API nhật ký')
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
          <div style={{ fontSize: '12px', color: '#15803D' }}>Lưu trữ an toàn trên CSDL MSSQL</div>
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
            placeholder="Tìm theo mã đối tượng (Target ID)..."
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Thời Điểm</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Tài Khoản</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Hành Động</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Thực Thể</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Mã Đối Tượng (ID)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Địa Chỉ IP</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr key={log.log_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} color="#64748B" />
                        <span>{log.username || `User #${log.user_id || 'Sys'}`}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getActionBadge(log.action_type)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>{log.target_entity}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                      {log.target_id}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>
                      {log.ip_address || 'Internal'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => setActiveLog(log)}
                        style={{
                          padding: '5px 10px',
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
      {/* MODAL: AUDIT LOG DETAIL & DIFF */}
      {/* ========================================================================= */}
      {activeLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} color="var(--brand-primary)" />
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)', fontWeight: 600 }}>
                  Chi Tiết Sự Kiện Kiểm Toán #{activeLog.log_id}
                </h3>
              </div>
              <button
                onClick={() => setActiveLog(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Security notice */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1D4ED8',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldAlert size={16} />
              <span>
                Mọi thông tin mật khẩu, token và khóa bảo mật được tự động khử trùng (REDACTED) trước khi xuất hiển thị.
              </span>
            </div>

            {/* Event Metadata */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                padding: '14px',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              <div>
                <span style={{ color: '#64748B' }}>Người thực hiện: </span>
                <strong>{activeLog.username || `User #${activeLog.user_id}`}</strong>
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
                <strong>{activeLog.target_entity}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Khóa định danh (ID): </span>
                <strong style={{ color: 'var(--brand-primary)' }}>{activeLog.target_id}</strong>
              </div>
            </div>

            {/* Changes: Before / After Diff */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Giá Trị Trước Thay Đổi (Pre-change Snapshot)
                </div>
                {renderJsonPretty(activeLog.pre_change_values)}
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Giá Trị Sau Thay Đổi (Post-change Snapshot)
                </div>
                {renderJsonPretty(activeLog.post_change_values)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setActiveLog(null)}
                style={{
                  padding: '8px 18px',
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
