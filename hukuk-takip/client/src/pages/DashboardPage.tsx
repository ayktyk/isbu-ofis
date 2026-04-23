import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ChevronRight,
  Clock3,
  ListChecks,
  MessageSquare,
  PhoneCall,
  Scale,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useStatistics } from '@/hooks/useStatistics'
import { useConsultationStats } from '@/hooks/useConsultations'
import {
  caseStatusLabels,
  caseTypeLabels,
  formatCurrency,
  formatDate,
  formatRelativeDate,
  isOverdue,
  taskPriorityLabels,
} from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const priorityVariant: Record<string, 'danger' | 'warning' | 'secondary' | 'outline'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string | number
  description: string
  icon: React.ElementType
}) {
  return (
    <Card className="overflow-hidden bg-card shadow-sm">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0 space-y-1 sm:space-y-2">
            <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-[13px]">{title}</p>
            <p className="text-xl font-semibold tracking-tight text-law-primary sm:text-3xl">{value}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">{description}</p>
          </div>
          <div className="flex-shrink-0 rounded-xl bg-law-accent/10 p-2 sm:rounded-2xl sm:p-3">
            <Icon className="h-4 w-4 text-law-accent sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OutstandingStatCard({
  total,
  cases,
  mediations,
}: {
  total: string
  cases: string
  mediations: string
}) {
  const totalNum = parseFloat(total || '0')
  const caseNum = parseFloat(cases || '0')
  const medNum = parseFloat(mediations || '0')
  return (
    <Card className="overflow-hidden bg-card shadow-sm ring-1 ring-[hsl(var(--gold))]/30">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0 space-y-1 sm:space-y-2">
            <p className="truncate text-[11px] font-medium text-[hsl(var(--gold))] sm:text-[13px]">
              Bekleyen Tahsilat
            </p>
            <p className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {formatCurrency(totalNum)}
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Dava {formatCurrency(caseNum)} · Arabuluculuk {formatCurrency(medNum)}
            </p>
          </div>
          <div className="flex-shrink-0 rounded-xl bg-[hsl(var(--gold))]/15 p-2 sm:rounded-2xl sm:p-3">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--gold))] sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-2xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useDashboard()
  const { data: stats } = useStatistics()
  const { data: consultStats } = useConsultationStats()

  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthCases = stats?.monthlyCases?.find((m: any) => m.month === currentMonth)?.count ?? 0
  const thisMonthMediations = stats?.monthlyMediations?.find((m: any) => m.month === currentMonth)?.count ?? 0
  const thisMonthIncomeRow = stats?.monthlyIncome?.find((m: any) => m.month === currentMonth)
  const thisMonthCaseIncome = thisMonthIncomeRow?.caseAmount ?? '0'
  const thisMonthMediationIncome = thisMonthIncomeRow?.mediationAmount ?? '0'
  const thisMonthCollections = thisMonthIncomeRow?.total ?? stats?.monthlyCollections?.find((m: any) => m.month === currentMonth)?.amount ?? '0'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Gösterge Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">Büroluk genel görünümü hazırlanıyor</p>
        </div>
        <DashboardSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Gösterge Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">Veri cekilemedi</p>
        </div>
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              Veriler yuklenirken hata olustu. Lutfen sayfayi yenileyin.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { cases, upcomingHearings, pendingTasks, recentCases, financials, outstandingFees } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Gösterge Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dava, görev, duruşma ve tahsilat akışınıza tek ekrandan bakın.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/cases/new')}
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted/50"
          >
            <Scale className="h-4 w-4 text-law-accent" />
            Yeni Dava
          </button>
          <button
            type="button"
            onClick={() => navigate('/clients/new')}
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted/50"
          >
            <Users className="h-4 w-4 text-law-accent" />
            Yeni Müvekkil
          </button>
          <button
            type="button"
            onClick={() => navigate('/consultations')}
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted/50"
          >
            <MessageSquare className="h-4 w-4 text-law-accent" />
            Yeni Görüşme
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard
          title="Aktif Davalar"
          value={cases?.active ?? 0}
          description="Çalışması süren ve temyiz aşamasındakiler dahil"
          icon={Scale}
        />
        <StatCard
          title="Potansiyel Davalar"
          value={cases?.pending ?? 0}
          description="Pasif dosyalar + potansiyel görüşmeler"
          icon={Clock3}
        />
        <StatCard
          title="Bekleyen Görevler"
          value={pendingTasks?.length ?? 0}
          description="Takvime alınmış açık işler"
          icon={ListChecks}
        />
        <StatCard
          title="Toplam Tahsilat"
          value={formatCurrency(financials?.totalCollections)}
          description="Dava + arabuluculuk tüm tahsilatlar"
          icon={Banknote}
        />
        <OutstandingStatCard
          total={financials?.outstandingTotal || '0'}
          cases={financials?.outstandingByCases || '0'}
          mediations={financials?.outstandingByMediations || '0'}
        />
      </div>

      {/* Bu Ay Özeti */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-l-4 border-l-law-accent">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] font-medium text-muted-foreground">Bu Ay Dava</p>
            <p className="text-xl font-bold text-law-primary">{thisMonthCases}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] font-medium text-muted-foreground">Bu Ay Arabuluculuk</p>
            <p className="text-xl font-bold text-law-primary">{thisMonthMediations}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">Bu Ay Tahsilat</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(thisMonthCollections)}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>Dava: <span className="font-medium text-foreground">{formatCurrency(thisMonthCaseIncome)}</span></span>
              <span>Arabuluculuk: <span className="font-medium text-foreground">{formatCurrency(thisMonthMediationIncome)}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ön Görüşmeler Özeti */}
      <Card className="border-l-4 border-l-law-accent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <PhoneCall className="h-4 w-4 text-law-accent" />
              Ön Görüşmeler
            </CardTitle>
            <button
              type="button"
              onClick={() => navigate('/consultations')}
              className="inline-flex items-center gap-1 text-xs font-medium text-law-accent transition hover:text-law-primary"
            >
              Detay
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Bugün</p>
              <p className="text-lg font-bold text-law-primary">
                {consultStats?.today ?? 0}
                <span className="text-xs text-muted-foreground">/{consultStats?.dailyGoal ?? 1}</span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-law-accent transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(((consultStats?.today ?? 0) / (consultStats?.dailyGoal || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Bu Hafta</p>
              <p className="text-lg font-bold text-law-primary">
                {consultStats?.week ?? 0}
                <span className="text-xs text-muted-foreground">/{consultStats?.weeklyGoal ?? 5}</span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    (consultStats?.week ?? 0) >= (consultStats?.weeklyGoal ?? 5) ? 'bg-emerald-500' : 'bg-law-accent'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round(((consultStats?.week ?? 0) / (consultStats?.weeklyGoal || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Bu Ay</p>
              <p className="text-lg font-bold text-law-primary">
                {consultStats?.month ?? 0}
                <span className="text-xs text-muted-foreground">/{consultStats?.monthlyGoal ?? 20}</span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    (consultStats?.month ?? 0) >= (consultStats?.monthlyGoal ?? 20) ? 'bg-emerald-500' : 'bg-law-accent'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round(((consultStats?.month ?? 0) / (consultStats?.monthlyGoal || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Dönüşüm
              </p>
              <p className="text-lg font-bold text-emerald-600">{consultStats?.conversionRate ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground">
                {consultStats?.converted ?? 0} müvekkil oldu
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/consultations')}
              className="inline-flex items-center gap-1 rounded-lg bg-law-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Yeni Görüşme
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <CalendarClock className="h-4 w-4 text-law-accent" />
                Yaklaşan Duruşmalar
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate('/hearings')}
                className="inline-flex items-center gap-1 text-xs font-medium text-law-accent transition hover:text-law-primary"
              >
                Tümünü gör
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {!upcomingHearings?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Yaklaşan duruşma bulunmuyor.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <th className="pb-2 pr-4">Tarih</th>
                      <th className="pb-2 pr-4">Dava</th>
                      <th className="hidden pb-2 pr-4 md:table-cell">Mahkeme</th>
                      <th className="pb-2">Salon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {upcomingHearings.slice(0, 5).map((hearing: any) => {
                      const overdue = isOverdue(hearing.hearingDate)
                      return (
                        <tr
                          key={hearing.id}
                          onClick={() => navigate(`/cases/${hearing.caseId}`)}
                          className="cursor-pointer transition hover:bg-muted/50"
                        >
                          <td className="py-3 pr-4">
                            <div>
                              <p className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
                                {formatDate(hearing.hearingDate)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeDate(hearing.hearingDate)}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <p className="font-medium">{hearing.caseTitle}</p>
                            <p className="text-xs text-muted-foreground">{hearing.clientName || '-'}</p>
                          </td>
                          <td className="hidden py-3 pr-4 md:table-cell text-muted-foreground">
                            {hearing.courtName || '-'}
                          </td>
                          <td className="py-3">
                            <Badge variant="outline">{hearing.courtRoom || '-'}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <ListChecks className="h-4 w-4 text-law-accent" />
                Bekleyen Görevler
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="inline-flex items-center gap-1 text-xs font-medium text-law-accent transition hover:text-law-primary"
              >
                Tümünü gör
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {!pendingTasks?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ListChecks className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Bekleyen görev bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task: any) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <Badge variant={priorityVariant[task.priority] || 'outline'}>
                          {taskPriorityLabels[task.priority] || task.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {task.caseTitle || 'Genel görev'}
                      </p>
                    </div>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(task.dueDate)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <Scale className="h-4 w-4 text-law-accent" />
                Son Eklenen Davalar
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate('/cases')}
                className="inline-flex items-center gap-1 text-xs font-medium text-law-accent transition hover:text-law-primary"
              >
                Tümünü gör
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {!recentCases?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Scale className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Dava bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCases.slice(0, 5).map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/cases/${item.id}`)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.clientName || '-'} • {caseTypeLabels[item.caseType] || item.caseType}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary">
                        {caseStatusLabels[item.status] || item.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <Banknote className="h-4 w-4 text-law-accent" />
                Beklenen Tahsilatlar
              </CardTitle>
              {financials?.outstandingTotal && parseFloat(financials.outstandingTotal) > 0 ? (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Toplam</p>
                  <p className="text-sm font-semibold text-amber-700">
                    {formatCurrency(financials.outstandingTotal)}
                  </p>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!outstandingFees?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Banknote className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Beklenen tahsilat bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {outstandingFees.slice(0, 5).map((fee: any) => {
                  const isMediation = fee.source === 'mediation'
                  return (
                    <button
                      key={`${fee.source || 'case'}-${fee.id}`}
                      type="button"
                      onClick={() =>
                        navigate(isMediation ? `/tools/mediation-files` : `/cases/${fee.id}`)
                      }
                      className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium">{fee.title}</p>
                          {isMediation ? (
                            <Badge variant="outline" className="text-[9px]">
                              Arabuluculuk
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{fee.clientName || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-law-primary">
                          {formatCurrency(fee.remaining)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Toplam: {formatCurrency(fee.contractedFee)}
                        </p>
                      </div>
                    </button>
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
