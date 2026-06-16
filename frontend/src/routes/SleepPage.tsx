import { useEffect, useState, type FormEvent } from 'react';
import { useDeleteSleepLog, useSetSleepLog, useSleepHistory, useSleepLog } from '../api/sleep';
import { ApiError } from '../api/client';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoString(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

export function SleepPage() {
  const today = todayDateString();
  const from = daysAgoString(13);

  const { data: todayLog } = useSleepLog(today);
  const { data: history } = useSleepHistory(from, today);
  const setSleepLog = useSetSleepLog();
  const deleteSleepLog = useDeleteSleepLog();

  const [hoursSlept, setHoursSlept] = useState('');
  const [hoursInBed, setHoursInBed] = useState('');
  const [qualityRating, setQualityRating] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (todayLog) {
      setHoursSlept(String(todayLog.hoursSlept));
      setHoursInBed(todayLog.hoursInBed !== null ? String(todayLog.hoursInBed) : '');
      setQualityRating(todayLog.qualityRating !== null ? String(todayLog.qualityRating) : '');
      setNotes(todayLog.notes ?? '');
    } else {
      setHoursSlept('');
      setHoursInBed('');
      setQualityRating('');
      setNotes('');
    }
  }, [todayLog]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await setSleepLog.mutateAsync({
        logDate: today,
        hoursSlept: Number(hoursSlept),
        hoursInBed: hoursInBed ? Number(hoursInBed) : null,
        qualityRating: qualityRating ? Number(qualityRating) : null,
        notes: notes || null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save sleep log');
    }
  }

  async function handleDelete(date: string) {
    setError(null);
    try {
      await deleteSleepLog.mutateAsync(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete sleep log');
    }
  }

  const otherDays = history?.filter((log) => log.logDate !== today) ?? [];

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Sleep</h1>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Last night ({today})</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Hours slept</label>
            <input
              type="number"
              required
              min="0"
              max="24"
              step="0.1"
              value={hoursSlept}
              onChange={(e) => setHoursSlept(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Hours in bed (optional)</label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.1"
              value={hoursInBed}
              onChange={(e) => setHoursInBed(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">Quality (optional)</label>
          <select
            value={qualityRating}
            onChange={(e) => setQualityRating(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating} · {QUALITY_LABELS[rating]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={setSleepLog.isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {setSleepLog.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-200">Recent history</p>
        {otherDays.length === 0 && <p className="text-sm text-slate-400">No entries yet.</p>}
        <ul className="space-y-2">
          {otherDays.map((log) => (
            <li
              key={log.logDate}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
            >
              <div>
                <p className="font-medium">{log.logDate}</p>
                <p className="text-sm text-slate-400">
                  {log.hoursSlept}h slept
                  {log.hoursInBed !== null ? ` · ${log.hoursInBed}h in bed` : ''}
                  {log.qualityRating !== null ? ` · ${QUALITY_LABELS[log.qualityRating]}` : ''}
                </p>
              </div>
              <button onClick={() => handleDelete(log.logDate)} className="text-sm text-red-400">
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
