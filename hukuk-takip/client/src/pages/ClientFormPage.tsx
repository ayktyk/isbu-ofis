import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClientSchema, type CreateClientInput } from '@hukuk-takip/shared'
import { useClient, useCreateClient, useUpdateClient } from '@/hooks/useClients'
import { useMobileKeyboardFix } from '@/hooks/useMobileKeyboardFix'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Save, Loader2, UserPlus, UserCog } from 'lucide-react'

export default function ClientFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  useMobileKeyboardFix()
  const { data: client, isLoading: loadingClient } = useClient(id)
  const createClient = useCreateClient()
  const updateClient = useUpdateClient(id || '')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      fullName: '',
      tcNo: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (isEdit && client) {
      reset({
        fullName: client.fullName || '',
        tcNo: client.tcNo || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        notes: client.notes || '',
      })
    }
  }, [client, isEdit, reset])

  function onSubmit(data: CreateClientInput) {
    if (isEdit) {
      updateClient.mutate(data, {
        onSuccess: () => navigate(`/clients/${id}`),
      })
    } else {
      createClient.mutate(data, {
        onSuccess: () => navigate('/clients'),
      })
    }
  }

  if (isEdit && loadingClient) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPending = createClient.isPending || updateClient.isPending

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="page-title">
            {isEdit ? 'Müvekkil Düzenle' : 'Yeni Müvekkil'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isEdit ? 'Müvekkil bilgilerini güncelleyin' : 'Yeni müvekkil kaydı oluşturun'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              {isEdit ? <UserCog className="h-4 w-4 text-law-accent" /> : <UserPlus className="h-4 w-4 text-law-accent" />}
              Kişisel Bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ad Soyad */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Ad Soyad <span className="text-red-500">*</span>
              </label>
              <input
                {...register('fullName')}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="Ahmet Yılmaz"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
              )}
            </div>

            {/* TC No */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">TC Kimlik No</label>
              <input
                {...register('tcNo')}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                placeholder="12345678901"
                maxLength={11}
              />
              {errors.tcNo && (
                <p className="mt-1 text-xs text-red-600">{errors.tcNo.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Telefon */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Telefon</label>
                <input
                  {...register('phone')}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="0532 123 4567"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
                )}
              </div>

              {/* E-posta */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">E-posta</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="ornek@email.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Adres */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Adres</label>
              <textarea
                {...register('address')}
                rows={3}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 resize-none"
                placeholder="Açık adres..."
              />
            </div>

            {/* Notlar */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Notlar</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 resize-none"
                placeholder="Müvekkille ilgili ekstra notlar..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Butonlar — mobilde sticky footer, desktop'ta normal akış */}
        <div className="sticky bottom-0 -mx-3 flex flex-col-reverse gap-2 border-t bg-background px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-4px_12px_rgba(0,0,0,0.04)] sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:shadow-none">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-law-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:opacity-50 sm:w-auto"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
