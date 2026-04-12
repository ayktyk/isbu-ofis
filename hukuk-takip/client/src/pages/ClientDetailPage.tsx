import { useNavigate, useParams } from 'react-router-dom'
import { useClient, useClientCases, useDeleteClient } from '@/hooks/useClients'
import { formatDate, maskTcNo, caseStatusLabels, caseTypeLabels } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Scale,
  Plus,
  AlertTriangle,
} from 'lucide-react'

const statusVariant: Record<string, 'default' | 'success' | 'danger' | 'warning' | 'secondary'> = {
  active: 'default',
  won: 'success',
  lost: 'danger',
  settled: 'warning',
  closed: 'secondary',
  passive: 'secondary',
}

export default function ClientDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: client, isLoading, isError } = useClient(id)
  const { data: casesData } = useClientCases(id)
  const deleteClient = useDeleteClient()

  const cases = casesData?.cases || casesData || []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="space-y-4 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isError || !client) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/clients')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Müvekkillere dön
        </button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Müvekkil bulunamadı.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const initials = client.fullName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/clients')}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-law-primary text-sm font-bold text-white">
              {initials}
            </div>
            <div>
              <h1 className="page-title">{client.fullName}</h1>
              <p className="text-sm text-muted-foreground">
                Kayıt: {formatDate(client.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/clients/${id}/edit`)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Edit className="h-4 w-4" />
            Düzenle
          </button>
          <button
            onClick={() => {
              if (confirm('Bu müvekkili silmek istediğinize emin misiniz?')) {
                deleteClient.mutate(client.id, {
                  onSuccess: () => navigate('/clients'),
                })
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: Müvekkil Bilgileri */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <User className="h-4 w-4 text-law-accent" />
              Kişisel Bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.tcNo && (
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">TC Kimlik No</p>
                  <p className="font-mono text-sm">{maskTcNo(client.tcNo)}</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefon</p>
                  <p className="text-sm">{client.phone}</p>
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">E-posta</p>
                  <p className="text-sm">{client.email}</p>
                </div>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Adres</p>
                  <p className="text-sm">{client.address}</p>
                </div>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Notlar</p>
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
            {!client.tcNo && !client.phone && !client.email && !client.address && !client.notes && (
              <p className="text-sm text-muted-foreground/60">Ek bilgi girilmemiş.</p>
            )}
          </CardContent>
        </Card>

        {/* Sağ: Davalar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <Scale className="h-4 w-4 text-law-accent" />
                Davalar
                {cases.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{cases.length}</Badge>
                )}
              </CardTitle>
              <button
                onClick={() => navigate('/cases/new')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-law-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1d4ed8]"
              >
                <Plus className="h-3.5 w-3.5" />
                Yeni Dava
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Scale className="mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Bu müvekkile ait dava bulunmuyor.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4">Dava</th>
                      <th className="hidden pb-2 pr-4 sm:table-cell">Tür</th>
                      <th className="pb-2 pr-4">Durum</th>
                      <th className="hidden pb-2 md:table-cell">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cases.map((c: any) => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium">{c.title}</p>
                          {c.caseNumber && (
                            <p className="text-xs text-muted-foreground">{c.caseNumber}</p>
                          )}
                        </td>
                        <td className="hidden py-3 pr-4 sm:table-cell">
                          <span className="text-muted-foreground">
                            {caseTypeLabels[c.caseType] || c.caseType}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant[c.status] || 'secondary'}>
                            {caseStatusLabels[c.status] || c.status}
                          </Badge>
                        </td>
                        <td className="hidden py-3 md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(c.startDate || c.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
