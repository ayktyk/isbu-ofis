import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { useUpdateTaskStatus } from '@/hooks/useTasks'

export function CompleteDeadlineModal({
  task,
  onClose,
}: {
  task: { id: string; title: string; legalBasis?: string | null }
  onClose: () => void
}) {
  const [evidence, setEvidence] = useState('')
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null)
  const updateStatus = useUpdateTaskStatus()

  // Background scroll lock — modal arkasında sayfa kaymasın.
  // Önceki body styllerini saklayıp restore ediyoruz, böylece kapatınca normale döner.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  // Portaling escapes transformed page ancestors. The keyboard can change
  // both the height and offset of the visible viewport.
  useEffect(() => {
    const vv = window.visualViewport
    const sync = () => setViewport({ height: vv?.height ?? window.innerHeight, top: vv?.offsetTop ?? 0 })
    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (updateStatus.isPending) return
    const trimmed = evidence.trim()
    if (trimmed.length < 5) {
      toast.error('En az 5 karakterlik kanıt notu zorunludur.')
      return
    }
    updateStatus.mutate(
      { id: task.id, status: 'completed', completionEvidence: trimmed },
      { onSuccess: onClose }
    )
  }

  return createPortal(
    <div
      className="fixed inset-x-0 z-[100] flex items-end justify-center overflow-hidden bg-black/40 sm:items-center sm:p-4"
      style={{ top: viewport?.top ?? 0, height: viewport ? `${viewport.height}px` : '100dvh' }}
      onClick={() => { if (!updateStatus.isPending) onClose() }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-deadline-title"
        className="relative z-10 flex h-full max-h-full w-full flex-col overflow-hidden rounded-none shadow-xl sm:h-[min(100%,640px)] sm:max-w-lg sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {/* Başlık */}
          <div className="flex flex-shrink-0 items-center justify-between border-b bg-card px-4 pb-3 pt-4 sm:px-5">
            <div className="min-w-0">
              <h2 id="complete-deadline-title" className="text-lg font-semibold text-law-primary">Süreli İşi Tamamla</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.title}</p>
            </div>
            <button
              onClick={onClose}
              disabled={updateStatus.isPending}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Only the fields scroll; the action row stays outside that area. */}
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <div className="flex-1 px-4 py-4 sm:px-5">
                <label htmlFor="deadline-evidence" className="mb-1.5 block text-sm font-medium">
                  Ne yapıldı? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="deadline-evidence"
                  disabled={updateStatus.isPending}
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  rows={5}
                  placeholder="Örn: İtiraz dilekçesi 02.05.2026 tarihinde UYAP üzerinden sunuldu. Tevzi no: ..."
                  className="min-h-[132px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-base outline-none focus:border-law-accent"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  En az 5 karakter. Bu not ileride ne yapıldığını hatırlatmak için saklanır.
                </p>
              </div>

            </div>
            <div className="flex flex-shrink-0 flex-wrap justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={updateStatus.isPending}
                  className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={updateStatus.isPending || evidence.trim().length < 5}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {updateStatus.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Kaydet ve tamamla
                </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>,
    document.body
  )
}
