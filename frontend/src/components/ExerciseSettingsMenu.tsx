import type { SessionExercise, WeightUnit } from '@glob/shared';
import { useUpdateExerciseSettings } from '../api/exercises';
import { useDeleteSessionExercise } from '../api/sessions';

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-slate-200">
        {label}
        {hint && <span className="ml-1 text-xs text-slate-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-700 bg-slate-950 disabled:opacity-50"
      />
    </label>
  );
}

export function ExerciseSettingsMenu({
  exercise,
  sessionId,
  onClose,
}: {
  exercise: SessionExercise;
  sessionId: string;
  onClose: () => void;
}) {
  const updateSettings = useUpdateExerciseSettings();
  const deleteExercise = useDeleteSessionExercise(sessionId);

  const exerciseId = exercise.exerciseId;
  const unit: WeightUnit = exercise.exercise?.weightUnit ?? 'kg';
  const logRpe = exercise.exercise?.logRpe ?? true;
  const logVelocity = exercise.exercise?.logVelocity ?? false;
  const busy = updateSettings.isPending;

  function setUnit(next: WeightUnit) {
    updateSettings.mutate({ id: exerciseId, weightUnit: next });
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-700 bg-slate-950 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">Exercise options</p>
        <button type="button" onClick={onClose} className="text-xs text-slate-400">
          Done
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-200">Weight unit</span>
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          {(['kg', 'lb'] as const).map((u) => (
            <button
              key={u}
              type="button"
              disabled={busy}
              onClick={() => setUnit(u)}
              className={`px-3 py-1 text-sm disabled:opacity-50 ${
                unit === u ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-300'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label="RPE logging"
        checked={logRpe}
        disabled={busy}
        onChange={(next) => updateSettings.mutate({ id: exerciseId, logRpe: next })}
      />
      <Toggle
        label="Velocity logging"
        hint="VBT"
        checked={logVelocity}
        disabled={busy}
        onChange={(next) => updateSettings.mutate({ id: exerciseId, logVelocity: next })}
      />

      <button
        type="button"
        disabled={deleteExercise.isPending}
        onClick={() => {
          deleteExercise.mutate(exercise.id);
          onClose();
        }}
        className="w-full rounded-md border border-red-900/50 px-3 py-1.5 text-sm text-red-400 disabled:opacity-50"
      >
        Remove exercise
      </button>
    </div>
  );
}
