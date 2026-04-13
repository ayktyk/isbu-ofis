import { useState, useMemo, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'
import {
  Users,
  Plus,
  Trash2,
  Calculator,
  Info,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Scale,
  Shield,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Child {
  id: string
  name: string
  alive: boolean
  hasChildren: boolean
  grandchildren: Grandchild[]
}

interface Grandchild {
  id: string
  name: string
}

interface ParentSide {
  alive: boolean
  descendants: SiblingOrDescendant[]
}

interface SiblingOrDescendant {
  id: string
  name: string
  alive: boolean
  children: NephewNiece[]
}

interface NephewNiece {
  id: string
  name: string
}

interface GrandparentPerson {
  alive: boolean
  descendants: AuntUncle[]
}

interface AuntUncle {
  id: string
  name: string
  alive: boolean
  children: Cousin[]
}

interface Cousin {
  id: string
  name: string
}

interface GrandparentSide {
  grandmother: GrandparentPerson
  grandfather: GrandparentPerson
}

interface FormState {
  deceasedName: string
  estateValue: number
  debts: number
  hasSpouse: boolean
  children: Child[]
  mother: ParentSide
  father: ParentSide
  maternalGrandparents: GrandparentSide
  paternalGrandparents: GrandparentSide
}

interface ShareResult {
  name: string
  zumre: string
  percentage: number
  fraction: string
  amount: number
}

interface ProtectedShareResult {
  name: string
  legalFraction: string
  legalAmount: number
  protectedRatio: string
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

function toFraction(numerator: number, denominator: number): string {
  if (numerator === 0) return '0'
  if (denominator === 0) return '0'
  const g = gcd(Math.round(numerator), Math.round(denominator))
  const n = Math.round(numerator) / g
  const d = Math.round(denominator) / g
  if (d === 1) return `${n}`
  return `${n}/${d}`
}

function percentageToFraction(pct: number): string {
  if (pct === 0) return '0'
  if (pct === 100) return '1/1'
  const precision = 10000
  const num = Math.round(pct * precision)
  const den = 100 * precision
  return toFraction(num, den)
}

// ---------------------------------------------------------------------------
// Unique ID helper
// ---------------------------------------------------------------------------

let _idCounter = 0
function uid(): string {
  _idCounter += 1
  return `heir_${Date.now()}_${_idCounter}`
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

function createInitialState(): FormState {
  return {
    deceasedName: '',
    estateValue: 0,
    debts: 0,
    hasSpouse: false,
    children: [],
    mother: { alive: false, descendants: [] },
    father: { alive: false, descendants: [] },
    maternalGrandparents: {
      grandmother: { alive: false, descendants: [] },
      grandfather: { alive: false, descendants: [] },
    },
    paternalGrandparents: {
      grandmother: { alive: false, descendants: [] },
      grandfather: { alive: false, descendants: [] },
    },
  }
}

// ---------------------------------------------------------------------------
// Share calculation — TMK m.495-506
// ---------------------------------------------------------------------------

function calculateInheritanceShares(form: FormState): {
  shares: ShareResult[]
  protectedShares: ProtectedShareResult[]
  activeZumre: number
  netEstate: number
  totalProtected: number
  disposable: number
} {
  const netEstate = Math.max(0, form.estateValue - form.debts)
  const shares: ShareResult[] = []

  // Determine active zumre
  const has1stZumre = hasFirstZumreHeirs(form)
  const has2ndZumre = hasSecondZumreHeirs(form)
  const has3rdZumre = hasThirdZumreHeirs(form)

  let activeZumre = 0
  if (has1stZumre) activeZumre = 1
  else if (has2ndZumre) activeZumre = 2
  else if (has3rdZumre) activeZumre = 3

  const hasSpouse = form.hasSpouse
  const noHeirs = activeZumre === 0 && !hasSpouse

  // If nobody at all, estate goes to state (Hazine)
  if (noHeirs) {
    shares.push({
      name: 'Hazine (Devlet)',
      zumre: '-',
      percentage: 100,
      fraction: '1/1',
      amount: netEstate,
    })
    return {
      shares,
      protectedShares: [],
      activeZumre: 0,
      netEstate,
      totalProtected: 0,
      disposable: netEstate,
    }
  }

  // Spouse share (fixed)
  let spousePct = 0
  let spouseLabel = ''
  if (hasSpouse) {
    if (activeZumre === 1) {
      spousePct = 25
      spouseLabel = '1. Zümre ile'
    } else if (activeZumre === 2) {
      spousePct = 50
      spouseLabel = '2. Zümre ile'
    } else if (activeZumre === 3) {
      spousePct = 75
      spouseLabel = '3. Zümre ile'
    } else {
      // No zumre heir at all, spouse takes everything
      spousePct = 100
      spouseLabel = 'Tek basina'
    }
    shares.push({
      name: 'Sag Kalan Es',
      zumre: spouseLabel,
      percentage: spousePct,
      fraction: percentageToFraction(spousePct),
      amount: (netEstate * spousePct) / 100,
    })
  }

  const remainingPct = 100 - spousePct

  // Distribute remaining among active zumre
  if (activeZumre === 1) {
    distributeFirstZumre(form, shares, remainingPct, netEstate)
  } else if (activeZumre === 2) {
    distributeSecondZumre(form, shares, remainingPct, netEstate)
  } else if (activeZumre === 3) {
    distributeThirdZumre(form, shares, remainingPct, netEstate)
  }

  // Protected shares (sakli pay) calculation
  const protectedShares = calculateProtectedShares(
    shares,
    activeZumre,
    hasSpouse,
    netEstate
  )
  const totalProtected = protectedShares.reduce((s, p) => s + p.protectedAmount, 0)
  const disposable = Math.max(0, netEstate - totalProtected)

  return {
    shares,
    protectedShares,
    activeZumre,
    netEstate,
    totalProtected,
    disposable,
  }
}

// ---------------------------------------------------------------------------
// Zumre detection helpers
// ---------------------------------------------------------------------------

function hasFirstZumreHeirs(form: FormState): boolean {
  for (const child of form.children) {
    if (child.alive) return true
    if (child.hasChildren && child.grandchildren.length > 0) return true
  }
  return false
}

function hasSecondZumreHeirs(form: FormState): boolean {
  if (form.mother.alive) return true
  if (form.father.alive) return true
  // Check mother's descendants (halefiyat)
  if (form.mother.descendants.some((d) => d.alive || d.children.length > 0))
    return true
  // Check father's descendants (halefiyat)
  if (form.father.descendants.some((d) => d.alive || d.children.length > 0))
    return true
  return false
}

function hasThirdZumreHeirs(form: FormState): boolean {
  const sides = [form.maternalGrandparents, form.paternalGrandparents]
  for (const side of sides) {
    for (const gp of [side.grandmother, side.grandfather]) {
      if (gp.alive) return true
      if (gp.descendants.some((d) => d.alive || d.children.length > 0))
        return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 1. Zumre distribution (children + halefiyat to grandchildren)
// ---------------------------------------------------------------------------

function distributeFirstZumre(
  form: FormState,
  shares: ShareResult[],
  remainingPct: number,
  netEstate: number
) {
  const childCount = form.children.length
  if (childCount === 0) return

  const perChildPct = remainingPct / childCount

  for (const child of form.children) {
    if (child.alive) {
      shares.push({
        name: child.name || 'Çocuk',
        zumre: '1. Zümre (Altsoy)',
        percentage: perChildPct,
        fraction: percentageToFraction(perChildPct),
        amount: (netEstate * perChildPct) / 100,
      })
    } else if (child.hasChildren && child.grandchildren.length > 0) {
      // Halefiyat: dead child's share passes to their children
      const gcCount = child.grandchildren.length
      const perGcPct = perChildPct / gcCount
      for (const gc of child.grandchildren) {
        shares.push({
          name: gc.name || 'Torun',
          zumre: '1. Zümre (Halefiyat)',
          percentage: perGcPct,
          fraction: percentageToFraction(perGcPct),
          amount: (netEstate * perGcPct) / 100,
        })
      }
    }
    // If child is dead with no grandchildren, their share is NOT redistributed
    // to other children - it simply disappears from that branch.
    // However, the per-child calculation already accounts for total child count,
    // so we need to handle this correctly.
  }

  // Recalculate: if some children are dead with no descendants,
  // their share should go to other 1st zumre heirs
  const effectiveHeirs = form.children.filter(
    (c) => c.alive || (c.hasChildren && c.grandchildren.length > 0)
  )
  if (effectiveHeirs.length < childCount && effectiveHeirs.length > 0) {
    // Need to recalculate - remove previously added and redo
    const nonZumreShares = shares.filter((s) => s.zumre !== '1. Zümre (Altsoy)' && s.zumre !== '1. Zümre (Halefiyat)')
    shares.length = 0
    shares.push(...nonZumreShares)

    const perEffectiveChildPct = remainingPct / effectiveHeirs.length
    for (const child of effectiveHeirs) {
      if (child.alive) {
        shares.push({
          name: child.name || 'Çocuk',
          zumre: '1. Zümre (Altsoy)',
          percentage: perEffectiveChildPct,
          fraction: percentageToFraction(perEffectiveChildPct),
          amount: (netEstate * perEffectiveChildPct) / 100,
        })
      } else {
        const gcCount = child.grandchildren.length
        const perGcPct = perEffectiveChildPct / gcCount
        for (const gc of child.grandchildren) {
          shares.push({
            name: gc.name || 'Torun',
            zumre: '1. Zümre (Halefiyat)',
            percentage: perGcPct,
            fraction: percentageToFraction(perGcPct),
            amount: (netEstate * perGcPct) / 100,
          })
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Zumre distribution (parents + halefiyat to siblings)
// ---------------------------------------------------------------------------

function distributeSecondZumre(
  form: FormState,
  shares: ShareResult[],
  remainingPct: number,
  netEstate: number
) {
  const motherAlive = form.mother.alive
  const fatherAlive = form.father.alive
  const motherHasDescendants = form.mother.descendants.some(
    (d) => d.alive || d.children.length > 0
  )
  const fatherHasDescendants = form.father.descendants.some(
    (d) => d.alive || d.children.length > 0
  )

  // Each parent gets half. If one parent is dead with no descendants,
  // their share goes to the other parent (or other parent's line)
  let motherPct = remainingPct / 2
  let fatherPct = remainingPct / 2

  // If mother is dead AND has no descendants at all → her share goes to father's side
  if (!motherAlive && !motherHasDescendants) {
    fatherPct = remainingPct
    motherPct = 0
  }
  // If father is dead AND has no descendants at all → his share goes to mother's side
  if (!fatherAlive && !fatherHasDescendants) {
    motherPct = remainingPct
    fatherPct = 0
  }
  // Edge: both dead with no descendants on either side → should not reach here
  // (hasSecondZumreHeirs would be false)

  // Distribute mother's side
  if (motherPct > 0) {
    if (motherAlive) {
      shares.push({
        name: 'Anne',
        zumre: '2. Zümre (Ana-Baba)',
        percentage: motherPct,
        fraction: percentageToFraction(motherPct),
        amount: (netEstate * motherPct) / 100,
      })
    } else {
      // Halefiyat: mother's share to her descendants (siblings of deceased)
      distributeDescendants(
        form.mother.descendants,
        motherPct,
        netEstate,
        shares,
        '2. Zümre (Halefiyat - Anne Kolu)'
      )
    }
  }

  // Distribute father's side
  if (fatherPct > 0) {
    if (fatherAlive) {
      shares.push({
        name: 'Baba',
        zumre: '2. Zümre (Ana-Baba)',
        percentage: fatherPct,
        fraction: percentageToFraction(fatherPct),
        amount: (netEstate * fatherPct) / 100,
      })
    } else {
      distributeDescendants(
        form.father.descendants,
        fatherPct,
        netEstate,
        shares,
        '2. Zümre (Halefiyat - Baba Kolu)'
      )
    }
  }
}

// Generic descendant distribution with sub-halefiyat
function distributeDescendants(
  descendants: SiblingOrDescendant[],
  totalPct: number,
  netEstate: number,
  shares: ShareResult[],
  zumreLabel: string
) {
  const effective = descendants.filter((d) => d.alive || d.children.length > 0)
  if (effective.length === 0) return

  const perPersonPct = totalPct / effective.length

  for (const person of effective) {
    if (person.alive) {
      shares.push({
        name: person.name || 'Mirascı',
        zumre: zumreLabel,
        percentage: perPersonPct,
        fraction: percentageToFraction(perPersonPct),
        amount: (netEstate * perPersonPct) / 100,
      })
    } else {
      // Sub-halefiyat: dead sibling's share to their children
      const childCount = person.children.length
      if (childCount === 0) continue
      const perChildPct = perPersonPct / childCount
      for (const child of person.children) {
        shares.push({
          name: child.name || 'Mirascı',
          zumre: zumreLabel,
          percentage: perChildPct,
          fraction: percentageToFraction(perChildPct),
          amount: (netEstate * perChildPct) / 100,
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Zumre distribution (grandparents + halefiyat to aunts/uncles)
// ---------------------------------------------------------------------------

function distributeThirdZumre(
  form: FormState,
  shares: ShareResult[],
  remainingPct: number,
  netEstate: number
) {
  // 4 grandparents each get 1/4 of remaining
  // Maternal side = 1/2, Paternal side = 1/2
  // Within each side: grandmother = 1/2, grandfather = 1/2

  const maternal = form.maternalGrandparents
  const paternal = form.paternalGrandparents

  const maternalHasHeirs = hasGrandparentSideHeirs(maternal)
  const paternalHasHeirs = hasGrandparentSideHeirs(paternal)

  let maternalPct = remainingPct / 2
  let paternalPct = remainingPct / 2

  // If one side has no heirs at all, other side takes all
  if (!maternalHasHeirs && paternalHasHeirs) {
    paternalPct = remainingPct
    maternalPct = 0
  } else if (maternalHasHeirs && !paternalHasHeirs) {
    maternalPct = remainingPct
    paternalPct = 0
  }

  if (maternalPct > 0) {
    distributeGrandparentSide(
      maternal,
      maternalPct,
      netEstate,
      shares,
      'Anne Tarafi'
    )
  }
  if (paternalPct > 0) {
    distributeGrandparentSide(
      paternal,
      paternalPct,
      netEstate,
      shares,
      'Baba Tarafi'
    )
  }
}

function hasGrandparentSideHeirs(side: GrandparentSide): boolean {
  for (const gp of [side.grandmother, side.grandfather]) {
    if (gp.alive) return true
    if (gp.descendants.some((d) => d.alive || d.children.length > 0))
      return true
  }
  return false
}

function hasGrandparentPersonHeirs(gp: GrandparentPerson): boolean {
  if (gp.alive) return true
  return gp.descendants.some((d) => d.alive || d.children.length > 0)
}

function distributeGrandparentSide(
  side: GrandparentSide,
  sidePct: number,
  netEstate: number,
  shares: ShareResult[],
  sideLabel: string
) {
  const gmHasHeirs = hasGrandparentPersonHeirs(side.grandmother)
  const gfHasHeirs = hasGrandparentPersonHeirs(side.grandfather)

  let gmPct = sidePct / 2
  let gfPct = sidePct / 2

  if (!gmHasHeirs && gfHasHeirs) {
    gfPct = sidePct
    gmPct = 0
  } else if (gmHasHeirs && !gfHasHeirs) {
    gmPct = sidePct
    gfPct = 0
  }

  if (gmPct > 0) {
    distributeGrandparent(
      side.grandmother,
      gmPct,
      netEstate,
      shares,
      `3. Zümre (${sideLabel} - Büyükanne)`
    )
  }
  if (gfPct > 0) {
    distributeGrandparent(
      side.grandfather,
      gfPct,
      netEstate,
      shares,
      `3. Zümre (${sideLabel} - Büyükbaba)`
    )
  }
}

function distributeGrandparent(
  gp: GrandparentPerson,
  gpPct: number,
  netEstate: number,
  shares: ShareResult[],
  zumreLabel: string
) {
  if (gp.alive) {
    const label = zumreLabel.includes('Büyükanne') ? 'Büyükanne' : 'Büyükbaba'
    const side = zumreLabel.includes('Anne Tarafi') ? '(Anne Tarafı)' : '(Baba Tarafı)'
    shares.push({
      name: `${label} ${side}`,
      zumre: '3. Zümre',
      percentage: gpPct,
      fraction: percentageToFraction(gpPct),
      amount: (netEstate * gpPct) / 100,
    })
  } else {
    // Halefiyat to aunts/uncles
    const effective = gp.descendants.filter(
      (d) => d.alive || d.children.length > 0
    )
    if (effective.length === 0) return
    const perPersonPct = gpPct / effective.length
    for (const person of effective) {
      if (person.alive) {
        shares.push({
          name: person.name || 'Mirascı',
          zumre: zumreLabel,
          percentage: perPersonPct,
          fraction: percentageToFraction(perPersonPct),
          amount: (netEstate * perPersonPct) / 100,
        })
      } else {
        const childCount = person.children.length
        if (childCount === 0) continue
        const perChildPct = perPersonPct / childCount
        for (const child of person.children) {
          shares.push({
            name: child.name || 'Mirascı',
            zumre: zumreLabel,
            percentage: perChildPct,
            fraction: percentageToFraction(perChildPct),
            amount: (netEstate * perChildPct) / 100,
          })
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Protected shares (sakli pay) — TMK m.506
// ---------------------------------------------------------------------------

function calculateProtectedShares(
  shares: ShareResult[],
  activeZumre: number,
  _hasSpouse: boolean,
  _netEstate: number
): ProtectedShareResult[] {
  const results: ProtectedShareResult[] = []

  for (const share of shares) {
    if (share.name === 'Hazine (Devlet)') continue

    let protectedRatioNum = 0
    let protectedRatioLabel = ''

    if (share.name === 'Sag Kalan Es') {
      if (activeZumre === 1) {
        // Spouse with 1st zumre: sakli pay = yasal payin tamami
        protectedRatioNum = 1
        protectedRatioLabel = '1/1 (tamami)'
      } else if (activeZumre === 2) {
        // Spouse with 2nd zumre: sakli pay = yasal payin tamami
        protectedRatioNum = 1
        protectedRatioLabel = '1/1 (tamami)'
      } else {
        // Spouse alone or with 3rd zumre: sakli pay = yasal payin 3/4'u
        protectedRatioNum = 3 / 4
        protectedRatioLabel = '3/4'
      }
    } else if (activeZumre === 1) {
      // Altsoy: sakli pay = yasal payin 1/2'si
      protectedRatioNum = 1 / 2
      protectedRatioLabel = '1/2 (yarisi)'
    } else if (activeZumre === 2) {
      // Anne-Baba: sakli pay = yasal payin 1/4'u
      protectedRatioNum = 1 / 4
      protectedRatioLabel = '1/4'
    } else if (activeZumre === 3) {
      // 3. zumre mirascilarinin sakli payi yoktur
      continue
    }

    if (protectedRatioNum > 0) {
      results.push({
        name: share.name,
        legalFraction: share.fraction,
        legalAmount: share.amount,
        protectedRatio: protectedRatioLabel,
        protectedAmount: share.amount * protectedRatioNum,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InheritancePage() {
  const [form, setForm] = useState<FormState>(createInitialState)
  const [showResults, setShowResults] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    estate: true,
    spouse: true,
    zumre1: true,
    zumre2: true,
    zumre3: true,
  })

  const netEstate = Math.max(0, form.estateValue - form.debts)

  const results = useMemo(() => {
    if (!showResults) return null
    return calculateInheritanceShares(form)
  }, [form, showResults])

  const has1stZumre = useMemo(() => hasFirstZumreHeirs(form), [form])
  const has2ndZumre = useMemo(
    () => !has1stZumre && hasSecondZumreHeirs(form),
    [form, has1stZumre]
  )

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setShowResults(false)
  }, [])

  // --- Child management ---
  const addChild = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      children: [
        ...prev.children,
        { id: uid(), name: '', alive: true, hasChildren: false, grandchildren: [] },
      ],
    }))
    setShowResults(false)
  }, [])

  const removeChild = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.filter((c) => c.id !== id),
    }))
    setShowResults(false)
  }, [])

  const updateChild = useCallback((id: string, updates: Partial<Child>) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
    setShowResults(false)
  }, [])

  const addGrandchild = useCallback((childId: string) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === childId
          ? {
              ...c,
              grandchildren: [
                ...c.grandchildren,
                { id: uid(), name: '' },
              ],
            }
          : c
      ),
    }))
    setShowResults(false)
  }, [])

  const removeGrandchild = useCallback((childId: string, gcId: string) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === childId
          ? { ...c, grandchildren: c.grandchildren.filter((gc) => gc.id !== gcId) }
          : c
      ),
    }))
    setShowResults(false)
  }, [])

  const updateGrandchild = useCallback((childId: string, gcId: string, name: string) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === childId
          ? {
              ...c,
              grandchildren: c.grandchildren.map((gc) =>
                gc.id === gcId ? { ...gc, name } : gc
              ),
            }
          : c
      ),
    }))
    setShowResults(false)
  }, [])

  // --- 2nd Zumre: parent descendant management ---
  const addParentDescendant = useCallback((parent: 'mother' | 'father') => {
    setForm((prev) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        descendants: [
          ...prev[parent].descendants,
          { id: uid(), name: '', alive: true, children: [] },
        ],
      },
    }))
    setShowResults(false)
  }, [])

  const removeParentDescendant = useCallback((parent: 'mother' | 'father', id: string) => {
    setForm((prev) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        descendants: prev[parent].descendants.filter((d) => d.id !== id),
      },
    }))
    setShowResults(false)
  }, [])

  const updateParentDescendant = useCallback(
    (parent: 'mother' | 'father', id: string, updates: Partial<SiblingOrDescendant>) => {
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          descendants: prev[parent].descendants.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        },
      }))
      setShowResults(false)
    },
    []
  )

  const addNephewNiece = useCallback((parent: 'mother' | 'father', siblingId: string) => {
    setForm((prev) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        descendants: prev[parent].descendants.map((d) =>
          d.id === siblingId
            ? { ...d, children: [...d.children, { id: uid(), name: '' }] }
            : d
        ),
      },
    }))
    setShowResults(false)
  }, [])

  const removeNephewNiece = useCallback(
    (parent: 'mother' | 'father', siblingId: string, nnId: string) => {
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          descendants: prev[parent].descendants.map((d) =>
            d.id === siblingId
              ? { ...d, children: d.children.filter((c) => c.id !== nnId) }
              : d
          ),
        },
      }))
      setShowResults(false)
    },
    []
  )

  const updateNephewNiece = useCallback(
    (parent: 'mother' | 'father', siblingId: string, nnId: string, name: string) => {
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          descendants: prev[parent].descendants.map((d) =>
            d.id === siblingId
              ? {
                  ...d,
                  children: d.children.map((c) =>
                    c.id === nnId ? { ...c, name } : c
                  ),
                }
              : d
          ),
        },
      }))
      setShowResults(false)
    },
    []
  )

  // --- 3rd Zumre: grandparent descendant management ---
  type GpSide = 'maternalGrandparents' | 'paternalGrandparents'
  type GpPerson = 'grandmother' | 'grandfather'

  const updateGrandparent = useCallback(
    (side: GpSide, person: GpPerson, updates: Partial<GrandparentPerson>) => {
      setForm((prev) => ({
        ...prev,
        [side]: {
          ...prev[side],
          [person]: { ...prev[side][person], ...updates },
        },
      }))
      setShowResults(false)
    },
    []
  )

  const addGpDescendant = useCallback((side: GpSide, person: GpPerson) => {
    setForm((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        [person]: {
          ...prev[side][person],
          descendants: [
            ...prev[side][person].descendants,
            { id: uid(), name: '', alive: true, children: [] },
          ],
        },
      },
    }))
    setShowResults(false)
  }, [])

  const removeGpDescendant = useCallback((side: GpSide, person: GpPerson, id: string) => {
    setForm((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        [person]: {
          ...prev[side][person],
          descendants: prev[side][person].descendants.filter((d) => d.id !== id),
        },
      },
    }))
    setShowResults(false)
  }, [])

  const updateGpDescendant = useCallback(
    (side: GpSide, person: GpPerson, id: string, updates: Partial<AuntUncle>) => {
      setForm((prev) => ({
        ...prev,
        [side]: {
          ...prev[side],
          [person]: {
            ...prev[side][person],
            descendants: prev[side][person].descendants.map((d) =>
              d.id === id ? { ...d, ...updates } : d
            ),
          },
        },
      }))
      setShowResults(false)
    },
    []
  )

  const addCousin = useCallback((side: GpSide, person: GpPerson, auId: string) => {
    setForm((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        [person]: {
          ...prev[side][person],
          descendants: prev[side][person].descendants.map((d) =>
            d.id === auId
              ? { ...d, children: [...d.children, { id: uid(), name: '' }] }
              : d
          ),
        },
      },
    }))
    setShowResults(false)
  }, [])

  const removeCousin = useCallback(
    (side: GpSide, person: GpPerson, auId: string, cId: string) => {
      setForm((prev) => ({
        ...prev,
        [side]: {
          ...prev[side],
          [person]: {
            ...prev[side][person],
            descendants: prev[side][person].descendants.map((d) =>
              d.id === auId
                ? { ...d, children: d.children.filter((c) => c.id !== cId) }
                : d
            ),
          },
        },
      }))
      setShowResults(false)
    },
    []
  )

  const updateCousin = useCallback(
    (side: GpSide, person: GpPerson, auId: string, cId: string, name: string) => {
      setForm((prev) => ({
        ...prev,
        [side]: {
          ...prev[side],
          [person]: {
            ...prev[side][person],
            descendants: prev[side][person].descendants.map((d) =>
              d.id === auId
                ? {
                    ...d,
                    children: d.children.map((c) =>
                      c.id === cId ? { ...c, name } : c
                    ),
                  }
                : d
            ),
          },
        },
      }))
      setShowResults(false)
    },
    []
  )

  const handleReset = useCallback(() => {
    setForm(createInitialState())
    setShowResults(false)
  }, [])

  const handleCalculate = useCallback(() => {
    setShowResults(true)
  }, [])

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Miras Payi Hesaplayici"
        description="TMK m.495-506 hukumlerine gore yasal miras paylari ve sakli pay hesaplama"
      >
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Sifirla
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ================================================================ */}
        {/* LEFT COLUMN: Form */}
        {/* ================================================================ */}
        <div className="space-y-4 xl:col-span-2">
          {/* Section 1: Estate Info */}
          <SectionCard
            title="Tereke Bilgileri"
            icon={<Scale className="h-5 w-5 text-primary" />}
            expanded={expandedSections.estate}
            onToggle={() => toggleSection('estate')}
          >
            <div className="space-y-4">
              <FormField label="Miras Birakanin Adi (opsiyonel)">
                <input
                  type="text"
                  value={form.deceasedName}
                  onChange={(e) => updateForm('deceasedName', e.target.value)}
                  placeholder="Orn: Ahmet Yilmaz"
                  className="input-field"
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Tereke Toplam Degeri (TL)">
                  <input
                    type="number"
                    min={0}
                    value={form.estateValue || ''}
                    onChange={(e) =>
                      updateForm('estateValue', Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="input-field"
                  />
                </FormField>
                <FormField label="Borclar (TL)">
                  <input
                    type="number"
                    min={0}
                    value={form.debts || ''}
                    onChange={(e) =>
                      updateForm('debts', Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="input-field"
                  />
                </FormField>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Net Tereke</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatCurrency(netEstate)}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section 2: Spouse */}
          <SectionCard
            title="Sag Kalan Es"
            icon={<Users className="h-5 w-5 text-primary" />}
            expanded={expandedSections.spouse}
            onToggle={() => toggleSection('spouse')}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasSpouse}
                onChange={(e) => updateForm('hasSpouse', e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Sag kalan es var</span>
            </label>
            {form.hasSpouse && (
              <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
                <Info className="mr-1 inline h-3.5 w-3.5" />
                Eş payı: 1. Zümre ile 1/4, 2. Zümre ile 1/2, 3. Zümre ile 3/4, tek başına tamamı
              </div>
            )}
          </SectionCard>

          {/* Section 3: 1st Zumre - Children */}
          <SectionCard
            title="1. Zümre - Altsoy (Çocuklar)"
            icon={<Users className="h-5 w-5 text-emerald-600" />}
            expanded={expandedSections.zumre1}
            onToggle={() => toggleSection('zumre1')}
            badge={form.children.length > 0 ? `${form.children.length} çocuk` : undefined}
          >
            <div className="space-y-3">
              {form.children.map((child, idx) => (
                <div
                  key={child.id}
                  className="rounded-lg border border-border bg-background p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-6">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) =>
                        updateChild(child.id, { name: e.target.value })
                      }
                      placeholder={`Çocuk ${idx + 1} adı`}
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeChild(child.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Kaldir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pl-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={child.alive}
                        onChange={(e) =>
                          updateChild(child.id, {
                            alive: e.target.checked,
                            hasChildren: e.target.checked ? false : child.hasChildren,
                          })
                        }
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Sag</span>
                    </label>

                    {!child.alive && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={child.hasChildren}
                          onChange={(e) =>
                            updateChild(child.id, {
                              hasChildren: e.target.checked,
                              grandchildren: e.target.checked
                                ? child.grandchildren
                                : [],
                            })
                          }
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm">Cocugu var (halefiyat)</span>
                      </label>
                    )}
                  </div>

                  {/* Grandchildren (halefiyat) */}
                  {!child.alive && child.hasChildren && (
                    <div className="ml-8 space-y-2 border-l-2 border-emerald-200 dark:border-emerald-800 pl-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Torunlar (halefiyat ile paya hak kazanir)
                      </p>
                      {child.grandchildren.map((gc, gcIdx) => (
                        <div key={gc.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6">
                            {gcIdx + 1}.
                          </span>
                          <input
                            type="text"
                            value={gc.name}
                            onChange={(e) =>
                              updateGrandchild(child.id, gc.id, e.target.value)
                            }
                            placeholder={`Torun ${gcIdx + 1}`}
                            className="input-field flex-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeGrandchild(child.id, gc.id)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addGrandchild(child.id)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        Torun ekle
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addChild}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
              >
                <Plus className="h-4 w-4" />
                Çocuk Ekle
              </button>
            </div>
          </SectionCard>

          {/* Section 4: 2nd Zumre - Parents (only if no 1st zumre) */}
          {!has1stZumre && (
            <SectionCard
              title="2. Zümre - Ana ve Baba"
              icon={<Users className="h-5 w-5 text-amber-600" />}
              expanded={expandedSections.zumre2}
              onToggle={() => toggleSection('zumre2')}
              disabled={has1stZumre}
              disabledMessage="1. zümrede mirasçı olduğu için 2. zümre devre dışı"
            >
              <div className="space-y-4">
                {/* Mother */}
                <ParentBlock
                  label="Anne"
                  parentState={form.mother}

                  onToggleAlive={(alive) => {
                    updateForm('mother', {
                      ...form.mother,
                      alive,
                      descendants: alive ? [] : form.mother.descendants,
                    })
                  }}
                  onAddDescendant={() => addParentDescendant('mother')}
                  onRemoveDescendant={(id) => removeParentDescendant('mother', id)}
                  onUpdateDescendant={(id, u) => updateParentDescendant('mother', id, u)}
                  onAddNephewNiece={(sibId) => addNephewNiece('mother', sibId)}
                  onRemoveNephewNiece={(sibId, nnId) => removeNephewNiece('mother', sibId, nnId)}
                  onUpdateNephewNiece={(sibId, nnId, name) => updateNephewNiece('mother', sibId, nnId, name)}
                  siblingLabel="Kardes (anne tarafindan)"
                />

                <hr className="border-border" />

                {/* Father */}
                <ParentBlock
                  label="Baba"
                  parentState={form.father}

                  onToggleAlive={(alive) => {
                    updateForm('father', {
                      ...form.father,
                      alive,
                      descendants: alive ? [] : form.father.descendants,
                    })
                  }}
                  onAddDescendant={() => addParentDescendant('father')}
                  onRemoveDescendant={(id) => removeParentDescendant('father', id)}
                  onUpdateDescendant={(id, u) => updateParentDescendant('father', id, u)}
                  onAddNephewNiece={(sibId) => addNephewNiece('father', sibId)}
                  onRemoveNephewNiece={(sibId, nnId) => removeNephewNiece('father', sibId, nnId)}
                  onUpdateNephewNiece={(sibId, nnId, name) => updateNephewNiece('father', sibId, nnId, name)}
                  siblingLabel="Kardes (baba tarafindan)"
                />
              </div>
            </SectionCard>
          )}

          {/* Section 5: 3rd Zumre - Grandparents (only if no 1st or 2nd zumre) */}
          {!has1stZumre && !has2ndZumre && (
            <SectionCard
              title="3. Zümre - Büyükanne ve Büyükbaba"
              icon={<Users className="h-5 w-5 text-purple-600" />}
              expanded={expandedSections.zumre3}
              onToggle={() => toggleSection('zumre3')}
            >
              <div className="space-y-6">
                <GrandparentSideBlock
                  sideLabel="Anne Tarafi"
                  side={form.maternalGrandparents}
                  sideKey="maternalGrandparents"
                  onUpdateGp={updateGrandparent}
                  onAddDesc={addGpDescendant}
                  onRemoveDesc={removeGpDescendant}
                  onUpdateDesc={updateGpDescendant}
                  onAddCousin={addCousin}
                  onRemoveCousin={removeCousin}
                  onUpdateCousin={updateCousin}
                />

                <hr className="border-border" />

                <GrandparentSideBlock
                  sideLabel="Baba Tarafi"
                  side={form.paternalGrandparents}
                  sideKey="paternalGrandparents"
                  onUpdateGp={updateGrandparent}
                  onAddDesc={addGpDescendant}
                  onRemoveDesc={removeGpDescendant}
                  onUpdateDesc={updateGpDescendant}
                  onAddCousin={addCousin}
                  onRemoveCousin={removeCousin}
                  onUpdateCousin={updateCousin}
                />
              </div>
            </SectionCard>
          )}

          {/* Calculate button */}
          <button
            type="button"
            onClick={handleCalculate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Calculator className="h-5 w-5" />
            Hesapla
          </button>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: Results */}
        {/* ================================================================ */}
        <div className="space-y-4">
          {results ? (
            <>
              {/* Summary card */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Ozet
                </h3>
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Tereke" value={formatCurrency(form.estateValue)} />
                  <SummaryRow label="Borclar" value={`- ${formatCurrency(form.debts)}`} />
                  <hr className="border-border" />
                  <SummaryRow
                    label="Net Tereke"
                    value={formatCurrency(results.netEstate)}
                    bold
                  />
                  {results.activeZumre > 0 && (
                    <div className="mt-2 rounded bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                      Aktif zumre: <strong>{results.activeZumre}. Zumre</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Legal shares table */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Yasal Miras Paylari
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                        <th className="pb-2 pr-2">Mirascı</th>
                        <th className="pb-2 pr-2">Zumre</th>
                        <th className="pb-2 pr-2 text-right">Kesir</th>
                        <th className="pb-2 pr-2 text-right">%</th>
                        <th className="pb-2 text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.shares.map((s, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2 pr-2 font-medium">{s.name}</td>
                          <td className="py-2 pr-2 text-xs text-muted-foreground">
                            {s.zumre}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-xs">
                            {s.fraction}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            %{s.percentage.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {formatCurrency(s.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Protected shares table */}
              {results.protectedShares.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    Sakli Paylar (TMK m.506)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                          <th className="pb-2 pr-2">Mirascı</th>
                          <th className="pb-2 pr-2 text-right">Yasal Pay</th>
                          <th className="pb-2 pr-2 text-right">Sakli Oran</th>
                          <th className="pb-2 text-right">Sakli Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.protectedShares.map((p, i) => (
                          <tr
                            key={i}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2 pr-2 font-medium">{p.name}</td>
                            <td className="py-2 pr-2 text-right text-xs">
                              {formatCurrency(p.legalAmount)}
                            </td>
                            <td className="py-2 pr-2 text-right font-mono text-xs">
                              {p.protectedRatio}
                            </td>
                            <td className="py-2 text-right font-medium">
                              {formatCurrency(p.protectedAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                    <SummaryRow
                      label="Sakli Paylar Toplami"
                      value={formatCurrency(results.totalProtected)}
                    />
                    <SummaryRow
                      label="Tasarruf Edilebilir Kisim"
                      value={formatCurrency(results.disposable)}
                      bold
                    />
                  </div>
                </div>
              )}

              {/* Legal info */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-xs text-amber-800 dark:text-amber-200">
                <Info className="mr-1.5 inline h-4 w-4" />
                Bu hesaplama TMK m.495-506 hukumlerine gore yapilmistir. Vasiyetname
                veya miras sozlesmesi varsa sonuc degisebilir. Kesin sonuc icin bir
                avukata danisiniz.
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Calculator className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                Mirascı bilgilerini girin ve &quot;Hesapla&quot; butonuna basin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

// --- Section card with collapsible header ---

function SectionCard({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  disabled,
  disabledMessage,
  children,
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  badge?: string
  disabled?: boolean
  disabledMessage?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border p-4">
          {disabled && disabledMessage ? (
            <p className="text-xs text-muted-foreground italic">{disabledMessage}</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}

// --- Form field ---

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

// --- Summary row ---

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold' : 'text-muted-foreground'}>
        {label}
      </span>
      <span className={bold ? 'font-bold text-foreground' : 'font-medium'}>
        {value}
      </span>
    </div>
  )
}

// --- 2nd Zumre: Parent block ---

function ParentBlock({
  label,
  parentState,
  onToggleAlive,
  onAddDescendant,
  onRemoveDescendant,
  onUpdateDescendant,
  onAddNephewNiece,
  onRemoveNephewNiece,
  onUpdateNephewNiece,
  siblingLabel,
}: {
  label: string
  parentState: ParentSide
  onToggleAlive: (alive: boolean) => void
  onAddDescendant: () => void
  onRemoveDescendant: (id: string) => void
  onUpdateDescendant: (id: string, updates: Partial<SiblingOrDescendant>) => void
  onAddNephewNiece: (siblingId: string) => void
  onRemoveNephewNiece: (siblingId: string, nnId: string) => void
  onUpdateNephewNiece: (siblingId: string, nnId: string, name: string) => void
  siblingLabel: string
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={parentState.alive}
          onChange={(e) => onToggleAlive(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm font-medium">{label} sag</span>
      </label>

      {!parentState.alive && (
        <div className="ml-6 space-y-2 border-l-2 border-amber-200 dark:border-amber-800 pl-3">
          <p className="text-xs font-medium text-muted-foreground">
            {label} vefat ettiyse, payi altsoyuna (kardeslerinize) gecer (halefiyat)
          </p>
          {parentState.descendants.map((sib, idx) => (
            <div
              key={sib.id}
              className="rounded border border-border bg-background p-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                <input
                  type="text"
                  value={sib.name}
                  onChange={(e) =>
                    onUpdateDescendant(sib.id, { name: e.target.value })
                  }
                  placeholder={`${siblingLabel} ${idx + 1}`}
                  className="input-field flex-1 text-sm"
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sib.alive}
                    onChange={(e) =>
                      onUpdateDescendant(sib.id, {
                        alive: e.target.checked,
                        children: e.target.checked ? [] : sib.children,
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs">Sag</span>
                </label>
                <button
                  type="button"
                  onClick={() => onRemoveDescendant(sib.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Nephew/niece sub-halefiyat */}
              {!sib.alive && (
                <div className="ml-7 space-y-1.5 border-l-2 border-amber-100 dark:border-amber-900 pl-2">
                  <p className="text-xs text-muted-foreground">
                    Cocuklari (yegen - halefiyat)
                  </p>
                  {sib.children.map((nn, nnIdx) => (
                    <div key={nn.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">
                        {nnIdx + 1}.
                      </span>
                      <input
                        type="text"
                        value={nn.name}
                        onChange={(e) =>
                          onUpdateNephewNiece(sib.id, nn.id, e.target.value)
                        }
                        placeholder={`Yegen ${nnIdx + 1}`}
                        className="input-field flex-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveNephewNiece(sib.id, nn.id)}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onAddNephewNiece(sib.id)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Yegen ekle
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onAddDescendant}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            {siblingLabel} ekle
          </button>
        </div>
      )}
    </div>
  )
}

// --- 3rd Zumre: Grandparent side block ---

function GrandparentSideBlock({
  sideLabel,
  side,
  sideKey,
  onUpdateGp,
  onAddDesc,
  onRemoveDesc,
  onUpdateDesc,
  onAddCousin,
  onRemoveCousin,
  onUpdateCousin,
}: {
  sideLabel: string
  side: GrandparentSide
  sideKey: 'maternalGrandparents' | 'paternalGrandparents'
  onUpdateGp: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather',
    updates: Partial<GrandparentPerson>
  ) => void
  onAddDesc: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather'
  ) => void
  onRemoveDesc: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather',
    id: string
  ) => void
  onUpdateDesc: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather',
    id: string,
    updates: Partial<AuntUncle>
  ) => void
  onAddCousin: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather',
    auId: string
  ) => void
  onRemoveCousin: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather',
    auId: string,
    cId: string
  ) => void
  onUpdateCousin: (
    side: 'maternalGrandparents' | 'paternalGrandparents',
    person: 'grandmother' | 'grandfather',
    auId: string,
    cId: string,
    name: string
  ) => void
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {sideLabel}
      </h4>

      {(['grandmother', 'grandfather'] as const).map((personKey) => {
        const gp = side[personKey]
        const personLabel = personKey === 'grandmother' ? 'Büyükanne' : 'Büyükbaba'
        const descLabel =
          sideLabel === 'Anne Tarafi'
            ? personKey === 'grandmother'
              ? 'Dayi/Teyze (buyukanne kolu)'
              : 'Dayi/Teyze (buyukbaba kolu)'
            : personKey === 'grandmother'
              ? 'Amca/Hala (buyukanne kolu)'
              : 'Amca/Hala (buyukbaba kolu)'

        return (
          <div key={personKey} className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gp.alive}
                onChange={(e) =>
                  onUpdateGp(sideKey, personKey, {
                    alive: e.target.checked,
                    descendants: e.target.checked ? [] : gp.descendants,
                  })
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">
                {personLabel} ({sideLabel.toLowerCase()}) sag
              </span>
            </label>

            {!gp.alive && (
              <div className="ml-6 space-y-2 border-l-2 border-purple-200 dark:border-purple-800 pl-3">
                <p className="text-xs text-muted-foreground">
                  {personLabel} vefat ettiyse payi altsoyuna gecer (halefiyat)
                </p>
                {gp.descendants.map((au, idx) => (
                  <div
                    key={au.id}
                    className="rounded border border-border bg-background p-2 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={au.name}
                        onChange={(e) =>
                          onUpdateDesc(sideKey, personKey, au.id, {
                            name: e.target.value,
                          })
                        }
                        placeholder={`${descLabel} ${idx + 1}`}
                        className="input-field flex-1 text-sm"
                      />
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={au.alive}
                          onChange={(e) =>
                            onUpdateDesc(sideKey, personKey, au.id, {
                              alive: e.target.checked,
                              children: e.target.checked ? [] : au.children,
                            })
                          }
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-xs">Sag</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemoveDesc(sideKey, personKey, au.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Cousin sub-halefiyat */}
                    {!au.alive && (
                      <div className="ml-7 space-y-1.5 border-l-2 border-purple-100 dark:border-purple-900 pl-2">
                        <p className="text-xs text-muted-foreground">
                          Cocuklari (kuzen - halefiyat)
                        </p>
                        {au.children.map((c, cIdx) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">
                              {cIdx + 1}.
                            </span>
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) =>
                                onUpdateCousin(
                                  sideKey,
                                  personKey,
                                  au.id,
                                  c.id,
                                  e.target.value
                                )
                              }
                              placeholder={`Kuzen ${cIdx + 1}`}
                              className="input-field flex-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onRemoveCousin(sideKey, personKey, au.id, c.id)
                              }
                              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => onAddCousin(sideKey, personKey, au.id)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Plus className="h-3 w-3" />
                          Kuzen ekle
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onAddDesc(sideKey, personKey)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  {descLabel} ekle
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
