import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import type { Query } from '@tanstack/react-query'

// PWA'da uygulama RAM'den atilip tekrar acildiginda son veriyi ANINDA gosterip
// arka planda yenilemek icin React Query cache'i diske yazilir.
//
// Neden IndexedDB (localStorage degil): localStorage senkron API'dir; buyuk
// liste JSON'larini yazarken ana thread'i bloklar ve mobilde takilma yaratir.
// IndexedDB asenkron oldugu icin bu sorun yoktur — bu yuzden onceki koddaki
// "sadece auth query'sini sakla" kisitina artik gerek kalmaz.
//
// Gizli sekme / depolama kapali senaryosunda IndexedDB erisilemez olabilir.
// O durumda sessizce devre disi kaliriz: uygulama agdan calismaya devam eder.
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await get<string>(key)
      return value ?? null
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await set(key, value)
    } catch {
      // Sessiz gec — kalicilastirma opsiyonel bir hizlandirmadir, kritik degil.
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await del(key)
    } catch {
      // Sessiz gec.
    }
  },
}

export const queryPersister = createAsyncStoragePersister({
  storage: safeStorage,
  key: 'hz-query-cache-idb',
  throttleTime: 1000,
})

// Diske yazilacak query'ler. Acilista ekrani dolduran, buyuk olmayan listeler.
// Buraya yazilmayan query'ler her acilista agdan gelir.
const PERSISTED_ROOT_KEYS = new Set([
  'auth',
  'dashboard',
  'tasks',
  'cases',
  'clients',
  'notifications',
  'collections',
  'hearings',
])

export function shouldPersistQuery(query: Query): boolean {
  const rootKey = query.queryKey?.[0]
  if (typeof rootKey !== 'string') return false
  if (!PERSISTED_ROOT_KEYS.has(rootKey)) return false
  return query.state.status === 'success'
}
