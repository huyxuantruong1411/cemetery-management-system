import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  PieChart,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import type {
  ContractReportResponse,
  OccupancyReportResponse,
  OperationsReportResponse,
  ReportExportRequest,
  ReportExportResponse,
  RevenueReportResponse,
} from '../../types/reports'

export const ReportsModule: React.FC = () => {
  const { accessToken } = useAuth()

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'revenue' | 'occupancy' | 'contracts' | 'operations'>('revenue')

  // Date filters
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Data states
  const [revenueData, setRevenueData] = useState<RevenueReportResponse | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyReportResponse | null>(null)
  const [contractsData, setContractsData] = useState<ContractReportResponse | null>(null)
  const [operationsData, setOperationsData] = useState<OperationsReportResponse | null>(null)

  // Loading & error
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Export modal
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)
  const [exportType, setExportType] = useState<'REVENUE' | 'OCCUPANCY' | 'CONTRACTS' | 'OPERATIONS'>('REVENUE')
  const [exportFormat, setExportFormat] = useState<'PDF' | 'XLSX'>('XLSX')
  const [exporting, setExporting] = useState<boolean>(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  const formatVND = (amount: number | null | undefined): string => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)
  }

  const formatPercent = (val: number | null | undefined): string => {
    return `${(val || 0).toFixed(1)}%`
  }

  // Fetch report data based on activeTab
  const fetchReport = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    setExportSuccess(null)

    try {
      const queryParams = new URLSearchParams()
      if (startDate) queryParams.append('start_date', startDate)
      if (endDate) queryParams.append('end_date', endDate)

      const url = `/api/v1/reports/${activeTab}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!resp.ok) {
        throw new Error(`Lỗi tải báo cáo: ${resp.status} (${resp.statusText})`)
      }

      const data = await resp.json()
      if (activeTab === 'revenue') setRevenueData(data)
      else if (activeTab === 'occupancy') setOccupancyData(data)
      else if (activeTab === 'contracts') setContractsData(data)
      else if (activeTab === 'operations') setOperationsData(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Không thể kết nối đến máy chủ API báo cáo')
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, activeTab, startDate, endDate])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Handle Export File
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken) return
    setExporting(true)
    setError(null)

    try {
      const payload: ReportExportRequest = {
        report_type: exportType,
        export_format: exportFormat,
        filter_params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      }

      const res = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Xuất báo cáo thất bại: ${res.statusText}`)
      }

      const exportRec: ReportExportResponse = await res.json()

      // Immediately initiate download
      const dlRes = await fetch(`/api/v1/reports/exports/${exportRec.export_id}/download`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!dlRes.ok) {
        throw new Error('Không thể tải tệp báo cáo vừa tạo')
      }

      const blob = await dlRes.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${exportRec.export_code}.${exportFormat.toLowerCase()}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      setExportSuccess(`Đã xuất báo cáo ${exportRec.export_code} thành công`)
      setIsExportOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Có lỗi xảy ra khi tạo bản xuất báo cáo')
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
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
            Báo Cáo Thống Kê & Vận Hành Quản Trị
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Tổng hợp dữ liệu dòng tiền thực thu, tỷ lệ lấp đầy mộ phần, phân loại hợp đồng và tiến độ hiện trường.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setExportType(
                activeTab === 'revenue'
                  ? 'REVENUE'
                  : activeTab === 'occupancy'
                    ? 'OCCUPANCY'
                    : activeTab === 'contracts'
                      ? 'CONTRACTS'
                      : 'OPERATIONS',
              )
              setIsExportOpen(true)
            }}
            style={{
              padding: '9px 16px',
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Download size={15} />
            <span>Xuất Báo Cáo (PDF / XLSX)</span>
          </button>

          <button
            onClick={fetchReport}
            style={{
              padding: '9px 12px',
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
      </div>

      {/* Success / Error notification */}
      {exportSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            color: '#15803D',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={16} />
          <span>{exportSuccess}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            color: '#B91C1C',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchReport}
            style={{
              padding: '4px 10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F87171',
              borderRadius: '6px',
              color: '#B91C1C',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Filter and Tab Navigation */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('revenue')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'revenue' ? '#E6F4EA' : 'transparent',
              color: activeTab === 'revenue' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'revenue' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <TrendingUp size={15} />
            <span>Doanh Thu Thực Thu</span>
          </button>

          <button
            onClick={() => setActiveTab('occupancy')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'occupancy' ? '#E6F4EA' : 'transparent',
              color: activeTab === 'occupancy' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'occupancy' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={15} />
            <span>Tỷ Lệ Lấp Đầy & Mộ Phần</span>
          </button>

          <button
            onClick={() => setActiveTab('contracts')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'contracts' ? '#E6F4EA' : 'transparent',
              color: activeTab === 'contracts' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'contracts' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={15} />
            <span>Hợp Đồng & Phụ Lục</span>
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'operations' ? '#E6F4EA' : 'transparent',
              color: activeTab === 'operations' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'operations' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <PieChart size={15} />
            <span>Vận Hành: Thi Công & Chăm Sóc</span>
          </button>
        </div>

        {/* Date Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
            <Calendar size={14} color="#64748B" />
            <span>Từ:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
            <span>Đến:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              style={{
                padding: '6px 10px',
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
      </div>

      {/* Main Content Areas with 4 UI States */}
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
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Đang tổng hợp số liệu báo cáo...</div>
        </div>
      ) : activeTab === 'revenue' ? (
        /* ========================================================================= */
        /* TAB 1: REVENUE REPORT */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Tổng Doanh Thu Thực Thu
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
                {formatVND(revenueData?.total_revenue)}
              </div>
              <div style={{ fontSize: '12px', color: '#15803D' }}>
                Không bao gồm công nợ chưa trả hoặc giảm trừ
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Số Lượng Phiếu Thu
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', margin: '8px 0 4px 0' }}>
                {revenueData?.total_transactions || 0} giao dịch
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Đã đối soát ghi nhận vào CSDL</div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Giá Trị Thu Trung Bình
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', margin: '8px 0 4px 0' }}>
                {formatVND(revenueData?.average_transaction_value)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Trên mỗi phiếu thanh toán</div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Phương Thức Chủ Đạo
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: '8px 0 4px 0' }}>
                {revenueData?.by_method?.[0]?.method || 'Chưa có'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Chiếm {revenueData?.by_method?.[0]?.percentage || 0}% tỷ trọng
              </div>
            </div>
          </div>

          {/* Revenue by Method breakdown */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '20px',
            }}
          >
            <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-main)' }}>
              Cơ Cấu Thu Theo Phương Thức Thanh Toán
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {revenueData?.by_method?.map((m) => (
                <div
                  key={m.method}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
                    <span style={{ fontWeight: 600 }}>{m.method}</span>
                    <span>{m.percentage}%</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: '4px 0' }}>
                    {formatVND(m.total_amount)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{m.count} phiếu thu</div>
                </div>
              ))}
            </div>
          </div>

          {/* Drilldown items table */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
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
              <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>
                Chi Tiết Nhật Ký Thu Tiền ({revenueData?.drilldown_items?.length || 0})
              </h4>
            </div>

            {(!revenueData?.drilldown_items || revenueData.drilldown_items.length === 0) ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                <p style={{ margin: 0 }}>Chưa có giao dịch thu tiền nào phát sinh trong kỳ đã chọn.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Mã Phiếu</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Ngày Thu</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Khách Hàng</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nguồn Hợp Đồng / Phụ Lục</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Phương Thức</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Số Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.drilldown_items.map((item) => (
                      <tr key={item.payment_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                          {item.payment_no}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{item.payment_date}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>{item.customer_name || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: item.source_type === 'CONTRACT' ? '#EFF6FF' : '#F5F3FF',
                              color: item.source_type === 'CONTRACT' ? '#1D4ED8' : '#6D28D9',
                              marginRight: '6px',
                            }}
                          >
                            {item.source_type}
                          </span>
                          {item.source_code}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{item.payment_method}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16A34A' }}>
                          {formatVND(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'occupancy' ? (
        /* ========================================================================= */
        /* TAB 2: OCCUPANCY REPORT */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Cards */}
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
                Tổng Số Ô Mộ
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', margin: '8px 0 4px 0' }}>
                {occupancyData?.total_plots || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Đã an táng: {occupancyData?.total_occupied || 0}
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
                Tỷ Lệ Lấp Đầy Nghĩa Trang
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
                {formatPercent(occupancyData?.overall_occupancy_rate)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Dựa trên số ô đã an táng / tổng số ô</div>
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
                Mộ Kim Tĩnh (Bất Biến)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#B45309', margin: '8px 0 4px 0' }}>
                {occupancyData?.total_kim_tinh || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#B45309' }}>Khóa vĩnh viễn cấu trúc & an táng</div>
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
                Ô Mộ Trống Còn Lại
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', margin: '8px 0 4px 0' }}>
                {occupancyData?.total_empty || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Đang giữ chỗ: {occupancyData?.total_reserved || 0}
              </div>
            </div>
          </div>

          {/* Zone Occupancy Table */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>
                Bảng Thống Kê Chi Tiết Từng Phân Khu
              </h4>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Mã & Tên Khu</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Tổng Số Ô</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Chưa Bán</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Giữ Chỗ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Đã Mua Chưa Xây</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Đang Thi Công</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Đã An Táng</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tỷ Lệ Lấp Đầy</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancyData?.zones?.map((z) => (
                    <tr key={z.zone_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <span style={{ color: 'var(--brand-primary)', marginRight: '6px' }}>{z.zone_code}</span>
                        {z.zone_name}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{z.total_plots}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#16A34A' }}>{z.empty_plots}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#D97706' }}>{z.reserved_plots}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569' }}>{z.owned_empty_plots}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#2563EB' }}>{z.under_construction_plots}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--brand-primary)' }}>
                        {z.occupied_plots}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: z.occupancy_rate > 80 ? '#FEF2F2' : '#F0FDF4',
                            color: z.occupancy_rate > 80 ? '#DC2626' : '#16A34A',
                          }}
                        >
                          {formatPercent(z.occupancy_rate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'contracts' ? (
        /* ========================================================================= */
        /* TAB 3: CONTRACTS REPORT */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Hợp Đồng Đất Nghĩa Trang
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
                {contractsData?.total_land_contracts || 0} HĐ
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Giá trị: {formatVND(contractsData?.total_land_value)}
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
                Phụ Lục Dịch Vụ Phát Sinh
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563EB', margin: '8px 0 4px 0' }}>
                {contractsData?.total_annexes || 0} phụ lục
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Giá trị: {formatVND(contractsData?.total_annex_value)}
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
                Chăm Sóc Sắp Hết Hạn
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#D97706', margin: '8px 0 4px 0' }}>
                {contractsData?.expiring_care_annexes?.length || 0} gói
              </div>
              <div style={{ fontSize: '12px', color: '#D97706' }}>Cần liên hệ gia hạn trong 60 ngày tới</div>
            </div>
          </div>

          {/* Breakdown grids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
              }}
            >
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-main)' }}>
                Trạng Thái Hợp Đồng Đất
              </h4>
              {contractsData?.by_contract_status?.map((st) => (
                <div
                  key={st.status}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{st.status}</span>
                  <div>
                    <span style={{ color: '#64748B', marginRight: '10px' }}>{st.count} HĐ</span>
                    <strong style={{ color: 'var(--brand-primary)' }}>{formatVND(st.total_value)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
              }}
            >
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-main)' }}>
                Cơ Cấu Phụ Lục Theo Loại
              </h4>
              {contractsData?.by_annex_type?.map((an) => (
                <div
                  key={an.annex_type}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{an.annex_type}</span>
                  <div>
                    <span style={{ color: '#64748B', marginRight: '10px' }}>{an.count} phụ lục</span>
                    <strong style={{ color: '#2563EB' }}>{formatVND(an.total_value)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expiring Care Annexes Alert Table */}
          {contractsData?.expiring_care_annexes && contractsData.expiring_care_annexes.length > 0 && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #FCD34D',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#FEF3C7',
                  borderBottom: '1px solid #FCD34D',
                  color: '#92400E',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Clock size={16} />
                <span>Danh Sách Phụ Lục Chăm Sóc Sắp Hết Hạn Trong 60 Ngày</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Mã Phụ Lục</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Khách Hàng</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Ô Mộ</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Ngày Hết Hạn</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Còn Lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractsData.expiring_care_annexes.map((item) => (
                      <tr key={item.annex_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                          {item.annex_code}
                        </td>
                        <td style={{ padding: '10px 16px' }}>{item.customer_name}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 500 }}>{item.plot_code}</td>
                        <td style={{ padding: '10px 16px' }}>{item.end_date}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>
                          {item.days_remaining} ngày
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 4: OPERATIONS REPORT */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Construction & Care KPI rows */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Tiến Độ Thi Công
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
                {formatPercent(operationsData?.construction.completion_rate)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Đã hoàn thành {operationsData?.construction.completed_count || 0} /{' '}
                {operationsData?.construction.total_orders || 0} lệnh
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
                Công Trình Quá Hạn
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626', margin: '8px 0 4px 0' }}>
                {operationsData?.construction.overdue_count || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#DC2626' }}>Cần đôn đốc hiện trường</div>
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
                Tỷ Lệ Đóng Ca Chăm Sóc
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', margin: '8px 0 4px 0' }}>
                {formatPercent(operationsData?.care.close_rate)}
              </div>
              <div style={{ fontSize: '12px', color: '#16A34A' }}>
                Đã đóng {operationsData?.care.closed_count || 0} / {operationsData?.care.total_schedules || 0} ca
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
                Tuân Thủ Ảnh Minh Chứng (G12)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
                {formatPercent(operationsData?.care.evidence_compliance_rate)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Ca có tải ảnh chụp hiện trường lên MinIO</div>
            </div>
          </div>

          {/* Operational summary container */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px',
            }}
          >
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-main)' }}>
              Đánh Giá Tuân Thủ Tiêu Chuẩn SLA & Quy Trình Hiện Trường
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '8px' }}>
                  Phân Hệ Thi Công Mộ Phần:
                </div>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.8' }}>
                  <div>Đang chờ vật tư / khởi công: <strong>{operationsData?.construction.pending_count || 0}</strong></div>
                  <div>Đang thi công xây dựng: <strong>{operationsData?.construction.in_progress_count || 0}</strong></div>
                  <div>Thời gian thi công trung bình: <strong>{operationsData?.construction.avg_duration_days || 0} ngày</strong></div>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '8px' }}>
                  Phân Hệ Chăm Sóc Định Kỳ:
                </div>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.8' }}>
                  <div>Đang thực hiện chăm sóc: <strong>{operationsData?.care.in_progress_count || 0}</strong></div>
                  <div>Số ca quá hạn chưa đóng: <strong>{operationsData?.care.overdue_count || 0}</strong></div>
                  <div>Tỷ lệ hoàn thành mục bắt buộc: <strong>{formatPercent(operationsData?.care.required_tasks_completed_rate)}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXPORT REPORT (PDF / XLSX) */}
      {/* ========================================================================= */}
      {isExportOpen && (
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
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={18} color="var(--brand-primary)" />
                <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-main)', fontWeight: 600 }}>
                  Trích Xuất Báo Cáo
                </h3>
              </div>
              <button
                onClick={() => setIsExportOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                  Loại Báo Cáo
                </label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'REVENUE' | 'OCCUPANCY' | 'CONTRACTS' | 'OPERATIONS')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="REVENUE">Doanh Thu Thực Thu</option>
                  <option value="OCCUPANCY">Lấp Đầy & Mộ Phần</option>
                  <option value="CONTRACTS">Hợp Đồng & Phụ Lục</option>
                  <option value="OPERATIONS">Vận Hành (Thi Công & Chăm Sóc)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                  Định Dạng Tệp
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setExportFormat('XLSX')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: exportFormat === 'XLSX' ? '2px solid var(--brand-primary)' : '1px solid #CBD5E1',
                      backgroundColor: exportFormat === 'XLSX' ? '#E6F4EA' : '#FFFFFF',
                      color: exportFormat === 'XLSX' ? 'var(--brand-primary)' : '#475569',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileSpreadsheet size={16} />
                    <span>Excel (.XLSX)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('PDF')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: exportFormat === 'PDF' ? '2px solid var(--brand-primary)' : '1px solid #CBD5E1',
                      backgroundColor: exportFormat === 'PDF' ? '#E6F4EA' : '#FFFFFF',
                      color: exportFormat === 'PDF' ? 'var(--brand-primary)' : '#475569',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileText size={16} />
                    <span>Adobe PDF (.PDF)</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                Tệp xuất được gắn mã SHA-256 xác thực, lưu trữ trên MinIO và hỗ trợ tải trực tiếp về thiết bị.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={exporting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {exporting ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Đang tạo tệp...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Tải Tệp Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
