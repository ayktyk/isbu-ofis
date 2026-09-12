import { useLocation, useSearchParams } from 'react-router-dom'
export default function FocusedRecordNotice({ param, found, loading }: { param: string; found: boolean; loading: boolean }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  if (!params.get(param)) return null
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-law-accent/30 bg-law-accent/5 p-3 text-sm" role="status">
    <span>{loading ? 'İlgili kayıt yükleniyor…' : found ? 'Bağlantıdan geldiğiniz kayıt gösteriliyor.' : 'İlgili kayıt bulunamadı veya erişiminiz yok.'}</span>
    <button className="min-h-10 font-medium text-law-accent underline" onClick={() => setParams(current => { const next = new URLSearchParams(current); next.delete(param); return next }, { replace: true, state: location.state })}>Tüm kayıtları göster</button>
  </div>
}
