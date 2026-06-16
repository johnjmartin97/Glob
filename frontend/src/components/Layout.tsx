import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import { InstallHint } from './InstallHint';

export function Layout() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <InstallHint />
      <TabBar />
    </div>
  );
}
