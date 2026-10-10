// Avukat tarafı (JWT): asistan betikleri için API anahtarı yönetimi.
// Anahtar yalnızca oluşturulduğu yanıtta bir kez gösterilir; DB'de sha256 özeti durur.
import { Router } from 'express'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { createApiKeySchema } from '@hukuk-takip/shared'
import { db } from '../db/index.js'
import { apiKeys, integrationEvents, users } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { generateApiKey } from '../utils/apiKeys.js'

const router = Router()
router.use(authenticate)

const publicColumns = {
  id: apiKeys.id,
  name: apiKeys.name,
  keyPrefix: apiKeys.keyPrefix,
  scopes: apiKeys.scopes,
  lastUsedAt: apiKeys.lastUsedAt,
  createdAt: apiKeys.createdAt,
  revokedAt: apiKeys.revokedAt,
}

async function assertLawyer(userId: string) {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (!user || !['admin', 'lawyer'].includes(user.role)) {
    throw Object.assign(new Error('API anahtarlarını yalnızca avukat yönetebilir.'), { status: 403 })
  }
}

router.get('/', async (req, res) => {
  const rows = await db
    .select(publicColumns)
    .from(apiKeys)
    .where(eq(apiKeys.userId, req.user!.userId))
    .orderBy(desc(apiKeys.createdAt))
  res.json(rows)
})

router.post('/', validate(createApiKeySchema), async (req, res) => {
  await assertLawyer(req.user!.userId)
  const { name, scopes } = createApiKeySchema.parse(req.body)
  const generated = generateApiKey()
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: req.user!.userId,
      name,
      scopes: [...new Set(scopes)],
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
    })
    .returning(publicColumns)
  await db.insert(integrationEvents).values({
    userId: req.user!.userId,
    actor: 'avukat',
    apiKeyId: row.id,
    action: 'api_key_created',
    details: { name, scopes: row.scopes },
  })
  res.status(201).json({
    ...row,
    key: generated.key,
    notice: 'Bu anahtar yalnızca şimdi gösterilir. Güvenli bir yere kaydedin.',
  })
})

router.post('/:id/revoke', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz anahtar kimliği.' })
    return
  }
  await assertLawyer(req.user!.userId)
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id.data), eq(apiKeys.userId, req.user!.userId), isNull(apiKeys.revokedAt)))
    .returning(publicColumns)
  if (!row) {
    const [existing] = await db
      .select(publicColumns)
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id.data), eq(apiKeys.userId, req.user!.userId)))
    if (!existing) {
      res.status(404).json({ error: 'Anahtar bulunamadı.' })
      return
    }
    res.json(existing) // zaten iptal edilmiş — idempotent
    return
  }
  await db.insert(integrationEvents).values({
    userId: req.user!.userId,
    actor: 'avukat',
    apiKeyId: row.id,
    action: 'api_key_revoked',
    details: { name: row.name },
  })
  res.json(row)
})

export default router
