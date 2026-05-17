import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, clients, collections, mediationFiles } from '../db/schema.js'

/**
 * Bekleyen tahsilat tanımı — tek kaynak:
 *
 *   "Avukatın anlaştığı bir tutar var (contractedFee > 0) ve henüz tam tahsil
 *    edilmedi (SUM(collections.amount) < contractedFee). Dava ve tahsilat
 *    arşivlenmemiş olmalı. Dava durumundan bağımsız — kapatılmış olsa bile
 *    hâlâ bekleyen alacak varsa burada görünür."
 *
 * Dashboard widget'ı ve Statistics sayfası BU helper üzerinden veri çeker.
 * Filtre/limit/sıralama farklı olduğunda iki ekran arasında tutarsızlık
 * oluşuyordu — bu modül tek doğru kaynağı zorunlu kılar.
 *
 * cmk parametresi:
 *   - undefined: hem CMK hem normal (tüm bekleyen davalar)
 *   - 'exclude':  sadece normal davalar (CMK hariç)
 *   - 'only':     sadece CMK görevlendirmeleri
 */
export type CmkFilter = 'exclude' | 'only' | undefined

export interface OutstandingCaseRow {
  id: string
  title: string
  clientName: string | null
  contractedFee: string | null
  totalCollected: string
  remaining: string
  source: 'case'
  isCmkAssignment: boolean
  createdAt: Date | null
  status: string
}

/**
 * Tüm bekleyen dava ücretlerini döner (önce yenisi, sonra büyük tutarlı).
 * Limit isteğe bağlı; verilmezse tümü.
 */
export async function getOutstandingCaseFees(
  userId: string,
  options: { cmk?: CmkFilter; limit?: number } = {},
): Promise<OutstandingCaseRow[]> {
  const conditions = [
    eq(cases.userId, userId),
    isNull(cases.archivedAt),
    sql`${cases.contractedFee} IS NOT NULL`,
    sql`${cases.contractedFee}::numeric > 0`,
  ]
  if (options.cmk === 'only') {
    conditions.push(eq(cases.isCmkAssignment, true))
  } else if (options.cmk === 'exclude') {
    conditions.push(eq(cases.isCmkAssignment, false))
  }

  let query = db
    .select({
      id: cases.id,
      title: cases.title,
      clientName: clients.fullName,
      contractedFee: cases.contractedFee,
      totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      remaining: sql<string>`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
      source: sql<'case'>`'case'`,
      isCmkAssignment: cases.isCmkAssignment,
      createdAt: cases.createdAt,
      status: cases.status,
    })
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(
      collections,
      and(eq(collections.caseId, cases.id), isNull(collections.archivedAt)),
    )
    .where(and(...conditions))
    .groupBy(
      cases.id,
      cases.title,
      cases.contractedFee,
      cases.isCmkAssignment,
      cases.createdAt,
      cases.status,
      clients.fullName,
    )
    .having(
      sql`${cases.contractedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`,
    )
    .orderBy(
      desc(cases.createdAt),
      sql`${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`,
    ) as any

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit)
  }

  return (await query) as OutstandingCaseRow[]
}

export interface OutstandingMediationRow {
  id: string
  title: string
  clientName: string | null
  contractedFee: string | null
  totalCollected: string
  remaining: string
  source: 'mediation'
  createdAt: Date | null
}

/**
 * Bekleyen arabuluculuk ücretleri. Mediation'ların `status='active'` olanı
 * sayılır — aksi halde dosya kapatılmıştır.
 */
export async function getOutstandingMediationFees(
  userId: string,
  options: { limit?: number } = {},
): Promise<OutstandingMediationRow[]> {
  let query = db
    .select({
      id: mediationFiles.id,
      title: sql<string>`COALESCE(${mediationFiles.fileNo}, ${mediationFiles.disputeType})`,
      clientName: sql<string>`${mediationFiles.disputeType}`,
      contractedFee: mediationFiles.agreedFee,
      totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      remaining: sql<string>`(${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
      source: sql<'mediation'>`'mediation'`,
      createdAt: mediationFiles.createdAt,
    })
    .from(mediationFiles)
    .leftJoin(
      collections,
      and(eq(collections.mediationFileId, mediationFiles.id), isNull(collections.archivedAt)),
    )
    .where(
      and(
        eq(mediationFiles.userId, userId),
        isNull(mediationFiles.archivedAt),
        sql`${mediationFiles.agreedFee} IS NOT NULL`,
        sql`${mediationFiles.agreedFee}::numeric > 0`,
        eq(mediationFiles.status, 'active'),
      ),
    )
    .groupBy(
      mediationFiles.id,
      mediationFiles.fileNo,
      mediationFiles.disputeType,
      mediationFiles.agreedFee,
      mediationFiles.createdAt,
    )
    .having(
      sql`${mediationFiles.agreedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`,
    )
    .orderBy(
      desc(mediationFiles.createdAt),
      sql`${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`,
    ) as any

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit)
  }

  return (await query) as OutstandingMediationRow[]
}

/**
 * Bekleyen tahsilat toplamı (TL, string olarak). Yuvarlama kuralı: 2 ondalık.
 */
export function sumOutstanding(rows: Array<{ remaining: string }>): number {
  return rows.reduce((sum, row) => sum + parseFloat(row.remaining || '0'), 0)
}
