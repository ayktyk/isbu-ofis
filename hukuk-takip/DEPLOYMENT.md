# Ucretsiz Kurulum

Bu repo icin en mantikli ucretsiz kurulum:
- `Neon`: veritabani
- `Render Free`: backend
- `Vercel Hobby`: frontend

## 1. Neon

Neon tarafinda iki baglanti kullan:
- `DATABASE_URL` = pooled URL
- `DATABASE_URL_MIGRATION` = direct URL

## 2. Yerel env

`hukuk-takip/.env.example` dosyasini baz alip `hukuk-takip/.env` olustur.

Lokal gelistirmede tipik ayar:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DATABASE_URL_MIGRATION=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
CLIENT_URL=http://localhost:5173
COOKIE_SECRET=local-cookie-secret
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
ENABLE_SCHEDULED_JOBS=false
JWT_SECRET=local-jwt-secret
JWT_REFRESH_SECRET=local-refresh-secret
```

Client tarafinda ayrik backend kullanacaksan `client/.env` icine:

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## 3. Migration ve ilk admin

Neon'a ilk kurulumda:

```bash
npm run db:migrate
```

Temiz ilk yonetici hesabi icin:

```bash
npm run db:bootstrap-admin --workspace=server
```

Bu komuttan once `.env` icine sunlari doldur:

```env
ADMIN_EMAIL=mailin@example.com
ADMIN_PASSWORD=guclu-sifren
ADMIN_FULL_NAME=Ad Soyad
ADMIN_BAR_NUMBER=
ADMIN_PHONE=
```

Not:
- `db:seed` komutu ornek musteri ve dava verisi ekler
- canli kurulumda bunu kullanma

## 4. Render backend

Repo icinde [render.yaml](/C:/Users/user/Desktop/projelerim/isbu-ofis/hukuk-takip/render.yaml:1) hazir.

Render uzerinde:
1. GitHub repo'yu bagla
2. `Blueprint` veya `New Web Service` ile olustur
3. `Free` plan sec
4. su env degiskenlerini gir:

```env
NODE_ENV=production
DATABASE_URL=pooled-neon-url
DATABASE_URL_MIGRATION=direct-neon-url
CLIENT_URL=https://senin-site.vercel.app
CORS_ORIGIN=https://senin-site.vercel.app
COOKIE_SECRET=strong-cookie-secret
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
ENABLE_SCHEDULED_JOBS=false
JWT_SECRET=strong-jwt-secret
JWT_REFRESH_SECRET=strong-refresh-secret
GOOGLE_CALENDAR_ID=senin-calendar-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_REMINDER_MINUTES=4320
GOOGLE_CALENDAR_TIMEZONE=Europe/Istanbul
```

Not:
- Render Free servis bosta kalinca uyur
- ilk istekten sonra yeniden ayaga kalkmasi biraz surebilir
- local dosya sistemi kalici degildir
- bu nedenle belge yukleme yerine Google Drive kullanman dogru

## 5. Vercel frontend

Repo icinde [vercel.json](/C:/Users/user/Desktop/projelerim/isbu-ofis/hukuk-takip/vercel.json:1) hazir.

Vercel'de:
1. ayni repo'yu import et
2. `Root Directory` olarak `hukuk-takip` sec
3. `vercel.json` build komutunu yonetecek
4. tek env degiskeni gir:

```env
VITE_API_BASE_URL=https://senin-render-servisin.onrender.com/api
```

Bu kurulumda frontend client-side routing icin rewrite hazir.

## 6. Operasyon notu

Belgeleri Google Drive'da tuttugun icin Neon sadece metin/veri saklayacak. Bu, ucretsiz limitin daha verimli kullanilmasini saglar.

Yine de haftalik yedek al:
- SQL dump
- CSV/JSON export
- Google Drive'a kopya

Render Free cron icin guvenilir degildir. Bildirim cron'unu bu nedenle varsayilan kapattik. Ileride ihtiyac olursa ayrik cron servisi ile yeniden acilabilir.

## 7. Google Calendar entegrasyonu

Bu yapi tek Gmail takvimi ile ucretsiz ve kararlı calissin diye `service account + paylasilan takvim` mantigiyla hazirlandi.

Yapman gerekenler:
1. Google Cloud'da yeni bir proje ac.
2. `Google Calendar API` etkinlestir.
3. Bir `Service Account` olustur.
4. Service account icin `JSON key` uret.
5. Kendi Google Calendar'inda kullanacagin takvimi ac.
6. Takvimi service account e-postasiyla `Make changes to events` yetkisi vererek paylas.
7. Yukaridaki Render env alanlarini JSON key icindeki degerlerle doldur.

Notlar:
- `GOOGLE_CALENDAR_ID` genelde Gmail adresin ya da takvim kimligin olur.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` Render'a tek satir olarak girilmeli; satir sonlari `\n` seklinde kalmali.
- Uygulama kayitlari once Neon'a yazilir. Google tarafinda hata olsa bile dava, gorev ve durusma verisi kaybolmaz.
- Takvim sonradan baglanirsa `POST /api/calendar/resync` ile mevcut kayitlar tekrar esitlenebilir.
