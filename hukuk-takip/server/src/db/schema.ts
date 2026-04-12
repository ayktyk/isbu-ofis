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
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'cascade' })
      .notNull(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'restrict' })
      .notNull(),
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
export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
