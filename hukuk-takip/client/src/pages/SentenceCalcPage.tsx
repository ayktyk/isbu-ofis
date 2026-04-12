import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SENTENCE_CATEGORIES, SPECIAL_CONDITIONS, RECIDIVISM_LEVELS } from '@/lib/constants/sentenceRates'

type PenaltyType = 'sureli' | 'muebbet' | 'agir_muebbet'

interface FormData {
  years: number
  months: number
  days: number
  penaltyType: PenaltyType
  crimeDate: string
  finalizationDate: string
  executionStartDate: string
  birthDate: string
  detentionDays: number
  crimeCategory: string
  recidivism: string
  specialCondition: string
}

interface CalcResult {
  appliedLaw: string
  ratio: string
  conditionalReleaseDate: Date
  supervisedProbationDays: number
  supervisedProbationStart: Date
  unconditionalReleaseDate: Date
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDuration(totalDays: number): string {
  const years = Math.floor(totalDays / 365)
  const remaining = totalDays % 365
  const months = Math.floor(remaining / 30)
  const days = remaining % 30
  const parts: string[] = []
  if (years > 0) parts.push(`${years} yil`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0) parts.push(`${days} gun`)
  return parts.length > 0 ? parts.join(' ') : '0 gun'
}

function calculate(form: FormData): CalcResult | null {
  const executionStart = new Date(form.executionStartDate)
  if (isNaN(executionStart.getTime())) return null

  if (form.penaltyType === 'muebbet') {
    const conditionalDays = 24 * 365
    const probationDays = 3 * 365
    const conditionalReleaseDate = addDays(executionStart, conditionalDays)
    const supervisedProbationStart = addDays(conditionalReleaseDate, -probationDays)
    const unconditionalReleaseDate = addDays(executionStart, 99 * 365) // symbolic
    return {
      appliedLaw: '5275 SK. m.107/2',
      ratio: 'Muebbet - 24 yil',
      conditionalReleaseDate,
      supervisedProbationDays: probationDays,
      supervisedProbationStart,
      unconditionalReleaseDate,
    }
  }

  if (form.penaltyType === 'agir_muebbet') {
    const conditionalDays = 30 * 365
    const probationDays = 3 * 365
    const conditionalReleaseDate = addDays(executionStart, conditionalDays)
    const supervisedProbationStart = addDays(conditionalReleaseDate, -probationDays)
    const unconditionalReleaseDate = addDays(executionStart, 99 * 365)
    return {
      appliedLaw: '5275 SK. m.107/1',
      ratio: 'Agirlastirilmis Muebbet - 30 yil',
      conditionalReleaseDate,
      supervisedProbationDays: probationDays,
      supervisedProbationStart,
      unconditionalReleaseDate,
    }
  }

  // Sureli ceza
  const totalDays =
    form.years * 365 + form.months * 30 + form.days - form.detentionDays

  if (totalDays <= 0) return null

  const category = SENTENCE_CATEGORIES.find((c) => c.id === form.crimeCategory)
  if (!category) return null

  let ratio = category.ratio
  let ratioLabel = category.ratioLabel

  // Tekerrur
  if (form.recidivism === '1') {
    ratio = Math.max(ratio, 2 / 3)
    if (ratio > category.ratio) {
      ratioLabel = `${category.ratioLabel} -> 2/3 (1. tekerrur)`
    }
  } else if (form.recidivism === '2') {
    ratio = 0.75
    ratioLabel = `3/4 (2. tekerrur - 7550 SK.)`
  }

  const infazDays = Math.ceil(totalDays * ratio)
  const conditionalReleaseDate = addDays(executionStart, infazDays)

  // Denetimli serbestlik: 7550 SK - en az 5 gun, toplam infaz gunlerinin %10'u
  const probationDays = Math.max(5, Math.floor(infazDays * 0.1))
  const supervisedProbationStart = addDays(conditionalReleaseDate, -probationDays)

  const unconditionalReleaseDate = addDays(executionStart, totalDays)

  return {
    appliedLaw: '5275 SK. m.107, 7550 SK., 7571 SK.',
    ratio: ratioLabel,
    conditionalReleaseDate,
    supervisedProbationDays: probationDays,
    supervisedProbationStart,
    unconditionalReleaseDate,
  }
}

function ResultItem({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? 'border-primary/20 bg-primary/5'
          : 'border-border bg-background'
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

const initialForm: FormData = {
  years: 0,
  months: 0,
  days: 0,
  penaltyType: 'sureli',
  crimeDate: '',
  finalizationDate: '',
  executionStartDate: '',
  birthDate: '',
  detentionDays: 0,
  crimeCategory: SENTENCE_CATEGORIES[0].id,
  recidivism: 'yok',
  specialCondition: 'yok',
}

export default function SentenceCalcPage() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [result, setResult] = useState<CalcResult | null>(null)

  const update = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCalculate = () => {
    const res = calculate(form)
    setResult(res)
  }

  const labelClass = 'block text-sm font-medium text-foreground mb-1'
  const inputClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div>
      <PageHeader
        title="Ceza Infaz Hesaplama"
        description="Kosullu saliverilme, denetimli serbestlik ve yatar hesabi"
      />

      <div className="inline-flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700 mb-4">
        7550 SK. &middot; 7571 SK.
      </div>

      {/* Form */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        {/* Ceza Bilgileri */}
        <fieldset>
          <legend className="text-base font-semibold mb-3">Ceza Bilgileri</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Yil</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.years}
                onChange={(e) => update('years', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>Ay</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.months}
                onChange={(e) => update('months', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>Gun</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.days}
                onChange={(e) => update('days', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {(
              [
                ['sureli', 'Sureli'],
                ['muebbet', 'Muebbet'],
                ['agir_muebbet', 'Agirlastirilmis Muebbet'],
              ] as [PenaltyType, string][]
            ).map(([val, lbl]) => (
              <label key={val} className="inline-flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="penaltyType"
                  value={val}
                  checked={form.penaltyType === val}
                  onChange={() => update('penaltyType', val)}
                  className="accent-primary"
                />
                {lbl}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Tarih Bilgileri */}
        <fieldset>
          <legend className="text-base font-semibold mb-3">Tarih Bilgileri</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Suc Tarihi</label>
              <input
                type="date"
                className={inputClass}
                value={form.crimeDate}
                onChange={(e) => update('crimeDate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Kesinlesme Tarihi</label>
              <input
                type="date"
                className={inputClass}
                value={form.finalizationDate}
                onChange={(e) => update('finalizationDate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Infaza Baslama Tarihi</label>
              <input
                type="date"
                className={inputClass}
                value={form.executionStartDate}
                onChange={(e) => update('executionStartDate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Dogum Tarihi</label>
              <input
                type="date"
                className={inputClass}
                value={form.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Suc Bilgileri */}
        <fieldset>
          <legend className="text-base font-semibold mb-3">Suc Bilgileri</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Suc Turu</label>
              <select
                className={selectClass}
                value={form.crimeCategory}
                onChange={(e) => update('crimeCategory', e.target.value)}
              >
                {SENTENCE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({cat.ratioLabel})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tekerrur</label>
              <select
                className={selectClass}
                value={form.recidivism}
                onChange={(e) => update('recidivism', e.target.value)}
              >
                {RECIDIVISM_LEVELS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Gozalti Suresi (gun)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.detentionDays}
                onChange={(e) =>
                  update('detentionDays', parseInt(e.target.value) || 0)
                }
              />
            </div>
          </div>
        </fieldset>

        {/* Hukumlu Durumu */}
        <fieldset>
          <legend className="text-base font-semibold mb-3">Hukumlu Durumu</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ozel Durum</label>
              <select
                className={selectClass}
                value={form.specialCondition}
                onChange={(e) => update('specialCondition', e.target.value)}
              >
                {SPECIAL_CONDITIONS.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <button
          onClick={handleCalculate}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Hesapla
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-lg border bg-card p-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultItem label="Uygulanan Mevzuat" value={result.appliedLaw} />
          <ResultItem label="Sartla Tahliye Orani" value={result.ratio} />
          <ResultItem
            label="Kosullu Saliverilme Tarihi"
            value={formatDate(result.conditionalReleaseDate)}
            highlight
          />
          <ResultItem
            label="Denetimli Serbestlik Suresi"
            value={formatDuration(result.supervisedProbationDays)}
          />
          <ResultItem
            label="Denetimli Serbestlik Baslangici"
            value={formatDate(result.supervisedProbationStart)}
          />
          <ResultItem
            label="Bihakkin Tahliye"
            value={formatDate(result.unconditionalReleaseDate)}
          />
        </div>
      )}
    </div>
  )
}
