# ISLEYIS.md — Hukuk Takip Sistemi Kullanim Kilavuzu

> Yeni muvekkil geldiginde, dava acildiginda ve arastirma yapildiginda
> bu sistemi adim adim nasil kullanacaginizi anlatan kilavuz.

---

## Icindekiler

**ONCE BUNU OKU:**
- [0. Sistemi Baslatma Kilavuzu (Teknik)](#0-sistemi-baslatma-kilavuzu-teknik)

**KULLANIM:**
1. [Sisteme Giris ve Genel Bakis](#1-sisteme-giris-ve-genel-bakis)
2. [Yeni Muvekkil Ekleme](#2-yeni-muvekkil-ekleme)
3. [Yeni Dava Acma](#3-yeni-dava-acma)
4. [Dava Detay Sayfasi ve Sekmeler](#4-dava-detay-sayfasi-ve-sekmeler)
5. [AI Otomasyon Hatti — Bastan Sona Akis](#5-ai-otomasyon-hatti--bastan-sona-akis)
6. [Gunluk Kullanim: Durusma, Gorev, Masraf, Tahsilat](#6-gunluk-kullanim)
7. [Takvim ve Bildirimler](#7-takvim-ve-bildirimler)
8. [Araclar: Ictihat Arama, Hesaplamalar](#8-araclar)
9. [Ayarlar](#9-ayarlar)
10. [Durum Kodlari ve Renk Sistemi](#10-durum-kodlari-ve-renk-sistemi)

**SORUN GIDERME:**
- [11. Sik Karsilasilan Sorunlar ve Cozumleri](#11-sik-karsilasilan-sorunlar-ve-cozumleri)
- [12. Sistemi Daha Kolay Kullanma Onerileri](#12-sistemi-daha-kolay-kullanma-onerileri)

---

## 0. Sistemi Baslatma Kilavuzu (Teknik)

> **Bu bolumu sistemi her actiginizda okuyun.** Tum adimlari sirayla yapin.
> Bir adimi atlarsaniz sistem calismaz ve hata alirsiniz.

### Sistem Nelerden Olusuyor?

Bu yazilim 5 parcadan olusur. Hepsi ayni anda calismalidir:

```
┌─────────────────────────────────────────────────────────┐
│  1. Docker Desktop   → Veritabanini calistirir          │
│  2. Server (Backend) → Yazilimin beyni, API             │
│  3. Client (Frontend)→ Tarayicida gordugumuz ekranlar   │
│  4. Google Drive     → Dosyalarin kaydedildigi yer      │
│  5. CLI Araclar      → Yargi, mevzuat, nlm (arastirma) │
└─────────────────────────────────────────────────────────┘
```

### Bilgisayari Actiktan Sonra Yapilacaklar (Sirayla)

---

#### ADIM 0.1: Docker Desktop'u Ac

**Ne:** Docker, veritabanini (PostgreSQL) calistirir. Docker acik olmazsa
sistem hic calismaz — giris bile yapamazsiniz.

**Nasil:**
1. Gorev cubugunda Docker simgesini arayin (mavi balina ikonu)
2. **Yoksa:** Baslat menusunden `Docker Desktop` yazin, acin
3. Docker acildiktan sonra sol altta **yesil** "Engine running" yazisini bekleyin
4. Bu 1-2 dakika surebilir. Yesil olana kadar beklyin

**Kontrol:** Docker acildiktan sonra:
- Docker penceresinde `Containers` sekmesine gidin
- `hukuk-pg` adinda bir container goreceksiniz
- **Yesil** (Running) olmali
- Eger gorunmuyorsa veya kirmiziysa: asagidaki "Ilk Kurulum" bolumune bakin

---

#### ADIM 0.2: Google Drive'in Senkronize Oldugunu Kontrol Et

**Ne:** Sistem urettigi dosyalari (dilekce, rapor vb.) Google Drive'a kaydeder.
Drive senkronize degilse dosyalar kaybolur.

**Nasil:**
1. Gorev cubugunda Google Drive simgesini bulun (uc renkli ucgen)
2. Uzerine tiklayin — "Senkronize" yazmali
3. **Yoksa:** Baslat menusunden `Google Drive` yazin, acin
4. Drive acilinca otomatik senkronize olacaktir

**Kontrol:** Dosya gezgininde `G:\Drive'im\Hukuk Burosu\Aktif Davalar` klasorune gidin.
Bu klasor gorunuyorsa Drive calisiyordur.

---

#### ADIM 0.3: Terminal Ac ve Sistemi Baslat

**Ne:** Server ve client'i (yazilimin arka planini ve on yuzunu) baslatiyoruz.

**Nasil:**
1. **Dosya gezgininde** su klasore gidin:
   ```
   C:\Users\user\Desktop\projelerim\Vektör Database li Otomasyon Claude Code\isbu-ofis\hukuk-takip
   ```
2. Adres cubuguna tiklayin, `cmd` yazin, Enter'a basin
   (Bu o klasorde komut satirini acar)
3. Su komutu yazin ve Enter'a basin:
   ```
   npm run dev
   ```
4. Ekranda su yazilari goreceksiniz:
   ```
   ✓ Server calisiyor: http://localhost:3001
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:5173/
   ```
5. **Her iki satiri da gorene kadar bekleyin.** Bu 10-15 saniye surer.

**Onemli:** Bu terminal penceresini KAPATMAYIN. Kapatrsaniz sistem durur.
Terminali minimalize edin ve arka planda biracin.

---

#### ADIM 0.4: Tarayicida Sistemi Ac

1. Chrome veya Edge tarayicinizi acin
2. Adres cubuguna yazin: **http://localhost:5173**
3. Giris ekrani gelecek

**Giris bilgileri:**
| Alan | Deger |
|------|-------|
| E-posta | `avukat@buro.com` |
| Sifre | `Admin123!` |

4. `Giris Yap` butonuna basin
5. Dashboard (ana sayfa) acilacak — sistem hazir!

---

### Bilgisayari Kapatirken

1. Terminaldeki `npm run dev` komutunu `Ctrl + C` ile durdurun
2. Docker Desktop'u kapatmaniza gerek yok — arka planda kalabilir
3. Bir sonraki seferde ayni adimlari tekrarlayin

---

### ILK KURULUM (Sadece Bir Kez Yapilir)

Eger sistemi ilk defa kuruyorsaniz veya veritabani bozulduysa:

#### 1. Docker'da Veritabanini Olustur

Terminal acin (yukardaki adim 0.3'teki gibi), su komutlari sirayla yazin:

```
docker compose up -d
```

Bu komut PostgreSQL veritabanini olusturur. 1-2 dakika bekleyin.

**Kontrol:** Docker Desktop → Containers → `hukuk-pg` → Yesil (Running)

#### 2. Bagimliliklari Yukle

```
npm install
```

Bu komut tum kutuphaneleri yukler. Ilk seferde 2-5 dakika surebilir.

#### 3. Veritabani Tablolarini Olustur

```
npm run db:migrate
```

"Migration completed" yazisini gormelisiniz.

**Eger "type already exists" hatasi alirsniz:** Tablolar zaten mevcut demektir,
bu hatayi gormezden gelin ve devam edin.

#### 4. Ornek Veriyi Yukle

```
cd server && npx tsx src/db/seed.ts && cd ..
```

Bu komut varsayilan avukat hesabini olusturur:
- E-posta: `avukat@buro.com`
- Sifre: `Admin123!`

**Eger "duplicate key" hatasi alirsniz:** Kullanici zaten var demektir,
bu hatayi gormezden gelin.

#### 5. Sistemi Baslat

```
npm run dev
```

Tamam! Simdi tarayicida `http://localhost:5173` adresine gidin.

---

### CLI ARACLARIN KONTROLU (Opsiyonel — Arastirma Icin)

Arastirma ozelligi su CLI araclarini kullanir. Hepsi zaten bilgisayarinizda kurulu.
Ama sorun yasarsaniz test etmek icin:

#### Yargi CLI (Yargitay karar arama)

```
yargi bedesten search "kidem tazminati"
```
JSON formatinda kararlar donmelidir.

#### Mevzuat CLI (Kanun arama)

```
mevzuat search "is kanunu" -t KANUN
```
JSON formatinda kanun listesi donmelidir.

#### NotebookLM CLI (AI calisma alani)

```
nlm notebook list --json
```
**Eger hata alirsniz:** `nlm login` komutuyla yeniden giris yapin.
Google hesabinizla kimlik dogrulama yapmaniz istenecek.

#### Claude CLI (AI dilekce/rapor uretimi)

```
claude --version
```
Versiyon numarasi donmelidir.

---

### PORSIYONLAR — Hangi Port Ne Ise Yarar

| Adres | Ne Yapar |
|-------|----------|
| `http://localhost:5173` | **Tarayicide actiginiz ekran** (frontend) |
| `http://localhost:3001` | Server API (arka planda calisir, dokunmayin) |
| `localhost:5432` | PostgreSQL veritabani (Docker icinde, dokunmayin) |

**Sadece `http://localhost:5173` adresini acmaniz yeterli.** Diger ikisi otomatik calisir.

---

### GUNLUK BASLATMA KONTROL LISTESI

Her gun bilgisayari actiginizda su listeyi takip edin:

```
[ ] 1. Docker Desktop acik mi? (Mavi balina, yesil "Running")
[ ] 2. Google Drive senkronize mi? (Ucgen ikon, "Senkronize")
[ ] 3. Terminal actim, npm run dev yazdim (iki satir yesil cikti)
[ ] 4. Tarayicide http://localhost:5173 actim
[ ] 5. avukat@buro.com / Admin123! ile giris yaptim
```

Hepsi tamam ise sistemi kullanmaya baslayabilirsiniz.

---

## 1. Sisteme Giris ve Genel Bakis

### Giris Ekrani

`/login` adresinden e-posta ve sifre ile giris yapin.

### Ana Sayfa (Dashboard)

Giris yaptiktan sonra Dashboard acilir. Burada 4 temel istatistik karti gorursunuz:

| Kart | Aciklama |
|------|----------|
| **Aktif Davalar** | Surmekte olan dava sayisi |
| **Bu Ay Durusma** | Bu ay icindeki durusma sayisi |
| **Beklemede Gorevler** | Henuz tamamlanmamis gorev sayisi |
| **Toplam Muvekkil** | Sistemdeki tum muvekkil sayisi |

Asagida su widgetlar vardir:

- **Yaklasan Durusmalar** — Onumuzdeki 7 gun icindeki durusmalar
- **Acil Gorevler** — Suresi gecmis veya yuksek oncelikli gorevler
- **Son Eklenen Davalar** — En son 5 dava
- **Istatistikler** — Dava dagilim grafikleri (tur ve duruma gore)

### Sol Menu (Sidebar)

```
Dashboard          — Ana sayfa
Muvekkilller       — Muvekkil listesi ve yonetimi
Davalar            — Dava listesi ve yonetimi
Durusmalar         — Tum durusmalar
Gorevler           — Gorev listesi
Takvim             — Aylik takvim gorunumu
Bildirimler        — Sistem uyarilari

── Araclar ──
Ictihat Arama      — Yargitay/Danistay karar arama
Hesaplamalar       — Iscilik alacagi, miras payi hesaplama
AI Sablonlari      — AI prompt sablonlari
Miras Payi         — Miras hesaplama araci
Arabuluculuk       — Arabuluculuk belgeleri
Infaz Hesabi       — Ceza infaz hesaplama

── Alt ──
Ayarlar            — Profil, sifre, API anahtarlari, tema
```

---

## 2. Yeni Muvekkil Ekleme

**Yol:** Sol menuden `Muvekkilller` → sag ustte `+ Yeni Muvekkil`

### Doldurulacak Alanlar

| Alan | Zorunlu | Aciklama |
|------|---------|----------|
| Ad Soyad | Evet | Muvekkilin tam adi |
| TC Kimlik No | Hayir | 11 haneli TC kimlik numarasi |
| Telefon | Hayir | Iletisim telefonu |
| E-posta | Hayir | E-posta adresi |
| Adres | Hayir | Acik adres |
| Notlar | Hayir | Muvekkile ozel notlar |

`Kaydet` butonuna basin. Muvekkil listesine yonlendirilirsiniz.

### Muvekkil Detay Sayfasi

Muvekkil listesinden bir muvekkile tiklayin. Detay sayfasinda:

- Muvekkilin temel bilgileri
- Bu muvekkile ait **davalar** listesi
- Muvekkile ait **belgeler**

---

## 3. Yeni Dava Acma

**Yol:** Sol menuden `Davalar` → sag ustte `+ Yeni Dava`

### Doldurulacak Alanlar

| Alan | Zorunlu | Secenekler / Aciklama |
|------|---------|----------------------|
| Muvekkil | Evet | Listeden secin veya yeni olusturun |
| Baslik | Evet | Dava basligi (ornek: "Ahmet Yilmaz - Iscilik Alacagi") |
| Dava Turu | Evet | Iscilik Alacagi, Bosanma, Velayet, Mal Paylasimi, Kira, Tuketici, Icra, Ceza, Idare, Diger |
| Aciklama | Hayir | Dava hakkinda detayli aciklama — ne kadar detayli olursa AI o kadar iyi calisir |
| Mahkeme Adi | Hayir | Ornek: "Istanbul 5. Is Mahkemesi" |
| Dava Esas No | Hayir | Mahkeme dosya numarasi |
| Baslangic Tarihi | Evet | Davanin acilis tarihi |
| Durum | Hayir | Varsayilan: Aktif |
| Sozlesmelik Ucret | Hayir | Anlasilmis vekalet ucreti |

**Onemli:** `Aciklama` alani AI sistemi icin kritik onem tasiyor. Buraya dava hikayesini,
muvekkilden alinan bilgileri, onemli tarihleri ve belirleyici olaylari yazin. AI butun
otomasyon hattinda bu aciklamayi temel alir.

`Kaydet` butonuna basin. Dava detay sayfasina yonlendirilirsiniz.

---

## 4. Dava Detay Sayfasi ve Sekmeler

Bir davaya tikladiginizda 11 sekmeli detay sayfasi acilir:

```
AI Calisma Alani | Durusmalar | Gorevler | Masraflar | Tahsilatlar |
Usul | Arastirma | Dilekce | Savunma | Belgeler | Notlar
```

Her sekmenin ne ise yaradigini tek tek aciklayalim:

### Sekme 1: AI Calisma Alani

**Bu ne:** Tum AI otomasyon hattinin kontrol merkezidir. Dava dosyasinin
Google Drive klasorunu olusturur ve otomasyon surecini baslatir.

**Ne yapilir:**
1. `AI ile Dava Baslat` butonuna basin
2. Sistem otomatik olarak:
   - Google Drive'da dava klasor yapisini olusturur
   - Sablon dosyalari yerlestirir
   - Otomasyon kodu atar
3. Durum `Baslandi` → `Klasor Hazir` olarak degisir

**Goruntulenen bilgiler:**
- Mevcut otomasyon durumu (pipeline gorunumu)
- Drive klasor yolu
- Tum artifact dosya yollari (briefing, usul, arastirma, dilekce vb.)

### Sekme 2: Durusmalar

**Bu ne:** Davaya ait durusma tarihlerini takip eder.

**Durusma eklemek icin:**
1. `Durusma Ekle` butonuna basin
2. Tarih, saat, salon bilgisini girin
3. Notlar alanina durusma icin hazirliklari yazin
4. Kaydedin

| Alan | Aciklama |
|------|----------|
| Tarih | Durusma tarihi |
| Saat | Durusma saati (varsayilan: 09:00) |
| Salon | Durusma salonu (ornek: A-101) |
| Notlar | Hazirlik notlari |

**Durum secenekleri:** Beklemede, Tamamlandi, Ertelendi, Iptal Edildi

**Hatirlatma:** Sistem 3 gun ve 1 gun once otomatik bildirim gonderir.

### Sekme 3: Gorevler

**Bu ne:** Davayla ilgili yapilmasi gereken isleri takip eder.

**Gorev eklemek icin:**
1. `Gorev Ekle` butonuna basin
2. Gorev basligini yazin
3. Oncelik secin: Dusuk / Orta / Yuksek / Acil
4. Son tarih belirleyin
5. Kaydedin

**Durum akisi:** Beklemede → Devam Ediyor → Tamamlandi

**Suresi gecen gorevler** kirmizi ile vurgulanir.

### Sekme 4: Masraflar

**Bu ne:** Dava surecinde yapilan masraflari kaydeder.

| Alan | Aciklama |
|------|----------|
| Aciklama | Masrafin ne oldugu |
| Tur | Mahkeme Harci, Noter, Bilirkisi, Ulasim, Evrak, Diger |
| Tutar | TL cinsinden tutar |
| Tarih | Masraf tarihi |

En altta **Toplam Masraf** tutari goruntulenir.

### Sekme 5: Tahsilatlar

**Bu ne:** Muvekkilden alinan odemeleri takip eder.

| Alan | Aciklama |
|------|----------|
| Tutar | Alinan odeme tutari (TL) |
| Tarih | Odeme tarihi |
| Odeme Yontemi | Banka Havalesi, Nakit, Cek |
| Aciklama | Odeme aciklamasi |

En altta **Toplam Tahsilat** ve **Bakiye** (tahsilat - masraf) goruntulenir.

### Sekme 6: Usul

**Bu ne:** Davanin usul hukuku analizini yapar. Gorevli mahkeme, yetki, zamanasimi,
arabuluculuk zorunlulugu gibi usul kontrollerini AI ile otomatik tespit eder.

Detayli akis icin asagida [AI Otomasyon Hatti](#5-ai-otomasyon-hatti--bastan-sona-akis) bolumune bakin.

### Sekme 7: Arastirma

**Bu ne:** Dava icin hukuki arastirma yapar. 4 paralel kaynak kullanir:
Yargi Kararlari (Yargitay/Danistay), Mevzuat (kanun/yonetmelik),
NotebookLM (AI calisma alani), Vektor Veritabani (buro kutuphanesi).

Detayli akis icin asagida [AI Otomasyon Hatti](#5-ai-otomasyon-hatti--bastan-sona-akis) bolumune bakin.

### Sekme 8: Dilekce

**Bu ne:** AI ile dilekce ve diger hukuki belgeleri uretir.

6 belge turu destekler:
- Dava Dilekcesi
- Ihtarname
- Cevap Dilekcesi
- Istinaf Dilekcesi
- Temyiz Dilekcesi
- Basvuru Dilekcesi

Detayli akis icin asagida [AI Otomasyon Hatti](#5-ai-otomasyon-hatti--bastan-sona-akis) bolumune bakin.

### Sekme 9: Savunma

**Bu ne:** Karsi tarafin yapabilecegi en guclu savunmalari simule eder.
Her savunma icin yanit stratejisi ve dilekceye eklenmesi gereken argumanlari olusturur.

Detayli akis icin asagida [AI Otomasyon Hatti](#5-ai-otomasyon-hatti--bastan-sona-akis) bolumune bakin.

### Sekme 10: Belgeler

**Bu ne:** Davayla ilgili belgeleri yukler ve yonetirsiniz.

**Belge yuklemek icin:**
1. `Belgeler Ekle` butonuna basin
2. Dosya secin (PDF, Word, resim vb.)
3. Opsiyonel aciklama yazin
4. Yukleyin

Maks. 10 dosya, her biri maks. 50MB.

### Sekme 11: Notlar

**Bu ne:** Davaya ait serbest notlar tutar.

1. Not alanina metni yazin
2. `Not Ekle` butonuna basin
3. Notlar tarih sirasina gore listelenir

---

## 5. AI Otomasyon Hatti — Bastan Sona Akis

Bu bolum, yeni bir muvekkil geldiginde ve dava acildiginda AI sisteminin
bastan sona nasil calistigini adim adim anlatir.

### Otomasyon Pipeline Sema

```
   ADIM 1                ADIM 2              ADIM 3
┌──────────┐      ┌──────────────┐     ┌──────────────┐
│ AI BASLA │ ───→ │   ARASTIRMA  │ ──→ │ USUL RAPORU  │
│ (Klasor) │      │  (4 kaynak)  │     │ (otomatik)   │
└──────────┘      └──────────────┘     └──────────────┘
                         │                     │
                         ▼                     │
                  ┌──────────────┐             │
                  │ ARASTIRMA    │             │
                  │ KALITE ONAY  │ ◄───────────┘
                  └──────┬───────┘
                         │ Onaylandi
                         ▼
   ADIM 4                ADIM 5              ADIM 6
┌──────────────┐  ┌──────────────┐     ┌──────────────┐
│  DILEKCE v1  │→ │   SAVUNMA    │ ──→ │  DILEKCE v2  │
│ (belge turu) │  │ SIMULASYONU  │     │  (revizyon)  │
└──────────────┘  └──────────────┘     └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ FINAL ONAY   │
                                       │ + DRIVE KAYIT│
                                       └──────────────┘
```

### Durum Akisi (automationStatus)

```
Baslanmadi → Klasor Hazir → Briefing Hazir → Arastirma Hazir →
Taslak Hazir → Revizyon Asamasi → Tamamlandi
```

---

### ADIM 1: Dava Dosyasini Baslat

**Nerede:** Dava Detay → `AI Calisma Alani` sekmesi

**Ne yapilir:**
1. `AI ile Dava Baslat` butonuna basin
2. Sistem otomatik olarak su islemleri yapar:
   - Google Drive'da dava klasoru olusturulur:
     ```
     G:\Drive'im\Hukuk Burosu\Aktif Davalar\
     └── 2026-dava-adi-abc123\
         ├── 00-Briefing.md
         ├── 01-Usul\usul-raporu.md
         ├── 02-Arastirma\arastirma-raporu.md
         ├── 03-Sentez-ve-Dilekce\dava-dilekcesi-v1.md
         ├── 04-Muvekkil-Belgeleri\
         └── 05-Durusma-Notlari\
     ```
   - Sablon dosyalar yerlestirilir
   - Otomasyon kodu atanir

**Durum degisimi:** `Baslanmadi` → `Klasor Hazir`

---

### ADIM 2: Arastirma Yap

**Nerede:** Dava Detay → `Arastirma` sekmesi

Arastirma 3 alt adimdan olusur:

#### Adim 2A: Girdi Toplama

1. Dava icin belge yukleyin (`Belgeler` sekmesinden)
2. **Avukat Yonlendirmesi** alanina stratejinizi yazin:
   ```
   Ornek: "Muvekkil 4 yildir calisirken isvereni tarafindan haksiz
   olarak isten cikarilmistir. Kidem ve ihbar tazminati odenmemistir.
   Fazla mesai alacagi da mevcuttur."
   ```
3. **Muvekkil Gorusme Notlari** alanina muvekkilden alinan bilgileri yazin:
   ```
   Ornek: "Muvekkil her gun 07:00-20:00 arasi calismis. Haftada 6 gun.
   Yemek ve yol ucreti nakit verilmis, bordroya yansitilmamis."
   ```
4. `Kaydet` butonuna basin

#### Adim 2B: Kritik Nokta Tespiti

1. `Taslagi Uret` butonuna basin — AI kritik noktayi otomatik tespit eder
2. Uretilen **Kritik Nokta Ozeti** alanini inceleyin ve gerekirse duzenleyin:
   ```
   Ornek AI ciktisi: "Isverenin hakli bir neden olmadan is sozlesmesini
   feshetmesi nedeniyle kidem tazminati, ihbar tazminati ve odenmemis
   fazla mesai alacagina hak kazanilip kazanilmadigi."
   ```
3. Detaylari gostermek icin `Detaylari goster` linkine tiklayin:
   - **Ana Hukuki Eksen** — Ornek: "hakli fesih, fazla mesai ispati"
   - **Ikincil Riskler** — Ornek: "ibra sozlesmesi imzalanmis olabilir"
   - **Ispat Riskleri** — Ornek: "bordrolar imzali, fazla mesai sutunu dolu"
   - **Karsi Taraf Argumanlari** — Ornek: "isci istifa etmistir savunmasi"
   - **Eksik Bilgi** — Ornek: "SGK hizmet dokumu henuz alinmadi"
   - **Eksik Belgeler** — Ornek: "banka hesap dokumu, is sozlesmesi"
4. `Kritik Noktayi Onayla` butonuna basin

#### Adim 2C: Paralel Arastirma

1. Kaynaklar secin (acma/kapama dugmeleri ile):

   | Kaynak | Ne Yapar | Varsayilan |
   |--------|----------|------------|
   | **Yargi Kararlari** | Yargitay, Danistay, istinaf kararlarini arar | Acik |
   | **Ilgili Mevzuat** | Kanun, KHK, yonetmelik maddelerini bulur | Acik |
   | **NotebookLM** | AI calisma alanindaki dokumanlari inceler | Kapali |
   | **Vektor Veritabani** | Buro kutuphanesinde semantik arama yapar | Kapali |

2. Her kaynagi genisletip ozel sorgu girebilirsiniz:
   - **Yargi:** Ozel arama terimi, daire filtresi (H9, HGK), tarih aracligi
   - **Mevzuat:** Ozel arama, kanun numarasi (4857, 6100 gibi)
   - **NotebookLM:** Notebook adi (ornek: "is hukuku")
   - **Vektor DB:** Koleksiyon adi, ozel sorgu

3. **Anahtar Kelimeler** alanina ek terimler girin:
   ```
   Ornek: "fazla mesai, ispat yuku, bordro, hakli fesih, kidem tazminati"
   ```

4. `Paralel Arastirma` butonuna basin

5. Sistem paralel olarak 4 kaynagi tarar. Her kaynak icin sonuc karti gorursunuz:
   - **Basarili** (yesil) — Sonuc bulundu, icerigi gorebilirsiniz
   - **Hata** (kirmizi) — Kaynak hata verdi, hata mesajini gosterir
   - **Atlandi** (gri) — Kaynak kapali oldugu icin atlanmis

6. Her kaynak kartindaki `Tam icerigi goruntule` linkine tiklayarak
   bulunan kararlari ve mevzuati inceleyebilirsiniz.

#### Adim 2D: Arastirma Kalite Kontrolu

Arastirma tamamlandiktan sonra **Kalite Kontrolu** paneli goruntulenir:

1. Bulunan argumanlari inceleyin
2. Kullanmak istediginiz argumanlari checkbox ile secin
3. Inceleme notu yazin (opsiyonel)
4. `Onayla — Dilekce Asamasina Gec` butonuna basin

**Onemli:** Onayla butonuna bastiginizda sistem otomatik olarak:
- Usul raporu uretir (precheck + rapor — arka planda)
- Usul raporunu Google Drive'a kaydeder
- Otomasyon durumunu `Taslak Hazir` yapar

---

### ADIM 3: Usul Raporu (Otomatik)

**Nerede:** Dava Detay → `Usul` sekmesi

Arastirma onayi sonrasi usul raporu **otomatik olarak** uretilir. Icerir:

- Gorevli ve yetkili mahkeme tespiti (dayanak kanun maddesi ile)
- Vekaletname kontrolu (ozel yetki gerekiyor mu?)
- Zorunlu on adimlar (arabuluculuk, ihtarname, tahkim vb.)
- Kritik sureler (zamanasimi, dava acma suresi)
- Harc tahmini
- Risk analizi

**Yapmaniz gereken:** Usul sekmesine gidin, raporu okuyun:
- Dogru ise `Onayla`
- Eksik veya hatali ise `Reddet` + duzeltme notu yazin
- `Yeniden Olustur` ile tekrar urettirebilirsiniz

---

### ADIM 4: Dilekce Uretimi (v1)

**Nerede:** Dava Detay → `Dilekce` sekmesi

1. **Belge Turu Secin:**

   | Belge Turu | Ne Zaman Kullanilir |
   |------------|---------------------|
   | **Dava Dilekcesi** | Yeni dava acarken |
   | **Ihtarname** | Dava oncesi karsi tarafa ihtar gonderirken |
   | **Cevap Dilekcesi** | Davali olarak cevap verirken |
   | **Istinaf Dilekcesi** | Yerel mahkeme kararina itiraz ederken |
   | **Temyiz Dilekcesi** | Istinaf kararina itiraz ederken (Yargitay) |
   | **Basvuru Dilekcesi** | Kurum veya mahkemeye basvururken |

2. Acilan dropdown'dan belge turunu secin
3. `Belge Taslagi Uret` butonuna basin
4. AI, arastirma sonuclari + usul raporu + dava bilgilerini kullanarak
   sectiginiz belge turunde taslak uretir
5. Uretilen taslak ekranda goruntulenir

**Taslak uzerinde islemler:**
- `Duzenle` — Metni dogrudan duzenleyebilirsiniz
- `Kaydet` — Yaptginiz degisiklikleri kaydedin
- `Yeniden Uret` — AI'dan tekrar urettirin
- `UDF Indir` — UYAP formatinda indirin

6. Taslagi inceleyin, gerekirse duzenleyin
7. `Onayla — Savunma Simulasyonuna Gec` butonuna basin

**Not:** Uretilen dilekce otomatik olarak Google Drive'daki
`03-Sentez-ve-Dilekce/dava-dilekcesi-v1.md` dosyasina kaydedilir.

---

### ADIM 5: Savunma Simulasyonu

**Nerede:** Dava Detay → `Savunma` sekmesi

1. `Savunma Simulasyonu Baslat` butonuna basin
2. AI, karsi tarafin perspektifinden en guclu savunmalari analiz eder
3. Her savunma icin su bilgileri uretir:
   - Savunmanin adi ve icerig
   - Hukuki dayanagi
   - **Bizim yanitimiz** — karsi arguman
   - **Dilekceye eklenmeli mi?** — evet/hayir

4. **Risk Flag:** Eger dogrulanamayan kararlar veya bulunamayan
   mevzuat varsa sari uyari gosterilir

5. Simülasyonu inceleyin
6. Inceleme notu yazin (opsiyonel)
7. `Onayla — Dilekce v2'ye Gec` butonuna basin

**Not:** Savunma simulasyonu otomatik olarak Google Drive'daki
`02-Arastirma/savunma-simulasyonu.md` dosyasina kaydedilir.

---

### ADIM 6: Dilekce v2 (Revizyon)

**Nerede:** Dava Detay → `Dilekce` sekmesi (alt kisim)

Savunma simulasyonu onaylandiktan sonra sayfa altinda **Dilekce v2 — Revizyon**
bolumu acilir.

1. `v2 Dilekce Uret` butonuna basin
2. AI su uc girdiyi birlestirerek v2 dilekceyi uretir:
   - v1 dilekce taslagi
   - Savunma simulasyonu sonuclari
   - Revizyon raporu (karsi tarafa karsi ek argumanlar)
3. v2 taslagi inceleyin
4. Final inceleme notu yazin (opsiyonel)
5. `Final Onay — Otomasyon Hattini Tamamla` butonuna basin

**Durum degisimi:** `Revizyon Asamasi` → `Tamamlandi`

**Not:** Revizyon raporu ve v2 dilekce otomatik olarak Google Drive'a kaydedilir:
- `03-Sentez-ve-Dilekce/revizyon-raporu-v1.md`
- `03-Sentez-ve-Dilekce/dilekce-v2.md`

---

### Tum Adimlar Sonrasi Google Drive Klasor Yapisi

```
G:\Drive'im\Hukuk Burosu\Aktif Davalar\2026-dava-adi-abc123\
├── 00-Briefing.md                          ← Dava ozet bilgileri
├── 01-Usul\
│   └── usul-raporu.md                      ← AI uretimi usul raporu
├── 02-Arastirma\
│   ├── arastirma-raporu.md                 ← Arastirma sonuclari
│   └── savunma-simulasyonu.md              ← Karsi taraf savunma analizi
├── 03-Sentez-ve-Dilekce\
│   ├── dava-dilekcesi-v1.md                ← Ilk dilekce taslagi
│   ├── dava-dilekcesi-v1.udf              ← UYAP formati
│   ├── revizyon-raporu-v1.md               ← Revizyon analizi
│   └── dilekce-v2.md                       ← Karsi savunmalari yenen v2
├── 04-Muvekkil-Belgeleri\
│   ├── 00-Ham\                             ← Ham belgeler
│   ├── 01-Tasnif\                          ← Tasnif edilmis
│   └── evrak-listesi.md                    ← Belge kontrol listesi
└── 05-Durusma-Notlari\                    ← Durusma notlari
```

---

## 6. Gunluk Kullanim

### Durusma Ekleme

1. Dava detay → `Durusmalar` sekmesi → `Durusma Ekle`
2. Tarih, saat, salon bilgisini girin
3. Kaydedin
4. Sistem 3 gun ve 1 gun once otomatik hatirlatma gonderir

### Gorev Ekleme

1. Dava detay → `Gorevler` sekmesi → `Gorev Ekle`
2. Gorev basligini yazin
3. Oncelik ve son tarih belirleyin
4. Kaydedin
5. Dashboard'da acil gorevler goruntulenir

### Masraf Kaydi

1. Dava detay → `Masraflar` sekmesi → `Masraf Ekle`
2. Aciklama, tur, tutar ve tarihi girin
3. Kaydedin

### Tahsilat Kaydi

1. Dava detay → `Tahsilatlar` sekmesi → `Tahsilat Ekle`
2. Tutar, tarih, odeme yontemi ve aciklamayi girin
3. Kaydedin
4. **Bakiye** otomatik hesaplanir: Tahsilat - Masraf

### Belge Yukleme

1. Dava detay → `Belgeler` sekmesi → `Belgeler Ekle`
2. Dosya secin (PDF, Word, resim)
3. Aciklama yazin (opsiyonel)
4. Yukleyin

### Not Ekleme

1. Dava detay → `Notlar` sekmesi
2. Metni yazin → `Not Ekle`

---

## 7. Takvim ve Bildirimler

### Takvim Gorunumu

**Yol:** Sol menuden `Takvim`

- Aylik takvim gorunumu
- **Mavi noktalar** — Durusmalar
- **Yesil noktalar** — Gorevler
- Bir gune tiklayinca o gunun etkinlikleri listelenir
- Sol/sag oklariyla ay degistirin

### Bildirimler

**Yol:** Sol menuden `Bildirimler` veya sag ust kosedeki zil ikonu

Otomatik bildirimler:
- Durusma 3 gun once
- Durusma 1 gun once
- Suresi gecen gorevler
- Dava durumu degisiklikleri
- AI islem tamamlandi bildirimleri

---

## 8. Araclar

### Ictihat Arama

**Yol:** Sol menuden `Araclar` → `Ictihat Arama`

Yargitay ve Danistay kararlarini dogrudan arayabilirsiniz.
- Arama terimi girin
- Daire filtresi secin
- Tarih araligi belirleyin
- Sonuclari inceleyin

### Hesaplamalar

**Yol:** Sol menuden `Araclar` → `Hesaplamalar`

Iscilik alacaklari hesaplama:
- Kidem tazminati
- Ihbar tazminati
- Fazla mesai ucreti
- Yillik izin ucreti
- UBGT ucreti

### Miras Payi

**Yol:** Sol menuden `Araclar` → `Miras Payi`

Miras paylasim hesaplayicisi.

### Arabuluculuk

**Yol:** Sol menuden `Araclar` → `Arabuluculuk`

Arabuluculuk belge sablonlari.

---

## 9. Ayarlar

**Yol:** Sol menuden `Ayarlar`

### Profil

- Ad Soyad degistirme
- Telefon degistirme

### Tema

- Acik / Koyu tema secimi
- Ozel renk semalari

### Sifre Degistir

- Mevcut sifre
- Yeni sifre (min. 6 karakter)
- Sifre tekrar

### AI API Anahtarlari

- **Anthropic API Key** — Claude AI icin (dilekce, arastirma, usul raporu uretimi)
- **Gemini API Key** — Google Gemini icin

Bu anahtarlar tarayicida saklanir. Sunucuya gonderilmez.

---

## 10. Durum Kodlari ve Renk Sistemi

### Dava Durumlari

| Durum | Renk | Aciklama |
|-------|------|----------|
| Aktif | Mavi | Dava suruyuor |
| Istinafta | Turuncu | Istinaf mahkemesinde |
| Yargitayda | Turuncu | Yargitay'da |
| Pasif | Gri | Askiya alinmis |
| Kapatildi | Gri | Dava kapandi |
| Kazanildi | Yesil | Lehimize sonuclandi |
| Kaybedildi | Kirmizi | Aleyhimize sonuclandi |
| Uzlasildi | Turuncu | Uzlasma saglandi |

### Otomasyon Durumlari

| Durum | Renk | Anlami |
|-------|------|--------|
| Baslanmadi | Gri | AI hatti henuz baslatilmadi |
| Klasor Hazir | Mavi | Drive klasoru olusturuldu |
| Briefing Hazir | Mavi | Briefing tamamlandi |
| Arastirma Hazir | Mavi | Arastirma onaylandi |
| Taslak Hazir | Turuncu | Dilekce v1 uretildi |
| Revizyon Asamasi | Turuncu | Savunma + v2 asamasinda |
| Tamamlandi | Yesil | Tum hat tamamlandi |

### Gorev Oncelikleri

| Oncelik | Renk |
|---------|------|
| Acil | Kirmizi |
| Yuksek | Turuncu |
| Orta | Gri |
| Dusuk | Beyaz |

### Genel Renk Kurallari

- **Yesil** — Basarili, onaylandi, tamamlandi
- **Kirmizi** — Hata, reddedildi, suresi gecmis
- **Turuncu** — Beklemede, uyari, dikkat gerekli
- **Mavi** — Aktif, surec devam ediyor
- **Gri** — Pasif, henuz baslanmamis

---

## Hizli Referans: Tam Akis Ozeti

```
1. Muvekkil Ekle        → /clients/new
2. Dava Ac              → /cases/new (muvekkili sec, bilgileri doldur)
3. AI Baslat            → Dava detay → AI Calisma Alani → "AI ile Dava Baslat"
4. Bilgi Gir            → Arastirma sekmesi → Avukat yonlendirmesi + muvekkil notlari
5. Kritik Noktayi Onayla→ Arastirma sekmesi → AI taslagi uret → onayla
6. Arastirma Calistir   → Kaynaklari sec → "Paralel Arastirma" butonuna bas
7. Arastirma Onayla     → Kalite Kontrolu → argumanlari sec → "Onayla"
                          (usul raporu otomatik uretilir)
8. Belge Turu Sec       → Dilekce sekmesi → dropdown'dan tur sec
9. Dilekce Uret         → "Belge Taslagi Uret" → incele → onayla
10. Savunma Simule Et   → Savunma sekmesi → "Simulasyon Baslat" → incele → onayla
11. v2 Dilekce Uret     → Dilekce sekmesi → "v2 Dilekce Uret" → final onay
12. UDF Indir           → Dilekce sekmesi → "UDF Indir" butonu
13. TAMAMLANDI          → Tum dosyalar Google Drive'da hazir
```

---

## 11. Sik Karsilasilan Sorunlar ve Cozumleri

### "Siteye giremiyorum / giris ekrani acilamadi"

**Neden:** Server veya Docker calismiyordur.

**Cozum:**
1. Docker Desktop acik mi? Gorev cubugunda mavi balina ikonuna bakin.
   - Kapali ise acin, 1-2 dakika bekleyin.
2. Terminal acik mi ve `npm run dev` calisiyor mu?
   - Calismiyor ise terminalde proje klasorune gidin:
     ```
     cd Desktop/projelerim/Vektör\ Database\ li\ Otomasyon\ Claude\ Code/isbu-ofis/hukuk-takip
     npm run dev
     ```
3. Tarayicida `http://localhost:5173` adresine gidin.
4. Hala acilmiyorsa terminaldeki hata mesajini okuyun.

---

### "Giris yaptim ama bos sayfa geliyor / veriler yuklenmiyor"

**Neden:** Veritabani baglantisi kopuk veya migration yapilmamis.

**Cozum:**
1. Docker Desktop'ta `hukuk-pg` container'inin yesil (Running) oldugunu kontrol edin.
2. Container durmussa baslatmak icin terminalde:
   ```
   docker start hukuk-pg
   ```
3. Migration yapilmamissa (ilk kurulumda veya sema degisikliginde):
   ```
   cd server
   npx drizzle-kit push
   ```
4. Seed verileri yoksa (ilk kurulumda):
   ```
   cd server
   npx tsx src/db/seed.ts
   ```

---

### "Arastirma baslatiyorum ama sonuc gelmiyor / hata veriyor"

**Neden:** CLI araclari (yargi, mevzuat, nlm) calismiyordur veya yolu yanlis.

**Cozum:**
1. Terminalde araclarin yuklu oldugunu test edin:
   ```
   yargi.cmd bedesten search "test"
   mevzuat.cmd search "test" -t KANUN
   ```
2. Hata aliyorsaniz PATH ortam degiskenini kontrol edin.
3. NotebookLM kullanacaksaniz once giris yapin:
   ```
   nlm.exe login
   ```
   Tarayici acilir, Google hesabinizla giris yapin, terminal "Login successful" diyecektir.
4. NotebookLM login suresi dolmussa tekrar `nlm.exe login` yapin.

---

### "Dilekce / usul raporu uretilmiyor — AI hatasi"

**Neden:** Anthropic API anahtari eksik veya gecersiz.

**Cozum:**
1. `server/.env` dosyasini acin ve su satirin oldugunu kontrol edin:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Anahtar yoksa veya gecersizse:
   - https://console.anthropic.com adresinden yeni anahtar alin
   - `.env` dosyasina yapisitirin
   - Server'i yeniden baslatin (terminalde Ctrl+C, sonra `npm run dev`)
3. Arayuzden de kontrol edebilirsiniz:
   - Ayarlar → AI API Anahtarlari → Anthropic API Key alanini kontrol edin

---

### "Google Drive'a kayit yapilmiyor / dosyalar Drive'da gorunmuyor"

**Neden:** Google Drive for Desktop calismiyordur veya klasor yolu yanlis.

**Cozum:**
1. Gorev cubugunda Google Drive simgesini kontrol edin.
   - Yoksa Google Drive for Desktop'u acin.
2. `G:\Drive'im\Hukuk Burosu\Aktif Davalar\` klasorunun var oldugundan emin olun.
   - Yoksa olusturun:
     ```
     Bilgisayarim → G: surucusu → Drive'im → Hukuk Burosu → Aktif Davalar
     ```
3. `server/.env` dosyasinda yolun dogru yazildigini kontrol edin:
   ```
   AI_ACTIVE_CASES_ROOT=G:\Drive'ım\Hukuk Bürosu\Aktif Davalar
   ```
4. Drive senkronizasyon durumunu kontrol edin — eger Drive dosyalari
   "senkronize ediliyor" yaziyorsa biraz bekleyin.

---

### "Docker Desktop acilamiyor / cok yavas"

**Neden:** Windows ozellikleri eksik veya bilgisayar kaynaklari yetersiz.

**Cozum:**
1. Windows'ta Hyper-V ve WSL2 aktif olmalidir:
   - Baslat → "Windows ozelliklerini ac veya kapat" → Hyper-V isaretli olmali
   - Terminalde: `wsl --update`
2. Docker Desktop ilk acilista 2-3 dakika surebilir — bekleyin.
3. Cok yavas ise Docker Desktop ayarlarindan RAM limitini 4 GB'a dusurun.
4. Hala calismiyorsa bilgisayari yeniden baslatin ve Docker'i tekrar acin.

---

### "npm run dev yazdim ama hata aliyor"

**Sik gorulen hatalar ve cozumleri:**

| Hata Mesaji | Neden | Cozum |
|-------------|-------|-------|
| `MODULE_NOT_FOUND` | Paketler kurulu degil | `npm install` yapin |
| `EADDRINUSE :3001` | Port zaten kullanimda | Onceki terminali kapatin veya `taskkill /F /PID <pid>` |
| `EADDRINUSE :5173` | Port zaten kullanimda | Ayni sekilde onceki islemi kapatin |
| `connection refused` | Docker / PostgreSQL kapali | Docker'i baslatin, `docker start hukuk-pg` |
| `relation does not exist` | Migration yapilmamis | `cd server && npx drizzle-kit push` |

---

### "Vektor veritabani (hukuk_ara) calismiyorum"

**Neden:** Python ortami veya vektor veritabani servisi calismiyordur.

**Cozum:**
1. Vektor veritabani Python tabanlidir. Python yuklu mu kontrol edin:
   ```
   python --version
   ```
2. Vektor veritabani servisini baslatin:
   ```
   cd D:\hukuk-vektordb
   python dosya-izleyici.py
   ```
3. Hata aliyorsaniz bagimliklar eksik olabilir:
   ```
   pip install -r requirements.txt
   ```

---

### "Savunma simulasyonu veya revizyon baslamiyor"

**Neden:** Onceki adimlar tamamlanmamistir. Sistem her adimin tamamlanmasini bekler.

**Cozum:**
1. Savunma simulasyonu icin: Dilekce v1 onaylanmis olmali
   (otomasyon durumu en az `review_ready` olmali).
2. v2 revizyon icin: Savunma simulasyonu onaylanmis olmali.
3. Dava detay sayfasindaki otomasyon durum cubugunu kontrol edin —
   hangi adimda oldugunuzu gorebilirsiniz.

---

### "Tarayicida eski versiyon gorunuyor / degisiklikler yansimadi"

**Cozum:**
1. Tarayicida `Ctrl + Shift + R` (hard refresh) yapin.
2. Hala eski gorunuyorsa tarayici onbellegini temizleyin:
   - Chrome: `Ctrl + Shift + Delete` → "Onbellege alinmis resimler ve dosyalar" → Temizle
3. Development modunda calisiyorsaniz (`npm run dev`) degisiklikler otomatik yansir.
   Yansimiyorsa terminalde server'i yeniden baslatin.

---

## 12. Sistemi Daha Kolay Kullanma Onerileri

### Oneri 1: Tek Tikla Baslat Dosyasi (BAT Script)

Her gun terminalde komut yazmak yerine bir `.bat` dosyasi olusturabilirsiniz.
Bu dosyaya cift tiklayinca tum sistem otomatik baslar.

Masaustune `HukukTakip-Baslat.bat` adinda bir dosya olusturun:

```bat
@echo off
echo ========================================
echo   Hukuk Takip Sistemi Baslatiliyor...
echo ========================================
echo.

echo [1/3] Docker kontrol ediliyor...
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker acik degil! Docker Desktop'u acin ve tekrar deneyin.
    pause
    exit
)

echo [2/3] Veritabani baslatiliyor...
docker start hukuk-pg 2>nul
timeout /t 3 /nobreak >nul

echo [3/3] Server ve Client baslatiliyor...
cd /d "C:\Users\user\Desktop\projelerim\Vektör Database li Otomasyon Claude Code\isbu-ofis\hukuk-takip"
start cmd /k "npm run dev"

echo.
echo ========================================
echo   Sistem baslatildi!
echo   Tarayicinizda su adrese gidin:
echo   http://localhost:5173
echo ========================================
echo.
timeout /t 5
start http://localhost:5173
```

**Nasil kullanilir:**
1. Bu dosyayi masaustunuze kaydedin
2. Docker Desktop'un acik oldugundan emin olun
3. Dosyaya cift tiklayin
4. Otomatik olarak tarayiciniz acilir ve sisteme giris yapabilirsiniz

---

### Oneri 2: Docker Desktop'u Windows ile Birlikte Baslat

Docker'i her seferinde elle acmamak icin:

1. Docker Desktop'u acin
2. Sag ust kosedeki disli simgesi (Settings) → `General`
3. `Start Docker Desktop when you sign in to Windows` secenegini isaretleyin
4. `Apply & Restart`

Artik bilgisayarinizi her actiginizda Docker otomatik baslar.

---

### Oneri 3: NLM Login'i Uzun Sureli Yapin

NotebookLM MCP oturumu belirli bir sure sonra kapanir. Bunu onlemek icin:

- Arastirma oncesi her zaman terminal acip `nlm.exe login` ile giris durumunu kontrol edin.
- Giris suresini uzatmak icin `nlm.exe login --persist` komutunu deneyin (destekleniyorsa).
- NotebookLM kullanmayacaksaniz arastirma kaynagi olarak kapatmak yeterlidir.

---

### Oneri 4: Masaustu Kisayolu

Tarayicida `http://localhost:5173` adresini her seferinde yazmak yerine:

**Chrome:**
1. Sistemi acin (localhost:5173)
2. Sag ustteki 3 nokta → "Diger araclar" → "Kisayol olustur"
3. "Pencere olarak ac" secenegini isaretleyin → "Olustur"
4. Masaustunuzde `Hukuk Takip` kisayolu olusur — normal uygulama gibi acilir

**Edge:**
1. Sistemi acin
2. Sag ust → "Uygulamalar" → "Bu siteyi uygulama olarak yukle"
3. Masaustunde kisayol olusur

---

### Oneri 5: Gunluk Kontrol Listesi (Yazdir ve Masaustune As)

Her sabah bu listeyi takip edin:

```
╔════════════════════════════════════════════╗
║   GUNLUK BASLANGIC KONTROL LISTESI        ║
╠════════════════════════════════════════════╣
║ [ ] Docker Desktop acik mi?               ║
║     (Gorev cubugunda mavi balina)          ║
║                                            ║
║ [ ] Google Drive calisiyor mu?             ║
║     (Gorev cubugunda Drive simgesi)        ║
║                                            ║
║ [ ] HukukTakip-Baslat.bat'a cift tikla    ║
║     VEYA terminalde: npm run dev           ║
║                                            ║
║ [ ] Tarayicida localhost:5173 acildi mi?   ║
║                                            ║
║ [ ] Dashboard'da bugunun islerine bak      ║
║     - Yaklasan durusmalar                  ║
║     - Bekleyen gorevler                    ║
║     - Bildirimler                          ║
╚════════════════════════════════════════════╝
```

---

### Oneri 6: Gelecekte Daha Kolay Cozumler

Sistemin su anki hali gelistirici ortaminda (development mode) calismaktadir.
Ileride su iyilestirmeler yapilabiir:

| Iyilestirme | Aciklama | Zorluk |
|-------------|----------|--------|
| **Docker Compose ile tek komut** | `docker-compose up` ile server + client + DB hep birlikte kalkar | Orta |
| **Production build** | `npm run build` ile uretim surumu olusturup statik sunum yapmak | Orta |
| **Windows servisi** | Server'i Windows servisi olarak calstirmak — terminal kapatilsa da calismaya devam eder | Zor |
| **Bulut ortami (VPS)** | Sistemi bir sunucuya kurmak — sadece tarayici ile erisim, hicbir yerel kurulum gerekmez | Zor |
| **Electron masaustu uygulamasi** | Sistemi .exe olarak paketlemek — normal uygulama gibi cift tikla ac | Zor |
| **Otomatik guncelleme** | `git pull && npm install && npm run dev` tek komutla guncelleme | Kolay |

En pratik kisa vadeli iyilestirme: **Docker Compose ile tek komut**.
Bu sayede terminalde sadece `docker-compose up` yazarak her seyi baslatabilirsiniz.
Bunu uygulamak istersen onay ver.

---

*Bu kilavuz `hukuk-takip` sistemi v1 icin hazirlanmistir. 2026-04-04*
