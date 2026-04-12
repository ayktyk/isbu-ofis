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
    const queryClient = postgres(process.env.DATABASE_URL)
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
