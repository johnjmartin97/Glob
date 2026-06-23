import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SessionExercise, SessionSet, WeightUnit } from '@glob/shared';
import {
  BAR_WEIGHT_KG,
  calculateWarmupSets,
  DEFAULT_WARMUP_PERCENTAGES,
  DEFAULT_WARMUP_REPS_PER_SET,
  defaultWarmupRepsForIndex,
  displayToKg,
  formatWeight,
  kgToDisplay,
  roundForDisplay,
} from '@glob/shared';
import {
  useAddSessionExercise,
  useAddSessionSet,
  useDeleteSessionSet,
  useSession,
  useUpdateSession,
  useUpdateSet,
} from '../api/sessions';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseSettingsMenu } from '../components/ExerciseSettingsMenu';
import { NumberStepper } from '../components/NumberStepper';
import { SwipeToDelete } from '../components/SwipeToDelete';

interface ColumnSpans {
  label: string;
  load: string;
  reps: string;
  rpe: string;
  vel: string;
  done: string;
}

// Hardcoded col-span classes (literal strings so Tailwind keeps them) that always total 12
// across the label + done columns plus load/reps and the visible optional rpe/vel columns.
// The same spans drive the header, the target line, and the actual line so they stay aligned.
function columnSpans(logRpe: boolean, logVelocity: boolean): ColumnSpans {
  const base = { label: 'col-span-2', done: 'col-span-1' };
  if (logRpe && logVelocity)
    return { ...base, load: 'col-span-3', reps: 'col-span-2', rpe: 'col-span-2', vel: 'col-span-2' };
  if (logRpe) return { ...base, load: 'col-span-4', reps: 'col-span-3', rpe: 'col-span-2', vel: '' };
  if (logVelocity) return { ...base, load: 'col-span-4', reps: 'col-span-3', rpe: '', vel: 'col-span-2' };
  return { ...base, load: 'col-span-5', reps: 'col-span-4', rpe: '', vel: '' };
}

const targetInputClass =
  'rounded border border-slate-700 bg-slate-950 px-1 py-1 text-center text-xs text-slate-300 focus:border-slate-500 focus:outline-none';
const actualInputClass =
  'rounded-md border border-slate-700 bg-slate-950 px-1 py-1 text-center text-sm focus:border-emerald-500 focus:outline-none';

function SetRow({
  set,
  index,
  unit,
  logRpe,
  logVelocity,
  spans,
  onUpdate,
  onDelete,
}: {
  set: SessionSet;
  index: number;
  unit: WeightUnit;
  logRpe: boolean;
  logVelocity: boolean;
  spans: ColumnSpans;
  onUpdate: (input: Parameters<ReturnType<typeof useUpdateSet>['mutate']>[0]['input']) => void;
  onDelete: () => void;
}) {
  const [prescLoad, setPrescLoad] = useState(
    set.prescribedLoadKg != null ? String(roundForDisplay(kgToDisplay(set.prescribedLoadKg, unit))) : '',
  );
  const [prescReps, setPrescReps] = useState(set.prescribedReps?.toString() ?? '');
  const [prescRpe, setPrescRpe] = useState(set.prescribedRpe?.toString() ?? '');
  const [prescVelocity, setPrescVelocity] = useState(set.prescribedVelocityMps?.toString() ?? '');
  const [weight, setWeight] = useState(
    set.actualWeightKg != null
      ? String(roundForDisplay(kgToDisplay(set.actualWeightKg, unit)))
      : set.prescribedLoadKg != null
      ? String(roundForDisplay(kgToDisplay(set.prescribedLoadKg, unit)))
      : '',
  );
  const [reps, setReps] = useState(set.actualReps?.toString() ?? set.prescribedReps?.toString() ?? '');
  const [rpe, setRpe] = useState(set.actualRpe?.toString() ?? '');
  const [velocity, setVelocity] = useState(set.actualVelocityMps?.toString() ?? '');

  // Warmups have no target/actual distinction and never track RPE/velocity — render a single row.
  if (set.setType === 'warmup') {
    return (
      <SwipeToDelete onDelete={onDelete} className="rounded-md border border-slate-800">
        <div className="grid grid-cols-12 items-center gap-1 bg-slate-900 px-2 py-2">
          <div className={`${spans.label} text-xs`}>
            <span className="text-amber-400">W{index + 1}</span>
          </div>
          <input
            type="number"
            step="0.5"
            placeholder={unit}
            value={prescLoad}
            onChange={(e) => setPrescLoad(e.target.value)}
            onBlur={() =>
              onUpdate({ prescribedLoadKg: prescLoad === '' ? null : displayToKg(Number(prescLoad), unit) })
            }
            className={`${spans.load} ${actualInputClass}`}
          />
          <input
            type="number"
            placeholder="reps"
            value={prescReps}
            onChange={(e) => setPrescReps(e.target.value)}
            onBlur={() => onUpdate({ prescribedReps: prescReps === '' ? null : Number(prescReps) })}
            className={`${spans.reps} ${actualInputClass}`}
          />
          {/* spacers keep the done checkbox aligned under the ✓ header */}
          {logRpe && <div className={spans.rpe} />}
          {logVelocity && <div className={spans.vel} />}
          <div className={`${spans.done} flex justify-center`}>
            <input
              type="checkbox"
              checked={set.completed}
              onChange={(e) => onUpdate({ completed: e.target.checked })}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950"
            />
          </div>
        </div>
      </SwipeToDelete>
    );
  }

  return (
    <SwipeToDelete onDelete={onDelete} className="rounded-md border border-slate-800">
      <div className="space-y-1 bg-slate-900 px-2 py-2">
        {/* Target line */}
        <div className="grid grid-cols-12 items-center gap-1">
          <div className={`${spans.label} text-xs text-slate-500`}>target</div>
          <input
            type="number"
            step="0.5"
            placeholder={unit}
            value={prescLoad}
            onChange={(e) => setPrescLoad(e.target.value)}
            onBlur={() =>
              onUpdate({ prescribedLoadKg: prescLoad === '' ? null : displayToKg(Number(prescLoad), unit) })
            }
            className={`${spans.load} ${targetInputClass}`}
          />
          <input
            type="number"
            placeholder="reps"
            value={prescReps}
            onChange={(e) => setPrescReps(e.target.value)}
            onBlur={() => onUpdate({ prescribedReps: prescReps === '' ? null : Number(prescReps) })}
            className={`${spans.reps} ${targetInputClass}`}
          />
          {logRpe && (
            <input
              type="number"
              step="0.5"
              placeholder="RPE"
              value={prescRpe}
              onChange={(e) => setPrescRpe(e.target.value)}
              onBlur={() => onUpdate({ prescribedRpe: prescRpe === '' ? null : Number(prescRpe) })}
              className={`${spans.rpe} ${targetInputClass}`}
            />
          )}
          {logVelocity && (
            <input
              type="number"
              step="0.01"
              placeholder="m/s"
              value={prescVelocity}
              onChange={(e) => setPrescVelocity(e.target.value)}
              onBlur={() =>
                onUpdate({ prescribedVelocityMps: prescVelocity === '' ? null : Number(prescVelocity) })
              }
              className={`${spans.vel} ${targetInputClass}`}
            />
          )}
          {/* spacer to keep the done column aligned with the actual line */}
          <div className={spans.done} />
        </div>

        {/* Actual line */}
        <div className="grid grid-cols-12 items-center gap-1">
          <div className={`${spans.label} text-xs`}>
            <span className="text-slate-200">S{index + 1}</span>
          </div>
          <input
            type="number"
            step="0.5"
            placeholder={unit}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() =>
              onUpdate({ actualWeightKg: weight === '' ? null : displayToKg(Number(weight), unit) })
            }
            className={`${spans.load} ${actualInputClass}`}
          />
          <input
            type="number"
            placeholder="reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={() => onUpdate({ actualReps: reps === '' ? null : Number(reps) })}
            className={`${spans.reps} ${actualInputClass}`}
          />
          {logRpe && (
            <input
              type="number"
              placeholder="RPE"
              step="0.5"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              onBlur={() => onUpdate({ actualRpe: rpe === '' ? null : Number(rpe) })}
              className={`${spans.rpe} ${actualInputClass}`}
            />
          )}
          {logVelocity && (
            <input
              type="number"
              placeholder="m/s"
              step="0.01"
              value={velocity}
              onChange={(e) => setVelocity(e.target.value)}
              onBlur={() => onUpdate({ actualVelocityMps: velocity === '' ? null : Number(velocity) })}
              className={`${spans.vel} ${actualInputClass}`}
            />
          )}
          <div className={`${spans.done} flex justify-center`}>
            <input
              type="checkbox"
              checked={set.completed}
              onChange={(e) => onUpdate({ completed: e.target.checked })}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950"
            />
          </div>
        </div>
      </div>
    </SwipeToDelete>
  );
}

interface WarmupPanelState {
  workingLoad: string;
  setCount: number;
  percentages: number[];
  repsPerSet: number[];
}

function defaultWarmupPanel(): WarmupPanelState {
  return {
    workingLoad: '',
    setCount: DEFAULT_WARMUP_PERCENTAGES.length,
    percentages: [...DEFAULT_WARMUP_PERCENTAGES],
    repsPerSet: [...DEFAULT_WARMUP_REPS_PER_SET],
  };
}

function WarmupPanel({
  exercise,
  unit,
  onApply,
  onCancel,
}: {
  exercise: SessionExercise;
  unit: WeightUnit;
  onApply: (sets: { prescribedLoadKg: number; prescribedReps: number }[]) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<WarmupPanelState>(() => {
    const lastWorking = [...exercise.sets].reverse().find((s) => s.setType === 'working');
    return {
      ...defaultWarmupPanel(),
      workingLoad: lastWorking?.prescribedLoadKg != null
        ? String(roundForDisplay(kgToDisplay(lastWorking.prescribedLoadKg, unit)))
        : '',
    };
  });

  const workingLoadKg = state.workingLoad !== '' ? displayToKg(Number(state.workingLoad), unit) : null;

  const preview = workingLoadKg != null
    ? calculateWarmupSets({
        workingLoadKg,
        warmupSetCount: state.setCount,
        warmupPercentages: state.percentages,
        warmupRepsPerSet: state.repsPerSet,
      })
    : [];

  function setCount(next: number) {
    setState((s) => ({
      ...s,
      setCount: next,
      percentages: Array.from({ length: next }, (_, i) => s.percentages[i] ?? s.percentages[s.percentages.length - 1] ?? 50),
      repsPerSet: Array.from({ length: next }, (_, i) => s.repsPerSet[i] ?? defaultWarmupRepsForIndex(i)),
    }));
  }

  function setPct(i: number, v: number) {
    setState((s) => { const next = s.percentages.slice(); next[i] = v; return { ...s, percentages: next }; });
  }

  function setReps(i: number, v: number) {
    setState((s) => { const next = s.repsPerSet.slice(); next[i] = v; return { ...s, repsPerSet: next }; });
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-900/40 bg-slate-950 p-3">
      <p className="text-sm font-medium text-amber-400">Add warmup sets</p>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Working weight ({unit})</label>
        <input
          type="number"
          step="0.5"
          value={state.workingLoad}
          onChange={(e) => setState((s) => ({ ...s, workingLoad: e.target.value }))}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <NumberStepper label="Warmup sets" value={state.setCount} onChange={setCount} min={1} max={10} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {state.percentages.slice(0, state.setCount).map((pct, i) => (
          <div key={i} className="space-y-1">
            <label className="block text-xs text-slate-400">W{i + 1}</label>
            <input type="number" value={pct} min={0} max={100} onChange={(e) => setPct(i, Number(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none" title="%" />
            <input type="number" value={state.repsPerSet[i] ?? defaultWarmupRepsForIndex(i)} min={1} max={20} onChange={(e) => setReps(i, Number(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none" title="reps" />
            <div className="flex justify-between px-0.5 text-xs text-slate-500"><span>%</span><span>reps</span></div>
          </div>
        ))}
      </div>
      {workingLoadKg != null && preview.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-400">
          {preview.map((s) => (
            <li key={s.setIndex} className="flex justify-between">
              <span>W{s.setIndex}</span>
              <span>{formatWeight(s.prescribedLoadKg, unit)} × {s.prescribedReps}
                {s.prescribedLoadKg === BAR_WEIGHT_KG && workingLoadKg > BAR_WEIGHT_KG && <span className="ml-1 text-slate-500">(bar)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={workingLoadKg == null || preview.length === 0}
          onClick={() => onApply(preview.map((s) => ({ prescribedLoadKg: s.prescribedLoadKg!, prescribedReps: s.prescribedReps! })))}
          className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
          Apply
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-400">Cancel</button>
      </div>
    </div>
  );
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession(id ?? '');
  const updateSet = useUpdateSet(id ?? '');
  const deleteSet = useDeleteSessionSet(id ?? '');
  const addExercise = useAddSessionExercise(id ?? '');
  const addSet = useAddSessionSet(id ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [warmupOpenFor, setWarmupOpenFor] = useState<string | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  if (isLoading || !session) {
    return <p className="p-4 text-sm text-slate-400">Loading session…</p>;
  }

  const isComplete = !!session.completedAt;

  async function applyWarmupSets(exercise: SessionExercise, sets: { prescribedLoadKg: number; prescribedReps: number }[]) {
    for (const s of sets) {
      await addSet.mutateAsync({
        exerciseId: exercise.id,
        input: { setType: 'warmup', prescribedLoadKg: s.prescribedLoadKg, prescribedReps: s.prescribedReps },
      });
    }
    setWarmupOpenFor(null);
  }

  return (
    <div className="space-y-6 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          <p className="text-sm text-slate-400">Started {new Date(session.startedAt).toLocaleString()}</p>
          {isComplete && (
            <p className="text-sm text-emerald-400">Completed {new Date(session.completedAt!).toLocaleString()}</p>
          )}
        </div>
        <button onClick={() => navigate('/history')} className="text-sm text-emerald-400">History</button>
      </div>

      <div className="space-y-4">
        {session.exercises.map((exercise) => {
          const unit: WeightUnit = exercise.exercise?.weightUnit ?? 'kg';
          const logRpe = exercise.exercise?.logRpe ?? true;
          const logVelocity = exercise.exercise?.logVelocity ?? false;
          const spans = columnSpans(logRpe, logVelocity);
          const hasWarmupSets = exercise.sets.some((s) => s.setType === 'warmup');
          const warmupOpen = warmupOpenFor === exercise.id;
          const menuOpen = menuOpenFor === exercise.id;

          return (
            <div key={exercise.id} className="space-y-2 rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{exercise.exercise?.name ?? 'Exercise'}</h2>
                <button
                  type="button"
                  aria-label="Exercise options"
                  onClick={() => setMenuOpenFor(menuOpen ? null : exercise.id)}
                  className={`rounded-md px-2 py-1 text-lg leading-none ${menuOpen ? 'text-emerald-400' : 'text-slate-400'}`}
                >
                  ⋯
                </button>
              </div>

              {menuOpen && (
                <ExerciseSettingsMenu
                  exercise={exercise}
                  sessionId={session.id}
                  onClose={() => setMenuOpenFor(null)}
                />
              )}

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-1 px-1 text-xs text-slate-500">
                <div className={spans.label} />
                <div className={spans.load}>{unit}</div>
                <div className={spans.reps}>Reps</div>
                {logRpe && <div className={spans.rpe}>RPE</div>}
                {logVelocity && <div className={spans.vel}>Vel</div>}
                <div className={`${spans.done} text-center`}>✓</div>
              </div>
              <div className="space-y-1">
                {(() => {
                  // Number warmups and working sets independently (W1.., S1..), since the sets array
                  // is ordered warmups-first across both types.
                  let warmupNo = 0;
                  let workingNo = 0;
                  return exercise.sets.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      index={set.setType === 'warmup' ? warmupNo++ : workingNo++}
                      unit={unit}
                      logRpe={logRpe}
                      logVelocity={logVelocity}
                      spans={spans}
                      onUpdate={(input) => updateSet.mutate({ setId: set.id, input })}
                      onDelete={() => deleteSet.mutate(set.id)}
                    />
                  ));
                })()}
              </div>

              {!hasWarmupSets && !warmupOpen && (
                <button type="button" onClick={() => setWarmupOpenFor(exercise.id)}
                  className="w-full rounded-md border border-dashed border-amber-900/50 px-3 py-1.5 text-xs text-amber-500">
                  + Add warmup sets
                </button>
              )}

              {warmupOpen && (
                <WarmupPanel
                  exercise={exercise}
                  unit={unit}
                  onApply={(sets) => applyWarmupSets(exercise, sets)}
                  onCancel={() => setWarmupOpenFor(null)}
                />
              )}

              <button type="button"
                onClick={() => addSet.mutate({
                  exerciseId: exercise.id,
                  input: {
                    setType: 'working',
                    prescribedReps: exercise.sets[exercise.sets.length - 1]?.prescribedReps ?? null,
                    prescribedLoadKg: exercise.sets[exercise.sets.length - 1]?.prescribedLoadKg ?? null,
                  },
                })}
                className="w-full rounded-md border border-dashed border-slate-700 px-3 py-1.5 text-xs text-slate-400">
                + Add set
              </button>
            </div>
          );
        })}
      </div>

      {showPicker ? (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-3">
          <ExercisePicker value={null} onChange={(exerciseId) => { addExercise.mutate({ exerciseId }); setShowPicker(false); }} />
          <button type="button" onClick={() => setShowPicker(false)} className="text-sm text-slate-400">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowPicker(true)}
          className="w-full rounded-md border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-300">
          + Add exercise
        </button>
      )}

      <button
        onClick={isComplete ? () => updateSession.mutateAsync({ completedAt: null }) : () => updateSession.mutateAsync({ completedAt: new Date().toISOString() })}
        className={`w-full rounded-md px-4 py-2 font-medium text-white ${isComplete ? 'bg-slate-700' : 'bg-emerald-600'}`}
      >
        {isComplete ? 'Reopen session' : 'Complete session'}
      </button>
    </div>
  );
}
