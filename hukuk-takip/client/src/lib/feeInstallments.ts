import { addMonths, format, isValid, parseISO } from 'date-fns'

export interface GeneratedInstallment {
  seq: number
  amount: number
  dueDate: string // YYYY-MM-DD
}

const MAX_INSTALLMENTS = 60

/**
 * Anlasilan maktu tutari esit taksitlere boler.
 *
 * Para hesabi KURUS (integer) uzerinden yapilir; float toplama hatasi olmasin
 * diye. Bolumden kalan kurus SON taksite eklenir — boylece taksitlerin toplami
 * her zaman anlasilan tutara birebir esittir. Avukatin muhasebesi tutmali:
 * 100.000 / 3 = 33.333,33 + 33.333,33 + 33.333,34
 *
 * Vadeler aydan aya ilerler. date-fns addMonths kisa aylara tasmayi kendisi
 * onler: 31 Ocak + 1 ay = 28/29 Subat.
 *
 * Gecersiz girdide bos dizi doner — cagiran taraf "taksit uretilemedi" olarak
 * yorumlar, hatali sayi uretmez.
 */
export function generateInstallments(
  totalAmount: number,
  count: number,
  firstDueDate: string
): GeneratedInstallment[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return []
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) return []
  if (!firstDueDate) return []

  const start = parseISO(firstDueDate)
  if (!isValid(start)) return []

  const totalKurus = Math.round(totalAmount * 100)
  const baseKurus = Math.floor(totalKurus / count)
  const remainderKurus = totalKurus - baseKurus * count

  return Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1
    const kurus = isLast ? baseKurus + remainderKurus : baseKurus
    return {
      seq: index + 1,
      amount: kurus / 100,
      dueDate: format(addMonths(start, index), 'yyyy-MM-dd'),
    }
  })
}

/** Vadesi bugunden once gecmis ve henuz odenmemis taksit mi? */
export function isInstallmentOverdue(installment: {
  dueDate: string
  status: string
}): boolean {
  if (installment.status === 'paid') return false
  const due = parseISO(installment.dueDate)
  if (!isValid(due)) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}
