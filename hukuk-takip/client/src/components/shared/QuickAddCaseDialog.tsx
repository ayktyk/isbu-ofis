import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { caseTypeValues, type CreateCaseInput } from '@hukuk-takip/shared'
import { useCreateCase } from '@/hooks/useCases'
import { useClients } from '@/hooks/useClients'
import { caseTypeLabels } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import QuickAddClientDialog from './QuickAddClientDialog'

/**
 * Hizli dava ekleme penceresi.
 *
 * Gorev eklerken "ilgili dava" listesinde aranan dava yoksa avukat sayfadan
 * cikmadan dava — gerekirse muvekkili de — olusturabilsin diye.
 *
 * defaultCmk=true ile CMK gorevlendirmesi isaretli acilir (gorev kategorisi
 * CMK secildiginde).
 */
export default function QuickAddCaseDialog({
  open,
  onOpenChange,
  onCreated,
  defaultCmk = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (caseId: string) => void
  defaultCmk?: boolean
}) {
  const createCase = useCreateCase()
  const { data: clientsData } = useClients({ pageSize: 100 })
  const clients = clientsData?.data || []

  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [caseType, setCaseType] = useState<CreateCaseInput['caseType']>('diger')
  const [isCmk, setIsCmk] = useState(defaultCmk)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  // Dava basligi sunucuda en az 3 karakter isteniyor (createCaseSchema).
  const canSubmit = title.trim().length >= 3 && !!clientId

  function handleCreate() {
    if (!canSubmit) return

    createCase.mutate(
      {
        title: title.trim(),
        clientId,
        caseType,
        isCmkAssignment: isCmk,
        currency: 'TRY',
      },
      {
        onSuccess: (response: any) => {
          const newId = response?.data?.id
          if (newId) onCreated(newId)
          onOpenChange(false)
          setTitle('')
          setClientId('')
          setCaseType('diger')
          setIsCmk(defaultCmk)
        },
      }
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isCmk ? 'Yeni CMK Dosyası' : 'Yeni Dava'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Dava Başlığı <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="Örnek: Ahmet Yılmaz işçilik alacağı"
                autoFocus
              />
              {title.trim().length > 0 && title.trim().length < 3 && (
                <p className="mt-1 text-xs text-red-600">En az 3 karakter olmalıdır.</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Müvekkil <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
                >
                  <option value="">Müvekkil seçin</option>
                  {clients.map((client: any) => (
                    <option key={client.id} value={client.id}>
                      {client.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setClientDialogOpen(true)}
                  className="rounded-xl border px-3 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title="Yeni müvekkil ekle"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Dava Türü</label>
              <select
                value={caseType}
                onChange={(event) =>
                  setCaseType(event.target.value as CreateCaseInput['caseType'])
                }
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
              >
                {caseTypeValues.map((type) => (
                  <option key={type} value={type}>
                    {caseTypeLabels[type] || type}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={isCmk}
                onChange={(event) => setIsCmk(event.target.checked)}
                className="h-4 w-4 rounded border-input text-law-accent focus:ring-2 focus:ring-law-accent/20"
              />
              <span className="text-sm font-medium">CMK Görevlendirmesi</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSubmit || createCase.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {createCase.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Oluştur
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(newClientId) => setClientId(newClientId)}
      />
    </>
  )
}
