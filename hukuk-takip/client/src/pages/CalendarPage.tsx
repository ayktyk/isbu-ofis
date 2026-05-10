import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHearings } from '@/hooks/useHearings'
import { useTasks } from '@/hooks/useTasks'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  ListChecks,
  AlertOctagon,
} from 'lucide-react'
import { daysUntil, deadlineSeverityLabels } from '@/lib/utils'

interface CalendarEvent {
  id: string
  title: string
  date: Date
  type: 'hearing' | 'task' | 'deadline'
  caseId?: string
  meta?: string
  /** Süreli iş için kalan gün (negatif = geçti) */
  daysLeft?: number
  /** Süreli iş şiddet seviyesi */
  severity?: string
  /** Süreli iş yasal dayanak */
  legalBasis?: string
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const { data: hearingsData } = useHearings()
  const { data: tasksData } = useTasks()

  const hearings = Array.isArray(hearingsData) ? hearingsData : []
  const tasks = Array.isArray(tasksData) ? tasksData : []

  // Tüm etkinlikleri birleştir
  const events = useMemo<CalendarEvent[]>(() => {
    const items: CalendarEvent[] = []

    hearings.forEach((h: any) => {
      if (h.hearingDate) {
        items.push({
          id: h.id,
          title: h.caseTitle || 'Duruşma',
          date: new Date(h.hearingDate),
          type: 'hearing',
          caseId: h.caseId,
          meta: h.courtRoom ? `Salon: ${h.courtRoom}` : undefined,
        })
      }
    })

    tasks.forEach((t: any) => {
      if (!t.dueDate) return
      // Tamamlanan veya iptal edilen görevler (süreli iş veya normal)
      // takvimde gösterilmez. Silinen görevler zaten API'den `archivedAt`
      // ile filtreleniyor; bu kontrol kullanıcı bir işi "Tamamla"
      // dediğinde de takvimden anında düşmesini garanti eder.
      if (t.status === 'completed' || t.status === 'cancelled') return

      // Süreli işler ayrı tip — kırmızı duvar render'ı için
      if (t.isDeadline) {
        const eventDate = new Date(t.dueDate)
        const left = daysUntil(t.dueDate)
        items.push({
          id: t.id,
          title: t.title,
          date: eventDate,
          type: 'deadline',
          caseId: t.caseId || undefined,
          meta: t.caseTitle || undefined,
          daysLeft: left ?? undefined,
          severity: t.deadlineSeverity || undefined,
          legalBasis: t.legalBasis || undefined,
        })
        return
      }
      // Normal görev
      items.push({
        id: t.id,
        title: t.title,
        date: new Date(t.dueDate),
        type: 'task',
        caseId: t.caseId || undefined,
        meta: t.caseTitle || undefined,
      })
    })

    return items
  }, [hearings, tasks])

  // Performans: hücre başına events.filter() yerine gün anahtarına göre
  // önceden gruplandırılmış Map. Yoğun bir ayda 100+ etkinlik × 42 hücre =
  // 4000+ isSameDay çağrısını O(1) lookup'a indirgiyor.
  const eventsByDay = useMemo<Map<string, CalendarEvent[]>>(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const evt of events) {
      const key = format(evt.date, 'yyyy-MM-dd')
      const arr = map.get(key)
      if (arr) {
        arr.push(evt)
      } else {
        map.set(key, [evt])
      }
    }
    return map
  }, [events])

  // Takvim günlerini hesapla
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  function getEventsForDay(day: Date) {
    return eventsByDay.get(format(day, 'yyyy-MM-dd')) ?? []
  }

  // Seçili gün
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []

  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="page-title">Takvim</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Duruşmalar ve görevlerinizi takvimde görüntüleyin
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Takvim */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {/* Ay navigasyonu */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-semibold text-law-primary">
                {format(currentMonth, 'MMMM yyyy', { locale: tr })}
              </h2>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Hafta günleri */}
            <div className="mb-1 grid grid-cols-7 text-center">
              {weekDays.map((day) => (
                <div key={day} className="py-2 text-xs font-medium uppercase text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Günler */}
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayEvents = getEventsForDay(day)
                const inMonth = isSameMonth(day, currentMonth)
                const today = isToday(day)
                const selected = selectedDay && isSameDay(day, selectedDay)
                const hasHearing = dayEvents.some((e) => e.type === 'hearing')
                const hasTask = dayEvents.some((e) => e.type === 'task')
                const hasDeadline = dayEvents.some((e) => e.type === 'deadline')

                // KIRMIZI DUVAR: bu hücredeki en kritik süreli işin durumu
                const deadlineEvts = dayEvents.filter((e) => e.type === 'deadline')
                const minDays = deadlineEvts.length
                  ? Math.min(
                      ...deadlineEvts.map((e) =>
                        e.daysLeft === undefined ? Number.POSITIVE_INFINITY : e.daysLeft
                      )
                    )
                  : Number.POSITIVE_INFINITY

                const isCriticalCell = inMonth && minDays <= 3
                const isUpcomingCell = inMonth && minDays > 3 && minDays <= 14

                const wallClass = isCriticalCell
                  ? 'border-2 border-red-500 bg-red-50/60 dark:bg-red-900/20'
                  : isUpcomingCell
                    ? 'border-b-4 border-orange-400'
                    : ''

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex min-h-[72px] flex-col items-center border-t p-1.5 text-sm transition-colors
                      ${!inMonth ? 'text-muted-foreground/30' : ''}
                      ${selected ? 'bg-law-accent/10' : 'hover:bg-muted/50'}
                      ${today ? 'font-bold' : ''}
                      ${wallClass}
                    `}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs
                        ${today ? 'bg-law-accent text-white' : ''}
                        ${selected && !today ? 'bg-law-primary text-white' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Kırmızı duvar ünlem ikonu (sağ üst) */}
                    {isCriticalCell && (
                      <AlertOctagon
                        className="absolute right-1 top-1 h-3.5 w-3.5 fill-red-600 text-white"
                        aria-label="Kritik süreli iş"
                      />
                    )}

                    {/* Etkinlik noktaları */}
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        {hasDeadline && (
                          <span
                            className={`h-2 w-2 rounded-full ${
                              minDays <= 3 ? 'bg-red-600' : 'bg-red-400'
                            }`}
                          />
                        )}
                        {hasHearing && <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
                        {hasTask && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                      </div>
                    )}

                    {/* Kısa etkinlik listesi (masaüstü) */}
                    <div className="mt-0.5 hidden w-full space-y-0.5 lg:block">
                      {dayEvents.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          className={`truncate rounded px-1 text-[10px] leading-tight ${
                            evt.type === 'deadline'
                              ? minDays <= 3
                                ? 'bg-red-600 font-semibold text-white'
                                : 'bg-red-100 font-medium text-red-700'
                              : evt.type === 'hearing'
                                ? 'bg-purple-500/10 text-purple-500'
                                : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dayEvents.length - 2}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Renk açıklaması */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Duruşma
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Görev
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-red-600" />
                Süreli iş (3 gün ve altı)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Süreli iş (yaklaşan)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-4 border-b-2 border-orange-400" />
                4-14 gün uyarı
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sağ panel: Seçili gün detayı */}
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-law-primary">
              {selectedDay
                ? format(selectedDay, 'd MMMM yyyy, EEEE', { locale: tr })
                : 'Bir gün seçin'}
            </h3>

            {!selectedDay && (
              <p className="text-sm text-muted-foreground">
                Takvimden bir güne tıklayarak o günün etkinliklerini görüntüleyin.
              </p>
            )}

            {selectedDay && selectedEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">Bu günde etkinlik yok.</p>
            )}

            {selectedDay && selectedEvents.length > 0 && (
              <div className="space-y-3">
                {selectedEvents.map((evt) => {
                  const borderClass =
                    evt.type === 'deadline'
                      ? evt.daysLeft !== undefined && evt.daysLeft <= 3
                        ? 'border-l-4 border-l-red-600 bg-red-50/50'
                        : 'border-l-4 border-l-red-400'
                      : evt.type === 'hearing'
                        ? 'border-l-4 border-l-purple-500'
                        : 'border-l-4 border-l-amber-500'

                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        if (evt.type === 'deadline') {
                          navigate('/sureli-isler')
                        } else if (evt.caseId) {
                          navigate(`/cases/${evt.caseId}`)
                        }
                      }}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${borderClass}`}
                    >
                      <div className="flex items-center gap-2">
                        {evt.type === 'deadline' ? (
                          <AlertOctagon className="h-4 w-4 text-red-600" />
                        ) : evt.type === 'hearing' ? (
                          <CalendarClock className="h-4 w-4 text-purple-500" />
                        ) : (
                          <ListChecks className="h-4 w-4 text-amber-500" />
                        )}
                        <Badge
                          variant={
                            evt.type === 'deadline'
                              ? 'danger'
                              : evt.type === 'hearing'
                                ? 'default'
                                : 'warning'
                          }
                          className="text-[10px]"
                        >
                          {evt.type === 'deadline'
                            ? 'SÜRELİ İŞ'
                            : evt.type === 'hearing'
                              ? 'Duruşma'
                              : 'Görev'}
                        </Badge>
                        {evt.type === 'deadline' && evt.severity && (
                          <span className="text-[10px] uppercase tracking-wide text-red-700">
                            {deadlineSeverityLabels[evt.severity] || evt.severity}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium">{evt.title}</p>
                      {evt.meta && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{evt.meta}</p>
                      )}
                      {evt.type === 'deadline' && evt.legalBasis && (
                        <p className="mt-0.5 text-xs font-medium text-slate-600">
                          {evt.legalBasis}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {evt.type === 'deadline'
                          ? evt.daysLeft !== undefined
                            ? evt.daysLeft <= 0
                              ? 'BUGÜN SON GÜN'
                              : `${evt.daysLeft} gün kaldı`
                            : ''
                          : format(evt.date, 'HH:mm', { locale: tr })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
