import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'
import {
  Home,
  Car,
  Banknote,
  Package,
  Plus,
  Trash2,
  ChevronDown,
  Users,
  Shield,
  RotateCcw,
  Calculator,
  MapPin,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssetType = 'nakit' | 'tasinmaz' | 'arac' | 'diger'
type TasinmazType = 'arsa' | 'arazi' | 'konut' | 'isyeri' | 'tarla'

interface AssetBase {
  id: string
  type: AssetType
  value: number
  divisible: boolean
}

interface NakitAsset extends AssetBase {
  type: 'nakit'
}

interface TasinmazAsset extends AssetBase {
  type: 'tasinmaz'
  ada: string
  parsel: string
  metrekare: number
  tasinmazType: TasinmazType
}

interface AracAsset extends AssetBase {
  type: 'arac'
  plaka: string
  markaModel: string
}

interface DigerAsset extends AssetBase {
  type: 'diger'
  description: string
}

type Asset = NakitAsset | TasinmazAsset | AracAsset | DigerAsset

interface HeirState {
  spouse: boolean
  children: string[]
  mother: boolean
  father: boolean
}

interface ShareResult {
  name: string
  zumre: string
  percentage: number
  amount: number
  fraction: string
}

interface ProtectedShare {
  name: string
  legalShare: number
  legalFraction: string
  protectedRatio: string
  protectedShare: number
  protectedFraction: string
  protectedAmount: number
}

// ---------------------------------------------------------------------------
// Fraction utilities
// ---------------------------------------------------------------------------

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  return b === 0 ? a : gcd(b, a % b)
}

function toFraction(percentage: number): string {
  if (percentage === 0) return '0'
  if (percentage === 100) return '1/1'

  const precision = 1000
  let numerator = Math.round(percentage * precision)
  let denominator = 100 * precision
  const g = gcd(numerator, denominator)
  numerator /= g
  denominator /= g
  return `${numerator}/${denominator}`
}

// ---------------------------------------------------------------------------
// Unique ID helper
// ---------------------------------------------------------------------------

let _idCounter = 0
function uniqueId(): string {
  _idCounter += 1
  return `asset_${Date.now()}_${_idCounter}`
}

// ---------------------------------------------------------------------------
// Share calculation (unchanged logic, added fraction)
// ---------------------------------------------------------------------------

function calculateShares(heirs: HeirState, totalAmount: number): ShareResult[] {
  const results: ShareResult[] = []
  const hasChildren = heirs.children.length > 0
  const hasParents = heirs.mother || heirs.father
  const hasSpouse = heirs.spouse

  if (!hasSpouse && !hasChildren && !hasParents) {
    results.push({
      name: 'Hazine (Devlet)',
      zumre: '-',
      percentage: 100,
      amount: totalAmount,
      fraction: '1/1',
    })
    return results
  }

  let spouseShare = 0
  let remainingShare = 100

  if (hasSpouse) {
    if (hasChildren) {
      spouseShare = 25
    } else if (hasParents) {
      spouseShare = 50
    } else {
      spouseShare = 100
    }
    remainingShare = 100 - spouseShare
    results.push({
      name: 'Sag Kalan Es',
      zumre: hasChildren ? '1. Zumre ile' : hasParents ? '2. Zumre ile' : 'Tek basina',
      percentage: spouseShare,
      amount: (totalAmount * spouseShare) / 100,
      fraction: toFraction(spouseShare),
    })
  }

  if (hasChildren) {
    const childShare = remainingShare / heirs.children.length
    for (const child of heirs.children) {
      results.push({
        name: child,
        zumre: '1. Zumre (Altsoy)',
        percentage: childShare,
        amount: (totalAmount * childShare) / 100,
        fraction: toFraction(childShare),
      })
    }
    return results
  }

  if (hasParents) {
    if (heirs.mother && heirs.father) {
      const parentShare = remainingShare / 2
      results.push({
        name: 'Anne',
        zumre: '2. Zumre (Ana-Baba)',
        percentage: parentShare,
        amount: (totalAmount * parentShare) / 100,
        fraction: toFraction(parentShare),
      })
      results.push({
        name: 'Baba',
        zumre: '2. Zumre (Ana-Baba)',
        percentage: parentShare,
        amount: (totalAmount * parentShare) / 100,
        fraction: toFraction(parentShare),
      })
    } else if (heirs.mother) {
      results.push({
        name: 'Anne',
        zumre: '2. Zumre (Ana-Baba)',
        percentage: remainingShare,
        amount: (totalAmount * remainingShare) / 100,
        fraction: toFraction(remainingShare),
      })
    } else if (heirs.father) {
      results.push({
        name: 'Baba',
        zumre: '2. Zumre (Ana-Baba)',
        percentage: remainingShare,
        amount: (totalAmount * remainingShare) / 100,
        fraction: toFraction(remainingShare),
      })
    }
    return results
  }

  return results
}

function calculateProtectedShares(results: ShareResult[], totalAmount: number): ProtectedShare[] {
  const protectedShares: ProtectedShare[] = []

  for (const r of results) {
    if (r.name === 'Hazine (Devlet)') continue

    let protectedRatio = ''
    let protectedMultiplier = 0

    if (r.name === 'Sag Kalan Es') {
      protectedRatio = 'Yasal payin tamami'
      protectedMultiplier = 1
    } else if (r.zumre.includes('1. Zumre')) {
      protectedRatio = "Yasal payin 1/2'si"
      protectedMultiplier = 0.5
    } else if (r.name === 'Anne' || r.name === 'Baba') {
      protectedRatio = "Yasal payin 1/4'u"
      protectedMultiplier = 0.25
    }

    if (protectedMultiplier > 0) {
      const protectedPct = r.percentage * protectedMultiplier
      protectedShares.push({
        name: r.name,
        legalShare: r.percentage,
        legalFraction: r.fraction,
        protectedRatio,
        protectedShare: protectedPct,
        protectedFraction: toFraction(protectedPct),
        protectedAmount: (totalAmount * protectedPct) / 100,
      })
    }
  }

  return protectedShares
}

// ---------------------------------------------------------------------------
// Asset type labels & icons
// ---------------------------------------------------------------------------

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  nakit: 'Nakit',
  tasinmaz: 'Tasinmaz',
  arac: 'Arac',
  diger: 'Diger',
}

const TASINMAZ_TYPE_LABELS: Record<TasinmazType, string> = {
  arsa: 'Arsa',
  arazi: 'Arazi',
  konut: 'Konut',
  isyeri: 'Isyeri',
  tarla: 'Tarla',
}

function AssetIcon({ type, className }: { type: AssetType; className?: string }) {
  const cls = className ?? 'h-4 w-4'
  switch (type) {
    case 'nakit':
      return <Banknote className={cls} />
    case 'tasinmaz':
      return <Home className={cls} />
    case 'arac':
      return <Car className={cls} />
    case 'diger':
      return <Package className={cls} />
  }
}

// ---------------------------------------------------------------------------
// Component: Asset Form (inline creation)
// ---------------------------------------------------------------------------

function AssetForm({
  type,
  onAdd,
  onCancel,
}: {
  type: AssetType
  onAdd: (asset: Asset) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState<number>(0)
  const [divisible, setDivisible] = useState(true)

  // tasinmaz
  const [ada, setAda] = useState('')
  const [parsel, setParsel] = useState('')
  const [metrekare, setMetrekare] = useState<number>(0)
  const [tasinmazType, setTasinmazType] = useState<TasinmazType>('konut')

  // arac
  const [plaka, setPlaka] = useState('')
  const [markaModel, setMarkaModel] = useState('')

  // diger
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    if (value <= 0) return

    const base = { id: uniqueId(), value, divisible }

    switch (type) {
      case 'nakit':
        onAdd({ ...base, type: 'nakit' })
        break
      case 'tasinmaz':
        if (!ada || !parsel) return
        onAdd({ ...base, type: 'tasinmaz', ada, parsel, metrekare, tasinmazType })
        break
      case 'arac':
        if (!plaka) return
        onAdd({ ...base, type: 'arac', plaka, markaModel })
        break
      case 'diger':
        if (!description.trim()) return
        onAdd({ ...base, type: 'diger', description: description.trim() })
        break
    }
  }

  const inputCls =
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AssetIcon type={type} />
          <span>{ASSET_TYPE_LABELS[type]} Ekle</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Type-specific fields */}
        {type === 'tasinmaz' && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ada No</label>
              <input
                className={inputCls}
                placeholder="Ornek: 123"
                value={ada}
                onChange={(e) => setAda(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Parsel No</label>
              <input
                className={inputCls}
                placeholder="Ornek: 5"
                value={parsel}
                onChange={(e) => setParsel(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tur</label>
              <select
                className={inputCls}
                value={tasinmazType}
                onChange={(e) => setTasinmazType(e.target.value as TasinmazType)}
              >
                {(Object.keys(TASINMAZ_TYPE_LABELS) as TasinmazType[]).map((t) => (
                  <option key={t} value={t}>
                    {TASINMAZ_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Metrekare (m2)</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="120"
                value={metrekare || ''}
                onChange={(e) => setMetrekare(Number(e.target.value))}
              />
            </div>
          </>
        )}

        {type === 'arac' && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Plaka</label>
              <input
                className={inputCls}
                placeholder="34 ABC 123"
                value={plaka}
                onChange={(e) => setPlaka(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Marka / Model</label>
              <input
                className={inputCls}
                placeholder="BMW 320i"
                value={markaModel}
                onChange={(e) => setMarkaModel(e.target.value)}
              />
            </div>
          </>
        )}

        {type === 'diger' && (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Aciklama</label>
            <input
              className={inputCls}
              placeholder="Ornek: Altin, hisse senedi, vb."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {/* Value - common */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tahmini Deger (TL)</label>
          <input
            type="number"
            min={0}
            className={inputCls}
            placeholder="0"
            value={value || ''}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>

        {/* Divisible toggle */}
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={divisible}
              onChange={(e) => setDivisible(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-primary"
            />
            Bolunebilir
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Ekle
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component: Asset Card
// ---------------------------------------------------------------------------

function AssetCard({ asset, onRemove }: { asset: Asset; onRemove: () => void }) {
  const label = (key: string, val: string | number) => (
    <span className="text-xs text-muted-foreground">
      {key}: <span className="font-medium text-foreground">{val}</span>
    </span>
  )

  return (
    <div className="relative rounded-lg border bg-background p-3 pr-9 space-y-1">
      <div className="flex items-center gap-2">
        <AssetIcon type={asset.type} className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{ASSET_TYPE_LABELS[asset.type]}</span>
        {!asset.divisible && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">
            Bolunemez
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {asset.type === 'tasinmaz' && (
          <>
            {label('Ada', asset.ada)}
            {label('Parsel', asset.parsel)}
            {label('Tur', TASINMAZ_TYPE_LABELS[asset.tasinmazType])}
            {asset.metrekare > 0 && label('m2', asset.metrekare)}
          </>
        )}
        {asset.type === 'arac' && (
          <>
            {label('Plaka', asset.plaka)}
            {asset.markaModel && label('Model', asset.markaModel)}
          </>
        )}
        {asset.type === 'diger' && label('Aciklama', asset.description)}
        {label('Deger', formatCurrency(asset.value))}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        aria-label="Varligi kaldir"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component: Property Detail Table
// ---------------------------------------------------------------------------

function PropertyDetailTable({
  asset,
  shares,
}: {
  asset: TasinmazAsset
  shares: ShareResult[]
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary" />
        <span>
          Ada {asset.ada} Parsel {asset.parsel}
        </span>
        <span className="text-muted-foreground">
          — {TASINMAZ_TYPE_LABELS[asset.tasinmazType]}
          {asset.metrekare > 0 && ` — ${asset.metrekare} m2`} — Deger:{' '}
          {formatCurrency(asset.value)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium">Mirasci</th>
              <th className="text-center py-2 px-3 font-medium">Hisse</th>
              {asset.metrekare > 0 && (
                <th className="text-right py-2 px-3 font-medium">m2 Karsiligi</th>
              )}
              <th className="text-right py-2 px-3 font-medium">Deger Karsiligi</th>
            </tr>
          </thead>
          <tbody>
            {shares.map((s, i) => (
              <tr key={i} className="border-b last:border-b-0 hover:bg-muted/50">
                <td className="py-2 px-3">{s.name}</td>
                <td className="py-2 px-3 text-center font-mono text-primary font-medium">
                  {s.fraction}
                </td>
                {asset.metrekare > 0 && (
                  <td className="py-2 px-3 text-right font-mono">
                    {((asset.metrekare * s.percentage) / 100).toFixed(1)} m2
                  </td>
                )}
                <td className="py-2 px-3 text-right font-mono">
                  {formatCurrency((asset.value * s.percentage) / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InheritancePage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [heirs, setHeirs] = useState<HeirState>({
    spouse: false,
    children: [],
    mother: false,
    father: false,
  })
  const [results, setResults] = useState<ShareResult[] | null>(null)
  const [showProtected, setShowProtected] = useState(false)
  const [protectedShares, setProtectedShares] = useState<ProtectedShare[]>([])
  const [addingType, setAddingType] = useState<AssetType | null>(null)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)

  // Computed total
  const totalEstateValue = useMemo(() => assets.reduce((s, a) => s + a.value, 0), [assets])
  const totalCash = useMemo(
    () => assets.filter((a) => a.type === 'nakit').reduce((s, a) => s + a.value, 0),
    [assets]
  )
  const tasinmazAssets = useMemo(
    () => assets.filter((a): a is TasinmazAsset => a.type === 'tasinmaz'),
    [assets]
  )

  // Heir management
  const addSpouse = () => {
    if (!heirs.spouse) setHeirs((h) => ({ ...h, spouse: true }))
  }

  const addChild = () => {
    const name = prompt('Cocugun adini girin:')
    if (name && name.trim()) {
      setHeirs((h) => ({ ...h, children: [...h.children, name.trim()] }))
    }
  }

  const removeChild = (index: number) => {
    setHeirs((h) => ({ ...h, children: h.children.filter((_, i) => i !== index) }))
  }

  // Asset management
  const addAsset = (asset: Asset) => {
    setAssets((prev) => [...prev, asset])
    setAddingType(null)
  }

  const removeAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  // Calculation
  const handleCalculate = () => {
    if (totalEstateValue <= 0) return
    const shareResults = calculateShares(heirs, totalEstateValue)
    setResults(shareResults)
    setProtectedShares(calculateProtectedShares(shareResults, totalEstateValue))
  }

  const handleReset = () => {
    setAssets([])
    setHeirs({ spouse: false, children: [], mother: false, father: false })
    setResults(null)
    setShowProtected(false)
    setProtectedShares([])
    setAddingType(null)
  }

  const handleShowProtected = () => {
    if (!results) {
      handleCalculate()
    }
    setShowProtected(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Miras Payi Hesaplama"
        description="TMK'ya gore kanuni ve sakli miras payi hesaplama — nakit, tasinmaz, arac ve diger varliklar"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Tereke Varliklari */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Tereke Varliklari
          </h3>

          {/* Toplam */}
          {assets.length > 0 && (
            <div className="text-sm">
              Toplam Tereke:{' '}
              <span className="font-semibold text-primary">{formatCurrency(totalEstateValue)}</span>
            </div>
          )}
        </div>

        {/* Asset cards */}
        {assets.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onRemove={() => removeAsset(asset.id)} />
            ))}
          </div>
        )}

        {assets.length === 0 && !addingType && (
          <p className="text-sm text-muted-foreground py-2">
            Henuz varlik eklenmedi. Asagidaki butonla terekeye varlik ekleyin.
          </p>
        )}

        {/* Inline form */}
        {addingType && (
          <AssetForm
            type={addingType}
            onAdd={addAsset}
            onCancel={() => setAddingType(null)}
          />
        )}

        {/* Add button with dropdown */}
        {!addingType && (
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowTypeDropdown((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/50 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Varlik Ekle
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showTypeDropdown && (
              <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-md border bg-background shadow-md py-1">
                {(
                  [
                    { type: 'nakit' as const, icon: Banknote, label: 'Nakit' },
                    { type: 'tasinmaz' as const, icon: Home, label: 'Tasinmaz (Gayrimenkul)' },
                    { type: 'arac' as const, icon: Car, label: 'Arac' },
                    { type: 'diger' as const, icon: Package, label: 'Diger Varlik' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setAddingType(item.type)
                      setShowTypeDropdown(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Mirascilar */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Mirascilar
        </h3>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addSpouse}
            disabled={heirs.spouse}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Es Ekle
          </button>
          <button
            type="button"
            onClick={addChild}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/10 transition-colors"
          >
            Cocuk Ekle
          </button>
          <button
            type="button"
            onClick={() => setHeirs((h) => ({ ...h, mother: true }))}
            disabled={heirs.mother}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anne Ekle
          </button>
          <button
            type="button"
            onClick={() => setHeirs((h) => ({ ...h, father: true }))}
            disabled={heirs.father}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Baba Ekle
          </button>
        </div>

        {/* Eklenen mirascilar */}
        {(heirs.spouse || heirs.children.length > 0 || heirs.mother || heirs.father) && (
          <div className="flex flex-wrap gap-3">
            {heirs.spouse && (
              <div className="relative rounded-lg border p-3 pr-8 flex items-center gap-2 bg-background">
                <span className="text-sm font-medium">Sag Kalan Es</span>
                <button
                  type="button"
                  onClick={() => setHeirs((h) => ({ ...h, spouse: false }))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                  aria-label="Esi kaldir"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {heirs.children.map((child, i) => (
              <div
                key={`child-${i}`}
                className="relative rounded-lg border p-3 pr-8 flex items-center gap-2 bg-background"
              >
                <span className="text-sm font-medium">{child}</span>
                <button
                  type="button"
                  onClick={() => removeChild(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                  aria-label={`${child} kaldir`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {heirs.mother && (
              <div className="relative rounded-lg border p-3 pr-8 flex items-center gap-2 bg-background">
                <span className="text-sm font-medium">Anne</span>
                <button
                  type="button"
                  onClick={() => setHeirs((h) => ({ ...h, mother: false }))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                  aria-label="Anneyi kaldir"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {heirs.father && (
              <div className="relative rounded-lg border p-3 pr-8 flex items-center gap-2 bg-background">
                <span className="text-sm font-medium">Baba</span>
                <button
                  type="button"
                  onClick={() => setHeirs((h) => ({ ...h, father: false }))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                  aria-label="Babayi kaldir"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Action Buttons */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCalculate}
          disabled={totalEstateValue <= 0}
          className="inline-flex items-center gap-1.5 justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Calculator className="h-4 w-4" />
          Hesapla
        </button>
        <button
          type="button"
          onClick={handleShowProtected}
          disabled={totalEstateValue <= 0}
          className="inline-flex items-center gap-1.5 justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Shield className="h-4 w-4" />
          Sakli Pay Goster
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Sifirla
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Results Table */}
      {/* ------------------------------------------------------------------ */}
      {results && results.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-6">
          <h3 className="text-lg font-semibold">Miras Paylari</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Mirasci</th>
                  <th className="text-left py-3 px-4 font-medium">Zumre</th>
                  <th className="text-center py-3 px-4 font-medium">Pay (Kesir)</th>
                  <th className="text-right py-3 px-4 font-medium">Pay (%)</th>
                  {totalCash > 0 && (
                    <th className="text-right py-3 px-4 font-medium">Nakit (TL)</th>
                  )}
                  {tasinmazAssets.length > 0 && (
                    <th className="text-left py-3 px-4 font-medium">Tasinmaz Paylari</th>
                  )}
                  <th className="text-right py-3 px-4 font-medium">Toplam Deger (TL)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b last:border-b-0 hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{r.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{r.zumre}</td>
                    <td className="py-3 px-4 text-center font-mono text-primary font-semibold">
                      {r.fraction}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">%{r.percentage.toFixed(2)}</td>
                    {totalCash > 0 && (
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency((totalCash * r.percentage) / 100)}
                      </td>
                    )}
                    {tasinmazAssets.length > 0 && (
                      <td className="py-3 px-4 text-xs">
                        {tasinmazAssets.map((t) => (
                          <div key={t.id} className="whitespace-nowrap">
                            Ada {t.ada} P.{t.parsel}: {r.fraction} hisse
                          </div>
                        ))}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {formatCurrency(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-3 px-4" colSpan={2}>
                    Toplam
                  </td>
                  <td className="py-3 px-4 text-center font-mono">1/1</td>
                  <td className="py-3 px-4 text-right font-mono">
                    %{results.reduce((s, r) => s + r.percentage, 0).toFixed(2)}
                  </td>
                  {totalCash > 0 && (
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCurrency(totalCash)}
                    </td>
                  )}
                  {tasinmazAssets.length > 0 && <td className="py-3 px-4" />}
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(totalEstateValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Asset summary */}
          {assets.length > 1 && (
            <div className="grid gap-2 sm:grid-cols-4 text-sm">
              {[
                { label: 'Nakit', val: totalCash },
                {
                  label: 'Tasinmaz',
                  val: tasinmazAssets.reduce((s, a) => s + a.value, 0),
                },
                {
                  label: 'Arac',
                  val: assets.filter((a) => a.type === 'arac').reduce((s, a) => s + a.value, 0),
                },
                {
                  label: 'Diger',
                  val: assets.filter((a) => a.type === 'diger').reduce((s, a) => s + a.value, 0),
                },
              ]
                .filter((item) => item.val > 0)
                .map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border p-3 flex items-center justify-between"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono font-medium">{formatCurrency(item.val)}</span>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <strong>Dayanak:</strong> TMK m.499-506 (Kanuni miras paylari ve zumre sistemi). Bu
            hesaplama bilgilendirme amaclidir, hukuki danismanlik niteliginde degildir.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Property Detail Tables */}
      {/* ------------------------------------------------------------------ */}
      {results && results.length > 0 && tasinmazAssets.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Tasinmaz Detay Tablosu
          </h3>
          {tasinmazAssets.map((asset) => (
            <PropertyDetailTable key={asset.id} asset={asset} shares={results} />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Protected Share Modal */}
      {/* ------------------------------------------------------------------ */}
      {showProtected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowProtected(false)}
        >
          <div
            className="bg-background rounded-lg border shadow-lg w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sakli Paylar (TMK m.506)
              </h3>
              <button
                type="button"
                onClick={() => setShowProtected(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {protectedShares.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Mirasci</th>
                          <th className="text-center py-3 px-4 font-medium">Yasal Pay</th>
                          <th className="text-left py-3 px-4 font-medium">Sakli Pay Orani</th>
                          <th className="text-center py-3 px-4 font-medium">Sakli Pay</th>
                          <th className="text-right py-3 px-4 font-medium">Tutar (TL)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {protectedShares.map((p, i) => (
                          <tr key={i} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{p.name}</td>
                            <td className="py-3 px-4 text-center font-mono">
                              <span className="text-primary font-semibold">{p.legalFraction}</span>
                              <span className="text-muted-foreground ml-1">
                                (%{p.legalShare.toFixed(2)})
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{p.protectedRatio}</td>
                            <td className="py-3 px-4 text-center font-mono">
                              <span className="text-primary font-semibold">
                                {p.protectedFraction}
                              </span>
                              <span className="text-muted-foreground ml-1">
                                (%{p.protectedShare.toFixed(2)})
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {formatCurrency(p.protectedAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td className="py-3 px-4" colSpan={3}>
                            Toplam Sakli Pay
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {toFraction(
                              protectedShares.reduce((s, p) => s + p.protectedShare, 0)
                            )}
                            <span className="text-muted-foreground ml-1 font-normal">
                              (%
                              {protectedShares
                                .reduce((s, p) => s + p.protectedShare, 0)
                                .toFixed(2)}
                              )
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatCurrency(
                              protectedShares.reduce((s, p) => s + p.protectedAmount, 0)
                            )}
                          </td>
                        </tr>
                        <tr className="font-semibold text-muted-foreground">
                          <td className="py-3 px-4" colSpan={3}>
                            Tasarruf Edilebilir Kisim
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {toFraction(
                              100 - protectedShares.reduce((s, p) => s + p.protectedShare, 0)
                            )}
                            <span className="ml-1 font-normal">
                              (%
                              {(
                                100 - protectedShares.reduce((s, p) => s + p.protectedShare, 0)
                              ).toFixed(2)}
                              )
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatCurrency(
                              totalEstateValue -
                                protectedShares.reduce((s, p) => s + p.protectedAmount, 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Per-asset protected share breakdown */}
                  {assets.length > 1 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        Varlik Bazinda Sakli Pay Dagilimi
                      </h4>
                      <div className="grid gap-2">
                        {assets.map((asset) => (
                          <div key={asset.id} className="rounded-md border p-3 text-xs">
                            <div className="flex items-center gap-2 mb-2 font-medium text-sm">
                              <AssetIcon type={asset.type} className="h-3.5 w-3.5" />
                              {asset.type === 'tasinmaz'
                                ? `Ada ${(asset as TasinmazAsset).ada} P.${(asset as TasinmazAsset).parsel}`
                                : asset.type === 'arac'
                                  ? `${(asset as AracAsset).plaka}`
                                  : asset.type === 'diger'
                                    ? (asset as DigerAsset).description
                                    : 'Nakit'}
                              <span className="text-muted-foreground font-normal ml-auto">
                                {formatCurrency(asset.value)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {protectedShares.map((p) => (
                                <span key={p.name}>
                                  {p.name}:{' '}
                                  <span className="font-mono font-medium">
                                    {formatCurrency((asset.value * p.protectedShare) / 100)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Sakli pay hesaplamasi icin mirasci eklenmeli ve hesaplama yapilmalidir.
                </p>
              )}

              <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <strong>Dayanak:</strong> TMK m.506 - Sakli pay oranlari. Altsoy: yasal payin
                1/2'si; ana-baba: yasal payin 1/4'u; sag kalan es: yasal payin tamami.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
