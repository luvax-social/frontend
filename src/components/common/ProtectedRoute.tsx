import { Navigate, Outlet, useLocation } from 'react-router-dom';

import PageLoader from '@/components/common/PageLoader';
import { ROUTES } from '@/config/constants';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * ProtectedRoute
 *
 * Guards any child routes from unauthenticated access.
 *
 * Security notes:
 * 1. `location.state.from` carries only `pathname` — never `search` or `hash`.
 *    Passing the full location object would persist ?token= and similar
 *    sensitive query params into navigation state, where they survive
 *    history traversal.
 *
 * 2. `isAuthenticated` (persisted flag) is not trusted alone. We additionally
 *    require a live `accessToken` in memory. After Sprint 1, `isAuthenticated`
 *    is persisted to localStorage but `accessToken` is NOT. On a cold page
 *    load the persist middleware rehydrates `isAuthenticated: true` but
 *    `accessToken` stays null until AuthSessionBootstrap completes a token
 *    refresh. Checking both prevents the guard from passing a stale
 *    isAuthenticated flag before the bootstrap finishes.
 */
export default function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  if (isBootstrapping) {
    return <PageLoader label="Checking your session..." />;
  }

  // Require both the persisted flag AND a live in-memory access token.
  // This closes the window between persist rehydration and AuthSessionBootstrap
  // completing its refresh — during that window isAuthenticated may be true
  // while accessToken is still null.
  const isLiveSession = isAuthenticated && Boolean(accessToken);

  if (!isLiveSession) {
    // Pass only the pathname — never search or hash — so no tokens leak
    // into router state that survives browser history traversal.
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: { pathname: location.pathname } }} />;
  }

  return <Outlet />;
}
