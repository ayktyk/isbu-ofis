import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CheckSquare,
  Handshake,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Plus,
  Settings,
  Users,
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

interface SearchResults {
  clients: { id: string; fullName: string; phone?: string; email?: string }[]
  cases: { id: string; title: string; caseNumber?: string; courtName?: string; status: string; clientName?: string }[]
  tasks: { id: string; title: string; status: string; priority: string }[]
  hearings: { id: string; caseId: string; hearingDate: string; courtRoom?: string; caseTitle?: string }[]
  mediations: { id: string; fileNo?: string; disputeType: string; disputeSubject?: string; status: string }[]
  consultations: { id: string; fullName: string; phone?: string; subject?: string; status: string; consultationDate: string }[]
}

const EMPTY: SearchResults = { clients: [], cases: [], tasks: [], hearings: [], mediations: [], consultations: [] }

export default function ActionSearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
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

  // Debounced search via global /api/search
  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResults(EMPTY)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get('/search', { params: { q: query.trim() } })
        setResults(res.data)
      } catch {
        setResults(EMPTY)
      } finally {
        setLoading(false)
      }
    }, 200)

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

  const hasResults =
    results.clients.length > 0 ||
    results.cases.length > 0 ||
    results.tasks.length > 0 ||
    results.hearings.length > 0 ||
    results.mediations.length > 0 ||
    results.consultations.length > 0

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Müvekkil, dava, görev, duruşma, arabuluculuk ara..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Aranıyor...' : query.length < 1 ? 'Arama için yazmaya başlayın.' : 'Sonuç bulunamadı.'}
        </CommandEmpty>

        {/* Müvekkiller */}
        {results.clients.length > 0 && (
          <CommandGroup heading="Müvekkiller">
            {results.clients.map((c) => (
              <CommandItem key={`client-${c.id}`} onSelect={() => runAction(`/clients/${c.id}`)}>
                <Users className="mr-2 h-4 w-4 text-emerald-500" />
                <div className="flex flex-col">
                  <span>{c.fullName}</span>
                  {(c.phone || c.email) && (
                    <span className="text-xs text-muted-foreground">{c.phone || c.email}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Davalar */}
        {results.cases.length > 0 && (
          <CommandGroup heading="Davalar">
            {results.cases.map((c) => (
              <CommandItem key={`case-${c.id}`} onSelect={() => runAction(`/cases/${c.id}`)}>
                <Briefcase className="mr-2 h-4 w-4 text-law-accent" />
                <div className="flex flex-col">
                  <span>{c.title}</span>
                  {(c.clientName || c.caseNumber) && (
                    <span className="text-xs text-muted-foreground">
                      {c.clientName}{c.clientName && c.caseNumber ? ' · ' : ''}{c.caseNumber}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Görevler */}
        {results.tasks.length > 0 && (
          <CommandGroup heading="Görevler">
            {results.tasks.map((t) => (
              <CommandItem key={`task-${t.id}`} onSelect={() => runAction('/tasks')}>
                <CheckSquare className="mr-2 h-4 w-4 text-amber-500" />
                <div className="flex flex-col">
                  <span>{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.status}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Duruşmalar */}
        {results.hearings.length > 0 && (
          <CommandGroup heading="Duruşmalar">
            {results.hearings.map((h) => (
              <CommandItem key={`hearing-${h.id}`} onSelect={() => runAction(`/cases/${h.caseId}`)}>
                <Calendar className="mr-2 h-4 w-4 text-blue-500" />
                <div className="flex flex-col">
                  <span>{h.caseTitle || 'Duruşma'}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.hearingDate).toLocaleDateString('tr-TR')}{h.courtRoom ? ` · ${h.courtRoom}` : ''}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Görüşmeler */}
        {results.consultations.length > 0 && (
          <CommandGroup heading="Görüşmeler">
            {results.consultations.map((c) => (
              <CommandItem key={`cons-${c.id}`} onSelect={() => runAction('/consultations')}>
                <MessageSquare className="mr-2 h-4 w-4 text-cyan-500" />
                <div className="flex flex-col">
                  <span>{c.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.subject || c.phone || new Date(c.consultationDate).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Arabuluculuk */}
        {results.mediations.length > 0 && (
          <CommandGroup heading="Arabuluculuk">
            {results.mediations.map((m) => (
              <CommandItem key={`med-${m.id}`} onSelect={() => runAction('/tools/mediation-files')}>
                <Handshake className="mr-2 h-4 w-4 text-purple-500" />
                <div className="flex flex-col">
                  <span>{m.disputeType}</span>
                  {(m.fileNo || m.disputeSubject) && (
                    <span className="text-xs text-muted-foreground">{m.fileNo || m.disputeSubject}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Hızlı Erişim - sonuç yokken göster */}
        {!hasResults && !loading && (
          <>
            <CommandGroup heading="Hızlı Erişim">
              <CommandItem onSelect={() => runAction('/dashboard')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => runAction('/cases')}>
                <Briefcase className="mr-2 h-4 w-4" />
                Tüm Davalar
              </CommandItem>
              <CommandItem onSelect={() => runAction('/clients')}>
                <Users className="mr-2 h-4 w-4" />
                Tüm Müvekkiller
              </CommandItem>
              <CommandItem onSelect={() => runAction('/hearings')}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Duruşmalar
              </CommandItem>
              <CommandItem onSelect={() => runAction('/tasks')}>
                <ListChecks className="mr-2 h-4 w-4" />
                Görevler
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Hızlı İşlem">
              <CommandItem onSelect={() => runAction('/cases/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Dava Aç
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runAction('/clients/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Müvekkil Ekle
              </CommandItem>
              <CommandItem onSelect={() => runAction('/settings')}>
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
