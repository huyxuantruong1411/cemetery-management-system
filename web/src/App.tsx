import React, { useEffect, useState } from 'react'
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
  Menu,
  PhoneCall,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  UserCog,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { UserManagementModule } from './components/admin/UserManagementModule'
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
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'

interface NavItemProps {
  id: string
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  badge?: string
}

function SidebarNavItem({ label, icon, isActive, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
        color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)',
        fontWeight: isActive ? 600 : 500,
        fontSize: '13px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        borderLeft: isActive ? '3px solid #D4AF37' : '3px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
          e.currentTarget.style.color = '#FFFFFF'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)'
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: isActive ? '#FFE082' : 'inherit', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      {badge && (
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '999px',
            backgroundColor: 'rgba(212, 175, 55, 0.3)',
            color: '#FFE082',
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function MainApp() {
  const { user, accessToken, logout, hasPermission } = useAuth()
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>('public_home')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false)

  // Auto-close mobile drawer when viewport expands to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  // Close mobile drawer on Escape key (R14)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileMenuOpen])

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab)
    setIsMobileMenuOpen(false)
  }

  useEffect(() => {
    if (user) {
      if (!user.roles || user.roles.length === 0) {
        setActiveTab('unauthorized')
      } else if (hasPermission('plots:read')) {
        setActiveTab('plots')
      } else if (hasPermission('finance:read')) {
        setActiveTab('finance')
      } else if (hasPermission('care:execute')) {
        setActiveTab('care')
      } else if (hasPermission('construction:execute')) {
        setActiveTab('construction')
      } else if (hasPermission('contracts:read')) {
        setActiveTab('contracts')
      } else if (hasPermission('customers:read')) {
        setActiveTab('profiles')
      } else {
        setActiveTab('unauthorized')
      }
    } else {
      setActiveTab('public_home')
    }
  }, [user])

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'unauthorized':
        return 'Chưa Được Phân Quyền Vận Hành'
      case 'public_home':
        return 'Trang Chủ & Hướng Dẫn Thăm Viếng'
      case 'public_memorial':
        return 'Tra Cứu Phần Mộ Trực Tuyến (Công Khai)'
      case 'plots':
        return 'Sơ đồ & vị trí ô mộ'
      case 'profiles':
        return 'Hồ Sơ Thân Nhân & Người Đã Khuất'
      case 'contracts':
        return 'Hợp Đồng An Táng & Hồ Sơ Khách Hàng'
      case 'catalog':
        return 'Bảng Giá & Danh Mục Gói Dịch Vụ'
      case 'finance':
        return 'Công nợ & thu tiền'
      case 'construction':
        return 'Giám Sát & Thi Công Kim Tĩnh Thực Địa'
      case 'care':
        return 'Chăm Sóc & Nghiệm Thu Mộ Phần Định Kỳ'
      case 'admin_users':
        return 'Quản Trị Người Dùng & Phân Quyền (RBAC)'
      case 'reports':
        return 'Báo Cáo & Thống Kê Tổng Hợp'
      case 'audit':
        return 'Nhật Ký Kiểm Toán An Toàn Hệ Thống'
      default:
        return 'Hệ Thống Quản Lý Nghĩa Trang'
    }
  }

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="app-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Đóng danh mục điều hướng"
        />
      )}

      {/* 1. LEFT SIDEBAR NAVIGATION (Desktop Fixed / Mobile Drawer) */}
      <aside className={`app-sidebar ${isMobileMenuOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={22} color="#FFE082" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em', color: '#FFFFFF', textTransform: 'uppercase' }}>
                QL Nghĩa Trang
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                {user ? 'Điều Hành Nội Bộ' : 'Công Viên Tâm Linh'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-only touch-target"
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
            }}
            aria-label="Đóng danh mục"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Navigation Area (Auto-hiding scrollbar) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Unauthenticated Visitor Menu */}
          {!user && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '0 8px 8px',
                }}
              >
                Cổng Dành Cho Thân Nhân
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <SidebarNavItem
                  id="public_home"
                  label="Trang Chủ & Giới Thiệu"
                  icon={<Compass size={17} />}
                  isActive={activeTab === 'public_home'}
                  onClick={() => handleSelectTab('public_home')}
                />
                <SidebarNavItem
                  id="public_memorial"
                  label="Tra Cứu Phần Mộ"
                  icon={<Search size={17} />}
                  isActive={activeTab === 'public_memorial'}
                  onClick={() => handleSelectTab('public_memorial')}
                />
              </div>
            </div>
          )}

          {/* Authenticated Staff Menu */}
          {user && (!user.roles || user.roles.length === 0) && (
            <div
              style={{
                padding: '14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#FCA5A5', marginBottom: '4px' }}>
                Chưa Phân Quyền
              </div>
              <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.4 }}>
                Tài khoản chưa được gán vai trò vận hành trong hệ thống.
              </div>
            </div>
          )}

          {user && user.roles && user.roles.length > 0 && (
            <>
              {/* Group 1: Tác Nghiệp Thực Địa & Kinh Doanh */}
              {(hasPermission('plots:read') ||
                hasPermission('customers:read') ||
                hasPermission('contracts:read') ||
                hasPermission('care:execute') ||
                hasPermission('construction:execute')) && (
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.45)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0 8px 8px',
                    }}
                  >
                    Tác Nghiệp & Kinh Doanh
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {hasPermission('plots:read') && (
                      <SidebarNavItem
                        id="plots"
                        label="Sơ Đồ Ô Mộ & Bản Đồ"
                        icon={<MapPin size={17} />}
                        isActive={activeTab === 'plots'}
                        onClick={() => handleSelectTab('plots')}
                      />
                    )}
                    {hasPermission('customers:read') && (
                      <SidebarNavItem
                        id="profiles"
                        label="Thân Nhân & Người Mất"
                        icon={<Users size={17} />}
                        isActive={activeTab === 'profiles'}
                        onClick={() => handleSelectTab('profiles')}
                      />
                    )}
                    {hasPermission('contracts:read') && (
                      <SidebarNavItem
                        id="contracts"
                        label="Hợp Đồng & Khách Hàng"
                        icon={<FileText size={17} />}
                        isActive={activeTab === 'contracts'}
                        onClick={() => handleSelectTab('contracts')}
                      />
                    )}
                    {hasPermission('care:execute') && (
                      <SidebarNavItem
                        id="care"
                        label="Chăm Sóc Mộ Phần"
                        icon={<Wrench size={17} />}
                        isActive={activeTab === 'care'}
                        onClick={() => handleSelectTab('care')}
                      />
                    )}
                    {hasPermission('construction:execute') && (
                      <SidebarNavItem
                        id="construction"
                        label="Thi Công Thực Địa"
                        icon={<Hammer size={17} />}
                        isActive={activeTab === 'construction'}
                        onClick={() => handleSelectTab('construction')}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Group 2: Tài Chính & Danh Mục */}
              {(hasPermission('finance:read') || hasPermission('catalog:manage')) && (
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.45)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0 8px 8px',
                    }}
                  >
                    Tài Chính & Danh Mục
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {hasPermission('finance:read') && (
                      <SidebarNavItem
                        id="finance"
                        label="Công Nợ & Thu Tiền"
                        icon={<Coins size={17} />}
                        isActive={activeTab === 'finance'}
                        onClick={() => handleSelectTab('finance')}
                      />
                    )}
                    {hasPermission('catalog:manage') && (
                      <SidebarNavItem
                        id="catalog"
                        label="Bảng Giá & Gói Dịch Vụ"
                        icon={<Tag size={17} />}
                        isActive={activeTab === 'catalog'}
                        onClick={() => handleSelectTab('catalog')}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Group 3: Quản Trị & Hệ Thống */}
              {(hasPermission('users:read') ||
                hasPermission('reports:read') ||
                hasPermission('reports:revenue')) && (
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.45)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0 8px 8px',
                    }}
                  >
                    Quản Trị & Hệ Thống
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {hasPermission('users:read') && (
                      <SidebarNavItem
                        id="admin_users"
                        label="Quản Trị Người Dùng"
                        icon={<UserCog size={17} />}
                        isActive={activeTab === 'admin_users'}
                        onClick={() => handleSelectTab('admin_users')}
                      />
                    )}
                    {(hasPermission('reports:read') || hasPermission('reports:revenue')) && (
                      <SidebarNavItem
                        id="reports"
                        label="Báo Cáo Thống Kê"
                        icon={<BarChart3 size={17} />}
                        isActive={activeTab === 'reports'}
                        onClick={() => handleSelectTab('reports')}
                      />
                    )}
                    {hasPermission('users:read') && (
                      <SidebarNavItem
                        id="audit"
                        label="Nhật Ký Kiểm Toán"
                        icon={<Shield size={17} />}
                        isActive={activeTab === 'audit'}
                        onClick={() => handleSelectTab('audit')}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Footer: User Card / Login CTA */}
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(0,0,0,0.12)',
          }}
        >
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: '#D4AF37',
                    color: '#163830',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {user.full_name?.charAt(0) || 'U'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#FFE082',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.roles.map((r) => ({ ADMIN: 'Quản trị viên', MARKETING: 'Kinh doanh', ACCOUNTANT: 'Kế toán', CARETAKER: 'Quản trang' }[r.role_name] || r.description || 'Nhân viên')).join(', ')}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <LogOut size={14} />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#D4AF37',
                color: '#163830',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              <LogIn size={16} />
              <span>Đăng nhập cán bộ</span>
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="app-main-content">
        {/* App Topbar */}
        <header
          style={{
            height: '56px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="mobile-only touch-target"
              style={{
                background: 'none',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                color: '#24594D',
                cursor: 'pointer',
                padding: '8px',
                flexShrink: 0,
              }}
              aria-label="Mở danh mục điều hướng"
            >
              <Menu size={20} />
            </button>

            <h2
              className="text-truncate-safe"
              style={{
                fontSize: 'clamp(14px, 2.5vw, 16px)',
                fontWeight: 700,
                color: '#0F172A',
                margin: 0,
                minWidth: 0,
              }}
            >
              {getPageTitle(activeTab)}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <a
              href="tel:19008888"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#24594D',
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #DCFCE7',
              }}
              title="Hotline 24/7: 1900 8888"
            >
              <PhoneCall size={14} color="#24594D" />
              <span className="desktop-only">Hotline 24/7: <strong>1900 8888</strong></span>
            </a>
            {user && (
              <div
                className="desktop-only"
                style={{
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#166534',
                  backgroundColor: '#DCFCE7',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={14} />
                <span>Phiên làm việc bảo mật</span>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Main Area (Auto-hiding Scrollbar) */}
        <main className="app-main-scroll">
          {/* Unauthenticated View: Public Home Landing */}
          {!user && activeTab === 'public_home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1200px', margin: '0 auto' }}>
              {/* Hero Banner (Responsive padding and layout) */}
              <div className="hero-banner-responsive">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
                  <Heart size={18} color="#FFE082" />
                  <span style={{ fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Công Viên Nghĩa Trang Sinh Thái & Dịch Vụ Tâm Linh
                  </span>
                </div>
                <h2 style={{ fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 700, margin: 0, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                  Nơi An Nghỉ Vĩnh Hằng & Tôn Vinh Ký Ức Bình Yên
                </h2>
                <p style={{ fontSize: '14px', opacity: 0.9, margin: 0, maxWidth: '780px', lineHeight: 1.6 }}>
                  Hệ thống cung cấp dịch vụ quản lý nghĩa trang toàn diện, chăm sóc mộ phần chu toàn và cổng thông tin trực tuyến
                  giúp thân nhân tra cứu vị trí an táng, năm mất, quê quán và nhật ký chăm sóc đã được công bố một cách trang nghiêm, minh bạch.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveTab('public_memorial')}
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: 'var(--brand-primary, #24594D)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 20px',
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
                    onClick={() => setIsLoginOpen(true)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <LogIn size={18} />
                    <span>Cổng Cán Bộ Nội Bộ</span>
                  </button>
                </div>
              </div>

              {/* 3 Quick Action Cards (Responsive grid: 1 col on mobile, 2 col on tablet, 3 col on desktop) */}
              <div className="portal-card-grid">
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
                      <Wrench size={22} color="#B45309" />
                    </div>
                    <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                      Dịch Vụ Chăm Sóc Phần Mộ
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                      Cung cấp các gói chăm sóc định kỳ, lau dọn bia mộ, dâng hương ngày rằm và mùng một, chỉnh trang hoa tươi và gửi báo cáo hình ảnh minh bạch.
                    </p>
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '13px', color: '#B45309', fontWeight: 600 }}>
                    Liên hệ Hotline: 1900 8888
                  </div>
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

              {/* Public Visiting Guide */}
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
                <div className="portal-guide-grid">
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

          {/* Unauthenticated View: Public Memorial Lookup (Strict Zero PII) */}
          {!user && activeTab === 'public_memorial' && (
            <ProfileModule token={null} currentUserRoles={[]} />
          )}

          {/* Authenticated Staff Modules */}
          {user && (!user.roles || user.roles.length === 0 || activeTab === 'unauthorized') && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #FECACA',
                padding: '40px 24px',
                textAlign: 'center',
                maxWidth: '600px',
                margin: '40px auto',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            >
              <ShieldAlert size={52} color="#DC2626" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#991B1B', margin: '0 0 8px 0' }}>
                Tài Khoản Chưa Được Gán Quyền Vận Hành
              </h3>
              <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                Tài khoản <strong>{user.username}</strong> ({user.full_name}) đã xác thực thành công nhưng hiện chưa được phân vai trò nào trong hệ thống (vai trò rỗng). Vui lòng liên hệ Quản trị viên để được cấp vai trò vận hành.
              </p>
              <button
                onClick={() => logout()}
                style={{
                  padding: '10px 22px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <LogOut size={16} />
                <span>Đăng Xuất Khỏi Hệ Thống</span>
              </button>
            </div>
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'plots' && hasPermission('plots:read') && (
            <PlotMapModule token={accessToken} onRequireLogin={() => setIsLoginOpen(true)} />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'profiles' && hasPermission('customers:read') && (
            <ProfileModule
              token={accessToken}
              currentUserRoles={user?.roles ? user.roles.map((r) => r.role_name) : []}
            />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'contracts' && hasPermission('contracts:read') && (
            <ContractModule
              token={accessToken}
              currentUserRoles={user?.roles ? user.roles.map((r) => r.role_name) : []}
            />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'catalog' && hasPermission('catalog:manage') && (
            <CatalogModule />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'finance' && hasPermission('finance:read') && (
            <FinanceModule />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'construction' && hasPermission('construction:execute') && (
            <ConstructionModule />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'care' && hasPermission('care:execute') && (
            <CareModule />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'admin_users' && hasPermission('users:read') && (
            <UserManagementModule />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'reports' && (hasPermission('reports:read') || hasPermission('reports:revenue')) && (
            <ReportsModule />
          )}

          {user && user.roles && user.roles.length > 0 && activeTab === 'audit' && hasPermission('users:read') && (
            <AuditModule />
          )}
        </main>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  )
}
export default App
