import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MealType } from '@glob/shared';
import { useAddLogEntry, useDailyLog, useDeleteLogEntry, useFoodItems } from '../api/nutrition';
import { ProgressBar } from '../components/ProgressBar';
import { ApiError } from '../api/client';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NutritionPage() {
  const date = todayDateString();
  const { data: log, isLoading } = useDailyLog(date);
  const { data: foods } = useFoodItems();
  const addEntry = useAddLogEntry(date);
  const deleteEntry = useDeleteLogEntry(date);

  const [foodItemId, setFoodItemId] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [servings, setServings] = useState('1');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!foodItemId) {
      setError('Select a food item');
      return;
    }
    try {
      await addEntry.mutateAsync({ foodItemId, mealType, servings: Number(servings) });
      setServings('1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to log entry');
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutrition</h1>
        <div className="flex gap-3 text-sm">
          <Link to="/nutrition/foods" className="text-emerald-400">
            Foods
          </Link>
          <Link to="/nutrition/targets" className="text-emerald-400">
            Targets
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {log && (
        <div className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
          <ProgressBar label="Calories" value={log.totals.calories} target={log.target?.caloriesTarget ?? null} unit="" />
          <ProgressBar label="Protein" value={log.totals.proteinG} target={log.target?.proteinGTarget ?? null} />
          <ProgressBar label="Carbs" value={log.totals.carbsG} target={log.target?.carbsGTarget ?? null} />
          <ProgressBar label="Fat" value={log.totals.fatG} target={log.target?.fatGTarget ?? null} />
          {!log.target && (
            <p className="text-xs text-slate-500">
              No targets set. <Link to="/nutrition/targets" className="text-emerald-400">Set targets</Link>.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Log food</p>
        <select
          value={foodItemId}
          onChange={(e) => setFoodItemId(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
        >
          <option value="" disabled>
            {foods?.length ? 'Select a food' : 'No foods yet — add one in Foods'}
          </option>
          {foods?.map((food) => (
            <option key={food.id} value={food.id}>
              {food.name} ({food.servingSize}
              {food.servingUnit})
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          >
            {MEAL_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Servings"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={addEntry.isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {addEntry.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div className="space-y-4">
        {MEAL_TYPES.map((meal) => {
          const entries = log?.entries.filter((e) => e.mealType === meal.value) ?? [];
          if (!entries.length) return null;
          return (
            <div key={meal.value}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
                {meal.label}
              </h2>
              <ul className="space-y-1">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
                  >
                    <div>
                      <p>{entry.foodItem?.name}</p>
                      <p className="text-sm text-slate-400">
                        {entry.servings} × {entry.foodItem?.servingSize}
                        {entry.foodItem?.servingUnit} ·{' '}
                        {Math.round((entry.foodItem?.calories ?? 0) * entry.servings)} kcal
                      </p>
                    </div>
                    <button
                      onClick={() => deleteEntry.mutate(entry.id)}
                      className="text-sm text-red-400"
                    >
                      Delete
                    </button>
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
