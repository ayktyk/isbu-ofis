# Asistan Entegrasyonu (rev14)

Dış asistan (Python betikleri + MCP sunucusu) avukatın verisini **okur** ve yalnızca
**öneri** gönderir. Hiçbir öneri avukat uygulamada onaylamadan kayda dokunmaz.
Onaylanan öneri tek transaction içinde uygulanır, son düzenleyen `asistan` olarak
işaretlenir ve `integration_events` tablosuna denetim izi düşer.

```
asistan ──(API anahtarı)──> POST /api/integration/proposals ──> assistant_proposals (pending)
avukat  ──(oturum/JWT)───> POST /api/proposals/:id/approve  ──> tür bazlı uygulayıcı ──> cases / case_hearings / tasks / ...
                                                                 └─> integration_events, Google Takvim senkronu
```

## 1. Kimlik doğrulama

| Taraf | Yöntem | Uçlar |
|---|---|---|
| Avukat (uygulama) | Mevcut JWT oturumu (cookie veya `Authorization: Bearer <jwt>`) | `/api/integration-keys`, `/api/proposals`, `/api/pulse` |
| Asistan (betik/MCP) | `Authorization: Bearer isbu_sk_<43 karakter>` | `/api/integration/*` (JWT burada **kabul edilmez**) |

- Anahtar `POST /api/integration-keys` ile oluşturulur ve **yalnızca bu yanıtta bir kez** döner.
  Veritabanında yalnızca ilk 16 karakter (`key_prefix`, arama için) ve `sha256` özeti
  (`key_hash`) saklanır; karşılaştırma sabit zamanlıdır.
- Kapsamlar: `read` (okuma uçları), `propose` (öneri gönderme). Betiğe en az yetkiyi verin.
- İptal: `POST /api/integration-keys/:id/revoke` (geri alınamaz; satır silinmez, `revoked_at` dolar).
- Anahtar yönetimi ve öneri onayı yalnızca `admin`/`lawyer` rolündedir.
- Anahtar `.env` veya işletim sistemi anahtar deposunda tutulur; repoya/loga yazılmaz.

## 2. Asistan uçları — `/api/integration/*`

Okuma (`read`):

| Uç | Açıklama |
|---|---|
| `GET /cases[?include_closed=1]` | Davalar + çalışma planı + nabız (`nextItem`, `openBalance`, `flags`, `lastActivityAt`) |
| `GET /cases/:id` | Dava detayı: çalışma planı, icra özeti, duruşmalar, `nextHearing`, açık görev/süreler (`openDeadlines`), son 30 günlük, bakiye + taksitler, bekleyen öneriler |
| `GET /hearings/upcoming?days=30` | Bekleyen duruşmalar (en çok 365 gün) |
| `GET /deadlines?days=60` | Açık süreli işler (tarihsiz/koşullu olanlar dahil) |
| `GET /collections/outstanding` | Bekleyen dava + arabuluculuk ücretleri ve toplam |
| `GET /pulse` | Dosya nabzı (bkz. §5) |
| `GET /changes?since=ISO` · `GET /changes?cursor=…` | **Avukatın** değiştirdiği dava/duruşma/görev/günlük satırları (arşivlenenler dahil), tablo başına `(updated_at, id)` sırasıyla. İlk çağrı `since` ile; sonrakiler yanıttaki opak **`next_cursor`** ile (`?cursor=`). `truncated=true` ise en az bir tablo sayfa sınırına (`?limit=`, en çok 500) ulaşmıştır, hemen `next_cursor` ile devam edin. İmleç eşit zaman damgalı satırları atlamaz/tekrarlamaz. `until` yalnız geriye uyumluluk içindir: `truncated=true` iken `until`'i `since` olarak kullanmak satır kaçırır. |
| `GET /proposals?status=&since=` | Asistanın kendi önerilerinin durumu |

Yazma (`propose`): `POST /proposals`

```json
{ "items": [{
  "kind": "hearing_upsert",
  "external_ref": "uyap:2026/101:durusma:1",
  "case_ref": { "case_number": "2026/101", "court_name": "İstanbul 3. İş Mahkemesi" },
  "payload": { "hearing_date": "2026-11-20T10:00:00+03:00", "court_room": "Salon 4" },
  "summary": "UYAP: yeni duruşma", "reason": "UYAP eşitlemesi 10.10.2026",
  "source": "uyap", "request_id": "uyap-2026-10-10-0001"
}]}
```

- `case_ref`: `id` | `external_ref` | `buro_kodu` | `case_number`+`court_name` (büyük/küçük harf duyarsız).
  Birden fazla dava eşleşirse öğe hata alır.
- `source`: `uyap` | `kalkan` | `icra_ozet` | `asistan`. `request_id`: 8–100 karakter, benzersiz.
- Yanıt `{ counts, results[] }`; herhangi bir öğe hatalıysa HTTP **207**. Öğe durumları:
  `created`, `updated` (aynı anahtarın bekleyen önerisi güncellendi), `duplicate` (aynı
  `request_id` daha önce işlendi), `no_change` (kayıt zaten güncel, öneri açılmadı),
  `skipped` (hedef avukat tarafından arşivlenmiş), `error` (doğrulama/referans hatası).
- `deferred_case: true`: dava henüz yok (ör. aynı partide `case_upsert`); dava onay anında yeniden aranır.
- **`external_ref`'siz kayıtla eşleşme:** `external_ref` ile hedef bulunamazsa avukatın elle girdiği
  kayıt doğal anahtarla aranır — duruşmada aynı dava + aynı gün/saat (dakika); süre/görevde aynı dava
  (davasızsa davasız) + başlık (büyük/küçük harf duyarsız) + aynı vade günü (İstanbul; koşullu sürede
  ikisi de tarihsiz). Tek eşleşme varsa yeni kayıt açılmaz: öneri o kaydı hedefler (`before` onun
  anlık görüntüsü, avukatın dolu değerini değiştirecekse `conflict=true`) ve onayda kayda öneri
  `external_ref`'i yazılır. Değer değişmese de bağlantı için öneri açılır (`no_change` dönmez).
  Olay kaydında `matched_without_ref: true`.

### Öneri türleri (payload snake_case, bilinmeyen alan reddedilir)

| kind | Hedef | Kural |
|---|---|---|
| `case_upsert` | `cases` (`external_ref` ile, yoksa `case_ref`) | Yeni dava: `title` + `client_id` veya `client_name` (aynı adlı tek müvekkil bulunur, yoksa oluşturulur). Var olan davada **yalnızca boş alanlar** doldurulur; dolu alan için `overwrite: ["title", ...]` gerekir. |
| `hearing_upsert` | `case_hearings` (dava + `external_ref`) | `hearing_date` saat dilimli ISO. Ekleme/güncelleme sonrası Google Takvim senkronu avukatın kullandığı kod yolundan çalışır. |
| `deadline_upsert` | `tasks` (`is_deadline=true`, kullanıcı + `external_ref`) | `due_date` gün (`YYYY-AA-GG`, İstanbul 09:00'a yerleşir) veya ISO. Koşullu süre: `conditional: true` + `condition`; `due_date` boş kalır, başlık `[Koşullu]` ile başlar, koşul açıklamaya yazılır. |
| `task_add` | `tasks` (kullanıcı + `external_ref`) | Davasız da olabilir. |
| `diary_add` | `case_diary_entries` (dava + `external_ref`) | Aynı anahtarla girdi varsa tekrar eklenmez. |
| `next_step` | `target: workspace` → `case_workspaces` (aşama/beklenen/kontrol tarihi, `revision` artar); `target: diary` → günlüğe sonraki adım | |
| `status_change` | `cases.status` (+`close_date`) | Günlüğe "X → Y" girdisi düşer. |
| `enforcement_upsert` | `case_enforcement.data` (jsonb) | Anahtarlar: alacakli, borclu, rolumuz, alacak, tahsilat, odeme_emri, itiraz, kesinlesme, son_islem, tasinmaz, arac, banka, sgk, fiili, sorgu_onerisi, not. Gelen anahtarlar üzerine yazar, diğerleri korunur. |

Şemalar: `shared/src/integration.ts` (`proposalPayloadSchemas`).

## 3. Öneri yaşam döngüsü

```
pending ──onay──> applied            (uygulandı; applied_target_id dolu)
   │      └─────> failed             (iş kuralı hatası, ör. müvekkilsiz yeni dava; error dolu)
   ├──ret───────> rejected
   └──kayıt zaten güncel──> superseded
```

- **Tek bekleyen öneri:** aynı (kullanıcı, kind, external_ref) için yeni öneri gelirse bekleyen
  öneri güncellenir (`updated`), yenisi açılmaz (kısmi tekil indeks de bunu zorlar).
- **İdempotens:** `request_id` önce `assistant_proposals`, sonra `integration_events` geçmişinde
  aranır; eski bir istek tekrar gelse bile içerik geri yazılmaz.
- **`before` + `conflict`:** öneri anındaki hedef satırın anlık görüntüsü saklanır. Hedefi en son
  avukat düzenlemişse (`updated_by_actor='avukat'`) ve öneri **dolu** bir değeri değiştirecekse
  `conflict=true`. Mevcut tüm satırlar `avukat` kabul edilir. Onay listesi çakışmalıları üstte gösterir.
- **Onay** (`POST /api/proposals/:id/approve { payload?, note?, expected_updated_at, force_overwrite? }`):
  düzenlenmiş payload yeniden doğrulanır (geçersizse 422, öneri `pending` kalır). Uygulama tek
  transaction + savepoint içinde; iş kuralı hatasında öneri `failed` olur ve yanıt 422 döner. Davası
  henüz olmayan öneri 409 alır, durum değişmez. Aynı öneriyi tekrar onaylamak `repeated: true` döner.
- **Eşzamanlılık sözleşmesi (ZORUNLU):** istemci, avukatın listede gördüğü önerinin `updatedAt`
  değerini **`expected_updated_at`** (ISO) olarak gönderir. Sunucudaki değer farklıysa (asistan
  öneriyi o arada güncellediyse) **409 `{ code: 'PROPOSAL_CHANGED', current_updated_at }`**; hiçbir
  şey yazılmaz, liste yenilenip yeniden incelenir. Alan gönderilmezse kontrol atlanır — bu yalnızca
  eski istemcilerle geriye uyumluluk içindir; yeni istemciler alanı **her zaman** göndermelidir.
  Ret (`/reject`) da aynı alanı kabul eder.
- **Hedef değişikliği koruması:** onay anında hedef kayıt yeniden okunur ve öneri anındaki `before`
  ile karşılaştırılır (`shared` → `detectTargetChange`). Kayıt o zamandan beri değiştiyse (`updated_at`
  ileri gitti veya bir alan farklı) **ve** son düzenleyen avukatsa ya da önerinin yazacağı alanlardan
  biri değiştiyse — veya hedef öneriden sonra ortaya çıktıysa — **409 `{ code: 'TARGET_CHANGED',
  current, before, after, changed_fields }`** döner (`current`/`before` hedef anlık görüntüsü, `after`
  önerinin yazacağı değerler). Hiçbir şey yazılmaz, öneri `pending` kalır. Avukat açıkça "yine de
  üzerine yaz" derse aynı istek **`force_overwrite: true`** ile tekrarlanır; olay kaydına
  `force_overwrite: true` düşer. Asistanın başka bir onaylı önerisiyle ilgisiz alan değişmişse
  (ör. aynı partide dava bilgisi + durum değişikliği) bloklanmaz. Yalnız ekleyen türlerde
  (`diary_add`, `next_step` günlük hedefi) kontrol yoktur.
- **Toplu:** `POST /api/proposals/bulk { ids, action: approve|reject, note?, expected_updated_at: { [id]: updatedAt } }`
  — `case_upsert` önce işlenir ki aynı partideki duruşma/süre önerileri yeni davayı bulsun. Toplu
  uçta **`force_overwrite` yoktur** (gönderilirse yok sayılır). Sürümü uyuşmayan veya hedefi değişmiş
  kalemler atlanır ve sonuç satırında `{ id, ok: false, status: 'error', code: 'PROPOSAL_CHANGED' |
  'TARGET_CHANGED' | 'NOT_FOUND', error }` döner; diğerleri uygulanır (`{ id, ok: true, status, … }`).
- **Liste:** `GET /api/proposals?status=pending|...|all&kind=&caseId=`.

Avukatın mevcut yazma uçları (dava, duruşma, görev, günlük, duruşma sonrası kayıt) artık
`updated_by_actor='avukat'` yazar; onaylanan öneriler `asistan` yazar.

## 4. Denetim izi — `integration_events`

`api_key_created`, `api_key_revoked`, `proposal_created`, `proposal_updated`, `proposal_no_change`,
`proposal_applied` (düzenlendi mi, değişen/üzerine yazılan alanlar, orijinal payload),
`proposal_rejected`, `proposal_failed`. Satırlar silinmez.

## 5. Dosya nabzı — `GET /api/pulse` (JWT) ve `GET /api/integration/pulse`

`closed` dışındaki her dava ve her aktif arabuluculuk dosyası için:
`lastActivityAt` (günlük, geçmiş duruşmalar, görevler, dava güncellemesi), `nextItem` (bugün ve
sonrası bekleyen duruşma, açık görev/süre, çalışma planı kontrol tarihi, günlük sonraki adımı —
en erkeni; tarihsiz açık iş de sayılır), `openBalance` (anlaşılan ücret − tahsilat),
`overdueInstallments`, bayraklar: `atil` (sırada iş yok ve son hareket > 30 gün), `sirada_is_yok`,
`tahsilat_bekliyor`, `kapanmaya_hazir` (won/lost/settled, açık iş ve alacak yok), `sure_yaklasiyor`
(süreli iş ≤ 7 gün, gecikmiş dahil), `gecikmis` (gecikmiş iş, gecikmiş taksit veya günü geçmiş ama
sonucu girilmemiş duruşma — `nextItem` "Duruşma sonucu girilmedi", `overdue: true`), `cmk`.
- **Son hareket** içerik değişikliklerine dayanır: görev sürükle-bırak sıralaması `updated_at`'i
  değiştirmez, nabzı ve `/changes` akışını şişirmez.
- **Arabuluculuk dosyaları** (bağlı görev/duruşma yok) sıradaki işi kendi tarihlerinden alır: bitiş
  tarihi ileride → o gün kontrol; bitiş geçmiş ve dosya hâlâ aktif → "Arabuluculuk sonucu girilmedi"
  (`gecikmis`); yalnız başlangıç tarihi → "son tutanak bekleniyor" (tarihsiz açık iş). Yasal süre
  varsayımı yapılmaz. Hiç tarih yoksa `sirada_is_yok` kalır.
Aciliyete göre sıralıdır (gecikmiş → süre yaklaşıyor → atıl → sırada iş yok → planlı → diğer).
Hesap saf fonksiyondur: `shared/src/casePulse.ts`.

## 6. Şema (rev14, tamamen additive)

- Yeni tablolar: `api_keys`, `assistant_proposals` (+`case_ref` jsonb), `integration_events`, `case_enforcement`.
- Yeni kolonlar: `cases.buro_kodu`, `cases.external_ref`; `external_ref` → `case_hearings`, `tasks`,
  `case_diary_entries`, `mediation_files`; `updated_by_actor varchar(20) default 'avukat'` →
  `cases`, `case_hearings`, `tasks`, `case_diary_entries`.
- Kısmi tekil indeksler (`WHERE external_ref IS NOT NULL`): davada (user, ref), duruşmada (dava, ref),
  görevde (user, ref), günlükte (dava, ref), arabuluculukta (user, ref). Mevcut satırlar NULL olduğundan çakışmaz.
- DROP / DELETE / tip daraltma yok. Mevcut satırlarda yalnızca `updated_by_actor` default değeri oluşur.
- Kaynak: `server/src/db/ensureSchema.ts` → `REV14_INTEGRATION_SQL`; aynısı
  `server/drizzle/migrations/0015_assistant_integration.sql` (0013/0014 gibi elle, journal dışı).
- **rev15 (yalnız ekleme):** `integration_events_request_id_idx` — `((details->>'request_id')) WHERE ... IS NOT NULL`
  ifade indeksi; `request_id` tekrar kontrolü tam tarama yapmaz. `REV15_INTEGRATION_SQL` (REV14'ten
  hemen sonra, `IF NOT EXISTS`) ve `server/drizzle/migrations/0016_integration_request_id_index.sql`.

## 7. Deploy adımları (CLAUDE.md veri koruma kuralı)

1. **Yedek (zorunlu):** deploy'dan önce Neon havuzsuz bağlantısıyla `pg_dump -Fc` alın,
   `backups/` altına tarih damgalı koyun, `pg_restore --list` ile okunabildiğini doğrulayın,
   SHA-256 ve satır sayılarını `backups/README.md` içindeki rev14 kaydına yazın.
   Neon PITR (7 gün) ek güvencedir, yedeğin yerine geçmez.
2. Bu dal `main`'e birleştiğinde Render `autoDeploy` ile derler (build komutunda DB komutu yok).
3. **Şema uygulaması:** sunucu açılışında `app.listen` sonrası `ensureSchema()` sırayla rev2…rev14'ü
   çalıştırır. REV14 idempotenttir (`IF NOT EXISTS`); her açılışta yeniden çalışması güvenlidir.
   Hata olursa log'a `Schema guard hatasi` düşer ve sunucu çalışmaya devam eder. **Dikkat:** Drizzle
   `select()` sorguları yeni kolonları (`buro_kodu`, `external_ref`, `updated_by_actor`) adıyla
   istediği için REV14 uygulanmadan dava/duruşma/görev/günlük okuma-yazmaları da hata verir
   (rev12'deki `cases.fee_*` kolonlarıyla aynı risk). Entegrasyon (`/api/integration/*`,
   `/api/integration-keys`), öneri (`/api/proposals`) ve nabız (`/api/pulse`) uçları bu pencerede
   eksik tablo/kolon hatasını (42P01/42703) yakalayıp **503 `{ code: 'SCHEMA_NOT_READY' }`** +
   `Retry-After: 30` döner; asistan betiği bu kodda bekleyip yeniden denemelidir. Diğer (mevcut)
   uçlar bu korumaya sahip değildir. İlk açılıştaki birkaç saniyelik pencere ve REV14 hatası bu yüzden izlenmeli; hata görülürse önceki commit'e geri dönülür (eklenen kolonlar
   eski kodu bozmaz).
4. Render log'unda `Schema guard: asistan entegrasyonu ... hazir.` ve `Schema guard: rev15 ... hazir.` satırlarını görün.
5. Doğrulama: `GET /api/health`; uygulamada oturumla `POST /api/integration-keys` →
   `GET /api/integration/pulse` (Bearer anahtar) 200 dönmeli.
6. `db:push` / `db:migrate` **çalıştırılmaz**; `render.yaml`/`vercel.json` değiştirilmedi.

## 8. Testler

- `npm test --workspace=shared` — nabız, birleştirme/çakışma, payload şemaları (vitest).
- `npm test --workspace=server` — anahtar özetleme + uçtan uca akış. Veritabanı **süreç içi PGlite**
  (WASM Postgres); taban şema Drizzle tanımından üretilir, yeni tablolar REV14 + REV15 SQL'iyle kurulur
  (`schemaNotReady.test.ts` bilerek REV14'süz kurar).
  Hiçbir uzak veritabanına bağlanılmaz. Önce `npm run build --workspace=shared` gerekir.
