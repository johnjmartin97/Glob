import { pgTable, uuid, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { exercises } from './exercises';

// Per-user overrides for an exercise's logging preferences. Lets a user customise
// settings (incl. for shared system exercises) without mutating the shared exercise row.
// Null columns mean "inherit the base default".
export const userExerciseSettings = pgTable(
  'user_exercise_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    weightUnit: text('weight_unit'),
    logRpe: boolean('log_rpe'),
    logVelocity: boolean('log_velocity'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.exerciseId)],
);
