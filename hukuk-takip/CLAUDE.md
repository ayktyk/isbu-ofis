# ISBUOFIS.md — Hukuk Burosu Web Uygulamasi (Ayri Proje)

> Bu dosya, isbu-ofis/hukuk-takip web uygulamasinin tamami icin bagimsiz CLAUDE.md dosyasidir.
> Bu projeyi ayri bir Claude Code oturumunda, ayri bir proje olarak kullanin.
> Terminal tabanli arastirma sistemi bu dosyanin KAPSAMINDA DEGILDIR.

---

## Projenin Amaci

Kucuk bir hukuk burosu (2-5 kisi) icin, hem telefon hem bilgisayardan kullanilabilen,
sade ve hizli bir is takip + AI destekli otomasyon uygulamasi.

**Temel hedef:** Avukatin durusma kacirmamasi, muvekkil bilgilerini saniyeler icinde
bulmasi, masraf ve ucretleri kolayca takip etmesi, AI ile arastirma/dilekce/savunma
simulasyonu yapabilmesi.

**Kapsam disi (simdilik):** UYAP entegrasyonu, icra takibi, karmasik muhasebe.

---

## Kullanici Profili

- **Birincil kullanici:** Avukat (teknik bilgisi yok, pratiklik oncelikli)
- **Ikincil kullanicilar:** Buro asistani, stajyer avukat (2-4 kisi)
- **Cihazlar:** Masaustu bilgisayar (oncelikli) + akilli telefon (sik)
- **Dil:** Tamamen Turkce arayuz

---

## Teknoloji Stack

### Frontend
- React + Vite (TypeScript)
- Tailwind CSS
- shadcn/ui
- TanStack React Query
- React Hook Form + Zod
- Recharts (grafikler)
- Lucide React (ikonlar)
- date-fns (Turkce locale)
- Sonner (toast bildirimleri)

### Backend
- Node.js + Express 5 (TypeScript)
- PostgreSQL (Docker icinde)
- Drizzle ORM
- Zod (validasyon)
- JWT (httpOnly cookie)
- bcrypt
- node-cron (hatirlatma isleri)

### Harici Araclar (CLI)
- `yargi` CLI — Yargitay, Danistay karar aramasi
- `mevzuat` CLI — Kanun, KHK, yonetmelik arama
- `nlm` CLI — NotebookLM entegrasyonu
- `claude` CLI — AI dilekce/rapor uretimi

---

## Klasor Yapisi

```
isbu-ofis/hukuk-takip/
├── client/                 <- React uygulamasi
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         <- shadcn bilesenleri
│   │   │   ├── layout/     <- sidebar, header
│   │   │   └── shared/     <- genel bilesenler (StatusBadge, DataTable, FilterBar, vb.)
│   │   ├── pages/          <- sayfa bilesenleri
│   │   ├── hooks/          <- ozel React hook'lari (useAuth, useCases, useClients, vb.)
│   │   └── lib/            <- yardimci fonksiyonlar, queryClient, theme
├── server/
│   ├── src/
│   │   ├── routes/         <- API endpoint'leri
│   │   ├── middleware/     <- auth, hata yakalama, validate
│   │   ├── db/             <- Drizzle sema ve baglanti
│   │   ├── utils/          <- aiIntegration, automation, research, intake, procedureAi, vb.
│   │   └── env.ts          <- ortam degiskenleri
├── shared/                 <- ortak tipler ve schemalar (client + server)
│   └── src/
│       ├── schemas/        <- Zod schemalari (auth, case, client, hearing, task, expense, vb.)
│       ├── types.ts
│       └── index.ts
├── docker-compose.yml      <- PostgreSQL container
├── GELISTIRME.md           <- Ozellik klonlama plani (HukukcuApp)
├── ISLEYIS.md              <- Kullanim kilavuzu (avukat icin)
└── package.json
```

---

## Tasarim Sistemi

### Renk Paleti
```css
--primary: #1e3a5f      /* Koyu kurumsal mavi */
--accent: #2563eb       /* Orta mavi - butonlar */
--success: #16a34a      /* Yesil - kazanildi, tamamlandi */
--warning: #d97706      /* Turuncu - beklemede */
--danger: #dc2626       /* Kirmizi - acil, kaybedildi */
--bg: #f8fafc           /* Acik gri - arka plan */
--sidebar: #1e293b      /* Koyu - kenar cubugu */
--law-primary, --law-accent, --law-gold /* Hukuk tema degiskenleri */
```

### Tasarim Ilkeleri
- Profesyonel ve sade — hukuk burosuna yakisir ciddi gorunum
- Masaustu oncelikli ama telefonda da tam kullanilabilir (responsive)
- Sik kullanilan islemler en fazla 2 tikla yapilabilmeli
- Tarih formati: GG.AA.YYYY
- Para birimi: TL
- shadcn/ui componentleri kullanilir, sifirdan yazilmaz
- Tipografi: EB Garamond (basliklar), Lato (icerik)

---

## Veritabani Semasi

### users
```
id, email, password_hash, full_name, role (admin|lawyer|assistant),
is_active, created_at, updated_at
```

### clients (Muvekkilller)
```
id, client_type (individual|company),
first_name, last_name, tc_no, birth_date, phone, email, address,
company_name, tax_no, tax_office, authorized_person,
notes, is_active, created_by, created_at, updated_at
```

### cases (Davalar)
```
id, case_no, client_id (FK),
case_type (civil|criminal|administrative|execution|other),
court_name, court_file_no, judge_name,
status (active|won|lost|settled|closed),
subject, description,
opened_date, closed_date,
lawyer_id (FK->users), assistant_id (FK->users, nullable),
automation_status, automation_code, drive_folder_path,
contracted_fee,
created_at, updated_at
```

### case_hearings (Durusmalar)
```
id, case_id (FK), hearing_date, hearing_time,
court_name, court_room,
hearing_type (ilk|ara|karar|kesif|bilirkisi|diger),
result, next_hearing_date, notes,
reminder_sent, created_at, updated_at
```

### tasks (Gorevler)
```
id, case_id (FK, nullable), client_id (FK, nullable),
title, description,
assigned_to (FK->users), created_by (FK->users),
priority (low|medium|high|urgent),
status (pending|in_progress|done|cancelled),
due_date, completed_at, created_at, updated_at
```

### expenses (Masraflar)
```
id, case_id (FK), expense_type (court_fee|notary|expert|transport|other),
amount, description, expense_date,
receipt_url, created_by, created_at, updated_at
```

### collections (Tahsilatlar)
```
id, case_id (FK), client_id (FK),
amount, collection_type (advance|installment|final|expense_reimbursement),
description, collection_date,
payment_method (cash|bank_transfer|check),
created_by, created_at, updated_at
```

### notes (Notlar)
```
id, case_id (FK, nullable), client_id (FK, nullable),
content, created_by, created_at, updated_at
```

### notifications (Bildirimler)
```
id, user_id (FK), type, title, message,
related_id, related_type,
is_read, created_at
```

### ai_jobs (AI Isleri)
```
id, case_id (FK), job_type, status, input, output,
error, created_at, updated_at
```

---

## Sayfa / Rota Listesi

```
/login                    -> Giris ekrani
/                         -> Dashboard (ana sayfa)
/clients                  -> Muvekkil listesi
/clients/new              -> Yeni muvekkil ekle
/clients/:id              -> Muvekkil detay
/clients/:id/edit         -> Muvekkil duzenle
/cases                    -> Dava listesi
/cases/new                -> Yeni dava ac
/cases/:id                -> Dava detay (11 sekmeli)
/cases/:id/edit           -> Dava duzenle
/hearings                 -> Tum durusmalar
/tasks                    -> Gorev listesi
/calendar                 -> Aylik takvim
/notifications            -> Bildirimler
/settings                 -> Ayarlar (profil, sifre, API anahtarlari, tema)
```

---

## Dava Detay Sayfasi — 11 Sekme

Dava detay sayfasi sistemin kalbidir. 11 sekmeden olusur:

| # | Sekme | Aciklama |
|---|-------|----------|
| 1 | AI Calisma Alani | Otomasyon hattinin kontrol merkezi, Drive klasor olusturma |
| 2 | Durusmalar | Durusma tarih/saat/salon takibi, otomatik hatirlatma |
| 3 | Gorevler | Davayla ilgili is takibi (oncelik, durum, son tarih) |
| 4 | Masraflar | Dava masraflari kaydi (harc, noter, bilirkisi, ulasim) |
| 5 | Tahsilatlar | Muvekkilden alinan odemeler, bakiye hesabi |
| 6 | Usul | AI ile usul hukuku analizi (mahkeme, zamanasimi, arabuluculuk) |
| 7 | Arastirma | 4 paralel kaynak ile hukuki arastirma (Yargi, Mevzuat, NotebookLM, Vektor DB) |
| 8 | Dilekce | AI ile belge uretimi (6 belge turu: dava, ihtarname, cevap, istinaf, temyiz, basvuru) |
| 9 | Savunma | Karsi taraf savunma simulasyonu + yanit stratejisi |
| 10 | Belgeler | Dosya yukleme ve yonetimi |
| 11 | Notlar | Serbest notlar |

---

## AI Otomasyon Hatti (Pipeline)

Yeni dava acildiginda bastan sona AI destekli akis:

```
ADIM 1: AI Baslat     -> Drive klasoru olusturulur
ADIM 2: Arastirma     -> 4 kaynak paralel taranir (Yargi, Mevzuat, NotebookLM, Vektor DB)
ADIM 3: Usul Raporu   -> Otomatik uretilir (mahkeme, zamanasimi, arabuluculuk, harc)
ADIM 4: Dilekce v1    -> Arastirma + usul sentezinden belge uretilir
ADIM 5: Savunma Sim.  -> Karsi tarafin en guclu savunmalari simule edilir
ADIM 6: Dilekce v2    -> Savunma simulasyonuna karsi guclendirmis revizyon
```

### Otomasyon Durumlari
```
Baslanmadi -> Klasor Hazir -> Briefing Hazir -> Arastirma Hazir ->
Taslak Hazir -> Revizyon Asamasi -> Tamamlandi
```

### Arastirma Kaynaklari

| Kaynak | Arac | Ne Yapar |
|--------|------|----------|
| Yargi Kararlari | `yargi` CLI | Yargitay, Danistay, istinaf kararlarini arar |
| Ilgili Mevzuat | `mevzuat` CLI | Kanun, KHK, yonetmelik maddelerini bulur |
| NotebookLM | `nlm` CLI | AI calisma alanindaki dokumanlari inceler |
| Vektor DB | `hukuk_ara` | Buro kutuphanesinde semantik arama yapar |

### Arastirma Akisi
1. Avukat yonlendirmesi + muvekkil gorusme notlari girilir
2. AI kritik noktayi otomatik tespit eder
3. Avukat kritik noktayi onaylar
4. 4 kaynak paralel taranir
5. Kalite kontrolu yapilir, argumanlar secilir
6. Onaylaninca usul raporu otomatik uretilir

### Dilekce Uretimi
- 6 belge turu desteklenir: Dava Dilekcesi, Ihtarname, Cevap, Istinaf, Temyiz, Basvuru
- v1 taslak uretilir -> avukat inceler
- Savunma simulasyonu yapilir
- v2 revizyon uretilir (savunmaya karsi guclendirmis)
- UDF (UYAP formati) indirilebilir
- Tum dosyalar otomatik Google Drive'a kaydedilir

### Google Drive Klasor Yapisi (Otomasyon Sonrasi)

```
G:\Drive'im\Hukuk Burosu\Aktif Davalar\{dava-id}\
├── 00-Briefing.md
├── 01-Usul\usul-raporu.md
├── 02-Arastirma\
│   ├── arastirma-raporu.md
│   └── savunma-simulasyonu.md
├── 03-Sentez-ve-Dilekce\
│   ├── dava-dilekcesi-v1.md
│   ├── dava-dilekcesi-v1.udf
│   ├── revizyon-raporu-v1.md
│   └── dilekce-v2.md
├── 04-Muvekkil-Belgeleri\
│   ├── 00-Ham\
│   ├── 01-Tasnif\
│   └── evrak-listesi.md
└── 05-Durusma-Notlari\
```

---

## API Endpoint Listesi

### Auth
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Muvekkilller
- GET /api/clients (liste, arama, filtre)
- POST /api/clients
- GET /api/clients/:id
- PUT /api/clients/:id
- DELETE /api/clients/:id (soft delete)
- GET /api/clients/:id/cases
- GET /api/clients/:id/documents

### Davalar
- GET /api/cases (liste, filtre: durum/tur/avukat)
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

### Durusmalar
- GET /api/hearings
- POST /api/hearings
- PUT /api/hearings/:id
- DELETE /api/hearings/:id

### Gorevler
- GET /api/tasks
- POST /api/tasks
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PATCH /api/tasks/:id/status

### Masraflar / Tahsilatlar
- GET/POST/PUT/DELETE /api/expenses
- GET/POST/PUT/DELETE /api/collections

### AI ve Otomasyon
- POST /api/intake/... — Dava baslangic, kritik nokta tespiti
- POST /api/research/... — Paralel arastirma
- POST /api/procedure/... — Usul raporu uretimi
- POST /api/ai-jobs/... — AI is takibi

### Dashboard
- GET /api/dashboard/stats
- GET /api/dashboard/upcoming-hearings
- GET /api/dashboard/pending-tasks
- GET /api/dashboard/recent-cases

### Bildirimler
- GET /api/notifications
- PATCH /api/notifications/:id/read
- PATCH /api/notifications/read-all

### Takvim
- GET /api/calendar
- GET /api/calendar/upcoming

---

## Araclar Bolumu (Ek Ozellikler — GELISTIRME.md'de Planlanmis)

Sidebar'daki "Araclar" grubu altinda 6 ek ozellik planlanmistir:

| Ozellik | Sayfa | Durum |
|---------|-------|-------|
| Akilli Ictihat Aramasi | /tools/ictihat | Planlanmis |
| Hesaplamalar (6 alt modul) | /tools/calculations | Planlanmis |
| AI Komut Sablonlari | /tools/prompts | Planlanmis |
| Miras Payi Hesaplama | /tools/inheritance | Planlanmis |
| Arabuluculuk Belgeleri | /tools/mediation | Planlanmis |
| Infaz Hesaplama | /tools/sentence | Planlanmis |

### Hesaplama Modulleri
1. **Iscilik Alacaklari** — Kidem, ihbar, fazla mesai, UBGT, hafta tatili, yillik izin
2. **Vekalet Ucreti** — AAUT 2025-2026 tarifesi
3. **Arabulucu Ucreti** — 2026 tarife
4. **Faiz Hesaplama** — Yasal + ticari avans, donemsel oran
5. **Is/Trafik Kazasi Tazminat** — TRH2010 + progresif rant
6. **Harc Hesaplama** — 2026 yargi harclari

Detayli plan: `GELISTIRME.md` dosyasinda.

---

## Kritik Is Kurallari

1. **Durusma hatirlatmalari:** 3 gun once + 1 gun once otomatik bildirim
2. **Gorev suresi gecmisse:** Kirmizi badge, bildirim
3. **Dava durumu "kazanildi/kaybedildi/uzlasildi"** ise sadece goruntule modu
4. **Muvekkil silinirse:** Soft delete, davalar korunur
5. **Masraf toplami vs. tahsilat toplami** her dava detayinda goruntulenir (bakiye)
6. **Durusma eklendikten sonra** otomatik takvim olayi olustur
7. **Rol bazli erisim:**
   - Admin: Her sey
   - Avukat: Kendi davalari + tum liste
   - Asistan: Goruntuleme + gorev guncelleme

---

## Durum Kodlari ve Renk Sistemi

### Dava Durumlari
| Durum | Renk |
|-------|------|
| Aktif | Mavi |
| Istinafta | Turuncu |
| Yargitayda | Turuncu |
| Pasif | Gri |
| Kapatildi | Gri |
| Kazanildi | Yesil |
| Kaybedildi | Kirmizi |
| Uzlasildi | Turuncu |

### Otomasyon Durumlari
| Durum | Renk |
|-------|------|
| Baslanmadi | Gri |
| Klasor Hazir | Mavi |
| Briefing Hazir | Mavi |
| Arastirma Hazir | Mavi |
| Taslak Hazir | Turuncu |
| Revizyon Asamasi | Turuncu |
| Tamamlandi | Yesil |

### Gorev Oncelikleri
| Oncelik | Renk |
|---------|------|
| Acil | Kirmizi |
| Yuksek | Turuncu |
| Orta | Gri |
| Dusuk | Beyaz |

---

## Calistirma (Baslangic)

### Gereksinimler
- Docker Desktop (PostgreSQL icin)
- Node.js
- Google Drive for Desktop (dosya senkronizasyonu)
- CLI araclar: yargi, mevzuat, nlm, claude

### Ilk Kurulum
```bash
cd isbu-ofis/hukuk-takip
docker compose up -d          # PostgreSQL baslatir
npm install                   # Bagimliliklari yukler
npm run db:migrate            # Tablolari olusturur
cd server && npx tsx src/db/seed.ts && cd ..   # Ornek veri yukler
```

### Gunluk Baslatma
```bash
# Docker Desktop acik olmali
cd isbu-ofis/hukuk-takip
npm run dev
# http://localhost:5173 adresini ac
# Giris: avukat@buro.com / Admin123!
```

### Portlar
| Adres | Gorev |
|-------|-------|
| http://localhost:5173 | Frontend (tarayicida ac) |
| http://localhost:3001 | Backend API |
| localhost:5432 | PostgreSQL (Docker) |

---

## Ortam Degiskenleri (server/.env)

```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=...
AI_ACTIVE_CASES_ROOT=G:\Drive'im\Hukuk Burosu\Aktif Davalar
```

---

## Guvenlik

- JWT httpOnly cookie ile kimlik dogrulama
- Sifre bcrypt ile hashlenir
- API anahtarlari .env dosyasinda saklanir
- TC kimlik, IBAN gibi hassas veriler harici API'ye gonderilmez
- Rol bazli erisim kontrolu (admin, lawyer, assistant)
- Tum ciktilar TASLAK'tir — avukat son kontrolu yapar

---

## Gelistirme Notlari

- Her API route'u Zod ile validate et
- Frontend'de tum form hatalarini Turkce goster
- Loading skeleton'lari her liste ve detay sayfasinda kullan
- Mobile'da sidebar drawer olarak acilir
- shadcn bilesenlerini ozellestir, sifirdan yazma
- Tum tarihler UTC store edilir, goruntulemede TR locale kullan
- API hatalari Sonner toast ile gosterilir
- Immutability kurali: objeleri mutate etme, yeni obje olustur
- Dosya boyutu limiti: 200-400 satir normal, 800 max

---

## Sik Karsilasilan Sorunlar

| Sorun | Cozum |
|-------|-------|
| Siteye giremiyorum | Docker acik mi? npm run dev calisiyor mu? |
| Veriler yuklenmiyor | docker start hukuk-pg, sonra npx drizzle-kit push |
| Arastirma hata veriyor | CLI araclari test et: yargi bedesten search "test" |
| AI hatasi | ANTHROPIC_API_KEY .env'de var mi kontrol et |
| Drive'a kayit olmuyor | Google Drive senkronize mi? Klasor yolu dogru mu? |
| npm run dev hata | npm install yap, port kullanimda ise onceki islemi kapat |

---

## Bu Dosyanin Kapsami

Bu dosya SADECE isbu-ofis/hukuk-takip web uygulamasini kapsar:
- Muvekkil, dava, durusma, gorev, masraf, tahsilat yonetimi
- AI otomasyon hatti (arastirma, usul, dilekce, savunma, revizyon)
- Dashboard, takvim, bildirimler
- Hesaplama araclari, ictihat arama, arabuluculuk belgeleri

Terminal tabanli arastirma sistemi (CLAUDE.md'deki ajan yapisi, director agent,
arastirma ajanlari, dilekce yazari) bu dosyanin KAPSAMINDA DEGILDIR.
O sistem icin ana projenin CLAUDE.md dosyasini kullanin.
