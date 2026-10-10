import { defineConfig } from 'vitest/config'

// review/ altindaki eski node:test dosyalari bu calistiricinin kapsami disinda.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
