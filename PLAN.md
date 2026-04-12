# PLAN.md

## Hedef

Bu projenin yeni hedefi nettir:

- frontend `Vercel` üzerinde yayınlanacak,
- backend bulutta ayrı servis olarak çalışacak,
- uygulama `PWA` olacak ve telefonda ana ekrana eklenebilecek,
- odak çekirdek ofis yönetimi olacak,
- araştırma/AI/yerel CLI hattı bu projeden çıkarılacak,
- yeni araçlar zamanla bu ürünün içine eklenecek,
- dava yönetiminde `aktif davalar`, `bekleyen davalar` ve `biten davalar` ayrımı görünür olacak.

Bu plan o hedefe göre yeniden düzenlenmiştir.

---

## Ürün Kapsamı

### V1 çekirdek kapsam

- Giriş / oturum yönetimi
- Dashboard
- Müvekkil yönetimi
- Dava yönetimi
- Duruşmalar
- Görevler
- Masraf / tahsilat
- Takvim
- Bildirimler
- Belge yükleme
- Hesaplama araçları için temel araç alanı
- Mobil kullanım
- PWA

### V1 dışında bırakılanlar

- İçtihat araştırma modülü
- mevzuat / yargı / notebook / CLI tabanlı araştırma akışları
- AI workspace
- briefing / intake / research / procedure / pleading / defense pipeline
- yerel Google Drive klasör mantığına bağlı gelişmiş otomasyon

---

## Mimari Karar

### Hedef mimari

- Frontend: `Vercel`
- Backend API: `Railway` veya `Render`
- Veritabanı: `Neon Postgres` veya `Supabase Postgres`
- Dosya saklama: `S3`, `Cloudflare R2` veya `Supabase Storage`
- Bildirim / zamanlanmış işler: backend worker veya platform scheduler

### Neden bu mimari

- Vercel frontend ve PWA dağıtımı için çok uygun.
- Mevcut Express backend serverless mantıktan çok ayrı servis mantığına uygun.
- Belgeler ve medya dosyaları yerel disk yerine object storage’a taşınmalı.
- Bildirim ve zamanlanmış işler kalıcı backend tarafında daha güvenli yürür.

---

## Faz 1 - Çekirdek Temizlik

### Amaç

Projeyi araştırma/AI yükünden arındırıp çekirdek dava takip ürününe çevirmek.

### Yapılacaklar

- araştırma ve AI ile ilgili route, sayfa, hook ve bileşenleri kaldır
- dava detay ekranını sadeleştir
- dava formundan otomasyon alanlarını kaldır
- dava listesi ve dashboard’da `aktif / bekleyen / biten` ayrımını görünür hale getir
- gereksiz shared schema ve export bağımlılıklarını azalt

### Çıktı

- daha temiz kod tabanı
- daha okunabilir frontend akışı
- deploy öncesi daha az teknik yük

---

## Faz 2 - Production Hazırlığı

### Amaç

Uygulamayı yerel geliştirme yapısından production uyumlu yapıya taşımak.

### Yapılacaklar

- frontend ve backend ortam ayarlarını ayır
- production API base URL yapısını netleştir
- cookie güvenliği, CORS ve domain ayarlarını production’a uygunlaştır
- healthcheck, hata loglama ve temel gözlemlenebilirlik ekle
- deploy dokümantasyonu yaz

### Çıktı

- production’a hazır frontend
- production’a hazır backend
- deploy checklist

---

## Faz 3 - Bulut Backend

### Amaç

Backend’i local bağımlılıklardan ayırıp bulutta çalıştırmak.

### Yapılacaklar

- backend servisini Railway veya Render’a taşı
- cloud Postgres kur ve bağla
- env secret yönetimini düzenle
- migration ve seed akışını production’a uygun hale getir
- belge upload akışını cloud storage’a taşıma altyapısını hazırla

### Çıktı

- canlı backend URL
- canlı veritabanı
- çalışan auth ve CRUD akışları

---

## Faz 4 - Vercel Frontend

### Amaç

Frontend’i Vercel’e sorunsuz şekilde almak.

### Yapılacaklar

- Vercel build ve output ayarlarını netleştir
- environment variable’ları frontend’e bağla
- production API ile entegrasyonu doğrula
- auth akışını canlı domain üzerinden test et
- temel sayfaların SEO/meta/PWA başlangıç ayarlarını düzenle

### Çıktı

- canlı frontend URL
- Vercel deploy pipeline

---

## Faz 5 - PWA

### Amaç

Uygulamayı telefonda ana ekrana eklenebilir hale getirmek.

### Yapılacaklar

- web manifest
- service worker
- offline cache stratejisi
- app icon seti
- splash / theme color / standalone görünüm
- install prompt davranışı

### Mobil odak ekranlar

- Dashboard
- Davalar
- Dava detay
- Görevler
- Takvim
- Bildirimler

### Çıktı

- Android ve iPhone’da ana ekrana eklenebilir sürüm

---

## Faz 6 - Premium Frontend

### Amaç

Kurumsal, hızlı ve güven veren bir arayüz çıkarmak.

### Yapılacaklar

- dashboard’ı daha güçlü yönetim ekranına çevir
- dava listesinde `aktif / bekleyen / biten` ayrımını kalıcı UX haline getir
- mobil navigation’ı iyileştir
- kartlar, boş durumlar, filtreler ve tabloları premium his verecek seviyeye taşı
- tipografi, boşluk ve renk sistemini üretim düzeyinde rafine et

### Çıktı

- daha güçlü masaüstü görünümü
- daha rahat mobil kullanım
- daha net durum odaklı dava yönetimi

---

## Faz 7 - Belgeler ve Dosya Yönetimi

### Amaç

Belgeleri gerçek production kullanımına uygun hale getirmek.

### Yapılacaklar

- local upload mantığını object storage’a taşı
- güvenli dosya erişim stratejisi kur
- indirme / önizleme / silme akışlarını bulut storage ile yeniden düzenle
- dava bazlı dosya organizasyonunu koru ama local path bağımlılığını kaldır

### Çıktı

- bulut belge yönetimi
- deploy uyumlu dosya altyapısı

---

## Faz 8 - Bildirim ve Operasyon

### Amaç

Canlı kullanımda sistemin güvenilirliğini artırmak.

### Yapılacaklar

- yaklaşan duruşma ve görev hatırlatmalarını scheduler ile üret
- e-posta bildirimi gerekiyorsa ikinci aşamada ekle
- backup ve restore planı hazırla
- hata loglarını ve temel kullanım sinyallerini takip et

### Çıktı

- daha güvenilir canlı kullanım
- operasyon checklist

---

## Faz 9 - Yeni Araçlar

### Amaç

Bu ürünü zamanla ofis araç merkezine çevirmek.

### Sonradan eklenecek araç örnekleri

- gelişmiş hesaplamalar
- tahsilat planlama
- ofis performans ekranları
- hızlı belge şablonları
- görev otomasyonları
- rapor ve export araçları

### Not

Araştırma sistemi bu projeye geri dönecekse ancak API veya servis tabanlı, bulut uyumlu bir yaklaşımla geri eklenmeli.

---

## Öncelik Sırası

İlk uygulama sırası şu olmalı:

1. araştırma/AI kalıntılarını temizle
2. dava akışını sadeleştir
3. `aktif / bekleyen / biten` dava ayrımını yerleştir
4. production backend hazırlığını yap
5. frontend’i Vercel’e al
6. PWA ekle
7. mobil ve premium UI rafinesi yap
8. belge storage katmanını buluta taşı

---

## Başarı Kriteri

İlk canlı sürüm başarılı sayılacaksa kullanıcı şunları sorunsuz yapabilmeli:

- bilgisayardan giriş yapıp günlük ofis işini yönetebilmek
- telefondan ana ekrana eklenmiş sürümle aynı sistemi kullanabilmek
- aktif, bekleyen ve biten davaları net ayırabilmek
- görev, duruşma, masraf ve tahsilat takibini hızlıca yapabilmek
- sisteme sonradan yeni araçlar eklenebilecek temiz bir temel üzerinde ilerlemek
