import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale,
  Users,
  CalendarClock,
  Plus,
  Settings,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { api } from '@/lib/axios'

interface SearchResult {
  id: number | string
  label: string
  sublabel?: string
  type: 'case' | 'client'
}

export default function ActionSearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Search API
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const [casesRes, clientsRes] = await Promise.all([
          api.get('/cases', { params: { search: query, pageSize: 5 } }).catch(() => ({ data: { data: [] } })),
          api.get('/clients', { params: { search: query, pageSize: 5 } }).catch(() => ({ data: { data: [] } })),
        ])

        const caseResults: SearchResult[] = (casesRes.data.data || []).map((c: any) => ({
          id: c.id,
          label: c.title || c.caseNumber || `Dava #${c.id}`,
          sublabel: c.courtName || c.clientName,
          type: 'case' as const,
        }))

        const clientResults: SearchResult[] = (clientsRes.data.data || []).map((c: any) => ({
          id: c.id,
          label: c.fullName,
          sublabel: c.phone || c.email,
          type: 'client' as const,
        }))

        setResults([...caseResults, ...clientResults])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const runAction = useCallback(
    (path: string) => {
      setOpen(false)
      setQuery('')
      navigate(path)
    },
    [navigate]
  )

  const cases = results.filter((r) => r.type === 'case')
  const clients = results.filter((r) => r.type === 'client')

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Dava, müvekkil veya işlem ara..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Aranıyor...' : query.length < 2 ? 'En az 2 karakter yazın.' : 'Sonuç bulunamadı.'}
        </CommandEmpty>

        {/* Search results */}
        {cases.length > 0 && (
          <CommandGroup heading="Davalar">
            {cases.map((c) => (
              <CommandItem key={`case-${c.id}`} onSelect={() => runAction(`/davalar/${c.id}`)}>
                <Scale className="mr-2 h-4 w-4 text-law-accent" />
                <div className="flex flex-col">
                  <span>{c.label}</span>
                  {c.sublabel && (
                    <span className="text-xs text-muted-foreground">{c.sublabel}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {clients.length > 0 && (
          <CommandGroup heading="Müvekkiller">
            {clients.map((c) => (
              <CommandItem key={`client-${c.id}`} onSelect={() => runAction(`/muvekkilller/${c.id}`)}>
                <Users className="mr-2 h-4 w-4 text-emerald-500" />
                <div className="flex flex-col">
                  <span>{c.label}</span>
                  {c.sublabel && (
                    <span className="text-xs text-muted-foreground">{c.sublabel}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick actions - always visible */}
        {results.length === 0 && !loading && (
          <>
            <CommandGroup heading="Hızlı Erişim">
              <CommandItem onSelect={() => runAction('/')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => runAction('/davalar')}>
                <Scale className="mr-2 h-4 w-4" />
                Tüm Davalar
              </CommandItem>
              <CommandItem onSelect={() => runAction('/muvekkilller')}>
                <Users className="mr-2 h-4 w-4" />
                Tüm Müvekkiller
              </CommandItem>
              <CommandItem onSelect={() => runAction('/durusmalar')}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Duruşmalar
              </CommandItem>
              <CommandItem onSelect={() => runAction('/gorevler')}>
                <ListChecks className="mr-2 h-4 w-4" />
                Görevler
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Hızlı İşlem">
              <CommandItem onSelect={() => runAction('/davalar/yeni')}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Dava Aç
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runAction('/muvekkilller/yeni')}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Müvekkil Ekle
              </CommandItem>
              <CommandItem onSelect={() => runAction('/ayarlar/profil')}>
                <Settings className="mr-2 h-4 w-4" />
                Ayarlar
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
