import { defineConfig } from 'vitest/config'
import path from 'path'

// Yalnizca saf yardimci fonksiyonlar test edilir: para hesabi (taksit bolme) ve
// metin normalizasyonu (Turkce I/i). Bunlar yanlis olursa sessizce yanlis sonuc
// uretirler — avukatin muhasebesi tutmaz ya da arama yanlis calisir.
//
// UI bilesenleri icin test altyapisi kurulmadi; onlar elle dogrulanir.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hukuk-takip/shared': path.resolve(__dirname, '../shared/dist/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
})
