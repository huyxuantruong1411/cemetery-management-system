import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react'

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

export function App() {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [version, setVersion] = useState<VersionData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <header
        style={{
          backgroundColor: 'var(--brand-primary)',
          color: '#FFFFFF',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
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
            <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Hệ thống Quản lý Nghĩa trang Tư nhân
            </h1>
            <p style={{ fontSize: '12px', opacity: 0.85 }}>Cổng điều hành & Dịch vụ tập trung</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontSize: '12px',
              backgroundColor: 'rgba(255,255,255,0.12)',
              padding: '4px 10px',
              borderRadius: '20px',
            }}
          >
            {version ? `v${version.version} • ${version.environment}` : 'v0.2.0 • Foundation'}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              transition: 'background-color 0.2s',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        {/* Banner */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '6px' }}>
              Trạng thái Hạ tầng & Dịch vụ (Milestone M01)
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Kiểm tra tính sẵn sàng đồng thời của Máy chủ FastAPI, Microsoft SQL Server 2022 và MinIO Object Storage trên ổ D.
            </p>
          </div>
          <div>
            {loading ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--brand-light)',
                  color: 'var(--brand-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <RefreshCw size={14} /> Đang kiểm tra...
              </span>
            ) : error ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--status-danger-bg)',
                  color: 'var(--status-danger)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={14} /> Chưa sẵn sàng
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={14} /> Sẵn sàng hoạt động
              </span>
            )}
          </div>
        </div>

        {/* 4 State Management Rendering */}
        {loading && (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
            }}
          >
            <Activity
              size={36}
              color="var(--brand-primary)"
              style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 16px' }}
            />
            <p style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 500 }}>
              Đang truy vấn trạng thái CSDL và bộ lưu trữ MinIO...
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Vui lòng chờ trong giây lát
            </p>
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--status-danger)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-danger-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertCircle size={28} color="var(--status-danger)" />
            </div>
            <h3 style={{ fontSize: '17px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '8px' }}>
              Không thể kết nối đến hạ tầng Backend
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--status-danger)', maxWidth: '500px', margin: '0 auto 20px' }}>
              {error}
            </p>
            <button
              onClick={fetchData}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Thử lại ngay
            </button>
          </div>
        )}

        {!loading && !error && readiness && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* FastAPI Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-light)',
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
                    fontWeight: 500,
                    color: 'var(--status-success)',
                    backgroundColor: 'var(--status-success-bg)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                  }}
                >
                  Hoạt động
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>FastAPI Backend</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Môi trường Python 3.12 (uv), kiến trúc Modular Monolith phục vụ đồng thời Web và Mobile.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                Endpoint: <code>http://127.0.0.1:8000/api/v1</code>
              </div>
            </div>

            {/* SQL Server Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Database size={22} color="var(--brand-primary)" />
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--status-success)',
                    backgroundColor: 'var(--status-success-bg)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                  }}
                >
                  Đã kết nối
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Microsoft SQL Server 2022</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                37 bảng nghiệp vụ, bảo vệ quy tắc Kim Tĩnh bất biến, kết nối native qua ODBC Driver 18.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                Máy chủ: <code>DESKTOP-HKIPI1M / QL_NghiaTrang</code>
              </div>
            </div>

            {/* MinIO Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HardDrive size={22} color="var(--brand-primary)" />
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--status-success)',
                    backgroundColor: 'var(--status-success-bg)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                  }}
                >
                  Đã kết nối
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>MinIO Object Storage</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Lưu trữ hợp đồng scan, giấy báo tử và ảnh nghiệm thu. Dữ liệu mount chặt chẽ trên ổ D.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                Vị trí: <code>backend/runtime/minio/data (Ổ D)</code>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-light)',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-muted)',
          backgroundColor: '#FFFFFF',
        }}
      >
        Dự án Hệ thống Quản lý Nghĩa trang Tư nhân • Triển khai theo tiêu chuẩn AGENTS.md & EXECUTION_PLAN.md
      </footer>
    </div>
  )
}

export default App
