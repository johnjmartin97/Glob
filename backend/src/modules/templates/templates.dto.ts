import type { TemplateExercise, WorkoutTemplate } from '@glob/shared';
import type { templateExercises, workoutTemplates } from '../../db/schema/index';
import { toExerciseDto } from '../exercises/exercises.dto';
import type { exercises } from '../../db/schema/index';

type TemplateRow = typeof workoutTemplates.$inferSelect;
type TemplateExerciseRow = typeof templateExercises.$inferSelect;
type ExerciseRow = typeof exercises.$inferSelect;

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function toTemplateExerciseDto(
  row: TemplateExerciseRow,
  exerciseRow?: ExerciseRow,
): TemplateExercise {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exercise: exerciseRow ? toExerciseDto(exerciseRow) : undefined,
    orderIndex: row.orderIndex,
    targetSets: row.targetSets,
    targetReps: row.targetReps,
    targetLoadKg: toNumber(row.targetLoadKg),
    targetLoadPct: toNumber(row.targetLoadPct),
    referenceLiftId: row.referenceLiftId,
    notes: row.notes,
    warmupEnabled: row.warmupEnabled,
    warmupSetCount: row.warmupSetCount,
    warmupPercentages: row.warmupPercentages
      ? row.warmupPercentages.map((p) => Number(p))
      : null,
  };
}

export function toTemplateDto(
  row: TemplateRow,
  exerciseRows: (TemplateExerciseRow & { exercise?: ExerciseRow })[],
): WorkoutTemplate {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    exercises: exerciseRows
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((ex) => toTemplateExerciseDto(ex, ex.exercise)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
