// Salt-okunur dogrulama: bekleyen tahsilat siralamasi gercekten kalan tutara
// gore buyukten kucuge mi geliyor? Gercek helper cagrilir (kopya sorgu degil).
//
// SADECE SELECT calistirir.
//
// Kullanim: cd server && npx tsx --env-file=../.env scripts/check-outstanding-order.ts
import '../src/env.js'
import { db } from '../src/db/index.js'
import { users } from '../src/db/schema.js'
import { getOutstandingCaseFees, getOutstandingMediationFees } from '../src/utils/outstandingFees.js'

const allUsers = await db.select({ id: users.id, email: users.email }).from(users)

for (const user of allUsers) {
  const [cases, mediations] = await Promise.all([
    getOutstandingCaseFees(user.id),
    getOutstandingMediationFees(user.id),
  ])

  const merged = [...cases, ...mediations].sort(
    (a, b) => parseFloat(b.remaining || '0') - parseFloat(a.remaining || '0'),
  )

  console.log(`\n=== ${user.email} — ${merged.length} bekleyen dosya ===`)
  merged.slice(0, 12).forEach((row, i) => {
    const remaining = parseFloat(row.remaining || '0')
    console.log(
      `${String(i + 1).padStart(2)}. ${remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 }).padStart(14)} TL  ${row.title?.slice(0, 45)}`,
    )
  })

  // Siralama dogrulugu: her satir bir oncekinden kucuk veya esit olmali.
  let ok = true
  for (let i = 1; i < merged.length; i++) {
    if (parseFloat(merged[i].remaining || '0') > parseFloat(merged[i - 1].remaining || '0')) {
      ok = false
      break
    }
  }
  console.log(ok ? 'SIRALAMA DOGRU (buyukten kucuge)' : 'SIRALAMA HATALI')

  // Dashboard widget'i LIMIT 20 kullaniyor — en buyuk borc ilk 20'de mi?
  const top20 = await getOutstandingCaseFees(user.id, { limit: 20 })
  if (cases.length > 0 && top20.length > 0) {
    const biggestOverall = Math.max(...cases.map((c) => parseFloat(c.remaining || '0')))
    const biggestInTop20 = Math.max(...top20.map((c) => parseFloat(c.remaining || '0')))
    console.log(
      biggestInTop20 === biggestOverall
        ? 'LIMIT 20 kontrolu: en buyuk borc listede VAR'
        : `LIMIT 20 kontrolu: SORUN — en buyuk ${biggestOverall}, listede ${biggestInTop20}`,
    )
  }
}

process.exit(0)
