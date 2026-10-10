import { describe, expect, it } from 'vitest'
import { detectConflict, mergeJsonData, planFieldUpdates, valuesEqual } from '../src/proposalMerge'
import { parseProposalPayload, proposalItemSchema, caseRefSchema } from '../src/integration'

describe('planFieldUpdates', () => {
  it('fills empty fields only in fillOnly mode', () => {
    const plan = planFieldUpdates(
      { title: 'Avukatın başlığı', caseNumber: null, courtName: '' },
      { title: 'UYAP başlığı', caseNumber: '2026/12', courtName: 'İst. 3. İş' },
      { fillOnly: true }
    )
    expect(plan.changes).toEqual({ caseNumber: '2026/12', courtName: 'İst. 3. İş' })
    expect(plan.skipped).toEqual(['title'])
    expect(plan.overwritten).toEqual([])
    expect(detectConflict('avukat', plan)).toBe(false)
  })

  it('overwrites listed fields and reports a conflict for lawyer-edited values', () => {
    const plan = planFieldUpdates({ title: 'Eski' }, { title: 'Yeni' }, { fillOnly: true, overwrite: ['title'] })
    expect(plan.changes).toEqual({ title: 'Yeni' })
    expect(detectConflict('avukat', plan)).toBe(true)
    expect(detectConflict('asistan', plan)).toBe(false)
  })

  it('treats equivalent dates and decimals as unchanged', () => {
    expect(valuesEqual('2026-10-20T10:30:00+03:00', '2026-10-20T07:30:00.000Z')).toBe(true)
    expect(valuesEqual('1000', '1000.00')).toBe(true)
    expect(valuesEqual(new Date('2026-10-20T07:30:00Z'), '2026-10-20T07:30:00.000Z')).toBe(true)
    const plan = planFieldUpdates({ hearingDate: '2026-10-20T07:30:00.000Z', judge: 'A' }, { hearingDate: '2026-10-20T10:30:00+03:00', judge: 'A' })
    expect(plan.changes).toEqual({})
  })

  it('creates everything when there is no target', () => {
    const plan = planFieldUpdates(null, { a: 1, b: undefined, c: '' })
    expect(plan.changes).toEqual({ a: 1 })
  })

  it('merges json data keeping untouched keys', () => {
    expect(mergeJsonData({ alacak: 100, borclu: 'X' }, { alacak: 200, banka: 'haciz' })).toEqual({ alacak: 200, borclu: 'X', banka: 'haciz' })
  })
})

describe('proposal payload schemas', () => {
  it('requires a condition for deadlines without date', () => {
    expect(parseProposalPayload('deadline_upsert', { title: 'İstinaf' }).success).toBe(false)
    expect(parseProposalPayload('deadline_upsert', { title: 'İstinaf', conditional: true, condition: 'Gerekçeli karar tebliğinden 2 hafta' }).success).toBe(true)
    expect(parseProposalPayload('deadline_upsert', { title: 'İstinaf', due_date: '2026-10-20' }).success).toBe(true)
  })

  it('rejects unknown keys and bad dates', () => {
    expect(parseProposalPayload('hearing_upsert', { hearing_date: '2026-10-20 10:00' }).success).toBe(false)
    expect(parseProposalPayload('hearing_upsert', { hearing_date: '2026-10-20T10:00:00+03:00', foo: 1 }).success).toBe(false)
    expect(parseProposalPayload('enforcement_upsert', { data: { alacak: 1, bilinmeyen: 2 } }).success).toBe(false)
    expect(parseProposalPayload('enforcement_upsert', { data: { alacak: { asil: 1000, faiz: 50 }, banka: ['A', 'B'] } }).success).toBe(true)
  })

  it('validates case refs and items', () => {
    expect(caseRefSchema.safeParse({ case_number: '2026/1' }).success).toBe(false)
    expect(caseRefSchema.safeParse({ case_number: '2026/1', court_name: 'X' }).success).toBe(true)
    expect(proposalItemSchema.safeParse({ kind: 'diary_add', external_ref: 'e', payload: {}, summary: 's', source: 'uyap', request_id: 'short' }).success).toBe(false)
  })
})
