import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { AlertIcon, CheckIcon } from '../icons';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

const toneIcon: Record<Tone, ReactNode> = {
  success: <CheckIcon className="shrink-0 text-positive" width={16} height={16} />,
  error: <AlertIcon className="shrink-0 text-negative" width={16} height={16} />,
  info: null,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2',
              'text-sm text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]', // a toast floats: its one allowed shadow
              toast.tone === 'error' && 'border-[#f0c9c6]',
            )}
          >
            {toneIcon[toast.tone]}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
