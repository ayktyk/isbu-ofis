# Dava çalışma alanı — teslim kaydı (12.09.2026)

## Tamamlanan kapsam

- Mobil dava kartları; müvekkil, mahkeme, esas ve durum görünürlüğü. Arama/filtre/sayfa URL'de, geri dönüş kaydırması oturumda korunur.
- Dava detayı Özet / İşler / Belgeler / Mali. Formlar ve sekmeler bellekte girdileri korur. Belge işlemleri birleşik detayı yeniler.
- Hızlı not, dava içinden görev tamamla/geri al, süreli iş oluşturma ve günlük adımlarını tamamlama. Bitmiş dava ve rol kontrolleri.
- Listede sıradaki iş, geciken iş sayısı, sonraki duruşma ve son gelişme. CMK dahil/hariç seçimi.
- Düzenlenebilir çalışma aşaması, kimden/ne beklendiği ve kontrol tarihi. Yeni `case_workspaces` tablosu; eski dava alanları aynen korunur. Güncellemeler günlüğe yazılır; revision kontrolü başka ekrandaki güncellemeyi sessizce ezmez.
- Tüm portföyde geciken işler/kontroller, beklenen yanıt/belge, plansız dosyalar ve bugün kontrol edilecekler filtreleri. Filtre sayfalamadan önce uygulanır; bitmiş dosyalar iş filtrelerine katılmaz.
- Günlük ana ekran: dava araması, bugünün duruşmaları ve vadesi gelen görevler, kontrol listesine bağlantı; sabitlenen/son açılan dosyalar. Kısayollar kullanıcıya ve cihaza özeldir. Dashboard görevleri bağlı davaya gider.
- Duruşma sonucu + isteğe bağlı sonraki duruşma + en fazla 10 görev tek transaction içinde kaydedilir. Yeni `hearing_review_receipts` tablosu aynı isteğin tekrarında çift kayıt oluşmasını önler; değişen içerikli aynı istek reddedilir. Önceki duruşma notları değiştirilmez; sonuç notu günlüğe eklenir.
- Hızlı not, çalışma planı ve duruşma sonrası kayıt taslakları kullanıcı/dosya bazında bu cihazda kalıcıdır. Bağlantı yokken yazma gönderilmez, otomatik arka plan yazma kuyruğu yoktur.
- PWA sürüm geçişi artık kullanıcı düğmesiyle yapılır; otomatik form kesen yenileme kapalı. Görünür olduğunda sürüm kontrol edilir. Bağlantı/güncellik göstergesi ve yenileme düğmesi eklendi.
- Kalıcı sorgu önbelleği kullanıcı kimliğiyle ayrıldı; hesap değişiminde bellek sorguları iptal edilip temizlenir. Service worker API yanıtlarını ortak bir önbellekte tutmaz. Başarısız yazmalar otomatik tekrar gönderilmez.

## Veri koruma

Güncel pg_dump yedeği ve ayrı ortamda geri yükleme doğrulaması tamamlandı. Yedek/migration makbuzları `backups/` içinde; ayrıntı `backups/README.md`. Dump dosyaları Git'e dahil edilmez.

Manuel additive migration 12.09.2026 00:09:24 UTC'de yalnızca `case_workspaces` ve `hearing_review_receipts` tablolarını oluşturdu. Önce/sonra 86 dava, 92 müvekkil. Eski kayıtlar değiştirilmedi. Migration build/startup/deploy komutuna eklenmedi.

## Testler

- 41 istemci testi: özet sıralaması, sekme/rol kontrolleri, belge yenilemesi, filtre/validasyon ve hesaplar arası önbellek ayrımı.
- 3 sunucu toplu sorgu/sahiplik testi.
- Ayrı geçici PostgreSQL'e geri yüklenmiş yedek üzerinde 5 HTTP entegrasyon testi: eski açıklamanın korunması, sürüm çakışması, sayfalama öncesi filtre, sahiplik, eşzamanlı çift gönderim, hata anında transaction rollback ve düzenleme yetkileri.
- Shared, server ve client/PWA üretim derlemeleri.
- Gerçek veritabanında salt okunur 20 dava özeti kontrolü; canlı kayıtlara test verisi yazılmadı.

## Kullanım sınırları ve cihaz kontrolü

Tarayıcı aracı bağlantı sağlayamadı. Gerçek telefon, dokunma/klavye, uygulamayı kapatıp açma ve servis çalışanı sürüm geçişi kullanıcı cihazında doğrulanmalıdır. Bu kontroller yapılmış sayılmıyor.

Kalıcı taslak kapsamı hızlı not, çalışma planı ve duruşma sonuç formudur. Diğer formlar/dosya seçimleri uygulama belleğinde korunur; kapanışta korunmaz. Güncelleme düğmesi bu formları önce kaydetmeyi hatırlatır. Çevrimdışı belge yükleme ve otomatik senkronizasyon eklenmedi. Kısayollar cihazlar arasında eşitlenmez; kaydedilmiş çalışma planı sunucudan tüm cihazlara gelir.

Cihaz kabulü: 390 px görünüm → dava ara → dosyayı aç → planı kaydet → not taslağıyla kapat/aç → görev tamamla/geri al → duruşma sonucu kaydet → filtreli listeye dön. Bu akışlar test hesabında denenmelidir.
