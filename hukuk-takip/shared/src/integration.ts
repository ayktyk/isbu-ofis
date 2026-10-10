import { z } from 'zod'
import { caseStatusValues, caseTypeValues } from './schemas/case.js'

// ─── Asistan entegrasyonu: öneri (proposal) sözleşmesi ─────────────────────────
// Dış asistan yalnızca ÖNERİ gönderir; avukat onaylayana kadar hiçbir kayıt değişmez.
// Payload alanları snake_case'tir (Python betikleri ve MCP sunucusu için).

export const proposalKindValues = [
  'case_upsert',
  'hearing_upsert',
  'deadline_upsert',
  'diary_add',
  'enforcement_upsert',
  'task_add',
  'next_step',
  'status_change',
] as const
export type ProposalKind = (typeof proposalKindValues)[number]

export const proposalSourceValues = ['uyap', 'kalkan', 'icra_ozet', 'asistan'] as const
export type ProposalSource = (typeof proposalSourceValues)[number]

export const proposalStatusValues = [
  'pending',
  'approved',
  'rejected',
  'applied',
  'superseded',
  'failed',
] as const
export type ProposalStatus = (typeof proposalStatusValues)[number]

export const apiKeyScopeValues = ['read', 'propose'] as const
export type ApiKeyScope = (typeof apiKeyScopeValues)[number]

export const proposalKindLabels: Record<ProposalKind, string> = {
  case_upsert: 'Dava kaydı',
  hearing_upsert: 'Duruşma',
  deadline_upsert: 'Süreli iş',
  diary_add: 'Günlük girdisi',
  enforcement_upsert: 'İcra özeti',
  task_add: 'Görev',
  next_step: 'Sonraki adım',
  status_change: 'Durum değişikliği',
}

const dateOnly = z.string().date('Tarih YYYY-AA-GG biçiminde olmalı')
const dateTime = z.string().datetime({ offset: true, message: 'Tarih-saat ISO 8601 (saat dilimli) olmalı' })
const optionalText = (max: number) => z.string().trim().max(max).optional()
const priority = z.enum(['low', 'medium', 'high', 'urgent'])

export const caseRefSchema = z
  .object({
    id: z.string().uuid().optional(),
    external_ref: z.string().trim().min(1).max(200).optional(),
    buro_kodu: z.string().trim().min(1).max(20).optional(),
    case_number: z.string().trim().min(1).max(100).optional(),
    court_name: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine(
    (ref) => !!(ref.id || ref.external_ref || ref.buro_kodu || (ref.case_number && ref.court_name)),
    { message: 'Dava referansı için id, external_ref, buro_kodu veya case_number+court_name gerekir' }
  )
export type CaseRef = z.infer<typeof caseRefSchema>

// Var olan davada yalnızca BOŞ alanlar doldurulur; dolu alanın üzerine yazmak için
// alan adı overwrite listesinde olmalı (avukat yine de onaylar ve çakışma işaretlenir).
export const caseUpsertFieldValues = [
  'title',
  'case_number',
  'court_name',
  'case_type',
  'custom_case_type',
  'description',
  'start_date',
  'buro_kodu',
  'contracted_fee',
  'is_cmk_assignment',
] as const

export const caseUpsertPayloadSchema = z
  .object({
    title: z.string().trim().min(3).max(500).optional(),
    client_id: z.string().uuid().optional(),
    client_name: z.string().trim().min(2).max(255).optional(),
    case_number: optionalText(100),
    court_name: optionalText(255),
    case_type: z.enum(caseTypeValues).optional(),
    custom_case_type: optionalText(255),
    description: optionalText(10000),
    start_date: dateOnly.optional(),
    status: z.enum(caseStatusValues).optional(),
    buro_kodu: optionalText(20),
    contracted_fee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    is_cmk_assignment: z.boolean().optional(),
    overwrite: z.array(z.enum(caseUpsertFieldValues)).max(20).optional(),
  })
  .strict()

export const hearingUpsertPayloadSchema = z
  .object({
    hearing_date: dateTime,
    court_room: optionalText(100),
    judge: optionalText(255),
    notes: optionalText(5000),
    result: z.enum(['pending', 'completed', 'postponed', 'cancelled']).optional(),
  })
  .strict()

export const deadlineUpsertPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(450),
    // Koşullu sürelerde (ör. "tebliğden itibaren 2 hafta", tebliğ tarihi belli değil)
    // due_date boş bırakılır ve conditional=true + condition gönderilir.
    due_date: z.union([dateOnly, dateTime]).nullable().optional(),
    conditional: z.boolean().optional(),
    condition: optionalText(500),
    description: optionalText(5000),
    priority: priority.optional(),
    legal_basis: optionalText(200),
    deadline_category: optionalText(40),
    deadline_severity: z.enum(['hak_dusurucu', 'zamanasimi', 'usul']).optional(),
    trigger_event_date: dateOnly.optional(),
    trigger_event_label: optionalText(200),
    status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  })
  .strict()
  .refine((p) => p.due_date || p.conditional, {
    message: 'Süre tarihi yoksa conditional=true ve koşul metni gönderilmeli',
    path: ['due_date'],
  })

export const diaryAddPayloadSchema = z
  .object({
    title: optionalText(255),
    content: z.string().trim().min(1).max(10000),
    occurred_at: dateTime.optional(),
    next_step: optionalText(2000),
    next_step_due_date: dateOnly.optional(),
  })
  .strict()

export const enforcementDataKeys = [
  'alacakli',
  'borclu',
  'rolumuz',
  'alacak',
  'tahsilat',
  'odeme_emri',
  'itiraz',
  'kesinlesme',
  'son_islem',
  'tasinmaz',
  'arac',
  'banka',
  'sgk',
  'fiili',
  'sorgu_onerisi',
  'not',
] as const

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(5000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue).max(200),
    z.record(jsonValue),
  ])
)

export const enforcementDataSchema = z
  .object(Object.fromEntries(enforcementDataKeys.map((k) => [k, jsonValue.optional()])) as Record<
    (typeof enforcementDataKeys)[number],
    z.ZodOptional<z.ZodType<unknown>>
  >)
  .strict()

export const enforcementUpsertPayloadSchema = z
  .object({
    data: enforcementDataSchema,
    source_ref: optionalText(200),
  })
  .strict()

export const taskAddPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: optionalText(5000),
    due_date: z.union([dateOnly, dateTime]).nullable().optional(),
    priority: priority.optional(),
    category: z.enum(['dava', 'cmk', 'arabuluculuk', 'genel']).optional(),
  })
  .strict()

export const nextStepPayloadSchema = z
  .object({
    // workspace: davanın çalışma planı (beklenen / kontrol tarihi / aşama)
    // diary: günlüğe "sonraki adım" girdisi
    target: z.enum(['workspace', 'diary']).default('workspace'),
    stage: optionalText(120),
    waiting_for: optionalText(500),
    check_date: dateOnly.optional(),
    next_step: optionalText(2000),
    next_step_due_date: dateOnly.optional(),
  })
  .strict()
  .refine(
    (p) =>
      p.target === 'workspace'
        ? !!(p.stage || p.waiting_for || p.check_date)
        : !!p.next_step,
    { message: 'workspace için stage/waiting_for/check_date, diary için next_step gerekli' }
  )

export const statusChangePayloadSchema = z
  .object({
    status: z.enum(caseStatusValues),
    close_date: dateOnly.optional(),
    note: optionalText(2000),
  })
  .strict()

export const proposalPayloadSchemas = {
  case_upsert: caseUpsertPayloadSchema,
  hearing_upsert: hearingUpsertPayloadSchema,
  deadline_upsert: deadlineUpsertPayloadSchema,
  diary_add: diaryAddPayloadSchema,
  enforcement_upsert: enforcementUpsertPayloadSchema,
  task_add: taskAddPayloadSchema,
  next_step: nextStepPayloadSchema,
  status_change: statusChangePayloadSchema,
} as const satisfies Record<ProposalKind, z.ZodTypeAny>

export type ProposalPayloadMap = {
  [K in ProposalKind]: z.infer<(typeof proposalPayloadSchemas)[K]>
}

export function parseProposalPayload<K extends ProposalKind>(kind: K, payload: unknown) {
  return proposalPayloadSchemas[kind].safeParse(payload) as z.SafeParseReturnType<
    unknown,
    ProposalPayloadMap[K]
  >
}

// Batch öğesi: payload burada yalnızca obje olarak kabul edilir, türüne göre
// doğrulama parseProposalPayload ile öğe bazında yapılır (bir öğe hatalıysa
// partinin geri kalanı yine işlenir).
export const proposalItemSchema = z
  .object({
    kind: z.enum(proposalKindValues),
    external_ref: z.string().trim().min(1).max(200),
    case_ref: caseRefSchema.optional(),
    payload: z.record(z.unknown()),
    summary: z.string().trim().min(1).max(1000),
    reason: z.string().trim().max(5000).optional(),
    source: z.enum(proposalSourceValues),
    request_id: z.string().trim().min(8).max(100),
  })
  .strict()
export type ProposalItemInput = z.infer<typeof proposalItemSchema>

export const proposalBatchSchema = z.object({
  items: z.array(z.unknown()).min(1).max(200),
})

// Avukatın listede gördüğü önerinin updatedAt değeri (ISO). Sunucudaki değerle
// uyuşmazsa 409 PROPOSAL_CHANGED. Eski istemciler için isteğe bağlı.
const expectedUpdatedAtSchema = z
  .string()
  .trim()
  .refine((v) => Number.isFinite(Date.parse(v)), 'expected_updated_at ISO tarih-saat olmalı')

export const approveProposalSchema = z.object({
  payload: z.record(z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
  expected_updated_at: expectedUpdatedAtSchema.optional(),
  // Hedef kayıt öneriden sonra avukatça değiştiyse (409 TARGET_CHANGED) yine de uygula.
  force_overwrite: z.boolean().optional(),
})

export const rejectProposalSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  expected_updated_at: expectedUpdatedAtSchema.optional(),
})

// Toplu uçta force_overwrite YOKTUR; çakışan kalemler atlanır.
export const bulkProposalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional(),
  expected_updated_at: z.record(z.string().uuid(), expectedUpdatedAtSchema).optional(),
})

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(100),
  scopes: z.array(z.enum(apiKeyScopeValues)).min(1).max(2),
})
