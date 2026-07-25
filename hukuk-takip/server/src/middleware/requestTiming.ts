import type { Request, Response, NextFunction } from 'express'

// Yavas istekleri gorunur kilar. Amac: "hizlandi" iddiasini sayiyla
// destekleyebilmek ve ileride bir regresyonu erken yakalamak.
//
// Yalnizca esigi asan istekler loglanir; normal trafikte gurultu yapmaz ve
// Render'in log kotasini doldurmaz.
const SLOW_REQUEST_MS = 500

export function requestTiming(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
    if (durationMs >= SLOW_REQUEST_MS) {
      console.log(
        `[slow] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(0)}ms`
      )
    }
  })

  next()
}
