import { describe, expect, it } from 'vitest'
import { getOpenWork, compareDueDates } from './caseWorkspace'

describe('case workspace open work', () => {
  it('keeps overdue work first and excludes finished or archived work', () => {
    const tasks = [
      { id: 'finished', title: 'Done', status: 'completed', dueDate: '2020-01-01' },
      { id: 'cancelled', title: 'Cancelled', status: 'cancelled' },
      { id: 'undated', title: 'No date', status: 'pending' },
      { id: 'deadline', title: 'Deadline', status: 'in_progress', isDeadline: true, dueDate: '2026-09-15' },
    ]
    const diary = [
      { id: 'overdue', nextStep: 'Follow up', nextStepDone: false, nextStepDueDate: '2026-09-01' },
      { id: 'done', nextStep: 'Done', nextStepDone: true, nextStepDueDate: null },
      { id: 'archived', nextStep: 'Old', nextStepDone: false, nextStepDueDate: null, archivedAt: '2026-09-01' },
      { id: 'empty', nextStep: null, nextStepDone: false, nextStepDueDate: null },
    ]
    expect(getOpenWork(tasks, diary).map(w => [w.id, w.kind])).toEqual([
      ['overdue', 'diary'], ['deadline', 'deadline'], ['undated', 'task'],
    ])
    expect(tasks[0].id).toBe('finished')
  })
  it('sorts invalid/missing dates last and keeps equal-date order stable', () => {
    const rows = [{ dueDate: 'bad' }, { dueDate: '2026-09-01' }, { dueDate: null }, { dueDate: '2026-09-01' }]
    expect([...rows].sort(compareDueDates)).toEqual([rows[1], rows[3], rows[0], rows[2]])
  })
})
