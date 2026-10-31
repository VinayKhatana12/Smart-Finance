import type { SVGProps } from 'react';

/**
 * One outline icon set for the whole app: 18px on a 1.5px stroke, currentColor,
 * decorative by default (callers supply accessible names on their controls).
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="7" height="9" rx="1.5" />
      <rect x="13" y="4" width="7" height="5" rx="1.5" />
      <rect x="13" y="11" width="7" height="9" rx="1.5" />
      <rect x="4" y="15" width="7" height="5" rx="1.5" />
    </Icon>
  );
}

export function TransactionsIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 19-3-3 3-3" />
    </Icon>
  );
}

export function BudgetsIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" />
      <path d="M3.5 10.5h17" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function GoalsIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ReportsIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4.5 4.5v15h15" />
      <path d="M9 15.5v-4" />
      <path d="M13 15.5V8.5" />
      <path d="M17 15.5v-6" />
    </Icon>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 7.5h9" />
      <circle cx="16.5" cy="7.5" r="2" />
      <path d="M20 7.5h-1.5" />
      <path d="M20 16.5h-9" />
      <circle cx="7.5" cy="16.5" r="2" />
      <path d="M4 16.5h1.5" />
    </Icon>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </Icon>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Icon>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function AlertIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

export function SignOutIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M14 4.5H7A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h7" />
      <path d="M10.5 12h9" />
      <path d="m16.5 9 3 3-3 3" />
    </Icon>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 4.5a5.5 5.5 0 0 1 5.5 5.5c0 3.5 1.5 5 1.5 5h-14s1.5-1.5 1.5-5A5.5 5.5 0 0 1 12 4.5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function WalletIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h11A1.5 1.5 0 0 1 18 7.5V9" />
      <rect x="4" y="9" width="16" height="9.5" rx="1.5" />
      <circle cx="16" cy="13.75" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15" />
      <path d="m14.5 7 5 5-5 5" />
    </Icon>
  );
}
