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
