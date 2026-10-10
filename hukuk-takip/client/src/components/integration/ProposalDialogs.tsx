import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  applyEdits,
  buildProposalDiff,
  editFieldsFor,
  overwriteDialogText,
  toEditValue,
  type ProposalRow,
} from '@/lib/proposals'
import ProposalDiff from './ProposalDiff'

const inputClass =
  'w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 sm:text-sm'

// ─── Düzenle ve onayla ───────────────────────────────────────────────────────

export function EditApproveDialog({
  proposal,
  busy,
  onClose,
  onSubmit,
}: {
  proposal: ProposalRow | null
  busy: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>, note: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const fields = proposal ? editFieldsFor(proposal.kind, proposal.payload) : []

  useEffect(() => {
    if (!proposal) return
    const initial: Record<string, string> = {}
    for (const field of editFieldsFor(proposal.kind, proposal.payload)) {
      initial[field.key] = toEditValue(proposal.payload[field.key], field.input)
    }
    setValues(initial)
    setNote('')
  }, [proposal])

  const missing = fields.some((f) => f.required && !values[f.key]?.trim())
  const conditional = proposal?.kind === 'deadline_upsert' && proposal.payload.conditional === true

  return (
    <Dialog open={!!proposal} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Düzenle ve onayla</DialogTitle>
          <DialogDescription>{proposal?.summary}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!proposal || missing || busy) return
            onSubmit(applyEdits(proposal.kind, proposal.payload, values), note)
          }}
        >
          {conditional && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              Koşullu süre: {String(proposal?.payload.condition ?? '')}. Son gün girerseniz süre koşulsuz kaydedilir.
            </p>
          )}
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label htmlFor={`edit-${field.key}`} className="text-xs font-medium text-muted-foreground">
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              {field.input === 'textarea' ? (
                <textarea
                  id={`edit-${field.key}`}
                  rows={3}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className={inputClass}
                />
              ) : field.input === 'select' ? (
                <select
                  id={`edit-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className={inputClass}
                >
                  {(field.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`edit-${field.key}`}
                  type={field.input === 'datetime' ? 'datetime-local' : field.input === 'date' ? 'date' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className={inputClass}
                />
              )}
            </div>
          ))}
          <div className="space-y-1.5">
            <label htmlFor="edit-note" className="text-xs font-medium text-muted-foreground">Karar notu (isteğe bağlı)</label>
            <input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={2000} />
          </div>
          <DialogFooter className="gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border px-4 text-sm font-medium transition hover:bg-muted">
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={busy || missing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-law-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Kaydet ve onayla
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reddet (isteğe bağlı not) ─────────────────────────────────────────────

export function RejectDialog({
  open,
  title,
  description,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  description?: string
  busy: boolean
  onClose: () => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) setNote('')
  }, [open])
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) onSubmit(note)
          }}
        >
          <label htmlFor="reject-note" className="text-xs font-medium text-muted-foreground">Not (isteğe bağlı)</label>
          <textarea
            id="reject-note"
            rows={3}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Neden reddedildi? Asistan bir sonraki eşitlemede görür."
            className={inputClass}
          />
          <DialogFooter className="gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border px-4 text-sm font-medium transition hover:bg-muted">
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reddet
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── 409 TARGET_CHANGED / CONFLICT_REVIEW_REQUIRED: açık "üzerine yaz" onayı ─────
// TARGET_CHANGED: hedef kayıt öneriden sonra avukatça düzenlendi.
// CONFLICT_REVIEW_REQUIRED: öneri avukatın girdiği dolu bir değerin üzerine yazacak.

export interface TargetChangedState {
  code: 'TARGET_CHANGED' | 'CONFLICT_REVIEW_REQUIRED'
  proposal: ProposalRow
  payload?: Record<string, unknown>
  note?: string
  message: string
  current: Record<string, unknown> | null
}

export function TargetChangedDialog({
  state,
  busy,
  onClose,
  onForce,
}: {
  state: TargetChangedState | null
  busy: boolean
  onClose: () => void
  onForce: () => void
}) {
  const rows = state
    ? buildProposalDiff(state.proposal.kind, state.payload ?? state.proposal.payload, state.current ?? state.proposal.before)
    : []
  const text = overwriteDialogText(state?.code ?? 'TARGET_CHANGED')
  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {text.title}
          </DialogTitle>
          <DialogDescription>{state?.message}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {text.explanation} Emin değilseniz vazgeçip kaydı açarak kontrol edin.
        </p>
        <ProposalDiff rows={rows} />
        <DialogFooter className="gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border px-4 text-sm font-medium transition hover:bg-muted">
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onForce}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Yine de üzerine yaz
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
