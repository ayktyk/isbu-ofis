import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'
import {
  KIDEM_TAVANLARI,
  IHBAR_SURELERI,
  SGK_ISCI_ORANI,
  ISSIZLIK_ISCI_ORANI,
  DAMGA_VERGISI_ORANI,
  GELIR_VERGISI_DILIMLERI,
  AAUT_NISPI_DILIMLER,
  AAUT_MAKTU_UCRETLER,
  ARABULUCU_SAATLIK,
  YASAL_FAIZ_ORANLARI,
  TICARI_AVANS_ORANLARI,
} from '@/lib/constants/legalRates2026'

// ─── Local constants not in legalRates2026.ts ──────────────────────────────

const UBGT_GUNLERI: Record<number, number> = {
  2018: 6,
  2019: 6.5,
  2020: 6.5,
  2021: 7.5,
  2022: 6.5,
  2023: 5,
  2024: 6,
  2025: 6,
  2026: 6,
}

// Yemek istisnasi gunluk tutarlari (TL/gun)
const YEMEK_ISTISNASI_GUNLUK: Record<number, number> = {
  2018: 16,
  2019: 19,
  2020: 23,
  2021: 25,
  2022: 51,
  2023: 118.80,
  2024: 170,
  2025: 200,
  2026: 230,
}

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
const checkboxCls = 'h-4 w-4 rounded border-gray-300'

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

function getIhbarGun(totalMonths: number): number {
  for (const s of IHBAR_SURELERI) {
    if (totalMonths < s.maxMonths) return s.weeks * 7
  }
  return 56
}

function calcGelirVergisiKademeli(matrah: number): number {
  let remaining = matrah
  let tax = 0
  let prevLimit = 0
  for (const d of GELIR_VERGISI_DILIMLERI) {
    const band = Math.min(remaining, d.limit - prevLimit)
    if (band <= 0) break
    tax += band * d.oran
    remaining -= band
    prevLimit = d.limit
  }
  return tax
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

/** Yillik izin hakki hesabi (toplam gun) */
function calcTotalIzinHak(years: number): number {
  if (years < 1) return 0
  let total = 0
  for (let y = 1; y <= years; y++) {
    if (y <= 5) total += 14
    else if (y <= 15) total += 20
    else total += 26
  }
  return total
}

/** Haftalar arasi hesaplama */
function weeksBetween(startStr: string, endStr: string): number {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, Math.floor(days / 7))
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
  netUcret: number
  yemek: number
  servis: number
  ikramiye: number
  fesihNedeni: FesihNedeni
  toplamIzinHak: number
  kullanilanIzin: number
  fazlaMesaiSaat: number
  fazlaMesaiBaslangic: string
  fazlaMesaiBitis: string
  ubgtVar: boolean
  haftaTatiliVar: boolean
  haftaTatiliGun: number // haftalik calisiyor ise gun sayisi
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
  yemekBrut: number
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
    netUcret: 0,
    yemek: 0,
    servis: 0,
    ikramiye: 0,
    fesihNedeni: 'isveren_haksiz',
    toplamIzinHak: 0,
    kullanilanIzin: 0,
    fazlaMesaiSaat: 0,
    fazlaMesaiBaslangic: '',
    fazlaMesaiBitis: '',
    ubgtVar: false,
    haftaTatiliVar: false,
    haftaTatiliGun: 1,
  })
  const [result, setResult] = useState<IscilikResult | null>(null)
  const [izinOtomatik, setIzinOtomatik] = useState(true)

  const set = (k: keyof IscilikFormState, v: string | number | boolean) =>
    setForm((p) => ({ ...p, [k]: v }))

  function hesapla() {
    if (!form.iseGiris || !form.istenCikis) {
      toast.error('Ise giris ve isten cikis tarihleri zorunludur.')
      return
    }
    if (form.netUcret <= 0) {
      toast.error('Net ucret giriniz.')
      return
    }

    const warnings: string[] = []
    const kalemler: IscilikKalemResult[] = []

    // ── MODUL 1: Hizmet Suresi ──
    const hizmet = dateDiff(form.iseGiris, form.istenCikis)
    const totalMonths = hizmet.years * 12 + hizmet.months

    // Zamanasimi kontrolu (5 yil, 01.01.2018 sonrasi)
    const cikisDate = new Date(form.istenCikis)
    const now = new Date()
    const yilFark = (now.getTime() - cikisDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    if (yilFark > 5) {
      warnings.push('ZAMANASIMI UYARISI: Fesih tarihinden 5 yildan fazla sure gecmis. Zamanasimi savunmasi riski yuksek.')
    } else if (yilFark > 4) {
      warnings.push('ZAMANASIMI UYARISI: Fesih tarihinden 4 yildan fazla sure gecmis. Zamanasimi yaklasiyors.')
    }

    // ── MODUL 2: Brut/Net Ucret Donusumu ──
    const brutUcret = netToBrut(form.netUcret)

    // Yemek istisnasi hesabi
    const cikisYili = cikisDate.getFullYear()
    const gunlukIstisna = YEMEK_ISTISNASI_GUNLUK[cikisYili] || YEMEK_ISTISNASI_GUNLUK[2026]
    const aylikIstisna = gunlukIstisna * 26
    const yemekBrut = Math.max(0, form.yemek - aylikIstisna)

    // Giydirilmis brut ucret
    const giydirilmisBrut = brutUcret + yemekBrut + form.servis + form.ikramiye

    // Fesih nedenine gore kidem hakki kontrolu
    const kidemHakki = form.fesihNedeni !== 'istifa'
    const ihbarHakki = form.fesihNedeni === 'isveren_haksiz' || form.fesihNedeni === 'ikale'

    if (form.fesihNedeni === 'istifa') {
      warnings.push('ISTIFA: Istifa eden isci kidem ve ihbar tazminatina hak kazanamaz. Ancak odenmemis alacak (fazla mesai vb.) nedeniyle hakli fesih sayilabilir.')
    }

    // ── MODUL 3: Kidem Tazminati ──
    if (kidemHakki && hizmet.totalDays >= 365) {
      const tavan = getKidemTavani(form.istenCikis)
      const esasUcret = Math.min(giydirilmisBrut, tavan)
      if (giydirilmisBrut > tavan) {
        warnings.push(`KIDEM TAVANI: Giydirilmis brut (${formatCurrency(giydirilmisBrut)}) kidem tavanini (${formatCurrency(tavan)}) asiyor. Tavan uygulanir.`)
      }
      const kidemBrut =
        esasUcret * hizmet.years +
        (esasUcret / 12) * hizmet.months +
        (esasUcret / 365) * hizmet.days
      // Kidem tazminatindan sadece damga vergisi kesilir
      const kidemDamga = kidemBrut * DAMGA_VERGISI_ORANI
      kalemler.push({
        label: 'Kidem Tazminati',
        brut: kidemBrut,
        kesinti: kidemDamga,
        net: kidemBrut - kidemDamga,
      })
    } else if (kidemHakki && hizmet.totalDays < 365) {
      warnings.push('KIDEM: 1 yildan az hizmet suresi oldugu icin kidem tazminati hesaplanmadi.')
    }

    // ── MODUL 4: Ihbar Tazminati ──
    if (ihbarHakki) {
      const ihbarGun = getIhbarGun(totalMonths)
      const ihbarBrut = (giydirilmisBrut / 30) * ihbarGun
      const ihbarGelir = ihbarBrut * 0.15
      const ihbarDamga = ihbarBrut * DAMGA_VERGISI_ORANI
      const ihbarKesinti = ihbarGelir + ihbarDamga
      kalemler.push({
        label: 'Ihbar Tazminati',
        brut: ihbarBrut,
        kesinti: ihbarKesinti,
        net: ihbarBrut - ihbarKesinti,
      })
    }

    // ── MODUL 5: Fazla Calisma Ucreti ──
    if (form.fazlaMesaiSaat > 0) {
      const fcBaslangic = form.fazlaMesaiBaslangic || form.iseGiris
      const fcBitis = form.fazlaMesaiBitis || form.istenCikis
      const toplamHafta = weeksBetween(fcBaslangic, fcBitis)

      const saatUcreti = brutUcret / 225
      const fcSaatUcreti = saatUcreti * 1.5
      const fcBrut = fcSaatUcreti * form.fazlaMesaiSaat * toplamHafta

      // SGK %15, kademeli gelir vergisi, damga vergisi
      const fcSgk = fcBrut * SGK_TOPLAM_ISCI
      const fcGelirMatrah = fcBrut - fcSgk
      const fcGelir = calcGelirVergisiKademeli(fcGelirMatrah)
      const fcDamga = fcBrut * DAMGA_VERGISI_ORANI
      const fcKesinti = fcSgk + fcGelir + fcDamga

      kalemler.push({
        label: 'Fazla Calisma Ucreti',
        brut: fcBrut,
        kesinti: fcKesinti,
        net: fcBrut - fcKesinti,
      })

      if (toplamHafta > 0) {
        // No extra warning needed
      }
    }

    // ── MODUL 6: UBGT Ucreti ──
    if (form.ubgtVar) {
      let ubgtToplamBrut = 0
      const girisYil = new Date(form.iseGiris).getFullYear()
      const cikisYil = cikisDate.getFullYear()

      for (let yil = girisYil; yil <= cikisYil; yil++) {
        const gunSayisi = UBGT_GUNLERI[yil] || 6
        // O yila ait brut ucret (basitlestirme: mevcut brut kullanilir)
        const yillikUbgtBrut = (brutUcret / 30) * gunSayisi
        ubgtToplamBrut += yillikUbgtBrut
      }

      const ubgtSgk = ubgtToplamBrut * SGK_TOPLAM_ISCI
      const ubgtGelir = (ubgtToplamBrut - ubgtSgk) * 0.15
      const ubgtDamga = ubgtToplamBrut * DAMGA_VERGISI_ORANI
      const ubgtKesinti = ubgtSgk + ubgtGelir + ubgtDamga

      kalemler.push({
        label: 'UBGT Ucreti',
        brut: ubgtToplamBrut,
        kesinti: ubgtKesinti,
        net: ubgtToplamBrut - ubgtKesinti,
      })
    }

    // ── MODUL 7: Hafta Tatili Ucreti ──
    if (form.haftaTatiliVar && form.haftaTatiliGun > 0) {
      const toplamHafta = weeksBetween(form.iseGiris, form.istenCikis)
      const htBrut = (brutUcret / 30) * 1.5 * form.haftaTatiliGun * toplamHafta

      const htSgk = htBrut * SGK_TOPLAM_ISCI
      const htGelir = (htBrut - htSgk) * 0.15
      const htDamga = htBrut * DAMGA_VERGISI_ORANI
      const htKesinti = htSgk + htGelir + htDamga

      kalemler.push({
        label: 'Hafta Tatili Ucreti',
        brut: htBrut,
        kesinti: htKesinti,
        net: htBrut - htKesinti,
      })
    }

    // ── MODUL 8: Yillik Izin Ucreti ──
    const toplamIzinHak = izinOtomatik
      ? calcTotalIzinHak(hizmet.years)
      : form.toplamIzinHak
    const bakiyeIzin = Math.max(0, toplamIzinHak - form.kullanilanIzin)

    if (bakiyeIzin > 0) {
      const izinBrut = (giydirilmisBrut / 30) * bakiyeIzin
      const izinSgk = izinBrut * SGK_TOPLAM_ISCI
      const izinGelir = (izinBrut - izinSgk) * 0.15
      const izinDamga = izinBrut * DAMGA_VERGISI_ORANI
      const izinKesinti = izinSgk + izinGelir + izinDamga

      kalemler.push({
        label: 'Yillik Izin Ucreti',
        brut: izinBrut,
        kesinti: izinKesinti,
        net: izinBrut - izinKesinti,
      })
    }

    // ── MODUL 9: Ise Iade ──
    if (form.fesihNedeni === 'isveren_haksiz' && hizmet.totalDays >= 180) {
      // Ise baslatmama tazminati (minimum 4 ay)
      const iseBrut = brutUcret * 4
      const iseDamga = iseBrut * DAMGA_VERGISI_ORANI
      kalemler.push({
        label: 'Ise Iade - Ise Baslatmama (4 ay)',
        brut: iseBrut,
        kesinti: iseDamga,
        net: iseBrut - iseDamga,
      })

      // Bosta gecen sure (max 4 ay)
      const bostaBrut = brutUcret * 4
      const bostaSgk = bostaBrut * SGK_TOPLAM_ISCI
      const bostaGelir = (bostaBrut - bostaSgk) * 0.15
      const bostaDamga = bostaBrut * DAMGA_VERGISI_ORANI
      const bostaKesinti = bostaSgk + bostaGelir + bostaDamga
      kalemler.push({
        label: 'Ise Iade - Bosta Gecen Sure (4 ay)',
        brut: bostaBrut,
        kesinti: bostaKesinti,
        net: bostaBrut - bostaKesinti,
      })
    }

    // Toplamlar
    const toplamBrut = kalemler.reduce((s, k) => s + k.brut, 0)
    const toplamKesinti = kalemler.reduce((s, k) => s + k.kesinti, 0)
    const toplamNet = kalemler.reduce((s, k) => s + k.net, 0)

    setResult({
      hizmet,
      brutUcret,
      giydirilmisBrut,
      yemekBrut,
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

      {/* Calisma Bilgileri */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Calisma Bilgileri
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

      {/* Ucret Bilgileri */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Ucret Bilgileri (Aylik TL)
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Son net ucret</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.netUcret || ''}
              onChange={(e) => set('netUcret', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Yemek yardimi (aylik)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Opsiyonel"
              value={form.yemek || ''}
              onChange={(e) => set('yemek', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Servis yardimi (aylik)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Opsiyonel"
              value={form.servis || ''}
              onChange={(e) => set('servis', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Ikramiye/prim (aylik)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Opsiyonel"
              value={form.ikramiye || ''}
              onChange={(e) => set('ikramiye', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </fieldset>

      {/* Izin Bilgileri */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Yillik Izin Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="izinOtomatik"
              className={checkboxCls}
              checked={izinOtomatik}
              onChange={(e) => setIzinOtomatik(e.target.checked)}
            />
            <label htmlFor="izinOtomatik" className="text-sm font-medium">
              Izin hakkini otomatik hesapla
            </label>
          </div>
          {!izinOtomatik && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Toplam izin hakki (gun)</label>
              <input
                type="number"
                className={inputCls}
                value={form.toplamIzinHak || ''}
                onChange={(e) => set('toplamIzinHak', parseInt(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Kullanilan izin (gun)</label>
            <input
              type="number"
              className={inputCls}
              value={form.kullanilanIzin || ''}
              onChange={(e) => set('kullanilanIzin', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </fieldset>

      {/* Fazla Mesai */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Fazla Calisma (Opsiyonel)
        </legend>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Haftalik fazla mesai (saat)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={form.fazlaMesaiSaat || ''}
              onChange={(e) => set('fazlaMesaiSaat', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">FC baslangic tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.fazlaMesaiBaslangic}
              onChange={(e) => set('fazlaMesaiBaslangic', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Bos birakilirsa ise giris tarihi</p>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">FC bitis tarihi</label>
            <input
              type="date"
              className={inputCls}
              value={form.fazlaMesaiBitis}
              onChange={(e) => set('fazlaMesaiBitis', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Bos birakilirsa isten cikis tarihi</p>
          </div>
        </div>
      </fieldset>

      {/* UBGT ve Hafta Tatili */}
      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          UBGT ve Hafta Tatili (Opsiyonel)
        </legend>
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ubgtVar"
              className={checkboxCls}
              checked={form.ubgtVar}
              onChange={(e) => set('ubgtVar', e.target.checked)}
            />
            <label htmlFor="ubgtVar" className="text-sm font-medium">
              UBGT calismasi var
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="haftaTatiliVar"
              className={checkboxCls}
              checked={form.haftaTatiliVar}
              onChange={(e) => set('haftaTatiliVar', e.target.checked)}
            />
            <label htmlFor="haftaTatiliVar" className="text-sm font-medium">
              Hafta tatili calismasi var
            </label>
          </div>
          {form.haftaTatiliVar && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Haftalik calisiyor (gun)</label>
              <input
                type="number"
                className={inputCls}
                min={1}
                max={2}
                value={form.haftaTatiliGun || ''}
                onChange={(e) => set('haftaTatiliGun', parseInt(e.target.value) || 1)}
              />
            </div>
          )}
        </div>
      </fieldset>

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
              <strong>Hesaplanan brut ucret:</strong>{' '}
              {formatCurrency(result.brutUcret)}
            </p>
            <p>
              <strong>Yemek brut (istisna sonrasi):</strong>{' '}
              {formatCurrency(result.yemekBrut)}
            </p>
            <p>
              <strong>Giydirilmis brut ucret:</strong>{' '}
              {formatCurrency(result.giydirilmisBrut)}
            </p>
            <p>
              <strong>Kidem tavani (cikis donemi):</strong>{' '}
              {formatCurrency(getKidemTavani(form.istenCikis))}
            </p>
          </div>

          {/* Result table */}
          <ResultTable
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

// ─── TAB 3: Arabulucu Ucreti ────────────────────────────────────────────────

function ArabulucuTab() {
  const [form, setForm] = useState({
    tur: 'isci-isveren' as keyof typeof ARABULUCU_SAATLIK,
    konu: 'parasal' as 'parasal' | 'parasal-olmayan',
    sonuc: 'anlasmali' as 'anlasmali' | 'anlasmasiz',
    sure: 2,
    deger: 0,
    tarafSayisi: 2,
  })
  const [result, setResult] = useState<null | {
    ucret: number
    tarafBasina: number
    aciklama: string
  }>(null)

  function hesapla() {
    const rates = ARABULUCU_SAATLIK[form.tur]
    const saatlik = rates[form.sonuc]
    let ucret = saatlik * form.sure

    let aciklama = `Saatlik ${formatCurrency(saatlik)} x ${form.sure} saat = ${formatCurrency(ucret)}`
    if (form.konu === 'parasal' && form.deger > 0 && form.sonuc === 'anlasmali') {
      const nispi = form.deger * 0.06
      if (nispi > ucret) {
        ucret = nispi
        aciklama = `Nispi hesap (%6): ${formatCurrency(nispi)} (saatlikten yuksek)`
      }
    }

    const tarafBasina = ucret / form.tarafSayisi

    setResult({ ucret, tarafBasina, aciklama })
  }

  return (
    <div className="space-y-6">
      <SourceBadge text="Kaynak: 6325 s. K., Arabuluculuk Ucret Tarifesi 2026" />

      <fieldset className="rounded-lg border p-4 space-y-3">
        <legend className="text-sm font-medium text-muted-foreground px-2">
          Arabuluculuk Bilgileri
        </legend>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Uyusmazlik turu</label>
            <select
              className={selectCls}
              value={form.tur}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  tur: e.target.value as keyof typeof ARABULUCU_SAATLIK,
                }))
              }
            >
              <option value="isci-isveren">Isci-Isveren</option>
              <option value="ticari">Ticari</option>
              <option value="tuketici">Tuketici</option>
              <option value="aile">Aile</option>
              <option value="kira">Kira</option>
              <option value="ortaklik">Ortaklik</option>
              <option value="diger">Diger</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Konu</label>
            <select
              className={selectCls}
              value={form.konu}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  konu: e.target.value as 'parasal' | 'parasal-olmayan',
                }))
              }
            >
              <option value="parasal">Parasal</option>
              <option value="parasal-olmayan">Parasal olmayan</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Sonuc</label>
            <select
              className={selectCls}
              value={form.sonuc}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  sonuc: e.target.value as 'anlasmali' | 'anlasmasiz',
                }))
              }
            >
              <option value="anlasmali">Anlasma ile</option>
              <option value="anlasmasiz">Anlasmazlik</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Sure (saat)</label>
            <input
              type="number"
              className={inputCls}
              value={form.sure || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  sure: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>
          {form.konu === 'parasal' && (
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">
                Uyusmazlik degeri (TL)
              </label>
              <input
                type="number"
                className={inputCls}
                value={form.deger || ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    deger: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Taraf sayisi</label>
            <input
              type="number"
              className={inputCls}
              value={form.tarafSayisi || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  tarafSayisi: parseInt(e.target.value) || 2,
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
          <ResultTable
            headers={['Kalem', 'Tutar (TL)']}
            rows={[
              ['Toplam arabulucu ucreti', result.ucret],
              ['Taraf basina', result.tarafBasina],
            ]}
          />
          <p className="text-sm text-muted-foreground">{result.aciklama}</p>
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
            <label className="text-sm font-medium">Kusur orani (%)</label>
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

// ─── TABS ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'iscilik', label: 'Iscilik Alacaklari' },
  { id: 'vekalet', label: 'Vekalet Ucreti' },
  { id: 'arabulucu', label: 'Arabulucu Ucreti' },
  { id: 'faiz', label: 'Faiz Hesaplama' },
  { id: 'kaza', label: 'Kaza Tazminat' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function CalculationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('iscilik')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hesaplamalar"
        description="Hukuki hesaplama araclari — 9 modullu iscilik alacaklari, vekalet ucreti, arabulucu ucreti, faiz ve kaza tazminati"
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
        {activeTab === 'kaza' && <KazaTazminatTab />}
      </div>
    </div>
  )
}
