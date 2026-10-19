import { apiFetch } from '../../services/apiClient'
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Building,
  CheckCircle,
  Clock,
  Download,
  FileCheck,
  FilePlus,
  FileText,
  Flame,
  Layers,
  Lock,
  MapPin,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Upload,
  User,
  X,
  XCircle,
  Grid,
  ListFilter,
  Sparkles,
  UserPlus,
  Wrench,
  Trash2,
} from 'lucide-react';
import type {
  ContractAnnexResponse,
  ContractBriefResponse,
  ContractDetailResponse,
  ContractStatus,
  ContractType,
  BurialAnnexCreate,
  CareAnnexCreate,
  ConstructionAnnexCreate,
} from '../../types/contracts';
import type { CarePackage } from '../../types/catalog';
import type { Customer, DeceasedProfile } from '../../types/profiles';
import type { Plot, PlotSlot } from '../../types/plots';
import { Pagination, usePagination } from '../common/Pagination';
import { useNotificationModal } from '../../context/NotificationModalContext';
import { DocumentAttachmentList } from '../documents/DocumentAttachmentList';

interface ContractModuleProps {
  token: string | null;
  currentUserRoles?: string[];
}

const getCremationPackageName = (code?: string): string => {
  if (!code) return 'Gói Tiêu Chuẩn';
  switch (code) {
    case 'HOA_TANG_VIP':
      return 'Gói VIP Nghi Lễ';
    case 'HOA_TANG_CAO_CAP':
      return 'Gói Cao Cấp Trọn Gói';
    case 'HOA_TANG_TIEU_CHUAN':
      return 'Gói Tiêu Chuẩn';
    default:
      return code.replace(/_/g, ' ');
  }
};

export interface AnnexChecklistItem {
  task_name: string;
  specs: string;
  is_required: boolean;
}

export const DEFAULT_CONSTRUCTION_CHECKLIST: AnnexChecklistItem[] = [
  { task_name: 'Khảo sát hiện trường & định vị tim mốc khuôn viên ô mộ', specs: 'Đo đạc thực địa, cắm mốc ranh giới, kiểm tra tim mốc', is_required: true },
  { task_name: 'Đào móng & đổ bê tông lót nền móng', specs: 'Đào sâu 0.8m, bê tông mác M250 dày 100mm, cốt thép D10', is_required: true },
  { task_name: 'Xây tường gạch & đúc hố kim tĩnh (nếu có)', specs: 'Gạch đặc thẻ nung, vữa xi măng M100, chống thấm 2 lớp', is_required: true },
  { task_name: 'Ốp đá hoa cương granite & hoàn thiện chi tiết', specs: 'Đá granite tự nhiên Bình Định 20mm, mài bóng gương', is_required: true },
  { task_name: 'Lắp bia mộ men sứ, dọn dẹp & nghiệm thu bàn giao', specs: 'Bia đá men sứ chịu nhiệt, vệ sinh sạch cảnh quan', is_required: true },
];

const renderConstructionSpecs = (rawSpec?: string | null) => {
  if (!rawSpec) return null;
  try {
    const parsed = JSON.parse(rawSpec);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wrench size={13} style={{ color: 'var(--brand-primary)' }} />
            <span>Hạng mục &amp; Quy chuẩn kỹ thuật ({parsed.length} hạng mục):</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
            {parsed.map((item: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>#{idx + 1}</span>
                    <span>{item.task_name || item.name || 'Hạng mục thi công'}</span>
                  </div>
                  {item.specs && (
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', paddingLeft: '18px' }}>
                      <strong style={{ color: '#475569' }}>Quy cách:</strong> {item.specs}
                    </div>
                  )}
                </div>
                {item.is_required !== undefined && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: item.is_required ? '#FEE2E2' : '#F1F5F9',
                      color: item.is_required ? '#DC2626' : '#64748B',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.is_required ? 'Bắt buộc' : 'Tùy chọn'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
  } catch {
    // Fall back to plain text
  }

  const items = rawSpec.includes(';')
    ? rawSpec.split(';').map((s) => s.trim()).filter(Boolean)
    : [rawSpec];

  return (
    <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
      <strong>Hạng mục / Thông số kỹ thuật:</strong>
      {items.length > 1 ? (
        <ul style={{ margin: '4px 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ color: '#334155' }}>{item}</li>
          ))}
        </ul>
      ) : (
        <span style={{ marginLeft: '4px' }}>{rawSpec}</span>
      )}
    </div>
  );
};

export const ContractModule: React.FC<ContractModuleProps> = ({ token, currentUserRoles = [] }) => {
  const { confirm: modalConfirm, alert: modalAlert } = useNotificationModal();

  // Master List State
  const [contracts, setContracts] = useState<ContractBriefResponse[]>([]);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'code_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sortedContracts = [...contracts].sort((a, b) => {
    if (sortBy === 'date_desc') {
      const da = a.signed_at || a.created_at || '';
      const db = b.signed_at || b.created_at || '';
      return new Date(db).getTime() - new Date(da).getTime();
    }
    if (sortBy === 'date_asc') {
      const da = a.signed_at || a.created_at || '';
      const db = b.signed_at || b.created_at || '';
      return new Date(da).getTime() - new Date(db).getTime();
    }
    if (sortBy === 'code_asc') {
      return a.contract_code.localeCompare(b.contract_code);
    }
    if (sortBy === 'amount_desc') {
      return Number(b.total_amount) - Number(a.total_amount);
    }
    if (sortBy === 'amount_asc') {
      return Number(a.total_amount) - Number(b.total_amount);
    }
    return 0;
  });

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

  // Quick Customer Creation State
  const [isQuickCustModalOpen, setIsQuickCustModalOpen] = useState<boolean>(false);
  const [quickCustFullName, setQuickCustFullName] = useState<string>('');
  const [quickCustCitizenId, setQuickCustCitizenId] = useState<string>('');
  const [quickCustPhone, setQuickCustPhone] = useState<string>('');
  const [quickCustAddress, setQuickCustAddress] = useState<string>('');
  const [quickCustDob, setQuickCustDob] = useState<string>('');
  const [quickCustEmail, setQuickCustEmail] = useState<string>('');
  const [quickCustSubmitting, setQuickCustSubmitting] = useState<boolean>(false);
  const [quickCustError, setQuickCustError] = useState<string | null>(null);

  // Available plots state for wizard
  const [availablePlots, setAvailablePlots] = useState<Plot[]>([]);
  const [plotFilterZone, setPlotFilterZone] = useState<string>('');
  const [plotFilterRow, setPlotFilterRow] = useState<string>('');
  const [plotFilterType, setPlotFilterType] = useState<string>('');
  const [plotFilterOrientation, setPlotFilterOrientation] = useState<string>('');
  const [plotSearchCode, setPlotSearchCode] = useState<string>('');
  const [plotViewMode, setPlotViewMode] = useState<'cards' | 'matrix'>('cards');
  const [plotLoading, setPlotLoading] = useState<boolean>(false);
  const [plotError, setPlotError] = useState<string | null>(null);

  // Care Annex Modal State
  const [isCareAnnexModalOpen, setIsCareAnnexModalOpen] = useState<boolean>(false);
  const [carePackages, setCarePackages] = useState<CarePackage[]>([]);
  const [selectedCarePackageId, setSelectedCarePackageId] = useState<number | ''>('');
  const [careCycleMonths, setCareCycleMonths] = useState<number>(12);
  const [careRecurringPrice, setCareRecurringPrice] = useState<string>('0');
  const [careNotes, setCareNotes] = useState<string>('');
  const [careSubmitting, setCareSubmitting] = useState<boolean>(false);
  const [careError, setCareError] = useState<string | null>(null);

  // Construction Annex Modal State
  const [isConstructionAnnexModalOpen, setIsConstructionAnnexModalOpen] = useState<boolean>(false);
  const [constStartDate, setConstStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [constEndDate, setConstEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [checklistItems, setChecklistItems] = useState<AnnexChecklistItem[]>(DEFAULT_CONSTRUCTION_CHECKLIST);
  const [constAmount, setConstAmount] = useState<string>('0');
  const [constNotes, setConstNotes] = useState<string>('');
  const [constSubmitting, setConstSubmitting] = useState<boolean>(false);
  const [constError, setConstError] = useState<string | null>(null);

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

  // M08: Burial Annex Modal State
  const [isBurialAnnexModalOpen, setIsBurialAnnexModalOpen] = useState<boolean>(false);
  const [burialDeceasedSearch, setBurialDeceasedSearch] = useState<string>('');
  const [burialDeceasedList, setBurialDeceasedList] = useState<DeceasedProfile[]>([]);
  const [selectedDeceased, setSelectedDeceased] = useState<DeceasedProfile | null>(null);
  const [contractPlotSlots, setContractPlotSlots] = useState<PlotSlot[]>([]);
  const [burialSlotId, setBurialSlotId] = useState<number | ''>('');
  const [burialDate, setBurialDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [burialIsKimTinh, setBurialIsKimTinh] = useState<boolean>(false);
  const [burialAmount, setBurialAmount] = useState<string>('0');
  const [burialConstructionNotes, setBurialConstructionNotes] = useState<string>('');
  const [burialSubmitting, setBurialSubmitting] = useState<boolean>(false);
  const [burialError, setBurialError] = useState<string | null>(null);

  // M08: Annex Activation Modal State
  const [isAnnexActivateModalOpen, setIsAnnexActivateModalOpen] = useState<boolean>(false);
  const [activeAnnexToActivate, setActiveAnnexToActivate] = useState<ContractAnnexResponse | null>(null);
  const [annexScanFile, setAnnexScanFile] = useState<File | null>(null);
  const [annexSignedAt, setAnnexSignedAt] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [annexActivationNotes, setAnnexActivationNotes] = useState<string>('');
  const [annexActivateSubmitting, setAnnexActivateSubmitting] = useState<boolean>(false);
  const [annexActivateError, setAnnexActivateError] = useState<string | null>(null);

  // M08: Exhumation Contract Modal State
  const [isExhumationModalOpen, setIsExhumationModalOpen] = useState<boolean>(false);
  const [exhumationCustomer, setExhumationCustomer] = useState<Customer | null>(null);
  const [exhumationPlots, setExhumationPlots] = useState<Plot[]>([]);
  const [selectedExhumationPlot, setSelectedExhumationPlot] = useState<Plot | null>(null);
  const [exhumationSlotId, setExhumationSlotId] = useState<number | ''>('');
  const [exhumationDeceasedId, setExhumationDeceasedId] = useState<number | ''>('');
  const [exhumationDate, setExhumationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [exhumationFee, setExhumationFee] = useState<string>('15000000');
  const [exhumationReason, setExhumationReason] = useState<string>('');
  const [exhumationSubmitting, setExhumationSubmitting] = useState<boolean>(false);
  const [exhumationError, setExhumationError] = useState<string | null>(null);

  // M08: Transfer Contract Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferSeller, setTransferSeller] = useState<Customer | null>(null);
  const [transferBuyer, setTransferBuyer] = useState<Customer | null>(null);
  const [transferPlots, setTransferPlots] = useState<Plot[]>([]);
  const [selectedTransferPlot, setSelectedTransferPlot] = useState<Plot | null>(null);
  const [transferCommission, setTransferCommission] = useState<string>('5000000');
  const [transferReason, setTransferReason] = useState<string>('');
  const [transferSubmitting, setTransferSubmitting] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // M08: Cremation Contract Modal State
  const [isCremationModalOpen, setIsCremationModalOpen] = useState<boolean>(false);
  const [cremationCustomer, setCremationCustomer] = useState<Customer | null>(null);
  const [cremationDeceasedList, setCremationDeceasedList] = useState<DeceasedProfile[]>([]);
  const [selectedCremationDeceased, setSelectedCremationDeceased] = useState<DeceasedProfile | null>(null);
  const [cremationDate, setCremationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [cremationPackage, setCremationPackage] = useState<string>('HOA_TANG_TIEU_CHUAN');
  const [cremationUrnOption, setCremationUrnOption] = useState<string>('Lưu tháp cốt Địa Tạng');
  const [cremationFee, setCremationFee] = useState<string>('8500000');
  const [cremationNotes, setCremationNotes] = useState<string>('');
  const [cremationSubmitting, setCremationSubmitting] = useState<boolean>(false);
  const [cremationError, setCremationError] = useState<string | null>(null);

  const canManage = currentUserRoles.some((r) => ['ADMIN', 'MARKETING'].includes(r));

function parseApiError(errJson: unknown, fallback: string): string {
  if (!errJson || typeof errJson !== 'object') return fallback;
  const data = errJson as Record<string, unknown>;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d: any) => d.msg || (typeof d === 'string' ? d : JSON.stringify(d)))
      .join(', ');
  }
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

  // ==========================================
  // API Fetch Functions
  // ==========================================
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/v1/contracts?limit=300';
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (typeFilter) url += `&contract_type=${encodeURIComponent(typeFilter)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await apiFetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(parseApiError(errJson, `Lỗi tải danh sách hợp đồng (${res.status})`));
      }
      const data = await res.json();
      setContracts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định khi tải hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const fetchContractDetail = async (contractId: number) => {
    setSelectedContractId(contractId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiFetch(`/api/v1/contracts/${contractId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(parseApiError(errJson, `Lỗi xem chi tiết (${res.status})`));
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
      const res = await apiFetch(`/api/v1/profiles/customers?search=${encodeURIComponent(keyword)}&limit=10`, {
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
    setPlotError(null);
    try {
      const res = await apiFetch('/api/v1/plots?status=EMPTY_UNSOLD&limit=2500', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAvailablePlots(Array.isArray(data) ? data : []);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = parseApiError(errJson, `Không thể tải danh sách ô mộ (${res.status})`);
        setPlotError(errMsg);
        console.error('Không thể tải danh sách ô mộ:', errJson);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi kết nối khi nạp danh sách ô mộ';
      setPlotError(errMsg);
      console.error('Lỗi kết nối khi nạp danh sách ô mộ:', err);
    } finally {
      setPlotLoading(false);
    }
  };

  useEffect(() => {
    if (isWizardOpen && wizardStep === 2 && availablePlots.length === 0) {
      fetchAvailablePlots();
    }
  }, [isWizardOpen, wizardStep, availablePlots.length]);

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

      const res = await apiFetch('/api/v1/contracts/land-purchase', {
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
    const ok = await modalConfirm({
      title: 'Xác Nhận Chuyển Ký Kết',
      message: 'Chuyển hợp đồng này sang trạng thái Chờ Ký Kết để khách hàng duyệt ký?',
      confirmText: 'Chuyển Chờ Ký',
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/v1/contracts/${contractId}/submit-signing`, {
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
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi không xác định', type: 'error' });
    }
  };

  // Action: Download PDF
  const handleDownloadPDF = async (contractId: number, contractCode: string) => {
    try {
      const res = await apiFetch(`/api/v1/contracts/${contractId}/pdf`, {
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
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi khi tải file PDF', type: 'error' });
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
      const upRes = await apiFetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!upRes.ok) {
        const upErr = await upRes.json().catch(() => ({}));
        throw new Error(upErr.detail || 'Tải tệp scan lên máy chủ thất bại');
      }
      const upData = await upRes.json();
      const fileId = upData.file_id;

      // 2. Call activate endpoint
      const actRes = await apiFetch(`/api/v1/contracts/${contractDetail.contract_id}/activate`, {
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
      const res = await apiFetch(`/api/v1/contracts/${contractDetail.contract_id}/cancel`, {
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
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi khi hủy hợp đồng', type: 'error' });
    } finally {
      setCancelSubmitting(false);
    }
  };

  // ==========================================
  // M08: Burial Annex Actions
  // ==========================================
  const searchBurialDeceased = async (keyword: string) => {
    try {
      const res = await apiFetch(`/api/v1/profiles/deceased?search=${encodeURIComponent(keyword)}&limit=15`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setBurialDeceasedList(data);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenBurialAnnex = async () => {
    if (!contractDetail) return;
    const plotId =
      contractDetail.plot?.plot_id ||
      contractDetail.land_purchase?.plot_id ||
      contractDetail.transfer?.plot_id;
    if (!plotId) {
      await modalAlert({ message: 'Không tìm thấy thông tin ô mộ của hợp đồng', type: 'warning' });
      return;
    }
    setBurialSlotId('');
    setSelectedDeceased(null);
    setBurialDeceasedSearch('');
    setBurialDate(new Date().toISOString().split('T')[0]);
    setBurialIsKimTinh(false);
    setBurialAmount('0');
    setBurialConstructionNotes('');
    setBurialError(null);

    try {
      const res = await apiFetch(`/api/v1/plots/${plotId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const plotData = await res.json();
        setContractPlotSlots(plotData.slots || []);
        if (plotData.slots && plotData.slots.length > 0) {
          const emptySlot = plotData.slots.find((s: PlotSlot) => s.status === 'EMPTY');
          if (emptySlot) setBurialSlotId(emptySlot.slot_id);
          else setBurialSlotId(plotData.slots[0].slot_id);
        }
      }
    } catch {
      // ignore
    }

    searchBurialDeceased('');
    setIsBurialAnnexModalOpen(true);
  };

  const handleCreateBurialAnnex = async () => {
    if (!contractDetail || !selectedDeceased || !burialSlotId) {
      setBurialError('Vui lòng chọn người quá cố và huyệt an táng');
      return;
    }
    setBurialSubmitting(true);
    setBurialError(null);
    try {
      const payload: BurialAnnexCreate = {
        deceased_id: selectedDeceased.deceased_id,
        slot_id: Number(burialSlotId),
        burial_date: burialDate,
        is_kim_tinh: burialIsKimTinh,
        additional_amount: Number(burialAmount) || 0,
        construction_notes: burialConstructionNotes.trim() || undefined,
      };
      const res = await apiFetch(`/api/v1/contracts/${contractDetail.contract_id}/annexes/burial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể tạo phụ lục an táng');
      }
      setIsBurialAnnexModalOpen(false);
      await fetchContracts();
      fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      setBurialError(err instanceof Error ? err.message : 'Lỗi khi tạo phụ lục an táng');
    } finally {
      setBurialSubmitting(false);
    }
  };

  const handleQuickCreateCustomer = async () => {
    if (!quickCustFullName.trim() || !quickCustCitizenId.trim() || !quickCustPhone.trim() || !quickCustAddress.trim()) {
      setQuickCustError('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }
    setQuickCustSubmitting(true);
    setQuickCustError(null);
    try {
      const res = await apiFetch('/api/v1/profiles/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: quickCustFullName.trim(),
          citizen_id: quickCustCitizenId.trim(),
          phone_number: quickCustPhone.trim(),
          address: quickCustAddress.trim(),
          date_of_birth: quickCustDob || undefined,
          email: quickCustEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Thêm khách hàng thất bại');
      }
      const newCust: Customer = await res.json();
      setWizardCustomer(newCust);
      setCustResults((prev) => [newCust, ...prev]);
      setIsQuickCustModalOpen(false);
      setQuickCustFullName('');
      setQuickCustCitizenId('');
      setQuickCustPhone('');
      setQuickCustAddress('');
      setQuickCustDob('');
      setQuickCustEmail('');
      await modalAlert({
        message: `Đã tạo khách hàng "${newCust.full_name}" (${newCust.customer_code}) thành công và tự động chọn cho hợp đồng!`,
        type: 'success',
      });
    } catch (err: unknown) {
      setQuickCustError(err instanceof Error ? err.message : 'Lỗi khi tạo hồ sơ khách hàng');
    } finally {
      setQuickCustSubmitting(false);
    }
  };

  const handleOpenCareAnnex = async () => {
    if (!contractDetail) return;
    setCareError(null);
    setCareNotes('');
    setCareCycleMonths(12);
    setCareRecurringPrice('0');
    setSelectedCarePackageId('');
    try {
      const res = await apiFetch('/api/v1/catalog/care-packages?active_only=true', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const pkgs: CarePackage[] = await res.json();
        setCarePackages(pkgs);
        if (pkgs.length > 0) {
          setSelectedCarePackageId(pkgs[0].package_id);
          setCareRecurringPrice(String(pkgs[0].unit_price));
        }
      }
    } catch {
      // ignore
    }
    setIsCareAnnexModalOpen(true);
  };

  const handleCreateCareAnnex = async () => {
    if (!contractDetail || !selectedCarePackageId) {
      setCareError('Vui lòng chọn gói dịch vụ chăm sóc');
      return;
    }
    setCareSubmitting(true);
    setCareError(null);
    try {
      const payload: CareAnnexCreate = {
        package_id: Number(selectedCarePackageId),
        cycle_months: careCycleMonths,
        recurring_price: Number(careRecurringPrice) || 0,
        notes: careNotes.trim() || undefined,
      };
      const res = await apiFetch(`/api/v1/contracts/${contractDetail.contract_id}/annexes/care`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Tạo phụ lục chăm sóc thất bại');
      }
      setIsCareAnnexModalOpen(false);
      await modalAlert({ message: 'Lập phụ lục chăm sóc thành công!', type: 'success' });
      await fetchContracts();
      if (contractDetail) fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      setCareError(err instanceof Error ? err.message : 'Lỗi khi tạo phụ lục chăm sóc');
    } finally {
      setCareSubmitting(false);
    }
  };

  const handleOpenConstructionAnnex = () => {
    if (!contractDetail) return;
    setConstError(null);
    setConstNotes('');
    setChecklistItems(DEFAULT_CONSTRUCTION_CHECKLIST.map((it) => ({ ...it })));
    setConstAmount('0');
    setConstStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setConstEndDate(d.toISOString().split('T')[0]);
    setIsConstructionAnnexModalOpen(true);
  };

  const handleUpdateChecklistItem = (index: number, field: keyof AnnexChecklistItem, val: string | boolean) => {
    setChecklistItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleAddChecklistItem = () => {
    setChecklistItems((prev) => [...prev, { task_name: '', specs: '', is_required: true }]);
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleResetDefaultChecklist = () => {
    setChecklistItems(DEFAULT_CONSTRUCTION_CHECKLIST.map((it) => ({ ...it })));
  };

  const handleCreateConstructionAnnex = async () => {
    if (!contractDetail || !constStartDate || !constEndDate) {
      setConstError('Vui lòng nhập ngày bắt đầu và kết thúc thi công');
      return;
    }
    const validItems = checklistItems.filter((it) => it.task_name.trim());
    if (validItems.length === 0) {
      setConstError('Vui lòng thiết lập ít nhất 1 hạng mục thi công trong checklist quy cách kỹ thuật');
      return;
    }
    setConstSubmitting(true);
    setConstError(null);
    try {
      const payload: ConstructionAnnexCreate = {
        estimated_start_date: constStartDate,
        estimated_end_date: constEndDate,
        checklist_specifications: JSON.stringify(validItems),
        additional_amount: Number(constAmount) || 0,
        notes: constNotes.trim() || undefined,
      };
      const res = await apiFetch(`/api/v1/contracts/${contractDetail.contract_id}/annexes/construction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Tạo phụ lục thi công thất bại');
      }
      setIsConstructionAnnexModalOpen(false);
      await modalAlert({ message: 'Lập phụ lục thi công xây dựng thành công!', type: 'success' });
      await fetchContracts();
      if (contractDetail) fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      setConstError(err instanceof Error ? err.message : 'Lỗi khi tạo phụ lục thi công');
    } finally {
      setConstSubmitting(false);
    }
  };

  const handleSubmitAnnexSigning = async (annexId: number) => {
    const ok = await modalConfirm({
      title: 'Xác Nhận Ký Phụ Lục',
      message: 'Chuyển phụ lục này sang trạng thái Chờ Ký Kết?',
      confirmText: 'Chuyển Chờ Ký',
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/v1/contracts/annexes/${annexId}/submit-signing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes: 'Đã hoàn thiện dự thảo phụ lục và gửi thân nhân ký duyệt.' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Thao tác thất bại');
      }
      if (contractDetail) fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      await modalAlert({ message: err instanceof Error ? err.message : 'Lỗi không xác định', type: 'error' });
    }
  };

  const handleOpenActivateAnnex = (annex: ContractAnnexResponse) => {
    setActiveAnnexToActivate(annex);
    setAnnexScanFile(null);
    setAnnexSignedAt(new Date().toISOString().split('T')[0]);
    setAnnexActivationNotes('');
    setAnnexActivateError(null);
    setIsAnnexActivateModalOpen(true);
  };

  const handleActivateAnnex = async () => {
    if (!activeAnnexToActivate || !annexScanFile) {
      setAnnexActivateError('Vui lòng đính kèm file scan phụ lục có chữ ký.');
      return;
    }
    setAnnexActivateSubmitting(true);
    setAnnexActivateError(null);
    try {
      const formData = new FormData();
      formData.append('file', annexScanFile);
      const upRes = await apiFetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!upRes.ok) {
        const upErr = await upRes.json().catch(() => ({}));
        throw new Error(upErr.detail || 'Tải tệp scan lên máy chủ thất bại');
      }
      const upData = await upRes.json();
      const fileId = upData.file_id;

      const actRes = await apiFetch(`/api/v1/contracts/annexes/${activeAnnexToActivate.annex_id}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          signed_scan_file_id: fileId,
          signed_at: annexSignedAt || undefined,
          activation_notes: annexActivationNotes.trim() || undefined,
        }),
      });
      if (!actRes.ok) {
        const actErr = await actRes.json().catch(() => ({}));
        throw new Error(actErr.detail || 'Kích hoạt phụ lục thất bại');
      }
      setIsAnnexActivateModalOpen(false);
      await fetchContracts();
      if (contractDetail) fetchContractDetail(contractDetail.contract_id);
    } catch (err: unknown) {
      setAnnexActivateError(err instanceof Error ? err.message : 'Lỗi khi kích hoạt phụ lục');
    } finally {
      setAnnexActivateSubmitting(false);
    }
  };

  // ==========================================
  // M08: Exhumation Contract Actions
  // ==========================================
  const handleOpenExhumationModal = () => {
    setExhumationCustomer(null);
    setExhumationPlots([]);
    setSelectedExhumationPlot(null);
    setExhumationSlotId('');
    setExhumationDeceasedId('');
    setExhumationDate(new Date().toISOString().split('T')[0]);
    setExhumationFee('15000000');
    setExhumationReason('');
    setExhumationError(null);
    setIsExhumationModalOpen(true);
    searchCustomers('');
  };

  const handleSelectExhumationCustomer = async (cust: Customer) => {
    setExhumationCustomer(cust);
    setSelectedExhumationPlot(null);
    setExhumationSlotId('');
    setExhumationDeceasedId('');
    try {
      const res = await apiFetch(`/api/v1/plots?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const plotsData: Plot[] = await res.json();
        const owned = plotsData.filter((p) => p.owner_id === cust.customer_id && !p.is_kim_tinh);
        setExhumationPlots(owned);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectExhumationPlot = async (plot: Plot) => {
    setSelectedExhumationPlot(plot);
    setExhumationSlotId('');
    setExhumationDeceasedId('');
    try {
      const res = await apiFetch(`/api/v1/plots/${plot.plot_id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const fullPlot = await res.json();
        const occupiedSlot = (fullPlot.slots || []).find((s: PlotSlot) => s.status === 'OCCUPIED');
        if (occupiedSlot) {
          setExhumationSlotId(occupiedSlot.slot_id);
          if (occupiedSlot.current_deceased_id) {
            setExhumationDeceasedId(occupiedSlot.current_deceased_id);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCreateExhumationContract = async () => {
    if (!exhumationCustomer || !selectedExhumationPlot || !exhumationSlotId || !exhumationDeceasedId) {
      setExhumationError('Vui lòng chọn khách hàng chủ mộ, ô mộ và huyệt có hài cốt');
      return;
    }
    setExhumationSubmitting(true);
    setExhumationError(null);
    try {
      const res = await apiFetch('/api/v1/contracts/exhumation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customer_id: exhumationCustomer.customer_id,
          plot_id: selectedExhumationPlot.plot_id,
          slot_id: Number(exhumationSlotId),
          current_deceased_id: Number(exhumationDeceasedId),
          exhumation_date: exhumationDate,
          exhumation_fee: Number(exhumationFee) || 0,
          reason: exhumationReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể lập hợp đồng cải táng');
      }
      const data = await res.json();
      setIsExhumationModalOpen(false);
      await fetchContracts();
      fetchContractDetail(data.contract_id);
    } catch (err: unknown) {
      setExhumationError(err instanceof Error ? err.message : 'Lỗi khi lập hợp đồng cải táng');
    } finally {
      setExhumationSubmitting(false);
    }
  };

  // ==========================================
  // M08: Transfer Contract Actions
  // ==========================================
  const handleOpenTransferModal = () => {
    setTransferSeller(null);
    setTransferBuyer(null);
    setTransferPlots([]);
    setSelectedTransferPlot(null);
    setTransferCommission('5000000');
    setTransferReason('');
    setTransferError(null);
    setIsTransferModalOpen(true);
    searchCustomers('');
  };

  const handleSelectTransferSeller = async (seller: Customer) => {
    setTransferSeller(seller);
    setSelectedTransferPlot(null);
    try {
      const res = await apiFetch(`/api/v1/plots?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const plotsData: Plot[] = await res.json();
        const owned = plotsData.filter((p) => p.owner_id === seller.customer_id && p.status === 'OWNED_EMPTY' && !p.is_kim_tinh);
        setTransferPlots(owned);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateTransferContract = async () => {
    if (!transferSeller || !transferBuyer || !selectedTransferPlot) {
      setTransferError('Vui lòng chọn bên chuyển nhượng, bên nhận và ô mộ');
      return;
    }
    if (transferSeller.customer_id === transferBuyer.customer_id) {
      setTransferError('Bên nhận chuyển nhượng phải khác bên chuyển nhượng');
      return;
    }
    setTransferSubmitting(true);
    setTransferError(null);
    try {
      const res = await apiFetch('/api/v1/contracts/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          seller_id: transferSeller.customer_id,
          buyer_id: transferBuyer.customer_id,
          plot_id: selectedTransferPlot.plot_id,
          commission_fee: Number(transferCommission) || 0,
          transfer_reason: transferReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể lập hợp đồng chuyển nhượng');
      }
      const data = await res.json();
      setIsTransferModalOpen(false);
      await fetchContracts();
      fetchContractDetail(data.contract_id);
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Lỗi khi lập hợp đồng chuyển nhượng');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // ==========================================
  // M08: Cremation Contract Actions
  // ==========================================
  const searchCremationDeceased = async (keyword: string) => {
    try {
      const res = await apiFetch(`/api/v1/profiles/deceased?search=${encodeURIComponent(keyword)}&limit=15`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCremationDeceasedList(data);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenCremationModal = () => {
    setCremationCustomer(null);
    setSelectedCremationDeceased(null);
    setCremationDate(new Date().toISOString().split('T')[0]);
    setCremationPackage('HOA_TANG_TIEU_CHUAN');
    setCremationUrnOption('Lưu tháp cốt Địa Tạng');
    setCremationFee('8500000');
    setCremationNotes('');
    setCremationError(null);
    setIsCremationModalOpen(true);
    searchCustomers('');
    searchCremationDeceased('');
  };

  const handleCreateCremationContract = async () => {
    if (!cremationCustomer || !selectedCremationDeceased) {
      setCremationError('Vui lòng chọn khách hàng đăng ký và người quá cố');
      return;
    }
    setCremationSubmitting(true);
    setCremationError(null);
    try {
      const res = await apiFetch('/api/v1/contracts/cremation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customer_id: cremationCustomer.customer_id,
          deceased_id: selectedCremationDeceased.deceased_id,
          cremation_date: cremationDate,
          package_service_code: cremationPackage,
          urn_storage_option: cremationUrnOption.trim() || undefined,
          service_fee: Number(cremationFee) || 0,
          notes: cremationNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể lập hợp đồng hỏa táng');
      }
      const data = await res.json();
      setIsCremationModalOpen(false);
      await fetchContracts();
      fetchContractDetail(data.contract_id);
    } catch (err: unknown) {
      setCremationError(err instanceof Error ? err.message : 'Lỗi khi lập hợp đồng hỏa táng');
    } finally {
      setCremationSubmitting(false);
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

  const getContractTypeBadge = (type: ContractType | string) => {
    switch (type) {
      case 'LAND_PURCHASE':
        return { label: 'Mua Đất', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' };
      case 'EXHUMATION':
        return { label: 'Cải Táng', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' };
      case 'TRANSFER':
        return { label: 'Chuyển Nhượng', bg: '#EEF2FF', color: '#4338CA', border: '#C7D2FE' };
      case 'CREMATION':
        return { label: 'Hỏa Táng', bg: '#FFF7ED', color: '#C2410C', border: '#FFEDD5' };
      case 'SERVICE':
      default:
        return { label: 'Dịch Vụ', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
    }
  };

  const getAnnexStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Dự Thảo', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
      case 'PENDING_SIGN':
        return { label: 'Chờ Ký', bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' };
      case 'ACTIVE':
        return { label: 'Hiệu Lực', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
      case 'CANCELLED':
        return { label: 'Đã Hủy', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' };
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

  // Pagination for Contract Table
  const {
    currentPage: contractPage,
    pageSize: contractPageSize,
    totalPages: contractTotalPages,
    totalItems: contractTotalItems,
    paginatedItems: paginatedContracts,
    setCurrentPage: setContractPage,
    setPageSize: setContractPageSize,
    startIndex: contractStartIndex,
    endIndex: contractEndIndex,
  } = usePagination(sortedContracts, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
          gap: '10px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '12px 14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} color="#0284C7" />
            <span>Tổng Hợp Đồng</span>
          </div>
          <div style={{ fontSize: 'clamp(18px, 4.5vw, 24px)', fontWeight: 700, color: '#0F172A', marginTop: '6px', wordBreak: 'break-word' }}>{totalCount}</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '12px 14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={15} color="#16A34A" />
            <span>Đang Hiệu Lực</span>
          </div>
          <div style={{ fontSize: 'clamp(18px, 4.5vw, 24px)', fontWeight: 700, color: '#16A34A', marginTop: '6px', wordBreak: 'break-word' }}>{activeCount}</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '12px 14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={15} color="#D97706" />
            <span>Chờ Ký / Dự Thảo</span>
          </div>
          <div style={{ fontSize: 'clamp(18px, 4.5vw, 24px)', fontWeight: 700, color: '#D97706', marginTop: '6px', wordBreak: 'break-word' }}>
            {pendingCount + draftCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '12px 14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={15} color="#4F46E5" />
            <span>Doanh Thu Hiệu Lực</span>
          </div>
          <div
            style={{
              fontSize: 'clamp(13px, 3.2vw, 18px)',
              fontWeight: 700,
              color: '#4F46E5',
              marginTop: '6px',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              lineHeight: 1.25,
            }}
          >
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
            <option value="DRAFT">Dự thảo</option>
            <option value="PENDING_SIGN">Chờ ký kết</option>
            <option value="ACTIVE">Đang hiệu lực</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="">Tất cả loại hợp đồng</option>
            <option value="LAND_PURCHASE">Mua Đất</option>
            <option value="EXHUMATION">Cải Táng</option>
            <option value="TRANSFER">Chuyển Nhượng</option>
            <option value="CREMATION">Hỏa Táng</option>
          </select>

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="date_desc">Ngày: Mới nhất</option>
            <option value="date_asc">Ngày: Cũ nhất</option>
            <option value="code_asc">Mã hợp đồng (A-Z)</option>
            <option value="amount_desc">Giá trị: Cao xuống thấp</option>
            <option value="amount_asc">Giá trị: Thấp lên cao</option>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenWizard}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <FilePlus size={15} />
              <span>+ Mua Đất</span>
            </button>
            <button
              onClick={handleOpenExhumationModal}
              style={{
                backgroundColor: '#B45309',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <ArrowRightLeft size={15} />
              <span>+ Cải Táng</span>
            </button>
            <button
              onClick={handleOpenTransferModal}
              style={{
                backgroundColor: '#4338CA',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <ArrowRightLeft size={15} />
              <span>+ Chuyển Nhượng</span>
            </button>
            <button
              onClick={handleOpenCremationModal}
              style={{
                backgroundColor: '#C2410C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <Flame size={15} />
              <span>+ Hỏa Táng</span>
            </button>
          </div>
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
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Contracts Dual-View (Mobile Cards / Desktop Table) */}
          {/* Mobile Card View (< 1024px) */}
          <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {paginatedContracts.map((c) => {
              const badge = getStatusBadge(c.status);
              const tBadge = getContractTypeBadge(c.contract_type);
              return (
                <div
                  key={c.contract_id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: '14px' }}>
                        {c.contract_code}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: tBadge.bg,
                          color: tBadge.color,
                          border: `1px solid ${tBadge.border}`,
                          marginTop: '4px',
                        }}
                      >
                        {tBadge.label}
                      </span>
                    </div>
                    <span
                      style={{
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
                  </div>

                  <div style={{ fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} color="#64748B" />
                    <strong>{c.customer_name}</strong>
                    {c.customer_phone && <span style={{ color: '#64748B', fontSize: '12px' }}>({c.customer_phone})</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B' }}>
                    <span>Ô mộ: <strong style={{ color: '#334155' }}>{c.plot_code || 'Chưa gán'}</strong></span>
                    <span>{new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {formatCurrency(c.total_amount)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => fetchContractDetail(c.contract_id)}
                        className="touch-target"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#F8FAFC',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(c.contract_id, c.contract_code)}
                        title="Tải bản in PDF"
                        className="touch-target"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#0284C7',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 1024px) */}
          <div className="desktop-only table-scroll-container">
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
                {paginatedContracts.map((c) => {
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
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <div style={{ color: 'var(--brand-primary)', marginBottom: '4px' }}>{c.contract_code}</div>
                        {(() => {
                          const tBadge = getContractTypeBadge(c.contract_type);
                          return (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: tBadge.bg,
                                color: tBadge.color,
                                border: `1px solid ${tBadge.border}`,
                              }}
                            >
                              {tBadge.label}
                            </span>
                          );
                        })()}
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
          <Pagination
            currentPage={contractPage}
            totalPages={contractTotalPages}
            totalItems={contractTotalItems}
            pageSize={contractPageSize}
            onPageChange={setContractPage}
            onPageSizeChange={setContractPageSize}
            startIndex={contractStartIndex}
            endIndex={contractEndIndex}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4-Step Land Purchase Wizard Modal */}
      {/* ========================================================================= */}
      {isWizardOpen && (
        <div
          className="responsive-modal-overlay"
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
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '960px',
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                      1. Tra cứu hoặc chọn khách hàng đứng tên hợp đồng:
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCustError(null);
                        setIsQuickCustModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--brand-primary)',
                        backgroundColor: '#F0FDF4',
                        color: 'var(--brand-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <UserPlus size={14} />
                      <span>+ Thêm Khách Hàng Nhanh</span>
                    </button>
                  </div>

                  {/* Inline Quick Add Customer Modal / Card */}
                  {isQuickCustModalOpen && (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        border: '1.5px dashed var(--brand-primary)',
                        marginBottom: '16px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserPlus size={16} />
                          <span>Hồ Sơ Khách Hàng Mới Nhanh</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsQuickCustModalOpen(false)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {quickCustError && (
                        <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: '12px', marginBottom: '10px' }}>
                          {quickCustError}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Họ và Tên (*)
                          </label>
                          <input
                            type="text"
                            placeholder="Ví dụ: Nguyễn Văn An"
                            value={quickCustFullName}
                            onChange={(e) => setQuickCustFullName(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Số CCCD / CMND (*)
                          </label>
                          <input
                            type="text"
                            placeholder="12 chữ số CCCD"
                            value={quickCustCitizenId}
                            onChange={(e) => setQuickCustCitizenId(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Số Điện Thoại (*)
                          </label>
                          <input
                            type="text"
                            placeholder="0912xxxxxx"
                            value={quickCustPhone}
                            onChange={(e) => setQuickCustPhone(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Ngày Sinh (tuỳ chọn)
                          </label>
                          <input
                            type="date"
                            value={quickCustDob}
                            onChange={(e) => setQuickCustDob(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Địa Chỉ Thường Trú (*)
                          </label>
                          <input
                            type="text"
                            placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                            value={quickCustAddress}
                            onChange={(e) => setQuickCustAddress(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Email (tuỳ chọn)
                          </label>
                          <input
                            type="email"
                            placeholder="khachhang@email.com"
                            value={quickCustEmail}
                            onChange={(e) => setQuickCustEmail(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setIsQuickCustModalOpen(false)}
                          style={{ padding: '6px 14px', borderRadius: '5px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Hủy Bỏ
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickCreateCustomer}
                          disabled={quickCustSubmitting}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '5px',
                            border: 'none',
                            backgroundColor: 'var(--brand-primary)',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {quickCustSubmitting ? 'Đang Tạo...' : 'Tạo & Chọn Khách Hàng Ngay'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                      <input
                        type="text"
                        placeholder="Tìm theo họ tên, CCCD hoặc số điện thoại..."
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
                      <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                        <div style={{ color: '#94A3B8', fontSize: '13px', marginBottom: '8px' }}>
                          Không tìm thấy khách hàng phù hợp.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickCustError(null);
                            setIsQuickCustModalOpen(true);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid var(--brand-primary)',
                            backgroundColor: '#F0FDF4',
                            color: 'var(--brand-primary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          + Thêm Khách Hàng Mới Ngay
                        </button>
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
                              CCCD: {c.citizen_id} • SĐT: {c.phone_number} • {c.address}
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

              {/* STEP 2: ADVANCED CEMETERY PLOT SELECTOR & MANAGER */}
              {wizardStep === 2 && (() => {
                const filteredPlots = availablePlots.filter((p) => {
                  if (plotFilterZone && p.zone_code !== plotFilterZone) return false;
                  if (plotFilterRow && p.row_code !== plotFilterRow) return false;
                  if (plotFilterType && p.type_name !== plotFilterType) return false;
                  if (plotFilterOrientation && p.orientation !== plotFilterOrientation) return false;
                  if (plotSearchCode && !p.plot_code.toLowerCase().includes(plotSearchCode.toLowerCase())) return false;
                  return true;
                });

                const uniqueZones = Array.from(new Set(availablePlots.map((p) => p.zone_code).filter((z): z is string => Boolean(z)))).sort();
                const uniqueRows = Array.from(
                  new Set(
                    availablePlots
                      .filter((p) => !plotFilterZone || p.zone_code === plotFilterZone)
                      .map((p) => p.row_code)
                      .filter((r): r is string => Boolean(r))
                  )
                ).sort();
                const uniqueTypes = Array.from(new Set(availablePlots.map((p) => p.type_name).filter((t): t is string => Boolean(t)))).sort();
                const uniqueOrientations = Array.from(new Set(availablePlots.map((p) => p.orientation).filter((o): o is string => Boolean(o)))).sort();

                // Group by row for matrix view
                const rowGroups: { [rowCode: string]: Plot[] } = {};
                filteredPlots.forEach((p) => {
                  const rc = p.row_code || 'Chưa phân hàng';
                  if (!rowGroups[rc]) rowGroups[rc] = [];
                  rowGroups[rc].push(p);
                });

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                        2. Trình Quản Lý &amp; Chọn Ô Mộ Khả Dụng (Chống Xung Đột Tức Thời):
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setPlotViewMode('cards')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid #CBD5E1',
                            backgroundColor: plotViewMode === 'cards' ? 'var(--brand-primary)' : '#FFFFFF',
                            color: plotViewMode === 'cards' ? '#FFFFFF' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ListFilter size={14} />
                          <span>Thẻ Chi Tiết</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlotViewMode('matrix')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid #CBD5E1',
                            backgroundColor: plotViewMode === 'matrix' ? 'var(--brand-primary)' : '#FFFFFF',
                            color: plotViewMode === 'matrix' ? '#FFFFFF' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Grid size={14} />
                          <span>Sơ Đồ Dãy Mộ</span>
                        </button>
                      </div>
                    </div>

                    {/* Selected Plot Banner */}
                    {wizardPlot && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          border: '1.5px solid #3B82F6',
                          marginBottom: '14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                              Ô ĐÃ CHỌN: {wizardPlot.plot_code}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1E3A8A' }}>
                              {wizardPlot.type_name}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#1D4ED8', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span><strong>Khu:</strong> {wizardPlot.zone_name}</span>
                            <span><strong>Hàng:</strong> {wizardPlot.row_code}</span>
                            <span><strong>Quy cách:</strong> {wizardPlot.plot_length || 2.5}m × {wizardPlot.plot_width || 1.2}m</span>
                            <span><strong>Số huyệt:</strong> {wizardPlot.default_slots || 1}</span>
                            <span><strong>Hướng phong thủy:</strong> {wizardPlot.orientation || 'Tự do'}</span>
                          </div>
                        </div>
                        <CheckCircle size={24} color="#2563EB" />
                      </div>
                    )}

                    {/* Advanced Filter Toolbar */}
                    <div
                      style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {/* Search code */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>
                            Mã ô mộ
                          </label>
                          <input
                            type="text"
                            placeholder="VD: A-H04, M07..."
                            value={plotSearchCode}
                            onChange={(e) => setPlotSearchCode(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                          />
                        </div>

                        {/* Zone Filter */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>
                            Khu vực
                          </label>
                          <select
                            value={plotFilterZone}
                            onChange={(e) => {
                              const newZone = e.target.value;
                              setPlotFilterZone(newZone);
                              if (newZone && plotFilterRow) {
                                const validRows = new Set(
                                  availablePlots.filter((p) => p.zone_code === newZone).map((p) => p.row_code)
                                );
                                if (!validRows.has(plotFilterRow)) {
                                  setPlotFilterRow('');
                                }
                              }
                            }}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                          >
                            <option value="">Tất cả các khu</option>
                            {uniqueZones.map((zc) => (
                              <option key={zc} value={zc}>Khu {zc}</option>
                            ))}
                          </select>
                        </div>

                        {/* Row Filter (Cascading) */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>
                            Hàng / Dãy {plotFilterZone ? `(Khu ${plotFilterZone})` : ''}
                          </label>
                          <select
                            value={plotFilterRow}
                            onChange={(e) => setPlotFilterRow(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                          >
                            <option value="">{plotFilterZone ? `-- Tất cả hàng trong Khu ${plotFilterZone} --` : 'Tất cả hàng'}</option>
                            {uniqueRows.map((rc) => (
                              <option key={rc} value={rc}>Dãy {rc}</option>
                            ))}
                          </select>
                        </div>

                        {/* Type Filter */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>
                            Loại mộ
                          </label>
                          <select
                            value={plotFilterType}
                            onChange={(e) => setPlotFilterType(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                          >
                            <option value="">Tất cả loại mộ</option>
                            {uniqueTypes.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        {/* Orientation Filter */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>
                            Hướng phong thủy
                          </label>
                          <select
                            value={plotFilterOrientation}
                            onChange={(e) => setPlotFilterOrientation(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                          >
                            <option value="">Tất cả hướng</option>
                            {uniqueOrientations.map((o) => (
                              <option key={o} value={o}>Hướng {o}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #E2E8F0', fontSize: '12px', color: '#64748B' }}>
                        <div>
                          Tìm thấy <strong>{filteredPlots.length}</strong> / {availablePlots.length} ô mộ trống khả dụng
                        </div>
                        {(plotSearchCode || plotFilterZone || plotFilterRow || plotFilterType || plotFilterOrientation) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPlotSearchCode('');
                              setPlotFilterZone('');
                              setPlotFilterRow('');
                              setPlotFilterType('');
                              setPlotFilterOrientation('');
                            }}
                            style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Plots Content */}
                    <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', backgroundColor: '#FAFAFA' }}>
                      {plotLoading ? (
                        <div style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <RefreshCw className="animate-spin" size={20} style={{ color: 'var(--brand-primary)' }} />
                          <span>Đang tải dữ liệu ô mộ trống khả dụng...</span>
                        </div>
                      ) : plotError ? (
                        <div style={{ padding: '30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>
                            <AlertCircle size={18} />
                            <span>{plotError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => fetchAvailablePlots()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: '#1E293B',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <RefreshCw size={14} />
                            Thử lại
                          </button>
                        </div>
                      ) : filteredPlots.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <p style={{ margin: 0 }}>
                            {availablePlots.length === 0
                              ? 'Hiện chưa có dữ liệu ô mộ trống nào trong hệ thống.'
                              : 'Không tìm thấy ô mộ trống phù hợp với bộ lọc hiện tại.'}
                          </p>
                          {availablePlots.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => fetchAvailablePlots()}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                color: '#1E293B',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <RefreshCw size={14} />
                              Tải Lại Danh Sách Ô Mộ
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPlotSearchCode('');
                                setPlotFilterZone('');
                                setPlotFilterRow('');
                                setPlotFilterType('');
                                setPlotFilterOrientation('');
                              }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                color: '#DC2626',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Xóa tất cả bộ lọc
                            </button>
                          )}
                        </div>
                      ) : plotViewMode === 'cards' ? (
                        /* CARDS VIEW */
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                          {filteredPlots.map((p) => {
                            const isSelected = wizardPlot?.plot_id === p.plot_id;
                            return (
                              <div
                                key={p.plot_id}
                                onClick={() => setWizardPlot(p)}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: '8px',
                                  border: isSelected ? '2px solid var(--brand-primary)' : '1px solid #E2E8F0',
                                  backgroundColor: isSelected ? '#F0FDFA' : '#FFFFFF',
                                  cursor: 'pointer',
                                  boxShadow: isSelected ? '0 4px 6px -1px rgba(13, 148, 136, 0.15)' : 'none',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? 'var(--brand-primary)' : '#0F172A' }}>
                                    {p.plot_code}
                                  </span>
                                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, backgroundColor: '#DCFCE7', color: '#166534' }}>
                                    Trống Khả Dụng
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                  {p.type_name}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div>Vị trí: {p.zone_name} • Dãy {p.row_code}</div>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <span>🪦 {p.default_slots || 1} huyệt</span>
                                    <span>📐 {p.plot_length || 2.5}m × {p.plot_width || 1.2}m</span>
                                    <span>🧭 {p.orientation || 'Tự do'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* MATRIX / ROW MAP VIEW */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {Object.keys(rowGroups).sort().map((rowCode) => (
                            <div key={rowCode} style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Grid size={13} color="var(--brand-primary)" />
                                <span>Dãy {rowCode} ({rowGroups[rowCode].length} ô khả dụng)</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {rowGroups[rowCode].map((p) => {
                                  const isSelected = wizardPlot?.plot_id === p.plot_id;
                                  return (
                                    <button
                                      key={p.plot_id}
                                      type="button"
                                      onClick={() => setWizardPlot(p)}
                                      title={`${p.plot_code} • ${p.type_name} • Hướng: ${p.orientation || 'Tự do'}`}
                                      style={{
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid #CBD5E1',
                                        backgroundColor: isSelected ? '#CCFBF1' : '#F8FAFC',
                                        color: isSelected ? 'var(--brand-primary)' : '#1E293B',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        minWidth: '55px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      <div>{p.plot_code.split('-').pop() || p.plot_code}</div>
                                      <div style={{ fontSize: '9px', fontWeight: 500, color: '#64748B' }}>
                                        {p.orientation || 'Tự do'}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                    <strong>Lưu ý nghiệp vụ:</strong> Sau khi tạo, hợp đồng sẽ ở trạng thái Dự Thảo và ô mộ{' '}
                    <code>{wizardPlot?.plot_code}</code> sẽ được tạm giữ chỗ để nhân viên gửi thân nhân ký duyệt.
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
                  <div className="responsive-form-row">
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

                  {/* Subtype Details Cards */}
                  {contractDetail.exhumation && (
                    <div style={{ border: '1px solid #FDE68A', borderRadius: '8px', padding: '16px', backgroundColor: '#FFFBEB' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <ArrowRightLeft size={16} />
                        <span>Hồ Sơ Cải Táng</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
                        <div><strong>Người quá cố:</strong> {contractDetail.exhumation.deceased_name || `ID #${contractDetail.exhumation.current_deceased_id}`}</div>
                        <div><strong>Vị trí:</strong> {contractDetail.exhumation.plot_code} (Huyệt số {contractDetail.exhumation.slot_number})</div>
                        <div><strong>Ngày cải táng:</strong> {contractDetail.exhumation.exhumation_date}</div>
                        <div><strong>Phí cải táng:</strong> {formatCurrency(contractDetail.exhumation.exhumation_fee)}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Lý do cải táng:</strong> {contractDetail.exhumation.reason || 'Không ghi chú'}</div>
                      </div>
                    </div>
                  )}

                  {contractDetail.transfer && (
                    <div style={{ border: '1px solid #C7D2FE', borderRadius: '8px', padding: '16px', backgroundColor: '#EEF2FF' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#4338CA', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <ArrowRightLeft size={16} />
                        <span>Hợp Đồng Chuyển Nhượng Quyền Sử Dụng</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
                        <div><strong>Bên chuyển nhượng:</strong> {contractDetail.transfer.seller_name || `ID #${contractDetail.transfer.seller_id}`}</div>
                        <div><strong>Bên nhận chuyển nhượng:</strong> {contractDetail.transfer.buyer_name || `ID #${contractDetail.transfer.buyer_id}`}</div>
                        <div><strong>Ô mộ chuyển nhượng:</strong> {contractDetail.transfer.plot_code}</div>
                        <div><strong>Phí thủ tục:</strong> {formatCurrency(contractDetail.transfer.commission_fee)}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Lý do:</strong> {contractDetail.transfer.transfer_reason || 'Không ghi chú'}</div>
                      </div>
                    </div>
                  )}

                  {contractDetail.cremation && (
                    <div style={{ border: '1px solid #FED7AA', borderRadius: '8px', padding: '16px', backgroundColor: '#FFF7ED' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#C2410C', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <Flame size={16} />
                        <span>Hợp Đồng Hỏa Táng Trọn Gói</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
                        <div><strong>Người quá cố:</strong> {contractDetail.cremation.deceased_name || `ID #${contractDetail.cremation.deceased_id}`}</div>
                        <div><strong>Ngày hỏa táng:</strong> {contractDetail.cremation.cremation_date}</div>
                        <div><strong>Gói dịch vụ:</strong> {getCremationPackageName(contractDetail.cremation.package_service_code)}</div>
                        <div><strong>Lưu trữ tro cốt:</strong> {contractDetail.cremation.urn_storage_option || 'Gia đình mang về'}</div>
                        <div><strong>Phí dịch vụ:</strong> {formatCurrency(contractDetail.cremation.service_fee)}</div>
                      </div>
                    </div>
                  )}

                  {/* Annexes Section */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={16} color="var(--brand-primary)" />
                        <span>Phụ Lục Hợp Đồng ({contractDetail.annexes?.length || 0})</span>
                      </div>
                      {contractDetail.status === 'ACTIVE' &&
                        (contractDetail.contract_type === 'LAND_PURCHASE' ||
                          contractDetail.contract_type === 'TRANSFER') &&
                        canManage && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={handleOpenBurialAnnex}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'var(--brand-primary)',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Plus size={14} />
                            <span>+ Phụ Lục An Táng</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenCareAnnex}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#0284C7',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Sparkles size={14} />
                            <span>+ Phụ Lục Chăm Sóc</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenConstructionAnnex}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#D97706',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Wrench size={14} />
                            <span>+ Phụ Lục Thi Công</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {(!contractDetail.annexes || contractDetail.annexes.length === 0) ? (
                      <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                        Chưa có phụ lục nào được lập cho hợp đồng này.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {contractDetail.annexes.map((annex) => {
                          const aBadge = getAnnexStatusBadge(annex.status);
                          const annexTypeLabel = annex.annex_type === 'BURIAL' 
                            ? 'An Táng' 
                            : annex.annex_type === 'CARE' 
                            ? 'Chăm Sóc' 
                            : annex.annex_type === 'CONSTRUCTION' 
                            ? 'Thi Công Xây Dựng' 
                            : (annex.annex_type || 'Phụ Lục');
                          return (
                            <div
                              key={annex.annex_id}
                              style={{
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                padding: '12px 14px',
                                backgroundColor: '#F8FAFC',
                                fontSize: '13px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{annex.annex_code}</span>
                                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, backgroundColor: '#E2E8F0', color: '#334155', whiteSpace: 'nowrap' }}>
                                    {annexTypeLabel}
                                  </span>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      backgroundColor: aBadge.bg,
                                      color: aBadge.color,
                                      border: `1px solid ${aBadge.border}`,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {aBadge.label}
                                  </span>
                                </div>
                                <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                                  {formatCurrency(annex.additional_amount)}
                                </div>
                              </div>

                              {/* BURIAL ANNEX DETAILS */}
                              {annex.annex_type === 'BURIAL' && annex.burial && (
                                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                                    <div><strong>Người quá cố:</strong> {annex.burial.deceased_name} ({annex.burial.deceased_code})</div>
                                    <div><strong>Vị trí:</strong> Huyệt số {annex.burial.slot_number}</div>
                                    <div><strong>Ngày an táng:</strong> {annex.burial.burial_date}</div>
                                    {annex.burial.is_kim_tinh && (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '2px 8px',
                                          borderRadius: '10px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          backgroundColor: '#FEF2F2',
                                          color: '#991B1B',
                                          border: '1px solid #FECACA',
                                        }}
                                      >
                                        <Lock size={12} />
                                        Kim Tĩnh (Khóa Vĩnh Viễn)
                                      </span>
                                    )}
                                  </div>
                                  {annex.burial.construction_notes && (
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                                      <strong>Ghi chú thi công:</strong> {annex.burial.construction_notes}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CARE ANNEX DETAILS */}
                              {annex.annex_type === 'CARE' && annex.care && (
                                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                                    <div><strong>Gói chăm sóc:</strong> {annex.care.package_name || annex.care.package_code}</div>
                                    <div><strong>Chu kỳ:</strong> {annex.care.cycle_months} tháng</div>
                                    <div><strong>Đơn giá định kỳ:</strong> {formatCurrency(annex.care.recurring_price)}</div>
                                  </div>
                                  {annex.notes && (
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                                      <strong>Ghi chú:</strong> {annex.notes}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CONSTRUCTION ANNEX DETAILS */}
                              {annex.annex_type === 'CONSTRUCTION' && annex.construction && (
                                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                                    <div><strong>Khởi công dự kiến:</strong> {annex.construction.estimated_start_date}</div>
                                    <div><strong>Hoàn thành dự kiến:</strong> {annex.construction.estimated_end_date}</div>
                                  </div>
                                  {renderConstructionSpecs(annex.construction.checklist_specifications)}
                                  {annex.notes && (
                                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748B' }}>
                                      <strong>Ghi chú:</strong> {annex.notes}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>
                                  Ngày tạo: {new Date(annex.created_at).toLocaleDateString('vi-VN')}
                                  {annex.signed_at && ` • Ký: ${annex.signed_at}`}
                                  {annex.activated_at && ` • Kích hoạt: ${new Date(annex.activated_at).toLocaleDateString('vi-VN')}`}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {annex.signed_scan_url && (
                                    <a
                                      href={annex.signed_scan_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #CBD5E1',
                                        backgroundColor: '#FFFFFF',
                                        color: '#0284C7',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Download size={12} />
                                      <span>Bản Scan</span>
                                    </a>
                                  )}
                                  {annex.status === 'DRAFT' && canManage && (
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitAnnexSigning(annex.annex_id)}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        border: '1px solid #D97706',
                                        backgroundColor: '#FFFBEB',
                                        color: '#B45309',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Trình Ký
                                    </button>
                                  )}
                                  {['DRAFT', 'PENDING_SIGN'].includes(annex.status) && canManage && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenActivateAnnex(annex)}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        backgroundColor: '#16A34A',
                                        color: '#FFFFFF',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Upload size={12} />
                                      <span>Kích Hoạt Phụ Lục</span>
                                    </button>
                                  )}
                                  {/* Role Separation for Physical Confirmation:
                                      Marketing does NOT have a button to confirm field burial.
                                      Field confirmation is carried out by Quản Trang when work order completes. */}
                                  {annex.annex_type === 'BURIAL' && annex.status === 'ACTIVE' && (
                                    <span
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: '#FEF3C7',
                                        color: '#92400E',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        border: '1px solid #FDE68A',
                                      }}
                                    >
                                      <Clock size={12} />
                                      <span>Chờ Quản trang xác nhận thực địa khi hoàn tất thi công</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Financial Receivable Card */}
                  {contractDetail.receivable && (
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span>Nghĩa Vụ Tài Chính &amp; Công Nợ (Receivable)</span>
                        {Number(contractDetail.receivable.discount_amount) > 0 && (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#7C3AED', backgroundColor: '#F3E8FF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #D8B4FE', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Percent size={12} />
                            Đã chiết khấu: {formatCurrency(contractDetail.receivable.discount_amount)}
                          </span>
                        )}
                      </div>
                      <div className="responsive-metric-grid-4" style={{ fontSize: '13px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Số tiền gốc</div>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(contractDetail.receivable.original_amount)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Số tiền phải thu sau giảm</div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{formatCurrency(contractDetail.receivable.final_payable_amount)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Đã thanh toán</div>
                          <div style={{ fontWeight: 600, color: '#16A34A' }}>{formatCurrency(contractDetail.receivable.total_paid_amount)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Trạng thái nợ</div>
                          <div style={{ fontWeight: 600 }}>{contractDetail.receivable.status}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attached Documents & Scan Files */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                    <DocumentAttachmentList
                      contractId={contractDetail.contract_id}
                      token={token}
                      title={`Tài Liệu & File Scan Đính Kèm (${contractDetail.contract_code})`}
                      canUpload={canManage}
                      onUploaded={() => fetchContractDetail(contractDetail.contract_id)}
                    />
                  </div>

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
                  Hỗ trợ định dạng PDF, JPG, PNG. Tệp sẽ được lưu trữ an toàn và bảo mật trên hệ thống.
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
              Thao tác này sẽ hủy bỏ hợp đồng và <strong>giải phóng ô mộ trở lại trạng thái Trống Chưa Bán</strong>.
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

      {/* ========================================================================= */}
      {/* M08: Burial Annex Modal */}
      {/* ========================================================================= */}
      {isBurialAnnexModalOpen && contractDetail && (
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
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="var(--brand-primary)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                  Lập Phụ Lục An Táng ({contractDetail.contract_code})
                </h3>
              </div>
              <button
                onClick={() => setIsBurialAnnexModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {burialError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {burialError}
              </div>
            )}

            {/* Step 1: Select Deceased */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                1. Chọn Người Quá Cố (*)
              </label>
              <input
                type="text"
                placeholder="Tìm theo tên hoặc mã người quá cố..."
                value={burialDeceasedSearch}
                onChange={(e) => {
                  setBurialDeceasedSearch(e.target.value);
                  searchBurialDeceased(e.target.value);
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '8px' }}
              />
              <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#F8FAFC' }}>
                {burialDeceasedList.map((d) => {
                  const isSelected = selectedDeceased?.deceased_id === d.deceased_id;
                  return (
                    <div
                      key={d.deceased_id}
                      onClick={() => setSelectedDeceased(d)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #E2E8F0',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{d.full_name}</span>{' '}
                        <span style={{ fontSize: '12px', color: '#64748B' }}>({d.deceased_code})</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: d.has_death_certificate ? '#DCFCE7' : '#FEF2F2',
                          color: d.has_death_certificate ? '#166534' : '#991B1B',
                        }}
                      >
                        {d.has_death_certificate ? 'Đã có GBT' : 'Chưa có GBT'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {selectedDeceased && !selectedDeceased.has_death_certificate && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={14} />
                  <span>Cảnh báo: Người này chưa có Giấy Báo Tử trong hồ sơ. Vui lòng bổ sung giấy báo tử trước khi tạo phụ lục!</span>
                </div>
              )}
            </div>

            {/* Step 2: Slot Selection */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                2. Chọn huyệt an táng
              </label>
              {contractPlotSlots.length === 0 ? (
                <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: '12px' }}>
                  Đang đồng bộ dữ liệu huyệt hoặc ô mộ này chưa có huyệt khả dụng. Vui lòng tải lại trang.
                </div>
              ) : (
                <select
                  value={burialSlotId}
                  onChange={(e) => setBurialSlotId(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="">-- Chọn huyệt an táng --</option>
                  {contractPlotSlots.map((s) => (
                    <option key={s.slot_id} value={s.slot_id} disabled={s.status !== 'EMPTY'}>
                      Huyệt số {s.slot_number} ({s.status === 'EMPTY' ? 'Trống khả dụng' : `Đã an táng: ${s.deceased_name || 'Đã có hài cốt'}`})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 3: Burial Date */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                3. Ngày An Táng (*)
              </label>
              <input
                type="date"
                value={burialDate}
                onChange={(e) => setBurialDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            {/* Step 4: Kim Tinh Checkbox & Invariant Alert */}
            <div style={{ marginBottom: '14px', padding: '12px', border: '1px solid #FECACA', borderRadius: '8px', backgroundColor: burialIsKimTinh ? '#FEF2F2' : '#FFFBEB' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, color: burialIsKimTinh ? '#991B1B' : '#92400E' }}>
                <input
                  type="checkbox"
                  checked={burialIsKimTinh}
                  onChange={(e) => setBurialIsKimTinh(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Kim tĩnh</span>
              </label>
              {burialIsKimTinh && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#991B1B', lineHeight: '1.4' }}>
                  <strong>🔒 LƯU Ý BẢO LƯU:</strong> Ô mộ Kim tĩnh sẽ được bảo lưu cố định vĩnh viễn, không áp dụng cải táng hoặc chuyển nhượng sau khi an táng.
                </div>
              )}
            </div>

            {/* Additional Amount */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Phí Dịch Vụ An Táng Phát Sinh (VNĐ)
              </label>
              <input
                type="number"
                value={burialAmount}
                onChange={(e) => setBurialAmount(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            {/* Construction Notes */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Ghi Chú Thi Công &amp; Xây Dựng
              </label>
              <textarea
                rows={2}
                placeholder="Yêu cầu xây kim tĩnh, đúc bê tông, ốp đá hoa cương..."
                value={burialConstructionNotes}
                onChange={(e) => setBurialConstructionNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsBurialAnnexModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateBurialAnnex}
                disabled={burialSubmitting || !selectedDeceased || !burialSlotId}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {burialSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus size={15} />}
                <span>Tạo Dự Thảo Phụ Lục</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Care Annex Modal */}
      {/* ========================================================================= */}
      {isCareAnnexModalOpen && contractDetail && (
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
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#0284C7" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                  Lập Phụ Lục Chăm Sóc Định Kỳ ({contractDetail.contract_code})
                </h3>
              </div>
              <button
                onClick={() => setIsCareAnnexModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {careError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {careError}
              </div>
            )}

            {/* Package Selection */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                1. Chọn Gói Dịch Vụ Chăm Sóc (*)
              </label>
              <select
                value={selectedCarePackageId}
                onChange={(e) => {
                  const pid = Number(e.target.value);
                  setSelectedCarePackageId(pid);
                  const pkg = carePackages.find((p) => p.package_id === pid);
                  if (pkg) {
                    setCareRecurringPrice(String(pkg.unit_price));
                  }
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
              >
                <option value="">-- Chọn gói dịch vụ chăm sóc --</option>
                {carePackages.map((pkg) => (
                  <option key={pkg.package_id} value={pkg.package_id}>
                    {pkg.package_name} ({pkg.package_code}) - {formatCurrency(pkg.unit_price)} / chu kỳ
                  </option>
                ))}
              </select>
            </div>

            {/* Cycle Months */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                2. Chu Kỳ Thời Gian Chăm Sóc (Tháng)
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {[12, 24, 36, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCareCycleMonths(m)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid #CBD5E1',
                      backgroundColor: careCycleMonths === m ? '#0284C7' : '#FFFFFF',
                      color: careCycleMonths === m ? '#FFFFFF' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {m} Tháng ({m / 12} Năm)
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={120}
                value={careCycleMonths}
                onChange={(e) => setCareCycleMonths(Math.max(1, Number(e.target.value)))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            {/* Recurring Price */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                3. Đơn Giá Định Kỳ Phụ Lục (VNĐ) (*)
              </label>
              <input
                type="number"
                value={careRecurringPrice}
                onChange={(e) => setCareRecurringPrice(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Ghi Chú Yêu Cầu Chăm Sóc Đặc Biệt
              </label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Thắp hương và thay hoa tươi ngày mùng một, rằm âm lịch hàng tháng; dọn cỏ tỉa cây định kỳ..."
                value={careNotes}
                onChange={(e) => setCareNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsCareAnnexModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateCareAnnex}
                disabled={careSubmitting || !selectedCarePackageId}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {careSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus size={15} />}
                <span>Tạo Dự Thảo Phụ Lục Chăm Sóc</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Construction Annex Modal */}
      {/* ========================================================================= */}
      {isConstructionAnnexModalOpen && contractDetail && (
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
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={20} color="#D97706" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                  Lập Phụ Lục Thi Công Xây Dựng ({contractDetail.contract_code})
                </h3>
              </div>
              <button
                onClick={() => setIsConstructionAnnexModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {constError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {constError}
              </div>
            )}

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Khởi Công Dự Kiến (*)
                </label>
                <input
                  type="date"
                  value={constStartDate}
                  onChange={(e) => setConstStartDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Hoàn Thành Dự Kiến (*)
                </label>
                <input
                  type="date"
                  value={constEndDate}
                  onChange={(e) => setConstEndDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Checklist Specifications */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Hạng Mục &amp; Quy Cách Kỹ Thuật Thi Công (*)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleResetDefaultChecklist}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Tải mẫu chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={13} />
                    <span>Thêm hạng mục</span>
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {checklistItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        borderBottom: idx === checklistItems.length - 1 ? 'none' : '1px solid #E2E8F0',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', width: '22px' }}>
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="Tên hạng mục thi công (VD: Đào móng bê tông, xây tường gạch...)"
                          value={item.task_name}
                          onChange={(e) => handleUpdateChecklistItem(idx, 'task_name', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: '5px',
                            border: '1px solid #CBD5E1',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={item.is_required}
                            onChange={(e) => handleUpdateChecklistItem(idx, 'is_required', e.target.checked)}
                          />
                          Bắt buộc
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistItem(idx)}
                          disabled={checklistItems.length <= 1}
                          title="Xóa hạng mục"
                          style={{
                            padding: '4px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: checklistItems.length <= 1 ? '#CBD5E1' : '#EF4444',
                            cursor: checklistItems.length <= 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div style={{ paddingLeft: '30px' }}>
                        <input
                          type="text"
                          placeholder="Quy cách kỹ thuật / vật liệu (VD: Bê tông mác M250 dày 100mm, thép D10, chống thấm...)"
                          value={item.specs}
                          onChange={(e) => handleUpdateChecklistItem(idx, 'specs', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: '4px',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                            color: '#475569',
                            backgroundColor: '#FFFFFF',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Amount */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Chi Phí Thi Công Xây Dựng (VNĐ)
              </label>
              <input
                type="number"
                value={constAmount}
                onChange={(e) => setConstAmount(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Ghi Chú Thêm
              </label>
              <textarea
                rows={2}
                placeholder="Yêu cầu cụ thể của thân nhân, vật liệu chỉ định..."
                value={constNotes}
                onChange={(e) => setConstNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsConstructionAnnexModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateConstructionAnnex}
                disabled={constSubmitting || !constStartDate || !constEndDate}
                style={{
                  padding: '8px 18px',
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
                {constSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus size={15} />}
                <span>Tạo Dự Thảo Phụ Lục Thi Công</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* M08: Annex Activate Modal */}
      {/* ========================================================================= */}
      {isAnnexActivateModalOpen && activeAnnexToActivate && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} color="#16A34A" />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                  Kích Hoạt Phụ Lục {activeAnnexToActivate.annex_code}
                </h4>
              </div>
              <button
                onClick={() => setIsAnnexActivateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {annexActivateError && (
              <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {annexActivateError}
              </div>
            )}

            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px' }}>
              Đính kèm bản scan phụ lục có chữ ký của khách hàng để kích hoạt hiệu lực pháp lý và cập nhật trạng thái an táng trên ô mộ.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  File scan phụ lục hợp đồng có chữ ký (*) (PDF / Ảnh)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setAnnexScanFile(e.target.files?.[0] || null)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ngày ký thực tế
                </label>
                <input
                  type="date"
                  value={annexSignedAt}
                  onChange={(e) => setAnnexSignedAt(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ghi chú kích hoạt
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về việc nghiệm thu thi công hoặc an táng..."
                  value={annexActivationNotes}
                  onChange={(e) => setAnnexActivationNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsAnnexActivateModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleActivateAnnex}
                disabled={annexActivateSubmitting || !annexScanFile}
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
                {annexActivateSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={15} />}
                <span>Xác Nhận Kích Hoạt Phụ Lục</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* M08: Exhumation Contract Modal */}
      {/* ========================================================================= */}
      {isExhumationModalOpen && (
        <div
          className="responsive-modal-overlay"
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
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={20} color="#B45309" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                  Lập Hợp Đồng Cải Táng / Cất Bốc Hài Cốt
                </h3>
              </div>
              <button
                onClick={() => setIsExhumationModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {exhumationError && (
              <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {exhumationError}
              </div>
            )}

            {/* Select Customer */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                1. Khách Hàng (Chủ sở hữu ô mộ) (*)
              </label>
              <input
                type="text"
                placeholder="Tìm khách hàng..."
                onChange={(e) => searchCustomers(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                {custResults.map((c) => (
                  <div
                    key={c.customer_id}
                    onClick={() => handleSelectExhumationCustomer(c)}
                    style={{
                      padding: '6px 10px',
                      borderBottom: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      backgroundColor: exhumationCustomer?.customer_id === c.customer_id ? '#FEF3C7' : 'transparent',
                    }}
                  >
                    <strong>{c.full_name}</strong> - {c.phone_number} ({c.customer_code})
                  </div>
                ))}
              </div>
            </div>

            {/* Select Owned Plot */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                2. Ô Mộ Đang An Táng (Chỉ ô không phải Kim Tĩnh) (*)
              </label>
              <select
                value={selectedExhumationPlot?.plot_id || ''}
                onChange={(e) => {
                  const p = exhumationPlots.find((pl) => pl.plot_id === Number(e.target.value));
                  if (p) handleSelectExhumationPlot(p);
                }}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
              >
                <option value="">-- Chọn ô mộ đã an táng --</option>
                {exhumationPlots.map((pl) => (
                  <option key={pl.plot_id} value={pl.plot_id}>
                    {pl.plot_code} - Khu {pl.zone_code} ({pl.status})
                  </option>
                ))}
              </select>
              {exhumationCustomer && exhumationPlots.length === 0 && (
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  Khách hàng này hiện không sở hữu ô mộ nào có thể cải táng (ô Kim Tĩnh bị khóa vĩnh viễn).
                </div>
              )}
            </div>

            {/* Exhumation Date & Fee */}
            <div className="responsive-form-row">
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ngày Cải Táng Dự Kiến
                </label>
                <input
                  type="date"
                  value={exhumationDate}
                  onChange={(e) => setExhumationDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Phí Cải Táng (VNĐ)
                </label>
                <input
                  type="number"
                  value={exhumationFee}
                  onChange={(e) => setExhumationFee(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Lý Do Cải Táng
              </label>
              <textarea
                rows={2}
                placeholder="Di dời về quê hương, cải táng theo nguyện vọng gia đình..."
                value={exhumationReason}
                onChange={(e) => setExhumationReason(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setIsExhumationModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateExhumationContract}
                disabled={exhumationSubmitting || !exhumationCustomer || !selectedExhumationPlot}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#B45309',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {exhumationSubmitting ? 'Đang tạo...' : 'Tạo Dự Thảo Cải Táng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* M08: Transfer Contract Modal */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <div
          className="responsive-modal-overlay"
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
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={20} color="#4338CA" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                  Lập Hợp Đồng Chuyển Nhượng Quyền Sử Dụng Đất
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {transferError && (
              <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {transferError}
              </div>
            )}

            {/* Seller */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                1. Bên Chuyển Nhượng (Chủ sở hữu hiện tại) (*)
              </label>
              <input
                type="text"
                placeholder="Tìm khách hàng chuyển nhượng..."
                onChange={(e) => searchCustomers(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                {custResults.map((c) => (
                  <div
                    key={c.customer_id}
                    onClick={() => handleSelectTransferSeller(c)}
                    style={{
                      padding: '5px 10px',
                      borderBottom: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      backgroundColor: transferSeller?.customer_id === c.customer_id ? '#EEF2FF' : 'transparent',
                    }}
                  >
                    <strong>{c.full_name}</strong> ({c.customer_code})
                  </div>
                ))}
              </div>
            </div>

            {/* Select Plot owned by seller */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                2. Ô Mộ Chuyển Nhượng (không có hài cốt) (*)
              </label>
              <select
                value={selectedTransferPlot?.plot_id || ''}
                onChange={(e) => {
                  const p = transferPlots.find((pl) => pl.plot_id === Number(e.target.value));
                  if (p) setSelectedTransferPlot(p);
                }}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
              >
                <option value="">-- Chọn ô mộ để chuyển nhượng --</option>
                {transferPlots.map((pl) => (
                  <option key={pl.plot_id} value={pl.plot_id}>
                    {pl.plot_code} - Khu {pl.zone_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Buyer */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                3. Bên Nhận Chuyển Nhượng (Chủ mới) (*)
              </label>
              <div style={{ maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                {custResults
                  .filter((c) => c.customer_id !== transferSeller?.customer_id)
                  .map((c) => (
                    <div
                      key={c.customer_id}
                      onClick={() => setTransferBuyer(c)}
                      style={{
                        padding: '5px 10px',
                        borderBottom: '1px solid #E2E8F0',
                        cursor: 'pointer',
                        fontSize: '12px',
                        backgroundColor: transferBuyer?.customer_id === c.customer_id ? '#DCFCE7' : 'transparent',
                      }}
                    >
                      <strong>{c.full_name}</strong> - {c.phone_number} ({c.customer_code})
                    </div>
                  ))}
              </div>
            </div>

            {/* Fee & Reason */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Phí Thủ Tục Chuyển Nhượng (VNĐ)
              </label>
              <input
                type="number"
                value={transferCommission}
                onChange={(e) => setTransferCommission(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Lý Do Chuyển Nhượng
              </label>
              <textarea
                rows={2}
                placeholder="Chuyển nhượng quyền sử dụng theo thỏa thuận hai bên..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateTransferContract}
                disabled={transferSubmitting || !transferSeller || !transferBuyer || !selectedTransferPlot}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#4338CA',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {transferSubmitting ? 'Đang tạo...' : 'Tạo Dự Thảo Chuyển Nhượng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* M08: Cremation Contract Modal */}
      {/* ========================================================================= */}
      {isCremationModalOpen && (
        <div
          className="responsive-modal-overlay"
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
            className="responsive-modal-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={20} color="#C2410C" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                  Lập Hợp Đồng Hỏa Táng Trọn Gói
                </h3>
              </div>
              <button
                onClick={() => setIsCremationModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {cremationError && (
              <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
                {cremationError}
              </div>
            )}

            {/* Customer */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                1. Khách Hàng Đại Diện Đăng Ký (*)
              </label>
              <input
                type="text"
                placeholder="Tìm khách hàng..."
                onChange={(e) => searchCustomers(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                {custResults.map((c) => (
                  <div
                    key={c.customer_id}
                    onClick={() => setCremationCustomer(c)}
                    style={{
                      padding: '5px 10px',
                      borderBottom: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      backgroundColor: cremationCustomer?.customer_id === c.customer_id ? '#FFEDD5' : 'transparent',
                    }}
                  >
                    <strong>{c.full_name}</strong> - {c.phone_number} ({c.customer_code})
                  </div>
                ))}
              </div>
            </div>

            {/* Deceased */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                2. Người Quá Cố Hỏa Táng (*)
              </label>
              <input
                type="text"
                placeholder="Tìm người quá cố..."
                onChange={(e) => searchCremationDeceased(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                {cremationDeceasedList.map((d) => (
                  <div
                    key={d.deceased_id}
                    onClick={() => setSelectedCremationDeceased(d)}
                    style={{
                      padding: '5px 10px',
                      borderBottom: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      backgroundColor: selectedCremationDeceased?.deceased_id === d.deceased_id ? '#FFEDD5' : 'transparent',
                    }}
                  >
                    <span><strong>{d.full_name}</strong> ({d.deceased_code})</span>
                    <span style={{ fontSize: '11px', color: d.has_death_certificate ? '#166534' : '#991B1B' }}>
                      {d.has_death_certificate ? '✓ Có GBT' : '✗ Chưa có GBT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Date, Package & Fee */}
            <div className="responsive-form-row">
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ngày Hỏa Táng
                </label>
                <input
                  type="date"
                  value={cremationDate}
                  onChange={(e) => setCremationDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Gói Dịch Vụ
                </label>
                <select
                  value={cremationPackage}
                  onChange={(e) => setCremationPackage(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="HOA_TANG_TIEU_CHUAN">Tiêu Chuẩn (8.500.000đ)</option>
                  <option value="HOA_TANG_VIP">VIP Nghi Lễ (15.000.000đ)</option>
                  <option value="HOA_TANG_CAO_CAP">Cao Cấp Trọn Gói (25.000.000đ)</option>
                </select>
              </div>
            </div>

            <div className="responsive-form-row">
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tùy Chọn Lưu Tro Cốt
                </label>
                <input
                  type="text"
                  value={cremationUrnOption}
                  onChange={(e) => setCremationUrnOption(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Phí Dịch Vụ (VNĐ)
                </label>
                <input
                  type="number"
                  value={cremationFee}
                  onChange={(e) => setCremationFee(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Ghi Chú
              </label>
              <textarea
                rows={2}
                placeholder="Ghi chú về tổ chức nghi lễ, giờ hỏa táng..."
                value={cremationNotes}
                onChange={(e) => setCremationNotes(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setIsCremationModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateCremationContract}
                disabled={cremationSubmitting || !cremationCustomer || !selectedCremationDeceased}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#C2410C',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cremationSubmitting ? 'Đang tạo...' : 'Tạo Dự Thảo Hỏa Táng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
