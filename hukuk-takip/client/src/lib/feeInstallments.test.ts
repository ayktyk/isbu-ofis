import { describe, expect, it } from 'vitest'
import { generateInstallments } from './feeInstallments'

describe('generateInstallments', () => {
  it('tam bolunen tutari esit boler', () => {
    const result = generateInstallments(90000, 3, '2026-08-01')
    expect(result.map((r) => r.amount)).toEqual([30000, 30000, 30000])
    expect(result.map((r) => r.dueDate)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
  })

  it('kurus artigini son taksite yazar, toplam her zaman tutari verir', () => {
    const result = generateInstallments(100000, 3, '2026-08-01')
    expect(result.map((r) => r.amount)).toEqual([33333.33, 33333.33, 33333.34])
    const total = result.reduce((sum, r) => sum + r.amount, 0)
    expect(Number(total.toFixed(2))).toBe(100000)
  })

  it('kucuk tutarlarda da toplam korunur', () => {
    const result = generateInstallments(100, 3, '2026-01-15')
    expect(result.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34])
    expect(Number(result.reduce((s, r) => s + r.amount, 0).toFixed(2))).toBe(100)
  })

  it('tek taksitte tutarin tamamini verir', () => {
    const result = generateInstallments(4500.5, 1, '2026-03-10')
    expect(result).toEqual([{ seq: 1, amount: 4500.5, dueDate: '2026-03-10' }])
  })

  it('ay sonu tarihlerde kisa aylara tasmaz', () => {
    const result = generateInstallments(300, 3, '2026-01-31')
    expect(result.map((r) => r.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('sira numaralari 1 den baslar ve artar', () => {
    const result = generateInstallments(1200, 4, '2026-05-01')
    expect(result.map((r) => r.seq)).toEqual([1, 2, 3, 4])
  })

  it('gecersiz girdide bos dizi doner', () => {
    expect(generateInstallments(0, 3, '2026-08-01')).toEqual([])
    expect(generateInstallments(-100, 3, '2026-08-01')).toEqual([])
    expect(generateInstallments(1000, 0, '2026-08-01')).toEqual([])
    expect(generateInstallments(1000, 3, '')).toEqual([])
    expect(generateInstallments(1000, 3, 'gecersiz-tarih')).toEqual([])
    expect(generateInstallments(Number.NaN, 3, '2026-08-01')).toEqual([])
  })

  it('taksit sayisini 60 ile sinirlar', () => {
    expect(generateInstallments(1000, 999, '2026-08-01')).toEqual([])
    expect(generateInstallments(1000, 60, '2026-08-01')).toHaveLength(60)
  })

  it('ondalikli taksit sayisini reddeder', () => {
    expect(generateInstallments(1000, 2.5, '2026-08-01')).toEqual([])
  })
})
