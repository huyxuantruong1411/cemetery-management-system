import { useEffect, useState } from 'react'
import {
  BarChart3,
  Clock,
  Coins,
  Compass,
  FileText,
  Hammer,
  Heart,
  LogIn,
  LogOut,
  MapPin,
  PhoneCall,
  Search,
  Shield,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
} from 'lucide-react'
import { AuditModule } from './components/audit/AuditModule'
import { LoginModal } from './components/auth/LoginModal'
import { CatalogModule } from './components/catalog/CatalogModule'
import { CareModule } from './components/care/CareModule'
import { ConstructionModule } from './components/construction/ConstructionModule'
import { ContractModule } from './components/contracts/ContractModule'
import { FinanceModule } from './components/finance/FinanceModule'
import { PlotMapModule } from './components/plots/PlotMapModule'
import { ProfileModule } from './components/profiles/ProfileModule'
import { ReportsModule } from './components/reports/ReportsModule'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'

function MainApp() {
  const { user, accessToken, logout, hasPermission } = useAuth()
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>('public_home')

  useEffect(() => {
    if (user) {
      if (hasPermission('plots:read')) {
        setActiveTab('plots')
      } else if (hasPermission('care:read')) {
        setActiveTab('care')
      } else if (hasPermission('construction:read')) {
        setActiveTab('construction')
      } else if (hasPermission('finance:read')) {
        setActiveTab('finance')
      } else if (hasPermission('contracts:read')) {
        setActiveTab('contracts')
      } else {
        setActiveTab('profiles')
      }
    } else {
      setActiveTab('public_home')
    }
  }, [user])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      {/* Topbar */}
      <header
        style={{
          backgroundColor: 'var(--brand-primary)',
          color: '#FFFFFF',
          padding: '14px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={24} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Hệ thống Quản lý Nghĩa trang Tư nhân
            </h1>
            <p style={{ fontSize: '12px', opacity: 0.85, margin: '2px 0 0 0' }}>
              {user ? 'Cổng Điều Hành & Quản Trị Tập Trung' : 'Công Viên Nghĩa Trang Sinh Thái & Dịch Vụ Tâm Linh Chu Toàn'}
            </p>
          </div>
        </div>

        {/* User profile & Auth button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.full_name}</div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  {user.roles.map((r) => (
                    <span
                      key={r.role_id}
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(212, 175, 55, 0.25)',
                        color: '#FFE082',
                        border: '1px solid rgba(212, 175, 55, 0.4)',
                      }}
                    >
                      {r.role_name}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={logout}
                title="Đăng xuất"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <LogOut size={15} />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              style={{
                backgroundColor: 'var(--brand-accent)',
                color: '#1E293B',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <LogIn size={16} />
              <span>Đăng nhập cán bộ</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation tabs if authenticated */}
      {user && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 32px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          {hasPermission('plots:read') && (
            <button
              onClick={() => setActiveTab('plots')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'plots' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'plots' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'plots' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <MapPin size={16} />
              <span>Sơ Đồ Ô Mộ</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('profiles')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'profiles' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'profiles' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'profiles' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Users size={16} />
            <span>Thân Nhân & Người Mất</span>
          </button>

          {hasPermission('contracts:read') && (
            <button
              onClick={() => setActiveTab('contracts')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'contracts' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'contracts' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'contracts' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <FileText size={16} />
              <span>Hợp Đồng & Khách Hàng</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'catalog' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'catalog' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'catalog' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Tag size={16} />
            <span>Bảng Giá & Danh Mục</span>
          </button>

          {hasPermission('finance:read') && (
            <button
              onClick={() => setActiveTab('finance')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'finance' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'finance' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'finance' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Coins size={16} />
              <span>Công Nợ & Thu Tiền</span>
            </button>
          )}

          {hasPermission('construction:read') && (
            <button
              onClick={() => setActiveTab('construction')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'construction' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'construction' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'construction' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Hammer size={16} />
              <span>Thi Công Thực Địa</span>
            </button>
          )}

          {hasPermission('care:read') && (
            <button
              onClick={() => setActiveTab('care')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'care' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'care' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'care' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Wrench size={16} />
              <span>Chăm Sóc Mộ Phần</span>
            </button>
          )}

          {hasPermission('users:read') && (
            <button
              onClick={() => setActiveTab('admin_users')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'admin_users' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'admin_users' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'admin_users' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Users size={16} />
              <span>Quản Trị Người Dùng & RBAC</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'reports' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'reports' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'reports' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <BarChart3 size={16} />
            <span>Báo Cáo Thống Kê</span>
          </button>

          {hasPermission('users:read') && (
            <button
              onClick={() => setActiveTab('audit')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'audit' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'audit' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'audit' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Shield size={16} />
              <span>Nhật Ký Kiểm Toán</span>
            </button>
          )}
        </div>
      )}

      {/* Public navigation if unauthenticated */}
      {!user && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 32px',
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setActiveTab('public_home')}
            style={{
              padding: '12px 18px',
              border: 'none',
              borderBottom: activeTab === 'public_home' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'public_home' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'public_home' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Compass size={16} />
            <span>Trang Chủ & Giới Thiệu</span>
          </button>

          <button
            onClick={() => setActiveTab('public_memorial')}
            style={{
              padding: '12px 18px',
              border: 'none',
              borderBottom: activeTab === 'public_memorial' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'public_memorial' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'public_memorial' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Search size={16} />
            <span>Tra Cứu Phần Mộ Trực Tuyến</span>
          </button>

          <button
            onClick={() => setActiveTab('public_map')}
            style={{
              padding: '12px 18px',
              border: 'none',
              borderBottom: activeTab === 'public_map' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'public_map' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'public_map' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <MapPin size={16} />
            <span>Sơ Đồ Quy Hoạch & Bản Đồ</span>
          </button>
        </div>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, padding: '32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {/* Unauthenticated View: Public Home Landing */}
        {!user && activeTab === 'public_home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Hero Section */}
            <div
              style={{
                borderRadius: '16px',
                backgroundColor: 'var(--brand-primary, #24594D)',
                color: '#FFFFFF',
                padding: '48px 40px',
                boxShadow: '0 4px 20px rgba(36, 89, 77, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
                <Heart size={18} color="#FFE082" />
                <span style={{ fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Công Viên Nghĩa Trang Sinh Thái Hiện Đại
                </span>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 700, margin: 0, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                Nơi An Nghỉ Vĩnh Hằng & Tôn Vinh Ký Ức Bình Yên
              </h2>
              <p style={{ fontSize: '15px', opacity: 0.9, margin: 0, maxWidth: '780px', lineHeight: 1.6 }}>
                Hệ thống cung cấp dịch vụ quản lý nghĩa trang toàn diện, chăm sóc mộ phần chu toàn và cổng thông tin trực tuyến
                giúp thân nhân tra cứu vị trí an táng, sơ đồ chỉ đường và nhật ký chăm sóc đã được công bố một cách trang nghiêm, minh bạch.
              </p>
              <div style={{ display: 'flex', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab('public_memorial')}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: 'var(--brand-primary, #24594D)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  <Search size={18} />
                  <span>Tra Cứu Phần Mộ Ngay</span>
                </button>
                <button
                  onClick={() => setActiveTab('public_map')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <MapPin size={18} />
                  <span>Xem Sơ Đồ Quy Hoạch</span>
                </button>
              </div>
            </div>

            {/* 3 Quick Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(36, 89, 77, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <Search size={22} color="var(--brand-primary, #24594D)" />
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                    Tra Cứu Phần Mộ Trực Tuyến
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                    Dành cho thân nhân và khách thăm viếng tìm kiếm vị trí phần mộ, xem thông tin người đã khuất và lịch sử kết quả chăm sóc đã được duyệt công bố.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('public_memorial')}
                  style={{
                    marginTop: '20px',
                    backgroundColor: 'transparent',
                    color: 'var(--brand-primary, #24594D)',
                    border: 'none',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Mở cổng tra cứu</span>
                  <span>→</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(212, 175, 55, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <MapPin size={22} color="#B45309" />
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                    Bản Đồ Quy Hoạch Thực Địa
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                    Quan sát tổng thể mặt bằng nghĩa trang, các phân khu an táng, hệ thống đường nội bộ, cảnh quan cây xanh và các công trình dịch vụ tâm linh.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('public_map')}
                  style={{
                    marginTop: '20px',
                    backgroundColor: 'transparent',
                    color: 'var(--brand-primary, #24594D)',
                    border: 'none',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Xem sơ đồ ô mộ</span>
                  <span>→</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <ShieldCheck size={22} color="#2563EB" />
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                    Cổng Dành Cho Cán Bộ Quản Lý
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                    Dành cho cán bộ quản trang, kinh doanh, kế toán và ban quản trị đăng nhập để thực hiện tác nghiệp theo vai trò được phân quyền.
                  </p>
                </div>
                <button
                  onClick={() => setIsLoginOpen(true)}
                  style={{
                    marginTop: '20px',
                    backgroundColor: 'transparent',
                    color: 'var(--brand-primary, #24594D)',
                    border: 'none',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Đăng nhập hệ thống</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* Public Service & Visiting Guide */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '28px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 20px 0', color: 'var(--text-main)' }}>
                Thông Tin Hướng Dẫn & Thăm Viếng
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ marginTop: '2px' }}>
                    <Clock size={20} color="var(--brand-primary, #24594D)" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: '#1E293B' }}>
                      Giờ Mở Cửa Thăm Viếng
                    </h4>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                      07:00 – 17:30 tất cả các ngày trong tuần, bao gồm cả Thứ Bảy, Chủ Nhật và các dịp Lễ, Tết.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ marginTop: '2px' }}>
                    <Wrench size={20} color="var(--brand-primary, #24594D)" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: '#1E293B' }}>
                      Dịch Vụ Chăm Sóc Định Kỳ
                    </h4>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                      Lau dọn phần mộ, thắp hương ngày rằm và mùng một, chỉnh trang hoa tươi và gửi báo cáo hình ảnh cho gia đình.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ marginTop: '2px' }}>
                    <PhoneCall size={20} color="var(--brand-primary, #24594D)" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: '#1E293B' }}>
                      Đường Dây Nóng Ban Quản Lý
                    </h4>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                      Túc trực 24/7 tiếp nhận các yêu cầu an táng khẩn cấp, hướng dẫn thủ tục chuyển nhượng và tiếp đón thân nhân.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unauthenticated View: Public Memorial Lookup */}
        {!user && activeTab === 'public_memorial' && (
          <ProfileModule token={null} currentUserRoles={[]} />
        )}

        {/* Unauthenticated View: Public Cemetery Map */}
        {!user && activeTab === 'public_map' && (
          <PlotMapModule token={null} onRequireLogin={() => setIsLoginOpen(true)} />
        )}

        {/* Authenticated Staff Modules */}
        {user && activeTab === 'plots' && (
          <PlotMapModule token={accessToken} onRequireLogin={() => setIsLoginOpen(true)} />
        )}

        {user && activeTab === 'profiles' && (
          <ProfileModule
            token={accessToken}
            currentUserRoles={user?.roles ? user.roles.map((r) => r.role_name) : []}
          />
        )}

        {user && activeTab === 'contracts' && (
          <ContractModule
            token={accessToken}
            currentUserRoles={user?.roles ? user.roles.map((r) => r.role_name) : []}
          />
        )}

        {user && activeTab === 'catalog' && <CatalogModule />}

        {user && activeTab === 'finance' && <FinanceModule />}

        {user && activeTab === 'construction' && <ConstructionModule />}

        {user && activeTab === 'care' && <CareModule />}

        {user && activeTab === 'admin_users' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '32px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>Quản Trị Người Dùng & Phân Quyền (RBAC)</h3>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px' }}>
              Quản trị viên có quyền tạo tài khoản mới, phân vai trò, thu hồi quyền hạn tức thời hoặc đổi mật khẩu.
            </p>
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                4 Vai Trò Tiêu Chuẩn Trong Hệ Thống:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: '1.8' }}>
                <li><strong>ADMIN:</strong> Quản trị viên toàn quyền hệ thống.</li>
                <li><strong>MARKETING:</strong> Chuyên viên kinh doanh & tiếp thị (tư vấn khách, lập hợp đồng).</li>
                <li><strong>ACCOUNTANT:</strong> Kế toán viên (theo dõi công nợ, thu tiền, xuất hóa đơn).</li>
                <li><strong>CARETAKER:</strong> Quản trang thực địa (thi công, chăm sóc, nghiệm thu an táng).</li>
              </ul>
            </div>
          </div>
        )}

        {user && activeTab === 'reports' && <ReportsModule />}

        {user && activeTab === 'audit' && <AuditModule />}
      </main>

      {/* Login Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
export default App
