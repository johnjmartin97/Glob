import { Router } from 'express';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { exercises, templateExercises } from '../../db/schema/index';
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

    res.json(rows.map(toExerciseDto));
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
