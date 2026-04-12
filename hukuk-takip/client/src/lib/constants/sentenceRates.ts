export type SentenceCategory = {
  id: string
  label: string
  ratio: number  // fraction as decimal, e.g. 0.5 for 1/2
  ratioLabel: string
}

export const SENTENCE_CATEGORIES: SentenceCategory[] = [
  { id: 'adi-1-2', label: 'Adi Suçlar (1/2)', ratio: 0.5, ratioLabel: '1/2' },
  { id: 'tck-86', label: 'Kasten Yaralama - TCK 86, 87', ratio: 0.5, ratioLabel: '1/2' },
  { id: 'tck-81', label: 'Kasten Öldürme - TCK 81', ratio: 2/3, ratioLabel: '2/3' },
  { id: 'tck-82', label: 'Nitelikli Kasten Öldürme - TCK 82', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'tck-83', label: 'İhmali Davranışla Öldürme - TCK 83', ratio: 2/3, ratioLabel: '2/3' },
  { id: 'nsa-yaralama', label: 'Neticesi Seb. Ağır. Yaralama', ratio: 2/3, ratioLabel: '2/3' },
  { id: 'iskence', label: 'İşkence / Eziyet', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'cocuk-cinsel', label: 'Çocuğun Cinsel İstismarı', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'cinsel-basit', label: 'Cinsel Saldırı (Basit)', ratio: 2/3, ratioLabel: '2/3' },
  { id: 'cinsel-nitelikli', label: 'Cinsel Saldırı (Nitelikli)', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'ozel-hayat', label: 'Özel Hayatın Gizliliği', ratio: 0.5, ratioLabel: '1/2' },
  { id: 'uyusturucu', label: 'Uyuşturucu Ticareti', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'devlet-sirlari', label: 'Devlet Sırlarına Karşı Suçlar', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'mit', label: 'MİT Kanunu Suçları', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'suc-orgutu', label: 'Suç Örgütü Kurma/Yönetme', ratio: 2/3, ratioLabel: '2/3' },
  { id: 'orgut-faaliyet', label: 'Örgüt Faaliyeti Suçları', ratio: 2/3, ratioLabel: '2/3' },
  { id: 'teror', label: 'Terör Suçları - 3713 SK.', ratio: 0.75, ratioLabel: '3/4' },
  { id: 'devlet-guvenlik', label: 'Devlet Güvenliğine Karşı Suçlar', ratio: 0.75, ratioLabel: '3/4' },
]

export type SpecialCondition = {
  id: string
  label: string
}

export const SPECIAL_CONDITIONS: SpecialCondition[] = [
  { id: 'yok', label: 'Özel Durumu Yok' },
  { id: 'cocuk', label: 'Çocuk (18 yaş altı)' },
  { id: '65', label: '65 Yaşını Bitirmiş' },
  { id: '70', label: '70 Yaşını Bitirmiş' },
  { id: '75', label: '75 Yaşını Bitirmiş' },
  { id: '80', label: '80 Yaşını Bitirmiş (7550 SK.)' },
  { id: 'kadin', label: 'Kadın' },
  { id: 'kadin-cocuk', label: '0-6 Yaş Çocuklu Kadın' },
  { id: 'agir-hasta', label: 'Ağır Hasta' },
  { id: 'engelli', label: 'Engelli' },
]

export type RecidivismLevel = {
  id: string
  label: string
}

export const RECIDIVISM_LEVELS: RecidivismLevel[] = [
  { id: 'yok', label: 'Tekerrür Yok' },
  { id: '1', label: '1. Tekerrür' },
  { id: '2', label: '2. Tekerrür (7550 SK.)' },
]
