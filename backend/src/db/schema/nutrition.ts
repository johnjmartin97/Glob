import { pgTable, uuid, text, integer, numeric, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const nutritionTargets = pgTable(
  'nutrition_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    effectiveDate: date('effective_date').notNull(),
    caloriesTarget: integer('calories_target').notNull(),
    proteinGTarget: numeric('protein_g_target', { precision: 6, scale: 1 }),
    carbsGTarget: numeric('carbs_g_target', { precision: 6, scale: 1 }),
    fatGTarget: numeric('fat_g_target', { precision: 6, scale: 1 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.effectiveDate)],
);

export const foodItems = pgTable('food_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  servingSize: numeric('serving_size', { precision: 8, scale: 2 }).notNull(),
  servingUnit: text('serving_unit').notNull(),
  calories: numeric('calories', { precision: 6, scale: 1 }).notNull(),
  proteinG: numeric('protein_g', { precision: 6, scale: 1 }).notNull(),
  carbsG: numeric('carbs_g', { precision: 6, scale: 1 }).notNull(),
  fatG: numeric('fat_g', { precision: 6, scale: 1 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const foodLogEntries = pgTable('food_log_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  foodItemId: uuid('food_item_id')
    .notNull()
    .references(() => foodItems.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  mealType: text('meal_type').notNull(),
  servings: numeric('servings', { precision: 6, scale: 2 }).notNull(),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
