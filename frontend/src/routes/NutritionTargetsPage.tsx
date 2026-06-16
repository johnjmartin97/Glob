import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentTarget, useSetTarget } from '../api/nutrition';
import { ApiError } from '../api/client';

export function NutritionTargetsPage() {
  const { data: target, isLoading } = useCurrentTarget();
  const setTarget = useSetTarget();
  const navigate = useNavigate();

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setCalories(target.caloriesTarget.toString());
    setProtein(target.proteinGTarget?.toString() ?? '');
    setCarbs(target.carbsGTarget?.toString() ?? '');
    setFat(target.fatGTarget?.toString() ?? '');
  }, [target]);

  async function handleSubmit() {
    setError(null);
    if (!calories) {
      setError('Calorie target is required');
      return;
    }
    try {
      await setTarget.mutateAsync({
        caloriesTarget: Number(calories),
        proteinGTarget: protein === '' ? null : Number(protein),
        carbsGTarget: carbs === '' ? null : Number(carbs),
        fatGTarget: fat === '' ? null : Number(fat),
      });
      navigate('/nutrition');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save targets');
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutrition Targets</h1>
        <Link to="/nutrition" className="text-sm text-emerald-400">
          Back
        </Link>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Daily calories</label>
          <input
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Protein (g)</label>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Carbs (g)</label>
            <input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Fat (g)</label>
            <input
              type="number"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={setTarget.isPending}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {setTarget.isPending ? 'Saving…' : 'Save targets'}
      </button>
    </div>
  );
}
