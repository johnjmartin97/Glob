import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDailyLog } from '../api/nutrition';
import { useSupplementChecklist } from '../api/supplements';
import { useSleepLog } from '../api/sleep';
import { useTemplates } from '../api/templates';
import { useStartSession } from '../api/sessions';
import { ProgressBar } from '../components/ProgressBar';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const date = todayDateString();

  const { data: log } = useDailyLog(date);
  const { data: checklist } = useSupplementChecklist(date);
  const { data: sleepLog } = useSleepLog(date);
  const { data: templates } = useTemplates();
  const startSession = useStartSession();

  const takenCount = checklist?.logs.filter((l) => l.taken).length ?? 0;
  const totalSupplements = checklist?.supplements.length ?? 0;

  async function handleQuickStart(templateId?: string) {
    const session = await startSession.mutateAsync(templateId ? { templateId } : { name: 'Workout' });
    navigate(`/sessions/${session.id}`);
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="text-sm text-slate-400">{user?.email}</p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Nutrition</h2>
          <Link to="/nutrition" className="text-sm text-emerald-400">
            View
          </Link>
        </div>
        {log ? (
          <div className="space-y-2">
            <ProgressBar label="Calories" value={log.totals.calories} target={log.target?.caloriesTarget ?? null} unit="kcal" />
            <ProgressBar label="Protein" value={log.totals.proteinG} target={log.target?.proteinGTarget ?? null} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Supplements</h2>
          <Link to="/supplements" className="text-sm text-emerald-400">
            View
          </Link>
        </div>
        {totalSupplements > 0 ? (
          <p className="text-sm text-slate-400">
            {takenCount} / {totalSupplements} taken today
          </p>
        ) : (
          <p className="text-sm text-slate-400">No supplements set up yet.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Sleep</h2>
          <Link to="/sleep" className="text-sm text-emerald-400">
            View
          </Link>
        </div>
        {sleepLog ? (
          <p className="text-sm text-slate-400">
            {sleepLog.hoursSlept}h slept last night
            {sleepLog.qualityRating !== null ? ` · quality ${sleepLog.qualityRating}/5` : ''}
          </p>
        ) : (
          <p className="text-sm text-slate-400">No sleep logged yet — tap to log it.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h2 className="font-medium">Quick start</h2>
        <button
          onClick={() => handleQuickStart()}
          disabled={startSession.isPending}
          className="w-full rounded-md border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-50"
        >
          Start quick workout
        </button>
        {templates?.slice(0, 3).map((template) => (
          <button
            key={template.id}
            onClick={() => handleQuickStart(template.id)}
            disabled={startSession.isPending}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Start "{template.name}"
          </button>
        ))}
      </div>
    </div>
  );
}
