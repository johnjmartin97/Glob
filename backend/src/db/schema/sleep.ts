import { pgTable, uuid, text, integer, numeric, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sleepLogs = pgTable(
  'sleep_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    hoursSlept: numeric('hours_slept', { precision: 4, scale: 2 }).notNull(),
    hoursInBed: numeric('hours_in_bed', { precision: 4, scale: 2 }),
    qualityRating: integer('quality_rating'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.logDate)],
);
