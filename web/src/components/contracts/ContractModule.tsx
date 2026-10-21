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

  // Quick Customer target state
  const [quickCustTarget, setQuickCustTarget] = useState<'LAND' | 'EXHUMATION' | 'TRANSFER_SELLER' | 'TRANSFER_BUYER' | 'CREMATION'>('LAND');

  // M08: Exhumation Contract 4-Step Wizard State
  const [isExhumationModalOpen, setIsExhumationModalOpen] = useState<boolean>(false);
  const [exhumationStep, setExhumationStep] = useState<number>(1);
  const [exhumationCustomer, setExhumationCustomer] = useState<Customer | null>(null);
  const [exhumationPlots, setExhumationPlots] = useState<Plot[]>([]);
  const [selectedExhumationPlot, setSelectedExhumationPlot] = useState<Plot | null>(null);
  const [exhumationSlotId, setExhumationSlotId] = useState<number | ''>('');
  const [exhumationSlotNumber, setExhumationSlotNumber] = useState<number | null>(null);
  const [exhumationDeceasedId, setExhumationDeceasedId] = useState<number | ''>('');
  const [exhumationDeceasedName, setExhumationDeceasedName] = useState<string>('');
  const [exhumationDate, setExhumationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [exhumationFee, setExhumationFee] = useState<string>('15000000');
  const [exhumationDestination, setExhumationDestination] = useState<string>('Nghĩa trang quê nhà / Nhà lưu tro');
  const [exhumationTransport, setExhumationTransport] = useState<string>('Xe chuyên dụng Ban Quản Trang');
  const [exhumationReason, setExhumationReason] = useState<string>('');
  const [exhumationPlotFilterZone, setExhumationPlotFilterZone] = useState<string>('');
  const [exhumationPlotSearchCode, setExhumationPlotSearchCode] = useState<string>('');
  const [exhumationPlotViewMode, setExhumationPlotViewMode] = useState<'cards' | 'matrix'>('cards');
  const [exhumationSubmitting, setExhumationSubmitting] = useState<boolean>(false);
  const [exhumationError, setExhumationError] = useState<string | null>(null);

  // M08: Transfer Contract 4-Step Wizard State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferStep, setTransferStep] = useState<number>(1);
  const [transferSeller, setTransferSeller] = useState<Customer | null>(null);
  const [transferBuyer, setTransferBuyer] = useState<Customer | null>(null);
  const [transferPlots, setTransferPlots] = useState<Plot[]>([]);
  const [selectedTransferPlot, setSelectedTransferPlot] = useState<Plot | null>(null);
  const [transferCommission, setTransferCommission] = useState<string>('5000000');
  const [transferPrice, setTransferPrice] = useState<string>('0');
  const [transferReason, setTransferReason] = useState<string>('');
  const [transferPlotFilterZone, setTransferPlotFilterZone] = useState<string>('');
  const [transferPlotSearchCode, setTransferPlotSearchCode] = useState<string>('');
  const [transferPlotViewMode, setTransferPlotViewMode] = useState<'cards' | 'matrix'>('cards');
  const [transferSubmitting, setTransferSubmitting] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // M08: Cremation Contract 4-Step Wizard State
  const [isCremationModalOpen, setIsCremationModalOpen] = useState<boolean>(false);
  const [cremationStep, setCremationStep] = useState<number>(1);
  const [cremationCustomer, setCremationCustomer] = useState<Customer | null>(null);
  const [cremationDeceasedList, setCremationDeceasedList] = useState<DeceasedProfile[]>([]);
  const [selectedCremationDeceased, setSelectedCremationDeceased] = useState<DeceasedProfile | null>(null);
  const [cremationDate, setCremationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [cremationTime, setCremationTime] = useState<string>('08:30');
  const [cremationPackage, setCremationPackage] = useState<string>('HOA_TANG_TIEU_CHUAN');
  const [cremationUrnOption, setCremationUrnOption] = useState<string>('Lưu tháp cốt Địa Tạng');
  const [cremationFee, setCremationFee] = useState<string>('8500000');
  const [cremationNotes, setCremationNotes] = useState<string>('');
  const [cremationSearchCust, setCremationSearchCust] = useState<string>('');
  const [cremationSearchDeceasedVal, setCremationSearchDeceasedVal] = useState<string>('');
  const [cremationSubmitting, setCremationSubmitting] = useState<boolean>(false);
  const [cremationError, setCremationError] = useState<string | null>(null);

  // Quick Deceased Inline State
  const [isQuickDeceasedModalOpen, setIsQuickDeceasedModalOpen] = useState<boolean>(false);
  const [quickDeceasedFullName, setQuickDeceasedFullName] = useState<string>('');
  const [quickDeceasedGender, setQuickDeceasedGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [quickDeceasedDod, setQuickDeceasedDod] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [quickDeceasedDob, setQuickDeceasedDob] = useState<string>('');
  const [quickDeceasedCertNo, setQuickDeceasedCertNo] = useState<string>('');
  const [quickDeceasedCertIssuer, setQuickDeceasedCertIssuer] = useState<string>('UBND Phường/Xã');
  const [quickDeceasedCertDate, setQuickDeceasedCertDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [quickDeceasedSubmitting, setQuickDeceasedSubmitting] = useState<boolean>(false);
  const [quickDeceasedError, setQuickDeceasedError] = useState<string | null>(null);

  // Care Annex Conflict & Continuation State
  const [careActiveExistingAnnex, setCareActiveExistingAnnex] = useState<ContractAnnexResponse | null>(null);
  const [careExtensionMode, setCareExtensionMode] = useState<'CONTINUE' | 'IMMEDIATE'>('CONTINUE');

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
      if (quickCustTarget === 'EXHUMATION') {
        handleSelectExhumationCustomer(newCust);
      } else if (quickCustTarget === 'TRANSFER_SELLER') {
        handleSelectTransferSeller(newCust);
      } else if (quickCustTarget === 'TRANSFER_BUYER') {
        setTransferBuyer(newCust);
      } else if (quickCustTarget === 'CREMATION') {
        setCremationCustomer(newCust);
      } else {
        setWizardCustomer(newCust);
      }
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

  const handleQuickCreateDeceased = async () => {
    if (!quickDeceasedFullName.trim() || !quickDeceasedDod || !quickDeceasedCertNo.trim()) {
      setQuickDeceasedError('Vui lòng nhập họ tên, ngày mất và số giấy báo tử');
      return;
    }
    setQuickDeceasedSubmitting(true);
    setQuickDeceasedError(null);
    try {
      const res = await apiFetch('/api/v1/profiles/deceased', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: quickDeceasedFullName.trim(),
          gender: quickDeceasedGender,
          date_of_death: quickDeceasedDod,
          date_of_birth: quickDeceasedDob || undefined,
          birth_date_precision: quickDeceasedDob ? 'EXACT' : 'UNKNOWN',
          customer_id: cremationCustomer?.customer_id || undefined,
          relationship_type: 'THÂN NHÂN',
          death_certificate: {
            certificate_number: quickDeceasedCertNo.trim(),
            issue_date: quickDeceasedCertDate || quickDeceasedDod,
            issuing_authority: quickDeceasedCertIssuer.trim() || 'UBND Phường/Xã',
          },
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Thêm hồ sơ người mất thất bại');
      }
      const newDeceased: DeceasedProfile = await res.json();
      setSelectedCremationDeceased(newDeceased);
      setCremationDeceasedList((prev) => [newDeceased, ...prev]);
      setIsQuickDeceasedModalOpen(false);
      setQuickDeceasedFullName('');
      setQuickDeceasedDod(new Date().toISOString().split('T')[0]);
      setQuickDeceasedDob('');
      setQuickDeceasedCertNo('');
      setQuickDeceasedCertIssuer('UBND Phường/Xã');
      await modalAlert({
        message: `Đã tạo hồ sơ người quá cố "${newDeceased.full_name}" (${newDeceased.deceased_code}) thành công!`,
        type: 'success',
      });
    } catch (err: unknown) {
      setQuickDeceasedError(err instanceof Error ? err.message : 'Lỗi khi tạo hồ sơ người mất');
    } finally {
      setQuickDeceasedSubmitting(false);
    }
  };

  const handleOpenCareAnnex = async () => {
    if (!contractDetail) return;
    setCareError(null);
    setCareNotes('');
    setCareCycleMonths(12);
    setCareRecurringPrice('0');
    setSelectedCarePackageId('');

    // Detect existing active care annex
    const existingActive = (contractDetail.annexes || []).find(
      (a) => (a.annex_type === 'CARE' || a.care) && a.status === 'ACTIVE' && (!a.valid_to || new Date(a.valid_to) >= new Date(new Date().toDateString()))
    );
    setCareActiveExistingAnnex(existingActive || null);
    setCareExtensionMode('CONTINUE');

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
      let notesPayload = careNotes.trim();
      if (careActiveExistingAnnex && careExtensionMode === 'CONTINUE') {
        const prefix = `[Gia hạn nối tiếp chu kỳ từ ${careActiveExistingAnnex.annex_code}]`;
        notesPayload = notesPayload ? `${prefix} ${notesPayload}` : prefix;
      }
      const payload: CareAnnexCreate = {
        package_id: Number(selectedCarePackageId),
        cycle_months: careCycleMonths,
        recurring_price: Number(careRecurringPrice) || 0,
        notes: notesPayload || undefined,
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
    setExhumationStep(1);
    setExhumationCustomer(null);
    setExhumationPlots([]);
    setSelectedExhumationPlot(null);
    setExhumationSlotId('');
    setExhumationSlotNumber(null);
    setExhumationDeceasedId('');
    setExhumationDeceasedName('');
    setExhumationDate(new Date().toISOString().split('T')[0]);
    setExhumationFee('15000000');
    setExhumationDestination('Nghĩa trang quê nhà / Nhà lưu tro');
    setExhumationTransport('Xe chuyên dụng Ban Quản Trang');
    setExhumationReason('');
    setExhumationPlotFilterZone('');
    setExhumationPlotSearchCode('');
    setExhumationPlotViewMode('cards');
    setExhumationError(null);
    setIsExhumationModalOpen(true);
    searchCustomers('');
  };

  const handleSelectExhumationCustomer = async (cust: Customer) => {
    setExhumationCustomer(cust);
    setSelectedExhumationPlot(null);
    setExhumationSlotId('');
    setExhumationSlotNumber(null);
    setExhumationDeceasedId('');
    setExhumationDeceasedName('');
    try {
      const res = await apiFetch(`/api/v1/plots?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const plotsData: Plot[] = await res.json();
        // Load all plots owned by customer (both Kim Tinh and non-Kim Tinh to show immutability badge)
        const owned = plotsData.filter((p) => p.owner_id === cust.customer_id);
        setExhumationPlots(owned);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectExhumationPlot = async (plot: Plot) => {
    if (plot.is_kim_tinh) {
      setExhumationError('Quy tắc bất biến: Ô mộ Kim Tĩnh bị khóa vĩnh viễn mức CSDL và nghiệp vụ, tuyệt đối cấm cải táng!');
      return;
    }
    setSelectedExhumationPlot(plot);
    setExhumationSlotId('');
    setExhumationSlotNumber(null);
    setExhumationDeceasedId('');
    setExhumationDeceasedName('');
    setExhumationError(null);
    try {
      const res = await apiFetch(`/api/v1/plots/${plot.plot_id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const fullPlot = await res.json();
        const occupiedSlot = (fullPlot.slots || []).find((s: PlotSlot) => s.status === 'OCCUPIED');
        if (occupiedSlot) {
          setExhumationSlotId(occupiedSlot.slot_id);
          setExhumationSlotNumber(occupiedSlot.slot_number || 1);
          setExhumationDeceasedName(occupiedSlot.deceased_name || 'Hài cốt trong huyệt');
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
      setExhumationError('Vui lòng chọn khách hàng chủ mộ, ô mộ và huyệt có hài cốt để cải táng');
      return;
    }
    setExhumationSubmitting(true);
    setExhumationError(null);
    try {
      const reasonCombined = [
        exhumationReason.trim(),
        exhumationDestination ? `Nơi di dời: ${exhumationDestination.trim()}` : '',
        exhumationTransport ? `Phương tiện: ${exhumationTransport.trim()}` : '',
      ].filter(Boolean).join(' | ');

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
          reason: reasonCombined || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể lập hợp đồng cải táng');
      }
      const data = await res.json();
      setIsExhumationModalOpen(false);
      await modalAlert({
        message: `Đã tạo dự thảo hợp đồng cải táng thành công cho ô ${selectedExhumationPlot.plot_code}!`,
        type: 'success',
      });
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
    setTransferStep(1);
    setTransferSeller(null);
    setTransferBuyer(null);
    setTransferPlots([]);
    setSelectedTransferPlot(null);
    setTransferCommission('5000000');
    setTransferPrice('0');
    setTransferReason('');
    setTransferPlotFilterZone('');
    setTransferPlotSearchCode('');
    setTransferPlotViewMode('cards');
    setTransferError(null);
    setIsTransferModalOpen(true);
    searchCustomers('');
  };

  const handleSelectTransferSeller = async (seller: Customer) => {
    setTransferSeller(seller);
    setSelectedTransferPlot(null);
    try {
      const res = await apiFetch(`/api/v1/plots?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const plotsData: Plot[] = await res.json();
        // Load all plots owned by seller to visualize eligible vs locked plots
        const owned = plotsData.filter((p) => p.owner_id === seller.customer_id);
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
      const reasonCombined = [
        transferReason.trim(),
        Number(transferPrice) > 0 ? `Giá thỏa thuận: ${formatCurrency(Number(transferPrice))}` : '',
      ].filter(Boolean).join(' | ');

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
          transfer_reason: reasonCombined || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể lập hợp đồng chuyển nhượng');
      }
      const data = await res.json();
      setIsTransferModalOpen(false);
      await modalAlert({
        message: `Đã tạo dự thảo hợp đồng chuyển nhượng quyền sử dụng ô ${selectedTransferPlot.plot_code} thành công!`,
        type: 'success',
      });
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
      const res = await apiFetch(`/api/v1/profiles/deceased?search=${encodeURIComponent(keyword)}&limit=25`, {
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
    setCremationStep(1);
    setCremationCustomer(null);
    setSelectedCremationDeceased(null);
    setCremationDate(new Date().toISOString().split('T')[0]);
    setCremationTime('08:30');
    setCremationPackage('HOA_TANG_TIEU_CHUAN');
    setCremationUrnOption('Lưu tháp cốt Địa Tạng');
    setCremationFee('8500000');
    setCremationNotes('');
    setCremationSearchCust('');
    setCremationSearchDeceasedVal('');
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
      const notesCombined = [
        cremationNotes.trim(),
        cremationTime ? `Giờ hỏa táng dự kiến: ${cremationTime}` : '',
      ].filter(Boolean).join(' | ');

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
          notes: notesCombined || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể lập hợp đồng hỏa táng');
      }
      const data = await res.json();
      setIsCremationModalOpen(false);
      await modalAlert({
        message: `Đã tạo dự thảo hợp đồng hỏa táng trọn gói thành công cho người quá cố ${selectedCremationDeceased.full_name}!`,
        type: 'success',
      });
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

  const formatDate = (val?: string | null) => {
    if (!val) return '--/--/----';
    try {
      return new Date(val).toLocaleDateString('vi-VN');
    } catch {
      return val;
    }
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

  // Inline Quick Add Customer Form Helper
  const renderQuickCustomerSection = (target: 'LAND' | 'EXHUMATION' | 'TRANSFER_SELLER' | 'TRANSFER_BUYER' | 'CREMATION') => {
    if (!isQuickCustModalOpen || quickCustTarget !== target) return null;
    return (
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
    );
  };

  // Inline Quick Add Deceased Form Helper
  const renderQuickDeceasedSection = () => {
    if (!isQuickDeceasedModalOpen) return null;
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: '#FFF7ED',
          border: '1.5px dashed #C2410C',
          marginBottom: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#C2410C', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={16} />
            <span>Hồ Sơ Người Quá Cố & Giấy Báo Tử Mới Nhanh</span>
          </div>
          <button
            type="button"
            onClick={() => setIsQuickDeceasedModalOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
          >
            <X size={16} />
          </button>
        </div>

        {quickDeceasedError && (
          <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: '12px', marginBottom: '10px' }}>
            {quickDeceasedError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Họ và Tên Người Quá Cố (*)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Trần Văn Phúc"
              value={quickDeceasedFullName}
              onChange={(e) => setQuickDeceasedFullName(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Giới Tính (*)
            </label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="quickDeceasedGender"
                  checked={quickDeceasedGender === 'MALE'}
                  onChange={() => setQuickDeceasedGender('MALE')}
                />
                <span>Nam</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="quickDeceasedGender"
                  checked={quickDeceasedGender === 'FEMALE'}
                  onChange={() => setQuickDeceasedGender('FEMALE')}
                />
                <span>Nữ</span>
              </label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Ngày Mất (*)
            </label>
            <input
              type="date"
              value={quickDeceasedDod}
              onChange={(e) => setQuickDeceasedDod(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Ngày Sinh (tuỳ chọn)
            </label>
            <input
              type="date"
              value={quickDeceasedDob}
              onChange={(e) => setQuickDeceasedDob(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Số Giấy Báo Tử / Trích Lục (*)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: GBT-2026/0129"
              value={quickDeceasedCertNo}
              onChange={(e) => setQuickDeceasedCertNo(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Cơ Quan Cấp Giấy Báo Tử
            </label>
            <input
              type="text"
              placeholder="UBND Phường/Xã..."
              value={quickDeceasedCertIssuer}
              onChange={(e) => setQuickDeceasedCertIssuer(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setIsQuickDeceasedModalOpen(false)}
            style={{ padding: '6px 14px', borderRadius: '5px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', cursor: 'pointer' }}
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={handleQuickCreateDeceased}
            disabled={quickDeceasedSubmitting}
            style={{
              padding: '6px 16px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: '#C2410C',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {quickDeceasedSubmitting ? 'Đang Tạo...' : 'Tạo & Chọn Người Quá Cố Ngay'}
          </button>
        </div>
      </div>
    );
  };

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
                        setQuickCustTarget('LAND');
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

                  {/* Inline Quick Add Customer Form */}
                  {renderQuickCustomerSection('LAND')}

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

            {/* Active Care Package Notice & Conflict Resolution */}
            {careActiveExistingAnnex && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#EFF6FF',
                  border: '1.5px solid #60A5FA',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1D4ED8', fontWeight: 700, fontSize: '13px' }}>
                  <Sparkles size={16} />
                  <span>Ô Mộ Đang Có Gói Chăm Sóc Còn Hiệu Lực!</span>
                </div>
                <div style={{ fontSize: '12px', color: '#1E40AF', marginTop: '4px' }}>
                  Phụ lục hiện tại: <strong>{careActiveExistingAnnex.annex_code}</strong> | Thời hạn: <strong>{formatDate(careActiveExistingAnnex.valid_from)}</strong> đến <strong>{formatDate(careActiveExistingAnnex.valid_to)}</strong>
                  {careActiveExistingAnnex.valid_to && (
                    <span style={{ marginLeft: '6px', fontWeight: 600, color: '#1E3A8A' }}>
                      (Còn {Math.max(0, Math.ceil((new Date(careActiveExistingAnnex.valid_to).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} ngày hiệu lực)
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#0369A1' }}>
                    <input
                      type="radio"
                      name="careExtMode"
                      checked={careExtensionMode === 'CONTINUE'}
                      onChange={() => setCareExtensionMode('CONTINUE')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <span>Gia hạn nối tiếp chu kỳ (Khuyến nghị)</span>
                      <div style={{ fontWeight: 400, color: '#475569', fontSize: '11px', marginTop: '2px' }}>
                        Tự động bắt đầu tiếp nối từ ngày {careActiveExistingAnnex.valid_to ? formatDate(new Date(new Date(careActiveExistingAnnex.valid_to).getTime() + 86400000).toISOString()) : 'kết thúc'}, không bị chồng lấn chu kỳ.
                      </div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#64748B' }}>
                    <input
                      type="radio"
                      name="careExtMode"
                      checked={careExtensionMode === 'IMMEDIATE'}
                      onChange={() => setCareExtensionMode('IMMEDIATE')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <span>Bắt đầu chu kỳ mới ngay hôm nay</span>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        Áp dụng ngay cho đợt chăm sóc phát sinh hoặc nâng cấp gói dịch vụ.
                      </div>
                    </div>
                  </label>
                </div>
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
      {/* M08: Exhumation Contract 4-Step Wizard Modal */}
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
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#B45309',
                color: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ArrowRightLeft size={22} color="#FFFFFF" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                    Quy Trình Lập Hợp Đồng Cải Táng / Cất Bốc Hài Cốt
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                    Bước {exhumationStep}/4: {exhumationStep === 1 && 'Khách Hàng (Chủ Mộ)'}
                    {exhumationStep === 2 && 'Trình Quản Lý & Chọn Ô Mộ An Táng'}
                    {exhumationStep === 3 && 'Lộ Trình Di Dời & Chi Phí'}
                    {exhumationStep === 4 && 'Xác Nhận & Xem Trước Dự Thảo'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsExhumationModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '12px 24px',
                gap: '8px',
              }}
            >
              {[
                { step: 1, label: 'Khách hàng' },
                { step: 2, label: 'Vị trí ô mộ & Hài cốt' },
                { step: 3, label: 'Lộ trình & Chi phí' },
                { step: 4, label: 'Xác nhận dự thảo' },
              ].map((s) => (
                <div
                  key={s.step}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: exhumationStep >= s.step ? '#B45309' : '#94A3B8',
                    fontWeight: exhumationStep === s.step ? 700 : 500,
                    fontSize: '13px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: exhumationStep >= s.step ? '#B45309' : '#E2E8F0',
                      color: exhumationStep >= s.step ? '#FFFFFF' : '#64748B',
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
              {exhumationError && (
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
                  <span>{exhumationError}</span>
                </div>
              )}

              {/* STEP 1: SELECT EXHUMATION CUSTOMER */}
              {exhumationStep === 1 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                      1. Tra cứu hoặc chọn khách hàng đứng tên hợp đồng cải táng:
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCustError(null);
                        setQuickCustTarget('EXHUMATION');
                        setIsQuickCustModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #B45309',
                        backgroundColor: '#FFFBEB',
                        color: '#B45309',
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

                  {/* Inline Quick Add Customer Form */}
                  {renderQuickCustomerSection('EXHUMATION')}

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

                  {exhumationCustomer && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
                            Đã Chọn Chủ Sở Hữu Mộ
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#92400E', marginTop: '2px' }}>
                            {exhumationCustomer.full_name} ({exhumationCustomer.customer_code})
                          </div>
                          <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
                            CCCD: {exhumationCustomer.citizen_id} | SĐT: {exhumationCustomer.phone_number} | Địa chỉ: {exhumationCustomer.address}
                          </div>
                        </div>
                        <CheckCircle size={24} color="#D97706" />
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
                            setQuickCustTarget('EXHUMATION');
                            setIsQuickCustModalOpen(true);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #B45309',
                            backgroundColor: '#FFFBEB',
                            color: '#B45309',
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
                          onClick={() => handleSelectExhumationCustomer(c)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: exhumationCustomer?.customer_id === c.customer_id ? '#FEF3C7' : '#FFFFFF',
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
                              backgroundColor: exhumationCustomer?.customer_id === c.customer_id ? '#B45309' : '#FFFFFF',
                              color: exhumationCustomer?.customer_id === c.customer_id ? '#FFFFFF' : '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            {exhumationCustomer?.customer_id === c.customer_id ? 'Đang chọn' : 'Chọn'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: ADVANCED EXHUMATION PLOT MANAGER & IMMUTABILITY CHECK */}
              {exhumationStep === 2 && (() => {
                const filteredPlots = exhumationPlots.filter((p) => {
                  if (exhumationPlotFilterZone && p.zone_code !== exhumationPlotFilterZone) return false;
                  if (exhumationPlotSearchCode && !p.plot_code.toLowerCase().includes(exhumationPlotSearchCode.toLowerCase())) return false;
                  return true;
                });
                const uniqueZones = Array.from(new Set(exhumationPlots.map((p) => p.zone_code).filter((z): z is string => Boolean(z)))).sort();

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                        2. Trình Quản Lý &amp; Chọn Ô Mộ Đang An Táng (Chống Cải Táng Kim Tĩnh Bất Biến):
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setExhumationPlotViewMode('cards')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid #CBD5E1',
                            backgroundColor: exhumationPlotViewMode === 'cards' ? '#B45309' : '#FFFFFF',
                            color: exhumationPlotViewMode === 'cards' ? '#FFFFFF' : '#475569',
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
                          onClick={() => setExhumationPlotViewMode('matrix')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid #CBD5E1',
                            backgroundColor: exhumationPlotViewMode === 'matrix' ? '#B45309' : '#FFFFFF',
                            color: exhumationPlotViewMode === 'matrix' ? '#FFFFFF' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Grid size={14} />
                          <span>Sơ Đồ Lưới</span>
                        </button>
                      </div>
                    </div>

                    {/* Selected Plot Banner */}
                    {selectedExhumationPlot && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#FFFBEB',
                          border: '1.5px solid #D97706',
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
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', backgroundColor: '#FDE68A', padding: '2px 8px', borderRadius: '4px' }}>
                              Ô ĐÃ CHỌN CẢI TÁNG: {selectedExhumationPlot.plot_code}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#B45309' }}>
                              {selectedExhumationPlot.type_name}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                              ✓ Đủ Điều Kiện Cải Táng (Hài cốt: {exhumationDeceasedName || 'Huyệt 1'})
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#B45309', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span><strong>Khu:</strong> {selectedExhumationPlot.zone_name}</span>
                            <span><strong>Hàng:</strong> {selectedExhumationPlot.row_code}</span>
                            <span><strong>Huyệt đang an táng:</strong> Số {exhumationSlotNumber || 1}</span>
                          </div>
                        </div>
                        <CheckCircle size={24} color="#D97706" />
                      </div>
                    )}

                    {/* Filter bar */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <select
                        value={exhumationPlotFilterZone}
                        onChange={(e) => setExhumationPlotFilterZone(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                      >
                        <option value="">-- Tất cả khu mộ --</option>
                        {uniqueZones.map((z) => (
                          <option key={z} value={z}>Khu {z}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Lọc mã ô (VD: M-01)..."
                        value={exhumationPlotSearchCode}
                        onChange={(e) => setExhumationPlotSearchCode(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', minWidth: '140px' }}
                      />
                    </div>

                    {/* Plots container */}
                    {exhumationPlots.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>
                          Khách hàng này hiện chưa đứng tên sở hữu ô mộ nào trong hệ thống.
                        </div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                          Vui lòng kiểm tra lại thông tin chủ hộ hoặc chọn khách hàng khác ở Bước 1.
                        </div>
                      </div>
                    ) : (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                          {filteredPlots.map((p) => {
                            const isKimTinh = Boolean(p.is_kim_tinh);
                            const isOccupied = p.status === 'OCCUPIED';
                            const isSelected = selectedExhumationPlot?.plot_id === p.plot_id;

                            // Rule #2: Kim Tinh plots are strictly immutable and locked
                            if (isKimTinh) {
                              return (
                                <div
                                  key={p.plot_id}
                                  style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #FECACA',
                                    backgroundColor: '#FEF2F2',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B' }}>
                                        {p.plot_code} - Khu {p.zone_name}
                                      </span>
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>
                                        🔒 KIM TĨNH BẤT BIẾN
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#B91C1C', marginTop: '6px', lineHeight: '1.4' }}>
                                      Quy tắc bất biến: Ô mộ xây theo chuẩn Kim Tĩnh bị khóa vĩnh viễn mức CSDL, tuyệt đối không được phép cải táng hay di dời.
                                    </div>
                                  </div>
                                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#991B1B', fontWeight: 600 }}>
                                    [Khóa Nghiệp Vụ - Cấm Cải Táng]
                                  </div>
                                </div>
                              );
                            }

                            // Empty plots cannot be exhumed
                            if (!isOccupied) {
                              return (
                                <div
                                  key={p.plot_id}
                                  style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #E2E8F0',
                                    backgroundColor: '#F8FAFC',
                                    opacity: 0.75,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#475569' }}>
                                        {p.plot_code} - Khu {p.zone_name}
                                      </span>
                                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>
                                        ĐẤT TRỐNG
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                      Ô mộ chưa an táng hài cốt nào, không áp dụng thủ tục cải táng.
                                    </div>
                                  </div>
                                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#94A3B8' }}>
                                    Hàng {p.row_code} • {p.type_name}
                                  </div>
                                </div>
                              );
                            }

                            // Eligible Occupied Plot
                            return (
                              <div
                                key={p.plot_id}
                                onClick={() => handleSelectExhumationPlot(p)}
                                style={{
                                  padding: '12px',
                                  borderRadius: '8px',
                                  border: isSelected ? '2px solid #D97706' : '1px solid #FDE68A',
                                  backgroundColor: isSelected ? '#FFFBEB' : '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  boxShadow: isSelected ? '0 4px 6px -1px rgba(217, 119, 6, 0.15)' : 'none',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>
                                      {p.plot_code} - Khu {p.zone_name}
                                    </span>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400E', backgroundColor: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                                      KHẢ DỤNG CẢI TÁNG
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                    Hàng: {p.row_code} • {p.type_name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                                    Trạng thái: Đang an táng ({p.default_slots} huyệt)
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  style={{
                                    marginTop: '10px',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    border: 'none',
                                    backgroundColor: isSelected ? '#B45309' : '#F1F5F9',
                                    color: isSelected ? '#FFFFFF' : '#334155',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isSelected ? 'Đang chọn ô này' : 'Chọn ô cải táng'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* STEP 3: EXHUMATION PLAN, DESTINATION & FEE */}
              {exhumationStep === 3 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '14px' }}>
                    3. Kế hoạch di dời, phương tiện &amp; đơn giá dịch vụ cải táng:
                  </div>

                  <div className="responsive-form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Ngày Cải Táng Dự Kiến (*)
                      </label>
                      <input
                        type="date"
                        value={exhumationDate}
                        onChange={(e) => setExhumationDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Phí Dịch Vụ Cải Táng Trọn Gói (VNĐ) (*)
                      </label>
                      <input
                        type="number"
                        value={exhumationFee}
                        onChange={(e) => setExhumationFee(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div className="responsive-form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Địa Điểm Di Dời Hài Cốt / Nơi An Táng Mới (*)
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Nghĩa trang quê nhà, Nhà lưu tro cốt..."
                        value={exhumationDestination}
                        onChange={(e) => setExhumationDestination(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Phương Tiện &amp; Đơn Vị Hỗ Trợ Vận Chuyển
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Xe chuyên dụng Ban Quản Trang"
                        value={exhumationTransport}
                        onChange={(e) => setExhumationTransport(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Lý Do Cải Táng &amp; Nguyện Vọng Gia Quyến
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Di dời về nghĩa trang gia đình, cải táng theo nguyện vọng phụ mẫu..."
                      value={exhumationReason}
                      onChange={(e) => setExhumationReason(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & CONFIRM EXHUMATION DRAFT */}
              {exhumationStep === 4 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '14px' }}>
                    4. Xem trước &amp; Xác nhận dự thảo hợp đồng cải táng:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                    {/* Card 1: Customer */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Bên Đứng Tên Hợp Đồng
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        {exhumationCustomer?.full_name} ({exhumationCustomer?.customer_code})
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                        CCCD: {exhumationCustomer?.citizen_id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        SĐT: {exhumationCustomer?.phone_number}
                      </div>
                    </div>

                    {/* Card 2: Plot & Slot */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Ô Mộ &amp; Hài Cốt Cải Táng
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400E' }}>
                        Ô {selectedExhumationPlot?.plot_code} - Khu {selectedExhumationPlot?.zone_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#B45309', marginTop: '4px' }}>
                        Huyệt số: {exhumationSlotNumber || 1} • {exhumationDeceasedName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, marginTop: '2px' }}>
                        Quy cách thông thường (Không phải Kim Tĩnh)
                      </div>
                    </div>

                    {/* Card 3: Plan & Fee */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Kế Hoạch &amp; Chi Phí
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        <strong>Ngày cải táng:</strong> {formatDate(exhumationDate)}
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                        <strong>Nơi di dời:</strong> {exhumationDestination}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#B45309', marginTop: '6px' }}>
                        Tổng phí: {formatCurrency(exhumationFee)}
                      </div>
                    </div>

                    {/* Card 4: Legal & Invariant Notice */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Cam Kết Quy Chuẩn Vệ Sinh
                      </div>
                      <div style={{ fontSize: '12px', color: '#1E40AF', lineHeight: '1.4' }}>
                        Tuân thủ nghiêm ngặt quy định y tế môi trường. Sau khi hoàn tất cất bốc hài cốt, mặt bằng ô mộ sẽ được giải phóng hoàn nguyên về trạng thái đất trống.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
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
              <button
                type="button"
                onClick={() => setIsExhumationModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {exhumationStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setExhumationStep((s) => s - 1)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Quay Lại
                  </button>
                )}

                {exhumationStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (exhumationStep === 1 && !exhumationCustomer) {
                        setExhumationError('Vui lòng chọn khách hàng đứng tên hợp đồng cải táng');
                        return;
                      }
                      if (exhumationStep === 2 && (!selectedExhumationPlot || !exhumationSlotId)) {
                        setExhumationError('Vui lòng chọn ô mộ và huyệt có hài cốt để cải táng');
                        return;
                      }
                      setExhumationError(null);
                      setExhumationStep((s) => s + 1);
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#B45309',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tiếp Theo &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateExhumationContract}
                    disabled={exhumationSubmitting}
                    style={{
                      padding: '8px 22px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#B45309',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {exhumationSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus size={15} />}
                    <span>Tạo Dự Thảo Cải Táng</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* M08: Transfer Contract 4-Step Wizard Modal */}
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
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#4338CA',
                color: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ArrowRightLeft size={22} color="#FFFFFF" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                    Quy Trình Lập Hợp Đồng Chuyển Nhượng Quyền Sử Dụng Đất
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                    Bước {transferStep}/4: {transferStep === 1 && 'Bên Chuyển Nhượng (Bên A)'}
                    {transferStep === 2 && 'Trình Quản Lý & Chọn Ô Mộ Chuyển Nhượng'}
                    {transferStep === 3 && 'Bên Nhận Chuyển Nhượng (Bên B) & Thỏa Thuận'}
                    {transferStep === 4 && 'Xác Nhận & Xem Trước Dự Thảo'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '12px 24px',
                gap: '8px',
              }}
            >
              {[
                { step: 1, label: 'Bên chuyển nhượng' },
                { step: 2, label: 'Ô mộ chuyển nhượng' },
                { step: 3, label: 'Bên nhận & Phí' },
                { step: 4, label: 'Xác nhận dự thảo' },
              ].map((s) => (
                <div
                  key={s.step}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: transferStep >= s.step ? '#4338CA' : '#94A3B8',
                    fontWeight: transferStep === s.step ? 700 : 500,
                    fontSize: '13px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: transferStep >= s.step ? '#4338CA' : '#E2E8F0',
                      color: transferStep >= s.step ? '#FFFFFF' : '#64748B',
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
              {transferError && (
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
                  <span>{transferError}</span>
                </div>
              )}

              {/* STEP 1: SELECT SELLER */}
              {transferStep === 1 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                      1. Tra cứu Bên Chuyển Nhượng (Chủ sở hữu hiện tại đứng tên):
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCustError(null);
                        setQuickCustTarget('TRANSFER_SELLER');
                        setIsQuickCustModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #4338CA',
                        backgroundColor: '#EEF2FF',
                        color: '#4338CA',
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

                  {/* Inline Quick Add Customer Form */}
                  {renderQuickCustomerSection('TRANSFER_SELLER')}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                      <input
                        type="text"
                        placeholder="Tìm theo họ tên, CCCD hoặc số điện thoại bên chuyển nhượng..."
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

                  {transferSeller && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#EEF2FF',
                        border: '1px solid #C7D2FE',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase' }}>
                            Đã Chọn Bên Chuyển Nhượng (Chủ Mộ Hiện Tại)
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#3730A3', marginTop: '2px' }}>
                            {transferSeller.full_name} ({transferSeller.customer_code})
                          </div>
                          <div style={{ fontSize: '12px', color: '#4338CA', marginTop: '2px' }}>
                            CCCD: {transferSeller.citizen_id} | SĐT: {transferSeller.phone_number} | Địa chỉ: {transferSeller.address}
                          </div>
                        </div>
                        <CheckCircle size={24} color="#4338CA" />
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
                            setQuickCustTarget('TRANSFER_SELLER');
                            setIsQuickCustModalOpen(true);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #4338CA',
                            backgroundColor: '#EEF2FF',
                            color: '#4338CA',
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
                          onClick={() => handleSelectTransferSeller(c)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: transferSeller?.customer_id === c.customer_id ? '#EEF2FF' : '#FFFFFF',
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
                              backgroundColor: transferSeller?.customer_id === c.customer_id ? '#4338CA' : '#FFFFFF',
                              color: transferSeller?.customer_id === c.customer_id ? '#FFFFFF' : '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            {transferSeller?.customer_id === c.customer_id ? 'Đang chọn' : 'Chọn Bên A'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: ADVANCED TRANSFER PLOT MANAGER (ELIGIBLE EMPTY PLOTS ONLY) */}
              {transferStep === 2 && (() => {
                const filteredPlots = transferPlots.filter((p) => {
                  if (transferPlotFilterZone && p.zone_code !== transferPlotFilterZone) return false;
                  if (transferPlotSearchCode && !p.plot_code.toLowerCase().includes(transferPlotSearchCode.toLowerCase())) return false;
                  return true;
                });
                const uniqueZones = Array.from(new Set(transferPlots.map((p) => p.zone_code).filter((z): z is string => Boolean(z)))).sort();

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                        2. Trình Quản Lý &amp; Chọn Ô Mộ Chuyển Nhượng (Chỉ Đất Trống Chưa An Táng):
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setTransferPlotViewMode('cards')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid #CBD5E1',
                            backgroundColor: transferPlotViewMode === 'cards' ? '#4338CA' : '#FFFFFF',
                            color: transferPlotViewMode === 'cards' ? '#FFFFFF' : '#475569',
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
                          onClick={() => setTransferPlotViewMode('matrix')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid #CBD5E1',
                            backgroundColor: transferPlotViewMode === 'matrix' ? '#4338CA' : '#FFFFFF',
                            color: transferPlotViewMode === 'matrix' ? '#FFFFFF' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Grid size={14} />
                          <span>Sơ Đồ Lưới</span>
                        </button>
                      </div>
                    </div>

                    {/* Selected Plot Banner */}
                    {selectedTransferPlot && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#EEF2FF',
                          border: '1.5px solid #4338CA',
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
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#3730A3', textTransform: 'uppercase', backgroundColor: '#C7D2FE', padding: '2px 8px', borderRadius: '4px' }}>
                              Ô ĐÃ CHỌN CHUYỂN NHƯỢNG: {selectedTransferPlot.plot_code}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#4338CA' }}>
                              {selectedTransferPlot.type_name}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                              ✓ Đủ Điều Kiện: Đất Trống Chính Chủ
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#4338CA', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span><strong>Khu:</strong> {selectedTransferPlot.zone_name}</span>
                            <span><strong>Hàng:</strong> {selectedTransferPlot.row_code}</span>
                            <span><strong>Quy cách:</strong> {selectedTransferPlot.plot_length || 2.5}m × {selectedTransferPlot.plot_width || 1.2}m</span>
                          </div>
                        </div>
                        <CheckCircle size={24} color="#4338CA" />
                      </div>
                    )}

                    {/* Filter bar */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <select
                        value={transferPlotFilterZone}
                        onChange={(e) => setTransferPlotFilterZone(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                      >
                        <option value="">-- Tất cả khu mộ --</option>
                        {uniqueZones.map((z) => (
                          <option key={z} value={z}>Khu {z}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Lọc mã ô (VD: M-01)..."
                        value={transferPlotSearchCode}
                        onChange={(e) => setTransferPlotSearchCode(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '12px', minWidth: '140px' }}
                      />
                    </div>

                    {/* Plots container */}
                    {transferPlots.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>
                          Bên chuyển nhượng hiện chưa đứng tên sở hữu ô mộ nào.
                        </div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                          Vui lòng kiểm tra lại bên chuyển nhượng ở Bước 1.
                        </div>
                      </div>
                    ) : (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                          {filteredPlots.map((p) => {
                            const isKimTinh = Boolean(p.is_kim_tinh);
                            const isOccupied = p.status === 'OCCUPIED';
                            const isEligible = p.status === 'OWNED_EMPTY' && !isKimTinh;
                            const isSelected = selectedTransferPlot?.plot_id === p.plot_id;

                            // Rule #2: Kim Tinh cannot be transferred
                            if (isKimTinh) {
                              return (
                                <div
                                  key={p.plot_id}
                                  style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #FECACA',
                                    backgroundColor: '#FEF2F2',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B' }}>
                                        {p.plot_code} - Khu {p.zone_name}
                                      </span>
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>
                                        🔒 KIM TĨNH
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#B91C1C', marginTop: '6px', lineHeight: '1.4' }}>
                                      Ô mộ Kim Tĩnh bị khóa vĩnh viễn theo quy định, không được phép chuyển nhượng.
                                    </div>
                                  </div>
                                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#991B1B', fontWeight: 600 }}>
                                    [Khóa Nghiệp Vụ - Cấm Chuyển Nhượng]
                                  </div>
                                </div>
                              );
                            }

                            // Occupied plots cannot be transferred
                            if (isOccupied) {
                              return (
                                <div
                                  key={p.plot_id}
                                  style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #FECACA',
                                    backgroundColor: '#FEF2F2',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B' }}>
                                        {p.plot_code} - Khu {p.zone_name}
                                      </span>
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>
                                        🔒 ĐÃ AN TÁNG
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#B91C1C', marginTop: '6px', lineHeight: '1.4' }}>
                                      Ô mộ đã an táng hài cốt, tuyệt đối không được phép chuyển nhượng quyền sử dụng đất.
                                    </div>
                                  </div>
                                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#991B1B', fontWeight: 600 }}>
                                    [Không Đạt Điều Kiện Đất Trống]
                                  </div>
                                </div>
                              );
                            }

                            // Eligible Empty Plot
                            return (
                              <div
                                key={p.plot_id}
                                onClick={() => isEligible && setSelectedTransferPlot(p)}
                                style={{
                                  padding: '12px',
                                  borderRadius: '8px',
                                  border: isSelected ? '2px solid #4338CA' : '1px solid #C7D2FE',
                                  backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  boxShadow: isSelected ? '0 4px 6px -1px rgba(67, 56, 202, 0.15)' : 'none',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>
                                      {p.plot_code} - Khu {p.zone_name}
                                    </span>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#3730A3', backgroundColor: '#E0E7FF', padding: '2px 6px', borderRadius: '4px' }}>
                                      ĐẤT TRỐNG CHÍNH CHỦ
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                    Hàng: {p.row_code} • {p.type_name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                                    Trạng thái: Đất trống chưa an táng (Sẵn sàng sang tên)
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  style={{
                                    marginTop: '10px',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    border: 'none',
                                    backgroundColor: isSelected ? '#4338CA' : '#F1F5F9',
                                    color: isSelected ? '#FFFFFF' : '#334155',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isSelected ? 'Đang chọn ô này' : 'Chọn ô chuyển nhượng'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* STEP 3: SELECT BUYER & FINANCIAL TERMS */}
              {transferStep === 3 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                      3. Tra cứu Bên Nhận Chuyển Nhượng (Chủ sở hữu mới):
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCustError(null);
                        setQuickCustTarget('TRANSFER_BUYER');
                        setIsQuickCustModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #16A34A',
                        backgroundColor: '#F0FDF4',
                        color: '#16A34A',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <UserPlus size={14} />
                      <span>+ Thêm Bên Nhận Nhanh</span>
                    </button>
                  </div>

                  {/* Inline Quick Add Customer Form */}
                  {renderQuickCustomerSection('TRANSFER_BUYER')}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                      <input
                        type="text"
                        placeholder="Tìm theo họ tên, CCCD hoặc số điện thoại bên nhận..."
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

                  {transferBuyer && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: transferBuyer.customer_id === transferSeller?.customer_id ? '#FEF2F2' : '#ECFDF5',
                        border: transferBuyer.customer_id === transferSeller?.customer_id ? '1px solid #FECACA' : '1px solid #A7F3D0',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: transferBuyer.customer_id === transferSeller?.customer_id ? '#991B1B' : '#065F46', textTransform: 'uppercase' }}>
                            {transferBuyer.customer_id === transferSeller?.customer_id ? '⚠ LỖI: TRÙNG BÊN CHUYỂN NHƯỢNG' : 'Đã Chọn Bên Nhận Chuyển Nhượng (Bên B)'}
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: transferBuyer.customer_id === transferSeller?.customer_id ? '#991B1B' : '#065F46', marginTop: '2px' }}>
                            {transferBuyer.full_name} ({transferBuyer.customer_code})
                          </div>
                          <div style={{ fontSize: '12px', color: transferBuyer.customer_id === transferSeller?.customer_id ? '#B91C1C' : '#047857', marginTop: '2px' }}>
                            CCCD: {transferBuyer.citizen_id} | SĐT: {transferBuyer.phone_number} | Địa chỉ: {transferBuyer.address}
                          </div>
                        </div>
                        {transferBuyer.customer_id === transferSeller?.customer_id ? (
                          <ShieldAlert size={24} color="#DC2626" />
                        ) : (
                          <CheckCircle size={24} color="#059669" />
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: '16px' }}>
                    {custResults
                      .filter((c) => c.customer_id !== transferSeller?.customer_id)
                      .map((c) => (
                        <div
                          key={c.customer_id}
                          onClick={() => setTransferBuyer(c)}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: transferBuyer?.customer_id === c.customer_id ? '#DCFCE7' : '#FFFFFF',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>{c.full_name}</span>{' '}
                            <span style={{ fontSize: '12px', color: '#64748B' }}>({c.customer_code} • {c.phone_number})</span>
                          </div>
                          <button
                            type="button"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: transferBuyer?.customer_id === c.customer_id ? '#16A34A' : '#FFFFFF',
                              color: transferBuyer?.customer_id === c.customer_id ? '#FFFFFF' : '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            {transferBuyer?.customer_id === c.customer_id ? 'Đang chọn' : 'Chọn Bên B'}
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Fee & Agreement */}
                  <div className="responsive-form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Phí Thủ Tục Chuyển Nhượng Quản Trang (VNĐ) (*)
                      </label>
                      <input
                        type="number"
                        value={transferCommission}
                        onChange={(e) => setTransferCommission(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Giá Trị Chuyển Nhượng Thỏa Thuận Giữa Hai Bên (VNĐ)
                      </label>
                      <input
                        type="number"
                        value={transferPrice}
                        onChange={(e) => setTransferPrice(e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Lý Do Chuyển Nhượng &amp; Cam Kết Giữa Hai Bên
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Chuyển nhượng quyền sử dụng theo biên bản tự nguyện giữa hai bên gia đình..."
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & CONFIRM TRANSFER DRAFT */}
              {transferStep === 4 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '14px' }}>
                    4. Xem trước &amp; Xác nhận dự thảo hợp đồng chuyển nhượng:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                    {/* Card 1: Seller */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Bên Chuyển Nhượng (Bên A - Chủ Cũ)
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#3730A3' }}>
                        {transferSeller?.full_name} ({transferSeller?.customer_code})
                      </div>
                      <div style={{ fontSize: '12px', color: '#4338CA', marginTop: '4px' }}>
                        CCCD: {transferSeller?.citizen_id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4338CA' }}>
                        SĐT: {transferSeller?.phone_number}
                      </div>
                    </div>

                    {/* Card 2: Buyer */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Bên Nhận Chuyển Nhượng (Bên B - Chủ Mới)
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#065F46' }}>
                        {transferBuyer?.full_name} ({transferBuyer?.customer_code})
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857', marginTop: '4px' }}>
                        CCCD: {transferBuyer?.citizen_id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857' }}>
                        SĐT: {transferBuyer?.phone_number}
                      </div>
                    </div>

                    {/* Card 3: Plot */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Ô Mộ Chuyển Giao Quyền Sử Dụng
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        Ô {selectedTransferPlot?.plot_code} - Khu {selectedTransferPlot?.zone_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                        Hàng: {selectedTransferPlot?.row_code} • {selectedTransferPlot?.type_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                        Đất trống chính chủ, không có hài cốt
                      </div>
                    </div>

                    {/* Card 4: Fee & Agreement */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Biểu Phí &amp; Giá Thỏa Thuận
                      </div>
                      <div style={{ fontSize: '13px', color: '#92400E' }}>
                        <strong>Phí hành chính Ban Quản Trang:</strong> {formatCurrency(transferCommission)}
                      </div>
                      {Number(transferPrice) > 0 && (
                        <div style={{ fontSize: '13px', color: '#92400E', marginTop: '2px' }}>
                          <strong>Giá thỏa thuận 2 bên:</strong> {formatCurrency(transferPrice)}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#B45309', marginTop: '4px', lineHeight: '1.4' }}>
                        Quyền sử dụng ô mộ sẽ được tự động cập nhật sổ bộ sang Bên B ngay khi hợp đồng được ký kết và kích hoạt.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
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
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {transferStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setTransferStep((s) => s - 1)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Quay Lại
                  </button>
                )}

                {transferStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (transferStep === 1 && !transferSeller) {
                        setTransferError('Vui lòng chọn bên chuyển nhượng (Bên A)');
                        return;
                      }
                      if (transferStep === 2 && !selectedTransferPlot) {
                        setTransferError('Vui lòng chọn ô mộ đất trống đủ điều kiện để chuyển nhượng');
                        return;
                      }
                      if (transferStep === 3 && !transferBuyer) {
                        setTransferError('Vui lòng chọn bên nhận chuyển nhượng (Bên B)');
                        return;
                      }
                      if (transferStep === 3 && transferBuyer && transferSeller && transferBuyer.customer_id === transferSeller.customer_id) {
                        setTransferError('Bên nhận chuyển nhượng phải khác bên chuyển nhượng!');
                        return;
                      }
                      setTransferError(null);
                      setTransferStep((s) => s + 1);
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#4338CA',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tiếp Theo &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateTransferContract}
                    disabled={transferSubmitting}
                    style={{
                      padding: '8px 22px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#4338CA',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {transferSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus size={15} />}
                    <span>Tạo Dự Thảo Chuyển Nhượng</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* M08: Cremation Contract 4-Step Wizard Modal */}
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
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#C2410C',
                color: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Flame size={22} color="#FFFFFF" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                    Quy Trình Lập Hợp Đồng Dịch Vụ Hỏa Táng Trọn Gói
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                    Bước {cremationStep}/4: {cremationStep === 1 && 'Khách Hàng Đăng Ký (Thân Nhân/Đại Diện)'}
                    {cremationStep === 2 && 'Hồ Sơ Người Quá Cố & Giấy Báo Tử'}
                    {cremationStep === 3 && 'Gói Dịch Vụ, Lịch Hỏa Táng & Lưu Trữ Tro Cốt'}
                    {cremationStep === 4 && 'Xác Nhận & Xem Trước Dự Thảo Hợp Đồng'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsCremationModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '12px 24px',
                gap: '8px',
              }}
            >
              {[
                { step: 1, label: 'Khách hàng đăng ký' },
                { step: 2, label: 'Hồ sơ người quá cố' },
                { step: 3, label: 'Gói dịch vụ & Lịch lễ' },
                { step: 4, label: 'Xác nhận dự thảo' },
              ].map((s) => (
                <div
                  key={s.step}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: cremationStep >= s.step ? '#C2410C' : '#94A3B8',
                    fontWeight: cremationStep === s.step ? 700 : 500,
                    fontSize: '13px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: cremationStep >= s.step ? '#C2410C' : '#E2E8F0',
                      color: cremationStep >= s.step ? '#FFFFFF' : '#64748B',
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
              {cremationError && (
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
                  <span>{cremationError}</span>
                </div>
              )}

              {/* STEP 1: SELECT CUSTOMER */}
              {cremationStep === 1 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                      1. Tra cứu Khách hàng đại diện đăng ký dịch vụ hỏa táng (Bên A):
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCustError(null);
                        setQuickCustTarget('CREMATION');
                        setIsQuickCustModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #C2410C',
                        backgroundColor: '#FFF7ED',
                        color: '#C2410C',
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

                  {/* Inline Quick Add Customer Form */}
                  {renderQuickCustomerSection('CREMATION')}

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

                  {/* Selected Customer Banner */}
                  {cremationCustomer && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#FFF7ED',
                        border: '1px solid #FDBA74',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase' }}>
                            Đã Chọn Khách Hàng Đại Diện Đăng Ký
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#9A3412', marginTop: '2px' }}>
                            {cremationCustomer.full_name} ({cremationCustomer.customer_code})
                          </div>
                          <div style={{ fontSize: '12px', color: '#C2410C', marginTop: '2px' }}>
                            CCCD: {cremationCustomer.citizen_id} | SĐT: {cremationCustomer.phone_number} | Địa chỉ: {cremationCustomer.address}
                          </div>
                        </div>
                        <CheckCircle size={24} color="#C2410C" />
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
                            setQuickCustTarget('CREMATION');
                            setIsQuickCustModalOpen(true);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #C2410C',
                            backgroundColor: '#FFF7ED',
                            color: '#C2410C',
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
                          onClick={() => setCremationCustomer(c)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: cremationCustomer?.customer_id === c.customer_id ? '#FFF7ED' : '#FFFFFF',
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
                              border: 'none',
                              backgroundColor: cremationCustomer?.customer_id === c.customer_id ? '#C2410C' : '#F1F5F9',
                              color: cremationCustomer?.customer_id === c.customer_id ? '#FFFFFF' : '#334155',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {cremationCustomer?.customer_id === c.customer_id ? 'Đang chọn' : 'Chọn'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT DECEASED & VERIFY DEATH CERTIFICATE */}
              {cremationStep === 2 && (
                <div>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <FileCheck size={18} color="#1D4ED8" />
                    <div style={{ fontSize: '12px', color: '#1E40AF', lineHeight: '1.4' }}>
                      <strong>Quy định pháp lý bắt buộc:</strong> Căn cứ Nghị định 23/2016/NĐ-CP, dịch vụ hỏa táng bắt buộc phải có Giấy Báo Tử do cơ quan thẩm quyền cấp trước khi thực hiện lễ hỏa táng.
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>
                      2. Tra cứu Hồ sơ Người Quá Cố &amp; Xác minh Giấy Báo Tử:
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickDeceasedError(null);
                        setIsQuickDeceasedModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #C2410C',
                        backgroundColor: '#FFF7ED',
                        color: '#C2410C',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <UserPlus size={14} />
                      <span>+ Thêm Hồ Sơ Người Quá Cố Nhanh</span>
                    </button>
                  </div>

                  {/* Inline Quick Add Deceased Form */}
                  {renderQuickDeceasedSection()}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                      <input
                        type="text"
                        placeholder="Tìm theo tên người quá cố hoặc mã hồ sơ..."
                        value={cremationSearchDeceasedVal}
                        onChange={(e) => {
                          setCremationSearchDeceasedVal(e.target.value);
                          searchCremationDeceased(e.target.value);
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

                  {/* Selected Deceased Banner */}
                  {selectedCremationDeceased && (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#FFF7ED',
                        border: '1.5px solid #FDBA74',
                        marginBottom: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase' }}>
                            ĐÃ CHỌN NGƯỜI QUÁ CỐ: {selectedCremationDeceased.full_name} ({selectedCremationDeceased.deceased_code})
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: selectedCremationDeceased.has_death_certificate ? '#166534' : '#B45309',
                              backgroundColor: selectedCremationDeceased.has_death_certificate ? '#DCFCE7' : '#FEF3C7',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {selectedCremationDeceased.has_death_certificate
                              ? '✓ ĐÃ XÁC MINH GIẤY BÁO TỬ'
                              : '⚠️ CHƯA CÓ GIẤY BÁO TỬ (Cần bổ sung trước ngày thiêu)'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#9A3412', marginTop: '4px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <span><strong>Ngày mất:</strong> {formatDate(selectedCremationDeceased.date_of_death)}</span>
                          {selectedCremationDeceased.date_of_birth && (
                            <span><strong>Ngày sinh:</strong> {formatDate(selectedCremationDeceased.date_of_birth)}</span>
                          )}
                          <span><strong>Giới tính:</strong> {selectedCremationDeceased.gender === 'MALE' ? 'Nam' : 'Nữ'}</span>
                          {selectedCremationDeceased.death_certificate_number && (
                            <span><strong>Số GBT:</strong> {selectedCremationDeceased.death_certificate_number}</span>
                          )}
                        </div>
                      </div>
                      <CheckCircle size={24} color="#C2410C" />
                    </div>
                  )}

                  {/* Deceased List */}
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                    {cremationDeceasedList.length === 0 ? (
                      <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                        <div style={{ color: '#94A3B8', fontSize: '13px', marginBottom: '8px' }}>
                          Không tìm thấy hồ sơ người quá cố phù hợp.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickDeceasedError(null);
                            setIsQuickDeceasedModalOpen(true);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #C2410C',
                            backgroundColor: '#FFF7ED',
                            color: '#C2410C',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          + Thêm Hồ Sơ Người Quá Cố Mới
                        </button>
                      </div>
                    ) : (
                      cremationDeceasedList.map((d) => (
                        <div
                          key={d.deceased_id}
                          onClick={() => setSelectedCremationDeceased(d)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: selectedCremationDeceased?.deceased_id === d.deceased_id ? '#FFF7ED' : '#FFFFFF',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>{d.full_name}</span>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>({d.deceased_code})</span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: d.has_death_certificate ? '#166534' : '#B45309',
                                  backgroundColor: d.has_death_certificate ? '#DCFCE7' : '#FEF3C7',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {d.has_death_certificate ? '✓ Đủ Giấy Báo Tử' : 'Thiếu Giấy Báo Tử'}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              Ngày mất: {formatDate(d.date_of_death)} • Giới tính: {d.gender === 'MALE' ? 'Nam' : 'Nữ'}
                              {d.death_certificate_number && ` • Số GBT: ${d.death_certificate_number}`}
                            </div>
                          </div>
                          <button
                            type="button"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: selectedCremationDeceased?.deceased_id === d.deceased_id ? '#C2410C' : '#F1F5F9',
                              color: selectedCremationDeceased?.deceased_id === d.deceased_id ? '#FFFFFF' : '#334155',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {selectedCremationDeceased?.deceased_id === d.deceased_id ? 'Đang chọn' : 'Chọn hồ sơ'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: CREMATION PACKAGE & LOGISTICS */}
              {cremationStep === 3 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '10px' }}>
                    3. Chọn Gói Dịch Vụ Hỏa Táng Trọn Gói:
                  </div>

                  {/* 3 Package Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                    {[
                      {
                        code: 'HOA_TANG_TIEU_CHUAN',
                        title: 'Tiêu Chuẩn',
                        price: 8500000,
                        tag: 'Phổ biến',
                        features: [
                          'Lò hỏa táng điện hiện đại không khói',
                          'Nghi lễ cử hành tiễn biệt 30 phút',
                          'Hũ đựng tro cốt gốm sứ hoa văn',
                          'Thời gian hoàn tất và nhận tro cốt: 2-3 giờ',
                        ],
                      },
                      {
                        code: 'HOA_TANG_VIP',
                        title: 'VIP Nghi Lễ',
                        price: 15000000,
                        tag: 'Trang trọng',
                        features: [
                          'Phòng hành lễ riêng biệt có máy lạnh & hoa tươi',
                          'Đội ngũ điều phối nghi thức tôn giáo trang nghiêm',
                          'Thời gian cử hành nghi lễ tiễn biệt 60 phút',
                          'Hũ tro cốt sứ cao cấp men lam truyền thống',
                        ],
                      },
                      {
                        code: 'HOA_TANG_CAO_CAP',
                        title: 'Cao Cấp Trọn Gói',
                        price: 25000000,
                        tag: 'Đặc biệt',
                        features: [
                          'Xe chuyên dụng đón rước linh cữu chuẩn mực',
                          'Lễ đường VIP độc lập toàn diện dành cho gia quyến',
                          'Hũ ngọc bích cao cấp dát viền chỉ vàng sang trọng',
                          'Tặng 1 năm lưu giữ miễn phí tại Tháp Cốt Địa Tạng',
                        ],
                      },
                    ].map((pkg) => {
                      const isSelected = cremationPackage === pkg.code;
                      return (
                        <div
                          key={pkg.code}
                          onClick={() => {
                            setCremationPackage(pkg.code);
                            setCremationFee(String(pkg.price));
                          }}
                          style={{
                            padding: '14px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #C2410C' : '1px solid #E2E8F0',
                            backgroundColor: isSelected ? '#FFF7ED' : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: isSelected ? '0 4px 6px -1px rgba(194, 65, 12, 0.15)' : 'none',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: isSelected ? '#C2410C' : '#1E293B' }}>
                                {pkg.title}
                              </h4>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor: isSelected ? '#FFEDD5' : '#F1F5F9',
                                  color: isSelected ? '#9A3412' : '#64748B',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {pkg.tag}
                              </span>
                            </div>
                            <div style={{ fontSize: '17px', fontWeight: 800, color: '#C2410C', marginTop: '6px' }}>
                              {formatCurrency(pkg.price)}
                            </div>
                            <ul style={{ margin: '10px 0 0 0', paddingLeft: '16px', fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                              {pkg.features.map((f, idx) => (
                                <li key={idx} style={{ marginBottom: '3px' }}>{f}</li>
                              ))}
                            </ul>
                          </div>
                          <button
                            type="button"
                            style={{
                              marginTop: '12px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isSelected ? '#C2410C' : '#F1F5F9',
                              color: isSelected ? '#FFFFFF' : '#475569',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {isSelected ? '✓ Đang chọn gói này' : 'Chọn gói này'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ceremony Date & Time */}
                  <div className="responsive-form-row" style={{ marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Ngày Tổ Chức Hỏa Táng (*)
                      </label>
                      <input
                        type="date"
                        value={cremationDate}
                        onChange={(e) => setCremationDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Khung Giờ Hỏa Táng Dự Kiến
                      </label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['07:30', '08:30', '10:00', '13:30', '15:00'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setCremationTime(t)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: cremationTime === t ? '1.5px solid #C2410C' : '1px solid #CBD5E1',
                              backgroundColor: cremationTime === t ? '#FFF7ED' : '#FFFFFF',
                              color: cremationTime === t ? '#C2410C' : '#475569',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Urn Storage Option & Service Fee */}
                  <div className="responsive-form-row" style={{ marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Tùy Chọn Lưu Trữ / An Vị Tro Cốt (*)
                      </label>
                      <select
                        value={cremationUrnOption}
                        onChange={(e) => setCremationUrnOption(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                      >
                        <option value="Lưu tháp cốt Địa Tạng">Lưu tháp cốt Địa Tạng (Khuôn viên trung tâm)</option>
                        <option value="Lưu bảo tháp Phước Duyên">Lưu bảo tháp Phước Duyên (Khuôn viên phía Đông)</option>
                        <option value="Gia đình tiếp nhận và mang về an vị">Gia đình tiếp nhận và mang về an vị tại gia</option>
                        <option value="An táng vào ô mộ gia tộc">An táng vào khuôn viên ô mộ gia tộc tại nghĩa trang</option>
                        <option value="Thủy táng / Rải tro cốt tại khuôn viên tưởng niệm">Thủy táng / Rải tro cốt tại khuôn viên tưởng niệm</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Phí Dịch Vụ Hỏa Táng (VNĐ) (*)
                      </label>
                      <input
                        type="number"
                        value={cremationFee}
                        onChange={(e) => setCremationFee(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {formatCurrency(cremationFee)}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Ghi Chú Yêu Cầu Nghi Thức &amp; Tâm Nguyện Gia Đình
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ghi chú về nghi thức tôn giáo (Phật giáo, Công giáo...), danh sách thân nhân tham dự, điều phối xe đón..."
                      value={cremationNotes}
                      onChange={(e) => setCremationNotes(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & CONFIRM */}
              {cremationStep === 4 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '14px' }}>
                    4. Xác nhận thông tin và kiểm tra dự thảo hợp đồng hỏa táng:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                    {/* Card 1: Customer */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Khách Hàng Đăng Ký (Bên A)
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        {cremationCustomer?.full_name} ({cremationCustomer?.customer_code})
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                        CCCD: {cremationCustomer?.citizen_id} • SĐT: {cremationCustomer?.phone_number}
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                        Địa chỉ: {cremationCustomer?.address}
                      </div>
                    </div>

                    {/* Card 2: Deceased */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Người Quá Cố Hỏa Táng
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        {selectedCremationDeceased?.full_name} ({selectedCremationDeceased?.deceased_code})
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                        Giới tính: {selectedCremationDeceased?.gender === 'MALE' ? 'Nam' : 'Nữ'} • Mất ngày: {formatDate(selectedCremationDeceased?.date_of_death)}
                      </div>
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: selectedCremationDeceased?.has_death_certificate ? '#166534' : '#B45309',
                            backgroundColor: selectedCremationDeceased?.has_death_certificate ? '#DCFCE7' : '#FEF3C7',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {selectedCremationDeceased?.has_death_certificate
                            ? `✓ Giấy báo tử: ${selectedCremationDeceased.death_certificate_number || 'Đã kiểm tra'}`
                            : '⚠️ Giấy báo tử chưa cập nhật (Cần bổ sung)'}
                        </span>
                      </div>
                    </div>

                    {/* Card 3: Ceremony & Urn */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#FFF7ED', border: '1px solid #FDBA74' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Gói Dịch Vụ &amp; Lịch Hỏa Táng
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#9A3412' }}>
                        {getCremationPackageName(cremationPackage)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#C2410C', marginTop: '4px' }}>
                        <strong>Ngày thực hiện:</strong> {formatDate(cremationDate)} ({cremationTime})
                      </div>
                      <div style={{ fontSize: '12px', color: '#C2410C', marginTop: '2px' }}>
                        <strong>Lưu tro cốt:</strong> {cremationUrnOption}
                      </div>
                    </div>

                    {/* Card 4: Fee & Confirmation */}
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Chi Phí &amp; Trạng Thái Dự Thảo
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534' }}>
                        {formatCurrency(cremationFee)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px', lineHeight: '1.4' }}>
                        Hợp đồng được tạo ở trạng thái Chờ Ký (DRAFT). Ban quản trang sẽ bố trí lò hỏa táng và điều phối nhân sự theo lịch hẹn đã đăng ký.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
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
              <button
                type="button"
                onClick={() => setIsCremationModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {cremationStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCremationStep((s) => s - 1)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Quay Lại
                  </button>
                )}

                {cremationStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (cremationStep === 1 && !cremationCustomer) {
                        setCremationError('Vui lòng chọn khách hàng đại diện đăng ký');
                        return;
                      }
                      if (cremationStep === 2 && !selectedCremationDeceased) {
                        setCremationError('Vui lòng chọn hồ sơ người quá cố');
                        return;
                      }
                      setCremationError(null);
                      setCremationStep((s) => s + 1);
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#C2410C',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tiếp Theo &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateCremationContract}
                    disabled={cremationSubmitting || !cremationCustomer || !selectedCremationDeceased}
                    style={{
                      padding: '8px 22px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#C2410C',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {cremationSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus size={15} />}
                    <span>Tạo Dự Thảo Hỏa Táng</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
