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
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const updateStatus = useUpdateTaskStatus()

  // Background scroll lock — modal arkasında sayfa kaymasın.
  // Önceki body styllerini saklayıp restore ediyoruz, böylece kapatınca normale döner.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // visualViewport — interactive-widget=resizes-content desteği olmayan
  // tarayıcılarda (eski Android, eski iOS) klavye açıldığında modal yüksekliğini
  // görünür alana kısalt. transform: translateY KULLANILMIYOR; o eski yaklaşım
  // bazı cihazlarda modal'ı görünmez alana itip "Kaydet" butonunu erişilemez
  // hale getiriyordu. Sadece height değişiyor — modal her zaman top:0'dan başlar.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => setVisibleHeight(vv.height)
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

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
    // Outer overlay — fixed inset-0 + 100dvh garantisi.
    // viewport meta'daki interactive-widget=resizes-content sayesinde mobil klavye
    // açıldığında dvh otomatik küçülür → modal her zaman görünür alanda kalır.
    // Eski transform: translateY(offsetTop) hilesi kaldırıldı (bazı cihazlarda
    // modal'ı görünmez alana itiyordu, Kaydet butonu erişilemez oluyordu).
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      style={{ height: visibleHeight ? `${visibleHeight}px` : '100dvh' }}
      onClick={onClose}
    >
      <Card
        className="relative z-10 flex w-full max-h-full flex-col overflow-hidden rounded-none shadow-xl sm:max-h-[min(90dvh,640px)] sm:max-w-lg sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {/* Başlık */}
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

          {/* Form — flex column. Scroll alanı + sticky footer.
              Sticky footer: scroll edilirken bile butonlar her zaman görünür kalır,
              çünkü scroll container'ın visible viewport'unun altına yapışır. */}
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <div className="flex-1 px-4 py-4 sm:px-5">
                <label className="mb-1.5 block text-sm font-medium">
                  Ne yapıldı? <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  rows={5}
                  placeholder="Örn: İtiraz dilekçesi 02.05.2026 tarihinde UYAP üzerinden sunuldu. Tevzi no: ..."
                  className="min-h-[132px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  En az 5 karakter. Bu not ileride ne yapıldığını hatırlatmak için saklanır.
                </p>
              </div>

              {/* Sticky footer — scroll içinde her zaman alttaki görünür viewport'a yapışır.
                  Klavye açılıp modal yüksekliği değişse bile Kaydet butonu erişilebilir kalır. */}
              <div className="sticky bottom-0 z-10 mt-auto flex flex-shrink-0 justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5">
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
