import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useRecordFocus(ready: boolean) {
  const { search } = useLocation()
  const focus = new URLSearchParams(search).get('focus')
  useEffect(() => {
    if (!ready || !focus) return
    let target: HTMLElement | null = null
    const frame = requestAnimationFrame(() => {
      target = document.getElementById(focus)
      if (!target) return
      target.setAttribute('data-record-target', 'true')
      target.setAttribute('tabindex', '-1')
      target.scrollIntoView({ block: 'center', behavior: 'auto' })
      target.focus({ preventScroll: true })
    })
    return () => { cancelAnimationFrame(frame); target?.removeAttribute('data-record-target'); target?.removeAttribute('tabindex') }
  }, [ready, focus])
}
