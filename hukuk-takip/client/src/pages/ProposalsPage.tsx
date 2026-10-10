import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Bot, Check, Loader2, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'
import ProposalCard from '@/components/integration/ProposalCard'
import {
  EditApproveDialog,
  RejectDialog,
  TargetChangedDialog,
  type TargetChangedState,
} from '@/components/integration/ProposalDialogs'
import { useApproveProposal, useBulkDecide, useProposals, useRejectProposal } from '@/hooks/useIntegration'
import {
  PROPOSAL_STATUS_TABS,
  groupProposals,
  proposalErrorCode,
  needsOverwriteConfirmation,
  bulkApproveDescription,
  proposalErrorMessage,
  summarizeBulkResults,
  type ProposalRow,
  type ProposalStatusFilter,
} from '@/lib/proposals'

const STATUS_VALUES = PROPOSAL_STATUS_TABS.map((t) => t.value)

interface BulkReport {
  action: 'approve' | 'reject'
  done: number
  skipped: Array<{ id: string; code?: string; reason: string; summary: string; caseTitle: string | null }>
}

export default function ProposalsPage() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('durum') as ProposalStatusFilter | null
  const status: ProposalStatusFilter = statusParam && STATUS_VALUES.includes(statusParam) ? statusParam : 'pending'
  const caseId = params.get('case') || undefined

  const { data, isLoading, isError, refetch, isFetching } = useProposals({ status, caseId })
  const proposals = useMemo(() => data ?? [], [data])
  const groups = useMemo(() => groupProposals(proposals), [proposals])

  const approve = useApproveProposal()
  const reject = useRejectProposal()
  const bulk = useBulkDecide()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProposalRow | null>(null)
  const [rejecting, setRejecting] = useState<ProposalRow | null>(null)
  const [targetChanged, setTargetChanged] = useState<TargetChangedState | null>(null)
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null)
  const [bulkReport, setBulkReport] = useState<BulkReport | null>(null)

  const pendingTab = status === 'pending'
  // Yenilenen listede artık olmayan seçimler sayılmaz.
  const selectedRows = proposals.filter((p) => selected.has(p.id) && p.status === 'pending')
  const caseTitle = caseId ? proposals.find((p) => p.caseId === caseId)?.caseTitle : null

  function setFilter(next: { durum?: ProposalStatusFilter; case?: string | null }) {
    const sp = new URLSearchParams(params)
    if (next.durum) {
      if (next.durum === 'pending') sp.delete('durum')
      else sp.set('durum', next.durum)
    }
    if (next.case === null) sp.delete('case')
    setParams(sp, { replace: true })
    setSelected(new Set())
    setBulkReport(null)
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function runApprove(proposal: ProposalRow, opts: { payload?: Record<string, unknown>; note?: string; forceOverwrite?: boolean } = {}) {
    setBusyId(proposal.id)
    try {
      const result = await approve.mutateAsync({ proposal, ...opts })
      toast.success(result?.repeated ? 'Öneri zaten uygulanmıştı.' : 'Öneri onaylandı ve kayda işlendi.')
      setEditing(null)
      setTargetChanged(null)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(proposal.id)
        return next
      })
    } catch (error) {
      const code = proposalErrorCode(error)
      const response = (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response
      if (code === 'PROPOSAL_CHANGED') {
        setEditing(null)
        setTargetChanged(null)
        toast.warning('Öneri güncellendi, yeniden inceleyin.')
        void refetch()
      } else if (needsOverwriteConfirmation(code)) {
        // TARGET_CHANGED veya CONFLICT_REVIEW_REQUIRED: avukatın açık "Yine de üzerine yaz" onayı gerekir.
        setEditing(null)
        const current = (response?.data?.current ?? response?.data?.before ?? null) as Record<string, unknown> | null
        setTargetChanged({
          code,
          proposal,
          payload: opts.payload,
          note: opts.note,
          current: current && typeof current === 'object' ? current : null,
          message: proposalErrorMessage(error, 'Kayıt öneriden sonra değiştirildi.'),
        })
      } else {
        const message = proposalErrorMessage(error, 'Öneri onaylanamadı.')
        // 422 (geçersiz düzenleme / iş kuralı) ve 409 (dava yok, sonuçlanmış) açıkça gösterilir.
        if (response?.status === 422 || response?.status === 409 || response?.status === 404 || response?.status === 400) {
          toast.error(message, { duration: 8000 })
        } else if (!response) {
          toast.error(message)
        }
        // 5xx/403 için axios zaten bildirim gösteriyor.
      }
    } finally {
      setBusyId(null)
    }
  }

  async function runReject(proposal: ProposalRow, note: string) {
    setBusyId(proposal.id)
    try {
      await reject.mutateAsync({ proposal, note })
      toast.success('Öneri reddedildi.')
      setRejecting(null)
    } catch (error) {
      toast.error(proposalErrorMessage(error, 'Öneri reddedilemedi.'), { duration: 8000 })
    } finally {
      setBusyId(null)
    }
  }

  async function runBulk(action: 'approve' | 'reject', note?: string) {
    const rows = selectedRows
    if (rows.length === 0) return
    try {
      const results = await bulk.mutateAsync({ proposals: rows, action, note })
      const { done, skipped } = summarizeBulkResults(results)
      const byId = new Map(rows.map((r) => [r.id, r]))
      setBulkReport({
        action,
        done,
        skipped: skipped.map((s) => ({ ...s, summary: byId.get(s.id)?.summary ?? s.id, caseTitle: byId.get(s.id)?.caseTitle ?? null })),
      })
      setSelected(new Set())
      setBulkAction(null)
      const verb = action === 'approve' ? 'onaylandı' : 'reddedildi'
      if (skipped.length === 0) toast.success(`${done} öneri ${verb}.`)
      else toast.warning(`${done} öneri ${verb}, ${skipped.length} öneri atlandı.`)
    } catch (error) {
      setBulkAction(null)
      toast.error(proposalErrorMessage(error, 'Toplu işlem yapılamadı.'), { duration: 8000 })
    }
  }

  const allSelected = proposals.length > 0 && selectedRows.length === proposals.length

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Asistan Önerileri</h1>
        <p className="text-sm text-muted-foreground">
          UYAP, Süre Kalkanı ve icra özetinden gelen öneriler. Siz onaylamadan hiçbir kayıt değişmez.
        </p>
      </div>

      {/* Durum sekmeleri */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Öneri durumu">
        {PROPOSAL_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setFilter({ durum: tab.value })}
            className={cn(
              'min-h-10 flex-shrink-0 rounded-full border px-4 text-sm font-medium transition',
              status === tab.value ? 'border-law-primary bg-law-primary text-primary-foreground' : 'bg-card hover:bg-muted'
            )}
          >
            {tab.label}
            {status === tab.value && !isLoading ? ` (${proposals.length})` : ''}
          </button>
        ))}
      </div>

      {caseId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Yalnızca bu dava:</span>
          <Link to={`/cases/${caseId}`} className="font-medium text-law-accent hover:underline">
            {caseTitle || 'Davayı aç'}
          </Link>
          <button type="button" onClick={() => setFilter({ case: null })} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">
            Filtreyi kaldır
          </button>
        </div>
      )}

      {bulkReport && (
        <Card className={bulkReport.skipped.length ? 'border-amber-300 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}>
          <CardContent className="space-y-2 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">
                Toplu {bulkReport.action === 'approve' ? 'onay' : 'ret'}: {bulkReport.done} öneri işlendi
                {bulkReport.skipped.length ? `, ${bulkReport.skipped.length} öneri atlandı` : ''}.
              </p>
              <button type="button" aria-label="Kapat" onClick={() => setBulkReport(null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            {bulkReport.skipped.length > 0 && (
              <ul className="space-y-1 text-xs">
                {bulkReport.skipped.map((s) => (
                  <li key={s.id} className="rounded bg-white/70 p-2">
                    <span className="font-medium">{s.summary}</span>
                    {s.caseTitle ? <span className="text-muted-foreground"> · {s.caseTitle}</span> : null}
                    <span className="block text-amber-900">
                      {s.reason}
                      {s.code ? <span className="ml-1 font-mono text-[10px] text-amber-700">({s.code})</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">Öneriler yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && proposals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-muted-foreground">
            {pendingTab ? 'Bekleyen öneri yok' : 'Bu durumda öneri yok'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {pendingTab ? 'Asistan yeni bir şey bulduğunda burada görünecek.' : 'Başka bir sekmeye bakabilirsiniz.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && proposals.length > 0 && (
        <div className={cn('space-y-6', pendingTab && selectedRows.length > 0 && 'pb-24 md:pb-20')}>
          {pendingTab && (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-5 w-5 accent-blue-600"
                checked={allSelected}
                onChange={(e) => setSelected(e.target.checked ? new Set(proposals.map((p) => p.id)) : new Set())}
              />
              Tümünü seç
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </label>
          )}
          {groups.map((group) => (
            <section key={group.kind} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label} <span className="font-normal">({group.items.length})</span>
              </h2>
              {group.items.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  selected={selected.has(p.id)}
                  onSelect={pendingTab ? (checked) => toggle(p.id, checked) : undefined}
                  busy={busyId === p.id || bulk.isPending}
                  onApprove={() => void runApprove(p)}
                  onEdit={() => setEditing(p)}
                  onReject={() => setRejecting(p)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {/* Toplu işlem çubuğu — mobilde alt barın üstünde durur */}
      {pendingTab && selectedRows.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-0 md:left-[240px]">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="mr-auto text-sm font-medium">{selectedRows.length} seçili</span>
            <button
              type="button"
              disabled={bulk.isPending}
              onClick={() => setBulkAction('reject')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Toplu ret
            </button>
            <button
              type="button"
              disabled={bulk.isPending}
              onClick={() => setBulkAction('approve')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-law-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Toplu onay
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={bulkAction === 'approve'}
        onOpenChange={(open) => !open && setBulkAction(null)}
        title={`${selectedRows.length} öneri onaylansın mı?`}
        description={bulkApproveDescription(selectedRows)}
        loading={bulk.isPending}
        onConfirm={() => void runBulk('approve')}
      />
      <RejectDialog
        open={bulkAction === 'reject'}
        title={`${selectedRows.length} öneri reddedilsin mi?`}
        busy={bulk.isPending}
        onClose={() => setBulkAction(null)}
        onSubmit={(note) => void runBulk('reject', note)}
      />
      <RejectDialog
        open={!!rejecting}
        title="Öneriyi reddet"
        description={rejecting?.summary}
        busy={!!rejecting && busyId === rejecting.id}
        onClose={() => setRejecting(null)}
        onSubmit={(note) => rejecting && void runReject(rejecting, note)}
      />
      <EditApproveDialog
        proposal={editing}
        busy={!!editing && busyId === editing.id}
        onClose={() => setEditing(null)}
        onSubmit={(payload, note) => editing && void runApprove(editing, { payload, note })}
      />
      <TargetChangedDialog
        state={targetChanged}
        busy={!!targetChanged && busyId === targetChanged.proposal.id}
        onClose={() => {
          setTargetChanged(null)
          void refetch()
        }}
        onForce={() =>
          targetChanged &&
          void runApprove(targetChanged.proposal, { payload: targetChanged.payload, note: targetChanged.note, forceOverwrite: true })
        }
      />
    </div>
  )
}
