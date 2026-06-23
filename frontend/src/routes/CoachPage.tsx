import { Link, useNavigate } from 'react-router-dom';
import { useActivePlan, useReadiness, useUpdatePlanSession } from '../api/coach';
import { useStartSession } from '../api/sessions';
import { ApiError } from '../api/client';
import { useState } from 'react';

function acwrLabel(ratio: number | null): { label: string; className: string } {
  if (ratio == null) return { label: 'Not enough data yet', className: 'text-slate-400' };
  if (ratio < 0.8) return { label: 'Low load', className: 'text-amber-400' };
  if (ratio <= 1.3) return { label: 'Balanced', className: 'text-emerald-400' };
  if (ratio <= 1.5) return { label: 'Elevated', className: 'text-amber-400' };
  return { label: 'High load — consider easing up', className: 'text-red-400' };
}

export function CoachPage() {
  const { data: readiness, isLoading: readinessLoading } = useReadiness();
  const { data: activePlan, isLoading: planLoading } = useActivePlan();
  const startSession = useStartSession();
  const updatePlanSession = useUpdatePlanSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const sessions = activePlan?.weeks.flatMap((w) => w.sessions) ?? [];
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const nextSession = activePlan?.weeks
    .slice()
    .sort((a, b) => a.weekIndex - b.weekIndex)
    .flatMap((w) => w.sessions)
    .find((s) => s.status === 'pending');

  async function handleStart(planSessionId: string, templateId: string) {
    setError(null);
    try {
      const session = await startSession.mutateAsync({ templateId });
      await updatePlanSession.mutateAsync({ id: planSessionId, input: { sessionId: session.id } });
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start session');
    }
  }

  const acwr = acwrLabel(readiness?.trainingLoad.acuteChronicRatio ?? null);

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Coach</h1>

      <div className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Your readiness</p>
        {readinessLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {readiness && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className={`text-sm font-semibold ${acwr.className}`}>{acwr.label}</p>
              <p className="text-xs text-slate-400">Training load</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{readiness.sleep.sleepDebtHours}h</p>
              <p className="text-xs text-slate-400">Sleep debt</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {readiness.nutrition.caloriesAdequacyPct != null ? `${readiness.nutrition.caloriesAdequacyPct}%` : '—'}
              </p>
              <p className="text-xs text-slate-400">Calorie target</p>
            </div>
          </div>
        )}
        {readiness && !readiness.dataCompleteness.hasEnoughSessionHistory && (
          <p className="text-xs text-slate-500">Log a few more workouts for a fuller picture.</p>
        )}
        {readiness && !readiness.dataCompleteness.hasEnoughSleepHistory && (
          <p className="text-xs text-slate-500">Log a few more nights of sleep for a fuller picture.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!planLoading && activePlan && (
        <div className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Active plan</p>
            <Link to={`/coach/plans/${activePlan.id}`} className="text-sm text-emerald-400">
              View plan
            </Link>
          </div>
          <p className="text-sm text-slate-400">
            {completedCount} / {sessions.length} sessions completed
          </p>
          {nextSession && (
            <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <div>
                <p className="font-medium">{nextSession.label}</p>
                <p className="text-sm text-slate-400">Next up</p>
              </div>
              <button
                onClick={() => handleStart(nextSession.id, nextSession.templateId)}
                disabled={startSession.isPending}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {startSession.isPending ? 'Starting…' : 'Start'}
              </button>
            </div>
          )}
        </div>
      )}

      {!planLoading && !activePlan && (
        <Link
          to="/coach/generate"
          className="block w-full rounded-md bg-emerald-600 px-4 py-2 text-center font-medium text-white"
        >
          Generate a training plan
        </Link>
      )}

      <Link to="/coach/plans" className="block text-center text-sm text-emerald-400">
        View plan history
      </Link>
    </div>
  );
}
