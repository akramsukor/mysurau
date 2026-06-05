import { useEffect, useState } from 'react';

const DETENT_HEIGHT = {
  compact: '280px',
  medium:  '50vh',
  large:   '90vh',
};

/**
 * Bottom sheet with fade backdrop and slide-up animation.
 *
 * Dismiss: backdrop click (v1 — drag-to-dismiss is a follow-up).
 * Scroll lock: applied to document.body while open.
 */
export default function BottomSheet({
  open,
  onClose,
  detent = 'medium',
  hideHandle = false,
  children,
}) {
  const [mounted, setMounted] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next frame so the initial translateY(100%) renders before we animate in
      const raf = requestAnimationFrame(() => setAnimIn(true));
      document.body.style.overflow = 'hidden';
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimIn(false);
      // Wait for slide-out before unmounting
      const t = setTimeout(() => setMounted(false), 350);
      document.body.style.overflow = '';
      return () => clearTimeout(t);
    }
  }, [open]);

  // Restore scroll on unmount
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  if (!mounted) return null;

  return (
    <div
      className={`bs-backdrop${animIn ? ' bs-backdrop--in' : ''}`}
      onClick={onClose}
    >
      <div
        className={`bs-sheet${animIn ? ' bs-sheet--in' : ''}`}
        style={{ height: DETENT_HEIGHT[detent] }}
        onClick={e => e.stopPropagation()}
      >
        {!hideHandle && (
          <div className="bs-handle-row">
            <div className="bs-handle" />
          </div>
        )}
        <div className="bs-content">{children}</div>
      </div>
    </div>
  );
}
