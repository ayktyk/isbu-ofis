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

// AAÜT 2025-2026 aşama indirimleri (T1 sayılı tarife — genel hükümler).
// Karar aşamasındaki tam tarife "1.0" kabul edilir; diğer aşamalar bu
// oran üzerinden uygulanır.
type VekaletAsama =
  | 'karar'
  | 'on-inceleme-oncesi'
  | 'on-inceleme-sonrasi'
  | 'istinaf'
  | 'temyiz'
  | 'icra-takip-itirazli'

const ASAMA_OPTIONS: { id: VekaletAsama; label: string; oran: number; not: string }[] = [
  { id: 'karar', label: 'Karar (tahkikat sonrası)', oran: 1.0, not: 'Tam tarife uygulanır.' },
  { id: 'on-inceleme-oncesi', label: 'Ön inceleme öncesi sulh', oran: 0.5, not: 'Tarifedeki ücretin yarısı.' },
  { id: 'on-inceleme-sonrasi', label: 'Ön inceleme sonrası — karar öncesi', oran: 0.75, not: 'Tarifedeki ücretin 3/4’ü.' },
  { id: 'istinaf', label: 'İstinaf duruşmalı', oran: 0.50, not: 'Tarifedeki ücretin yarısı (duruşmasızda 1/4).' },
  { id: 'temyiz', label: 'Temyiz duruşmalı', oran: 0.50, not: 'Tarifedeki ücretin yarısı (duruşmasızda 1/4).' },
  { id: 'icra-takip-itirazli', label: 'İcra takibi (itirazsız)', oran: 1.0, not: 'AAÜT İcra ve İflas tarifesinden gelir.' },
]

const MAHKEME_LABELS: Record<string, string> = {
  'sulh-hukuk': 'Sulh Hukuk',
  'asliye-hukuk': 'Asliye Hukuk',
  'asliye-ticaret': 'Asliye Ticaret',
  'is': 'İş Mahkemesi',
  'aile': 'Aile Mahkemesi',
  'tuketici': 'Tüketici Mahkemesi',
  'asliye-ceza': 'Asliye Ceza',
  'agir-ceza': 'Ağır Ceza',
  'idare-durusmasiz': 'İdare (Duruşmasız)',
  'idare-durusmali': 'İdare (Duruşmalı)',
  'vergi-durusmasiz': 'Vergi (Duruşmasız)',
  'vergi-durusmali': 'Vergi (Duruşmalı)',
  'icra-takip': 'İcra Takip Dairesi',
  'icra-mah-is': 'İcra Mahkemesi (İşler)',
  'icra-mah-dava': 'İcra Mahkemesi (Davalar)',
  'sorusturma': 'Soruşturma (Cumhuriyet Savcılığı)',
  'sulh-ceza': 'Sulh Ceza Hâkimliği',
  'cocuk': 'Çocuk Mahkemesi',
  'cocuk-agir': 'Çocuk Ağır Ceza',
}

function VekaletTab() {
  const [form, setForm] = useState({
    mahkemeTuru: 'asliye-hukuk',
    davaTuru: 'nispi' as 'nispi' | 'maktu',
    asama: 'karar' as VekaletAsama,
    davaDegeri: 0,
    seriDavaSayisi: 0,
  })
  const [result, setResult] = useState<null | {
    nispiHam: number
    maktuAlt: number
    tarifeUcret: number
    asamaOrani: number
    asamaSonrasi: number
    seriIndirimi: number
    netUcret: number
    kdv: number
    stopaj: number
    netOdeme: number
    aciklamalar: string[]
  }>(null)

  function hesapla() {
    const aciklamalar: string[] = []
    const maktuAlt = AAUT_MAKTU_UCRETLER[form.mahkemeTuru] || 0
    let nispiHam = 0

    if (form.davaTuru === 'nispi') {
      let remaining = form.davaDegeri
      let prevLimit = 0
      for (const d of AAUT_NISPI_DILIMLER) {
        const band = Math.min(remaining, d.limit - prevLimit)
        if (band <= 0) break
        nispiHam += band * d.oran
        remaining -= band
        prevLimit = d.limit
      }
    }

    let tarifeUcret = form.davaTuru === 'maktu' ? maktuAlt : Math.max(nispiHam, maktuAlt)
    if (form.davaTuru === 'nispi') {
      if (nispiHam < maktuAlt) {
        aciklamalar.push(`Nispi hesap (${formatCurrency(nispiHam)}) maktu alt sınırın (${formatCurrency(maktuAlt)}) altında kaldığı için maktu uygulanır (AAÜT m.13).`)
      } else {
        aciklamalar.push(`Nispi dilimli hesap uygulandı: ${formatCurrency(nispiHam)} (alt sınır ${formatCurrency(maktuAlt)} aşıldı).`)
      }
    } else {
      aciklamalar.push(`Maktu ücret: ${formatCurrency(maktuAlt)} (${MAHKEME_LABELS[form.mahkemeTuru] || form.mahkemeTuru}).`)
    }

    const asama = ASAMA_OPTIONS.find((a) => a.id === form.asama)!
    const asamaSonrasi = tarifeUcret * asama.oran
    if (asama.oran !== 1.0) {
      aciklamalar.push(`${asama.label}: ${asama.not} Sonuç ${formatCurrency(asamaSonrasi)}.`)
    }

    // Seri dava: AAÜT m.22 — aynı tutanakla birleştirilmiş benzer davalarda,
    // birinciye tam, sonrakilere 1/2 ücret. Burada kullanıcı sonraki dava
    // sayısını veriyor.
    let seriIndirimi = 0
    let netUcret = asamaSonrasi
    if (form.seriDavaSayisi > 0) {
      const sonrakilerToplam = form.seriDavaSayisi * asamaSonrasi * 0.5
      const birinci = asamaSonrasi
      const seriYeniToplam = (birinci + sonrakilerToplam) / (form.seriDavaSayisi + 1)
      seriIndirimi = asamaSonrasi - seriYeniToplam
      netUcret = seriYeniToplam
      aciklamalar.push(
        `Seri dava (AAÜT m.22): birinci davaya tam, sonraki ${form.seriDavaSayisi} davaya yarım. Dava başına ortalama ${formatCurrency(seriYeniToplam)}.`,
      )
    }

    // KDV ve stopaj — vekâlet ücreti karşı tarafça ödendiğinde:
    // KDV %20 hasıma yansıtılır; stopaj %20 müvekkilden veya hasımdan gelirse
    // gelir vergisi olarak kesilir (avukat serbest meslek erbabı).
    const kdv = netUcret * 0.20
    const stopaj = netUcret * 0.20
    const netOdeme = netUcret + kdv - stopaj

    setResult({
      nispiHam,
      maktuAlt,
      tarifeUcret,
      asamaOrani: asama.oran,
      asamaSonrasi,
      seriIndirimi,
      netUcret,
      kdv,
      stopaj,
      netOdeme,
      aciklamalar,
    })
  }

  const mahkemeOptions = Object.keys(AAUT_MAKTU_UCRETLER).map((k) => (
    <option key={k} value={k}>
      {MAHKEME_LABELS[k] || k}
    </option>
  ))

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: AAÜT 2025-2026 (Avukatlık Asgari Ücret Tarifesi, RG 21.09.2025)" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Dava Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[220px]">
            <label className="text-sm font-medium">Mahkeme türü</label>
            <select
              className={selectCls}
              value={form.mahkemeTuru}
              onChange={(e) => setForm((p) => ({ ...p, mahkemeTuru: e.target.value }))}
            >
              {mahkemeOptions}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Ücret tipi</label>
            <select
              className={selectCls}
              value={form.davaTuru}
              onChange={(e) =>
                setForm((p) => ({ ...p, davaTuru: e.target.value as 'nispi' | 'maktu' }))
              }
            >
              <option value="nispi">Nispi (konusu para olan dava)</option>
              <option value="maktu">Maktu (konusu para olmayan dava)</option>
            </select>
          </div>
          <div className="min-w-[260px]">
            <label className="text-sm font-medium">Dava aşaması</label>
            <select
              className={selectCls}
              value={form.asama}
              onChange={(e) => setForm((p) => ({ ...p, asama: e.target.value as VekaletAsama }))}
            >
              {ASAMA_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {form.davaTuru === 'nispi' && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Dava değeri (TL)</label>
              <input
                type="number"
                className={inputCls}
                value={form.davaDegeri || ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, davaDegeri: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Seri dava — sonraki dava sayısı</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.seriDavaSayisi || ''}
              placeholder="0"
              onChange={(e) =>
                setForm((p) => ({ ...p, seriDavaSayisi: parseInt(e.target.value) || 0 }))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">0 ise tek dava (seri yok). AAÜT m.22.</p>
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
            rows={[
              ['Tarife ücreti (alt sınır dâhil)', result.tarifeUcret],
              [`Aşama uygulaması (×${result.asamaOrani.toFixed(2)})`, result.asamaSonrasi],
              ...(result.seriIndirimi > 0
                ? [['Seri dava indirimi (-)' as string | number, result.seriIndirimi as string | number] as (string | number)[]]
                : []),
              ['Hesaplanan vekâlet ücreti (KDV/Stopaj öncesi)', result.netUcret],
              ['+ KDV %20', result.kdv],
              ['− Stopaj %20 (gelir vergisi)', -result.stopaj],
              ['Avukata net ödeme (KDV dâhil, stopaj düşülmüş)', result.netOdeme],
            ]}
          />

          <div className="rounded-lg border bg-muted/30 p-4 text-xs space-y-1">
            {result.aciklamalar.map((a, i) => (
              <p key={i} className="text-muted-foreground">{a}</p>
            ))}
          </div>

          <WarningBadge text="Tarife asgaridir. Sözleşmeyle daha yüksek ücret kararlaştırılabilir. Karşı tarafa yüklenen vekâlet ücreti hâkimin takdiri ile değişebilir." />
        </div>
      )}
    </div>
  )
}

// ─── TAB 3: Arabulucu Ucreti (2025-2026 ARAB. AÜT) ─────────────────────────

type ArabulucuTur =
  | 'isci-isveren'
  | 'ticari'
  | 'tuketici'
  | 'kira'
  | 'aile'
  | 'ortaklik'
  | 'idari'
  | 'diger'

type AnlasmaDurumu = 'anlasma' | 'anlasama'
type ArabulucuRejim = 'dava-sarti' | 'ihtiyari'

/**
 * Arabuluculuk Asgari Ücret Tarifesi 2025-2026 saatlik tutarları.
 * Yapı: [ilk3SaatAnlasma, sonrakiAnlasma, ilk3SaatAnlasama, sonrakiAnlasama]
 * Tutarlar mevcut tarifeye göre giriliyor; resmî tarife değişirse buradan
 * güncellenir. legalRates2026.ts'deki ARABULUCU_SAATLIK objesinden farklı
 * olarak burada "ilk 3 saat / sonraki" ve "anlaşma / anlaşamama" ayrımı
 * tutulur — uyuşmazlık türü başına 4 değer.
 */
const ARABULUCU_SAATLIK_2TARAF: Record<ArabulucuTur, [number, number, number, number]> = {
  'isci-isveren': [1000, 750, 750, 500],
  'ticari':       [1500, 1000, 1000, 750],
  'tuketici':     [600, 450, 450, 350],
  'aile':         [900, 650, 650, 500],
  'kira':         [800, 600, 600, 450],
  'ortaklik':     [1200, 900, 900, 650],
  'idari':        [900, 700, 700, 500],
  'diger':        [750, 550, 550, 400],
}

const ARABULUCU_SAATLIK_3PLUS: Record<ArabulucuTur, [number, number, number, number]> = {
  'isci-isveren': [1250, 1000, 1000, 750],
  'ticari':       [1750, 1250, 1250, 1000],
  'tuketici':     [800, 600, 600, 450],
  'aile':         [1100, 850, 850, 650],
  'kira':         [1000, 800, 800, 600],
  'ortaklik':     [1500, 1100, 1100, 850],
  'idari':        [1100, 900, 900, 650],
  'diger':        [950, 700, 700, 550],
}

const ARABULUCU_TUR_LABELS: Record<ArabulucuTur, string> = {
  'isci-isveren': 'İşçi-İşveren',
  'ticari': 'Ticari',
  'tuketici': 'Tüketici',
  'kira': 'Kira',
  'aile': 'Aile (Boşanma vb.)',
  'ortaklik': 'Ortaklığın Giderilmesi',
  'idari': 'İdari Uyuşmazlık',
  'diger': 'Diğer',
}

// Dava şartı arabuluculuğun zorunlu olduğu uyuşmazlıklar.
// İhtiyari arabuluculuk her tür için seçilebilir, ama bu liste "dava
// şartı" rejimini varsayılan olarak öneren türleri işaretler.
const DAVA_SARTI_TURLER: ArabulucuTur[] = ['isci-isveren', 'ticari', 'tuketici', 'kira']

const ARABULUCU_TUR_REF: Record<ArabulucuTur, string> = {
  'isci-isveren': '7036 SK m.3',
  'ticari': '6325 SK m.5/A, 6102 SK',
  'tuketici': '6502 SK m.73/A',
  'kira': 'HMK m.4/A (2023)',
  'aile': '6325 SK (ihtiyari)',
  'ortaklik': '6325 SK (ihtiyari)',
  'idari': '6325 SK (ihtiyari)',
  'diger': '6325 SK',
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
  bakanlikKarsiladigi: number
  taraflarinKarsiladigi: number
  kdv: number
  stopaj: number
  taraflarinNetOdemesi: number
  tarafBasina: number
  arabulucuNetGelir: number
  uyari?: string
}

function ArabulucuTab() {
  const [form, setForm] = useState({
    rejim: 'dava-sarti' as ArabulucuRejim,
    tur: 'isci-isveren' as ArabulucuTur,
    sonuc: 'anlasma' as AnlasmaDurumu,
    sure: 3,
    tarafSayisi: 2,
    deger: 0,
  })
  const [result, setResult] = useState<ArabulucuResult | null>(null)

  function hesapla() {
    if (form.sure <= 0) {
      toast.error('Toplantı süresi giriniz (saat).')
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

    // Dava şartı + anlaşamama: anlaşamama tutanağı ile sonuçlandığında
    // arabulucunun anlaşamama tarifesi üzerinden 2 saate kadar olan
    // kısmı (en fazla bu meblağ) Adalet Bakanlığı bütçesinden karşılanır.
    // Yetersiz kısım (toplantı 2 saati aşmışsa veya nispi/diğer kalemler)
    // taraflara aittir. Aile/ortaklık/idari ihtiyari arabuluculukta da
    // mevzuat aksini öngörmedikçe taraflar öder.
    let bakanlikKarsiladigi = 0
    let uyari: string | undefined
    if (form.rejim === 'dava-sarti' && !isAnlasma) {
      // ilk 2 saatlik anlaşamama bedeli
      const ilkIki = Math.min(form.sure, 2)
      const bakanlikUst = ilkIki * (rates[2])
      bakanlikKarsiladigi = Math.min(bakanlikUst, uygulananUcret)
      uyari =
        'Dava şartı arabuluculukta anlaşamama hâlinde ilk 2 saatlik anlaşamama tarifesi Adalet Bakanlığı bütçesinden karşılanır (6325 SK m.18/A-13). Aşan süre ve diğer kalemler taraflara aittir.'
    } else if (form.rejim === 'dava-sarti' && isAnlasma) {
      uyari =
        'Dava şartı arabuluculukta anlaşma hâlinde ücreti taraflar eşit oranda öder; aksi kararlaştırılabilir.'
    } else {
      uyari =
        'İhtiyari arabuluculuk: ücret tamamen taraflarca karşılanır, paylaşım taraflar arası anlaşmaya bağlıdır.'
    }

    const taraflarinKarsiladigi = Math.max(0, uygulananUcret - bakanlikKarsiladigi)
    const kdv = taraflarinKarsiladigi * 0.20
    const stopaj = taraflarinKarsiladigi * 0.20
    const taraflarinNetOdemesi = taraflarinKarsiladigi + kdv - stopaj
    const tarafBasina = taraflarinNetOdemesi / Math.max(form.tarafSayisi, 1)
    const arabulucuNetGelir = uygulananUcret - stopaj

    setResult({
      saatlikToplam,
      nispiToplam,
      uygulananUcret,
      bakanlikKarsiladigi,
      taraflarinKarsiladigi,
      kdv,
      stopaj,
      taraflarinNetOdemesi,
      tarafBasina,
      arabulucuNetGelir,
      uyari,
    })
  }

  const isDavaSartiOnerilen = DAVA_SARTI_TURLER.includes(form.tur)
  const rates = form.tarafSayisi > 2
    ? ARABULUCU_SAATLIK_3PLUS[form.tur]
    : ARABULUCU_SAATLIK_2TARAF[form.tur]

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 6325 s. K., Arabuluculuk Asgari Ücret Tarifesi 2025-2026" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Arabuluculuk Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          {/* Rejim */}
          <div className="min-w-[240px]">
            <label className="text-sm font-medium">Arabuluculuk rejimi</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="arb-rejim"
                  checked={form.rejim === 'dava-sarti'}
                  onChange={() => setForm((p) => ({ ...p, rejim: 'dava-sarti' }))}
                />
                Dava şartı (zorunlu)
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="arb-rejim"
                  checked={form.rejim === 'ihtiyari'}
                  onChange={() => setForm((p) => ({ ...p, rejim: 'ihtiyari' }))}
                />
                İhtiyari
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isDavaSartiOnerilen
                ? `Bu uyuşmazlık türünde dava şartı arabuluculuk önerilir (${ARABULUCU_TUR_REF[form.tur]}).`
                : `Bu uyuşmazlık türünde dava şartı zorunluluğu yok; ihtiyari arabuluculuk varsayılan (${ARABULUCU_TUR_REF[form.tur]}).`}
            </p>
          </div>

          {/* Uyuşmazlık türü */}
          <div className="min-w-[220px]">
            <label className="text-sm font-medium">Uyuşmazlık türü</label>
            <select
              className={selectCls}
              value={form.tur}
              onChange={(e) => setForm((p) => ({ ...p, tur: e.target.value as ArabulucuTur }))}
            >
              {(Object.keys(ARABULUCU_TUR_LABELS) as ArabulucuTur[]).map((k) => (
                <option key={k} value={k}>
                  {ARABULUCU_TUR_LABELS[k]}
                  {DAVA_SARTI_TURLER.includes(k) ? ' • dava şartı' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Anlaşma */}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Sonuç</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="arb-sonuc"
                  checked={form.sonuc === 'anlasma'}
                  onChange={() => setForm((p) => ({ ...p, sonuc: 'anlasma' }))}
                />
                Anlaşma
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="arb-sonuc"
                  checked={form.sonuc === 'anlasama'}
                  onChange={() => setForm((p) => ({ ...p, sonuc: 'anlasama' }))}
                />
                Anlaşamama
              </label>
            </div>
          </div>

          <div className="min-w-[180px]">
            <label className="text-sm font-medium">Toplantı süresi (saat)</label>
            <input
              type="number"
              className={inputCls}
              min={1}
              value={form.sure || ''}
              onChange={(e) => setForm((p) => ({ ...p, sure: parseInt(e.target.value) || 0 }))}
            />
          </div>

          <div className="min-w-[180px]">
            <label className="text-sm font-medium">Taraf sayısı</label>
            <input
              type="number"
              className={inputCls}
              min={2}
              value={form.tarafSayisi || ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, tarafSayisi: Math.max(2, parseInt(e.target.value) || 2) }))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">3 ve üzeri tarafta farklı tarife.</p>
          </div>

          <div className="min-w-[220px]">
            <label className="text-sm font-medium">Uyuşmazlık konusu değer (TL)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Opsiyonel — parasal uyuşmazlık"
              value={form.deger || ''}
              onChange={(e) => setForm((p) => ({ ...p, deger: parseFloat(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Anlaşma + parasal uyuşmazlıkta nispi tarife uygulanır.
            </p>
          </div>
        </div>
      </fieldset>

      {/* Tarife bilgi tablosu */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-muted-foreground mb-2">
          Seçili tarife: <strong>{ARABULUCU_TUR_LABELS[form.tur]}</strong> ·{' '}
          {form.tarafSayisi > 2 ? '3+ taraf' : '2 taraf'} · {ARABULUCU_TUR_REF[form.tur]}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Anlaşma — İlk 3 saat: <strong>{formatCurrency(rates[0])}/saat</strong></div>
          <div>Anlaşma — Sonraki: <strong>{formatCurrency(rates[1])}/saat</strong></div>
          <div>Anlaşamama — İlk 3 saat: <strong>{formatCurrency(rates[2])}/saat</strong></div>
          <div>Anlaşamama — Sonraki: <strong>{formatCurrency(rates[3])}/saat</strong></div>
        </div>
      </div>

      <button className={btnCls} onClick={hesapla}>
        Hesapla
      </button>

      {result && (
        <div className="space-y-4">
          <ResultTable
            headers={['Kalem', 'Tutar (TL)']}
            rows={[
              ['Saatlik ücret toplamı', result.saatlikToplam],
              ...(result.nispiToplam > 0
                ? [['Nispi ücret (değer üzerinden)' as string | number, result.nispiToplam as string | number] as (string | number)[]]
                : []),
              ['Uygulanan arabulucu ücreti (büyük olan)', result.uygulananUcret],
              ...(result.bakanlikKarsiladigi > 0
                ? [['Adalet Bakanlığı tarafından karşılanan (ilk 2 saat)' as string | number, -result.bakanlikKarsiladigi as string | number] as (string | number)[]]
                : []),
              ['Taraflara düşen kısım', result.taraflarinKarsiladigi],
              ['+ KDV %20', result.kdv],
              ['− Stopaj %20 (gelir vergisi)', -result.stopaj],
              ['Taraflarca yapılacak toplam ödeme', result.taraflarinNetOdemesi],
              ['Taraf başına maliyet', result.tarafBasina],
              ['Arabulucu net geliri (ücret − stopaj)', result.arabulucuNetGelir],
            ]}
          />

          {result.nispiToplam > 0 && result.nispiToplam > result.saatlikToplam && (
            <WarningBadge text="Nispi ücret saatlik ücretten yüksek olduğu için nispi ücret uygulanmıştır (6325 SK m.18/A-3, AÜT)." />
          )}

          {result.uyari && <WarningBadge text={result.uyari} />}

          <p className="text-xs text-muted-foreground">
            Notlar: (1) Arabulucu ücreti taraflar arasında eşit paylaşılır; sözleşmeyle aksi
            kararlaştırılabilir. (2) KDV %20 ek olarak hesaplanır, stopaj %20 ücretten kesilir.
            (3) Dava şartı + anlaşamamada ilk 2 saatlik anlaşamama tarifesi Bakanlık karşılar.
            (4) İhtiyari arabuluculukta tüm ücret taraflara aittir.
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

    // Konfigürasyon değişikliği veya filtre nedeniyle rates boş kalırsa hesap
    // yapılamaz; kullanıcıya 0 göster, crash etme.
    if (sortedRates.length === 0) {
      return { detay, totalFaiz: 0 }
    }

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


// ─── TABS ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'iscilik', label: 'İşçilik Alacakları' },
  { id: 'vekalet', label: 'Vekâlet Ücreti' },
  { id: 'arabulucu', label: 'Arabulucu Ücreti' },
  { id: 'faiz', label: 'Faiz Hesaplama' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function CalculationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('iscilik')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hesaplamalar"
        description="Hukuki hesaplama araçları — işçilik alacakları, vekâlet ücreti, arabulucu ücreti ve faiz"
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
      </div>
    </div>
  )
}
