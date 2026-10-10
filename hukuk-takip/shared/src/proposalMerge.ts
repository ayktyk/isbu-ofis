// Öneri birleştirme ve çakışma kuralları — saf fonksiyonlar (DB'ye dokunmaz).
//
// "before" ve "proposed" aynı anahtar uzayındadır (hedef tablonun camelCase kolon
// adları, tarih-saatler ISO string). planFieldUpdates hangi alanların gerçekten
// değişeceğini ve bunlardan hangilerinin DOLU bir değerin üzerine yazacağını söyler.
// Çakışma: hedefi en son avukat düzenlemiş ve öneri avukatın girdiği bir değeri
// değiştirecekse conflict=true (avukat yine onaylayabilir; arayüz uyarır).

export type Actor = 'avukat' | 'asistan'

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object' && !(value instanceof Date)) return Object.keys(value as object).length === 0
  return false
}

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof Date) return `@${value.getTime()}`
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // ISO tarih-saat → milisaniyeye indir (farklı saat dilimi yazımları eşit sayılsın)
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const ms = Date.parse(trimmed)
      if (Number.isFinite(ms)) return `@${ms}`
    }
    // Sayısal metin ("1000" ile "1000.00" eşit)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `#${Number(trimmed)}`
    return trimmed
  }
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true
  return normalizeForCompare(a) === normalizeForCompare(b)
}

export interface FieldPlanOptions {
  // true: dolu alanlara dokunma (yalnızca boşları doldur), overwrite listesindekiler hariç
  fillOnly?: boolean
  overwrite?: readonly string[]
}

export interface FieldPlan {
  changes: Record<string, unknown>
  // Dolu bir değerin üzerine yazılacak alanlar
  overwritten: string[]
  // fillOnly nedeniyle atlanan (dolu ve farklı) alanlar
  skipped: string[]
}

export function planFieldUpdates(
  before: Record<string, unknown> | null | undefined,
  proposed: Record<string, unknown>,
  options: FieldPlanOptions = {}
): FieldPlan {
  const changes: Record<string, unknown> = {}
  const overwritten: string[] = []
  const skipped: string[] = []
  const overwrite = new Set(options.overwrite ?? [])
  for (const [key, value] of Object.entries(proposed)) {
    if (value === undefined) continue
    // Boş/yalnız boşluk/null öneri değeri hiçbir alana yazılmaz: dolu değeri silmek
    // asistanın yetkisinde değildir (avukat elle temizler).
    if (isEmptyValue(value)) continue
    const current = before ? before[key] : undefined
    if (before && valuesEqual(current, value)) continue
    if (!before || isEmptyValue(current)) {
      if (!isEmptyValue(value)) changes[key] = value
      continue
    }
    if (options.fillOnly && !overwrite.has(key)) {
      skipped.push(key)
      continue
    }
    changes[key] = value
    overwritten.push(key)
  }
  return { changes, overwritten, skipped }
}

export function detectConflict(beforeActor: string | null | undefined, plan: FieldPlan): boolean {
  return (beforeActor ?? 'avukat') === 'avukat' && plan.overwritten.length > 0
}

// Onay anı koruması: öneri oluşturulduktan sonra hedef kayıt değişti mi?
// before = öneri anındaki anlık görüntü, current = onay anındaki (aynı anahtar uzayı,
// meta: updatedByActor/updatedAt). Bloklayıcı sayılır:
//   - hedef öneriden sonra ortaya çıktıysa (before yok, current var),
//   - değiştiyse (updatedAt ileri gitti veya bir alan farklı) ve son düzenleyen avukatsa,
//   - değiştiyse ve önerinin yazacağı alanlardan biri değiştiyse (kim değiştirirse).
// Asistanın başka bir onaylı önerisiyle ilgisiz alan değişmişse bloklamaz.
const TARGET_META_KEYS = new Set(['updatedByActor', 'updatedAt', 'revision', '__sourceRef'])

export interface TargetChange {
  changed: boolean
  blocking: boolean
  changedFields: string[]
}

export function detectTargetChange(
  before: Record<string, unknown> | null | undefined,
  current: Record<string, unknown> | null | undefined,
  currentActor: string | null | undefined,
  touchedKeys: readonly string[]
): TargetChange {
  if (!current) return { changed: false, blocking: false, changedFields: [] }
  if (!before) return { changed: true, blocking: true, changedFields: [] }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(current)])].filter((k) => !TARGET_META_KEYS.has(k))
  const changedFields = keys.filter((k) => !valuesEqual(before[k], current[k]))
  const tBefore = Date.parse(String(before.updatedAt ?? ''))
  const tNow = Date.parse(String(current.updatedAt ?? ''))
  const newer = Number.isFinite(tBefore) && Number.isFinite(tNow) && tNow > tBefore
  const changed = newer || changedFields.length > 0
  if (!changed) return { changed, blocking: false, changedFields }
  const touched = new Set(touchedKeys)
  const blocking = (currentActor ?? 'avukat') === 'avukat' || changedFields.some((k) => touched.has(k))
  return { changed, blocking, changedFields }
}

// JSONB "data" birleştirme (icra özeti): öneride gelen anahtarlar üzerine yazar,
// diğer anahtarlar korunur.
export function mergeJsonData(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(current ?? {}) }
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined) merged[key] = value
  }
  return merged
}
