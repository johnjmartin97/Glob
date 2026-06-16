interface NumberStepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberStepper({ label, value, onChange, min, max, step = 1 }: NumberStepperProps) {
  function clamp(next: number) {
    let result = next;
    if (min != null) result = Math.max(min, result);
    if (max != null) result = Math.min(max, result);
    return result;
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm text-slate-300">{label}</label>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-lg text-slate-200"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-center text-base focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-lg text-slate-200"
        >
          +
        </button>
      </div>
    </div>
  );
}
