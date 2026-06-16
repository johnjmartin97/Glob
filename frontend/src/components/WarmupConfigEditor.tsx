import {
  calculateWarmupSets,
  DEFAULT_WARMUP_PERCENTAGES,
  DEFAULT_WARMUP_REPS,
  formatWeight,
} from '@glob/shared';
import { NumberStepper } from './NumberStepper';
import { useWeightUnit } from '../hooks/useWeightUnit';

interface WarmupConfigEditorProps {
  enabled: boolean;
  setCount: number | null;
  percentages: number[] | null;
  workingLoadKg: number | null;
  onChange: (patch: {
    warmupEnabled?: boolean;
    warmupSetCount?: number | null;
    warmupPercentages?: number[] | null;
  }) => void;
}

export function WarmupConfigEditor({
  enabled,
  setCount,
  percentages,
  workingLoadKg,
  onChange,
}: WarmupConfigEditorProps) {
  const unit = useWeightUnit();
  const count = setCount ?? DEFAULT_WARMUP_PERCENTAGES.length;
  const pcts = percentages ?? DEFAULT_WARMUP_PERCENTAGES;

  function setCountTo(next: number) {
    const nextPcts = Array.from({ length: next }, (_, i) => pcts[i] ?? pcts[pcts.length - 1] ?? 50);
    onChange({ warmupSetCount: next, warmupPercentages: nextPcts });
  }

  function setPercentage(index: number, value: number) {
    const next = pcts.slice();
    next[index] = value;
    onChange({ warmupPercentages: next });
  }

  const preview =
    enabled && workingLoadKg != null
      ? calculateWarmupSets({
          workingLoadKg,
          warmupSetCount: count,
          warmupPercentages: pcts,
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
            <p className="text-sm text-slate-300">Warmup set % of working load</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {pcts.slice(0, count).map((pct, i) => (
                <div key={i}>
                  <label className="mb-1 block text-xs text-slate-400">Set {i + 1}</label>
                  <input
                    type="number"
                    value={pct}
                    min={0}
                    max={100}
                    onChange={(e) => setPercentage(i, Number(e.target.value))}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm focus:border-emerald-500 focus:outline-none"
                  />
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
                      {formatWeight(set.prescribedLoadKg, unit)} × {set.prescribedReps ?? DEFAULT_WARMUP_REPS}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between text-slate-200">
                  <span>Working</span>
                  <span>{formatWeight(workingLoadKg, unit)}</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
