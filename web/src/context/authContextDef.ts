import { createContext } from 'react'
import type { User } from '../types/auth'

export interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permissionCode: string) => boolean
  hasRole: (roleName: string) => boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
