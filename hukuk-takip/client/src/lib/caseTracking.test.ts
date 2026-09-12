import { describe, expect, it } from 'vitest'
import { summarizeCaseTracking, type TrackingDiary, type TrackingTask } from '@hukuk-takip/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CaseTrackingPreview from '@/components/cases/CaseTrackingPreview'

const now = new Date('2026-09-12T10:00:00Z')
const task = (patch: Partial<TrackingTask> = {}): TrackingTask => ({ id: 't1', caseId: 'a', title: 'Raporu kontrol et', status: 'pending', dueDate: '2026-09-13T09:00:00Z', isDeadline: false, ...patch })
const diary = (patch: Partial<TrackingDiary> = {}): TrackingDiary => ({ id: 'd1', caseId: 'a', entryType: 'manual', content: 'Rapor bekleniyor', title: null, nextStep: 'Dosyayı kontrol et', nextStepDone: false, nextStepDueDate: '2026-09-11', occurredAt: '2026-09-10T09:00:00Z', ...patch })

describe('case tracking summaries', () => {
  it('combines open work without duplicating records or including archived/completed/foreign rows', () => {
    const tasks = [task(), task({ id: 'done', status: 'completed' }), task({ id: 'cancelled', status: 'cancelled' }), task({ id: 'archived', archivedAt: now }), task({ id: 'other', caseId: 'other' }), task({ id: 'general', caseId: null }), task({ id: 'deadline', isDeadline: true, dueDate: null })]
    const result = summarizeCaseTracking(['a', 'b'], { tasks, diary: [diary(), diary({ id: 'closed', nextStepDone: true })], notes: [], hearings: [] }, now)
    expect(result.a.openCount).toBe(3)
    expect(result.a.overdueCount).toBe(1)
    expect(result.a.deadlineCount).toBe(1)
    expect(result.a.nextWork?.id).toBe('d1')
    expect(result.b.openCount).toBe(0)
    expect(result.other).toBeUndefined()
    expect(tasks[0].status).toBe('pending')
  })
  it('uses Istanbul calendar days for overdue counts and keeps date-only steps ahead of later work', () => {
    const result = summarizeCaseTracking(['a'], {
      tasks: [task({ dueDate: '2026-09-11T22:00:00Z' })], diary: [diary({ nextStepDueDate: '2026-09-12' })], notes: [], hearings: [],
    }, now).a
    expect(result.overdueCount).toBe(0)
    expect(result.nextWork?.id).toBe('d1')
  })
  it('selects the next pending hearing and latest substantive development, ignoring administrative activity', () => {
    const result = summarizeCaseTracking(['a'], {
      tasks: [], diary: [diary(), diary({ id: 'auto', entryType: 'document_added', content: 'Belge eklendi', occurredAt: now, nextStep: null })],
      notes: [{ id: 'n', caseId: 'a', content: 'Müvekkilden belge beklenecek', createdAt: '2026-09-11' }],
      hearings: [
        { id: 'past', caseId: 'a', result: 'pending', hearingDate: '2026-09-01' },
        { id: 'done', caseId: 'a', result: 'decided', hearingDate: '2026-09-13' },
        { id: 'next', caseId: 'a', result: 'pending', hearingDate: '2026-09-15T07:00:00Z' },
        { id: 'later', caseId: 'a', result: 'pending', hearingDate: '2026-09-18T07:00:00Z' },
      ],
    }, now).a
    expect(result.nextHearing?.id).toBe('next')
    expect(result.lastDevelopment?.text).toBe('Müvekkilden belge beklenecek')
  })
  it('does not infer a stage or claim an active case needs no work when its next action is missing', () => {
    const tracking = summarizeCaseTracking(['a'], { tasks: [], diary: [], notes: [], hearings: [] }, now).a
    const html = renderToStaticMarkup(createElement(CaseTrackingPreview, { tracking, status: 'active' }))
    expect(html).toContain('Sonraki adım belirlenmemiş.')
    expect(html).not.toContain('Açık iş kaydı yok.')
    expect(tracking).not.toHaveProperty('stage')
  })
  it('prioritizes a deadline when timestamps tie and puts invalid/missing dates last', () => {
    const tracking = summarizeCaseTracking(['a'], { tasks: [task(), task({ id: 'bad', dueDate: 'invalid' }), task({ id: 'critical', isDeadline: true })], diary: [], notes: [], hearings: [] }, now).a
    expect(tracking.nextWork?.id).toBe('critical')
    expect(tracking.openCount).toBe(3)
  })
})
