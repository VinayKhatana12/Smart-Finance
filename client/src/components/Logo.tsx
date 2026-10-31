import { cn } from '../lib/cn';

/**
 * The product's mark, drawn for Smart Finance: a rounded cobalt square with a
 * rising three-step spend line ending in a coin dot.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="var(--color-accent)" />
      <path
        d="M8 21.5 12.5 17l3.5 3 7.5-8"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.5" cy="12" r="2.2" fill="#ffffff" />
    </svg>
  );
}
