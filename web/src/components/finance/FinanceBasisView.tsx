import { apiFetch, responseError } from '../../services/apiClient'
import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Coins,
  FileCheck2,
  Filter,
  MapPin,
  Phone,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'

export interface FinanceBasisItem {
  contract_id: number
  contract_code: string
  contract_type: string
  annex_id: number | null
  annex_code: string | null
  source_type: 'CONTRACT' | 'ANNEX'
  status: string
  signed_at: string | null
  payer_name: string | null
  payer_phone: string | null
  plot_code: string | null
  total_amount: number | string
  paid_amount: number | string
  balance: number | string
  due_date: string | null
  service_description: string
}

interface FinanceBasisViewProps {
  onSelectPayment?: (basis: FinanceBasisItem) => void
}

export const FinanceBasisView: React.FC<FinanceBasisViewProps> = ({ onSelectPayment }) => {
  const { accessToken } = useAuth()
  const [items, setItems] = useState<FinanceBasisItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const fetchFinanceBases = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/v1/finance/bases', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        throw new Error(await responseError(res, 'Chưa tải được danh sách khoản thu.'))
      }
      const data: FinanceBasisItem[] = await res.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchFinanceBases()
  }, [fetchFinanceBases])

  const formatVND = (amount: number | string | null | undefined): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0)
  }

  const filteredItems = items.filter((item) => {
    if (statusFilter === 'UNPAID') {
      const bal = typeof item.balance === 'string' ? parseFloat(item.balance) : item.balance
      if (bal <= 0) return false
    } else if (statusFilter === 'PAID') {
      const bal = typeof item.balance === 'string' ? parseFloat(item.balance) : item.balance
      if (bal > 0) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCode = item.contract_code.toLowerCase().includes(q)
      const matchAnnex = (item.annex_code || '').toLowerCase().includes(q)
      const matchPlot = (item.plot_code || '').toLowerCase().includes(q)
      const matchPayer = (item.payer_name || '').toLowerCase().includes(q)
      const matchPhone = (item.payer_phone || '').includes(q)
      return matchCode || matchAnnex || matchPlot || matchPayer || matchPhone
    }
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <header className="basis-header"><div><h2>Khoản thu theo hợp đồng</h2><p>Tra người nộp, số tiền còn thiếu và hạn thanh toán.</p></div><button type="button" onClick={fetchFinanceBases} disabled={loading}><RefreshCw size={16} />Làm mới</button></header>

      {/* Toolbar filters */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          padding: '14px 18px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            placeholder="Tìm theo mã HĐ, tên người nộp, số điện thoại, mã ô mộ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} color="#64748B" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Tất cả trạng thái nợ</option>
            <option value="UNPAID">Còn nợ / Chưa nộp đủ</option>
            <option value="PAID">Đã thanh toán đủ</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          <div>Đang tải khoản thu…</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '24px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            color: '#B91C1C',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={24} />
          <div>
            {error} <button type="button" onClick={fetchFinanceBases}>Thử lại</button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px dashed #CBD5E1',
            color: '#64748B',
          }}
        >
          <FileCheck2 size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#334155', margin: '0 0 6px 0' }}>
            Không có khoản thu khớp bộ lọc
          </h3>
          <p style={{ fontSize: '13px', margin: 0 }}>
            Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc trạng thái.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'auto',
          }}
          className="basis-table-wrap"
        >
          <table className="basis-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Hợp đồng / phụ lục</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Người Nộp Tiền</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vị Trí Mộ Phần</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Tổng Giá Trị</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Đã Thanh Toán</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Còn Nợ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Hạn Nộp</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const bal = typeof item.balance === 'string' ? parseFloat(item.balance) : item.balance
                const isPaid = bal <= 0
                return (
                  <tr
                    key={`${item.contract_id}-${item.annex_id || 0}-${idx}`}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>
                        {item.annex_code || item.contract_code}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {item.service_description}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: item.source_type === 'CONTRACT' ? '#EFF6FF' : '#FDF4FF',
                          color: item.source_type === 'CONTRACT' ? '#1E40AF' : '#86198F',
                          marginTop: '4px',
                          display: 'inline-block',
                        }}
                      >
                        {item.source_type === 'CONTRACT' ? 'Hợp Đồng Chính' : 'Phụ Lục'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>
                        {item.payer_name || 'Khách vãng lai'}
                      </div>
                      {item.payer_phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          <Phone size={11} />
                          <span>{item.payer_phone}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#24594D' }}>
                        <MapPin size={13} />
                        <span>{item.plot_code || 'Chưa gán'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#1E293B' }}>
                      {formatVND(item.total_amount)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#10B981' }}>
                      {formatVND(item.paid_amount)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: isPaid ? '#10B981' : '#D97706' }}>
                      {formatVND(item.balance)}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748B' }}>
                      {item.due_date || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {isPaid ? (
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle size={12} />
                          Đã Hoàn Tất
                        </span>
                      ) : (
                        <button
                          disabled={!onSelectPayment}
                          onClick={() => onSelectPayment?.(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#24594D',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Coins size={13} />
                          Xem khoản thu
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
