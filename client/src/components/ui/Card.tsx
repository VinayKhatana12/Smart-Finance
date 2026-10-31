import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Flat surface: one tone step from the ground, a 1px edge, nothing elevated. */
export function Card({ className, children, ...props }: CardProps) {
  return (
    <section className={cn('rounded-[20px] border border-line bg-surface p-5', className)} {...props}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  caption?: string;
  action?: ReactNode;
}

export function CardHeader({ title, caption, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {caption ? <span className="text-[13px] text-muted">{caption}</span> : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}
