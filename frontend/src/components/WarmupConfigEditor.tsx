import {
  BAR_WEIGHT_KG,
  calculateWarmupSets,
  DEFAULT_WARMUP_PERCENTAGES,
  DEFAULT_WARMUP_REPS,
  defaultWarmupRepsForIndex,
  formatWeight,
} from '@glob/shared';
import type { WeightUnit } from '@glob/shared';
import { NumberStepper } from './NumberStepper';

interface WarmupConfigEditorProps {
  enabled: boolean;
  setCount: number | null;
  percentages: number[] | null;
  repsPerSet: number[] | null;
  workingLoadKg: number | null;
  weightUnit: WeightUnit;
  onChange: (patch: {
    warmupEnabled?: boolean;
    warmupSetCount?: number | null;
    warmupPercentages?: number[] | null;
    warmupRepsPerSet?: number[] | null;
  }) => void;
}

export function WarmupConfigEditor({
  enabled,
  setCount,
  percentages,
  repsPerSet,
  workingLoadKg,
  weightUnit,
  onChange,
}: WarmupConfigEditorProps) {
  const count = setCount ?? DEFAULT_WARMUP_PERCENTAGES.length;
  const pcts = percentages ?? DEFAULT_WARMUP_PERCENTAGES;
  const reps = repsPerSet ?? Array.from({ length: count }, (_, i) => defaultWarmupRepsForIndex(i));

  function setCountTo(next: number) {
    const nextPcts = Array.from({ length: next }, (_, i) => pcts[i] ?? pcts[pcts.length - 1] ?? 50);
    const nextReps = Array.from({ length: next }, (_, i) => reps[i] ?? defaultWarmupRepsForIndex(i));
    onChange({ warmupSetCount: next, warmupPercentages: nextPcts, warmupRepsPerSet: nextReps });
  }

  function setPercentage(index: number, value: number) {
    const next = pcts.slice();
    next[index] = value;
    onChange({ warmupPercentages: next });
  }

  function setReps(index: number, value: number) {
    const next = Array.from({ length: count }, (_, i) => reps[i] ?? defaultWarmupRepsForIndex(i));
    next[index] = value;
    onChange({ warmupRepsPerSet: next });
  }

  const preview =
    enabled && workingLoadKg != null
      ? calculateWarmupSets({
          workingLoadKg,
          warmupSetCount: count,
          warmupPercentages: pcts,
          warmupRepsPerSet: reps,
        })
      : [];

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange({
              warmupEnabled: e.target.checked,
              warmupSetCount: e.target.checked ? count : setCount,
              warmupPercentages: e.target.checked ? pcts : percentages,
              warmupRepsPerSet: e.target.checked ? reps : repsPerSet,
            })
          }
          className="h-4 w-4 rounded border-slate-700 bg-slate-900"
        />
        Enable warmup sets
      </label>

      {enabled && (
        <div className="mt-3 space-y-3">
          <NumberStepper
            label="Number of warmup sets"
            value={count}
            onChange={setCountTo}
            min={1}
            max={10}
          />

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {pcts.slice(0, count).map((pct, i) => (
                <div key={i} className="space-y-1">
                  <label className="block text-xs text-slate-400">Set {i + 1}</label>
                  <input
                    type="number"
                    value={pct}
                    min={0}
                    max={100}
                    onChange={(e) => setPercentage(i, Number(e.target.value))}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none"
                    title="% of working load"
                  />
                  <input
                    type="number"
                    value={reps[i] ?? defaultWarmupRepsForIndex(i)}
                    min={1}
                    max={20}
                    onChange={(e) => setReps(i, Number(e.target.value))}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none"
                    title="Reps"
                  />
                  <div className="flex justify-between px-0.5 text-xs text-slate-500">
                    <span>%</span>
                    <span>reps</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-slate-300">Preview</p>
            {workingLoadKg == null ? (
              <p className="text-xs text-slate-500">
                Set a target load to preview computed warmup weights.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-slate-400">
                {preview.map((set) => (
                  <li key={set.setIndex} className="flex justify-between">
                    <span>Warmup {set.setIndex}</span>
                    <span>
                      {formatWeight(set.prescribedLoadKg, weightUnit)} × {set.prescribedReps ?? DEFAULT_WARMUP_REPS}
                      {set.prescribedLoadKg === BAR_WEIGHT_KG && workingLoadKg > BAR_WEIGHT_KG && (
                        <span className="ml-1 text-xs text-slate-500">(bar)</span>
                      )}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between text-slate-200">
                  <span>Working</span>
                  <span>{formatWeight(workingLoadKg, weightUnit)}</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
