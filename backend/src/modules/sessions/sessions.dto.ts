import type { SessionExercise, SessionSet, SetType, WorkoutSession } from '@glob/shared';
import type {
  exercises,
  sessionExercises,
  sessionSets,
  userExerciseSettings,
  workoutSessions,
} from '../../db/schema/index';
import { toExerciseDto } from '../exercises/exercises.dto';

type SessionRow = typeof workoutSessions.$inferSelect;
type SessionExerciseRow = typeof sessionExercises.$inferSelect;
type SessionSetRow = typeof sessionSets.$inferSelect;
type ExerciseRow = typeof exercises.$inferSelect;
type ExerciseSettingsRow = typeof userExerciseSettings.$inferSelect;

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
    prescribedRpe: toNumber(row.prescribedRpe),
    prescribedVelocityMps: toNumber(row.prescribedVelocityMps),
    actualWeightKg: toNumber(row.actualWeightKg),
    actualReps: row.actualReps,
    actualRpe: toNumber(row.actualRpe),
    actualVelocityMps: toNumber(row.actualVelocityMps),
    completed: row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export function toSessionExerciseDto(
  row: SessionExerciseRow & { exercise?: ExerciseRow; exerciseSettings?: ExerciseSettingsRow },
  sets: SessionSetRow[],
): SessionExercise {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exercise: row.exercise ? toExerciseDto(row.exercise, row.exerciseSettings) : undefined,
    orderIndex: row.orderIndex,
    templateExerciseId: row.templateExerciseId,
    notes: row.notes,
    sets: sets
      .slice()
      // Warmups always render before working sets, then by setIndex within each group.
      .sort(
        (a, b) =>
          (a.setType === 'warmup' ? 0 : 1) - (b.setType === 'warmup' ? 0 : 1) ||
          a.setIndex - b.setIndex,
      )
      .map(toSessionSetDto),
  };
}

export function toSessionDto(
  row: SessionRow,
  exerciseRows: (SessionExerciseRow & {
    exercise?: ExerciseRow;
    exerciseSettings?: ExerciseSettingsRow;
    sets: SessionSetRow[];
  })[],
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
