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
} from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  date: Date
  type: 'hearing' | 'task'
  caseId?: string
  meta?: string
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
      if (t.dueDate) {
        items.push({
          id: t.id,
          title: t.title,
          date: new Date(t.dueDate),
          type: 'task',
          caseId: t.caseId || undefined,
          meta: t.caseTitle || undefined,
        })
      }
    })

    return items
  }, [hearings, tasks])

  // Takvim günlerini hesapla
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(e.date, day))
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

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex min-h-[72px] flex-col items-center border-t p-1.5 text-sm transition-colors
                      ${!inMonth ? 'text-muted-foreground/30' : ''}
                      ${selected ? 'bg-law-accent/10' : 'hover:bg-muted/50'}
                      ${today ? 'font-bold' : ''}
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

                    {/* Etkinlik noktaları */}
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
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
                            evt.type === 'hearing'
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
            <div className="mt-3 flex items-center gap-4 border-t pt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Duruşma
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Görev
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
                {selectedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => evt.caseId && navigate(`/cases/${evt.caseId}`)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                      evt.type === 'hearing' ? 'border-l-4 border-l-purple-500' : 'border-l-4 border-l-amber-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {evt.type === 'hearing' ? (
                        <CalendarClock className="h-4 w-4 text-purple-500" />
                      ) : (
                        <ListChecks className="h-4 w-4 text-amber-500" />
                      )}
                      <Badge variant={evt.type === 'hearing' ? 'default' : 'warning'} className="text-[10px]">
                        {evt.type === 'hearing' ? 'Duruşma' : 'Görev'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm font-medium">{evt.title}</p>
                    {evt.meta && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{evt.meta}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(evt.date, 'HH:mm', { locale: tr })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
