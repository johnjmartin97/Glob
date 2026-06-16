import type { SetType } from './types.js';

export const DEFAULT_WARMUP_PERCENTAGES = [40, 60, 80];
export const DEFAULT_PLATE_INCREMENT_KG = 2.5;
export const DEFAULT_WARMUP_REPS = 5;

export interface GeneratedSet {
  setIndex: number;
  setType: SetType;
  prescribedLoadKg: number | null;
  prescribedReps: number | null;
}

export interface WarmupCalculatorInput {
  workingLoadKg: number;
  warmupSetCount: number;
  warmupPercentages: number[];
  plateIncrementKg?: number;
  warmupReps?: number;
}

/** Rounds a load to the nearest plate increment (default 2.5kg). */
export function roundToNearestIncrement(
  value: number,
  increment: number = DEFAULT_PLATE_INCREMENT_KG,
): number {
  return Math.round(value / increment) * increment;
}

/**
 * Generates warmup sets as a percentage of the first working set's load.
 * `warmupPercentages[i]` corresponds to warmup set `i + 1`.
 */
export function calculateWarmupSets(input: WarmupCalculatorInput): GeneratedSet[] {
  const {
    workingLoadKg,
    warmupSetCount,
    warmupPercentages,
    plateIncrementKg = DEFAULT_PLATE_INCREMENT_KG,
    warmupReps = DEFAULT_WARMUP_REPS,
  } = input;

  const sets: GeneratedSet[] = [];
  for (let i = 0; i < warmupSetCount; i++) {
    const pct = warmupPercentages[i] ?? warmupPercentages[warmupPercentages.length - 1] ?? 0;
    const rawLoad = workingLoadKg * (pct / 100);
    sets.push({
      setIndex: i + 1,
      setType: 'warmup',
      prescribedLoadKg: roundToNearestIncrement(rawLoad, plateIncrementKg),
      prescribedReps: warmupReps,
    });
  }
  return sets;
}

export interface TemplateExerciseForSetGeneration {
  targetSets: number;
  targetReps: number | null;
  targetLoadKg: number | null;
  warmupEnabled: boolean;
  warmupSetCount: number | null;
  warmupPercentages: number[] | null;
}

/**
 * Generates the full ordered list of sets (warmups followed by working sets)
 * for a template exercise, used when snapshotting a template into a session.
 */
export function generateSessionSets(
  templateExercise: TemplateExerciseForSetGeneration,
): GeneratedSet[] {
  const sets: GeneratedSet[] = [];

  if (
    templateExercise.warmupEnabled &&
    templateExercise.targetLoadKg != null &&
    templateExercise.warmupSetCount &&
    templateExercise.warmupPercentages?.length
  ) {
    sets.push(
      ...calculateWarmupSets({
        workingLoadKg: templateExercise.targetLoadKg,
        warmupSetCount: templateExercise.warmupSetCount,
        warmupPercentages: templateExercise.warmupPercentages,
      }),
    );
  }

  const warmupCount = sets.length;
  for (let i = 0; i < templateExercise.targetSets; i++) {
    sets.push({
      setIndex: warmupCount + i + 1,
      setType: 'working',
      prescribedLoadKg: templateExercise.targetLoadKg,
      prescribedReps: templateExercise.targetReps,
    });
  }

  return sets;
}
