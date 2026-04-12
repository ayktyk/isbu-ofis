import { Loader2 } from 'lucide-react'

export function LoadingPage() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Yükleniyor...</p>
    </div>
  )
}
