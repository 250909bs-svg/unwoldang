import { useEffect, useRef, type ReactNode } from 'react';

export default function GuiyeondoSheet({ open, label, onClose, children }: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    window.setTimeout(() => {
      const target = panel?.querySelector<HTMLElement>('input:not(:disabled)')
        || panel?.querySelector<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]');
      target?.focus();
    }, 30);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="gy-sheet-layer" role="presentation">
      <button type="button" className="gy-sheet-backdrop" onClick={onClose} aria-label="창 닫기" />
      <div ref={panelRef} className="gy-sheet" role="dialog" aria-modal="true" aria-label={label}>
        <span className="gy-sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
