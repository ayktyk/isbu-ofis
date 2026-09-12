import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
export default function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [update, setUpdate] = useState<null | (() => void)>(() => (window as any).__themisUpdate || null)
  const qc = useQueryClient()
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const [, rerender] = useState(0)
  useEffect(() => {
    const change = () => setOnline(navigator.onLine)
    const ready = (e: Event) => setUpdate(() => (e as CustomEvent).detail)
    window.addEventListener('online', change); window.addEventListener('offline', change); window.addEventListener('themis-update-ready', ready)
    const unsubscribe = qc.getQueryCache().subscribe(() => rerender(v => v + 1))
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); window.removeEventListener('themis-update-ready', ready); unsubscribe() }
  }, [qc])
  const active = qc.getQueryCache().getAll().filter(q => q.isActive() && q.queryKey[0] !== 'auth')
  const stale = active.some(q => q.state.fetchStatus !== 'fetching' && (q.state.status === 'error' || q.isStale()))
  const timestamps = active.map(q => q.state.dataUpdatedAt).filter(Boolean)
  const oldest = timestamps.length ? Math.min(...timestamps) : 0
  return <div className="border-b bg-card px-3 py-2 text-xs" role="status">
    {!online ? 'Çevrimdışısınız. Görünen kayıtlar eski olabilir; değişiklikler sunucuya kaydedilmez.' : fetching ? 'Kayıtlar güncelleniyor…' : stale ? 'Bazı kayıtlar güncel olmayabilir.' : oldest ? `Görünen verilerin en eski yenilenmesi: ${new Date(oldest).toLocaleString('tr-TR')}` : 'Bağlantı açık'}
    {online && <button className="ml-3 min-h-8 underline" onClick={() => qc.invalidateQueries()}>Yenile</button>}
    {update && <button disabled={mutating > 0} className="ml-3 min-h-8 font-semibold text-law-accent" onClick={() => { if (confirm('Yeni sürüm yüklenecek. Not, çalışma planı ve duruşma sonucu taslakları korunur. Diğer açık formları ve dosya yüklemelerini önce kaydedin. Devam edilsin mi?')) update() }}>Yeni sürüm hazır · Güncelle</button>}
  </div>
}
