# DB Backup Notes

## 2026-07-25 — pre-rev11 + pre-rev12 (9 maddelik iyileştirme paketi)

**Yedek:** `pg_dump` bu makinede kurulu değil. Yerine salt-okunur JSON anlık
görüntüsü alındı:

```bash
cd hukuk-takip/server
node --env-file=../.env scripts/snapshot.mjs faz3-oncesi
```

Çıktı: `hukuk-takip/.local-backups/2026-07-25-19-55-37-faz3-oncesi.json`
(gitignore'da — müvekkil verisi içerir, repoya girmez.)

**Anlık görüntü satır sayıları (doğrulama referansı):**

| Tablo | Satır |
|---|---|
| cases | 84 |
| clients | 90 |
| tasks | 67 |
| collections | 18 |
| mediation_files | 9 |
| mediation_parties | 18 |
| consultations | 21 |
| case_hearings | 14 |
| case_diary_entries | 23 |
| notifications | 54 |
| notes | 4 |
| users | 2 |

Migration sonrası bu sayılar **birebir aynı** olmalıdır.

**REV11 (Faz 3) — görev kategorisi:**
- `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category varchar(20)` (nullable)
- `CREATE INDEX IF NOT EXISTS tasks_user_category_idx`
- Backfill YOK. Mevcut 67 görev `category = NULL` kalır.

**REV12 (Faz 5) — esnek ücret anlaşması:**
- `cases` tablosuna 5 nullable kolon: `fee_type`, `fee_percentage`,
  `fee_percentage_base`, `fee_percentage_note`, `fee_payment_plan`
- Yeni tablo: `case_fee_installments` (+ 2 indeks)
- `contracted_fee` **DEĞİŞMEDİ** — maktu tutarı ifade etmeye devam ediyor.
- Rename YOK, DROP YOK, backfill YOK. `fee_type IS NULL` olan 84 dava
  bugünküyle birebir aynı davranır.

**Geri alma:** Neon dashboard → Branches → Restore to point before 2026-07-25.
PITR penceresi 7 gün.

## 2026-05-17 — pre-rev9 (CMK görevlendirme ayrımı) migration

**Migration:** `0014_add_cmk_assignment.sql` + `ensureSchema.ts` REV9 bloğu

**Tam ADDITIVE — risk yok:**
- Yeni kolon: `cases.is_cmk_assignment boolean NOT NULL DEFAULT false`
- Yeni indeks: `cases_cmk_idx (user_id, is_cmk_assignment)`
- Hiçbir mevcut kayıt değişmedi (default false alır)
- Backfill UPDATE ayrı bir kullanıcı onayıyla çalıştırılır

## 2026-05-17 — pre-rev8 (dava günlüğü) migration

**Migration:** `0013_add_case_diary.sql` + `ensureSchema.ts` REV8 bloğu

**Tam ADDITIVE — risk yok:**
- Yeni enum: `diary_entry_type`
- Yeni tablo: `case_diary_entries` (PK + FK'lar + 3 indeks)
- Hiçbir mevcut kolon değişmedi
- Hiçbir mevcut satır silinmedi
- Hiçbir mevcut tablo dokunulmadı

`CREATE TABLE IF NOT EXISTS` ve `DO $$ ... EXCEPTION WHEN duplicate_object` blokları ile idempotent. Server boot'unda ensureSchema otomatik uygular. Geri alma gerekirse Neon dashboard → Branches → Restore to point before 2026-05-17.

## 2026-04-22 — pre-rev2 migration

**Durum:** pg_dump yerel olarak yüklü değil, Docker kapalı.

**Yedek stratejisi:** Neon kendi otomatik PITR (Point-in-time Restore) tutuyor (7 gün). Bu tarih öncesine istenildiği an dönülebilir.

**Migration güvenliği:** Uygulanan migration tamamen ADDITIVE:
- Hiçbir kolon DROP edilmedi
- Hiçbir row SILINMEDI
- Sadece: (a) yeni kolonlar eklendi (mediation_file_id, user_id, agreed_fee, currency), (b) mevcut iki kolon nullable hale getirildi (case_id, client_id) — mevcut satırları etkilemez.

Her şeyi geri almak gerekirse Neon dashboard → Branches → Restore to point before migration.
## 2026-09-12 — Dava listesi takip özeti öncesi doğrulanmış yedek

- Kullanıcı bu adımı sürdürmeyi ve Docker üzerinden yedek alma/izole geri yükleme işlemlerini onayladı.
- Dosya: `pre-case-tracking-2026-09-11T23-36-13-696Z.dump` (UTC isim; Türkiye'de 12.09.2026).
- SHA-256: `9615f26e15b349ec7213108ffa1be4e4b87b29ec90fc20535715e426d6e865fb`.
- PostgreSQL 17.11 kaynağından PostgreSQL 17 pg_dump, custom format, 133.920 bayt.
- Arşiv `pg_restore --list` ile okundu, dış ağa kapalı geçici PostgreSQL konteynerine hatasız geri yüklendi. Konteyner yalnız test için oluşturuldu; sonrasında durduruldu. Mevcut konteynerlere/volume'lara dokunulmadı.
- Geri yüklenen sayılar: cases 86; clients 92; tasks 100; case_diary_entries 31; case_hearings 14; notes 4; documents 0; expenses 0; collections 23.
- Ayrıntılı makbuz: aynı dosya adına eklenen `.receipt.json`.
- Bu paket sadece liste için SELECT sorguları ekler. Migration, startup veya canlı veri yazma işlemi yok. Yedek bir geri dönüş hazırlığıdır; arayüz/sunucu kodu geri alınırken canlı veri bu yedeğin üzerine döndürülmez.
- Yedek bağlantısı, [Neon'un pg_dump için doğrudan bağlantı önerisine](https://neon.com/docs/connect/connection-pooling) uygun olarak aynı endpoint'in havuzsuz adresini kullandı. Uygulamanın `.env` bağlantısı değiştirilmedi.

## 2026-09-12 — Çalışma planı ve duruşma kayıt makbuzu (manuel additive migration)

Kullanıcı kalan planın uygulanmasını, test edilmesini ve GitHub'a commit/push ile yayımlanmasını açıkça istedi. Kapsam: yalnızca `case_workspaces` ve `hearing_review_receipts` tablolarını oluşturmak. Eski tablo/kolon/kayıt kaldırılmaz veya yeniden yazılmaz. Yeni tablolar eski davalara geriye dönük veri doldurmaz.

Migration: `server/src/db/workspace-additive.sql`. Build/startup/Render/Vercel komutlarına eklenmez. `server/review/applyWorkspaceMigration.mjs` doğrulanmış yedek makbuzu ister, işlemi transaction içinde çalıştırır ve dava/müvekkil sayılarını karşılaştırır.

Migration öncesi güncel yedek: `pre-case-tracking-2026-09-12T00-07-16-458Z.dump`; SHA-256: `8a2300acf753eb0454542591455c037d5920da5ead431c43045d8d1126716e12`. Ayrı geçici PostgreSQL 17 ortamına geri yükleme doğrulandı: 86 dava, 92 müvekkil, 100 görev, 31 günlük, 14 duruşma, 4 not, 23 tahsilat. Makbuz aynı isimli `.receipt.json` dosyasında. Dump Git'e dahil edilmez.

İzole yedek kopyasında HTTP testleri: çalışma planı sürüm çakışması, eski açıklamanın korunması, sayfalama öncesi portföy filtresi, sahiplik, eşzamanlı çift gönderim, yapay veritabanı hatasında atomik rollback, bitmiş dava ve asistan kısıtı geçti. Bu testler canlı API'ye yazmadı.
