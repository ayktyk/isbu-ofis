// Kıdem tazminatı tavanları (dönemsel)
export const KIDEM_TAVANLARI = [
  { start: '2026-01-01', end: '2026-06-30', tavan: 64948.77, asgariUcretBrut: 33030 },
  { start: '2025-07-01', end: '2025-12-31', tavan: 46655.43, asgariUcretBrut: 26005.50 },
  { start: '2025-01-01', end: '2025-06-30', tavan: 41828.42, asgariUcretBrut: 26005.50 },
  { start: '2024-07-01', end: '2024-12-31', tavan: 35058.58, asgariUcretBrut: 20002.50 },
  { start: '2024-01-01', end: '2024-06-30', tavan: 35058.58, asgariUcretBrut: 20002.50 },
  { start: '2023-07-01', end: '2023-12-31', tavan: 23489.83, asgariUcretBrut: 13414.50 },
  { start: '2023-01-01', end: '2023-06-30', tavan: 19982.83, asgariUcretBrut: 10008 },
  { start: '2022-07-01', end: '2022-12-31', tavan: 15371.40, asgariUcretBrut: 6471 },
  { start: '2022-01-01', end: '2022-06-30', tavan: 10848.59, asgariUcretBrut: 5004 },
]

// İhbar süreleri (ay bazlı kıdem -> hafta)
export const IHBAR_SURELERI = [
  { maxMonths: 6, weeks: 2 },
  { maxMonths: 18, weeks: 4 },
  { maxMonths: 36, weeks: 6 },
  { maxMonths: Infinity, weeks: 8 },
]

// Yıllık izin günleri (kıdeme göre)
export const YILLIK_IZIN_GUNLERI = [
  { maxYears: 1, days: 14 },
  { maxYears: 5, days: 14 },
  { maxYears: 15, days: 20 },
  { maxYears: Infinity, days: 26 },
]

// SGK kesinti oranları
export const SGK_ISCI_ORANI = 0.14
export const ISSIZLIK_ISCI_ORANI = 0.01
export const SGK_ISVEREN_ORANI = 0.205
export const ISSIZLIK_ISVEREN_ORANI = 0.02
export const DAMGA_VERGISI_ORANI = 0.00759

// 2025 Gelir vergisi dilimleri
export const GELIR_VERGISI_DILIMLERI = [
  { limit: 158000, oran: 0.15 },
  { limit: 330000, oran: 0.20 },
  { limit: 800000, oran: 0.27 },
  { limit: 1900000, oran: 0.35 },
  { limit: Infinity, oran: 0.40 },
]

// AAÜT 2025-2026 nispi tarife dilimleri
export const AAUT_NISPI_DILIMLER = [
  { limit: 600000, oran: 0.15 },
  { limit: 1500000, oran: 0.13 },
  { limit: 3000000, oran: 0.11 },
  { limit: 6000000, oran: 0.09 },
  { limit: 9000000, oran: 0.07 },
  { limit: 12000000, oran: 0.05 },
  { limit: 15000000, oran: 0.04 },
  { limit: 18000000, oran: 0.03 },
  { limit: 18600000, oran: 0.02 },
  { limit: Infinity, oran: 0.01 },
]

// AAÜT Maktu ücretler
export const AAUT_MAKTU_UCRETLER: Record<string, number> = {
  'sulh-hukuk': 18750,
  'asliye-hukuk': 30000,
  'asliye-ticaret': 37500,
  'is': 30000,
  'aile': 22500,
  'tuketici': 15000,
  'asliye-ceza': 22500,
  'agir-ceza': 30000,
  'idare-durusmasiz': 22500,
  'idare-durusmali': 30000,
  'vergi-durusmasiz': 22500,
  'vergi-durusmali': 30000,
  'icra-takip': 7500,
  'icra-mah-is': 11250,
  'icra-mah-dava': 15000,
  'sorusturma': 7500,
  'sulh-ceza': 15000,
  'cocuk': 18750,
  'cocuk-agir': 22500,
}

// Arabulucu saatlik ücretler
export const ARABULUCU_SAATLIK = {
  'isci-isveren': { anlasmali: 1000, anlasmasiz: 750 },
  'ticari': { anlasmali: 1500, anlasmasiz: 1000 },
  'tuketici': { anlasmali: 600, anlasmasiz: 450 },
  'aile': { anlasmali: 900, anlasmasiz: 650 },
  'kira': { anlasmali: 800, anlasmasiz: 600 },
  'ortaklik': { anlasmali: 1200, anlasmasiz: 900 },
  'diger': { anlasmali: 750, anlasmasiz: 550 },
} as const

// Yasal faiz oranları
export const YASAL_FAIZ_ORANLARI = [
  { start: '2024-06-01', oran: 24.0 },
  { start: '2022-07-01', oran: 12.0 },
  { start: '2017-01-01', oran: 9.0 },
]

// Ticari avans faiz oranları
export const TICARI_AVANS_ORANLARI = [
  { start: '2025-12-20', oran: 39.75 },
  { start: '2025-06-01', oran: 42.0 },
  { start: '2024-03-01', oran: 47.0 },
  { start: '2023-06-01', oran: 30.0 },
]

// Harç oranları 2026
export const HARC_ORANLARI = {
  nispiBasvurma: 0.00685,
  nispiKarar: 0.01140,
  maktuBasvurma: 179.90,
  maktuKarar: 179.90,
  vekaletSuret: 32.50,
  tebligatNormal: 42.50,
  tebligatAps: 65.00,
  bilirkisiOrtalama: 750,
  kesifOrtalama: 1500,
}
