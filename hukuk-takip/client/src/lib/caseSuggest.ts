/**
 * Dava secici icin Turkce arama + gorev metninden dava onerisi.
 *
 * Neden ayri: gorev formundaki dava listesi 1000 kayda kadar cikabiliyor ve
 * cmdk'nin varsayilan bulanik filtresi Turkce I/ı ve aksanlari bilmiyor —
 * "yilmaz" yazinca "Yılmaz" bulunmuyordu. Buradaki fonksiyonlar saf (DOM ve
 * React yok, import yok); node ile dogrudan test edilir.
 *
 * Oneri davayi ASLA otomatik secmez, yalniz aday gosterir. Yanlis davaya
 * baglanan gorev, yanlis dosyada unutulan is demektir.
 */

export type CaseOption = {
  id: string
  title: string
  clientName?: string | null
  caseNumber?: string | null
  courtName?: string | null
  status?: string | null
  isCmkAssignment?: boolean | null
}

export type CaseSuggestion = {
  case: CaseOption
  score: number
  // client-partial: yalniz ad gibi tek kelime tuttu (25 puan); tek basina
  // oneri cikarmaz, baslik eslesmesini guclendirir.
  reason: 'case-number' | 'client-full' | 'client-surname' | 'client-honorific' | 'client-partial' | 'title'
}

export const SUGGESTION_MIN_SCORE = 40
export const STRONG_SUGGESTION_SCORE = 60

/**
 * Arama icin Turkce katlama: kucuk harf, aksan/cedilla yok, noktalama ayirici.
 *
 * normalizeTr (textSearch.ts) aksani KORUR; burada "yilmaz" ile "Yılmaz",
 * "ozturk" ile "Öztürk" eslesmeli — telefonda Turkce karakter yazilmayabilir.
 * Once 'tr' ile kucultulur (I -> ı, İ -> i), NFD ile birlesik isaretler ayrilip
 * silinir, en son ı -> i. Kesme isareti de ayirici: "Yılmaz'ın" -> "yilmaz in".
 */
export function foldTr(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// "2024/123", "2024 / 0123". Yil 4 hane; oncesi rakam olmamali ("12024/5"
// esas no degil). Lookbehind bilerek kullanilmadi: iOS 16.4 oncesi Safari
// desteklemiyor ve tum modul yuklenemezdi.
const CASE_NUMBER_PATTERN = /(^|\D)(\d{4})\s*\/\s*(\d+)/g

/** Metindeki tum esas numaralari, "2024/123" bicimine normalize, tekrarsiz. */
export function extractCaseNumbers(value: string | null | undefined): string[] {
  if (!value) return []
  const found: string[] = []
  for (const match of value.matchAll(CASE_NUMBER_PATTERN)) {
    // Sira no basindaki sifirlar atilir: UYAP "2024/0123", dilekce "2024/123" yazar.
    const normalized = `${match[2]}/${match[3].replace(/^0+(?=\d)/, '')}`
    if (!found.includes(normalized)) found.push(normalized)
  }
  return found
}

/** Ilk esas numarasi ("2024/123") ya da null. */
export function normalizeCaseNumber(value: string | null | undefined): string | null {
  return extractCaseNumbers(value)[0] ?? null
}

// Ad ekleri (foldTr sonrasi): "Yılmaz'ın" yerine "yilmazin", "Öztürklerin"
// gibi kesmesiz yazimlar da eslessin. Bilerek dar tutuldu: "Kara" -> "karar"
// ya da "Ali" -> "alinacak" eslesmesin diye yalniz ad/hal ekleri var.
const NAME_SUFFIXES = [
  'a', 'e', 'i', 'u', 'in', 'un', 'nin', 'nun', 'ya', 'ye', 'yi', 'yu', 'yin', 'yun',
  'da', 'de', 'ta', 'te', 'dan', 'den', 'tan', 'ten', 'nda', 'nde', 'ndan', 'nden',
  'la', 'le', 'yla', 'yle', 'na', 'ne', 'ni', 'nu', 'lar', 'ler', 'lari', 'leri',
  'larin', 'lerin', 'lara', 'lere', 'lardan', 'lerden', 'larla', 'lerle', 'larda',
  'lerde', 'ca', 'ce', 'gil', 'giller', 'gile', 'gilin',
]
const NAME_SUFFIX_SET = new Set(NAME_SUFFIXES)
// Unsuz yumusamasi (kesmesiz yazim): "Çeliğin" -> celik, "Mehmede" -> mehmet.
const SOFTENED_ENDINGS: Record<string, string> = { g: 'k', d: 't', b: 'p' }

// Sirket/unvan dolgusu: "Ltd. Şti." her sirkette var, ayirt etmez. "... ve
// Arkadaşları", "Op. Dr." gibi kaliplar da ad degil.
const CLIENT_FILLER_WORDS = new Set([
  'ltd', 'sti', 'sirketi', 'sirket', 'as', 'a', 's', 'anonim', 'limited', 've', 'tic',
  'ticaret', 'san', 'sanayi', 'ins', 'insaat', 'holding', 'grup', 'koop', 'kooperatifi',
  'vakfi', 'dernegi', 'mirascilari', 'varisleri', 'vekili', 'av', 'avukat', 'dr', 'prof',
  'bey', 'hanim', 'arkadaslari', 'arkadasi', 'arkadaslar', 'digerleri', 'diger', 'op',
  'uzm', 'doc', 'yrd', 'muh', 'ars', 'gor',
])

// Unvaninda bunlardan biri olan muvekkil sirkettir; kisi adi gibi puanlanmaz: ayirt
// edici kelime ilki (marka) ya da sahibin soyadi, sonuncusu cogu zaman sektor ("Lojistik").
const COMPANY_MARKERS = new Set([
  'ltd', 'sti', 'as', 'anonim', 'limited', 'sirketi', 'koll', 'kom', 'koop', 'kooperatifi',
])
// Sektor kelimesi ("insaat") bilerek yok: "Yıldız İnşaat"i "Murat Yıldız"dan ayirir.
const LEGAL_FORM_WORDS = new Set([
  ...COMPANY_MARKERS, 'sirket', 've', 'tic', 'ticaret', 'san', 'sanayi', 'sanayii', 'ith',
  'ihr', 'ithalat', 'ihracat', 'ort', 'ortakligi',
])
// Unvanin ikinci kelimesi sektorse ("Yıldız İnşaat Taahhüt") soyad ya da marka sayilmaz.
const SECTOR_WORDS = new Set([
  'insaat', 'yapi', 'taahhut', 'muhendislik', 'danismanlik', 'gida', 'tarim', 'pazarlama',
  'lojistik', 'nakliyat', 'tasimacilik', 'tekstil', 'turizm', 'otomotiv', 'enerji', 'elektrik',
  'yazilim', 'bilisim', 'teknoloji', 'emlak', 'saglik', 'makine', 'mobilya', 'petrol', 'grup',
])

// Gunluk/hukuk dilinde kelime olan adlar ("doğan alacak", "Türk Medeni Kanunu")
// tek basina kanit degil; kesmeli yazim ("Doğan'ın") ozel ad oldugunu gosterir.
const COMMON_WORD_NAMES = new Set([
  'dogan', 'isik', 'turk', 'sen', 'ozel', 'yazici', 'can', 'ates', 'kara', 'deniz', 'umut',
])
// Ay/gun/bayram adinda kesme de kanit degil: tarih de kesmeli ("12 Kasım'da", "Cuma'ya kadar").
const DATE_NAMES = new Set(['kasim', 'nisan', 'eylul', 'cuma', 'bayram'])

// Dava basliklarinda her yerde gecen hukuk kelimeleri; oneriye katki vermez.
const TITLE_STOP_WORDS = new Set([
  'dava', 'davasi', 'davalari', 'dosya', 'dosyasi', 'dilekce', 'dilekcesi', 'hakkinda',
  'ile', 'veya', 'karsi', 'aleyhine', 'tarafindan', 'icin', 'olan', 'ait', 'muvekkil',
  'esas', 'karar', 'sayili', 'tarihli', 'mahkemesi', 'mahkeme', 'asliye', 'hukuk', 'ceza',
  'sulh', 'icra', 'aile', 'tuketici', 'ticaret', 'idare', 'vergi', 'agir', 'bolge',
  'adliye', 'istinaf', 'yargitay', 'temyiz', 'itiraz', 'talep', 'talebi',
])

// Esas no ararken anlamsiz isaretler: "E. 2024/123", "Esas No: 2024/123".
const CASE_NUMBER_MARKERS = new Set(['e', 'k', 'esas', 'karar', 'no', 'sayili'])

// "Ahmet Bey'i ara": hitap, yalniz adin gectigi metni guclu kanit yapar.
const HONORIFICS = new Set([
  'bey', 'beyi', 'beye', 'beyin', 'beyle', 'beyden', 'hanim', 'hanima', 'hanimi',
  'hanimin', 'hanimla', 'hanimdan', 'hn', 'by',
])

// Acik dosya (aktif / istinafta / yargitayda) esitlikte one gecsin.
const OPEN_STATUSES = new Set(['active', 'istinafta', 'yargitayda'])

/**
 * Metin kelimesi, ad kelimesinin kendisi ya da ad + Turkce ad eki mi?
 * Ek kurali 3+ harfli adlarda: "Er" -> "erin" eslesmesin.
 */
export function tokenMatches(textWord: string, nameWord: string): boolean {
  if (textWord === nameWord) return true
  if (nameWord.length < 3 || !textWord.startsWith(nameWord)) return false
  return NAME_SUFFIX_SET.has(textWord.slice(nameWord.length))
}

function splitWords(folded: string): string[] {
  return folded ? folded.split(' ') : []
}

const isNumber = (word: string) => /^\d+$/.test(word)

type FoldedCase = {
  haystack: string
  startWords: string[]
  caseNumber: string | null
  clientWords: string[]
  companyWords: string[] | null // sirket unvani, tur kelimeleri atilmis (marka ilki ya da ikincisi)
  titleWords: string[]
  isOpen: boolean
}

// React Query satirlari render'lar arasinda ayni referansta kalir; katlama her
// tusa basista 1000 dava icin yeniden yapilmasin diye nesne basina saklanir.
const foldedCache = new WeakMap<CaseOption, FoldedCase>()

function companyWordsOf(words: string[]): string[] | null {
  const isCompany = words.some(
    (word, index) => COMPANY_MARKERS.has(word) || (word === 'a' && words[index + 1] === 's')
  )
  if (!isCompany) return null
  return words.filter((word) => word.length >= 2 && !isNumber(word) && !LEGAL_FORM_WORDS.has(word))
}

function getFolded(item: CaseOption): FoldedCase {
  const cached = foldedCache.get(item)
  if (cached) return cached

  const client = foldTr(item.clientName)
  const title = foldTr(item.title)
  const clientAll = splitWords(client)
  const titleAll = splitWords(title)
  const titleWords = titleAll.filter(
    (word, index) =>
      word.length >= 4 &&
      !TITLE_STOP_WORDS.has(word) &&
      // Yil ("2025") gorev metnindeki tarihle eslesip puan vermesin.
      !/^(19|20)\d\d$/.test(word) &&
      titleAll.indexOf(word) === index &&
      // Muvekkil adi zaten musteri puaninda sayiliyor; baslikta tekrar sayilmasin.
      !clientAll.some((clientWord) => tokenMatches(word, clientWord))
  )

  const folded: FoldedCase = {
    haystack: [title, client, foldTr(item.caseNumber), foldTr(item.courtName)].filter(Boolean).join(' '),
    startWords: [...clientAll, ...titleAll],
    // CMK'da sorusturma no cogu zaman yalniz baslikta yazili.
    caseNumber: normalizeCaseNumber(item.caseNumber) ?? normalizeCaseNumber(item.title),
    clientWords: clientAll.filter(
      (word) => word.length >= 2 && !isNumber(word) && !CLIENT_FILLER_WORDS.has(word)
    ),
    companyWords: companyWordsOf(clientAll),
    titleWords,
    isOpen: OPEN_STATUSES.has(foldTr(item.status)),
  }
  foldedCache.set(item, folded)
  return folded
}

// Arama kelimeleri: kesmeli ek ("Yılmaz'ın") ve sira no basindaki sifir ("2024/0123")
// atilir; sorguda esas no varsa "E.", "Esas" gibi isaretler de aranmaz.
const dropLeadingZeros = (word: string) => (isNumber(word) ? word.replace(/^0+(?=\d)/, '') : word)
function queryWords(query: string): string[] {
  const words = splitWords(foldTr(query.replace(/['’]\p{L}+/gu, ''))).map(dropLeadingZeros)
  if (extractCaseNumbers(query).length === 0) return words
  return words.filter((word) => !CASE_NUMBER_MARKERS.has(word))
}

/**
 * Dava secicideki arama. Her sorgu kelimesi baslik / muvekkil / esas no /
 * mahkeme metninde gecmeli (VE, sira serbest). Siralama: esas no birebir
 * tutanlar, sonra muvekkil adi ya da baslikta kelime BASINDAN tutan kelime
 * sayisi; esitlikte gelis sirasi (sunucu sirasi = aktif dosyalar once).
 */
export function filterCases(
  query: string,
  cases: CaseOption[],
  limit = 50
): { items: CaseOption[]; total: number } {
  const words = queryWords(query)
  if (words.length === 0) return { items: cases.slice(0, limit), total: cases.length }

  const queryNumbers = extractCaseNumbers(query)
  const ranked: Array<{ item: CaseOption; rank: number; index: number }> = []

  cases.forEach((item, index) => {
    const info = getFolded(item)
    if (!words.every((word) => info.haystack.includes(word))) return
    const exactNumber = info.caseNumber !== null && queryNumbers.includes(info.caseNumber)
    const startHits = words.filter((word) =>
      info.startWords.some((candidate) => candidate.startsWith(word))
    ).length
    ranked.push({ item, rank: (exactNumber ? 1000 : 0) + startHits, index })
  })

  ranked.sort((a, b) => b.rank - a.rank || a.index - b.index)
  return { items: ranked.slice(0, limit).map((entry) => entry.item), total: ranked.length }
}

type TextIndex = {
  exact: Set<string>
  stems: Set<string>
  honorificStems: Set<string>
  proper: Set<string> // kesme isaretinden hemen onceki kelime ("Doğan'ın"): ozel ad
  caseNumbers: string[]
}

// Kelimenin kendisi + bilinen ad eki atilmis kokleri (kok en az 3 harf).
// Her davada her kelimeyi tek tek denemek yerine bir kez hesaplanir:
// stems.has(ad) === metinde tokenMatches(kelime, ad) tutan kelime var.
function addStems(target: Set<string>, word: string): void {
  target.add(word)
  for (const suffix of NAME_SUFFIXES) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) {
      const stem = word.slice(0, word.length - suffix.length)
      target.add(stem)
      const hard = SOFTENED_ENDINGS[stem[stem.length - 1]]
      if (hard && /^[aeiu]/.test(suffix)) target.add(stem.slice(0, -1) + hard)
    }
  }
}

function buildTextIndex(text: string): TextIndex | null {
  const folded = foldTr(text)
  if (folded.length < 3) return null
  const words = splitWords(folded).filter((word) => word.length >= 2)
  const index: TextIndex = {
    exact: new Set(words),
    stems: new Set(),
    honorificStems: new Set(),
    proper: new Set(),
    caseNumbers: extractCaseNumbers(text),
  }
  words.forEach((word, position) => {
    addStems(index.stems, word)
    if (HONORIFICS.has(words[position + 1] ?? '')) addStems(index.honorificStems, word)
  })
  for (const match of text.matchAll(/(\p{L}+)['’]/gu)) addStems(index.proper, foldTr(match[1]))
  return index
}

type ClientScore = { score: number; reason: CaseSuggestion['reason'] }
const NO_CLIENT: ClientScore = { score: 0, reason: 'client-full' }

const soloHit = (word: string, text: TextIndex) =>
  text.stems.has(word) && !DATE_NAMES.has(word) && (!COMMON_WORD_NAMES.has(word) || text.proper.has(word))

function scoreClient(words: string[], text: TextIndex): ClientScore {
  if (words.length === 0) return NO_CLIENT
  const hits = words.map((word) => text.stems.has(word))
  if (words.length === 1) {
    const only = words[0]
    // Tek kelimelik ad (sirket ya da tek ad): kisa adlar ("Er", "Can") yalniz birebir.
    if (!soloHit(only, text) || (only.length < 4 && !text.exact.has(only))) return NO_CLIENT
    return { score: only.length >= 4 ? 80 : 60, reason: 'client-full' }
  }

  const last = words.length - 1
  if (hits.every(Boolean) || (words.length >= 3 && hits[0] && hits[last])) {
    return { score: 100, reason: 'client-full' }
  }
  // Cift ad + hitap: "Mehmet Ali Bey", "Ayşe Nur Hanım'a".
  const givenHit = last >= 2 && hits.slice(0, last).every(Boolean)
  if (givenHit && text.honorificStems.has(words[last - 1])) {
    return { score: 100, reason: 'client-honorific' }
  }
  // 3+ kelimeli adda ilk ad + bir soyad: "Ayşe Yılmaz" -> "Ayşe Yılmaz Kaya".
  if (last >= 2 && hits[0] && hits.slice(1).some(Boolean)) return { score: 80, reason: 'client-full' }
  if (words[last].length >= 3 && soloHit(words[last], text)) return { score: 60, reason: 'client-surname' }
  if (text.honorificStems.has(words[0])) return { score: 60, reason: 'client-honorific' }
  // Yalniz ad ("Ahmet") cok yaygin; tek basina oneri cikarmaz.
  if (words.some((word) => word.length >= 4 && soloHit(word, text))) {
    return { score: 25, reason: 'client-partial' }
  }
  return NO_CLIENT
}

// Kisa marka ("ABC", "İş") yalniz birebir tutar, uzunu ekli de ("Marmara'ya").
// Yalniz marka: iki harfliyse ya da gunluk kelimeyse kanit degil. 3+ kelimede ilki tutmazsa
// ikincisi marka ("Ahmet Yılmaz İnşaat" -> "Yılmaz İnşaat'a"); yalnizken kesme ister ("Yılmaz'a").
function scoreCompany(words: string[], text: TextIndex): ClientScore {
  const hit = (word: string) => (word.length >= 4 ? text.stems.has(word) : text.exact.has(word))
  const second = words.length >= 3 && !hit(words[0]) && !SECTOR_WORDS.has(words[1])
  const [brand, ...rest] = second ? words.slice(1) : words
  if (!brand || !hit(brand)) return NO_CLIENT
  if (rest.some((word) => text.stems.has(word))) return { score: 100, reason: 'client-full' }
  if (brand.length < 3 || !soloHit(brand, text) || (second && !text.proper.has(brand))) return NO_CLIENT
  return rest.length === 0 ? { score: 80, reason: 'client-full' } : { score: 60, reason: 'client-surname' }
}

function scoreTitle(words: string[], text: TextIndex): number {
  return Math.min(words.filter((word) => text.stems.has(word)).length * 20, 60)
}

/**
 * Gorev basligi + aciklamasindan olasi davalari puanlar (yalniz oneri).
 *
 * Puan = muvekkil (tam ad 100, tek kelimelik ad 80, soyad ya da "Ahmet Bey" 60,
 * yalniz ad 25; sirkette marka + baska kelime 100, tek kelimelik unvan 80, yalniz
 * marka 60) + esas no (120) + baslik kelimesi (her biri 20, en fazla 60)
 * + acik dosya (5). minScore alti elenir; buyukten kucuge, esitlikte gelis sirasi.
 */
export function suggestCases(
  text: string,
  cases: CaseOption[],
  options: { limit?: number; minScore?: number } = {}
): CaseSuggestion[] {
  const limit = options.limit ?? 3
  const minScore = options.minScore ?? SUGGESTION_MIN_SCORE
  const index = buildTextIndex(text)
  if (!index || cases.length === 0) return []

  const scored: Array<CaseSuggestion & { order: number }> = []
  cases.forEach((item, order) => {
    const info = getFolded(item)
    const client = info.companyWords
      ? scoreCompany(info.companyWords, index)
      : scoreClient(info.clientWords, index)
    const caseNumber = info.caseNumber !== null && index.caseNumbers.includes(info.caseNumber) ? 120 : 0
    const title = scoreTitle(info.titleWords, index)
    // Metinde hicbir kanit yoksa "acik dosya" puani tek basina oneri yapmaz.
    if (client.score + caseNumber + title === 0) return

    const score = client.score + caseNumber + title + (info.isOpen ? 5 : 0)
    if (score < minScore) return

    // Gerekce = en buyuk katki; esitlikte esas no > muvekkil > baslik.
    let reason: CaseSuggestion['reason'] = 'case-number'
    let best = caseNumber
    if (client.score > best) {
      reason = client.reason
      best = client.score
    }
    if (title > best) reason = 'title'

    scored.push({ case: item, score, reason, order })
  })

  scored.sort((a, b) => b.score - a.score || a.order - b.order)
  return scored.slice(0, limit).map(({ case: item, score, reason }) => ({ case: item, score, reason }))
}
