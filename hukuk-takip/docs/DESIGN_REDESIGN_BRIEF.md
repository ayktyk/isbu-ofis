# Themis — UI/UX Redesign Brief for Claude Designer

> Bu dosya, mevcut hukuk bürosu iş takip uygulamasını (internal code: **Themis** — kullanıcı yüzüne `HukukTakip`) **Claude Designer**'a tanıtmak için yazıldı. Designer bu brief'le uygulamanın amacını, akışını, mevcut estetiğini ve redesign hedeflerini anlayıp kapsamlı bir UI/UX revizyonu önerecek.
>
> Dosyayı okurken **mevcut durumu** ve **geliştirilmesini istediğim yönü** ayırdığıma dikkat et. Başlıklarda "Mevcut", "Sorun", "Hedef" etiketleri kullanılıyor.

---

## 1. Ürün Özeti (TL;DR)

**Themis**, 2-5 kişilik hukuk bürolarının günlük işini yöneten full-stack web uygulamasıdır (PWA destekli). Avukat birincil kullanıcı. Masaüstünde "gün planlaması merkezi", cep telefonunda "adliyeyi işaretleme + müvekkil aratma" modunda çalışıyor.

**İşlevsel kapsam:**
- Müvekkil CRM (bireysel/kurumsal, aktif/pasif, soft-delete)
- Dava yönetimi (10 dava tipi, 8 durum, esas numarası, mahkeme, anlaşılan ücret)
- Duruşma takvimi (Google Calendar senkron, 3 gün + 1 gün önce otomatik bildirim)
- Görev yönetimi (priorite, due date, atama)
- Masraf + tahsilat (her davada bakiye hesabı)
- **Arabuluculuk dosyaları** (ayrı entity, taraflar, anlaşılan ücret, tahsilat — yeni)
- Ön görüşme (kaynağı takipli: tavsiye/google/website; potansiyel→müvekkil dönüşüm)
- Aylık istatistik (dava sayısı, gelir, tahsilat oranı, bekleyen ücret)
- Yardımcı hesap araçları (işçilik alacakları, miras payı, infaz, arabulucu ücreti, faiz)
- AI otomasyonları (dava detayında 11 sekme: araştırma, usul, dilekçe vb. — şu an kısıtlı, redesign öncelikli değil)

**İşlevsel olmayan öncelikler:**
- **Hız hissi**: Avukat tıkladığı anda ekranın cevap vermesini istiyor. "Loading, bekleyin" görmek istemiyor.
- **Ciddiyet**: Hukuk bürosu estetiği, emoji yok, gereksiz süsleme yok.
- **Mobile parity**: Telefonda da bütün kritik işlemler yapılabilmeli.
- **Türkçe yerli his**: İngilizceden birebir çeviri hissi vermemeli.

---

## 2. Kullanıcı Profili

### Birincil: Avukat (Aykut)
- **Teknik seviye**: Kod yazmıyor, "uygulama" kullanıyor. Terminal, yüklenme göstergesi, JSON gibi şeyler yabancı.
- **Zaman baskısı**: Gün içinde ~10 dava arasında mekik dokuyor. Sabah duruşma, öğlen müvekkil görüşmesi, akşam dilekçe — arada 2 dakika açık bilgisayar.
- **Hassasiyet**: Duruşma kaçırma → dosya kaybı. Tahsilat unutma → gelir kaybı. Bunlar için sistem ikonik güven vermeli.
- **Cihaz**:
  - Masaüstü Windows 11, Chrome, geniş ekran. *Ana çalışma yeri.*
  - iPhone (Safari). Adliyede, yolda, müvekkil karşısında. *Sık ama kısa etkileşim.*

### İkincil: Büro asistanı / stajyer avukat
- Görev durumu günceller, belge yükler, evrak tarihlerini girer
- Daha az yetkiye sahip (rol bazlı erişim: admin, lawyer, assistant)

### Şu an aktif oturum: **çoklu cihaz, tek kullanıcı** senaryosu. Gelecekte 3-5 kişili büro.

---

## 3. Temel Kullanıcı Akışları (must-support)

### Akış 1 — Yeni dava açma (en sık)
1. Dashboard → "Yeni Dava" (üst sağ, hemen görünür)
2. Müvekkil seç (autocomplete) veya "+ Yeni Müvekkil" dialog açılır
3. Dava tipi (select), esas no, mahkeme, başlangıç tarihi, anlaşılan ücret
4. Kaydet → dava detayına yönlendir

### Akış 2 — Duruşma günü sabahı
1. Dashboard'u aç → "Önümüzdeki 7 Gün" listesinde bugünkü duruşma
2. Davaya tıkla → detay → duruşma notları
3. Adliyede not al → mobilde aynı davaya gir → "Görev ekle: temyiz dilekçesi hazırla"

### Akış 3 — Tahsilat alma
1. Dashboard → "Bekleyen Tahsilat" kartı ya da liste
2. İlgili dava/arabuluculuk → "Tahsilat ekle" — tutar, tarih, ödeme yöntemi
3. Bakiye otomatik güncellenir

### Akış 4 — Arabuluculuk dosyası (yeni eklenmiş akış)
1. Sol menüden "Arabuluculuk Dosyaları"
2. "Yeni Dosya" → dosya no, uyuşmazlık türü, taraflar (başvurucu + karşı taraf), **anlaşılan ücret**
3. Dosya kart olarak listede. Tıklayınca expand → taraflar detayı + **ücret ve tahsilat paneli** (progress bar)
4. "Tahsilat ekle" — dosya bazlı takip

### Akış 5 — Ay sonu gelir raporu
1. İstatistikler sayfası
2. **Aylık Gelir** grafiği (dava + arabuluculuk **stacked bar**)
3. "Bu ay" 3 kartı: Dava geliri | Arabuluculuk geliri | Toplam
4. Bekleyen Tahsilatlar tablosu (kaynak tipi işaretli)

### Akış 6 — Müvekkil arama (telefon görüşmesi sırasında)
1. Header'da global arama kutusu (şu an `ActionSearchBar` var)
2. İsim/TC yaz → anında öneri: müvekkil + davası + telefon
3. Tıkla → detay

---

## 4. Sayfa Envanteri

| Rota | Sayfa | Kritikliği | Cihaz Önceliği | Not |
|------|-------|-----------|----------------|-----|
| `/login` | Giriş | Kritik | D+M | Tek alan (e-posta, şifre), logo |
| `/dashboard` | Gösterge Paneli | **En kritik** | D+M | Avukatın gün açılışı |
| `/cases` | Dava Listesi | Kritik | D | Arama, filtre (durum/tip), kağıtlama |
| `/cases/new`, `/cases/:id/edit` | Dava Formu | Orta | D+M | Uzun form, mobilde sticky footer gerekli |
| `/cases/:id` | Dava Detay | **Çok önemli** | D+M | Özet + duruşmalar + görevler + masraf + tahsilat + belge + not. Tek sayfada. |
| `/clients` | Müvekkil Listesi | Orta | D+M | Basit liste |
| `/clients/new`, `/clients/:id/edit` | Müvekkil Formu | Orta | D+M | Uzun form, mobilde sticky footer |
| `/clients/:id` | Müvekkil Detay | Orta | D | Davalar + belgeler + notlar |
| `/hearings` | Tüm Duruşmalar | Orta | D+M | Takvim + liste hibrit |
| `/tasks` | Görevler | Orta | D+M | Kanban veya tablo |
| `/consultations` | Ön Görüşmeler | Orta | D+M | CRM tarzı, ısı ölçümü |
| `/calendar` | Aylık Takvim | Düşük | D | Şu an basit. Görsel olabilir. |
| `/notifications` | Bildirimler | Düşük | D+M | Liste |
| `/statistics` | İstatistikler | Orta | D | Grafikler, ay sonu gelir |
| `/tools/mediation-files` | Arabuluculuk Dosyaları | **Çok önemli (yeni)** | D+M | Taraflar + ücret + tahsilat |
| `/tools/calculations` | Hesaplamalar | Orta | D | İşçilik alacakları vb. |
| `/tools/inheritance` | Miras Payı | Düşük | D | |
| `/tools/sentence` | İnfaz Hesabı | Düşük | D | |
| `/tools/prompts` | AI Komutları | Düşük | D | |
| `/tools/mediation` | Arabuluculuk Belgeleri | Düşük | D | Şablon indir |
| `/settings` | Ayarlar | Düşük | D | Profil, tema, API anahtarları |

**D** = Desktop, **M** = Mobile.

---

## 5. Mevcut Tasarım Sistemi

### Renk (CSS variable tabanlı, dark mode destekli)

```css
/* Ana renkler (açık tema) */
--law-primary: 215 50% 25%    /* Koyu kurumsal mavi - başlıklar */
--law-accent:  217 91% 60%    /* Orta mavi - butonlar, aktif */
--law-gold:    38  86% 45%    /* Altın - vurgu, aktif sekme işareti */
--gold-light:  38  92% 70%

--law-success: 152 56% 33%    /* Yeşil - kazanıldı, tahsil */
--law-warning: 38  95% 45%    /* Turuncu - beklemede, bekleyen ücret */
--law-danger:  0   72% 42%    /* Kırmızı - acil, kaybedildi */

--background:  0   0% 98%     /* #F7F7F8 açık gri */
--law-surface: 0   0% 100%    /* beyaz */
--sidebar-bg:  215 40% 16%    /* koyu lacivert */
```

Tailwind üzerinden `bg-law-primary`, `text-law-accent`, `ring-law-gold` gibi sınıflarla kullanılıyor. Her renk CSS variable'a bağlı → dark mode otomatik çevriliyor.

### Tipografi
- **Başlık**: `EB Garamond` (serif, klasik hukuki hissi)
- **İçerik**: `Lato` (sans-serif, okunabilir)
- Google Fonts ile yüklü, `asyncFont` optimizasyonu var.

### Yuvarlama
- `--radius: 0.5rem` (8px). Butonlar `rounded-lg`, kartlar `rounded-xl` veya `rounded-2xl`.

### Bileşen kitaplığı
- **Shadcn/ui** (Radix primitives üstüne kurulu): Button, Card, Dialog, Input, Select, Tabs, Tooltip, Badge, Avatar, Checkbox, DropdownMenu, ScrollArea, Separator, Skeleton, Switch, Popover, Label
- **Lucide React** ikonları
- **Sonner** toast bildirim
- **Recharts** grafikler (BarChart, PieChart, ResponsiveContainer)

### Kullanılan pattern'ler
- Stat kartları (gradient + ikon, 2x2 veya 5'li grid)
- Kart-tabanlı liste (expand/collapse akordeon)
- Dashboard "4 kart + 2 büyük panel" layout
- Skeleton screens her liste/detay sayfasında
- Filter chip'leri (rounded-full, scroll-x)
- Sidebar: kapalı/açık toggle, mobilde drawer (Sheet), masaüstünde sabit

---

## 6. UX Ağrı Noktaları (Avukatın Kendi Sözleri)

> **1. "Yavaş ve akıcı değil, hızı hissedemiyorum."**
> Sekme değiştirirken, veri girerken, liste yüklenirken beklemek istemiyor. "Tıkla-cevap" döngüsü gecikmemeli.
>
> (Bu iş boyutunda backend `/api/dashboard/summary` birleştirildi, `/api/cases/:id/detail` tek roundtrip oldu, `keepPreviousData` pagination'da flash kesti. Ama hâlâ *algısal* hız için UI motion/transition desteği bekleniyor — burası designer'a iş.)

> **2. "Telefonda formda güncelle butonu kesiliyor."**
> Çözüldü: mobilde `sticky footer` + `safe-area-inset-bottom`. Ama tüm formlarda standart değildi, sadece 3 forma uygulandı. Redesign sırasında form şablonunu unify etmek iyi olur.

> **3. "Gelir netlik yok — hem dava hem arabulucu para getiriyor, karışmasın."**
> Çözüldü: dashboard + statistics'te dava vs arabuluculuk ayrıştırıldı. Ama görsel olarak daha güçlü olabilir (sparkline, mini bar, renk kodlu).

> **4. "Ciddiye alayım istiyorum, lüks pastel olmasın."**
> Renk paleti zaten koyu mavi/altın (kurumsal hukuk tonu). Devam.

> **5. "Dava detay sayfası çok kalabalık."**
> 6 panel tek sayfada. Bu çözüm görünürlüğü artırıyor (tek scroll'da her şey) ama telefonda uzuyor. Alternatif: tab yapısı (ama 7 tab çok). Mobilde accordion olabilir, desktop'ta 2-kolonlu devam.

> **6. "Bildirim sistemi sessiz."**
> Avukat farkında bile değil bildirim geldiğinden. Redesign'da daha canlı (badge, ses mi?, toast mı?) düşünülebilir.

---

## 7. Korunması Gereken Güçlü Yanlar

- **Koyu mavi + altın kurumsal kimlik**: Avukat bu renk kodlarını sahipleniyor. Değişmesin.
- **EB Garamond / Lato tipo çiftlisi**: Hukuki hissiyatı taşıyor, korunabilir.
- **Kart tabanlı liste pattern'i**: Tanıdık, okunaklı.
- **Türkçe lokalizasyon**: Her label Türkçe ve ciddi üslupla.
- **Shadcn/ui + Radix altyapısı**: Erişilebilir, klavye dostu. Radix primitives'ten kopma.
- **CSS variables ile renk sistemi**: Dark mode otomatik. Korunmalı.
- **Mobile bottom nav** (5 sekme: Panel / Davalar / Takvim / Görevler / Müvekkil): Mobilde temel dolaşım doğru kurulmuş.

---

## 8. Redesign Hedefleri (Designer'a Yönlendirme)

### Ana hedef: **"Hızlı ve ciddi"**

### 1. Algısal hız (Motion + Progressive Disclosure)
- **Mikro animasyonlar**: Sayfa geçişlerinde opacity fade + translateY(4-8px) — 200ms. Sekme değiştirirken hiç "boş ekran anı" olmamalı.
- **Skeleton yerine shimmer**: Stateful skeleton cachelenmiş veriyle birleştirilmeli. React Query `placeholderData: keepPreviousData` zaten var; designer bunu görsel olarak kullanmalı.
- **Optimistic UI**: Task status, note ekleme, collection ekleme gibi hızlı işlemlerde buton tıklandığı anda sonuç görünmeli.
- **View transitions API** keşfedilebilir (Chrome 117+).

### 2. Bilgi yoğunluğu + okunabilirlik dengesi
- Dashboard'da avukat sabah 8 sn'de gününü kavramalı. Şu anki 5 stat kartı + 2 büyük panel iyi ama daha *akıllı* olabilir:
  - Bugün duruşma var mı → kırmızı/turuncu uyarı şeridi üstte
  - Beklenen tahsilat toplamı şu an vurguluyor ama görsel agresifliği eksik — "kazan-kazan" hissi verecek renk denemesi

### 3. Mobil "telefonla iş yapma" modu
- Tek elle kullanım: sık işlemler ekran altında (thumb zone).
- Bottom nav 5 sekme — bunun üzerine ek "quick action" FAB düşünülebilir ("Yeni not ekle" gibi).
- Form input'lar büyük dokunma hedefi, keyboard affordance.

### 4. Görselleştirme iyileştirmesi
- **Aylık gelir grafiği**: Şu an stacked bar var. Alternatif: sparkline + compare (last month vs this month). Belki "gelir momentum" kartı.
- **Bekleyen ücret**: Tek sayı yerine "5 dosyadan toplam ₺X" + top-3 mini liste kartın içinde.
- **Dava timeline**: Dava detayında açılıştan bugüne timeline (duruşma, ödeme, belge eklenmiş) bir grafik.

### 5. Sessizlik karşıtı bildirim
- "Hatırlatma"lar canlı olsun. Header'da badge sayısı şu an küçük. Belki renk + mikro animasyon.
- Kritik duruşma yaklaşırken dashboard'da kalıcı uyarı şeridi.

### 6. Ikonografi
- Hukuk temalı lucide alternatifleri: `Gavel`, `Scale`, `FileText`, `BookOpen`, `Briefcase` zaten kullanımda — bunları daha tutarlı kullanmak.

### 7. Empty state'ler
- "Henüz arabuluculuk dosyanız yok" gibi empty screen'ler şu an çok sade. İllüstrasyonlu veya "ilk adım" CTA'lı olabilir.

### 8. Dark mode gerçek kullanım
- Şu an dark mode var ama optimize değil. Designer hem light hem dark için birebir tutarlı palette önermeli.

### 9. Loading UX
- 4 saniye NetworkFirst timeout sonra cache. Bu sırada kullanıcıya ne gösteriliyor? "Son bilinen veri" etiketi + yenilenme çemberi.

### 10. Print / PDF çıktısı
- Dava detayı, istatistik, tahsilat raporları yazdırılabilir görünüm gerek (kaşe/imza bölümü ayrılmış).

---

## 9. Teknik Kısıtlar (Designer'ın Uyması Gereken)

### Altyapı
- **React + Vite + TypeScript** — değişmez
- **Tailwind CSS** — tüm stiller Tailwind class'larıyla gelmeli, inline CSS yok
- **Shadcn/ui** — bileşenler bu kütüphaneyi baz almalı, tam custom bileşen minimum
- **Radix primitives** — erişilebilirlik için üstüne kurulu pattern'ler korunsun
- **Lucide React** — ikon seti
- **Recharts** — grafikler (alternatif kütüphane önermeyin, bundle büyür)

### Performans
- Bundle size: şu an `vendor-charts` ~500KB ayrı chunk (lazy). Yeni ağır kütüphane eklemeyin.
- Web fonts async yüklü, **en fazla 2 font family** (EB Garamond + Lato).
- Lazy-loaded routes (React.lazy + Suspense) — designer her sayfayı bağımsız component varsaysın.
- PWA: uygulama offline shell + API runtime cache (NetworkFirst 4s timeout).

### Mobil
- iOS Safari: `env(safe-area-inset-bottom)` dikkat, `visualViewport` API'leri.
- Android Chrome: `inputMode` önemli, klavye tipini doğru seç.
- Touch targets: min 44x44px (Apple HIG).

### Dil
- Tüm metin Türkçe. Formlar, butonlar, hata mesajları, empty state'ler. İngilizce kaçak yok.
- Tarih formatı: `GG.AA.YYYY`. date-fns tr locale.
- Para: `1.234,56 ₺` (tr-TR Intl).

### Erişilebilirlik
- WCAG AA minimum.
- Keyboard navigation her modalda çalışsın (Radix zaten sağlıyor).
- Screen reader label'ları TR.
- Kontrast oranı metin 4.5:1, büyük metin 3:1.

### Responsive breakpoint'ler (Tailwind default)
- `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1400px`.
- Sidebar `md`'den sonra sabit, `md`'den önce drawer.

---

## 10. Designer'dan Beklenenler

### Teslim edilecek tasarım çıktıları (öncelik sırasıyla)

1. **Dashboard** — en kritik ekran. Hem light hem dark. Hem mobile hem desktop.
   - Gün başı avukat açılışı için optimize
   - Bekleyen tahsilat + bugün duruşma + bugün görev net görünmeli

2. **Dava Detay** — 6 panel tek sayfada. Mobilde accordion, desktop'ta 2-kolon.
   - "Ben davam hakkında her şeyi burada görürüm" hissi

3. **Arabuluculuk Dosyaları listesi + detay** — yeni entity, tarafları + ücret paneli + tahsilat listesi tek expand'ta

4. **Form şablonu** — müvekkil/dava/arabuluculuk form'ları için birleşik pattern. Mobilde sticky footer zorunlu.

5. **Mobil Bottom Nav + Header** — 5 sekme + search + notifications

6. **İstatistikler** — aylık gelir kırılımı (dava vs arabuluculuk), bekleyen, kazanma oranı

### Bileşen tasarım rehberi (stil kılavuzu)
- Button (primary, secondary, ghost, destructive) — 4 varyant × 3 boyut
- Input (default, focus, error, disabled)
- Select / Combobox
- Card (default, bordered, gradient stat)
- Badge (8 semantic renk: default, success, warning, danger, info, gold, outline, secondary)
- Empty state bileşeni
- Timeline bileşeni (dava için)
- Progress bar (tahsilat için)
- Toast (Sonner ile uyumlu)
- Dialog / Sheet
- Skeleton (shimmer efektli)

### Motion rehberi
- Duration: 150ms (mikro), 250ms (geçiş), 400ms (giriş)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (Radix default)
- Stagger animation pattern'leri (liste giriş)

### Referans estetikler (designer kendi referansını bulur ama yön)
- **Linear**, **Superhuman**, **Notion** — algısal hız
- **Harvest**, **Stripe Dashboard** — finansal görselleştirme
- **ReactBits**, **MagicUI** — mikro animasyon bileşen ilhamı
- **Turkish hukuk firmaları websiteleri** — ciddi kurumsal ton (ama web sitesi değil, uygulama tasarlıyoruz)

---

## 11. Başarı Kriterleri

Designer'ın çıktısı şu soruları "EVET" yanıtlarsa başarılı:

- [ ] Avukat sabah dashboard'u açtığında 5 saniye içinde gününü planlayabiliyor mu?
- [ ] Telefonda formu doldururken "güncelle" butonu her an görünür mü?
- [ ] Arabuluculuk dosyası ile dava dosyasının gelirleri net ayırt edilebiliyor mu?
- [ ] Sekme değiştirince "yavaş" hissediyor mu yoksa "anlık" mı?
- [ ] Dark mode tamamen tutarlı mı? (Hiçbir ekranda yarım renk olmamalı.)
- [ ] Bir stajyer ilk kez girdiğinde, formu rehbersiz doldurabiliyor mu?
- [ ] Empty state'ler ("henüz dava yok" vb.) yönlendirici mi yoksa mahzun mu?
- [ ] Print görünümünde profesyonel rapor çıkıyor mu?
- [ ] WCAG AA kontrast testini her renk kombinasyonu geçiyor mu?
- [ ] Bundle size ≤ mevcut sınır (client ~500KB initial, recharts ayrı chunk)?

---

## 12. Ekler — Kodda Bulunabilecek Referans Dosyalar

Designer kodu incelemek isterse:

| Konu | Dosya |
|------|-------|
| Renk + CSS variables | `client/src/index.css` |
| Tailwind config | `client/tailwind.config.ts` |
| Mevcut layout | `client/src/components/layout/AppLayout.tsx` |
| Dashboard | `client/src/pages/DashboardPage.tsx` |
| Dava detay (6-panel) | `client/src/pages/CaseDetailPage.tsx` |
| Arabuluculuk (yeni) | `client/src/pages/MediationFilesPage.tsx` |
| İstatistikler | `client/src/pages/StatisticsPage.tsx` |
| Mobile bottom nav | `client/src/components/layout/MobileBottomNav.tsx` |
| Shadcn bileşenler | `client/src/components/ui/` |
| Paylaşılan (DataTable, FilterBar, StatusBadge) | `client/src/components/shared/` |
| Form pattern | `client/src/pages/ClientFormPage.tsx`, `CaseFormPage.tsx` |

Proje CLAUDE.md (detaylı şema + endpoint listesi): `hukuk-takip/CLAUDE.md`.

---

**Son not (Aykut'tan designer'a):**

> Bu uygulamada her gün çalışıyorum. Müvekkilimin telefonunu açtığımda, adliyede duruşma öncesi dosyayı kontrol ettiğimde, akşam tahsilatı kaydederken — her karede *"hızlı, ciddi, bana yardım ediyor"* hissetmek istiyorum. Güzel olsun ama süslü değil. Modern olsun ama pastel değil. Hukuki olsun ama 1990 avukatlık bürosu kliseleri olmasın. Bana "evet, bu benim uygulamam" dedirtecek bir dil bulmanı istiyorum.
