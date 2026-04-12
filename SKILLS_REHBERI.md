# HukukTakip — Skills Kullanım Rehberi

Bu rehber, HukukTakip projesinde hangi Claude Code skill'lerinin ne zaman
kullanılacağını açıklar.

---

## frontend-design Skill'i

**Ne zaman kullan:**
- Yeni sayfa bileşenleri oluştururken
- Layout (sidebar, header, ana yapı) tasarlarken
- Dashboard, liste sayfaları, form ekranları yazarken
- Mevcut UI bileşenlerini iyileştirirken
- Responsive tasarım sorunlarını çözerken

**Tetikleyici komutlar:**
```
/frontend-design layout oluştur: sidebar + header + main content
/frontend-design müvekkil listesi sayfası
/frontend-design dava detay sayfası
/frontend-design dashboard bileşenleri
```

**Tasarım kısıtları (skill'e her seferinde ver):**
```
Renk paleti:
  primary: #1e3a5f (başlıklar, sidebar)
  accent: #2563eb (butonlar, aktif)
  success: #16a34a
  warning: #d97706
  danger: #dc2626
  bg: #f8fafc
  sidebar: #1e293b

Stack: React + TypeScript + Tailwind CSS + shadcn/ui + Lucide React
Dil: Türkçe arayüz
Tarih formatı: GG.AA.YYYY
Para: ₺ (Türk Lirası)
```

---

## anthropic-skills:xlsx Skill'i

**Ne zaman kullan:**
- Adım 15: Excel export özelliği için
- Dava masraf raporu Excel çıktısı
- Müvekkil listesi Excel export
- Tahsilat özeti Excel

---

## anthropic-skills:pdf Skill'i

**Ne zaman kullan:**
- Dava özeti PDF raporu
- Masraf döküm PDF'i
- Müvekkil dosya özeti PDF

---

## anthropic-skills:schedule Skill'i

**Ne zaman kullan:**
- Duruşma hatırlatma cron job'ları için
- Görev süresi dolma bildirimleri için
- Periyodik rapor gönderimi için

---

## Genel Kullanım Tavsiyeleri

1. **Her yeni UI sayfası için** frontend-design skill'ini kullan
2. **Tasarım tutarlılığı** için CLAUDE.md'deki renk paletini her seferinde skill'e ilet
3. **Mobil uyumluluk** için her bileşende responsive tasarım iste
4. **shadcn/ui bileşenlerini** sıfırdan yazmak yerine özelleştir
5. **Loading state ve error state** her bileşende olmalı
