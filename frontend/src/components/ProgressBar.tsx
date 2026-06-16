interface ProgressBarProps {
  label: string;
  value: number;
  target: number | null;
  unit?: string;
}

export function ProgressBar({ label, value, target, unit = 'g' }: ProgressBarProps) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">
          {Math.round(value)}
          {unit} {target ? `/ ${target}${unit}` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: target ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  );
}
