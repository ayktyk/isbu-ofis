import { useState } from 'react'
import type { UseFormRegister, UseFormWatch } from 'react-hook-form'
import { Trash2, Wand2 } from 'lucide-react'
import {
  feePercentageBaseValues,
  feePercentageBaseLabels,
  feeTypeValues,
  feeTypeLabels,
} from '@hukuk-takip/shared'
import { generateInstallments, type GeneratedInstallment } from '@/lib/feeInstallments'
import { formatCurrency } from '@/lib/utils'

const inputClass =
  'w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20'

/**
 * Dava formundaki "Ucret Anlasmasi" bolumu.
 *
 * Avukatin gercek calisma bicimi: bazen sadece maktu tutar, bazen sadece
 * yuzdelik, bazen ikisi birden; maktu tutar sik sik taksitli
 * (or. 90.000 TL / 3 taksit).
 *
 * Taksitler burada YEREL olarak uretilir ve `onInstallmentsChange` ile ust
 * bilesene bildirilir. Yazma islemi dava kaydedildikten SONRA yapilir (yeni
 * davada henuz id yoktur).
 */
export default function FeeAgreementFields({
  register,
  watch,
  installments,
  onInstallmentsChange,
}: {
  register: UseFormRegister<any>
  watch: UseFormWatch<any>
  installments: GeneratedInstallment[]
  onInstallmentsChange: (rows: GeneratedInstallment[]) => void
}) {
  const feeType = watch('feeType') || 'fixed'
  const feePaymentPlan = watch('feePaymentPlan') || 'single'
  const contractedFee = watch('contractedFee')

  const [count, setCount] = useState(3)
  const [firstDueDate, setFirstDueDate] = useState('')
  const [genError, setGenError] = useState('')

  const hasFixed = feeType === 'fixed' || feeType === 'fixed_plus_percentage'
  const hasPercentage = feeType === 'percentage' || feeType === 'fixed_plus_percentage'
  const showInstallments = hasFixed && feePaymentPlan === 'installment'

  const installmentTotal = installments.reduce((sum, row) => sum + row.amount, 0)

  function handleGenerate() {
    setGenError('')
    const amount = Number.parseFloat(String(contractedFee || '').replace(',', '.'))

    if (!Number.isFinite(amount) || amount <= 0) {
      setGenError('Önce maktu tutarı girin.')
      return
    }
    if (!firstDueDate) {
      setGenError('İlk taksit vadesini seçin.')
      return
    }

    const rows = generateInstallments(amount, count, firstDueDate)
    if (rows.length === 0) {
      setGenError('Taksit üretilemedi. Tutar, taksit sayısı ve vadeyi kontrol edin.')
      return
    }
    onInstallmentsChange(rows)
  }

  function updateRow(index: number, patch: Partial<GeneratedInstallment>) {
    onInstallmentsChange(
      installments.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function removeRow(index: number) {
    onInstallmentsChange(
      installments.filter((_, i) => i !== index).map((row, i) => ({ ...row, seq: i + 1 }))
    )
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Ücret Tipi</label>
        <div className="flex flex-wrap gap-1.5">
          {feeTypeValues.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                feeType === value
                  ? 'border-law-accent bg-law-accent text-white'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <input type="radio" value={value} {...register('feeType')} className="sr-only" />
              {feeTypeLabels[value]}
            </label>
          ))}
        </div>
      </div>

      {hasFixed && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Maktu Tutar</label>
              <input {...register('contractedFee')} className={inputClass} placeholder="90000.00" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Ödeme Planı</label>
              <div className="flex gap-1.5">
                {(
                  [
                    { value: 'single', label: 'Tek Ödeme' },
                    { value: 'installment', label: 'Taksitli' },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-center text-xs font-medium transition ${
                      feePaymentPlan === option.value
                        ? 'border-law-accent bg-law-accent text-white'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      {...register('feePaymentPlan')}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {showInstallments && (
            <div className="space-y-3 rounded-xl border bg-background p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Taksit Sayısı</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={count}
                    onChange={(e) => setCount(Number.parseInt(e.target.value, 10) || 1)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium">İlk Vade</label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-law-accent px-3 py-2.5 text-xs font-medium text-law-accent transition hover:bg-law-accent/10"
                  >
                    <Wand2 className="h-4 w-4" />
                    Taksitleri Oluştur
                  </button>
                </div>
              </div>

              {genError && <p className="text-xs text-red-600">{genError}</p>}

              {installments.length > 0 && (
                <div className="space-y-2">
                  {installments.map((row, index) => (
                    <div key={row.seq} className="flex items-center gap-2">
                      <span className="w-6 flex-shrink-0 text-xs text-muted-foreground">
                        {row.seq}.
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          updateRow(index, { amount: Number.parseFloat(e.target.value) || 0 })
                        }
                        className={`${inputClass} py-1.5 text-xs`}
                      />
                      <input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => updateRow(index, { dueDate: e.target.value })}
                        className={`${inputClass} py-1.5 text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="flex-shrink-0 rounded-lg p-2 text-muted-foreground/60 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Taksiti kaldır"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground">
                    Taksit toplamı: <strong>{formatCurrency(installmentTotal, 'TRY')}</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {hasPercentage && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Yüzde Oranı (%)</label>
            <input {...register('feePercentage')} className={inputClass} placeholder="15" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Matrah</label>
            <select {...register('feePercentageBase')} className={inputClass}>
              <option value="">Seçilmedi</option>
              {feePercentageBaseValues.map((value) => (
                <option key={value} value={value}>
                  {feePercentageBaseLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Yüzdelik Notu</label>
            <input
              {...register('feePercentageNote')}
              className={inputClass}
              placeholder="Örnek: dava sonunda tahsil edilen tutar üzerinden"
            />
          </div>
        </div>
      )}
    </div>
  )
}
