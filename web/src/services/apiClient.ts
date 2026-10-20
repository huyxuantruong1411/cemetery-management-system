/**
 * =================================================================================================
 * TRUNG TÂM HTTP CLIENT & CƠ CHẾ QUẢN LÝ PHIÊN DUAL-TOKEN (apiClient.ts)
 * =================================================================================================
 * 
 * [MỤC ĐÍCH NGHIỆP VỤ & KIẾN TRÚC]:
 * 1. Dual-Token Architecture (RFC 6749 & RFC 6819):
 *    - Access Token: Thời gian sống ngắn (15-60 phút), gửi kèm header Authorization: Bearer <token>
 *      để thực thi các API nghiệp vụ.
 *    - Refresh Token: Thời gian sống dài (7-30 ngày), dùng để xin cấp lại Access Token mới mà
 *      không bắt người dùng đăng nhập lại (Silent Refresh).
 * 
 * 2. Tự Động Làm Mới Token (Seamless Refresh Interceptor):
 *    - Khi một API trả về HTTP 401 (Unauthorized - Access Token hết hạn), hàm `apiFetch` sẽ
 *      tự động chặn lại (intercept), gọi API refresh token lấy cặp token mới, sau đó thử lại
 *      (retry) request ban đầu đúng 1 lần. Trải nghiệm người dùng không bị gián đoạn.
 * 
 * 3. Chống Tranh Chấp Concurrency (Race Condition Mutex):
 *    - Biến `refreshing`: Nếu 5 API cùng bị 401 đồng thời, chỉ DUY NHẤT 1 request refresh được gửi lên
 *      máy chủ (Singleton Promise). 4 request còn lại đợi kết quả của request đầu tiên để tránh bị
 *      hệ thống backend phạt lỗi Token Reuse Detection (thu hồi toàn bộ phiên đăng nhập).
 * 
 * 4. Chống Rò Rỉ Phiên Chéo Tài Khoản (Session Generation Guard):
 *    - Biến `sessionGeneration`: Ngăn trường hợp người dùng A đăng xuất, người dùng B đăng nhập ngay,
 *      nhưng một request refresh dở dang của A trả về sau đó ghi đè làm sống lại phiên của A.
 * =================================================================================================
 */

import { authApi } from './authApi'

// Khóa lưu Refresh Token trong localStorage trình duyệt
const REFRESH_KEY = 'cemetery_refresh_token'

// Tên Custom Event phát thanh trong trình duyệt khi phiên thay đổi (để cập nhật UI tức thì)
export const SESSION_EVENT = 'cemetery-session-change'

// Promise singleton chia sẻ giữa các request 401 đồng thời (Mutex)
let refreshing: Promise<string> | null = null

// Bộ đếm thế hệ phiên: tăng mỗi khi đăng nhập mới hoặc đăng xuất
let sessionGeneration = 0

/**
 * Tăng thế hệ phiên để vô hiệu hóa tất cả các promise refresh đang bay của phiên cũ
 */
export function beginSession() { sessionGeneration += 1 }

/**
 * Xóa sạch toàn bộ token trong bộ nhớ trình duyệt và thông báo cho toàn hệ thống
 */
export function clearSession() {
  beginSession()
  for (const key of [REFRESH_KEY, 'access_token', 'cemetery_access_token']) localStorage.removeItem(key)
  // Kích hoạt sự kiện cho AuthContext và các component khác cập nhật trạng thái về Chưa đăng nhập
  window.dispatchEvent(new Event(SESSION_EVENT))
}

/**
 * Cơ chế Refresh Token an toàn:
 * - Dùng Singleton Promise để các request đồng thời không gọi trùng lặp
 * - Kiểm tra Refresh Token còn hợp lệ trước khi ghi đè
 * - Xóa phiên sạch sẽ nếu refresh thất bại (Refresh token hết hạn hoặc bị thu hồi)
 */
export function refreshSession(): Promise<string> {
  // Nếu đã có một tiến trình refresh đang chạy, tái sử dụng promise đó (không gửi request thứ 2)
  if (refreshing) return refreshing
  
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return Promise.reject(new Error('Vui lòng đăng nhập lại.'))
  
  refreshing = authApi.refreshToken(refreshToken).then(tokens => {
    // Bảo vệ phiên: Nếu trong lúc chờ phản hồi mà người dùng đã đăng xuất hoặc đổi tài khoản khác,
    // hủy ngay kết quả này để không khôi phục nhầm phiên cũ
    if (localStorage.getItem(REFRESH_KEY) !== refreshToken) throw new Error('Phiên đăng nhập đã thay đổi.')
    
    // Lưu cặp token mới được cấp (Refresh Token Rotation - token cũ tự động hủy trên server)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('cemetery_access_token', tokens.access_token)
    
    // Bắn event báo cho các tab/component biết token mới đã sẵn sàng
    window.dispatchEvent(new Event(SESSION_EVENT))
    return tokens.access_token
  }).catch(error => {
    // Nếu lỗi refresh xảy ra trên chính token hiện tại, xóa sạch phiên để đưa về trang Login
    if (localStorage.getItem(REFRESH_KEY) === refreshToken) clearSession()
    throw error
  }).finally(() => { 
    // Giải phóng mutex sau khi hoàn tất
    refreshing = null 
  })
  
  return refreshing
}

/**
 * Wrapper trung tâm cho fetch():
 * - Tự động đính kèm Bearer token từ localStorage
 * - Tự động bắt lỗi 401, làm mới token trong hậu cảnh và thử lại 1 lần duy nhất
 * - Tuyệt đối KHÔNG retry nếu gặp lỗi 403 (Forbidden - không đủ quyền)
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const generation = sessionGeneration
  const headers = new Headers(init?.headers)
  const authenticated = headers.has('Authorization')
  const current = localStorage.getItem('access_token')
  
  // Tự động gắn token mới nhất vào header nếu request yêu cầu xác thực
  if (authenticated && current) headers.set('Authorization', `Bearer ${current}`)
  
  // Gửi HTTP request ban đầu
  const response = await fetch(input, { ...init, headers })
  
  // Nếu không phải lỗi 401 hoặc request không cần auth hoặc phiên đã bị đổi giữa chừng thì trả về kết quả
  if (response.status !== 401 || !authenticated || generation !== sessionGeneration) return response
  
  try {
    // Xử lý khi bị 401 (Access Token hết hạn):
    // Kiểm tra xem request đồng thời khác đã kịp refresh lấy token mới chưa
    const latest = localStorage.getItem('access_token')
    const token = latest && latest !== current ? latest : await refreshSession()
    
    // Nếu phiên đã bị người dùng hủy giữa chừng thì không thực hiện retry
    if (generation !== sessionGeneration) return response
    
    // Thử lại (retry) đúng 1 lần với token mới được cấp
    headers.set('Authorization', `Bearer ${token}`)
    return await fetch(input, { ...init, headers })
  } catch {
    // Nếu refresh thất bại, trả về response 401 ban đầu để giao diện hiển thị thông báo
    return response
  }
}

/**
 * Trích xuất thông điệp lỗi thân thiện với người dùng từ phản hồi máy chủ:
 * - Chuẩn hóa thông báo lỗi 401 (hết hạn phiên) và 403 (không đủ quyền)
 * - Đọc chi tiết lỗi nghiệp vụ từ trường `detail` trong JSON trả về của FastAPI
 */
export async function responseError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (response.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  const body = await response.json().catch(() => ({}))
  return typeof body.detail === 'string' ? body.detail : fallback
}

