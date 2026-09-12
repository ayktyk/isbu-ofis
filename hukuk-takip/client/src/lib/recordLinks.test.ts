import { describe, expect, it } from 'vitest'
import { caseRecordHref, notificationHref, taskHref } from './recordLinks'
describe('related record navigation', () => {
  it.each([
    ['hearing', 'work'], ['task', 'work'], ['deadline', 'work'], ['note', 'overview'],
    ['document', 'documents'], ['expense', 'finance'], ['collection', 'finance'], ['entry', 'overview'],
  ] as const)('opens %s in the correct case section', (kind, section) => {
    const url = new URL(caseRecordHref('case-1', kind, 'record-2'), 'https://example.invalid')
    expect(url.pathname).toBe('/cases/case-1')
    expect(url.searchParams.get('section')).toBe(section)
    expect(url.searchParams.get('focus')).toBe(`case-${kind}-record-2`)
  })
  it.each(['task', 'task_due_now', 'task_overdue'])('resolves %s notifications to the exact task', relatedType => {
    expect(notificationHref({ relatedType, relatedId: 't1' })).toBe('/tasks?task=t1')
  })
  it('resolves overdue hearings, deadline offsets and unknown notifications safely', () => {
    expect(notificationHref({ relatedType: 'hearing_overdue', relatedId: 'h1' })).toBe('/hearings?hearing=h1')
    expect(notificationHref({ relatedType: 'legal_deadline_3', relatedId: 't1' })).toBe('/sureli-isler?task=t1')
    expect(notificationHref({ type: 'system' })).toBeNull()
    expect(notificationHref({ relatedType: 'unknown', relatedId: 'x' })).toBeNull()
  })
  it('keeps unlinked tasks usable and encodes ids instead of constructing unsafe query strings', () => {
    expect(taskHref({ id: 'a&b', isDeadline: true })).toBe('/sureli-isler?task=a%26b')
    expect(taskHref({ id: 't1' })).toBe('/tasks?task=t1')
    expect(taskHref({ id: 't1', caseId: 'c1', isDeadline: true })).toBe(caseRecordHref('c1', 'deadline', 't1'))
  })
})
