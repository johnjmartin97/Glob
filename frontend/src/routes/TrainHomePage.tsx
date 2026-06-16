import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTemplates } from '../api/templates';
import { useStartSession } from '../api/sessions';
import { ApiError } from '../api/client';

export function TrainHomePage() {
  const { data: templates, isLoading } = useTemplates();
  const startSession = useStartSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function startQuick() {
    setError(null);
    try {
      const session = await startSession.mutateAsync({ name: 'Quick Workout' });
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start session');
    }
  }

  async function startFromTemplate(templateId: string) {
    setError(null);
    try {
      const session = await startSession.mutateAsync({ templateId });
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start session');
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Train</h1>
        <div className="flex gap-3 text-sm">
          <Link to="/templates" className="text-emerald-400">
            Templates
          </Link>
          <Link to="/history" className="text-emerald-400">
            History
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={startQuick}
        disabled={startSession.isPending}
        className="w-full rounded-md border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-300 disabled:opacity-50"
      >
        Start quick workout
      </button>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Templates</h2>
        {isLoading && <p className="text-sm text-slate-400">Loading templates…</p>}
        {!isLoading && templates?.length === 0 && (
          <p className="text-sm text-slate-400">
            No templates yet. <Link to="/templates/new" className="text-emerald-400">Create one</Link>.
          </p>
        )}
        <ul className="space-y-2">
          {templates?.map((template) => (
            <li
              key={template.id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-3"
            >
              <Link to={`/templates/${template.id}/edit`} className="flex-1">
                <p className="font-medium">{template.name}</p>
                <p className="text-sm text-slate-400">
                  {template.exerciseCount} exercise{template.exerciseCount === 1 ? '' : 's'}
                </p>
              </Link>
              <button
                onClick={() => startFromTemplate(template.id)}
                disabled={startSession.isPending}
                className="ml-3 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
