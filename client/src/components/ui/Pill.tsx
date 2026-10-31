import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'positive' | 'negative' | 'warning' | 'neutral' | 'accent';

const toneClasses: Record<Tone, string> = {
  positive: 'bg-[#dcfae5] text-[#04250e]',
  negative: 'bg-[#ffedea] text-[#831c1e]',
  warning: 'bg-[#fffbeb] text-[#92400e]',
  neutral: 'bg-[#eef1f4] text-[#3a3d40]',
  accent: 'bg-accent-soft text-accent-ink',
};

/** Pale tint with dark text of the same hue; never above a heading. */
export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
