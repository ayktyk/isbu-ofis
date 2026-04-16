import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { ThemeProvider } from './lib/theme'
import App from './App'
import './index.css'

// React Query cache'i localStorage'a persist et.
// Amac: PWA mobilde RAM'den atilip tekrar acildiginda son veriyi aninda
// gosterip arka planda yenilemek — bos ekran/spinner yok.
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'hz-query-cache',
  throttleTime: 1000,
})

// Bundle versiyonu degistiginde persisted cache'i invalide et.
// Yeni build'te (yeni hash'li asset'ler) eski cache anlamsizdir.
const CACHE_BUSTER = import.meta.env.VITE_BUILD_ID || '2026-04-16-pwa-v1'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24 saat sonra at
          buster: CACHE_BUSTER,
          dehydrateOptions: {
            // Hassas/gerçek zamanli olmayan verileri persist et.
            // Notifications persist edilmez (her zaman taze gelsin).
            shouldDehydrateQuery: (query) => {
              const key = query.queryKey?.[0]
              if (typeof key !== 'string') return false
              const persisted = [
                'auth',
                'dashboard',
                'cases',
                'clients',
                'tasks',
                'hearings',
                'calendar',
                'statistics',
                'consultations',
              ]
              return persisted.includes(key) && query.state.status === 'success'
            },
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
