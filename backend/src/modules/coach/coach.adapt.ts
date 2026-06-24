import { and, eq, inArray } from 'drizzle-orm';
import { loadPctFromRepsRpe, MAIN_LIFT_CATEGORIES, roundToNearestIncrement, type ExerciseCategory } from '@glob/shared';
import { db } from '../../db/client';
import {
  coachingPlanLifts,
  coachingPlanSessions,
  coachingPlanWeeks,
  coachingPlans,
  exercises,
  sessionExercises,
  sessionSets,
  templateExercises,
} from '../../db/schema/index';

// Cap how far one session's result can move the tracked 1RM, so a single noisy
// (or sandbagged) top set can't wildly rescale the rest of the plan.
const MAX_E1RM_CHANGE = 0.07;

function toNum(v: string | null): number | null {
  return v == null ? null : Number(v);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * When a plan-linked workout is completed, mark the plan session completed and autoregulate the
 * loads of the remaining pending sessions from the lifter's actual main-lift performance.
 * Best-effort: callers should not let a failure here block the workout save.
 */
export async function adaptPlanForCompletedSession(workoutSessionId: string, userId: string): Promise<void> {
  const planSession = await db.query.coachingPlanSessions.findFirst({
    where: eq(coachingPlanSessions.sessionId, workoutSessionId),
  });
  if (!planSession || planSession.status === 'completed' || planSession.status === 'skipped') return;

  const plan = await db.query.coachingPlans.findFirst({ where: eq(coachingPlans.id, planSession.planId) });
  if (!plan || plan.userId !== userId || plan.status !== 'active') return;

  // Actual performance from the completed workout, grouped by exercise (main lifts only).
  const workoutExercises = await db.query.sessionExercises.findMany({
    where: eq(sessionExercises.sessionId, workoutSessionId),
  });
  const exerciseIds = workoutExercises.map((e) => e.exerciseId);
  const exerciseRows = exerciseIds.length
    ? await db.query.exercises.findMany({ where: inArray(exercises.id, exerciseIds) })
    : [];
  const categoryById = new Map(exerciseRows.map((e) => [e.id, e.category as ExerciseCategory]));
  const sessExIds = workoutExercises.map((e) => e.id);
  const setRows = sessExIds.length
    ? await db.query.sessionSets.findMany({ where: inArray(sessionSets.sessionExerciseId, sessExIds) })
    : [];
  const setsBySessEx = new Map<string, typeof setRows>();
  for (const s of setRows) {
    const list = setsBySessEx.get(s.sessionExerciseId) ?? [];
    list.push(s);
    setsBySessEx.set(s.sessionExerciseId, list);
  }

  // Best implied e1RM per main-lift exerciseId in this workout.
  const actualE1rmByExercise = new Map<string, number>();
  for (const ex of workoutExercises) {
    if (!MAIN_LIFT_CATEGORIES.includes(categoryById.get(ex.exerciseId) ?? 'other')) continue;
    let best = 0;
    for (const set of setsBySessEx.get(ex.id) ?? []) {
      if (set.setType !== 'working' || !set.completed) continue;
      const w = toNum(set.actualWeightKg);
      const reps = set.actualReps;
      const rpe = toNum(set.actualRpe);
      if (w == null || reps == null || rpe == null) continue;
      const e1rm = w / (loadPctFromRepsRpe(reps, rpe) / 100);
      if (e1rm > best) best = e1rm;
    }
    if (best > 0) actualE1rmByExercise.set(ex.exerciseId, best);
  }

  // Pending plan sessions ordered AFTER the completed one (by week, then day).
  const weeks = await db.query.coachingPlanWeeks.findMany({ where: eq(coachingPlanWeeks.planId, plan.id) });
  const weekIndexById = new Map(weeks.map((w) => [w.id, w.weekIndex]));
  const completedKey = (weekIndexById.get(planSession.weekId) ?? 0) * 1000 + planSession.dayIndex;
  const allSessions = await db.query.coachingPlanSessions.findMany({
    where: eq(coachingPlanSessions.planId, plan.id),
  });
  const futurePending = allSessions.filter(
    (s) =>
      s.status === 'pending' &&
      (weekIndexById.get(s.weekId) ?? 0) * 1000 + s.dayIndex > completedKey,
  );

  await db.transaction(async (tx) => {
    for (const [exerciseId, actualE1rm] of actualE1rmByExercise) {
      const liftState = await tx.query.coachingPlanLifts.findFirst({
        where: and(eq(coachingPlanLifts.planId, plan.id), eq(coachingPlanLifts.exerciseId, exerciseId)),
      });

      // No baseline yet (lift wasn't seeded) — record it and don't rescale this round.
      if (!liftState) {
        await tx
          .insert(coachingPlanLifts)
          .values({ planId: plan.id, exerciseId, estimated1rmKg: actualE1rm.toFixed(2) })
          .onConflictDoNothing();
        continue;
      }

      const stored = Number(liftState.estimated1rmKg);
      const newE1rm = clamp(actualE1rm, stored * (1 - MAX_E1RM_CHANGE), stored * (1 + MAX_E1RM_CHANGE));
      const ratio = stored > 0 ? newE1rm / stored : 1;

      await tx
        .update(coachingPlanLifts)
        .set({ estimated1rmKg: newE1rm.toFixed(2), updatedAt: new Date() })
        .where(eq(coachingPlanLifts.id, liftState.id));

      if (Math.abs(ratio - 1) < 0.001 || futurePending.length === 0) continue;

      // Rescale this lift's loads in every future pending session (preserve %1RM => reps/rpe/velocity stay).
      const templateIds = futurePending.map((s) => s.templateId);
      const rows = await tx.query.templateExercises.findMany({
        where: and(
          inArray(templateExercises.templateId, templateIds),
          eq(templateExercises.exerciseId, exerciseId),
        ),
      });
      for (const row of rows) {
        const newSetsConfig = row.setsConfig
          ? row.setsConfig.map((c) => ({
              ...c,
              loadKg: c.loadKg == null ? null : roundToNearestIncrement(c.loadKg * ratio, 2.5),
            }))
          : row.setsConfig;
        const newTargetLoad =
          row.targetLoadKg == null ? null : roundToNearestIncrement(Number(row.targetLoadKg) * ratio, 2.5);
        await tx
          .update(templateExercises)
          .set({
            setsConfig: newSetsConfig,
            targetLoadKg: newTargetLoad == null ? null : newTargetLoad.toString(),
            updatedAt: new Date(),
          })
          .where(eq(templateExercises.id, row.id));
      }
    }

    await tx
      .update(coachingPlanSessions)
      .set({ status: 'completed', statusUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(coachingPlanSessions.id, planSession.id));
  });
}
