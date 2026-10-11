import { Navigate, Outlet } from 'react-router-dom';

import PageLoader from '@/components/common/PageLoader';
import { ROUTES } from '@/config/constants';
import { isPanelRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Gates the whole panel route tree on a panel role.
 *
 * This guard sits inside the existing authentication guard, so the caller is
 * always authenticated by the time it runs. It only decides role.
 *
 * The role comes from the boot refresh, which the authentication guard waits
 * for by showing a loader while bootstrapping. The bootstrapping check is
 * repeated here so the first routing decision is never made against a role that
 * is about to change, which is what would cause a moderator tree to flash before
 * correcting to an administrator tree.
 *
 * An authenticated ordinary user who reaches the panel is sent to the
 * user-facing application rather than to a dead "not available" page, because
 * they have a working surface there and no business in the panel.
 */
export default function AdminRouteGuard() {
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const role = useAuthStore((state) => state.role);

  if (isBootstrapping) {
    return <PageLoader label="Checking your access..." />;
  }

  if (!isPanelRole(role)) {
    return <Navigate to={ROUTES.APP} replace />;
  }

  return <Outlet />;
}
