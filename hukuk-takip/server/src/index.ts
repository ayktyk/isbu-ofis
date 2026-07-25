import './env.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { ensureSchema } from './db/ensureSchema.js'
import { requestTiming } from './middleware/requestTiming.js'
import { runReminderScan } from './services/notificationScheduler.js'
import authRouter from './routes/auth.js'
import clientsRouter from './routes/clients.js'
import casesRouter from './routes/cases.js'
import hearingsRouter from './routes/hearings.js'
import tasksRouter from './routes/tasks.js'
import expensesRouter from './routes/expenses.js'
import collectionsRouter from './routes/collections.js'
import dashboardRouter from './routes/dashboard.js'
import notesRouter from './routes/notes.js'
import notificationsRouter from './routes/notifications.js'
import documentsRouter from './routes/documents.js'
import mediationRouter from './routes/mediation.js'
import mediationFilesRouter from './routes/mediationFiles.js'
import calendarRouter from './routes/calendar.js'
import statisticsRouter from './routes/statistics.js'
import searchRouter from './routes/search.js'
import consultationsRouter from './routes/consultations.js'
import caseDiaryRouter from './routes/caseDiary.js'
import feeInstallmentsRouter from './routes/feeInstallments.js'
import { errorHandler } from './middleware/errorHandler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
// Varsayilan olarak acik. Kapatmak icin ENABLE_SCHEDULED_JOBS=false yapilabilir.
const shouldRunScheduledJobs = process.env.ENABLE_SCHEDULED_JOBS !== 'false'

function parseOriginList(value?: string) {
  if (!value) return []

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const allowedOrigins = Array.from(
  new Set([
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : []),
    ...parseOriginList(process.env.CLIENT_URL),
    ...parseOriginList(process.env.CORS_ORIGIN),
  ])
)

const corsOriginRegex = process.env.CORS_ORIGIN_REGEX
  ? new RegExp(process.env.CORS_ORIGIN_REGEX)
  : null

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
)

// gzip/brotli sıkıştırma — JSON yanıtlarını ~%60-80 küçültür (özellikle mobil/yavaş
// ağda hissedilir). 1KB altı yanıtlar sıkıştırılmaz (overhead'e değmez). İstemci
// `Accept-Encoding` göndermezse otomatik atlanır; davranış değişmez, veri etkilenmez.
app.use(compression({ threshold: 1024 }))

// Yavas istek olcumu — compression'dan hemen sonra, route'lardan once.
app.use(requestTiming)

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Cok fazla istek gonderildi. 15 dakika sonra tekrar deneyin.' },
  })
)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }

      if (allowedOrigins.includes(origin) || corsOriginRegex?.test(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser(process.env.COOKIE_SECRET))

// /api/health          -> sade, DB'ye dokunmaz. Render healthCheck ve harici
//                         keep-alive cron'u bunu kullanir (Neon compute saatini
//                         5 dakikada bir yakmamak icin bilincli tercih).
// /api/health?deep=1   -> tek SELECT 1 ile Neon'u da uyandirir. YALNIZCA
//                         istemcinin acilis ping'i cagirir; boylece kullanici
//                         ilk gercek sorguyu yaptiginda veritabani da uyanik olur.
// Calisan surumun commit kimligi. Render deploy sirasinda RENDER_GIT_COMMIT'i
// otomatik saglar. Amac: "degisiklik canliya cikti mi?" sorusunu disaridan tek
// istekle cevaplayabilmek — onceden bu ancak uygulamaya girip gozle bakarak
// anlasilabiliyordu.
const BUILD_COMMIT = (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7)

app.get('/api/health', async (req, res) => {
  const timestamp = new Date().toISOString()

  if (req.query.deep !== '1') {
    res.json({ status: 'ok', commit: BUILD_COMMIT, timestamp })
    return
  }

  try {
    await db.execute(sql`select 1`)
    res.json({ status: 'ok', db: 'ok', commit: BUILD_COMMIT, timestamp })
  } catch {
    // Isinma amacli bir istek; DB hatasi saglik kontrolunu dusurmemeli.
    res.json({ status: 'ok', db: 'error', commit: BUILD_COMMIT, timestamp })
  }
})

app.use('/api', mediationRouter)
app.use('/api/auth', authRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/cases', casesRouter)
app.use('/api/hearings', hearingsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/collections', collectionsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/notes', notesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/mediation-files', mediationFilesRouter)
app.use('/api/statistics', statisticsRouter)
app.use('/api/search', searchRouter)
app.use('/api/consultations', consultationsRouter)
// Dava günlüğü — /cases/:caseId/diary, /cases/:caseId/next-step, /diary/:entryId
// Tek router iki path prefix'inden de cevap verir; route'lar tam yolu içeriyor.
app.use('/api', caseDiaryRouter)
// Ücret taksitleri — /cases/:caseId/fee-installments ve /fee-installments/:id
// Router tam yolları içerdiği için caseDiary ile aynı desende bağlanır.
app.use('/api', feeInstallmentsRouter)

if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public')
  app.use(express.static(publicPath))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'))
  })
}

app.use(errorHandler)

app.listen(PORT, async () => {
  console.log(`Server calisiyor: http://localhost:${PORT}`)
  console.log(`Ortam: ${process.env.NODE_ENV || 'development'}`)
  await ensureSchema()

  if (shouldRunScheduledJobs) {
    // Basta bir kez tara (eksik bildirimleri yakalamak icin)
    try {
      const result = await runReminderScan()
      console.log(
        `Bildirim taramasi (baslangic): ${result.upcomingHearings} yaklasan durusma, ${result.upcomingTasks} yaklasan gorev, ${result.overdueHearings} geciken durusma, ${result.overdueTasks} geciken gorev eklendi, ${result.skipped} mevcut.`
      )
    } catch (err) {
      console.error('Bildirim taramasi (baslangic) hatasi:', err)
    }
  } else {
    console.log('Zamanlanmis gorevler kapali. ENABLE_SCHEDULED_JOBS kaldirilarak acilabilir.')
  }
})

if (shouldRunScheduledJobs) {
  // Her gun 09:00'da tara
  cron.schedule('0 9 * * *', async () => {
    try {
      const result = await runReminderScan()
      console.log(
        `Bildirim cron: ${result.upcomingHearings}+${result.upcomingTasks} yaklasan, ${result.overdueHearings}+${result.overdueTasks} geciken eklendi, ${result.skipped} mevcut.`
      )
    } catch (err) {
      console.error('Bildirim cron hatasi:', err)
    }
  })

  // Yeni eklenen gorev/durusma icin: her 15 dakikada bir hizli tara
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runReminderScan()
    } catch (err) {
      console.error('Bildirim 15dk tarama hatasi:', err)
    }
  })
}

export default app
