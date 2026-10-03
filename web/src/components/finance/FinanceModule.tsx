import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  FileCheck,
  Percent,
  Receipt,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import type {
  DiscountApplyPayload,
  FinanceSummary,
  Payment,
  PaymentMethod,
  PaymentRecordPayload,
  Receivable,
} from '../../types/finance'

export const FinanceModule: React.FC = () => {
  const { accessToken, hasPermission } = useAuth()

  // Data states
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Action modals
  const [activeReceivable, setActiveReceivable] = useState<Receivable | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false)
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false)

  // Payment Form state
  const [payAmount, setPayAmount] = useState<string>('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [payRef, setPayRef] = useState<string>('')
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false)
  const [paymentSuccessReceipt, setPaymentSuccessReceipt] = useState<Payment | null>(null)

  // Discount Form state
  const [discType, setDiscType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE')
  const [discValue, setDiscValue] = useState<string>('')
  const [discReason, setDiscReason] = useState<string>('')
  const [submittingDiscount, setSubmittingDiscount] = useState<boolean>(false)

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN')
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
  }

  // Fetch summary and receivables
  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const summaryUrl = '/api/v1/finance/summary'
      const queryParams = new URLSearchParams()
      if (statusFilter) queryParams.append('status', statusFilter)
      if (searchTerm) queryParams.append('search', searchTerm)

      const recUrl = `/api/v1/finance/receivables?${queryParams.toString()}`

      const [sumRes, recRes] = await Promise.all([
        fetch(summaryUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(recUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ])

      if (!sumRes.ok) {
        throw new Error(`Lỗi tải dữ liệu tổng hợp: ${sumRes.status}`)
      }
      if (!recRes.ok) {
        throw new Error(`Lỗi tải danh sách khoản thu: ${recRes.status}`)
      }

      const sumData: FinanceSummary = await sumRes.json()
      const recData: Receivable[] = await recRes.json()

      setSummary(sumData)
      setReceivables(recData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu tài chính')
    } finally {
      setLoading(false)
    }
  }, [accessToken, statusFilter, searchTerm])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Open Payment Dialog
  const handleOpenPayment = (rec: Receivable) => {
    setActiveReceivable(rec)
    setPayAmount(rec.remaining_balance.toString())
    setPayMethod('BANK_TRANSFER')
    setPayRef('')
    setPaymentSuccessReceipt(null)
    setIsPaymentModalOpen(true)
  }

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeReceivable || !accessToken) return

    const amountNum = parseFloat(payAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Vui lòng nhập số tiền thanh toán hợp lệ lớn hơn 0.')
      return
    }
    if (amountNum > activeReceivable.remaining_balance) {
      alert(`Số tiền thanh toán không được vượt quá dư nợ (${formatCurrency(activeReceivable.remaining_balance)})`)
      return
    }

    setSubmittingPayment(true)
    try {
      const payload: PaymentRecordPayload = {
        paid_amount: amountNum,
        payment_method: payMethod,
        transaction_reference: payRef || undefined,
        idempotency_key: `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      }

      const res = await fetch(`/api/v1/finance/receivables/${activeReceivable.receivable_id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Idempotency-Key': payload.idempotency_key || '',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || `Lỗi thu tiền: ${res.status}`)
      }

      const newPayment: Payment = await res.json()
      setPaymentSuccessReceipt(newPayment)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi ghi nhận thanh toán')
    } finally {
      setSubmittingPayment(false)
    }
  }

  // Open Discount Dialog
  const handleOpenDiscount = (rec: Receivable) => {
    setActiveReceivable(rec)
    setDiscType('PERCENTAGE')
    setDiscValue('5')
    setDiscReason('')
    setIsDiscountModalOpen(true)
  }

  // Submit Discount
  const handleSubmitDiscount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeReceivable || !accessToken) return

    const valNum = parseFloat(discValue)
    if (isNaN(valNum) || valNum <= 0) {
      alert('Giá trị chiết khấu phải lớn hơn 0.')
      return
    }
    if (discType === 'PERCENTAGE' && valNum > 100) {
      alert('Chiết khấu phần trăm tối đa là 100%.')
      return
    }
    if (!discReason || discReason.trim().length < 5) {
      alert('Vui lòng nhập lý do giảm trừ cụ thể (tối thiểu 5 ký tự).')
      return
    }

    setSubmittingDiscount(true)
    try {
      const payload: DiscountApplyPayload = {
        discount_type: discType,
        discount_value: valNum,
        justification_reason: discReason.trim(),
      }

      const res = await fetch(`/api/v1/finance/receivables/${activeReceivable.receivable_id}/discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || `Lỗi duyệt chiết khấu: ${res.status}`)
      }

      alert('Đã áp dụng chiết khấu thành công cho khoản thu.')
      setIsDiscountModalOpen(false)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi áp dụng chiết khấu')
    } finally {
      setSubmittingDiscount(false)
    }
  }

  // Download Receipt PDF
  const handleDownloadReceipt = async (paymentId: number) => {
    if (!accessToken) return
    try {
      const res = await fetch(`/api/v1/finance/payments/${paymentId}/receipt/download`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        throw new Error(`Không thể tải biên lai: ${res.status}`)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BienLai_ThuTien_${paymentId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi tải tệp biên lai')
    }
  }

  // Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#DCFCE7',
              color: '#15803D',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle size={13} />
            Đã thanh toán
          </span>
        )
      case 'PARTIALLY_PAID':
        return (
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={13} />
            Thu một phần
          </span>
        )
      case 'UNPAID':
        return (
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#F1F5F9',
              color: '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertCircle size={13} />
            Chưa thanh toán
          </span>
        )
      case 'CANCELLED':
        return (
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#FEE2E2',
              color: '#B91C1C',
            }}
          >
            Đã hủy
          </span>
        )
      default:
        return <span>{status}</span>
    }
  }

  // Render 4 UI states
  if (loading && !summary) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '40px',
        }}
      >
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--brand-primary)', marginBottom: '16px' }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
          Đang tải dữ liệu kế toán và công nợ...
        </div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>
          Đồng bộ sổ cái thu chi và kiểm tra trạng thái thanh toán.
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #FCA5A5',
          padding: '36px',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={40} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#991B1B', marginBottom: '8px' }}>
          Không thể kết nối đến máy chủ kế toán
        </h4>
        <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>{error}</p>
        <button
          onClick={loadData}
          style={{
            padding: '8px 20px',
            backgroundColor: 'var(--brand-primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <RefreshCw size={15} />
          Thử Lại
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Title */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '20px 24px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
            Quản Lý Công Nợ & Thu Tiền (Milestone M11)
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
            Kiểm soát sổ cái công nợ theo hợp đồng, chiết khấu, thu ngân tiền mặt, ngân hàng và xuất biên lai PDF chuẩn xác.
          </p>
        </div>
        <button
          onClick={loadData}
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
          <RefreshCw size={14} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* 2. KPI Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #3B82F6',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Tổng Nghĩa Vụ Phải Thu
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', marginTop: '6px' }}>
              {formatCurrency(summary.total_receivables_amount)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Tổng số khoản thu: {summary.count_unpaid + summary.count_partially_paid + summary.count_paid}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #10B981',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Đã Thực Thu (Đã Nộp)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#10B981', marginTop: '6px' }}>
              {formatCurrency(summary.total_collected_amount)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              {summary.count_paid} khoản đã hoàn tất 100%
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #F59E0B',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Dư Nợ Còn Lại Cần Thu
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#D97706', marginTop: '6px' }}>
              {formatCurrency(summary.total_outstanding_amount)}
            </div>
            <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>
              {summary.count_overdue} khoản đã quá hạn thanh toán
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #8B5CF6',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Tổng Chiết Khấu Đã Duyệt
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#7C3AED', marginTop: '6px' }}>
              {formatCurrency(summary.total_discounts_amount)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Chính sách ưu đãi và miễn giảm
            </div>
          </div>
        </div>
      )}

      {/* 3. Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, số điện thoại, mã hợp đồng hoặc mã phụ lục..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#FFFFFF',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="UNPAID">Chưa thanh toán</option>
          <option value="PARTIALLY_PAID">Thu một phần</option>
          <option value="PAID">Đã thanh toán</option>
        </select>
      </div>

      {/* 4. Receivables List */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        {receivables.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <FileCheck size={44} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>
              Không có khoản phải thu nào
            </h4>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              {searchTerm || statusFilter
                ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                : 'Hệ thống chưa ghi nhận nghĩa vụ tài chính nào.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Mã / Căn Cứ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Khách Hàng</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Hạn Nộp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Tiền Gốc</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Chiết Khấu</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Phải Thu</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Đã Nộp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Dư Nợ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((rec) => {
                  const isOverdue =
                    rec.status !== 'PAID' &&
                    rec.status !== 'CANCELLED' &&
                    new Date(rec.due_date) < new Date(new Date().setHours(0, 0, 0, 0))

                  return (
                    <tr
                      key={rec.receivable_id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        backgroundColor: isOverdue ? '#FFFBEB' : '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>#{rec.receivable_id}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {rec.contract_code ? `HĐ: ${rec.contract_code}` : `Phụ lục: ${rec.annex_code}`}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Đợt {rec.installment_no}</div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{rec.customer_name || 'Khách vãng lai'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          {rec.customer_phone || '-'}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ color: isOverdue ? '#DC2626' : '#334155', fontWeight: isOverdue ? 600 : 400 }}>
                          {formatDate(rec.due_date)}
                        </div>
                        {isOverdue && (
                          <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>Quá hạn nộp</div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top', color: '#64748B' }}>
                        {formatCurrency(rec.original_amount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top', color: '#7C3AED' }}>
                        {rec.discount_amount > 0 ? `-${formatCurrency(rec.discount_amount)}` : '-'}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, color: '#1E293B' }}>
                        {formatCurrency(rec.final_payable_amount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top', color: '#10B981', fontWeight: 600 }}>
                        {formatCurrency(rec.total_paid_amount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top', color: rec.remaining_balance > 0 ? '#D97706' : '#94A3B8', fontWeight: 700 }}>
                        {formatCurrency(rec.remaining_balance)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'top' }}>
                        {renderStatusBadge(rec.status)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {hasPermission('finance:write') && rec.status !== 'PAID' && rec.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleOpenPayment(rec)}
                              title="Tiếp nhận thanh toán"
                              style={{
                                padding: '6px 10px',
                                backgroundColor: 'var(--brand-primary)',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CreditCard size={13} />
                              Thu Tiền
                            </button>
                          )}

                          {hasPermission('finance:discount') &&
                            rec.discounts.length === 0 &&
                            rec.status !== 'PAID' &&
                            rec.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleOpenDiscount(rec)}
                                title="Áp dụng chiết khấu"
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: '#F3E8FF',
                                  color: '#7C3AED',
                                  border: '1px solid #D8B4FE',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Percent size={13} />
                                Chiết Khấu
                              </button>
                            )}

                          <button
                            onClick={() => {
                              setActiveReceivable(rec)
                              setIsHistoryDrawerOpen(true)
                            }}
                            title="Xem lịch sử thanh toán & biên lai"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Receipt size={13} />
                            Lịch Sử ({rec.payments.length})
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Payment Modal */}
      {isPaymentModalOpen && activeReceivable && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '540px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} />
                Tiếp Nhận Thu Tiền - Khoản Thu #{activeReceivable.receivable_id}
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {paymentSuccessReceipt ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <CheckCircle size={48} style={{ color: '#10B981', margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#1E293B', margin: '0 0 6px' }}>
                  Giao Dịch Thanh Toán Thành Công!
                </h4>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px' }}>
                  Số tiền <b>{formatCurrency(paymentSuccessReceipt.paid_amount)}</b> đã được ghi nhận vào hệ thống.
                </p>

                {paymentSuccessReceipt.invoice && (
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      textAlign: 'left',
                      marginBottom: '24px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#64748B' }}>Mã biên lai:</span>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>
                        {paymentSuccessReceipt.invoice.invoice_number}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#64748B' }}>Bằng chữ:</span>
                      <span style={{ fontStyle: 'italic', color: '#1E293B' }}>
                        {paymentSuccessReceipt.invoice.total_amount_in_words}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Nhân viên thu:</span>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {paymentSuccessReceipt.recorder_name || 'Thu ngân'}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleDownloadReceipt(paymentSuccessReceipt.payment_id)}
                    style={{
                      padding: '9px 18px',
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
                    <Download size={15} />
                    Tải Về Biên Lai (PDF)
                  </button>
                  <button
                    onClick={() => {
                      setIsPaymentModalOpen(false)
                      setPaymentSuccessReceipt(null)
                    }}
                    style={{
                      padding: '9px 18px',
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPayment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748B' }}>Khách hàng:</span>
                    <span style={{ fontWeight: 600, color: '#1E293B' }}>{activeReceivable.customer_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748B' }}>Hợp đồng / Phụ lục:</span>
                    <span style={{ fontWeight: 600, color: '#1E293B' }}>
                      {activeReceivable.contract_code || activeReceivable.annex_code}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Dư nợ hiện tại:</span>
                    <span style={{ fontWeight: 700, color: '#D97706' }}>
                      {formatCurrency(activeReceivable.remaining_balance)}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Số tiền thanh toán (VNĐ) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      required
                      min="1"
                      max={activeReceivable.remaining_balance}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        fontWeight: 600,
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPayAmount(activeReceivable.remaining_balance.toString())}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '11px',
                        padding: '4px 8px',
                        backgroundColor: '#E2E8F0',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#334155',
                        fontWeight: 600,
                      }}
                    >
                      Nộp toàn bộ
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Phương thức thanh toán *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                    <option value="CASH">Tiền mặt tại quầy</option>
                    <option value="VIET_QR">Quét mã VietQR</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Mã giao dịch / Mã tham chiếu
                  </label>
                  <input
                    type="text"
                    placeholder="VD: FT2610041234, VCB-998877..."
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    style={{
                      padding: '9px 16px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    style={{
                      padding: '9px 20px',
                      backgroundColor: 'var(--brand-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      cursor: submittingPayment ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submittingPayment ? 'Đang ghi nhận...' : 'Xác Nhận & Xuất Biên Lai'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6. Discount Modal */}
      {isDiscountModalOpen && activeReceivable && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '500px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={18} />
                Áp Dụng Chiết Khấu - Khoản Thu #{activeReceivable.receivable_id}
              </h3>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDiscount} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Số tiền gốc ban đầu:</span>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{formatCurrency(activeReceivable.original_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Đã thu:</span>
                  <span style={{ fontWeight: 600, color: '#10B981' }}>{formatCurrency(activeReceivable.total_paid_amount)}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Loại chiết khấu *
                </label>
                <select
                  value={discType}
                  onChange={(e) => setDiscType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="PERCENTAGE">Theo tỷ lệ phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Theo số tiền cố định (VNĐ)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Giá trị chiết khấu {discType === 'PERCENTAGE' ? '(%)' : '(VNĐ)'} *
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  max={discType === 'PERCENTAGE' ? 100 : activeReceivable.original_amount}
                  step={discType === 'PERCENTAGE' ? '0.1' : '1000'}
                  value={discValue}
                  onChange={(e) => setDiscValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Căn cứ & Lý do giảm trừ * (bắt buộc)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ghi rõ lý do chiết khấu, số quyết định phê duyệt của ban giám đốc..."
                  value={discReason}
                  onChange={(e) => setDiscReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingDiscount}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#7C3AED',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: submittingDiscount ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submittingDiscount ? 'Đang duyệt...' : 'Phê Duyệt Chiết Khấu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. History Drawer */}
      {isHistoryDrawerOpen && activeReceivable && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              width: '580px',
              maxWidth: '90vw',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)',
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
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
                  Lịch Sử Giao Dịch & Biên Lai
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Khoản thu #{activeReceivable.receivable_id} - Khách: {activeReceivable.customer_name}
                </div>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Receivable snapshot */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>Tổng quan nghĩa vụ:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Số tiền gốc:</span>{' '}
                    <span style={{ fontWeight: 600 }}>{formatCurrency(activeReceivable.original_amount)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Chiết khấu:</span>{' '}
                    <span style={{ fontWeight: 600, color: '#7C3AED' }}>{formatCurrency(activeReceivable.discount_amount)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Phải thu cuối cùng:</span>{' '}
                    <span style={{ fontWeight: 700, color: '#1E293B' }}>{formatCurrency(activeReceivable.final_payable_amount)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Đã thanh toán:</span>{' '}
                    <span style={{ fontWeight: 700, color: '#10B981' }}>{formatCurrency(activeReceivable.total_paid_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Payments list */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 12px' }}>
                  Các Lần Ghi Nhận Thanh Toán ({activeReceivable.payments.length})
                </h4>

                {activeReceivable.payments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '8px' }}>
                    Chưa có giao dịch thanh toán nào được ghi nhận cho khoản thu này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeReceivable.payments.map((p) => (
                      <div
                        key={p.payment_id}
                        style={{
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '14px 16px',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#10B981' }}>
                            +{formatCurrency(p.paid_amount)}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDateTime(p.paid_at)}</span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>
                            <b>Phương thức:</b> {p.payment_method === 'CASH' ? 'Tiền mặt' : p.payment_method === 'VIET_QR' ? 'VietQR' : 'Chuyển khoản'}
                            {p.transaction_reference && ` (Tham chiếu: ${p.transaction_reference})`}
                          </div>
                          <div>
                            <b>Thu ngân:</b> {p.recorder_name || 'Nhân viên kế toán'}
                          </div>
                          {p.invoice && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>
                                <b>Biên lai:</b> {p.invoice.invoice_number}
                              </span>
                              <button
                                onClick={() => handleDownloadReceipt(p.payment_id)}
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: 'var(--brand-primary)',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Download size={12} />
                                Tải PDF
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discounts history */}
              {activeReceivable.discounts.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 12px' }}>
                    Thông Tin Chiết Khấu Đã Áp Dụng
                  </h4>
                  {activeReceivable.discounts.map((d) => (
                    <div
                      key={d.discount_id}
                      style={{
                        border: '1px solid #D8B4FE',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        backgroundColor: '#FAF5FF',
                        fontSize: '12px',
                        color: '#4C1D95',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        Giảm trừ: {formatCurrency(d.calculated_amount)} ({d.discount_type === 'PERCENTAGE' ? `${d.discount_value}%` : 'Cố định'})
                      </div>
                      <div style={{ color: '#6B21A8' }}>Lý do: {d.justification_reason}</div>
                      <div style={{ color: '#9333EA', fontSize: '11px', marginTop: '4px' }}>
                        Ngày duyệt: {formatDateTime(d.applied_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', textAlign: 'right' }}>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#E2E8F0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
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

export default FinanceModule
