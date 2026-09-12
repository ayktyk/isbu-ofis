import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

const state = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useQueryClient: () => state.client,
  useMutation: (options: unknown) => options,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/axios', () => ({ api: {} }))
import { useCreateDocument, useDeleteDocument } from '@/hooks/useCases'

describe('document changes refresh the case workspace', () => {
  let client: QueryClient
  beforeEach(() => {
    client = new QueryClient()
    state.client = client
    for (const section of ['documents', 'detail', 'diary']) {
      client.setQueryData(['cases', 'case-a', section], { existing: true })
    }
    client.setQueryData(['cases', 'case-b', 'detail'], { existing: true })
  })
  function expectRefreshedCase() {
    for (const section of ['documents', 'detail', 'diary']) {
      expect(client.getQueryState(['cases', 'case-a', section])?.isInvalidated).toBe(true)
    }
    expect(client.getQueryState(['cases', 'case-b', 'detail'])?.isInvalidated).toBe(false)
    client.clear()
  }
  it('refreshes the combined detail after upload', () => {
    const mutation = useCreateDocument() as unknown as { onSuccess: (data: unknown, variables: unknown) => void }
    mutation.onSuccess({ uploadedCount: 1 }, { caseId: 'case-a', files: [] })
    expectRefreshedCase()
  })
  it('refreshes the combined detail after document removal', () => {
    const mutation = useDeleteDocument('case-a') as unknown as { onSuccess: () => void }
    mutation.onSuccess()
    expectRefreshedCase()
  })
})
