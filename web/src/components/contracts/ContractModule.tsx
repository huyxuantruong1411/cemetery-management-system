import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building,
  CheckCircle,
  Clock,
  Download,
  FileCheck,
  FilePlus,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  Send,
  Upload,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ContractBriefResponse,
  ContractDetailResponse,
  ContractStatus,
} from '../../types/contracts';
import type { Customer } from '../../types/profiles';
import type { Plot } from '../../types/plots';

interface ContractModuleProps {
  token: string | null;
  currentUserRoles?: string[];
}

export const ContractModule: React.FC<ContractModuleProps> = ({ token, currentUserRoles = [] }) => {
  // Master List State
  const [contracts, setContracts] = useState<ContractBriefResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail Modal State
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardCustomer, setWizardCustomer] = useState<Customer | null>(null);
  const [wizardPlot, setWizardPlot] = useState<Plot | null>(null);
  const [wizardPrice, setWizardPrice] = useState<string>('');
  const [wizardNotes, setWizardNotes] = useState<string>('');
  const [wizardSubmitting, setWizardSubmitting] = useState<boolean>(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Customer search state for wizard
  const [custSearch, setCustSearch] = useState<string>('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [custLoading, setCustLoading] = useState<boolean>(false);

  // Available plots state for wizard
  const [availablePlots, setAvailablePlots] = useState<Plot[]>([]);
  const [plotFilterZone, setPlotFilterZone] = useState<string>('');
  const [plotLoading, setPlotLoading] = useState<boolean>(false);

  // Activation Modal State
  const [isActivateModalOpen, setIsActivateModalOpen] = useState<boolean>(false);
  const [activateScanFile, setActivateScanFile] = useState<File | null>(null);
  const [activateSignedAt, setActivateSignedAt] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activateNotes, setActivateNotes] = useState<string>('');
  const [activateSubmitting, setActivateSubmitting] = useState<boolean>(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);

  const canManage = currentUserRoles.some((r) => ['ADMIN', 'MARKETING'].includes(r));

  // ==========================================
  // API Fetch Functions
  // ==========================================
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/v1/contracts?limit=100';
      if (statusFilter) url += `&status_filter=${statusFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Lỗi tải danh sách hợp đồng (${res.status})`);
      }
      const data = await res.json();
      setContracts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định khi tải hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, searchQuery]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const fetchContractDetail = async (contractId: number) => {
    setSelectedContractId(contractId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Lỗi xem chi tiết (${res.status})`);
      }
      const data = await res.json();
      setContractDetail(data);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setDetailLoading(false);
    }
  };

  // Search customers for Step 1
  const searchCustomers = async (keyword: string) => {
    setCustLoading(true);
    try {
      const res = await fetch(`/api/v1/profiles/customers?search=${encodeURIComponent(keyword)}&limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCustResults(data);
      }
    } catch {
      // ignore
    } finally {
      setCustLoading(false);
    }
  };

  // Fetch available plots for Step 2
  const fetchAvailablePlots = async () => {
    setPlotLoading(true);
    try {
      const res = await fetch('/api/v1/plots?status=EMPTY_UNSOLD&limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAvailablePlots(data);
      }
    } catch {
      // ignore
    } finally {
      setPlotLoading(false);
    }
  };

  // Open Wizard
  const handleOpenWizard = () => {
    setWizardStep(1);
    setWizardCustomer(null);
    setWizardPlot(null);
    setWizardPrice('');
    setWizardNotes('');
    setWizardError(null);
    setIsWizardOpen(true);
    searchCustomers('');
    fetchAvailablePlots();
  };

  // Submit Draft Contract (Step 4)
  const handleCreateDraft = async () => {
    if (!wizardCustomer || !wizardPlot) {
      setWizardError('Vui lòng chọn khách hàng và ô mộ hợp lệ');
      return;
    }
    setWizardSubmitting(true);
    setWizardError(null);
    try {
      const payload: {
        customer_id: number;
        plot_id: number;
        land_unit_price?: number;
        notes?: string;
      } = {
        customer_id: wizardCustomer.customer_id,
        plot_id: wizardPlot.plot_id,
        notes: wizardNotes.trim() || undefined,
      };
      if (wizardPrice.trim() && !isNaN(Number(wizardPrice))) {
        payload.land_unit_price = Number(wizardPrice);
      }

      const res = await fetch('/api/v1/contracts/land-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể tạo hợp đồng nháp');
      }

      const created = await res.json();
      setIsWizardOpen(false);
      await fetchContracts();
      fetchContractDetail(created.contract_id);
    } catch (err: unknown) {
      setWizardError(err instanceof Error ? err.message : 'Lỗi khi tạo hợp đồng');
    } finally {
      setWizardSubmitting(false);
    }
  };

  // Action: Submit for signing
  const handleSubmitForSigning = async (contractId: number) => {
    if (!window.confirm('Chuyển hợp đồng này sang trạng thái Chờ Ký Kết?')) return;
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/submit-signing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes: 'Đã hoàn thiện dự thảo và gửi thân nhân ký duyệt.' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Thao tác thất bại');
      }
      await fetchContracts();
      fetchContractDetail(contractId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
  };

  // Action: Download PDF
  const handleDownloadPDF = async (contractId: number, contractCode: string) => {
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Không thể tạo file in PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HopDong_${contractCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi tải file PDF');
    }
  };

  // Action: Activate Contract with scan upload
  const handleActivateContract = async () => {
    if (!contractDetail || !activateScanFile) {
      setActivateError('Vui lòng đính kèm file scan hợp đồng có chữ ký.');
      return;
    }
    setActivateSubmitting(true);
    setActivateError(null);
    try {
      // 1. Upload scan file to MinIO
      const formData = new FormData();
      formData.append('file', activateScanFile);
      const upRes = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!upRes.ok) {
        const upErr = await upRes.json().catch(() => ({}));
        throw new Error(upErr.detail || 'Tải file scan lên MinIO thất bại');
      }
      const upData = await upRes.json();
      const fileId = upData.file_id;

      // 2. Call activate endpoint
      const actRes = await fetch(`/api/v1/contracts/${contractDetail.contract_id}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          signed_scan_file_id: fileId,
          signed_at: activateSignedAt || undefined,
          activation_notes: activateNotes.trim() || undefined,
        }),
      });

      if (!actRes.ok) {
        const actErr = await actRes.json().catch(() => ({}));
        throw new Error(actErr.detail || 'Kích hoạt hợp đồng thất bại');
      }

      setIsActivateModalOpen(false);
      setActivateScanFile(null);
      await fetchContracts();
      fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      setActivateError(err instanceof Error ? err.message : 'Lỗi kích hoạt hợp đồng');
    } finally {
      setActivateSubmitting(false);
    }
  };

  // Action: Cancel Draft Contract
  const handleCancelContract = async () => {
    if (!contractDetail || !cancelReason.trim()) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/v1/contracts/${contractDetail.contract_id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Hủy hợp đồng thất bại');
      }
      setIsCancelModalOpen(false);
      setCancelReason('');
      await fetchContracts();
      fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi hủy hợp đồng');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Helpers
  const formatCurrency = (val: number | string | undefined | null) => {
    if (val === null || val === undefined) return '0 ₫';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
  };

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Dự thảo', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
      case 'PENDING_SIGN':
        return { label: 'Chờ ký kết', bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' };
      case 'ACTIVE':
        return { label: 'Đang hiệu lực', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
      case 'CANCELLED':
        return { label: 'Đã hủy', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' };
      default:
        return { label: status, bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
    }
  };

  // Summary Metrics
  const totalCount = contracts.length;
  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const pendingCount = contracts.filter((c) => c.status === 'PENDING_SIGN').length;
  const draftCount = contracts.filter((c) => c.status === 'DRAFT').length;
  const totalValue = contracts
    .filter((c) => c.status === 'ACTIVE')
    .reduce((acc, c) => acc + (typeof c.total_amount === 'string' ? parseFloat(c.total_amount) : c.total_amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '16px 20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} color="#0284C7" />
            <span>Tổng Hợp Đồng</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginTop: '6px' }}>{totalCount}</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '16px 20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={16} color="#16A34A" />
            <span>Đang Hiệu Lực</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', marginTop: '6px' }}>{activeCount}</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '16px 20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} color="#D97706" />
            <span>Chờ Ký / Dự Thảo</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#D97706', marginTop: '6px' }}>
            {pendingCount + draftCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '16px 20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={16} color="#4F46E5" />
            <span>Doanh Thu Hiệu Lực</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#4F46E5', marginTop: '6px' }}>
            {formatCurrency(totalValue)}
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          padding: '16px 20px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
          {/* Search */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              minWidth: '240px',
              maxWidth: '360px',
              flex: 1,
            }}
          >
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Tìm theo mã HĐ, tên KH, SĐT, mã ô..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchContracts()}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Dự thảo (Draft)</option>
            <option value="PENDING_SIGN">Chờ ký kết (Pending Sign)</option>
            <option value="ACTIVE">Đang hiệu lực (Active)</option>
            <option value="CANCELLED">Đã hủy (Cancelled)</option>
          </select>

          <button
            onClick={() => fetchContracts()}
            disabled={loading}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>

        {canManage && (
          <button
            onClick={handleOpenWizard}
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <FilePlus size={16} />
            <span>Lập Hợp Đồng Mua Đất</span>
          </button>
        )}
      </div>

      {/* Main Content Area: 4 States */}
      {loading ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '60px 20px',
            border: '1px solid #E2E8F0',
            textAlign: 'center',
          }}
        >
          <RefreshCw size={32} color="var(--brand-primary)" className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', color: '#64748B' }}>Đang tải danh sách hợp đồng...</div>
        </div>
      ) : error ? (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: '10px',
            padding: '30px 20px',
            border: '1px solid #FECACA',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={32} color="#DC2626" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#991B1B' }}>Không thể tải danh sách hợp đồng</div>
          <p style={{ fontSize: '13px', color: '#B91C1C', marginTop: '4px' }}>{error}</p>
          <button
            onClick={() => fetchContracts()}
            style={{
              marginTop: '12px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      ) : contracts.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '60px 20px',
            border: '1px solid #E2E8F0',
            textAlign: 'center',
          }}
        >
          <FileText size={48} color="#94A3B8" style={{ margin: '0 auto 14px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#334155' }}>Chưa có hợp đồng nào phù hợp</div>
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '6px auto 16px' }}>
            Không tìm thấy hợp đồng nào theo điều kiện lọc hiện tại. Bắt đầu tư vấn và lập hợp đồng mua bán đất mới ngay.
          </p>
          {canManage && (
            <button
              onClick={handleOpenWizard}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FilePlus size={16} />
              <span>Tạo Hợp Đồng Mua Đất Đầu Tiên</span>
            </button>
          )}
        </div>
      ) : (
        /* Contracts Table */
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mã Hợp Đồng</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Khách Hàng Đứng Tên</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vị Trí Đất / Ô Mộ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Giá Trị Hợp Đồng</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ngày Lập</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const badge = getStatusBadge(c.status);
                  return (
                    <tr
                      key={c.contract_id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                        {c.contract_code}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{c.customer_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{c.customer_phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {c.plot_code ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#0F172A' }}>{c.plot_code}</span>
                            {c.zone_name && <span style={{ fontSize: '12px', color: '#64748B' }}> ({c.zone_name})</span>}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Dịch vụ chung</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                        {formatCurrency(c.total_amount)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>
                        {new Date(c.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => fetchContractDetail(c.contract_id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#334155',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(c.contract_id, c.contract_code)}
                            title="Tải bản in PDF"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#0284C7',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4-Step Land Purchase Wizard Modal */}
      {/* ========================================================================= */}
      {isWizardOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
              maxWidth: '780px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Wizard Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
                  Quy Trình Lập Hợp Đồng Mua Bán Đất Nghĩa Trang
                </h3>
                <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
                  Bước {wizardStep}/4: {wizardStep === 1 && 'Chọn Khách Hàng Đứng Tên'}
                  {wizardStep === 2 && 'Chọn Vị Trí Ô Mộ Khả Dụng'}
                  {wizardStep === 3 && 'Định Giá Đất & Mẫu Hợp Đồng'}
                  {wizardStep === 4 && 'Xác Nhận & Tạo Bản Dự Thảo'}
                </div>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Step Indicators */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '12px 24px',
              }}
            >
              {[
                { step: 1, label: 'Khách hàng' },
                { step: 2, label: 'Vị trí đất' },
                { step: 3, label: 'Đơn giá' },
                { step: 4, label: 'Xác nhận' },
              ].map((s) => (
                <div
                  key={s.step}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: wizardStep >= s.step ? 'var(--brand-primary)' : '#94A3B8',
                    fontWeight: wizardStep === s.step ? 600 : 500,
                    fontSize: '13px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: wizardStep >= s.step ? 'var(--brand-primary)' : '#E2E8F0',
                      color: wizardStep >= s.step ? '#FFFFFF' : '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                    }}
                  >
                    {s.step}
                  </div>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Wizard Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {wizardError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: '13px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{wizardError}</span>
                </div>
              )}

              {/* STEP 1: SELECT CUSTOMER */}
              {wizardStep === 1 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
                    1. Tra cứu hoặc chọn khách hàng đứng tên hợp đồng:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                      <input
                        type="text"
                        placeholder="Nhập họ tên, số CCCD hoặc SĐT khách hàng..."
                        value={custSearch}
                        onChange={(e) => {
                          setCustSearch(e.target.value);
                          searchCustomers(e.target.value);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>

                  {wizardCustomer && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#065F46', textTransform: 'uppercase' }}>
                            Đã Chọn Khách Hàng
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#065F46', marginTop: '2px' }}>
                            {wizardCustomer.full_name} ({wizardCustomer.customer_code})
                          </div>
                          <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                            CCCD: {wizardCustomer.citizen_id} | SĐT: {wizardCustomer.phone_number} | Địa chỉ: {wizardCustomer.address}
                          </div>
                        </div>
                        <CheckCircle size={24} color="#059669" />
                      </div>
                    </div>
                  )}

                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                    {custLoading ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                        Đang tìm kiếm khách hàng...
                      </div>
                    ) : custResults.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                        Không tìm thấy khách hàng. Vui lòng tạo hồ sơ khách hàng mới ở tab &apos;Thân Nhân &amp; Người Mất&apos;.
                      </div>
                    ) : (
                      custResults.map((c) => (
                        <div
                          key={c.customer_id}
                          onClick={() => setWizardCustomer(c)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: wizardCustomer?.customer_id === c.customer_id ? '#F0FDFA' : '#FFFFFF',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>{c.full_name}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              CCCD: {c.citizen_id} • SĐT: {c.phone_number}
                            </div>
                          </div>
                          <button
                            type="button"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: wizardCustomer?.customer_id === c.customer_id ? 'var(--brand-primary)' : '#FFFFFF',
                              color: wizardCustomer?.customer_id === c.customer_id ? '#FFFFFF' : '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            {wizardCustomer?.customer_id === c.customer_id ? 'Đang chọn' : 'Chọn'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT AVAILABLE PLOT */}
              {wizardStep === 2 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
                    2. Chọn vị trí ô mộ trống cần mua (chống xung đột đặt chỗ tức thời):
                  </div>

                  {wizardPlot && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#1E40AF', textTransform: 'uppercase' }}>
                            Đã Chọn Ô Mộ
                          </span>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E40AF', marginTop: '2px' }}>
                            {wizardPlot.plot_code}
                          </div>
                          <div style={{ fontSize: '12px', color: '#1D4ED8', marginTop: '2px' }}>
                            Khu: {wizardPlot.zone_name} | Hàng: {wizardPlot.row_code} | Loại mộ: {wizardPlot.type_name} | Hướng: {wizardPlot.orientation || 'Tự do'}
                          </div>
                        </div>
                        <MapPin size={24} color="#2563EB" />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <select
                      value={plotFilterZone}
                      onChange={(e) => setPlotFilterZone(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="">Tất cả các khu</option>
                      {Array.from(new Set(availablePlots.map((p) => p.zone_code))).map((zc) => (
                        <option key={zc} value={zc}>
                          Khu {zc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                    {plotLoading ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                        Đang tải danh sách ô mộ trống...
                      </div>
                    ) : availablePlots.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                        Không có ô mộ trống khả dụng để bán.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', padding: '10px' }}>
                        {availablePlots
                          .filter((p) => !plotFilterZone || p.zone_code === plotFilterZone)
                          .map((p) => (
                            <div
                              key={p.plot_id}
                              onClick={() => setWizardPlot(p)}
                              style={{
                                padding: '10px',
                                borderRadius: '6px',
                                border: wizardPlot?.plot_id === p.plot_id ? '2px solid var(--brand-primary)' : '1px solid #E2E8F0',
                                backgroundColor: wizardPlot?.plot_id === p.plot_id ? '#F0FDFA' : '#FFFFFF',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{p.plot_code}</div>
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                {p.zone_name} - {p.type_name}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: PRICING & TEMPLATE */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                    3. Thiết lập đơn giá đất và điều khoản hợp đồng:
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Đơn giá chuyển nhượng đất (VND)
                    </label>
                    <input
                      type="number"
                      placeholder="Để trống nếu áp dụng giá niêm yết tự động theo bảng giá"
                      value={wizardPrice}
                      onChange={(e) => setWizardPrice(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                      }}
                    />
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                      * Nếu không nhập, hệ thống sẽ tự động tra cứu đơn giá niêm yết đang có hiệu lực cho loại mộ của ô{' '}
                      {wizardPlot?.plot_code}.
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Ghi chú / Điều khoản thỏa thuận đặc biệt
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ghi chú thêm về yêu cầu phong thủy, người thụ hưởng tương lai..."
                      value={wizardNotes}
                      onChange={(e) => setWizardNotes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & CONFIRM */}
              {wizardStep === 4 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '14px' }}>
                    4. Rà soát thông tin trước khi phát hành hợp đồng dự thảo:
                  </div>

                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 600 }}>
                      Tóm Tắt Hợp Đồng Mua Đất An Táng
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Khách hàng đứng tên:</span>
                        <span style={{ fontWeight: 600 }}>{wizardCustomer?.full_name} (CCCD: {wizardCustomer?.citizen_id})</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Số điện thoại liên lạc:</span>
                        <span style={{ fontWeight: 600 }}>{wizardCustomer?.phone_number}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Ô mộ đăng ký mua:</span>
                        <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>
                          {wizardPlot?.plot_code} ({wizardPlot?.zone_name})
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Loại quy cách huyệt:</span>
                        <span style={{ fontWeight: 600 }}>{wizardPlot?.type_name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Đơn giá áp dụng:</span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>
                          {wizardPrice.trim() ? formatCurrency(Number(wizardPrice)) : 'Theo biểu giá niêm yết tự động'}
                        </span>
                      </div>
                      {wizardNotes && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748B' }}>Ghi chú đính kèm:</span>
                          <span style={{ fontStyle: 'italic' }}>{wizardNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      backgroundColor: '#FEF3C7',
                      borderRadius: '6px',
                      border: '1px solid #FDE68A',
                      fontSize: '12px',
                      color: '#92400E',
                    }}
                  >
                    <strong>Lưu ý nghiệp vụ:</strong> Sau khi tạo, hợp đồng sẽ ở trạng thái <code>DRAFT</code> và ô mộ{' '}
                    <code>{wizardPlot?.plot_code}</code> sẽ được tạm khóa giữ chỗ (RESERVED) để nhân viên in ấn gửi thân nhân ký duyệt.
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (wizardStep === 1) setIsWizardOpen(false);
                  else setWizardStep(wizardStep - 1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {wizardStep === 1 ? 'Hủy bỏ' : 'Quay lại'}
              </button>

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1 && !wizardCustomer) {
                      setWizardError('Vui lòng chọn khách hàng');
                      return;
                    }
                    if (wizardStep === 2 && !wizardPlot) {
                      setWizardError('Vui lòng chọn một ô mộ trống');
                      return;
                    }
                    setWizardError(null);
                    setWizardStep(wizardStep + 1);
                  }}
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Tiếp theo &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateDraft}
                  disabled={wizardSubmitting}
                  style={{
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 22px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {wizardSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FileCheck size={16} />}
                  <span>Xác Nhận &amp; Tạo Dự Thảo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Contract Detail Modal */}
      {/* ========================================================================= */}
      {selectedContractId !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
              maxWidth: '840px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
                  Chi Tiết Hợp Đồng: {contractDetail?.contract_code || 'Đang tải...'}
                </h3>
                <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
                  Loại: Mua Bán Quyền Sử Dụng Đất An Táng
                </div>
              </div>
              <button
                onClick={() => setSelectedContractId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {detailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  <div>Đang tải chi tiết hợp đồng...</div>
                </div>
              ) : detailError ? (
                <div style={{ padding: '20px', color: '#B91C1C', backgroundColor: '#FEF2F2', borderRadius: '6px' }}>
                  {detailError}
                </div>
              ) : contractDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Status Banner */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 18px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Trạng thái hồ sơ</div>
                      <div style={{ marginTop: '4px' }}>
                        {(() => {
                          const b = getStatusBadge(contractDetail.status);
                          return (
                            <span
                              style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                backgroundColor: b.bg,
                                color: b.color,
                                border: `1px solid ${b.border}`,
                              }}
                            >
                              {b.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Tổng giá trị hợp đồng</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                        {formatCurrency(contractDetail.total_amount)}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Plot Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Customer Card */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <User size={16} color="var(--brand-primary)" />
                        <span>Khách Hàng Đứng Tên</span>
                      </div>
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div><strong>Họ tên:</strong> {contractDetail.customer?.full_name}</div>
                        <div><strong>Mã KH:</strong> {contractDetail.customer?.customer_code}</div>
                        <div><strong>Số CCCD:</strong> {contractDetail.customer?.citizen_id}</div>
                        <div><strong>SĐT:</strong> {contractDetail.customer?.phone_number}</div>
                        <div><strong>Địa chỉ:</strong> {contractDetail.customer?.address}</div>
                      </div>
                    </div>

                    {/* Plot Card */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <MapPin size={16} color="var(--brand-primary)" />
                        <span>Vị Trí Đất An Táng</span>
                      </div>
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div><strong>Mã ô mộ:</strong> {contractDetail.plot?.plot_code || contractDetail.land_purchase?.plot?.plot_code}</div>
                        <div><strong>Khu:</strong> {contractDetail.plot?.zone_name || contractDetail.land_purchase?.plot?.zone_name}</div>
                        <div><strong>Hàng:</strong> {contractDetail.plot?.row_code || contractDetail.land_purchase?.plot?.row_code}</div>
                        <div><strong>Quy cách:</strong> {contractDetail.plot?.type_name || contractDetail.land_purchase?.plot?.type_name}</div>
                        <div><strong>Hướng:</strong> {contractDetail.plot?.orientation || 'Chính Đông'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Receivable Card */}
                  {contractDetail.receivable && (
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '10px' }}>
                        Nghĩa Vụ Tài Chính &amp; Công Nợ (Receivable)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Số tiền phải thu</div>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(contractDetail.receivable.final_payable_amount)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Đã thanh toán</div>
                          <div style={{ fontWeight: 600, color: '#16A34A' }}>{formatCurrency(contractDetail.receivable.total_paid_amount)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Trạng thái nợ</div>
                          <div style={{ fontWeight: 600 }}>{contractDetail.receivable.status}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Hạn chót thanh toán</div>
                          <div style={{ fontWeight: 600 }}>{contractDetail.receivable.due_date}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline & Metadata */}
                  <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                    <div>Ngày lập: {new Date(contractDetail.created_at).toLocaleString('vi-VN')}</div>
                    {contractDetail.signed_at && <div>Ngày ký thực tế: {contractDetail.signed_at}</div>}
                    {contractDetail.activated_at && (
                      <div>
                        Ngày kích hoạt: {new Date(contractDetail.activated_at).toLocaleString('vi-VN')} (Bởi: {contractDetail.activator_name || 'Hệ thống'})
                      </div>
                    )}
                    {contractDetail.activation_notes && (
                      <div>Ghi chú kích hoạt: {contractDetail.activation_notes}</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => setSelectedContractId(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>

              {contractDetail && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Download PDF button */}
                  <button
                    onClick={() => handleDownloadPDF(contractDetail.contract_id, contractDetail.contract_code)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #0284C7',
                      backgroundColor: '#FFFFFF',
                      color: '#0284C7',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={15} />
                    <span>In Hợp Đồng (PDF)</span>
                  </button>

                  {/* Submit for signing (if DRAFT) */}
                  {contractDetail.status === 'DRAFT' && canManage && (
                    <button
                      onClick={() => handleSubmitForSigning(contractDetail.contract_id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#D97706',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Send size={15} />
                      <span>Chuyển Chờ Ký</span>
                    </button>
                  )}

                  {/* Activate Contract (if PENDING_SIGN or DRAFT) */}
                  {(contractDetail.status === 'PENDING_SIGN' || contractDetail.status === 'DRAFT') && canManage && (
                    <button
                      onClick={() => {
                        setActivateError(null);
                        setActivateScanFile(null);
                        setIsActivateModalOpen(true);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#16A34A',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Upload size={15} />
                      <span>Kích Hoạt (Kèm File Scan)</span>
                    </button>
                  )}

                  {/* Cancel Contract (if not ACTIVE/CANCELLED) */}
                  {['DRAFT', 'PENDING_SIGN'].includes(contractDetail.status) && canManage && (
                    <button
                      onClick={() => {
                        setCancelReason('');
                        setIsCancelModalOpen(true);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <XCircle size={15} />
                      <span>Hủy Dự Thảo</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Activate Contract Modal with File Upload */}
      {/* ========================================================================= */}
      {isActivateModalOpen && contractDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Kích Hoạt Hợp Đồng {contractDetail.contract_code}
              </h4>
              <button
                onClick={() => setIsActivateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {activateError && (
              <div
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  fontSize: '13px',
                  marginBottom: '14px',
                }}
              >
                {activateError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Đính kèm bản scan hợp đồng có chữ ký thân nhân (*)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setActivateScanFile(e.target.files[0]);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Hỗ trợ định dạng PDF, JPG, PNG. File sẽ được lưu trữ an toàn trên MinIO.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ngày ký hợp đồng trên văn bản giấy
                </label>
                <input
                  type="date"
                  value={activateSignedAt}
                  onChange={(e) => setActivateSignedAt(e.target.value)}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ghi chú kích hoạt &amp; biên nhận
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú xác thực chữ ký hoặc tình trạng giao dịch..."
                  value={activateNotes}
                  onChange={(e) => setActivateNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsActivateModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleActivateContract}
                disabled={activateSubmitting || !activateScanFile}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {activateSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={15} />}
                <span>Xác Nhận Kích Hoạt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Cancel Contract Modal */}
      {/* ========================================================================= */}
      {isCancelModalOpen && contractDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
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
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>
                Hủy Dự Thảo Hợp Đồng {contractDetail.contract_code}
              </h4>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px' }}>
              Thao tác này sẽ hủy bỏ hợp đồng và <strong>giải phóng ô mộ trở lại trạng thái Trống Chưa Bán (EMPTY_UNSOLD)</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Lý do hủy hợp đồng (*)
              </label>
              <textarea
                rows={3}
                placeholder="Nhập lý do khách hàng đổi ý hoặc hủy giao dịch..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleCancelContract}
                disabled={cancelSubmitting || !cancelReason.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cancelSubmitting ? 'Đang xử lý...' : 'Xác Nhận Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
