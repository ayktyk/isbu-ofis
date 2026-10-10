import type { NextFunction, Request, Response } from 'express'

// Dağıtım penceresi koruması: yeni sürüm açıldığında ensureSchema (rev14/rev15)
// app.listen SONRASI çalışır. O birkaç saniyede (veya şema adımı hata verirse)
// entegrasyon/öneri/nabız uçları eksik tablo/kolona çarpar. Bu durumda 500 yerine
// 503 SCHEMA_NOT_READY döner; istemci/asistan kısa süre sonra yeniden dener.
// Postgres: 42P01 undefined_table, 42703 undefined_column.
const SCHEMA_MISSING_CODES = new Set(['42P01', '42703'])

export function isSchemaMissingError(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && SCHEMA_MISSING_CODES.has(code)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

// Router sonuna eklenen hata ara katmanı; diğer hatalar genel errorHandler'a gider.
export function schemaNotReadyHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (!isSchemaMissingError(error)) {
    next(error)
    return
  }
  console.warn('[schemaGuard] Şema henüz hazır değil:', error instanceof Error ? error.message.slice(0, 200) : error)
  res.setHeader('Retry-After', '30')
  res.status(503).json({ code: 'SCHEMA_NOT_READY', error: 'Sistem güncelleniyor; lütfen birkaç saniye sonra tekrar deneyin.' })
}
