import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './lib/axios'
import { readCachedUser, writeCachedUser, clearCachedUser } from './lib/authCache'

// ─── Chunk yükleme hatalarını yakalar (mobilde cached eski HTML yeni chunk'ları bulamaz) ──

const RELOAD_KEY = 'hz-chunk-reload'

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const msg = String((err as any)?.message || err)
  const name = String((err as any)?.name || '')
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

function hardReload() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('_r', String(Date.now()))
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}

class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorInfo: string }
> {
  state = { hasError: false, errorInfo: '' }

  static getDerivedStateFromError(err: unknown) {
    const info =
      (err as any)?.stack?.toString?.() ||
      (err as any)?.message ||
      String(err)
    if (isChunkLoadError(err)) {
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        hardReload()
        return { hasError: true, errorInfo: info }
      }
    }
    return { hasError: true, errorInfo: info }
  }

  componentDidCatch(err: unknown) {
    console.error('App error:', err)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-law-bg p-6">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-lg font-semibold text-law-primary">Uygulama yüklenemedi</h1>
            <p className="text-sm text-muted-foreground">
              Lütfen sayfayı yenileyin. Sorun devam ederse tarayıcı önbelleğini temizleyin.
            </p>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(RELOAD_KEY)
                  hardReload()
                }}
                className="rounded-lg bg-law-accent px-4 py-2 text-sm font-medium text-white"
              >
                Yenile
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    if (typeof caches !== 'undefined') {
                      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
                    }
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker
                        .getRegistrations()
                        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
                    }
                    localStorage.clear()
                    sessionStorage.clear()
                  } catch {}
                  setTimeout(hardReload, 300)
                }}
                className="rounded-lg border border-law-accent px-4 py-2 text-xs font-medium text-law-accent"
              >
                Önbelleği temizle ve yenile
              </button>
            </div>
            {this.state.errorInfo && (
              <pre className="mt-4 max-h-48 overflow-auto rounded bg-muted p-2 text-left text-[10px] text-muted-foreground">
                {this.state.errorInfo}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error)) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        hardReload()
      }
    }
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        hardReload()
      }
    }
  })
  // Başarılı yüklemede flag'i sıfırla
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(RELOAD_KEY)
    }, 5000)
  })
}

// ─── Layout eager (protected route hemen layout'u render eder) ────────────────

import AppLayout from './components/layout/AppLayout'

// ─── Tüm sayfalar lazy — mobilde ilk açılış hızı için ──────────────────────

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const CasesPage = lazy(() => import('./pages/CasesPage'))
const CaseDetailPage = lazy(() => import('./pages/CaseDetailPage'))
const HearingsPage = lazy(() => import('./pages/HearingsPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))
const MediationFilesPage = lazy(() => import('./pages/MediationFilesPage'))
const ClientFormPage = lazy(() => import('./pages/ClientFormPage'))
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'))
const CaseFormPage = lazy(() => import('./pages/CaseFormPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CalculationsPage = lazy(() => import('./pages/CalculationsPage'))
const AiPromptsPage = lazy(() => import('./pages/AiPromptsPage'))
const InheritancePage = lazy(() => import('./pages/InheritancePage'))
const MediationDocumentsPage = lazy(() => import('./pages/MediationDocumentsPage'))
const SentenceCalcPage = lazy(() => import('./pages/SentenceCalcPage'))
const ConsultationsPage = lazy(() => import('./pages/ConsultationsPage'))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'))

// ─── Sayfa yüklenirken gösterilecek skeleton ──────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-law-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-law-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    </div>
  )
}

// Layout icinde sekme degistiginde tam ekran flash olmasin diye ince skeleton.
export function InlinePageLoader() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  )
}

// ─── Korumalı route bileşeni ──────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const cachedUser = readCachedUser()

  const { data: user, isLoading, isError, isFetched } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    initialData: cachedUser ?? undefined,
  })

  useEffect(() => {
    if (user) writeCachedUser(user)
  }, [user])

  useEffect(() => {
    if (isError && !user) {
      clearCachedUser()
      queryClient.removeQueries({ queryKey: ['auth', 'me'] })
    }
  }, [isError, user, queryClient])

  // Cache varsa dashboard'u ve kritik sayfalari arka planda prefetch et
  useEffect(() => {
    if (!cachedUser) return
    queryClient.prefetchQuery({
      queryKey: ['dashboard'],
      queryFn: async () => (await api.get('/dashboard')).data,
    })
    // Notification sayisini da pesinen cek
    queryClient.prefetchQuery({
      queryKey: ['notifications', { unread: true }],
      queryFn: async () => (await api.get('/notifications', { params: { unread: true } })).data,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cache varsa hemen render et (arka planda yenilenir). Yoksa klasik loader.
  if (!cachedUser && isLoading) return <PageLoader />
  if (!cachedUser && (isError || !user)) return <Navigate to="/login" replace />
  // Cache vardi ama sunucu 401/403 donduruyorsa (session expire) logine at.
  if (cachedUser && isFetched && isError) return <Navigate to="/login" replace />

  return <>{children}</>
}

// ─── Uygulama rotaları ────────────────────────────────────────────────────────

export default function App() {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/new" element={<ClientFormPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="clients/:id/edit" element={<ClientFormPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/new" element={<CaseFormPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="cases/:id/edit" element={<CaseFormPage />} />
          <Route path="hearings" element={<HearingsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="consultations" element={<ConsultationsPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Araçlar */}
          <Route path="tools/calculations" element={<CalculationsPage />} />
          <Route path="tools/prompts" element={<AiPromptsPage />} />
          <Route path="tools/inheritance" element={<InheritancePage />} />
          <Route path="tools/mediation" element={<MediationDocumentsPage mediationType="dava-sarti" />} />
          <Route path="tools/mediation/dava-sarti" element={<MediationDocumentsPage mediationType="dava-sarti" />} />
          <Route path="tools/mediation/ihtiyari" element={<MediationDocumentsPage mediationType="ihtiyari" />} />
          <Route path="tools/mediation-files" element={<MediationFilesPage />} />
          <Route path="tools/sentence" element={<SentenceCalcPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  )
}
