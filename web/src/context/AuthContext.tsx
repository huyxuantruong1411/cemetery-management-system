import React, { useEffect, useState } from 'react'
import { authApi } from '../services/authApi'
import type { User } from '../types/auth'
import { AuthContext } from './authContextDef'

const REFRESH_TOKEN_KEY = 'cemetery_refresh_token'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const logout = async () => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (storedRefresh) {
      await authApi.logout(storedRefresh)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
    setUser(null)
    setAccessToken(null)
  }

  const login = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const tokens = await authApi.login(username, password)
      setAccessToken(tokens.access_token)
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)

      const userInfo = await authApi.getMe(tokens.access_token)
      setUser(userInfo)
    } finally {
      setIsLoading(false)
    }
  }

  // Restore session on initial load
  useEffect(() => {
    const initAuth = async () => {
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (!storedRefresh) {
        setIsLoading(false)
        return
      }

      try {
        const tokens = await authApi.refreshToken(storedRefresh)
        setAccessToken(tokens.access_token)
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)

        const userInfo = await authApi.getMe(tokens.access_token)
        setUser(userInfo)
      } catch {
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        setUser(null)
        setAccessToken(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false
    if (user.roles.some((r) => r.role_name === 'ADMIN')) return true
    return user.permissions.includes(permissionCode)
  }

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
