import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  DEFAULT_LOAD_VELOCITY_PROFILES,
  roundToNearestIncrement,
  targetVelocityForLoadPct,
  type ExerciseCategory,
} from '@glob/shared';
import type { CoachingPlanDetail, CoachingPlanSessionDetail } from '@glob/shared';
import { db } from '../../db/client';
import {
  coachingPlanSessions,
  coachingPlanWeeks,
  coachingPlans,
  exercises,
  templateExercises,
  workoutTemplates,
} from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { toTemplateExerciseDto } from '../templates/templates.dto';
import { computeReadinessSnapshot, computeVelocityProfiles, loadCoachMetricsInput } from './coach.metrics';
import { COACH_MODEL, generateTrainingPlan, type LlmPlanResponse } from './coach.llm';
import { toCoachingPlanDetailDto, toCoachingPlanSessionDto, toCoachingPlanSummaryDto, toCoachingPlanWeekDto } from './coach.dto';

export const coachRouter = Router();

coachRouter.use(requireAuth);

const GOALS = ['strength', 'hypertrophy', 'peaking', 'general_fitness'] as const;

const generatePlanSchema = z.object({
  goal: z.enum(GOALS),
  durationWeeks: z.number().int().min(1).max(16),
  daysPerWeek: z.number().int().min(1).max(7),
});

const updatePlanSessionSchema = z.object({
  status: z.enum(['pending', 'completed', 'skipped']).optional(),
  sessionId: z.string().uuid().optional(),
});

const updatePlanSchema = z.object({
  status: z.literal('abandoned'),
});

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumericString(value: number | null | undefined): string | null {
  return value == null ? null : value.toString();
}

function resolveSetLoadKg(
  set: { loadKg: number | null; loadPct: number | null },
  workingLoadKg: number | null,
): number | null {
  if (set.loadKg != null) return set.loadKg;
  if (set.loadPct != null && workingLoadKg != null) {
    return roundToNearestIncrement(workingLoadKg * (set.loadPct / 100));
  }
  return null;
}

// The %1RM a set represents — taken directly from loadPct, else inferred from loadKg vs the
// first working set's load (mirrors how warmup percentages are derived elsewhere).
function resolveSetLoadPct(
  set: { loadKg: number | null; loadPct: number | null },
  firstWorkingLoadKg: number | null,
): number | null {
  if (set.loadPct != null) return set.loadPct;
  if (set.loadKg != null && firstWorkingLoadKg) {
    return Math.round((set.loadKg / firstWorkingLoadKg) * 100);
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function loadFullPlan(planId: string): Promise<CoachingPlanDetail | null> {
  const plan = await db.query.coachingPlans.findFirst({ where: eq(coachingPlans.id, planId) });
  if (!plan) {
    return null;
  }

  const weekRows = await db.query.coachingPlanWeeks.findMany({
    where: eq(coachingPlanWeeks.planId, planId),
  });
  const weekIds = weekRows.map((w) => w.id);
  const sessionRows = weekIds.length
    ? await db.query.coachingPlanSessions.findMany({ where: inArray(coachingPlanSessions.weekId, weekIds) })
    : [];

  const templateIds = sessionRows.map((s) => s.templateId);
  const templateExerciseRows = templateIds.length
    ? await db.query.templateExercises.findMany({ where: inArray(templateExercises.templateId, templateIds) })
    : [];
  const exerciseIds = [...new Set(templateExerciseRows.map((row) => row.exerciseId))];
  const exerciseLookup = exerciseIds.length
    ? await db.query.exercises.findMany({ where: inArray(exercises.id, exerciseIds) })
    : [];
  const exerciseById = new Map(exerciseLookup.map((e) => [e.id, e]));

  const templateExercisesByTemplate = new Map<string, typeof templateExerciseRows>();
  for (const row of templateExerciseRows) {
    const list = templateExercisesByTemplate.get(row.templateId) ?? [];
    list.push(row);
    templateExercisesByTemplate.set(row.templateId, list);
  }

  const sessionDtosByWeek = new Map<string, CoachingPlanSessionDetail[]>();
  for (const session of sessionRows) {
    const exerciseRows = templateExercisesByTemplate.get(session.templateId) ?? [];
    const exerciseDtos = exerciseRows
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((row) => toTemplateExerciseDto(row, exerciseById.get(row.exerciseId)));
    const dto = toCoachingPlanSessionDto(session, exerciseDtos);
    const list = sessionDtosByWeek.get(session.weekId) ?? [];
    list.push(dto);
    sessionDtosByWeek.set(session.weekId, list);
  }

  const weekDtos = weekRows.map((week) => toCoachingPlanWeekDto(week, sessionDtosByWeek.get(week.id) ?? []));

  return toCoachingPlanDetailDto(plan, weekDtos);
}

coachRouter.get(
  '/readiness',
  asyncHandler(async (req, res) => {
    const asOfDate = todayDateString();
    const input = await loadCoachMetricsInput(req.userId, asOfDate);
    res.json(computeReadinessSnapshot(input));
  }),
);

coachRouter.post(
  '/plans',
  asyncHandler(async (req, res) => {
    const body = generatePlanSchema.parse(req.body);
    const asOfDate = todayDateString();

    const metricsInput = await loadCoachMetricsInput(req.userId, asOfDate);
    const readiness = computeReadinessSnapshot(metricsInput);
    const velocityProfiles = computeVelocityProfiles(metricsInput);

    const existingExercises = await db.query.exercises.findMany({
      where: or(eq(exercises.userId, req.userId), isNull(exercises.userId)),
    });
    const exerciseIdByName = new Map(existingExercises.map((e) => [e.name.trim().toLowerCase(), e.id]));

    const llmResponse: LlmPlanResponse = await generateTrainingPlan({
      readiness,
      goal: body.goal,
      durationWeeks: body.durationWeeks,
      daysPerWeek: body.daysPerWeek,
      availableExercises: existingExercises.map((e) => ({
        name: e.name,
        category: e.category as ExerciseCategory,
      })),
    });

    const planId = await db.transaction(async (tx) => {
      await tx
        .update(coachingPlans)
        .set({ status: 'superseded', updatedAt: new Date() })
        .where(and(eq(coachingPlans.userId, req.userId), eq(coachingPlans.status, 'active')));

      const [plan] = await tx
        .insert(coachingPlans)
        .values({
          userId: req.userId,
          status: 'active',
          goal: body.goal,
          durationWeeks: body.durationWeeks,
          daysPerWeek: body.daysPerWeek,
          startDate: asOfDate,
          model: COACH_MODEL,
          readinessSnapshot: readiness,
          rationale: llmResponse.overallRationale,
          rawLlmResponse: llmResponse,
        })
        .returning();

      for (const week of llmResponse.weeks) {
        const [weekRow] = await tx
          .insert(coachingPlanWeeks)
          .values({
            planId: plan!.id,
            weekIndex: week.weekIndex,
            focus: week.focus,
            rationale: week.rationale,
          })
          .returning();

        for (const session of week.sessions) {
          const [template] = await tx
            .insert(workoutTemplates)
            .values({
              userId: req.userId,
              name: session.label,
              source: 'ai_coach',
            })
            .returning();

          for (const [orderIndex, exercise] of session.exercises.entries()) {
            const key = exercise.exerciseName.trim().toLowerCase();
            let exerciseId = exerciseIdByName.get(key);
            if (!exerciseId) {
              const [created] = await tx
                .insert(exercises)
                .values({
                  userId: req.userId,
                  name: exercise.exerciseName.trim(),
                  category: exercise.category,
                  isSystem: false,
                })
                .returning();
              exerciseId = created!.id;
              exerciseIdByName.set(key, exerciseId);
            }

            const warmupSets = exercise.sets.filter((s) => s.isWarmup).sort((a, b) => a.setIndex - b.setIndex);
            const workingSets = exercise.sets.filter((s) => !s.isWarmup).sort((a, b) => a.setIndex - b.setIndex);
            const firstWorkingLoadKg = workingSets[0]?.loadKg ?? null;

            const warmupEnabled = warmupSets.length > 0 && firstWorkingLoadKg != null;
            const warmupPercentages = warmupEnabled
              ? warmupSets.map((s) => {
                  if (s.loadPct != null) return s.loadPct;
                  if (s.loadKg != null && firstWorkingLoadKg) {
                    return Math.round((s.loadKg / firstWorkingLoadKg) * 100);
                  }
                  return 50;
                })
              : null;
            const warmupRepsPerSet = warmupEnabled ? warmupSets.map((s) => s.reps) : null;

            const velocityProfile =
              velocityProfiles.get(key) ?? DEFAULT_LOAD_VELOCITY_PROFILES[exercise.category];
            const setsConfig = workingSets.length
              ? workingSets.map((s) => {
                  const loadPct = resolveSetLoadPct(s, firstWorkingLoadKg);
                  return {
                    loadKg: resolveSetLoadKg(s, firstWorkingLoadKg),
                    reps: s.reps,
                    rpe: s.targetRpe ?? null,
                    velocityMps:
                      loadPct == null ? null : round2(targetVelocityForLoadPct(loadPct, velocityProfile)),
                  };
                })
              : null;

            await tx.insert(templateExercises).values({
              templateId: template!.id,
              exerciseId,
              orderIndex,
              targetSets: workingSets.length || 1,
              targetReps: workingSets[0]?.reps ?? null,
              targetLoadKg: toNumericString(setsConfig?.[0]?.loadKg ?? null),
              notes: exercise.notes,
              warmupEnabled,
              warmupSetCount: warmupEnabled ? warmupSets.length : null,
              warmupPercentages: warmupPercentages?.map((p) => p.toString()) ?? null,
              warmupRepsPerSet,
              setsConfig,
            });
          }

          await tx.insert(coachingPlanSessions).values({
            planId: plan!.id,
            weekId: weekRow!.id,
            dayIndex: session.dayIndex,
            label: session.label,
            templateId: template!.id,
            rationale: session.rationale,
          });
        }
      }

      return plan!.id;
    });

    res.status(201).json(await loadFullPlan(planId));
  }),
);

coachRouter.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const plans = await db.query.coachingPlans.findMany({
      where: eq(coachingPlans.userId, req.userId),
      orderBy: (table, { desc }) => [desc(table.generatedAt)],
    });

    const result = await Promise.all(
      plans.map(async (plan) => {
        const weekRows = await db.query.coachingPlanWeeks.findMany({
          where: eq(coachingPlanWeeks.planId, plan.id),
        });
        const weekIds = weekRows.map((w) => w.id);
        const sessionRows = weekIds.length
          ? await db.query.coachingPlanSessions.findMany({ where: inArray(coachingPlanSessions.weekId, weekIds) })
          : [];
        return toCoachingPlanSummaryDto(plan, {
          weekCount: weekRows.length,
          sessionCount: sessionRows.length,
          completedSessionCount: sessionRows.filter((s) => s.status === 'completed').length,
        });
      }),
    );

    res.json(result);
  }),
);

coachRouter.get(
  '/plans/active',
  asyncHandler(async (req, res) => {
    const plan = await db.query.coachingPlans.findFirst({
      where: and(eq(coachingPlans.userId, req.userId), eq(coachingPlans.status, 'active')),
    });
    res.json(plan ? await loadFullPlan(plan.id) : null);
  }),
);

coachRouter.get(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const plan = await db.query.coachingPlans.findFirst({ where: eq(coachingPlans.id, req.params.id!) });
    if (!plan || plan.userId !== req.userId) {
      throw new NotFoundError('Plan not found');
    }
    res.json(await loadFullPlan(plan.id));
  }),
);

coachRouter.patch(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const body = updatePlanSchema.parse(req.body);

    const plan = await db.query.coachingPlans.findFirst({ where: eq(coachingPlans.id, req.params.id!) });
    if (!plan || plan.userId !== req.userId) {
      throw new NotFoundError('Plan not found');
    }
    if (plan.status !== 'active') {
      throw new ConflictError('Only an active plan can be abandoned');
    }

    await db
      .update(coachingPlans)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(coachingPlans.id, plan.id));

    res.json(await loadFullPlan(plan.id));
  }),
);

coachRouter.patch(
  '/plan-sessions/:id',
  asyncHandler(async (req, res) => {
    const body = updatePlanSessionSchema.parse(req.body);

    const planSession = await db.query.coachingPlanSessions.findFirst({
      where: eq(coachingPlanSessions.id, req.params.id!),
    });
    if (!planSession) {
      throw new NotFoundError('Plan session not found');
    }
    const plan = await db.query.coachingPlans.findFirst({ where: eq(coachingPlans.id, planSession.planId) });
    if (!plan || plan.userId !== req.userId) {
      throw new NotFoundError('Plan session not found');
    }

    await db
      .update(coachingPlanSessions)
      .set({
        ...(body.status !== undefined ? { status: body.status, statusUpdatedAt: new Date() } : {}),
        ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(coachingPlanSessions.id, planSession.id));

    res.json(await loadFullPlan(plan.id));
  }),
);
