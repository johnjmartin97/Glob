import { pgTable, uuid, text, integer, numeric, date, json, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ReadinessSnapshot } from '@glob/shared';
import { users } from './users';
import { exercises } from './exercises';
import { workoutTemplates } from './templates';
import { workoutSessions } from './sessions';

export const coachingPlans = pgTable(
  'coaching_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'),
    goal: text('goal').notNull(),
    durationWeeks: integer('duration_weeks').notNull(),
    daysPerWeek: integer('days_per_week').notNull(),
    startDate: date('start_date').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    model: text('model').notNull(),
    readinessSnapshot: json('readiness_snapshot').$type<ReadinessSnapshot>().notNull(),
    rationale: text('rationale').notNull(),
    rawLlmResponse: json('raw_llm_response'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('coaching_plans_one_active_idx')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const coachingPlanWeeks = pgTable(
  'coaching_plan_weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => coachingPlans.id, { onDelete: 'cascade' }),
    weekIndex: integer('week_index').notNull(),
    focus: text('focus'),
    rationale: text('rationale'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.planId, table.weekIndex)],
);

export const coachingPlanSessions = pgTable(
  'coaching_plan_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => coachingPlans.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id')
      .notNull()
      .references(() => coachingPlanWeeks.id, { onDelete: 'cascade' }),
    dayIndex: integer('day_index').notNull(),
    label: text('label').notNull(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => workoutSessions.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    rationale: text('rationale'),
    statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.weekId, table.dayIndex)],
);

// Per-plan running estimate of each main lift's 1RM, used to autoregulate the loads of
// upcoming sessions from the lifter's actual performance.
export const coachingPlanLifts = pgTable(
  'coaching_plan_lifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => coachingPlans.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    estimated1rmKg: numeric('estimated_1rm_kg', { precision: 6, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.planId, table.exerciseId)],
);
