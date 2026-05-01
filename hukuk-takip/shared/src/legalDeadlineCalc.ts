// Süreli iş hesaplama yardımcısı.
// Türkiye resmi tatil verisi statik tutulur (yıl bazlı). Dini bayram tarihleri
// her yıl başı manuel güncellenir. Sistem ÖTELEMEYİ ZORLA UYGULAMAZ — avukat
// onayıyla `adjustedForHoliday=true` kaydedilir.

import type { LegalDeadlineTemplate } from './legalDeadlines.js'

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  c.setDate(c.getDate() + n)
  return c
}

function addYears(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  c.setFullYear(c.getFullYear() + n)
  return c
}

// ISO YYYY-MM-DD biçiminde Türkiye resmi + dini bayram tarihleri.
// 2026 ve 2027 için doldurulmuştur. Diyanet 2027 takvimi yayınladığında PR ile genişletilir.
const TR_HOLIDAYS: ReadonlySet<string> = new Set<string>([
  // 2026
  '2026-01-01', // Yılbaşı
  '2026-03-21', // Ramazan Bayramı 1. gün (yaklaşık — Diyanet takvimi ile teyit)
  '2026-03-22',
  '2026-03-23',
  '2026-04-23', // Ulusal Egemenlik
  '2026-05-01', // Emek Bayramı
  '2026-05-19', // Atatürk'ü Anma, Gençlik ve Spor
  '2026-05-27', // Kurban Bayramı 1. gün (yaklaşık)
  '2026-05-28',
  '2026-05-29',
  '2026-05-30',
  '2026-07-15', // Demokrasi ve Milli Birlik
  '2026-08-30', // Zafer Bayramı
  '2026-10-29', // Cumhuriyet Bayramı

  // 2027
  '2027-01-01',
  '2027-03-10', // Ramazan Bayramı (yaklaşık)
  '2027-03-11',
  '2027-03-12',
  '2027-04-23',
  '2027-05-01',
  '2027-05-16', // Kurban Bayramı (yaklaşık)
  '2027-05-17',
  '2027-05-18',
  '2027-05-19',
  '2027-07-15',
  '2027-08-30',
  '2027-10-29',
])

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isWeekendDay(d: Date): boolean {
  const w = d.getDay()
  return w === 0 || w === 6
}

export function isHoliday(d: Date): boolean {
  return TR_HOLIDAYS.has(toIso(d))
}

export function isBusinessDay(d: Date): boolean {
  return !isWeekendDay(d) && !isHoliday(d)
}

/** Verilen günden itibaren takip eden ilk iş gününü döndürür (verilen gün iş günü ise aynısını). */
export function shiftToNextBusinessDay(d: Date): Date {
  let cur = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  while (!isBusinessDay(cur)) {
    cur = addDays(cur, 1)
  }
  return cur
}

export interface ComputedDeadline {
  rawDueDate: Date
  adjustedDueDate: Date
  wasShifted: boolean
}

/**
 * Şablon ve tetik tarihinden son günü hesaplar.
 * Sistem ASLA otomatik öteleme uygulamaz — sadece "ham" ve "önerilen" tarihi döndürür.
 * Avukat formdaki checkbox ile öteleme onayı verir.
 */
export function computeLegalDeadline(
  tpl: LegalDeadlineTemplate,
  triggerDate: Date
): ComputedDeadline {
  const raw = tpl.durationYears
    ? addYears(triggerDate, tpl.durationYears)
    : addDays(triggerDate, tpl.durationDays)

  const adjusted = tpl.applyHolidayShift ? shiftToNextBusinessDay(raw) : raw
  const wasShifted = adjusted.getTime() !== raw.getTime()

  return {
    rawDueDate: raw,
    adjustedDueDate: adjusted,
    wasShifted,
  }
}
