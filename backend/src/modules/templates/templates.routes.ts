import { Router } from 'express';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { exercises, templateExercises, workoutTemplates } from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';
import { toTemplateDto } from './templates.dto';

export const templatesRouter = Router();

templatesRouter.use(requireAuth);

const templateExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().min(0),
  targetSets: z.number().int().min(1).default(1),
  targetReps: z.number().int().min(1).nullable().optional(),
  targetLoadKg: z.number().min(0).nullable().optional(),
  targetLoadPct: z.number().min(0).max(100).nullable().optional(),
  referenceLiftId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  warmupEnabled: z.boolean().default(false),
  warmupSetCount: z.number().int().min(1).max(10).nullable().optional(),
  warmupPercentages: z.array(z.number().min(0).max(100)).nullable().optional(),
});

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  notes: z.string().max(1000).nullable().optional(),
  exercises: z.array(templateExerciseSchema),
});

function toNumericString(value: number | null | undefined): string | null {
  return value == null ? null : value.toString();
}

async function loadFullTemplate(templateId: string) {
  const template = await db.query.workoutTemplates.findFirst({
    where: eq(workoutTemplates.id, templateId),
  });
  if (!template) {
    return null;
  }

  const exerciseRows = await db.query.templateExercises.findMany({
    where: eq(templateExercises.templateId, templateId),
  });

  const exerciseIds = exerciseRows.map((row) => row.exerciseId);
  const exerciseLookup = exerciseIds.length
    ? await db.query.exercises.findMany({ where: inArray(exercises.id, exerciseIds) })
    : [];
  const exerciseById = new Map(exerciseLookup.map((e) => [e.id, e]));

  return toTemplateDto(
    template,
    exerciseRows.map((row) => ({ ...row, exercise: exerciseById.get(row.exerciseId) })),
  );
}

templatesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const templates = await db.query.workoutTemplates.findMany({
      where: eq(workoutTemplates.userId, req.userId),
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    });

    const result = await Promise.all(
      templates.map(async (template) => {
        const exerciseRows = await db.query.templateExercises.findMany({
          where: eq(templateExercises.templateId, template.id),
        });
        return {
          id: template.id,
          name: template.name,
          notes: template.notes,
          exerciseCount: exerciseRows.length,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        };
      }),
    );

    res.json(result);
  }),
);

templatesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = templateSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      const [template] = await tx
        .insert(workoutTemplates)
        .values({ userId: req.userId, name: body.name, notes: body.notes ?? null })
        .returning();

      if (body.exercises.length) {
        await tx.insert(templateExercises).values(
          body.exercises.map((ex) => ({
            templateId: template!.id,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps ?? null,
            targetLoadKg: toNumericString(ex.targetLoadKg),
            targetLoadPct: toNumericString(ex.targetLoadPct),
            referenceLiftId: ex.referenceLiftId ?? null,
            notes: ex.notes ?? null,
            warmupEnabled: ex.warmupEnabled,
            warmupSetCount: ex.warmupSetCount ?? null,
            warmupPercentages: ex.warmupPercentages?.map((p) => p.toString()) ?? null,
          })),
        );
      }

      return template!.id;
    });

    res.status(201).json(await loadFullTemplate(result));
  }),
);

templatesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const template = await db.query.workoutTemplates.findFirst({
      where: eq(workoutTemplates.id, req.params.id!),
    });
    if (!template || template.userId !== req.userId) {
      throw new NotFoundError('Template not found');
    }

    res.json(await loadFullTemplate(template.id));
  }),
);

templatesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = templateSchema.parse(req.body);

    const existing = await db.query.workoutTemplates.findFirst({
      where: eq(workoutTemplates.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Template not found');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(workoutTemplates)
        .set({ name: body.name, notes: body.notes ?? null, updatedAt: new Date() })
        .where(eq(workoutTemplates.id, existing.id));

      await tx.delete(templateExercises).where(eq(templateExercises.templateId, existing.id));

      if (body.exercises.length) {
        await tx.insert(templateExercises).values(
          body.exercises.map((ex) => ({
            templateId: existing.id,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps ?? null,
            targetLoadKg: toNumericString(ex.targetLoadKg),
            targetLoadPct: toNumericString(ex.targetLoadPct),
            referenceLiftId: ex.referenceLiftId ?? null,
            notes: ex.notes ?? null,
            warmupEnabled: ex.warmupEnabled,
            warmupSetCount: ex.warmupSetCount ?? null,
            warmupPercentages: ex.warmupPercentages?.map((p) => p.toString()) ?? null,
          })),
        );
      }
    });

    res.json(await loadFullTemplate(existing.id));
  }),
);

templatesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.query.workoutTemplates.findFirst({
      where: eq(workoutTemplates.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Template not found');
    }

    await db.delete(workoutTemplates).where(eq(workoutTemplates.id, existing.id));
    res.status(204).end();
  }),
);
