import { describe, expect, it } from 'vitest'
import { apiKeyLookupPrefix, apiKeyMatches, generateApiKey, hashApiKey, isWellFormedApiKey } from '../src/utils/apiKeys.js'

describe('api key hashing', () => {
  it('generates prefixed random keys whose hash is stored, never the key', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).toMatch(/^isbu_sk_[A-Za-z0-9_-]{43}$/)
    expect(a.key).not.toBe(b.key)
    expect(a.prefix).toBe(a.key.slice(0, 16))
    expect(a.hash).toBe(hashApiKey(a.key))
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(isWellFormedApiKey(a.key)).toBe(true)
    expect(apiKeyLookupPrefix(a.key)).toBe(a.prefix)
  })

  it('compares hashes in constant time and rejects mismatches', () => {
    const { key, hash } = generateApiKey()
    expect(apiKeyMatches(key, hash)).toBe(true)
    expect(apiKeyMatches(key + 'x', hash)).toBe(false)
    expect(apiKeyMatches(key, 'abcd')).toBe(false)
  })

  it('rejects malformed keys', () => {
    expect(isWellFormedApiKey('isbu_sk_short')).toBe(false)
    expect(isWellFormedApiKey('Bearer isbu_sk_' + 'a'.repeat(43))).toBe(false)
    expect(isWellFormedApiKey('sk_' + 'a'.repeat(43))).toBe(false)
  })
})
