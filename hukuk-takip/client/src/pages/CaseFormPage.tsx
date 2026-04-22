import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  caseStatusValues,
  caseTypeValues,
  createCaseSchema,
  type CreateCaseInput,
  type UpdateCaseInput,
  updateCaseSchema,
} from '@hukuk-takip/shared'
import { ArrowLeft, Loader2, Plus, Save, Scale } from 'lucide-react'
import { useCase, useCreateCase, useUpdateCase } from '@/hooks/useCases'
import { useMobileKeyboardFix } from '@/hooks/useMobileKeyboardFix'
import { useClients, useCreateClient } from '@/hooks/useClients'
import { caseStatusLabels, caseTypeLabels } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type CaseFormValues = CreateCaseInput & Pick<UpdateCaseInput, 'status' | 'closeDate'>

export default function CaseFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  useMobileKeyboardFix()
  const { data: caseData, isLoading: loadingCase } = useCase(id)
  const createCase = useCreateCase()
  const updateCase = useUpdateCase(id || '')
  const { data: clientsData } = useClients({ pageSize: 100 })
  const createClient = useCreateClient()

  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  const clients = clientsData?.data || []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(isEdit ? updateCaseSchema : createCaseSchema),
    defaultValues: {
      clientId: '',
      caseNumber: '',
      courtName: '',
      caseType: 'diger',
      customCaseType: '',
      title: '',
      description: '',
      startDate: '',
      contractedFee: '',
      currency: 'TRY',
      status: 'active',
      closeDate: '',
    },
  })

  useEffect(() => {
    if (!isEdit || !caseData) return

    reset({
      clientId: caseData.clientId || '',
      caseNumber: caseData.caseNumber || '',
      courtName: caseData.courtName || '',
      caseType: caseData.caseType || 'diger',
      customCaseType: caseData.customCaseType || '',
      title: caseData.title || '',
      description: caseData.description || '',
      startDate: caseData.startDate ? new Date(caseData.startDate).toISOString().split('T')[0] : '',
      contractedFee: caseData.contractedFee || '',
      currency: caseData.currency || 'TRY',
      status: caseData.status || 'active',
      closeDate: caseData.closeDate ? new Date(caseData.closeDate).toISOString().split('T')[0] : '',
    })
  }, [caseData, isEdit, reset])

  const selectedCaseType = watch('caseType')
  const selectedStatus = watch('status')
  const isPending = createCase.isPending || updateCase.isPending

  function handleCreateClient() {
    if (!newClientName.trim()) return

    createClient.mutate(
      {
        fullName: newClientName.trim(),
        phone: newClientPhone.trim() || undefined,
        email: newClientEmail.trim() || undefined,
      },
      {
        onSuccess: (response: any) => {
          const newId = response?.data?.id
          if (newId) {
            setValue('clientId', newId)
          }

          setClientDialogOpen(false)
          setNewClientName('')
          setNewClientPhone('')
          setNewClientEmail('')
        },
      }
    )
  }

  function onSubmit(values: CaseFormValues) {
    if (isEdit) {
      updateCase.mutate(values, {
        onSuccess: () => navigate(`/cases/${id}`),
      })
      return
    }

    createCase.mutate(values, {
      onSuccess: (response: any) => {
        const newCaseId = response?.data?.id
        navigate(newCaseId ? `/cases/${newCaseId}` : '/cases')
      },
    })
  }

  if (isEdit && loadingCase) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Dava Duzenle' : 'Yeni Dava'}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isEdit ? 'Dosya bilgilerini guncelleyin.' : 'Yeni dosya kaydini olusturun.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-law-accent" />
              Temel Dava Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Dava Basligi <span className="text-red-500">*</span>
              </label>
              <input
                {...register('title')}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="Ornek: Ahmet Yilmaz iscilik alacagi dosyasi"
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Muvekkil <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    {...register('clientId')}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
                  >
                    <option value="">Muvekkil secin</option>
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
                    title="Yeni muvekkil ekle"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Dava Turu <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('caseType')}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
                >
                  {caseTypeValues.map((type) => (
                    <option key={type} value={type}>
                      {caseTypeLabels[type] || type}
                    </option>
                  ))}
                </select>
                {errors.caseType && <p className="mt-1 text-xs text-red-600">{errors.caseType.message}</p>}
              </div>
            </div>

            {selectedCaseType === 'diger' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Ozel Dava Turu</label>
                <input
                  {...register('customCaseType')}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="Ornek: Tapu iptali, ortakligin giderilmesi"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Esas Numarasi</label>
                <input
                  {...register('caseNumber')}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="2026/145"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Mahkeme</label>
                <input
                  {...register('courtName')}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="Istanbul 5. Is Mahkemesi"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Baslangic Tarihi</label>
                <input
                  {...register('startDate')}
                  type="date"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Anlasilan Ucret</label>
                <input
                  {...register('contractedFee')}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="25000.00"
                />
                {errors.contractedFee && (
                  <p className="mt-1 text-xs text-red-600">{errors.contractedFee.message}</p>
                )}
              </div>
            </div>

            {isEdit && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Dosya Durumu</label>
                  <select
                    {...register('status')}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
                  >
                    {caseStatusValues.map((status) => (
                      <option key={status} value={status}>
                        {caseStatusLabels[status] || status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Kapanis Tarihi</label>
                  <input
                    {...register('closeDate')}
                    type="date"
                    disabled={!selectedStatus || !['won', 'lost', 'settled', 'closed'].includes(selectedStatus)}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 disabled:cursor-not-allowed disabled:bg-muted/40"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Aciklama</label>
              <textarea
                {...register('description')}
                rows={5}
                className="w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="Dosya ozeti, hedef, riskler, karsi taraf bilgisi ve notlar"
              />
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 -mx-3 flex flex-col-reverse gap-2 border-t bg-background px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-4px_12px_rgba(0,0,0,0.04)] sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:shadow-none">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            Iptal
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-law-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Guncelle' : 'Kaydet'}
          </button>
        </div>
      </form>

      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Muvekkil Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Ad Soyad <span className="text-red-500">*</span>
              </label>
              <input
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="Ad Soyad"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Telefon</label>
              <input
                value={newClientPhone}
                onChange={(event) => setNewClientPhone(event.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="05xx xxx xx xx"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">E-posta</label>
              <input
                value={newClientEmail}
                onChange={(event) => setNewClientEmail(event.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="ornek@mail.com"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClientDialogOpen(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                Iptal
              </button>
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={!newClientName.trim() || createClient.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Olustur
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
