# DB Backup Notes

## 2026-04-22 — pre-rev2 migration

**Durum:** pg_dump yerel olarak yüklü değil, Docker kapalı.

**Yedek stratejisi:** Neon kendi otomatik PITR (Point-in-time Restore) tutuyor (7 gün). Bu tarih öncesine istenildiği an dönülebilir.

**Migration güvenliği:** Uygulanan migration tamamen ADDITIVE:
- Hiçbir kolon DROP edilmedi
- Hiçbir row SILINMEDI
- Sadece: (a) yeni kolonlar eklendi (mediation_file_id, user_id, agreed_fee, currency), (b) mevcut iki kolon nullable hale getirildi (case_id, client_id) — mevcut satırları etkilemez.

Her şeyi geri almak gerekirse Neon dashboard → Branches → Restore to point before migration.
