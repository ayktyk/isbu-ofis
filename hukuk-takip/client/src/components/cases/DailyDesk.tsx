import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCaseShortcuts } from '@/hooks/useCaseShortcuts'
import { useHearings } from '@/hooks/useHearings'
import { api } from '@/lib/axios'
import { formatDateTime } from '@/lib/utils'

export default function DailyDesk({ tasks = [] }: { tasks: any[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { pinned, recent } = useCaseShortcuts(user?.id)
  const ids = [...new Set([...pinned, ...recent])]
  const queries = useQueries({ queries: ids.map(id => ({ queryKey: ['cases', id], queryFn: async () => (await api.get(`/cases/${id}`)).data, retry: false, enabled: !!user?.id })) })
  const hearings = useHearings()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  const todays = (hearings.data || []).filter((h: any) => h.result === 'pending' && new Date(h.hearingDate).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) === today)
  const dueTasks = tasks.filter(task => task.dueDate && new Date(task.dueDate).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) <= today)
  return <section className="space-y-4">
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); navigate(`/cases?search=${encodeURIComponent(search)}`) }}><input aria-label="Dava ara" placeholder="Müvekkil, dava veya esas numarası ara" className="min-w-0 min-h-12 flex-1 rounded-xl border bg-card px-4" value={search} onChange={e => setSearch(e.target.value)} /><button className="rounded-xl bg-law-primary px-5 text-white">Ara</button></form>
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-card p-4 space-y-2"><h2 className="font-semibold">Bugünün duruşmaları</h2>{hearings.isPending ? <p>Yükleniyor…</p> : hearings.isError ? <button onClick={() => hearings.refetch()}>Duruşmalar alınamadı. Tekrar dene</button> : todays.length ? todays.map((h: any) => <Link className="block rounded-lg bg-muted/40 p-3 text-sm" key={h.id} to={`/cases/${h.caseId}?section=work`}>{formatDateTime(h.hearingDate)} · {h.caseTitle}<span className="block text-muted-foreground">{h.courtName}</span></Link>) : <p className="text-sm text-muted-foreground">Bugün bekleyen duruşma yok.</p>}</div>
    <div className="rounded-xl border bg-card p-4 space-y-2"><h2 className="font-semibold">Bugün ve geciken işler</h2>{dueTasks.length ? dueTasks.map(task => <Link key={task.id} className="block rounded-lg bg-muted/40 p-3 text-sm" to={task.caseId ? `/cases/${task.caseId}?section=work` : '/tasks'}>{task.title}<span className="block text-muted-foreground">{formatDateTime(task.dueDate)}</span></Link>) : <p className="text-sm text-muted-foreground">Özette bugün için görev görünmüyor.</p>}<Link className="block text-sm text-law-accent" to="/cases?tracking=check">Kontrol edilecek dosyalar →</Link><Link className="block text-sm text-law-accent" to="/tasks">Tüm görevler →</Link></div></div>
    <details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer font-semibold">Sabitlenen ve son açılan dosyalar</summary><p className="mt-1 text-xs text-muted-foreground">Bu cihazdaki kısayollarınız. Dosya içinden sabitleyebilirsiniz.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{ids.map((id, index) => { const item = queries[index].data; return <Link className="rounded-lg border p-3 text-sm" key={id} to={`/cases/${id}`}>{pinned.includes(id) ? '★ ' : ''}{item?.title || (queries[index].isError ? 'Dosya alınamadı; açıp kontrol edin' : 'Yükleniyor…')}</Link> })}{!ids.length && <p className="text-sm text-muted-foreground">Açtığınız dosyalar burada görünecek.</p>}</div></details>
  </section>
}
