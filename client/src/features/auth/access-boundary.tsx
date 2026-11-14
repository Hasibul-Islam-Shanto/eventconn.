'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentUser } from './queries';

export function AccessBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const organizerRoute = path.startsWith('/organizer');
  const customerRoute = path.startsWith('/bookings') || path === '/profile';
  const protectedRoute = organizerRoute || customerRoute;
  const allowed =
    !protectedRoute ||
    (organizerRoute
      ? currentUser.data?.role === 'ORGANIZER'
      : currentUser.data?.role === 'CUSTOMER');
  useEffect(() => {
    if (!protectedRoute || currentUser.isPending || currentUser.isError || allowed) return;
    router.replace(
      !currentUser.data
        ? `/login?next=${encodeURIComponent(path)}`
        : currentUser.data.role === 'ORGANIZER'
          ? '/organizer'
          : '/',
    );
  }, [
    allowed,
    currentUser.data,
    currentUser.isError,
    currentUser.isPending,
    path,
    protectedRoute,
    router,
  ]);
  if (!protectedRoute) return children;
  if (currentUser.isPending) return <p className="container page-space">Checking your session…</p>;
  if (currentUser.isError)
    return (
      <div className="container page-space empty-state">
        <h2>We couldn’t verify your session.</h2>
        <p>Please check the API Gateway and try again.</p>
        <button className="button" onClick={() => currentUser.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!allowed) return <p className="container page-space">Taking you to the right place…</p>;
  return children;
}
