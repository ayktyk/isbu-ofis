export type PromptTemplate = {
  id: string
  title: string
  category: string
  description: string
  badge: string
  content: string
}

export const promptData: PromptTemplate[] = [
  {
    id: 'strateji-belirleme',
    title: 'Hukuki Strateji Belirleme: Dava mi, Anlasma mi?',
    category: 'Stratejik Planlama',
    description:
      'Oyun teorisi yaklasimi ile dava acma veya uzlasma kararini analiz eder. Maliyet-fayda, risk ve surec karsilastirmasi yapar.',
    badge: 'Stratejik',
    content: `Sen deneyimli bir hukuk stratejisti ve muzakereci olarak gorev yapiyorsun. Asagidaki bilgileri kullanarak dava acma ile uzlasma/anlasma arasinda kapsamli bir karsilastirma analizi yap.

## DAVA BILGILERI
- Dava Turu: [ornegin: iscilik alacagi, kira uyusmazligi, tuketici davasi]
- Dava Degeri (Tahmini): [TL tutari]
- Karsi Taraf Profili: [bireysel / kurumsal / kamu kurumu]
- Mevcut Delil Durumu: [guclu / orta / zayif — kisa aciklama]
- Muvekkil Onceligi: [hizli cozum / tam tazminat / ilkesel kazanim]

## ANALIZ CIKTISI FORMATI

### 1. DAVA SENARYOSU
- Tahmini surec (ay/yil)
- Avukatlik ucreti ve masraf tahmini
- Basari olasiligi (dusuk/orta/yuksek — gerekce ile)
- En iyi ve en kotu senaryo tutarlari
- Riskler (zamanasimi, ispat yukunun yer degistirmesi, bilirkisi belirsizligi)

### 2. UZLASMA SENARYOSU
- Makul uzlasma araligi (alt-ust sinir)
- Karsi tarafin uzlasma motivasyonu
- Muzakere kaldiraclari (neleri kullanabiliriz)
- Uzlasma riskleri (dusuk tutar, emsal olusturmama)

### 3. KARAR MATRISI
| Kriter | Dava | Uzlasma |
|--------|------|---------|
| Tahmini net getiri | | |
| Sure | | |
| Maliyet | | |
| Risk seviyesi | | |
| Muvekkil memnuniyeti | | |

### 4. ONERI
Tum bu verilere gore net bir oneri sun. Muvekkile hangi secenegin neden daha uygun oldugunu acikla.`,
  },
  {
    id: 'dava-strateji-analizi',
    title: 'Dava Strateji Analizi',
    category: 'Dava Yonetimi',
    description:
      'Kapsamli dava strateji planlamasi. Guclu ve zayif yonler, karsi taraf analizi ve adim adim yol haritasi olusturur.',
    badge: 'Analiz',
    content: `Sen kidemli bir dava avukati olarak gorev yapiyorsun. Asagidaki bilgilere dayanarak kapsamli bir dava strateji raporu hazirla.

## DAVA OZETI
- Muvekkil Pozisyonu: [davaci / davali]
- Dava Turu: [...]
- Mahkeme: [...]
- Dava Konusu: [kisa ozet]
- Mevcut Asama: [dava oncesi / yargilama / istinaf / temyiz]

## OLAYLAR KRONOLOJISI
[Tarihleriyle birlikte onemli olaylari sirala]

## MEVCUT DELILLER
[Elimizdeki delilleri listele]

## ANALIZ CIKTISI

### 1. GUCLU YONLER (Lehimize olan noktalar)
- Her bir gucu kaynagi ile birlikte belirt (yasal dayanak, emsal karar, delil)

### 2. ZAYIF YONLER (Aleyhimize olan noktalar)
- Her bir zayifligi acikca belirt
- Her zayiflik icin savunma/karsitlik stratejisi oner

### 3. KARSI TARAF ANALIZI
- Karsi tarafin muhtemel savunma/iddia hatti
- Karsi tarafin guclu ve zayif yonleri
- Karsi tarafin muhtemel delilleri

### 4. HUKUKI DAYANAK HARITASI
- Uygulanacak kanun maddeleri
- Emsal Yargitay/Danistay kararlari (varsa HGK/IBK)
- Doktrin gorusleri

### 5. YOL HARITASI
| Adim | Islem | Sure | Oncelik |
|------|-------|------|---------|
| 1 | | | |
| 2 | | | |
| ... | | | |

### 6. RISK DEGERLENDIRMESI
- Dusuk risk senaryosu
- Orta risk senaryosu
- Yuksek risk senaryosu

### 7. ONERI
Net ve uygulanabilir strateji onerisi.`,
  },
  {
    id: 'evrensel-dilekce',
    title: 'Evrensel Dilekce Sablonu',
    category: 'Dilekce',
    description:
      'Her dava turu icin uyarlanabilir genel dilekce taslagi. Olaylar, hukuki degerlendirme, deliller ve talep bolumlerini icerir.',
    badge: 'Sablon',
    content: `Sen deneyimli bir dilekce yazari olarak gorev yapiyorsun. Asagidaki bilgileri kullanarak mahkemeye sunulmaya hazir, profesyonel bir dilekce taslagi olustur.

## DAVA BILGILERI
- Mahkeme: [ornegin: Istanbul 5. Is Mahkemesi]
- Davaci: [Ad Soyad / Unvan]
- Davaci Vekili: [Av. Ad Soyad, Baro Sicil No]
- Davali: [Ad Soyad / Unvan]
- Dava Turu: [...]
- Konu: [ornegin: Kidem ve ihbar tazminati ile iscilik alacaklari talebi]

## OLGULAR
[Kronolojik sirada olay ozetini yaz]

## HUKUKI DAYANAK
[Uygulanacak kanun maddeleri ve emsal kararlar]

## TALEP EDILEN KALEMLER
[Her alacak kalemini ayri ayri belirt — varsa tutar]

## DELILLER
[Elimizdeki delilleri listele]

## DILEKCE FORMATI

[MAHKEME ADI]'NA

DAVACI    : [...]
VEKILI    : [...]
DAVALI    : [...]
KONU      : [...]
DEGER     : [...]

ACIKLAMALAR

I. OLAYLAR
[Kronolojik, olgusal anlatim. Duygusal ifade kullanilmaz. Her paragraf bir olayi anlatir.]

II. HUKUKI DEGERLENDIRME
[Kanun maddeleri ve Yargitay kararlarina atifla hukuki argumanlari sirala. Her arguman ayri alt baslik altinda.]

III. DELILLER
1. [Belge adi ve aciklamasi]
2. [...]
(Bilirkisi incelemesi, tanik beyani, her turlu delil)

IV. HUKUKI NEDENLER
[Ilgili kanun maddeleri listesi]

V. SONUC VE TALEP
[Her alacak kalemini ayri madde olarak, net tutarlarla belirt. Yargilama giderleri ve vekalet ucretinin karsi tarafa yukletilmesini talep et.]

                                          Davaci Vekili
                                          Av. [Ad Soyad]

## KURALLAR
- Resmi ve profesyonel dil kullan
- Duygusal, subjektif ifadelerden kacin
- Her iddia icin somut delil veya yasal dayanak goster
- Yargitay kararlarina E. ve K. numaralariyla atif yap
- Sonuc-i talep bolumunde her kalemi ayri madde olarak yaz`,
  },
  {
    id: 'ise-iade-dilekce',
    title: 'Ise Iade Davasi Dilekcesi',
    category: 'Is Hukuku',
    description:
      '4857 sayili Is Kanunu kapsaminda ise iade davasi dilekcesi. Feshin gecersizligi, is guvencesi sartlari ve tazminat taleplerini icerir.',
    badge: 'Is Hukuku',
    content: `Sen is hukuku alaninda uzman bir dilekce yazari olarak gorev yapiyorsun. 4857 sayili Is Kanunu m.18-21 kapsaminda ise iade davasi dilekcesi hazirla.

## MUVEKKIL BILGILERI
- Ad Soyad: [...]
- TC Kimlik No: [...]
- Ise Giris Tarihi: [GG.AA.YYYY]
- Isten Cikis Tarihi: [GG.AA.YYYY]
- Son Brut Ucret: [TL]
- Gorev/Unvan: [...]
- Calisma Suresi: [yil, ay]

## ISVEREN BILGILERI
- Unvan: [...]
- Adres: [...]
- Isyerinde Calisan Sayisi: [30'dan fazla olmali]
- SGK Isyeri Sicil No: [...]

## FESIH BILGILERI
- Fesih Sekli: [sozlu / yazili bildirim / noter ihtarnamesi]
- Bildirilen Fesih Nedeni: [...]
- Gercek Fesih Nedeni (iddiamiz): [...]
- Arabuluculuk Tutanagi Tarihi: [GG.AA.YYYY]
- Arabuluculuk Sonucu: [anlasma saglanamadi]

## IS GUVENCESI SARTLARI KONTROLU
- [ ] 30'dan fazla isci calistirilmasi (4857 m.18/1)
- [ ] En az 6 ay kidem (4857 m.18/1)
- [ ] Belirsiz sureli is sozlesmesi
- [ ] Isyeri muduru veya isvereni temsil yetkisi yok
- [ ] Arabuluculuk sureci tamamlandi (7036 s.K. m.3)
- [ ] Dava arabuluculuk tutanagindan itibaren 2 hafta icinde aciliyor

## DILEKCE YAPISI

### I. OLAYLAR
- Muvekkil [tarih]'de davaliya ait isyerinde [gorev] olarak calismaya baslamistir.
- [Calisma sureci ozetini kronolojik yaz]
- [Fesih surecini detayli anlat]
- Arabuluculuk gorusmelerinde anlasma saglanamamis, [tarih] tarihli son tutanak duzenlemistir.

### II. FESHIN GECERSIZLIGI
A) Is guvencesi sartlarinin gerceklestigi
B) Feshin gecerli bir nedene dayanmadigi
   - Isverenin bildirdigi neden: [...]
   - Bu nedenin gercegi yansitmadigi/yetersiz kaldigi: [aciklama + delil]
C) Feshin son care ilkesine uyulmadigi
D) Savunma alinmadigi / usule aykiri fesih

### III. HUKUKI DAYANAK
- 4857 sayili Is Kanunu m.18, 19, 20, 21
- 7036 sayili Is Mahkemeleri Kanunu m.3, 11
- Yargitay 9. HD ve 22. HD kararlari
- [Spesifik emsal kararlar]

### IV. DELILLER
1. SGK hizmet dokumu
2. Is sozlesmesi
3. Fesih bildirimi
4. Arabuluculuk son tutanagi
5. Tanik beyanlari
6. [Diger deliller]

### V. SONUC VE TALEP
1. Feshin GECERSIZLIGINE ve muvekkilin ISE IADESINE,
2. Ise baslatilmama halinde 4-8 aylik brut ucret tutarinda tazminata,
3. Bosta gecen sure icin 4 aylik brut ucret ve diger haklarin odenmesine,
4. Yargilama giderleri ve vekalet ucretinin davaliya yukletilmesine
karar verilmesini saygiyla talep ederiz.`,
  },
  {
    id: 'istinaf-temyiz',
    title: 'Istinaf / Temyiz Layihasi',
    category: 'Kanun Yollari',
    description:
      'Istinaf veya temyiz asamasinda kullanilacak layiha sablonu. Usul ve esas yonunden bozma gerekceleri ile emsal kararlara dayali argumanlar icerir.',
    badge: 'Kanun Yolu',
    content: `Sen istinaf ve temyiz asamalarinda uzman bir ust mahkeme avukati olarak gorev yapiyorsun. Asagidaki bilgilere dayanarak etkili bir istinaf/temyiz layihasi hazirla.

## KARAR BILGILERI
- Mahkeme: [ilk derece mahkemesi adi]
- Esas No: [...]
- Karar No: [...]
- Karar Tarihi: [GG.AA.YYYY]
- Karar Ozeti: [lehimize/aleyhimize olan kisimlari belirt]
- Basvuru Turu: [istinaf / temyiz]
- Basvuru Suresi: [kalan gun]

## ITIRAZ EDILEN HUSUSLAR
[Kararin hangi kisim/kisimlarini itiraz edecegimizi belirt]

## LAYIHA YAPISI

### I. USUL YONUNDEN BOZMA GEREKCELERI
A) Gorev ve yetki itirazlari (varsa)
B) Taraf ehliyeti / dava ehliyeti sorunlari (varsa)
C) Hukuki dinlenilme hakkinin ihlali (HMK m.27)
   - Delillerin degerlendirilmemesi
   - Taleplerin karsilanmamasi
   - Beyanlarin dinlenmemesi
D) Bilirkisi raporuna itirazlarin degerlendirilmemesi
E) Yargilama usulune aykiri islemler

### II. ESAS YONUNDEN BOZMA GEREKCELERI
A) Maddi olgunun hatali tespiti
   - Mahkemenin kabul ettigi olay: [...]
   - Gercek durum ve delillerimiz: [...]
B) Hukuki nitelendirme hatasi
   - Mahkemenin uyguladigi hukuki kural: [...]
   - Uygulanmasi gereken hukuki kural: [...]
C) Emsal Yargitay/Danistay kararlarina aykirilik
   - [Emsal karar kunyesi ve ozeti]
   - [Yerel mahkeme kararinin bu emsale neden aykiri oldugu]
D) Tazminat/alacak hesaplama hatalari (varsa)

### III. EMSAL KARARLAR
[Her emsal icin: Daire, Tarih, Esas/Karar No, ilgili kisim ozeti]

### IV. SONUC VE TALEP
- Istinaf icin: Kararin KALDIRILMASINA ve davanin yeniden gorulmesine / duzeltilerek yeniden karar verilmesine
- Temyiz icin: Kararin BOZULMASINA

## KURALLAR
- Her itiraz noktasini ayri baslik altinda isle
- Somut delil ve emsal karar ile destekle
- Genel ifadelerden kacin, spesifik ol
- Usul itirazlarini esas itirazlardan once yaz
- HMK, ilgili ozel kanun ve Yargitay ictihatlarini kaynak goster`,
  },
  {
    id: 'bilirkisi-raporu-analizi',
    title: 'Bilirkisi Raporu Analizi',
    category: 'Belge Analizi',
    description:
      'Bilirkisi raporunu hukuki ve teknik acilardan inceler. Rapora itiraz noktalari, hesaplama hatalari ve eksiklikleri tespit eder.',
    badge: 'Analiz',
    content: `Sen bilirkisi raporlarini analiz etme konusunda uzman bir avukat olarak gorev yapiyorsun. Asagidaki bilirkisi raporunu detayli olarak incele ve itiraz raporu hazirla.

## RAPOR BILGILERI
- Mahkeme: [...]
- Esas No: [...]
- Bilirkisi Adi/Unvani: [...]
- Rapor Tarihi: [GG.AA.YYYY]
- Rapor Konusu: [ornegin: iscilik alacaklari hesaplamasi, hasar tespiti, deger tespiti]

## RAPOR ICERIGI
[Bilirkisi raporunun ozetini veya tam metnini buraya yapistir]

## MUVEKKIL POZISYONU
[Raporda lehimize ve aleyhimize olan hususlar]

## ANALIZ CIKTISI

### 1. GENEL DEGERLENDIRME
- Rapor gorev tanimina uygun mu?
- Tum talepler degerlendirilmis mi?
- Rapor gecikme var mi? (HMK m.274 suresi)

### 2. YONTEM ANALIZI
- Kullanilan hesaplama yontemi dogru mu?
- Alternatif yontem uygulanmali miydi?
- Emsal Yargitay uygulamasina uygun mu?

### 3. HESAPLAMA KONTROLU
| Kalem | Bilirkisi Hesabi | Dogru Hesap | Fark | Aciklama |
|-------|-----------------|-------------|------|----------|
| | | | | |

### 4. EKSIKLIKLER
- Degerlenmemis talepler
- Dikkate alinmamis deliller
- Eksik donem/kalem hesaplamalari

### 5. HATALI TESPITLER
- Maddi hata (yanlis veri kullanimi)
- Hukuki hata (yanlis kanun maddesi uygulamasi)
- Mantik hatasi (celiskili tespitler)

### 6. ITIRAZ NOKTALARI (Beyana Esas)
[Her itiraz noktasini madde madde, mahkemeye sunulacak beyan formatinda yaz]

1. [Itiraz 1]: [Aciklama + dayanak]
2. [Itiraz 2]: [Aciklama + dayanak]

### 7. EK BILIRKISI / YENI RAPOR TALEBI
[Gerekli ise ek rapor veya yeni bilirkisi heyeti talebi icin gerekceleri belirt]

### 8. ONERI
[Avukata: rapora itiraz mi etmeli, kabul mu etmeli, kismi itiraz mi sunmali?]`,
  },
  {
    id: 'sozlesme-inceleme',
    title: 'Sozlesme Inceleme',
    category: 'Belge Analizi',
    description:
      'Sozlesme metnini hukuki acilardan inceler. Risk analizi, eksik hukumler, muvekkil aleyhine maddeler ve revizyon onerileri sunar.',
    badge: 'Inceleme',
    content: `Sen sozlesme hukuku alaninda uzman bir avukat olarak gorev yapiyorsun. Asagidaki sozlesmeyi muvekkil lehine detayli olarak incele.

## SOZLESME BILGILERI
- Sozlesme Turu: [is sozlesmesi / kira / satis / hizmet / ortaklik / diger]
- Taraflar: [...]
- Muvekkil Taraf: [kiraci / isci / satici / hizmet alan / ...]
- Sozlesme Tarihi: [...]
- Sure: [belirli / belirsiz sureli]

## SOZLESME METNI
[Sozlesme metnini buraya yapistir]

## INCELEME CIKTISI

### 1. GENEL DEGERLENDIRME
- Sozlesmenin hukuki gecerliligi
- Sekil sartlarina uygunlugu
- Genel denge durumu (taraflar arasi)

### 2. MUVEKKIL ALEYHINE MADDELER
| Madde No | Icerik Ozeti | Risk Seviyesi | Aciklama |
|----------|-------------|---------------|----------|
| | | Yuksek/Orta/Dusuk | |

### 3. EKSIK HUKUMLER
[Sozlesmede olmasi gereken ama bulunmayan maddeler]
- [Eksik hukum 1]: Neden gerekli, onerilen metin
- [Eksik hukum 2]: ...

### 4. BELIRSIZ / MUGLAK IFADELER
[Uyusmazliga yol acabilecek belirsiz ifadeler ve netlestirilmis alternatifleri]

### 5. CEZAI SART VE TAZMINAT ANALIZI
- Orantililik degerlendirmesi
- Tek tarafli cezai sart var mi?
- Emsal Yargitay kararlarina gore gecerlilik durumu

### 6. FESIH VE SURE ANALIZI
- Fesih kosullari dengeli mi?
- Bildirim sureleri yeterli mi?
- Otomatik yenilenme sartlari muvekkil aleyhine mi?

### 7. UYUSMAZLIK COZUMU
- Yetkili mahkeme/hakem secimi muvekkil aleyhine mi?
- Arabuluculuk sarti var mi?
- Uygulanacak hukuk dogru mu?

### 8. REVIZYON ONERILERI
[Her oneri icin mevcut metin → onerilen metin seklinde yaz]

**Mevcut:** "[mevcut madde metni]"
**Onerilen:** "[revize madde metni]"
**Gerekce:** [...]

### 9. SONUC
- Imzalanabilir mi: [Evet / Revizyon sonrasi / Hayir]
- Kritik risk sayisi: [...]
- Oncelikli duzeltilmesi gereken maddeler: [...]`,
  },
  {
    id: 'ihtarname-hazirlama',
    title: 'Ihtarname Hazirlama',
    category: 'Resmi Yazisma',
    description:
      'Noterden gonderilecek ihtarname taslagi. Hukuki dayanaklari ve talepleri net bir sekilde iceren profesyonel ihtarname olusturur.',
    badge: 'Yazisma',
    content: `Sen ihtarname hazirlamada uzman bir avukat olarak gorev yapiyorsun. Asagidaki bilgilere dayanarak noterden gonderilmeye hazir bir ihtarname taslagi olustur.

## TARAF BILGILERI
- Ihtar Eden (Muvekkil): [Ad Soyad / Unvan]
- Ihtar Eden Vekili: [Av. Ad Soyad]
- Muhatap: [Ad Soyad / Unvan]
- Muhatap Adresi: [...]

## IHTARNAME KONUSU
- Konu Ozeti: [ornegin: odenmemis kira bedeli, is sozlesmesinin feshi, ayipli mal iadesi]
- Talep Edilen Islem: [odeme / tahliye / iade / ifa / diger]
- Mehil Suresi: [ornegin: 30 gun, 7 gun]
- Hukuki Dayanak: [ilgili kanun maddeleri]

## OLGUSAL ARKA PLAN
[Olaylari kronolojik sirada ve kisa paragraflarla anlat]

## IHTARNAME FORMATI

IHTARNAME

IHTAR EDEN    : [...]
VEKILI        : [...]
MUHATAP       : [...]

KONU: [Ihtarnamenin konusunu tek cumlede belirt]

SAYIN [MUHATAP],

[1. Paragraf: Taraflar arasi iliskinin tanimlanmasi]
Muvekkil [Ad] ile muhatap [Ad] arasinda [tarih] tarihli [sozlesme turu] sozlesmesi bulunmaktadir.

[2. Paragraf: Olaylarin kronolojik anlatimi]
[Olgusal durumu net ve kisa anlat]

[3. Paragraf: Ihlal ve hukuki dayanak]
Bu durum [ilgili kanun] m.[madde no] hukmune acikca aykirilik teskil etmektedir. Yargitay [Daire] Dairesi'nin [tarih] tarihli, [Esas/Karar No] sayili karari da bu yondedir.

[4. Paragraf: Talep ve mehil]
Yukarida belirtilen nedenlerle, isbu ihtarnamenin tarafiniza tebliginden itibaren [sure] icerisinde [talep edilen islem] yapmanizi; aksi takdirde aleyhinize [dava turu / icra takibi / cezai sikayet] baslatilacagini ve dogan/dogacak tum zararlarin talep edilecegini ihtar ederiz.

Saygilarimizla,

Ihtar Eden Vekili
Av. [Ad Soyad]

## KURALLAR
- Resmi ve kesin dil kullan, tehdit degil ihtar tonu
- Duygusal ifadelerden kacin
- Hukuki dayanaklari acikca belirt
- Mehil suresini net ver
- Sonuclari (dava, icra, sikayet) somut olarak belirt`,
  },
  {
    id: 'muvekkil-bilgilendirme',
    title: 'Muvekkil Bilgilendirme',
    category: 'Muvekkil Iliskileri',
    description:
      'Muvekkile dava durumu, hukuki surecler veya strateji hakkinda anlasilir bir bilgilendirme metni hazirlar. Hukuki jargondan arindirilmis, net anlatim.',
    badge: 'Iletisim',
    content: `Sen muvekkil iletisimi konusunda uzman bir avukat olarak gorev yapiyorsun. Asagidaki hukuki durumu muvekkile anlasilir, guven verici ve profesyonel bir dille acikla.

## BILGILENDIRME BILGILERI
- Muvekkil Adi: [...]
- Dava/Konu: [...]
- Bilgilendirme Turu: [dava durumu / strateji aciklamasi / karar bildirimi / surec bilgisi / belge talebi]
- Iletisim Kanali: [e-posta / telefon ozeti / yuz yuze gorusme notu]

## MEVCUT DURUM
[Davanin/konunun guncel durumunu kisa ozetle]

## AKTARILACAK BILGILER
[Muvekkile iletilmesi gereken bilgiler]

## BILGILENDIRME CIKTISI

### MUVEKKILE ILETILECEK METIN

Sayin [Muvekkil Adi],

[1. Paragraf: Selamlama ve konu giris]
[Dava/konu hakkinda kisa hatirlatma]

[2. Paragraf: Guncel durum]
[Hukuki jargon kullanmadan, sade Turkce ile mevcut durumu acikla]
[Teknik terimleri kullanirsan parantez icinde kisa aciklama ekle]

[3. Paragraf: Bundan sonraki adimlar]
[Yapilacak islemleri madde madde listele]
1. [Adim 1 — tahmini tarih]
2. [Adim 2 — tahmini tarih]
3. [...]

[4. Paragraf: Muvekkilden beklenenler (varsa)]
[Belge, bilgi veya onay gerekiyorsa net olarak belirt]

[5. Paragraf: Kapanig]
[Guven verici, profesyonel kapanig]

Saygilarimla,
Av. [Ad Soyad]
[Telefon]
[E-posta]

---

### AVUKAT ICIN NOTLAR (Muvekkile iletilmeyecek)
- Hassas noktalar: [muvekkile soylenmemesi gereken stratejik detaylar]
- Risk uyarisi: [muvekkilin bilmesi gereken ama dikkatli aktarilmasi gereken riskler]
- Takip gerektiren islemler: [...]

## KURALLAR
- Hukuki jargonu minimumda tut
- "Kaybedebiliriz" yerine "risk tasimaktadir" gibi olculu ifadeler kullan
- Kesin vaatlerde bulunma ("kesinlikle kazaniriz" yasak)
- Sureleri net ver
- Muvekkile sorumluluk yukluyorsan bunu kibarca ama net yaz`,
  },
]
