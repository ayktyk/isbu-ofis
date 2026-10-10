// Dosya nabzı — saf yardımcılar (bayrak etiketleri, sıralama, filtre, bağlantı).
// Veri GET /api/pulse'tan gelir (sunucu zaten aciliyete göre sıralar; hesap
// shared/casePulse.ts'te). Burada yalnızca gösterim ve istemci filtresi var.
import type { CasePulseItem, PulseFlag, PulseNextKind } from '@hukuk-takip/shared'

export type PulseTypeFilter = 'all' | 'dava' | 'arabuluculuk' | 'cmk'

// Gösterim sırası = önem sırası (en acil solda).
export const PULSE_FLAG_ORDER: PulseFlag[] = [
  'gecikmis',
  'sure_yaklasiyor',
  'atil',
  'sirada_is_yok',
  'tahsilat_bekliyor',
  'kapanmaya_hazir',
  'cmk',
]

export const PULSE_FLAG_LABELS: Record<PulseFlag, string> = {
  gecikmis: 'Gecikmiş',
  sure_yaklasiyor: 'Süre yaklaşıyor',
  atil: 'Atıl',
  sirada_is_yok: 'Sıradaki iş yok',
  tahsilat_bekliyor: 'Tahsilat bekliyor',
  kapanmaya_hazir: 'Kapanmaya hazır',
  cmk: 'CMK',
}

export const PULSE_FLAG_CLASSES: Record<PulseFlag, string> = {
  gecikmis: 'bg-red-100 text-red-800 border-red-200',
  sure_yaklasiyor: 'bg-amber-100 text-amber-800 border-amber-200',
  atil: 'bg-slate-200 text-slate-800 border-slate-300',
  sirada_is_yok: 'bg-slate-100 text-slate-700 border-slate-200',
  tahsilat_bekliyor: 'bg-blue-100 text-blue-800 border-blue-200',
  kapanmaya_hazir: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cmk: 'bg-violet-100 text-violet-800 border-violet-200',
}

export const PULSE_TYPE_LABELS: Record<PulseTypeFilter, string> = {
  all: 'Tümü',
  dava: 'Dava',
  arabuluculuk: 'Arabuluculuk',
  cmk: 'CMK',
}

export const PULSE_NEXT_KIND_LABELS: Record<PulseNextKind, string> = {
  hearing: 'Duruşma',
  deadline: 'Süreli iş',
  task: 'Görev',
  check: 'Kontrol',
  next_step: 'Sonraki adım',
}

export function sortPulseFlags(flags: readonly PulseFlag[]): PulseFlag[] {
  const rank = (f: PulseFlag) => {
    const i = PULSE_FLAG_ORDER.indexOf(f)
    return i === -1 ? PULSE_FLAG_ORDER.length : i
  }
  return [...new Set(flags)].sort((a, b) => rank(a) - rank(b))
}

export function pulseItemType(item: Pick<CasePulseItem, 'type' | 'flags'>): Exclude<PulseTypeFilter, 'all'> {
  if (item.type === 'mediation') return 'arabuluculuk'
  return item.flags.includes('cmk') ? 'cmk' : 'dava'
}

export function filterPulse<T extends Pick<CasePulseItem, 'type' | 'flags'>>(
  items: readonly T[],
  filter: { flag?: PulseFlag | null; type?: PulseTypeFilter }
): T[] {
  return items.filter((item) => {
    if (filter.flag && !item.flags.includes(filter.flag)) return false
    if (filter.type && filter.type !== 'all' && pulseItemType(item) !== filter.type) return false
    return true
  })
}

export function countPulseFlags(items: readonly Pick<CasePulseItem, 'flags'>[]): Record<PulseFlag, number> {
  const counts = Object.fromEntries(PULSE_FLAG_ORDER.map((f) => [f, 0])) as Record<PulseFlag, number>
  for (const item of items) for (const flag of new Set(item.flags)) counts[flag] = (counts[flag] ?? 0) + 1
  return counts
}

// Sunucu sırası esas; istemci yine de aynı kuralla kararlı sıralar (filtre sonrası güvence).
export function sortPulse<T extends Pick<CasePulseItem, 'urgency' | 'daysSinceActivity'> & { nextItem: { date: string | null } | null }>(
  items: readonly T[]
): T[] {
  const key = (item: T) => {
    const date = item.nextItem?.date
    if (!date) return Number.MAX_SAFE_INTEGER
    const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00+03:00` : date).getTime()
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.urgency !== b.item.urgency) return a.item.urgency - b.item.urgency
      const ka = key(a.item)
      const kb = key(b.item)
      if (ka !== kb) return ka - kb
      const da = a.item.daysSinceActivity ?? Number.MAX_SAFE_INTEGER
      const db = b.item.daysSinceActivity ?? Number.MAX_SAFE_INTEGER
      if (da !== db) return db - da
      return a.index - b.index
    })
    .map(({ item }) => item)
}

export function pulseHref(item: Pick<CasePulseItem, 'type' | 'id'>): string {
  return item.type === 'mediation'
    ? `/tools/mediation-files?record=${encodeURIComponent(item.id)}`
    : `/cases/${encodeURIComponent(item.id)}`
}

export function lastActivityLabel(days: number | null): string {
  if (days === null) return 'Hareket kaydı yok'
  if (days <= 0) return 'Bugün hareket var'
  if (days === 1) return 'Son hareket dün'
  return `Son hareket ${days} gün önce`
}
