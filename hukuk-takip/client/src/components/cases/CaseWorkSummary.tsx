import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { getOpenWork } from '@/lib/caseWorkspace'
import type { DiaryEntry } from '@/hooks/useCaseDiary'

export default function CaseWorkSummary({ tasks, diary, hearings, notes, diaryLoading, diaryError, onWork, onDiary }: {
  tasks: any[]; diary: DiaryEntry[]; hearings: any[]; notes: any[]
  diaryLoading: boolean; diaryError: boolean; onWork: (target?: string) => void; onDiary: () => void
}) {
  const work = getOpenWork(tasks, diary)
  const hearing = [...hearings].filter(h => Date.parse(h.hearingDate) >= Date.now())
    .sort((a, b) => Date.parse(a.hearingDate) - Date.parse(b.hearingDate))[0]
  const developments = [
    ...diary.filter(d => !d.archivedAt && ['manual', 'hearing_completed', 'status_changed'].includes(d.entryType))
      .map(d => ({ id: d.id, content: d.content || d.title, date: d.occurredAt })),
    ...notes.map(n => ({ id: n.id, content: n.content, date: n.createdAt })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const latest = developments[0]
  const deadlineCount = work.filter(w => w.kind === 'deadline').length
  return (
    <section aria-label="Dosyanın son durumu" className="grid gap-3 lg:grid-cols-3">
      <Card className="border-law-accent/20">
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Son gelişme</h2>
          {diaryLoading ? <p className="text-sm text-muted-foreground">Günlük yükleniyor…</p> : <>
            {diaryError && <p className="text-sm text-amber-700">Günlük alınamadı; yalnızca mevcut notlar gösteriliyor.</p>}
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm">{latest?.content || 'Henüz gelişme kaydı yok.'}</p>
            {latest && <p className="text-xs text-muted-foreground">{formatDateTime(latest.date)}</p>}
          </>}
          <button onClick={onDiary} className="min-h-11 text-sm font-medium text-law-accent">Günlüğü aç →</button>
        </CardContent>
      </Card>
      <Card className="border-amber-300/70">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Sıradaki işler</h2><Badge variant="warning">{diaryLoading || diaryError ? 'Kısmi liste' : `${work.length} açık`}</Badge></div>
          {diaryLoading && <p className="text-xs text-muted-foreground">Günlükteki adımlar yükleniyor…</p>}
          {diaryError && <p className="text-xs text-amber-700">Günlük adımları alınamadı.</p>}
          {work.slice(0, 3).map(w => <button type="button" onClick={() => onWork(`case-${w.kind}-${w.id}`)} key={`${w.kind}:${w.id}`} className="block min-h-11 w-full border-l-2 border-amber-400 pl-3 text-left hover:bg-muted/50">
            <p className="line-clamp-2 break-words text-sm font-medium">{w.title}</p>
            <p className="text-xs text-muted-foreground">{w.kind === 'deadline' ? 'Süreli iş' : w.kind === 'diary' ? 'Günlük adımı' : 'Görev'} · {w.dueDate ? formatDate(w.dueDate) : 'Tarih belirtilmemiş'}</p>
          </button>)}
          {!work.length && !diaryLoading && !diaryError && <p className="text-sm text-muted-foreground">Sonraki adım belirlenmemiş.</p>}
          {deadlineCount > 0 && <p className="text-xs font-medium text-red-700">{deadlineCount} açık süreli iş var.</p>}
          <button onClick={() => onWork()} className="min-h-11 text-sm font-medium text-law-accent">İşleri aç →</button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Yaklaşan duruşma</h2>
          {hearing ? <>
            <p className="font-semibold text-law-accent">{formatDateTime(hearing.hearingDate)}</p>
            <p className="text-sm">{hearing.courtName || 'Mahkeme dosya bilgilerinde'}</p>
            {hearing.notes && <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{hearing.notes}</p>}
          </> : <p className="text-sm text-muted-foreground">İleri tarihli duruşma kaydı yok.</p>}
        </CardContent>
      </Card>
    </section>
  )
}
