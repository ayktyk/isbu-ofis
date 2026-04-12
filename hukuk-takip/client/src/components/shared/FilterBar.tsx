import { X, ListFilter, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

export interface FilterDefinition {
  key: string
  label: string
  options: FilterOption[]
  icon?: React.ElementType
}

interface FilterBarProps {
  filters: FilterDefinition[]
  activeFilters: Record<string, string[]>
  onChange: (filters: Record<string, string[]>) => void
  className?: string
}

export default function FilterBar({
  filters,
  activeFilters,
  onChange,
  className,
}: FilterBarProps) {
  const totalActive = Object.values(activeFilters).flat().length

  const toggleFilter = (key: string, value: string) => {
    const current = activeFilters[key] || []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...activeFilters, [key]: updated })
  }

  const removeFilter = (key: string, value: string) => {
    const current = activeFilters[key] || []
    onChange({ ...activeFilters, [key]: current.filter((v) => v !== value) })
  }

  const clearAll = () => {
    onChange({})
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Filter dropdowns */}
      {filters.map((filter) => {
        const Icon = filter.icon || ListFilter
        const selected = activeFilters[filter.key] || []
        const isActive = selected.length > 0

        return (
          <Popover key={filter.key}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                  isActive
                    ? 'border-law-accent/40 bg-law-accent/10 text-law-accent'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {filter.label}
                {isActive && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-law-accent px-1 text-[10px] font-bold text-white">
                    {selected.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="start">
              <div className="max-h-60 overflow-y-auto">
                {filter.options.map((opt) => {
                  const checked = selected.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleFilter(filter.key, opt.value)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        checked
                          ? 'bg-law-accent/10 text-law-accent'
                          : 'text-foreground hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                            checked
                              ? 'border-law-accent bg-law-accent text-white'
                              : 'border-muted-foreground/30'
                          )}
                        >
                          {checked && (
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span>{opt.label}</span>
                      </div>
                      {opt.count != null && (
                        <span className="text-xs text-muted-foreground">{opt.count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        )
      })}

      {/* Active filter chips */}
      {totalActive > 0 && (
        <>
          <div className="h-5 w-px bg-border" />
          {Object.entries(activeFilters).flatMap(([key, values]) => {
            const filterDef = filters.find((f) => f.key === key)
            return values.map((val) => {
              const optLabel = filterDef?.options.find((o) => o.value === val)?.label || val
              return (
                <span
                  key={`${key}-${val}`}
                  className="inline-flex items-center gap-1 rounded-full bg-law-accent/10 px-2.5 py-1 text-xs font-medium text-law-accent"
                >
                  {optLabel}
                  <button
                    type="button"
                    onClick={() => removeFilter(key, val)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-law-accent/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })
          })}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Temizle
          </button>
        </>
      )}
    </div>
  )
}
