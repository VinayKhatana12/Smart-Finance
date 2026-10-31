import { cn } from '../../lib/cn';

interface ProgressBarProps {
  /** True ratio 0..1 (values above 1 render as a full track in the negative colour). */
  ratio: number;
  tone?: 'ink' | 'positive' | 'warning' | 'negative';
  className?: string;
}

/** 6px track, fully rounded, the fill the true ratio; quiet while a limit holds. */
export function ProgressBar({ ratio, tone = 'ink', className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = {
    ink: 'bg-ink/70',
    positive: 'bg-positive',
    warning: 'bg-[#d97706]',
    negative: 'bg-negative',
  }[tone];
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-rule', className)} role="presentation">
      {clamped > 0 ? <div className={cn('h-1.5 rounded-full', fill)} style={{ width: `${clamped * 100}%` }} /> : null}
    </div>
  );
}
