import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

export function CompleteDeadlineModal({
  task,
  onClose,
}: {
  task: { id: string; title: string; legalBasis?: string | null }
  onClose: () => void
}) {
  const [evidence, setEvidence] = useState('')
  const updateStatus = useUpdateTaskStatus()

  // Body scroll lock
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevPosition = document.body.style.position
    const prevTop = document.body.style.top
    const prevWidth = document.body.style.width
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.position = prevPosition
      document.body.style.top = prevTop
      document.body.style.width = prevWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  function handleSubmit() {
    const trimmed = evidence.trim()
    if (trimmed.length < 5) {
      toast.error('En az 5 karakterlik kanıt notu zorunludur.')
      return
    }
    updateStatus.mutate(
      { id: task.id, status: 'completed', completionEvidence: trimmed } as any,
      {
        onSuccess: () => {
          toast.success('Süreli iş tamamlandı.')
          onClose()
        },
      }
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-none sm:h-auto sm:max-h-[92vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {/* Header — sabit */}
          <div className="flex flex-shrink-0 items-center justify-between border-b bg-card px-4 pb-3 pt-4 sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-law-primary">Süreli İşi Tamamla</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{task.title}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* BODY — kaydırılabilir */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <label className="mb-1.5 block text-sm font-medium">
            Ne yapıldı? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={4}
            placeholder="Örn: İcra dosyasına itiraz dilekçesi 02.05.2026 tarihinde UYAP üzerinden sunuldu. Tevzii No: ...&#10;veya: Anlaşma sağlandığı için süre takibi gerekli değil — dosya kapatıldı."
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
            autoFocus
          />
          <p className="mt-1 text-xs text-muted-foreground">
            En az 5 karakter. Bu not ileride hangi işlemin yapıldığını hatırlamak için arşivlenir.
          </p>
          </div>

          {/* Footer — sabit (bottom) */}
          <div className="flex flex-shrink-0 justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={updateStatus.isPending || evidence.trim().length < 5}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Tamamlandı Olarak İşaretle
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
