import { describe, expect, it } from 'vitest'
import {
  applyEdits,
  buildApproveBody,
  buildBulkBody,
  buildProposalDiff,
  formatProposalDate,
  groupProposals,
  proposalErrorCode,
  proposalErrorMessage,
  summarizeBulkResults,
  toEditValue,
} from './proposals'

describe('proposal diff', () => {
  it('formats hearing changes in Istanbul time with Turkish labels', () => {
    const rows = buildProposalDiff(
      'hearing_upsert',
      { hearing_date: '2026-11-20T10:00:00+03:00', court_room: 'Salon 4' },
      { hearingDate: '2026-11-13T07:30:00.000Z', courtRoom: 'Salon 4', updatedByActor: 'avukat' }
    )
    expect(rows).toEqual([
      { key: 'hearing_date', label: 'Duruşma tarihi', before: '13.11.2026 10:30', after: '20.11.2026 10:00', effect: 'change' },
      { key: 'court_room', label: 'Salon', before: 'Salon 4', after: 'Salon 4', effect: 'same' },
    ])
  })
  it('marks every field new when the target does not exist yet', () => {
    const rows = buildProposalDiff('deadline_upsert', { title: 'İstinaf', due_date: '2026-10-21', priority: 'urgent' }, null)
    expect(rows.map((r) => [r.label, r.after, r.effect])).toEqual([
      ['Başlık', 'İstinaf', 'new'],
      ['Son gün', '21.10.2026', 'new'],
      ['Öncelik', 'Acil', 'new'],
    ])
  })
  it('compares a day payload against a stored timestamp on the same Istanbul day', () => {
    const rows = buildProposalDiff('deadline_upsert', { title: 'x', due_date: '2026-10-21' }, { title: 'x', dueDate: '2026-10-21T06:00:00.000Z' })
    expect(rows[1].effect).toBe('same')
  })
  it('keeps filled case fields unless overwrite lists them', () => {
    const before = { title: 'Eski ad', courtName: null, contractedFee: '1000.00', status: 'active' }
    const rows = buildProposalDiff('case_upsert', { title: 'Yeni ad', court_name: 'İstanbul 3. İş', contracted_fee: '1500' }, before)
    expect(rows.map((r) => [r.key, r.effect])).toEqual([
      ['title', 'kept'],
      ['court_name', 'new'],
      ['contracted_fee', 'kept'],
    ])
    expect(rows[2].before).toBe('1.000,00 TL')
    const forced = buildProposalDiff('case_upsert', { title: 'Yeni ad', overwrite: ['title'] }, before)
    expect(forced[0].effect).toBe('change')
  })
  it('labels enforcement data keys and status values', () => {
    expect(
      buildProposalDiff('enforcement_upsert', { data: { borclu: 'X A.Ş.', itiraz: true } }, { borclu: 'X A.Ş.' }).map((r) => [
        r.label,
        r.after,
        r.effect,
      ])
    ).toEqual([
      ['Borçlu', 'X A.Ş.', 'same'],
      ['İtiraz', 'Evet', 'new'],
    ])
    expect(buildProposalDiff('status_change', { status: 'won' }, { status: 'active' })[0]).toMatchObject({
      before: 'Aktif',
      after: 'Kazanıldı',
      effect: 'change',
    })
  })
  it('handles bad or empty values without throwing', () => {
    expect(formatProposalDate('')).toBeNull()
    expect(formatProposalDate('not-a-date')).toBe('not-a-date')
    expect(buildProposalDiff('unknown_kind', { a: 1 }, null)).toEqual([])
  })
})

describe('edit and approve', () => {
  it('drops cleared optional fields and un-conditions a deadline once a date is given', () => {
    const payload = { title: '[Koşullu] İstinaf', conditional: true, condition: 'Tebliğden itibaren 2 hafta', legal_basis: 'HMK 345' }
    const next = applyEdits('deadline_upsert', payload, { title: 'İstinaf', due_date: '2026-10-30', legal_basis: '' })
    expect(next).toEqual({ title: 'İstinaf', due_date: '2026-10-30' })
    expect(payload.conditional).toBe(true) // orijinal değişmez
  })
  it('converts a datetime-local value to ISO and reads day fields from timestamps', () => {
    const next = applyEdits('hearing_upsert', { hearing_date: '2026-11-20T10:00:00+03:00' }, { hearing_date: '2026-11-21T09:15' })
    expect(next.hearing_date).toBe(new Date('2026-11-21T09:15').toISOString())
    expect(toEditValue('2026-10-20T22:30:00.000Z', 'date')).toBe('2026-10-21')
    expect(toEditValue(null, 'text')).toBe('')
  })
  it('carries expected_updated_at and only forces on explicit request', () => {
    expect(buildApproveBody({ updatedAt: 'T1' }, { note: '  ' })).toEqual({ expected_updated_at: 'T1' })
    expect(buildApproveBody({ updatedAt: 'T1' }, { forceOverwrite: true, note: 'tamam' })).toEqual({
      expected_updated_at: 'T1',
      force_overwrite: true,
      note: 'tamam',
    })
    const bulk = buildBulkBody(
      [
        { id: 'a', updatedAt: 'T1' },
        { id: 'b', updatedAt: 'T2' },
      ],
      'approve'
    )
    expect(bulk).toEqual({ ids: ['a', 'b'], action: 'approve', expected_updated_at: { a: 'T1', b: 'T2' } })
    expect(bulk).not.toHaveProperty('force_overwrite')
  })
})

describe('server responses', () => {
  it('reads conflict codes and readable error messages', () => {
    const err = { response: { status: 409, data: { error: 'Değişti', code: 'TARGET_CHANGED' } } }
    expect(proposalErrorCode(err)).toBe('TARGET_CHANGED')
    expect(proposalErrorCode({ response: { status: 409, data: { error: 'x' } } })).toBeNull()
    expect(
      proposalErrorMessage(
        { response: { status: 422, data: { error: 'Düzenlenen öneri geçersiz.', details: [{ path: 'due_date', message: 'Tarih' }] } } },
        'f'
      )
    ).toBe('Düzenlenen öneri geçersiz. (due_date: Tarih)')
    expect(proposalErrorMessage({}, 'Bilinmeyen')).toBe('Bilinmeyen')
  })
  it('summarizes bulk results with skip reasons', () => {
    expect(
      summarizeBulkResults([
        { id: 'a', status: 'applied' },
        { id: 'b', status: 'error', code: 'TARGET_CHANGED', error: 'x' },
        { id: 'c', status: 'failed', error: 'Müvekkil yok' },
      ])
    ).toEqual({
      done: 1,
      skipped: [
        { id: 'b', reason: 'kaydı siz düzenlemiştiniz, tek tek inceleyin' },
        { id: 'c', reason: 'Müvekkil yok' },
      ],
    })
  })
  it('groups proposals in the lawyer-facing kind order', () => {
    const groups = groupProposals([{ kind: 'task_add' }, { kind: 'hearing_upsert' }, { kind: 'case_upsert' }, { kind: 'hearing_upsert' }])
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Dava', 1],
      ['Duruşma', 2],
      ['İş', 1],
    ])
  })
})
