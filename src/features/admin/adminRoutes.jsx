import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/config/constants';

import AdminRouteGuard from './guards/AdminRouteGuard';
import AdminOnlyRoute from './guards/AdminOnlyRoute';
import { NotAvailable } from './components/NotAvailable';
import { SupportTicketQueueScreen } from './screens/SupportTicketQueueScreen';

/**
 * The panel route subtree, registered in the central router.
 *
 * The whole panel is lazily loaded so the user-facing application does not carry
 * its weight. The tree is a role guard wrapping the shell, and the shell frames
 * every screen. Administrator-only screens sit behind a second guard, so adding
 * a later section is one more child here and its screen, with no restructuring.
 *
 * Child paths are the relative segment of their ROUTES constant, so the path
 * strings still have a single source in the central constants file.
 */
const AdminShell = lazy(() => import('./components/AdminShell'));
const ReportQueueScreen = lazy(() =>
  import('./screens/ReportQueueScreen').then((m) => ({ default: m.ReportQueueScreen }))
);
const EscalatedQueueScreen = lazy(() =>
  import('./screens/EscalatedQueueScreen').then((m) => ({ default: m.EscalatedQueueScreen }))
);
const ReportDetailScreen = lazy(() =>
  import('./screens/ReportDetailScreen').then((m) => ({ default: m.ReportDetailScreen }))
);
const MyEscalationsScreen = lazy(() =>
  import('./screens/MyEscalationsScreen').then((m) => ({ default: m.MyEscalationsScreen }))
);
const AuditLogScreen = lazy(() =>
  import('./screens/AuditLogScreen').then((m) => ({ default: m.AuditLogScreen }))
);
const AccountModerationScreen = lazy(() =>
  import('./screens/AccountModerationScreen').then((m) => ({ default: m.AccountModerationScreen }))
);
const AccountListScreen = lazy(() =>
  import('./screens/AccountListScreen').then((m) => ({ default: m.AccountListScreen }))
);
const HashtagRegistryScreen = lazy(() =>
  import('./screens/HashtagRegistryScreen').then((m) => ({ default: m.HashtagRegistryScreen }))
);
const StatisticsScreen = lazy(() =>
  import('./screens/StatisticsScreen').then((m) => ({ default: m.StatisticsScreen }))
);
const ActivityLogScreen = lazy(() =>
  import('./screens/ActivityLogScreen').then((m) => ({ default: m.ActivityLogScreen }))
);

const rel = (fullPath) => fullPath.slice(ROUTES.ADMIN.length + 1);

export const adminRoute = {
  path: ROUTES.ADMIN,
  element: <AdminRouteGuard />,
  children: [
    {
      element: <AdminShell />,
      children: [
        { index: true, element: <Navigate to={ROUTES.ADMIN_REPORTS} replace /> },
        { path: rel(ROUTES.ADMIN_REPORTS), element: <ReportQueueScreen /> },
        { path: rel(ROUTES.ADMIN_REPORT_DETAIL), element: <ReportDetailScreen /> },
        // The action log and the account moderation view are reachable by both
        // roles: a moderator sees its own actions and may view an account's
        // violations, content, and issue a warning, so neither sits behind the
        // administrator-only guard.
        { path: rel(ROUTES.ADMIN_ACTIONS), element: <AuditLogScreen /> },
        { path: rel(ROUTES.ADMIN_SUPPORT), element: <SupportTicketQueueScreen /> },
        // Both roles: the endpoint scopes by caller, not by role, so an
        // administrator reaches its own escalations here too.
        { path: rel(ROUTES.ADMIN_MY_ESCALATIONS), element: <MyEscalationsScreen /> },
        { path: rel(ROUTES.ADMIN_USER), element: <AccountModerationScreen /> },
        // Administrator-only: the account list and search and the hashtag
        // registry sit behind the second guard because the backend answers the
        // whole account surface and the hashtag admin surface with 403 for a
        // moderator, so the screens never mount to fire one.
        {
          element: <AdminOnlyRoute />,
          children: [
            { path: rel(ROUTES.ADMIN_ESCALATED), element: <EscalatedQueueScreen /> },
            { path: rel(ROUTES.ADMIN_USERS), element: <AccountListScreen /> },
            { path: rel(ROUTES.ADMIN_HASHTAGS), element: <HashtagRegistryScreen /> },
            { path: rel(ROUTES.ADMIN_STATISTICS), element: <StatisticsScreen /> },
            { path: rel(ROUTES.ADMIN_ACTIVITY), element: <ActivityLogScreen /> },
          ],
        },
        {
          path: '*',
          element: <NotAvailable title="not found" message="this panel page does not exist." />,
        },
      ],
    },
  ],
};
