import { describe, expect, it } from 'vitest'
import {
  extractCaseNumbers,
  filterCases,
  foldTr,
  normalizeCaseNumber,
  suggestCases,
  tokenMatches,
  type CaseOption,
} from './caseSuggest'

function makeCase(id: string, title: string, extra: Partial<CaseOption> = {}): CaseOption {
  return { id, title, status: 'active', ...extra }
}

const ids = (items: Array<{ id: string }>) => items.map((item) => item.id)
const suggestionIds = (text: string, cases: CaseOption[], options?: { limit?: number }) =>
  suggestCases(text, cases, options).map((s) => s.case.id)

describe('foldTr', () => {
  it('Turkce buyuk I ve İ harflerini dogru katlar', () => {
    expect(foldTr('İSTANBUL')).toBe('istanbul')
    expect(foldTr('Istanbul')).toBe('istanbul')
    expect(foldTr('ışık')).toBe('isik')
  })

  it('aksan, cedilla ve sapkali harfleri sadelestirir', () => {
    expect(foldTr('Öztürk')).toBe('ozturk')
    expect(foldTr('Kâzım')).toBe('kazim')
    expect(foldTr('Şükrü Çağlar')).toBe('sukru caglar')
  })

  it('kesme isareti ve noktalamayi kelime ayiricisi yapar', () => {
    expect(foldTr("Yılmaz'ın")).toBe('yilmaz in')
    expect(foldTr('Yıldız İnşaat Ltd. Şti.')).toBe('yildiz insaat ltd sti')
    expect(foldTr('  2024 / 15  ')).toBe('2024 15')
  })

  it('bos ve tanimsiz degerlerde bos string doner', () => {
    expect(foldTr('')).toBe('')
    expect(foldTr(undefined)).toBe('')
    expect(foldTr(null)).toBe('')
  })
})

describe('normalizeCaseNumber', () => {
  it('esas no desenini sadelestirir', () => {
    expect(normalizeCaseNumber('2024/123 E.')).toBe('2024/123')
    expect(normalizeCaseNumber('2024 / 0123')).toBe('2024/123')
    expect(normalizeCaseNumber('Esas: 2023/7')).toBe('2023/7')
  })

  it('desen yoksa null doner', () => {
    expect(normalizeCaseNumber('esas numarasi yok')).toBeNull()
    expect(normalizeCaseNumber('')).toBeNull()
    expect(normalizeCaseNumber(null)).toBeNull()
  })

  it('rakama bitisik yili esas no saymaz', () => {
    expect(normalizeCaseNumber('12024/5')).toBeNull()
  })
})

describe('extractCaseNumbers', () => {
  it('metindeki tum esas numaralarini tekrarsiz cikarir', () => {
    expect(extractCaseNumbers('2024/5 E., 2025/17 K. ve yine 2024/05')).toEqual([
      '2024/5',
      '2025/17',
    ])
  })
})

describe('tokenMatches', () => {
  it('birebir ve ad ekli yazimlari eslestirir', () => {
    expect(tokenMatches('yilmaz', 'yilmaz')).toBe(true)
    expect(tokenMatches('yilmazin', 'yilmaz')).toBe(true)
    expect(tokenMatches('ozturklerin', 'ozturk')).toBe(true)
    expect(tokenMatches('alinin', 'ali')).toBe(true)
  })

  it('ad ile baslayan baska kelimeleri eslestirmez', () => {
    expect(tokenMatches('karar', 'kara')).toBe(false)
    expect(tokenMatches('karakol', 'kara')).toBe(false)
    expect(tokenMatches('alinacak', 'ali')).toBe(false)
    expect(tokenMatches('alin', 'ali')).toBe(false)
  })

  it('3 harften kisa adlarda ek kuralini uygulamaz', () => {
    expect(tokenMatches('erin', 'er')).toBe(false)
  })
})

describe('filterCases', () => {
  const cases: CaseOption[] = [
    makeCase('1', 'Kira alacağı', { clientName: 'Ahmet Yılmaz', caseNumber: '2024/15' }),
    makeCase('2', 'İşçilik alacağı', { clientName: 'Ahmet Yılmaz', caseNumber: '2024/150' }),
    makeCase('3', 'Tahliye ve kira', { clientName: 'Mehmet Öztürk' }),
    makeCase('4', 'Tapu iptali', { clientName: 'Metin Aydın', courtName: 'İstanbul 3. Asliye Hukuk' }),
  ]

  it('Turkce karaktersiz yazilan muvekkil adini bulur', () => {
    expect(ids(filterCases('yilmaz', cases).items)).toEqual(['1', '2'])
    expect(ids(filterCases('ozturk', cases).items)).toEqual(['3'])
    expect(ids(filterCases('ISTANBUL', cases).items)).toEqual(['4'])
  })

  it('tum kelimeler gecmeli (VE), sira onemsiz', () => {
    expect(ids(filterCases('ahmet kira', cases).items)).toEqual(['1'])
    expect(ids(filterCases('kira ahmet', cases).items)).toEqual(['1'])
  })

  it('esas no ile arar, birebir tutan one gecer', () => {
    const result = filterCases('2024/150', cases)
    expect(ids(result.items)).toEqual(['2'])
    const reversed = [...cases].reverse()
    expect(ids(filterCases('2024/15', reversed).items)).toEqual(['1', '2'])
  })

  it('kelime basindan tutanlari one alir, esitlikte gelis sirasini korur', () => {
    const people = [
      makeCase('a', 'Dava A', { clientName: 'Mehmet Kaya' }),
      makeCase('b', 'Dava B', { clientName: 'Metin Er' }),
    ]
    expect(ids(filterCases('met', people).items)).toEqual(['b', 'a'])
  })

  it('bos sorguda tum listeyi ayni sirada dondurur', () => {
    const result = filterCases('   ', cases)
    expect(ids(result.items)).toEqual(['1', '2', '3', '4'])
    expect(result.total).toBe(4)
  })

  it('limit ilk N kaydi verir, total tum eslesenleri sayar', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeCase(String(i), `Kira dosyası ${i}`, { clientName: 'Ayşe Demir' })
    )
    const result = filterCases('kira', many)
    expect(result.items).toHaveLength(50)
    expect(result.total).toBe(60)
    expect(filterCases('kira', many, 10).items).toHaveLength(10)
    expect(filterCases('', many, 5)).toEqual({ items: many.slice(0, 5), total: 60 })
  })

  it('eslesme yoksa bos sonuc doner', () => {
    expect(filterCases('bulunmayan', cases)).toEqual({ items: [], total: 0 })
  })

  it('esas no "E." / "Esas" isaretiyle ya da basi sifirli yazilsa da bulur', () => {
    // x'in hicbir alaninda "e" yok: isaret kelimesi de aranirsa kaybolurdu.
    const numbered = [
      makeCase('x', 'İşçilik alacağı', { clientName: 'Hasan Kaya', caseNumber: '2024/123' }),
      makeCase('y', 'Kira tahliye', { clientName: 'Ayşe Demir', caseNumber: '2024/0123' }),
    ]
    const queries = ['2024/123 E.', 'E. 2024/123', 'E.2024/123', 'Esas 2024/123', 'Esas No: 2024/123', '2024/0123']
    for (const query of queries) {
      expect(ids(filterCases(query, numbered).items)).toEqual(['x', 'y'])
    }
  })

  it('kesmeli ekle yazilan adi bulur', () => {
    expect(ids(filterCases("Yılmaz'ın", cases).items)).toEqual(['1', '2'])
  })
})

describe('suggestCases', () => {
  const yilmazKira = makeCase('kira', 'Kira tahliye davası', { clientName: 'Ahmet Yılmaz' })
  const yilmazIs = makeCase('is', 'İşçilik alacağı davası', { clientName: 'Ahmet Yılmaz' })
  const ozturk = makeCase('ozturk', 'Tapu iptali', { clientName: 'Mehmet Öztürk' })
  const kara = makeCase('kara', 'Boşanma', { clientName: 'Ayşe Kara' })
  const ali = makeCase('ali', 'Alacak davası', { clientName: 'Ali Demir' })
  const yildiz = makeCase('yildiz', 'Fatura alacağı', { clientName: 'Yıldız İnşaat Ltd. Şti.' })

  it('tam ad gecince muvekkilin davasini onerir', () => {
    const result = suggestCases('Ahmet Yılmaz ile görüşme', [ozturk, yilmazKira])
    expect(result[0].case.id).toBe('kira')
    expect(result[0].reason).toBe('client-full')
    expect(result[0].score).toBeGreaterThanOrEqual(100)
  })

  it("ekli yazimlari tanir: Yılmaz'ın / yilmazin / Yılmaz'a", () => {
    expect(suggestionIds("Yılmaz'ın dilekçesini hazırla", [ozturk, yilmazKira])).toEqual(['kira'])
    expect(suggestionIds('yilmazin evraklari', [ozturk, yilmazKira])).toEqual(['kira'])
    expect(suggestionIds("Yılmaz'a haber ver", [ozturk, yilmazKira])).toEqual(['kira'])
  })

  it('yalniz soyad gecince onerir', () => {
    const [first] = suggestCases('Öztürk dosyası için bilirkişi', [yilmazKira, ozturk])
    expect(first.case.id).toBe('ozturk')
    expect(first.reason).toBe('client-surname')
    expect(first.score).toBeGreaterThanOrEqual(60)
  })

  it('"Ahmet Bey\'i ara" hitabiyla yalniz adi kabul eder', () => {
    const [first] = suggestCases("Ahmet Bey'i ara", [ozturk, yilmazKira])
    expect(first.case.id).toBe('kira')
    expect(first.reason).toBe('client-honorific')
  })

  it('hitapsiz yalniz ad oneri cikarmaz', () => {
    expect(suggestCases('Ahmet ile konuş', [ozturk, yilmazKira])).toEqual([])
  })

  it('"karar duruşması" metni Kara soyadli muvekkili onermez', () => {
    expect(suggestCases('karar duruşması hazırlığı', [kara])).toEqual([])
    expect(suggestionIds("Kara'nın boşanma evrakı", [kara])).toEqual(['kara'])
  })

  it('"Ali" adi "alınacak" kelimesiyle eslesmez', () => {
    expect(suggestCases('Tapu kaydı alınacak', [ali])).toEqual([])
  })

  it('sirket adini unvan dolgusu olmadan eslestirir', () => {
    const [first] = suggestCases('Yıldız İnşaat ödemesi takip', [ozturk, yildiz])
    expect(first.case.id).toBe('yildiz')
    expect(first.reason).toBe('client-full')
    expect(first.score).toBeGreaterThanOrEqual(80)
  })

  it('ayni muvekkilin iki davasinda baslik kelimesi dogru davayi one alir', () => {
    const text = 'Ahmet Yılmaz işçilik alacağı için bilirkişi raporuna itiraz'
    expect(suggestionIds(text, [yilmazKira, yilmazIs])).toEqual(['is', 'kira'])
  })

  it('esas no ile muvekkil adi gecmese de onerir', () => {
    const numbered = makeCase('esas', 'Tazminat', { clientName: 'Fatma Şen', caseNumber: '2024/123' })
    const [first] = suggestCases('2024/0123 E. sayılı dosyaya beyan', [ozturk, numbered])
    expect(first.case.id).toBe('esas')
    expect(first.reason).toBe('case-number')
    expect(first.score).toBeGreaterThanOrEqual(120)
  })

  it('puan esitliginde acik dava kapanmistan once gelir', () => {
    const closed = makeCase('kapali', 'Ortaklığın giderilmesi', { clientName: 'Zeynep Arslan', status: 'closed' })
    const active = makeCase('acik', 'Ortaklığın giderilmesi', { clientName: 'Zeynep Arslan', status: 'active' })
    expect(suggestionIds('Zeynep Arslan tapu', [closed, active])).toEqual(['acik', 'kapali'])
  })

  it('clientName bos olan davalarda hata vermez, basliktan puanlar', () => {
    const noClient = makeCase('x', 'Ortaklığın giderilmesi tapu tescil', { clientName: null })
    const undefinedClient = makeCase('y', 'Kira', { clientName: undefined })
    expect(() => suggestCases('ortaklığın giderilmesi tapu', [noClient, undefinedClient])).not.toThrow()
    expect(suggestionIds('ortaklığın giderilmesi tapu', [noClient, undefinedClient])).toEqual(['x'])
  })

  it('limit varsayilan 3, istenirse daraltilir', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      makeCase(String(i), `Dava ${i}`, { clientName: 'Hasan Çelik' })
    )
    expect(suggestCases('Hasan Çelik', many)).toHaveLength(3)
    expect(suggestCases('Hasan Çelik', many, { limit: 1 })).toHaveLength(1)
  })

  it('kisa metinde ve bos listede bos doner, girdiyi degistirmez', () => {
    const list = [yilmazKira, ozturk]
    expect(suggestCases('ab', list)).toEqual([])
    expect(suggestCases('Ahmet Yılmaz', [])).toEqual([])
    suggestCases('Öztürk Yılmaz', list)
    expect(ids(list)).toEqual(['kira', 'ozturk'])
  })

  it('3 kelimeli adda ad + bir soyadi, cift adda ad + hitabi tanir', () => {
    const list = [
      makeCase('yilmaz', 'Kira', { clientName: 'Ahmet Yılmaz' }),
      makeCase('ayk', 'Boşanma', { clientName: 'Ayşe Yılmaz Kaya' }),
      makeCase('aliDemir', 'Alacak', { clientName: 'Ali Demir' }),
      makeCase('mal', 'İşçilik alacağı', { clientName: 'Mehmet Ali Arslan' }),
      makeCase('anp', 'Tazminat', { clientName: 'Ayşe Nur Polat' }),
    ]
    expect(suggestionIds('Ayşe Yılmaz ile görüş', list)).toEqual(['ayk', 'yilmaz'])
    expect(suggestionIds('Mehmet Ali Bey ile görüş', list)).toEqual(['mal', 'aliDemir'])
    expect(suggestionIds("Ayşe Nur Hanım'a bilgi ver", list)).toEqual(['anp'])
  })

  it('"ve Arkadaşları", "Op. Dr." gibi kaliplari ad saymaz', () => {
    const list = [
      makeCase('arkadas', 'İşçilik', { clientName: 'Hakan Uçar ve 12 Arkadaşı' }),
      makeCase('digerleri', 'Ortaklık', { clientName: 'Mehmet Kaya ve Diğerleri' }),
      makeCase('selim', 'Malpraktis', { clientName: 'Op. Dr. Selim Arslan' }),
      makeCase('elif', 'Tazminat', { clientName: 'Uzm. Dr. Elif Koç' }),
    ]
    expect(suggestionIds('Hakan Uçar ile görüş', list)).toEqual(['arkadas'])
    expect(suggestionIds("Kaya'ya bilgi ver", list)).toEqual(['digerleri'])
    expect(suggestionIds("Selim Bey'i ara", list)).toEqual(['selim'])
    expect(suggestionIds("Elif Hanım'ı ara", list)).toEqual(['elif'])
  })

  it('kesmesiz yazimda unsuz yumusamasini tanir: Çeliğin, Mehmede', () => {
    const list = [
      makeCase('celik', 'Kıdem', { clientName: 'Hasan Çelik' }),
      makeCase('mehmet', 'Tapu', { clientName: 'Mehmet' }),
    ]
    expect(suggestionIds('Çeliğin dosyası', list)).toEqual(['celik'])
    expect(suggestionIds('Mehmede bilgi ver', list)).toEqual(['mehmet'])
  })

  it('baslikta yil tarihle eslesmez; baslikta yazili esas no esas no sayilir', () => {
    const cmk = makeCase('cmk', 'CMK 2025/3456 Soruşturma - Serkan Doğan dolandırıcılık', {
      clientName: 'Serkan Doğan',
      isCmkAssignment: true,
    })
    expect(suggestCases('Soruşturma dosyası 15.11.2025 ifade', [cmk])).toEqual([])
    const [first] = suggestCases('2025/3456 soruşturma ifade', [cmk])
    expect(first.reason).toBe('case-number')
  })
})

describe('suggestCases — sirket muvekkil', () => {
  const all = [
    makeCase('murat', 'CMK - uyuşturucu', { clientName: 'Murat Yıldız', isCmkAssignment: true }),
    makeCase('yildizCo', 'Alacak', { clientName: 'Yıldız İnşaat Taahhüt Ltd. Şti.' }),
    makeCase('akin', 'Ticari alacak', { clientName: 'Akın Tekstil İth. İhr. San. ve Tic. Ltd. Şti.' }),
    makeCase('marmara', 'Ayıplı mal', { clientName: 'Marmara Gıda Pazarlama A.Ş.' }),
    makeCase('ege', 'Eser sözleşmesi', { clientName: 'Ege Lojistik Taşımacılık A.Ş.' }),
    makeCase('abc', 'Fatura', { clientName: 'ABC Yazılım Ltd. Şti.' }),
    makeCase('isb', 'Kredi', { clientName: 'İş Bankası A.Ş.' }),
    makeCase('yilmazCo', 'Fatura alacağı', { clientName: 'Ahmet Yılmaz İnşaat Ltd. Şti.' }),
    makeCase('kayaCo', 'Alacak', { clientName: 'Mehmet Kaya Nakliyat San. ve Tic. Ltd. Şti.' }),
    makeCase('demirCo', 'Ayıplı mal', { clientName: 'Hasan Demir Tekstil A.Ş.' }),
    makeCase('garanti', 'Kredi', { clientName: 'Türkiye Garanti Bankası A.Ş.' }),
  ]

  it('marka + unvan kelimesi sirketin davasini ayni soyadli kisiden one alir', () => {
    expect(suggestionIds('Yıldız İnşaat ödemesi takip', all)).toEqual(['yildizCo', 'murat'])
    expect(suggestionIds("Akın Tekstil'e ihtarname", all)).toEqual(['akin'])
    expect(suggestionIds('Ege Lojistik dosyası', all)).toEqual(['ege'])
    expect(suggestionIds("İş Bankası'na ihtarname", all)).toEqual(['isb'])
  })

  it('yalniz marka gecince de onerir', () => {
    expect(suggestionIds("Marmara'ya ihtar", all)).toEqual(['marmara'])
    expect(suggestionIds("ABC'ye fatura gönder", all)).toEqual(['abc'])
  })

  it('sahibinin adini tasiyan unvani soyad + sektorle ya da kesmeli soyadla onerir', () => {
    expect(suggestionIds("Yılmaz İnşaat'a fatura gönder", all)).toEqual(['yilmazCo'])
    expect(suggestionIds("Yılmaz'a bilgi ver", all)).toEqual(['yilmazCo'])
    expect(suggestionIds('Kaya Nakliyat ödemesi takip', all)).toEqual(['kayaCo'])
    expect(suggestionIds('Demir Tekstil ihtarname', all)).toEqual(['demirCo'])
    expect(suggestionIds("Garanti Bankası'na ihtarname", all)).toEqual(['garanti'])
  })

  it('sektor kelimesi, iki harfli marka ya da kesmesiz soyad tek basina oneri cikarmaz', () => {
    expect(suggestCases('Pazarlama sözleşmesi incele', all)).toEqual([])
    expect(suggestCases('Lojistik sözleşmesi incele', all)).toEqual([])
    expect(suggestCases('iş takibi yap', all)).toEqual([])
    expect(suggestCases('Yılmaz bilgi ver', all)).toEqual([])
    expect(suggestCases("Kaya İnşaat'a fatura gönder", all)).toEqual([])
    expect(suggestCases('İnşaat taahhüt sözleşmesini incele', all)).toEqual([])
  })
})

describe('suggestCases — gunluk kelime olan adlar', () => {
  const people = [
    makeCase('dogan', 'Tapu', { clientName: 'İbrahim Doğan' }),
    makeCase('isik', 'Miras', { clientName: 'Bayram Işık' }),
    makeCase('turk', 'Nafaka', { clientName: 'Selin Türk' }),
    makeCase('sen', 'Tazminat', { clientName: 'Fatma Şen' }),
    makeCase('kara', 'Boşanma', { clientName: 'Mustafa Kara' }),
    makeCase('ozel', 'Tapu iptali', { clientName: 'Murat Özel' }),
    makeCase('yazici', 'İşe iade', { clientName: 'Ayşe Yazıcı' }),
    makeCase('can', 'Ortaklık', { clientName: 'Deniz Can' }),
    makeCase('ates', 'Ceza', { clientName: 'Kemal Ateş' }),
    makeCase('kasim', 'Kira tespit', { clientName: 'Kasım Koç' }),
    makeCase('aliKasim', 'Ecrimisil', { clientName: 'Ali Kasım' }),
    makeCase('bayram', 'Vasiyet', { clientName: 'Hasan Bayram' }),
    makeCase('nisan', 'Önalım', { clientName: 'Zeynep Nisan' }),
    makeCase('cuma', 'Kat mülkiyeti', { clientName: 'Mehmet Cuma' }),
  ]

  it('metinde kisi adi yokken soyad/ad gibi okunan kelime oneri cikarmaz', () => {
    const texts = [
      'Kira sözleşmesinden doğan alacak için icra takibi başlat',
      'Kırmızı ışık ihlali bilirkişi raporu',
      'Türk Medeni Kanunu 166. madde araştır',
      'Senin için hazırladığım taslağı kontrol et',
      'Kara para aklama dosyası ifade',
      'Özel vekaletname çıkar',
      'yazıcı toneri al',
      'İş kazasında can kaybı tazminat hesabı',
      'ateş etme suçu emsal karar bul',
      'Kasım ayında kira artışı hesapla',
      "Duruşma 12 Kasım'da, bilirkişi raporuna itiraz hazırla",
      "Kurban Bayramı'ndan sonra istinaf dilekçesi",
      "Nisan'da keşif var, tanık listesini hazırla",
      "Cuma'ya kadar cevap dilekçesi",
    ]
    for (const text of texts) expect(suggestCases(text, people)).toEqual([])
  })

  it('ay/gun adini tasiyan kisiyi tam ad ve hitap yine bulur', () => {
    expect(suggestionIds("Ali Kasım'a bilgi ver", people)).toEqual(['aliKasim'])
    expect(suggestionIds("Mehmet Bey'i ara", people)).toEqual(['cuma'])
  })

  it('kesmeli yazilinca ozel ad sayilir', () => {
    expect(suggestionIds("Doğan'ın tapu dosyası", people)).toEqual(['dogan'])
    expect(suggestionIds("Özel'in dosyası", people)).toEqual(['ozel'])
  })
})
