import { pgTable, uuid, text, integer, boolean, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const supplements = pgTable('supplements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dosage: text('dosage'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supplementLogs = pgTable(
  'supplement_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplementId: uuid('supplement_id')
      .notNull()
      .references(() => supplements.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    taken: boolean('taken').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.supplementId, table.logDate)],
);
