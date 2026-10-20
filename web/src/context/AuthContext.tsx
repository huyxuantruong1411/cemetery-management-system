/**
 * =================================================================================================
 * QUẢN LÝ TRẠNG THÁI XÁC THỰC TOÀN CỤC & PHÂN QUYỀN RBAC (AuthContext.tsx)
 * =================================================================================================
 * 
 * [MỤC ĐÍCH NGHIỆP VỤ & KIẾN TRÚC]:
 * 1. Global Authentication State:
 *    - Quản lý trạng thái đăng nhập tập trung trong ứng dụng React (User, AccessToken, isLoading).
 *    - Tự động phục hồi phiên làm việc (Session Restoration) khi người dùng F5 / reload trang bằng
 *      cách đọc Refresh Token trong `localStorage` và xin cấp lại Access Token mới.
 * 
 * 2. Phân Quyền RBAC (Role-Based Access Control):
 *    - `hasPermission(code)`: Kiểm tra quyền chi tiết dạng `<resource>:<action>`
 *      (Ví dụ: `contracts:confirm_burial`, `plots:read`, `finance:collect_payment`).
 *    - `hasRole(role)`: Kiểm tra vai trò của người dùng (ADMIN, STAFF, CARETAKER, ACCOUNTANT).
 *    - Admin Superuser Bypass: Vai trò ADMIN tự động có quyền bypass mọi kiểm tra quyền và vai trò.
 * 
 * 3. Đồng Bộ Phiên Liên Tab / Custom Events:
 *    - Lắng nghe sự kiện `SESSION_EVENT` ('cemetery-session-change') phát từ `apiClient` để tự động
 *      cập nhật token hoặc reset state về null khi phiên bị thu hồi mà không cần reload trang.
 * =================================================================================================
 */

import React, { useEffect, useState } from 'react'
import { authApi } from '../services/authApi'
import type { User } from '../types/auth'
import { AuthContext } from './authContextDef'
import { beginSession, clearSession, refreshSession, SESSION_EVENT } from '../services/apiClient'

// Khóa lưu trữ Refresh Token trên LocalStorage
const REFRESH_TOKEN_KEY = 'cemetery_refresh_token'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Trạng thái thông tin người dùng hiện tại (bao gồm danh sách roles và permissions)
  const [user, setUser] = useState<User | null>(null)
  
  // Access Token dùng để gửi kèm vào Authorization header trong các request
  const [accessToken, setAccessToken] = useState<string | null>(null)
  
  // Trạng thái đang khởi tạo/khôi phục phiên đăng nhập khi mới mở app
  const [isLoading, setIsLoading] = useState<boolean>(true)

  /**
   * Đăng xuất người dùng:
   * 1. Lấy refresh token để gọi backend thu hồi phiên (hủy session trên database)
   * 2. Xóa toàn bộ token khỏi localStorage và phát tín hiệu cho toàn app
   * 3. Reset các state React về null
   */
  const logout = async () => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    clearSession()
    setUser(null)
    setAccessToken(null)
    if (storedRefresh) {
      await authApi.logout(storedRefresh)
    }
  }

  /**
   * Đăng nhập người dùng:
   * 1. Gửi username/password lên API `/api/v1/auth/login`
   * 2. Tăng generation phiên, lưu cặp tokens vào localStorage
   * 3. Lấy thông tin cá nhân và quyền hạn từ API `/api/v1/auth/me`
   */
  const login = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const tokens = await authApi.login(username, password)
      beginSession()
      setAccessToken(tokens.access_token)
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('cemetery_access_token', tokens.access_token)

      // Lấy thông tin chi tiết user (profile, roles, permissions)
      const userInfo = await authApi.getMe(tokens.access_token)
      setUser(userInfo)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Phục hồi phiên làm việc khi tải lại trang (Initial Mount & Session Sync):
   * - Nếu tìm thấy Refresh Token trong localStorage, tiến hành silent refresh
   * - Sau khi có token mới, lấy thông tin user qua getMe()
   * - Đăng ký lắng nghe sự kiện SESSION_EVENT để đồng bộ giữa các component
   */
  useEffect(() => {
    const updateSession = () => {
      const token = localStorage.getItem('access_token')
      setAccessToken(token)
      if (!token) setUser(null)
    }
    window.addEventListener(SESSION_EVENT, updateSession)
    let cancelled = false
    
    const initAuth = async () => {
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (!storedRefresh) {
        setIsLoading(false)
        return
      }

      try {
        // Thực hiện làm mới Access Token từ Refresh Token còn lưu
        const token = await refreshSession()
        const userInfo = await authApi.getMe(token)
        if (!cancelled && localStorage.getItem('access_token') === token) {
          setAccessToken(token)
          setUser(userInfo)
        }
      } catch {
        // Nếu refresh token đã hết hạn hoặc bị hủy, xóa phiên và chuyển về trạng thái khách
        if (!cancelled) {
          clearSession()
          setUser(null)
          setAccessToken(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    initAuth()
    return () => {
      cancelled = true
      window.removeEventListener(SESSION_EVENT, updateSession)
    }
  }, [])

  /**
   * Kiểm tra quyền hạn người dùng (Granular RBAC Check):
   * - Nếu tài khoản có vai trò 'ADMIN' -> Luôn trả về true (Superuser bypass)
   * - Ngược lại: Kiểm tra xem mã quyền `permissionCode` có nằm trong mảng user.permissions hay không
   */
  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false
    if (user.roles.some((r) => r.role_name === 'ADMIN')) return true
    return user.permissions.includes(permissionCode)
  }

  /**
   * Kiểm tra vai trò của người dùng (Role Check):
   * - Nếu tài khoản có vai trò 'ADMIN' -> Luôn trả về true
   * - Ngược lại: Kiểm tra xem user có vai trò `roleName` hay không
   */
  const hasRole = (roleName: string): boolean => {
    if (!user) return false
    if (user.roles.some((r) => r.role_name === 'ADMIN')) return true
    return user.roles.some((r) => r.role_name === roleName)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

