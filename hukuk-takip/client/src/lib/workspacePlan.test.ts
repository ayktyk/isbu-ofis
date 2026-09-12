import { describe, it, expect, vi } from 'vitest'
import { hearingReviewSchema, workflowSchema, matchesTrackingFilter } from '@hukuk-takip/shared'
const store = vi.hoisted(() => ({ token: '', values: new Map<string, any>() }))
vi.mock('./authTokens', () => ({ getAccessToken: () => store.token }))
vi.mock('idb-keyval', () => ({ get: async (k: string) => store.values.get(k), set: async (k: string, v: any) => { store.values.set(k, v) }, del: async (k: string) => { store.values.delete(k) } }))
import { queryPersister } from './queryPersister'
import { draftKey } from '@/hooks/useLocalDraft'

describe('workspace validation and filters', () => {
  it('rejects invalid dates and excessive tasks', () => {
    expect(workflowSchema.safeParse({ stage: 'A', waitingFor: '', checkDate: '2026-02-30', revision: 0 }).success).toBe(false)
    const base = { requestId: '00000000-0000-4000-8000-000000000001', result: 'completed', note: 'Not', nextDate: null, tasks: [] }
    expect(hearingReviewSchema.safeParse(base).success).toBe(true)
    expect(hearingReviewSchema.safeParse({ ...base, tasks: Array.from({ length: 11 }, () => ({ title: 'Görev', dueDate: null })) }).success).toBe(false)
  })
  it('handles overdue controls, waiting files and missing next steps independently', () => {
    const summary = { openCount: 0, overdueCount: 0 }
    const workflow = { waitingFor: 'Müvekkil', checkDate: '2026-09-10' }
    expect(matchesTrackingFilter('overdue', 'active', summary, workflow, '2026-09-12')).toBe(true)
    expect(matchesTrackingFilter('waiting', 'active', summary, workflow)).toBe(true)
    expect(matchesTrackingFilter('unplanned', 'active', summary, workflow)).toBe(false)
    expect(matchesTrackingFilter('unplanned', 'active', summary, null)).toBe(true)
    expect(matchesTrackingFilter('overdue', 'closed', { openCount: 1, overdueCount: 1 }, workflow)).toBe(false)
  })
  it('keeps drafts separate by user and case', () => {
    expect(draftKey('a', 'note:1')).not.toBe(draftKey('b', 'note:1'))
    expect(draftKey('a', 'note:1')).not.toBe(draftKey('a', 'note:2'))
  })
  it('never restores or persists another account cache', async () => {
    const token = (id: string) => `header.${btoa(JSON.stringify({ userId: id }))}.signature`
    const cache: any = { timestamp: Date.now(), buster: 'test', clientState: { mutations: [], queries: [{ queryKey: ['auth', 'me'], state: { data: { id: 'a' } } }] } }
    store.token = token('a'); await queryPersister.persistClient(cache)
    expect(await queryPersister.restoreClient()).toEqual(cache)
    store.token = token('b'); expect(await queryPersister.restoreClient()).toBeUndefined()
    await queryPersister.persistClient(cache); expect(store.values.has('themis:query:b')).toBe(false)
    store.token = ''; expect(await queryPersister.restoreClient()).toBeUndefined()
  })
})
