export interface Role {
  role_id: number
  role_name: string
  description?: string
}

export interface User {
  user_id: number
  username: string
  full_name: string
  email: string
  phone_number?: string | null
  is_active: boolean
  auth_version: number
  roles: Role[]
  permissions: string[]
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}
