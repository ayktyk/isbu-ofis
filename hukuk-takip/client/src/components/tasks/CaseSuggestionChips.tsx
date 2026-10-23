import { cn } from '@/lib/utils'
import type { CaseOption } from '@/lib/caseSuggest'

/**
 * Gorev metninden onerilen davalar icin dokunulabilir cipler.
 *
 * Yalniz oneri: cipe dokunulmadikca hicbir sey secilmez. Metin "Muvekkil · Dava
 * basligi" — ayni muvekkilin iki davasini ayirt etmek icin ikisi birlikte.
 */
export default function CaseSuggestionChips({
  items,
  onPick,
  label,
  className,
}: {
  items: CaseOption[]
  onPick: (item: CaseOption) => void
  label?: string
  className?: string
}) {
  if (items.length === 0) return null

  // Tek satir + yatay kaydirma: telefonda her cip ayri satira inip alttaki
  // alanlari itiyordu. Odak halkasi ice cizilir, kaydirma kutusu onu kesmesin.
  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto', className)}>
      {label && <span className="flex-shrink-0 text-xs text-muted-foreground">{label}</span>}
      {items.map((item) => {
        const text = [item.clientName, item.title].filter(Boolean).join(' · ')
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            title={text}
            className="inline-flex min-h-11 max-w-[85%] flex-shrink-0 items-center rounded-full border border-accent/40 bg-background px-3 py-1.5 text-xs font-medium text-law-accent outline-none transition hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 sm:min-h-9 sm:max-w-xs"
          >
            <span className="truncate">{text}</span>
          </button>
        )
      })}
    </div>
  )
}
