import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'glob:install-hint-dismissed';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
}

export function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIos() && !isStandalone() && !localStorage.getItem(DISMISSED_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-10 mx-3 rounded-md border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p>
          Install Glob: tap the Share icon, then "Add to Home Screen" for a full-screen app
          experience.
        </p>
        <button onClick={dismiss} className="text-slate-400" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
