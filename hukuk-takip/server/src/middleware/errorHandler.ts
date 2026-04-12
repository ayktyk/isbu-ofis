import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[Error]', err.message)

  const statusCode = err.statusCode || err.status || 500
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : statusCode >= 500
        ? 'Sunucu hatası oluştu.'
        : err.message

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
