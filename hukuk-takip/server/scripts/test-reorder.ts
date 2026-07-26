// Siralama SQL'ini GERCEK veritabaninda dener ama islemi GERI ALIR.
// Amac: CASE WHEN kurgusunun dogru calistigini kalici degisiklik yapmadan
// dogrulamak.
//
// Sonunda ROLLBACK edilir — hicbir gorevin sirasi kalici olarak degismez.
//
// Kullanim: cd server && npx tsx --env-file=../.env scripts/test-reorder.ts
import '../src/env.js'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { tasks, users } from '../src/db/schema.js'

// En cok gorevi olan kullaniciyi sec — birden fazla hesap varsa bos olani
// secip testi bosa dusurmesin.
const [user] = await db
  .select({ id: users.id, email: users.email, n: sql<number>`count(${tasks.id})::int` })
  .from(users)
  .leftJoin(tasks, and(eq(tasks.userId, users.id), isNull(tasks.archivedAt)))
  .groupBy(users.id, users.email)
  .orderBy(sql`count(${tasks.id}) DESC`)
  .limit(1)

if (!user) {
  console.log('Kullanici yok, test atlandi.')
  process.exit(0)
}
console.log(`Test kullanicisi: ${user.email} (${user.n} gorev)\n`)

const sample = await db
  .select({ id: tasks.id, title: tasks.title, sortOrder: tasks.sortOrder })
  .from(tasks)
  .where(and(eq(tasks.userId, user.id), isNull(tasks.archivedAt)))
  .limit(4)

if (sample.length < 2) {
  console.log('Yeterli gorev yok, test atlandi.')
  process.exit(0)
}

console.log('ONCE:')
sample.forEach((t, i) => console.log(`  ${i}. sortOrder=${t.sortOrder} | ${t.title.slice(0, 40)}`))

// Sirayi ters cevir
const ids = sample.map((t) => t.id).reverse()

try {
  await db.transaction(async (tx) => {
    const cases_ = ids
      .map((id, index) => sql`WHEN ${id}::uuid THEN ${index}`)
      .reduce((acc, part) => sql`${acc} ${part}`)

    await tx
      .update(tasks)
      .set({
        sortOrder: sql`CASE ${tasks.id} ${cases_} ELSE ${tasks.sortOrder} END`,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.userId, user.id), isNull(tasks.archivedAt), inArray(tasks.id, ids)))

    const after = await tx
      .select({ id: tasks.id, title: tasks.title, sortOrder: tasks.sortOrder })
      .from(tasks)
      .where(inArray(tasks.id, ids))

    const byId = new Map(after.map((r) => [r.id, r]))
    console.log('\nSONRA (islem icinde):')
    let ok = true
    ids.forEach((id, expected) => {
      const row = byId.get(id)
      const got = row?.sortOrder
      if (got !== expected) ok = false
      console.log(`  beklenen=${expected} gelen=${got} | ${row?.title.slice(0, 40)}`)
    })
    console.log(ok ? '\nSONUC: SIRALAMA DOGRU YAZILDI' : '\nSONUC: HATA — beklenen sira yazilmadi')

    // Kalici olmasin.
    throw new Error('__ROLLBACK__')
  })
} catch (err: any) {
  if (err?.message === '__ROLLBACK__') {
    console.log('Islem geri alindi — hicbir gorev kalici olarak degismedi.')
  } else {
    console.error('HATA:', err?.message)
    process.exitCode = 1
  }
}

const verify = await db
  .select({ id: tasks.id, sortOrder: tasks.sortOrder })
  .from(tasks)
  .where(inArray(tasks.id, ids))

console.log('\nGERI ALMA DOGRULAMASI (hepsi baslangictaki degerinde olmali):')
const original = new Map(sample.map((t) => [t.id, t.sortOrder]))
let restored = true
for (const row of verify) {
  if (row.sortOrder !== original.get(row.id)) restored = false
}
console.log(restored ? 'TEMIZ — veritabani ilk haliyle ayni.' : 'UYARI — degerler degismis!')

process.exit(0)
