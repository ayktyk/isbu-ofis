import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import * as schema from './schema.js'

const SALT_ROUNDS = 12

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const client = postgres(process.env.DATABASE_URL)
  const db = drizzle(client, { schema })

  console.log('Seed başlıyor...')

  // ─── Admin kullanıcı ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin123!', SALT_ROUNDS)

  const [adminUser] = await db
    .insert(schema.users)
    .values({
      email: 'avukat@buro.com',
      passwordHash,
      fullName: 'Av. Aykut Yılmaz',
      barNumber: '12345',
      phone: '0532 123 4567',
    })
    .returning()

  console.log('✓ Admin kullanıcı oluşturuldu:', adminUser.email)

  // ─── Asistan kullanıcı ──────────────────────────────────────────────────────
  const assistantHash = await bcrypt.hash('Asistan123!', SALT_ROUNDS)

  const [assistantUser] = await db
    .insert(schema.users)
    .values({
      email: 'asistan@buro.com',
      passwordHash: assistantHash,
      fullName: 'Zeynep Kaya',
      phone: '0533 987 6543',
    })
    .returning()

  console.log('✓ Asistan kullanıcı oluşturuldu:', assistantUser.email)

  // ─── Örnek müvekkiller ──────────────────────────────────────────────────────
  const [client1] = await db
    .insert(schema.clients)
    .values({
      userId: adminUser.id,
      fullName: 'Ahmet Demir',
      tcNo: '12345678901',
      phone: '0544 111 2233',
      email: 'ahmet@email.com',
      address: 'Kadıköy, İstanbul',
      notes: 'İşçilik alacağı davası müvekkili',
    })
    .returning()

  const [client2] = await db
    .insert(schema.clients)
    .values({
      userId: adminUser.id,
      fullName: 'Fatma Yıldız',
      tcNo: '98765432109',
      phone: '0555 444 5566',
      email: 'fatma@email.com',
      address: 'Bakırköy, İstanbul',
      notes: 'Boşanma davası müvekkili',
    })
    .returning()

  const [client3] = await db
    .insert(schema.clients)
    .values({
      userId: adminUser.id,
      fullName: 'Mehmet Aksoy',
      phone: '0546 777 8899',
      address: 'Beşiktaş, İstanbul',
    })
    .returning()

  console.log('✓ 3 örnek müvekkil oluşturuldu')

  // ─── Örnek davalar ──────────────────────────────────────────────────────────
  const [case1] = await db
    .insert(schema.cases)
    .values({
      userId: adminUser.id,
      clientId: client1.id,
      caseNumber: '2025/1234',
      courtName: 'İstanbul 5. İş Mahkemesi',
      caseType: 'iscilik_alacagi',
      status: 'active',
      title: 'Ahmet Demir - İşçilik Alacağı Davası',
      description:
        'Müvekkil 4 yıl çalıştıktan sonra istifa etmiş görünüyor. 14 aylık ödenmemiş fazla mesai alacağı mevcut.',
      startDate: '2025-03-15',
      contractedFee: '25000.00',
    })
    .returning()

  const [case2] = await db
    .insert(schema.cases)
    .values({
      userId: adminUser.id,
      clientId: client2.id,
      caseNumber: '2025/5678',
      courtName: 'İstanbul 3. Aile Mahkemesi',
      caseType: 'bosanma',
      status: 'active',
      title: 'Fatma Yıldız - Anlaşmalı Boşanma',
      description: 'Müvekkil anlaşmalı boşanma istiyor. Velayet ve nafaka konuları müzakere edilecek.',
      startDate: '2025-02-10',
      contractedFee: '15000.00',
    })
    .returning()

  const [case3] = await db
    .insert(schema.cases)
    .values({
      userId: adminUser.id,
      clientId: client3.id,
      courtName: 'İstanbul 2. Tüketici Mahkemesi',
      caseType: 'tuketici',
      status: 'won',
      title: 'Mehmet Aksoy - Tüketici Davası',
      description: 'Ayıplı mal davası. Karar verildi, dava kazanıldı.',
      startDate: '2024-06-20',
      contractedFee: '10000.00',
    })
    .returning()

  console.log('✓ 3 örnek dava oluşturuldu')

  // ─── Duruşmalar ─────────────────────────────────────────────────────────────
  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const tenDaysLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  await db.insert(schema.caseHearings).values([
    {
      caseId: case1.id,
      hearingDate: threeDaysLater,
      courtRoom: 'B-203',
      judge: 'Hakim Ali Vural',
      result: 'pending',
      notes: 'İlk duruşma. Tanık listesi hazırlanacak.',
    },
    {
      caseId: case1.id,
      hearingDate: thirtyDaysLater,
      courtRoom: 'B-203',
      judge: 'Hakim Ali Vural',
      result: 'pending',
      notes: 'Bilirkişi raporu bekleniyor.',
    },
    {
      caseId: case2.id,
      hearingDate: tenDaysLater,
      courtRoom: 'A-105',
      judge: 'Hakim Seda Öztürk',
      result: 'pending',
      notes: 'Anlaşmalı boşanma protokolü sunulacak.',
    },
  ])

  console.log('✓ 3 örnek duruşma oluşturuldu')

  // ─── Görevler ───────────────────────────────────────────────────────────────
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  await db.insert(schema.tasks).values([
    {
      userId: adminUser.id,
      caseId: case1.id,
      title: 'SGK hizmet dökümü temin et',
      description: 'e-Devlet üzerinden müvekkilin SGK hizmet dökümünü al.',
      status: 'pending',
      priority: 'high',
      dueDate: tomorrow,
    },
    {
      userId: adminUser.id,
      caseId: case1.id,
      title: 'Tanık listesi hazırla',
      description: 'Duruşma öncesi tanık listesini mahkemeye sun.',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: threeDaysLater,
    },
    {
      userId: assistantUser.id,
      caseId: case2.id,
      title: 'Boşanma protokolü taslağını tamamla',
      status: 'pending',
      priority: 'medium',
      dueDate: nextWeek,
    },
    {
      userId: adminUser.id,
      title: 'Baro aidatı öde',
      description: 'Mart ayı baro aidatını öde.',
      status: 'pending',
      priority: 'low',
      dueDate: yesterday, // süresi geçmiş — test için
    },
  ])

  console.log('✓ 4 örnek görev oluşturuldu')

  // ─── Masraflar ──────────────────────────────────────────────────────────────
  await db.insert(schema.expenses).values([
    {
      caseId: case1.id,
      userId: adminUser.id,
      type: 'court_fee',
      description: 'Başvurma harcı',
      amount: '427.60',
      expenseDate: '2025-03-15',
    },
    {
      caseId: case1.id,
      userId: adminUser.id,
      type: 'expert',
      description: 'Bilirkişi ücreti avansı',
      amount: '3500.00',
      expenseDate: '2025-03-20',
    },
    {
      caseId: case2.id,
      userId: adminUser.id,
      type: 'court_fee',
      description: 'Başvurma harcı',
      amount: '427.60',
      expenseDate: '2025-02-10',
    },
  ])

  console.log('✓ 3 örnek masraf oluşturuldu')

  // ─── Tahsilatlar ────────────────────────────────────────────────────────────
  await db.insert(schema.collections).values([
    {
      caseId: case1.id,
      clientId: client1.id,
      amount: '10000.00',
      collectionDate: '2025-03-15',
      description: 'Avans ödemesi',
      paymentMethod: 'bank_transfer',
    },
    {
      caseId: case2.id,
      clientId: client2.id,
      amount: '7500.00',
      collectionDate: '2025-02-10',
      description: 'Avans ödemesi',
      paymentMethod: 'cash',
    },
  ])

  console.log('✓ 2 örnek tahsilat oluşturuldu')

  // ─── Bildirimler ────────────────────────────────────────────────────────────
  await db.insert(schema.notifications).values([
    {
      userId: adminUser.id,
      type: 'hearing',
      title: 'Duruşma Hatırlatması',
      message: `${client1.fullName} - İşçilik Alacağı davası duruşması 3 gün sonra.`,
      relatedId: case1.id,
      relatedType: 'case',
      isRead: false,
    },
    {
      userId: adminUser.id,
      type: 'task',
      title: 'Gecikmiş Görev',
      message: 'Baro aidatı ödeme görevi süresi geçti.',
      isRead: false,
    },
  ])

  console.log('✓ 2 örnek bildirim oluşturuldu')

  // ─── Notlar ─────────────────────────────────────────────────────────────────
  await db.insert(schema.notes).values([
    {
      caseId: case1.id,
      userId: adminUser.id,
      content:
        'Müvekkil istifa dilekçesi imzalatılmış olsa da haklı fesih argümanı güçlü. Ödenmemiş fazla mesai nedeniyle istifanın haklı fesih sayılması gerektiği Yargıtay kararlarıyla desteklenebilir.',
    },
    {
      clientId: client2.id,
      userId: adminUser.id,
      content: 'Müvekkil anlaşmalı boşanma istiyor. Eşiyle nafaka konusunda anlaşma sağlanmış durumda.',
    },
  ])

  console.log('✓ 2 örnek not oluşturuldu')

  console.log('\n✓ Seed tamamlandı!')
  console.log('  Giriş bilgileri:')
  console.log('  Avukat : avukat@buro.com / Admin123!')
  console.log('  Asistan: asistan@buro.com / Asistan123!')

  await client.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed hatası:', err)
  process.exit(1)
})
