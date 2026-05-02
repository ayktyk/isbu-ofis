// Süreli işler şablon kütüphanesi.
// Yeni şablonlar bu dosyaya eklenir; migration gerekmez.

export const deadlineCategoryValues = ['hukuk', 'icra', 'is', 'ceza', 'idari', 'tbk'] as const
export const deadlineSeverityValues = ['hak_dusurucu', 'zamanasimi', 'usul'] as const

export type DeadlineCategory = (typeof deadlineCategoryValues)[number]
export type DeadlineSeverity = (typeof deadlineSeverityValues)[number]

export interface LegalDeadlineTemplate {
  key: string
  label: string
  category: DeadlineCategory
  severity: DeadlineSeverity
  durationDays: number
  durationWeeks?: number
  durationYears?: number
  triggerLabel: string
  legalBasis: string
  description?: string
  applyHolidayShift: boolean
  suggestedFor?: string[]
}

export const LEGAL_DEADLINE_TEMPLATES: LegalDeadlineTemplate[] = [
  // ICRA
  {
    key: 'odeme_emrine_itiraz',
    label: 'Ödeme emrine itiraz',
    category: 'icra',
    severity: 'hak_dusurucu',
    durationDays: 7,
    triggerLabel: 'Ödeme emri tebliğ tarihi',
    legalBasis: 'İİK m.62',
    applyHolidayShift: true,
    suggestedFor: ['icra'],
    description:
      'İlamsız icra takibinde ödeme emrine itiraz süresi. Süre kaçırılırsa takip kesinleşir.',
  },

  // HUKUK
  {
    key: 'istinaf_hukuk',
    label: 'İstinaf başvurusu (HMK)',
    category: 'hukuk',
    severity: 'hak_dusurucu',
    durationDays: 0,
    durationWeeks: 2,
    triggerLabel: 'Karar tebliğ tarihi',
    legalBasis: 'HMK m.345, 92, 93',
    applyHolidayShift: true,
    description:
      'İlamın usulen tebliğinden sonra iki haftalık süre hesaplanır; son gün resmi tatile denk gelirse ilk iş gününe uzar.',
  },
  {
    key: 'temyiz_hukuk',
    label: 'Temyiz başvurusu (HMK)',
    category: 'hukuk',
    severity: 'hak_dusurucu',
    durationDays: 0,
    durationWeeks: 2,
    triggerLabel: 'BAM kararı tebliğ tarihi',
    legalBasis: 'HMK m.361, 92, 93',
    applyHolidayShift: true,
  },
  {
    key: 'ihtiyati_tedbir_itiraz',
    label: 'İhtiyati tedbir kararına itiraz',
    category: 'hukuk',
    severity: 'hak_dusurucu',
    durationDays: 7,
    triggerLabel: 'Tedbir tebliğ / öğrenme tarihi',
    legalBasis: 'HMK m.394',
    applyHolidayShift: true,
  },

  // IS HUKUKU
  {
    key: 'ise_iade_dava',
    label: 'İşe iade davası',
    category: 'is',
    severity: 'hak_dusurucu',
    durationDays: 0,
    durationWeeks: 2,
    triggerLabel: 'Arabuluculuk son tutanak tarihi',
    legalBasis: 'İş K. m.20',
    applyHolidayShift: true,
    suggestedFor: ['iscilik_alacagi'],
    description:
      'Arabuluculuk anlaşmazlıkla sonuçlandığında iki hafta içinde işe iade davası açılmalıdır.',
  },

  // CEZA
  {
    key: 'istinaf_ceza',
    label: 'İstinaf (CMK)',
    category: 'ceza',
    severity: 'hak_dusurucu',
    durationDays: 7,
    triggerLabel: 'Hüküm tefhim / tebliğ tarihi',
    legalBasis: 'CMK m.273',
    applyHolidayShift: true,
    suggestedFor: ['ceza'],
  },
  {
    key: 'temyiz_ceza',
    label: 'Temyiz (CMK)',
    category: 'ceza',
    severity: 'hak_dusurucu',
    durationDays: 15,
    triggerLabel: 'BAM kararı tebliğ tarihi',
    legalBasis: 'CMK m.291',
    applyHolidayShift: true,
    suggestedFor: ['ceza'],
  },

  // IDARI
  {
    key: 'idari_dava',
    label: 'İdari dava açma',
    category: 'idari',
    severity: 'hak_dusurucu',
    durationDays: 60,
    triggerLabel: 'İşlem tebliğ tarihi',
    legalBasis: 'İYUK m.7',
    applyHolidayShift: true,
    suggestedFor: ['idare'],
    description: 'Vergi davalarında 30 gün; genel idari yargıda 60 gün. Dosya özelinde doğrulayın.',
  },
  {
    key: 'aym_bireysel',
    label: 'AYM bireysel başvuru',
    category: 'idari',
    severity: 'hak_dusurucu',
    durationDays: 30,
    triggerLabel: 'Olağan yolların tüketildiği tarih',
    legalBasis: '6216 SK m.47',
    applyHolidayShift: true,
  },
]

export const TEMPLATE_INDEX: Record<string, LegalDeadlineTemplate> = Object.fromEntries(
  LEGAL_DEADLINE_TEMPLATES.map((template) => [template.key, template])
)

export function findTemplate(key: string): LegalDeadlineTemplate | undefined {
  return TEMPLATE_INDEX[key]
}

export const DEADLINE_CATEGORY_LABEL: Record<DeadlineCategory, string> = {
  hukuk: 'Hukuk',
  icra: 'İcra',
  is: 'İş Hukuku',
  ceza: 'Ceza',
  idari: 'İdari',
  tbk: 'TBK Genel',
}

export const DEADLINE_SEVERITY_LABEL: Record<DeadlineSeverity, string> = {
  hak_dusurucu: 'Hak Düşürücü',
  zamanasimi: 'Zamanaşımı',
  usul: 'Usul',
}
