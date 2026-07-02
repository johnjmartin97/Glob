import { Apple, Bed, Dumbbell, Monitor, MoreHorizontal } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Dashboard', icon: Monitor, iconClassName: undefined },
  { to: '/train', label: 'Train', icon: Dumbbell, iconClassName: 'rotate-45' },
  { to: '/nutrition', label: 'Nutrition', icon: Apple, iconClassName: undefined },
  { to: '/sleep', label: 'Sleep', icon: Bed, iconClassName: undefined },
  { to: '/more', label: 'More', icon: MoreHorizontal, iconClassName: undefined },
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
              <tab.icon size={22} className={tab.iconClassName} />
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
