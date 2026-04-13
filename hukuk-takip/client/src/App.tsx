import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from './lib/axios'

// ─── Kritik sayfalar (ana bundle — login sonrası anında açılır) ──────────────

import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

// ─── Diğer sayfalar (lazy — gerektiğinde yüklenir) ──────────────────────────

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

// ─── Korumalı route bileşeni ──────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <PageLoader />
  if (isError || !user) return <Navigate to="/login" replace />

  return <>{children}</>
}

// ─── Uygulama rotaları ────────────────────────────────────────────────────────

export default function App() {
  return (
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
  )
}
