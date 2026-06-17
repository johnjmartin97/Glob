import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, ilike, inArray, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { foodItems, foodLogEntries, nutritionTargets } from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ConflictError, HttpError, NotFoundError } from '../../utils/errors';
import type { ExternalFoodResult } from '@glob/shared';
import { env } from '../../config/env';
import { toFoodItemDto, toFoodLogEntryDto, toNutritionTargetDto } from './nutrition.dto';

export const nutritionRouter = Router();

nutritionRouter.use(requireAuth);

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumericString(value: number | null | undefined): string | null {
  return value == null ? null : value.toString();
}

const targetSchema = z.object({
  effectiveDate: z.string().date().optional(),
  caloriesTarget: z.number().int().min(0),
  proteinGTarget: z.number().min(0).nullable().optional(),
  carbsGTarget: z.number().min(0).nullable().optional(),
  fatGTarget: z.number().min(0).nullable().optional(),
});

const foodItemSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(200).nullable().optional(),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1).max(50),
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
});

const foodItemUpdateSchema = foodItemSchema.partial();

const logEntrySchema = z.object({
  foodItemId: z.string().uuid(),
  logDate: z.string().date(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number().positive(),
});

const logEntryUpdateSchema = z.object({
  logDate: z.string().date().optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  servings: z.number().positive().optional(),
});

// --- Targets ---

nutritionRouter.get(
  '/targets',
  asyncHandler(async (req, res) => {
    const rows = await db.query.nutritionTargets.findMany({
      where: eq(nutritionTargets.userId, req.userId),
      orderBy: (table, { desc: descOrder }) => [descOrder(table.effectiveDate)],
    });
    res.json(rows.map(toNutritionTargetDto));
  }),
);

nutritionRouter.get(
  '/targets/current',
  asyncHandler(async (req, res) => {
    const row = await db.query.nutritionTargets.findFirst({
      where: and(
        eq(nutritionTargets.userId, req.userId),
        lte(nutritionTargets.effectiveDate, todayDateString()),
      ),
      orderBy: (table, { desc: descOrder }) => [descOrder(table.effectiveDate)],
    });
    res.json(row ? toNutritionTargetDto(row) : null);
  }),
);

nutritionRouter.put(
  '/targets/current',
  asyncHandler(async (req, res) => {
    const body = targetSchema.parse(req.body);
    const effectiveDate = body.effectiveDate ?? todayDateString();

    const [row] = await db
      .insert(nutritionTargets)
      .values({
        userId: req.userId,
        effectiveDate,
        caloriesTarget: body.caloriesTarget,
        proteinGTarget: toNumericString(body.proteinGTarget),
        carbsGTarget: toNumericString(body.carbsGTarget),
        fatGTarget: toNumericString(body.fatGTarget),
      })
      .onConflictDoUpdate({
        target: [nutritionTargets.userId, nutritionTargets.effectiveDate],
        set: {
          caloriesTarget: body.caloriesTarget,
          proteinGTarget: toNumericString(body.proteinGTarget),
          carbsGTarget: toNumericString(body.carbsGTarget),
          fatGTarget: toNumericString(body.fatGTarget),
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(toNutritionTargetDto(row!));
  }),
);

// --- External food search (USDA FoodData Central) ---

interface FdcNutrient {
  nutrientId: number;
  value?: number | null;
}

interface FdcFood {
  description?: string | null;
  brandOwner?: string | null;
  brandName?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  foodNutrients?: FdcNutrient[];
}

interface FdcApiResponse {
  foods?: FdcFood[];
}

const KCAL_ID = 1008, PROTEIN_ID = 1003, CARBS_ID = 1005, FAT_ID = 1004;

function nutrientValue(nutrients: FdcNutrient[], id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

function transformFood(f: FdcFood): ExternalFoodResult | null {
  const name = f.description?.trim() ?? '';
  if (!name) return null;

  const nutrients = f.foodNutrients ?? [];
  const calories = nutrientValue(nutrients, KCAL_ID);
  if (!isFinite(calories)) return null;

  const brand = (f.brandName ?? f.brandOwner ?? '').trim() || null;

  return {
    name,
    brand,
    servingSize: Math.round((f.servingSize ?? 100) * 100) / 100,
    servingUnit: f.servingSizeUnit?.trim() || 'g',
    calories: Math.round(calories * 10) / 10,
    proteinG: Math.round(nutrientValue(nutrients, PROTEIN_ID) * 10) / 10,
    carbsG: Math.round(nutrientValue(nutrients, CARBS_ID) * 10) / 10,
    fatG: Math.round(nutrientValue(nutrients, FAT_ID) * 10) / 10,
  };
}

nutritionRouter.get(
  '/foods/search-external',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) { res.json([]); return; }

    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('query', q);
    url.searchParams.set('api_key', env.USDA_API_KEY);
    url.searchParams.set('dataType', 'Branded');
    url.searchParams.set('pageSize', '15');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new HttpError(502, 'External food database unavailable');

    const data = await response.json() as FdcApiResponse;
    const results = (data.foods ?? [])
      .map(transformFood)
      .filter((r): r is ExternalFoodResult => r !== null);

    res.json(results);
  }),
);

nutritionRouter.get(
  '/foods/barcode/:upc',
  asyncHandler(async (req, res) => {
    const upc = (req.params.upc ?? '').trim();

    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('query', upc);
    url.searchParams.set('api_key', env.USDA_API_KEY);
    url.searchParams.set('dataType', 'Branded');
    url.searchParams.set('pageSize', '5');

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new HttpError(502, 'External food database unavailable');

    const data = await response.json() as FdcApiResponse;
    const result = (data.foods ?? []).map(transformFood).find((r): r is ExternalFoodResult => r !== null) ?? null;

    res.json(result);
  }),
);

// --- Food items ---

nutritionRouter.get(
  '/foods',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const conditions = [eq(foodItems.userId, req.userId)];
    if (search) {
      conditions.push(ilike(foodItems.name, `%${search}%`));
    }

    const rows = await db.query.foodItems.findMany({
      where: and(...conditions),
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    res.json(rows.map(toFoodItemDto));
  }),
);

nutritionRouter.post(
  '/foods',
  asyncHandler(async (req, res) => {
    const body = foodItemSchema.parse(req.body);

    const [created] = await db
      .insert(foodItems)
      .values({
        userId: req.userId,
        name: body.name,
        brand: body.brand ?? null,
        servingSize: body.servingSize.toString(),
        servingUnit: body.servingUnit,
        calories: body.calories.toString(),
        proteinG: body.proteinG.toString(),
        carbsG: body.carbsG.toString(),
        fatG: body.fatG.toString(),
      })
      .returning();

    res.status(201).json(toFoodItemDto(created!));
  }),
);

nutritionRouter.patch(
  '/foods/:id',
  asyncHandler(async (req, res) => {
    const body = foodItemUpdateSchema.parse(req.body);

    const existing = await db.query.foodItems.findFirst({
      where: eq(foodItems.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Food item not found');
    }

    const [updated] = await db
      .update(foodItems)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.brand !== undefined ? { brand: body.brand } : {}),
        ...(body.servingSize !== undefined ? { servingSize: body.servingSize.toString() } : {}),
        ...(body.servingUnit !== undefined ? { servingUnit: body.servingUnit } : {}),
        ...(body.calories !== undefined ? { calories: body.calories.toString() } : {}),
        ...(body.proteinG !== undefined ? { proteinG: body.proteinG.toString() } : {}),
        ...(body.carbsG !== undefined ? { carbsG: body.carbsG.toString() } : {}),
        ...(body.fatG !== undefined ? { fatG: body.fatG.toString() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(foodItems.id, existing.id))
      .returning();

    res.json(toFoodItemDto(updated!));
  }),
);

nutritionRouter.delete(
  '/foods/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.query.foodItems.findFirst({
      where: eq(foodItems.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Food item not found');
    }

    const referenced = await db.query.foodLogEntries.findFirst({
      where: eq(foodLogEntries.foodItemId, existing.id),
    });
    if (referenced) {
      throw new ConflictError('Food item is used in the food diary and cannot be deleted');
    }

    await db.delete(foodItems).where(eq(foodItems.id, existing.id));
    res.status(204).end();
  }),
);

// --- Food log ---

nutritionRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : todayDateString();

    const entries = await db.query.foodLogEntries.findMany({
      where: and(eq(foodLogEntries.userId, req.userId), eq(foodLogEntries.logDate, date)),
      orderBy: (table, { asc }) => [asc(table.loggedAt)],
    });

    const foodItemIds = entries.map((e) => e.foodItemId);
    const foodItemRows = foodItemIds.length
      ? await db.query.foodItems.findMany({ where: inArray(foodItems.id, foodItemIds) })
      : [];
    const foodItemById = new Map(foodItemRows.map((f) => [f.id, f]));

    const totals = entries.reduce(
      (acc, entry) => {
        const food = foodItemById.get(entry.foodItemId);
        if (!food) return acc;
        const servings = Number(entry.servings);
        acc.calories += Number(food.calories) * servings;
        acc.proteinG += Number(food.proteinG) * servings;
        acc.carbsG += Number(food.carbsG) * servings;
        acc.fatG += Number(food.fatG) * servings;
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

    const target = await db.query.nutritionTargets.findFirst({
      where: and(eq(nutritionTargets.userId, req.userId), lte(nutritionTargets.effectiveDate, date)),
      orderBy: (table, { desc: descOrder }) => [descOrder(table.effectiveDate)],
    });

    res.json({
      date,
      entries: entries.map((entry) => toFoodLogEntryDto(entry, foodItemById.get(entry.foodItemId))),
      totals,
      target: target ? toNutritionTargetDto(target) : null,
    });
  }),
);

nutritionRouter.post(
  '/logs',
  asyncHandler(async (req, res) => {
    const body = logEntrySchema.parse(req.body);

    const foodItem = await db.query.foodItems.findFirst({
      where: eq(foodItems.id, body.foodItemId),
    });
    if (!foodItem || foodItem.userId !== req.userId) {
      throw new NotFoundError('Food item not found');
    }

    const [created] = await db
      .insert(foodLogEntries)
      .values({
        userId: req.userId,
        foodItemId: body.foodItemId,
        logDate: body.logDate,
        mealType: body.mealType,
        servings: body.servings.toString(),
      })
      .returning();

    res.status(201).json(toFoodLogEntryDto(created!, foodItem));
  }),
);

nutritionRouter.patch(
  '/logs/:id',
  asyncHandler(async (req, res) => {
    const body = logEntryUpdateSchema.parse(req.body);

    const existing = await db.query.foodLogEntries.findFirst({
      where: eq(foodLogEntries.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Food log entry not found');
    }

    const [updated] = await db
      .update(foodLogEntries)
      .set({
        ...(body.logDate !== undefined ? { logDate: body.logDate } : {}),
        ...(body.mealType !== undefined ? { mealType: body.mealType } : {}),
        ...(body.servings !== undefined ? { servings: body.servings.toString() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(foodLogEntries.id, existing.id))
      .returning();

    const foodItem = await db.query.foodItems.findFirst({
      where: eq(foodItems.id, updated!.foodItemId),
    });

    res.json(toFoodLogEntryDto(updated!, foodItem));
  }),
);

nutritionRouter.delete(
  '/logs/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.query.foodLogEntries.findFirst({
      where: eq(foodLogEntries.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Food log entry not found');
    }

    await db.delete(foodLogEntries).where(eq(foodLogEntries.id, existing.id));
    res.status(204).end();
  }),
);
