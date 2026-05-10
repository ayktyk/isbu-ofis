import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CheckSquare,
  FileText,
  Handshake,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Plus,
  Receipt,
  Settings,
  StickyNote,
  Users,
  Wallet,
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
  notes: { id: string; content: string; caseId?: string | null; clientId?: string | null; caseTitle?: string | null; clientName?: string | null }[]
  expenses: { id: string; description: string; amount: string; caseId?: string | null; caseTitle?: string | null; expenseDate?: string }[]
  collections: { id: string; description?: string | null; amount: string; caseId?: string | null; mediationFileId?: string | null; caseTitle?: string | null; clientName?: string | null; collectionDate?: string }[]
  documents: { id: string; fileName: string; description?: string | null; caseId: string; caseTitle?: string | null }[]
}

const EMPTY: SearchResults = {
  clients: [],
  cases: [],
  tasks: [],
  hearings: [],
  mediations: [],
  consultations: [],
  notes: [],
  expenses: [],
  collections: [],
  documents: [],
}

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
    results.consultations.length > 0 ||
    results.notes.length > 0 ||
    results.expenses.length > 0 ||
    results.collections.length > 0 ||
    results.documents.length > 0

  return (
    // shouldFilter={false}: arama tamamen sunucuda yapılıyor; cmdk'nın
    // varsayılan client-side filter'ı (input ile fuzzy match) sunucu sonuçlarını
    // ilk render'da gizliyordu — bu yüzden "ilk seferde sonuç yok, tekrar
    // açınca dolu" görünümü oluşuyordu. Filter'ı kapatınca tüm sunucu sonuçları
    // doğrudan render edilir.
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Müvekkil, dava, görev, duruşma, not, masraf, tahsilat, belge ara..."
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

        {/* Notlar */}
        {results.notes.length > 0 && (
          <CommandGroup heading="Notlar">
            {results.notes.map((n) => {
              const target = n.caseId
                ? `/cases/${n.caseId}`
                : n.clientId
                  ? `/clients/${n.clientId}`
                  : '/dashboard'
              const preview = (n.content || '').replace(/\s+/g, ' ').trim().slice(0, 80)
              const context = n.caseTitle || n.clientName
              return (
                <CommandItem key={`note-${n.id}`} onSelect={() => runAction(target)}>
                  <StickyNote className="mr-2 h-4 w-4 text-yellow-500" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{preview || 'Not'}</span>
                    {context && (
                      <span className="text-xs text-muted-foreground truncate">{context}</span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Masraflar */}
        {results.expenses.length > 0 && (
          <CommandGroup heading="Masraflar">
            {results.expenses.map((e) => (
              <CommandItem
                key={`exp-${e.id}`}
                onSelect={() => runAction(e.caseId ? `/cases/${e.caseId}` : '/dashboard')}
              >
                <Receipt className="mr-2 h-4 w-4 text-orange-500" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{e.description}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {e.caseTitle || ''}{e.caseTitle && e.amount ? ' · ' : ''}
                    {e.amount ? `${parseFloat(e.amount).toLocaleString('tr-TR')} ₺` : ''}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Tahsilatlar */}
        {results.collections.length > 0 && (
          <CommandGroup heading="Tahsilatlar">
            {results.collections.map((c) => {
              const target = c.caseId
                ? `/cases/${c.caseId}`
                : c.mediationFileId
                  ? '/tools/mediation-files'
                  : '/collections'
              return (
                <CommandItem key={`col-${c.id}`} onSelect={() => runAction(target)}>
                  <Wallet className="mr-2 h-4 w-4 text-emerald-500" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{c.description || 'Tahsilat'}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {c.caseTitle || c.clientName || ''}{(c.caseTitle || c.clientName) && c.amount ? ' · ' : ''}
                      {c.amount ? `${parseFloat(c.amount).toLocaleString('tr-TR')} ₺` : ''}
                    </span>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Belgeler */}
        {results.documents.length > 0 && (
          <CommandGroup heading="Belgeler">
            {results.documents.map((d) => (
              <CommandItem key={`doc-${d.id}`} onSelect={() => runAction(`/cases/${d.caseId}`)}>
                <FileText className="mr-2 h-4 w-4 text-sky-500" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{d.fileName}</span>
                  {(d.caseTitle || d.description) && (
                    <span className="text-xs text-muted-foreground truncate">
                      {d.caseTitle || d.description}
                    </span>
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
