export function getSingleValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first : null
  }

  return null
}

export function getPositiveInt(value: unknown, fallback: number): number {
  const raw = getSingleValue(value)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}
