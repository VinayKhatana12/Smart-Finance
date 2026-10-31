import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { CloseIcon } from '../icons';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

/**
 * The one allowed overlay: opaque surface, a real shadow, Escape and backdrop
 * close, focus moved inside on open and restored on close.
 */
export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative max-h-[92svh] w-full overflow-y-auto rounded-t-[20px] border border-line bg-surface p-5',
          'shadow-[0_12px_28px_rgba(0,0,0,0.18)] sm:rounded-[20px]',
          wide ? 'sm:max-w-[560px]' : 'sm:max-w-[440px]',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-active hover:text-ink"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  children?: ReactNode;
}

/** Names the object before it is destroyed; the destructive action is the odd one out. */
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Delete', busy, children }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[15px] leading-relaxed text-ink">{body}</p>
      {children}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
