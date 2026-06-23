import type { Exercise, ExerciseCategory } from '@glob/shared';
import type { exercises, userExerciseSettings } from '../../db/schema/index';

type ExerciseRow = typeof exercises.$inferSelect;
type ExerciseSettingsRow = typeof userExerciseSettings.$inferSelect;

// Base defaults when a user has no override row for an exercise.
export const DEFAULT_LOG_RPE = true;
export const DEFAULT_LOG_VELOCITY = false;

export function toExerciseDto(
  row: ExerciseRow,
  override?: Pick<ExerciseSettingsRow, 'weightUnit' | 'logRpe' | 'logVelocity'> | null,
): Exercise {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    category: row.category as ExerciseCategory,
    isSystem: row.isSystem,
    weightUnit: (override?.weightUnit ?? row.weightUnit ?? 'kg') as Exercise['weightUnit'],
    logRpe: override?.logRpe ?? DEFAULT_LOG_RPE,
    logVelocity: override?.logVelocity ?? DEFAULT_LOG_VELOCITY,
  };
}
