const ACCESS_TOKEN_KEY = 'isbu_access_token'
const REFRESH_TOKEN_KEY = 'isbu_refresh_token'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getAccessToken() {
  if (!canUseStorage()) return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  if (!canUseStorage()) return null
  return window.localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setAuthTokens(tokens: { accessToken?: string | null; refreshToken?: string | null }) {
  if (!canUseStorage()) return

  if (tokens.accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  }
  if (tokens.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }
}

export function clearAuthTokens() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
}
