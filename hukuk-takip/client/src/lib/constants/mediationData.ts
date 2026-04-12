export const MEDIATION_DISPUTE_TYPES = [
  'Iscilik Alacagi',
  'Ise Iade',
  'Kira Uyusmazligi',
  'Tuketici Uyusmazligi',
  'Ticari Uyusmazlik',
  'Ortaklik Uyusmazligi',
  'Sigorta Uyusmazligi',
  'Bankacilik Uyusmazligi',
  'Tasinmaz Uyusmazligi',
  'Alacak Davasi',
  'Tazminat Davasi',
  'Kat Mulkiyeti Uyusmazligi',
  'Diger',
] as const

export type MediationDisputeType = (typeof MEDIATION_DISPUTE_TYPES)[number]

export const MEDIATION_RESULT_OPTIONS = [
  { value: 'agreed', label: 'Anlasti' },
  { value: 'not_agreed', label: 'Anlasamadi' },
  { value: 'partially_agreed', label: 'Kismen Anlasti' },
] as const

export type MediationResult = (typeof MEDIATION_RESULT_OPTIONS)[number]['value']
