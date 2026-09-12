# Yazı düzeni ve kayıt bağlantıları — 12.09.2026

- Tüm temalarda başlık/gövde yazısı Inter ailesinde birleştirildi; başlıklar ve satır aralıkları düzenlendi. Sayılar aynı ailede hizalı rakamlarla gösterilir. Mobil form yazısı 16 px. Yedi yazı ailesi yerine Inter ve kodlar için JetBrains Mono yüklenir.
- Ortak `recordLinks.ts`: görev, süreli iş, duruşma, not, belge, masraf, tahsilat ve günlük girdileri dava içinde ilgili sekme/satıra gider. Kayıt yüklenince kaydırılır ve vurgulanır. Bulunamayan kayıt açıkça belirtilir. Bağlantıyla gelen tamamlanmış görev görünür kalır.
- Dashboard, günlük masa, takvim, arama sonuçları, bildirimler, görev/süreli iş satırları ve dava kartları ortak bağlantıları kullanır. Genel liste düğmeleri listeye gitmeye devam eder.
- Bağlantıdan gelen bağımsız görev, süreli iş ve geçmiş duruşma ilgili listede tek kayıt olarak gösterilir; tüm kayıtları göster düğmesi vardır. Arama sonucu görüşme seçilir; arabuluculuk dosyası seçilip açılır.
- Dava detayında müvekkil açılır. Müvekkilden yeni dava açarken müvekkil önceden seçilir; ilk 100 müvekkil içinde olmasa da seçili seçenek yüklenir. Müvekkile dönüşen görüşmenin adı müvekkile bağlanır. Tahsilatlar bağlı dosyanın mali bölümüne gider.
- Belge indirme mevcut API istemcisini kullanır; farklı origin sunucu ve Bearer oturumu desteklenir.

Veritabanı, şema ve sunucu değiştirilmedi. Testler: bağlantı eşlemeleri, tamamlanmış görev odağı ve sabit belge/not hedefleri dahil istemci testleri; TypeScript/Vite/PWA derlemesi. Gerçek cihaz ve görsel tarayıcı kontrolü yapılmış sayılmıyor.
