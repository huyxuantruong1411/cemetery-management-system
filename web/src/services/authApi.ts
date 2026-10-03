import type { TokenResponse, User } from '../types/auth'

export const authApi = {
  async login(username: string, password: string): Promise<TokenResponse> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.detail || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.')
    }
    return res.json()
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.detail || 'Phiên làm việc hết hạn.')
    }
    return res.json()
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // Ignore network errors on logout
    }
  },

  async getMe(accessToken: string): Promise<User> {
    const res = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.detail || 'Không thể xác thực thông tin người dùng.')
    }
    return res.json()
  },
}
