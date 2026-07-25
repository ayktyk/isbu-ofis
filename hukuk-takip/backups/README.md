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
