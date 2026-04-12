import { useState } from 'react'
import { Copy, Check, Plus, Trash2, FileText, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { api } from '@/lib/axios'
import {
  MEDIATION_DISPUTE_TYPES,
  MEDIATION_RESULT_OPTIONS,
} from '@/lib/constants/mediationData'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'invitation' | 'first_session' | 'final_minutes' | 'agreement'

interface InvitationForm {
  applicantName: string
  applicantAddress: string
  otherPartyName: string
  otherPartyAddress: string
  mediatorName: string
  mediatorRegistrationNo: string
  meetingDate: string
  meetingTime: string
  meetingPlace: string
  disputeType: string
  disputeSubject: string
}

interface FirstSessionForm {
  applicantName: string
  applicantLawyer: string
  otherPartyName: string
  otherPartyLawyer: string
  mediatorName: string
  mediatorRegistrationNo: string
  meetingDate: string
  meetingPlace: string
  discussionSummary: string
  nextSessionDate: string
  nextSessionTime: string
}

interface FinalMinutesForm {
  applicantName: string
  applicantLawyer: string
  otherPartyName: string
  otherPartyLawyer: string
  mediatorName: string
  mediatorRegistrationNo: string
  fileNo: string
  firstSessionDate: string
  lastSessionDate: string
  totalSessions: string
  result: string
  resultDetails: string
  disputeType: string
  disputeSubject: string
}

interface AgreementForm {
  applicantName: string
  applicantTcNo: string
  applicantAddress: string
  otherPartyName: string
  otherPartyTcNo: string
  otherPartyAddress: string
  mediatorName: string
  mediatorRegistrationNo: string
  fileNo: string
  agreementDate: string
  agreementItems: string[]
  disputeSubject: string
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string; filePrefix: string }[] = [
  { id: 'invitation', label: 'Davet Mektubu', filePrefix: 'arabuluculuk-davet' },
  { id: 'first_session', label: 'Ilk Oturum Tutanagi', filePrefix: 'ilk-oturum-tutanagi' },
  { id: 'final_minutes', label: 'Son Tutanak', filePrefix: 'son-tutanak' },
  { id: 'agreement', label: 'Anlasma Belgesi', filePrefix: 'anlasma-belgesi' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTR(dateStr: string): string {
  if (!dateStr) return '../../....'
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

// ---------------------------------------------------------------------------
// Initial form states
// ---------------------------------------------------------------------------

const initialInvitation: InvitationForm = {
  applicantName: '',
  applicantAddress: '',
  otherPartyName: '',
  otherPartyAddress: '',
  mediatorName: '',
  mediatorRegistrationNo: '',
  meetingDate: todayStr(),
  meetingTime: '14:00',
  meetingPlace: '',
  disputeType: MEDIATION_DISPUTE_TYPES[0],
  disputeSubject: '',
}

const initialFirstSession: FirstSessionForm = {
  applicantName: '',
  applicantLawyer: '',
  otherPartyName: '',
  otherPartyLawyer: '',
  mediatorName: '',
  mediatorRegistrationNo: '',
  meetingDate: todayStr(),
  meetingPlace: '',
  discussionSummary: '',
  nextSessionDate: '',
  nextSessionTime: '14:00',
}

const initialFinalMinutes: FinalMinutesForm = {
  applicantName: '',
  applicantLawyer: '',
  otherPartyName: '',
  otherPartyLawyer: '',
  mediatorName: '',
  mediatorRegistrationNo: '',
  fileNo: '',
  firstSessionDate: todayStr(),
  lastSessionDate: todayStr(),
  totalSessions: '1',
  result: 'not_agreed',
  resultDetails: '',
  disputeType: MEDIATION_DISPUTE_TYPES[0],
  disputeSubject: '',
}

const initialAgreement: AgreementForm = {
  applicantName: '',
  applicantTcNo: '',
  applicantAddress: '',
  otherPartyName: '',
  otherPartyTcNo: '',
  otherPartyAddress: '',
  mediatorName: '',
  mediatorRegistrationNo: '',
  fileNo: '',
  agreementDate: todayStr(),
  agreementItems: [''],
  disputeSubject: '',
}

// ---------------------------------------------------------------------------
// Document generators
// ---------------------------------------------------------------------------

function generateInvitation(f: InvitationForm): string {
  return `ARABULUCULUK DAVET MEKTUBU

Sayin ${f.otherPartyName || '[Karsi Taraf Adi Soyadi]'},

6325 sayili Hukuk Uyusmazliklarinda Arabuluculuk Kanunu ve ilgili mevzuat uyarinca, asagida belirtilen uyusmazlik konusunda arabuluculuk gorusmelerine davet edilmektesiniz.

ARABULUCU BILGILERI
Arabulucu         : ${f.mediatorName || '[Arabulucu Adi Soyadi]'}
Sicil No          : ${f.mediatorRegistrationNo || '[Sicil No]'}

BASVURAN TARAF
Adi Soyadi        : ${f.applicantName || '[Basvuran Adi Soyadi]'}
Adresi            : ${f.applicantAddress || '[Basvuran Adresi]'}

KARSI TARAF
Adi Soyadi        : ${f.otherPartyName || '[Karsi Taraf Adi Soyadi]'}
Adresi            : ${f.otherPartyAddress || '[Karsi Taraf Adresi]'}

UYUSMAZLIK BILGILERI
Uyusmazlik Turu   : ${f.disputeType}
Uyusmazlik Konusu : ${f.disputeSubject || '[Uyusmazlik Konusu]'}

TOPLANTI BILGILERI
Tarih             : ${formatDateTR(f.meetingDate)}
Saat              : ${f.meetingTime || '[Saat]'}
Yer               : ${f.meetingPlace || '[Toplanti Yeri]'}

Belirtilen tarih ve saatte yukarida adresi yazili yerde hazir bulunmaniz gerekmektedir.
Arabuluculuk gorusmelerine katilmamaniz halinde, arabuluculuk faaliyetinin sona erdirilecegini ve 6325 sayili Kanun'un 18/A maddesi uyarinca ilk oturuma katilmayan tarafin yargilama giderlerinin tamamindan sorumlu tutulacagini ve lehine vekalet ucretine hukmedilmeyecegini onemle bildiririz.

Bilgilerinize sunariz.

Tarih: ${formatDateTR(f.meetingDate)}

${f.mediatorName || '[Arabulucu Adi Soyadi]'}
Arabulucu - Sicil No: ${f.mediatorRegistrationNo || '[Sicil No]'}`
}

function generateFirstSession(f: FirstSessionForm): string {
  return `ARABULUCULUK ILK OTURUM TUTANAGI

ARABULUCU BILGILERI
Arabulucu         : ${f.mediatorName || '[Arabulucu Adi Soyadi]'}
Sicil No          : ${f.mediatorRegistrationNo || '[Sicil No]'}

TOPLANTI BILGILERI
Tarih             : ${formatDateTR(f.meetingDate)}
Yer               : ${f.meetingPlace || '[Toplanti Yeri]'}

TARAF BILGILERI

Basvuran Taraf    : ${f.applicantName || '[Basvuran Adi Soyadi]'}
Vekili            : ${f.applicantLawyer || '[Vekil Adi Soyadi]'}

Karsi Taraf       : ${f.otherPartyName || '[Karsi Taraf Adi Soyadi]'}
Vekili            : ${f.otherPartyLawyer || '[Vekil Adi Soyadi]'}

GORUSME OZETI
${f.discussionSummary || '[Gorusme icerigi burada yer alacaktir.]'}

Taraflar arabuluculuk surecine devam etme konusunda mutabik kalarak bir sonraki oturum tarihini asagidaki sekilde belirlemislerdir.

SONRAKI OTURUM
Tarih             : ${formatDateTR(f.nextSessionDate)}
Saat              : ${f.nextSessionTime || '[Saat]'}

Isbu tutanak taraflarin ve arabulucunun huzurunda tanzim edilmistir.

Basvuran Taraf         Karsi Taraf             Arabulucu
${f.applicantName || '[Ad Soyad]'}       ${f.otherPartyName || '[Ad Soyad]'}        ${f.mediatorName || '[Ad Soyad]'}

Tarih: ${formatDateTR(f.meetingDate)}`
}

function generateFinalMinutes(f: FinalMinutesForm): string {
  const resultLabel =
    MEDIATION_RESULT_OPTIONS.find((o) => o.value === f.result)?.label ?? f.result

  return `ARABULUCULUK SON TUTANAGI

DOSYA BILGILERI
Arabuluculuk Dosya No : ${f.fileNo || '[Dosya No]'}
Uyusmazlik Turu       : ${f.disputeType}
Uyusmazlik Konusu     : ${f.disputeSubject || '[Uyusmazlik Konusu]'}

ARABULUCU BILGILERI
Arabulucu             : ${f.mediatorName || '[Arabulucu Adi Soyadi]'}
Sicil No              : ${f.mediatorRegistrationNo || '[Sicil No]'}

TARAF BILGILERI

Basvuran Taraf        : ${f.applicantName || '[Basvuran Adi Soyadi]'}
Vekili                : ${f.applicantLawyer || '[Vekil Adi Soyadi]'}

Karsi Taraf           : ${f.otherPartyName || '[Karsi Taraf Adi Soyadi]'}
Vekili                : ${f.otherPartyLawyer || '[Vekil Adi Soyadi]'}

SURE BILGILERI
Ilk Oturum Tarihi     : ${formatDateTR(f.firstSessionDate)}
Son Oturum Tarihi     : ${formatDateTR(f.lastSessionDate)}
Toplam Oturum Sayisi  : ${f.totalSessions || '1'}

SONUC
Anlasma Durumu        : ${resultLabel}

${f.resultDetails ? `Aciklama:\n${f.resultDetails}` : ''}

6325 sayili Hukuk Uyusmazliklarinda Arabuluculuk Kanunu'nun 18. maddesi uyarinca isbu son tutanak duzenlenmistir.

${f.result === 'not_agreed' ? 'Taraflar anlasmaya varamamislardir. Arabuluculuk faaliyeti anlasmama ile sona ermistir.' : ''}${f.result === 'agreed' ? 'Taraflar asagida belirtilen hususlarda anlasmaya varmislardir.' : ''}${f.result === 'partially_agreed' ? 'Taraflar bazi hususlarda anlasmaya varmis olup, anlasilamayan hususlar tutanakta belirtilmistir.' : ''}

Basvuran Taraf         Karsi Taraf             Arabulucu
${f.applicantName || '[Ad Soyad]'}       ${f.otherPartyName || '[Ad Soyad]'}        ${f.mediatorName || '[Ad Soyad]'}

Tarih: ${formatDateTR(f.lastSessionDate)}`
}

function generateAgreement(f: AgreementForm): string {
  const items = f.agreementItems
    .filter((item) => item.trim() !== '')
    .map((item, i) => `${i + 1}. ${item}`)
    .join('\n')

  return `ARABULUCULUK ANLASMA BELGESI

DOSYA BILGILERI
Arabuluculuk Dosya No : ${f.fileNo || '[Dosya No]'}
Uyusmazlik Konusu     : ${f.disputeSubject || '[Uyusmazlik Konusu]'}

ARABULUCU BILGILERI
Arabulucu             : ${f.mediatorName || '[Arabulucu Adi Soyadi]'}
Sicil No              : ${f.mediatorRegistrationNo || '[Sicil No]'}

TARAF BILGILERI

Basvuran Taraf
Adi Soyadi            : ${f.applicantName || '[Basvuran Adi Soyadi]'}
T.C. Kimlik No        : ${f.applicantTcNo || '[TC No]'}
Adresi                : ${f.applicantAddress || '[Adres]'}

Karsi Taraf
Adi Soyadi            : ${f.otherPartyName || '[Karsi Taraf Adi Soyadi]'}
T.C. Kimlik No        : ${f.otherPartyTcNo || '[TC No]'}
Adresi                : ${f.otherPartyAddress || '[Adres]'}

ANLASMA MADDELERI

${items || '[Anlasma maddeleri burada yer alacaktir.]'}

GENEL HUKUMLER

Taraflar, yukaridaki maddelerde belirtilen hususlarda tam ve kesin olarak anlasarak, bu konularda birbirlerinden baska hicbir hak ve alacaklari kalmadigini, isbu anlasma belgesinin 6325 sayili Kanun'un 18. maddesi uyarinca ilam niteliginde oldugunu kabul ve beyan ederler.

Isbu anlasma belgesi taraflarin ve arabulucunun huzurunda ${formatDateTR(f.agreementDate)} tarihinde tanzim ve imza edilmistir.

Basvuran Taraf         Karsi Taraf             Arabulucu
${f.applicantName || '[Ad Soyad]'}       ${f.otherPartyName || '[Ad Soyad]'}        ${f.mediatorName || '[Ad Soyad]'}

Imza Tarihi: ${formatDateTR(f.agreementDate)}
Arabulucu Onay: ${f.mediatorName || '[Arabulucu Adi Soyadi]'} - Sicil No: ${f.mediatorRegistrationNo || '[Sicil No]'}`
}

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-foreground">
      {children}
    </label>
  )
}

function Input({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    />
  )
}

function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    />
  )
}

function Select({
  id,
  value,
  onChange,
  options,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: readonly (string | { value: string; label: string })[]
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value
        const l = typeof opt === 'string' ? opt : opt.label
        return (
          <option key={v} value={v}>
            {l}
          </option>
        )
      })}
    </select>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 border-b pb-2 text-sm font-semibold text-foreground">{children}</h3>
  )
}

function FormField({
  label,
  id,
  children,
}: {
  label: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab form components
// ---------------------------------------------------------------------------

function InvitationTab({
  form,
  setForm,
}: {
  form: InvitationForm
  setForm: React.Dispatch<React.SetStateAction<InvitationForm>>
}) {
  const u = <K extends keyof InvitationForm>(k: K) => (v: InvitationForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="space-y-5">
      <SectionTitle>Arabulucu Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Arabulucu Adi Soyadi" id="inv-med-name">
          <Input id="inv-med-name" value={form.mediatorName} onChange={u('mediatorName')} placeholder="Av. Mehmet Yilmaz" />
        </FormField>
        <FormField label="Arabulucu Sicil No" id="inv-med-reg">
          <Input id="inv-med-reg" value={form.mediatorRegistrationNo} onChange={u('mediatorRegistrationNo')} placeholder="12345" />
        </FormField>
      </div>

      <SectionTitle>Basvuran Taraf</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Adi Soyadi" id="inv-app-name">
          <Input id="inv-app-name" value={form.applicantName} onChange={u('applicantName')} />
        </FormField>
        <FormField label="Adresi" id="inv-app-addr">
          <Input id="inv-app-addr" value={form.applicantAddress} onChange={u('applicantAddress')} />
        </FormField>
      </div>

      <SectionTitle>Karsi Taraf</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Adi Soyadi" id="inv-opp-name">
          <Input id="inv-opp-name" value={form.otherPartyName} onChange={u('otherPartyName')} />
        </FormField>
        <FormField label="Adresi" id="inv-opp-addr">
          <Input id="inv-opp-addr" value={form.otherPartyAddress} onChange={u('otherPartyAddress')} />
        </FormField>
      </div>

      <SectionTitle>Uyusmazlik Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Uyusmazlik Turu" id="inv-disp-type">
          <Select id="inv-disp-type" value={form.disputeType} onChange={u('disputeType')} options={MEDIATION_DISPUTE_TYPES} />
        </FormField>
        <FormField label="Uyusmazlik Konusu" id="inv-disp-subj">
          <Input id="inv-disp-subj" value={form.disputeSubject} onChange={u('disputeSubject')} placeholder="Kidem tazminati ve fazla mesai alacagi" />
        </FormField>
      </div>

      <SectionTitle>Toplanti Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Tarih" id="inv-date">
          <Input id="inv-date" type="date" value={form.meetingDate} onChange={u('meetingDate')} />
        </FormField>
        <FormField label="Saat" id="inv-time">
          <Input id="inv-time" type="time" value={form.meetingTime} onChange={u('meetingTime')} />
        </FormField>
        <FormField label="Yer" id="inv-place">
          <Input id="inv-place" value={form.meetingPlace} onChange={u('meetingPlace')} placeholder="Arabuluculuk Merkezi, Kat 3" />
        </FormField>
      </div>
    </div>
  )
}

function FirstSessionTab({
  form,
  setForm,
}: {
  form: FirstSessionForm
  setForm: React.Dispatch<React.SetStateAction<FirstSessionForm>>
}) {
  const u = <K extends keyof FirstSessionForm>(k: K) => (v: FirstSessionForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="space-y-5">
      <SectionTitle>Arabulucu Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Arabulucu Adi Soyadi" id="fs-med-name">
          <Input id="fs-med-name" value={form.mediatorName} onChange={u('mediatorName')} />
        </FormField>
        <FormField label="Sicil No" id="fs-med-reg">
          <Input id="fs-med-reg" value={form.mediatorRegistrationNo} onChange={u('mediatorRegistrationNo')} />
        </FormField>
      </div>

      <SectionTitle>Taraf Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Basvuran Taraf" id="fs-app-name">
          <Input id="fs-app-name" value={form.applicantName} onChange={u('applicantName')} />
        </FormField>
        <FormField label="Basvuran Vekili" id="fs-app-law">
          <Input id="fs-app-law" value={form.applicantLawyer} onChange={u('applicantLawyer')} placeholder="Av. ..." />
        </FormField>
        <FormField label="Karsi Taraf" id="fs-opp-name">
          <Input id="fs-opp-name" value={form.otherPartyName} onChange={u('otherPartyName')} />
        </FormField>
        <FormField label="Karsi Taraf Vekili" id="fs-opp-law">
          <Input id="fs-opp-law" value={form.otherPartyLawyer} onChange={u('otherPartyLawyer')} placeholder="Av. ..." />
        </FormField>
      </div>

      <SectionTitle>Toplanti Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Toplanti Tarihi" id="fs-date">
          <Input id="fs-date" type="date" value={form.meetingDate} onChange={u('meetingDate')} />
        </FormField>
        <FormField label="Toplanti Yeri" id="fs-place">
          <Input id="fs-place" value={form.meetingPlace} onChange={u('meetingPlace')} />
        </FormField>
      </div>

      <SectionTitle>Gorusme Ozeti</SectionTitle>
      <FormField label="Gorusme Icerigi" id="fs-summary">
        <TextArea id="fs-summary" value={form.discussionSummary} onChange={u('discussionSummary')} rows={5} placeholder="Taraflar arasinda yapilan gorusmenin ozeti..." />
      </FormField>

      <SectionTitle>Sonraki Oturum</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Sonraki Oturum Tarihi" id="fs-next-date">
          <Input id="fs-next-date" type="date" value={form.nextSessionDate} onChange={u('nextSessionDate')} />
        </FormField>
        <FormField label="Saat" id="fs-next-time">
          <Input id="fs-next-time" type="time" value={form.nextSessionTime} onChange={u('nextSessionTime')} />
        </FormField>
      </div>
    </div>
  )
}

function FinalMinutesTab({
  form,
  setForm,
}: {
  form: FinalMinutesForm
  setForm: React.Dispatch<React.SetStateAction<FinalMinutesForm>>
}) {
  const u = <K extends keyof FinalMinutesForm>(k: K) => (v: FinalMinutesForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="space-y-5">
      <SectionTitle>Dosya Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Arabuluculuk Dosya No" id="fm-file-no">
          <Input id="fm-file-no" value={form.fileNo} onChange={u('fileNo')} placeholder="2026/12345" />
        </FormField>
        <FormField label="Uyusmazlik Turu" id="fm-disp-type">
          <Select id="fm-disp-type" value={form.disputeType} onChange={u('disputeType')} options={MEDIATION_DISPUTE_TYPES} />
        </FormField>
      </div>
      <FormField label="Uyusmazlik Konusu" id="fm-disp-subj">
        <Input id="fm-disp-subj" value={form.disputeSubject} onChange={u('disputeSubject')} />
      </FormField>

      <SectionTitle>Arabulucu Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Arabulucu Adi Soyadi" id="fm-med-name">
          <Input id="fm-med-name" value={form.mediatorName} onChange={u('mediatorName')} />
        </FormField>
        <FormField label="Sicil No" id="fm-med-reg">
          <Input id="fm-med-reg" value={form.mediatorRegistrationNo} onChange={u('mediatorRegistrationNo')} />
        </FormField>
      </div>

      <SectionTitle>Taraf Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Basvuran Taraf" id="fm-app-name">
          <Input id="fm-app-name" value={form.applicantName} onChange={u('applicantName')} />
        </FormField>
        <FormField label="Basvuran Vekili" id="fm-app-law">
          <Input id="fm-app-law" value={form.applicantLawyer} onChange={u('applicantLawyer')} />
        </FormField>
        <FormField label="Karsi Taraf" id="fm-opp-name">
          <Input id="fm-opp-name" value={form.otherPartyName} onChange={u('otherPartyName')} />
        </FormField>
        <FormField label="Karsi Taraf Vekili" id="fm-opp-law">
          <Input id="fm-opp-law" value={form.otherPartyLawyer} onChange={u('otherPartyLawyer')} />
        </FormField>
      </div>

      <SectionTitle>Sure Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Ilk Oturum Tarihi" id="fm-first-date">
          <Input id="fm-first-date" type="date" value={form.firstSessionDate} onChange={u('firstSessionDate')} />
        </FormField>
        <FormField label="Son Oturum Tarihi" id="fm-last-date">
          <Input id="fm-last-date" type="date" value={form.lastSessionDate} onChange={u('lastSessionDate')} />
        </FormField>
        <FormField label="Toplam Oturum Sayisi" id="fm-total">
          <Input id="fm-total" type="number" value={form.totalSessions} onChange={u('totalSessions')} />
        </FormField>
      </div>

      <SectionTitle>Sonuc</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Anlasma Durumu" id="fm-result">
          <Select id="fm-result" value={form.result} onChange={u('result')} options={MEDIATION_RESULT_OPTIONS} />
        </FormField>
      </div>
      <FormField label="Sonuc Aciklamasi" id="fm-result-det">
        <TextArea id="fm-result-det" value={form.resultDetails} onChange={u('resultDetails')} rows={4} placeholder="Anlasma veya anlasamama ile ilgili detaylar..." />
      </FormField>
    </div>
  )
}

function AgreementTab({
  form,
  setForm,
}: {
  form: AgreementForm
  setForm: React.Dispatch<React.SetStateAction<AgreementForm>>
}) {
  const u = <K extends keyof AgreementForm>(k: K) => (v: AgreementForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const addItem = () => setForm((p) => ({ ...p, agreementItems: [...p.agreementItems, ''] }))
  const removeItem = (idx: number) =>
    setForm((p) => ({
      ...p,
      agreementItems: p.agreementItems.filter((_, i) => i !== idx),
    }))
  const updateItem = (idx: number, val: string) =>
    setForm((p) => ({
      ...p,
      agreementItems: p.agreementItems.map((item, i) => (i === idx ? val : item)),
    }))

  return (
    <div className="space-y-5">
      <SectionTitle>Dosya Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Arabuluculuk Dosya No" id="ag-file-no">
          <Input id="ag-file-no" value={form.fileNo} onChange={u('fileNo')} placeholder="2026/12345" />
        </FormField>
        <FormField label="Uyusmazlik Konusu" id="ag-disp-subj">
          <Input id="ag-disp-subj" value={form.disputeSubject} onChange={u('disputeSubject')} />
        </FormField>
      </div>

      <SectionTitle>Arabulucu Bilgileri</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Arabulucu Adi Soyadi" id="ag-med-name">
          <Input id="ag-med-name" value={form.mediatorName} onChange={u('mediatorName')} />
        </FormField>
        <FormField label="Sicil No" id="ag-med-reg">
          <Input id="ag-med-reg" value={form.mediatorRegistrationNo} onChange={u('mediatorRegistrationNo')} />
        </FormField>
      </div>

      <SectionTitle>Basvuran Taraf</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Adi Soyadi" id="ag-app-name">
          <Input id="ag-app-name" value={form.applicantName} onChange={u('applicantName')} />
        </FormField>
        <FormField label="T.C. Kimlik No" id="ag-app-tc">
          <Input id="ag-app-tc" value={form.applicantTcNo} onChange={u('applicantTcNo')} placeholder="11111111111" />
        </FormField>
        <FormField label="Adresi" id="ag-app-addr">
          <Input id="ag-app-addr" value={form.applicantAddress} onChange={u('applicantAddress')} />
        </FormField>
      </div>

      <SectionTitle>Karsi Taraf</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Adi Soyadi" id="ag-opp-name">
          <Input id="ag-opp-name" value={form.otherPartyName} onChange={u('otherPartyName')} />
        </FormField>
        <FormField label="T.C. Kimlik No" id="ag-opp-tc">
          <Input id="ag-opp-tc" value={form.otherPartyTcNo} onChange={u('otherPartyTcNo')} placeholder="11111111111" />
        </FormField>
        <FormField label="Adresi" id="ag-opp-addr">
          <Input id="ag-opp-addr" value={form.otherPartyAddress} onChange={u('otherPartyAddress')} />
        </FormField>
      </div>

      <SectionTitle>Anlasma Maddeleri</SectionTitle>
      <div className="space-y-3">
        {form.agreementItems.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium text-muted-foreground">
              {idx + 1}
            </span>
            <input
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder={`${idx + 1}. madde icerigi`}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {form.agreementItems.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          Madde Ekle
        </button>
      </div>

      <SectionTitle>Imza Bilgileri</SectionTitle>
      <FormField label="Anlasma Tarihi" id="ag-date">
        <Input id="ag-date" type="date" value={form.agreementDate} onChange={u('agreementDate')} />
      </FormField>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MediationDocumentsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('invitation')
  const [copied, setCopied] = useState(false)
  const [downloadingUdf, setDownloadingUdf] = useState(false)
  const [downloadingDocx, setDownloadingDocx] = useState(false)

  const [invitationForm, setInvitationForm] = useState<InvitationForm>(initialInvitation)
  const [firstSessionForm, setFirstSessionForm] = useState<FirstSessionForm>(initialFirstSession)
  const [finalMinutesForm, setFinalMinutesForm] = useState<FinalMinutesForm>(initialFinalMinutes)
  const [agreementForm, setAgreementForm] = useState<AgreementForm>(initialAgreement)

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!

  // Generate preview for active tab
  const preview = (() => {
    switch (activeTab) {
      case 'invitation':
        return generateInvitation(invitationForm)
      case 'first_session':
        return generateFirstSession(firstSessionForm)
      case 'final_minutes':
        return generateFinalMinutes(finalMinutesForm)
      case 'agreement':
        return generateAgreement(agreementForm)
    }
  })()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = preview
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadUdf = async () => {
    try {
      setDownloadingUdf(true)
      const response = await api.post(
        '/mediation/generate-udf',
        { content: preview, fileName: activeTabMeta.filePrefix, documentType: activeTab },
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeTabMeta.filePrefix}.udf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('UDF dosyasi indirildi')
    } catch {
      toast.error('UDF olusturulamadi')
    } finally {
      setDownloadingUdf(false)
    }
  }

  const handleDownloadDocx = () => {
    try {
      setDownloadingDocx(true)
      const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; }
  p { margin: 6pt 0; line-height: 1.5; }
</style></head>
<body>${preview.replace(/\n/g, '<br/>')}</body></html>`
      const blob = new Blob([htmlContent], {
        type: 'application/vnd.ms-word;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeTabMeta.filePrefix}.doc`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Word dosyasi indirildi')
    } catch {
      toast.error('Word dosyasi olusturulamadi')
    } finally {
      setDownloadingDocx(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arabuluculuk Belgeleri"
        description="Arabuluculuk surecine ait belge olusturma ve onizleme"
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form + Preview layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {activeTabMeta.label} Formu
          </h2>
          {activeTab === 'invitation' && (
            <InvitationTab form={invitationForm} setForm={setInvitationForm} />
          )}
          {activeTab === 'first_session' && (
            <FirstSessionTab form={firstSessionForm} setForm={setFirstSessionForm} />
          )}
          {activeTab === 'final_minutes' && (
            <FinalMinutesTab form={finalMinutesForm} setForm={setFinalMinutesForm} />
          )}
          {activeTab === 'agreement' && (
            <AgreementTab form={agreementForm} setForm={setAgreementForm} />
          )}
        </div>

        {/* Preview */}
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="h-4 w-4" />
              Belge Onizleme
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopy}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Kopyalandi
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Kopyala
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadUdf}
                disabled={downloadingUdf}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingUdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                UDF Indir
              </button>
              <button
                onClick={handleDownloadDocx}
                disabled={downloadingDocx}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingDocx ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Word Indir
              </button>
            </div>
          </div>
          <pre className="max-h-[700px] overflow-auto rounded-md bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words font-mono text-foreground">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  )
}
