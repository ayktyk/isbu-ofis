# HukukTakip — Avukatlık Büro Yönetim Sistemi
## CLAUDE.md — Geliştirici Yapay Zeka Talimat Dosyası

> Bu dosya, Claude Code / Cursor / Windsurf gibi AI geliştirme araçlarına
> projeyi eksiksiz anlatmak için yazılmıştır. Her oturumda bu dosyayı oku.

---

## Projenin Amacı

Küçük bir hukuk bürosu (2-5 kişi) için, hem telefon hem bilgisayardan
kullanılabilen, sade ve hızlı bir iş takip uygulaması.

**Temel hedef:** Avukatın duruşma kaçırmaması, müvekkil bilgilerini
saniyeler içinde bulması, masraf ve ücretleri kolayca takip etmesi.

**Kapsam dışı (şimdilik):** UYAP entegrasyonu, icra takibi, karmaşık muhasebe.
Bunlar Faz 2'ye bırakıldı. Önce temeli sağlam kuralım.

---

## Kullanıcı Profili

- **Birincil kullanıcı:** Avukat (teknik bilgisi yok, pratiklik öncelikli)
- **İkincil kullanıcılar:** Büro asistanı, stajyer avukat (2-4 kişi)
- **Cihazlar:** Masaüstü bilgisayar (öncelikli) + akıllı telefon (sık)
- **Dil:** Tamamen Türkçe arayüz

---

## Teknoloji Stack

### Frontend
- React + Vite (TypeScript)
- Tailwind CSS
- shadcn/ui
- TanStack React Query
- React Hook Form + Zod
- Recharts
- Lucide React
- date-fns (Türkçe locale)
- Sonner (toast bildirimleri)

### Backend
- Node.js + Express 5 (TypeScript)
- PostgreSQL
- Drizzle ORM
- Zod (validasyon)
- JWT (httpOnly cookie)
- bcrypt
- node-cron (hatırlatma işleri)

### Klasör Yapısı
```
hukuk-takip/
├── client/                 ← React uygulaması
│   ├── src/
│   │   ├── components/     ← tekrar kullanılan bileşenler
│   │   │   ├── ui/         ← shadcn bileşenleri
│   │   │   ├── layout/     ← sidebar, header, layout
│   │   │   └── shared/     ← genel bileşenler
│   │   ├── pages/          ← sayfa bileşenleri
│   │   ├── hooks/          ← özel React hook'ları
│   │   ├── lib/            ← yardımcı fonksiyonlar
│   │   └── types/          ← TypeScript tip tanımları
├── server/                 ← Express API
│   ├── src/
│   │   ├── routes/         ← API endpoint'leri
│   │   ├── middleware/     ← auth, hata yakalama
│   │   ├── db/             ← Drizzle şema ve bağlantı
│   │   └── services/       ← iş mantığı
└── shared/                 ← ortak tipler (client+server)
```

---

## Tasarım Sistemi

### Renk Paleti
```css
--primary: #1e3a5f      /* Koyu kurumsal mavi - başlıklar */
--accent: #2563eb       /* Orta mavi - butonlar, aktif öğeler */
--success: #16a34a      /* Yeşil - kazanıldı, tamamlandı */
--warning: #d97706      /* Turuncu - beklemede, yaklaşan */
--danger: #dc2626       /* Kırmızı - acil, kaybedildi */
--bg: #f8fafc           /* Açık gri - sayfa arka planı */
--sidebar: #1e293b      /* Koyu - kenar çubuğu */
```

### Tasarım İlkeleri
- Profesyonel ve sade — hukuk bürosuna yakışır ciddi görünüm
- Masaüstü öncelikli ama telefonda da tam kullanılabilir (responsive)
- Sık kullanılan işlemler en fazla 2 tıkla yapılabilmeli
- Tablolar okunabilir, satırlar tıklanabilir
- Tarih formatı her yerde: GG.AA.YYYY
- Para birimi: ₺ (Türk Lirası)

---

## Veritabanı Şeması

### users
```sql
id, email, password_hash, full_name, role (admin|lawyer|assistant),
is_active, created_at, updated_at
```

### clients (Müvekkiller)
```sql
id, client_type (individual|company),
-- Bireysel
first_name, last_name, tc_no, birth_date, phone, email, address,
-- Kurumsal
company_name, tax_no, tax_office, authorized_person,
-- Ortak
notes, is_active, created_by, created_at, updated_at
```

### cases (Davalar)
```sql
id, case_no, client_id (FK),
case_type (civil|criminal|administrative|execution|other),
court_name, court_file_no, judge_name,
status (active|won|lost|settled|closed),
subject, description,
opened_date, closed_date,
lawyer_id (FK→users), assistant_id (FK→users, nullable),
created_at, updated_at
```

### case_hearings (Duruşmalar)
```sql
id, case_id (FK), hearing_date, hearing_time,
court_name, court_room,
hearing_type (ilk|ara|karar|keşif|bilirkişi|diğer),
result, next_hearing_date, notes,
reminder_sent, created_at, updated_at
```

### tasks (Görevler)
```sql
id, case_id (FK, nullable), client_id (FK, nullable),
title, description,
assigned_to (FK→users), created_by (FK→users),
priority (low|medium|high|urgent),
status (pending|in_progress|done|cancelled),
due_date, completed_at, created_at, updated_at
```

### expenses (Masraflar)
```sql
id, case_id (FK), expense_type (court_fee|notary|expert|transport|other),
amount, description, expense_date,
receipt_url, created_by, created_at, updated_at
```

### collections (Tahsilatlar / Honorarium)
```sql
id, case_id (FK), client_id (FK),
amount, collection_type (advance|installment|final|expense_reimbursement),
description, collection_date,
payment_method (cash|bank_transfer|check),
created_by, created_at, updated_at
```

### documents (Belgeler)
```sql
id, case_id (FK, nullable), client_id (FK, nullable),
file_name, file_url, file_size, file_type,
description, uploaded_by, created_at
```

### calendar_events (Takvim Olayları)
```sql
id, event_type (hearing|task|deadline|meeting|other),
related_id (FK→hearings veya tasks),
title, description, event_date, event_time,
reminder_minutes, reminder_sent,
created_by, created_at
```

### notes (Notlar)
```sql
id, case_id (FK, nullable), client_id (FK, nullable),
content, created_by, created_at, updated_at
```

### notifications (Bildirimler)
```sql
id, user_id (FK), type, title, message,
related_id, related_type,
is_read, created_at
```

---

## API Endpoint Listesi

### Auth
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Müvekkiller
- GET /api/clients (liste, arama, filtre)
- POST /api/clients
- GET /api/clients/:id
- PUT /api/clients/:id
- DELETE /api/clients/:id (soft delete)
- GET /api/clients/:id/cases
- GET /api/clients/:id/documents

### Davalar
- GET /api/cases (liste, filtre: durum/tür/avukat)
- POST /api/cases
- GET /api/cases/:id
- PUT /api/cases/:id
- DELETE /api/cases/:id
- GET /api/cases/:id/hearings
- GET /api/cases/:id/tasks
- GET /api/cases/:id/expenses
- GET /api/cases/:id/collections
- GET /api/cases/:id/documents
- GET /api/cases/:id/notes

### Duruşmalar
- GET /api/hearings (yaklaşan, tarih filtreli)
- POST /api/hearings
- PUT /api/hearings/:id
- DELETE /api/hearings/:id

### Görevler
- GET /api/tasks (liste, filtre: atanan/öncelik/durum)
- POST /api/tasks
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PATCH /api/tasks/:id/status

### Masraflar
- GET /api/expenses
- POST /api/expenses
- PUT /api/expenses/:id
- DELETE /api/expenses/:id

### Tahsilatlar
- GET /api/collections
- POST /api/collections
- PUT /api/collections/:id
- DELETE /api/collections/:id

### Takvim
- GET /api/calendar (aylık görünüm, tarih aralığı)
- GET /api/calendar/upcoming (önümüzdeki 7/30 gün)

### Dashboard
- GET /api/dashboard/stats (özet istatistikler)
- GET /api/dashboard/upcoming-hearings
- GET /api/dashboard/pending-tasks
- GET /api/dashboard/recent-cases

### Bildirimler
- GET /api/notifications
- PATCH /api/notifications/:id/read
- PATCH /api/notifications/read-all

### Belgeler
- POST /api/documents/upload
- DELETE /api/documents/:id

### Kullanıcılar (Admin)
- GET /api/users
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id

---

## Sayfa / Rota Listesi

```
/login                    → Giriş ekranı
/                         → Dashboard (ana sayfa)
/muvekkilller             → Müvekkil listesi
/muvekkilller/yeni        → Yeni müvekkil ekle
/muvekkilller/:id         → Müvekkil detay (davalar, belgeler, notlar)
/muvekkilller/:id/duzenle → Müvekkil düzenle
/davalar                  → Dava listesi
/davalar/yeni             → Yeni dava aç
/davalar/:id              → Dava detay (duruşmalar, görevler, masraf, belge)
/davalar/:id/duzenle      → Dava düzenle
/durusmalar               → Tüm duruşmalar (takvim + liste)
/gorevler                 → Görev listesi (kanban veya tablo)
/takvim                   → Aylık takvim görünümü
/ayarlar/kullanicilar     → Kullanıcı yönetimi (admin)
/ayarlar/profil           → Profil ayarları
```

---

## Kritik İş Kuralları

1. **Duruşma hatırlatmaları:** 3 gün önce + 1 gün önce otomatik bildirim
2. **Görev süresi geçmişse:** Kırmızı badge, bildirim
3. **Dava durumu "kazanıldı/kaybedildi/uzlaşıldı"** ise sadece görüntüle modu
4. **Müvekkil silinirse:** Soft delete, davalar korunur
5. **Masraf toplamı vs. tahsilat toplamı** her dava detayında görünür (bakiye)
6. **Duruşma eklendikten sonra** otomatik takvim olayı oluştur
7. **Rol bazlı erişim:**
   - Admin: Her şey
   - Avukat: Kendi davaları + tüm liste
   - Asistan: Görüntüleme + görev güncelleme

---

## Geliştirme Sırası

| Adım | Kapsam | Öncelik |
|------|--------|---------|
| 1 | Proje iskeletini kur (klasörler, bağımlılıklar, env) | Kritik |
| 2 | Veritabanı şeması + Drizzle migration + seed | Kritik |
| 3 | Auth sistemi (login/logout/me + middleware) | Kritik |
| 4 | Layout (sidebar + header + routing + koruma) | Yüksek |
| 5 | Müvekkil CRUD (liste, ekle, düzenle, detay) | Yüksek |
| 6 | Dava CRUD + liste + detay sayfası | Yüksek |
| 7 | Duruşma takibi (ekleme, listeleme, yaklaşanlar) | Yüksek |
| 8 | Görev yönetimi (liste, kanban, atama) | Orta |
| 9 | Masraf + tahsilat takibi | Orta |
| 10 | Takvim görünümü | Orta |
| 11 | Dashboard (istatistikler, özet) | Orta |
| 12 | Bildirim sistemi + cron hatırlatmaları | Orta |
| 13 | Belge yükleme (multer/S3) | Düşük |
| 14 | Kullanıcı yönetimi (admin paneli) | Düşük |
| 15 | Excel export + raporlar | Düşük |

---

## Geliştirme Notları

- Her API route'u Zod ile validate et
- Frontend'de tüm form hatalarını Türkçe göster
- Loading skeleton'ları her liste ve detay sayfasında kullan
- Error boundary ile 500 hatalarını yönet
- Mobile'da sidebar drawer olarak açılır
- shadcn bileşenlerini özelleştir, sıfırdan yazma
- Tüm tarihler UTC store edilir, görüntülemede TR locale kullan
- API hataları toast ile gösterilir
