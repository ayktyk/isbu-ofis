import { describe, expect, it } from 'vitest'
import { computeCasePulse, type CasePulseInput } from '../src/casePulse'

// 2026-10-10 12:00 İstanbul
const NOW = new Date('2026-10-10T09:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

function baseCase(id: string, extra: Partial<CasePulseInput['cases'][number]> = {}) {
  return { id, title: `Dava ${id}`, status: 'active', updatedAt: daysAgo(5), createdAt: daysAgo(100), ...extra }
}

describe('computeCasePulse', () => {
  it('picks the earliest upcoming item across hearings, tasks, workspace and diary', () => {
    const [item] = computeCasePulse({
      cases: [baseCase('a')],
      hearings: [
        { id: 'h-past', caseId: 'a', hearingDate: daysAgo(3), result: 'completed' },
        { id: 'h1', caseId: 'a', hearingDate: '2026-10-20T07:30:00Z', result: 'pending' },
      ],
      tasks: [{ id: 't1', caseId: 'a', title: 'Bilirkişi itirazı', status: 'pending', dueDate: '2026-10-15T06:00:00Z', isDeadline: true }],
      workspaces: [{ caseId: 'a', waitingFor: 'Müzekkere cevabı', checkDate: '2026-10-25' }],
      diary: [{ id: 'd1', caseId: 'a', occurredAt: daysAgo(2), nextStep: 'Müvekkili ara', nextStepDone: false, nextStepDueDate: '2026-10-12' }],
    }, NOW)
    expect(item.nextItem).toMatchObject({ kind: 'next_step', id: 'd1', date: '2026-10-12', overdue: false })
    expect(item.openItemCount).toBe(4)
    expect(item.flags).toContain('sure_yaklasiyor')
    expect(item.flags).not.toContain('sirada_is_yok')
  })

  it('flags atil when nothing is planned and last activity is older than 30 days', () => {
    const [item] = computeCasePulse({
      cases: [baseCase('a', { updatedAt: daysAgo(45), createdAt: daysAgo(200) })],
      diary: [{ id: 'd', caseId: 'a', occurredAt: daysAgo(40), nextStep: null, nextStepDone: false, nextStepDueDate: null }],
    }, NOW)
    expect(item.flags).toEqual(expect.arrayContaining(['atil', 'sirada_is_yok']))
    expect(item.daysSinceActivity).toBe(40)
    expect(item.urgency).toBe(2)
  })

  it('is sirada_is_yok but not atil when recently touched', () => {
    const [item] = computeCasePulse({ cases: [baseCase('a', { updatedAt: daysAgo(3) })] }, NOW)
    expect(item.flags).toContain('sirada_is_yok')
    expect(item.flags).not.toContain('atil')
  })

  it('computes open balance and overdue installments', () => {
    const [item] = computeCasePulse({
      cases: [baseCase('a', { contractedFee: '90000.00' })],
      collections: [
        { caseId: 'a', mediationFileId: null, amount: '30000' },
        { caseId: null, mediationFileId: 'm', amount: '999' },
      ],
      installments: [
        { caseId: 'a', amount: '30000', dueDate: '2026-09-01', status: 'paid' },
        { caseId: 'a', amount: '30000', dueDate: '2026-10-01', status: 'pending' },
        { caseId: 'a', amount: '30000', dueDate: '2026-11-01', status: 'pending' },
      ],
    }, NOW)
    expect(item.openBalance).toBe(60000)
    expect(item.overdueInstallments).toEqual({ count: 1, amount: 30000 })
    expect(item.flags).toEqual(expect.arrayContaining(['tahsilat_bekliyor', 'gecikmis']))
    expect(item.urgency).toBe(0)
  })

  it('marks decided cases with nothing pending as kapanmaya_hazir (not atil)', () => {
    const [item] = computeCasePulse({ cases: [baseCase('a', { status: 'won', updatedAt: daysAgo(90) })] }, NOW)
    expect(item.flags).toContain('kapanmaya_hazir')
    expect(item.flags).not.toContain('atil')
  })

  it('does not mark kapanmaya_hazir while money is still owed', () => {
    const [item] = computeCasePulse({ cases: [baseCase('a', { status: 'settled', contractedFee: '1000' })] }, NOW)
    expect(item.flags).not.toContain('kapanmaya_hazir')
    expect(item.flags).toContain('tahsilat_bekliyor')
  })

  it('ignores closed cases and completed tasks, passes cmk through', () => {
    const items = computeCasePulse({
      cases: [baseCase('closed', { status: 'closed' }), baseCase('cmk', { isCmkAssignment: true })],
      tasks: [{ id: 't', caseId: 'cmk', title: 'x', status: 'completed', dueDate: '2026-10-11', isDeadline: true }],
    }, NOW)
    expect(items.map((i) => i.id)).toEqual(['cmk'])
    expect(items[0].flags).toContain('cmk')
    expect(items[0].flags).not.toContain('sure_yaklasiyor')
  })

  it('treats undated open work as a next item and sorts by urgency', () => {
    const items = computeCasePulse({
      cases: [baseCase('planned'), baseCase('overdue'), baseCase('idle', { updatedAt: daysAgo(60), createdAt: daysAgo(60) })],
      tasks: [
        { id: 'u', caseId: 'planned', title: 'Tarihsiz iş', status: 'pending', dueDate: null, isDeadline: false },
        { id: 'o', caseId: 'overdue', title: 'Gecikmiş', status: 'in_progress', dueDate: '2026-10-01', isDeadline: false },
      ],
    }, NOW)
    expect(items.map((i) => i.id)).toEqual(['overdue', 'idle', 'planned'])
    expect(items[2].nextItem).toMatchObject({ id: 'u', date: null })
  })

  it('includes active mediation files with balance', () => {
    const items = computeCasePulse({
      cases: [],
      mediationFiles: [
        { id: 'm1', title: 'Arb 1', status: 'active', agreedFee: '5000', updatedAt: daysAgo(10) },
        { id: 'm2', title: 'Arb 2', status: 'agreed' },
      ],
      collections: [{ caseId: null, mediationFileId: 'm1', amount: '2000' }],
    }, NOW)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ type: 'mediation', openBalance: 3000 })
    expect(items[0].flags).toContain('tahsilat_bekliyor')
  })
  it('flags a past hearing whose result was never entered as gecikmis', () => {
    const [item] = computeCasePulse({
      cases: [baseCase('a')],
      hearings: [
        { id: 'h-old', caseId: 'a', hearingDate: daysAgo(4), result: 'pending' },
        { id: 'h-next', caseId: 'a', hearingDate: '2026-10-20T07:30:00Z', result: 'pending' },
      ],
    }, NOW)
    expect(item.flags).toContain('gecikmis')
    expect(item.nextItem).toMatchObject({ kind: 'hearing', id: 'h-old', overdue: true })
    expect(item.nextItem?.title).toBe('Duruşma sonucu girilmedi')
    expect(item.urgency).toBe(0)
  })

  it('does not flag a hearing held earlier today before its result is entered', () => {
    const [item] = computeCasePulse({
      cases: [baseCase('a')],
      hearings: [{ id: 'h-today', caseId: 'a', hearingDate: '2026-10-10T06:30:00Z', result: 'pending' }],
    }, NOW)
    expect(item.flags).not.toContain('gecikmis')
    expect(item.nextItem).toMatchObject({ kind: 'hearing', id: 'h-today', overdue: false })
  })

  it('derives the next item of a mediation file from its own dates', () => {
    const items = computeCasePulse({
      cases: [],
      mediationFiles: [
        { id: 'future', title: 'Bitişi ileride', status: 'active', startDate: '2026-10-01', endDate: '2026-10-22', updatedAt: daysAgo(9) },
        { id: 'past', title: 'Bitişi geçmiş', status: 'active', startDate: '2026-09-01', endDate: '2026-10-05', updatedAt: daysAgo(9) },
        { id: 'open', title: 'Süreç sürüyor', status: 'active', startDate: '2026-10-03', updatedAt: daysAgo(7) },
        { id: 'empty', title: 'Tarih yok', status: 'active', updatedAt: daysAgo(7) },
      ],
    }, NOW)
    const by = Object.fromEntries(items.map((i) => [i.id, i]))
    expect(by.future.nextItem).toMatchObject({ kind: 'check', id: 'future', date: '2026-10-22', overdue: false })
    expect(by.future.flags).not.toContain('sirada_is_yok')
    expect(by.past.nextItem).toMatchObject({ date: '2026-10-05', overdue: true })
    expect(by.past.flags).toContain('gecikmis')
    expect(by.open.nextItem).toMatchObject({ kind: 'check', date: null, overdue: false })
    expect(by.open.flags).not.toContain('sirada_is_yok')
    expect(by.open.openItemCount).toBe(1)
    expect(by.empty.nextItem).toBeNull()
    expect(by.empty.flags).toContain('sirada_is_yok')
    expect(items[0].id).toBe('past')
  })
})
