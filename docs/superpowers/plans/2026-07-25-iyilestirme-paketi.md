# 9 Maddelik İyileştirme Paketi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avukatın günlük iş akışındaki 9 somut eksiği kapatmak — PWA açılış hızı, görev ekranı (arama/sayaç/kategori/hızlı dava ekleme), arabuluculuk ve CMK sayaçları, tahsilat sıralaması ve bekleyen tahsilatlar, esnek ücret anlaşması (maktu + yüzdelik + taksit).

**Architecture:** Mevcut mimari korunuyor — React + Vite (client), Express 5 + Drizzle (server), ortak Zod şemaları (shared). Şema değişiklikleri drizzle migration ile değil, projenin kanıtlanmış idempotent deseni olan `server/src/db/ensureSchema.ts` içindeki `REV*` blokları ile yapılır (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`). Büyüyen sayfalar (TasksPage, CaseFormPage) sorumluluk bazında alt bileşenlere ayrılır.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, React Hook Form + Zod, Tailwind, Express 5, Drizzle ORM, PostgreSQL (Neon), Vitest (yalnızca saf hesap fonksiyonları için).

---

## ⛔ Tüm Planı Bağlayan Veri Koruma Kuralı

Bu planda **hiçbir adımda** şunlar yoktur ve eklenemez:
`DROP TABLE` · `DROP COLUMN` · `DROP SCHEMA` · `TRUNCATE` · toplu `DELETE FROM` · kolon rename · tip daraltma · mevcut satırlarda toplu `UPDATE`.

Kullanıcının tek tek sildiği kayıtlar `archived_at` ile arşivlenir, fiziksel silinmez.

**Faz 3 ve Faz 5'e başlamadan önce zorunlu:** `pg_dump` yedeği alınır ve `backups/` altına tarih damgalı kaydedilir + `backups/README.md`'ye not düşülür. Bu adım planın içinde ayrı bir görev olarak yer alıyor.

---

## Dosya Haritası

**Yeni dosyalar**

| Dosya | Sorumluluk |
|---|---|
| `client/src/lib/queryPersister.ts` | IndexedDB tabanlı React Query persister + kalıcılaştırılacak query beyaz listesi |
| `client/src/lib/routeChunks.ts` | Rota yolu → lazy chunk `import()` eşlemesi (dokunmada chunk ön yükleme) |
| `client/src/lib/textSearch.ts` | Türkçe duyarlı metin normalizasyonu + mükerrer başlık tespiti |
| `client/src/lib/taskCategory.ts` | Görev kategorisi değerleri, etiketleri, renkleri, eski kayıttan türetme |
| `client/src/lib/feeInstallments.ts` | Taksit üretimi (saf fonksiyon, birim testli) |
| `client/src/lib/feeInstallments.test.ts` | `feeInstallments` birim testleri |
| `client/src/components/shared/RefreshBar.tsx` | Arka plan yenileme sırasında üstte ince ilerleme çizgisi |
| `client/src/components/shared/QuickAddClientDialog.tsx` | Hızlı müvekkil ekleme penceresi (ortak) |
| `client/src/components/shared/QuickAddCaseDialog.tsx` | Hızlı dava ekleme penceresi (ortak) |
| `client/src/components/tasks/TaskForm.tsx` | Görev ekleme/düzenleme formu (tek kaynak) |
| `client/src/components/tasks/TaskRow.tsx` | Görev listesi satırı |
| `client/src/components/cases/FeeAgreementFields.tsx` | Ücret anlaşması form bölümü |
| `client/src/components/cases/FeeInstallmentTable.tsx` | Dava detayında taksit tablosu |
| `client/src/hooks/useFeeInstallments.ts` | Taksit CRUD hook'ları |
| `server/src/middleware/requestTiming.ts` | Yavaş istek logu (>500 ms) |
| `server/src/routes/feeInstallments.ts` | Taksit endpoint'leri |
| `shared/src/schemas/feeInstallment.ts` | Taksit Zod şemaları |

**Değiştirilecek dosyalar**

`client/src/main.tsx` · `client/src/index.css` · `client/src/components/layout/AppLayout.tsx` · `client/src/components/layout/Sidebar.tsx` · `client/src/components/layout/MobileBottomNav.tsx` · `client/src/pages/TasksPage.tsx` · `client/src/pages/CaseFormPage.tsx` · `client/src/pages/CaseDetailPage.tsx` · `client/src/pages/CmkAssignmentsPage.tsx` · `client/src/pages/MediationFilesPage.tsx` · `client/src/pages/CollectionsPage.tsx` · `client/src/hooks/useCollections.ts` · `client/src/hooks/useTasks.ts` · `server/src/index.ts` · `server/src/db/schema.ts` · `server/src/db/ensureSchema.ts` · `server/src/routes/collections.ts` · `server/src/routes/tasks.ts` · `shared/src/schemas/task.ts` · `shared/src/schemas/case.ts` · `.github/workflows/keep-alive.yml` · `hukuk-takip/DEPLOYMENT.md`

---

## Ortak Doğrulama Komutları

Her fazın sonunda çalıştırılır (proje kökü: `hukuk-takip/`):

```bash
npm run build --workspace=shared
npx tsc --noEmit -p client/tsconfig.json
npx tsc --noEmit -p server/tsconfig.json
npm run build --workspace=client
```

Beklenen: dördü de hatasız (exit 0).

---

# FAZ 1 — Hız (Madde 7)

Şema değişikliği yok. Amaç: cold start'ı nadir hale getirmek, PWA açılışını anlık göstermek.

---

### Task 1.1: Harici keep-alive kurulumu + workflow notu

**Neden:** Ölçüm, GitHub Actions cron'unun `*/10` yazılmasına rağmen günde 12-16 kez çalıştığını gösterdi (beklenen 144). Gece 3 saatlik boşluklar var. Render 15 dk'da uyuduğu için sunucu zamanın büyük kısmını uykuda geçiriyor.

**Files:**
- Modify: `.github/workflows/keep-alive.yml`
- Modify: `hukuk-takip/DEPLOYMENT.md`

- [ ] **Step 1: Workflow'u yedek katmana indir ve sıklığı artır**

`.github/workflows/keep-alive.yml` içinde `on:` bloğunun üstündeki yorumun sonuna ekle ve cron'u değiştir:

```yaml
# ÖNEMLİ (2026-07-25 ölçümü): GitHub, public repolarda sık zamanlanmış
# workflow'ları agresif şekilde kısıtlıyor. '*/10' yazılmasına rağmen gerçek
# çalışma aralığı ~1 saat, gece 3 saate kadar çıkıyor (günde 144 yerine 12-16
# ping). Bu nedenle BİRİNCİL keep-alive mekanizması cron-job.org'dur;
# bu workflow yalnızca YEDEK katmandır. Kurulum: DEPLOYMENT.md § 8.

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
```

- [ ] **Step 2: DEPLOYMENT.md'ye kurulum bölümü ekle**

`hukuk-takip/DEPLOYMENT.md` dosyasının sonuna ekle:

```markdown
## 8. Keep-alive (cold start çözümü)

Render Free plani 15 dakika hareketsizlikten sonra uyur; uyandiktan sonraki ilk
istek ~22 saniye surer. Avukat uygulamayi sabah ilk actiginda bu bekleme
yasanir.

GitHub Actions cron'u bu is icin yeterli DEGILDIR (olculdu: `*/10` yazilmasina
ragmen gunde 12-16 kez calisiyor, gece 3 saatlik bosluklar oluyor). Birincil
mekanizma harici bir cron servisidir.

### cron-job.org kurulumu (ucretsiz)

1. https://cron-job.org adresinde hesap ac.
2. "Create cronjob" -> Title: `isbu-ofis keep-alive`
3. URL: `https://isbu-ofis-api.onrender.com/api/health`
4. Schedule: "Every 5 minutes"
5. "Advanced" -> Execution window / saat kisitlamasi:
   - Gunler: Pazartesi-Cumartesi
   - Saatler: 06:00 - 21:00 (Europe/Istanbul)
6. Kaydet.

### Neden 7/24 degil, mesai penceresi?

Render Free ayda 750 instance-saat verir. 7/24 ping ~730 saat eder -> kotaya
pay birakmaz ve ikinci bir free servis eklenirse kota asilir. 06:00-21:00 x 26
gun ~= 390 saat -> kota rahat, avukatin fiili kullanim saatleri tam kapsanir.

Mesai disi (gece / Pazar) acilista cold start yine yasanabilir; bu durumda
istemcideki "Sunucu uyandiriliyor..." bildirimi devreye girer.

### Dogrulama

Kurulumdan 30 dakika sonra:

```bash
curl -s -o /dev/null -w "%{time_total}s\n" https://isbu-ofis-api.onrender.com/api/health
```

Beklenen: 1 saniyenin altinda. 20+ saniye cikiyorsa cron calismiyor demektir.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/keep-alive.yml hukuk-takip/DEPLOYMENT.md
git commit -m "perf: keep-alive birincil mekanizmasini harici cron'a tasi

GitHub Actions cron olcumu: */10 yazilmasina ragmen gunde 12-16 ping
(beklenen 144), gece 3 saatlik bosluklar. Workflow yedek katman olarak
kaliyor, cron ifadesi */5'e cekildi. Birincil mekanizma cron-job.org;
kurulum adimlari DEPLOYMENT.md ss 8'de.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Avukata bildir**

Bu görev tamamlandığında avukata cron-job.org kurulumunu yapması söylenir — bu adım repoda kod değil, dış servis ayarıdır. Kurulum yapılmadan Faz 1'in en büyük kazancı devreye girmez.

---

### Task 1.2: IndexedDB persister — PWA açılışında son veriyi anında göster

**Neden:** `main.tsx` şu an yalnızca `['auth']` query'sini kalıcılaştırıyor. Dashboard/görev/dava listeleri her açılışta sıfırdan ağ bekliyor. Beyaz listenin gerekçesi "localStorage senkron yazımı mobilde takılma yaratır" — asenkron IndexedDB persister bu gerekçeyi ortadan kaldırır.

**Files:**
- Create: `client/src/lib/queryPersister.ts`
- Modify: `client/src/main.tsx:26-30` (persister) ve `:63-79` (persistOptions)

- [ ] **Step 1: Bağımlılıkları ekle**

```bash
npm install @tanstack/query-async-storage-persister idb-keyval --workspace=client
```

Beklenen: `client/package.json` dependencies'e iki paket eklenir. `package-lock.json`'a elle dokunulmaz.

- [ ] **Step 2: Persister modülünü oluştur**

`client/src/lib/queryPersister.ts`:

```ts
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import type { Query } from '@tanstack/react-query'

// PWA'da uygulama RAM'den atilip tekrar acildiginda son veriyi ANINDA gosterip
// arka planda yenilemek icin React Query cache'i diske yazilir.
//
// Neden IndexedDB (localStorage degil): localStorage senkron API'dir; buyuk
// liste JSON'larini yazarken ana thread'i bloklar ve mobilde takilma yaratir.
// IndexedDB asenkron oldugu icin bu sorun yoktur — bu yuzden onceki koddaki
// "sadece auth'u sakla" kisitina artik gerek kalmaz.
//
// Gizli sekme / depolama kapali senaryosunda IndexedDB erisilemez olabilir.
// O durumda sessizce devre disi kaliriz: uygulama agdan calismaya devam eder.
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await get<string>(key)
      return value ?? null
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await set(key, value)
    } catch {
      // sessiz gec — kalicilastirma opsiyonel bir hizlandirmadir
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await del(key)
    } catch {
      // sessiz gec
    }
  },
}

export const queryPersister = createAsyncStoragePersister({
  storage: safeStorage,
  key: 'hz-query-cache-idb',
  throttleTime: 1000,
})

// Diske yazilacak query'ler. Buyuk/hassas olmayan, acilista ekrani dolduran
// listeler. Buraya yazilmayan query'ler her acilista agdan gelir.
const PERSISTED_ROOT_KEYS = new Set([
  'auth',
  'dashboard',
  'tasks',
  'cases',
  'clients',
  'notifications',
  'collections',
  'hearings',
])

export function shouldPersistQuery(query: Query): boolean {
  const rootKey = query.queryKey?.[0]
  if (typeof rootKey !== 'string') return false
  if (!PERSISTED_ROOT_KEYS.has(rootKey)) return false
  return query.state.status === 'success'
}
```

- [ ] **Step 3: main.tsx'i yeni persister'a bağla**

`client/src/main.tsx` — mevcut import'lardan `PersistQueryClientProvider` kalır, `createSyncStoragePersister` importu silinir; yerine:

```ts
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryPersister, shouldPersistQuery } from './lib/queryPersister'
```

Mevcut `const persister = createSyncStoragePersister({...})` bloğunu (satır 26-30) tamamen kaldır ve yerine şu tek satırlık temizliği koy:

```ts
// Eski localStorage tabanli cache artik kullanilmiyor; yer kaplamasin.
// Bu yalnizca istemci onbellegidir — kullanici verisi degildir.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('hz-query-cache')
  } catch {}
}
```

`persistOptions`'ı şu şekilde güncelle:

```tsx
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: 1000 * 60 * 60 * 24, // 24 saat sonra at
          buster: CACHE_BUSTER,
          dehydrateOptions: {
            shouldDehydrateQuery: shouldPersistQuery,
          },
        }}
      >
```

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json
npm run build --workspace=client
```

Beklenen: ikisi de hatasız.

- [ ] **Step 5: Tarayıcıda elle doğrula**

`npm run dev` → giriş yap → Dashboard ve Görevler sayfalarını gez → sekmeyi kapat → tekrar aç.
Beklenen: sayfa iskelet göstermeden son veriyle açılır. DevTools → Application → IndexedDB altında `keyval-store` içinde `hz-query-cache-idb` kaydı görünür.

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/src/lib/queryPersister.ts client/src/main.tsx
git commit -m "perf: React Query cache'ini IndexedDB'ye kalicilastir

Onceki kod yalnizca auth query'sini localStorage'a yaziyordu; dashboard,
gorev, dava listeleri her PWA acilisinda sifirdan ag bekliyordu. Asenkron
IndexedDB persister ana thread'i bloklamadigi icin beyaz liste genisletildi
(auth, dashboard, tasks, cases, clients, notifications, collections,
hearings). IndexedDB erisilemezse sessizce devre disi kalir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Arka plan yenileme çizgisi (iskelet yerine)

**Files:**
- Create: `client/src/components/shared/RefreshBar.tsx`
- Modify: `client/src/index.css` (keyframe)
- Modify: `client/src/components/layout/AppLayout.tsx` (bileşeni yerleştir)

- [ ] **Step 1: Keyframe ekle**

`client/src/index.css` dosyasının sonuna:

```css
@keyframes hz-refresh-slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
```

- [ ] **Step 2: RefreshBar bileşenini yaz**

`client/src/components/shared/RefreshBar.tsx`:

```tsx
import { useIsFetching } from '@tanstack/react-query'

/**
 * Cache'te veri varken tam sayfa iskeleti basmak yerine veriyi gosterip
 * yenilemeyi ustteki ince cizgiyle bildiririz. "Sekmeye basinca bekliyor"
 * hissini ortadan kaldirir.
 */
export default function RefreshBar() {
  const fetching = useIsFetching()
  if (fetching === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="h-full w-1/4 bg-law-accent"
        style={{ animation: 'hz-refresh-slide 1.1s ease-in-out infinite' }}
      />
    </div>
  )
}
```

- [ ] **Step 3: AppLayout'a yerleştir**

`client/src/components/layout/AppLayout.tsx` — import ekle ve döndürülen JSX'in en dış sarmalayıcısının ilk çocuğu olarak `<RefreshBar />` koy:

```tsx
import RefreshBar from '@/components/shared/RefreshBar'
```

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json
```

Beklenen: hatasız. `npm run dev` ile sekmeler arasında gezinirken üstte ince mavi çizginin kısa süre göründüğü gözle doğrulanır.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/shared/RefreshBar.tsx client/src/index.css client/src/components/layout/AppLayout.tsx
git commit -m "perf: arka plan yenilemesi icin ince ilerleme cizgisi

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Dokunmada rota chunk'ı ön yükleme

**Neden:** Sidebar ve alt menüde **veri** prefetch'i zaten var (`Sidebar.tsx:35-47`, `MobileBottomNav.tsx:78-80`). Eksik olan, rotanın lazy JS chunk'ı — mobilde tıkladıktan sonraki beklemenin kalan kısmı bu.

**Files:**
- Create: `client/src/lib/routeChunks.ts`
- Modify: `client/src/components/layout/Sidebar.tsx`
- Modify: `client/src/components/layout/MobileBottomNav.tsx`

- [ ] **Step 1: Chunk eşlemesini yaz**

`client/src/lib/routeChunks.ts`:

```ts
// Rota -> lazy chunk yukleyici. Menude hover/dokunma aninda chunk indirilir,
// tiklamada JS beklemesi kalmaz. Vite ayni modulu dedupe eder; ek chunk
// uretmez. App.tsx'teki lazy() cagrilariyla ayni yollari kullanmak sart.
const routeChunkLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/clients': () => import('../pages/ClientsPage'),
  '/cases': () => import('../pages/CasesPage'),
  '/cmk': () => import('../pages/CmkAssignmentsPage'),
  '/tools/mediation-files': () => import('../pages/MediationFilesPage'),
  '/hearings': () => import('../pages/HearingsPage'),
  '/tasks': () => import('../pages/TasksPage'),
  '/sureli-isler': () => import('../pages/LegalDeadlinesPage'),
  '/consultations': () => import('../pages/ConsultationsPage'),
  '/collections': () => import('../pages/CollectionsPage'),
  '/calendar': () => import('../pages/CalendarPage'),
  '/notifications': () => import('../pages/NotificationsPage'),
  '/statistics': () => import('../pages/StatisticsPage'),
  '/settings': () => import('../pages/SettingsPage'),
  '/tools/calculations': () => import('../pages/CalculationsPage'),
  '/tools/inheritance': () => import('../pages/InheritancePage'),
  '/tools/sentence': () => import('../pages/SentenceCalcPage'),
}

const warmed = new Set<string>()

export function prefetchRouteChunk(path: string): void {
  if (warmed.has(path)) return
  const loader = routeChunkLoaders[path]
  if (!loader) return
  warmed.add(path)
  void loader().catch(() => {
    warmed.delete(path)
  })
}
```

- [ ] **Step 2: Sidebar'da chunk prefetch'i bağla**

`client/src/components/layout/Sidebar.tsx` — import ekle:

```ts
import { prefetchRouteChunk } from '@/lib/routeChunks'
```

`navItems.map` içindeki `onPrefetch` prop'unu, prefetch meta'sı olmayan öğelerde de chunk ısıtacak şekilde değiştir (satır 171):

```tsx
              onPrefetch={() => {
                prefetchRouteChunk(item.to)
                if (item.prefetch) prefetch(item.prefetch)
              }}
```

`toolItems.map` içindeki `SidebarLink`'e de ekle (satır 181):

```tsx
              <SidebarLink
                key={to}
                to={to}
                label={label}
                Icon={Icon}
                onClick={onClose}
                onPrefetch={() => prefetchRouteChunk(to)}
              />
```

- [ ] **Step 3: MobileBottomNav'da chunk prefetch'i bağla**

`client/src/components/layout/MobileBottomNav.tsx` — import ekle:

```ts
import { prefetchRouteChunk } from '@/lib/routeChunks'
```

`onTouchStart` handler'ını değiştir (satır 78-80):

```tsx
            onTouchStart={() => {
              prefetchRouteChunk(to)
              if (prefetchInfo) prefetch(prefetchInfo.queryKey, prefetchInfo.url)
            }}
```

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json
npm run build --workspace=client
```

Beklenen: hatasız. `npm run dev` → DevTools Network sekmesi → menü öğesinin üzerine gelince ilgili chunk'ın (`.js`) indiğinin gözlenmesi.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/routeChunks.ts client/src/components/layout/Sidebar.tsx client/src/components/layout/MobileBottomNav.tsx
git commit -m "perf: menude dokunma/hover aninda rota chunk'ini on yukle

Veri prefetch'i zaten vardi; eksik olan lazy JS chunk'iydi. Mobilde
tiklamadan sonraki chunk indirme beklemesi kalkiyor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.5: Derin health endpoint'i (Neon'u da uyandır)

**Neden:** `main.tsx` açılışta `/api/health`'e ping atıyor ama bu endpoint DB'ye dokunmuyor; Neon uykuda kalıyor ve ilk gerçek sorgu Neon uyanmasını da bekliyor.

**Files:**
- Modify: `server/src/index.ts:105-107` (health endpoint)
- Modify: `client/src/main.tsx:19-21` (açılış ping'i)

- [ ] **Step 1: Sunucuda deep varyantını ekle**

`server/src/index.ts` — üstteki import bloğuna ekle:

```ts
import { sql } from 'drizzle-orm'
import { db } from './db/index.js'
```

Mevcut health endpoint'ini değiştir:

```ts
// /api/health          -> sade, DB'ye dokunmaz. Render healthCheck ve harici
//                         keep-alive cron'u bunu kullanir (Neon compute saatini
//                         5 dakikada bir yakmamak icin bilincli tercih).
// /api/health?deep=1   -> tek SELECT 1 ile Neon'u da uyandirir. YALNIZCA
//                         istemcinin acilis ping'i kullanir.
app.get('/api/health', async (req, res) => {
  const timestamp = new Date().toISOString()

  if (req.query.deep !== '1') {
    res.json({ status: 'ok', timestamp })
    return
  }

  try {
    await db.execute(sql`select 1`)
    res.json({ status: 'ok', db: 'ok', timestamp })
  } catch {
    // Isinma amacli bir istek; DB hatasi saglik kontrolunu dusurmemeli.
    res.json({ status: 'ok', db: 'error', timestamp })
  }
})
```

- [ ] **Step 2: İstemci açılış ping'ini deep'e çevir**

`client/src/main.tsx` satır 20'yi değiştir:

```ts
  void fetch(`${wakeApiBase}/health?deep=1`, { cache: 'no-store' }).catch(() => {})
```

- [ ] **Step 3: Doğrula**

```bash
npx tsc --noEmit -p server/tsconfig.json
npx tsc --noEmit -p client/tsconfig.json
```

Beklenen: hatasız.

Sunucu çalışırken:

```bash
curl -s "http://localhost:3001/api/health"        # {"status":"ok","timestamp":...}
curl -s "http://localhost:3001/api/health?deep=1" # {"status":"ok","db":"ok","timestamp":...}
```

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts client/src/main.tsx
git commit -m "perf: /api/health?deep=1 ile acilista Neon'u da uyandir

Sade /api/health DB'ye dokunmaz (Render healthCheck + harici cron bunu
kullanir). deep=1 varyanti tek SELECT 1 calistirir ve yalnizca istemcinin
acilis ping'i tarafindan cagrilir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.6: Yavaş istek ölçümü

**Files:**
- Create: `server/src/middleware/requestTiming.ts`
- Modify: `server/src/index.ts` (middleware'i bağla)

- [ ] **Step 1: Middleware'i yaz**

`server/src/middleware/requestTiming.ts`:

```ts
import type { Request, Response, NextFunction } from 'express'

// Yavas istekleri gorunur kilar. Amac: "hizlandi" iddiasini sayi ile
// destekleyebilmek ve regresyonu erken yakalamak. Sadece esigi asanlar
// loglanir; normal trafikte gurultu yapmaz.
const SLOW_REQUEST_MS = 500

export function requestTiming(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
    if (durationMs >= SLOW_REQUEST_MS) {
      console.log(
        `[slow] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(0)}ms`
      )
    }
  })

  next()
}
```

- [ ] **Step 2: index.ts'e bağla**

`server/src/index.ts` — import ekle:

```ts
import { requestTiming } from './middleware/requestTiming.js'
```

`app.use(compression({ threshold: 1024 }))` satırının hemen ALTINA ekle:

```ts
app.use(requestTiming)
```

- [ ] **Step 3: Doğrula**

```bash
npx tsc --noEmit -p server/tsconfig.json
```

Beklenen: hatasız.

- [ ] **Step 4: Commit**

```bash
git add server/src/middleware/requestTiming.ts server/src/index.ts
git commit -m "perf: 500ms ustu istekler icin yavas istek logu

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.7: Faz 1 doğrulama

- [ ] **Step 1: Tam derleme**

```bash
npm run build --workspace=shared && npx tsc --noEmit -p client/tsconfig.json && npx tsc --noEmit -p server/tsconfig.json && npm run build --workspace=client
```

Beklenen: hepsi exit 0.

- [ ] **Step 2: Deploy sonrası ölçüm**

Deploy edildikten ve cron-job.org kurulduktan 30 dk sonra:

```bash
curl -s -o /dev/null -w "%{time_total}s\n" https://isbu-ofis-api.onrender.com/api/health
```

Beklenen: < 1 sn. Kayıt altına al (öncesi: uyanıkken 0,29 sn / uykudan 21,8 sn).

---

# FAZ 2 — Tek Dokunuşluk Düzeltmeler (Madde 2, 4, 5, 8a)

Şema değişikliği yok.

---

### Task 2.1: Tahsilat sıralaması düzeltmesi (Madde 8a)

**Neden:** Liste `createdAt`'e göre sıralı. Geçmiş tarihli bir tahsilatı bugün girince listenin başına çıkıyor — avukat "en son yapılan tahsilat en başta olsun" diyor, kastettiği tahsilat tarihi.

**Files:**
- Modify: `server/src/routes/collections.ts:74`

- [ ] **Step 1: orderBy'ı değiştir**

Satır 74'teki

```ts
    .orderBy(desc(collections.createdAt))
```

satırını şununla değiştir:

```ts
    // Avukatin bekledigi sira: tahsilatin YAPILDIGI tarih (collection_date).
    // createdAt yalnizca kaydin girildigi an — gecmis tarihli bir tahsilati
    // bugun girince listenin basina cikiyordu. createdAt ikincil kriter olarak
    // ayni gun icinde girilen kayitlarin sirasini korur.
    .orderBy(desc(collections.collectionDate), desc(collections.createdAt))
```

- [ ] **Step 2: Doğrula**

```bash
npx tsc --noEmit -p server/tsconfig.json
```

Beklenen: hatasız. `collections.collectionDate` `server/src/db/schema.ts:288`'de tanımlı.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/collections.ts
git commit -m "fix: tahsilatlari kayit tarihine degil tahsilat tarihine gore sirala

Gecmis tarihli bir tahsilat bugun girildiginde listenin basina cikiyordu.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: Arabuluculuk toplam dosya sayısı (Madde 2)

**Files:**
- Modify: `client/src/pages/MediationFilesPage.tsx:136-139`

- [ ] **Step 1: Başlık altını sayaçlı hale getir**

Mevcut:

```tsx
          <h1 className="page-title">Arabuluculuk Dosyalari</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arabuluculuk dosya takibi ve taraf kayitlari
          </p>
```

Yerine (Davalar ve CMK sayfalarındaki ifade kalıbının aynısı):

```tsx
          <h1 className="page-title">Arabuluculuk Dosyaları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalFiles > 0
              ? `${totalFiles} arabuluculuk dosyası kayıtlı`
              : 'Arabuluculuk dosya takibi ve taraf kayıtları'}
          </p>
```

Bileşenin içinde, listenin türetildiği yerin hemen altına ekle:

```tsx
  const totalFiles = Array.isArray(files) ? files.length : 0
```

> Not: `useMediationFiles` endpoint'i dizi döner (`total` alanı yok), bu yüzden sayı istemci tarafında hesaplanır. Değişkenin adı listenin mevcut adına göre uyarlanır — dosyada listeyi tutan değişkeni bulup onu kullan.

- [ ] **Step 2: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json
```

Beklenen: hatasız.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/MediationFilesPage.tsx
git commit -m "feat: arabuluculuk sayfasinda toplam dosya sayisini goster

Davalar ve CMK sayfalarindaki ifade kalibiyla ayni.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: CMK eklenme tarihi kolonu (Madde 5)

**Neden:** CMK listesinde dosyanın ne zaman eklendiği görünmüyor. `createdAt` liste endpoint'inde zaten dönüyor (`server/src/routes/cases.ts:204`) — sunucuda değişiklik gerekmez.

**Files:**
- Modify: `client/src/pages/CmkAssignmentsPage.tsx`

- [ ] **Step 1: formatDate'i içe aktar**

Satır 19'daki import'u genişlet:

```ts
import { caseStatusLabels, formatCurrency, formatDate } from '@/lib/utils'
```

- [ ] **Step 2: Tablo başlığına kolon ekle**

`<thead>` içinde "Esas No" `<th>`'sinin hemen ardına ekle:

```tsx
                    <th className="hidden pb-2 pr-3 lg:table-cell">Eklenme</th>
```

- [ ] **Step 3: Tablo satırına hücre ekle**

`<tbody>` içinde `caseNumber` `<td>`'sinin hemen ardına ekle:

```tsx
                      <td className="hidden py-3 pr-3 text-muted-foreground lg:table-cell">
                        {row.createdAt ? formatDate(row.createdAt) : '-'}
                      </td>
```

Ayrıca mobil görünümde de görünsün diye, "Dosya" hücresindeki mobil alt satırı genişlet:

```tsx
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {row.clientName || '-'}
                            {row.createdAt ? ` · ${formatDate(row.createdAt)}` : ''}
                          </span>
```

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json
```

Beklenen: hatasız. `formatDate` `client/src/lib/utils.ts`'de mevcut (CollectionsPage kullanıyor).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/CmkAssignmentsPage.tsx
git commit -m "feat: CMK listesine eklenme tarihi kolonu

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.4: Faz 2 doğrulama ve elle kontrol

- [ ] **Step 1: Derleme**

```bash
npx tsc --noEmit -p client/tsconfig.json && npx tsc --noEmit -p server/tsconfig.json
```

- [ ] **Step 2: Elle doğrula**

`npm run dev` ile:
- Tahsilatlar sayfası: en üstteki kaydın **tahsilat tarihi** en yeni olmalı.
- Arabuluculuk Dosyaları: başlık altında "N arabuluculuk dosyası kayıtlı".
- CMK Görevlendirmeleri: geniş ekranda "Eklenme" kolonu, dar ekranda müvekkil adının yanında tarih.

---

# FAZ 3 — Görevler Ekranı (Madde 3, 9, 1)

Tek `ADD COLUMN` içerir. **Başlamadan önce yedek zorunlu.**

---

### Task 3.0: Yedek al (ZORUNLU — atlanamaz)

**Files:**
- Create: `hukuk-takip/backups/<tarih>-faz3-oncesi.sql`
- Modify: `hukuk-takip/backups/README.md`

- [ ] **Step 1: pg_dump yedeği al**

```bash
cd hukuk-takip
pg_dump "$DATABASE_URL_MIGRATION" --no-owner --no-privileges -f "backups/2026-07-25-faz3-oncesi.sql"
```

Beklenen: dosya oluşur ve boyutu 0'dan büyüktür. Doğrula:

```bash
ls -la backups/2026-07-25-faz3-oncesi.sql
grep -c "CREATE TABLE" backups/2026-07-25-faz3-oncesi.sql
```

Beklenen: satır sayısı 10'dan büyük (tüm tablolar yedekte).

- [ ] **Step 2: backups/README.md'ye not düş**

```markdown
## 2026-07-25 — Faz 3 öncesi (tasks.category)

- Dosya: `2026-07-25-faz3-oncesi.sql`
- Sebep: `ensureSchema.ts` REV11 — `tasks` tablosuna `category varchar(20)` eklenecek.
- İşlem tipi: ADDITIVE (`ADD COLUMN IF NOT EXISTS`). Backfill yok, DROP yok.
- Geri alma: Kolon boş kalır; kod kolonu kullanmayı bırakırsa veri kaybı olmaz.
- Neon PITR: bu tarihten geriye 7 gün pencere mevcut.
```

- [ ] **Step 3: Neon PITR penceresini teyit et**

Neon dashboard → Branches → "Restore to point before..." penceresinin bugünü kapsadığını gözle doğrula. Kapsamıyorsa DURDUR ve avukata bildir.

- [ ] **Step 4: Commit**

```bash
git add backups/README.md
git commit -m "chore: Faz 3 oncesi yedek notu (tasks.category)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

> `backups/*.sql` dosyası `.gitignore`'da ise commit edilmez — yalnızca README notu commit edilir. `.gitignore`'da değilse ve dosya büyükse repoya ekleme, yerelde tut.

---

### Task 3.1: `tasks.category` kolonu — şema, tip, endpoint

**Files:**
- Modify: `server/src/db/ensureSchema.ts` (yeni REV11 bloğu + runner çağrısı)
- Modify: `server/src/db/schema.ts:219` civarı (tasks tablosu)
- Modify: `shared/src/schemas/task.ts`
- Modify: `server/src/routes/tasks.ts` (select kolonları, POST, PUT)

- [ ] **Step 1: ensureSchema'ya REV11 bloğunu ekle**

`server/src/db/ensureSchema.ts` — `REV10_PERF_INDEXES_SQL` tanımının hemen ardına ekle:

```ts
// rev11 (2026-07): Görev kategorisi. Görevler artık "Dava / CMK / Arabuluculuk /
// Genel" olarak etiketlenebilir; listede renkli rozet ve filtre olarak görünür.
// TAM ADDITIVE: nullable kolon eklenir, hiçbir satır güncellenmez. Mevcut
// görevler category=NULL kalır ve rozet göstermez (ya da caseId üzerinden
// türetilir). Backfill YAPILMAZ.
const REV11_TASK_CATEGORY_SQL = `
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "category" varchar(20);
CREATE INDEX IF NOT EXISTS "tasks_user_category_idx" ON "tasks" ("user_id", "category");
`
```

`ensureSchema()` fonksiyonu içinde, `REV10` çağrısının ardına ekle:

```ts
    await sql.unsafe(REV11_TASK_CATEGORY_SQL)
    console.log('Schema guard: tasks.category hazir.')
```

- [ ] **Step 2: Drizzle şemasına kolonu ekle**

`server/src/db/schema.ts` — `tasks` tablosunda `label` satırının hemen altına:

```ts
    // Görev kategorisi: 'dava' | 'cmk' | 'arabuluculuk' | 'genel'
    // Nullable — eski görevler NULL kalır, backfill yapılmaz.
    category: varchar('category', { length: 20 }),
```

Tablo tanımının index bloğuna ekle:

```ts
    userCategoryIdx: index('tasks_user_category_idx').on(table.userId, table.category),
```

- [ ] **Step 3: Ortak Zod şemasına ekle**

`shared/src/schemas/task.ts` — dosyanın üstüne, `taskPriorityValues` tanımının ardına:

```ts
export const taskCategoryValues = ['dava', 'cmk', 'arabuluculuk', 'genel'] as const
export type TaskCategory = (typeof taskCategoryValues)[number]
```

`createTaskSchema` içinde `label` alanının hemen altına:

```ts
  category: z.enum(taskCategoryValues).optional().or(z.literal('')),
```

- [ ] **Step 4: Sunucu route'una ekle**

`server/src/routes/tasks.ts`:

1. `taskSelectColumns` içinde `label: tasks.label,` satırının altına:

```ts
  category: tasks.category,
```

Ayrıca `caseTitle: cases.title,` satırının altına ekle — eski (kategorisiz) görevlerin rozeti bağlı davadan türetilecek, bunun için davanın CMK olup olmadığı gerekiyor:

```ts
  caseIsCmk: cases.isCmkAssignment,
```

2. `router.post('/')` içinde destructure listesine `category` ekle ve insert değerlerinde `label: label || null,` satırının altına:

```ts
      category: category || null,
```

3. `router.put('/:id')` içinde, güncelleme payload'ı `label` alanını nasıl işliyorsa `category` de birebir aynı şekilde işlenir (tanımlıysa `|| null` ile yazılır, tanımsızsa dokunulmaz).

- [ ] **Step 5: Doğrula**

```bash
npm run build --workspace=shared
npx tsc --noEmit -p server/tsconfig.json
```

Beklenen: hatasız.

Yerel sunucuyu başlat ve log satırını gör:

```bash
npm run dev --workspace=server
```

Beklenen çıktı içinde: `Schema guard: tasks.category hazir.`

Kolonun gerçekten eklendiğini doğrula:

```bash
psql "$DATABASE_URL_MIGRATION" -c "\d tasks" | grep category
```

Beklenen: `category | character varying(20)` satırı.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/ensureSchema.ts server/src/db/schema.ts shared/src/schemas/task.ts server/src/routes/tasks.ts
git commit -m "feat: gorev kategorisi kolonu (dava/cmk/arabuluculuk/genel)

ensureSchema REV11 ile additive ADD COLUMN IF NOT EXISTS. Backfill yok,
mevcut gorevler NULL kalir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.2: Test altyapısı + saf yardımcı modüller

**Neden test:** Mükerrer başlık tespiti (Türkçe normalizasyon) ve ilerleyen fazdaki taksit bölme (para, yuvarlama) saf hesap fonksiyonlarıdır ve yanlış olursa sessizce yanlış sonuç üretirler. Yalnızca bu tür fonksiyonlar test edilir; UI için elle doğrulama yapılır.

**Files:**
- Modify: `client/package.json` (vitest)
- Create: `client/vitest.config.ts`
- Create: `client/src/lib/textSearch.ts`
- Create: `client/src/lib/textSearch.test.ts`
- Create: `client/src/lib/taskCategory.ts`

- [ ] **Step 1: Vitest'i ekle**

```bash
npm install -D vitest --workspace=client
```

`client/package.json` scripts bölümüne ekle:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Vitest yapılandırması**

`client/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

// Yalnizca saf yardimci fonksiyonlar test edilir (para hesabi, metin
// normalizasyonu). UI bilesenleri icin test altyapisi kurulmadi — bunlar
// elle dogrulanir.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Başarısız testi yaz**

`client/src/lib/textSearch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeTr, findDuplicateTitle } from './textSearch'

describe('normalizeTr', () => {
  it('Turkce buyuk I ve i harflerini dogru kucultur', () => {
    expect(normalizeTr('İSTİNAF')).toBe('istinaf')
    expect(normalizeTr('Istinaf')).toBe('ıstinaf')
  })

  it('bastaki/sondaki bosluklari ve coklu bosluklari sadelestirir', () => {
    expect(normalizeTr('  dilekçe   yaz  ')).toBe('dilekçe yaz')
  })

  it('bos ve tanimsiz degerlerde bos string doner', () => {
    expect(normalizeTr('')).toBe('')
    expect(normalizeTr(undefined)).toBe('')
    expect(normalizeTr(null)).toBe('')
  })
})

describe('findDuplicateTitle', () => {
  const tasks = [
    { id: '1', title: 'Dilekçe Yaz' },
    { id: '2', title: 'Duruşmaya git' },
  ]

  it('buyuk/kucuk harf farkina ragmen mukerrer bulur', () => {
    expect(findDuplicateTitle('dilekçe yaz', tasks)?.id).toBe('1')
  })

  it('fazladan bosluklari yok sayar', () => {
    expect(findDuplicateTitle('  Dilekçe   Yaz ', tasks)?.id).toBe('1')
  })

  it('farkli baslikta null doner', () => {
    expect(findDuplicateTitle('Temyiz hazirla', tasks)).toBeNull()
  })

  it('2 karakterden kisa girdide null doner (erken yazim gurultusu)', () => {
    expect(findDuplicateTitle('d', tasks)).toBeNull()
  })

  it('kendi kaydini mukerrer saymaz (duzenleme senaryosu)', () => {
    expect(findDuplicateTitle('Dilekçe Yaz', tasks, '1')).toBeNull()
  })
})
```

- [ ] **Step 4: Testi çalıştır, başarısız olduğunu gör**

```bash
npm run test --workspace=client
```

Beklenen: FAIL — `Failed to resolve import "./textSearch"` veya benzeri.

- [ ] **Step 5: Modülü yaz**

`client/src/lib/textSearch.ts`:

```ts
/**
 * Turkce duyarli metin normalizasyonu.
 *
 * Neden ozel: JS'in varsayilan toLowerCase()'i 'I' harfini 'i' yapar; Turkce'de
 * 'I' -> 'ı' ve 'İ' -> 'i' olmalidir. Arama ve mukerrer tespitinde bu fark
 * yanlis sonuca yol acar.
 */
export function normalizeTr(value: string | null | undefined): string {
  if (!value) return ''
  return value.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()
}

/** Verilen metnin, alanlardan herhangi birinde gecip gecmedigi. */
export function matchesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const q = normalizeTr(query)
  if (!q) return true
  const haystack = normalizeTr(fields.filter(Boolean).join(' '))
  return haystack.includes(q)
}

/**
 * Ayni baslikta zaten kayitli bir gorev var mi?
 * Avukat ayni gorevi yanlislikla iki kez giriyor; form icinde uyarmak icin.
 *
 * - 2 karakterden kisa girdide null doner (yazmaya baslarken gurultu olmasin).
 * - excludeId verilirse o kayit atlanir (duzenleme sirasinda kendini mukerrer
 *   saymamasi icin).
 */
export function findDuplicateTitle<T extends { id: string; title: string }>(
  title: string,
  items: T[],
  excludeId?: string
): T | null {
  const normalized = normalizeTr(title)
  if (normalized.length < 2) return null
  return (
    items.find((item) => item.id !== excludeId && normalizeTr(item.title) === normalized) ?? null
  )
}
```

- [ ] **Step 6: Testi çalıştır, geçtiğini gör**

```bash
npm run test --workspace=client
```

Beklenen: PASS — 8 test geçer.

- [ ] **Step 7: Kategori yardımcı modülünü yaz**

`client/src/lib/taskCategory.ts`:

```ts
import { taskCategoryValues, type TaskCategory } from '@hukuk-takip/shared'

export const taskCategoryLabels: Record<TaskCategory, string> = {
  dava: 'Dava',
  cmk: 'CMK',
  arabuluculuk: 'Arabuluculuk',
  genel: 'Genel',
}

// Rozet renkleri. Tahsilatlar sayfasindaki kaynak renkleriyle tutarli:
// dava = law-accent (mavi), cmk = indigo, arabuluculuk = turuncu.
export const taskCategoryBadgeClass: Record<TaskCategory, string> = {
  dava: 'bg-law-accent/10 text-law-accent',
  cmk: 'bg-indigo-100 text-indigo-700',
  arabuluculuk: 'bg-orange-100 text-orange-700',
  genel: 'bg-muted text-muted-foreground',
}

export const taskCategoryOptions = taskCategoryValues.map((value) => ({
  value,
  label: taskCategoryLabels[value],
}))

/**
 * Eski gorevlerde category NULL. Mumkunse bagli davadan turet:
 * CMK davasina bagliysa 'cmk', normal davaya bagliysa 'dava'.
 * Turetilemezse null doner ve rozet gosterilmez — uydurma etiket basmayiz.
 */
export function resolveTaskCategory(task: {
  category?: string | null
  caseId?: string | null
  caseIsCmk?: boolean | null
}): TaskCategory | null {
  if (task.category && (taskCategoryValues as readonly string[]).includes(task.category)) {
    return task.category as TaskCategory
  }
  if (task.caseId) return task.caseIsCmk ? 'cmk' : 'dava'
  return null
}
```

- [ ] **Step 8: Doğrula ve commit**

```bash
npm run test --workspace=client && npx tsc --noEmit -p client/tsconfig.json
```

Beklenen: testler geçer, tip hatası yok.

```bash
git add client/package.json client/vitest.config.ts client/src/lib/textSearch.ts client/src/lib/textSearch.test.ts client/src/lib/taskCategory.ts
git commit -m "feat: Turkce metin normalizasyonu + mukerrer baslik tespiti + gorev kategori yardimcilari

Vitest yalnizca saf hesap/metin fonksiyonlari icin eklendi (UI elle
dogrulanir). Turkce I/i kucultme farki test altina alindi.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: TasksPage'i bileşenlere ayır (davranış değişikliği YOK)

**Neden:** `TasksPage.tsx` 548 satır; bu fazın özellikleri eklenince 800+ satıra çıkar (proje kuralı: 800 max). Ayrıca ekleme ve düzenleme formu bugün iki ayrı kopya — kategori/arama eklerken iki yerde aynı işi yapmak hata kaynağı olur.

**Files:**
- Create: `client/src/components/tasks/TaskForm.tsx`
- Create: `client/src/components/tasks/TaskRow.tsx`
- Modify: `client/src/pages/TasksPage.tsx`

- [ ] **Step 1: TaskForm'u çıkar**

`client/src/components/tasks/TaskForm.tsx` oluştur. Bu bileşen hem ekleme hem düzenleme için kullanılır:

- Props: `{ mode: 'create' | 'edit', task?: any, casesList: any[], existingTasks: {id: string; title: string}[], onDone: () => void }`
- `mode === 'create'` ise `useCreateTask`, `edit` ise `useUpdateTask(task.id)` kullanır.
- `mode === 'edit'` iken ayrıca "Durum" alanı gösterir (mevcut `EditTaskForm` davranışı).
- Alanlar mevcut iki formun birleşimidir: Başlık, İlgili Dava, Öncelik, Son Tarih, Açıklama, Kategori/Etiket, (edit'te) Durum.
- Mevcut `TasksPage.tsx:56-186` içindeki `EditTaskForm` ve `TasksPage.tsx:262-353` içindeki ekleme formu bu bileşene taşınır; **bu adımda yeni alan eklenmez**, yalnızca birleştirme yapılır.

- [ ] **Step 2: TaskRow'u çıkar**

`client/src/components/tasks/TaskRow.tsx` oluştur. `TasksPage.tsx:445-540` arasındaki `<Card>` render'ı buraya taşınır.

- Props: `{ task: any, onToggleComplete: (task: any) => void, onEdit: (id: string) => void, onDelete: (id: string) => void }`
- Bu adımda görsel değişiklik yapılmaz.

- [ ] **Step 3: TasksPage'i orchestrator'a indir**

`TasksPage.tsx` artık yalnızca: state (filtreler, form açık/kapalı, düzenlenen id), veri çekme, ve `TaskForm` / `TaskRow` bileşenlerini yerleştirme işini yapar.

- [ ] **Step 4: Doğrula — davranış aynı olmalı**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile elle kontrol listesi:
- Yeni görev ekleme çalışıyor
- Görev düzenleme çalışıyor (durum alanı görünüyor)
- Tamamla/geri al butonu çalışıyor
- Silme onayı çıkıyor ve siliyor
- Filtreler (durum/öncelik) çalışıyor

- [ ] **Step 5: Commit**

```bash
git add client/src/components/tasks/ client/src/pages/TasksPage.tsx
git commit -m "refactor: TasksPage'i TaskForm ve TaskRow bilesenlerine ayir

Ekleme ve duzenleme formu tek kaynakta birlesti (onceden iki kopyaydi).
Davranis degisikligi yok — yeni ozellikler kucuk dosyalara eklenebilsin diye.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.4: Arama, sayaç ve mükerrer uyarısı (Madde 3 + 4)

**Files:**
- Modify: `client/src/pages/TasksPage.tsx`
- Modify: `client/src/components/tasks/TaskForm.tsx`

- [ ] **Step 1: TasksPage'e arama kutusu ve filtre ekle**

Import ekle:

```ts
import { Search, X } from 'lucide-react'
import { matchesQuery } from '@/lib/textSearch'
```

State ekle:

```tsx
  const [query, setQuery] = useState('')
```

`tasks` türetildikten sonra filtrelenmiş listeyi hesapla:

```tsx
  // Arama istemci tarafinda: liste zaten tek istekte geliyor, sunucuya
  // gitmeden aninda filtrelenir.
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task: any) =>
        matchesQuery(query, [task.title, task.description, task.label, task.caseTitle])
      ),
    [tasks, query]
  )
```

Filtre satırının içine arama kutusunu ekle:

```tsx
        <div className="relative col-span-2 sm:col-span-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Görev, açıklama, etiket, dava ara…"
            className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-9 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Aramayı temizle"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
```

Listeyi render eden yerde `tasks.map` yerine `filteredTasks.map` kullan; boş durum kontrolü de `filteredTasks.length === 0` olur.

- [ ] **Step 2: Sayacı başlığa ekle (Madde 4)**

Başlıktaki açıklama satırını değiştir:

```tsx
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length === 0
              ? 'Tüm görevlerinizi yönetin'
              : filteredTasks.length === tasks.length
              ? `${tasks.length} görev · ${openCount} tamamlanmadı`
              : `${filteredTasks.length} / ${tasks.length} görev gösteriliyor`}
          </p>
```

`openCount`'u hesapla:

```tsx
  const openCount = useMemo(
    () => tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').length,
    [tasks]
  )
```

- [ ] **Step 3: TaskForm'a mükerrer uyarısı ekle**

`TaskForm.tsx` içinde import:

```ts
import { findDuplicateTitle } from '@/lib/textSearch'
import { AlertTriangle } from 'lucide-react'
```

Başlık alanını izle ve uyarıyı hesapla:

```tsx
  const watchedTitle = watch('title') || ''
  const duplicate = findDuplicateTitle(
    watchedTitle,
    existingTasks,
    mode === 'edit' ? task?.id : undefined
  )
```

Başlık input'unun hemen altına (hata mesajının ardına) ekle:

```tsx
          {duplicate && (
            <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Bu başlıkta bir görev zaten var: <strong>{duplicate.title}</strong>. Yine de
                eklemek istiyorsan devam edebilirsin.
              </span>
            </p>
          )}
```

> Uyarı engellemez — avukat bilerek benzer görev ekleyebilir.

`TasksPage`, `TaskForm`'a `existingTasks={tasks.map((t: any) => ({ id: t.id, title: t.title }))}` geçer.

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile:
- Arama kutusuna yazınca liste anında daralır
- Başlıkta `12 görev · 5 tamamlanmadı`, arama yapınca `3 / 12 görev gösteriliyor`
- Var olan bir görev başlığını yeni görev formuna yazınca sarı uyarı çıkar
- Düzenleme modunda kendi başlığı uyarı üretmez

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TasksPage.tsx client/src/components/tasks/TaskForm.tsx
git commit -m "feat: gorevlerde arama, sayac ve mukerrer baslik uyarisi

Arama istemci tarafinda (liste zaten tek istekte geliyor). Mukerrer uyarisi
engellemez, yalnizca bildirir — ayni gorevi iki kez yazma sorununa karsi.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.5: Kategori seçici, rozet ve filtre (Madde 9)

**Files:**
- Modify: `client/src/components/tasks/TaskForm.tsx`
- Modify: `client/src/components/tasks/TaskRow.tsx`
- Modify: `client/src/pages/TasksPage.tsx`

- [ ] **Step 1: TaskForm'a kategori seçici ekle**

Import:

```ts
import { taskCategoryOptions } from '@/lib/taskCategory'
```

`defaultValues`'a `category: task?.category || 'genel'` ekle.

Başlık alanının hemen altına segment seçiciyi koy:

```tsx
          <div>
            <label className="mb-1.5 block text-sm font-medium">İlgili Kayıt Türü</label>
            <div className="flex flex-wrap gap-1.5">
              {taskCategoryOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedCategory === opt.value
                      ? 'border-law-accent bg-law-accent text-white'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...register('category')}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
```

`const selectedCategory = watch('category')` ekle.

- [ ] **Step 2: Dava seçicisini kategoriye göre besle**

`TaskForm` iki liste alır: `casesList` (normal davalar) ve `cmkList` (CMK dosyaları).

Dava seçicisi yalnızca `dava` veya `cmk` seçiliyken görünür:

```tsx
          {(selectedCategory === 'dava' || selectedCategory === 'cmk') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {selectedCategory === 'cmk' ? 'İlgili CMK Dosyası' : 'İlgili Dava'}
              </label>
              <div className="flex gap-2">
                <select
                  {...register('caseId')}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                >
                  <option value="">Seçilmedi</option>
                  {(selectedCategory === 'cmk' ? cmkList : casesList).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
```

`TasksPage` CMK listesini de çeker:

```tsx
  const { data: cmkData } = useCases({ isCmk: 'only', pageSize: 100 })
  const cmkList = cmkData?.data || []
```

> **Not:** Bugün `TasksPage` `useCases({ pageSize: 100 })` çağırıyor ve bu çağrı CMK dosyalarını hariç tutuyor — yani bir görev hiç CMK dosyasına bağlanamıyordu. Bu adım o eksiği de kapatıyor.

- [ ] **Step 3: TaskRow'a rozet ekle**

Import:

```ts
import { resolveTaskCategory, taskCategoryLabels, taskCategoryBadgeClass } from '@/lib/taskCategory'
```

Başlık satırındaki rozetlerin yanına ekle:

```tsx
                          {(() => {
                            const cat = resolveTaskCategory(task)
                            if (!cat) return null
                            return (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${taskCategoryBadgeClass[cat]}`}
                              >
                                {taskCategoryLabels[cat]}
                              </span>
                            )
                          })()}
```

- [ ] **Step 4: TasksPage'e kategori filtresi ekle**

Import ekle:

```ts
import { taskCategoryOptions, resolveTaskCategory } from '@/lib/taskCategory'
```

```tsx
  const [category, setCategory] = useState('')
```

Filtre satırına select ekle:

```tsx
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          <option value="">Tüm Kategoriler</option>
          {taskCategoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
```

`filteredTasks` hesabına kategori koşulunu ekle:

```tsx
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task: any) => {
        if (category && resolveTaskCategory(task) !== category) return false
        return matchesQuery(query, [task.title, task.description, task.label, task.caseTitle])
      }),
    [tasks, query, category]
  )
```

- [ ] **Step 5: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile:
- Yeni görevde kategori seçilebiliyor; "CMK" seçilince CMK dosyaları listeleniyor
- "Arabuluculuk" ve "Genel" seçilince dava seçici gizleniyor
- Listede renkli rozet görünüyor
- Kategori filtresi çalışıyor
- Eski (kategorisiz) görevler davaya bağlıysa "Dava"/"CMK" rozeti alıyor, değilse rozetsiz

- [ ] **Step 6: Commit**

```bash
git add client/src/components/tasks/ client/src/pages/TasksPage.tsx
git commit -m "feat: gorevlere kategori (dava/cmk/arabuluculuk/genel) etiketi ve filtresi

CMK secilince CMK dosyalari listeleniyor — onceden gorev hic CMK dosyasina
baglanamiyordu. Arabuluculuk yalnizca etiket (avukat karari). Eski gorevler
bagli davadan turetilir, turetilemezse rozetsiz kalir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.6: Görev formundan hızlı dava / müvekkil ekleme (Madde 1)

**Files:**
- Create: `client/src/components/shared/QuickAddClientDialog.tsx`
- Create: `client/src/components/shared/QuickAddCaseDialog.tsx`
- Modify: `client/src/pages/CaseFormPage.tsx:363-418` (inline dialog'u ortak bileşenle değiştir)
- Modify: `client/src/components/tasks/TaskForm.tsx`

- [ ] **Step 1: QuickAddClientDialog'u çıkar**

`client/src/components/shared/QuickAddClientDialog.tsx` — `CaseFormPage.tsx:363-418` arasındaki Dialog'un birebir taşınmış hâli:

```tsx
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useCreateClient } from '@/hooks/useClients'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function QuickAddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (clientId: string) => void
}) {
  const createClient = useCreateClient()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  function handleCreate() {
    if (!fullName.trim()) return
    createClient.mutate(
      {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      },
      {
        onSuccess: (response: any) => {
          const newId = response?.data?.id
          if (newId) onCreated(newId)
          onOpenChange(false)
          setFullName('')
          setPhone('')
          setEmail('')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Müvekkil Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-posta</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
              placeholder="ornek@mail.com"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!fullName.trim() || createClient.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: CaseFormPage'i ortak bileşene geçir**

`CaseFormPage.tsx` içindeki inline Dialog (satır 363-418), `newClientName/Phone/Email` state'leri ve `handleCreateClient` fonksiyonu silinir; yerine:

```tsx
      <QuickAddClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(clientId) => setValue('clientId', clientId)}
      />
```

- [ ] **Step 3: QuickAddCaseDialog'u yaz**

`client/src/components/shared/QuickAddCaseDialog.tsx`:

```tsx
import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { caseTypeValues } from '@hukuk-takip/shared'
import { useCreateCase } from '@/hooks/useCases'
import { useClients } from '@/hooks/useClients'
import { caseTypeLabels } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import QuickAddClientDialog from './QuickAddClientDialog'

/**
 * Gorev eklerken "ilgili dava" listesinde aradigi dava yoksa avukat sayfadan
 * cikmadan dava (ve gerekirse muvekkil) olusturabilsin diye.
 * defaultCmk=true ile CMK gorevlendirmesi olarak acilir.
 */
export default function QuickAddCaseDialog({
  open,
  onOpenChange,
  onCreated,
  defaultCmk = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (caseId: string) => void
  defaultCmk?: boolean
}) {
  const createCase = useCreateCase()
  const { data: clientsData } = useClients({ pageSize: 100 })
  const clients = clientsData?.data || []

  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [caseType, setCaseType] = useState<string>('diger')
  const [isCmk, setIsCmk] = useState(defaultCmk)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  const canSubmit = title.trim().length >= 2 && !!clientId

  function handleCreate() {
    if (!canSubmit) return
    createCase.mutate(
      {
        title: title.trim(),
        clientId,
        caseType: caseType as any,
        isCmkAssignment: isCmk,
        currency: 'TRY',
      } as any,
      {
        onSuccess: (response: any) => {
          const newId = response?.data?.id
          if (newId) onCreated(newId)
          onOpenChange(false)
          setTitle('')
          setClientId('')
          setCaseType('diger')
          setIsCmk(defaultCmk)
        },
      }
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isCmk ? 'Yeni CMK Dosyası' : 'Yeni Dava'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Dava Başlığı <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="Örnek: Ahmet Yılmaz işçilik alacağı"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Müvekkil <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
                >
                  <option value="">Müvekkil seçin</option>
                  {clients.map((client: any) => (
                    <option key={client.id} value={client.id}>{client.fullName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setClientDialogOpen(true)}
                  className="rounded-xl border px-3 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title="Yeni müvekkil ekle"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Dava Türü</label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
              >
                {caseTypeValues.map((type) => (
                  <option key={type} value={type}>{caseTypeLabels[type] || type}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isCmk}
                onChange={(e) => setIsCmk(e.target.checked)}
                className="h-4 w-4 rounded border-input text-law-accent focus:ring-2 focus:ring-law-accent/20"
              />
              <span className="text-sm font-medium">CMK Görevlendirmesi</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSubmit || createCase.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {createCase.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Oluştur
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(newClientId) => setClientId(newClientId)}
      />
    </>
  )
}
```

- [ ] **Step 4: TaskForm'a `+` butonunu bağla**

`TaskForm.tsx` içinde, Task 3.5'te eklenen dava seçicisinin yanına `+` butonu koy:

```tsx
                <button
                  type="button"
                  onClick={() => setCaseDialogOpen(true)}
                  className="rounded-lg border px-3 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title={selectedCategory === 'cmk' ? 'Yeni CMK dosyası ekle' : 'Yeni dava ekle'}
                >
                  <Plus className="h-4 w-4" />
                </button>
```

Bileşenin sonuna:

```tsx
      <QuickAddCaseDialog
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        defaultCmk={selectedCategory === 'cmk'}
        onCreated={(newCaseId) => setValue('caseId', newCaseId)}
      />
```

`const [caseDialogOpen, setCaseDialogOpen] = useState(false)` ekle ve `useForm`'dan `setValue`'yu al.

- [ ] **Step 5: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile:
- Görev formunda `+` → yeni dava penceresi açılıyor
- O pencerede `+` → yeni müvekkil penceresi açılıyor, oluşturunca müvekkil seçili geliyor
- Dava oluşturunca görev formunda dava seçili geliyor
- Kategori "CMK" iken oluşturulan dava CMK olarak işaretli geliyor
- Dava Ekle/Düzenle sayfasındaki müvekkil `+` butonu hâlâ çalışıyor (ortak bileşene geçti)

- [ ] **Step 6: Commit**

```bash
git add client/src/components/shared/QuickAddClientDialog.tsx client/src/components/shared/QuickAddCaseDialog.tsx client/src/components/tasks/TaskForm.tsx client/src/pages/CaseFormPage.tsx
git commit -m "feat: gorev formundan hizli dava ve muvekkil ekleme

CaseFormPage'deki inline muvekkil dialogu ortak bilesene tasindi; iki yerde
ayni form durmuyor. Kategori CMK iken acilan dava CMK olarak isaretlenir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.7: Faz 3 doğrulama

- [ ] **Step 1: Tam kontrol**

```bash
npm run build --workspace=shared && npm run test --workspace=client && npx tsc --noEmit -p client/tsconfig.json && npx tsc --noEmit -p server/tsconfig.json && npm run build --workspace=client
```

Beklenen: hepsi exit 0.

- [ ] **Step 2: Veri bütünlüğü kontrolü**

```bash
psql "$DATABASE_URL_MIGRATION" -c "select count(*) from tasks;"
```

Beklenen: Faz 3 öncesindeki sayıyla **aynı**. Azaldıysa DURDUR ve yedekten dönüşü avukatla konuş.

---

# FAZ 4 — Bekleyen Tahsilatlar (Madde 8b)

Şema değişikliği yok. Mevcut sunucu yardımcıları kullanılır.

---

### Task 4.1: `GET /api/collections/outstanding` endpoint'i

**Neden mevcut yardımcı:** `server/src/utils/outstandingFees.ts` "bekleyen tahsilat"ın tek doğru kaynağıdır ve Dashboard ile İstatistikler zaten onu kullanıyor. Yeni bir hesap yazmak üç ekran arasında tutarsızlık üretir — bu daha önce yaşanmış ve tek kaynağa bağlanarak çözülmüş bir sorundur.

**Files:**
- Modify: `server/src/routes/collections.ts`

- [ ] **Step 1: Endpoint'i ekle**

`server/src/routes/collections.ts` — import ekle:

```ts
import { getOutstandingCaseFees, getOutstandingMediationFees } from '../utils/outstandingFees.js'
```

`router.get('/', ...)` tanımının **hemen üstüne** ekle (yol çakışmasını önlemek için `/:id` içeren route'lardan önce olmalı):

```ts
// ─── GET /api/collections/outstanding ────────────────────────────────────────
// Bekleyen (henuz tam tahsil edilmemis) dava ve arabuluculuk ucretleri.
// Hesap outstandingFees.ts'ten gelir — Dashboard ve Istatistikler de ayni
// kaynagi kullanir, boylece uc ekran arasinda tutarsizlik olmaz.
router.get('/outstanding', async (req, res) => {
  const userId = req.user!.userId

  const [caseRows, mediationRows] = await Promise.all([
    getOutstandingCaseFees(userId),
    getOutstandingMediationFees(userId),
  ])

  res.json({ cases: caseRows, mediations: mediationRows })
})
```

- [ ] **Step 2: Doğrula**

```bash
npx tsc --noEmit -p server/tsconfig.json
```

Beklenen: hatasız.

Sunucu çalışırken (giriş yapılmış bir oturum çerezi ile):

```bash
curl -s "http://localhost:3001/api/collections/outstanding" -b cookies.txt | head -c 400
```

Beklenen: `{"cases":[...],"mediations":[...]}` yapısı.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/collections.ts
git commit -m "feat: bekleyen tahsilatlar endpoint'i

Hesap mevcut outstandingFees.ts yardimcilarindan gelir; Dashboard ve
Istatistikler ile ayni kaynak.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.2: Tahsilatlar sayfasına "Bekleyen" sekmesi

**Files:**
- Modify: `client/src/hooks/useCollections.ts`
- Modify: `client/src/pages/CollectionsPage.tsx`

- [ ] **Step 1: Hook'u ekle**

`client/src/hooks/useCollections.ts` dosyasının sonuna:

```ts
export interface OutstandingRow {
  id: string
  title: string
  clientName: string | null
  contractedFee: string | null
  totalCollected: string
  remaining: string
  source: 'case' | 'mediation'
  isCmkAssignment?: boolean
}

// Bekleyen tahsilatlar — anlasilan ucreti olup henuz tam tahsil edilmemis
// dava ve arabuluculuk dosyalari.
export function useOutstandingCollections() {
  return useQuery({
    queryKey: ['collections', 'outstanding'],
    queryFn: async () => {
      const res = await api.get('/collections/outstanding')
      return res.data as { cases: OutstandingRow[]; mediations: OutstandingRow[] }
    },
    staleTime: 1000 * 60 * 2,
  })
}
```

- [ ] **Step 2: Sayfaya sekme yapısı ekle**

`client/src/pages/CollectionsPage.tsx` — import ekle:

```ts
import { useOutstandingCollections } from '@/hooks/useCollections'
import { Clock } from 'lucide-react'
```

State ekle:

```tsx
  const [tab, setTab] = useState<'done' | 'outstanding'>('done')
  const { data: outstandingData, isLoading: outstandingLoading } = useOutstandingCollections()

  const outstandingRows = useMemo(() => {
    if (!outstandingData) return []
    return [...outstandingData.cases, ...outstandingData.mediations]
  }, [outstandingData])

  const outstandingTotal = useMemo(
    () => outstandingRows.reduce((sum, row) => sum + Number.parseFloat(row.remaining || '0'), 0),
    [outstandingRows]
  )
```

Başlığın hemen altına sekme çubuğunu koy:

```tsx
      <div className="flex w-fit rounded-xl border bg-card p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('done')}
          className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
            tab === 'done'
              ? 'bg-law-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Tahsilatlar
        </button>
        <button
          type="button"
          onClick={() => setTab('outstanding')}
          className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
            tab === 'outstanding'
              ? 'bg-law-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Bekleyen{outstandingRows.length > 0 ? ` (${outstandingRows.length})` : ''}
        </button>
      </div>
```

Mevcut özet kartları, kaynak filtresi, arama ve tablo `{tab === 'done' && ( ... )}` içine alınır.

- [ ] **Step 3: Bekleyen sekmesinin içeriğini yaz**

```tsx
      {tab === 'outstanding' && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Bekleyen Toplam · {outstandingRows.length} dosya
                </p>
                <p className="mt-0.5 truncate text-lg font-semibold">
                  {formatCurrency(outstandingTotal, 'TRY')}
                </p>
              </div>
            </CardContent>
          </Card>

          {outstandingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : outstandingRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Bekleyen tahsilat yok
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Anlaşılan ücreti girilmiş tüm dosyalar tam tahsil edilmiş görünüyor.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Dosya</th>
                    <th className="hidden px-4 py-3 md:table-cell">Müvekkil</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">Anlaşılan</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">Tahsil Edilen</th>
                    <th className="px-4 py-3 text-right">Kalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {outstandingRows.map((row) => {
                    const isMediation = row.source === 'mediation'
                    const SourceIcon = isMediation ? Handshake : row.isCmkAssignment ? Shield : Scale
                    return (
                      <tr
                        key={`${row.source}-${row.id}`}
                        onClick={
                          isMediation
                            ? () => navigate('/tools/mediation-files')
                            : () => navigate(`/cases/${row.id}`)
                        }
                        className="cursor-pointer transition-colors even:bg-muted/20 hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <SourceIcon
                              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                                isMediation
                                  ? 'text-orange-500'
                                  : row.isCmkAssignment
                                  ? 'text-indigo-600'
                                  : 'text-law-accent'
                              }`}
                            />
                            <p className="truncate font-medium">{row.title}</p>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {row.clientName || '—'}
                        </td>
                        <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                          {row.contractedFee ? formatCurrency(row.contractedFee, 'TRY') : '—'}
                        </td>
                        <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                          {formatCurrency(row.totalCollected, 'TRY')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold tabular-nums text-amber-700">
                            {formatCurrency(row.remaining, 'TRY')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
```

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile:
- "Bekleyen (N)" sekmesi görünüyor, N Dashboard'daki bekleyen sayısıyla tutarlı
- Satıra tıklayınca ilgili dava/arabuluculuk sayfası açılıyor
- "Tahsilatlar" sekmesi eskisi gibi çalışıyor (filtre, arama, toplamlar)

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useCollections.ts client/src/pages/CollectionsPage.tsx
git commit -m "feat: tahsilatlar sayfasina bekleyen tahsilatlar sekmesi

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

# FAZ 5 — Esnek Ücret Anlaşması (Madde 6)

En büyük iş: 5 kolon + 1 yeni tablo. **Başlamadan önce yedek zorunlu.**

---

### Task 5.0: Yedek al (ZORUNLU)

- [ ] **Step 1: pg_dump**

```bash
cd hukuk-takip
pg_dump "$DATABASE_URL_MIGRATION" --no-owner --no-privileges -f "backups/2026-07-25-faz5-oncesi.sql"
ls -la backups/2026-07-25-faz5-oncesi.sql
```

Beklenen: dosya var ve boyutu 0'dan büyük.

- [ ] **Step 2: backups/README.md'ye not düş**

```markdown
## 2026-07-25 — Faz 5 öncesi (esnek ücret anlaşması)

- Dosya: `2026-07-25-faz5-oncesi.sql`
- Sebep: `ensureSchema.ts` REV12 — `cases` tablosuna 5 nullable kolon
  (`fee_type`, `fee_percentage`, `fee_percentage_base`, `fee_percentage_note`,
  `fee_payment_plan`) + yeni `case_fee_installments` tablosu.
- İşlem tipi: ADDITIVE. `contracted_fee` DEĞİŞMEZ, rename yok, backfill yok.
- Geri alma: yeni kolonlar/tablo boş kalır; eski davranış `fee_type IS NULL`
  ile korunur.
```

- [ ] **Step 3: Commit**

```bash
git add backups/README.md
git commit -m "chore: Faz 5 oncesi yedek notu (esnek ucret anlasmasi)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.1: Taksit hesabı — saf fonksiyon (TDD)

**Neden test:** Para bölünüyor. `100.000 / 3` yanlış yuvarlanırsa toplam anlaşılan ücretle tutmaz ve avukatın muhasebesi bozulur.

**Files:**
- Create: `client/src/lib/feeInstallments.test.ts`
- Create: `client/src/lib/feeInstallments.ts`

- [ ] **Step 1: Başarısız testi yaz**

`client/src/lib/feeInstallments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generateInstallments } from './feeInstallments'

describe('generateInstallments', () => {
  it('tam bolunen tutari esit boler', () => {
    const result = generateInstallments(90000, 3, '2026-08-01')
    expect(result.map((r) => r.amount)).toEqual([30000, 30000, 30000])
    expect(result.map((r) => r.dueDate)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
  })

  it('kurus artigini son taksite yazar, toplam her zaman tutari verir', () => {
    const result = generateInstallments(100000, 3, '2026-08-01')
    expect(result.map((r) => r.amount)).toEqual([33333.33, 33333.33, 33333.34])
    const total = result.reduce((sum, r) => sum + r.amount, 0)
    expect(Number(total.toFixed(2))).toBe(100000)
  })

  it('kucuk tutarlarda da toplam korunur', () => {
    const result = generateInstallments(100, 3, '2026-01-15')
    expect(result.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34])
    expect(Number(result.reduce((s, r) => s + r.amount, 0).toFixed(2))).toBe(100)
  })

  it('tek taksitte tutarin tamamini verir', () => {
    const result = generateInstallments(4500.5, 1, '2026-03-10')
    expect(result).toEqual([{ seq: 1, amount: 4500.5, dueDate: '2026-03-10' }])
  })

  it('ay sonu tarihlerde kisa aylara tasmaz', () => {
    const result = generateInstallments(300, 3, '2026-01-31')
    expect(result.map((r) => r.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('gecersiz girdide bos dizi doner', () => {
    expect(generateInstallments(0, 3, '2026-08-01')).toEqual([])
    expect(generateInstallments(1000, 0, '2026-08-01')).toEqual([])
    expect(generateInstallments(1000, 3, '')).toEqual([])
  })

  it('taksit sayisini 60 ile sinirlar', () => {
    expect(generateInstallments(1000, 999, '2026-08-01')).toEqual([])
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

```bash
npm run test --workspace=client
```

Beklenen: FAIL — `Failed to resolve import "./feeInstallments"`.

- [ ] **Step 3: Modülü yaz**

`client/src/lib/feeInstallments.ts`:

```ts
import { addMonths, format, parseISO, isValid } from 'date-fns'

export interface GeneratedInstallment {
  seq: number
  amount: number
  dueDate: string // YYYY-MM-DD
}

const MAX_INSTALLMENTS = 60

/**
 * Anlasilan maktu tutari esit taksitlere boler.
 *
 * Para hesabi kurus (integer) uzerinden yapilir; float toplama hatasi olmasin
 * diye. Bolumden kalan kurus SON taksite eklenir — boylece taksitlerin toplami
 * her zaman anlasilan tutara birebir esittir. (Avukatin muhasebesi tutmali.)
 *
 * Vadeler aydan aya ilerler. date-fns addMonths kisa aylara tasmayi kendisi
 * onler: 31 Ocak + 1 ay = 28/29 Subat.
 */
export function generateInstallments(
  totalAmount: number,
  count: number,
  firstDueDate: string
): GeneratedInstallment[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return []
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) return []
  if (!firstDueDate) return []

  const start = parseISO(firstDueDate)
  if (!isValid(start)) return []

  const totalKurus = Math.round(totalAmount * 100)
  const baseKurus = Math.floor(totalKurus / count)
  const remainderKurus = totalKurus - baseKurus * count

  return Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1
    const kurus = isLast ? baseKurus + remainderKurus : baseKurus
    return {
      seq: index + 1,
      amount: kurus / 100,
      dueDate: format(addMonths(start, index), 'yyyy-MM-dd'),
    }
  })
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

```bash
npm run test --workspace=client
```

Beklenen: PASS — tüm testler geçer (textSearch testleri dahil).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/feeInstallments.ts client/src/lib/feeInstallments.test.ts
git commit -m "feat: taksit uretimi (kurus bazli, artik son taksite)

Toplam her zaman anlasilan tutara birebir esit. Ay sonu tarihleri kisa
aylara tasmaz.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.2: Şema — 5 kolon + taksit tablosu

**Files:**
- Modify: `server/src/db/ensureSchema.ts`
- Modify: `server/src/db/schema.ts`

- [ ] **Step 1: ensureSchema REV12 bloğunu ekle**

`server/src/db/ensureSchema.ts` — `REV11_TASK_CATEGORY_SQL`'in ardına:

```ts
// rev12 (2026-07): Esnek ucret anlasmasi. Avukat bazen sadece maktu tutara,
// bazen sadece yuzdeye, bazen ikisine birden anlasiyor; maktu tutar sik sik
// taksitli oluyor (or. 90.000 TL / 3 taksit).
//
// TAM ADDITIVE:
//  - contracted_fee DEGISMEZ ve maktu tutari ifade etmeye devam eder.
//  - fee_type NULL olan mevcut davalar bugunku davranisla birebir ayni calisir.
//  - Hicbir satir guncellenmez (backfill YOK), hicbir kolon drop edilmez.
const REV12_FEE_AGREEMENT_SQL = `
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "fee_type" varchar(20);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "fee_percentage" numeric(5,2);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "fee_percentage_base" varchar(20);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "fee_percentage_note" varchar(500);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "fee_payment_plan" varchar(20);

CREATE TABLE IF NOT EXISTS "case_fee_installments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id" uuid NOT NULL REFERENCES "cases"("id") ON DELETE CASCADE,
  "seq" integer NOT NULL DEFAULT 1,
  "amount" numeric(12,2) NOT NULL,
  "due_date" date NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "collection_id" uuid REFERENCES "collections"("id") ON DELETE SET NULL,
  "note" varchar(300),
  "archived_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "case_fee_installments_case_idx" ON "case_fee_installments" ("case_id");
CREATE INDEX IF NOT EXISTS "case_fee_installments_due_idx" ON "case_fee_installments" ("due_date", "status");
`
```

`ensureSchema()` içinde REV11'in ardına:

```ts
    await sql.unsafe(REV12_FEE_AGREEMENT_SQL)
    console.log('Schema guard: esnek ucret anlasmasi (cases fee_* + case_fee_installments) hazir.')
```

- [ ] **Step 2: Drizzle şemasına ekle**

`server/src/db/schema.ts` — `cases` tablosunda `currency` satırının altına:

```ts
    // Esnek ücret anlaşması (rev12). contractedFee = maktu tutar (değişmedi).
    // feeType NULL = eski davranış (yalnızca maktu).
    feeType: varchar('fee_type', { length: 20 }),
    feePercentage: decimal('fee_percentage', { precision: 5, scale: 2 }),
    feePercentageBase: varchar('fee_percentage_base', { length: 20 }),
    feePercentageNote: varchar('fee_percentage_note', { length: 500 }),
    feePaymentPlan: varchar('fee_payment_plan', { length: 20 }),
```

Dosyanın `collections` tanımının ardına yeni tabloyu ekle:

```ts
export const caseFeeInstallments = pgTable(
  'case_fee_installments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'cascade' })
      .notNull(),
    seq: integer('seq').default(1).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    dueDate: date('due_date').notNull(),
    // 'pending' | 'paid' | 'partial'
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    collectionId: uuid('collection_id').references(() => collections.id, {
      onDelete: 'set null',
    }),
    note: varchar('note', { length: 300 }),
    // Silme = arşivleme. Fiziksel DELETE kod yolu yok.
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index('case_fee_installments_case_idx').on(table.caseId),
    dueIdx: index('case_fee_installments_due_idx').on(table.dueDate, table.status),
  })
)
```

`integer` drizzle-orm/pg-core import listesinde yoksa ekle.

- [ ] **Step 3: Doğrula**

```bash
npx tsc --noEmit -p server/tsconfig.json
npm run dev --workspace=server
```

Beklenen log: `Schema guard: esnek ucret anlasmasi (cases fee_* + case_fee_installments) hazir.`

```bash
psql "$DATABASE_URL_MIGRATION" -c "\d case_fee_installments"
psql "$DATABASE_URL_MIGRATION" -c "select count(*) from cases;"
```

Beklenen: tablo mevcut; dava sayısı Faz 5 öncesiyle **aynı**.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/ensureSchema.ts server/src/db/schema.ts
git commit -m "feat: esnek ucret anlasmasi semasi (REV12)

cases'e 5 nullable fee_* kolonu + case_fee_installments tablosu. ADDITIVE:
contracted_fee degismedi, backfill yok, DROP yok. fee_type NULL olan davalar
bugunku davranisla ayni calisir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.3: Zod şemaları ve taksit endpoint'leri

**Files:**
- Create: `shared/src/schemas/feeInstallment.ts`
- Modify: `shared/src/schemas/case.ts`
- Modify: `shared/src/index.ts` (dışa aktarım)
- Create: `server/src/routes/feeInstallments.ts`
- Modify: `server/src/index.ts` (router'ı bağla)
- Modify: `server/src/routes/cases.ts` (fee alanlarını kabul et/döndür)

- [ ] **Step 1: Taksit şemasını yaz**

`shared/src/schemas/feeInstallment.ts`:

```ts
import { z } from 'zod'

export const installmentStatusValues = ['pending', 'paid', 'partial'] as const
export type InstallmentStatus = (typeof installmentStatusValues)[number]

export const createFeeInstallmentSchema = z.object({
  seq: z.number().int().min(1).max(60).optional(),
  amount: z.string().min(1, 'Tutar zorunludur'),
  dueDate: z.string().min(1, 'Vade tarihi zorunludur'),
  status: z.enum(installmentStatusValues).optional(),
  note: z.string().max(300).optional().or(z.literal('')),
})

export const updateFeeInstallmentSchema = createFeeInstallmentSchema.partial().extend({
  collectionId: z.string().uuid().optional().or(z.literal('')),
})

export type CreateFeeInstallmentInput = z.infer<typeof createFeeInstallmentSchema>
export type UpdateFeeInstallmentInput = z.infer<typeof updateFeeInstallmentSchema>
```

- [ ] **Step 2: Dava şemasına ücret alanlarını ekle**

`shared/src/schemas/case.ts` — mevcut değer listelerinin yanına:

```ts
export const feeTypeValues = ['fixed', 'percentage', 'fixed_plus_percentage'] as const
export const feePercentageBaseValues = ['collected', 'awarded'] as const
export const feePaymentPlanValues = ['single', 'installment'] as const
export type FeeType = (typeof feeTypeValues)[number]
```

`createCaseSchema` içine (tümü opsiyonel — mevcut form gönderimleri kırılmaz):

```ts
  feeType: z.enum(feeTypeValues).optional().or(z.literal('')),
  feePercentage: z
    .string()
    .regex(/^\d{1,2}([.,]\d{1,2})?$/, 'Oran 0-99 arası olmalıdır')
    .optional()
    .or(z.literal('')),
  feePercentageBase: z.enum(feePercentageBaseValues).optional().or(z.literal('')),
  feePercentageNote: z.string().max(500).optional().or(z.literal('')),
  feePaymentPlan: z.enum(feePaymentPlanValues).optional().or(z.literal('')),
```

`shared/src/index.ts`'e ekle:

```ts
export * from './schemas/feeInstallment.js'
```

- [ ] **Step 3: Taksit router'ını yaz**

`server/src/routes/feeInstallments.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { and, asc, eq, isNull } from 'drizzle-orm'
import {
  createFeeInstallmentSchema,
  updateFeeInstallmentSchema,
} from '@hukuk-takip/shared'
import { db } from '../db/index.js'
import { caseFeeInstallments, cases } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()

/** Dava gercekten bu kullaniciya mi ait? Taksit islemleri once bunu dogrular. */
async function assertCaseOwnership(caseId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId), isNull(cases.archivedAt)))
    .limit(1)
  return rows.length > 0
}

// GET /api/cases/:caseId/fee-installments
router.get('/cases/:caseId/fee-installments', async (req: Request, res: Response) => {
  const caseId = getSingleValue(req.params.caseId)
  if (!caseId || !(await assertCaseOwnership(caseId, req.user!.userId))) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const rows = await db
    .select()
    .from(caseFeeInstallments)
    .where(and(eq(caseFeeInstallments.caseId, caseId), isNull(caseFeeInstallments.archivedAt)))
    .orderBy(asc(caseFeeInstallments.seq), asc(caseFeeInstallments.dueDate))

  res.json(rows)
})

// POST /api/cases/:caseId/fee-installments
router.post(
  '/cases/:caseId/fee-installments',
  validate(createFeeInstallmentSchema),
  async (req: Request, res: Response) => {
    const caseId = getSingleValue(req.params.caseId)
    if (!caseId || !(await assertCaseOwnership(caseId, req.user!.userId))) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }

    const { seq, amount, dueDate, status, note } = req.body

    const [created] = await db
      .insert(caseFeeInstallments)
      .values({
        caseId,
        seq: seq ?? 1,
        amount,
        dueDate,
        status: status || 'pending',
        note: note || null,
      })
      .returning()

    res.status(201).json(created)
  }
)

// PUT /api/fee-installments/:id
router.put(
  '/fee-installments/:id',
  validate(updateFeeInstallmentSchema),
  async (req: Request, res: Response) => {
    const id = getSingleValue(req.params.id)
    if (!id) {
      res.status(400).json({ error: 'Gecersiz taksit id.' })
      return
    }

    const existing = await db
      .select({ caseId: caseFeeInstallments.caseId })
      .from(caseFeeInstallments)
      .where(eq(caseFeeInstallments.id, id))
      .limit(1)

    if (!existing[0] || !(await assertCaseOwnership(existing[0].caseId, req.user!.userId))) {
      res.status(404).json({ error: 'Taksit bulunamadi.' })
      return
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (req.body.amount !== undefined) patch.amount = req.body.amount
    if (req.body.dueDate !== undefined) patch.dueDate = req.body.dueDate
    if (req.body.status !== undefined) patch.status = req.body.status
    if (req.body.seq !== undefined) patch.seq = req.body.seq
    if (req.body.note !== undefined) patch.note = req.body.note || null
    if (req.body.collectionId !== undefined) patch.collectionId = req.body.collectionId || null

    const [updated] = await db
      .update(caseFeeInstallments)
      .set(patch)
      .where(eq(caseFeeInstallments.id, id))
      .returning()

    res.json(updated)
  }
)

// DELETE /api/fee-installments/:id — ARSIVLER, satiri silmez.
router.delete('/fee-installments/:id', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Gecersiz taksit id.' })
    return
  }

  const existing = await db
    .select({ caseId: caseFeeInstallments.caseId })
    .from(caseFeeInstallments)
    .where(eq(caseFeeInstallments.id, id))
    .limit(1)

  if (!existing[0] || !(await assertCaseOwnership(existing[0].caseId, req.user!.userId))) {
    res.status(404).json({ error: 'Taksit bulunamadi.' })
    return
  }

  // Veri koruma kurali: fiziksel DELETE yok, archived_at set edilir.
  await db
    .update(caseFeeInstallments)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(caseFeeInstallments.id, id))

  res.json({ success: true })
})

export default router
```

- [ ] **Step 4: Router'ı bağla**

`server/src/index.ts` — import ekle:

```ts
import feeInstallmentsRouter from './routes/feeInstallments.js'
```

`app.use('/api', caseDiaryRouter)` satırının hemen ardına (aynı desen — router tam yolları içerir):

```ts
// Ücret taksitleri — /cases/:caseId/fee-installments ve /fee-installments/:id
app.use('/api', feeInstallmentsRouter)
```

- [ ] **Step 5: cases route'una fee alanlarını ekle**

`server/src/routes/cases.ts`:
1. Dava **detay** select'ine (`/:id` endpoint'i) beş `fee*` kolonunu ekle.
2. POST ve PUT payload normalizasyonunda, `contractedFee` alanı nasıl işleniyorsa `feeType`, `feePercentage`, `feePercentageBase`, `feePercentageNote`, `feePaymentPlan` de aynı şekilde işlenir (boş string → `null`).
3. Liste select'ine `feeType` ve `feePercentage` eklenir (listede rozet göstermek için).

- [ ] **Step 6: Doğrula**

```bash
npm run build --workspace=shared && npx tsc --noEmit -p server/tsconfig.json
```

Beklenen: hatasız.

- [ ] **Step 7: Commit**

```bash
git add shared/src/schemas/feeInstallment.ts shared/src/schemas/case.ts shared/src/index.ts server/src/routes/feeInstallments.ts server/src/routes/cases.ts server/src/index.ts
git commit -m "feat: ucret anlasmasi semalari ve taksit endpoint'leri

DELETE endpoint'i archived_at set eder, satiri silmez. Tum fee alanlari
opsiyonel — mevcut form gonderimleri kirilmaz.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.4: Dava formunda ücret anlaşması bölümü

**Files:**
- Create: `client/src/hooks/useFeeInstallments.ts`
- Create: `client/src/components/cases/FeeAgreementFields.tsx`
- Modify: `client/src/pages/CaseFormPage.tsx`

- [ ] **Step 1: Hook'ları yaz**

`client/src/hooks/useFeeInstallments.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'

export interface FeeInstallment {
  id: string
  caseId: string
  seq: number
  amount: string
  dueDate: string
  status: 'pending' | 'paid' | 'partial'
  collectionId: string | null
  note: string | null
}

export function useFeeInstallments(caseId: string | undefined) {
  return useQuery({
    queryKey: ['cases', caseId, 'fee-installments'],
    queryFn: async () => {
      const res = await api.get(`/cases/${caseId}/fee-installments`)
      return res.data as FeeInstallment[]
    },
    enabled: !!caseId,
  })
}

export function useCreateFeeInstallment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      seq?: number
      amount: string
      dueDate: string
      note?: string
    }) => (await api.post(`/cases/${caseId}/fee-installments`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId, 'fee-installments'] })
    },
    onError: () => toast.error('Taksit eklenemedi.'),
  })
}

export function useUpdateFeeInstallment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.put(`/fee-installments/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId, 'fee-installments'] })
    },
    onError: () => toast.error('Taksit guncellenemedi.'),
  })
}

// Sunucu tarafinda ARSIVLER — satir silinmez, geri alinabilir.
export function useArchiveFeeInstallment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/fee-installments/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId, 'fee-installments'] })
      toast.success('Taksit kaldirildi.')
    },
    onError: () => toast.error('Taksit kaldirilamadi.'),
  })
}
```

- [ ] **Step 2: Form bölümünü yaz**

`client/src/components/cases/FeeAgreementFields.tsx` — `react-hook-form`'un `register` / `watch` / `setValue` fonksiyonlarını props olarak alan sunum bileşeni:

- Ücret tipi: üç seçenekli segment (`Maktu` / `Yüzdelik` / `Maktu + Yüzdelik`) → `feeType`
- `feeType` `fixed` veya `fixed_plus_percentage` ise: `contractedFee` + `currency` + ödeme planı segmenti (`Tek ödeme` / `Taksitli`) → `feePaymentPlan`
- `feePaymentPlan === 'installment'` ise: taksit sayısı ve ilk vade girişleri + **Taksitleri Oluştur** butonu. Buton `generateInstallments(Number(contractedFee), count, firstDue)` çağırır ve üretilen satırları yerel state'te gösterir; kayıt sırasında `useCreateFeeInstallment` ile tek tek yazılır.
- `feeType` `percentage` veya `fixed_plus_percentage` ise: `feePercentage` (%), `feePercentageBase` (`Tahsil edilen` / `Hükmedilen`), `feePercentageNote`

Yeni dava oluştururken dava id'si henüz yok; bu durumda üretilen taksitler bileşen state'inde tutulur ve dava oluşturulduktan sonra `onCreated` callback'i ile yazılır. Düzenleme modunda doğrudan API'ye yazılır.

- [ ] **Step 3: CaseFormPage'e yerleştir**

Mevcut "Anlasilan Ucret" input'u (satır 276-286) `FeeAgreementFields` bileşeniyle değiştirilir. `contractedFee` alanı bileşenin içinde yaşamaya devam eder — isim ve anlam değişmez.

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile senaryolar:
- Sadece maktu: 25.000 gir, kaydet, dava detayında görünüyor
- Maktu + taksit: 90.000 / 3 taksit / ilk vade 01.08.2026 → üç satır 30.000 olarak üretiliyor
- 100.000 / 3 → 33.333,33 + 33.333,33 + 33.333,34 (toplam tam)
- Sadece yüzdelik: %15 / tahsil edilen → maktu tutar alanı gizli
- Maktu + yüzdelik: ikisi de görünüyor
- **Eski bir davayı düzenle ve kaydet** → ücret bilgisi değişmemiş olmalı

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useFeeInstallments.ts client/src/components/cases/FeeAgreementFields.tsx client/src/pages/CaseFormPage.tsx
git commit -m "feat: dava formunda esnek ucret anlasmasi (maktu + yuzdelik + taksit)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.5: Dava detayında taksit tablosu

**Files:**
- Create: `client/src/components/cases/FeeInstallmentTable.tsx`
- Modify: `client/src/pages/CaseDetailPage.tsx`

- [ ] **Step 1: Tabloyu yaz**

`client/src/components/cases/FeeInstallmentTable.tsx`:

- `useFeeInstallments(caseId)` ile taksitleri çeker
- Kolonlar: sıra, tutar, vade, durum, işlem
- Durum renkleri: `paid` → yeşil, vadesi geçmiş `pending` → kırmızı, diğer `pending` → nötr
- Her satırda **"Tahsilat olarak işle"** butonu → dava detayındaki mevcut tahsilat ekleme formunu tutar ve tarihle doldurur; tahsilat kaydedilince `useUpdateFeeInstallment` ile taksit `paid` yapılır ve `collectionId` bağlanır
- Satır kaldırma butonu `useArchiveFeeInstallment` çağırır ve onay ister:
  `"Bu taksit satırı kaldırılacak. Tahsilat kayıtları etkilenmez. Devam edilsin mi?"`
- Alt satırda özet: `Toplam taksit: X · Ödenen: Y · Kalan: Z`

- [ ] **Step 2: Ücret özeti rozeti**

Dava detayının üst kısmında ücret anlaşmasını özetle:
- `fixed` → `25.000 ₺`
- `percentage` → `%15 · dava sonu (tahsil edilen üzerinden)`
- `fixed_plus_percentage` → `90.000 ₺ + %15`

> Yalnızca yüzdelik anlaşmalarda hesaplanabilir bir tutar yoktur; **rakam uydurulmaz**, yalnızca oran ve matrah gösterilir.

- [ ] **Step 3: CaseDetailPage'e yerleştir**

Tahsilatlar sekmesinin üstüne `FeeInstallmentTable` eklenir; ücret özeti rozeti dava başlığının yanına konur.

- [ ] **Step 4: Doğrula**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

`npm run dev` ile:
- Taksitli bir davada tablo görünüyor, vadesi geçmiş taksit kırmızı
- "Tahsilat olarak işle" tahsilat formunu dolu açıyor, kayıt sonrası taksit yeşile dönüyor
- Taksit kaldırma onay soruyor ve satırı listeden çıkarıyor
- **Taksitsiz eski davalarda tablo hiç görünmüyor** (bozulma yok)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/cases/FeeInstallmentTable.tsx client/src/pages/CaseDetailPage.tsx
git commit -m "feat: dava detayinda taksit tablosu ve ucret ozeti

Taksit kaldirma arsivler; tahsilat kayitlarina dokunmaz. Yalnizca yuzdelik
anlasmalarda rakam uydurulmaz, oran ve matrah gosterilir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.6: Bekleyen tahsilat mantığını koru + yüzdelik rozeti

**Files:**
- Modify: `client/src/pages/CollectionsPage.tsx` (Bekleyen sekmesi)

- [ ] **Step 1: `outstandingFees.ts`'e DOKUNMA**

Bu adımda sunucu tarafındaki bekleyen hesabı **değiştirilmez**. Maktu davalar bugünkü gibi hesaplanır; yalnızca yüzdelik davalar (`contracted_fee` boş) zaten hesaba girmez.

- [ ] **Step 2: Yüzdelik davaları görünür kıl**

Bekleyen sekmesinde, hesaba girmeyen ama yüzdelik anlaşması olan davaları ayrı bir bilgi bloğunda listele:

```tsx
          {percentageOnlyCases.length > 0 && (
            <div className="rounded-xl border border-dashed bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Yüzdelik anlaşmalı dosyalar — tutar dava sonunda belli olur, bekleyen
                toplama dâhil edilmez
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {percentageOnlyCases.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted"
                  >
                    {c.title} · %{c.feePercentage}
                  </button>
                ))}
              </div>
            </div>
          )}
```

`percentageOnlyCases`, dava listesinden `feeType === 'percentage'` olanlar süzülerek elde edilir (`useCases({ pageSize: 200 })`).

- [ ] **Step 3: Doğrula ve commit**

```bash
npx tsc --noEmit -p client/tsconfig.json && npm run build --workspace=client
```

```bash
git add client/src/pages/CollectionsPage.tsx
git commit -m "feat: bekleyen sekmesinde yuzdelik anlasmali dosyalari ayri goster

Tutari hesaplanamayan dosyalar icin rakam uydurulmaz; toplama katilmaz ama
gozden kacmasin diye ayri blokta listelenir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.7: Faz 5 doğrulama

- [ ] **Step 1: Tam kontrol**

```bash
npm run build --workspace=shared && npm run test --workspace=client && npx tsc --noEmit -p client/tsconfig.json && npx tsc --noEmit -p server/tsconfig.json && npm run build --workspace=client
```

Beklenen: hepsi exit 0.

- [ ] **Step 2: Veri bütünlüğü**

```bash
psql "$DATABASE_URL_MIGRATION" -c "select count(*) from cases;"
psql "$DATABASE_URL_MIGRATION" -c "select count(*) from collections;"
psql "$DATABASE_URL_MIGRATION" -c "select count(*) from tasks;"
psql "$DATABASE_URL_MIGRATION" -c "select count(*) from cases where contracted_fee is not null;"
```

Beklenen: dördü de Faz 5 öncesindeki değerlerle **birebir aynı**. Farklıysa DURDUR.

- [ ] **Step 3: Regresyon kontrolü — Dashboard tutarlılığı**

Dashboard'daki "bekleyen tahsilat" toplamı ile İstatistikler sayfasındaki ve Tahsilatlar → Bekleyen sekmesindeki toplam **aynı olmalı**. Farklıysa `outstandingFees.ts`'e yanlışlıkla dokunulmuş demektir — geri al.

---

## Kapanış Kontrol Listesi

- [ ] Madde 1 — Görev formundan yeni dava/müvekkil ekleme (Task 3.6)
- [ ] Madde 2 — Arabuluculuk toplam dosya sayısı (Task 2.2)
- [ ] Madde 3 — Görevlerde arama + mükerrer uyarısı (Task 3.4)
- [ ] Madde 4 — Görev sayısı (Task 3.4)
- [ ] Madde 5 — CMK eklenme tarihi (Task 2.3)
- [ ] Madde 6 — Esnek ücret: maktu + yüzdelik + taksit (Faz 5)
- [ ] Madde 7 — Hız / PWA / cold start (Faz 1)
- [ ] Madde 8 — Tahsilat sıralaması (Task 2.1) + bekleyen tahsilatlar (Faz 4)
- [ ] Madde 9 — Görev kategorisi etiketi (Task 3.5)
- [ ] cron-job.org kurulumu avukat tarafından yapıldı ve doğrulandı
- [ ] Tüm satır sayıları Faz öncesi değerlerle aynı
