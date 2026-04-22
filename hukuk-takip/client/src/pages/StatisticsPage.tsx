import {
  BarChart3,
  Briefcase,
  Banknote,
  Handshake,
  TrendingUp,
  PieChart as PieChartIcon,
  Target,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useStatistics } from '@/hooks/useStatistics'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Colors ──────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'hsl(201, 96%, 32%)',   // law-accent blue
  'hsl(38, 86%, 40%)',    // gold
  'hsl(152, 56%, 33%)',   // green
  'hsl(0, 72%, 42%)',     // red
  'hsl(262, 52%, 47%)',   // purple
  'hsl(25, 95%, 53%)',    // orange
  'hsl(199, 89%, 48%)',   // sky
  'hsl(340, 75%, 55%)',   // pink
  'hsl(158, 64%, 52%)',   // teal
  'hsl(47, 96%, 53%)',    // amber
]

const STATUS_COLORS: Record<string, string> = {
  Aktif: 'hsl(201, 96%, 32%)',
  İstinafta: 'hsl(38, 86%, 40%)',
  Yargıtayda: 'hsl(262, 52%, 47%)',
  Pasif: 'hsl(215, 16%, 47%)',
  Kazanıldı: 'hsl(152, 56%, 33%)',
  Kaybedildi: 'hsl(0, 72%, 42%)',
  Uzlaşma: 'hsl(25, 95%, 53%)',
  Kapandı: 'hsl(215, 20%, 65%)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortMonth(label: string): string {
  if (!label) return ''
  const parts = label.split(' ')
  if (parts.length < 2) return label
  const m = parts[0]
  const y = parts[1]?.slice(2)
  const short = m.length > 3 ? m.slice(0, 3) : m
  return `${short} '${y}`
}

function formatCompact(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`
  return String(val)
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, isCurrency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          {entry.name}:{' '}
          <span className="font-semibold text-foreground">
            {isCurrency ? formatCurrency(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function BigStat({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'text-law-accent',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  color?: string
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-law-primary">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`flex-shrink-0 rounded-xl bg-law-accent/10 p-2.5`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function StatisticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StatisticsPage() {
  const { data, isLoading, isError } = useStatistics()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">İstatistikler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Veriler yukleniyor...</p>
        </div>
        <StatisticsSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">İstatistikler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Veri cekilemedi.</p>
        </div>
      </div>
    )
  }

  const {
    monthlyCases,
    monthlyCollections,
    monthlyIncome,
    monthlyMediations,
    casesByType,
    casesByStatus,
    expectedCollections,
    totals,
  } = data

  // Prepare bar chart data: merge cases + mediations per month
  const monthlyBarData = (monthlyCases || []).map((mc: any, i: number) => ({
    name: shortMonth(mc.label),
    Davalar: mc.count,
    Arabuluculuk: monthlyMediations?.[i]?.count ?? 0,
  }))

  // Gelir — stacked bar (dava + arabuluculuk kırılımı)
  const incomeBarData = (monthlyIncome || monthlyCollections || []).map((mc: any) => ({
    name: shortMonth(mc.label),
    Dava: parseFloat(mc.caseAmount ?? mc.amount ?? '0') || 0,
    Arabuluculuk: parseFloat(mc.mediationAmount ?? '0') || 0,
  }))

  // Pie chart data
  const typeData = (casesByType || [])
    .filter((t: any) => t.count > 0)
    .map((t: any) => ({ name: t.label, value: t.count }))

  const statusData = (casesByStatus || [])
    .filter((s: any) => s.count > 0)
    .map((s: any) => ({ name: s.label, value: s.count }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Istatistikler</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Büro performansı ve dosya istatistikleri
        </p>
      </div>

      {/* ─── Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat
          title="Toplam Dava"
          value={totals?.totalCases ?? 0}
          subtitle="Tüm zamanlar"
          icon={Briefcase}
        />
        <BigStat
          title="Arabuluculuk"
          value={totals?.totalMediations ?? 0}
          subtitle="Toplam dosya"
          icon={Handshake}
        />
        <BigStat
          title="Toplam Tahsilat"
          value={formatCurrency(totals?.totalCollected)}
          subtitle={`Dava ${formatCurrency(totals?.totalCaseIncome)} · Arabuluculuk ${formatCurrency(totals?.totalMediationIncome)}`}
          icon={Banknote}
          color="text-emerald-600"
        />
        <BigStat
          title="Bekleyen Tahsilat"
          value={formatCurrency(totals?.totalExpected)}
          subtitle={`Tahsilat oranı: %${totals?.collectionRate?.toFixed(1) ?? '0'}`}
          icon={Target}
          color="text-amber-600"
        />
      </div>

      {/* Bu Ay */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-l-4 border-l-law-accent">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] font-medium text-muted-foreground">Bu Ay Dava Geliri</p>
            <p className="text-xl font-bold text-law-primary">{formatCurrency(totals?.thisMonthCaseIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] font-medium text-muted-foreground">Bu Ay Arabuluculuk Geliri</p>
            <p className="text-xl font-bold text-law-primary">{formatCurrency(totals?.thisMonthMediationIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] font-medium text-muted-foreground">Bu Ay Toplam</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals?.thisMonthTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts Row 1: Monthly Cases + Collections ─────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly cases + mediations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <BarChart3 className="h-4 w-4 text-law-accent" />
              Aylık Dosya Sayısı
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyBarData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Davalar" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Arabuluculuk" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Henüz veri bulunmuyor
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly income — dava + arabuluculuk stacked */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-law-primary">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Aylık Gelir
              </CardTitle>
              <div className="flex flex-wrap gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[0] }} />
                  Dava: <span className="font-semibold text-foreground">{formatCurrency(totals?.totalCaseIncome)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[1] }} />
                  Arabuluculuk: <span className="font-semibold text-foreground">{formatCurrency(totals?.totalMediationIncome)}</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {incomeBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={incomeBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatCompact}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip isCurrency />} />
                  <Bar dataKey="Dava" stackId="inc" fill={CHART_COLORS[0]} maxBarSize={40} />
                  <Bar dataKey="Arabuluculuk" stackId="inc" fill={CHART_COLORS[1]} maxBarSize={40} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Henüz tahsilat verisi yok
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts Row 2: Pie Charts ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cases by type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <PieChartIcon className="h-4 w-4 text-law-accent" />
              Dava Türleri Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {typeData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Dava verisi yok
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cases by status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <PieChartIcon className="h-4 w-4 text-law-accent" />
              Dava Durumları
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {statusData.map((s: any, i: number) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[s.name] || CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Dava verisi yok
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Expected Collections Table ────────────────────────── */}
      {expectedCollections?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-law-primary">
              <Banknote className="h-4 w-4 text-law-accent" />
              Beklenen Tahsilatlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Dava</th>
                    <th className="hidden pb-2 pr-4 sm:table-cell">Müvekkil</th>
                    <th className="pb-2 pr-4 text-right">Sözleşme</th>
                    <th className="pb-2 pr-4 text-right">Tahsil</th>
                    <th className="pb-2 text-right">Kalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expectedCollections.map((row: any) => (
                    <tr key={`${row.source || 'case'}-${row.caseId}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{row.title}</span>
                          {row.source === 'mediation' ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                              ARABULUCULUK
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="hidden py-2.5 pr-4 text-muted-foreground sm:table-cell">
                        {row.clientName || '-'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">
                        {formatCurrency(row.contractedFee)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-emerald-600 font-medium">
                        {formatCurrency(row.collected)}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-law-primary">
                        {formatCurrency(row.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
