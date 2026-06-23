import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { exercises, templateExercises, userExerciseSettings } from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { toExerciseDto } from './exercises.dto';

export const exercisesRouter = Router();

exercisesRouter.use(requireAuth);

const EXERCISE_CATEGORIES = [
  'squat',
  'bench',
  'deadlift',
  'overhead_press',
  'accessory',
  'other',
] as const;

const WEIGHT_UNITS = ['kg', 'lb'] as const;

const createExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(EXERCISE_CATEGORIES),
  weightUnit: z.enum(WEIGHT_UNITS).optional(),
});

const updateExerciseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  weightUnit: z.enum(WEIGHT_UNITS).optional(),
});

// Per-user logging preferences for any exercise (incl. shared system exercises).
const updateExerciseSettingsSchema = z.object({
  weightUnit: z.enum(WEIGHT_UNITS).optional(),
  logRpe: z.boolean().optional(),
  logVelocity: z.boolean().optional(),
});

const listQuerySchema = z.object({
  category: z.enum(EXERCISE_CATEGORIES).optional(),
});

exercisesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);

    const conditions = [or(eq(exercises.userId, req.userId), isNull(exercises.userId))!];
    if (query.category) {
      conditions.push(eq(exercises.category, query.category));
    }

    const rows = await db.query.exercises.findMany({
      where: and(...conditions),
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    const overrides = await db.query.userExerciseSettings.findMany({
      where: eq(userExerciseSettings.userId, req.userId),
    });
    const overrideByExercise = new Map(overrides.map((o) => [o.exerciseId, o]));

    res.json(rows.map((row) => toExerciseDto(row, overrideByExercise.get(row.id))));
  }),
);

exercisesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createExerciseSchema.parse(req.body);

    const [created] = await db
      .insert(exercises)
      .values({ ...body, userId: req.userId, isSystem: false })
      .returning();

    res.status(201).json(toExerciseDto(created!));
  }),
);

exercisesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateExerciseSchema.parse(req.body);

    const existing = await db.query.exercises.findFirst({
      where: eq(exercises.id, req.params.id!),
    });
    if (!existing) {
      throw new NotFoundError('Exercise not found');
    }
    if (existing.isSystem || existing.userId !== req.userId) {
      throw new BadRequestError('Cannot modify this exercise');
    }

    const [updated] = await db
      .update(exercises)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(exercises.id, req.params.id!))
      .returning();

    res.json(toExerciseDto(updated!));
  }),
);

// Upsert the current user's per-exercise logging preferences. Works for system
// exercises too, since it never mutates the shared exercise row.
exercisesRouter.put(
  '/:id/settings',
  asyncHandler(async (req, res) => {
    const body = updateExerciseSettingsSchema.parse(req.body);

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, req.params.id!),
    });
    if (!exercise || (!exercise.isSystem && exercise.userId !== req.userId)) {
      throw new NotFoundError('Exercise not found');
    }

    const fields = {
      ...(body.weightUnit !== undefined ? { weightUnit: body.weightUnit } : {}),
      ...(body.logRpe !== undefined ? { logRpe: body.logRpe } : {}),
      ...(body.logVelocity !== undefined ? { logVelocity: body.logVelocity } : {}),
    };

    const [override] = await db
      .insert(userExerciseSettings)
      .values({ userId: req.userId, exerciseId: exercise.id, ...fields })
      .onConflictDoUpdate({
        target: [userExerciseSettings.userId, userExerciseSettings.exerciseId],
        set: { ...fields, updatedAt: new Date() },
      })
      .returning();

    res.json(toExerciseDto(exercise, override));
  }),
);

exercisesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.query.exercises.findFirst({
      where: eq(exercises.id, req.params.id!),
    });
    if (!existing) {
      throw new NotFoundError('Exercise not found');
    }
    if (existing.isSystem || existing.userId !== req.userId) {
      throw new BadRequestError('Cannot delete this exercise');
    }

    const referenced = await db.query.templateExercises.findFirst({
      where: eq(templateExercises.exerciseId, req.params.id!),
    });
    if (referenced) {
      throw new ConflictError('Exercise is used in a template and cannot be deleted');
    }

    await db.delete(exercises).where(eq(exercises.id, req.params.id!));
    res.status(204).end();
  }),
);
