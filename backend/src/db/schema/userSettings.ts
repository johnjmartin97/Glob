import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  weightUnit: text('weight_unit').notNull().default('kg'),
  timezone: text('timezone').notNull().default('UTC'),
  theme: text('theme').notNull().default('dark'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
