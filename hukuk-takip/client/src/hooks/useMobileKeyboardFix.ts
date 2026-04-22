import { useEffect } from 'react'

// iOS Safari ve bazı Android Chrome versiyonlarında sanal klavye açıldığında
// sayfa altındaki sticky buton klavye tarafından kapatılabiliyor.
// Odaklanılan input bottom-sheet ile çakışıyorsa scrollIntoView tetikler.
export function useMobileKeyboardFix() {
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return
      // Klavyenin açılması için kısa bir gecikme
      setTimeout(() => {
        try {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        } catch {
          // Eski tarayıcılarda arguments desteklenmeyebilir
          target.scrollIntoView()
        }
      }, 250)
    }

    document.addEventListener('focusin', handleFocus)
    return () => {
      document.removeEventListener('focusin', handleFocus)
    }
  }, [])
}
