import type { SessionExercise, SessionSet, SetType, WorkoutSession } from '@glob/shared';
import type { exercises, sessionExercises, sessionSets, workoutSessions } from '../../db/schema/index';
import { toExerciseDto } from '../exercises/exercises.dto';

type SessionRow = typeof workoutSessions.$inferSelect;
type SessionExerciseRow = typeof sessionExercises.$inferSelect;
type SessionSetRow = typeof sessionSets.$inferSelect;
type ExerciseRow = typeof exercises.$inferSelect;

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function toSessionSetDto(row: SessionSetRow): SessionSet {
  return {
    id: row.id,
    setIndex: row.setIndex,
    setType: row.setType as SetType,
    prescribedReps: row.prescribedReps,
    prescribedLoadKg: toNumber(row.prescribedLoadKg),
    actualWeightKg: toNumber(row.actualWeightKg),
    actualReps: row.actualReps,
    actualRpe: toNumber(row.actualRpe),
    completed: row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export function toSessionExerciseDto(
  row: SessionExerciseRow & { exercise?: ExerciseRow },
  sets: SessionSetRow[],
): SessionExercise {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exercise: row.exercise ? toExerciseDto(row.exercise) : undefined,
    orderIndex: row.orderIndex,
    templateExerciseId: row.templateExerciseId,
    notes: row.notes,
    sets: sets
      .slice()
      .sort((a, b) => a.setIndex - b.setIndex)
      .map(toSessionSetDto),
  };
}

export function toSessionDto(
  row: SessionRow,
  exerciseRows: (SessionExerciseRow & { exercise?: ExerciseRow; sets: SessionSetRow[] })[],
): WorkoutSession {
  return {
    id: row.id,
    templateId: row.templateId,
    name: row.name,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    notes: row.notes,
    exercises: exerciseRows
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((ex) => toSessionExerciseDto(ex, ex.sets)),
  };
}
