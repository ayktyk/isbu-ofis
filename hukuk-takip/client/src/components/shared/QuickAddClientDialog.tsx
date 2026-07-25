import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useCreateClient } from '@/hooks/useClients'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Hizli muvekkil ekleme penceresi.
 *
 * Dava formunda ve gorev formundaki hizli dava penceresinde ayni sekilde
 * kullanilir — onceden bu form CaseFormPage icinde inline duruyordu, iki
 * yerde kopyalanmasin diye ortak bilesene tasindi.
 */
export default function QuickAddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (clientId: string) => void
}) {
  const createClient = useCreateClient()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  function handleCreate() {
    if (!fullName.trim()) return

    createClient.mutate(
      {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      },
      {
        onSuccess: (response: any) => {
          const newId = response?.data?.id
          if (newId) onCreated(newId)
          onOpenChange(false)
          setFullName('')
          setPhone('')
          setEmail('')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Müvekkil Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Telefon</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-posta</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
              placeholder="ornek@mail.com"
            />
          </div>
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
              disabled={!fullName.trim() || createClient.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
