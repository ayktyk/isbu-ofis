import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// Anahtar biçimi: isbu_sk_<43 karakter base64url>. Veritabanında yalnızca
// ilk 16 karakter (arama öneki) ve sha256 özeti saklanır.
export const API_KEY_PREFIX = 'isbu_sk_'
const LOOKUP_PREFIX_LENGTH = 16

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

export function apiKeyLookupPrefix(key: string): string {
  return key.slice(0, LOOKUP_PREFIX_LENGTH)
}

export function generateApiKey() {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  return { key, prefix: apiKeyLookupPrefix(key), hash: hashApiKey(key) }
}

export function isWellFormedApiKey(key: string): boolean {
  return /^isbu_sk_[A-Za-z0-9_-]{32,64}$/.test(key)
}

// Sabit zamanlı karşılaştırma (hex özetler eşit uzunlukta).
export function apiKeyMatches(key: string, storedHash: string): boolean {
  const a = Buffer.from(hashApiKey(key), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
