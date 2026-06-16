import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { exercises } from './exercises';

export const workoutTemplates = pgTable('workout_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templateExercises = pgTable('template_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercises.id),
  orderIndex: integer('order_index').notNull(),
  targetSets: integer('target_sets').notNull().default(1),
  targetReps: integer('target_reps'),
  targetLoadKg: numeric('target_load_kg', { precision: 6, scale: 2 }),
  targetLoadPct: numeric('target_load_pct', { precision: 5, scale: 2 }),
  referenceLiftId: uuid('reference_lift_id').references(() => exercises.id),
  notes: text('notes'),
  warmupEnabled: boolean('warmup_enabled').notNull().default(false),
  warmupSetCount: integer('warmup_set_count'),
  warmupPercentages: numeric('warmup_percentages', { precision: 5, scale: 2 }).array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
