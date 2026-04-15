// Auth kullanıcısını localStorage'a kaydet — reload'da beyaz ekran olmasın.
// /auth/me arka planda yenilenir; ön yüz kesintisiz çalışır.

const AUTH_CACHE_KEY = 'hz-auth-user'

export interface CachedUser {
  id?: string
  email?: string
  fullName?: string
  role?: string
  [k: string]: unknown
}

export function readCachedUser(): CachedUser | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.email) return parsed
    return null
  } catch {
    return null
  }
}

export function writeCachedUser(user: CachedUser | null | undefined): void {
  try {
    if (user && user.email) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY)
    }
  } catch {
    // sessizce geç
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY)
  } catch {
    // sessizce geç
  }
}
