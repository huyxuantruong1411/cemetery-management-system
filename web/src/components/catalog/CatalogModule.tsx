import React, { useState, useEffect } from 'react'
import {
  Tag,
  HeartHandshake,
  FileCode,
  Calculator,
  Palette,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import type { CarePackage, ContractTemplate, PriceList, PriceLookupResult } from '../../types/catalog'

export const CatalogModule: React.FC = () => {
  const [subTab, setSubTab] = useState<'prices' | 'care' | 'templates' | 'simulator' | 'design'>('prices')
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [carePackages, setCarePackages] = useState<CarePackage[]>([])
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Simulation state
  const [simDate, setSimDate] = useState<string>('2026-10-03')
  const [simServiceCode, setSimServiceCode] = useState<string>('BURIAL')
  const [simResult, setSimResult] = useState<PriceLookupResult | null>(null)
  const [simLoading, setSimLoading] = useState<boolean>(false)

  // Modals state
  const [activeModal, setActiveModal] = useState<'new_price_list' | 'new_item' | 'new_package' | 'view_template' | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
  const [selectedPriceListId, setSelectedPriceListId] = useState<number | null>(null)

  // Form states
  const [newPlName, setNewPlName] = useState('')
  const [newPlFrom, setNewPlFrom] = useState('2026-10-03')
  const [newPlTo, setNewPlTo] = useState('')
  const [newPlActive, setNewPlActive] = useState(true)

  const [newItemCode, setNewItemCode] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('ô mộ')
  const [newItemService, setNewItemService] = useState('BURIAL')

  const [newPkgCode, setNewPkgCode] = useState('')
  const [newPkgName, setNewPkgName] = useState('')
  const [newPkgCycle, setNewPkgCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [newPkgPrice, setNewPkgPrice] = useState('')
  const [newPkgTasks, setNewPkgTasks] = useState('Dọn cỏ, Lau bia đá, Thắp hương tuần rằm')

  const getAuthToken = () => localStorage.getItem('access_token') || ''

  const loadAllData = async () => {
    setLoading(true)
    setError(null)
    const token = getAuthToken()
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [plRes, careRes, tmplRes] = await Promise.all([
        fetch('/api/v1/catalog/price-lists', { headers }),
        fetch('/api/v1/catalog/care-packages', { headers }),
        fetch('/api/v1/catalog/contract-templates', { headers }),
      ])

      if (!plRes.ok || !careRes.ok || !tmplRes.ok) {
        throw new Error('Không thể tải danh mục cấu hình nền từ máy chủ')
      }

      const [plData, careData, tmplData] = await Promise.all([
        plRes.json(),
        careRes.json(),
        tmplRes.json(),
      ])

      setPriceLists(plData)
      setCarePackages(careData)
      setTemplates(tmplData)
      if (plData.length > 0 && !selectedPriceListId) {
        setSelectedPriceListId(plData[0].price_list_id)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Đã xảy ra lỗi nạp dữ liệu')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  // Price Simulation Handler
  const handleSimulatePrice = async () => {
    setSimLoading(true)
    try {
      const res = await fetch('/api/v1/catalog/lookup-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          target_date: simDate || undefined,
          service_code: simServiceCode || undefined,
        }),
      })
      if (!res.ok) throw new Error('Không thể tra cứu giá')
      const result: PriceLookupResult = await res.json()
      setSimResult(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi tra cứu')
    } finally {
      setSimLoading(false)
    }
  }

  // Create Price List
  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/v1/catalog/price-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          price_list_name: newPlName,
          effective_from_date: newPlFrom,
          effective_to_date: newPlTo || null,
          is_active: newPlActive,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi tạo bảng giá')
      }
      setStatusMessage('Tạo bảng giá mới thành công!')
      setActiveModal(null)
      setNewPlName('')
      loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi')
    }
  }

  // Add Price Item
  const handleAddPriceItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPriceListId) return
    try {
      const res = await fetch('/api/v1/catalog/price-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          price_list_id: selectedPriceListId,
          item_code: newItemCode,
          item_name: newItemName,
          unit_price: parseFloat(newItemPrice),
          unit: newItemUnit,
          service_code: newItemService,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi thêm khoản mục giá')
      }
      setStatusMessage('Thêm khoản mục giá thành công!')
      setActiveModal(null)
      setNewItemCode('')
      setNewItemName('')
      setNewItemPrice('')
      loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi')
    }
  }

  // Toggle Care Package Active
  const handleTogglePackageActive = async (pkg: CarePackage) => {
    try {
      const res = await fetch(`/api/v1/catalog/care-packages/${pkg.package_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          is_active: !pkg.is_active,
        }),
      })
      if (!res.ok) throw new Error('Không thể thay đổi trạng thái gói')
      setStatusMessage(`Đã ${pkg.is_active ? 'ngừng kích hoạt' : 'kích hoạt lại'} gói ${pkg.package_code}`)
      loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi')
    }
  }

  // Bump Template Version
  const handleBumpTemplateVersion = async (tmpl: ContractTemplate) => {
    const newContent = prompt('Nhập nội dung sửa đổi cho điều khoản (Sẽ tự động nâng lên Version mới không hồi tố):', tmpl.content_html)
    if (!newContent || newContent === tmpl.content_html) return

    try {
      const res = await fetch(`/api/v1/catalog/contract-templates/${tmpl.template_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          content_html: newContent,
        }),
      })
      if (!res.ok) throw new Error('Không thể nâng cấp phiên bản')
      const updated: ContractTemplate = await res.json()
      setStatusMessage(`Đã nâng cấp mẫu ${updated.template_code} lên Phiên bản v${updated.version_no} (Không hồi tố)!`)
      loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi')
    }
  }

  // Create Care Package
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const taskList = newPkgTasks.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await fetch('/api/v1/catalog/care-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          package_code: newPkgCode,
          package_name: newPkgName,
          cycle_type: newPkgCycle,
          default_tasks_json: JSON.stringify(taskList),
          unit_price: parseFloat(newPkgPrice),
          is_active: true,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi tạo gói chăm sóc')
      }
      setStatusMessage('Tạo gói chăm sóc thành công!')
      setActiveModal(null)
      setNewPkgCode('')
      setNewPkgName('')
      setNewPkgPrice('')
      loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi')
    }
  }

  const selectedPriceList = priceLists.find((pl) => pl.price_list_id === selectedPriceListId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Module Title Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px 28px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} color="#B45309" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Quản Trị Cấu Hình Nền & Design System (M04)
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
                Bảng giá không hồi tố (G03), Gói chăm sóc định kỳ, Mẫu hợp đồng 4 loại chuẩn & Thư viện thành phần
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadAllData}
          style={{
            backgroundColor: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={15} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #BBF7D0',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Sub Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: '#FFFFFF',
          padding: '8px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setSubTab('prices')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'prices' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'prices' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Tag size={16} />
          <span>1. Bảng Giá & Khoản Mục ({priceLists.length})</span>
        </button>

        <button
          onClick={() => setSubTab('care')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'care' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'care' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <HeartHandshake size={16} />
          <span>2. Gói Chăm Sóc ({carePackages.length})</span>
        </button>

        <button
          onClick={() => setSubTab('templates')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'templates' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'templates' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <FileCode size={16} />
          <span>3. Mẫu Hợp Đồng 4 Loại ({templates.length})</span>
        </button>

        <button
          onClick={() => setSubTab('simulator')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'simulator' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'simulator' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Calculator size={16} />
          <span>4. Tra Cứu Giá Tức Thời</span>
        </button>

        <button
          onClick={() => setSubTab('design')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'design' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'design' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Palette size={16} />
          <span>5. Design System Gallery</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <RefreshCw size={28} className="spin" color="var(--brand-primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '12px', color: '#64748B', fontSize: '14px' }}>Đang nạp dữ liệu cấu hình...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '24px', backgroundColor: '#FEE2E2', borderRadius: '12px', border: '1px solid #FECACA', color: '#DC2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <AlertCircle size={20} />
            <span>Đã xảy ra lỗi</span>
          </div>
          <p style={{ marginTop: '6px', fontSize: '13px' }}>{error}</p>
          <button
            onClick={loadAllData}
            style={{
              marginTop: '12px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* VIEW 1: PRICING & PRICE ITEMS */}
      {!loading && !error && subTab === 'prices' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Price Lists Sidebar */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Các Bảng Giá ({priceLists.length})
              </h3>
              <button
                onClick={() => setActiveModal('new_price_list')}
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>Thêm</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {priceLists.map((pl) => (
                <div
                  key={pl.price_list_id}
                  onClick={() => setSelectedPriceListId(pl.price_list_id)}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    border: selectedPriceListId === pl.price_list_id ? '2px solid var(--brand-primary)' : '1px solid #E2E8F0',
                    backgroundColor: selectedPriceListId === pl.price_list_id ? 'rgba(36, 89, 77, 0.04)' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>{pl.price_list_name}</div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: pl.is_active ? '#DCFCE7' : '#F1F5F9',
                        color: pl.is_active ? '#15803D' : '#64748B',
                      }}
                    >
                      {pl.is_active ? 'HIỆU LỰC' : 'ĐÃ ĐÓNG'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>
                      {pl.effective_from_date} → {pl.effective_to_date || 'Vô thời hạn'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Price List Items */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  {selectedPriceList ? selectedPriceList.price_list_name : 'Chi Tiết Bảng Giá'}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  {selectedPriceList?.items.length || 0} khoản mục định giá niêm yết
                </p>
              </div>
              <button
                onClick={() => setActiveModal('new_item')}
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>Thêm Khoản Mục Giá</span>
              </button>
            </div>

            {selectedPriceList?.items.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '8px' }}>
                Bảng giá này chưa có khoản mục giá nào. Nhấn "Thêm Khoản Mục Giá" để thiết lập.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                      <th style={{ padding: '10px 12px' }}>Mã Khoản Mục</th>
                      <th style={{ padding: '10px 12px' }}>Tên Dịch Vụ / Hạng Mục</th>
                      <th style={{ padding: '10px 12px' }}>Phạm Vi Scope (G03)</th>
                      <th style={{ padding: '10px 12px' }}>Đơn Giá (VNĐ)</th>
                      <th style={{ padding: '10px 12px' }}>Đơn Vị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPriceList?.items.map((item) => (
                      <tr key={item.item_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>
                          {item.item_code}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 500, color: '#1E293B' }}>{item.item_name}</td>
                        <td style={{ padding: '12px', color: '#64748B' }}>
                          {item.service_code ? (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                              Dịch vụ: {item.service_code}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Toàn nghĩa trang</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#0F172A' }}>
                          {Number(item.unit_price).toLocaleString('vi-VN')} đ
                        </td>
                        <td style={{ padding: '12px', color: '#64748B' }}>{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: CARE PACKAGES */}
      {!loading && !error && subTab === 'care' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
              Danh Mục Gói Dịch Vụ Chăm Sóc Mộ Định Kỳ ({carePackages.length})
            </div>
            <button
              onClick={() => setActiveModal('new_package')}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>Thêm Gói Mới</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {carePackages.map((pkg) => {
            let tasks: string[] = []
            try {
              tasks = JSON.parse(pkg.default_tasks_json)
            } catch {
              tasks = [pkg.default_tasks_json]
            }

            return (
              <div
                key={pkg.package_id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  opacity: pkg.is_active ? 1 : 0.65,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                      }}
                    >
                      {pkg.cycle_type}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: pkg.is_active ? '#DCFCE7' : '#F1F5F9',
                        color: pkg.is_active ? '#15803D' : '#64748B',
                      }}
                    >
                      {pkg.is_active ? 'ĐANG KÍCH HOẠT' : 'NGỪNG ÁP DỤNG'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                    {pkg.package_name}
                  </h3>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B', marginBottom: '16px' }}>
                    Mã gói: {pkg.package_code}
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                    Quy Trình Công Việc Mặc Định:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                    {tasks.map((task, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Đơn giá niêm yết:</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {Number(pkg.unit_price).toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <button
                    onClick={() => handleTogglePackageActive(pkg)}
                    style={{
                      backgroundColor: pkg.is_active ? '#FEE2E2' : '#DCFCE7',
                      color: pkg.is_active ? '#DC2626' : '#15803D',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {pkg.is_active ? 'Ngừng Kích Hoạt' : 'Bật Lại'}
                  </button>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* VIEW 3: CONTRACT TEMPLATES */}
      {!loading && !error && subTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '13px', color: '#1E40AF' }}>
            <strong>Quy chuẩn G03 (Không hồi tố):</strong> Hệ thống hỗ trợ 4 mã loại hợp đồng chuẩn (LAND_PURCHASE, EXHUMATION, CREMATION, TRANSFER) và phụ lục an táng. Khi biên tập lại điều khoản, hệ thống tự động sinh số phiên bản mới (`v2`, `v3`) mà không làm thay đổi các hợp đồng đã ký trong quá khứ.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {templates.map((tmpl) => {
              let reqDocs: string[] = []
              try {
                if (tmpl.required_documents_json) reqDocs = JSON.parse(tmpl.required_documents_json)
              } catch {
                reqDocs = []
              }

              return (
                <div
                  key={tmpl.template_id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#E0F2FE',
                          color: '#0369A1',
                        }}
                      >
                        {tmpl.contract_type}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#FEF3C7',
                          color: '#B45309',
                        }}
                      >
                        Version v{tmpl.version_no}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                      {tmpl.template_name}
                    </h3>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B', marginBottom: '14px' }}>
                      Mã: {tmpl.template_code}
                    </div>

                    {reqDocs.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                          Hồ sơ pháp lý bắt buộc:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {reqDocs.map((doc, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#F1F5F9',
                                color: '#334155',
                                border: '1px solid #CBD5E1',
                              }}
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      onClick={() => {
                        setSelectedTemplate(tmpl)
                        setActiveModal('view_template')
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#1E293B',
                        cursor: 'pointer',
                      }}
                    >
                      Xem Điều Khoản
                    </button>
                    <button
                      onClick={() => handleBumpTemplateVersion(tmpl)}
                      style={{
                        backgroundColor: 'var(--brand-primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Nâng Phiên Bản (Bump)
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VIEW 4: PRICE LOOKUP SIMULATOR */}
      {!loading && !error && subTab === 'simulator' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Calculator size={22} color="var(--brand-primary)" />
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Công Cụ Mô Phỏng Tra Cứu Đơn Giá Tức Thời (Realtime Pricing Simulator)
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
                Kiểm chứng tính snapshot giá tại thời điểm ký kết hợp đồng, đảm bảo không bị ảnh hưởng khi bảng giá tương lai thay đổi.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Ngày áp dụng định giá</label>
              <input
                type="date"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Hạng mục / Dịch vụ</label>
              <select
                value={simServiceCode}
                onChange={(e) => setSimServiceCode(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value="BURIAL">An táng (Hạ huyệt tiêu chuẩn)</option>
                <option value="CONSTRUCTION">Thi công kim tĩnh đúc kiên cố</option>
                <option value="EXHUMATION">Cải táng sang tiểu quách</option>
                <option value="CREMATION">Hỏa táng công nghệ cao</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSimulatePrice}
            disabled={simLoading}
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: simLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Calculator size={16} />
            <span>{simLoading ? 'Đang tính toán...' : 'Tra Cứu Bảng Giá'}</span>
          </button>

          {simResult && (
            <div style={{ marginTop: '24px', padding: '20px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
                Kết Quả Khớp Bảng Giá Áp Dụng:
              </div>

              {simResult.matched ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div>Bảng giá nguồn: <strong>{simResult.price_list_name}</strong></div>
                  <div>Khoản mục: <strong>[{simResult.item_code}] {simResult.item_name}</strong></div>
                  <div>
                    Đơn giá snapshot hợp đồng:{' '}
                    <strong style={{ fontSize: '18px', color: 'var(--brand-primary)' }}>
                      {Number(simResult.unit_price).toLocaleString('vi-VN')} đ
                    </strong>{' '}
                    / {simResult.unit}
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803D' }}>
                    ✓ Kết quả khớp chính xác bảng giá hiệu lực tại ngày {simDate}.
                  </div>
                </div>
              ) : (
                <div style={{ color: '#DC2626', fontSize: '13px' }}>
                  Không tìm thấy bảng giá nào đang hiệu lực tại ngày {simDate} cho dịch vụ này.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: DESIGN SYSTEM GALLERY */}
      {!loading && !error && subTab === 'design' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
            Thư Viện Design Tokens & Thành Phần Chuẩn (Design System Gallery)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
            Thiết kế tôn nghiêm, độ tương phản cao, tối ưu cho điều kiện làm việc ánh sáng ngoài trời và chuẩn trợ năng WCAG.
          </p>

          {/* Color Tokens */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>1. Bảng Màu Thương Hiệu (Color Tokens)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#24594D', color: '#FFFFFF' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Primary Green</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>#24594D</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#D4AF37', color: '#1E293B' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Accent Gold</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>#D4AF37</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#3E885B', color: '#FFFFFF' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Secondary Green</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>#3E885B</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#1F2933', color: '#FFFFFF' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Slate Main Text</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>#1F2933</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Success State</div>
                <div style={{ fontSize: '11px' }}>#15803D</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Danger State</div>
                <div style={{ fontSize: '11px' }}>#DC2626</div>
              </div>
            </div>
          </div>

          {/* Button Variants */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>2. Các Kiểu Nút Bấm (Button Variants)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button style={{ backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Primary Solid
              </button>
              <button style={{ backgroundColor: '#D4AF37', color: '#1E293B', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Accent Gold Action
              </button>
              <button style={{ backgroundColor: '#FFFFFF', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Outline Button
              </button>
              <button style={{ backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Neutral Subtle
              </button>
              <button style={{ backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Danger Action
              </button>
            </div>
          </div>

          {/* Status Chips */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>3. Huy Hiệu Trạng Thái Ô Mộ & Hợp Đồng (Status Chips)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#DCFCE7', color: '#15803D' }}>
                EMPTY_UNSOLD (Chưa Bán)
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#B45309' }}>
                RESERVED (Đang Giữ Chỗ)
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                OCCUPIED (Đã An Táng)
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#F3E8FF', color: '#7E22CE' }}>
                KIM_TINH_LOCKED (Khóa Bất Biến)
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                EXHUMED (Đã Cải Táng)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Template HTML */}
      {activeModal === 'view_template' && selectedTemplate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>
                {selectedTemplate.template_name} (v{selectedTemplate.version_no})
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, lineHeight: '1.7', fontSize: '14px' }}>
              <div dangerouslySetInnerHTML={{ __html: selectedTemplate.content_html }} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', textAlign: 'right' }}>
              <button onClick={() => setActiveModal(null)} style={{ backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Price List */}
      {activeModal === 'new_price_list' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '460px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Tạo Bảng Giá Mới (G03)</h3>
            <form onSubmit={handleCreatePriceList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên bảng giá</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bảng Giá Điều Chỉnh Quý 3/2026"
                  value={newPlName}
                  onChange={(e) => setNewPlName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày bắt đầu hiệu lực</label>
                <input
                  type="date"
                  required
                  value={newPlFrom}
                  onChange={(e) => setNewPlFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày kết thúc (Để trống nếu vô thời hạn)</label>
                <input
                  type="date"
                  value={newPlTo}
                  onChange={(e) => setNewPlTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="pl_active"
                  checked={newPlActive}
                  onChange={(e) => setNewPlActive(e.target.checked)}
                />
                <label htmlFor="pl_active" style={{ fontSize: '13px', cursor: 'pointer' }}>Kích hoạt ngay (Kiểm tra chống trùng lặp hiệu lực)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Tạo Bảng Giá</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Price Item */}
      {activeModal === 'new_item' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Thêm Khoản Mục Giá Mới</h3>
            <form onSubmit={handleAddPriceItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã khoản mục</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: GIA-DAT-A2"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên khoản mục</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đơn giá chuyển nhượng ô mộ khu A2"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    placeholder="120000000"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn vị tính</label>
                  <input
                    type="text"
                    required
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã dịch vụ gắn kết (Scope)</label>
                <select
                  value={newItemService}
                  onChange={(e) => setNewItemService(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="BURIAL">BURIAL (An táng)</option>
                  <option value="CONSTRUCTION">CONSTRUCTION (Thi công)</option>
                  <option value="EXHUMATION">EXHUMATION (Cải táng)</option>
                  <option value="CREMATION">CREMATION (Hỏa táng)</option>
                  <option value="LAND_PURCHASE">LAND_PURCHASE (Bán đất)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Khoản Mục</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Care Package */}
      {activeModal === 'new_package' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Thêm Gói Chăm Sóc Định Kỳ Mới</h3>
            <form onSubmit={handleCreatePackage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã gói dịch vụ</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: GOI-CS-DIP-LE"
                  value={newPkgCode}
                  onChange={(e) => setNewPkgCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên gói dịch vụ</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Gói Chăm Sóc Dịp Lễ Tết"
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Chu kỳ chăm sóc</label>
                  <select
                    value={newPkgCycle}
                    onChange={(e) => setNewPkgCycle(e.target.value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="MONTHLY">MONTHLY (Hàng tháng)</option>
                    <option value="QUARTERLY">QUARTERLY (Theo quý)</option>
                    <option value="YEARLY">YEARLY (Hàng năm)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    placeholder="800000"
                    value={newPkgPrice}
                    onChange={(e) => setNewPkgPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  Danh sách công việc (ngăn cách bằng dấu phẩy)
                </label>
                <textarea
                  rows={3}
                  value={newPkgTasks}
                  onChange={(e) => setNewPkgTasks(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Gói Dịch Vụ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
