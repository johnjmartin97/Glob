import type { Exercise } from '@glob/shared';
import { useExercises, EXERCISE_CATEGORIES } from '../api/exercises';

interface ExercisePickerProps {
  value: string | null;
  onChange: (exerciseId: string, exercise: Exercise) => void;
}

export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
  const { data: exercises, isLoading } = useExercises();

  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const exercise = exercises?.find((ex) => ex.id === e.target.value);
        if (exercise) onChange(exercise.id, exercise);
      }}
      disabled={isLoading}
      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
    >
      <option value="" disabled>
        {isLoading ? 'Loading…' : 'Select an exercise'}
      </option>
      {EXERCISE_CATEGORIES.map((cat) => {
        const options = exercises?.filter((ex) => ex.category === cat.value) ?? [];
        if (!options.length) return null;
        return (
          <optgroup key={cat.value} label={cat.label}>
            {options.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
