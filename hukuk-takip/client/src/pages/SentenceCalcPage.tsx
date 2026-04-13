import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'

// ─── Types ──────────────────────────────────────────────────────────────────

type PenaltyType = 'sureli' | 'muebbet' | 'agir_muebbet'
type Tekerrur = 'yok' | '1' | '2'

interface CrimeCategory {
  id: string
  label: string
  ratio: number
  ratioLabel: string
  noDenetimliSerbestlik7456?: boolean
}

interface FormState {
  penaltyType: PenaltyType
  years: number
  months: number
  days: number
  crimeCategory: string
  crimeDate: string
  executionStartDate: string
  detentionDays: number
  isJuvenile: boolean
  birthDate: string
  tekerrur: Tekerrur
  iyiHal: boolean
}

interface CalcResult {
  toplamCezaGun: number
  mahsupGun: number
  cocukIndirimiGun: number
  netCezaGun: number
  infazOrani: string
  kosulluGun: number
  kosulluTarih: Date
  denetimliSerbestlikGun: number
  denetimliSerbestlikBaslangic: Date
  bihakkinTarih: Date
  kapaliCezaeviGun: number
  acikCezaeviTarih: Date | null
  uygulananMevzuat: string[]
  penaltyType: PenaltyType
  uyarilar: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CRIME_CATEGORIES: CrimeCategory[] = [
  { id: 'genel', label: 'Genel suçlar', ratio: 1 / 2, ratioLabel: '1/2' },
  {
    id: 'kasten_oldurme',
    label: 'Kasten öldürme (TCK 81, 82)',
    ratio: 2 / 3,
    ratioLabel: '2/3',
  },
  {
    id: 'uyusturucu',
    label: 'Uyuşturucu imal/ticareti (TCK 188)',
    ratio: 3 / 4,
    ratioLabel: '3/4',
    noDenetimliSerbestlik7456: true,
  },
  {
    id: 'cinsel',
    label: 'Cinsel suçlar (TCK 102, 103, 104)',
    ratio: 3 / 4,
    ratioLabel: '3/4',
    noDenetimliSerbestlik7456: true,
  },
  {
    id: 'teror',
    label: 'Terör suçları (TMK)',
    ratio: 3 / 4,
    ratioLabel: '3/4',
    noDenetimliSerbestlik7456: true,
  },
  {
    id: 'devlet',
    label: 'Devlete karşı suçlar (TCK 302-339)',
    ratio: 3 / 4,
    ratioLabel: '3/4',
  },
  {
    id: 'orgutlu',
    label: 'Örgütlü suçlar (TCK 314, 220)',
    ratio: 3 / 4,
    ratioLabel: '3/4',
  },
  {
    id: 'mukerrir',
    label: 'İkinci kez mükerrir (tekerrür)',
    ratio: 3 / 4,
    ratioLabel: '3/4',
  },
]

const TEKERRUR_OPTIONS = [
  { id: 'yok' as const, label: 'Yok' },
  { id: '1' as const, label: 'Birinci Tekerrür' },
  { id: '2' as const, label: 'İkinci Tekerrür (Mükerrir)' },
]

// Muebbet tekerrur adjustments (yil cinsinden)
const MUEBBET_TEKERRUR: Record<Tekerrur, number> = {
  yok: 24,
  '1': 28,
  '2': 32,
}
const AGIR_MUEBBET_TEKERRUR: Record<Tekerrur, number> = {
  yok: 30,
  '1': 34,
  '2': 36,
}

// Denetimli serbestlik cutoff dates
const DS_CUTOFF_7242 = new Date('2020-03-30') // 7242 SK
const DS_CUTOFF_7456 = new Date('2023-08-01') // 7456 SK

// ─── Helpers ────────────────────────────────────────────────────────────────

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const selectCls = inputCls
const labelCls = 'block text-sm font-medium text-foreground mb-1'
const btnCls =
  'inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50'

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

function daysToYMD(totalDays: number): string {
  if (totalDays <= 0) return '0 gun'
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

function getAgeAtDate(birthDate: Date, targetDate: Date): number {
  let age = targetDate.getFullYear() - birthDate.getFullYear()
  const monthDiff = targetDate.getMonth() - birthDate.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && targetDate.getDate() < birthDate.getDate())
  ) {
    age--
  }
  return age
}

// ─── Calculation Engine ─────────────────────────────────────────────────────

function calculate(form: FormState): CalcResult | null {
  const executionStart = new Date(form.executionStartDate)
  if (isNaN(executionStart.getTime())) return null

  const crimeDate = form.crimeDate ? new Date(form.crimeDate) : null
  const category = CRIME_CATEGORIES.find((c) => c.id === form.crimeCategory)
  if (!category) return null

  const uyarilar: string[] = []
  const mevzuat: string[] = ['5275 SK m.107']

  // ── Muebbet / Agir Muebbet ──
  if (form.penaltyType !== 'sureli') {
    const isAgir = form.penaltyType === 'agir_muebbet'
    const tekerrurMap = isAgir ? AGIR_MUEBBET_TEKERRUR : MUEBBET_TEKERRUR
    const baseYil = tekerrurMap[form.tekerrur]
    const kosulluGun = baseYil * 365 - form.detentionDays

    if (form.tekerrur !== 'yok') {
      mevzuat.push('5275 SK m.108 (tekerrur)')
    }

    // DS for muebbet
    let dsGun = 0
    if (form.iyiHal) {
      dsGun = calculateDenetimliSerbestlik(
        kosulluGun,
        crimeDate,
        category,
        mevzuat,
      )
    }

    const kosulluTarih = addDays(executionStart, kosulluGun)
    const dsBaslangic = addDays(kosulluTarih, -dsGun)
    const kapaliGun = Math.max(0, kosulluGun - dsGun)

    if (isAgir) {
      mevzuat.unshift('5275 SK m.107/1')
    } else {
      mevzuat.unshift('5275 SK m.107/2')
    }

    if (form.detentionDays > 0) {
      uyarilar.push(
        `${form.detentionDays} gun tutukluluk suresi mahsup edildi.`,
      )
    }

    return {
      toplamCezaGun: baseYil * 365,
      mahsupGun: form.detentionDays,
      cocukIndirimiGun: 0,
      netCezaGun: baseYil * 365,
      infazOrani: `${isAgir ? 'Agirlastirilmis' : ''} Muebbet - ${baseYil} yil`,
      kosulluGun,
      kosulluTarih,
      denetimliSerbestlikGun: dsGun,
      denetimliSerbestlikBaslangic: dsBaslangic,
      bihakkinTarih: addDays(executionStart, 99 * 365), // symbolic
      kapaliCezaeviGun: kapaliGun,
      acikCezaeviTarih:
        kapaliGun > 0
          ? addDays(executionStart, Math.ceil(kapaliGun / 2))
          : null,
      uygulananMevzuat: [...new Set(mevzuat)],
      penaltyType: form.penaltyType,
      uyarilar,
    }
  }

  // ── Sureli Hapis ──

  // Step 1: Total days
  const toplamGun = form.years * 365 + form.months * 30 + form.days
  if (toplamGun <= 0) return null

  // Step 2: Mahsup
  const mahsupSonrasi = toplamGun - form.detentionDays
  if (mahsupSonrasi <= 0) {
    uyarilar.push('Tutukluluk suresi ceza suresinden fazla veya esit.')
    return null
  }

  // Step 3: Juvenile reduction
  let cocukIndirimi = 0
  let netGun = mahsupSonrasi

  if (form.isJuvenile && form.birthDate && crimeDate) {
    const birth = new Date(form.birthDate)
    const age = getAgeAtDate(birth, crimeDate)
    if (age >= 12 && age < 15) {
      cocukIndirimi = Math.floor(netGun * (1 / 3))
      netGun = netGun - cocukIndirimi
      uyarilar.push(
        `Suc tarihinde ${age} yas (12-15 araligi): cezanin 2/3\'u uygulanir.`,
      )
      mevzuat.push('TCK m.31/2')
    } else if (age >= 15 && age < 18) {
      cocukIndirimi = Math.floor(netGun * (1 / 2))
      netGun = netGun - cocukIndirimi
      uyarilar.push(
        `Suc tarihinde ${age} yas (15-18 araligi): cezanin 1/2\'si uygulanir.`,
      )
      mevzuat.push('TCK m.31/3')
    } else if (age < 12) {
      uyarilar.push('12 yasindan kucuk cocuklara ceza verilemez (TCK m.31/1).')
      return null
    } else {
      uyarilar.push('Suc tarihinde 18 yas ve uzeri - cocuk indirimi uygulanmaz.')
    }
  }

  // Step 4: Infaz orani
  let oran = category.ratio
  let oranLabel = category.ratioLabel

  if (form.tekerrur === '1') {
    if (oran < 2 / 3) {
      oran = 2 / 3
      oranLabel = `2/3 (1. tekerrur)`
      mevzuat.push('5275 SK m.108')
    }
  } else if (form.tekerrur === '2') {
    oran = 3 / 4
    oranLabel = `3/4 (2. tekerrur - mukerrir)`
    mevzuat.push('5275 SK m.108')
  }

  // Step 5: Kosullu saliverilme
  let kosulluGun = Math.ceil(netGun * oran)
  // Minimum 1 yil
  if (kosulluGun < 365 && netGun >= 365) {
    kosulluGun = 365
    uyarilar.push(
      'Kosullu saliverilme suresi 1 yildan az olamaz (5275 SK m.107/2).',
    )
  }

  // Step 6: Denetimli serbestlik
  let dsGun = 0
  if (form.iyiHal) {
    dsGun = calculateDenetimliSerbestlik(kosulluGun, crimeDate, category, mevzuat)
    // DS cannot exceed total sentence
    if (dsGun > netGun) {
      dsGun = netGun
    }
    // DS cannot exceed kosullu gun
    if (dsGun > kosulluGun) {
      dsGun = kosulluGun
    }
  }

  // Step 7: Calculate dates
  const kosulluTarih = addDays(executionStart, kosulluGun)
  const dsBaslangic = addDays(kosulluTarih, -dsGun)
  const bihakkinTarih = addDays(executionStart, netGun)

  // Step 8: Kapali cezaevi
  const kapaliGun = Math.max(0, kosulluGun - dsGun)
  const acikCezaeviTarih =
    kapaliGun > 0 && form.iyiHal
      ? addDays(executionStart, Math.ceil(kapaliGun / 2))
      : null

  if (form.detentionDays > 0) {
    uyarilar.push(`${form.detentionDays} gun tutukluluk/gozalti suresi mahsup edildi.`)
  }

  return {
    toplamCezaGun: toplamGun,
    mahsupGun: form.detentionDays,
    cocukIndirimiGun: cocukIndirimi,
    netCezaGun: netGun,
    infazOrani: oranLabel,
    kosulluGun,
    kosulluTarih,
    denetimliSerbestlikGun: dsGun,
    denetimliSerbestlikBaslangic: dsBaslangic,
    bihakkinTarih,
    kapaliCezaeviGun: kapaliGun,
    acikCezaeviTarih,
    uygulananMevzuat: [...new Set(mevzuat)],
    penaltyType: form.penaltyType,
    uyarilar,
  }
}

function calculateDenetimliSerbestlik(
  kosulluGun: number,
  crimeDate: Date | null,
  category: CrimeCategory,
  mevzuat: string[],
): number {
  if (!crimeDate) {
    // Default to 3 yil if no crime date
    return Math.min(1095, kosulluGun)
  }

  // Suc tarihi 01.08.2023 ve sonrasi (7456 SK)
  if (crimeDate >= DS_CUTOFF_7456) {
    mevzuat.push('7456 SK')
    // Teror, cinsel, uyusturucu → DS uygulanmaz
    if (category.noDenetimliSerbestlik7456) {
      return 0
    }
    // DS = kosullu saliverilme suresinin 1/2'si
    let ds = Math.ceil(kosulluGun / 2)
    // Minimum 1 yil
    if (ds < 365) ds = 365
    // Genel suclarda max 3 yil
    if (category.id === 'genel' && ds > 1095) ds = 1095
    return ds
  }

  // Suc tarihi 30.03.2020 - 31.07.2023 arasi (7242 SK)
  if (crimeDate > DS_CUTOFF_7242) {
    mevzuat.push('7242 SK')
    return Math.min(1095, kosulluGun) // 3 yil
  }

  // Suc tarihi 30.03.2020 ve oncesi
  mevzuat.push('5275 SK m.105/A')
  return Math.min(1095, kosulluGun) // 3 yil, ceza suresinden fazla olamaz
}

// ─── Result Card Component ──────────────────────────────────────────────────

function ResultCard({
  label,
  value,
  highlight = false,
  sublabel,
}: {
  label: string
  value: string
  highlight?: boolean
  sublabel?: string
}) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        highlight
          ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/10'
          : 'border-border bg-background'
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  )
}

// ─── Initial Form ───────────────────────────────────────────────────────────

const initialForm: FormState = {
  penaltyType: 'sureli',
  years: 0,
  months: 0,
  days: 0,
  crimeCategory: 'genel',
  crimeDate: '',
  executionStartDate: '',
  detentionDays: 0,
  isJuvenile: false,
  birthDate: '',
  tekerrur: 'yok',
  iyiHal: true,
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SentenceCalcPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [result, setResult] = useState<CalcResult | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setHasCalculated(false)
  }

  const isSureli = form.penaltyType === 'sureli'

  const canCalculate = useMemo(() => {
    if (!form.executionStartDate) return false
    if (isSureli && form.years === 0 && form.months === 0 && form.days === 0)
      return false
    if (form.isJuvenile && !form.birthDate) return false
    return true
  }, [form, isSureli])

  const handleCalculate = () => {
    const res = calculate(form)
    setResult(res)
    setHasCalculated(true)
  }

  const handleReset = () => {
    setForm(initialForm)
    setResult(null)
    setHasCalculated(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ceza İnfaz Hesaplama"
        description="Koşullu salıverilme, denetimli serbestlik ve yatar hesabı"
      />

      {/* Uyari */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <p>
          Bu hesaplama bilgilendirme amaçlıdır, kesin sonuç için infaz savcılığına
          başvurunuz. Hesaplama 5275 SK, 7242 SK ve 7456 SK hükümlerine
          dayanmaktadır.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-lg border bg-card p-6 space-y-8">
        {/* Section 1: Ceza Turu */}
        <fieldset>
          <legend className="text-base font-semibold mb-4">Ceza Türü</legend>
          <div className="flex flex-wrap gap-6">
            {(
              [
                ['sureli', 'Süreli Hapis'],
                ['muebbet', 'Müebbet Hapis'],
                ['agir_muebbet', 'Ağırlaştırılmış Müebbet Hapis'],
              ] as [PenaltyType, string][]
            ).map(([val, lbl]) => (
              <label
                key={val}
                className="inline-flex items-center gap-2 cursor-pointer text-sm"
              >
                <input
                  type="radio"
                  name="penaltyType"
                  value={val}
                  checked={form.penaltyType === val}
                  onChange={() => update('penaltyType', val)}
                  className="accent-primary h-4 w-4"
                />
                <span className={form.penaltyType === val ? 'font-medium' : ''}>
                  {lbl}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Section 2: Ceza Suresi (only sureli) */}
        {isSureli && (
          <fieldset>
            <legend className="text-base font-semibold mb-4">
              Ceza Suresi
            </legend>
            <div className="grid grid-cols-3 gap-4 max-w-md">
              <div>
                <label className={labelCls}>Yil</label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  className={inputCls}
                  value={form.years || ''}
                  placeholder="0"
                  onChange={(e) =>
                    update('years', parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Ay</label>
                <input
                  type="number"
                  min={0}
                  max={11}
                  className={inputCls}
                  value={form.months || ''}
                  placeholder="0"
                  onChange={(e) =>
                    update('months', parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Gun</label>
                <input
                  type="number"
                  min={0}
                  max={29}
                  className={inputCls}
                  value={form.days || ''}
                  placeholder="0"
                  onChange={(e) =>
                    update('days', parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </fieldset>
        )}

        {/* Section 3: Suc Bilgileri */}
        <fieldset>
          <legend className="text-base font-semibold mb-4">Suç Bilgileri</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Suç Türü</label>
              <select
                className={selectCls}
                value={form.crimeCategory}
                onChange={(e) => update('crimeCategory', e.target.value)}
              >
                {CRIME_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({cat.ratioLabel})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tekerrür</label>
              <select
                className={selectCls}
                value={form.tekerrur}
                onChange={(e) => update('tekerrur', e.target.value as Tekerrur)}
              >
                {TEKERRUR_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Suç Tarihi</label>
              <input
                type="date"
                className={inputCls}
                value={form.crimeDate}
                onChange={(e) => update('crimeDate', e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Hangi kanunun uygulanacagini belirler
              </p>
            </div>
            <div>
              <label className={labelCls}>İnfaza Başlama Tarihi</label>
              <input
                type="date"
                className={inputCls}
                value={form.executionStartDate}
                onChange={(e) => update('executionStartDate', e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Section 4: Tutukluluk / Mahsup */}
        <fieldset>
          <legend className="text-base font-semibold mb-4">
            Tutukluluk / Gozalti
          </legend>
          <div className="max-w-xs">
            <label className={labelCls}>Tutuklu/Gozalti Suresi (gun)</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.detentionDays || ''}
              placeholder="0"
              onChange={(e) =>
                update('detentionDays', parseInt(e.target.value) || 0)
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Cezadan mahsup edilecek sure
            </p>
          </div>
        </fieldset>

        {/* Section 5: Cocuk / Yas */}
        <fieldset>
          <legend className="text-base font-semibold mb-4">
            Hukumlu Durumu
          </legend>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.isJuvenile}
                  onChange={(e) => update('isJuvenile', e.target.checked)}
                  className="accent-primary h-4 w-4"
                />
                <span>Suc tarihinde 18 yasindan kucuk (cocuk)</span>
              </label>
            </div>

            {form.isJuvenile && (
              <div className="max-w-xs">
                <label className={labelCls}>Dogum Tarihi</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.birthDate}
                  onChange={(e) => update('birthDate', e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Suc tarihindeki yasi hesaplamak icin gerekli
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.iyiHal}
                  onChange={(e) => update('iyiHal', e.target.checked)}
                  className="accent-primary h-4 w-4"
                />
                <span>Iyi hal indirimi (denetimli serbestlik icin)</span>
              </label>
            </div>
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCalculate}
            disabled={!canCalculate}
            className={btnCls}
          >
            Hesapla
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Temizle
          </button>
        </div>
      </div>

      {/* Results */}
      {hasCalculated && !result && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Hesaplama yapilamadi. Lutfen girilen degerleri kontrol edin.
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Uyarilar */}
          {result.uyarilar.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-1 dark:border-blue-900/50 dark:bg-blue-950/30">
              {result.uyarilar.map((u, i) => (
                <p
                  key={i}
                  className="text-sm text-blue-800 dark:text-blue-200"
                >
                  {u}
                </p>
              ))}
            </div>
          )}

          {/* Result Grid */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-base font-semibold mb-4">Hesaplama Sonucu</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.penaltyType === 'sureli' && (
                <>
                  <ResultCard
                    label="Toplam Ceza Süresi"
                    value={daysToYMD(result.toplamCezaGun)}
                    sublabel={`${result.toplamCezaGun} gün`}
                  />
                  {result.mahsupGun > 0 && (
                    <ResultCard
                      label="Mahsup (Tutukluluk)"
                      value={`-${daysToYMD(result.mahsupGun)}`}
                      sublabel={`${result.mahsupGun} gün düşüldü`}
                    />
                  )}
                  {result.cocukIndirimiGun > 0 && (
                    <ResultCard
                      label="Çocuk İndirimi"
                      value={`-${daysToYMD(result.cocukIndirimiGun)}`}
                      sublabel="Yaş grubuna göre indirim"
                    />
                  )}
                  <ResultCard
                    label="Net Ceza"
                    value={daysToYMD(result.netCezaGun)}
                    sublabel={`${result.netCezaGun} gun`}
                  />
                </>
              )}

              <ResultCard
                label="İnfaz Oranı"
                value={result.infazOrani}
                sublabel="Koşullu salıverilme oranı"
              />

              <ResultCard
                label="Koşullu Salıverilme Tarihi"
                value={formatDate(result.kosulluTarih)}
                highlight
                sublabel={`${result.kosulluGun} gün sonra`}
              />

              {result.denetimliSerbestlikGun > 0 ? (
                <>
                  <ResultCard
                    label="Denetimli Serbestlik Süresi"
                    value={daysToYMD(result.denetimliSerbestlikGun)}
                    sublabel={`${result.denetimliSerbestlikGun} gün`}
                  />
                  <ResultCard
                    label="Denetimli Serbestlik Başlangıcı"
                    value={formatDate(result.denetimliSerbestlikBaslangic)}
                    highlight
                  />
                </>
              ) : (
                <ResultCard
                  label="Denetimli Serbestlik"
                  value="Uygulanmaz"
                  sublabel={
                    !form.iyiHal
                      ? 'İyi hal indirimi seçilmedi'
                      : 'Suç türü nedeniyle uygulanmaz'
                  }
                />
              )}

              <ResultCard
                label="Bihakkın Tahliye Tarihi"
                value={
                  result.penaltyType !== 'sureli'
                    ? 'Ömür boyu'
                    : formatDate(result.bihakkinTarih)
                }
                sublabel={
                  result.penaltyType !== 'sureli'
                    ? 'Müebbet cezalarda cezanın tamamı'
                    : `${result.netCezaGun} gün sonra`
                }
              />

              <ResultCard
                label="Yatar Süresi (Kapalı Cezaevi)"
                value={daysToYMD(result.kapaliCezaeviGun)}
                sublabel={`${result.kapaliCezaeviGun} gün`}
              />

              {result.acikCezaeviTarih && (
                <ResultCard
                  label="Açık Cezaevine Ayrılma (tahmini)"
                  value={formatDate(result.acikCezaeviTarih)}
                  sublabel="İyi halli hükümlü için tahmini"
                />
              )}
            </div>
          </div>

          {/* Mevzuat */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Uygulanan Mevzuat</h3>
            <div className="flex flex-wrap gap-2">
              {result.uygulananMevzuat.map((m, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
