import { useState } from 'react'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
export default function DocumentDownload({ id, fileName }: { id: string; fileName: string }) {
  const [pending, setPending] = useState(false)
  async function download() {
    if (pending) return
    setPending(true)
    try {
      const response = await api.get(`/documents/${encodeURIComponent(id)}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Belge indirilemedi. Bağlantınızı kontrol edip tekrar deneyin.') }
    finally { setPending(false) }
  }
  return <button type="button" disabled={pending} onClick={download} className="min-h-10 text-sm font-medium text-law-accent hover:underline disabled:opacity-50">{pending ? 'İndiriliyor…' : 'İndir'}</button>
}
