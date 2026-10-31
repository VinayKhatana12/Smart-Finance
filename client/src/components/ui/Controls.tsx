import { cn } from '../../lib/cn';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/** "1–20 of 128" with prev/next; the range, not ornament. */
export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 pt-3 text-sm text-muted">
      <span className="tnum">
        {total === 0 ? '0 of 0' : `${start}–${end} of ${new Intl.NumberFormat().format(total)}`}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-[8px] border border-control bg-surface px-3 py-1.5 text-ink transition-colors hover:border-muted disabled:opacity-50"
        >
          Previous
        </button>
        <span className="tnum self-center px-1">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="rounded-[8px] border border-control bg-surface px-3 py-1.5 text-ink transition-colors hover:border-muted disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** A segmented track as wide as its options; the active pill carries the ink. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex h-9 items-center gap-1 rounded-[10px] bg-active p-1', className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'h-7 rounded-[7px] px-3 text-sm font-medium transition-colors',
            value === option.id ? 'bg-surface text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
