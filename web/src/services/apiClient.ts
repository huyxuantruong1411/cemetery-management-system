import { authApi } from './authApi'

const REFRESH_KEY = 'cemetery_refresh_token'
export const SESSION_EVENT = 'cemetery-session-change'
let refreshing: Promise<string> | null = null
let sessionGeneration = 0

export function beginSession() { sessionGeneration += 1 }

export function clearSession() {
  beginSession()
  for (const key of [REFRESH_KEY, 'access_token', 'cemetery_access_token']) localStorage.removeItem(key)
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function refreshSession(): Promise<string> {
  if (refreshing) return refreshing
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return Promise.reject(new Error('Vui lòng đăng nhập lại.'))
  refreshing = authApi.refreshToken(refreshToken).then(tokens => {
    // A response from a previous account must never restore that account after logout/login.
    if (localStorage.getItem(REFRESH_KEY) !== refreshToken) throw new Error('Phiên đăng nhập đã thay đổi.')
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('cemetery_access_token', tokens.access_token)
    window.dispatchEvent(new Event(SESSION_EVENT))
    return tokens.access_token
  }).catch(error => {
    if (localStorage.getItem(REFRESH_KEY) === refreshToken) clearSession()
    throw error
  }).finally(() => { refreshing = null })
  return refreshing
}

/** Refresh an expired session once; never retry a forbidden operation. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const generation = sessionGeneration
  const headers = new Headers(init?.headers)
  const authenticated = headers.has('Authorization')
  const current = localStorage.getItem('access_token')
  if (authenticated && current) headers.set('Authorization', `Bearer ${current}`)
  const response = await fetch(input, { ...init, headers })
  if (response.status !== 401 || !authenticated || generation !== sessionGeneration) return response
  try {
    // Another simultaneous request may already have rotated the session.
    const latest = localStorage.getItem('access_token')
    const token = latest && latest !== current ? latest : await refreshSession()
    if (generation !== sessionGeneration) return response
    headers.set('Authorization', `Bearer ${token}`)
    return await fetch(input, { ...init, headers })
  } catch {
    return response
  }
}

export async function responseError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (response.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  const body = await response.json().catch(() => ({}))
  return typeof body.detail === 'string' ? body.detail : fallback
}
