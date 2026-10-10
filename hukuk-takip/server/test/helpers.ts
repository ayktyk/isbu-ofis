// Test altyapısı: süreç içi PGlite (gerçek Postgres 17, WASM) + Express uygulaması.
// Uzak veritabanına HİÇBİR bağlantı yapılmaz.
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '../src/db/schema.js'
import { setDbForTests } from '../src/db/index.js'
import { REV14_INTEGRATION_SQL, REV15_INTEGRATION_SQL } from '../src/db/ensureSchema.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.ENABLE_SCHEDULED_JOBS = 'false'
delete process.env.GOOGLE_CALENDAR_ID

const require = createRequire(import.meta.url)
// drizzle-kit/api ESM paketi dinamik require içerdiği için CJS sürümü yüklenir.
const { generateDrizzleJson, generateMigration } = require('drizzle-kit/api') as {
  generateDrizzleJson: (imports: Record<string, unknown>) => unknown
  generateMigration: (prev: unknown, cur: unknown) => Promise<string[]>
}

export const NEW_TABLES = ['api_keys', 'assistant_proposals', 'integration_events', 'case_enforcement'] as const

// Rev14 öncesi şema (yeni tablolar hariç) Drizzle tanımından üretilir, sonra
// üretimde boot'ta çalışan REV14 SQL'i uygulanır. Böylece yeni tablolar gerçekten
// ensureSchema'daki DDL ile oluşur.
export async function createTestDatabase(options: { integrationSchema?: boolean; queryLog?: string[] } = {}) {
  const { apiKeys: _a, assistantProposals: _b, integrationEvents: _c, caseEnforcement: _d, ...base } = schema
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(base))
  const pg = new PGlite()
  for (const statement of statements) await pg.exec(statement)
  if (options.integrationSchema !== false) {
    await pg.exec(REV14_INTEGRATION_SQL)
    await pg.exec(REV15_INTEGRATION_SQL)
  }
  const log = options.queryLog
  const db = drizzle(pg, { schema, ...(log ? { logger: { logQuery: (query: string) => void log.push(query) } } : {}) })
  setDbForTests(db)
  return { pg, db }
}

export async function startApp(mount: (app: express.Express) => void | Promise<void>) {
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser())
  await mount(app)
  const { errorHandler } = await import('../src/middleware/errorHandler.js')
  app.use(errorHandler)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    base,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export function tokenFor(userId: string) {
  return jwt.sign({ userId, email: `${userId}@test` }, process.env.JWT_SECRET!)
}

export function client(base: string) {
  return async function call(method: string, path: string, opts: { token?: string; key?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const bearer = opts.key ?? opts.token
    if (bearer) headers.authorization = `Bearer ${bearer}`
    const res = await fetch(`${base}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { json = text }
    return { status: res.status, body: json }
  }
}
