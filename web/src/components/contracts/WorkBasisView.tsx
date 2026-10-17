import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileCheck2,
  Filter,
  Hammer,
  MapPin,
  RefreshCw,
  Search,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'

export interface WorkBasisItem {
  annex_id: number
  annex_code: string
  contract_id: number
  contract_code: string
  work_type: 'BURIAL' | 'CARE' | 'CONSTRUCTION'
  status: string
  valid_from: string
  valid_to: string | null
  plot_id: number | null
  plot_code: string | null
  zone_code: string | null
  slot_number: number | null
  deceased_id: number | null
  deceased_name: string | null
  burial_date: string | null
  is_burial_confirmed: boolean
  service_summary: string
  notes: string | null
}

export const WorkBasisView: React.FC = () => {
  const { accessToken } = useAuth()
  const [items, setItems] = useState<WorkBasisItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Confirm Burial Modal state
  const [confirmModalItem, setConfirmModalItem] = useState<WorkBasisItem | null>(null)
  const [confirmNotes, setConfirmNotes] = useState<string>('')
  const [confirmProofFileId, setConfirmProofFileId] = useState<string>('')
  const [confirming, setConfirming] = useState<boolean>(false)
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState<string | null>(null)
  const [confirmErrorMsg, setConfirmErrorMsg] = useState<string | null>(null)

  const fetchWorkBases = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/contracts/work-bases', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        throw new Error(`Lỗi tải danh sách căn cứ công việc (${res.status})`)
      }
      const data: WorkBasisItem[] = await res.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchWorkBases()
  }, [fetchWorkBases])

  const handleConfirmBurial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmModalItem || !accessToken) return
    setConfirming(true)
    setConfirmErrorMsg(null)
    try {
      const res = await fetch(`/api/v1/contracts/annexes/${confirmModalItem.annex_id}/confirm-burial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          proof_file_id: confirmProofFileId.trim() || undefined,
          notes: confirmNotes.trim() || 'Quản trang xác nhận hạ huyệt thực tế hoàn tất.',
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể xác nhận an táng thực địa.')
      }
      const result = await res.json()
      setConfirmSuccessMsg(
        `Xác nhận an táng thành công cho ô ${result.plot_code} (Huyệt ${result.slot_number}). Ô mộ đã cập nhật trạng thái đã an táng!`
      )
      setTimeout(() => {
        setConfirmModalItem(null)
        setConfirmSuccessMsg(null)
        setConfirmNotes('')
        setConfirmProofFileId('')
        fetchWorkBases()
      }, 2500)
    } catch (err) {
      setConfirmErrorMsg(err instanceof Error ? err.message : 'Lỗi khi xác nhận an táng.')
    } finally {
      setConfirming(false)
    }
  }

  const filteredItems = items.filter((item) => {
    if (filterType !== 'ALL' && item.work_type !== filterType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCode = item.annex_code.toLowerCase().includes(q)
      const matchPlot = (item.plot_code || '').toLowerCase().includes(q)
      const matchDeceased = (item.deceased_name || '').toLowerCase().includes(q)
      return matchCode || matchPlot || matchDeceased
    }
    return true
  })

  const getWorkTypeBadge = (type: string) => {
    switch (type) {
      case 'BURIAL':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={12} />
            An Táng
          </span>
        )
      case 'CARE':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#ECFDF5',
              color: '#047857',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Wrench size={12} />
            Chăm Sóc
          </span>
        )
      case 'CONSTRUCTION':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Hammer size={12} />
            Thi Công
          </span>
        )
      default:
        return <span>{type}</span>
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '18px 24px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
              Căn Cứ Công Việc Thực Địa (WorkBasis)
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
              }}
            >
              Chuẩn Bảo Mật EX-01
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
            Tiếp nhận căn cứ dịch vụ được bàn giao cho Quản trang: loại công việc, vị trí ô/huyệt, thông tin người mất và xác nhận nghiệm thu hạ huyệt tại hiện trường. Tuyệt đối không kéo theo CCCD hoặc dữ liệu cá nhân nhạy cảm.
          </p>
        </div>
        <button
          onClick={fetchWorkBases}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#334155',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

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
            placeholder="Tìm theo mã phụ lục, mã ô mộ, tên người mất..."
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
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
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
            <option value="ALL">Tất cả loại việc</option>
            <option value="BURIAL">An táng (Hạ huyệt)</option>
            <option value="CARE">Chăm sóc mộ phần</option>
            <option value="CONSTRUCTION">Xây dựng / Thi công</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          <div>Đang tải danh sách căn cứ công việc...</div>
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
            <strong>Lỗi tải dữ liệu:</strong> {error}
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
            Không có căn cứ công việc nào phù hợp
          </h3>
          <p style={{ fontSize: '13px', margin: 0 }}>
            Tất cả các ca bàn giao hiện đã hoàn tất hoặc không có yêu cầu nào khớp bộ lọc.
          </p>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mã Căn Cứ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Loại Việc</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vị Trí Mộ Phần</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Người Quá Cố</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ngày Hẹn / Hiệu Lực</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mô Tả Công Việc</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Trạng Thái Thực Địa</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Thao Tác Hiện Trường</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.annex_id}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                    {item.annex_code}
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>
                      HĐ: {item.contract_code}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>{getWorkTypeBadge(item.work_type)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#24594D' }}>
                      <MapPin size={14} />
                      <span>{item.plot_code || 'Chưa gán ô'}</span>
                    </div>
                    {item.slot_number !== null && (
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        Huyệt số: <strong>{item.slot_number}</strong> {item.zone_code ? `(Khu ${item.zone_code})` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {item.deceased_name ? (
                      <div style={{ fontWeight: 600, color: '#334155' }}>
                        {item.deceased_name}
                      </div>
                    ) : (
                      <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Không có</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>
                    {item.burial_date ? (
                      <div style={{ fontWeight: 600, color: '#B45309' }}>
                        {item.burial_date}
                      </div>
                    ) : (
                      <div>{item.valid_from}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', maxWidth: '240px' }}>
                    {item.service_summary}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {item.work_type === 'BURIAL' ? (
                      item.is_burial_confirmed ? (
                        <span
                          style={{
                            padding: '3px 8px',
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
                          Đã An Táng
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={12} />
                          Chờ Hạ Huyệt
                        </span>
                      )
                    ) : (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                        }}
                      >
                        {item.status}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {item.work_type === 'BURIAL' && !item.is_burial_confirmed ? (
                      <button
                        onClick={() => {
                          setConfirmModalItem(item)
                          setConfirmNotes('')
                          setConfirmProofFileId('')
                          setConfirmErrorMsg(null)
                          setConfirmSuccessMsg(null)
                        }}
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
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <CheckCircle size={13} />
                        Xác Nhận Hạ Huyệt
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Burial Modal */}
      {confirmModalItem && (
        <div
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
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} color="#24594D" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                  Xác Nhận Hạ Huyệt Thực Địa
                </h3>
              </div>
              <button
                onClick={() => setConfirmModalItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmBurial} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#F0FDF4', padding: '12px 16px', borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '13px', color: '#166534' }}>
                <div><strong>Phụ lục:</strong> {confirmModalItem.annex_code}</div>
                <div><strong>Vị trí ô mộ:</strong> {confirmModalItem.plot_code} (Huyệt số {confirmModalItem.slot_number})</div>
                <div><strong>Người quá cố:</strong> {confirmModalItem.deceased_name || 'N/A'}</div>
              </div>

              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                Thao tác này xác nhận người quá cố đã được an táng thực tế vào huyệt mộ. Sau khi xác nhận, slot sẽ chuyển sang trạng thái <strong>ĐÃ AN TÁNG (OCCUPIED)</strong> và nếu là mộ Kim Tĩnh sẽ được <strong>KHÓA VĨNH VIỄN</strong>.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Ghi chú hiện trường:
                </label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Ghi chú về việc hạ huyệt, thời gian, đại diện gia đình có mặt..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Mã tệp ảnh minh chứng (tùy chọn):
                </label>
                <input
                  type="text"
                  value={confirmProofFileId}
                  onChange={(e) => setConfirmProofFileId(e.target.value)}
                  placeholder="Mã file_id ảnh chụp hạ huyệt nếu có"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {confirmErrorMsg && (
                <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '12px', color: '#B91C1C' }}>
                  {confirmErrorMsg}
                </div>
              )}

              {confirmSuccessMsg && (
                <div style={{ padding: '10px 14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '6px', fontSize: '12px', color: '#15803D' }}>
                  {confirmSuccessMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmModalItem(null)}
                  disabled={confirming}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={confirming || !!confirmSuccessMsg}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#24594D',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {confirming ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  <span>Xác Nhận Hạ Huyệt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
