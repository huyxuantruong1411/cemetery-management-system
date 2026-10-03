import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Coins,
  Database,
  FileCheck,
  FileText,
  Hammer,
  HardDrive,
  Key,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Server,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
} from 'lucide-react'
import { LoginModal } from './components/auth/LoginModal'
import { CatalogModule } from './components/catalog/CatalogModule'
import { ConstructionModule } from './components/construction/ConstructionModule'
import { ContractModule } from './components/contracts/ContractModule'
import { DocumentManager } from './components/documents/DocumentManager'
import { PlotMapModule } from './components/plots/PlotMapModule'
import { ProfileModule } from './components/profiles/ProfileModule'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'

interface ReadinessData {
  status: string
  database: string
  storage: string
  timestamp: string
}

interface VersionData {
  app_name: string
  version: string
  environment: string
}

function MainApp() {
  const { user, accessToken, logout, hasPermission } = useAuth()
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [version, setVersion] = useState<VersionData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>('overview')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [readyRes, verRes] = await Promise.all([
        fetch('/api/v1/health/ready'),
        fetch('/api/v1/version'),
      ])

      if (!readyRes.ok) {
        throw new Error(`Mã lỗi máy chủ: ${readyRes.status} (${readyRes.statusText})`)
      }

      const readyData: ReadinessData = await readyRes.json()
      const verData: VersionData = await verRes.json()

      setReadiness(readyData)
      setVersion(verData)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Không thể kết nối đến máy chủ API')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

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
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={22} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Hệ thống Quản lý Nghĩa trang Tư nhân
            </h1>
            <p style={{ fontSize: '12px', opacity: 0.85, margin: '2px 0 0 0' }}>Cổng Điều Hành & Quản Trị Tập Trung</p>
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
              <span>Đăng nhập</span>
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
          }}
        >
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'overview' ? 'var(--brand-primary)' : '#64748B',
              fontWeight: activeTab === 'overview' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={16} />
            <span>Hạ Tầng & Trạng Thái</span>
          </button>

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
              }}
            >
              <FileText size={16} />
              <span>Hợp Đồng & Khách Hàng</span>
            </button>
          )}

          {user && (
            <button
              onClick={() => setActiveTab('documents')}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: activeTab === 'documents' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'documents' ? 'var(--brand-primary)' : '#64748B',
                fontWeight: activeTab === 'documents' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FileCheck size={16} />
              <span>Hồ Sơ Chứng Từ & MinIO</span>
            </button>
          )}

          {user && (
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
              }}
            >
              <Tag size={16} />
              <span>Bảng Giá & Danh Mục</span>
            </button>
          )}

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
              }}
            >
              <Users size={16} />
              <span>Quản Trị Người Dùng & RBAC</span>
            </button>
          )}
        </div>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, padding: '32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {/* Banner if not logged in */}
        {!user && (
          <div
            style={{
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              marginBottom: '28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                Chào mừng bạn đến với Cổng quản trị Nghĩa trang
              </h2>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                Hệ thống yêu cầu xác thực người dùng để truy cập các phân hệ nghiệp vụ theo vai trò được phân quyền.
              </p>
            </div>
            <button
              onClick={() => setIsLoginOpen(true)}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <LogIn size={16} />
              <span>Đăng nhập ngay</span>
            </button>
          </div>
        )}

        {/* User permissions badge bar if logged in */}
        {user && (
          <div
            style={{
              padding: '18px 24px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--brand-primary)" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Quyền Hạn Thực Tế Của Tài Khoản (RBAC Active Permissions)
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Mã phiên: {user.username} · Auth Version: {user.auth_version}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {user.permissions.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#F1F5F9',
                    color: '#334155',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab 1: Overview & Health */}
        {activeTab === 'overview' && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                  Hạ Tầng Kỹ Thuật & Giám Sát Kết Nối
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Kiểm tra tính sẵn sàng của máy chủ SQL Server và lưu trữ đối tượng MinIO
                </p>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-main)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                <span>Làm mới</span>
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <AlertCircle size={20} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{error}</span>
              </div>
            )}

            {/* Infrastructure Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {/* Card 1: API */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(36, 89, 77, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Server size={22} color="var(--brand-primary)" />
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#15803D',
                      backgroundColor: '#DCFCE7',
                      padding: '3px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    HOẠT ĐỘNG
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px', marginBottom: '4px' }}>FastAPI Backend</h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Phiên bản: {version?.version || '0.2.0'} · Môi trường: {version?.environment || 'development'}
                </p>
              </div>

              {/* Card 2: SQL Server */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(212, 175, 55, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Database size={22} color="#B45309" />
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: readiness?.database ? '#15803D' : '#DC2626',
                      backgroundColor: readiness?.database ? '#DCFCE7' : '#FEE2E2',
                      padding: '3px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {readiness?.database ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG'}
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px', marginBottom: '4px' }}>SQL Server 2022</h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  CSDL: QL_NghiaTrang · Trạng thái: {readiness?.database || 'Đang kiểm tra...'}
                </p>
              </div>

              {/* Card 3: MinIO Storage */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <HardDrive size={22} color="#2563EB" />
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: readiness?.storage ? '#15803D' : '#DC2626',
                      backgroundColor: readiness?.storage ? '#DCFCE7' : '#FEE2E2',
                      padding: '3px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {readiness?.storage ? 'BỀN VỮNG' : 'CHƯA SẴN SÀNG'}
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px', marginBottom: '4px' }}>MinIO Private S3</h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Lưu trữ ổ D · Trạng thái: {readiness?.storage || 'Đang kiểm tra...'}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Plots GIS & Mapping (M05) */}
        {activeTab === 'plots' && (
          <PlotMapModule
            token={accessToken}
            onRequireLogin={() => setIsLoginOpen(true)}
          />
        )}

        {/* Tab Profiles: Customers, Deceased & Memorials (M06) */}
        {activeTab === 'profiles' && (
          <ProfileModule
            token={accessToken}
            currentUserRoles={user?.roles ? user.roles.map((r) => r.role_name) : []}
          />
        )}

        {/* Tab 3: Contracts M07 */}
        {activeTab === 'contracts' && (
          <ContractModule
            token={accessToken}
            currentUserRoles={user?.roles ? user.roles.map((r) => r.role_name) : []}
          />
        )}

        {/* Tab Documents: M03 */}
        {activeTab === 'documents' && <DocumentManager />}

        {/* Tab Catalog: M04 */}
        {activeTab === 'catalog' && <CatalogModule />}

        {/* Tab 4: Finance placeholder */}
        {activeTab === 'finance' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '32px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>Quản Lý Công Nợ & Thu Tiền</h3>
            <p style={{ fontSize: '14px', color: '#64748B' }}>
              Quyền hạn của bạn cho phép ghi nhận thanh toán, áp dụng chiết khấu và theo dõi số dư công nợ (Milestone M11).
            </p>
          </div>
        )}

        {/* Tab Construction: M09 */}
        {activeTab === 'construction' && <ConstructionModule />}

        {/* Tab 5: Care placeholder */}
        {activeTab === 'care' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '32px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>Chăm Sóc & Quản Trang Thực Địa</h3>
            <p style={{ fontSize: '14px', color: '#64748B' }}>
              Quyền hạn của bạn cho phép lập kế hoạch chăm sóc định kỳ, kiểm tra hương khói và đóng ca (Milestone M10).
            </p>
          </div>
        )}

        {/* Tab 6: Admin Users */}
        {activeTab === 'admin_users' && (
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
