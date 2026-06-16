import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Dashboard' },
  { to: '/train', label: 'Train' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/sleep', label: 'Sleep' },
  { to: '/more', label: 'More' },
];

export function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-900 pb-safe-bottom">
      <ul className="flex">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-xs ${
                  isActive ? 'text-emerald-400' : 'text-slate-400'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
