import { useState, type FormEvent } from 'react';
import {
  useCreateSupplement,
  useDeleteSupplement,
  useSetSupplementLog,
  useSupplementChecklist,
  useSupplements,
} from '../api/supplements';
import { ApiError } from '../api/client';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function SupplementsPage() {
  const date = todayDateString();
  const { data: supplements, isLoading } = useSupplements();
  const { data: checklist } = useSupplementChecklist(date);
  const createSupplement = useCreateSupplement();
  const deleteSupplement = useDeleteSupplement();
  const setLog = useSetSupplementLog(date);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const takenBySupplementId = new Map(checklist?.logs.map((log) => [log.supplementId, log.taken]) ?? []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createSupplement.mutateAsync({ name, dosage: dosage || null });
      setName('');
      setDosage('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add supplement');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSupplement.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete supplement');
    }
  }

  function handleToggle(supplementId: string, taken: boolean) {
    setLog.mutate({ supplementId, taken: !taken });
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Supplements</h1>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && (supplements?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-400">No supplements yet — add one below.</p>
      )}

      {(supplements?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-200">Today's checklist</p>
          <ul className="space-y-2">
            {supplements?.map((supplement) => {
              const taken = takenBySupplementId.get(supplement.id) ?? false;
              return (
                <li
                  key={supplement.id}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
                >
                  <label className="flex flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={taken}
                      onChange={() => handleToggle(supplement.id, taken)}
                      className="h-5 w-5 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <span className="font-medium">{supplement.name}</span>
                      {supplement.dosage ? (
                        <span className="text-slate-400"> · {supplement.dosage}</span>
                      ) : null}
                    </span>
                  </label>
                  <button onClick={() => handleDelete(supplement.id)} className="text-sm text-red-400">
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Add supplement</p>
        <input
          type="text"
          placeholder="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Dosage (optional)"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={createSupplement.isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {createSupplement.isPending ? 'Adding…' : 'Add supplement'}
        </button>
      </form>
    </div>
  );
}
