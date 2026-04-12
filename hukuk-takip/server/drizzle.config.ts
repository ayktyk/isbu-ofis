import { defineConfig } from 'drizzle-kit'

const connectionUrl = process.env.DATABASE_URL_MIGRATION || process.env.DATABASE_URL

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionUrl!,
  },
  verbose: true,
  strict: true,
})
