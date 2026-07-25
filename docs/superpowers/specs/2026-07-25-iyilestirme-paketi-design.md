# İyileştirme Paketi — 9 Madde

**Tarih:** 2026-07-25
**Durum:** Tasarım onaylandı (avukat onayı alındı)
**Kapsam:** `hukuk-takip` (client + server + shared)

---

## 0. Değişmez Kural — Veri Koruma

Sistem 2026-04-16'dan beri canlı üretimde; müvekkil, dava, duruşma, masraf ve
tahsilat verileri elle girilmiş durumda. Bu spec'teki hiçbir madde şunları
içermez:

- `DROP TABLE` / `DROP COLUMN` / `DROP SCHEMA` / `TRUNCATE`
- Toplu `DELETE FROM`
- Kolon rename veya tip daraltma
- Mevcut satırlar üzerinde toplu `UPDATE` (backfill)

İzin verilen tek şema işlemleri: **`ADD COLUMN` (nullable)** ve
**`CREATE TABLE`**. Kullanıcının tek tek sildiği satırlar fiziksel silinmez,
`archived_at` ile arşivlenir (projedeki mevcut desen).

**Migration öncesi zorunlu:** `pg_dump` yedeği `backups/` altına tarih damgalı
kaydedilir ve `backups/README.md`'ye o migration için not düşülür. Neon PITR
penceresi (7 gün) ayrıca teyit edilir.

---

## 1. Doğrulanmış Bulgular (tahmin değil, ölçüm)

Bu spec'in Faz 1'i aşağıdaki üç ölçüme dayanıyor:

| Bulgu | Kanıt | Sonuç |
|---|---|---|
| Render servisi uyanıkken hızlı | `curl https://isbu-ofis-api.onrender.com/api/health` → **0,29 sn**, HTTP 200 | Sunucu veya sorgular yavaş değil |
| Cold start pahalı | Önceki oturumda ölçülen: **21,8 sn** | İlk isteğin tamamı boot maliyeti |
| Keep-alive kurulu ama işlevsiz | GitHub Actions API: workflow `schedule` ile "success" dönüyor, ancak gerçek aralıklar 01:04→04:24 (3s 20dk), 04:24→06:38, 06:38→08:50, sonrası ~1 saat. Beklenen 144 ping/gün, gerçek **12-16 ping/gün** | GitHub public repolarda sık cron'u kısıyor; Render 15 dk'da uyuduğu için sunucu saatin ~50 dakikasını, gece 3 saati uykuda geçiriyor |

**Çıkarım:** "İlk açtığımda yavaş" şikâyetinin birincil sebebi, keep-alive'ın
_kurulu ama pratikte çalışmıyor_ olması. GitHub Actions cron'u bu iş için
yeterli değildir; harici bir pinger gerekir.

Ek olarak, sunucu uyanık olsa bile PWA açılışta ekrana veri basmıyor:
`client/src/main.tsx` içindeki `shouldDehydrateQuery` yalnızca `['auth']`
query'sini kalıcılaştırıyor. Dashboard, görev, dava, müvekkil listeleri her
açılışta sıfırdan ağ isteği bekliyor.

---

## 2. Faz 1 — Hız (Madde 7)

Şema değişikliği yok. Riski en düşük, kazancı en yüksek faz.

### 2.1 Harici keep-alive (asıl çözüm)

- `.github/workflows/keep-alive.yml` **silinmez**; yedek katman olarak kalır,
  ama tek dayanak olmaktan çıkar. Cron ifadesi `*/10` yerine `*/5` yapılır
  (GitHub kısıtlasa da daha sık deneme = daha çok gerçekleşen ping) ve dosyaya
  "birincil mekanizma harici cron'dur" notu eklenir.
- **Birincil pinger: cron-job.org** (ücretsiz, 1 dakikaya kadar iner,
  GitHub'ın aksine ilan edilen aralığa sadık kalır).
  - Hedef: `https://isbu-ofis-api.onrender.com/api/health`
  - Aralık: **5 dakika** (Render'ın 15 dk uyku eşiğinin çok altında)
  - Pencere: hafta içi + Cumartesi **06:00–21:00 (Europe/Istanbul)**
  - Gerekçe: 7/24 ping = ~730 saat/ay, Render Free'nin 750 saatlik kotasına
    pay bırakmaz. Mesai penceresi ~15 saat/gün × 26 gün ≈ **390 saat/ay** →
    kota yarı yarıya rahat, avukatın fiilî kullanım saatleri tam kapsanır.
  - Bu adım avukat tarafından web arayüzünden yapılır; repoya kod girmez.
    Spec, adım adım talimatı `DEPLOYMENT.md`'ye ekler.

### 2.2 PWA açılışında son veriyi anında göster

`client/src/main.tsx`:

- Persister `createSyncStoragePersister` (localStorage, senkron — ana thread'i
  bloklar) yerine **IndexedDB tabanlı asenkron persister**'a geçer:
  `@tanstack/query-async-storage-persister` + `idb-keyval` (toplam ~3 KB;
  `npm install` ile eklenir, `package-lock.json`'a elle dokunulmaz). Bu,
  mevcut kodda `shouldDehydrateQuery` beyaz listesinin gerekçesi olan
  "büyük listeleri senkron yazmak mobilde takılma yaratır" sorununu ortadan
  kaldırır.
- `shouldDehydrateQuery` beyaz listesi genişler:
  `auth`, `dashboard`, `tasks`, `cases`, `clients`, `notifications`,
  `collections`, `hearings`.
- `maxAge` 24 saat olarak kalır; `buster` (`VITE_BUILD_ID`) davranışı korunur.

Beklenen etki: uygulama açılır açılmaz son bilinen veri ekranda; yenileme
arka planda sessizce olur.

### 2.3 İskelet yerine "güncelleniyor" göstergesi

Cache'te veri varken tam sayfa iskeleti basmak yerine veri gösterilir ve
üstte ince bir ilerleme çizgisi çıkar. Uygulanacağı sayfalar: Dashboard,
Görevler, Davalar, Müvekkiller, Tahsilatlar, CMK, Arabuluculuk.
`isLoading` yerine `isPending && !data` mantığı; `isFetching` ilerleme
çizgisini sürer.

### 2.4 Dokunmada ön yükleme

`Sidebar.tsx` ve `MobileBottomNav.tsx` öğelerine `onPointerDown` eklenir:
ilgili rotanın lazy chunk'ı `import()` ile, ilgili query `prefetchQuery` ile
ısıtılır. Parmak kalkmadan sayfa hazır olur.

### 2.5 Uyandırma zinciri — Neon de uyansın

- Sunucuya `GET /api/health?deep=1` eklenir: normal health çıktısına ek olarak
  tek bir `SELECT 1` çalıştırır.
- **Sadece istemci açılış ping'i** (`main.tsx`) bu varyantı kullanır.
- Harici keep-alive ve `render.yaml` healthCheck **sade** `/api/health`
  kullanmaya devam eder — Neon compute saatini 5 dakikada bir uyandırmamak
  için bilinçli tercih.

### 2.6 Ölçüm

- Sunucu: her isteğin süresini yazan hafif bir middleware (yalnızca
  `NODE_ENV=production` ve >500 ms olanlar için log).
- İstemci: açılışta tek seferlik `performance` ölçümü, `console.debug`.
- Amaç: "hızlandı" iddiasını öncesi/sonrası sayı ile destekleyebilmek.

### 2.7 Dürüst sınır

Render Free planında cold start **tamamen ortadan kaldırılamaz**. Bu fazın
hedefi onu (a) nadir hale getirmek (5 dakikalık güvenilir ping) ve
(b) görünmez kılmaktır (cache-first açılış). Avukat mesai penceresi dışında
(gece/pazar) uygulamayı açarsa yine 20+ saniye bekleyebilir; bu durumda
`axios.ts`'teki mevcut "Sunucu uyandırılıyor…" bildirimi devrede kalır.

---

## 3. Faz 2 — Tek Dokunuşluk Düzeltmeler

| # | Madde | Dosya | Değişiklik |
|---|---|---|---|
| 2 | Arabuluculuk toplam dosya sayısı | `MediationFilesPage.tsx` | Başlık altına `{n} arabuluculuk dosyası kayıtlı` — Davalar/CMK sayfalarındaki ifadenin birebir aynısı. Sayı `useMediationFiles` dizisinin uzunluğundan gelir (endpoint dizi döner, `total` yok) |
| 4 | Görev sayısı | `TasksPage.tsx` | Başlık altı: `12 görev · 5 tamamlanmadı`. Arama/filtre etkinken: `8 / 12 görev gösteriliyor` |
| 5 | CMK eklenme zamanı | `CmkAssignmentsPage.tsx` (+ gerekirse `routes/cases.ts` select) | Tabloya **Eklenme** kolonu, `createdAt`, GG.AA.YYYY. Liste endpoint'i `createdAt` döndürmüyorsa select'e eklenir (salt okuma, additive) |
| 8a | Tahsilat sıralaması | `server/src/routes/collections.ts` | **Gerçek hata:** `orderBy(desc(collections.createdAt))` → geçmiş tarihli bir tahsilat bugün girilince listenin başına çıkıyor. `orderBy(desc(collectionDate), desc(createdAt))` olacak |

---

## 4. Faz 3 — Görevler Ekranı (Madde 3, 9, 1)

### 4.1 Arama + mükerrer uyarısı (Madde 3)

- `TasksPage.tsx`'e arama kutusu. Filtre **istemci tarafında**: başlık,
  açıklama, etiket, dava adı içinde arar. Liste zaten tek istekte geliyor;
  sunucuya dokunulmaz, tuşa basınca anında filtrelenir.
- Türkçe karakter duyarlı normalizasyon (`toLocaleLowerCase('tr')`) —
  `CollectionsPage`'deki mevcut desenle aynı.
- **Mükerrer uyarısı:** Yeni görev formunda başlık yazılırken, mevcut
  görevlerle normalize edilmiş karşılaştırma yapılır. Eşleşme varsa form
  içinde sarı uyarı: *"Bu başlıkta bir görev zaten var: …"*. Engellemez,
  yalnızca uyarır — asıl "iki kez yazma" sorununu çözen budur.

### 4.2 Kategori etiketi (Madde 9)

**Şema (additive):**

```
tasks ADD COLUMN category varchar(20)   -- nullable
      -- değerler: 'dava' | 'cmk' | 'arabuluculuk' | 'genel'
```

- Eski görevler `null` kalır. **Hiçbir backfill/toplu UPDATE yapılmaz.**
- Formda segment seçici. Listede renkli rozet:
  Dava = mavi, CMK = indigo, Arabuluculuk = turuncu, Genel = gri.
- Filtre çubuğuna kategori filtresi eklenir.
- **Avukat kararı gereği "Arabuluculuk" yalnızca etikettir** — arabuluculuk
  dosyasına bağlanmaz, `tasks` tablosuna `mediation_file_id` **eklenmez**.
- "Dava" seçilince dava listesi (`useCases`, CMK hariç), "CMK" seçilince CMK
  listesi (`useCases({ isCmk: 'only' })`) gelir. CMK dosyaları zaten `cases`
  tablosunda olduğu için ek şema gerekmez. **Yan kazanç:** bugün bir görev
  CMK dosyasına hiç bağlanamıyor (`TasksPage` `useCases`'i CMK'sız çağırıyor),
  bu düzelmiş olur.
- `null` kategorili eski görevlerde rozet, mümkünse `caseId` →
  `case.isCmkAssignment` üzerinden türetilir; türetilemezse rozet gösterilmez.

### 4.3 Görev formundan yeni dava / yeni müvekkil (Madde 1)

- Dava seçicisinin yanına `+` butonu → **Hızlı Dava Ekle** penceresi:
  dava başlığı (zorunlu), müvekkil seçimi + kendi `+`'sı ile hızlı müvekkil
  oluşturma, dava türü, CMK işareti.
- Kayıt sonrası yeni dava forma otomatik seçilir.
- **Kod tekrarını önlemek için:** `CaseFormPage.tsx` içindeki mevcut inline
  müvekkil ekleme dialog'u `components/shared/QuickAddClientDialog.tsx`'e
  taşınır; yeni `components/shared/QuickAddCaseDialog.tsx` onu kullanır.
  `CaseFormPage` de ortak bileşene geçer — iki yerde aynı form durmaz.
- Mevcut `useCreateCase` / `useCreateClient` hook'ları kullanılır; yeni
  endpoint yazılmaz.

---

## 5. Faz 4 — Esnek Ücret Anlaşması (Madde 6)

Avukatın gerçek çalışma biçimi: bazen sadece maktu tutar, bazen sadece
yüzdelik, bazen ikisi birden; maktu tutar sık sık taksitli (ör. 90.000 TL /
3 taksit).

### 5.1 Şema (additive)

```
cases ADD COLUMN fee_type             varchar(20)    -- 'fixed' | 'percentage' | 'fixed_plus_percentage'
cases ADD COLUMN fee_percentage       decimal(5,2)   -- ör. 15.00
cases ADD COLUMN fee_percentage_base  varchar(20)    -- 'collected' (tahsil edilen) | 'awarded' (hükmedilen)
cases ADD COLUMN fee_percentage_note  varchar(500)
cases ADD COLUMN fee_payment_plan     varchar(20)    -- 'single' | 'installment'
```

- **`contracted_fee` olduğu gibi kalır** ve maktu tutarı ifade eder.
  Rename yok, taşıma yok, backfill yok.
- `fee_type` boş olan mevcut davalar bugünkü davranışla birebir aynı çalışır
  (`fixed` gibi yorumlanır).

```
CREATE TABLE case_fee_installments (
  id           uuid PK default random,
  case_id      uuid FK -> cases(id) ON DELETE CASCADE, NOT NULL,
  seq          integer NOT NULL,          -- 1, 2, 3...
  amount       decimal(12,2) NOT NULL,
  due_date     date NOT NULL,
  status       varchar(20) NOT NULL default 'pending',  -- 'pending' | 'paid' | 'partial'
  collection_id uuid FK -> collections(id) ON DELETE SET NULL,  -- ödendiğinde bağlanan tahsilat
  note         varchar(300),
  archived_at  timestamp,                 -- "silme" = arşivleme
  created_at   timestamp default now() NOT NULL,
  updated_at   timestamp default now() NOT NULL
);
CREATE INDEX case_fee_installments_case_idx ON case_fee_installments(case_id);
```

### 5.2 API

```
GET    /api/cases/:id/fee-installments
POST   /api/cases/:id/fee-installments        -- tek taksit ekle
PUT    /api/fee-installments/:id              -- tutar / vade / durum güncelle
DELETE /api/fee-installments/:id              -- archived_at set eder, satır silinmez
```

Toplu "replace" endpoint'i **yazılmaz** — mevcut taksitleri topluca silip
yeniden yazan bir kod yolu veri koruma kuralına aykırıdır.

### 5.3 Form (`CaseFormPage.tsx` — yeni "Ücret Anlaşması" kartı)

- Ücret tipi: `( ) Maktu  ( ) Yüzdelik  ( ) Maktu + Yüzdelik`
- Maktu seçiliyse: tutar + para birimi + ödeme planı
  (`Tek ödeme` / `Taksitli`).
- Taksitli seçiliyse: taksit sayısı + ilk vade + **[Taksitleri Oluştur]**
  butonu. Eşit böler, **kuruş artığını son taksite yazar** (toplam her zaman
  maktu tutara birebir eşit olur). Üretilen her satır tek tek düzenlenebilir
  (tutar + vade), tek tek silinebilir (arşivlenir), elle satır eklenebilir.
- Yüzdelik seçiliyse: oran (%) + matrah (`Tahsil edilen` / `Hükmedilen`) +
  serbest not.
- Zod şeması `shared/src/schemas/case.ts`'e eklenir; alanların tümü opsiyonel
  olduğu için mevcut form gönderimleri kırılmaz.

### 5.4 Dava detayı (`CaseDetailPage.tsx`)

- Ücret anlaşması özeti (tip, tutar, oran, matrah).
- Taksit tablosu: ödenmiş yeşil, bekleyen nötr, **vadesi geçmiş kırmızı**.
- Her taksit satırında **"Tahsilat olarak işle"** → tahsilat formunu tutar ve
  tarih dolu şekilde açar; kayıt sonrası taksit `paid` olur ve
  `collection_id` bağlanır.

### 5.5 Bakiye mantığı (dikkat gerektiren kısım)

- **Maktu davalar:** `outstandingFees.ts` hesabı **hiç değişmez**.
  Bugün bekleyen listesinde görünen hiçbir dava kaybolmaz/eklenmez.
- **Taksitli davalar:** kalan tutar yine `contracted_fee − tahsil edilen`.
  Ek olarak "vadesi geçmiş taksit" ayrı bir sinyal olarak gösterilir.
- **Yalnızca yüzdelik davalar:** ortada hesaplanabilir bir tutar yoktur.
  **Uydurma rakam üretilmez.** Bu davalar bekleyen tahsilat _toplamına_
  girmez; bunun yerine listede `%15 · dava sonu` rozetiyle görünür kalır ki
  gözden kaçmasın.

### 5.6 Kapsam sınırı

Bu madde `cases` tablosunu (dolayısıyla CMK dosyalarını da) kapsar.
`mediation_files.agreed_fee` alanına **dokunulmaz**. Arabuluculuk için de
esnek ücret istenirse ayrı bir iş olarak ele alınır.

---

## 6. Faz 5 — Bekleyen Tahsilatlar (Madde 8b)

`CollectionsPage.tsx` iki sekmeye ayrılır:

```
[ Tahsilatlar ]  [ Bekleyen (7) ]
```

- **Bekleyen sekmesi**, sunucudaki mevcut `getOutstandingCaseFees` ve
  `getOutstandingMediationFees` yardımcılarını kullanır. Bu yardımcılar
  Dashboard ve İstatistikler tarafından da kullanıldığı için üç ekran
  arasında tutarsızlık oluşmaz (bu, daha önce yaşanmış ve tek kaynağa
  bağlanarak çözülmüş bir sorun — o karar korunuyor).
- Yeni endpoint: `GET /api/collections/outstanding` → `{ cases: [], mediations: [] }`.
- Kolonlar: dosya, müvekkil, anlaşılan, tahsil edilen, **kalan**.
- Faz 4 tamamlandıktan sonra vadesi geçmiş taksitler bu sekmede kırmızı
  görünür.
- Mevcut kaynak filtresi (Tümü / Davalar / Arabuluculuk / CMK) ve arama
  kutusu, "Tahsilatlar" sekmesinde bugünkü haliyle kalır.

---

## 7. Uygulama Sırası

| Sıra | Faz | Neden bu sırada |
|---|---|---|
| 1 | Faz 1 — Hız | Günlük acı bu; şema değişmez, risk en düşük, kazanç en büyük |
| 2 | Faz 2 — Tek dokunuşluklar | Küçük, bağımsız, hemen görünür (madde 2, 4, 5, 8a) |
| 3 | Faz 3 — Görevler (3, 9, 1) | Tek `ADD COLUMN`; görev akışı bütünüyle toparlanır |
| 4 | Faz 5 — Bekleyen tahsilatlar (8b) | Mevcut sunucu yardımcılarını kullanır, şema değişmez |
| 5 | Faz 4 — Esnek ücret (6) | En büyük iş; yeni tablo + 5 kolon. En sona, tam yedekle |

Her fazın sonunda: type-check + build + gözle doğrulama, sonra commit.
Şema değiştiren fazlardan (3 ve 4) **önce** `pg_dump` yedeği alınır.

---

## 8. Riskler ve Önlemler

| Risk | Önlem |
|---|---|
| IndexedDB persister mobilde beklenmedik davranır | `buster` mekanizması korunur; hata durumunda persister sessizce devre dışı kalır, uygulama ağdan çalışmaya devam eder (graceful degradation) |
| `contracted_fee` anlamının değişmesi | Değişmiyor — maktu tutar olarak kalıyor, `fee_type` null davranışı bugünküyle özdeş |
| Bekleyen tahsilat rakamlarının kayması | `outstandingFees.ts` maktu davalar için hiç değiştirilmez; yüzdelik davalar toplama dahil edilmez |
| cron-job.org hesabı unutulur/düşer | GitHub workflow yedek katman olarak kalır; ayrıca `DEPLOYMENT.md`'ye kurulum ve doğrulama adımı yazılır |
| Taksit satırı yanlışlıkla silinir | Fiziksel silme yok; `archived_at` ile arşivlenir, geri alınabilir |
| Render 750 saat kotası aşılır | Ping yalnızca mesai penceresinde (~390 saat/ay) |

---

## 9. Kapsam Dışı (bilinçli karar)

- `tasks` tablosuna `mediation_file_id` eklemek — avukat "arabuluculuk sadece
  etiket olsun" dedi.
- `mediation_files` için esnek ücret / taksit.
- Render ücretli plana geçiş — avukat "fiyatlar çok yüksek" dedi, ücretsiz
  kalınacak.
- Liste virtualization, büyük sayfa dosyalarını parçalama, Sentry, Pino —
  `KALANIYILEŞTIRMELER.md`'de duruyor, bu paketin parçası değil.
- Mevcut verinin herhangi bir şekilde taşınması, dönüştürülmesi veya
  temizlenmesi.
