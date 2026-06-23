import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ExerciseCategory, WeightUnit } from '@glob/shared';
import {
  EXERCISE_CATEGORIES,
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useUpdateExerciseSettings,
} from '../api/exercises';
import { ApiError } from '../api/client';
import { SwipeToDelete } from '../components/SwipeToDelete';

export function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises();
  const createExercise = useCreateExercise();
  const updateSettings = useUpdateExerciseSettings();
  const deleteExercise = useDeleteExercise();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('accessory');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createExercise.mutateAsync({ name, category, weightUnit });
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create exercise');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteExercise.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete exercise');
    }
  }

  async function handleToggleUnit(id: string, current: WeightUnit) {
    const next: WeightUnit = current === 'kg' ? 'lb' : 'kg';
    try {
      await updateSettings.mutateAsync({ id, weightUnit: next });
    } catch {
      // ignore — UI will revert via query invalidation
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exercise Library</h1>
        <Link to="/templates" className="text-sm text-emerald-400">
          Back to templates
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Add custom exercise</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Exercise name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          >
            {EXERCISE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Weight unit:</span>
          <button
            type="button"
            onClick={() => setWeightUnit((u) => (u === 'kg' ? 'lb' : 'kg'))}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-200"
          >
            {weightUnit}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={createExercise.isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {createExercise.isPending ? 'Adding…' : 'Add exercise'}
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-400">Loading exercises…</p>}

      <div className="space-y-4">
        {EXERCISE_CATEGORIES.map((cat) => {
          const items = exercises?.filter((ex) => ex.category === cat.value) ?? [];
          if (!items.length) return null;
          return (
            <div key={cat.value}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
                {cat.label}
              </h2>
              <ul className="space-y-1">
                {items.map((ex) => (
                  <li key={ex.id} className="overflow-hidden rounded-md border border-slate-800">
                    {ex.isSystem ? (
                      <div className="flex items-center justify-between bg-slate-900 px-3 py-2">
                        <span>{ex.name}</span>
                        <button
                          onClick={() => handleToggleUnit(ex.id, ex.weightUnit)}
                          disabled={updateSettings.isPending}
                          className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 disabled:opacity-50"
                        >
                          {ex.weightUnit}
                        </button>
                      </div>
                    ) : (
                      <SwipeToDelete onDelete={() => handleDelete(ex.id)}>
                        <div className="flex items-center justify-between bg-slate-900 px-3 py-2">
                          <span>{ex.name}</span>
                          <button
                            onClick={() => handleToggleUnit(ex.id, ex.weightUnit)}
                            disabled={updateSettings.isPending}
                            className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 disabled:opacity-50"
                          >
                            {ex.weightUnit}
                          </button>
                        </div>
                      </SwipeToDelete>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
