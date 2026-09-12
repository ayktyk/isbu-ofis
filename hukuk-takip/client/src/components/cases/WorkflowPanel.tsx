import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { useLocalDraft } from '@/hooks/useLocalDraft'
import type { Workflow } from '@hukuk-takip/shared'

export default function WorkflowPanel({ caseId, userId, canWrite }: { caseId: string; userId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const query = useQuery<Workflow>({ queryKey: ['cases', caseId, 'workflow'], queryFn: async () => (await api.get(`/workspace/${caseId}/workflow`)).data })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft, clear] = useLocalDraft<Workflow | null>(userId, `workflow:${caseId}`, null)
  const mutation = useMutation({ mutationFn: (data: Workflow) => api.put(`/workspace/${caseId}/workflow`, data), onSuccess: async () => { clear(); setEditing(false); await qc.invalidateQueries({ queryKey: ['cases'] }); await qc.invalidateQueries({ queryKey: ['case-diary', caseId] }); toast.success('Çalışma planı kaydedildi.') }, onError: (error: any) => { toast.error(error.response?.data?.error || 'Plan kaydedilemedi. Taslağınız korunuyor.'); if (error.response?.status === 409) void query.refetch() } })
  const value = draft || query.data
  return <section className="rounded-xl border bg-card p-4 space-y-3">
    <h2 className="font-semibold">Dosya hangi aşamada?</h2>
    {query.isPending ? <p>Plan yükleniyor…</p> : query.isError ? <button onClick={() => query.refetch()}>Plan alınamadı. Tekrar dene</button> : <>
      <p className="text-sm">{query.data?.stage || 'Çalışma aşaması belirtilmemiş'}</p>
      <p className="text-sm text-muted-foreground">Beklenen: {query.data?.waitingFor || 'Belirtilmemiş'} · Kontrol: {query.data?.checkDate ? formatDate(query.data.checkDate) : 'Belirtilmemiş'}</p>
      {canWrite && <button className="min-h-11 text-sm font-medium text-law-accent" onClick={() => setEditing(!editing)}>{editing ? 'Formu kapat' : draft ? 'Taslağa devam et' : 'Çalışma planını düzenle'}</button>}
      {canWrite && editing && value && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); mutation.mutate(value) }}>
        <fieldset disabled={mutation.isPending} className="grid gap-3">
        <label className="text-sm">Aşama<input required maxLength={120} placeholder="Örn. Bilirkişi incelemesinde" className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={value.stage} onChange={e => setDraft({ ...value, stage: e.target.value })} /></label>
        <label className="text-sm">Kimden ne bekleniyor?<textarea maxLength={500} placeholder="Örn. Müvekkilden bordrolar bekleniyor" className="mt-1 w-full rounded-lg border bg-background p-3" value={value.waitingFor} onChange={e => setDraft({ ...value, waitingFor: e.target.value })} /></label>
        <label className="text-sm">Tekrar kontrol tarihi<input type="date" className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={value.checkDate || ''} onChange={e => setDraft({ ...value, checkDate: e.target.value || null })} /></label>
        {draft && query.data && draft.revision !== query.data.revision && <button type="button" className="text-sm text-amber-700" onClick={() => setDraft({ ...draft, revision: query.data!.revision })}>Sunucudaki plan değişmiş. Yukarıdaki güncel planı inceledim; taslağımı kaydetmek istiyorum.</button>}
        <p className="text-xs text-muted-foreground">Taslak bu cihazda saklanır. Kaydettiğiniz plan diğer cihazlarda da görünür.</p>
        <button disabled={mutation.isPending || !navigator.onLine} className="min-h-11 rounded-lg bg-law-primary text-white disabled:opacity-50">{mutation.isPending ? 'Kaydediliyor…' : 'Planı kaydet'}</button>
        </fieldset>
      </form>}
    </>}
  </section>
}
