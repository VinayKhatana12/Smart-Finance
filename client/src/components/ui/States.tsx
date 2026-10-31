import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Flat grey bar at the real size of the value it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-[8px] bg-[#e9edf2]', className)} aria-hidden="true" />;
}

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  className?: string;
}

/** An empty section keeps its frame: one dashed box, one sentence, optional action. */
export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-control px-4 py-8 text-center',
        className,
      )}
    >
      <p className="max-w-[44ch] text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** An error lives inside the block that failed, with a retry and no full-screen banner. */
export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-[8px] border border-dashed border-control px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="alert"
    >
      <p className="text-sm text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[8px] px-2 py-1 text-sm font-medium text-accent-ink hover:bg-accent-soft"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
