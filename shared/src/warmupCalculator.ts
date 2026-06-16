import type { SetType } from './types.js';

export const DEFAULT_WARMUP_PERCENTAGES = [40, 60, 80];
export const DEFAULT_PLATE_INCREMENT_KG = 2.5;
export const DEFAULT_WARMUP_REPS = 5;
export const BAR_WEIGHT_KG = 20;

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
  warmupRepsPerSet?: number[];
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
 * Load is clamped to a minimum of BAR_WEIGHT_KG (20 kg / 45 lb bar).
 */
export function calculateWarmupSets(input: WarmupCalculatorInput): GeneratedSet[] {
  const {
    workingLoadKg,
    warmupSetCount,
    warmupPercentages,
    plateIncrementKg = DEFAULT_PLATE_INCREMENT_KG,
    warmupRepsPerSet,
  } = input;

  const sets: GeneratedSet[] = [];
  for (let i = 0; i < warmupSetCount; i++) {
    const pct = warmupPercentages[i] ?? warmupPercentages[warmupPercentages.length - 1] ?? 0;
    const rawLoad = workingLoadKg * (pct / 100);
    const rounded = roundToNearestIncrement(rawLoad, plateIncrementKg);
    const prescribedLoadKg = Math.max(BAR_WEIGHT_KG, rounded);
    const prescribedReps = warmupRepsPerSet?.[i] ?? DEFAULT_WARMUP_REPS;
    sets.push({
      setIndex: i + 1,
      setType: 'warmup',
      prescribedLoadKg,
      prescribedReps,
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
  warmupRepsPerSet: number[] | null;
  setsConfig: Array<{ loadKg: number | null; reps: number | null }> | null;
}

function expandToSetsConfig(
  ex: Pick<TemplateExerciseForSetGeneration, 'targetSets' | 'targetLoadKg' | 'targetReps' | 'setsConfig'>,
): Array<{ loadKg: number | null; reps: number | null }> {
  if (ex.setsConfig?.length) return ex.setsConfig;
  return Array.from({ length: ex.targetSets }, () => ({
    loadKg: ex.targetLoadKg,
    reps: ex.targetReps,
  }));
}

/**
 * Generates the full ordered list of sets (warmups followed by working sets)
 * for a template exercise, used when snapshotting a template into a session.
 * Uses setsConfig for per-set load/reps when present; falls back to scalar fields.
 */
export function generateSessionSets(
  templateExercise: TemplateExerciseForSetGeneration,
): GeneratedSet[] {
  const sets: GeneratedSet[] = [];
  const workingSets = expandToSetsConfig(templateExercise);
  const workingLoadKg = workingSets[0]?.loadKg ?? null;

  if (
    templateExercise.warmupEnabled &&
    workingLoadKg != null &&
    templateExercise.warmupSetCount &&
    templateExercise.warmupPercentages?.length
  ) {
    sets.push(
      ...calculateWarmupSets({
        workingLoadKg,
        warmupSetCount: templateExercise.warmupSetCount,
        warmupPercentages: templateExercise.warmupPercentages,
        warmupRepsPerSet: templateExercise.warmupRepsPerSet ?? undefined,
      }),
    );
  }

  const warmupCount = sets.length;
  workingSets.forEach((setDef, i) => {
    sets.push({
      setIndex: warmupCount + i + 1,
      setType: 'working',
      prescribedLoadKg: setDef.loadKg,
      prescribedReps: setDef.reps,
    });
  });

  return sets;
}
