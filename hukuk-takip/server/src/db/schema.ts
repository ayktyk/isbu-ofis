import {
  boolean,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'lawyer', 'assistant'])

export const caseStatusEnum = pgEnum('case_status', [
  'active',
  'istinafta',
  'yargıtayda',
  'passive',
  'closed',
  'won',
  'lost',
  'settled',
])

export const caseTypeEnum = pgEnum('case_type', [
  'iscilik_alacagi',
  'bosanma',
  'velayet',
  'mal_paylasimi',
  'kira',
  'tuketici',
  'icra',
  'ceza',
  'idare',
  'diger',
])

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
])

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
])

export const hearingResultEnum = pgEnum('hearing_result', [
  'pending',
  'completed',
  'postponed',
  'cancelled',
])

export const expenseTypeEnum = pgEnum('expense_type', [
  'court_fee',
  'notary',
  'expert',
  'travel',
  'document',
  'other',
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'hearing',
  'deadline',
  'task',
  'payment',
  'system',
])

export const consultationTypeEnum = pgEnum('consultation_type', ['phone', 'in_person'])

export const consultationStatusEnum = pgEnum('consultation_status', [
  'pending',    // bekliyor
  'potential',  // potansiyel müvekkil
  'converted',  // müvekkil oldu
  'declined',   // ilgilenmedi
])

export const consultationSourceEnum = pgEnum('consultation_source', [
  'client_referral', // müvekkil tavsiyesi
  'past_client',     // eski müvekkil (kendisi)
  'friend',          // arkadaş
  'google',
  'website',
  'other',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('lawyer').notNull(),
    barNumber: varchar('bar_number', { length: 50 }),
    phone: varchar('phone', { length: 20 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
)

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    tcNo: varchar('tc_no', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('clients_user_idx').on(table.userId),
  })
)

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'restrict' })
      .notNull(),
    caseNumber: varchar('case_number', { length: 100 }),
    courtName: varchar('court_name', { length: 255 }),
    caseType: caseTypeEnum('case_type').notNull(),
    customCaseType: varchar('custom_case_type', { length: 255 }),
    status: caseStatusEnum('status').default('active').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    startDate: date('start_date'),
    closeDate: date('close_date'),
    contractedFee: decimal('contracted_fee', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('TRY').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('cases_user_idx').on(table.userId),
    clientIdx: index('cases_client_idx').on(table.clientId),
    statusIdx: index('cases_status_idx').on(table.status),
  })
)

export const caseHearings = pgTable(
  'case_hearings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'cascade' })
      .notNull(),
    hearingDate: timestamp('hearing_date').notNull(),
    courtRoom: varchar('court_room', { length: 100 }),
    judge: varchar('judge', { length: 255 }),
    result: hearingResultEnum('result').default('pending').notNull(),
    notes: text('notes'),
    nextHearingDate: timestamp('next_hearing_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index('hearings_case_idx').on(table.caseId),
    dateIdx: index('hearings_date_idx').on(table.hearingDate),
  })
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
    label: varchar('label', { length: 100 }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('pending').notNull(),
    priority: taskPriorityEnum('priority').default('medium').notNull(),
    dueDate: timestamp('due_date'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('tasks_user_idx').on(table.userId),
    statusIdx: index('tasks_status_idx').on(table.status),
    dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
  })
)

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    type: expenseTypeEnum('type').notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('TRY').notNull(),
    expenseDate: date('expense_date').notNull(),
    receiptUrl: varchar('receipt_url', { length: 1000 }),
    isBillable: boolean('is_billable').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index('expenses_case_idx').on(table.caseId),
  })
)

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Polimorfik — caseId VEYA mediationFileId dolu olmalı (CHECK constraint ile DB'de zorlanır)
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    mediationFileId: uuid('mediation_file_id').references((): any => mediationFiles.id, {
      onDelete: 'cascade',
    }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('TRY').notNull(),
    collectionDate: date('collection_date').notNull(),
    description: varchar('description', { length: 500 }),
    paymentMethod: varchar('payment_method', { length: 50 }),
    receiptNo: varchar('receipt_no', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index('collections_case_idx').on(table.caseId),
    mediationIdx: index('collections_mediation_idx').on(table.mediationFileId),
    userIdx: index('collections_user_idx').on(table.userId),
  })
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    relatedId: uuid('related_id'),
    relatedType: varchar('related_type', { length: 50 }),
    isRead: boolean('is_read').default(false).notNull(),
    scheduledFor: timestamp('scheduled_for'),
    dismissedAt: timestamp('dismissed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index('notifications_user_read_idx').on(table.userId, table.isRead),
  })
)

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'cascade' })
      .notNull(),
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    fileName: varchar('file_name', { length: 500 }).notNull(),
    fileUrl: varchar('file_url', { length: 1000 }).notNull(),
    fileSize: integer('file_size'),
    mimeType: varchar('mime_type', { length: 100 }),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index('documents_case_idx').on(table.caseId),
  })
)

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Case = typeof cases.$inferSelect
export type NewCase = typeof cases.$inferInsert
export type CaseHearing = typeof caseHearings.$inferSelect
export type NewCaseHearing = typeof caseHearings.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert
export type Collection = typeof collections.$inferSelect
export type NewCollection = typeof collections.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export const mediationTypeEnum = pgEnum('mediation_type', ['dava_sarti', 'ihtiyari'])

export const mediationStatusEnum = pgEnum('mediation_status', [
  'active',
  'agreed',
  'not_agreed',
  'partially_agreed',
  'cancelled',
])

export const mediationFiles = pgTable(
  'mediation_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    fileNo: varchar('file_no', { length: 100 }),
    mediationType: mediationTypeEnum('mediation_type').notNull(),
    disputeType: varchar('dispute_type', { length: 255 }).notNull(),
    disputeSubject: text('dispute_subject'),
    status: mediationStatusEnum('status').default('active').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    agreedFee: decimal('agreed_fee', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('TRY').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('mediation_files_user_idx').on(table.userId),
    statusIdx: index('mediation_files_status_idx').on(table.status),
  })
)

export const mediationParties = pgTable(
  'mediation_parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediationFileId: uuid('mediation_file_id')
      .references(() => mediationFiles.id, { onDelete: 'cascade' })
      .notNull(),
    side: varchar('side', { length: 20 }).notNull(), // 'applicant' | 'respondent'
    fullName: varchar('full_name', { length: 255 }).notNull(),
    tcNo: varchar('tc_no', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    lawyerName: varchar('lawyer_name', { length: 255 }),
    lawyerBarNo: varchar('lawyer_bar_no', { length: 50 }),
    lawyerPhone: varchar('lawyer_phone', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    fileIdx: index('mediation_parties_file_idx').on(table.mediationFileId),
  })
)

export const consultations = pgTable(
  'consultations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    consultationDate: timestamp('consultation_date').notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    type: consultationTypeEnum('type').default('phone').notNull(),
    subject: varchar('subject', { length: 500 }),
    notes: text('notes'),
    status: consultationStatusEnum('status').default('pending').notNull(),
    source: consultationSourceEnum('source'),
    sourceDetail: varchar('source_detail', { length: 255 }),
    referredByClientId: uuid('referred_by_client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    nextActionDate: date('next_action_date'),
    convertedClientId: uuid('converted_client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('consultations_user_idx').on(table.userId),
    dateIdx: index('consultations_date_idx').on(table.consultationDate),
    statusIdx: index('consultations_status_idx').on(table.status),
  })
)

export type Consultation = typeof consultations.$inferSelect
export type NewConsultation = typeof consultations.$inferInsert

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
export type MediationFile = typeof mediationFiles.$inferSelect
export type NewMediationFile = typeof mediationFiles.$inferInsert
export type MediationParty = typeof mediationParties.$inferSelect
export type NewMediationParty = typeof mediationParties.$inferInsert

