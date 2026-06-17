import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeleteSession, useSessions } from '../api/sessions';

export function HistoryPage() {
  const { data: sessions, isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">History</h1>
        <Link to="/train" className="text-sm text-emerald-400">
          Train
        </Link>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && sessions?.length === 0 && (
        <p className="text-sm text-slate-400">No sessions yet.</p>
      )}

      <ul className="space-y-2">
        {sessions?.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-3"
          >
            <Link to={`/sessions/${session.id}`} className="flex-1">
              <p className="font-medium">{session.name}</p>
              <p className="text-sm text-slate-400">
                {new Date(session.startedAt).toLocaleString()} · {session.exerciseCount} exercise
                {session.exerciseCount === 1 ? '' : 's'}
                {session.completedAt ? ' · Completed' : ' · In progress'}
              </p>
            </Link>
            {pendingDeleteId === session.id ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { deleteSession.mutate(session.id); setPendingDeleteId(null); }}
                  className="text-sm text-red-400"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="text-sm text-slate-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPendingDeleteId(session.id)}
                className="text-sm text-red-400"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
