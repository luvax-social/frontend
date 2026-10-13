import { Navigate, Outlet, useLocation } from 'react-router-dom';

import PageLoader from '@/components/common/PageLoader';
import SessionRestoreError from '@/components/common/SessionRestoreError';
import { landingPathForRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';

export default function GuestRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const sessionRestoreError = useAuthStore((state) => state.sessionRestoreError);
  const role = useAuthStore((state) => state.role);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isReauthRequest = new URLSearchParams(location.search).get('reauth') === '1';

  if (isBootstrapping) {
    return <PageLoader label="Preparing authentication..." />;
  }

  if (sessionRestoreError && !isReauthRequest) return <SessionRestoreError />;

  if (isAuthenticated && accessToken && !isReauthRequest) {
    // Where an already-authenticated visitor is sent is decided by role, so a
    // signed-in moderator or administrator lands in the panel rather than in the
    // user-facing application.
    return <Navigate to={landingPathForRole(role)} replace />;
  }

  return <Outlet />;
}
