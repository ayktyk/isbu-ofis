import { describe, expect, it } from 'vitest'
import { normalizeTr, matchesQuery, findDuplicateTitle } from './textSearch'

describe('normalizeTr', () => {
  it('Turkce buyuk I ve i harflerini dogru kucultur', () => {
    expect(normalizeTr('İSTİNAF')).toBe('istinaf')
    expect(normalizeTr('Istinaf')).toBe('ıstinaf')
  })

  it('bastaki/sondaki bosluklari ve coklu bosluklari sadelestirir', () => {
    expect(normalizeTr('  dilekçe   yaz  ')).toBe('dilekçe yaz')
  })

  it('bos ve tanimsiz degerlerde bos string doner', () => {
    expect(normalizeTr('')).toBe('')
    expect(normalizeTr(undefined)).toBe('')
    expect(normalizeTr(null)).toBe('')
  })
})

describe('matchesQuery', () => {
  it('bos sorguda her zaman true doner', () => {
    expect(matchesQuery('', ['herhangi bir metin'])).toBe(true)
  })

  it('alanlardan herhangi birinde gecerse true doner', () => {
    expect(matchesQuery('temyiz', ['Dilekçe yaz', null, 'Temyiz dosyası'])).toBe(true)
  })

  it('hicbir alanda gecmezse false doner', () => {
    expect(matchesQuery('istinaf', ['Dilekçe yaz', 'Duruşma'])).toBe(false)
  })

  it('Turkce buyuk/kucuk harf farkini yok sayar', () => {
    expect(matchesQuery('İSTİNAF', ['istinaf dilekçesi'])).toBe(true)
  })
})

describe('findDuplicateTitle', () => {
  const tasks = [
    { id: '1', title: 'Dilekçe Yaz' },
    { id: '2', title: 'Duruşmaya git' },
  ]

  it('buyuk/kucuk harf farkina ragmen mukerrer bulur', () => {
    expect(findDuplicateTitle('dilekçe yaz', tasks)?.id).toBe('1')
  })

  it('fazladan bosluklari yok sayar', () => {
    expect(findDuplicateTitle('  Dilekçe   Yaz ', tasks)?.id).toBe('1')
  })

  it('farkli baslikta null doner', () => {
    expect(findDuplicateTitle('Temyiz hazirla', tasks)).toBeNull()
  })

  it('2 karakterden kisa girdide null doner (erken yazim gurultusu)', () => {
    expect(findDuplicateTitle('d', tasks)).toBeNull()
  })

  it('kendi kaydini mukerrer saymaz (duzenleme senaryosu)', () => {
    expect(findDuplicateTitle('Dilekçe Yaz', tasks, '1')).toBeNull()
  })

  it('bos listede null doner', () => {
    expect(findDuplicateTitle('Dilekçe Yaz', [])).toBeNull()
  })
})
