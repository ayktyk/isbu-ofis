import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients, useDeleteClient } from '@/hooks/useClients'
import { formatDate, maskTcNo } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Trash2,
  Edit,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'

export default function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>()
  function handleSearch(value: string) {
    setSearch(value)
    if (timer) clearTimeout(timer)
    const t = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
    setTimer(t)
  }

  const { data, isLoading, isError } = useClients({
    search: debouncedSearch || undefined,
    page,
    pageSize,
  })

  const deleteClient = useDeleteClient()

  const clients = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Müvekkiller</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${total} müvekkil kayıtlı` : 'Müvekkil listesi'}
          </p>
        </div>
        <button
          onClick={() => navigate('/clients/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Yeni Müvekkil
        </button>
      </div>

      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="İsim, TC No veya telefon ile ara..."
          className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-10 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
        />
        {search && (
          <button
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Yükleniyor */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-60" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hata */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Müvekkil listesi yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {!isLoading && !isError && (
        <>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {debouncedSearch ? 'Sonuç bulunamadı' : 'Henüz müvekkil eklenmemiş'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {debouncedSearch ? 'Farklı bir arama terimi deneyin' : 'İlk müvekkilinizi ekleyerek başlayın'}
              </p>
              {!debouncedSearch && (
                <button
                  onClick={() => navigate('/clients/new')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Müvekkil Ekle
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Müvekkil</th>
                    <th className="hidden px-4 py-3 md:table-cell">TC No</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Telefon</th>
                    <th className="hidden px-4 py-3 lg:table-cell">E-posta</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Kayıt Tarihi</th>
                    <th className="px-4 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.map((client: any) => (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="cursor-pointer transition-colors hover:bg-muted/50 even:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-law-primary text-xs font-semibold text-white">
                            {client.fullName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{client.fullName}</p>
                            {client.notes && (
                              <p className="max-w-[200px] truncate text-xs text-muted-foreground">{client.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">{maskTcNo(client.tcNo)}</span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {client.phone ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {client.email ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-xs text-muted-foreground">{formatDate(client.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client.id}`) }}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Görüntüle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client.id}/edit`) }}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Düzenle"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Bu müvekkili silmek istediğinize emin misiniz?')) {
                                deleteClient.mutate(client.id)
                              }
                            }}
                            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-xs font-medium">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
