// LOW8: rev14 ensureSchema henüz çalışmamışken (dağıtım penceresi) entegrasyon/öneri/nabız
// uçları çökmesin, 503 SCHEMA_NOT_READY dönsün. Veritabanı süreç içi PGlite (geçici).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { client, createTestDatabase, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()

beforeAll(async () => {
  // rev14 tabloları KURULMADAN (yalnız taban şema)
  ctx = await createTestDatabase({ integrationSchema: false })
  await ctx.db.insert(s.users).values({ id: A, email: 'nr@test', passwordHash: 'x', fullName: 'Avukat', role: 'lawyer' })
  const integration = (await import('../src/routes/integration.js')).default
  const keys = (await import('../src/routes/integrationKeys.js')).default
  const proposals = (await import('../src/routes/proposals.js')).default
  const pulse = (await import('../src/routes/pulse.js')).default
  app = await startApp((e) => {
    e.use('/api/integration', integration)
    e.use('/api/integration-keys', keys)
    e.use('/api/proposals', proposals)
    e.use('/api/pulse', pulse)
    e.get('/api/health', (_req, res) => { res.json({ ok: true }) })
  })
  call = client(app.base)
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('LOW8: şema hazır değilken 503 SCHEMA_NOT_READY', () => {
  it('öneri, anahtar ve asistan uçları 503 döner', async () => {
    const list = await call('GET', '/api/proposals', { token: tokenFor(A) })
    expect(list.status).toBe(503)
    expect(list.body.code).toBe('SCHEMA_NOT_READY')
    const keys = await call('GET', '/api/integration-keys', { token: tokenFor(A) })
    expect(keys).toMatchObject({ status: 503, body: { code: 'SCHEMA_NOT_READY' } })
    const assistant = await call('GET', '/api/integration/pulse', { key: 'isbu_sk_' + 'a'.repeat(43) })
    expect(assistant).toMatchObject({ status: 503, body: { code: 'SCHEMA_NOT_READY' } })
  })

  it('eksik kolonda nabız 503 döner, uygulama ayakta kalır', async () => {
    // Yalnız bu geçici test veritabanında: rev14 kolonu henüz yokmuş gibi.
    await ctx.pg.exec('ALTER TABLE cases RENAME COLUMN buro_kodu TO buro_kodu_yok')
    const pulse = await call('GET', '/api/pulse', { token: tokenFor(A) })
    expect(pulse).toMatchObject({ status: 503, body: { code: 'SCHEMA_NOT_READY' } })
    expect((await call('GET', '/api/health')).status).toBe(200)
  })
})
