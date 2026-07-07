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
  // Render cold start en kötü ~50 sn; 90 sn tavan, istekler sonsuz asılı kalmasın.
  timeout: 90_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Yavaş istek geri bildirimi ────────────────────────────────────────────────
// Render Free uykudan uyanırken ilk istek 20-50 sn sürebiliyor. Kullanıcı bu
// sürede sessiz bir iskelet ekranına bakmasın: 4 sn'yi aşan istekte bir kez
// "sunucu uyandırılıyor" bildirimi göster, sunucudan ilk yanıt gelince kapat.
const SLOW_REQUEST_MS = 4000
const WAKE_TOAST_ID = 'server-wake'
let wakeToastActive = false

function startSlowTimer(config: { _slowTimer?: ReturnType<typeof setTimeout> }) {
  config._slowTimer = setTimeout(() => {
    wakeToastActive = true
    toast.loading('Sunucu uyandırılıyor, ilk açılış 30-50 saniye sürebilir…', {
      id: WAKE_TOAST_ID,
      duration: 60_000,
    })
  }, SLOW_REQUEST_MS)
}

function settleSlowTimer(
  config?: { _slowTimer?: ReturnType<typeof setTimeout> },
  serverResponded = true
) {
  if (config?._slowTimer) clearTimeout(config._slowTimer)
  // Toast yalnızca sunucudan gerçek bir yanıt geldiğinde kapatılır; timeout /
  // ağ hatasında açık kalır (60 sn sonra kendiliğinden düşer).
  if (wakeToastActive && serverResponded) {
    wakeToastActive = false
    toast.dismiss(WAKE_TOAST_ID)
  }
}

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
    // Dosya yükleme yavaş ağda 90 sn'yi aşabilir — üst sınırı kaldır.
    config.timeout = 0
  }

  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  startSlowTimer(config as { _slowTimer?: ReturnType<typeof setTimeout> })

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
  (response) => {
    settleSlowTimer(response.config as { _slowTimer?: ReturnType<typeof setTimeout> })
    return response
  },
  async (error) => {
    const originalRequest = error.config
    settleSlowTimer(
      originalRequest as { _slowTimer?: ReturnType<typeof setTimeout> } | undefined,
      Boolean(error.response)
    )

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
