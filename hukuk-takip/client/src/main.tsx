import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { queryPersister, shouldPersistQuery } from './lib/queryPersister'
import { ThemeProvider } from './lib/theme'
import App from './App'
import './index.css'

// Render Free plan 15 dk sonra uykuya dalar; ilk istek 20-50 sn boot bekler.
// Uygulama daha chunk'lari indirirken / kullanici login ekranindayken sunucuya
// sessiz bir health ping at ki uyanma sureci kullanici ilk veriyi istemeden
// once baslasin. Basarisizlik onemsiz — yalnizca isinma amacli, veri tasimaz.
const rawWakeBase = import.meta.env.VITE_API_BASE_URL?.trim()
const wakeApiBase = rawWakeBase && rawWakeBase.length > 0 ? rawWakeBase.replace(/\/+$/, '') : '/api'
if (typeof window !== 'undefined') {
  // deep=1: sunucuyla birlikte Neon'u da uyandirir (tek SELECT 1). Kullanici
  // ilk gercek sorguyu yaptiginda veritabani da hazir olsun diye.
  void fetch(`${wakeApiBase}/health?deep=1`, { cache: 'no-store' }).catch(() => {})
}

// React Query cache'i IndexedDB'ye persist edilir (bkz. lib/queryPersister.ts).
// Eski localStorage tabanli cache artik kullanilmiyor; yer kaplamasin diye bir
// kez temizlenir. Bu yalnizca istemci onbellegidir — kullanici verisi degildir.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('hz-query-cache')
  } catch {}
}

// Bundle versiyonu degistiginde persisted cache'i invalide et.
// Yeni build'te (yeni hash'li asset'ler) eski cache anlamsizdir.
const CACHE_BUSTER = import.meta.env.VITE_BUILD_ID || '2026-05-02-deadlines-v1'

// PWA Service Worker update detection: yeni versiyon hazir oldugunda
// kullaniciya soylesin, kabul ederse hemen yeniden yukle. Mobilde "manuel ekle"
// gibi yeni ozelliklerin gozukmesi icin sayfayi kapatip acmaya gerek kalmaz.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // virtual:pwa-register dynamic import — vite-plugin-pwa runtime'da saglar
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          // Sessiz auto-reload: kullanicinin nerede oldugunu kaydet, sonra yenile.
          // confirm() istersen burada gosterebilirsin; mobilde rahatsiz edici olabilir.
          try {
            sessionStorage.setItem('hz-pwa-reloading', '1')
          } catch {}
          updateSW(true)
        },
        onOfflineReady() {},
      })
    })
    .catch(() => {
      // virtual:pwa-register dev modda yok; ignore.
    })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: 1000 * 60 * 60 * 24, // 24 saat sonra at
          buster: CACHE_BUSTER,
          dehydrateOptions: {
            // Hangi query'lerin diske yazilacagi queryPersister.ts'te tanimli.
            // IndexedDB asenkron oldugu icin liste query'leri de guvenle saklanir.
            shouldDehydrateQuery: shouldPersistQuery,
          },
        }}
      >
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </BrowserRouter>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </PersistQueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
)
