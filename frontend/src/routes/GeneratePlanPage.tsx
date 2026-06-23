import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CoachGoal } from '@glob/shared';
import { useGeneratePlan } from '../api/coach';
import { ApiError } from '../api/client';

const GOAL_OPTIONS: Array<{ value: CoachGoal; label: string }> = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'peaking', label: 'Peaking for a meet' },
  { value: 'general_fitness', label: 'General fitness' },
];

export function GeneratePlanPage() {
  const [goal, setGoal] = useState<CoachGoal>('strength');
  const [durationWeeks, setDurationWeeks] = useState('6');
  const [daysPerWeek, setDaysPerWeek] = useState('4');
  const [error, setError] = useState<string | null>(null);
  const generatePlan = useGeneratePlan();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const plan = await generatePlan.mutateAsync({
        goal,
        durationWeeks: Number(durationWeeks),
        daysPerWeek: Number(daysPerWeek),
      });
      navigate(`/coach/plans/${plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate plan');
    }
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Generate a plan</h1>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Goal</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as CoachGoal)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          >
            {GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Duration (weeks)</label>
            <input
              type="number"
              required
              min="1"
              max="16"
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Days per week</label>
            <input
              type="number"
              required
              min="1"
              max="7"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={generatePlan.isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {generatePlan.isPending ? 'Generating your plan… this can take a couple of minutes' : 'Generate plan'}
        </button>
      </form>
    </div>
  );
}
