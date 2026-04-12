export type CaseStatus =
  | 'active'
  | 'istinafta'
  | 'yargıtayda'
  | 'passive'
  | 'closed'
  | 'won'
  | 'lost'
  | 'settled'

export type CaseType =
  | 'iscilik_alacagi'
  | 'bosanma'
  | 'velayet'
  | 'mal_paylasimi'
  | 'kira'
  | 'tuketici'
  | 'icra'
  | 'ceza'
  | 'idare'
  | 'diger'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type HearingResult = 'pending' | 'completed' | 'postponed' | 'cancelled'
export type ExpenseType = 'court_fee' | 'notary' | 'expert' | 'travel' | 'document' | 'other'
export type NotificationType = 'hearing' | 'deadline' | 'task' | 'payment' | 'system'

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  error: string
  details?: Record<string, string[]>
}
