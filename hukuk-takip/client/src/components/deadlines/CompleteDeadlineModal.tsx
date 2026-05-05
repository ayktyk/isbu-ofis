import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  const [viewport, setViewport] = useState<{ height: number; offsetTop: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const updateStatus = useUpdateTaskStatus()

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    const keepActiveTextareaVisible = () => {
      if (document.activeElement !== textareaRef.current) return
      window.requestAnimationFrame(() => {
        textareaRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
      })
    }

    const syncViewport = () => {
      setViewport({
        height: visualViewport.height,
        offsetTop: visualViewport.offsetTop || 0,
      })
      keepActiveTextareaVisible()
    }

    syncViewport()
    visualViewport.addEventListener('resize', syncViewport)
    visualViewport.addEventListener('scroll', syncViewport)
    return () => {
      visualViewport.removeEventListener('resize', syncViewport)
      visualViewport.removeEventListener('scroll', syncViewport)
    }
  }, [])

  function keepTextareaVisible() {
    window.requestAnimationFrame(() => {
      textareaRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
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

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      style={{
        height: viewport ? `${viewport.height}px` : '100dvh',
        transform: viewport?.offsetTop ? `translateY(${viewport.offsetTop}px)` : undefined,
      }}
    >
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Kapat" />
      <Card className="relative z-10 flex max-h-full w-full flex-col overflow-hidden rounded-none shadow-xl sm:max-h-[min(90dvh,640px)] sm:max-w-lg sm:rounded-xl">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="flex flex-shrink-0 items-center justify-between border-b bg-card px-4 pb-3 pt-4 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-law-primary">Süreli İşi Tamamla</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.title}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <label className="mb-1.5 block text-sm font-medium">
                Ne yapıldı? <span className="text-red-500">*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value)
                  keepTextareaVisible()
                }}
                onFocus={keepTextareaVisible}
                rows={5}
                placeholder="Örn: İtiraz dilekçesi 02.05.2026 tarihinde UYAP üzerinden sunuldu. Tevzi no: ..."
                className="min-h-[132px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                En az 5 karakter. Bu not ileride ne yapıldığını hatırlatmak için saklanır.
              </p>
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5">
              <button
                type="button"
                onClick={onClose}
                disabled={updateStatus.isPending}
                className="rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={updateStatus.isPending || evidence.trim().length < 5}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {updateStatus.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Kaydet ve Yapıldı İşaretle
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
