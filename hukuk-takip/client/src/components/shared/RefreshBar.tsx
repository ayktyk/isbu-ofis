import { useIsFetching } from '@tanstack/react-query'

/**
 * Cache'te veri varken tam sayfa iskeleti basmak yerine veriyi gosterip
 * yenilemeyi ustteki ince cizgiyle bildiririz. "Sekmeye basinca bekliyor"
 * hissini ortadan kaldirir.
 *
 * Ekran okuyuculara duyurulmaz (aria-hidden): bilgi tasimayan, tamamen
 * dekoratif bir ilerleme gostergesidir.
 */
export default function RefreshBar() {
  const fetching = useIsFetching()
  if (fetching === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="h-full w-1/4 bg-law-accent"
        style={{ animation: 'hz-refresh-slide 1.1s ease-in-out infinite' }}
      />
    </div>
  )
}
