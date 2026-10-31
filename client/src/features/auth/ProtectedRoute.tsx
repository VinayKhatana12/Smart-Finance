import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from './hooks';
import { Skeleton } from '../../components/ui/States';

/** Loading keeps the final layout with flat grey bars at the real sizes. */
function AuthSkeleton() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      <Skeleton className="h-6 w-40" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[306px_1fr]">
        <Skeleton className="h-64 rounded-[20px]" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 rounded-[20px]" />
          <Skeleton className="h-48 rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { data, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return <AuthSkeleton />;
  }
  if (!data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
