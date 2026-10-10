import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { Pagination } from '../common/Pagination'

interface RoleItem {
  role_id: number
  role_name: string
  description?: string
  permissions?: {
    permission_id: number
    permission_code: string
    resource: string
    action: string
  }[]
}

interface UserItem {
  user_id: number
  username: string
  full_name: string
  email: string
  phone_number?: string
  is_active: boolean
  auth_version: number
  roles: { role_id: number; role_name: string; description?: string }[]
  permissions: string[]
}

export const UserManagementModule: React.FC = () => {
  const { accessToken, user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'rbac'>('users')
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Pagination
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<UserItem | null>(null)

  // Form states - Create
  const [newUsername, setNewUsername] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [newFullName, setNewFullName] = useState<string>('')
  const [newEmail, setNewEmail] = useState<string>('')
  const [newPhone, setNewPhone] = useState<string>('')
  const [newRoleIds, setNewRoleIds] = useState<number[]>([])

  // Form states - Edit
  const [editFullName, setEditFullName] = useState<string>('')
  const [editEmail, setEditEmail] = useState<string>('')
  const [editPhone, setEditPhone] = useState<string>('')
  const [editIsActive, setEditIsActive] = useState<boolean>(true)
  const [editRoleIds, setEditRoleIds] = useState<number[]>([])

  // Form states - Reset password
  const [adminNewPassword, setAdminNewPassword] = useState<string>('')

  const fetchUsersAndRoles = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/v1/auth/users', { headers }),
        fetch('/api/v1/auth/roles', { headers }),
      ])

      if (!usersRes.ok) throw new Error('Không thể tải danh sách người dùng. Vui lòng kiểm tra quyền users:read.')
      if (!rolesRes.ok) throw new Error('Không thể tải danh sách vai trò hệ thống.')

      const usersData = await usersRes.json()
      const rolesData = await rolesRes.json()

      setUsers(usersData)
      setRoles(rolesData)
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi nạp dữ liệu người dùng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsersAndRoles()
  }, [accessToken])

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/v1/auth/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          full_name: newFullName.trim(),
          email: newEmail.trim(),
          phone_number: newPhone.trim() || undefined,
          role_ids: newRoleIds,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Tạo tài khoản thất bại')
      }

      showSuccess(`Đã tạo tài khoản '${newUsername}' thành công!`)
      setIsCreateModalOpen(false)
      setNewUsername('')
      setNewPassword('')
      setNewFullName('')
      setNewEmail('')
      setNewPhone('')
      setNewRoleIds([])
      fetchUsersAndRoles()
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  // Open Edit Modal
  const openEditModal = (u: UserItem) => {
    setEditUser(u)
    setEditFullName(u.full_name)
    setEditEmail(u.email)
    setEditPhone(u.phone_number || '')
    setEditIsActive(u.is_active)
    setEditRoleIds(u.roles.map((r) => r.role_id))
  }

  // Handle Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    try {
      const res = await fetch(`/api/v1/auth/users/${editUser.user_id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: editFullName.trim(),
          email: editEmail.trim(),
          phone_number: editPhone.trim() || undefined,
          is_active: editIsActive,
          role_ids: editRoleIds,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Cập nhật tài khoản thất bại')
      }

      showSuccess(`Đã cập nhật tài khoản '${editUser.username}' thành công!`)
      setEditUser(null)
      fetchUsersAndRoles()
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  // Handle Quick Toggle Active
  const handleToggleActive = async (u: UserItem) => {
    const nextActive = !u.is_active
    const confirmText = nextActive
      ? `Bạn có chắc muốn MỞ KHÓA tài khoản '${u.username}'?`
      : `Bạn có chắc muốn KHÓA tài khoản '${u.username}'? (Các phiên đăng nhập hiện tại sẽ bị hủy ngay lập tức)`
    if (!window.confirm(confirmText)) return

    try {
      const res = await fetch(`/api/v1/auth/users/${u.user_id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: nextActive,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Thao tác khóa/mở khóa thất bại')
      }

      showSuccess(`Đã ${nextActive ? 'mở khóa' : 'khóa'} tài khoản '${u.username}'!`)
      fetchUsersAndRoles()
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPwdUser) return
    try {
      const res = await fetch(`/api/v1/auth/users/${resetPwdUser.user_id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: adminNewPassword,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Đặt lại mật khẩu thất bại')
      }

      showSuccess(`Đã đặt lại mật khẩu cho '${resetPwdUser.username}' thành công!`)
      setResetPwdUser(null)
      setAdminNewPassword('')
      fetchUsersAndRoles()
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      u.username.toLowerCase().includes(term) ||
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.phone_number && u.phone_number.includes(term))

    const matchesRole =
      roleFilter === 'ALL' || u.roles.some((r) => r.role_name === roleFilter)

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'LOCKED' && !u.is_active)

    return matchesSearch && matchesRole && matchesStatus
  })

  // Paginated Users
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          padding: '20px 24px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#EFF6F2',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Quản Trị Người Dùng & Phân Quyền (RBAC)
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '3px 0 0 0' }}>
              Quản lý tài khoản cán bộ nhân viên, vai trò truy cập và ma trận quyền theo tiêu chuẩn Lab 1–4
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchUsersAndRoles}
            disabled={loading}
            style={{
              padding: '9px 15px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(36, 89, 77, 0.2)',
            }}
          >
            <UserPlus size={16} />
            <span>Thêm Tài Khoản Mới</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#DCFCE7',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '8px',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: '#FFFFFF',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          width: 'fit-content',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          style={{
            padding: '8px 20px',
            borderRadius: '7px',
            border: 'none',
            backgroundColor: activeTab === 'users' ? 'var(--brand-primary)' : 'transparent',
            color: activeTab === 'users' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={16} />
          <span>Danh Sách Tài Khoản ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rbac')}
          style={{
            padding: '8px 20px',
            borderRadius: '7px',
            border: 'none',
            backgroundColor: activeTab === 'rbac' ? 'var(--brand-primary)' : 'transparent',
            color: activeTab === 'rbac' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Shield size={16} />
          <span>Ma Trận Phân Quyền Vai Trò ({roles.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}
        >
          {/* Filter Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              backgroundColor: '#FAFCFA',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px 12px',
                flex: '1 1 240px',
              }}
            >
              <Search size={16} color="#94A3B8" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, username, email, SĐT..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Vai trò:</span>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value)
                  setPage(1)
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12px',
                  color: '#1E293B',
                  outline: 'none',
                }}
              >
                <option value="ALL">Tất cả vai trò</option>
                {roles.map((r) => (
                  <option key={r.role_id} value={r.role_name}>
                    {r.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12px',
                  color: '#1E293B',
                  outline: 'none',
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đã bị khóa</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 600 }}>Tài khoản / Họ tên</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 600 }}>Thông tin liên hệ</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 600 }}>Vai trò (Roles)</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 600 }}>Trạng thái</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 600 }}>Phiên bảo mật</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 600 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      Không tìm thấy tài khoản người dùng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const isSelf = currentUser?.user_id === u.user_id
                    return (
                      <tr
                        key={u.user_id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B' }}>
                            {u.full_name}
                            {isSelf && (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  fontSize: '11px',
                                  backgroundColor: '#E2E8F0',
                                  color: '#475569',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                Bạn
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                            @{u.username}
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ color: '#334155' }}>{u.email}</div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>{u.phone_number || '—'}</div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {u.roles.map((r) => {
                              let bg = '#F1F5F9'
                              let fg = '#475569'
                              if (r.role_name === 'ADMIN') {
                                bg = '#FEE2E2'
                                fg = '#DC2626'
                              } else if (r.role_name === 'MARKETING') {
                                bg = '#E0F2FE'
                                fg = '#0369A1'
                              } else if (r.role_name === 'ACCOUNTANT') {
                                bg = '#FEF3C7'
                                fg = '#B45309'
                              } else if (r.role_name === 'CARETAKER') {
                                bg = '#DCFCE7'
                                fg = '#15803D'
                              }

                              return (
                                <span
                                  key={r.role_id}
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: bg,
                                    color: fg,
                                    letterSpacing: '0.02em',
                                  }}
                                  title={r.description}
                                >
                                  {r.role_name}
                                </span>
                              )
                            })}
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          {u.is_active ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#15803D',
                                backgroundColor: '#DCFCE7',
                                padding: '3px 10px',
                                borderRadius: '12px',
                              }}
                            >
                              <UserCheck size={14} /> Hoạt động
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#DC2626',
                                backgroundColor: '#FEE2E2',
                                padding: '3px 10px',
                                borderRadius: '12px',
                              }}
                            >
                              <UserX size={14} /> Bị khóa
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              backgroundColor: '#F8FAFC',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #E2E8F0',
                            }}
                            title="Auth version: tự động tăng khi đổi quyền, đổi pass hoặc bị khóa"
                          >
                            v{u.auth_version}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#334155',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              Sửa
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setResetPwdUser(u)
                                setAdminNewPassword('')
                              }}
                              title="Đặt lại mật khẩu"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#334155',
                                fontSize: '12px',
                              }}
                            >
                              <KeyRound size={14} />
                            </button>

                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleToggleActive(u)}
                              title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: isSelf ? '#F1F5F9' : u.is_active ? '#FEF2F2' : '#F0FDF4',
                                color: isSelf ? '#94A3B8' : u.is_active ? '#DC2626' : '#16A34A',
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {u.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Advanced Pagination */}
          <Pagination
            currentPage={page}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}

      {/* TAB 2: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
              Ma Trận Quyền Hạn Vai Trò Cốt Lõi (Role-Based Access Control)
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
              Quy tắc phân định trách nhiệm 4 tác nhân theo Lab 1–4, đảm bảo toàn vẹn nghiệp vụ và bảo mật
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {roles.map((r) => {
                let badgeColor = 'var(--brand-primary)'
                if (r.role_name === 'ADMIN') badgeColor = '#DC2626'
                if (r.role_name === 'MARKETING') badgeColor = '#0284C7'
                if (r.role_name === 'ACCOUNTANT') badgeColor = '#D97706'
                if (r.role_name === 'CARETAKER') badgeColor = '#16A34A'

                return (
                  <div
                    key={r.role_id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '18px',
                      backgroundColor: '#FAFCFA',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          backgroundColor: badgeColor,
                          padding: '4px 10px',
                          borderRadius: '6px',
                        }}
                      >
                        {r.role_name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                        {r.permissions?.length || 0} quyền hạn
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#334155', margin: '8px 0 14px 0', minHeight: '38px' }}>
                      {r.description || 'Không có mô tả'}
                    </p>

                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Các quyền hạn được cấp:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '180px', overflowY: 'auto' }}>
                        {r.permissions && r.permissions.length > 0 ? (
                          r.permissions.map((p) => (
                            <span
                              key={p.permission_id}
                              style={{
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                color: '#1E293B',
                              }}
                            >
                              {p.permission_code}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Chưa có phân quyền cụ thể</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
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
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Thêm Tài Khoản Người Dùng Mới</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: nv_kinhdoanh_01"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Mật khẩu khởi tạo * (tối thiểu 8 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Nhập mật khẩu..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Họ và tên cán bộ nhân viên *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Hoàng"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Email công vụ *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="hoangnv@nghiatrang.vn"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Gán vai trò hệ thống (Roles)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {roles.map((r) => {
                    const isChecked = newRoleIds.includes(r.role_id)
                    return (
                      <label
                        key={r.role_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRoleIds([...newRoleIds, r.role_id])
                            } else {
                              setNewRoleIds(newRoleIds.filter((id) => id !== r.role_id))
                            }
                          }}
                        />
                        <span>
                          <strong>{r.role_name}</strong> - {r.description}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F1F5F9',
                    fontSize: '13px',
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
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  Tạo Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
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
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
              Cập Nhật Tài Khoản: @{editUser.username}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
              Nếu thay đổi vai trò hoặc khóa tài khoản, phiên làm việc hiện tại của nhân viên sẽ tự động thu hồi ngay lập tức.
            </p>

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Họ và tên cán bộ nhân viên *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Email công vụ *
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Vai trò được gán (Roles)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {roles.map((r) => {
                    const isChecked = editRoleIds.includes(r.role_id)
                    return (
                      <label
                        key={r.role_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditRoleIds([...editRoleIds, r.role_id])
                            } else {
                              setEditRoleIds(editRoleIds.filter((id) => id !== r.role_id))
                            }
                          }}
                        />
                        <span>
                          <strong>{r.role_name}</strong> - {r.description}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                <label htmlFor="edit_is_active" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Tài khoản đang hoạt động (Bỏ chọn để khóa tài khoản)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F1F5F9',
                    fontSize: '13px',
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
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPwdUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
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
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <KeyRound size={22} color="var(--brand-primary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Đặt Lại Mật Khẩu: @{resetPwdUser.username}
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
              Sau khi đổi mật khẩu, toàn bộ token và phiên đăng nhập hiện tại của người dùng này sẽ bị hủy ngay lập tức.
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Mật khẩu mới * (tối thiểu 8 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Nhập mật khẩu mới..."
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F1F5F9',
                    fontSize: '13px',
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
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  Xác Nhận Đổi Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
