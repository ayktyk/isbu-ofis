import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { caseStatusLabels, cn } from '@/lib/utils'
import { filterCases, type CaseOption } from '@/lib/caseSuggest'

const VISIBLE_LIMIT = 50

// Radix, icerik sarmalayicisinda ekranda kalan yuksekligi bu degiskenle verir.
// Telefonda klavye acikken liste ekrandan tasmasin diye arama kutusunun payi
// (~56px) dusulur.
const LIST_STYLE = {
  maxHeight: 'min(320px, calc(var(--radix-popover-content-available-height, 360px) - 56px))',
}

// Vurgulu satirda varsayilan bg-accent tam doygun renk; ikinci satirdaki soluk
// metin okunmuyordu. Hafif aksan zemini tum temalarda okunur kalir. law-accent/NN
// degil accent/NN: law-accent var() yedegiyle tanimli oldugu icin Tailwind onun
// opaklikli sinifini hic uretmiyor (vurgu gorunmuyordu); iki degisken her temada ayni.
const ITEM_CLASS =
  'min-h-11 gap-2 py-2.5 data-[selected=true]:bg-accent/10 data-[selected=true]:text-foreground'

// Hicbir satira ait olmayan cmdk degeri: acilista ilk satir kendiliginden
// vurgulanmasin (secili dava varsa o satir vurgulanir).
const NO_ACTIVE_ROW = '__acilis__'
// cmdk'nin satirlar arasinda gezdirdigi tuslar.
const NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End'])

export type CaseListStatus = 'loading' | 'error' | 'ready'
export type CaseKind = 'dava' | 'cmk'

// Secici CMK kategorisinde de kullanilir; metinler ustteki etiketle ("Ilgili CMK
// Dosyasi") uyussun. "Dokunun" yerine "ara veya sec": masaustunde de dogru okunur.
const KIND_TEXT: Record<CaseKind, { one: string; heading: string; placeholder: string; search: string }> = {
  dava: { one: 'dava', heading: 'Davalar', placeholder: 'Dava ara veya seç…', search: 'Dava ara' },
  cmk: {
    one: 'CMK dosyası',
    heading: 'CMK dosyaları',
    placeholder: 'CMK dosyası ara veya seç…',
    search: 'CMK dosyası ara',
  },
}

function emptyMessage(status: CaseListStatus, truncated: boolean, one: string): string {
  if (status === 'loading') return 'Davalar yükleniyor…'
  if (status === 'error') return 'Dava listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.'
  // Liste kesikse dava listelenmeyen eski kayitlarda olabilir: + ile yeniden
  // acmaya yonlendirmek mukerrer dava demek.
  if (truncated) return `Eşleşen ${one} bulunamadı. Listelenmeyen eski kayıtlar arasında olabilir.`
  return `Eşleşen ${one} bulunamadı. Yeni ${one} için + düğmesini kullanın.`
}

function caseMeta(item: CaseOption, withCourt: boolean): string {
  return [
    item.clientName,
    item.caseNumber ? `Esas: ${item.caseNumber}` : null,
    withCourt ? item.courtName : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function CaseOptionRow({
  item,
  value,
  checked,
  onSelect,
}: {
  item: CaseOption
  value: string
  checked: boolean
  onSelect: () => void
}) {
  const meta = caseMeta(item, true)
  const statusLabel =
    item.status && item.status !== 'active' ? caseStatusLabels[item.status] || item.status : null

  return (
    <CommandItem value={value} onSelect={onSelect} className={cn(ITEM_CLASS, 'items-start')}>
      <Check
        className={cn(
          'mt-0.5 h-4 w-4 flex-shrink-0 text-law-accent',
          checked ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-snug">{item.title}</p>
        {(meta || statusLabel) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {meta && <span className="break-words">{meta}</span>}
            {statusLabel && (
              <span className="rounded bg-muted px-1.5 text-[11px] font-medium">{statusLabel}</span>
            )}
          </div>
        )}
      </div>
    </CommandItem>
  )
}

/**
 * Aranabilir dava secici (shadcn Combobox: Popover + Command).
 *
 * Native <select> 100+ davada kaydirarak aramayi zorlastiriyordu. Filtre
 * bizim (filterCases): cmdk'nin varsayilan bulanik filtresi Turkce I/ı ve
 * aksanlari bilmez, "yilmaz" ile "Yılmaz"i eslestirmez.
 *
 * Icerik body'ye portal edilir; arama kutusunda Enter formu gondermez (cmdk
 * Enter'da preventDefault yapar, kutu formun DOM'unda da degil).
 */
export default function CaseCombobox({
  value,
  onChange,
  cases,
  suggestions = [],
  fallbackLabel,
  totalAvailable,
  loadedCount,
  status = 'ready',
  kind = 'dava',
  placeholder,
  ariaLabel = 'Dava seç',
}: {
  value: string
  onChange: (caseId: string) => void
  cases: CaseOption[]
  suggestions?: CaseOption[]
  fallbackLabel?: string | null
  totalAvailable?: number
  // Sunucudan yuklenen toplam kayit. Normal + CMK tek istekte gelip ikiye
  // ayrildiginda cases yalniz bir parca; kesme notu buna gore verilmeli.
  loadedCount?: number
  // Liste yuklenirken bos sonuc "dava yok" demek degil.
  status?: CaseListStatus
  kind?: CaseKind
  placeholder?: string
  ariaLabel?: string
}) {
  const text = KIND_TEXT[kind]
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigatedRef = useRef(false)

  const selected = useMemo(
    () => (value ? cases.find((item) => item.id === value) ?? null : null),
    [cases, value]
  )
  const filtered = useMemo(() => filterCases(query, cases, VISIBLE_LIMIT), [query, cases])

  const isSearching = query.trim().length > 0
  // cmdk ilk satiri vurgular; arama yazilirken en ustte "Secimi kaldir" olsaydi
  // Enter ilk sonucu secmek yerine secimi silerdi. O yuzden yalniz bos aramada.
  const showClear = Boolean(value) && !isSearching
  const showSuggestions = !isSearching && suggestions.length > 0
  const hiddenCount = filtered.total - filtered.items.length
  const loaded = loadedCount ?? cases.length
  const truncatedTotal = totalAvailable !== undefined && totalAvailable > loaded ? totalAvailable : null
  const selectedMeta = selected ? caseMeta(selected, false) : ''
  const triggerText = selected
    ? selected.title
    : value
      ? fallbackLabel || `Seçili ${text.one} yükleniyor…`
      : placeholder ?? text.placeholder

  function handleOpenChange(next: boolean) {
    setOpen(next)
    navigatedRef.current = false
    if (!next) setQuery('')
  }

  function handleQueryChange(next: string) {
    navigatedRef.current = false
    setQuery(next)
  }

  // Bos aramada tek basina Enter hicbir sey secmez: cmdk ilk satiri kendiliginden
  // vurgular; telefonda klavyeyi kapatmak icin basilan Enter/Git baglantiyi
  // silmesin ya da ilk davayi baglamasin. Okla secilen satir Enter'la alinir.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (NAV_KEYS.has(event.key)) navigatedRef.current = true
    else if (event.key === 'Enter' && !isSearching && !navigatedRef.current) event.preventDefault()
  }

  function choose(caseId: string) {
    onChange(caseId)
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          // aria-label gorunen metnin yerine gecer; secili dava da okunsun diye eklenir.
          aria-label={`${ariaLabel}: ${triggerText}`}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-left text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-accent/20 data-[state=open]:border-law-accent data-[state=open]:ring-2 data-[state=open]:ring-accent/20"
        >
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate', !value && 'text-muted-foreground')}>
              {triggerText}
            </span>
            {selectedMeta && (
              <span className="block truncate text-xs text-muted-foreground">{selectedMeta}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
      >
        <Command
          shouldFilter={false}
          loop
          label={text.search}
          defaultValue={value ? `dava-${value}` : NO_ACTIVE_ROW}
          onKeyDown={handleKeyDown}
        >
          <CommandInput
            placeholder="Müvekkil, dava adı veya esas no…"
            value={query}
            onValueChange={handleQueryChange}
          />
          <CommandList label={ariaLabel} style={LIST_STYLE} className="overscroll-contain">
            {showClear && (
              <CommandGroup>
                <CommandItem
                  value="__temizle__"
                  onSelect={() => choose('')}
                  className={cn(ITEM_CLASS, 'items-center text-muted-foreground')}
                >
                  <X className="h-4 w-4 flex-shrink-0" />
                  Seçimi kaldır
                </CommandItem>
              </CommandGroup>
            )}

            {showSuggestions && (
              <CommandGroup heading="Görev metnine göre önerilen">
                {suggestions.map((item) => (
                  <CaseOptionRow
                    key={`oneri-${item.id}`}
                    value={`oneri-${item.id}`}
                    item={item}
                    checked={item.id === value}
                    onSelect={() => choose(item.id)}
                  />
                ))}
              </CommandGroup>
            )}

            {filtered.items.length > 0 && (
              <CommandGroup heading={text.heading}>
                {filtered.items.map((item) => (
                  <CaseOptionRow
                    key={`dava-${item.id}`}
                    value={`dava-${item.id}`}
                    item={item}
                    checked={item.id === value}
                    onSelect={() => choose(item.id)}
                  />
                ))}
              </CommandGroup>
            )}

            {hiddenCount > 0 && (
              <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">
                +{hiddenCount} {text.one} daha — aramayı daraltın
              </p>
            )}

            {truncatedTotal !== null && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Toplam {truncatedTotal} davanın ilk {loaded} tanesi listelendi
              </p>
            )}

            {/* cmdk'nin CommandEmpty'si shouldFilter={false} iken yalniz HIC oge
                yokken gorunur; "Secimi kaldir" satiri varken bos sonucu gizlerdi.
                Bu yuzden bos durum elle gosterilir. */}
            {filtered.total === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage(status, truncatedTotal !== null, text.one)}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
