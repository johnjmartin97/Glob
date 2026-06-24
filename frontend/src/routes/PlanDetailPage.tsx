import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CoachGoal, CoachingPlanSessionStatus } from '@glob/shared';
import { useAbandonPlan, usePlan, useUpdatePlanSession } from '../api/coach';
import { useStartSession } from '../api/sessions';
import { ApiError } from '../api/client';

const GOAL_LABELS: Record<CoachGoal, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  peaking: 'Peaking for a meet',
  general_fitness: 'General fitness',
};

const STATUS_STYLES: Record<CoachingPlanSessionStatus, string> = {
  pending: 'text-slate-400',
  completed: 'text-emerald-400',
  skipped: 'text-slate-500',
};

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading } = usePlan(id);
  const startSession = useStartSession();
  const updatePlanSession = useUpdatePlanSession();
  const abandonPlan = useAbandonPlan();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pendingAbandon, setPendingAbandon] = useState(false);

  async function handleAbandon(planId: string) {
    setError(null);
    try {
      await abandonPlan.mutateAsync(planId);
      setPendingAbandon(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to abandon plan');
    }
  }

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

  async function handleSkip(planSessionId: string) {
    setError(null);
    try {
      await updatePlanSession.mutateAsync({ id: planSessionId, input: { status: 'skipped' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update session');
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-slate-400">Loading plan…</p>;
  }

  if (!plan) {
    return <p className="p-4 text-sm text-slate-400">Plan not found.</p>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{GOAL_LABELS[plan.goal]}</h1>
          <p className="text-sm text-slate-400">
            {plan.durationWeeks} week{plan.durationWeeks === 1 ? '' : 's'} · {plan.daysPerWeek}x/week · {plan.status}
          </p>
        </div>
        {plan.status === 'active' && (
          pendingAbandon ? (
            <div className="flex items-center gap-2">
              <button onClick={() => handleAbandon(plan.id)} className="text-sm text-red-400">
                Confirm
              </button>
              <button onClick={() => setPendingAbandon(false)} className="text-sm text-slate-400">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setPendingAbandon(true)} className="text-sm text-red-400">
              Abandon plan
            </button>
          )
        )}
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Coach's rationale</p>
        <p className="mt-1 text-sm text-slate-400">{plan.rationale}</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-4">
        {plan.weeks.map((week) => (
          <div key={week.id} className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-3">
            <div>
              <p className="font-medium">
                Week {week.weekIndex + 1}
                {week.focus ? ` · ${week.focus}` : ''}
              </p>
              {week.rationale && <p className="text-sm text-slate-400">{week.rationale}</p>}
            </div>

            <ul className="space-y-2">
              {week.sessions.map((session) => (
                <li key={session.id} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{session.label}</p>
                      <p className={`text-sm ${STATUS_STYLES[session.status]}`}>{session.status}</p>
                    </div>
                    {plan.status === 'active' && session.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleSkip(session.id)} className="text-sm text-slate-400">
                          Skip
                        </button>
                        <button
                          onClick={() => handleStart(session.id, session.templateId)}
                          disabled={startSession.isPending}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Start
                        </button>
                      </div>
                    )}
                  </div>
                  {session.rationale && <p className="mt-1 text-sm text-slate-400">{session.rationale}</p>}
                  <ul className="mt-2 space-y-1">
                    {session.exercises.map((exercise) => {
                      const top = exercise.setsConfig?.[0];
                      const load = top?.loadKg ?? exercise.targetLoadKg;
                      return (
                        <li key={exercise.id} className="text-sm text-slate-400">
                          {exercise.exercise?.name ?? 'Exercise'} — {exercise.targetSets} sets
                          {exercise.targetReps ? ` x ${exercise.targetReps} reps` : ''}
                          {load != null ? ` @ ${load} kg` : ''}
                          {top?.rpe != null ? ` · RPE ${top.rpe}` : ''}
                          {top?.velocityMps != null ? ` · ${top.velocityMps} m/s` : ''}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
