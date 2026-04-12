// ============================================================
// courtData.ts — Mahkeme, daire ve hukuk dali sabitleri
// Ictihat arama sayfasi icin kullanilir
// ============================================================

export interface CourtType {
  id: string
  label: string
  cliFlag: string // yargi CLI -c parametresi
}

export interface Department {
  id: string
  label: string
  cliFlag: string // yargi CLI -b parametresi
}

export interface LegalBranch {
  id: string
  label: string
  keywords: string[] // Arama terimlerine eklenmesi onerilen anahtar kelimeler
}

export interface QuickFilter {
  id: string
  label: string
  icon: string
  description: string
  apply: {
    courtType?: string
    department?: string
    yearFrom?: number
    searchTerm?: string
  }
}

// ─── Mahkeme Turleri ───────────────────────────────────────

export const COURT_TYPES: CourtType[] = [
  { id: 'yargitay', label: 'Yargitay', cliFlag: 'YARGITAYKARARI' },
  { id: 'danistay', label: 'Danistay', cliFlag: 'DANISTAYKARARI' },
  { id: 'bam', label: 'Bolge Adliye Mahkemesi', cliFlag: 'BAM' },
  { id: 'anayasa', label: 'Anayasa Mahkemesi', cliFlag: 'AYM' },
]

// ─── Yargitay Daireleri ────────────────────────────────────

export const YARGITAY_DEPARTMENTS: Department[] = [
  // Hukuk Daireleri
  { id: 'h1', label: '1. Hukuk Dairesi', cliFlag: 'H1' },
  { id: 'h2', label: '2. Hukuk Dairesi', cliFlag: 'H2' },
  { id: 'h3', label: '3. Hukuk Dairesi', cliFlag: 'H3' },
  { id: 'h4', label: '4. Hukuk Dairesi', cliFlag: 'H4' },
  { id: 'h5', label: '5. Hukuk Dairesi', cliFlag: 'H5' },
  { id: 'h6', label: '6. Hukuk Dairesi', cliFlag: 'H6' },
  { id: 'h7', label: '7. Hukuk Dairesi', cliFlag: 'H7' },
  { id: 'h8', label: '8. Hukuk Dairesi', cliFlag: 'H8' },
  { id: 'h9', label: '9. Hukuk Dairesi', cliFlag: 'H9' },
  { id: 'h10', label: '10. Hukuk Dairesi', cliFlag: 'H10' },
  { id: 'h11', label: '11. Hukuk Dairesi', cliFlag: 'H11' },
  { id: 'h12', label: '12. Hukuk Dairesi', cliFlag: 'H12' },
  { id: 'h13', label: '13. Hukuk Dairesi', cliFlag: 'H13' },
  { id: 'h14', label: '14. Hukuk Dairesi', cliFlag: 'H14' },
  { id: 'h15', label: '15. Hukuk Dairesi', cliFlag: 'H15' },
  { id: 'h16', label: '16. Hukuk Dairesi', cliFlag: 'H16' },
  { id: 'h17', label: '17. Hukuk Dairesi', cliFlag: 'H17' },
  { id: 'h18', label: '18. Hukuk Dairesi', cliFlag: 'H18' },
  { id: 'h19', label: '19. Hukuk Dairesi', cliFlag: 'H19' },
  { id: 'h20', label: '20. Hukuk Dairesi', cliFlag: 'H20' },
  { id: 'h21', label: '21. Hukuk Dairesi', cliFlag: 'H21' },
  { id: 'h22', label: '22. Hukuk Dairesi', cliFlag: 'H22' },
  { id: 'h23', label: '23. Hukuk Dairesi', cliFlag: 'H23' },
  // Ceza Daireleri
  { id: 'c1', label: '1. Ceza Dairesi', cliFlag: 'C1' },
  { id: 'c2', label: '2. Ceza Dairesi', cliFlag: 'C2' },
  { id: 'c3', label: '3. Ceza Dairesi', cliFlag: 'C3' },
  { id: 'c4', label: '4. Ceza Dairesi', cliFlag: 'C4' },
  { id: 'c5', label: '5. Ceza Dairesi', cliFlag: 'C5' },
  { id: 'c6', label: '6. Ceza Dairesi', cliFlag: 'C6' },
  { id: 'c7', label: '7. Ceza Dairesi', cliFlag: 'C7' },
  { id: 'c8', label: '8. Ceza Dairesi', cliFlag: 'C8' },
  { id: 'c9', label: '9. Ceza Dairesi', cliFlag: 'C9' },
  { id: 'c10', label: '10. Ceza Dairesi', cliFlag: 'C10' },
  { id: 'c11', label: '11. Ceza Dairesi', cliFlag: 'C11' },
  { id: 'c12', label: '12. Ceza Dairesi', cliFlag: 'C12' },
  { id: 'c13', label: '13. Ceza Dairesi', cliFlag: 'C13' },
  { id: 'c14', label: '14. Ceza Dairesi', cliFlag: 'C14' },
  { id: 'c15', label: '15. Ceza Dairesi', cliFlag: 'C15' },
  { id: 'c16', label: '16. Ceza Dairesi', cliFlag: 'C16' },
  { id: 'c17', label: '17. Ceza Dairesi', cliFlag: 'C17' },
  { id: 'c18', label: '18. Ceza Dairesi', cliFlag: 'C18' },
  { id: 'c19', label: '19. Ceza Dairesi', cliFlag: 'C19' },
  { id: 'c20', label: '20. Ceza Dairesi', cliFlag: 'C20' },
  // Genel Kurullar
  { id: 'hgk', label: 'Hukuk Genel Kurulu (HGK)', cliFlag: 'HGK' },
  { id: 'cgk', label: 'Ceza Genel Kurulu (CGK)', cliFlag: 'CGK' },
  { id: 'ibk', label: 'Ictihadlari Birlestirme Kurulu (IBK)', cliFlag: 'IBK' },
]

// ─── Danistay Daireleri ────────────────────────────────────

export const DANISTAY_DEPARTMENTS: Department[] = [
  { id: 'd1', label: '1. Daire', cliFlag: 'D1' },
  { id: 'd2', label: '2. Daire', cliFlag: 'D2' },
  { id: 'd3', label: '3. Daire', cliFlag: 'D3' },
  { id: 'd4', label: '4. Daire', cliFlag: 'D4' },
  { id: 'd5', label: '5. Daire', cliFlag: 'D5' },
  { id: 'd6', label: '6. Daire', cliFlag: 'D6' },
  { id: 'd7', label: '7. Daire', cliFlag: 'D7' },
  { id: 'd8', label: '8. Daire', cliFlag: 'D8' },
  { id: 'd9', label: '9. Daire', cliFlag: 'D9' },
  { id: 'd10', label: '10. Daire', cliFlag: 'D10' },
  { id: 'd11', label: '11. Daire', cliFlag: 'D11' },
  { id: 'd12', label: '12. Daire', cliFlag: 'D12' },
  { id: 'd13', label: '13. Daire', cliFlag: 'D13' },
  { id: 'd14', label: '14. Daire', cliFlag: 'D14' },
  { id: 'd15', label: '15. Daire', cliFlag: 'D15' },
  { id: 'diddk', label: 'Idari Dava Daireleri Kurulu (IDDK)', cliFlag: 'IDDK' },
  { id: 'vddk', label: 'Vergi Dava Daireleri Kurulu (VDDK)', cliFlag: 'VDDK' },
]

// ─── BAM Daireleri (genel) ─────────────────────────────────

export const BAM_DEPARTMENTS: Department[] = [
  { id: 'bam_hukuk', label: 'Hukuk Daireleri', cliFlag: 'HUKUK' },
  { id: 'bam_ceza', label: 'Ceza Daireleri', cliFlag: 'CEZA' },
]

// ─── Hukuk Dallari ─────────────────────────────────────────

export const LEGAL_BRANCHES: LegalBranch[] = [
  {
    id: 'is_hukuku',
    label: 'Is Hukuku',
    keywords: ['isci', 'isveren', 'kidem', 'ihbar', 'fazla mesai', 'ise iade', 'fesih'],
  },
  {
    id: 'aile_hukuku',
    label: 'Aile Hukuku',
    keywords: ['bosanma', 'velayet', 'nafaka', 'mal rejimi', 'evlilik', 'tazminat'],
  },
  {
    id: 'borclar_hukuku',
    label: 'Borclar Hukuku',
    keywords: ['tazminat', 'sozlesme', 'haksiz fiil', 'sebepsiz zenginlesme', 'alacak'],
  },
  {
    id: 'ticaret_hukuku',
    label: 'Ticaret Hukuku',
    keywords: ['sirket', 'ticari', 'iflas', 'konkordato', 'kambiyo', 'cek', 'senet'],
  },
  {
    id: 'ceza_hukuku',
    label: 'Ceza Hukuku',
    keywords: ['suc', 'ceza', 'tutuklama', 'beraat', 'mahkumiyet', 'hagb', 'erteleme'],
  },
  {
    id: 'idare_hukuku',
    label: 'Idare Hukuku',
    keywords: ['idari islem', 'iptal', 'tam yargi', 'disiplin', 'imar', 'kamulastirma'],
  },
  {
    id: 'icra_iflas',
    label: 'Icra ve Iflas Hukuku',
    keywords: ['icra', 'haciz', 'itiraz', 'iflas', 'takip', 'odeme emri'],
  },
  {
    id: 'miras_hukuku',
    label: 'Miras Hukuku',
    keywords: ['miras', 'vasiyetname', 'terekenin taksimi', 'tenkis', 'mirascilarin'],
  },
  {
    id: 'tuketici_hukuku',
    label: 'Tuketici Hukuku',
    keywords: ['tuketici', 'ayipli mal', 'cayma', 'mesafeli satis', 'garanti'],
  },
  {
    id: 'saglik_hukuku',
    label: 'Saglik Hukuku',
    keywords: ['tibbi hata', 'malpraktis', 'hekim', 'hastane', 'saglik'],
  },
  {
    id: 'vergi_hukuku',
    label: 'Vergi Hukuku',
    keywords: ['vergi', 'matrah', 'tarhiyat', 'ozelge', 'kdv', 'gelir vergisi'],
  },
  {
    id: 'bilisim_hukuku',
    label: 'Bilisim Hukuku',
    keywords: ['kisisel veri', 'kvkk', 'erisim engeli', 'siber suc', 'bilisim'],
  },
]

// ─── Hizli Filtreler ───────────────────────────────────────

export const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'hgk',
    label: 'HGK Kararlari',
    icon: 'scale',
    description: 'Yargitay Hukuk Genel Kurulu kararlari',
    apply: { courtType: 'yargitay', department: 'hgk' },
  },
  {
    id: 'ibk',
    label: 'IBK Kararlari',
    icon: 'landmark',
    description: 'Ictihadlari Birlestirme Kurulu kararlari',
    apply: { courtType: 'yargitay', department: 'ibk' },
  },
  {
    id: 'son1yil',
    label: 'Son 1 Yil',
    icon: 'calendar',
    description: 'Son 12 ay icinde verilen kararlar',
    apply: { yearFrom: new Date().getFullYear() - 1 },
  },
  {
    id: 'emsal',
    label: 'Emsal Kararlar',
    icon: 'bookmark',
    description: 'Emsal nitelikteki kararlar',
    apply: { searchTerm: 'emsal karar' },
  },
  {
    id: 'is_9hd',
    label: '9. HD (Is)',
    icon: 'briefcase',
    description: 'Yargitay 9. Hukuk Dairesi - Is Hukuku',
    apply: { courtType: 'yargitay', department: 'h9' },
  },
  {
    id: 'is_22hd',
    label: '22. HD (Is)',
    icon: 'briefcase',
    description: 'Yargitay 22. Hukuk Dairesi - Is Hukuku',
    apply: { courtType: 'yargitay', department: 'h22' },
  },
  {
    id: 'aile_2hd',
    label: '2. HD (Aile)',
    icon: 'users',
    description: 'Yargitay 2. Hukuk Dairesi - Aile Hukuku',
    apply: { courtType: 'yargitay', department: 'h2' },
  },
  {
    id: 'cgk',
    label: 'CGK Kararlari',
    icon: 'shield',
    description: 'Yargitay Ceza Genel Kurulu kararlari',
    apply: { courtType: 'yargitay', department: 'cgk' },
  },
]

// ─── Daire secim yardimcisi ────────────────────────────────

export function getDepartmentsForCourt(courtTypeId: string): Department[] {
  switch (courtTypeId) {
    case 'yargitay':
      return YARGITAY_DEPARTMENTS
    case 'danistay':
      return DANISTAY_DEPARTMENTS
    case 'bam':
      return BAM_DEPARTMENTS
    default:
      return []
  }
}

// ─── Arama ipuclari ───────────────────────────────────────

export const SEARCH_TIPS = [
  {
    title: 'Anahtar kelime secimi',
    content:
      'Genel terimler yerine spesifik hukuki kavramlar kullanin. Ornegin "tazminat" yerine "kidem tazminati hakli fesih" yazin.',
  },
  {
    title: 'Daire bazli arama',
    content:
      'Dava turunuze uygun daireyi secin. Is uyusmazliklari icin 9. HD, aile hukuku icin 2. HD, ticaret davalari icin 11. HD veya 19. HD daha isabetli sonuc verir.',
  },
  {
    title: 'Tarih araligi daraltma',
    content:
      'Son 2-3 yilin kararlarini once arayin. Guncel ictihat degismis olabilir. Eski kararlar yalnizca yerlesik uygulama kontrolu icin kullanilir.',
  },
  {
    title: 'HGK ve IBK onceligi',
    content:
      'Konuya iliskin HGK veya IBK karari varsa once onu bulun. Daire kararlari bu kararlara aykiri olamaz.',
  },
  {
    title: 'Birden fazla terimle arama',
    content:
      'Tek aramada sonuc gelmezse farkli terimler deneyin. Ornegin: "fazla mesai ispat yukuu", "fazla calisma bordro", "mesai tanik beyani" gibi varyasyonlar.',
  },
  {
    title: 'Karsi taraf argumanlari',
    content:
      'Sadece lehinize degil, karsi tarafin dayanak gosterebilecegi kararlari da arayin. Savunma simulasyonunda bu emsal bilgisi kritik onem tasir.',
  },
]
