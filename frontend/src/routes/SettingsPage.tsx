import { Link } from 'react-router-dom';
import type { WeightUnit } from '@glob/shared';
import { useAuth } from '../context/AuthContext';
import { useUpdateSettings } from '../api/settings';

export function SettingsPage() {
  const { settings } = useAuth();
  const updateSettings = useUpdateSettings();

  function handleUnitChange(unit: WeightUnit) {
    updateSettings.mutate({ weightUnit: unit });
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link to="/more" className="text-sm text-emerald-400">
          Back
        </Link>
      </div>

      <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Weight unit</p>
        <p className="text-sm text-slate-400">
          Weights are stored in kg and converted for display.
        </p>
        <div className="flex gap-2">
          {(['kg', 'lb'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => handleUnitChange(unit)}
              disabled={updateSettings.isPending}
              className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
                settings?.weightUnit === unit
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {unit.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
