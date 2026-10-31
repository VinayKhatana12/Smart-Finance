import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const variantClasses: Record<Variant, string> = {
  // One filled primary per screen, near-black; the accent appears on at most one control.
  primary: 'bg-ink text-white hover:bg-[#33373b] active:bg-ink',
  accent: 'bg-accent text-white hover:bg-[#1a55bd] active:bg-accent',
  secondary: 'bg-surface text-ink border border-control hover:border-muted',
  ghost: 'bg-transparent text-ink hover:bg-active',
  danger: 'bg-transparent text-negative border border-control hover:border-negative',
};

const sizeClasses: Record<Size, string> = {
  md: 'h-10 px-4 text-[15px]',
  sm: 'h-8 px-3 text-sm',
};

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium select-none ' +
  'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)} {...props}>
      {children}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function LinkButton({ variant = 'primary', size = 'md', className, children, ...props }: LinkButtonProps) {
  return (
    <a className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)} {...props}>
      {children}
    </a>
  );
}
