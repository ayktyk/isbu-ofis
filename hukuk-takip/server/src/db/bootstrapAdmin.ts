import bcrypt from 'bcrypt'
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const SALT_ROUNDS = 12

async function bootstrapAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD?.trim()
  const fullName = process.env.ADMIN_FULL_NAME?.trim()

  if (!email || !password || !fullName) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_FULL_NAME are required')
  }

  const client = postgres(process.env.DATABASE_URL)
  const db = drizzle(client, { schema })

  const [existingUser] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  if (existingUser) {
    await db
      .update(schema.users)
      .set({
        passwordHash,
        fullName,
        role: 'admin',
        barNumber: process.env.ADMIN_BAR_NUMBER?.trim() || null,
        phone: process.env.ADMIN_PHONE?.trim() || null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existingUser.id))

    console.log(`Admin kullanici guncellendi: ${email}`)
  } else {
    await db.insert(schema.users).values({
      email,
      passwordHash,
      fullName,
      role: 'admin',
      barNumber: process.env.ADMIN_BAR_NUMBER?.trim() || null,
      phone: process.env.ADMIN_PHONE?.trim() || null,
      isActive: true,
    })

    console.log(`Admin kullanici olusturuldu: ${email}`)
  }

  await client.end()
}

bootstrapAdmin().catch(async (error) => {
  console.error('Admin bootstrap hatasi:', error)
  process.exit(1)
})
