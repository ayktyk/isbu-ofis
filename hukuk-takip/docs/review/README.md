# Dava listesi takip özeti — yerelde uygulandı

`cases-tracking.patch` inceleme kaydıdır; değişiklik zaten `server/src/routes/cases.ts` dosyasına uygulanmıştır. Tekrar uygulanmamalıdır.

GET /api/cases, `includeTracking=true` istendiğinde `trackingVersion: 1` ve her dava için `tracking` döndürür. Seçenek Zod ile doğrulanır. Seçeneği göndermeyen istemcilerin mevcut yanıtı korunur.

`server/src/utils/caseTrackingLoader.ts` yalnızca SELECT kullanır. Okunan tablolar: cases, tasks, case_diary_entries, case_hearings, notes. Her sorguda dava sahipliği ve arşiv filtreleri korunur. Sayfa başına dört toplu sorgu çalışır; dava başına detay isteği yapılmaz. Özet sayfada bulunan davaları kapsar, portföy geneli filtre/sayaç değildir.

Özet; ilk açık görev/günlük adımı, açık ve geciken iş sayıları, süreli iş sayısı, yaklaşan bekleyen duruşma ve son manuel gelişme/not içerir. Geçmiş kayıtlar değiştirilmez. Çalışma aşaması çıkarımı yapılmaz; mevcut dava durumu ayrı kalır. Eski API yanıtında eksik takip bilgisi kullanıcıya bildirilir. CMK dosyaları varsayılan olarak listeye dahildir.

## Veri koruma

AGENTS.md gereğince yedek ve onay ardından uygulandı. 12.09.2026 tarihinde PostgreSQL 17 araçlarıyla özel biçimli pg_dump alındı, SHA-256 kaydedildi ve ağ bağlantısı olmayan geçici PostgreSQL ortamına başarıyla geri yüklendi. Doğrulanan sayılar arasında 86 dava, 92 müvekkil, 100 görev var. Ayrıntılar ve makbuz yolu `backups/README.md` içinde.

Canlı veriler ve şema değiştirilmedi. Migration çalıştırılmadı. Sunucu startup kodu çağrılmadı. Yedek üretime geri yüklenmedi.

## Doğrulama

- İstemci: 37 test; sunucu toplu sorgu/sahiplik kontrolleri: 3 test.
- Shared, server ve client üretim derlemeleri geçti.
- `server/review/checkCaseTracking.mjs` gerçek veritabanında READ ONLY işlemle 1 kullanıcıya ait 20 davanın özetini ve başka kullanıcı adına sorguda veri dönmediğini doğruladı. Çıktıda kişisel bilgi yok.
- `server/review/readOnlyBackup.mjs` yedekleme; `verifyTrackingBackup.mjs` izole geri yükleme yardımcılarıdır. Uygulama başlangıcında çalışmazlar.
- Gerçek cihaz, HTTP etkileşim testi ve canlı yayın henüz yapılmadı.

Çalışma aşaması, beklenen gelişme ve kontrol tarihi için yeni kalıcı alanlar ayrı additive tasarım ve yedek/onay gerektirir.

## Sonraki paketle genişletildi (12.09.2026)

Salt okuma paketi üzerine çalışma planı, portföy filtreleri, atomik duruşma sonrası kayıt, günlük ana ekran ve PWA korumaları eklendi. Artık iki yeni tablo vardır; manuel additive migration ve güncel doğrulanmış yedek kaydı `backups/README.md` içindedir. Yukarıdaki "yeni kalıcı alanlar kapsam dışı" açıklaması yalnızca ilk salt-okuma paketinin tarihsel kapsamıdır. Güncel teslim ve test sınırları `docs/CASE_WORKSPACE_PROGRESS.md` dosyasındadır.
