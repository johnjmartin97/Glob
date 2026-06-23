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
import { workoutTemplates, templateExercises } from './templates';

export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => workoutTemplates.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessionExercises = pgTable('session_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercises.id),
  orderIndex: integer('order_index').notNull(),
  templateExerciseId: uuid('template_exercise_id').references(() => templateExercises.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessionSets = pgTable('session_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionExerciseId: uuid('session_exercise_id')
    .notNull()
    .references(() => sessionExercises.id, { onDelete: 'cascade' }),
  setIndex: integer('set_index').notNull(),
  setType: text('set_type').notNull(),
  prescribedReps: integer('prescribed_reps'),
  prescribedLoadKg: numeric('prescribed_load_kg', { precision: 6, scale: 2 }),
  prescribedRpe: numeric('prescribed_rpe', { precision: 3, scale: 1 }),
  prescribedVelocityMps: numeric('prescribed_velocity_mps', { precision: 4, scale: 2 }),
  actualWeightKg: numeric('actual_weight_kg', { precision: 6, scale: 2 }),
  actualReps: integer('actual_reps'),
  actualRpe: numeric('actual_rpe', { precision: 3, scale: 1 }),
  actualVelocityMps: numeric('actual_velocity_mps', { precision: 4, scale: 2 }),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
