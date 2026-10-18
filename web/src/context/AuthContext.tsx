import React, { useEffect, useState } from 'react'
import { authApi } from '../services/authApi'
import type { User } from '../types/auth'
import { AuthContext } from './authContextDef'
import { beginSession, clearSession, refreshSession, SESSION_EVENT } from '../services/apiClient'

const REFRESH_TOKEN_KEY = 'cemetery_refresh_token'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const logout = async () => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    clearSession()
    setUser(null)
    setAccessToken(null)
    if (storedRefresh) {
      await authApi.logout(storedRefresh)
    }
  }

  const login = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const tokens = await authApi.login(username, password)
      beginSession()
      setAccessToken(tokens.access_token)
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('cemetery_access_token', tokens.access_token)

      const userInfo = await authApi.getMe(tokens.access_token)
      setUser(userInfo)
    } finally {
      setIsLoading(false)
    }
  }

  // Restore session on initial load
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
        const token = await refreshSession()
        const userInfo = await authApi.getMe(token)
        if (!cancelled && localStorage.getItem('access_token') === token) {
          setAccessToken(token)
          setUser(userInfo)
        }
      } catch {
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
