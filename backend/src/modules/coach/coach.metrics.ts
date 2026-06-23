import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type { ExerciseCategory, LoadVelocityProfile, ReadinessSnapshot, RpeTrendDirection, SetType } from '@glob/shared';
import { fitLoadVelocityProfile, loadPctFromRepsRpe } from '@glob/shared';
import { db } from '../../db/client';
import {
  exercises,
  foodItems,
  foodLogEntries,
  nutritionTargets,
  sessionExercises,
  sessionSets,
  sleepLogs,
  workoutSessions,
} from '../../db/schema/index';

const RECENT_PERFORMANCE_EXERCISE_LIMIT = 8;
const RECENT_PERFORMANCE_SETS_PER_EXERCISE = 3;
const RECENT_PERFORMANCE_RECENCY_FILTER_DAYS = 14;

export interface CoachMetricsSet {
  setType: SetType;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualRpe: number | null;
  actualVelocityMps: number | null;
  completed: boolean;
}

export interface CoachMetricsExercise {
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
  sets: CoachMetricsSet[];
}

export interface CoachMetricsSession {
  startedAt: string;
  exercises: CoachMetricsExercise[];
}

export interface CoachMetricsInput {
  asOfDate: string;
  sessions: CoachMetricsSession[];
  sleepLogs: Array<{ logDate: string; hoursSlept: number }>;
  nutritionTarget: { caloriesTarget: number; proteinGTarget: number | null } | null;
  dailyNutritionTotals: Array<{ logDate: string; calories: number; proteinG: number }>;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundInt(value: number): number {
  return Math.round(value);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(laterDate: string, earlierDate: string): number {
  const later = Date.parse(`${laterDate}T00:00:00Z`);
  const earlier = Date.parse(`${earlierDate}T00:00:00Z`);
  return Math.round((later - earlier) / (24 * 60 * 60 * 1000));
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function inWindow(asOfDate: string, dateStr: string, windowDays: number): boolean {
  const age = daysBetween(asOfDate, dateStr);
  return age >= 0 && age < windowDays;
}

function workingSetVolumeKg(sets: CoachMetricsSet[]): number {
  return sets
    .filter((s) => s.setType === 'working' && s.completed && s.actualWeightKg != null && s.actualReps != null)
    .reduce((sum, s) => sum + s.actualWeightKg! * s.actualReps!, 0);
}

function sessionVolumeKg(session: CoachMetricsSession): number {
  return session.exercises.reduce((sum, ex) => sum + workingSetVolumeKg(ex.sets), 0);
}

interface TopSetByDay {
  exerciseName: string;
  category: ExerciseCategory;
  date: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  velocityMps: number | null;
}

/**
 * Most-frequently-trained exercises in the trailing 28 days (with at least one qualifying set in
 * the trailing 14, so a high-frequency exercise the user dropped weeks ago doesn't outrank
 * something they're actively training now), each with up to 3 most-recent top-set data points
 * (one per session day, heaviest-weight-wins tie-break — same criterion the old single-point
 * perLiftRecent used) for trend-aware progressive-overload prescriptions.
 */
function computeRecentExercisePerformance(
  asOfDate: string,
  sessions: CoachMetricsSession[],
): ReadinessSnapshot['recentExercisePerformance'] {
  const topSetByExerciseAndDay = new Map<string, TopSetByDay>();

  for (const session of sessions) {
    const sessionDate = dateOnly(session.startedAt);
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (set.setType !== 'working' || !set.completed || set.actualWeightKg == null || set.actualReps == null) {
          continue;
        }
        const key = `${ex.exerciseName}::${sessionDate}`;
        const existing = topSetByExerciseAndDay.get(key);
        const isBetter =
          !existing ||
          set.actualWeightKg > existing.weightKg ||
          (set.actualWeightKg === existing.weightKg && set.actualReps > existing.reps) ||
          (set.actualWeightKg === existing.weightKg &&
            set.actualReps === existing.reps &&
            (set.actualRpe ?? -1) > (existing.rpe ?? -1));
        if (isBetter) {
          topSetByExerciseAndDay.set(key, {
            exerciseName: ex.exerciseName,
            category: ex.exerciseCategory,
            date: sessionDate,
            weightKg: set.actualWeightKg,
            reps: set.actualReps,
            rpe: set.actualRpe,
            velocityMps: set.actualVelocityMps,
          });
        }
      }
    }
  }

  const byExercise = new Map<string, TopSetByDay[]>();
  for (const topSet of topSetByExerciseAndDay.values()) {
    const list = byExercise.get(topSet.exerciseName) ?? [];
    list.push(topSet);
    byExercise.set(topSet.exerciseName, list);
  }

  const candidates = Array.from(byExercise.entries())
    .map(([exerciseName, days]) => ({
      exerciseName,
      days: days.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    }))
    .filter(({ days }) => days.some((d) => daysBetween(asOfDate, d.date) <= RECENT_PERFORMANCE_RECENCY_FILTER_DAYS));

  // Deterministic ranking: most training days desc, then most-recent day desc, then name asc —
  // so the selection doesn't depend on incidental DB/Map iteration order.
  candidates.sort((a, b) => {
    if (b.days.length !== a.days.length) return b.days.length - a.days.length;
    const aMostRecent = a.days[0]!.date;
    const bMostRecent = b.days[0]!.date;
    if (aMostRecent !== bMostRecent) return aMostRecent < bMostRecent ? 1 : -1;
    return a.exerciseName.localeCompare(b.exerciseName);
  });

  return candidates.slice(0, RECENT_PERFORMANCE_EXERCISE_LIMIT).map(({ exerciseName, days }) => ({
    exerciseName,
    category: days[0]!.category,
    recentSets: days.slice(0, RECENT_PERFORMANCE_SETS_PER_EXERCISE).map((d) => ({
      daysAgo: daysBetween(asOfDate, d.date),
      weightKg: round1(d.weightKg),
      reps: d.reps,
      rpe: d.rpe != null ? round1(d.rpe) : null,
      velocityMps: d.velocityMps != null ? Math.round(d.velocityMps * 100) / 100 : null,
    })),
  }));
}

/**
 * Fits a per-lift load–velocity profile from the user's logged sets, keyed by lowercased exercise
 * name. Only working, completed sets that logged reps, RPE, and velocity contribute a point
 * (loadPct estimated from reps+RPE). Lifts without enough spread-out data are omitted, so the coach
 * falls back to the category default profile for them.
 */
export function computeVelocityProfiles(input: CoachMetricsInput): Map<string, LoadVelocityProfile> {
  const pointsByExercise = new Map<string, Array<{ loadPct: number; velocityMps: number }>>();

  for (const session of input.sessions) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (
          set.setType !== 'working' ||
          !set.completed ||
          set.actualReps == null ||
          set.actualRpe == null ||
          set.actualVelocityMps == null
        ) {
          continue;
        }
        const key = ex.exerciseName.trim().toLowerCase();
        const list = pointsByExercise.get(key) ?? [];
        list.push({
          loadPct: loadPctFromRepsRpe(set.actualReps, set.actualRpe),
          velocityMps: set.actualVelocityMps,
        });
        pointsByExercise.set(key, list);
      }
    }
  }

  const profiles = new Map<string, LoadVelocityProfile>();
  for (const [name, points] of pointsByExercise) {
    const profile = fitLoadVelocityProfile(points);
    if (profile) profiles.set(name, profile);
  }
  return profiles;
}

/** Pure, synchronous: computes the readiness snapshot from already-loaded rows. No DB access. */
export function computeReadinessSnapshot(input: CoachMetricsInput): ReadinessSnapshot {
  const { asOfDate, sessions, sleepLogs: sleep, nutritionTarget, dailyNutritionTotals } = input;

  const sessions7 = sessions.filter((s) => inWindow(asOfDate, dateOnly(s.startedAt), 7));
  const sessions28 = sessions.filter((s) => inWindow(asOfDate, dateOnly(s.startedAt), 28));

  const acuteVolumeKg = round1(sessions7.reduce((sum, s) => sum + sessionVolumeKg(s), 0));
  const chronicVolumeKgPerWeek = round1(sessions28.reduce((sum, s) => sum + sessionVolumeKg(s), 0) / 4);
  const acuteChronicRatio = chronicVolumeKgPerWeek > 0 ? round1(acuteVolumeKg / chronicVolumeKgPerWeek) : null;

  const workingSets7 = sessions7.flatMap((s) => s.exercises.flatMap((ex) => ex.sets));
  const workingSets28 = sessions28.flatMap((s) => s.exercises.flatMap((ex) => ex.sets));
  const rpes7 = workingSets7.filter((s) => s.setType === 'working' && s.actualRpe != null).map((s) => s.actualRpe!);
  const rpes28 = workingSets28.filter((s) => s.setType === 'working' && s.actualRpe != null).map((s) => s.actualRpe!);

  const avgWorkingRpeLast7Days = average(rpes7);
  const avgWorkingRpeLast28Days = average(rpes28);

  let trendDirection: RpeTrendDirection = 'insufficient_data';
  if (avgWorkingRpeLast7Days != null && avgWorkingRpeLast28Days != null) {
    const delta = avgWorkingRpeLast7Days - avgWorkingRpeLast28Days;
    trendDirection = delta > 0.3 ? 'rising' : delta < -0.3 ? 'falling' : 'flat';
  }

  const sleep7 = sleep.filter((log) => inWindow(asOfDate, log.logDate, 7));
  const sleep28 = sleep.filter((log) => inWindow(asOfDate, log.logDate, 28));
  const nightsLoggedLast7Days = sleep7.length;
  const avgHoursLast7Days = average(sleep7.map((l) => l.hoursSlept));
  const avgHoursLast28Days = average(sleep28.map((l) => l.hoursSlept));
  const sleepDebtHours =
    nightsLoggedLast7Days === 0
      ? 0
      : Math.max(0, round1(nightsLoggedLast7Days * 8 - sleep7.reduce((sum, l) => sum + l.hoursSlept, 0)));

  const daysLoggedLast7Days = dailyNutritionTotals.length;
  const avgCaloriesLast7Days = average(dailyNutritionTotals.map((d) => d.calories));
  const avgProteinGLast7Days = average(dailyNutritionTotals.map((d) => d.proteinG));
  const targetCalories = nutritionTarget?.caloriesTarget ?? null;
  const targetProteinG = nutritionTarget?.proteinGTarget ?? null;
  const caloriesAdequacyPct =
    avgCaloriesLast7Days != null && targetCalories
      ? roundInt((avgCaloriesLast7Days / targetCalories) * 100)
      : null;
  const proteinAdequacyPct =
    avgProteinGLast7Days != null && targetProteinG
      ? roundInt((avgProteinGLast7Days / targetProteinG) * 100)
      : null;

  const recentExercisePerformance = computeRecentExercisePerformance(asOfDate, sessions);

  return {
    asOfDate,
    trainingLoad: {
      acuteVolumeKg,
      chronicVolumeKgPerWeek,
      acuteChronicRatio,
      sessionsLast7Days: sessions7.length,
      sessionsLast28Days: sessions28.length,
    },
    rpeTrend: {
      avgWorkingRpeLast7Days: avgWorkingRpeLast7Days != null ? round1(avgWorkingRpeLast7Days) : null,
      avgWorkingRpeLast28Days: avgWorkingRpeLast28Days != null ? round1(avgWorkingRpeLast28Days) : null,
      trendDirection,
    },
    sleep: {
      avgHoursLast7Days: avgHoursLast7Days != null ? round1(avgHoursLast7Days) : null,
      avgHoursLast28Days: avgHoursLast28Days != null ? round1(avgHoursLast28Days) : null,
      sleepDebtHours,
      nightsLoggedLast7Days,
    },
    nutrition: {
      avgCaloriesLast7Days: avgCaloriesLast7Days != null ? roundInt(avgCaloriesLast7Days) : null,
      targetCalories,
      caloriesAdequacyPct,
      avgProteinGLast7Days: avgProteinGLast7Days != null ? round1(avgProteinGLast7Days) : null,
      targetProteinG,
      proteinAdequacyPct,
      daysLoggedLast7Days,
    },
    recentExercisePerformance,
    dataCompleteness: {
      hasEnoughSessionHistory: sessions28.length >= 2,
      hasEnoughSleepHistory: nightsLoggedLast7Days >= 3,
      hasNutritionTargets: nutritionTarget != null,
    },
  };
}

/** Loads the raw rows computeReadinessSnapshot needs. The only DB-touching piece in this module. */
export async function loadCoachMetricsInput(userId: string, asOfDate: string): Promise<CoachMetricsInput> {
  const windowStart = shiftDate(asOfDate, -27);

  const sessionRows = await db.query.workoutSessions.findMany({
    where: and(eq(workoutSessions.userId, userId), gte(workoutSessions.startedAt, new Date(`${windowStart}T00:00:00Z`))),
  });

  const sessionIds = sessionRows.map((s) => s.id);
  const exerciseRows = sessionIds.length
    ? await db.query.sessionExercises.findMany({ where: inArray(sessionExercises.sessionId, sessionIds) })
    : [];

  const exerciseIds = [...new Set(exerciseRows.map((e) => e.exerciseId))];
  const exerciseLookup = exerciseIds.length
    ? await db.query.exercises.findMany({ where: inArray(exercises.id, exerciseIds) })
    : [];
  const categoryById = new Map(exerciseLookup.map((e) => [e.id, e.category as ExerciseCategory]));
  const nameById = new Map(exerciseLookup.map((e) => [e.id, e.name]));

  const sessionExerciseIds = exerciseRows.map((e) => e.id);
  const setRows = sessionExerciseIds.length
    ? await db.query.sessionSets.findMany({ where: inArray(sessionSets.sessionExerciseId, sessionExerciseIds) })
    : [];

  const setsByExercise = new Map<string, typeof setRows>();
  for (const set of setRows) {
    const list = setsByExercise.get(set.sessionExerciseId) ?? [];
    list.push(set);
    setsByExercise.set(set.sessionExerciseId, list);
  }

  const exercisesBySession = new Map<string, typeof exerciseRows>();
  for (const ex of exerciseRows) {
    const list = exercisesBySession.get(ex.sessionId) ?? [];
    list.push(ex);
    exercisesBySession.set(ex.sessionId, list);
  }

  const sessions: CoachMetricsSession[] = sessionRows.map((session) => ({
    startedAt: session.startedAt.toISOString(),
    exercises: (exercisesBySession.get(session.id) ?? []).map((ex) => ({
      exerciseCategory: categoryById.get(ex.exerciseId) ?? 'other',
      exerciseName: nameById.get(ex.exerciseId) ?? 'Unknown exercise',
      sets: (setsByExercise.get(ex.id) ?? []).map((set) => ({
        setType: set.setType as SetType,
        actualWeightKg: set.actualWeightKg == null ? null : Number(set.actualWeightKg),
        actualReps: set.actualReps,
        actualRpe: set.actualRpe == null ? null : Number(set.actualRpe),
        actualVelocityMps: set.actualVelocityMps == null ? null : Number(set.actualVelocityMps),
        completed: set.completed,
      })),
    })),
  }));

  const sleepRows = await db.query.sleepLogs.findMany({
    where: and(eq(sleepLogs.userId, userId), gte(sleepLogs.logDate, windowStart), lte(sleepLogs.logDate, asOfDate)),
  });
  const sleepLogsInput = sleepRows.map((row) => ({ logDate: row.logDate, hoursSlept: Number(row.hoursSlept) }));

  const targetRow = await db.query.nutritionTargets.findFirst({
    where: and(eq(nutritionTargets.userId, userId), lte(nutritionTargets.effectiveDate, asOfDate)),
    orderBy: (table, { desc }) => [desc(table.effectiveDate)],
  });

  const nutritionWindowStart = shiftDate(asOfDate, -6);
  const logEntries = await db.query.foodLogEntries.findMany({
    where: and(
      eq(foodLogEntries.userId, userId),
      gte(foodLogEntries.logDate, nutritionWindowStart),
      lte(foodLogEntries.logDate, asOfDate),
    ),
  });
  const foodItemIds = [...new Set(logEntries.map((e) => e.foodItemId))];
  const foodItemRows = foodItemIds.length
    ? await db.query.foodItems.findMany({ where: inArray(foodItems.id, foodItemIds) })
    : [];
  const foodItemById = new Map(foodItemRows.map((f) => [f.id, f]));

  const totalsByDate = new Map<string, { calories: number; proteinG: number }>();
  for (const entry of logEntries) {
    const food = foodItemById.get(entry.foodItemId);
    if (!food) continue;
    const servings = Number(entry.servings);
    const current = totalsByDate.get(entry.logDate) ?? { calories: 0, proteinG: 0 };
    current.calories += Number(food.calories) * servings;
    current.proteinG += Number(food.proteinG) * servings;
    totalsByDate.set(entry.logDate, current);
  }

  const dailyNutritionTotals = Array.from(totalsByDate.entries()).map(([logDate, totals]) => ({
    logDate,
    calories: totals.calories,
    proteinG: totals.proteinG,
  }));

  return {
    asOfDate,
    sessions,
    sleepLogs: sleepLogsInput,
    nutritionTarget: targetRow
      ? {
          caloriesTarget: targetRow.caloriesTarget,
          proteinGTarget: targetRow.proteinGTarget == null ? null : Number(targetRow.proteinGTarget),
        }
      : null,
    dailyNutritionTotals,
  };
}
