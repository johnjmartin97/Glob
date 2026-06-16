import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise } from '@glob/shared';
import {
  useCreateTemplate,
  useTemplate,
  useUpdateTemplate,
  type TemplateExerciseInput,
} from '../api/templates';
import { ApiError } from '../api/client';
import { displayToKg, kgToDisplay, roundForDisplay } from '@glob/shared';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumberStepper } from '../components/NumberStepper';
import { WarmupConfigEditor } from '../components/WarmupConfigEditor';
import { useWeightUnit } from '../hooks/useWeightUnit';

interface ExerciseRow extends TemplateExerciseInput {
  key: string;
  exerciseName: string;
}

function emptyRow(orderIndex: number): ExerciseRow {
  return {
    key: crypto.randomUUID(),
    exerciseId: '',
    exerciseName: '',
    orderIndex,
    targetSets: 3,
    targetReps: 5,
    targetLoadKg: null,
    targetLoadPct: null,
    referenceLiftId: null,
    notes: null,
    warmupEnabled: false,
    warmupSetCount: null,
    warmupPercentages: null,
  };
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();

  const unit = useWeightUnit();
  const { data: template, isLoading } = useTemplate(id);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate(id ?? '');

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
        orderIndex: ex.orderIndex,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetLoadKg: ex.targetLoadKg,
        targetLoadPct: ex.targetLoadPct,
        referenceLiftId: ex.referenceLiftId,
        notes: ex.notes,
        warmupEnabled: ex.warmupEnabled,
        warmupSetCount: ex.warmupSetCount,
        warmupPercentages: ex.warmupPercentages,
      })),
    );
  }, [template]);

  function updateRow(key: string, patch: Partial<ExerciseRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
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
    updateRow(key, { exerciseId, exerciseName: exercise.name });
  }

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (rows.some((row) => !row.exerciseId)) {
      setError('Select an exercise for every row');
      return;
    }

    const input = {
      name: name.trim(),
      notes: notes.trim() ? notes.trim() : null,
      exercises: rows.map(({ key, exerciseName, ...rest }) => rest),
    };

    try {
      if (isEditing) {
        await updateTemplate.mutateAsync(input);
      } else {
        await createTemplate.mutateAsync(input);
      }
      navigate('/templates');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    }
  }

  if (isEditing && isLoading) {
    return <p className="p-4 text-sm text-slate-400">Loading template…</p>;
  }

  const saving = createTemplate.isPending || updateTemplate.isPending;

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
        {rows.map((row, i) => (
          <div key={row.key} className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Exercise {i + 1}</span>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => moveRow(row.key, -1)}
                  disabled={i === 0}
                  className="text-slate-400 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(row.key, 1)}
                  disabled={i === rows.length - 1}
                  className="text-slate-400 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>

            <ExercisePicker
              value={row.exerciseId || null}
              onChange={(exerciseId, exercise) => onExerciseSelected(row.key, exerciseId, exercise)}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberStepper
                label="Sets"
                value={row.targetSets}
                onChange={(v) => updateRow(row.key, { targetSets: v })}
                min={1}
                max={20}
              />
              <NumberStepper
                label="Reps"
                value={row.targetReps ?? 0}
                onChange={(v) => updateRow(row.key, { targetReps: v })}
                min={0}
                max={50}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">Target load ({unit})</label>
              <input
                type="number"
                step="0.5"
                value={row.targetLoadKg != null ? roundForDisplay(kgToDisplay(row.targetLoadKg, unit)) : ''}
                onChange={(e) =>
                  updateRow(row.key, {
                    targetLoadKg: e.target.value === '' ? null : displayToKg(Number(e.target.value), unit),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <WarmupConfigEditor
              enabled={row.warmupEnabled}
              setCount={row.warmupSetCount}
              percentages={row.warmupPercentages}
              workingLoadKg={row.targetLoadKg}
              onChange={(patch) => updateRow(row.key, patch)}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-md border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-300"
        >
          + Add exercise
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save template'}
      </button>
    </div>
  );
}
