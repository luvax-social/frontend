import { Outlet } from 'react-router-dom';

import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';

import { NotAvailable } from '../components/NotAvailable';

/**
 * Gates an administrator-only branch of the panel. A moderator that types an
 * administrator route into the address bar reaches a full-page "not available"
 * rather than the screen: the screen behind this guard never mounts, so it
 * cannot render and then fire a 403, and it never shows an empty table.
 */
export default function AdminOnlyRoute() {
  const role = useAuthStore((state) => state.role);

  if (!isAdminRole(role)) {
    return <NotAvailable message="this area is available to administrators only." />;
  }

  return <Outlet />;
}
