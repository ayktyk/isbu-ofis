import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate, type JwtPayload } from '../middleware/auth.js'
import { loginSchema } from '../../../shared/dist/index.js'

const router = Router()

const ACCESS_TOKEN_EXPIRES = (process.env.JWT_EXPIRES_IN || '2h') as jwt.SignOptions['expiresIn']
const REFRESH_TOKEN_EXPIRES = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn']

// Süre string'ini milisaniyeye çevir (cookie maxAge için)
function parseDurationMs(dur: string): number {
  const match = dur.match(/^(\d+)\s*(s|m|h|d)$/)
  if (!match) return 2 * 60 * 60 * 1000 // fallback 2 saat
  const val = parseInt(match[1], 10)
  switch (match[2]) {
    case 's': return val * 1000
    case 'm': return val * 60 * 1000
    case 'h': return val * 60 * 60 * 1000
    case 'd': return val * 24 * 60 * 60 * 1000
    default: return 2 * 60 * 60 * 1000
  }
}

const ACCESS_TOKEN_MAX_AGE = parseDurationMs(ACCESS_TOKEN_EXPIRES as string)
const REFRESH_TOKEN_MAX_AGE = parseDurationMs(REFRESH_TOKEN_EXPIRES as string)

type SameSiteValue = 'lax' | 'strict' | 'none'

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  })
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  })
}

function getCookieBaseOptions(): import('express').CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production'
  const sameSite =
    (process.env.COOKIE_SAME_SITE as SameSiteValue | undefined) ||
    (isProduction ? 'none' : 'lax')
  const secure =
    process.env.COOKIE_SECURE != null
      ? process.env.COOKIE_SECURE === 'true'
      : isProduction || sameSite === 'none'

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  }
}

function setTokenCookies(res: import('express').Response, accessToken: string, refreshToken: string) {
  const cookieOptions = getCookieBaseOptions()

  res.cookie('access_token', accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })

  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  })
}

function getRefreshTokenFromRequest(req: import('express').Request) {
  const refreshTokenFromBody =
    typeof req.body?.refreshToken === 'string' && req.body.refreshToken.trim().length > 0
      ? req.body.refreshToken.trim()
      : null

  return refreshTokenFromBody || req.cookies?.refresh_token || null
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    res.status(401).json({ error: 'E-posta veya şifre hatalı.' })
    return
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Hesabınız devre dışı bırakılmış.' })
    return
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
  if (!isPasswordValid) {
    res.status(401).json({ error: 'E-posta veya şifre hatalı.' })
    return
  }

  const payload: JwtPayload = { userId: user.id, email: user.email }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  setTokenCookies(res, accessToken, refreshToken)

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      barNumber: user.barNumber,
      phone: user.phone,
    },
  })
})

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req)

  if (!refreshToken) {
    res.status(401).json({ error: 'Oturum süresi doldu.' })
    return
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload

    // Kullanıcının hâlâ aktif olduğunu doğrula
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1)

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Hesap bulunamadı veya devre dışı.' })
      return
    }

    // Token rotation — yeni token'lar üret
    const newPayload: JwtPayload = { userId: user.id, email: user.email }
    const newAccessToken = generateAccessToken(newPayload)
    const newRefreshToken = generateRefreshToken(newPayload)

    setTokenCookies(res, newAccessToken, newRefreshToken)

    res.json({
      message: 'Token yenilendi.',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  } catch {
    res.status(401).json({ error: 'Oturum süresi doldu. Tekrar giriş yapın.' })
    return
  }
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      barNumber: users.barNumber,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1)

  if (!user) {
    res.status(404).json({ error: 'Kullanıcı bulunamadı.' })
    return
  }

  res.json(user)
})

// ─── PUT /api/auth/me ────────────────────────────────────────────────────────

router.put('/me', authenticate, async (req, res) => {
  const { fullName, phone } = req.body

  if (!fullName || fullName.trim().length < 2) {
    res.status(400).json({ error: 'Ad soyad en az 2 karakter olmalıdır.' })
    return
  }

  await db
    .update(users)
    .set({
      fullName: fullName.trim(),
      phone: phone?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.user!.userId))

  const [updated] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1)

  res.json(updated)
})

// ─── PUT /api/auth/password ──────────────────────────────────────────────────

router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Mevcut ve yeni şifre gereklidir.' })
    return
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' })
    return
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1)

  if (!user) {
    res.status(404).json({ error: 'Kullanıcı bulunamadı.' })
    return
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isValid) {
    res.status(401).json({ error: 'Mevcut şifre hatalı.' })
    return
  }

  const newHash = await bcrypt.hash(newPassword, 10)

  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, req.user!.userId))

  res.json({ message: 'Şifre başarıyla değiştirildi.' })
})

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  const cookieOptions = getCookieBaseOptions()

  res.clearCookie('access_token', cookieOptions)
  res.clearCookie('refresh_token', cookieOptions)
  res.json({ message: 'Çıkış yapıldı.' })
})

export default router
