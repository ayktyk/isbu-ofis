import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'
import {
  KIDEM_TAVANLARI,
  SGK_ISCI_ORANI,
  ISSIZLIK_ISCI_ORANI,
  DAMGA_VERGISI_ORANI,
  AAUT_NISPI_DILIMLER,
  AAUT_MAKTU_UCRETLER,
  YASAL_FAIZ_ORANLARI,
  TICARI_AVANS_ORANLARI,
  AU_GV_ISTISNASI,
  AU_DV_ISTISNASI,
} from '@/lib/constants/legalRates2026'

// ─── Local constants ──────────────────────────────────────────────────────

const SGK_TOPLAM_ISCI = SGK_ISCI_ORANI + ISSIZLIK_ISCI_ORANI // 0.15

type FesihNedeni = 'isveren_haksiz' | 'isci_hakli' | 'ikale' | 'istifa'

// ─── Helpers ────────────────────────────────────────────────────────────────

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm'
const selectCls = inputCls
const btnCls =
  'bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-md text-sm font-medium'
const btnSecondaryCls =
  'border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 rounded-md text-sm font-medium'

function dateDiff(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  let years = e.getFullYear() - s.getFullYear()
  let months = e.getMonth() - s.getMonth()
  let days = e.getDate() - s.getDate() + 1
  if (days < 0) {
    months--
    const prev = new Date(e.getFullYear(), e.getMonth(), 0).getDate()
    days += prev
  }
  if (months < 0) {
    years--
    months += 12
  }
  const totalDays = Math.floor(
    (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1
  return { years, months, days, totalDays }
}

/** Excel'deki kademeli GV hesabi - kumulatif matraha gore dilim orani uygulanir */
function calcGvByKumulatif(matrah: number, kumulatif: number): number {
  if (kumulatif + matrah <= 190000) return matrah * 0.15
  if (kumulatif >= 5300000) return matrah * 0.40
  if (kumulatif >= 1500000) return matrah * 0.35
  if (kumulatif >= 400000) return matrah * 0.27
  if (kumulatif >= 190000) return matrah * 0.20
  return matrah * 0.15
}

/** Net ucretten brut ucrete iteratif donusum */
function netToBrut(netUcret: number): number {
  // Iterative approach: brut = net / (1 - SGK - gelirVergisi*(1-SGK) - damga)
  // First approximation
  let brut = netUcret / (1 - SGK_TOPLAM_ISCI - 0.15 * (1 - SGK_TOPLAM_ISCI) - DAMGA_VERGISI_ORANI)
  // Iterate 5 times for precision
  for (let i = 0; i < 5; i++) {
    const sgk = brut * SGK_TOPLAM_ISCI
    const gelirMatrah = brut - sgk
    const gelirVergisi = gelirMatrah * 0.15 // ilk dilim yaklasimi
    const damga = brut * DAMGA_VERGISI_ORANI
    const calcNet = brut - sgk - gelirVergisi - damga
    const diff = netUcret - calcNet
    brut += diff
  }
  return Math.round(brut * 100) / 100
}

/** Kidem tavani: cikis tarihine gore uygun tavan */
function getKidemTavani(dateStr: string): number {
  const d = new Date(dateStr)
  for (const t of KIDEM_TAVANLARI) {
    if (d >= new Date(t.start) && d <= new Date(t.end)) return t.tavan
  }
  return KIDEM_TAVANLARI[0].tavan
}

function SourceBadge({ text }: { text: string }) {
  return (
    <div className="mb-4 inline-block rounded-md bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
      {text}
    </div>
  )
}

function WarningBadge({ text }: { text: string }) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800">
      {text}
    </div>
  )
}

function ResultTable({
  rows,
  headers = ['Kalem', 'Brut (TL)', 'Kesinti (TL)', 'Net (TL)'],
}: {
  rows: (string | number)[][]
  headers?: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            {headers.map((h, i) => (
              <th key={i} className="border px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri === rows.length - 1 ? 'font-semibold bg-muted/50' : ''}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="border px-3 py-2">
                  {typeof cell === 'number' ? formatCurrency(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── TAB 1: Iscilik Alacaklari (All 9 modules) ─────────────────────────────

interface IscilikFormState {
  iseGiris: string
  istenCikis: string
  brutUcret: number
  netUcret: number
  ucretGirisTipi: 'brut' | 'net'
  yemek: number
  servis: number
  ikramiye: number
  prim: number
  barinma: number
  diger: number
  fesihNedeni: FesihNedeni
  kullanilamayanIzin: number
  haftalikFmSaat: number
  toplamFmSaat: number
  ubgtGun: number
  hakkaniyetOrani: number
  kumulatifGvMatrah: number
}

interface IscilikKalemResult {
  label: string
  brut: number
  kesinti: number
  net: number
}

interface IscilikResult {
  hizmet: { years: number; months: number; days: number; totalDays: number }
  brutUcret: number
  giydirilmisBrut: number
  kalemler: IscilikKalemResult[]
  warnings: string[]
  toplamBrut: number
  toplamKesinti: number
  toplamNet: number
}

function IscilikTab() {
  const [form, setForm] = useState<IscilikFormState>({
    iseGiris: '',
    istenCikis: '',
    brutUcret: 0,
    netUcret: 0,
    ucretGirisTipi: 'brut',
    yemek: 0,
    servis: 0,
    ikramiye: 0,
    prim: 0,
    barinma: 0,
    diger: 0,
    fesihNedeni: 'isveren_haksiz',
    kullanilamayanIzin: 0,
    haftalikFmSaat: 0,
    toplamFmSaat: 0,
    ubgtGun: 0,
    hakkaniyetOrani: 0.30,
    kumulatifGvMatrah: 0,
  })
  const [result, setResult] = useState<IscilikResult | null>(null)

  const set = (k: keyof IscilikFormState, v: string | number | boolean) =>
    setForm((p) => ({ ...p, [k]: v }))

  function hesapla() {
    if (!form.iseGiris || !form.istenCikis) {
      toast.error('Ise giris ve isten cikis tarihleri zorunludur.')
      return
    }

    const ciplaklBrut = form.ucretGirisTipi === 'brut'
      ? form.brutUcret
      : netToBrut(form.netUcret)

    if (ciplaklBrut <= 0) {
      toast.error('Brut veya net ucret giriniz.')
      return
    }

    const warnings: string[] = []
    const kalemler: IscilikKalemResult[] = []

    // ── HIZMET SURESI ──
    const hizmet = dateDiff(form.iseGiris, form.istenCikis)

    // Zamanasimi kontrolu
    const cikisDate = new Date(form.istenCikis)
    const now = new Date()
    const yilFark = (now.getTime() - cikisDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    if (yilFark > 5) {
      warnings.push('ZAMANASIMI: Fesih tarihinden 5 yildan fazla sure gecmis.')
    } else if (yilFark > 4) {
      warnings.push('ZAMANASIMI YAKLASIYORS: Fesih tarihinden 4 yildan fazla sure gecmis.')
    }

    // Giydirilmis brut ucret
    const giydirilmisBrut = ciplaklBrut + form.yemek + form.servis + form.ikramiye + form.prim + form.barinma + form.diger

    // Fesih kontrolu
    const kidemHakki = form.fesihNedeni !== 'istifa'
    const ihbarHakki = form.fesihNedeni === 'isveren_haksiz' || form.fesihNedeni === 'ikale'

    if (form.fesihNedeni === 'istifa') {
      warnings.push('ISTIFA: Istifa eden isci kidem ve ihbar tazminatina hak kazanamaz. Ancak odenmemis alacak nedeniyle hakli fesih sayilabilir.')
    }

    // ── KIDEM TAZMINATI ──
    if (kidemHakki && hizmet.totalDays >= 365) {
      const tavan = getKidemTavani(form.istenCikis)
      const esasUcret = Math.min(giydirilmisBrut, tavan)
      if (giydirilmisBrut > tavan) {
        warnings.push(`KIDEM TAVANI: Giydirilmis brut (${formatCurrency(giydirilmisBrut)}) tavani (${formatCurrency(tavan)}) asiyor. Tavan esas alinir.`)
      }

      // Formul: Esas x Yil + Esas/12 x Ay + Esas/365 x Gun
      const tamYilKidemi = esasUcret * hizmet.years
      const kalanAyKidemi = (esasUcret / 12) * hizmet.months
      const kalanGunKidemi = (esasUcret / 365) * hizmet.days
      const kidemBrut = tamYilKidemi + kalanAyKidemi + kalanGunKidemi

      // Kesintiler: SADECE Damga Vergisi
      const kidemDv = kidemBrut * DAMGA_VERGISI_ORANI
      const kidemDvIstisna = AU_DV_ISTISNASI
      const kidemNetDv = Math.max(0, kidemDv - kidemDvIstisna)

      kalemler.push({
        label: 'Kıdem Tazminatı',
        brut: kidemBrut,
        kesinti: kidemNetDv,
        net: kidemBrut - kidemNetDv,
      })
    } else if (kidemHakki && hizmet.totalDays < 365) {
      warnings.push('KIDEM: 1 yildan az hizmet suresi - kidem tazminati hesaplanmadi.')
    }

    // ── IHBAR TAZMINATI ──
    if (ihbarHakki) {
      const hizmetYil = hizmet.years + hizmet.months / 12 + hizmet.days / 365

      let ihbarGun: number
      if (hizmetYil < 0.5) ihbarGun = 14
      else if (hizmetYil < 1.5) ihbarGun = 28
      else if (hizmetYil < 3) ihbarGun = 42
      else ihbarGun = 56

      const gunlukGiydirilmis = giydirilmisBrut / 30
      const ihbarBrut = gunlukGiydirilmis * ihbarGun

      // GV: Kumulatif matraha gore dilim orani
      const ihbarGv = calcGvByKumulatif(ihbarBrut, form.kumulatifGvMatrah)
      const ihbarGvIstisna = AU_GV_ISTISNASI
      const ihbarNetGv = Math.max(0, ihbarGv - ihbarGvIstisna)

      // DV
      const ihbarDv = ihbarBrut * DAMGA_VERGISI_ORANI
      const ihbarDvIstisna = AU_DV_ISTISNASI
      const ihbarNetDv = Math.max(0, ihbarDv - ihbarDvIstisna)

      const ihbarKesinti = ihbarNetGv + ihbarNetDv

      kalemler.push({
        label: 'İhbar Tazminatı',
        brut: ihbarBrut,
        kesinti: ihbarKesinti,
        net: ihbarBrut - ihbarKesinti,
      })
    }

    // ── YILLIK IZIN UCRETI ──
    if (form.kullanilamayanIzin > 0) {
      // Excel: CIPLAK Brut / 30 x kullanilmayan gun
      const gunlukCiplak = ciplaklBrut / 30
      const izinBrut = gunlukCiplak * form.kullanilamayanIzin

      // Kesintiler: SGK %14, Issizlik %1, GV (kademeli), DV
      const izinSgk = izinBrut * SGK_ISCI_ORANI
      const izinIssizlik = izinBrut * ISSIZLIK_ISCI_ORANI
      const izinGvMatrah = izinBrut - izinSgk - izinIssizlik
      const izinGv = calcGvByKumulatif(izinGvMatrah, form.kumulatifGvMatrah)
      const izinGvIstisna = AU_GV_ISTISNASI
      const izinNetGv = Math.max(0, izinGv - izinGvIstisna)
      const izinDv = izinBrut * DAMGA_VERGISI_ORANI
      const izinDvIstisna = AU_DV_ISTISNASI
      const izinNetDv = Math.max(0, izinDv - izinDvIstisna)

      const izinKesinti = izinSgk + izinIssizlik + izinNetGv + izinNetDv

      kalemler.push({
        label: 'Yıllık İzin Ücreti',
        brut: izinBrut,
        kesinti: izinKesinti,
        net: izinBrut - izinKesinti,
      })
    }

    // ── FAZLA MESAI UCRETI ──
    const toplamFmSaat = form.toplamFmSaat > 0
      ? form.toplamFmSaat
      : form.haftalikFmSaat * Math.max(0, Math.floor(hizmet.totalDays / 7))

    if (toplamFmSaat > 0) {
      // Excel: Ciplak Brut / 225 x 1.5 x toplam saat
      const saatlik = ciplaklBrut / 225
      const fmBrutTavan = saatlik * 1.5 * toplamFmSaat

      // Hakkaniyet indirimi
      const fmBrut = fmBrutTavan * (1 - form.hakkaniyetOrani)

      // Kesintiler: SGK %14, Issizlik %1, GV, DV (AU istisnasi YOK)
      const fmSgk = fmBrut * SGK_ISCI_ORANI
      const fmIssizlik = fmBrut * ISSIZLIK_ISCI_ORANI
      const fmGvMatrah = fmBrut - fmSgk - fmIssizlik
      const fmGv = calcGvByKumulatif(fmGvMatrah, form.kumulatifGvMatrah)
      const fmDv = fmBrut * DAMGA_VERGISI_ORANI
      const fmKesinti = fmSgk + fmIssizlik + fmGv + fmDv

      kalemler.push({
        label: 'Fazla Mesai Ücreti',
        brut: fmBrut,
        kesinti: fmKesinti,
        net: fmBrut - fmKesinti,
      })

      if (form.hakkaniyetOrani > 0) {
        warnings.push(`FM hakkaniyet indirimi: %${(form.hakkaniyetOrani * 100).toFixed(0)} uygulandi. Tanik beyaniyla ispatlanan FM icin standart oran %30.`)
      }
    }

    // ── UBGT UCRETI ──
    if (form.ubgtGun > 0) {
      // Excel: Ciplak Brut / 30 x gun sayisi
      const gunlukCiplak = ciplaklBrut / 30
      const ubgtBrutTavan = gunlukCiplak * form.ubgtGun

      // Hakkaniyet indirimi
      const ubgtBrut = ubgtBrutTavan * (1 - form.hakkaniyetOrani)

      // Kesintiler: SGK %14, Issizlik %1, GV, DV (AU istisnasi YOK)
      const ubgtSgk = ubgtBrut * SGK_ISCI_ORANI
      const ubgtIssizlik = ubgtBrut * ISSIZLIK_ISCI_ORANI
      const ubgtGvMatrah = ubgtBrut - ubgtSgk - ubgtIssizlik
      const ubgtGv = calcGvByKumulatif(ubgtGvMatrah, form.kumulatifGvMatrah)
      const ubgtDv = ubgtBrut * DAMGA_VERGISI_ORANI
      const ubgtKesinti = ubgtSgk + ubgtIssizlik + ubgtGv + ubgtDv

      kalemler.push({
        label: 'UBGT Ücreti',
        brut: ubgtBrut,
        kesinti: ubgtKesinti,
        net: ubgtBrut - ubgtKesinti,
      })
    }

    // Toplamlar
    const toplamBrut = kalemler.reduce((s, k) => s + k.brut, 0)
    const toplamKesinti = kalemler.reduce((s, k) => s + k.kesinti, 0)
    const toplamNet = kalemler.reduce((s, k) => s + k.net, 0)

    setResult({
      hizmet,
      brutUcret: ciplaklBrut,
      giydirilmisBrut,
      kalemler,
      warnings,
      toplamBrut,
      toplamKesinti,
      toplamNet,
    })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 4857 s. Is Kanunu, 1475 s. K. m.14, Excel Hesaplama Formulleri" />

      {/* A. ISCI BILGILERI */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          A. Isci Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Ise giris tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.iseGiris}
              onChange={(e) => set('iseGiris', e.target.value)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Isten cikis tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.istenCikis}
              onChange={(e) => set('istenCikis', e.target.value)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Fesih nedeni</label>
            <select
              className={selectCls}
              value={form.fesihNedeni}
              onChange={(e) => set('fesihNedeni', e.target.value)}
            >
              <option value="isveren_haksiz">Isveren haksiz fesih</option>
              <option value="isci_hakli">Isci hakli fesih</option>
              <option value="ikale">Ikale (karsilikli anlasma)</option>
              <option value="istifa">Istifa</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* B. UCRET BILGILERI */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          B. Ücret Bilgileri (Aylık TL)
        </legend>
        <div className="flex flex-wrap gap-4">
          {/* Brut/Net toggle */}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Ücret giriş tipi</label>
            <select
              className={selectCls}
              value={form.ucretGirisTipi}
              onChange={(e) => set('ucretGirisTipi', e.target.value)}
            >
              <option value="brut">Brut ucret</option>
              <option value="net">Net ucret</option>
            </select>
          </div>
          {form.ucretGirisTipi === 'brut' ? (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Ciplak brut ucret</label>
              <input
                type="number"
                className={inputCls}
                placeholder="0"
                value={form.brutUcret || ''}
                onChange={(e) => set('brutUcret', parseFloat(e.target.value) || 0)}
              />
            </div>
          ) : (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Net ucret</label>
              <input
                type="number"
                className={inputCls}
                placeholder="0"
                value={form.netUcret || ''}
                onChange={(e) => set('netUcret', parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Yemek yardimi (brut)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.yemek || ''}
              onChange={(e) => set('yemek', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Yol/Servis (brut)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.servis || ''}
              onChange={(e) => set('servis', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Ikramiye (brut)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.ikramiye || ''}
              onChange={(e) => set('ikramiye', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Prim (brut)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.prim || ''}
              onChange={(e) => set('prim', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Barinma/Konut (brut)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.barinma || ''}
              onChange={(e) => set('barinma', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Diğer aynî/nakdî (brüt)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.diger || ''}
              onChange={(e) => set('diger', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </fieldset>

      {/* D. DIGER GIRDILER */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          D. Diğer Girdiler
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Kullanilmamis izin (gun)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.kullanilamayanIzin || ''}
              onChange={(e) => set('kullanilamayanIzin', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Haftalik FM saat</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.haftalikFmSaat || ''}
              onChange={(e) => set('haftalikFmSaat', parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">Haftalik ortalama fazla mesai</p>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Toplam FM saat</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.toplamFmSaat || ''}
              onChange={(e) => set('toplamFmSaat', parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">0 ise haftaliktan hesaplanir</p>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">UBGT çalışılan gün</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.ubgtGun || ''}
              onChange={(e) => set('ubgtGun', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Hakkaniyet indirimi (%)</label>
            <input
              type="number"
              className={inputCls}
              step={5}
              min={0}
              max={100}
              value={(form.hakkaniyetOrani * 100) || ''}
              onChange={(e) => set('hakkaniyetOrani', (parseFloat(e.target.value) || 0) / 100)}
            />
            <p className="text-xs text-muted-foreground mt-1">FM ve UBGT için (standart: 30)</p>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Kumulatif GV matrahi</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.kumulatifGvMatrah || ''}
              onChange={(e) => set('kumulatifGvMatrah', parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">Isten cikis ayi bordrosundan</p>
          </div>
        </div>
      </fieldset>

      {/* Otomatik Hesaplanan */}
      {form.iseGiris && form.istenCikis && (form.brutUcret > 0 || form.netUcret > 0) && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
          <p className="font-medium text-muted-foreground mb-2">Otomatik Hesaplanan</p>
          <p>
            <strong>Hizmet suresi:</strong>{' '}
            {(() => {
              const h = dateDiff(form.iseGiris, form.istenCikis)
              return `${h.years} yil ${h.months} ay ${h.days} gun`
            })()}
          </p>
          <p>
            <strong>Ciplak brut ucret:</strong>{' '}
            {formatCurrency(
              form.ucretGirisTipi === 'brut' ? form.brutUcret : netToBrut(form.netUcret)
            )}
          </p>
          <p>
            <strong>Giydirilmis brut:</strong>{' '}
            {formatCurrency(
              (form.ucretGirisTipi === 'brut' ? form.brutUcret : netToBrut(form.netUcret)) +
                form.yemek + form.servis + form.ikramiye + form.prim + form.barinma + form.diger
            )}
          </p>
          <p>
            <strong>SGK + Issizlik payi (%15):</strong>{' '}
            {formatCurrency(
              (form.ucretGirisTipi === 'brut' ? form.brutUcret : netToBrut(form.netUcret)) * SGK_TOPLAM_ISCI
            )}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button className={btnCls} onClick={hesapla}>
          Hesapla
        </button>
        {result && (
          <button
            className={btnSecondaryCls}
            onClick={() => toast.info('Excel export ozelligi yakinda eklenecek.')}
          >
            Excel&apos;e Aktar
          </button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <WarningBadge key={i} text={w} />
              ))}
            </div>
          )}

          {/* Summary info */}
          <div className="rounded-lg border p-4 text-sm space-y-1">
            <p>
              <strong>Hizmet suresi:</strong> {result.hizmet.years} yil{' '}
              {result.hizmet.months} ay {result.hizmet.days} gun (toplam{' '}
              {result.hizmet.totalDays} gun)
            </p>
            <p>
              <strong>Ciplak brut ucret:</strong>{' '}
              {formatCurrency(result.brutUcret)}
            </p>
            <p>
              <strong>Giydirilmis brut ucret:</strong>{' '}
              {formatCurrency(result.giydirilmisBrut)}
            </p>
            <p>
              <strong>Kidem tavani (cikis donemi):</strong>{' '}
              {formatCurrency(getKidemTavani(form.istenCikis))}
            </p>
            {result.giydirilmisBrut > getKidemTavani(form.istenCikis) && (
              <p className="text-amber-600 font-medium">
                Giydirilmis brut tavan asimi - kidem icin tavan esas alinir.
              </p>
            )}
          </div>

          {/* Result table */}
          <ResultTable
            headers={['Alacak Kalemi', 'Brut Tutar (TL)', 'Kesintiler (TL)', 'Net Tutar (TL)']}
            rows={[
              ...result.kalemler.map((k) => [
                k.label,
                k.brut,
                k.kesinti,
                k.net,
              ] as (string | number)[]),
              ['TOPLAM', result.toplamBrut, result.toplamKesinti, result.toplamNet],
            ]}
          />

          <p className="text-xs text-muted-foreground">
            Not: Bu hesaplama yaklasik degerler icerir. Kesin hesap icin bilirkisi raporu gerekebilir.
            Kidem tazminatindan yalnizca damga vergisi kesilir (SGK ve gelir vergisi yok).
            Ihbar tazminatindan gelir vergisi + damga vergisi kesilir (SGK yok).
            FM ve UBGT için AU istisnası uygulanmaz.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── TAB 2: Vekalet Ucreti ──────────────────────────────────────────────────

function VekaletTab() {
  const [form, setForm] = useState({
    mahkemeTuru: 'asliye-hukuk',
    davaTuru: 'nispi' as 'nispi' | 'maktu',
    asama: 'karar' as 'karar' | 'on-inceleme-oncesi',
    davaDegeri: 0,
    seriDava: false,
  })
  const [result, setResult] = useState<null | {
    ucret: number
    asama: string
    aciklama: string
  }>(null)

  function hesapla() {
    let ucret = 0
    let aciklama = ''

    if (form.davaTuru === 'maktu') {
      ucret = AAUT_MAKTU_UCRETLER[form.mahkemeTuru] || 30000
      aciklama = `Maktu ucret (${form.mahkemeTuru}): ${formatCurrency(ucret)}`
    } else {
      let remaining = form.davaDegeri
      let prevLimit = 0
      for (const d of AAUT_NISPI_DILIMLER) {
        const band = Math.min(remaining, d.limit - prevLimit)
        if (band <= 0) break
        ucret += band * d.oran
        remaining -= band
        prevLimit = d.limit
      }
      const maktuAlt = AAUT_MAKTU_UCRETLER[form.mahkemeTuru] || 30000
      if (ucret < maktuAlt) {
        ucret = maktuAlt
        aciklama = `Nispi hesap (${formatCurrency(ucret)}) maktu alt sinirin altinda, maktu uygulanir.`
      } else {
        aciklama = `Nispi dilimli hesaplama sonucu.`
      }
    }

    if (form.asama === 'on-inceleme-oncesi') {
      ucret = ucret / 2
      aciklama += ' On inceleme oncesi sulh: 1/2 indirim uygulanir.'
    }

    if (form.seriDava) {
      ucret = ucret * 0.5
      aciklama += ' Seri dava indirimi: %50 uygulanir.'
    }

    setResult({ ucret, asama: form.asama, aciklama })
  }

  const mahkemeOptions = Object.keys(AAUT_MAKTU_UCRETLER).map((k) => (
    <option key={k} value={k}>
      {k.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </option>
  ))

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: AAUT 2025-2026 Tarifesi" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Dava Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Mahkeme turu</label>
            <select
              className={selectCls}
              value={form.mahkemeTuru}
              onChange={(e) =>
                setForm((p) => ({ ...p, mahkemeTuru: e.target.value }))
              }
            >
              {mahkemeOptions}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Dava turu</label>
            <select
              className={selectCls}
              value={form.davaTuru}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  davaTuru: e.target.value as 'nispi' | 'maktu',
                }))
              }
            >
              <option value="nispi">Nispi</option>
              <option value="maktu">Maktu</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Dava asamasi</label>
            <select
              className={selectCls}
              value={form.asama}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  asama: e.target.value as 'karar' | 'on-inceleme-oncesi',
                }))
              }
            >
              <option value="karar">Karar asamasi</option>
              <option value="on-inceleme-oncesi">On inceleme oncesi</option>
            </select>
          </div>
          {form.davaTuru === 'nispi' && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Dava degeri (TL)</label>
              <input
                type="number"
                className={inputCls}
                value={form.davaDegeri || ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    davaDegeri: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          )}
          <div className="min-w-[200px] flex items-end gap-2">
            <input
              type="checkbox"
              id="seriDava"
              checked={form.seriDava}
              onChange={(e) =>
                setForm((p) => ({ ...p, seriDava: e.target.checked }))
              }
            />
            <label htmlFor="seriDava" className="text-sm font-medium">
              Seri dava
            </label>
          </div>
        </div>
      </fieldset>

      <button className={btnCls} onClick={hesapla}>
        Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <ResultTable
            headers={['Kalem', 'Tutar (TL)']}
            rows={[['Vekalet Ucreti', result.ucret]]}
          />
          <p className="text-sm text-muted-foreground">{result.aciklama}</p>
        </div>
      )}
    </div>
  )
}

// ─── TAB 3: Arabulucu Ucreti (2025-2026 AAUT Tarifesi) ─────────────────────

type ArabulucuTur = 'isci-isveren' | 'ticari' | 'tuketici' | 'kira' | 'aile' | 'ortaklik' | 'diger'
type AnlasmaDurumu = 'anlasma' | 'anlasama'

/** Saatlik ucret tarifesi: [ilk3SaatAnlasma, sonrakiAnlasma, ilk3SaatAnlasama, sonrakiAnlasama] */
const ARABULUCU_SAATLIK_2TARAF: Record<ArabulucuTur, [number, number, number, number]> = {
  'isci-isveren': [1000, 750, 750, 500],
  'ticari':       [1500, 1000, 1000, 750],
  'tuketici':     [600, 450, 450, 350],
  'aile':         [900, 650, 650, 500],
  'kira':         [800, 600, 600, 450],
  'ortaklik':     [1200, 900, 900, 650],
  'diger':        [750, 550, 550, 400],
}

const ARABULUCU_SAATLIK_3PLUS: Record<ArabulucuTur, [number, number, number, number]> = {
  'isci-isveren': [1250, 1000, 1000, 750],
  'ticari':       [1750, 1250, 1250, 1000],
  'tuketici':     [800, 600, 600, 450],
  'aile':         [1100, 850, 850, 650],
  'kira':         [1000, 800, 800, 600],
  'ortaklik':     [1500, 1100, 1100, 850],
  'diger':        [950, 700, 700, 550],
}

const ARABULUCU_NISPI_DILIMLER = [
  { limit: 120_000, oran: 0.06 },
  { limit: 240_000, oran: 0.05 },
  { limit: 600_000, oran: 0.04 },
  { limit: 1_200_000, oran: 0.03 },
  { limit: 2_400_000, oran: 0.02 },
  { limit: 6_000_000, oran: 0.015 },
  { limit: 12_000_000, oran: 0.01 },
  { limit: Infinity, oran: 0.005 },
]

function calcArabulucuNispi(deger: number): number {
  let remaining = deger
  let total = 0
  let prevLimit = 0
  for (const d of ARABULUCU_NISPI_DILIMLER) {
    const band = Math.min(remaining, d.limit - prevLimit)
    if (band <= 0) break
    total += band * d.oran
    remaining -= band
    prevLimit = d.limit
  }
  return total
}

interface ArabulucuResult {
  saatlikToplam: number
  nispiToplam: number
  uygulananUcret: number
  kdv: number
  stopaj: number
  netOdeme: number
  tarafBasina: number
  arabulucuNetGelir: number
}

function ArabulucuTab() {
  const [form, setForm] = useState({
    tur: 'isci-isveren' as ArabulucuTur,
    sonuc: 'anlasma' as AnlasmaDurumu,
    sure: 3,
    tarafSayisi: 2,
    deger: 0,
  })
  const [result, setResult] = useState<ArabulucuResult | null>(null)

  function hesapla() {
    if (form.sure <= 0) {
      toast.error('Toplanti suresi giriniz.')
      return
    }

    const rates = form.tarafSayisi > 2
      ? ARABULUCU_SAATLIK_3PLUS[form.tur]
      : ARABULUCU_SAATLIK_2TARAF[form.tur]

    const isAnlasma = form.sonuc === 'anlasma'
    const ilk3Saat = isAnlasma ? rates[0] : rates[2]
    const sonrakiSaat = isAnlasma ? rates[1] : rates[3]

    const ilk3 = Math.min(form.sure, 3)
    const sonraki = Math.max(0, form.sure - 3)
    const saatlikToplam = ilk3 * ilk3Saat + sonraki * sonrakiSaat

    let nispiToplam = 0
    if (isAnlasma && form.deger > 0) {
      nispiToplam = calcArabulucuNispi(form.deger)
    }

    const uygulananUcret = Math.max(saatlikToplam, nispiToplam)
    const kdv = uygulananUcret * 0.20
    const stopaj = uygulananUcret * 0.20
    const netOdeme = uygulananUcret - stopaj + kdv
    const tarafBasina = netOdeme / Math.max(form.tarafSayisi, 1)
    const arabulucuNetGelir = uygulananUcret - stopaj

    setResult({
      saatlikToplam,
      nispiToplam,
      uygulananUcret,
      kdv,
      stopaj,
      netOdeme,
      tarafBasina,
      arabulucuNetGelir,
    })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 6325 s. K., AAUT Arabuluculuk Asgari Ucret Tarifesi 2025-2026" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Arabuluculuk Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Uyuşmazlık türü</label>
            <select
              className={selectCls}
              value={form.tur}
              onChange={(e) => setForm((p) => ({ ...p, tur: e.target.value as ArabulucuTur }))}
            >
              <option value="isci-isveren">İşçi-İşveren</option>
              <option value="ticari">Ticari</option>
              <option value="tuketici">Tüketici</option>
              <option value="kira">Kira</option>
              <option value="aile">Aile (Boşanma vb.)</option>
              <option value="ortaklik">Ortaklığın Giderilmesi</option>
              <option value="diger">Diğer</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Anlasma durumu</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="arb-sonuc"
                  checked={form.sonuc === 'anlasma'}
                  onChange={() => setForm((p) => ({ ...p, sonuc: 'anlasma' }))}
                />
                Anlasma ile
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="arb-sonuc"
                  checked={form.sonuc === 'anlasama'}
                  onChange={() => setForm((p) => ({ ...p, sonuc: 'anlasama' }))}
                />
                Anlasama ile
              </label>
            </div>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Toplanti suresi (saat)</label>
            <input
              type="number"
              className={inputCls}
              min={1}
              value={form.sure || ''}
              onChange={(e) => setForm((p) => ({ ...p, sure: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Taraf sayisi</label>
            <input
              type="number"
              className={inputCls}
              min={2}
              value={form.tarafSayisi || ''}
              onChange={(e) => setForm((p) => ({ ...p, tarafSayisi: Math.max(2, parseInt(e.target.value) || 2) }))}
            />
            <p className="text-xs text-muted-foreground mt-1">3+ tarafta farkli tarife uygulanir</p>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Uyusmazlik konusu deger (TL)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Opsiyonel - parasal uyusmazliklar icin"
              value={form.deger || ''}
              onChange={(e) => setForm((p) => ({ ...p, deger: parseFloat(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Anlasma halinde nispi ucret hesabi icin</p>
          </div>
        </div>
      </fieldset>

      {/* Tarife bilgi tablosu */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-muted-foreground mb-2">
          Secili tarife: {form.tur.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ({form.tarafSayisi > 2 ? '3+ taraf' : '2 taraf'})
        </p>
        {(() => {
          const rates = form.tarafSayisi > 2
            ? ARABULUCU_SAATLIK_3PLUS[form.tur]
            : ARABULUCU_SAATLIK_2TARAF[form.tur]
          return (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Anlasma - Ilk 3 saat: <strong>{formatCurrency(rates[0])}/saat</strong></div>
              <div>Anlasma - Sonraki: <strong>{formatCurrency(rates[1])}/saat</strong></div>
              <div>Anlasama - Ilk 3 saat: <strong>{formatCurrency(rates[2])}/saat</strong></div>
              <div>Anlasama - Sonraki: <strong>{formatCurrency(rates[3])}/saat</strong></div>
            </div>
          )
        })()}
      </div>

      <button className={btnCls} onClick={hesapla}>
        Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <ResultTable
            headers={['Kalem', 'Tutar (TL)']}
            rows={[
              ['Saatlik ucret toplami', result.saatlikToplam],
              ...(result.nispiToplam > 0
                ? [['Nispi ucret toplami (deger uzerinden)' as string | number, result.nispiToplam as string | number] as (string | number)[]]
                : []),
              ['Uygulanan ucret (buyuk olan)', result.uygulananUcret],
              ['KDV (%20)', result.kdv],
              ['Stopaj - GV (%20)', result.stopaj],
              ['Toplam odeme (ucret - stopaj + KDV)', result.netOdeme],
              ['Taraf basina maliyet', result.tarafBasina],
              ['Arabulucu net gelir (ucret - stopaj)', result.arabulucuNetGelir],
            ]}
          />

          {result.nispiToplam > 0 && result.nispiToplam > result.saatlikToplam && (
            <WarningBadge text="Nispi ucret saatlik ucretten yuksek oldugu icin nispi ucret uygulanmistir." />
          )}

          <p className="text-xs text-muted-foreground">
            Not: Arabulucu ucreti taraflar arasinda esit olarak paylasilir.
            KDV arabulucuya ayrica odenir. Stopaj (%20 gelir vergisi) arabulucu ucretinden kesilir.
            Nispi ucret yalnizca anlasma halinde ve deger girilmisse hesaplanir; saatlik ucretten az olamaz.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── TAB 4: Faiz Hesaplama ──────────────────────────────────────────────────

function FaizTab() {
  const [form, setForm] = useState({
    anapara: 0,
    baslangic: '',
    bitis: '',
    faizTuru: 'yasal' as 'yasal' | 'ticari' | 'ozel',
    ozelOran: 0,
  })
  const [result, setResult] = useState<null | {
    faiz: number
    toplam: number
    gunSayisi: number
    detay: { donem: string; gun: number; oran: number; faiz: number }[]
  }>(null)

  function hesapla() {
    if (!form.baslangic || !form.bitis || form.anapara <= 0) return

    const start = new Date(form.baslangic)
    const end = new Date(form.bitis)
    const totalDays = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (totalDays <= 0) return

    if (form.faizTuru === 'ozel') {
      const faiz = (form.anapara * form.ozelOran * totalDays) / (100 * 365)
      setResult({
        faiz,
        toplam: form.anapara + faiz,
        gunSayisi: totalDays,
        detay: [
          {
            donem: `${form.baslangic} - ${form.bitis}`,
            gun: totalDays,
            oran: form.ozelOran,
            faiz,
          },
        ],
      })
      return
    }

    const rates =
      form.faizTuru === 'yasal' ? YASAL_FAIZ_ORANLARI : TICARI_AVANS_ORANLARI
    const detay: { donem: string; gun: number; oran: number; faiz: number }[] =
      []
    let totalFaiz = 0
    let cursor = new Date(start)

    const sortedRates = [...rates].sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
    )

    while (cursor < end) {
      let oran = sortedRates[sortedRates.length - 1].oran
      for (const r of sortedRates) {
        if (cursor >= new Date(r.start)) {
          oran = r.oran
          break
        }
      }
      let periodEnd = new Date(end)
      for (const r of sortedRates) {
        const rDate = new Date(r.start)
        if (rDate > cursor && rDate < periodEnd) {
          periodEnd = rDate
        }
      }
      const gun = Math.floor(
        (periodEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (gun > 0) {
        const faiz = (form.anapara * oran * gun) / (100 * 365)
        detay.push({
          donem: `${cursor.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`,
          gun,
          oran,
          faiz,
        })
        totalFaiz += faiz
      }
      cursor = periodEnd
    }

    setResult({
      faiz: totalFaiz,
      toplam: form.anapara + totalFaiz,
      gunSayisi: totalDays,
      detay,
    })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 3095 s. Kanuni Faiz ve Temerrut Faizine Iliskin Kanun" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Faiz Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Anapara (TL)</label>
            <input
              type="number"
              className={inputCls}
              value={form.anapara || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  anapara: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Baslangic tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.baslangic}
              onChange={(e) =>
                setForm((p) => ({ ...p, baslangic: e.target.value }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Bitis tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.bitis}
              onChange={(e) =>
                setForm((p) => ({ ...p, bitis: e.target.value }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Faiz turu</label>
            <select
              className={selectCls}
              value={form.faizTuru}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  faizTuru: e.target.value as 'yasal' | 'ticari' | 'ozel',
                }))
              }
            >
              <option value="yasal">Yasal faiz</option>
              <option value="ticari">Ticari avans faizi</option>
              <option value="ozel">Ozel oran</option>
            </select>
          </div>
          {form.faizTuru === 'ozel' && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Ozel oran (%)</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={form.ozelOran || ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    ozelOran: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          )}
        </div>
      </fieldset>

      <button className={btnCls} onClick={hesapla}>
        Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 text-sm space-y-1">
            <p>
              <strong>Toplam gun:</strong> {result.gunSayisi}
            </p>
            <p>
              <strong>Toplam faiz:</strong> {formatCurrency(result.faiz)}
            </p>
            <p>
              <strong>Anapara + Faiz:</strong> {formatCurrency(result.toplam)}
            </p>
          </div>
          <ResultTable
            headers={['Donem', 'Gun', 'Oran (%)', 'Faiz (TL)']}
            rows={result.detay.map((d) => [d.donem, d.gun, d.oran, d.faiz])}
          />
        </div>
      )}
    </div>
  )
}

// ─── TAB 5: Is/Trafik Kazasi Tazminat ──────────────────────────────────────

function KazaTazminatTab() {
  const [form, setForm] = useState({
    dogumTarihi: '',
    kazaTarihi: '',
    hesapTarihi: '',
    cinsiyet: 'E' as 'E' | 'K',
    maluliyetOrani: 0,
    kusurOrani: 100,
    aylikGelir: 0,
  })
  const [result, setResult] = useState<null | {
    yas: number
    bakiyeOmur: number
    calismaSuresi: number
    pasifDonem: number
    aktiveTazminat: number
    pasifTazminat: number
    toplamTazminat: number
    kusurluTazminat: number
  }>(null)

  function hesapla() {
    if (!form.dogumTarihi || !form.kazaTarihi || !form.hesapTarihi) return

    const dogum = new Date(form.dogumTarihi)
    const kaza = new Date(form.kazaTarihi)

    const yas = Math.floor(
      (kaza.getTime() - dogum.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    )
    const ortalamOmur = form.cinsiyet === 'E' ? 74.2 : 79.1
    const bakiyeOmur = Math.max(0, ortalamOmur - yas)
    const calismaYasi = 65
    const calismaSuresi = Math.max(0, Math.min(calismaYasi - yas, bakiyeOmur))
    const pasifDonem = Math.max(0, bakiyeOmur - calismaSuresi)

    const yillikGelir = form.aylikGelir * 12
    const malKatsayi = form.maluliyetOrani / 100

    let aktiveToplam = 0
    for (let y = 0; y < calismaSuresi; y++) {
      const artmisGelir = yillikGelir * Math.pow(1.1, y)
      const iskontolu = artmisGelir / Math.pow(1.1, y)
      aktiveToplam += iskontolu
    }
    const aktiveTazminat = aktiveToplam * malKatsayi

    const asgariYillik = 33030 * 12
    let pasifToplam = 0
    for (let y = 0; y < pasifDonem; y++) {
      pasifToplam += asgariYillik / Math.pow(1.1, y)
    }
    const pasifTazminat = pasifToplam * malKatsayi

    const toplamTazminat = aktiveTazminat + pasifTazminat
    const kusurluTazminat = toplamTazminat * (form.kusurOrani / 100)

    setResult({
      yas,
      bakiyeOmur,
      calismaSuresi,
      pasifDonem,
      aktiveTazminat,
      pasifTazminat,
      toplamTazminat,
      kusurluTazminat,
    })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 6098 s. TBK m.49-58, TRH2010 Yasam Tablosu" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Kisi Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Dogum tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.dogumTarihi}
              onChange={(e) =>
                setForm((p) => ({ ...p, dogumTarihi: e.target.value }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Kaza tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.kazaTarihi}
              onChange={(e) =>
                setForm((p) => ({ ...p, kazaTarihi: e.target.value }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Hesap tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.hesapTarihi}
              onChange={(e) =>
                setForm((p) => ({ ...p, hesapTarihi: e.target.value }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Cinsiyet</label>
            <select
              className={selectCls}
              value={form.cinsiyet}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  cinsiyet: e.target.value as 'E' | 'K',
                }))
              }
            >
              <option value="E">Erkek</option>
              <option value="K">Kadin</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Hesaplama Parametreleri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Maluliyet orani (%)</label>
            <input
              type="number"
              className={inputCls}
              value={form.maluliyetOrani || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  maluliyetOrani: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Kusur oranı (%)</label>
            <input
              type="number"
              className={inputCls}
              value={form.kusurOrani || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  kusurOrani: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Aylik gelir (TL)</label>
            <input
              type="number"
              className={inputCls}
              value={form.aylikGelir || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  aylikGelir: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>
      </fieldset>

      <button className={btnCls} onClick={hesapla}>
        Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 text-sm space-y-1">
            <p>
              <strong>Kaza anindaki yas:</strong> {result.yas}
            </p>
            <p>
              <strong>Bakiye omur:</strong> {result.bakiyeOmur.toFixed(1)} yil
            </p>
            <p>
              <strong>Aktif calisma suresi:</strong>{' '}
              {result.calismaSuresi.toFixed(1)} yil
            </p>
            <p>
              <strong>Pasif donem:</strong> {result.pasifDonem.toFixed(1)} yil
            </p>
          </div>
          <ResultTable
            headers={['Kalem', 'Tutar (TL)']}
            rows={[
              ['Aktif donem tazminati', result.aktiveTazminat],
              ['Pasif donem tazminati', result.pasifTazminat],
              ['Toplam (kusur oncesi)', result.toplamTazminat],
              [
                `Kusur orani uygulanmis (%${form.kusurOrani})`,
                result.kusurluTazminat,
              ],
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Not: Bu hesaplama yaklasik bir deger verir. Kesin hesap icin
            bilirkisi raporu gereklidir. Progresif rant yontemi (%10 artis, %10
            iskonto) uygulanmistir.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── TAB 5b: Harc Hesaplama ─────────────────────────────────────────────────

type DavaMahkemesi = 'asliye-hukuk' | 'sulh-hukuk' | 'is-mahkemesi' | 'aile' | 'ticaret' | 'tuketici' | 'idare' | 'vergi' | 'icra'

const MAKTU_BASVURMA_HARCI: Record<DavaMahkemesi, number> = {
  'asliye-hukuk': 427.60,
  'sulh-hukuk': 427.60,
  'is-mahkemesi': 427.60,
  'aile': 427.60,
  'ticaret': 427.60,
  'tuketici': 427.60,
  'idare': 427.60,
  'vergi': 427.60,
  'icra': 427.60,
}

const HARC_SABITLERI = {
  nispiBasvurmaBinde: 6.831,
  nispiKararBinde: 11.40,
  vekaletSuret: 32.50,
  tebligatNormal: 142.50,
  tebligatAps: 165.00,
  bilirkisiOrtalama: 3000,
  kesifOrtalama: 5000,
  tanikTazminati: 100,
  postaMuzekkere: 500,
  tarafBasinaTebligat: 200,
}

interface HarcResult {
  maktuBasvurma: number
  nispiBasvurma: number
  nispiKarar: number
  pesinHarc: number
  vekaletSuret: number
  giderAvansi: number
  giderDetay: { kalem: string; tutar: number }[]
  toplamOnOdeme: number
  bakiyeKararHarci: number
}

function HarcTab() {
  const [form, setForm] = useState({
    mahkeme: 'asliye-hukuk' as DavaMahkemesi,
    davaDegeri: 0,
    harcTuru: 'nispi' as 'nispi' | 'maktu',
    tarafSayisi: 2,
    tanikSayisi: 2,
    bilirkisiGerekli: true,
    kesifGerekli: false,
  })
  const [result, setResult] = useState<HarcResult | null>(null)

  function hesapla() {
    const maktuBasvurma = MAKTU_BASVURMA_HARCI[form.mahkeme]

    let nispiBasvurma = 0
    let nispiKarar = 0
    let pesinHarc = 0

    if (form.harcTuru === 'nispi' && form.davaDegeri > 0) {
      nispiBasvurma = form.davaDegeri * (HARC_SABITLERI.nispiBasvurmaBinde / 1000)
      nispiKarar = form.davaDegeri * (HARC_SABITLERI.nispiKararBinde / 1000)
      pesinHarc = nispiKarar / 4
    }

    const vekaletSuret = HARC_SABITLERI.vekaletSuret

    const giderDetay: { kalem: string; tutar: number }[] = []
    const tebligatTutar = HARC_SABITLERI.tarafBasinaTebligat * form.tarafSayisi
    giderDetay.push({ kalem: `Tebligat (${form.tarafSayisi} taraf x ${formatCurrency(HARC_SABITLERI.tarafBasinaTebligat)})`, tutar: tebligatTutar })

    if (form.bilirkisiGerekli) {
      giderDetay.push({ kalem: 'Bilirkisi ucreti (ortalama)', tutar: HARC_SABITLERI.bilirkisiOrtalama })
    }
    if (form.kesifGerekli) {
      giderDetay.push({ kalem: 'Kesif ucreti (ortalama)', tutar: HARC_SABITLERI.kesifOrtalama })
    }
    if (form.tanikSayisi > 0) {
      const tanikTutar = HARC_SABITLERI.tanikTazminati * form.tanikSayisi
      giderDetay.push({ kalem: `Tanik tazminati (${form.tanikSayisi} tanik x ${formatCurrency(HARC_SABITLERI.tanikTazminati)})`, tutar: tanikTutar })
    }
    giderDetay.push({ kalem: 'Posta/muzekkere', tutar: HARC_SABITLERI.postaMuzekkere })

    const giderAvansi = giderDetay.reduce((s, d) => s + d.tutar, 0)

    const basvurmaHarci = form.harcTuru === 'nispi' ? Math.max(maktuBasvurma, nispiBasvurma) : maktuBasvurma
    const toplamOnOdeme = basvurmaHarci + pesinHarc + vekaletSuret + giderAvansi
    const bakiyeKararHarci = nispiKarar > 0 ? nispiKarar - pesinHarc : 0

    setResult({
      maktuBasvurma,
      nispiBasvurma,
      nispiKarar,
      pesinHarc,
      vekaletSuret,
      giderAvansi,
      giderDetay,
      toplamOnOdeme,
      bakiyeKararHarci,
    })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 492 s. Harclar Kanunu, 2026 Harclar Kanunu Genel Tebligi" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Dava Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Mahkeme turu</label>
            <select
              className={selectCls}
              value={form.mahkeme}
              onChange={(e) => setForm((p) => ({ ...p, mahkeme: e.target.value as DavaMahkemesi }))}
            >
              <option value="asliye-hukuk">Asliye Hukuk</option>
              <option value="sulh-hukuk">Sulh Hukuk</option>
              <option value="is-mahkemesi">İş Mahkemesi</option>
              <option value="aile">Aile Mahkemesi</option>
              <option value="ticaret">Ticaret Mahkemesi</option>
              <option value="tuketici">Tüketici Mahkemesi</option>
              <option value="idare">İdare Mahkemesi</option>
              <option value="vergi">Vergi Mahkemesi</option>
              <option value="icra">İcra Dairesi</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Harc turu</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="harc-turu"
                  checked={form.harcTuru === 'nispi'}
                  onChange={() => setForm((p) => ({ ...p, harcTuru: 'nispi' }))}
                />
                Nispi
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="harc-turu"
                  checked={form.harcTuru === 'maktu'}
                  onChange={() => setForm((p) => ({ ...p, harcTuru: 'maktu' }))}
                />
                Maktu
              </label>
            </div>
          </div>
          {form.harcTuru === 'nispi' && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Dava degeri (TL)</label>
              <input
                type="number"
                className={inputCls}
                value={form.davaDegeri || ''}
                onChange={(e) => setForm((p) => ({ ...p, davaDegeri: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Taraf sayisi</label>
            <input
              type="number"
              className={inputCls}
              min={2}
              value={form.tarafSayisi || ''}
              onChange={(e) => setForm((p) => ({ ...p, tarafSayisi: Math.max(2, parseInt(e.target.value) || 2) }))}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Gider Avansi Kalemleri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Tanik sayisi</label>
            <input
              type="number"
              className={inputCls}
              min={0}
              value={form.tanikSayisi || ''}
              onChange={(e) => setForm((p) => ({ ...p, tanikSayisi: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="min-w-[200px] flex items-end gap-2">
            <input
              type="checkbox"
              id="bilirkisi"
              checked={form.bilirkisiGerekli}
              onChange={(e) => setForm((p) => ({ ...p, bilirkisiGerekli: e.target.checked }))}
            />
            <label htmlFor="bilirkisi" className="text-sm font-medium">Bilirkisi gerekli</label>
          </div>
          <div className="min-w-[200px] flex items-end gap-2">
            <input
              type="checkbox"
              id="kesif"
              checked={form.kesifGerekli}
              onChange={(e) => setForm((p) => ({ ...p, kesifGerekli: e.target.checked }))}
            />
            <label htmlFor="kesif" className="text-sm font-medium">Kesif gerekli</label>
          </div>
        </div>
      </fieldset>

      <button className={btnCls} onClick={hesapla}>
        Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">On Odeme Tablosu</h3>
          <ResultTable
            headers={['Kalem', 'Tutar (TL)']}
            rows={[
              [
                form.harcTuru === 'nispi' && result.nispiBasvurma > result.maktuBasvurma
                  ? `Basvurma harci (nispi: binde ${HARC_SABITLERI.nispiBasvurmaBinde})`
                  : 'Basvurma harci (maktu)',
                form.harcTuru === 'nispi'
                  ? Math.max(result.maktuBasvurma, result.nispiBasvurma)
                  : result.maktuBasvurma,
              ],
              ...(result.pesinHarc > 0
                ? [['Pesin harc (karar harcinin 1/4)' as string | number, result.pesinHarc as string | number] as (string | number)[]]
                : []),
              ['Vekalet suret harci', result.vekaletSuret],
              ...result.giderDetay.map(
                (d) => [d.kalem, d.tutar] as (string | number)[]
              ),
              ['TOPLAM ON ODEME', result.toplamOnOdeme],
            ]}
          />

          {result.nispiKarar > 0 && (
            <>
              <h3 className="text-sm font-semibold mt-4">Dava Sonunda Odenecek</h3>
              <ResultTable
                headers={['Kalem', 'Tutar (TL)']}
                rows={[
                  ['Karar ve ilam harci (toplam)', result.nispiKarar],
                  ['Pesin harc (on odeme ile odendr)', result.pesinHarc],
                  ['Bakiye karar harci', result.bakiyeKararHarci],
                ]}
              />
            </>
          )}

          <WarningBadge text="Harc tutarlari 2026 yili Harclar Kanunu Genel Tebligine goredir. UYAP uzerinden dogrulayiniz." />

          <div className="rounded-lg border bg-muted/30 p-4 text-xs space-y-1">
            <p><strong>Diğer masraflar (referans):</strong></p>
            <p>Tebligat (normal): {formatCurrency(HARC_SABITLERI.tebligatNormal)} | Tebligat (APS): {formatCurrency(HARC_SABITLERI.tebligatAps)}</p>
            <p>Nispi basvurma harci: binde {HARC_SABITLERI.nispiBasvurmaBinde} | Nispi karar harci: binde {HARC_SABITLERI.nispiKararBinde}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB 5c: Kira Sureleri ──────────────────────────────────────────────────

type TahliyeNedeni =
  | 'konut-ihtiyaci'
  | 'yeni-malik'
  | 'esasli-tadilat'
  | 'tahliye-taahhut'
  | 'ayni-ilce-konut'
  | 'iki-hakli-ihtar'
  | '10-yillik-uzama'
  | 'kira-odememe'
  | 'ozenle-kullanma'
  | 'komsulara-saygisizlik'

const TAHLIYE_NEDENLERI: { value: TahliyeNedeni; label: string; madde: string }[] = [
  { value: 'konut-ihtiyaci', label: 'Kiraya verenin konut ihtiyaci', madde: 'TBK 350/1' },
  { value: 'yeni-malik', label: 'Yeni malikin ihtiyaci', madde: 'TBK 351' },
  { value: 'esasli-tadilat', label: 'Esasli tamir/tadilat', madde: 'TBK 350/2' },
  { value: 'tahliye-taahhut', label: 'Kiracının tahliye taahhütnamesi', madde: 'TBK 352/1' },
  { value: 'ayni-ilce-konut', label: 'Ayni ilce/beldede konutu olma', madde: 'TBK 352/3' },
  { value: 'iki-hakli-ihtar', label: 'Iki hakli ihtar', madde: 'TBK 352/2' },
  { value: '10-yillik-uzama', label: '10 yillik uzama sonrasi', madde: 'TBK 347' },
  { value: 'kira-odememe', label: 'Kira bedelinin odenmemesi', madde: 'TBK 315' },
  { value: 'ozenle-kullanma', label: 'Ozenle kullanma yukumlulugu ihlali', madde: 'TBK 316' },
  { value: 'komsulara-saygisizlik', label: 'Komsulara saygisizlik / rahatsizlik', madde: 'TBK 316' },
]

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function formatTarih(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

interface KiraSureResult {
  items: { label: string; tarih: string; uyari?: boolean }[]
  notlar: string[]
  kanunMaddesi: string
}

function calcKiraSureleri(
  _baslangic: Date,
  bitis: Date,
  neden: TahliyeNedeni,
  edinmeTarihi?: Date,
  taahutTarihi?: Date,
): KiraSureResult {
  const items: KiraSureResult['items'] = []
  const notlar: string[] = []
  const nedenInfo = TAHLIYE_NEDENLERI.find((n) => n.value === neden)
  const kanunMaddesi = nedenInfo?.madde || ''

  switch (neden) {
    case 'konut-ihtiyaci': {
      const ihtarSonTarih = addMonths(bitis, -3)
      const davaBaslangic = new Date(bitis)
      const davaSonTarih = addMonths(bitis, 1)
      items.push({ label: 'Ihtarname gonderme son tarihi', tarih: formatTarih(ihtarSonTarih), uyari: true })
      items.push({ label: 'Dava acma baslangic tarihi', tarih: formatTarih(davaBaslangic) })
      items.push({ label: 'Dava acma son tarihi', tarih: formatTarih(davaSonTarih), uyari: true })
      notlar.push('Kira bitis tarihinden en az 3 ay once ihtarname gonderilmelidir.')
      notlar.push('Dava sozlesme bitiminden itibaren 1 ay icinde acilmalidir.')
      notlar.push('Tahliye sonrasi 3 yil yeniden kiraya verilemez.')
      break
    }
    case 'yeni-malik': {
      if (edinmeTarihi) {
        const ihtarSonTarih = addMonths(edinmeTarihi, 1)
        const dava6ay = addMonths(edinmeTarihi, 6)
        const kiraBitis = new Date(bitis)
        const davaBaslangic = dava6ay < kiraBitis ? dava6ay : kiraBitis
        items.push({ label: 'Ihtarname gonderme son tarihi (edinmeden 1 ay)', tarih: formatTarih(ihtarSonTarih), uyari: true })
        items.push({ label: 'Dava acma (edinmeden 6 ay sonra)', tarih: formatTarih(dava6ay) })
        items.push({ label: 'Dava acma (kira bitis tarihi)', tarih: formatTarih(kiraBitis) })
        items.push({ label: 'Uygulanacak dava tarihi (once gelen)', tarih: formatTarih(davaBaslangic), uyari: true })
      } else {
        items.push({ label: 'Edinme tarihi girilmedi', tarih: '-', uyari: true })
      }
      notlar.push('Edinme tarihinden itibaren 1 ay icinde ihtarname gonderilmelidir.')
      notlar.push('Edinmeden 6 ay sonra VEYA kira bitis tarihinde dava acilir (hangisi once ise).')
      break
    }
    case 'esasli-tadilat': {
      const davaBaslangic = new Date(bitis)
      const davaSonTarih = addMonths(bitis, 1)
      items.push({ label: 'Dava acma baslangic tarihi', tarih: formatTarih(davaBaslangic) })
      items.push({ label: 'Dava acma son tarihi', tarih: formatTarih(davaSonTarih), uyari: true })
      notlar.push('Sozlesme bitiminden itibaren 1 ay icinde dava acilmalidir.')
      notlar.push('Tahliye sonrasi 3 yil eski kiraciya oncelik hakki vardir.')
      notlar.push('Tadilat surecinde tasinmazin kullanilmasinin imkansiz olmasi gerekir.')
      break
    }
    case 'tahliye-taahhut': {
      if (taahutTarihi) {
        const icraVeyaDavaSon = addMonths(taahutTarihi, 1)
        items.push({ label: 'Taahhut edilen tarih', tarih: formatTarih(taahutTarihi) })
        items.push({ label: 'Icra/dava son tarihi (taahhut tarihinden 1 ay)', tarih: formatTarih(icraVeyaDavaSon), uyari: true })
      } else {
        items.push({ label: 'Taahhut tarihi girilmedi', tarih: '-', uyari: true })
      }
      notlar.push('Taahhutname kira sozlesmesi baslangicindan SONRA verilmis olmalidir.')
      notlar.push('Taahhut edilen tarihten itibaren 1 ay icinde icra takibi veya dava acilmalidir.')
      break
    }
    case 'ayni-ilce-konut': {
      const davaSonTarih = addMonths(bitis, 1)
      items.push({ label: 'Dava acma son tarihi', tarih: formatTarih(davaSonTarih), uyari: true })
      notlar.push('Sozlesme bitiminden itibaren 1 ay icinde dava acilmalidir.')
      notlar.push('Kiracinin ayni ilce veya beldede konutunun bulundugu kanitlanmalidir.')
      break
    }
    case 'iki-hakli-ihtar': {
      const sonrakiYilBaslangic = addYears(bitis, 1)
      const davaSonTarih = addMonths(sonrakiYilBaslangic, 1)
      items.push({ label: 'Sonraki kira yili baslangici', tarih: formatTarih(sonrakiYilBaslangic) })
      items.push({ label: 'Dava acma son tarihi', tarih: formatTarih(davaSonTarih), uyari: true })
      notlar.push('Bir kira yili icinde 2 hakli ihtar yapilmis olmalidir.')
      notlar.push('Dava sonraki kira yilinin basindan itibaren 1 ay icinde acilmalidir.')
      break
    }
    case '10-yillik-uzama': {
      const onYilSonrasi = addYears(bitis, 10)
      const fesihBildirimSon = addMonths(onYilSonrasi, -3)
      const birSonrakiYil = addYears(onYilSonrasi, 1)
      const birSonrakiFesihSon = addMonths(birSonrakiYil, -3)
      items.push({ label: '10 yillik uzama suresi dolusu', tarih: formatTarih(onYilSonrasi) })
      items.push({ label: 'Fesih bildirimi son tarihi (3 ay once)', tarih: formatTarih(fesihBildirimSon), uyari: true })
      items.push({ label: 'Fesih yapilmazsa sonraki firsat', tarih: formatTarih(birSonrakiFesihSon) })
      notlar.push('10 yillik uzama suresi doldugunda, her uzama yili sonundan en az 3 ay once fesih bildirimi yapilmalidir.')
      notlar.push('Bildirim yapilmazsa sozlesme 1 yil daha uzar, her yil ayni hak tekrar dogar.')
      break
    }
    case 'kira-odememe': {
      const ihtarSureSonu = addDays(new Date(), 30)
      items.push({ label: 'Ihtarname ile 30 gun sure verilir', tarih: formatTarih(new Date()), uyari: true })
      items.push({ label: 'Sure dolum tarihi (dava acilabilir)', tarih: formatTarih(ihtarSureSonu) })
      notlar.push('Kiraciya 30 gun sure verilerek ihtarname gonderilmelidir.')
      notlar.push('Sure icerisinde odeme yapilmazsa tahliye davasi acilabilir.')
      break
    }
    case 'ozenle-kullanma':
    case 'komsulara-saygisizlik': {
      const ihtarSureSonu = addDays(new Date(), 30)
      items.push({ label: 'Ihtarname ile 30 gun sure verilir', tarih: formatTarih(new Date()), uyari: true })
      items.push({ label: 'Sure dolum tarihi (dava acilabilir)', tarih: formatTarih(ihtarSureSonu) })
      notlar.push('Kiraciya yazili olarak 30 gun sure verilmelidir.')
      notlar.push('Sure icerisinde aykirilik giderilmezse fesih hakki dogar.')
      break
    }
  }

  return { items, notlar, kanunMaddesi }
}

function KiraSureleriTab() {
  const [form, setForm] = useState({
    baslangic: '',
    bitis: '',
    neden: 'konut-ihtiyaci' as TahliyeNedeni,
    edinmeTarihi: '',
    taahutTarihi: '',
    mevcutKira: 0,
    tufeOrani: 0,
  })
  const [result, setResult] = useState<KiraSureResult | null>(null)
  const [kiraArtis, setKiraArtis] = useState<{ yeniKira: number; artis: number } | null>(null)

  const nedenlerRequiringEdinme: TahliyeNedeni[] = ['yeni-malik']
  const nedenlerRequiringTaahut: TahliyeNedeni[] = ['tahliye-taahhut']

  function hesaplaSureler() {
    if (!form.baslangic || !form.bitis) {
      toast.error('Kira sozlesmesi baslangic ve bitis tarihleri zorunludur.')
      return
    }

    const baslangic = new Date(form.baslangic)
    const bitis = new Date(form.bitis)
    const edinme = form.edinmeTarihi ? new Date(form.edinmeTarihi) : undefined
    const taahut = form.taahutTarihi ? new Date(form.taahutTarihi) : undefined

    setResult(calcKiraSureleri(baslangic, bitis, form.neden, edinme, taahut))
  }

  function hesaplaKiraArtisi() {
    if (form.mevcutKira <= 0 || form.tufeOrani <= 0) {
      toast.error('Mevcut kira ve TUFE orani giriniz.')
      return
    }
    const artis = form.mevcutKira * (form.tufeOrani / 100)
    const yeniKira = form.mevcutKira + artis
    setKiraArtis({ yeniKira, artis })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 6098 s. TBK m.315, 316, 347, 350-352" />

      {/* Tahliye sure hesaplama */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Kira Sozlesmesi Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Sozlesme baslangic tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.baslangic}
              onChange={(e) => setForm((p) => ({ ...p, baslangic: e.target.value }))}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Sozlesme bitis tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.bitis}
              onChange={(e) => setForm((p) => ({ ...p, bitis: e.target.value }))}
            />
          </div>
          <div className="min-w-[280px]">
            <label className="text-sm font-medium">Tahliye nedeni</label>
            <select
              className={selectCls}
              value={form.neden}
              onChange={(e) => setForm((p) => ({ ...p, neden: e.target.value as TahliyeNedeni }))}
            >
              {TAHLIYE_NEDENLERI.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label} ({n.madde})
                </option>
              ))}
            </select>
          </div>
          {nedenlerRequiringEdinme.includes(form.neden) && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Tasinmaz edinme tarihi</label>
              <input
                type="date"
                className={inputCls}
                value={form.edinmeTarihi}
                onChange={(e) => setForm((p) => ({ ...p, edinmeTarihi: e.target.value }))}
              />
            </div>
          )}
          {nedenlerRequiringTaahut.includes(form.neden) && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Taahhut edilen tahliye tarihi</label>
              <input
                type="date"
                className={inputCls}
                value={form.taahutTarihi}
                onChange={(e) => setForm((p) => ({ ...p, taahutTarihi: e.target.value }))}
              />
            </div>
          )}
        </div>
      </fieldset>

      <button className={btnCls} onClick={hesaplaSureler}>
        Sureleri Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">
              Sure Tablosu — {TAHLIYE_NEDENLERI.find((n) => n.value === form.neden)?.label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">({result.kanunMaddesi})</span>
            </h3>
            <div className="space-y-2">
              {result.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                    item.uyari ? 'bg-amber-50 border border-amber-200' : 'bg-muted/30'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`font-medium ${item.uyari ? 'text-amber-800' : ''}`}>
                    {item.tarih}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.notlar.length > 0 && (
            <div className="space-y-1">
              {result.notlar.map((n, i) => (
                <WarningBadge key={i} text={n} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 10 Yillik Uzama Hesabi */}
      {form.baslangic && form.bitis && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
          <p className="font-medium text-muted-foreground">10 Yıllık Uzama Hesabı (TBK m.347)</p>
          {(() => {
            const bitis = new Date(form.bitis)
            const onYil = addYears(bitis, 10)
            const fesihSon = addMonths(onYil, -3)
            return (
              <>
                <p>Sozlesme bitis: <strong>{formatTarih(bitis)}</strong></p>
                <p>10 yillik uzama dolusu: <strong>{formatTarih(onYil)}</strong></p>
                <p>Fesih bildirimi son tarih: <strong className="text-amber-700">{formatTarih(fesihSon)}</strong></p>
                <p className="text-xs text-muted-foreground">Fesih yapilmazsa sozlesme 1 yil daha uzar, her yil ayni hak tekrar dogar.</p>
              </>
            )
          })()}
        </div>
      )}

      {/* Kira artis hesaplama */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Kira Artis Hesaplama (TBK m.344)
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Mevcut kira bedeli (TL)</label>
            <input
              type="number"
              className={inputCls}
              value={form.mevcutKira || ''}
              onChange={(e) => setForm((p) => ({ ...p, mevcutKira: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">TUFE 12 aylik ortalama (%)</label>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.tufeOrani || ''}
              onChange={(e) => setForm((p) => ({ ...p, tufeOrani: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="min-w-[200px] flex items-end">
            <button className={btnCls} onClick={hesaplaKiraArtisi}>
              Artis Hesapla
            </button>
          </div>
        </div>

        {kiraArtis && (
          <div className="mt-3">
            <ResultTable
              headers={['Kalem', 'Tutar (TL)']}
              rows={[
                ['Mevcut kira', form.mevcutKira],
                [`Artis tutari (%${form.tufeOrani})`, kiraArtis.artis],
                ['Yeni kira bedeli', kiraArtis.yeniKira],
              ]}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          TBK m.344: Konut kiralarinda kira artisi bir onceki kira yilina ait TUFE 12 aylik ortalamasini gecemez.
          2024 Temmuz sonrasi %25 tavan uygulamasi kaldirilmistir, sadece TUFE siniri gecerlidir.
        </p>
      </fieldset>
    </div>
  )
}

// ─── TABS ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'iscilik', label: 'İşçilik Alacakları' },
  { id: 'vekalet', label: 'Vekâlet Ücreti' },
  { id: 'arabulucu', label: 'Arabulucu Ücreti' },
  { id: 'faiz', label: 'Faiz Hesaplama' },
  { id: 'harc', label: 'Harç Hesaplama' },
  { id: 'kira', label: 'Kira Süreleri' },
  { id: 'kaza', label: 'Kaza Tazminatı' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function CalculationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('iscilik')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hesaplamalar"
        description="Hukuki hesaplama araçları — işçilik alacakları, vekâlet ücreti, arabulucu ücreti, faiz, harç, kira süreleri ve kaza tazminatı"
      />

      {/* Tab buttons */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-lg border bg-card p-6">
        {activeTab === 'iscilik' && <IscilikTab />}
        {activeTab === 'vekalet' && <VekaletTab />}
        {activeTab === 'arabulucu' && <ArabulucuTab />}
        {activeTab === 'faiz' && <FaizTab />}
        {activeTab === 'harc' && <HarcTab />}
        {activeTab === 'kira' && <KiraSureleriTab />}
        {activeTab === 'kaza' && <KazaTazminatTab />}
      </div>
    </div>
  )
}
