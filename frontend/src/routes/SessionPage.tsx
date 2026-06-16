import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SessionSet } from '@glob/shared';
import { displayToKg, formatWeight, kgToDisplay, roundForDisplay } from '@glob/shared';
import {
  useAddSessionExercise,
  useAddSessionSet,
  useSession,
  useUpdateSession,
  useUpdateSet,
} from '../api/sessions';
import { ExercisePicker } from '../components/ExercisePicker';
import { useWeightUnit } from '../hooks/useWeightUnit';

function SetRow({
  set,
  index,
  onUpdate,
}: {
  set: SessionSet;
  index: number;
  onUpdate: (input: Parameters<ReturnType<typeof useUpdateSet>['mutate']>[0]['input']) => void;
}) {
  const unit = useWeightUnit();
  const [weight, setWeight] = useState(
    set.actualWeightKg != null ? String(roundForDisplay(kgToDisplay(set.actualWeightKg, unit))) : '',
  );
  const [reps, setReps] = useState(set.actualReps?.toString() ?? '');
  const [rpe, setRpe] = useState(set.actualRpe?.toString() ?? '');

  return (
    <div className="grid grid-cols-12 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2 py-2">
      <div className="col-span-2 text-sm text-slate-400">
        <span className={set.setType === 'warmup' ? 'text-amber-400' : 'text-slate-200'}>
          {set.setType === 'warmup' ? 'W' : 'S'}
          {index + 1}
        </span>
      </div>
      <div className="col-span-3 text-sm text-slate-400">
        {formatWeight(set.prescribedLoadKg, unit)} × {set.prescribedReps ?? '–'}
      </div>
      <input
        type="number"
        placeholder={unit}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() =>
          onUpdate({ actualWeightKg: weight === '' ? null : displayToKg(Number(weight), unit) })
        }
        className="col-span-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm focus:border-emerald-500 focus:outline-none"
      />
      <input
        type="number"
        placeholder="reps"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => onUpdate({ actualReps: reps === '' ? null : Number(reps) })}
        className="col-span-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm focus:border-emerald-500 focus:outline-none"
      />
      <input
        type="number"
        placeholder="RPE"
        step="0.5"
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        onBlur={() => onUpdate({ actualRpe: rpe === '' ? null : Number(rpe) })}
        className="col-span-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm focus:border-emerald-500 focus:outline-none"
      />
      <div className="col-span-1 flex justify-center">
        <input
          type="checkbox"
          checked={set.completed}
          onChange={(e) => onUpdate({ completed: e.target.checked })}
          className="h-5 w-5 rounded border-slate-700 bg-slate-950"
        />
      </div>
    </div>
  );
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const unit = useWeightUnit();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession(id ?? '');
  const updateSet = useUpdateSet(id ?? '');
  const addExercise = useAddSessionExercise(id ?? '');
  const addSet = useAddSessionSet(id ?? '');
  const [showPicker, setShowPicker] = useState(false);

  if (isLoading || !session) {
    return <p className="p-4 text-sm text-slate-400">Loading session…</p>;
  }

  const isComplete = !!session.completedAt;

  async function handleComplete() {
    await updateSession.mutateAsync({ completedAt: new Date().toISOString() });
  }

  async function handleReopen() {
    await updateSession.mutateAsync({ completedAt: null });
  }

  return (
    <div className="space-y-6 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          <p className="text-sm text-slate-400">
            Started {new Date(session.startedAt).toLocaleString()}
          </p>
          {isComplete && (
            <p className="text-sm text-emerald-400">
              Completed {new Date(session.completedAt!).toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={() => navigate('/history')} className="text-sm text-emerald-400">
          History
        </button>
      </div>

      <div className="space-y-4">
        {session.exercises.map((exercise) => (
          <div key={exercise.id} className="space-y-2 rounded-md border border-slate-800 bg-slate-950 p-3">
            <h2 className="font-medium">{exercise.exercise?.name ?? 'Exercise'}</h2>
            <div className="grid grid-cols-12 gap-2 px-2 text-xs text-slate-500">
              <div className="col-span-2">Set</div>
              <div className="col-span-3">Target</div>
              <div className="col-span-2">{unit}</div>
              <div className="col-span-2">Reps</div>
              <div className="col-span-2">RPE</div>
              <div className="col-span-1 text-center">✓</div>
            </div>
            <div className="space-y-1">
              {exercise.sets.map((set, i) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={i}
                  onUpdate={(input) => updateSet.mutate({ setId: set.id, input })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                addSet.mutate({
                  exerciseId: exercise.id,
                  input: {
                    setType: 'working',
                    prescribedReps:
                      exercise.sets[exercise.sets.length - 1]?.prescribedReps ?? null,
                    prescribedLoadKg:
                      exercise.sets[exercise.sets.length - 1]?.prescribedLoadKg ?? null,
                  },
                })
              }
              className="w-full rounded-md border border-dashed border-slate-700 px-3 py-1.5 text-xs text-slate-400"
            >
              + Add set
            </button>
          </div>
        ))}
      </div>

      {showPicker ? (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-3">
          <ExercisePicker
            value={null}
            onChange={(exerciseId) => {
              addExercise.mutate({ exerciseId });
              setShowPicker(false);
            }}
          />
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="text-sm text-slate-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-md border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-300"
        >
          + Add exercise
        </button>
      )}

      <button
        onClick={isComplete ? handleReopen : handleComplete}
        className={`w-full rounded-md px-4 py-2 font-medium text-white ${
          isComplete ? 'bg-slate-700' : 'bg-emerald-600'
        }`}
      >
        {isComplete ? 'Reopen session' : 'Complete session'}
      </button>
    </div>
  );
}
