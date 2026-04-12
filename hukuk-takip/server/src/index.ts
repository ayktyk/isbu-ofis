import './env.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { db } from './db/index.js'
import { caseHearings, tasks, notifications, cases } from './db/schema.js'
import { eq, and, gte, lte } from 'drizzle-orm'
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
import { errorHandler } from './middleware/errorHandler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const shouldRunScheduledJobs = process.env.ENABLE_SCHEDULED_JOBS === 'true'

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

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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

if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public')
  app.use(express.static(publicPath))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'))
  })
}

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server calisiyor: http://localhost:${PORT}`)
  console.log(`Ortam: ${process.env.NODE_ENV || 'development'}`)
  if (!shouldRunScheduledJobs) {
    console.log('Zamanlanmis gorevler kapali. ENABLE_SCHEDULED_JOBS=true ile acilabilir.')
  }
})

if (shouldRunScheduledJobs) {
  cron.schedule('0 9 * * *', async () => {
    try {
      const now = new Date()
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const threeDaysStart = new Date(threeDaysLater)
      threeDaysStart.setHours(0, 0, 0, 0)
      const threeDaysEnd = new Date(threeDaysLater)
      threeDaysEnd.setHours(23, 59, 59, 999)

      const upcomingHearings = await db
        .select({
          id: caseHearings.id,
          caseId: caseHearings.caseId,
          hearingDate: caseHearings.hearingDate,
          caseTitle: cases.title,
          userId: cases.userId,
        })
        .from(caseHearings)
        .innerJoin(cases, eq(caseHearings.caseId, cases.id))
        .where(
          and(
            gte(caseHearings.hearingDate, threeDaysStart),
            lte(caseHearings.hearingDate, threeDaysEnd)
          )
        )

      for (const hearing of upcomingHearings) {
        await db.insert(notifications).values({
          userId: hearing.userId,
          type: 'hearing',
          title: 'Durusma Hatirlatmasi',
          message: `"${hearing.caseTitle}" davasi icin 3 gun sonra durusma var.`,
          relatedId: hearing.caseId,
          relatedType: 'case',
          isRead: false,
        })
      }

      const upcomingTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            gte(tasks.dueDate, threeDaysStart),
            lte(tasks.dueDate, threeDaysEnd)
          )
        )

      for (const task of upcomingTasks) {
        await db.insert(notifications).values({
          userId: task.userId,
          type: 'task',
          title: 'Gorev Hatirlatmasi',
          message: `"${task.title}" gorevi icin son 3 gun kaldi.`,
          relatedId: task.id,
          relatedType: 'task',
          isRead: false,
        })
      }

      console.log(
        `Bildirim cron calisti: ${upcomingHearings.length} durusma, ${upcomingTasks.length} gorev`
      )
    } catch (err) {
      console.error('Bildirim cron hatasi:', err)
    }
  })
}

export default app
