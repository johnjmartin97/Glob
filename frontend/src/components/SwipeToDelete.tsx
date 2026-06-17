import { useEffect, useRef, useState } from 'react';

const DELETE_WIDTH = 72;
const SNAP_THRESHOLD = DELETE_WIDTH * 0.4;

interface SwipeToDeleteProps {
  onDelete: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function SwipeToDelete({ onDelete, deleteLabel = 'Delete', children, className, disabled }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startOffset = useRef(0);
  const directionLocked = useRef<'h' | 'v' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (directionLocked.current === 'h') e.preventDefault();
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  if (disabled) return <>{children}</>;

  function onTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startOffset.current = offset;
    directionLocked.current = null;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    if (directionLocked.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      directionLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }

    if (directionLocked.current !== 'h') return;

    const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffset.current + dx));
    setOffset(next);
  }

  function onTouchEnd() {
    setDragging(false);
    startX.current = null;
    startY.current = null;
    setOffset(prev => prev < -SNAP_THRESHOLD ? -DELETE_WIDTH : 0);
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ''}`}>
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600"
        style={{ width: DELETE_WIDTH }}
      >
        <button
          type="button"
          onClick={onDelete}
          className="h-full w-full text-sm font-medium text-white"
        >
          {deleteLabel}
        </button>
      </div>

      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
