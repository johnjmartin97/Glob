import { Router } from 'express';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { generateSessionSets } from '@glob/shared';
import { db } from '../../db/client';
import {
  exercises,
  sessionExercises,
  sessionSets,
  templateExercises,
  workoutSessions,
  workoutTemplates,
} from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';
import { toSessionDto } from './sessions.dto';

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

function toNumericString(value: number | null | undefined): string | null {
  return value == null ? null : value.toString();
}

const createSessionSchema = z.object({
  templateId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(1000).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

const addExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  notes: z.string().max(500).nullable().optional(),
});

const addSetSchema = z.object({
  setType: z.enum(['warmup', 'working']).default('working'),
  prescribedReps: z.number().int().min(0).nullable().optional(),
  prescribedLoadKg: z.number().min(0).nullable().optional(),
});

const updateSetSchema = z.object({
  prescribedReps: z.number().int().min(0).nullable().optional(),
  prescribedLoadKg: z.number().min(0).nullable().optional(),
  actualWeightKg: z.number().min(0).nullable().optional(),
  actualReps: z.number().int().min(0).nullable().optional(),
  actualRpe: z.number().min(0).max(10).nullable().optional(),
  completed: z.boolean().optional(),
});

async function loadFullSession(sessionId: string) {
  const session = await db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.id, sessionId),
  });
  if (!session) {
    return null;
  }

  const exerciseRows = await db.query.sessionExercises.findMany({
    where: eq(sessionExercises.sessionId, sessionId),
  });

  const exerciseIds = exerciseRows.map((row) => row.exerciseId);
  const exerciseLookup = exerciseIds.length
    ? await db.query.exercises.findMany({ where: inArray(exercises.id, exerciseIds) })
    : [];
  const exerciseById = new Map(exerciseLookup.map((e) => [e.id, e]));

  const sessionExerciseIds = exerciseRows.map((row) => row.id);
  const setRows = sessionExerciseIds.length
    ? await db.query.sessionSets.findMany({
        where: inArray(sessionSets.sessionExerciseId, sessionExerciseIds),
      })
    : [];
  const setsByExercise = new Map<string, typeof setRows>();
  for (const set of setRows) {
    const list = setsByExercise.get(set.sessionExerciseId) ?? [];
    list.push(set);
    setsByExercise.set(set.sessionExerciseId, list);
  }

  return toSessionDto(
    session,
    exerciseRows.map((row) => ({
      ...row,
      exercise: exerciseById.get(row.exerciseId),
      sets: setsByExercise.get(row.id) ?? [],
    })),
  );
}

async function getOwnedSession(sessionId: string, userId: string) {
  const session = await db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.id, sessionId),
  });
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Session not found');
  }
  return session;
}

async function getOwnedSessionExercise(sessionExerciseId: string, userId: string) {
  const sessionExercise = await db.query.sessionExercises.findFirst({
    where: eq(sessionExercises.id, sessionExerciseId),
  });
  if (!sessionExercise) {
    throw new NotFoundError('Session exercise not found');
  }
  await getOwnedSession(sessionExercise.sessionId, userId);
  return sessionExercise;
}

async function getOwnedSessionSet(setId: string, userId: string) {
  const set = await db.query.sessionSets.findFirst({ where: eq(sessionSets.id, setId) });
  if (!set) {
    throw new NotFoundError('Set not found');
  }
  await getOwnedSessionExercise(set.sessionExerciseId, userId);
  return set;
}

sessionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessions = await db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, req.userId),
      orderBy: (table, { desc }) => [desc(table.startedAt)],
    });

    const result = await Promise.all(
      sessions.map(async (session) => {
        const exerciseRows = await db.query.sessionExercises.findMany({
          where: eq(sessionExercises.sessionId, session.id),
        });
        return {
          id: session.id,
          templateId: session.templateId,
          name: session.name,
          startedAt: session.startedAt.toISOString(),
          completedAt: session.completedAt ? session.completedAt.toISOString() : null,
          exerciseCount: exerciseRows.length,
        };
      }),
    );

    res.json(result);
  }),
);

sessionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSessionSchema.parse(req.body);

    const sessionId = await db.transaction(async (tx) => {
      let sessionName = body.name;
      let templateId: string | null = null;
      let sourceExercises: (typeof templateExercises.$inferSelect)[] = [];

      if (body.templateId) {
        const template = await tx.query.workoutTemplates.findFirst({
          where: eq(workoutTemplates.id, body.templateId),
        });
        if (!template || template.userId !== req.userId) {
          throw new NotFoundError('Template not found');
        }
        templateId = template.id;
        sessionName = sessionName ?? template.name;
        sourceExercises = await tx.query.templateExercises.findMany({
          where: eq(templateExercises.templateId, template.id),
          orderBy: (table, { asc }) => [asc(table.orderIndex)],
        });
      }

      if (!sessionName) {
        throw new NotFoundError('Session name is required when not starting from a template');
      }

      const [session] = await tx
        .insert(workoutSessions)
        .values({ userId: req.userId, templateId, name: sessionName })
        .returning();

      for (const templateExercise of sourceExercises) {
        const [sessionExercise] = await tx
          .insert(sessionExercises)
          .values({
            sessionId: session!.id,
            exerciseId: templateExercise.exerciseId,
            orderIndex: templateExercise.orderIndex,
            templateExerciseId: templateExercise.id,
            notes: templateExercise.notes,
          })
          .returning();

        const generatedSets = generateSessionSets({
          targetSets: templateExercise.targetSets,
          targetReps: templateExercise.targetReps,
          targetLoadKg:
            templateExercise.targetLoadKg == null ? null : Number(templateExercise.targetLoadKg),
          warmupEnabled: templateExercise.warmupEnabled,
          warmupSetCount: templateExercise.warmupSetCount,
          warmupPercentages: templateExercise.warmupPercentages
            ? templateExercise.warmupPercentages.map((p) => Number(p))
            : null,
        });

        if (generatedSets.length) {
          await tx.insert(sessionSets).values(
            generatedSets.map((set) => ({
              sessionExerciseId: sessionExercise!.id,
              setIndex: set.setIndex,
              setType: set.setType,
              prescribedReps: set.prescribedReps,
              prescribedLoadKg: toNumericString(set.prescribedLoadKg),
            })),
          );
        }
      }

      return session!.id;
    });

    res.status(201).json(await loadFullSession(sessionId));
  }),
);

sessionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await getOwnedSession(req.params.id!, req.userId);
    res.json(await loadFullSession(req.params.id!));
  }),
);

sessionsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateSessionSchema.parse(req.body);
    const session = await getOwnedSession(req.params.id!, req.userId);

    await db
      .update(workoutSessions)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.completedAt !== undefined
          ? { completedAt: body.completedAt ? new Date(body.completedAt) : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(workoutSessions.id, session.id));

    res.json(await loadFullSession(session.id));
  }),
);

sessionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req.params.id!, req.userId);
    await db.delete(workoutSessions).where(eq(workoutSessions.id, session.id));
    res.status(204).end();
  }),
);

sessionsRouter.post(
  '/:id/exercises',
  asyncHandler(async (req, res) => {
    const body = addExerciseSchema.parse(req.body);
    const session = await getOwnedSession(req.params.id!, req.userId);

    const existing = await db.query.sessionExercises.findMany({
      where: eq(sessionExercises.sessionId, session.id),
    });

    await db.insert(sessionExercises).values({
      sessionId: session.id,
      exerciseId: body.exerciseId,
      orderIndex: existing.length,
      notes: body.notes ?? null,
    });

    res.status(201).json(await loadFullSession(session.id));
  }),
);

sessionsRouter.delete(
  '/:id/exercises/:exerciseId',
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req.params.id!, req.userId);

    const sessionExercise = await db.query.sessionExercises.findFirst({
      where: eq(sessionExercises.id, req.params.exerciseId!),
    });
    if (!sessionExercise || sessionExercise.sessionId !== session.id) {
      throw new NotFoundError('Session exercise not found');
    }

    await db.delete(sessionExercises).where(eq(sessionExercises.id, sessionExercise.id));
    res.status(204).end();
  }),
);

sessionsRouter.post(
  '/:id/exercises/:exerciseId/sets',
  asyncHandler(async (req, res) => {
    const body = addSetSchema.parse(req.body);
    const session = await getOwnedSession(req.params.id!, req.userId);

    const sessionExercise = await db.query.sessionExercises.findFirst({
      where: eq(sessionExercises.id, req.params.exerciseId!),
    });
    if (!sessionExercise || sessionExercise.sessionId !== session.id) {
      throw new NotFoundError('Session exercise not found');
    }

    const existingSets = await db.query.sessionSets.findMany({
      where: eq(sessionSets.sessionExerciseId, sessionExercise.id),
    });

    await db.insert(sessionSets).values({
      sessionExerciseId: sessionExercise.id,
      setIndex: existingSets.length + 1,
      setType: body.setType,
      prescribedReps: body.prescribedReps ?? null,
      prescribedLoadKg: toNumericString(body.prescribedLoadKg),
    });

    res.status(201).json(await loadFullSession(session.id));
  }),
);

sessionsRouter.patch(
  '/sets/:setId',
  asyncHandler(async (req, res) => {
    const body = updateSetSchema.parse(req.body);
    const set = await getOwnedSessionSet(req.params.setId!, req.userId);

    const completedAt =
      body.completed === undefined
        ? undefined
        : body.completed
          ? (set.completedAt ?? new Date())
          : null;

    const [updated] = await db
      .update(sessionSets)
      .set({
        ...(body.prescribedReps !== undefined ? { prescribedReps: body.prescribedReps } : {}),
        ...(body.prescribedLoadKg !== undefined
          ? { prescribedLoadKg: toNumericString(body.prescribedLoadKg) }
          : {}),
        ...(body.actualWeightKg !== undefined
          ? { actualWeightKg: toNumericString(body.actualWeightKg) }
          : {}),
        ...(body.actualReps !== undefined ? { actualReps: body.actualReps } : {}),
        ...(body.actualRpe !== undefined ? { actualRpe: toNumericString(body.actualRpe) } : {}),
        ...(body.completed !== undefined ? { completed: body.completed, completedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sessionSets.id, set.id))
      .returning();

    const sessionExercise = await db.query.sessionExercises.findFirst({
      where: eq(sessionExercises.id, updated!.sessionExerciseId),
    });

    res.json(await loadFullSession(sessionExercise!.sessionId));
  }),
);

sessionsRouter.delete(
  '/sets/:setId',
  asyncHandler(async (req, res) => {
    const set = await getOwnedSessionSet(req.params.setId!, req.userId);
    const sessionExercise = await db.query.sessionExercises.findFirst({
      where: eq(sessionExercises.id, set.sessionExerciseId),
    });

    await db.delete(sessionSets).where(eq(sessionSets.id, set.id));
    res.json(await loadFullSession(sessionExercise!.sessionId));
  }),
);
