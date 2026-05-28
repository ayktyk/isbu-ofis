import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

// dotenv entry point'te (index.ts) yüklenir, burada tekrar yüklemeye gerek yok

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required')
    }
    // Pool yapılandırması — Neon serverless için makul bir denge:
    //   max=10 küçük bir büro için yeterli ve Neon pooler default'u ile uyumlu.
    //   idle_timeout=30sn ile boşta kalan bağlantılar serbest bırakılır,
    //     varsayılan (asla kapatma) Neon dashboard'da idle conn limit'ine
    //     yaklaşıldıkça sorun olabilirdi.
    //   connect_timeout=10sn ile cold start senaryosunda hızlı fail-fast.
    // prepare default true; Neon pooler transaction mode kullanılıyorsa
    //   PGBOUNCER_PREPARE=false env ile kapatılabilir (additive: env yoksa true).
    const queryClient = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: process.env.PGBOUNCER_PREPARE === 'false' ? false : true,
    })
    _db = drizzle(queryClient, { schema })
  }
  return _db
}

// Geriye dönük uyumluluk — import anında değil, ilk kullanımda başlatılır
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type DB = ReturnType<typeof drizzle>
