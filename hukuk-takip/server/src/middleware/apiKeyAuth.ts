import { type NextFunction, type Request, type Response } from 'express'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { apiKeys, users } from '../db/schema.js'
import { apiKeyLookupPrefix, apiKeyMatches, isWellFormedApiKey } from '../utils/apiKeys.js'

export interface IntegrationAuth {
  userId: string
  apiKeyId: string
  scopes: string[]
}

declare global {
  namespace Express {
    interface Request {
      integration?: IntegrationAuth
    }
  }
}

const LAST_USED_RESOLUTION_MS = 60_000

// Asistan betikleri için kimlik doğrulama: Authorization: Bearer isbu_sk_...
// JWT oturumu burada KABUL EDİLMEZ; /api/integration/* yalnızca API anahtarıyla çalışır.
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const key = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!key || !isWellFormedApiKey(key)) {
    res.status(401).json({ error: 'Geçerli bir API anahtarı gerekli.' })
    return
  }

  const candidates = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, keyHash: apiKeys.keyHash, scopes: apiKeys.scopes, isActive: users.isActive })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyPrefix, apiKeyLookupPrefix(key)), isNull(apiKeys.revokedAt)))

  const match = candidates.find((row) => apiKeyMatches(key, row.keyHash))
  if (!match || !match.isActive) {
    res.status(401).json({ error: 'API anahtarı geçersiz veya iptal edilmiş.' })
    return
  }

  // L4: her istekte yazma yükü olmasın; son kullanım dakikada en çok bir kez güncellenir.
  const now = new Date()
  await db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(and(eq(apiKeys.id, match.id), or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, new Date(now.getTime() - LAST_USED_RESOLUTION_MS)))))
  req.integration = { userId: match.userId, apiKeyId: match.id, scopes: match.scopes ?? [] }
  next()
}

export function requireScope(scope: 'read' | 'propose') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.integration?.scopes.includes(scope)) {
      res.status(403).json({ error: `Bu işlem için API anahtarında '${scope}' yetkisi gerekli.` })
      return
    }
    next()
  }
}
