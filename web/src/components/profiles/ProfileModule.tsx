import React, { useState, useEffect } from 'react';
import { ExternalLink, MapPin, Shield, RefreshCw, Link2, Trash2 } from 'lucide-react';
import { Pagination, usePagination } from '../common/Pagination';
import type {
  Customer,
  CustomerCreate,
  DeceasedProfile,
  DeceasedProfileCreate,
  DeathCertificateCreate,
  DeceasedPublicLookupResponse,
  RelationDetail,
  RelationCreate,
} from '../../types/profiles';

interface ProfileModuleProps {
  token: string | null;
  currentUserRoles?: string[];
}

export const ProfileModule: React.FC<ProfileModuleProps> = ({ token, currentUserRoles: _currentUserRoles = [] }) => {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'DECEASED' | 'RELATIONS' | 'MEMORIAL_PUBLIC'>(
    token ? 'CUSTOMERS' : 'MEMORIAL_PUBLIC'
  );

  useEffect(() => {
    if (!token && activeTab !== 'MEMORIAL_PUBLIC') {
      setActiveTab('MEMORIAL_PUBLIC');
    }
  }, [token, activeTab]);

  // Customer states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerCreate>({
    full_name: '',
    citizen_id: '',
    phone_number: '',
    email: '',
    address: '',
    date_of_birth: '',
  });

  // Deceased states
  const [deceasedList, setDeceasedList] = useState<DeceasedProfile[]>([]);
  const [deceasedSearch, setDeceasedSearch] = useState('');
  const [deceasedFilter, setDeceasedFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [selectedDeceased, setSelectedDeceased] = useState<DeceasedProfile | null>(null);
  const [isDeceasedModalOpen, setIsDeceasedModalOpen] = useState(false);
  const [isYearOnlyPrecision, setIsYearOnlyPrecision] = useState(false);
  const [deceasedForm, setDeceasedForm] = useState<DeceasedProfileCreate>({
    full_name: '',
    gender: 'MALE',
    date_of_birth: '',
    date_of_death: new Date().toISOString().split('T')[0],
    birth_year: 1950,
    birth_date_precision: 'EXACT',
    hometown: '',
    religion: '',
    customer_id: null,
    relationship_type: 'Thân nhân',
    is_primary_contact: true,
  });

  // Certificate attach & verify
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certForm, setCertForm] = useState<DeathCertificateCreate>({
    certificate_number: '',
    issuing_authority: '',
    issue_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Public Memorial search states
  const [memorialQuery, setMemorialQuery] = useState('');
  const [memorialResults, setMemorialResults] = useState<DeceasedPublicLookupResponse[]>([]);
  const [isMemorialLoading, setIsMemorialLoading] = useState(false);

  // Relations states
  const [relationsList, setRelationsList] = useState<RelationDetail[]>([]);
  const [relationSearch, setRelationSearch] = useState('');
  const [relationFilter, setRelationFilter] = useState<'ALL' | 'PRIMARY' | 'OTHER'>('ALL');
  const [isRelationModalOpen, setIsRelationModalOpen] = useState(false);
  const [relationForm, setRelationForm] = useState<{
    customer_id: number | '';
    deceased_id: number | '';
    relationship_type: string;
    is_primary_contact: boolean;
  }>({
    customer_id: '',
    deceased_id: '',
    relationship_type: 'Con',
    is_primary_contact: true,
  });
  const [relationSubmitting, setRelationSubmitting] = useState(false);

  // Common states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  useEffect(() => {
    if (activeTab === 'CUSTOMERS' && token) {
      loadCustomers();
    } else if (activeTab === 'DECEASED' && token) {
      loadDeceased();
    } else if (activeTab === 'RELATIONS' && token) {
      loadRelations();
      if (customers.length === 0) loadCustomers();
      if (deceasedList.length === 0) loadDeceased();
    }
  }, [activeTab, token]);

  // Load Customers
  const loadCustomers = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : '';
      const res = await fetch(`/api/v1/profiles/customers${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải danh sách khách hàng');
      const data: Customer[] = await res.json();
      setCustomers(data);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Load Deceased
  const loadDeceased = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = deceasedSearch ? `?search=${encodeURIComponent(deceasedSearch)}` : '';
      const res = await fetch(`/api/v1/profiles/deceased${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải danh sách người mất');
      const data: DeceasedProfile[] = await res.json();
      setDeceasedList(data);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Load Relations
  const loadRelations = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = relationSearch ? `?search=${encodeURIComponent(relationSearch)}` : '';
      const res = await fetch(`/api/v1/profiles/relations${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải danh sách liên kết hồ sơ');
      const data: RelationDetail[] = await res.json();
      setRelationsList(data);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Open Relation Modal
  const handleOpenRelationModal = (customerId?: number, deceasedId?: number) => {
    if (customers.length === 0) loadCustomers();
    if (deceasedList.length === 0) loadDeceased();
    setRelationForm({
      customer_id: customerId !== undefined ? customerId : (customers[0]?.customer_id || ''),
      deceased_id: deceasedId !== undefined ? deceasedId : (deceasedList[0]?.deceased_id || ''),
      relationship_type: 'Con',
      is_primary_contact: true,
    });
    setIsRelationModalOpen(true);
  };

  // Save Relation
  const handleSaveRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!relationForm.customer_id || !relationForm.deceased_id) {
      setErrorMsg('Vui lòng chọn cả Khách hàng và Người mất để thiết lập liên kết');
      return;
    }
    if (!relationForm.relationship_type.trim()) {
      setErrorMsg('Vui lòng nhập hoặc chọn mối quan hệ thân nhân');
      return;
    }
    setRelationSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: RelationCreate = {
        customer_id: Number(relationForm.customer_id),
        deceased_id: Number(relationForm.deceased_id),
        relationship_type: relationForm.relationship_type.trim(),
        is_primary_contact: relationForm.is_primary_contact,
      };
      const res = await fetch('/api/v1/profiles/relations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Không thể thiết lập liên kết');
      }
      setSuccessMsg('Thiết lập liên kết hồ sơ thành công!');
      setIsRelationModalOpen(false);
      loadCustomers();
      loadDeceased();
      loadRelations();
      if (selectedCustomer && selectedCustomer.customer_id === Number(relationForm.customer_id)) {
        const cRes = await fetch(`/api/v1/profiles/customers/${selectedCustomer.customer_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cRes.ok) setSelectedCustomer(await cRes.json());
      }
      if (selectedDeceased && selectedDeceased.deceased_id === Number(relationForm.deceased_id)) {
        const dRes = await fetch(`/api/v1/profiles/deceased/${selectedDeceased.deceased_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dRes.ok) setSelectedDeceased(await dRes.json());
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Lỗi thiết lập liên kết');
    } finally {
      setRelationSubmitting(false);
    }
  };

  // Delete Relation
  const handleDeleteRelation = async (relationId: number) => {
    if (!token) return;
    if (!window.confirm('Bạn có chắc chắn muốn gỡ bỏ mối liên kết hồ sơ này?')) {
      return;
    }
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/profiles/relations/${relationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        throw new Error('Không thể gỡ bỏ liên kết');
      }
      setSuccessMsg('Đã gỡ bỏ mối liên kết thành công!');
      loadCustomers();
      loadDeceased();
      loadRelations();
      if (selectedCustomer) {
        const cRes = await fetch(`/api/v1/profiles/customers/${selectedCustomer.customer_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cRes.ok) setSelectedCustomer(await cRes.json());
      }
      if (selectedDeceased) {
        const dRes = await fetch(`/api/v1/profiles/deceased/${selectedDeceased.deceased_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dRes.ok) setSelectedDeceased(await dRes.json());
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Lỗi gỡ bỏ liên kết');
    }
  };

  // Create Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErrorMsg(null);
    try {
      const payload = {
        ...customerForm,
        date_of_birth: customerForm.date_of_birth || null,
        email: customerForm.email || null,
      };
      const res = await fetch('/api/v1/profiles/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Trùng số CCCD trong hệ thống');
      }
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Không thể tạo khách hàng');
      }

      setSuccessMsg('Tạo mới khách hàng thân nhân thành công!');
      setIsCustomerModalOpen(false);
      setCustomerForm({
        full_name: '',
        citizen_id: '',
        phone_number: '',
        email: '',
        address: '',
        date_of_birth: '',
      });
      loadCustomers();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  // Create Deceased
  const handleCreateDeceased = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErrorMsg(null);
    try {
      const payload: DeceasedProfileCreate = {
        ...deceasedForm,
        date_of_birth: isYearOnlyPrecision ? null : deceasedForm.date_of_birth || null,
        birth_year: isYearOnlyPrecision
          ? Number(deceasedForm.birth_year)
          : deceasedForm.date_of_birth
          ? new Date(deceasedForm.date_of_birth).getFullYear()
          : null,
        birth_date_precision: isYearOnlyPrecision ? 'YEAR_ONLY' : 'EXACT',
        customer_id: deceasedForm.customer_id ? Number(deceasedForm.customer_id) : null,
      };

      const res = await fetch('/api/v1/profiles/deceased', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Không thể tạo hồ sơ người mất');
      }

      setSuccessMsg('Tạo mới hồ sơ người mất thành công!');
      setIsDeceasedModalOpen(false);
      loadDeceased();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  // Attach Certificate
  const handleAttachCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedDeceased) return;
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/v1/profiles/deceased/${selectedDeceased.deceased_id}/certificate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(certForm),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Không thể cập nhật giấy báo tử');
      }

      setSuccessMsg('Đính kèm giấy báo tử thành công (Trạng thái: Chờ thẩm định)!');
      setIsCertModalOpen(false);
      // Reload current deceased detail
      const updatedRes = await fetch(
        `/api/v1/profiles/deceased/${selectedDeceased.deceased_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (updatedRes.ok) {
        const updated = await updatedRes.json();
        setSelectedDeceased(updated);
      }
      loadDeceased();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };


  // Customer relation filter
  const [customerFilter, setCustomerFilter] = useState<'ALL' | 'HAS_RELATIONS' | 'NO_RELATIONS'>('ALL');

  const filteredCustomers = customers.filter((c) => {
    if (customerFilter === 'HAS_RELATIONS') return c.relations && c.relations.length > 0;
    if (customerFilter === 'NO_RELATIONS') return !c.relations || c.relations.length === 0;
    return true;
  });

  // Filtered deceased list
  const filteredDeceased = deceasedList.filter((d) => {
    if (deceasedFilter === 'VERIFIED') return !!d.death_certificate;
    if (deceasedFilter === 'UNVERIFIED') return !d.death_certificate;
    return true;
  });

  // Pagination for customers
  const {
    currentPage: custPage,
    pageSize: custPageSize,
    totalPages: custTotalPages,
    totalItems: custTotalItems,
    paginatedItems: paginatedCustomers,
    setCurrentPage: setCustPage,
    setPageSize: setCustPageSize,
    startIndex: custStartIndex,
    endIndex: custEndIndex,
  } = usePagination(filteredCustomers, 10);

  // Pagination for deceased
  const {
    currentPage: decPage,
    pageSize: decPageSize,
    totalPages: decTotalPages,
    totalItems: decTotalItems,
    paginatedItems: paginatedDeceased,
    setCurrentPage: setDecPage,
    setPageSize: setDecPageSize,
    startIndex: decStartIndex,
    endIndex: decEndIndex,
  } = usePagination(filteredDeceased, 10);

  // Pagination for memorial results
  const {
    currentPage: memPage,
    pageSize: memPageSize,
    totalPages: memTotalPages,
    totalItems: memTotalItems,
    paginatedItems: paginatedMemorial,
    setCurrentPage: setMemPage,
    setPageSize: setMemPageSize,
    startIndex: memStartIndex,
    endIndex: memEndIndex,
  } = usePagination(memorialResults, 6);

  // Filtered relations list
  const filteredRelations = relationsList.filter((r) => {
    if (relationFilter === 'PRIMARY') return r.is_primary_contact;
    if (relationFilter === 'OTHER') return !r.is_primary_contact;
    return true;
  });

  // Pagination for relations
  const {
    currentPage: relPage,
    pageSize: relPageSize,
    totalPages: relTotalPages,
    totalItems: relTotalItems,
    paginatedItems: paginatedRelations,
    setCurrentPage: setRelPage,
    setPageSize: setRelPageSize,
    startIndex: relStartIndex,
    endIndex: relEndIndex,
  } = usePagination(filteredRelations, 10);

  // Debounced Live Search for Public Memorial Lookup
  useEffect(() => {
    if (activeTab !== 'MEMORIAL_PUBLIC') return;
    const q = memorialQuery.trim();
    if (q.length < 2) {
      if (q.length === 0) setMemorialResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsMemorialLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/v1/profiles/public/memorials?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data: DeceasedPublicLookupResponse[] = await res.json();
          setMemorialResults(data);
        }
      } catch {
        // ignore
      } finally {
        setIsMemorialLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [memorialQuery, activeTab]);

  return (
    <div className="profile-module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#24594D', fontSize: '24px', fontWeight: 'bold' }}>
            {!token ? 'Cổng Tra Cứu Phần Mộ Tưởng Niệm (Dành Cho Thân Nhân)' : 'Hồ Sơ Khách Hàng & Người Quá Cố'}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '14px' }}>
            {!token
              ? 'Tra cứu vị trí phần mộ, phân khu và kết quả chăm sóc đã được công bố công khai (Bảo vệ thông tin cá nhân)'
              : 'Quản lý thân nhân, hồ sơ người mất, thẩm định giấy báo tử và Cổng tra cứu tưởng niệm'}
          </p>
        </div>

        {/* Global tabs - ONLY visible for authenticated staff */}
        {token && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              background: '#F3F4F6',
              padding: '4px',
              borderRadius: '10px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              maxWidth: '100%',
            }}
          >
            <button
              onClick={() => setActiveTab('CUSTOMERS')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: activeTab === 'CUSTOMERS' ? '#24594D' : 'transparent',
                color: activeTab === 'CUSTOMERS' ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              👥 Thân Nhân (Khách Hàng)
            </button>
            <button
              onClick={() => setActiveTab('DECEASED')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: activeTab === 'DECEASED' ? '#24594D' : 'transparent',
                color: activeTab === 'DECEASED' ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ⚰️ Người Quá Cố & Giấy Báo Tử
            </button>
            <button
              onClick={() => setActiveTab('RELATIONS')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: activeTab === 'RELATIONS' ? '#24594D' : 'transparent',
                color: activeTab === 'RELATIONS' ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              🔗 Liên Kết Hồ Sơ
            </button>
            <button
              onClick={() => setActiveTab('MEMORIAL_PUBLIC')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: activeTab === 'MEMORIAL_PUBLIC' ? '#047857' : 'transparent',
                color: activeTab === 'MEMORIAL_PUBLIC' ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              🪷 Cổng Tra Cứu Tưởng Niệm
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEE2E2',
            color: '#B91C1C',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}
      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803D', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMERS */}
      {/* ========================================================================= */}
      {activeTab === 'CUSTOMERS' && (
        <div>
          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Row 1: Full-width search bar */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tìm tên, mã KH, số CCCD, SĐT..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={loadCustomers}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#24594D',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Tìm Kiếm
              </button>
            </div>

            {/* Row 2: Filter chips on left, Add Customer button on right */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              {/* Customer relationship filter chips */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCustomerFilter('ALL')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: customerFilter === 'ALL' ? '#24594D' : '#F9FAFB',
                    color: customerFilter === 'ALL' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Tất cả ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('HAS_RELATIONS')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: customerFilter === 'HAS_RELATIONS' ? '#24594D' : '#F9FAFB',
                    color: customerFilter === 'HAS_RELATIONS' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Có liên kết
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('NO_RELATIONS')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: customerFilter === 'NO_RELATIONS' ? '#24594D' : '#F9FAFB',
                    color: customerFilter === 'NO_RELATIONS' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Chưa liên kết
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleOpenRelationModal()}
                  style={{
                    padding: '9px 14px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Link2 size={15} /> Thiết Lập Liên Kết Hồ Sơ
                </button>
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#047857',
                    color: 'white',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>+</span> Thêm Khách Hàng Thân Nhân
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>⏳ Đang tải danh sách khách hàng...</div>
            </div>
          ) : customers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px dashed #D1D5DB',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
              <h3 style={{ margin: '0 0 6px 0', color: '#374151' }}>Không tìm thấy khách hàng nào</h3>
              <p style={{ margin: '0 0 16px 0', color: '#6B7280', fontSize: '14px' }}>
                Chưa có dữ liệu khách hàng hoặc bộ lọc không khớp
              </p>
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#24594D',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                + Thêm khách hàng đầu tiên
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Mobile Card View (< 1024px) */}
              <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
                {paginatedCustomers.map((c) => (
                  <div
                    key={c.customer_id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, color: '#24594D', fontSize: '13px' }}>{c.customer_code}</div>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: (c.relations?.length || 0) > 0 ? '#DCFCE7' : '#F3F4F6',
                          color: (c.relations?.length || 0) > 0 ? '#15803D' : '#6B7280',
                          fontWeight: 600,
                        }}
                      >
                        {(c.relations?.length || 0) > 0 ? `Liên kết: ${c.relations?.length} người` : 'Chưa liên kết'}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      {c.full_name}
                    </div>

                    <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '2px' }}>
                      <span>CCCD: </span>
                      <code style={{ fontFamily: 'monospace', backgroundColor: '#F3F4F6', padding: '1px 4px', borderRadius: '4px' }}>
                        {c.citizen_id}
                      </code>
                    </div>

                    <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '2px' }}>
                      <span>SĐT: </span>
                      <strong>{c.phone_number}</strong>
                    </div>

                    {c.address && (
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                        Địa chỉ: {c.address}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="touch-target"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: '#F3F4F6',
                          color: '#374151',
                          borderRadius: '6px',
                          border: '1px solid #D1D5DB',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => handleOpenRelationModal(c.customer_id, undefined)}
                        className="touch-target"
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          borderRadius: '6px',
                          border: '1px solid #BFDBFE',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Link2 size={13} /> Gắn kết
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 1024px) */}
              <div className="desktop-only table-scroll-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Mã KH</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Họ và Tên</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Số CCCD (Duy Nhất)</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Số Điện Thoại</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Ngày Sinh</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Địa Chỉ</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Người Thân Quá Cố</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600, textAlign: 'right' }}>
                      Thao Tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((c) => (
                    <tr
                      key={c.customer_id}
                      style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#24594D' }}>
                        {c.customer_code}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.full_name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            backgroundColor: '#F3F4F6',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          {c.citizen_id}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{c.phone_number}</td>
                      <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                        {c.date_of_birth ? new Date(c.date_of_birth).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: '#4B5563',
                          maxWidth: '220px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.address}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {c.relations.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {c.relations.map((r) => (
                              <span
                                key={r.relation_id}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  backgroundColor: '#E0E7FF',
                                  color: '#3730A3',
                                  borderRadius: '6px',
                                  fontWeight: 500,
                                }}
                              >
                                {r.deceased_full_name} ({r.relationship_type})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Chưa liên kết</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleOpenRelationModal(c.customer_id, undefined)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            borderRadius: '6px',
                            border: '1px solid #BFDBFE',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            marginRight: '6px',
                          }}
                        >
                          + Gắn kết
                        </button>
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          style={{
                            padding: '5px 12px',
                            backgroundColor: '#E5E7EB',
                            color: '#374151',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <Pagination
                currentPage={custPage}
                totalPages={custTotalPages}
                totalItems={custTotalItems}
                pageSize={custPageSize}
                onPageChange={setCustPage}
                onPageSizeChange={setCustPageSize}
                startIndex={custStartIndex}
                endIndex={custEndIndex}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DECEASED PROFILES & DEATH CERTIFICATES */}
      {/* ========================================================================= */}
      {activeTab === 'DECEASED' && (
        <div>
          {/* Action & Filter bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Row 1: Full-width search bar */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tìm theo họ tên, mã người mất, quê quán..."
                value={deceasedSearch}
                onChange={(e) => setDeceasedSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDeceased()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={loadDeceased}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#24594D',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Tìm Kiếm
              </button>
            </div>

            {/* Row 2: Filter chips on left, Add Deceased button on right */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              {/* Filter chips */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: '2px',
                }}
              >
                <button
                  onClick={() => setDeceasedFilter('ALL')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: deceasedFilter === 'ALL' ? '#24594D' : '#F9FAFB',
                    color: deceasedFilter === 'ALL' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Tất cả ({deceasedList.length})
                </button>
                <button
                  onClick={() => setDeceasedFilter('VERIFIED')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #BBF7D0',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: deceasedFilter === 'VERIFIED' ? '#16A34A' : '#F0FDF4',
                    color: deceasedFilter === 'VERIFIED' ? 'white' : '#15803D',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ✓ Đã có giấy báo tử
                </button>
                <button
                  onClick={() => setDeceasedFilter('UNVERIFIED')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #FCD34D',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: deceasedFilter === 'UNVERIFIED' ? '#D97706' : '#FEF3C7',
                    color: deceasedFilter === 'UNVERIFIED' ? 'white' : '#92400E',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Chưa có giấy báo tử
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleOpenRelationModal()}
                  style={{
                    padding: '9px 14px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Link2 size={15} /> Thiết Lập Liên Kết Hồ Sơ
                </button>
                <button
                  onClick={() => setIsDeceasedModalOpen(true)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#047857',
                    color: 'white',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>+</span> Thêm Hồ Sơ Người Mất
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>⏳ Đang tải danh sách hồ sơ người mất...</div>
            </div>
          ) : filteredDeceased.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px dashed #D1D5DB',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🕯️</div>
              <h3 style={{ margin: '0 0 6px 0', color: '#374151' }}>Không tìm thấy hồ sơ người mất nào</h3>
              <p style={{ margin: '0 0 16px 0', color: '#6B7280', fontSize: '14px' }}>
                Thêm hồ sơ người mất hoặc điều chỉnh bộ lọc tìm kiếm
              </p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Mobile Card View (< 1024px) */}
              <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
                {paginatedDeceased.map((d) => {
                  const isCertVerified = d.death_certificate?.is_verified === true;
                  const hasCert = !!d.death_certificate;
                  return (
                    <div
                      key={d.deceased_id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 700, color: '#24594D', fontSize: '13px' }}>{d.deceased_code}</div>
                        {hasCert ? (
                          isCertVerified ? (
                            <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#DCFCE7', color: '#15803D', borderRadius: '6px', fontWeight: 600 }}>
                              ✓ Đã thẩm định
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '6px', fontWeight: 600 }}>
                              ⏳ Chờ thẩm định
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontWeight: 500 }}>
                            Chưa nộp GBT
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                        {d.full_name} ({d.gender === 'MALE' ? 'Nam' : d.gender === 'FEMALE' ? 'Nữ' : 'Khác'})
                      </div>

                      <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '4px' }}>
                        Sinh:{' '}
                        <strong>
                          {d.birth_date_precision === 'YEAR_ONLY'
                            ? `Năm ${d.birth_year}`
                            : d.date_of_birth
                            ? new Date(d.date_of_birth).toLocaleDateString('vi-VN')
                            : '—'}
                        </strong>{' '}
                        · Mất:{' '}
                        <strong style={{ color: '#DC2626' }}>
                          {d.date_of_death ? new Date(d.date_of_death).toLocaleDateString('vi-VN') : '—'}
                        </strong>
                      </div>

                      <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '4px' }}>
                        Vị trí:{' '}
                        {d.burial_slot ? (
                          <strong style={{ color: 'var(--brand-primary)' }}>
                            {d.burial_slot.plot_code} ({d.burial_slot.zone_name})
                          </strong>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>Chưa an táng thực địa</span>
                        )}
                      </div>

                      {d.relations && d.relations.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                          Thân nhân: {d.relations[0].customer_full_name} ({d.relations[0].relationship_type})
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setSelectedDeceased(d)}
                          className="touch-target"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            backgroundColor: '#F3F4F6',
                            color: '#374151',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          Chi tiết hồ sơ
                        </button>
                        <button
                          onClick={() => handleOpenRelationModal(undefined, d.deceased_id)}
                          className="touch-target"
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            borderRadius: '6px',
                            border: '1px solid #BFDBFE',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Link2 size={13} /> Gắn thân nhân
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= 1024px) */}
              <div className="desktop-only table-scroll-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Mã Hồ Sơ</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Họ và Tên</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Giới Tính</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Sinh - Mất</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Quê Quán</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Giấy Báo Tử</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Vị Trí Mộ Phần</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Thân Nhân Liên Hệ</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600, textAlign: 'right' }}>
                      Thao Tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeceased.map((d) => {
                    const isCertVerified = d.death_certificate?.is_verified === true;
                    const hasCert = !!d.death_certificate;
                    return (
                      <tr
                        key={d.deceased_id}
                        style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#24594D' }}>
                          {d.deceased_code}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.full_name}</td>
                        <td style={{ padding: '12px 16px', color: '#4B5563' }}>
                          {d.gender === 'MALE' ? 'Nam' : d.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 500 }}>
                            {d.birth_date_precision === 'YEAR_ONLY'
                              ? `Năm ${d.birth_year}`
                              : d.date_of_birth
                              ? new Date(d.date_of_birth).toLocaleDateString('vi-VN')
                              : 'Không rõ'}
                          </span>
                          <span style={{ color: '#9CA3AF', margin: '0 4px' }}>—</span>
                          <span style={{ color: '#DC2626', fontWeight: 500 }}>
                            {new Date(d.date_of_death).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6B7280' }}>{d.hometown || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {hasCert ? (
                            isCertVerified ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  backgroundColor: '#DCFCE7',
                                  color: '#15803D',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                }}
                              >
                                ✓ Đã thẩm định
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  backgroundColor: '#FEF3C7',
                                  color: '#92400E',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                }}
                              >
                                ⏳ Chờ thẩm định
                              </span>
                            )
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                backgroundColor: '#FEE2E2',
                                color: '#991B1B',
                                borderRadius: '6px',
                                fontWeight: 500,
                              }}
                            >
                              Chưa nộp
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {d.burial_slot ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  backgroundColor: '#F3F4F6',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  color: '#24594D',
                                }}
                              >
                                {d.burial_slot.plot_code} - Slot {d.burial_slot.slot_number}
                              </span>
                              {d.burial_slot.is_kim_tinh && (
                                <span title="Ô mộ Kim Tĩnh bất biến" style={{ fontSize: '13px' }}>
                                  🛡️
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Chưa an táng</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {d.relations.length > 0 ? (
                            <span style={{ color: '#374151' }}>
                              {d.relations[0].customer_full_name} ({d.relations[0].relationship_type})
                            </span>
                          ) : (
                            <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Chưa gán</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenRelationModal(undefined, d.deceased_id)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              borderRadius: '6px',
                              border: '1px solid #BFDBFE',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                              marginRight: '6px',
                            }}
                          >
                            + Thân nhân
                          </button>
                          <button
                            onClick={() => setSelectedDeceased(d)}
                            style={{
                              padding: '5px 12px',
                              backgroundColor: '#E5E7EB',
                              color: '#374151',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Hồ sơ chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <Pagination
                currentPage={decPage}
                totalPages={decTotalPages}
                totalItems={decTotalItems}
                pageSize={decPageSize}
                onPageChange={setDecPage}
                onPageSizeChange={setDecPageSize}
                startIndex={decStartIndex}
                endIndex={decEndIndex}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RELATIONS (LIÊN KẾT HỒ SƠ) */}
      {/* ========================================================================= */}
      {activeTab === 'RELATIONS' && (
        <div>
          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Row 1: Search bar */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tìm theo tên khách, tên người mất, CCCD, SĐT..."
                value={relationSearch}
                onChange={(e) => setRelationSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadRelations()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                }}
              />
              <button
                type="button"
                onClick={loadRelations}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#24594D',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Tìm Kiếm
              </button>
            </div>

            {/* Row 2: Filter chips on left, Add Relation button on right */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setRelationFilter('ALL')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: relationFilter === 'ALL' ? '#24594D' : '#F9FAFB',
                    color: relationFilter === 'ALL' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Tất cả ({relationsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRelationFilter('PRIMARY')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: relationFilter === 'PRIMARY' ? '#24594D' : '#F9FAFB',
                    color: relationFilter === 'PRIMARY' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ★ Đại diện chính
                </button>
                <button
                  type="button"
                  onClick={() => setRelationFilter('OTHER')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: relationFilter === 'OTHER' ? '#24594D' : '#F9FAFB',
                    color: relationFilter === 'OTHER' ? 'white' : '#4B5563',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Thân nhân khác
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenRelationModal()}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#047857',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Link2 size={15} /> Thiết Lập Liên Kết Mới
              </button>
            </div>
          </div>

          {/* Table / Cards */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>⏳ Đang tải dữ liệu liên kết hồ sơ...</div>
            </div>
          ) : filteredRelations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px dashed #D1D5DB',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔗</div>
              <h3 style={{ margin: '0 0 6px 0', color: '#374151' }}>Chưa có mối liên kết hồ sơ nào phù hợp</h3>
              <p style={{ margin: '0 0 16px 0', color: '#6B7280', fontSize: '14px' }}>
                Thiết lập liên kết giữa khách hàng thân nhân và hồ sơ người mất để phân công quản lý và an táng.
              </p>
              <button
                type="button"
                onClick={() => handleOpenRelationModal()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#24594D',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                + Thiết lập liên kết đầu tiên
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Mobile Card View (< 1024px) */}
              <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
                {paginatedRelations.map((r) => (
                  <div
                    key={r.relation_id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#E0E7FF',
                          color: '#3730A3',
                          fontWeight: 600,
                        }}
                      >
                        Quan hệ: {r.relationship_type}
                      </span>
                      {r.is_primary_contact && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            fontWeight: 700,
                          }}
                        >
                          ★ Đại diện chính
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>KHÁCH HÀNG THÂN NHÂN:</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                          {r.customer_name} <span style={{ color: '#24594D', fontSize: '12px' }}>({r.customer_code})</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#4B5563' }}>
                          SĐT: {r.phone_number} · CCCD: <code>{r.citizen_id}</code>
                        </div>
                      </div>

                      <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>NGƯỜI THÂN QUÁ CỐ:</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                          {r.deceased_name} <span style={{ color: '#6B7280', fontSize: '12px' }}>({r.deceased_code})</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#4B5563' }}>
                          Mất ngày: {new Date(r.date_of_death).toLocaleDateString('vi-VN')} · {r.slot_info ? <strong style={{ color: '#047857' }}>{r.slot_info}</strong> : <span style={{ color: '#9CA3AF' }}>Chưa an táng</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenRelationModal(r.customer_id, r.deceased_id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        Sửa quan hệ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRelation(r.relation_id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          border: '1px solid #FCA5A5',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        Gỡ liên kết
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 1024px) */}
              <div className="desktop-only table-scroll-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Khách Hàng Thân Nhân</th>
                      <th style={{ padding: '12px 16px' }}>Mối Quan Hệ</th>
                      <th style={{ padding: '12px 16px' }}>Người Quá Cố</th>
                      <th style={{ padding: '12px 16px' }}>Vị Trí Mộ Phần</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRelations.map((r) => (
                      <tr key={r.relation_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            {r.customer_name}
                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#24594D', fontWeight: 700 }}>
                              {r.customer_code}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            SĐT: {r.phone_number} · CCCD: <code>{r.citizen_id}</code>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              padding: '2px 8px',
                              backgroundColor: '#E0E7FF',
                              color: '#3730A3',
                              borderRadius: '6px',
                              fontWeight: 600,
                              marginRight: '6px',
                            }}
                          >
                            {r.relationship_type}
                          </span>
                          {r.is_primary_contact && (
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              ★ Đại diện chính
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            {r.deceased_name}
                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#6B7280' }}>
                              ({r.deceased_code})
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            Mất ngày: {new Date(r.date_of_death).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {r.slot_info ? (
                            <span style={{ fontWeight: 600, color: '#047857' }}>{r.slot_info}</span>
                          ) : (
                            <span style={{ color: '#9CA3AF' }}>Chưa an táng</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenRelationModal(r.customer_id, r.deceased_id)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              borderRadius: '6px',
                              border: '1px solid #BFDBFE',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                              marginRight: '6px',
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRelation(r.relation_id)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              borderRadius: '6px',
                              border: '1px solid #FCA5A5',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Gỡ bỏ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={relPage}
                totalPages={relTotalPages}
                pageSize={relPageSize}
                totalItems={relTotalItems}
                startIndex={relStartIndex}
                endIndex={relEndIndex}
                onPageChange={setRelPage}
                onPageSizeChange={setRelPageSize}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PUBLIC MEMORIAL PORTAL (ZERO PII - G19 & ADR-001) */}
      {/* ========================================================================= */}
      {activeTab === 'MEMORIAL_PUBLIC' && (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '10px 0' }}>
          {/* Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #24594D 0%, #153E35 100%)',
              color: 'white',
              padding: '36px 30px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
              marginBottom: '30px',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🪷</div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '26px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              Cổng Tra Cứu Tưởng Niệm & Vị Trí Mộ Phần
            </h2>
            <p style={{ margin: '0 auto 24px auto', maxWidth: '640px', color: '#D1FAE5', fontSize: '14px', lineHeight: '1.6' }}>
              Tra cứu thông tin nơi an nghỉ của người quá cố phục vụ thân nhân, người thân và khách viếng thăm tìm kiếm vị trí thực địa tại Nghĩa Trang Tư Nhân.
            </p>

            <div style={{ maxWidth: '560px', margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Nhập họ tên hoặc mã người quá cố (ví dụ: Nguyễn Văn Phúc hoặc NM-2024)..."
                    value={memorialQuery}
                    onChange={(e) => setMemorialQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '15px',
                      color: '#111827',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      outline: 'none',
                    }}
                  />
                  {isMemorialLoading && (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                      style={{ position: 'absolute', right: '14px', top: '15px', color: '#24594D' }}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (memorialQuery.trim()) {
                      setIsMemorialLoading(true);
                      fetch(`/api/v1/profiles/public/memorials?q=${encodeURIComponent(memorialQuery.trim())}`)
                        .then(r => r.json())
                        .then(data => setMemorialResults(data))
                        .finally(() => setIsMemorialLoading(false));
                    }
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#EAB308',
                    color: '#713F12',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  Tìm Kiếm
                </button>
              </div>

              {/* Quick Suggestion Chips */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#D1FAE5' }}>Gợi ý:</span>
                {['Nguyễn', 'Trần', 'Lê', 'A1', 'Khu A'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setMemorialQuery(chip)}
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#FFFFFF',
                      borderRadius: '14px',
                      padding: '2px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Privacy badge */}
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#1E40AF',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '18px' }}>🔒</span>
            <span>
              <strong>Bảo đảm quyền riêng tư tuyệt đối:</strong> Cổng thông tin công khai không bao giờ cung cấp số CCCD, số điện thoại, địa chỉ thân nhân hay hồ sơ pháp lý theo quy chuẩn bảo vệ dữ liệu.
            </span>
          </div>

          {/* Results */}
          {memorialResults.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 16px 0', color: '#1F2937', fontSize: '18px', fontWeight: 600 }}>
                Kết quả tìm kiếm ({memorialResults.length})
              </h3>
              <div className="responsive-auto-cards">
                {paginatedMemorial.map((item) => (
                  <div
                    key={item.deceased_code}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#24594D', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          Mã: {item.deceased_code}
                        </div>
                        <h4 style={{ margin: '4px 0 6px 0', fontSize: '18px', color: '#111827' }}>
                          {item.full_name}
                        </h4>
                      </div>
                      {item.is_kim_tinh && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #FCD34D',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Shield size={12} />
                          <span>Mộ Kim Tĩnh</span>
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#4B5563', lineHeight: '1.6' }}>
                      <div>
                        <strong>Năm sinh:</strong> {item.year_of_birth ? item.year_of_birth : 'Không rõ'} ·{' '}
                        <strong>Ngày mất:</strong> {new Date(item.date_of_death).toLocaleDateString('vi-VN')}
                      </div>
                      {item.hometown && (
                        <div>
                          <strong>Quê quán:</strong> {item.hometown}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#24594D',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <MapPin size={14} />
                        <span>VỊ TRÍ AN TÁNG TẠI NGHĨA TRANG:</span>
                      </div>
                      {item.navigation_guidance ? (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '6px' }}>
                            {item.navigation_guidance}
                          </div>
                          {item.latitude && item.longitude && (
                            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                              Tọa độ GPS: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                            </div>
                          )}
                          {item.maps_url && (
                            <a
                              href={item.maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--brand-primary)',
                                textDecoration: 'none',
                                padding: '4px 8px',
                                backgroundColor: '#E6F4EA',
                                borderRadius: '4px',
                                border: '1px solid #A7F3D0',
                              }}
                            >
                              <ExternalLink size={13} />
                              <span>Mở bản đồ Google Maps chỉ đường</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Chưa ghi nhận vị trí an táng thực địa</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px' }}>
                <Pagination
                  currentPage={memPage}
                  totalPages={memTotalPages}
                  totalItems={memTotalItems}
                  pageSize={memPageSize}
                  onPageChange={setMemPage}
                  onPageSizeChange={setMemPageSize}
                  startIndex={memStartIndex}
                  endIndex={memEndIndex}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOMER */}
      {/* ========================================================================= */}
      {isCustomerModalOpen && (
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
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '24px',
              width: '520px',
              maxWidth: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#24594D', fontSize: '18px', fontWeight: 'bold' }}>
                Thêm Khách Hàng Thân Nhân Mới
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Họ và Tên Thân Nhân *
                </label>
                <input
                  type="text"
                  required
                  value={customerForm.full_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  placeholder="Ví dụ: Nguyễn Văn An"
                />
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Số CCCD (Bắt buộc duy nhất) *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerForm.citizen_id}
                    onChange={(e) => setCustomerForm({ ...customerForm, citizen_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    placeholder="12 chữ số CCCD"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Số Điện Thoại *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerForm.phone_number}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone_number: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    placeholder="09..."
                  />
                </div>
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Ngày Sinh
                  </label>
                  <input
                    type="date"
                    value={customerForm.date_of_birth || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, date_of_birth: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerForm.email || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Địa Chỉ Liên Hệ *
                </label>
                <input
                  type="text"
                  required
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  placeholder="Địa chỉ cư trú"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#24594D',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Lưu Khách Hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD DECEASED (G07) */}
      {/* ========================================================================= */}
      {isDeceasedModalOpen && (
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
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '24px',
              width: '600px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#24594D', fontSize: '18px', fontWeight: 'bold' }}>
                Thêm Hồ Sơ Người Quá Cố
              </h3>
              <button
                onClick={() => setIsDeceasedModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeceased}>
              <div className="responsive-form-row-2-1">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Họ và Tên Người Quá Cố *
                  </label>
                  <input
                    type="text"
                    required
                    value={deceasedForm.full_name}
                    onChange={(e) => setDeceasedForm({ ...deceasedForm, full_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    placeholder="Ví dụ: Cụ Nguyễn Văn Phúc"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Giới Tính *
                  </label>
                  <select
                    value={deceasedForm.gender}
                    onChange={(e) => setDeceasedForm({ ...deceasedForm, gender: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              {/* G07: Precision toggle */}
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    id="yearOnlyCheck"
                    checked={isYearOnlyPrecision}
                    onChange={(e) => setIsYearOnlyPrecision(e.target.checked)}
                  />
                  <label htmlFor="yearOnlyCheck" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Thân nhân chỉ nhớ năm sinh (chỉ lưu năm sinh, không bắt buộc ngày tháng)
                  </label>
                </div>

                {isYearOnlyPrecision ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4B5563', marginBottom: '4px' }}>
                      Năm Sinh *
                    </label>
                    <input
                      type="number"
                      required
                      min={1880}
                      max={new Date().getFullYear()}
                      value={deceasedForm.birth_year || 1950}
                      onChange={(e) => setDeceasedForm({ ...deceasedForm, birth_year: Number(e.target.value) })}
                      style={{ width: '140px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4B5563', marginBottom: '4px' }}>
                      Ngày Tháng Năm Sinh Đầy Đủ
                    </label>
                    <input
                      type="date"
                      value={deceasedForm.date_of_birth || ''}
                      onChange={(e) => setDeceasedForm({ ...deceasedForm, date_of_birth: e.target.value })}
                      style={{ width: '180px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    />
                  </div>
                )}
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Ngày Mất *
                  </label>
                  <input
                    type="date"
                    required
                    value={deceasedForm.date_of_death}
                    onChange={(e) => setDeceasedForm({ ...deceasedForm, date_of_death: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Tôn Giáo
                  </label>
                  <input
                    type="text"
                    value={deceasedForm.religion || ''}
                    onChange={(e) => setDeceasedForm({ ...deceasedForm, religion: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    placeholder="Phật giáo / Công giáo / Không..."
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Quê Quán
                </label>
                <input
                  type="text"
                  value={deceasedForm.hometown || ''}
                  onChange={(e) => setDeceasedForm({ ...deceasedForm, hometown: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  placeholder="Tỉnh/Thành phố quê hương"
                />
              </div>

              {/* Relative link */}
              <div
                style={{
                  marginBottom: '18px',
                  padding: '12px',
                  backgroundColor: '#F0FDF4',
                  borderRadius: '8px',
                  border: '1px solid #BBF7D0',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534', marginBottom: '8px' }}>
                  Liên kết thân nhân đứng đại diện (Khách hàng):
                </div>
                <div className="responsive-form-row-2-1">
                  <select
                    value={deceasedForm.customer_id || ''}
                    onChange={(e) =>
                      setDeceasedForm({ ...deceasedForm, customer_id: e.target.value ? Number(e.target.value) : null })
                    }
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  >
                    <option value="">-- Chọn khách hàng đã có trong hệ thống --</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.full_name} ({c.citizen_id})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Quan hệ (Cha con...)"
                    value={deceasedForm.relationship_type || ''}
                    onChange={(e) => setDeceasedForm({ ...deceasedForm, relationship_type: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsDeceasedModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#24594D',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Lưu Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: DECEASED DETAIL & DEATH CERTIFICATE VERIFICATION (G08) */}
      {/* ========================================================================= */}
      {selectedDeceased && (
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
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '680px',
              maxWidth: '100%',
              maxHeight: 'min(90vh, 720px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {/* Header (fixed) */}
            <div
              style={{
                flexShrink: 0,
                padding: '18px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#24594D',
                    backgroundColor: '#ECFDF5',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {selectedDeceased.deceased_code}
                </span>
                <h3 style={{ margin: '8px 0 2px 0', fontSize: '20px', color: '#111827', fontWeight: 'bold' }}>
                  {selectedDeceased.full_name}
                </h3>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>
                  Giới tính: {selectedDeceased.gender === 'MALE' ? 'Nam' : 'Nữ'} · Tôn giáo:{' '}
                  {selectedDeceased.religion || 'Không'}
                </span>
              </div>
              <button
                onClick={() => setSelectedDeceased(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body (scrollable) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Vital stats & Grave slot */}
              <div className="responsive-form-row">
              <div style={{ backgroundColor: '#F9FAFB', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600, marginBottom: '6px' }}>
                  THÔNG TIN SINH & MẤT
                </div>
                <div style={{ fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                  <strong>Ngày sinh:</strong>{' '}
                  {selectedDeceased.birth_date_precision === 'YEAR_ONLY'
                    ? `Năm ${selectedDeceased.birth_year} (Thân nhân chỉ nhớ năm sinh)`
                    : selectedDeceased.date_of_birth
                    ? new Date(selectedDeceased.date_of_birth).toLocaleDateString('vi-VN')
                    : 'Không rõ'}
                </div>
                <div style={{ fontSize: '14px', color: '#DC2626' }}>
                  <strong>Ngày mất:</strong>{' '}
                  {new Date(selectedDeceased.date_of_death).toLocaleDateString('vi-VN')}
                </div>
                {selectedDeceased.hometown && (
                  <div style={{ fontSize: '13px', color: '#4B5563', marginTop: '6px' }}>
                    <strong>Quê quán:</strong> {selectedDeceased.hometown}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#F0FDF4', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600, marginBottom: '6px' }}>
                  VỊ TRÍ AN TÁNG THỰC ĐỊA
                </div>
                {selectedDeceased.burial_slot ? (
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#14532D' }}>
                      {selectedDeceased.burial_slot.zone_name} · Ô {selectedDeceased.burial_slot.plot_code}
                    </div>
                    <div style={{ fontSize: '13px', color: '#166534', marginTop: '4px' }}>
                      Huyệt số: <strong>{selectedDeceased.burial_slot.slot_number}</strong> · Hàng:{' '}
                      {selectedDeceased.burial_slot.row_code}
                    </div>
                    {selectedDeceased.burial_slot.is_kim_tinh && (
                      <div
                        style={{
                          marginTop: '6px',
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        🛡️ Đã an táng Kim Tĩnh (Ô mộ khóa bất biến)
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>
                    Chưa an táng vào ô mộ. Có thể mua đất và lập phụ lục an táng sau khi giấy báo tử được thẩm định.
                  </div>
                )}
              </div>
            </div>

            {/* Death Certificate Section */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                padding: '18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📜</span>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 'bold' }}>
                    Hồ Sơ Giấy Báo Tử (Căn cứ pháp lý an táng)
                  </h4>
                </div>

                {!selectedDeceased.death_certificate && (
                  <button
                    onClick={() => setIsCertModalOpen(true)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#24594D',
                      color: 'white',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    + Đính kèm giấy báo tử
                  </button>
                )}
              </div>

              {selectedDeceased.death_certificate ? (
                <div>
                  {/* Status Banner */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>✓</span>
                      <div>
                        <strong>HỒ SƠ GIẤY BÁO TỬ ĐÃ LƯU TRỮ HỢP LỆ</strong>
                        {selectedDeceased.death_certificate.verified_at && (
                          <div style={{ fontSize: '11px', marginTop: '2px', color: '#166534' }}>
                            Ngày lưu: {new Date(selectedDeceased.death_certificate.verified_at).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setIsCertModalOpen(true)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'white',
                        border: '1px solid #86EFAC',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#15803D',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Sửa thông tin
                    </button>
                  </div>

                  {/* Cert detail rows */}
                  <div className="responsive-form-row">
                    <div>
                      <span style={{ color: '#6B7280' }}>Số Giấy Báo Tử:</span>{' '}
                      <strong style={{ color: '#111827' }}>
                        {selectedDeceased.death_certificate.certificate_number}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280' }}>Ngày Cấp:</span>{' '}
                      <strong>
                        {new Date(selectedDeceased.death_certificate.issue_date).toLocaleDateString('vi-VN')}
                      </strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#6B7280' }}>Cơ Quan Cấp:</span>{' '}
                      <strong>{selectedDeceased.death_certificate.issuing_authority}</strong>
                    </div>
                    {selectedDeceased.death_certificate.notes && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: '#6B7280' }}>Ghi chú:</span>{' '}
                        <span>{selectedDeceased.death_certificate.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#6B7280', fontSize: '13px' }}>
                  Chưa có thông tin giấy báo tử. Thân nhân cần cung cấp giấy báo tử có dấu đỏ trước khi lập thủ tục an táng.
                </div>
              )}
            </div>

            {/* Relatives List */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <h4 style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: 'bold' }}>
                  Thân Nhân Có Trách Nhiệm Liên Hệ
                </h4>
                {token && (
                  <button
                    onClick={() => handleOpenRelationModal(undefined, selectedDeceased.deceased_id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                      border: '1px solid #C7D2FE',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <Link2 size={14} />
                    + Thêm Thân Nhân
                  </button>
                )}
              </div>
              {selectedDeceased.relations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedDeceased.relations.map((r) => (
                    <div
                      key={r.relation_id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: '13.5px', wordBreak: 'break-word' }}>
                          {r.customer_full_name}
                        </div>
                        {token && (
                          <button
                            onClick={() => handleDeleteRelation(r.relation_id)}
                            title="Gỡ liên kết"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #FECACA',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 size={13} />
                            Gỡ
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#EEF2FF',
                            color: '#3730A3',
                            border: '1px solid #C7D2FE',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Quan hệ: {r.relationship_type}
                        </span>
                        {r.is_primary_contact && (
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              border: '1px solid #FDE68A',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            ★ Đại diện chính
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4B5563', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        <span>SĐT: <strong style={{ color: '#111827' }}>{r.phone_number}</strong></span>
                        <span>CCCD: <code style={{ color: '#111827', backgroundColor: '#F3F4F6', padding: '1px 4px', borderRadius: '4px' }}>{r.citizen_id}</code></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#9CA3AF', fontSize: '13px' }}>Chưa có thân nhân liên kết</div>
              )}
            </div>
          </div>

          {/* Footer (fixed) */}
          <div
            style={{
              flexShrink: 0,
              padding: '16px 24px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={() => setSelectedDeceased(null)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                color: '#374151',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    )}

      {/* ========================================================================= */}
      {/* MODAL: ATTACH DEATH CERTIFICATE */}
      {/* ========================================================================= */}
      {isCertModalOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '24px',
              width: '480px',
              maxWidth: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#24594D', fontSize: '18px', fontWeight: 'bold' }}>
                Đính Kèm Giấy Báo Tử
              </h3>
              <button
                onClick={() => setIsCertModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAttachCertificate}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Số Giấy Báo Tử *
                </label>
                <input
                  type="text"
                  required
                  value={certForm.certificate_number}
                  onChange={(e) => setCertForm({ ...certForm, certificate_number: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  placeholder="Ví dụ: GTT-2026-0123"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Cơ Quan Cấp Giấy *
                </label>
                <input
                  type="text"
                  required
                  value={certForm.issuing_authority}
                  onChange={(e) => setCertForm({ ...certForm, issuing_authority: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  placeholder="UBND Xã/Phường cấp"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Ngày Cấp *
                </label>
                <input
                  type="date"
                  required
                  value={certForm.issue_date}
                  onChange={(e) => setCertForm({ ...certForm, issue_date: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Ghi Chú Hồ Sơ
                </label>
                <textarea
                  rows={2}
                  value={certForm.notes || ''}
                  onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  placeholder="Thông tin đối chiếu bản chụp hoặc số vào sổ..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsCertModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#24594D',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Lưu Hồ Sơ Giấy Báo Tử
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* MODAL: CUSTOMER DETAIL */}
      {selectedCustomer && (
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
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '560px',
              maxWidth: '100%',
              maxHeight: 'min(90vh, 680px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {/* Header (fixed) */}
            <div
              style={{
                flexShrink: 0,
                padding: '18px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#24594D',
                    backgroundColor: '#ECFDF5',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {selectedCustomer.customer_code}
                </span>
                <h3 style={{ margin: '8px 0 2px 0', fontSize: '20px', color: '#111827', fontWeight: 'bold' }}>
                  {selectedCustomer.full_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body (scrollable) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div className="responsive-form-row">
                <div>
                  <span style={{ color: '#6B7280' }}>Số CCCD:</span>{' '}
                  <strong style={{ fontFamily: 'monospace' }}>{selectedCustomer.citizen_id}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Số điện thoại:</span>{' '}
                  <strong>{selectedCustomer.phone_number}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Ngày sinh:</span>{' '}
                  <strong>
                    {selectedCustomer.date_of_birth
                      ? new Date(selectedCustomer.date_of_birth).toLocaleDateString('vi-VN')
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Email:</span>{' '}
                  <strong>{selectedCustomer.email || '—'}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#6B7280' }}>Địa chỉ:</span>{' '}
                  <strong>{selectedCustomer.address}</strong>
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: 'bold' }}>
                    Danh Sách Người Thân Quá Cố Đã Gắn Kết
                  </h4>
                  {token && (
                    <button
                      onClick={() => handleOpenRelationModal(selectedCustomer.customer_id, undefined)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <Link2 size={14} />
                      + Gắn Kết Người Mất
                    </button>
                  )}
                </div>
                {selectedCustomer.relations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedCustomer.relations.map((r) => (
                      <div
                        key={r.relation_id}
                        style={{
                          padding: '12px 14px',
                          backgroundColor: '#F9FAFB',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontWeight: 600, color: '#111827', fontSize: '13.5px', wordBreak: 'break-word' }}>
                            {r.deceased_full_name}{' '}
                            <span style={{ color: '#6B7280', fontSize: '12px', fontWeight: 'normal' }}>
                              ({r.deceased_code})
                            </span>
                          </div>
                          {token && (
                            <button
                              onClick={() => handleDeleteRelation(r.relation_id)}
                              title="Gỡ liên kết"
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #FECACA',
                                backgroundColor: '#FEF2F2',
                                color: '#DC2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              <Trash2 size={13} />
                              Gỡ
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#EEF2FF',
                              color: '#3730A3',
                              border: '1px solid #C7D2FE',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            Quan hệ: {r.relationship_type}
                          </span>
                          {r.is_primary_contact && (
                            <span
                              style={{
                                fontSize: '11px',
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              ★ Đại diện chính
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#9CA3AF', fontSize: '13px', padding: '12px 0' }}>
                    Chưa có người thân quá cố nào liên kết với khách hàng này.
                  </div>
                )}
              </div>
            </div>

            {/* Footer (fixed) */}
            <div
              style={{
                flexShrink: 0,
                padding: '16px 24px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: '#374151',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ESTABLISH PROFILE RELATION (LIÊN KẾT HỒ SƠ) */}
      {/* ========================================================================= */}
      {isRelationModalOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
        >
          <div
            className="responsive-modal-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '560px',
              maxWidth: '100%',
              maxHeight: 'min(90vh, 640px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {/* Header */}
            <div
              style={{
                flexShrink: 0,
                padding: '20px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: '#24594D',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Link2 size={20} color="#24594D" />
                  Thiết Lập Liên Kết Hồ Sơ
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
                  Gắn kết quan hệ giữa Khách hàng (Thân nhân) và Người quá cố (Huyệt mộ)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRelationModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form
              id="relation-form"
              onSubmit={handleSaveRelation}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Customer Select */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Khách Hàng (Thân nhân) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  required
                  value={relationForm.customer_id}
                  onChange={(e) => setRelationForm({ ...relationForm, customer_id: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    color: '#111827',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Chọn khách hàng / thân nhân --</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      [{c.customer_code}] {c.full_name} · SĐT: {c.phone_number} (CCCD: {c.citizen_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Deceased Select */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Người Quá Cố (Hồ sơ an táng) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  required
                  value={relationForm.deceased_id}
                  onChange={(e) => setRelationForm({ ...relationForm, deceased_id: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    color: '#111827',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Chọn hồ sơ người mất --</option>
                  {deceasedList.map((d) => (
                    <option key={d.deceased_id} value={d.deceased_id}>
                      [{d.deceased_code}] {d.full_name} (Mất: {new Date(d.date_of_death).getFullYear()}) {d.burial_slot?.plot_code ? `· Mộ: ${d.burial_slot.plot_code}` : '· Chưa xếp mộ'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Relationship Type with Quick Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Mối Quan Hệ Thân Nhân <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {['Con', 'Vợ', 'Chồng', 'Bố', 'Mẹ', 'Anh', 'Chị', 'Em', 'Cháu', 'Người thừa kế', 'Người giám hộ'].map((rel) => (
                    <button
                      type="button"
                      key={rel}
                      onClick={() => setRelationForm({ ...relationForm, relationship_type: rel })}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: '16px',
                        border: relationForm.relationship_type === rel ? '1px solid #24594D' : '1px solid #E5E7EB',
                        backgroundColor: relationForm.relationship_type === rel ? '#ECFDF5' : '#F9FAFB',
                        color: relationForm.relationship_type === rel ? '#065F46' : '#4B5563',
                        fontWeight: relationForm.relationship_type === rel ? 'bold' : 'normal',
                        cursor: 'pointer',
                      }}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={relationForm.relationship_type}
                  onChange={(e) => setRelationForm({ ...relationForm, relationship_type: e.target.value })}
                  placeholder="Nhập hoặc bấm chọn quan hệ ở trên (ví dụ: Con trai cả, Em gái,...)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Is Primary Contact Checkbox */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <input
                  type="checkbox"
                  id="relation-primary-contact"
                  checked={relationForm.is_primary_contact}
                  onChange={(e) => setRelationForm({ ...relationForm, is_primary_contact: e.target.checked })}
                  style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="relation-primary-contact" style={{ fontSize: '13px', color: '#1F2937', cursor: 'pointer' }}>
                  <strong style={{ display: 'block', color: '#0F172A', marginBottom: '2px' }}>
                    Đại diện liên hệ chính (★)
                  </strong>
                  Khách hàng này sẽ là người tiếp nhận các thông báo hạn chăm sóc mộ phần, lễ giỗ thường niên, thủ tục gia hạn và dịch vụ liên quan.
                </label>
              </div>
            </form>

            {/* Footer */}
            <div
              style={{
                flexShrink: 0,
                padding: '16px 24px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsRelationModalOpen(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="relation-form"
                disabled={relationSubmitting}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#24594D',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: relationSubmitting ? 'not-allowed' : 'pointer',
                  opacity: relationSubmitting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Link2 size={16} />
                {relationSubmitting ? 'Đang lưu...' : 'Xác Nhận Liên Kết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
