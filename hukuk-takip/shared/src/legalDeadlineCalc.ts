import type { LegalDeadlineTemplate } from './legalDeadlines.js'

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setFullYear(next.getFullYear() + years)
  return next
}

const TR_HOLIDAYS: ReadonlySet<string> = new Set<string>([
  '2026-01-01',
  '2026-03-21',
  '2026-03-22',
  '2026-03-23',
  '2026-04-23',
  '2026-05-01',
  '2026-05-19',
  '2026-05-27',
  '2026-05-28',
  '2026-05-29',
  '2026-05-30',
  '2026-07-15',
  '2026-08-30',
  '2026-10-29',
  '2027-01-01',
  '2027-03-10',
  '2027-03-11',
  '2027-03-12',
  '2027-04-23',
  '2027-05-01',
  '2027-05-16',
  '2027-05-17',
  '2027-05-18',
  '2027-05-19',
  '2027-07-15',
  '2027-08-30',
  '2027-10-29',
])

function toIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isWeekendDay(date: Date): boolean {
  const weekday = date.getDay()
  return weekday === 0 || weekday === 6
}

export function isHoliday(date: Date): boolean {
  return TR_HOLIDAYS.has(toIso(date))
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekendDay(date) && !isHoliday(date)
}

export function shiftToNextBusinessDay(date: Date): Date {
  let current = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  while (!isBusinessDay(current)) {
    current = addDays(current, 1)
  }
  return current
}

export interface ComputedDeadline {
  rawDueDate: Date
  adjustedDueDate: Date
  wasShifted: boolean
}

export function computeLegalDeadline(
  template: LegalDeadlineTemplate,
  triggerDate: Date
): ComputedDeadline {
  const rawDueDate = template.durationYears
    ? addYears(triggerDate, template.durationYears)
    : template.durationWeeks
      ? addWeeks(triggerDate, template.durationWeeks)
      : addDays(triggerDate, template.durationDays)

  const adjustedDueDate = template.applyHolidayShift
    ? shiftToNextBusinessDay(rawDueDate)
    : rawDueDate

  return {
    rawDueDate,
    adjustedDueDate,
    wasShifted: adjustedDueDate.getTime() !== rawDueDate.getTime(),
  }
}
