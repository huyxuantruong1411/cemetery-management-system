import React, { useState, useEffect } from 'react';
import type {
  Customer,
  CustomerCreate,
  DeceasedProfile,
  DeceasedProfileCreate,
  DeathCertificateCreate,
  DeathCertificateVerifyRequest,
  DeceasedPublicLookupResponse,
} from '../../types/profiles';

interface ProfileModuleProps {
  token: string | null;
  currentUserRoles?: string[];
}

export const ProfileModule: React.FC<ProfileModuleProps> = ({ token, currentUserRoles = [] }) => {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'DECEASED' | 'MEMORIAL_PUBLIC'>('CUSTOMERS');

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
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Public Memorial search states
  const [memorialQuery, setMemorialQuery] = useState('');
  const [memorialResults, setMemorialResults] = useState<DeceasedPublicLookupResponse[]>([]);
  const [isMemorialLoading, setIsMemorialLoading] = useState(false);

  // Common states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isStaff = currentUserRoles.some((r) =>
    ['ADMIN', 'QUAN_TRANG', 'MARKETING', 'ACCOUNTANT'].includes(r.toUpperCase())
  );

  useEffect(() => {
    if (activeTab === 'CUSTOMERS' && token) {
      loadCustomers();
    } else if (activeTab === 'DECEASED' && token) {
      loadDeceased();
    }
  }, [activeTab, token]);

  // Load Customers
  const loadCustomers = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : '';
      const res = await fetch(`http://127.0.0.1:8000/api/v1/profiles/customers${q}`, {
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
      const res = await fetch(`http://127.0.0.1:8000/api/v1/profiles/deceased${q}`, {
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
      const res = await fetch('http://127.0.0.1:8000/api/v1/profiles/customers', {
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

      const res = await fetch('http://127.0.0.1:8000/api/v1/profiles/deceased', {
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
        `http://127.0.0.1:8000/api/v1/profiles/deceased/${selectedDeceased.deceased_id}/certificate`,
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
        `http://127.0.0.1:8000/api/v1/profiles/deceased/${selectedDeceased.deceased_id}`,
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

  // Verify / Reject Certificate (G08)
  const handleVerifyCertificate = async (isVerified: boolean, reason?: string) => {
    if (!token || !selectedDeceased || !selectedDeceased.death_certificate) return;
    setErrorMsg(null);
    try {
      const payload: DeathCertificateVerifyRequest = {
        is_verified: isVerified,
        rejection_reason: reason || null,
        notes: isVerified ? 'Đã đối chiếu bản gốc hợp lệ' : 'Hồ sơ chưa đủ điều kiện',
      };

      const certId = selectedDeceased.death_certificate.cert_id;
      const res = await fetch(`http://127.0.0.1:8000/api/v1/profiles/certificates/${certId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Không thể cập nhật thẩm định');
      }

      setSuccessMsg(
        isVerified ? 'Xác minh giấy báo tử thành công! Đủ điều kiện an táng.' : 'Đã từ chối giấy báo tử.'
      );
      setIsRejectModalOpen(false);

      // Reload deceased
      const updatedRes = await fetch(
        `http://127.0.0.1:8000/api/v1/profiles/deceased/${selectedDeceased.deceased_id}`,
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

  // Public Memorial search
  const handleMemorialSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memorialQuery.trim()) return;
    setIsMemorialLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/v1/profiles/public/memorials?q=${encodeURIComponent(memorialQuery.trim())}`
      );
      if (!res.ok) throw new Error('Không thể tra cứu thông tin tưởng niệm');
      const data: DeceasedPublicLookupResponse[] = await res.json();
      setMemorialResults(data);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsMemorialLoading(false);
    }
  };

  // Filtered deceased list
  const filteredDeceased = deceasedList.filter((d) => {
    if (deceasedFilter === 'VERIFIED') return d.death_certificate?.is_verified === true;
    if (deceasedFilter === 'UNVERIFIED') return d.death_certificate?.is_verified !== true;
    return true;
  });

  return (
    <div className="profile-module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#24594D', fontSize: '24px', fontWeight: 'bold' }}>
            Hồ Sơ Khách Hàng & Người Quá Cố
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '14px' }}>
            Quản lý thân nhân, hồ sơ người mất (G07), thẩm định giấy báo tử (G08) và Cổng tra cứu tưởng niệm không rò rỉ PII
          </p>
        </div>

        {/* Global tabs */}
        <div style={{ display: 'flex', gap: '8px', background: '#F3F4F6', padding: '4px', borderRadius: '10px' }}>
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
            }}
          >
            ⚰️ Người Quá Cố & Giấy Báo Tử
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
            }}
          >
            🪷 Cổng Tra Cứu Tưởng Niệm (Công Khai)
          </button>
        </div>
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
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '500px' }}>
              <input
                type="text"
                placeholder="Tìm theo tên, mã KH, số CCCD, số điện thoại..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
                style={{
                  flex: 1,
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
                }}
              >
                Tìm Kiếm
              </button>
            </div>

            <button
              onClick={() => setIsCustomerModalOpen(true)}
              style={{
                padding: '9px 18px',
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
              }}
            >
              <span>+</span> Thêm Khách Hàng Thân Nhân
            </button>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Mã KH</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Họ và Tên</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Số CCCD (Duy Nhất)</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Số Điện Thoại</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Ngày Sinh (G07)</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Địa Chỉ</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Người Thân Quá Cố</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600, textAlign: 'right' }}>
                      Thao Tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
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
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
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
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                placeholder="Tìm theo họ tên, mã người mất, quê quán..."
                value={deceasedSearch}
                onChange={(e) => setDeceasedSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDeceased()}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                  width: '320px',
                }}
              />
              <button
                onClick={loadDeceased}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#24594D',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Tìm Kiếm
              </button>

              {/* Filter chips */}
              <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
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
                  }}
                >
                  ✓ Đã xác minh giấy tờ
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
                  }}
                >
                  ⏳ Chờ / Chưa xác minh
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsDeceasedModalOpen(true)}
              style={{
                padding: '9px 18px',
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
              }}
            >
              <span>+</span> Thêm Hồ Sơ Người Mất
            </button>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Mã Hồ Sơ</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Họ và Tên</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Giới Tính</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Sinh - Mất (G07)</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Quê Quán</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Giấy Báo Tử (G08)</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Vị Trí Mộ Phần</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600 }}>Thân Nhân Liên Hệ</th>
                    <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: 600, textAlign: 'right' }}>
                      Thao Tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeceased.map((d) => {
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
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
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
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PUBLIC MEMORIAL PORTAL (ZERO PII - G19 & ADR-001) */}
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

            <form
              onSubmit={handleMemorialSearch}
              style={{ display: 'flex', gap: '8px', maxWidth: '560px', margin: '0 auto' }}
            >
              <input
                type="text"
                placeholder="Nhập họ tên hoặc mã người quá cố (ví dụ: Nguyễn Văn Phúc hoặc NM-2024)..."
                value={memorialQuery}
                onChange={(e) => setMemorialQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '15px',
                  color: '#111827',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isMemorialLoading}
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
                {isMemorialLoading ? 'Đang tìm...' : 'Tra Cứu'}
              </button>
            </form>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                {memorialResults.map((item) => (
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
                          }}
                        >
                          🛡️ Mộ Kim Tĩnh
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
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#24594D', marginBottom: '4px' }}>
                        📍 VỊ TRÍ AN TÁNG TẠI NGHĨA TRANG:
                      </div>
                      {item.plot_code ? (
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                          {item.zone_name} · Hàng {item.row_code} · Ô mộ {item.plot_code}{' '}
                          {item.slot_number ? `(Slot ${item.slot_number})` : ''}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Chưa ghi nhận vị trí an táng thực địa</div>
                      )}
                    </div>
                  </div>
                ))}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Ngày Sinh (G07)
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
                Thêm Hồ Sơ Người Quá Cố (G07)
              </h3>
              <button
                onClick={() => setIsDeceasedModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeceased}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
                    Thân nhân chỉ nhớ năm sinh (G07 Invariant - Không bịa ngày 01/01)
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
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
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '28px',
              width: '700px',
              maxWidth: '92%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: '14px',
                marginBottom: '18px',
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
                <h3 style={{ margin: '8px 0 2px 0', fontSize: '22px', color: '#111827' }}>
                  {selectedDeceased.full_name}
                </h3>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>
                  Giới tính: {selectedDeceased.gender === 'MALE' ? 'Nam' : 'Nữ'} · Tôn giáo:{' '}
                  {selectedDeceased.religion || 'Không'}
                </span>
              </div>
              <button
                onClick={() => setSelectedDeceased(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}
              >
                ✕
              </button>
            </div>

            {/* Vital stats & Grave slot */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#F9FAFB', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600, marginBottom: '6px' }}>
                  THÔNG TIN SINH & MẤT (G07)
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

            {/* Death Certificate Section (G08) */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📜</span>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 'bold' }}>
                    Giấy Báo Tử (Căn cứ pháp lý duyệt an táng - G08)
                  </h4>
                </div>

                {!selectedDeceased.death_certificate && (
                  <button
                    onClick={() => setIsCertModalOpen(true)}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#24594D',
                      color: 'white',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
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
                      backgroundColor: selectedDeceased.death_certificate.is_verified ? '#DCFCE7' : '#FEF3C7',
                      color: selectedDeceased.death_certificate.is_verified ? '#15803D' : '#92400E',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>
                        {selectedDeceased.death_certificate.is_verified ? '✓' : '⏳'}
                      </span>
                      <div>
                        <strong>
                          {selectedDeceased.death_certificate.is_verified
                            ? 'ĐÃ ĐƯỢC THẨM ĐỊNH & PHÊ DUYỆT HỢP LỆ'
                            : 'ĐANG CHỜ NHÂN VIÊN CÓ THẨM QUYỀN THẨM ĐỊNH'}
                        </strong>
                        {selectedDeceased.death_certificate.verifier_name && (
                          <div style={{ fontSize: '11px', marginTop: '2px' }}>
                            Người xác minh: {selectedDeceased.death_certificate.verifier_name} · Ngày:{' '}
                            {selectedDeceased.death_certificate.verified_at
                              ? new Date(selectedDeceased.death_certificate.verified_at).toLocaleString('vi-VN')
                              : ''}
                          </div>
                        )}
                        {selectedDeceased.death_certificate.rejection_reason && (
                          <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                            Lý do từ chối: {selectedDeceased.death_certificate.rejection_reason}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setIsCertModalOpen(true)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'white',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#374151',
                      }}
                    >
                      Sửa thông tin
                    </button>
                  </div>

                  {/* Cert detail rows */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
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
                  </div>

                  {/* Verification action buttons for staff */}
                  {isStaff && (
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '14px',
                        borderTop: '1px solid #E5E7EB',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                      }}
                    >
                      {!selectedDeceased.death_certificate.is_verified ? (
                        <>
                          <button
                            onClick={() => setIsRejectModalOpen(true)}
                            style={{
                              padding: '7px 14px',
                              backgroundColor: '#FEE2E2',
                              color: '#991B1B',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            Từ Chối Giấy Báo Tử
                          </button>
                          <button
                            onClick={() => handleVerifyCertificate(true)}
                            style={{
                              padding: '7px 16px',
                              backgroundColor: '#16A34A',
                              color: 'white',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            ✓ Thẩm Định & Phê Duyệt An Táng
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsRejectModalOpen(true)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            borderRadius: '6px',
                            border: '1px solid #FCD34D',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Thu hồi xác minh
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#6B7280', fontSize: '13px' }}>
                  Chưa có thông tin giấy báo tử. Thân nhân cần cung cấp giấy báo tử có dấu đỏ trước khi lập thủ tục an táng.
                </div>
              )}
            </div>

            {/* Relatives List */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#111827', fontWeight: 'bold' }}>
                Thân Nhân Có Trách Nhiệm Liên Hệ
              </h4>
              {selectedDeceased.relations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDeceased.relations.map((r) => (
                    <div
                      key={r.relation_id}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}
                    >
                      <div>
                        <strong>{r.customer_full_name}</strong> · Quan hệ: <em>{r.relationship_type}</em>{' '}
                        {r.is_primary_contact && (
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              marginLeft: '4px',
                            }}
                          >
                            ★ Đại diện chính
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#4B5563' }}>
                        SĐT: <strong>{r.phone_number}</strong> · CCCD: <code>{r.citizen_id}</code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#9CA3AF', fontSize: '13px' }}>Chưa có thân nhân liên kết</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATTACH DEATH CERTIFICATE */}
      {/* ========================================================================= */}
      {isCertModalOpen && (
        <div
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
                Đính Kèm Giấy Báo Tử (G08)
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
                  Lưu & Gửi Thẩm Định
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJECT CERTIFICATE */}
      {/* ========================================================================= */}
      {isRejectModalOpen && (
        <div
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
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '24px',
              width: '450px',
              maxWidth: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', color: '#991B1B', fontSize: '18px', fontWeight: 'bold' }}>
              Từ Chối Giấy Báo Tử
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#4B5563' }}>
              Vui lòng nhập lý do từ chối để thân nhân có căn cứ bổ sung hồ sơ hợp lệ:
            </p>

            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Bản chụp mờ không rõ số quyết định, yêu cầu bản sao có chứng thực..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
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
                type="button"
                onClick={() => handleVerifyCertificate(false, rejectReason)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMER DETAIL */}
      {selectedCustomer && (
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
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '28px',
              width: '560px',
              maxWidth: '92%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: '14px',
                marginBottom: '16px',
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
                <h3 style={{ margin: '8px 0 2px 0', fontSize: '20px', color: '#111827' }}>
                  {selectedCustomer.full_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '20px' }}>
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
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#111827', fontWeight: 'bold' }}>
                Danh Sách Người Thân Quá Cố Đã Gắn Kết
              </h4>
              {selectedCustomer.relations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedCustomer.relations.map((r) => (
                    <div
                      key={r.relation_id}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}
                    >
                      <div>
                        <strong>{r.deceased_full_name}</strong> ({r.deceased_code})
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#E0E7FF',
                            color: '#3730A3',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
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
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              marginLeft: '6px',
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
