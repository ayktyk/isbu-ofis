import { describe, expect, it } from 'vitest'
import type { PulseFlag } from '@hukuk-takip/shared'
import { countPulseFlags, filterPulse, lastActivityLabel, pulseHref, sortPulse, sortPulseFlags } from './pulse'

function item(id: string, over: Partial<{ type: 'case' | 'mediation'; flags: PulseFlag[]; urgency: number; daysSinceActivity: number | null; nextItem: { date: string | null } | null }> = {}) {
  return {
    id,
    type: 'case' as 'case' | 'mediation',
    flags: [] as PulseFlag[],
    urgency: 4,
    daysSinceActivity: 1 as number | null,
    nextItem: null as { date: string | null } | null,
    ...over,
  }
}

describe('case pulse helpers', () => {
  it('orders flags by severity and removes duplicates', () => {
    expect(sortPulseFlags(['cmk', 'tahsilat_bekliyor', 'gecikmis', 'atil', 'gecikmis'])).toEqual([
      'gecikmis',
      'atil',
      'tahsilat_bekliyor',
      'cmk',
    ])
  })
  it('filters by flag and by dava/arabuluculuk/CMK type', () => {
    const rows = [
      item('a', { flags: ['cmk', 'atil'] }),
      item('b', { flags: ['atil'] }),
      item('m', { type: 'mediation', flags: ['sirada_is_yok'] }),
    ]
    expect(filterPulse(rows, { flag: 'atil' }).map((r) => r.id)).toEqual(['a', 'b'])
    expect(filterPulse(rows, { type: 'cmk' }).map((r) => r.id)).toEqual(['a'])
    expect(filterPulse(rows, { type: 'dava' }).map((r) => r.id)).toEqual(['b'])
    expect(filterPulse(rows, { type: 'arabuluculuk', flag: 'sirada_is_yok' }).map((r) => r.id)).toEqual(['m'])
    expect(countPulseFlags(rows)).toMatchObject({ atil: 2, cmk: 1, sirada_is_yok: 1, gecikmis: 0 })
  })
  it('sorts by urgency, then nearest next item, then longest idle', () => {
    const rows = [
      item('later', { urgency: 1, nextItem: { date: '2026-10-20' } }),
      item('sooner', { urgency: 1, nextItem: { date: '2026-10-12T07:00:00.000Z' } }),
      item('idle-old', { urgency: 2, daysSinceActivity: 90 }),
      item('overdue', { urgency: 0, nextItem: { date: null } }),
      item('idle-new', { urgency: 2, daysSinceActivity: 40 }),
    ]
    expect(sortPulse(rows).map((r) => r.id)).toEqual(['overdue', 'sooner', 'later', 'idle-old', 'idle-new'])
  })
  it('links cases and mediation files to their detail screens', () => {
    expect(pulseHref({ type: 'case', id: 'c1' })).toBe('/cases/c1')
    expect(pulseHref({ type: 'mediation', id: 'm 1' })).toBe('/tools/mediation-files?record=m%201')
    expect(lastActivityLabel(null)).toBe('Hareket kaydı yok')
    expect(lastActivityLabel(12)).toBe('Son hareket 12 gün önce')
  })
})
