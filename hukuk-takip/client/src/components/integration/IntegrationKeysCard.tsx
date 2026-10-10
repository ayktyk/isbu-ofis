import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Bot, Copy, KeyRound, Loader2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import { proposalErrorMessage } from '@/lib/proposals'
import { useApiKeys, useCreateApiKey, useRevokeApiKey, type ApiKeyRow } from '@/hooks/useIntegration'

const SCOPE_LABELS: Record<string, string> = { read: 'Okuma', propose: 'Öneri gönderme' }

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Anahtar kopyalandı.')
  } catch {
    toast.error('Kopyalanamadı; anahtarı elle seçip kopyalayın.')
  }
}

// Ayarlar → Asistan Entegrasyonu: betik/MCP için API anahtarları.
// Anahtar yalnızca oluşturulduğu anda bir kez gösterilir (sunucuda yalnız özeti durur).
export default function IntegrationKeysCard({ canManage }: { canManage: boolean }) {
  const { data, isLoading, isError } = useApiKeys()
  const createKey = useCreateApiKey()
  const revokeKey = useRevokeApiKey()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read', 'propose'])
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null)
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)

  const keys = data ?? []

  function toggleScope(scope: string, checked: boolean) {
    setScopes((prev) => (checked ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope)))
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2 || scopes.length === 0 || createKey.isPending) return
    createKey.mutate(
      { name: name.trim(), scopes },
      {
        onSuccess: (row) => {
          setCreated({ name: row.name, key: row.key })
          setName('')
        },
        onError: (error) => toast.error(proposalErrorMessage(error, 'Anahtar oluşturulamadı.')),
      }
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-law-accent" />
          Asistan Entegrasyonu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          UYAP eşitleme, Süre Kalkanı ve icra özeti betikleri bu anahtarla verinizi okur ve öneri gönderir. Öneriler siz
          onaylamadan kayda işlenmez. Her betiğe ayrı anahtar verin, yalnızca gereken yetkiyi seçin.
        </p>

        {canManage ? (
          <form onSubmit={handleCreate} className="space-y-3 rounded-xl border bg-muted/20 p-3">
            <div>
              <label htmlFor="api-key-name" className="mb-1.5 block text-sm font-medium">Anahtar adı</label>
              <input
                id="api-key-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. UYAP eşitleme (büro bilgisayarı)"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 sm:text-sm"
              />
            </div>
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-1.5 text-sm font-medium">Yetkiler</legend>
              {(['read', 'propose'] as const).map((scope) => (
                <label key={scope} className="flex min-h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-blue-600"
                    checked={scopes.includes(scope)}
                    onChange={(e) => toggleScope(scope, e.target.checked)}
                  />
                  {SCOPE_LABELS[scope]}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createKey.isPending || name.trim().length < 2 || scopes.length === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Anahtar oluştur
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">Anahtarları yalnızca avukat yönetebilir.</p>
        )}

        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : isError ? (
          <p className="text-sm text-destructive">Anahtarlar yüklenemedi.</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz anahtar yok.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <KeyRound className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="break-words font-medium">{key.name}</span>
                    {key.revokedAt ? <Badge variant="danger">İptal edildi</Badge> : <Badge variant="success">Etkin</Badge>}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{key.keyPrefix}…</p>
                  <p className="text-xs text-muted-foreground">
                    {key.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')} · Son kullanım:{' '}
                    {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'hiç'}
                    {key.revokedAt ? ` · İptal: ${formatDateTime(key.revokedAt)}` : ''}
                  </p>
                </div>
                {canManage && !key.revokedAt && (
                  <button
                    type="button"
                    onClick={() => setRevoking(key)}
                    className="min-h-10 self-start rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:self-center"
                  >
                    İptal et
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle>Anahtar oluşturuldu</DialogTitle>
            <DialogDescription>{created?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Bu anahtar <strong>yalnızca şimdi</strong> gösterilir. Kopyalayıp betiğin bulunduğu bilgisayarda güvenli yere
              (ör. .env dosyası) kaydedin. Kaybederseniz iptal edip yenisini oluşturun.
            </span>
          </div>
          <code className="block select-all break-all rounded-lg border bg-muted p-3 font-mono text-xs">{created?.key}</code>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => created && void copyText(created.key)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition hover:bg-muted"
            >
              <Copy className="h-4 w-4" /> Kopyala
            </button>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Kaydettim, kapat
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Anahtar iptal edilsin mi?"
        description={`"${revoking?.name ?? ''}" anahtarını kullanan betikler hemen çalışmaz. Bu işlem geri alınamaz.`}
        variant="danger"
        loading={revokeKey.isPending}
        onConfirm={() =>
          revoking &&
          revokeKey.mutate(revoking.id, {
            onSuccess: () => {
              toast.success('Anahtar iptal edildi.')
              setRevoking(null)
            },
            onError: (error) => toast.error(proposalErrorMessage(error, 'Anahtar iptal edilemedi.')),
          })
        }
      />
    </Card>
  )
}
