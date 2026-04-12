import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ChevronRight,
  Clock3,
  ListChecks,
  Scale,
  Users,
} from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
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
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-white via-slate-50 to-slate-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-law-primary">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl bg-law-accent/10 p-3">
            <Icon className="h-5 w-5 text-law-accent" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Gosterge Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">Buroluk genel gorunumu hazirlaniyor</p>
        </div>
        <DashboardSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Gosterge Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">Veri cekilemedi</p>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">
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
          <h1 className="page-title">Gosterge Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dava, gorev, durusma ve tahsilat akisiniza tek ekrandan bakin.
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
            Yeni Muvekkil
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Aktif Davalar"
          value={cases?.active ?? 0}
          description="Calismasi suren ve temyiz asamasindakiler dahil"
          icon={Scale}
        />
        <StatCard
          title="Potansiyel Davalar"
          value={cases?.pending ?? 0}
          description="Pasif veya islem bekleyen dosyalar"
          icon={Clock3}
        />
        <StatCard
          title="Biten Davalar"
          value={cases?.finished ?? 0}
          description="Kazanilan, kaybedilen, uzlasilan ve kapananlar"
          icon={Scale}
        />
        <StatCard
          title="Bekleyen Gorevler"
          value={pendingTasks?.length ?? 0}
          description="Takvime alinmis acik isler"
          icon={ListChecks}
        />
        <StatCard
          title="Toplam Tahsilat"
          value={formatCurrency(financials?.totalCollections)}
          description="Tum dosyalardan tahsil edilen toplam"
          icon={Banknote}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <CalendarClock className="h-4 w-4 text-law-accent" />
                Yaklasan Durusmalar
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate('/hearings')}
                className="inline-flex items-center gap-1 text-xs font-medium text-law-accent transition hover:text-law-primary"
              >
                Tumunu gor
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {!upcomingHearings?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Yaklasan durusma bulunmuyor.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                          className="cursor-pointer transition hover:bg-slate-50"
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
                Bekleyen Gorevler
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="inline-flex items-center gap-1 text-xs font-medium text-law-accent transition hover:text-law-primary"
              >
                Tumunu gor
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {!pendingTasks?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ListChecks className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Bekleyen gorev bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task: any) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <Badge variant={priorityVariant[task.priority] || 'outline'}>
                          {taskPriorityLabels[task.priority] || task.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {task.caseTitle || 'Genel gorev'}
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
                Tumunu gor
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
                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-slate-50"
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
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <Banknote className="h-4 w-4 text-law-accent" />
              Beklenen Tahsilatlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!outstandingFees?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Banknote className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Beklenen tahsilat bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {outstandingFees.slice(0, 5).map((fee: any) => (
                  <button
                    key={fee.id}
                    type="button"
                    onClick={() => navigate(`/cases/${fee.id}`)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{fee.title}</p>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
