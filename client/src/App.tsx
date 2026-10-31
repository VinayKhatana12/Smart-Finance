import { createBrowserRouter, Link } from 'react-router-dom';
import { LandingPage } from './landing/LandingPage';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { BudgetsPage } from './features/planning/BudgetsPage';
import { GoalsPage } from './features/planning/GoalsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ground px-5 text-center">
      <p className="text-2xl font-semibold text-ink">That page does not exist.</p>
      <Link to="/" className="text-[15px] font-medium text-accent-ink hover:underline">
        Back to the start
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot', element: <ForgotPasswordPage /> },
  { path: '/reset', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/transactions', element: <TransactionsPage /> },
          { path: '/accounts', element: <AccountsPage /> },
          { path: '/budgets', element: <BudgetsPage /> },
          { path: '/goals', element: <GoalsPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
