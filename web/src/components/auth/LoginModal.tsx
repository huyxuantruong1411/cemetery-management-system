import React, { useState } from 'react'
import { AlertCircle, Loader2, LogIn, ShieldCheck, UserCheck, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

const DEMO_ROLES = [
  {
    role: 'ADMIN',
    label: 'Quản Trị Viên',
    username: 'admin',
    password: 'Admin2026!',
    desc: 'Toàn quyền cấu hình, quản trị người dùng & giám sát',
  },
  {
    role: 'MARKETING',
    label: 'Kinh Doanh',
    username: 'marketing',
    password: 'Marketing2026!',
    desc: 'Quản lý khách hàng, tư vấn ô mộ & lập hợp đồng',
  },
  {
    role: 'ACCOUNTANT',
    label: 'Kế Toán',
    username: 'accountant',
    password: 'Accountant2026!',
    desc: 'Theo dõi công nợ, thu tiền & xuất hóa đơn',
  },
  {
    role: 'CARETAKER',
    label: 'Quản Trang',
    username: 'caretaker',
    password: 'Caretaker2026!',
    desc: 'Giám sát thi công, thực hiện chăm sóc & an táng',
  },
]

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleQuickSelect = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await login(username.trim(), password)
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: '#FFFFFF',
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={24} color="#FFFFFF" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Đăng Nhập Hệ Thống</h3>
              <p style={{ fontSize: '13px', opacity: 0.85, margin: '2px 0 0 0' }}>
                Xác thực danh tính & phân quyền nghiệp vụ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px' }}>
          {/* Quick role selection */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Chọn nhanh vai trò kiểm thử (Demo)
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}
            >
              {DEMO_ROLES.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => handleQuickSelect(d.username, d.password)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: username === d.username ? '2px solid var(--brand-primary)' : '1px solid #E2E8F0',
                    backgroundColor: username === d.username ? 'rgba(36, 89, 77, 0.08)' : '#F8FAFC',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={14} color={username === d.username ? 'var(--brand-primary)' : '#64748B'} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{d.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                    {d.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  marginBottom: '6px',
                }}
              >
                Tên đăng nhập
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  marginBottom: '6px',
                }}
              >
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(36, 89, 77, 0.2)',
                  opacity: submitting ? 0.75 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Đăng nhập</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
