// Asistan entegrasyonu: öneriler (onay/ret), dosya nabzı ve API anahtarları.
// Uçlar: /api/proposals, /api/pulse, /api/integration-keys (JWT oturumu).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CasePulseItem } from '@hukuk-takip/shared'
import { api } from '@/lib/axios'
import {
  buildApproveBody,
  buildBulkBody,
  buildRejectBody,
  type BulkResultRow,
  type ProposalRow,
  type ProposalStatusFilter,
} from '@/lib/proposals'

export interface ProposalListParams {
  status: ProposalStatusFilter
  caseId?: string
}

export function useProposals(params: ProposalListParams) {
  return useQuery({
    queryKey: ['proposals', params],
    queryFn: async () => {
      const res = await api.get('/proposals', {
        params: { status: params.status, ...(params.caseId ? { caseId: params.caseId } : {}) },
      })
      return (Array.isArray(res.data) ? res.data : []) as ProposalRow[]
    },
    staleTime: 1000 * 30,
  })
}

// Navigasyon rozeti için bekleyen öneri sayısı. Liste ile aynı cache'i paylaşır.
export function usePendingProposalCount(caseId?: string) {
  const query = useProposals({ status: 'pending', caseId })
  return query.data?.length ?? 0
}

// Onay bir kaydı değiştirebilir: ilgili tüm listeler yenilenir.
function invalidateAfterDecision(qc: QueryClient) {
  for (const key of ['proposals', 'pulse', 'cases', 'hearings', 'tasks', 'deadlines', 'dashboard', 'calendar', 'case-diary']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}

export interface ApproveVars {
  proposal: ProposalRow
  payload?: Record<string, unknown>
  note?: string
  forceOverwrite?: boolean
}

export function useApproveProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposal, payload, note, forceOverwrite }: ApproveVars) =>
      (await api.post(`/proposals/${proposal.id}/approve`, buildApproveBody(proposal, { payload, note, forceOverwrite }))).data as {
        id: string
        status: string
        repeated?: boolean
        error?: string
      },
    // Hata olsa da (409/422) listeyi tazele: avukat güncel durumu görsün.
    onSettled: () => invalidateAfterDecision(qc),
  })
}

export function useRejectProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposal, note }: { proposal: ProposalRow; note?: string }) =>
      (await api.post(`/proposals/${proposal.id}/reject`, buildRejectBody(proposal, note))).data,
    onSettled: () => invalidateAfterDecision(qc),
  })
}

export function useBulkDecide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposals, action, note }: { proposals: ProposalRow[]; action: 'approve' | 'reject'; note?: string }) =>
      ((await api.post('/proposals/bulk', buildBulkBody(proposals, action, note))).data?.results ?? []) as BulkResultRow[],
    onSettled: () => invalidateAfterDecision(qc),
  })
}

export function usePulse() {
  return useQuery({
    queryKey: ['pulse'],
    queryFn: async () => ((await api.get('/pulse')).data ?? []) as CasePulseItem[],
    staleTime: 1000 * 60 * 2,
  })
}

export interface ApiKeyRow {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export function useApiKeys(enabled = true) {
  return useQuery({
    queryKey: ['integration-keys'],
    queryFn: async () => ((await api.get('/integration-keys')).data ?? []) as ApiKeyRow[],
    enabled,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; scopes: string[] }) =>
      (await api.post('/integration-keys', input)).data as ApiKeyRow & { key: string; notice?: string },
    onSettled: () => qc.invalidateQueries({ queryKey: ['integration-keys'] }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/integration-keys/${id}/revoke`)).data as ApiKeyRow,
    onSettled: () => qc.invalidateQueries({ queryKey: ['integration-keys'] }),
  })
}
