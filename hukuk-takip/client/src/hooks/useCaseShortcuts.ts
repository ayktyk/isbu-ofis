import { useEffect, useState } from 'react'
import { toast } from 'sonner'
export function useCaseShortcuts(userId?: string, visitedId?: string) {
  const key = `themis:shortcuts:${userId || 'none'}`
  const read = (): { pinned: string[]; recent: string[] } => { try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return { pinned: Array.isArray(value.pinned) ? value.pinned.filter((s: unknown) => typeof s === 'string').slice(0, 12) : [], recent: Array.isArray(value.recent) ? value.recent.filter((s: unknown) => typeof s === 'string').slice(0, 8) : [] } } catch { return { pinned: [], recent: [] } } }
  const [value, setValue] = useState(read)
  function write(next: typeof value) { setValue(next); try { localStorage.setItem(key, JSON.stringify(next)) } catch { toast.error('Kısayollar cihazda saklanamadı.') } }
  useEffect(() => { const current = read(); if (userId && visitedId) write({ ...current, recent: [visitedId, ...current.recent.filter(id => id !== visitedId)].slice(0, 8) }); else setValue(current) }, [key, visitedId])
  const toggle = (id: string) => { if (!value.pinned.includes(id) && value.pinned.length >= 12) { toast.info('En fazla 12 dosya sabitlenebilir.'); return } write({ ...value, pinned: value.pinned.includes(id) ? value.pinned.filter(item => item !== id) : [...value.pinned, id] }) }
  return { ...value, toggle }
}
