import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import { useLocalDraft } from '@/hooks/useLocalDraft'
import { localInputToISO } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export default function HearingReviewForm({ hearingId, userId }: { hearingId: string; userId: string }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const [draft, setDraft, clear] = useLocalDraft(userId, `hearing:${hearingId}`, { requestId: crypto.randomUUID(), result: 'completed', note: '', nextDate: '', tasks: '', dueDate: '' })
  const mutation = useMutation({ mutationFn: () => api.post(`/workspace/hearings/${hearingId}/review`, { requestId: draft.requestId, result: draft.result, note: draft.note, nextDate: draft.nextDate ? localInputToISO(draft.nextDate) : null, tasks: draft.tasks.split('\n').map(s => s.trim()).filter(Boolean).map(title => ({ title, dueDate: draft.dueDate ? localInputToISO(`${draft.dueDate}T09:00`) : null })) }), onSuccess: async () => { clear(); setOpen(false); await Promise.all(['cases', 'case-diary', 'hearings', 'tasks', 'dashboard', 'calendar'].map(key => qc.invalidateQueries({ queryKey: [key] }))); toast.success('Sonuç, sonraki duruşma ve görevler kaydedildi.') }, onError: (error: any) => toast.error(error.response?.data?.error || 'Kaydetme doğrulanamadı. Aynı taslakla tekrar deneyebilirsiniz.') })
  const field = 'mt-1 w-full rounded-lg border bg-background p-2.5 text-sm'
  return <><button className="min-h-11 px-2 text-sm font-medium text-law-accent" onClick={() => setOpen(true)}>Sonuç kaydet</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>Duruşma sonrası kayıt</DialogTitle><DialogDescription>Sonuç ve sonraki işleri birlikte kaydedin. Taslağınız bu cihazda korunur.</DialogDescription><form className="grid gap-3" onSubmit={e => { e.preventDefault(); mutation.mutate() }}>
    <fieldset disabled={mutation.isPending} className="grid gap-3">
    <label className="text-sm">Sonuç<select className={field} value={draft.result} onChange={e => setDraft({ ...draft, result: e.target.value })}><option value="completed">Yapıldı</option><option value="postponed">Ertelendi</option></select></label>
    <label className="text-sm">Sonuç notu<textarea required maxLength={5000} className={field} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
    <label className="text-sm">Sonraki duruşma (isteğe bağlı)<input type="datetime-local" className={field} value={draft.nextDate} onChange={e => setDraft({ ...draft, nextDate: e.target.value })} /></label>
    <label className="text-sm">Yeni görevler (her satıra bir görev, en fazla 10)<textarea className={field} value={draft.tasks} onChange={e => setDraft({ ...draft, tasks: e.target.value })} /></label>
    <label className="text-sm">Yeni görevlerin son tarihi<input type="date" className={field} value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></label>
    <button disabled={!navigator.onLine} className="min-h-11 rounded-lg bg-law-primary text-white disabled:opacity-50">{mutation.isPending ? 'Kaydediliyor…' : 'Tümünü kaydet'}</button>
    </fieldset></form></DialogContent></Dialog></>
}
