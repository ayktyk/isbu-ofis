import axios from 'axios'
import { toast } from 'sonner'
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from './authTokens'

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const apiBaseUrl =
  rawApiBaseUrl && rawApiBaseUrl.length > 0
    ? rawApiBaseUrl.replace(/\/+$/, '')
    : '/api'

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(undefined)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = getRefreshToken()
        const refreshResponse = await axios.post(
          buildApiUrl('/auth/refresh'),
          { refreshToken },
          { withCredentials: true }
        )
        const newAccess =
          typeof refreshResponse.data?.accessToken === 'string' && refreshResponse.data.accessToken.length > 0
            ? refreshResponse.data.accessToken
            : null
        const newRefresh =
          typeof refreshResponse.data?.refreshToken === 'string' && refreshResponse.data.refreshToken.length > 0
            ? refreshResponse.data.refreshToken
            : null
        // Sunucu cookie tabanlı session kullanıyorsa response body boş olabilir;
        // bu durumda mevcut token'larla devam eder. Ama "ne body ne cookie"
        // senaryosunda sonsuz 401 döngüsüne girmemek için boş response'u hata say.
        if (!newAccess && !newRefresh && !refreshResponse.headers?.['set-cookie']) {
          throw new Error('Refresh response invalid: no tokens returned')
        }
        if (newAccess || newRefresh) {
          setAuthTokens({
            accessToken: newAccess,
            refreshToken: newRefresh,
          })
        }
        processQueue(null)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        clearAuthTokens()
        if (window.location.pathname !== '/login') {
          toast.error('Oturum suresi doldu. Tekrar giris yapin.')
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status === 403) {
      toast.error('Bu islem icin yetkiniz bulunmuyor.')
    }

    if (error.response?.status === 422) {
      return Promise.reject(error)
    }

    if (error.response?.status >= 500) {
      toast.error('Sunucu hatasi olustu. Lutfen tekrar deneyin.')
    }

    if (!error.response) {
      toast.error('Baglanti hatasi. Internet baglantinizi kontrol edin.')
    }

    return Promise.reject(error)
  }
)

export default api
