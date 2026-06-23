import { Link } from 'react-router-dom';
import type { CoachGoal } from '@glob/shared';
import { usePlans } from '../api/coach';

const GOAL_LABELS: Record<CoachGoal, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  peaking: 'Peaking for a meet',
  general_fitness: 'General fitness',
};

export function PlanHistoryPage() {
  const { data: plans, isLoading } = usePlans();

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Plan history</h1>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && plans?.length === 0 && <p className="text-sm text-slate-400">No plans generated yet.</p>}

      <ul className="space-y-2">
        {plans?.map((plan) => (
          <li key={plan.id} className="rounded-md border border-slate-800 bg-slate-900">
            <Link to={`/coach/plans/${plan.id}`} className="block px-3 py-3">
              <p className="font-medium">{GOAL_LABELS[plan.goal]}</p>
              <p className="text-sm text-slate-400">
                {plan.durationWeeks} week{plan.durationWeeks === 1 ? '' : 's'} · {plan.completedSessionCount}/
                {plan.sessionCount} done · {plan.status} · {plan.generatedAt.slice(0, 10)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
