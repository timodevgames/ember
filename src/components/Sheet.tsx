import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Centered dialog instead of a bottom sheet. */
  center?: boolean;
}

export default function Sheet({ open, onClose, title, children, center = false }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-50 flex ${center ? 'items-center p-5' : 'items-end'} justify-center bg-black/60 animate-fade-in`} onClick={onClose}>
      <div
        className={`w-full max-w-md bg-night-900 border border-night-700 animate-rise-in ${center ? 'rounded-3xl' : 'rounded-t-3xl pb-safe'} max-h-[88dvh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="p-5">
          {title && <h2 className="text-lg font-bold mb-3">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
}
