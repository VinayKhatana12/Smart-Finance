import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '../../features/auth/hooks';
import { cn } from '../../lib/cn';
import { LogoMark } from '../Logo';
import {
  BellIcon,
  BudgetsIcon,
  DashboardIcon,
  GoalsIcon,
  ReportsIcon,
  SettingsIcon,
  TransactionsIcon,
  WalletIcon,
} from '../icons';
import { useUnreadCount } from '../../features/notifications/hooks';
import { usePwa } from '../../lib/pwa';
import { useToast } from '../ui/Toaster';

interface Destination {
  to: string;
  label: string;
  icon: typeof DashboardIcon;
}

const DESTINATIONS: Destination[] = [
  { to: '/dashboard', label: 'Overview', icon: DashboardIcon },
  { to: '/transactions', label: 'Money', icon: TransactionsIcon },
  { to: '/accounts', label: 'Accounts', icon: WalletIcon },
  { to: '/budgets', label: 'Budgets', icon: BudgetsIcon },
  { to: '/goals', label: 'Goals', icon: GoalsIcon },
  { to: '/reports', label: 'Reports', icon: ReportsIcon },
  { to: '/notifications', label: 'Alerts', icon: BellIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function RailLink({ destination, compact }: { destination: Destination; compact: boolean }) {
  const { icon: DestinationIcon, to, label } = destination;
  if (compact) {
    return (
      <NavLink
        to={to}
        aria-label={label}
        title={label}
        className={({ isActive }) =>
          cn(
            'flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors',
            isActive ? 'bg-active text-ink' : 'text-muted hover:bg-active/60 hover:text-ink',
          )
        }
      >
        <DestinationIcon />
      </NavLink>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 rounded-[8px] px-1 py-1.5 text-[11px] leading-tight',
          isActive ? 'text-accent-ink font-semibold' : 'text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <DestinationIcon width={20} height={20} className={isActive ? 'text-accent-ink' : undefined} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * The dealt shell: an unlabelled icon rail on the page ground (desktop),
 * a labelled bottom bar (phone). Motion is feedback only — no entrance performances.
 */
export function AppLayout() {
  const { data } = useMe();
  const { online, syncStatus, pendingCount, syncNow } = usePwa();
  const unread = useUnreadCount();
  const logout = useLogout();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSignOut = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        showToast('Signed out.', 'info');
        navigate('/');
      },
      onError: () => showToast('Could not sign out. Please try again.', 'error'),
    });
  };

  return (
    <div className="min-h-screen">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col items-center border-r border-line bg-ground py-3 md:flex">
        <NavLink to="/dashboard" aria-label="Smart Finance home" className="mb-4 flex h-9 w-9 items-center justify-center">
          <LogoMark size={30} />
        </NavLink>
        <nav aria-label="Main" className="flex flex-1 flex-col items-center gap-1">
          {DESTINATIONS.slice(0, 7).map((destination) => (
            <span key={destination.to} className="relative">
              <RailLink destination={destination} compact />
              {destination.to === '/notifications' && (unread.data || 0) > 0 ? (
                <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-negative" />
              ) : null}
            </span>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-3 border-t border-rule pt-3">
          <RailLink destination={DESTINATIONS[7]!} compact />
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-active/60 hover:text-ink"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
              {(data?.user.name ?? '').trim().charAt(0).toUpperCase() || '·'}
            </span>
          </button>
        </div>
      </aside>

      {/* Offline / sync banner: sits above everything, never blocks interaction */}
      {!online ? (
        <div
          role="status"
          className="sticky top-0 z-50 border-b border-[#fde68a] bg-[#fffbeb] px-4 py-2 text-center text-[13px] text-[#92400e] md:pl-[72px]"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          You're offline — changes are saved on this device and will sync when you reconnect.
        </div>
      ) : pendingCount > 0 ? (
        <div
          role="status"
          className="sticky top-0 z-50 border-b border-line bg-raised px-4 py-2 text-center text-[13px] text-ink md:pl-[72px]"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          {pendingCount} transaction{pendingCount === 1 ? '' : 's'} pending sync
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncStatus === 'syncing'}
            className="ml-3 font-medium text-accent-ink hover:underline disabled:opacity-50"
          >
            {syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      ) : null}

      {/* Phone top bar */}
      <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-line bg-ground px-4 md:hidden">
        <LogoMark size={24} />
        <span className="text-[15px] font-semibold text-ink">Smart Finance</span>
        <span className="ml-auto flex items-center gap-3 text-[13px] font-medium text-muted">
          <NavLink to="/reports" className={({ isActive }) => (isActive ? 'text-accent-ink' : 'hover:text-ink')}>
            Reports
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'text-accent-ink' : 'hover:text-ink')}>
            Alerts
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'text-accent-ink' : 'hover:text-ink')}>
            Settings
          </NavLink>
          <button type="button" onClick={handleSignOut} className="hover:text-ink">
            Sign out
          </button>
        </span>
      </header>

      <main className="pb-20 md:pb-0 md:pl-14">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-6 md:px-8">
          <Outlet />
        </div>
      </main>

      {/* Phone bottom bar: the five highest-traffic destinations */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface md:hidden" 
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {DESTINATIONS.slice(0, 5).map((destination) => (
          <RailLink key={destination.to} destination={destination} compact={false} />
        ))}
      </nav>
    </div>
  );
}
