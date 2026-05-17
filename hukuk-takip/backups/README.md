# DB Backup Notes

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
