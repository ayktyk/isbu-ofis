// Süreli işler şablon kütüphanesi.
// V1: 15 çekirdek şablon. Yeni şablonlar bu dosyaya satır eklenerek deploy edilir;
// migration gerekmez. Tüm süreler "doğrulanmalı" — avukat son günü onaylar.

export const deadlineCategoryValues = ['hukuk', 'icra', 'is', 'ceza', 'idari', 'tbk'] as const
export const deadlineSeverityValues = ['hak_dusurucu', 'zamanasimi', 'usul'] as const

export type DeadlineCategory = (typeof deadlineCategoryValues)[number]
export type DeadlineSeverity = (typeof deadlineSeverityValues)[number]

export interface LegalDeadlineTemplate {
  /** Stable kod — DB'de tutulan deadline_template_key */
  key: string
  /** Avukat dostu etiket */
  label: string
  category: DeadlineCategory
  severity: DeadlineSeverity
  /** Gün bazlı süre. durationYears verilmişse bu alan 0 olabilir. */
  durationDays: number
  /** Yıl bazlı süre (zamanaşımı için). Verilmemişse durationDays geçerlidir. */
  durationYears?: number
  /** Tetikleyici olayın etiketi — formda placeholder olarak görünür. */
  triggerLabel: string
  /** İlgili kanun maddesi. */
  legalBasis: string
  /** Kısa açıklama (opsiyonel). */
  description?: string
  /** Hafta sonu / resmi tatile denk gelirse takip eden iş gününe ötelensin mi? */
  applyHolidayShift: boolean
  /** Bu şablon hangi dava türlerinde önerilsin (suggestedFor)? case.caseType ile eşleşir. */
  suggestedFor?: string[]
}

export const LEGAL_DEADLINE_TEMPLATES: LegalDeadlineTemplate[] = [
  // İCRA
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
  {
    key: 'takibe_itiraz',
    label: 'Genel haciz takibine itiraz',
    category: 'icra',
    severity: 'hak_dusurucu',
    durationDays: 30,
    triggerLabel: 'Tebliğ tarihi',
    legalBasis: 'İİK m.62',
    applyHolidayShift: true,
    suggestedFor: ['icra'],
  },
  {
    key: 'ihalenin_iptali',
    label: 'İhalenin iptali davası',
    category: 'icra',
    severity: 'hak_dusurucu',
    durationDays: 7,
    triggerLabel: 'İhale tarihi',
    legalBasis: 'İİK m.134',
    applyHolidayShift: true,
    suggestedFor: ['icra'],
  },

  // HUKUK
  {
    key: 'istinaf_hukuk',
    label: 'İstinaf başvurusu (HMK)',
    category: 'hukuk',
    severity: 'hak_dusurucu',
    durationDays: 14,
    triggerLabel: 'Karar tebliğ tarihi',
    legalBasis: 'HMK m.345',
    applyHolidayShift: true,
    description:
      'HMK 345. madde uyarınca istinaf süresi karar tebliğinden itibaren 2 haftadır.',
  },
  {
    key: 'temyiz_hukuk',
    label: 'Temyiz başvurusu (HMK)',
    category: 'hukuk',
    severity: 'hak_dusurucu',
    durationDays: 14,
    triggerLabel: 'BAM kararı tebliğ tarihi',
    legalBasis: 'HMK m.361',
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

  // İŞ HUKUKU
  {
    key: 'ise_iade_dava',
    label: 'İşe iade davası',
    category: 'is',
    severity: 'hak_dusurucu',
    durationDays: 14,
    triggerLabel: 'Arabuluculuk son tutanak tarihi',
    legalBasis: 'İş K. m.20',
    applyHolidayShift: true,
    suggestedFor: ['iscilik_alacagi'],
    description:
      'Arabuluculuk anlaşmazlıkla sonuçlandığında 2 hafta içinde işe iade davası açılmalıdır.',
  },
  {
    key: 'kidem_zamanasimi',
    label: 'Kıdem tazminatı zamanaşımı',
    category: 'is',
    severity: 'zamanasimi',
    durationDays: 0,
    durationYears: 5,
    triggerLabel: 'Fesih tarihi',
    legalBasis: 'İş K. ek m.3',
    applyHolidayShift: false,
    suggestedFor: ['iscilik_alacagi'],
  },
  {
    key: 'fazla_mesai_zamanasimi',
    label: 'Fazla mesai ücreti zamanaşımı',
    category: 'is',
    severity: 'zamanasimi',
    durationDays: 0,
    durationYears: 5,
    triggerLabel: 'Alacağın muaccel olduğu tarih',
    legalBasis: 'TBK m.147',
    applyHolidayShift: false,
    suggestedFor: ['iscilik_alacagi'],
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

  // İDARİ
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
    description: 'Vergi davalarında 30 gün; genel idari yargıda 60 gün. Avukat doğrulasın.',
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

  // TBK
  {
    key: 'tbk_genel',
    label: 'TBK genel zamanaşımı',
    category: 'tbk',
    severity: 'zamanasimi',
    durationDays: 0,
    durationYears: 10,
    triggerLabel: 'Alacağın muaccel olduğu tarih',
    legalBasis: 'TBK m.146',
    applyHolidayShift: false,
  },
  {
    key: 'tbk_haksiz_fiil_bilgi',
    label: 'Haksız fiilde 2 yıl (öğrenme)',
    category: 'tbk',
    severity: 'zamanasimi',
    durationDays: 0,
    durationYears: 2,
    triggerLabel: 'Zarar ve failin öğrenildiği tarih',
    legalBasis: 'TBK m.72',
    applyHolidayShift: false,
  },
]

export const TEMPLATE_INDEX: Record<string, LegalDeadlineTemplate> = Object.fromEntries(
  LEGAL_DEADLINE_TEMPLATES.map((t) => [t.key, t])
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
