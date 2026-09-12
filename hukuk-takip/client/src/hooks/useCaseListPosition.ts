import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

// Only navigation preferences live here; no case content is stored.
export function useCaseListPosition(ready: boolean) {
  const location = useLocation()
  const restored = useRef(false)
  useEffect(() => {
    if (!ready) return
    const main = document.getElementById('app-scroll-main')
    if (!main) return
    const key = `case-list-scroll:${location.search}`
    let saved = 0
    try { saved = Number(sessionStorage.getItem(key)) || 0 } catch { /* storage unavailable */ }
    const frame = requestAnimationFrame(() => {
      main.scrollTop = restored.current ? 0 : saved
      restored.current = true
    })
    const save = () => {
      try { sessionStorage.setItem(key, String(main.scrollTop)) } catch { /* storage unavailable */ }
    }
    main.addEventListener('scroll', save, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      main.removeEventListener('scroll', save)
    }
  }, [ready, location.search])
}

export function useCaseListFilters() {
  const [params, setParams] = useSearchParams()
  const setFilter = (key: string, value: string) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    }, { replace: true })
  }
  return { params, setFilter }
}
