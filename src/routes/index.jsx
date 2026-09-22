import {
  Navigate,
  Outlet,
  ScrollRestoration,
  createBrowserRouter,
  useLocation,
  useParams,
} from 'react-router-dom';

import { Suspense, lazy } from 'react';

import AuthSessionBootstrap from '@/components/common/AuthSessionBootstrap';
import GuestRoute from '@/components/common/GuestRoute';
import NotFoundPage from '@/components/common/NotFoundPage';
import PageLoader from '@/components/common/PageLoader';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import RouterErrorPage from '@/components/common/RouterErrorPage';
import { ROUTES, routeTo } from '@/config/constants';
import EmailVerificationPage from '@/pages/auth/EmailVerificationPage';
import VerifyEmailNoticePage from '@/pages/auth/VerifyEmailNoticePage';
import AuthPage from '@/features/auth/components/AuthPage';
import OAuthCallbackPage from '@/pages/auth/OAuthCallbackPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import { adminRoute } from '@/features/admin';
import { APP_NOT_FOUND_SCREEN, APP_OVERLAY_SCREENS, APP_SCREENS } from './appScreens';

// The authenticated shell and everything under it load on demand. An anonymous visitor on the
// sign-in page has no use for either, and the shell was the largest single contributor to the
// entry chunk.
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const LuvaxPage = lazy(() => import('@/pages/LuvaxPage'));
// The five anonymous support screens. Deferred like every other route, and
// deliberately outside ProtectedRoute: the accounts that reach them hold no
// session and cannot be issued one.
const AppealLandingScreen = lazy(() =>
  import('@/features/support/components/AppealLandingScreen').then((m) => ({
    default: m.AppealLandingScreen,
  }))
);
const ConfirmLandingScreen = lazy(() =>
  import('@/features/support/components/ConfirmLandingScreen').then((m) => ({
    default: m.ConfirmLandingScreen,
  }))
);
const PublicSupportFormScreen = lazy(() =>
  import('@/features/support/components/PublicSupportFormScreen').then((m) => ({
    default: m.PublicSupportFormScreen,
  }))
);
const AppealStatusScreen = lazy(() =>
  import('@/features/support/components/AppealStatusScreen').then((m) => ({
    default: m.AppealStatusScreen,
  }))
);
const AppealResendScreen = lazy(() =>
  import('@/features/support/components/AppealResendScreen').then((m) => ({
    default: m.AppealResendScreen,
  }))
);

function RootLayout() {
  return (
    <>
      <AuthSessionBootstrap />
      {/* Sends every navigation to the top of the page and returns the browser
          to its previous offset on back, replacing the manual scroll reset the
          screen switch used to perform.

          getKey opts overlay addresses (post detail, story) out of that default: their own
          location carries the screen underneath in `state.background`, and keying the
          restoration entry by that background path - rather than by the overlay's own path -
          tells React Router this is the same page as before, not a new one to reset to the top.
          Without it, opening an overlay was indistinguishable from a real navigation and reset
          the page behind the overlay to (0, 0) on every open.

          The fallback is the plain pathname rather than the default `location.key`: the save (on
          the background page, before the overlay opens) and the restore (on the overlay's own
          location, once it has) must resolve to the identical key, and `state.background` only
          ever holds a pathname - keying the background's own visit by its `.key` instead would
          save under one string and restore under another, and never match. */}
      <ScrollRestoration getKey={(location) => location.state?.background || location.pathname} />

      {/* Screens under the authenticated shell are code-split, so a first visit to one suspends
          while its chunk downloads. One boundary here covers every route rather than each screen
          having to remember its own. */}
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={`/${location.search}`} state={location.state} replace />;
}

function HashtagDeepLinkRedirect() {
  const { name } = useParams();
  return <Navigate to={routeTo.hashtag(name)} replace />;
}

// Each screen carries its identity on the route rather than in component state.
// The layout reads it back through useMatches to pick the chrome, so adding a
// screen means adding one row to APP_SCREENS and nothing else.
const toRouteObject = ({ screen, index, path, element, chrome, rightRail }) => ({
  ...(index ? { index: true } : { path }),
  element,
  handle: { screen, chrome, rightRail },
});

const toOverlayRouteObject = ({ screen, path, element }) => ({
  path,
  element,
  handle: { screen, chrome: 'overlay' },
});

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouterErrorPage />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          {
            path: ROUTES.HOME,
            element: <AuthPage />,
          },
        ],
      },
      {
        path: ROUTES.VERIFY_EMAIL,
        element: <EmailVerificationPage />,
      },
      {
        path: ROUTES.VERIFY_EMAIL_NOTICE,
        element: <VerifyEmailNoticePage />,
      },
      {
        path: ROUTES.LOGIN,
        element: <LoginRedirect />,
      },
      {
        path: ROUTES.REGISTER,
        element: <Navigate to={`${ROUTES.HOME}?view=register`} replace />,
      },
      {
        path: ROUTES.FORGOT_PASSWORD,
        element: <Navigate to={`${ROUTES.HOME}?view=forgot`} replace />,
      },
      {
        path: ROUTES.RESET_PASSWORD,
        element: <ResetPasswordPage />,
      },
      {
        // Reached from the signed link in a moderation notice. No guard: the
        // account it is submitted for is banned or suspended and therefore
        // cannot authenticate at all. Redeeming the link mints no session.
        path: ROUTES.SUPPORT_APPEAL,
        element: <AppealLandingScreen />,
      },
      {
        path: ROUTES.SUPPORT_CONFIRM,
        element: <ConfirmLandingScreen />,
      },
      {
        path: ROUTES.SUPPORT_PUBLIC,
        element: <PublicSupportFormScreen />,
      },
      {
        // Where the status link from a filed appeal lands. No guard, for the
        // same reason the appeal itself has none: the appellant holds no
        // session, and the token they hold reads one ticket and nothing else.
        path: ROUTES.SUPPORT_APPEAL_STATUS,
        element: <AppealStatusScreen />,
      },
      {
        // Reached from the sign-in failure copy and from a dead appeal or
        // status link. Anonymous by necessity: the account asking is the one
        // that cannot sign in.
        path: ROUTES.SUPPORT_APPEAL_RESEND,
        element: <AppealResendScreen />,
      },
      {
        path: ROUTES.OAUTH_CALLBACK,
        element: <OAuthCallbackPage />,
      },
      {
        // Shareable top-level form of the hashtag address. The page itself lives inside /app,
        // where the shell and navigation exist, so a pasted /tags/... link lands on the real
        // screen instead of a page with no way out of it.
        path: ROUTES.HASHTAG_DEEP_LINK,
        element: <HashtagDeepLinkRedirect />,
      },
      {
        // One guard for the whole authenticated area, and one shell rendered
        // around every screen in it.
        element: <ProtectedRoute />,
        children: [
          {
            path: ROUTES.APP,
            element: <LuvaxPage />,
            children: [
              ...APP_SCREENS.map(toRouteObject),
              ...APP_OVERLAY_SCREENS.map(toOverlayRouteObject),
              {
                path: '*',
                element: APP_NOT_FOUND_SCREEN.element,
                handle: {
                  screen: APP_NOT_FOUND_SCREEN.screen,
                  chrome: APP_NOT_FOUND_SCREEN.chrome,
                },
              },
            ],
          },
          {
            path: ROUTES.DASHBOARD,
            element: <DashboardPage />,
          },
          // The administrative and moderation panel. A separate route tree under
          // /admin, gated on role inside the shared authentication guard.
          adminRoute,
        ],
      },
    ],
  },
  {
    path: ROUTES.NOT_FOUND,
    element: <NotFoundPage />,
  },
]);

export default router;
