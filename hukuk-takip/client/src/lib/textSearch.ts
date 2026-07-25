/**
 * Turkce duyarli metin normalizasyonu.
 *
 * Neden ozel: JS'in varsayilan toLowerCase()'i 'I' harfini 'i' yapar; Turkce'de
 * 'I' -> 'ı' ve 'İ' -> 'i' olmalidir. Arama ve mukerrer tespitinde bu fark
 * yanlis sonuca yol acar (or. "İSTİNAF" ile "istinaf" eslesmez).
 */
export function normalizeTr(value: string | null | undefined): string {
  if (!value) return ''
  return value.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()
}

/** Verilen metnin, alanlardan herhangi birinde gecip gecmedigi. */
export function matchesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const q = normalizeTr(query)
  if (!q) return true
  const haystack = normalizeTr(fields.filter(Boolean).join(' '))
  return haystack.includes(q)
}

/**
 * Ayni baslikta zaten kayitli bir kayit var mi?
 *
 * Avukat ayni gorevi yanlislikla iki kez giriyor; form icinde uyarmak icin.
 * Engellemez — bilerek benzer gorev eklenebilir, yalnizca bildirir.
 *
 * - 2 karakterden kisa girdide null doner (yazmaya baslarken gurultu olmasin).
 * - excludeId verilirse o kayit atlanir (duzenleme sirasinda kayit kendini
 *   mukerrer saymasin).
 */
export function findDuplicateTitle<T extends { id: string; title: string }>(
  title: string,
  items: T[],
  excludeId?: string
): T | null {
  const normalized = normalizeTr(title)
  if (normalized.length < 2) return null
  return (
    items.find((item) => item.id !== excludeId && normalizeTr(item.title) === normalized) ?? null
  )
}
