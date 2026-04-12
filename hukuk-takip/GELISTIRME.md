# GELISTIRME.md — HukukcuApp Ozellik Klonlama Plani

> HukukcuApp sitesinden 7 ozelligin mevcut hukuk-takip projesine entegrasyonu.
> Tum ozellikler React + TypeScript + shadcn/ui + Tailwind mimarisine uyarlanacak.

---

## Genel Mimari Kararlar

| Karar | Aciklama |
|-------|----------|
| **Framework** | Mevcut React + Vite + TypeScript altyapisi kullanilacak |
| **UI** | shadcn/ui componentleri (Card, Tabs, Select, Input, Dialog, Badge, Button, Table) |
| **Stil** | Tailwind CSS + mevcut tema degiskenleri (--law-primary, --law-accent vb.) |
| **Routing** | React Router — mevcut lazy-load + ProtectedRoute yapisi |
| **State** | React state (useState, useReducer) — hesaplamalar icin backend gereksiz |
| **API** | Ictihat aramasi icin mevcut Yargi MCP + Mevzuat MCP backend entegrasyonu |
| **Kayit** | localStorage (kullanici tercihleri, prompt favorileri) |
| **Hesaplama** | Tamami client-side — sunucuya veri gonderilmez |

---

## Klasor Yapisi (Eklenecek)

```
client/src/
├── pages/
│   ├── IctihatSearchPage.tsx          ← 1. Akilli Ictihat
│   ├── CalculationsPage.tsx           ← 2. Hesaplamalar (ana sayfa + tab router)
│   ├── AiPromptsPage.tsx              ← 3. AI Komut Sablonlari
│   ├── InheritancePage.tsx            ← 4+7. Miras Payi Hesaplama
│   ├── MediationDocumentsPage.tsx     ← 5. Arabuluculuk Belgeleri
│   └── SentenceCalcPage.tsx           ← 6. Infaz Hesaplama
├── components/
│   ├── tools/
│   │   ├── ictihat/
│   │   │   ├── IctihatSearchForm.tsx
│   │   │   ├── IctihatResultCard.tsx
│   │   │   └── IctihatDetailModal.tsx
│   │   ├── calculations/
│   │   │   ├── LaborCalc.tsx          ← Iscilik alacaklari
│   │   │   ├── AttorneyFeeCalc.tsx    ← Vekalet ucreti
│   │   │   ├── MediatorFeeCalc.tsx    ← Arabulucu ucreti
│   │   │   ├── InterestCalc.tsx       ← Faiz hesaplama
│   │   │   ├── AccidentCompCalc.tsx   ← Is/Trafik kazasi tazminat
│   │   │   └── CourtFeeCalc.tsx       ← Harc hesaplama
│   │   ├── prompts/
│   │   │   ├── PromptCard.tsx
│   │   │   └── promptData.ts          ← 9 sablon verisi
│   │   ├── inheritance/
│   │   │   ├── FamilyTreeBuilder.tsx
│   │   │   ├── InheritanceResult.tsx
│   │   │   └── ProtectedShareModal.tsx
│   │   ├── mediation/
│   │   │   ├── InvitationForm.tsx
│   │   │   ├── FirstSessionForm.tsx
│   │   │   ├── FinalReportForm.tsx
│   │   │   ├── AgreementForm.tsx
│   │   │   └── mediationBureaus.ts    ← 81 il buro listesi
│   │   └── sentence/
│   │       ├── SentenceCalcForm.tsx
│   │       ├── SentenceResult.tsx
│   │       └── StatuteOfLimitationsCalc.tsx
│   └── shared/
│       └── PrintableDocument.tsx       ← Yazdir / PDF indir wrapper
├── lib/
│   ├── calculations/
│   │   ├── labor.ts                   ← Iscilik hesaplama formuelleri
│   │   ├── attorneyFee.ts             ← AAUT 2025-2026 tarife
│   │   ├── mediatorFee.ts             ← Arabulucu tarife
│   │   ├── interest.ts                ← Faiz oranlari + donemsel hesap
│   │   ├── accidentComp.ts            ← TRH2010 + progesif rant
│   │   ├── courtFee.ts                ← Harc oranlari
│   │   ├── inheritance.ts             ← TMK zumre sistemi + sakli pay
│   │   └── sentence.ts                ← Infaz oranlari + DS sureleri
│   └── constants/
│       ├── legalRates2026.ts          ← Kidem tavani, asgari ucret, harc oranlari
│       ├── sentenceRates.ts           ← Suc turu → infaz orani esleme
│       └── trh2010.ts                 ← Yasam tablosu (erkek + kadin)
server/src/
└── routes/
    └── tools.ts                       ← Ictihat arama backend endpoint
```

---

## Ozellik 1: Akilli Ictihat Aramasi

### Aciklama
Mevcut Yargi MCP'yi (bedesten search/doc) kullanan bagimsiz arama sayfasi.
HukukcuApp'in Gemini API yaklasimi yerine bizim mevcut CLI araclarimiz kullanilacak.

### Farklar (HukukcuApp vs Bizim Uygulama)
| HukukcuApp | Bizim | Neden |
|------------|-------|-------|
| Gemini API ile "akilli" arama | Yargi MCP + opsiyonel Claude analiz | Gercek karar veritabanina erisim var |
| Client-side API key | Server-side backend | Guvenlik — API key sunucuda |
| Gunluk 20 kota (localStorage) | Kullaniciya bagli kota (opsiyonel) | Auth sistemi mevcut |
| Daire + tarih filtresi | Daire + tarih + mahkeme turu filtresi | Yargi MCP daha zengin filtre destekler |

### Sayfa: `IctihatSearchPage.tsx`
- Arama kutusu: textarea (dogal dil vaka aciklamasi)
- Filtreler: Daire secimi (H1-H22, HGK), tarih araligi, mahkeme turu
- Sonuclar: Karar kartlari listesi
- Detay: Dialog modal ile tam metin
- Opsiyonel: Claude ile "Benzer kararlari analiz et" butonu

### Backend: `POST /api/tools/ictihat-search`
```typescript
// Girdi
{ query: string, chamber?: string, dateStart?: string, dateEnd?: string, courtType?: string }

// Islem
1. yargi bedesten search "query" -c courtType -b chamber --date-start dateStart
2. Ilk 10 sonuc icin yargi bedesten doc <documentId>
3. Sonuclari JSON olarak don

// Cikti
{ results: Array<{ documentId, daire, esasNo, kararNo, tarih, ozet, tamMetin? }> }
```

### Oncelik: YUKSEK
### Tahmini Dosya Sayisi: 5 dosya (1 sayfa, 3 component, 1 backend route)

---

## Ozellik 2: Hesaplamalar Boluemu

### Aciklama
6 farkli hesaplama araci tek sayfada tab sistemiyle sunulur.
Tum hesaplamalar client-side — backend gereksiz.

### Alt Moduller

#### 2.1 Iscilik Alacaklari
- **Kaynak:** Mevcut `iscilik-hesaplama.md` formulleri (CLAUDE.md'de tanimli)
- **Girdiler:** Ise giris/cikis tarihi, brut ucret, yan odemeler, izin gunleri
- **Ciktilar:** Kidem, ihbar, fazla mesai, UBGT, hafta tatili, yillik izin
- **Ozel:** Donemsel kidem tavani tablosu, kademeli vergi hesabi
- **Not:** CLAUDE.md'deki MODUL 1-9 formulleri aynen kullanilacak

#### 2.2 Vekalet Ucreti
- **Kaynak:** AAUT 2025-2026 (10 kademeli dilim)
- **Girdiler:** Mahkeme turu, dava turu (nispi/maktu), dava degeri, asama, seri dava
- **Ozel:** On inceleme oncesi 1/2 indirimi, seri dava kademeli indirimi

#### 2.3 Arabulucu Ucreti
- **Kaynak:** 2026 Arabuluculuk Asgari Ucret Tarifesi
- **Girdiler:** Uyusmazlik turu, konu, sonuc, sure, deger, taraf sayisi
- **Ozel:** Anlasmali/anlasmaz fark, nispi/saatlik secimi

#### 2.4 Faiz Hesaplama
- **Kaynak:** Yasal + ticari avans faiz oranlari (tarih bazli)
- **Girdiler:** Anapara, baslangic/bitis tarihi, faiz turu
- **Ozel:** Donemsel oran degisimlerini otomatik uygula

#### 2.5 Is/Trafik Kazasi Tazminat
- **Kaynak:** TRH 2010 yasam tablosu, progresif rant (%10/%10)
- **Girdiler:** Dogum/kaza/hesap tarihi, cinsiyet, maluliyet, kusur, gelir
- **Ozel:** Aktueeryal hesaplama, calisma yasi siniri

#### 2.6 Harc Hesaplama
- **Kaynak:** 2026 Yargi Harclari
- **Girdiler:** Islem turu, konu, deger, taraf/tanik/bilirkisi sayisi
- **Ozel:** Nispi/maktu secimi, gider avansi otomatik hesap

### Sayfa: `CalculationsPage.tsx`
```tsx
<Tabs defaultValue="labor">
  <TabsList>
    <TabsTrigger value="labor">Iscilik Alacaklari</TabsTrigger>
    <TabsTrigger value="attorney">Vekalet Ucreti</TabsTrigger>
    <TabsTrigger value="mediator">Arabulucu Ucreti</TabsTrigger>
    <TabsTrigger value="interest">Faiz</TabsTrigger>
    <TabsTrigger value="accident">Is/Trafik Kazasi</TabsTrigger>
    <TabsTrigger value="court">Harc</TabsTrigger>
  </TabsList>
  <TabsContent value="labor"><LaborCalc /></TabsContent>
  ...
</Tabs>
```

### Oncelik: YUKSEK
### Tahmini Dosya Sayisi: 14 dosya (1 sayfa, 6 component, 7 lib/hesaplama)

---

## Ozellik 3: Yapay Zeka Komut Sablonlari

### Aciklama
9 profesyonel hukuki prompt sablonu accordion/kart gorunumunde.
Kopyalama ve MD indirme ozelligi.

### Sablonlar (promptData.ts)
1. Hukuki Strateji Belirleme (Game Theory)
2. Dava Strateji Analizi
3. Evrensel Dilekce Sablonu
4. Ise Iade Davasi Dilekce
5. Istinaf / Temyiz Layihasi
6. Bilirkisi Raporu Analizi
7. Sozlesme Inceleme
8. Ihtarname Hazirlama
9. Muvekkil Bilgilendirme

### Sayfa: `AiPromptsPage.tsx`
- Kategori filtreleme (Stratejik Planlama, Dilekce, Is Hukuku, vb.)
- Accordion kartlar — tiklayinca prompt icerigi acilir
- "Kopyala" butonu (navigator.clipboard)
- "MD Indir" butonu (Blob + download)
- Opsiyonel: "Simdi Claude'a Gonder" butonu (mevcut AI altyapisina bagla)

### Oncelik: DUSUK (en hizli yapilacak, 1-2 saat)
### Tahmini Dosya Sayisi: 3 dosya (1 sayfa, 1 component, 1 data)

---

## Ozellik 4+7: Miras Payi Hesaplama

### Aciklama
TMK'ya gore 1., 2. ve 3. zumre sistemi ile miras payi hesaplama.
Gorsel soyagaci arayuzu + sakli pay (mahfuz hisse) gosterimi.

### Hesaplama Mantigi (lib/inheritance.ts)
```
Sag kalan es payi:
  1. zumreyle (cocuklar) → 1/4
  2. zumreyle (anne-baba) → 1/2
  3. zumreyle (buyukanne-buyukbaba) → 3/4
  Tek basina → tamamini alir

Altsoy (1. zumre): Kalan pay esit bolunur
Anne-baba (2. zumre): Kalan pay esit bolunur
  - Biri vefat ettiyse → onun payi altsoyuna (kardes)
  - Altsoy yoksa → diger ebeveyne

Sakli paylar (TMK 506):
  Altsoy → yasal payin 1/2'si
  Anne-baba → yasal payin 1/4'u
  Sag kalan es → yasal payin tamami
```

### Sayfa: `InheritancePage.tsx`
- Miras tutari giris alani
- Gorsel soyagaci: Mirasbırakan dugumu + dinamik mirasci ekleme
- Mirasci ekleme butonlari: Es, Cocuk, Anne, Baba
- Her mirasciya ozel "Kaldir" butonu
- Hesapla butonu → sonuc tablosu (ad, zumre, %, tutar)
- Sakli Pay butonu → Dialog modal ile TMK 506 tablosu

### Oncelik: ORTA
### Tahmini Dosya Sayisi: 5 dosya (1 sayfa, 3 component, 1 lib)

---

## Ozellik 5: Arabuluculuk Belgeleri

### Aciklama
4 asamali form: Davet Mektubu, Ilk Oturum Tutanagi, Son Tutanak, Anlasma Belgesi.
Tum belgeler yazdirilabilir / PDF olarak indirilebilir.

### Form Asamalari
| Asama | Belge | Ozel Alanlar |
|-------|-------|-------------|
| 1 | Davet Mektubu | Arabuluculuk no, buro, taraflar, uyusmazlik, toplanti yeri/tarihi |
| 2 | Ilk Oturum Tutanagi | Katilimcilar, vekiller, uyusmazlik konusu ozeti |
| 3 | Son Tutanak | Sonuc (anlasma/anlasmazlik), oturum sayisi, sure |
| 4 | Anlasma Belgesi | Anlasma maddeleri, tazminat tutarlari, taksit plani |

### Ortak Form Alanlari
- Arabuluculuk no, buro dosya no
- Buro secimi (81 il — mediationBureaus.ts'de tum liste)
- Arabulucu bilgileri (ad, sicil, adres)
- Basvuran taraf (ad, TC, vekil)
- Karsi taraf (ad, TC, vekil)
- Uyusmazlik turu ve konusu

### Sayfa: `MediationDocumentsPage.tsx`
```tsx
<Tabs defaultValue="invitation">
  <TabsList>
    <TabsTrigger value="invitation">Davet Mektubu</TabsTrigger>
    <TabsTrigger value="first-session">Ilk Oturum</TabsTrigger>
    <TabsTrigger value="final-report">Son Tutanak</TabsTrigger>
    <TabsTrigger value="agreement">Anlasma</TabsTrigger>
  </TabsList>
  ...
</Tabs>
```

### Cikti
- Onizleme: Dialog modal
- Yazdir: window.print() ile print-friendly layout
- PDF: react-pdf veya window.print() PDF secenegi

### Oncelik: ORTA
### Tahmini Dosya Sayisi: 8 dosya (1 sayfa, 4 form, 1 shared, 1 data, 1 lib)

---

## Ozellik 6: Infaz Hesaplama

### Aciklama
7550 SK ve 7571 SK'ya gore ceza infaz suresi hesaplama.
Kosullu saliverlme, denetimli serbestlik ve bihakkin tahliye.

### Hesaplama Mantigi (lib/sentence.ts)

**Infaz Oranlari (suc turune gore):**
| Suc Kategorisi | Oran |
|---------------|------|
| Adi suclar | 1/2 |
| Kasten yaralama TCK 86, 87 | 1/2 |
| Kasten oldurme TCK 81 | 2/3 |
| Nitelikli kasten oldurme TCK 82 | 3/4 |
| Iskence, eziyet | 3/4 |
| Cocuk cinsel istismari | 3/4 |
| Cinsel saldiri (basit) | 2/3 |
| Cinsel saldiri (nitelikli) | 3/4 |
| Uyusturucu ticareti | 3/4 |
| Teror suclari 3713 SK | 3/4 |
| Muebbet | 24 yil |
| Agirlastirilmis muebbet | 30 yil |

**Tekerrur:**
- 1. tekerrur → min 2/3
- 2. tekerrur (7550 SK) → 3/4 zorunlu

**Denetimli Serbestlik:** min 5 gun + infaz suresinin 1/10'u

### Sayfa: `SentenceCalcPage.tsx`
- Ceza bilgileri: yil/ay/gun + ceza turu (sureli/muebbet/agir muebbet)
- Tarih bilgileri: suc tarihi, kesinlesme, infaza baslama, dogum, gozalti
- Suc turu secimi (dropdown — 17 kategori)
- Tekerrur durumu
- Ozel durum (cocuk, 65+, kadin, engelli vb.)
- Sonuc grid: mevzuat, oran, kosullu tarih, denetimli serbestlik, bihakkin

### Alt Sekme: Dava Zamanasimi
- Suc turu → zamanasimi suresi otomatik
- Tarih hesaplama

### Oncelik: ORTA
### Tahmini Dosya Sayisi: 5 dosya (1 sayfa, 2 component, 1 lib, 1 constants)

---

## Uygulama Plani — Adim Adim

### Faz 1: Altyapi (Tum ozellikler icin ortak)

**Adim 1.1:** Router + Navigation guncellemesi
- `App.tsx`'e 6 yeni route ekle (lazy import)
- `Sidebar.tsx`'e "Araclar" grubu ekle (Calculator, Search, FileText, Scale, Shield, BookOpen ikonlari)

**Adim 1.2:** Ortak bilesenler
- `PrintableDocument.tsx` — yazdir/PDF wrapper component
- `ToolPageHeader.tsx` — Arac sayfalari icin ozel header (kaynak badge'i dahil)

**Adim 1.3:** Sabitler dosyalari
- `legalRates2026.ts` — Kidem tavani, asgari ucret, harc, AAUT dilimleri
- `sentenceRates.ts` — Infaz oranlari
- `trh2010.ts` — Yasam tablosu

### Faz 2: Hesaplamalar (En kapsamli — once baslat)

**Adim 2.1:** `lib/calculations/labor.ts` — Iscilik hesaplama fonksiyonlari
**Adim 2.2:** `LaborCalc.tsx` — UI component (alt tablar: fesih, fazla mesai, UBGT, hafta tatili)
**Adim 2.3:** `lib/calculations/attorneyFee.ts` + `AttorneyFeeCalc.tsx`
**Adim 2.4:** `lib/calculations/mediatorFee.ts` + `MediatorFeeCalc.tsx`
**Adim 2.5:** `lib/calculations/interest.ts` + `InterestCalc.tsx`
**Adim 2.6:** `lib/calculations/accidentComp.ts` + `AccidentCompCalc.tsx`
**Adim 2.7:** `lib/calculations/courtFee.ts` + `CourtFeeCalc.tsx`
**Adim 2.8:** `CalculationsPage.tsx` — Ana sayfa + tab sistemi

### Faz 3: AI Prompt Sablonlari (En hizli)

**Adim 3.1:** `promptData.ts` — 9 sablon verisi
**Adim 3.2:** `PromptCard.tsx` — Accordion kart component
**Adim 3.3:** `AiPromptsPage.tsx` — Ana sayfa + kategori filtresi

### Faz 4: Miras Payi Hesaplama

**Adim 4.1:** `lib/calculations/inheritance.ts` — TMK zumre hesaplama
**Adim 4.2:** `FamilyTreeBuilder.tsx` — Gorsel soyagaci + mirasci ekleme
**Adim 4.3:** `InheritanceResult.tsx` + `ProtectedShareModal.tsx`
**Adim 4.4:** `InheritancePage.tsx` — Ana sayfa

### Faz 5: Infaz Hesaplama

**Adim 5.1:** `lib/calculations/sentence.ts` — Infaz formulleri
**Adim 5.2:** `SentenceCalcForm.tsx` + `SentenceResult.tsx`
**Adim 5.3:** `StatuteOfLimitationsCalc.tsx` — Zamanasimi alt sekmesi
**Adim 5.4:** `SentenceCalcPage.tsx` — Ana sayfa

### Faz 6: Arabuluculuk Belgeleri

**Adim 6.1:** `mediationBureaus.ts` — 81 il buro listesi
**Adim 6.2:** `InvitationForm.tsx` + `FirstSessionForm.tsx`
**Adim 6.3:** `FinalReportForm.tsx` + `AgreementForm.tsx`
**Adim 6.4:** `MediationDocumentsPage.tsx` — Ana sayfa + tab sistemi

### Faz 7: Akilli Ictihat Aramasi

**Adim 7.1:** `server/src/routes/tools.ts` — Backend endpoint (Yargi MCP entegrasyonu)
**Adim 7.2:** `IctihatSearchForm.tsx` — Arama formu + filtreler
**Adim 7.3:** `IctihatResultCard.tsx` + `IctihatDetailModal.tsx`
**Adim 7.4:** `IctihatSearchPage.tsx` — Ana sayfa
**Adim 7.5:** Client hook: `useIctihatSearch()` — React Query mutation

---

## Sidebar Navigasyon Guncellemesi

```tsx
// Mevcut navigasyon altina "ARACLAR" grubu ekle:
{
  group: 'Araclar',
  items: [
    { path: '/tools/ictihat', label: 'Ictihat Arama', icon: Search },
    { path: '/tools/calculations', label: 'Hesaplamalar', icon: Calculator },
    { path: '/tools/prompts', label: 'AI Sablonlari', icon: Sparkles },
    { path: '/tools/inheritance', label: 'Miras Payi', icon: Scale },
    { path: '/tools/mediation', label: 'Arabuluculuk', icon: FileText },
    { path: '/tools/sentence', label: 'Infaz Hesabi', icon: Shield },
  ]
}
```

---

## Route Yapisi

```tsx
// App.tsx'e eklenecek route'lar:
<Route path="tools">
  <Route path="ictihat" element={<IctihatSearchPage />} />
  <Route path="calculations" element={<CalculationsPage />} />
  <Route path="prompts" element={<AiPromptsPage />} />
  <Route path="inheritance" element={<InheritancePage />} />
  <Route path="mediation" element={<MediationDocumentsPage />} />
  <Route path="sentence" element={<SentenceCalcPage />} />
</Route>
```

---

## Tasarim Uyumu

Mevcut tema degiskenleri kullanilacak:
- Kart arka plani: `bg-card` (var(--card))
- Birincil renk: `text-primary` (var(--primary))
- Vurgu: `text-[var(--law-accent)]`
- Altin vurgu: `text-[var(--law-gold)]`
- Kaynak badge: `bg-green-50 border-green-200 text-green-700`
- Uyari kutusu: `bg-amber-50 border-amber-200`
- Bilgi kutusu: `bg-blue-50 border-blue-200`

Tipografi:
- Sayfa basliklari: `page-title` sinifi (EB Garamond)
- Icerik: Lato sans-serif
- Hesaplama sonuclari: tabular-nums monospace

---

## Kalite Kontrol

Her ozellik icin:
- [ ] TypeScript tipler tanimli
- [ ] shadcn/ui componentleri kullanildi (vanilla HTML degil)
- [ ] Tailwind siniflarla stillendi (inline style yok)
- [ ] Responsive tasarim (mobile breakpoint)
- [ ] Turkce etiketler ve hata mesajlari
- [ ] Edge case'ler: bos girdi, negatif deger, tarih validasyonu
- [ ] Mevcut tema ile uyumlu gorunum
- [ ] Lazy-loaded route (code splitting)

---

## Toplam Dosya Tahmini

| Faz | Dosya Sayisi |
|-----|-------------|
| Altyapi | 5 |
| Hesaplamalar | 14 |
| AI Sablonlari | 3 |
| Miras Payi | 5 |
| Infaz Hesaplama | 5 |
| Arabuluculuk | 8 |
| Ictihat Arama | 5 |
| **Toplam** | **~45 dosya** |
