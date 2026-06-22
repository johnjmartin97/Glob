import { Logo } from './Logo';

export function Header() {
  return (
    <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2">
      <Logo className="h-10 w-10" />
      <span className="font-semibold text-slate-100">Glob</span>
    </header>
  );
}
