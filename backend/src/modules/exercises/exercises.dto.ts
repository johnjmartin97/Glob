import type { Exercise, ExerciseCategory } from '@glob/shared';
import type { exercises } from '../../db/schema/index';

type ExerciseRow = typeof exercises.$inferSelect;

export function toExerciseDto(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    category: row.category as ExerciseCategory,
    isSystem: row.isSystem,
  };
}
