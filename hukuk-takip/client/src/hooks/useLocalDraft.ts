import { useState } from 'react'
import { toast } from 'sonner'

export function draftKey(userId: string, scope: string) { return `themis:draft:${userId}:${scope}` }
export function useLocalDraft<T>(userId: string, scope: string, initial: T) {
  const key = draftKey(userId, scope)
  const read = () => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial } catch { return initial } }
  const [stored, setStored] = useState(() => ({ key, value: read() }))
  if (stored.key !== key) setStored({ key, value: read() })
  const value = stored.key === key ? stored.value : read()
  const save = (next: T | ((value: T) => T)) => {
    const updated = typeof next === 'function' ? (next as (v: T) => T)(value) : next
    setStored({ key, value: updated })
    try { localStorage.setItem(key, JSON.stringify(updated)) }
    catch { toast.error('Taslak cihazda saklanamadı. Ekranı kapatmadan kaydedin.', { id: 'draft-storage' }) }
  }
  const clear = () => { setStored({ key, value: initial }); try { localStorage.removeItem(key) } catch {} }
  return [value, save, clear] as const
}
