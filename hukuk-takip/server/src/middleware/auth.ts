import { type NextFunction, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req) || req.cookies?.access_token

  if (!token) {
    res.status(401).json({ error: 'Oturum acmaniz gerekiyor.' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Oturum suresi doldu. Tekrar giris yapin.' })
  }
}
