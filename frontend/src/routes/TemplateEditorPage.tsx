import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise } from '@glob/shared';
import {
  useCreateTemplate,
  useTemplate,
  useUpdateTemplate,
  type TemplateExerciseInput,
} from '../api/templates';
import { useStartSession } from '../api/sessions';
import { ApiError } from '../api/client';
import { displayToKg, kgToDisplay, roundForDisplay } from '@glob/shared';
import { ExercisePicker } from '../components/ExercisePicker';
import { WarmupConfigEditor } from '../components/WarmupConfigEditor';
import { SwipeToDelete } from '../components/SwipeToDelete';

interface SetDef {
  loadKg: number | null;
  reps: number | null;
  rpe: number | null;
  velocityMps: number | null;
}

interface ExerciseRow extends Omit<TemplateExerciseInput, 'targetSets' | 'targetReps' | 'targetLoadKg' | 'setsConfig'> {
  key: string;
  exerciseName: string;
  exerciseWeightUnit: 'kg' | 'lb';
  exerciseLogRpe: boolean;
  exerciseLogVelocity: boolean;
  sets: SetDef[];
}

function emptyRow(orderIndex: number): ExerciseRow {
  return {
    key: crypto.randomUUID(),
    exerciseId: '',
    exerciseName: '',
    exerciseWeightUnit: 'kg',
    exerciseLogRpe: true,
    exerciseLogVelocity: false,
    orderIndex,
    targetLoadPct: null,
    referenceLiftId: null,
    notes: null,
    warmupEnabled: false,
    warmupSetCount: null,
    warmupPercentages: null,
    warmupRepsPerSet: null,
    sets: [{ loadKg: null, reps: 5, rpe: null, velocityMps: null }],
  };
}

function expandSets(ex: { setsConfig: SetDef[] | null; targetSets: number; targetLoadKg: number | null; targetReps: number | null }): SetDef[] {
  if (ex.setsConfig?.length) {
    return ex.setsConfig.map((s) => ({
      loadKg: s.loadKg,
      reps: s.reps,
      rpe: s.rpe ?? null,
      velocityMps: s.velocityMps ?? null,
    }));
  }
  return Array.from({ length: ex.targetSets }, () => ({
    loadKg: ex.targetLoadKg,
    reps: ex.targetReps,
    rpe: null,
    velocityMps: null,
  }));
}

// Literal col-span-* classes summing to 12 with fixed `#` (1) and clone (2) columns, plus the
// visible RPE/Vel target columns. Used for both the set header and each set row.
function templateSetSpans(logRpe: boolean, logVelocity: boolean) {
  if (logRpe && logVelocity)
    return { load: 'col-span-3', reps: 'col-span-2', rpe: 'col-span-2', vel: 'col-span-2' };
  if (logRpe) return { load: 'col-span-4', reps: 'col-span-3', rpe: 'col-span-2', vel: '' };
  if (logVelocity) return { load: 'col-span-4', reps: 'col-span-3', rpe: '', vel: 'col-span-2' };
  return { load: 'col-span-5', reps: 'col-span-4', rpe: '', vel: '' };
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();

  const { data: template, isLoading } = useTemplate(id);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate(id ?? '');
  const startSession = useStartSession();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setNotes(template.notes ?? '');
    setRows(
      template.exercises.map((ex) => ({
        key: crypto.randomUUID(),
        exerciseId: ex.exerciseId,
        exerciseName: ex.exercise?.name ?? '',
        exerciseWeightUnit: ex.exercise?.weightUnit ?? 'kg',
        exerciseLogRpe: ex.exercise?.logRpe ?? true,
        exerciseLogVelocity: ex.exercise?.logVelocity ?? false,
        orderIndex: ex.orderIndex,
        targetLoadPct: ex.targetLoadPct,
        referenceLiftId: ex.referenceLiftId,
        notes: ex.notes,
        warmupEnabled: ex.warmupEnabled,
        warmupSetCount: ex.warmupSetCount,
        warmupPercentages: ex.warmupPercentages,
        warmupRepsPerSet: ex.warmupRepsPerSet,
        sets: expandSets({
          setsConfig: ex.setsConfig,
          targetSets: ex.targetSets,
          targetLoadKg: ex.targetLoadKg,
          targetReps: ex.targetReps,
        }),
      })),
    );
  }, [template]);

  function updateRow(key: string, patch: Partial<ExerciseRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateSet(rowKey: string, setIndex: number, patch: Partial<SetDef>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const sets = row.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s));
        return { ...row, sets };
      }),
    );
  }

  function addSet(rowKey: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const last = row.sets[row.sets.length - 1] ?? { loadKg: null, reps: 5, rpe: null, velocityMps: null };
        return { ...row, sets: [...row.sets, { ...last }] };
      }),
    );
  }

  function cloneSet(rowKey: string, setIndex: number) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const copy = { ...row.sets[setIndex]! };
        const sets = [...row.sets.slice(0, setIndex + 1), copy, ...row.sets.slice(setIndex + 1)];
        return { ...row, sets };
      }),
    );
  }

  function removeSet(rowKey: string, setIndex: number) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey || row.sets.length <= 1) return row;
        return { ...row, sets: row.sets.filter((_, i) => i !== setIndex) };
      }),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(prev.length)]);
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.filter((row) => row.key !== key).map((row, i) => ({ ...row, orderIndex: i })),
    );
  }

  function moveRow(key: string, direction: -1 | 1) {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.key === key);
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((row, i) => ({ ...row, orderIndex: i }));
    });
  }

  function onExerciseSelected(key: string, exerciseId: string, exercise: Exercise) {
    updateRow(key, {
      exerciseId,
      exerciseName: exercise.name,
      exerciseWeightUnit: exercise.weightUnit,
      exerciseLogRpe: exercise.logRpe,
      exerciseLogVelocity: exercise.logVelocity,
    });
  }

  function buildInput() {
    return {
      name: name.trim(),
      notes: notes.trim() ? notes.trim() : null,
      exercises: rows.map(({ key, exerciseName, exerciseWeightUnit, exerciseLogRpe, exerciseLogVelocity, sets, ...rest }) => ({
        ...rest,
        targetSets: sets.length,
        targetLoadKg: sets[0]?.loadKg ?? null,
        targetReps: sets[0]?.reps ?? null,
        setsConfig: sets,
      })),
    };
  }

  function validate(): boolean {
    if (!name.trim()) {
      setError('Template name is required');
      return false;
    }
    if (rows.some((row) => !row.exerciseId)) {
      setError('Select an exercise for every row');
      return false;
    }
    return true;
  }

  async function handleSave() {
    setError(null);
    if (!validate()) return;
    try {
      if (isEditing) {
        await updateTemplate.mutateAsync(buildInput());
      } else {
        await createTemplate.mutateAsync(buildInput());
      }
      navigate('/templates');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    }
  }

  async function handleSaveAndStart() {
    setError(null);
    if (!validate()) return;
    try {
      let templateId = id;
      if (isEditing) {
        await updateTemplate.mutateAsync(buildInput());
        templateId = id;
      } else {
        const created = await createTemplate.mutateAsync(buildInput());
        templateId = created.id;
      }
      const session = await startSession.mutateAsync({ templateId });
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    }
  }

  if (isEditing && isLoading) {
    return <p className="p-4 text-sm text-slate-400">Loading template…</p>;
  }

  const saving = createTemplate.isPending || updateTemplate.isPending || startSession.isPending;

  return (
    <div className="space-y-6 p-4 pb-24">
      <h1 className="text-2xl font-semibold">{isEditing ? 'Edit template' : 'New template'}</h1>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Exercises</h2>
        {rows.map((row, i) => {
          const unit = row.exerciseWeightUnit;
          const workingLoadKg = row.sets[0]?.loadKg ?? null;
          const setSpans = templateSetSpans(row.exerciseLogRpe, row.exerciseLogVelocity);
          return (
            <div key={row.key} className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
              <SwipeToDelete onDelete={() => removeRow(row.key)} deleteLabel="Remove">
                <div className="flex items-center justify-between bg-slate-900 px-3 pt-3 pb-1">
                  <span className="text-sm text-slate-400">Exercise {i + 1}</span>
                  <div className="flex gap-2 text-sm">
                    <button type="button" onClick={() => moveRow(row.key, -1)} disabled={i === 0} className="text-slate-400 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveRow(row.key, 1)} disabled={i === rows.length - 1} className="text-slate-400 disabled:opacity-30">↓</button>
                  </div>
                </div>
              </SwipeToDelete>
              <div className="space-y-3 px-3 pb-3">

              <ExercisePicker
                value={row.exerciseId || null}
                onChange={(exerciseId, exercise) => onExerciseSelected(row.key, exerciseId, exercise)}
              />

              <div>
                <div className="mb-1 grid grid-cols-12 gap-1 px-1 text-xs text-slate-500">
                  <div className="col-span-1" />
                  <div className={setSpans.load}>Load ({unit})</div>
                  <div className={setSpans.reps}>Reps</div>
                  {row.exerciseLogRpe && <div className={setSpans.rpe}>RPE</div>}
                  {row.exerciseLogVelocity && <div className={setSpans.vel}>m/s</div>}
                  <div className="col-span-2" />
                </div>
                <div className="space-y-1">
                  {row.sets.map((set, si) => (
                    <SwipeToDelete
                      key={si}
                      onDelete={() => removeSet(row.key, si)}
                      deleteLabel="×"
                      disabled={row.sets.length <= 1}
                    >
                      <div className="grid grid-cols-12 items-center gap-1 bg-slate-900">
                        <span className="col-span-1 text-xs text-slate-500">{si + 1}</span>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="—"
                          value={set.loadKg != null ? roundForDisplay(kgToDisplay(set.loadKg, unit)) : ''}
                          onChange={(e) =>
                            updateSet(row.key, si, {
                              loadKg: e.target.value === '' ? null : displayToKg(Number(e.target.value), unit),
                            })
                          }
                          className={`${setSpans.load} rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none`}
                        />
                        <input
                          type="number"
                          placeholder="—"
                          value={set.reps ?? ''}
                          onChange={(e) =>
                            updateSet(row.key, si, {
                              reps: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className={`${setSpans.reps} rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none`}
                        />
                        {row.exerciseLogRpe && (
                          <input
                            type="number"
                            step="0.5"
                            placeholder="RPE"
                            value={set.rpe ?? ''}
                            onChange={(e) =>
                              updateSet(row.key, si, {
                                rpe: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className={`${setSpans.rpe} rounded-md border border-slate-700 bg-slate-950 px-1 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none`}
                          />
                        )}
                        {row.exerciseLogVelocity && (
                          <input
                            type="number"
                            step="0.01"
                            placeholder="m/s"
                            value={set.velocityMps ?? ''}
                            onChange={(e) =>
                              updateSet(row.key, si, {
                                velocityMps: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className={`${setSpans.vel} rounded-md border border-slate-700 bg-slate-950 px-1 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => cloneSet(row.key, si)}
                          title="Clone set below"
                          className="col-span-2 text-center text-xs text-slate-400"
                        >
                          ↓+
                        </button>
                      </div>
                    </SwipeToDelete>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addSet(row.key)}
                  className="mt-1 w-full rounded-md border border-dashed border-slate-700 py-1 text-xs text-slate-400"
                >
                  + Add set
                </button>
              </div>

              <WarmupConfigEditor
                enabled={row.warmupEnabled}
                setCount={row.warmupSetCount}
                percentages={row.warmupPercentages}
                repsPerSet={row.warmupRepsPerSet}
                workingLoadKg={workingLoadKg}
                weightUnit={unit}
                onChange={(patch) => updateRow(row.key, patch)}
              />
            </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-md border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-300"
        >
          + Add exercise
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleSaveAndStart}
          disabled={saving}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {startSession.isPending ? 'Starting…' : saving ? 'Saving…' : 'Save and start workout'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 font-medium text-slate-200 disabled:opacity-50"
        >
          {saving && !startSession.isPending ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </div>
  );
}
