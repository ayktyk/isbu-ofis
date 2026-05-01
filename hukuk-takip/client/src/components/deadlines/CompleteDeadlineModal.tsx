import { useState } from 'react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
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

          <div className="mt-5 flex justify-end gap-2">
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
