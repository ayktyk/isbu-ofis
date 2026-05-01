import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { tr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return format(new Date(date), 'dd.MM.yyyy', { locale: tr })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: tr })
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isToday(d)) return 'Bugün'
  if (isTomorrow(d)) return 'Yarın'
  return formatDistanceToNow(d, { addSuffix: true, locale: tr })
}

export function isOverdue(date: string | Date | null | undefined): boolean {
  if (!date) return false
  return isPast(new Date(date))
}

/**
 * <input type="datetime-local"> değerini ("2026-04-30T14:00" gibi, saat dilimi yok)
 * client'ın YEREL saatine göre ISO string'e çevirir. Sunucu UTC'deyse saat +3 kayması
 * olmaması için bunu yolla. Boş/geçersiz değerler boş döner.
 *
 * Örn: İstanbul'da "2026-04-30T14:00" → "2026-04-30T11:00:00.000Z"
 */
export function localInputToISO(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

/**
 * ISO string'i ("2026-04-30T11:00:00.000Z") <input type="datetime-local"> için
 * local formatına çevirir: "2026-04-30T14:00". TZ offset kullanıcının yereline göre.
 */
export function isoToLocalInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'TRY'
): string {
  if (amount == null || amount === '') return '-'
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (Number.isNaN(num)) return '-'

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

export const caseTypeLabels: Record<string, string> = {
  iscilik_alacagi: 'İşçilik Alacağı',
  bosanma: 'Boşanma',
  velayet: 'Velayet',
  mal_paylasimi: 'Mal Paylaşımı',
  kira: 'Kira',
  tuketici: 'Tüketici',
  icra: 'İcra',
  ceza: 'Ceza',
  idare: 'İdare',
  diger: 'Diğer',
}

export const caseStatusLabels: Record<string, string> = {
  active: 'Aktif',
  istinafta: 'İstinafta',
  yargitayda: 'Yargıtayda',
  'yargıtayda': 'Yargıtayda',
  'yargÄ±tayda': 'Yargıtayda',
  passive: 'Potansiyel',
  closed: 'Kapatıldı',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
  settled: 'Uzlaşıldı',
}

export const taskStatusLabels: Record<string, string> = {
  pending: 'Beklemede',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
}

export const taskPriorityLabels: Record<string, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  urgent: 'Acil',
}

export const hearingResultLabels: Record<string, string> = {
  pending: 'Beklemede',
  completed: 'Tamamlandı',
  postponed: 'Ertelendi',
  cancelled: 'İptal Edildi',
}

export const expenseTypeLabels: Record<string, string> = {
  court_fee: 'Mahkeme Harcı',
  notary: 'Noter',
  expert: 'Bilirkişi',
  travel: 'Ulaşım',
  document: 'Evrak',
  other: 'Diğer',
}

export function maskTcNo(tcNo: string | null | undefined): string {
  if (!tcNo) return '-'
  if (tcNo.length <= 4) return '*'.repeat(tcNo.length)
  return '*'.repeat(tcNo.length - 4) + tcNo.slice(-4)
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Süreli iş yardımcıları ────────────────────────────────────────────────────

export const deadlineCategoryLabels: Record<string, string> = {
  hukuk: 'Hukuk',
  icra: 'İcra',
  is: 'İş Hukuku',
  ceza: 'Ceza',
  idari: 'İdari',
  tbk: 'TBK Genel',
}

export const deadlineSeverityLabels: Record<string, string> = {
  hak_dusurucu: 'Hak Düşürücü',
  zamanasimi: 'Zamanaşımı',
  usul: 'Usul',
}

/** Bir süreli iş için kalan gün hesaplar (gün bazında, saat dikkate alınmaz). */
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const due = new Date(date)
  if (Number.isNaN(due.getTime())) return null
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  return Math.round((startOfDue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000))
}

/** Süreli iş "kalan gün" rozeti için renk sınıfı. */
export function deadlineDaysClass(daysLeft: number | null): string {
  if (daysLeft === null) return 'bg-slate-200 text-slate-700'
  if (daysLeft < 0) return 'bg-red-700 text-white'
  if (daysLeft <= 1) return 'bg-red-600 text-white'
  if (daysLeft <= 3) return 'bg-red-500 text-white'
  if (daysLeft <= 7) return 'bg-orange-500 text-white'
  if (daysLeft <= 14) return 'bg-amber-500 text-white'
  if (daysLeft <= 30) return 'bg-yellow-200 text-yellow-900'
  return 'bg-slate-200 text-slate-700'
}

export function deadlineDaysLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'Süre yok'
  if (daysLeft < 0) return `${Math.abs(daysLeft)} gün geçti`
  if (daysLeft === 0) return 'BUGÜN SON'
  if (daysLeft === 1) return 'YARIN SON'
  return `${daysLeft} gün kaldı`
}
