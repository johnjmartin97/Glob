import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/supplements', label: 'Supplements' },
  { to: '/exercises', label: 'Exercise library' },
  { to: '/templates', label: 'Workout templates' },
  { to: '/nutrition/foods', label: 'Food library' },
  { to: '/nutrition/targets', label: 'Nutrition targets' },
  { to: '/history', label: 'Training history' },
  { to: '/settings', label: 'Settings' },
];

export function MorePage() {
  const { logout } = useAuth();

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">More</h1>

      <ul className="space-y-2">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="block rounded-md border border-slate-800 bg-slate-900 px-3 py-3 text-slate-200"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <button
        onClick={() => logout()}
        className="w-full rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300"
      >
        Log out
      </button>
    </div>
  );
}
