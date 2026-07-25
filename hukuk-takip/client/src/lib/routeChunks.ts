// Rota -> lazy chunk yukleyici eslemesi.
//
// Menude hover/dokunma aninda sayfanin JS chunk'i indirilir; tiklamada chunk
// bekleme suresi kalmaz. Veri prefetch'i zaten Sidebar/MobileBottomNav icinde
// yapiliyor — burasi onun eksik kalan yarisi (kod indirme).
//
// Vite ayni modulu dedupe eder: burada import edilen sayfalar App.tsx'teki
// lazy() cagrilariyla ayni chunk'i paylasir, ek paket uretilmez.
const routeChunkLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/clients': () => import('../pages/ClientsPage'),
  '/cases': () => import('../pages/CasesPage'),
  '/cmk': () => import('../pages/CmkAssignmentsPage'),
  '/tools/mediation-files': () => import('../pages/MediationFilesPage'),
  '/hearings': () => import('../pages/HearingsPage'),
  '/tasks': () => import('../pages/TasksPage'),
  '/sureli-isler': () => import('../pages/LegalDeadlinesPage'),
  '/consultations': () => import('../pages/ConsultationsPage'),
  '/collections': () => import('../pages/CollectionsPage'),
  '/calendar': () => import('../pages/CalendarPage'),
  '/notifications': () => import('../pages/NotificationsPage'),
  '/statistics': () => import('../pages/StatisticsPage'),
  '/settings': () => import('../pages/SettingsPage'),
  '/tools/calculations': () => import('../pages/CalculationsPage'),
  '/tools/inheritance': () => import('../pages/InheritancePage'),
  '/tools/sentence': () => import('../pages/SentenceCalcPage'),
}

// Bir kez isitilan rotayi tekrar istemeyiz. Hata olursa isaret geri alinir ki
// bir sonraki dokunusta yeniden denensin (gecici ag hatasi kalici olmasin).
const warmed = new Set<string>()

export function prefetchRouteChunk(path: string): void {
  if (warmed.has(path)) return
  const loader = routeChunkLoaders[path]
  if (!loader) return
  warmed.add(path)
  void loader().catch(() => {
    warmed.delete(path)
  })
}
