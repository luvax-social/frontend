import { useEffect, useRef } from 'react';

import { authApi } from '@/api/authApi';
import { clearLegacyAuthStorage, useAuthStore } from '@/store/useAuthStore';

// Paths that establish a session themselves and must not be bootstrapped alongside.
// The OAuth callback exchanges its own short-lived code and calls setAuth with the
// result, so a refresh running beside it would either consume the refresh cookie
// concurrently with that exchange or, on the 401 a first-time Google sign-in
// returns, clear the session the exchange had just established.
const SELF_AUTHENTICATING_PATHS = new Set(['/oauth2/callback']);

export default function AuthSessionBootstrap() {
  const didRunRef = useRef(false);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated || didRunRef.current) {
      return;
    }

    didRunRef.current = true;

    const bootstrapAuth = async () => {
      const {
        accessToken,
        refreshToken,
        user,
        setAuth,
        setTokens,
        setUser,
        setBootstrapping,
        logout,
      } = useAuthStore.getState();

      setBootstrapping(true);

      try {
        clearLegacyAuthStorage();

        if (SELF_AUTHENTICATING_PATHS.has(window.location.pathname)) {
          return;
        }

        if (!accessToken) {
          // Holding no refresh token is not the end of the road. The backend
          // issues the refresh token as an HttpOnly cookie, which the browser
          // replays automatically and application code cannot read, so the same
          // call restores a session whether the token survives in memory or only
          // in the cookie. No path may skip this on the strength of an absent
          // in-memory token: that copy is deliberately never persisted, so after
          // any full page load it is always absent, and treating that as "no
          // session" signed out every visitor who arrived on one of these paths
          // holding a perfectly valid cookie.
          const refreshedSession = await authApi.refreshSession(refreshToken ?? undefined);

          if (!refreshedSession.accessToken) {
            throw new Error('Unable to restore your session.');
          }

          setTokens({
            accessToken: refreshedSession.accessToken,
            refreshToken: refreshedSession.refreshToken ?? refreshToken,
          });

          if (refreshedSession.user) {
            setUser(refreshedSession.user);
            return;
          }
        }

        if (accessToken && user) {
          return;
        }

        const nextUser = user || (await authApi.getCurrentUser());
        const currentState = useAuthStore.getState();

        setAuth({
          accessToken: currentState.accessToken,
          refreshToken: currentState.refreshToken,
          user: nextUser,
        });
      } catch (error) {
        if (error?.response?.status === 401) {
          logout();
          return;
        }

        // A network failure or a server fault is not evidence that the session
        // ended. Clearing the store here would sign out someone whose
        // connection dropped for a second and whose refresh cookie is still
        // perfectly valid, so the persisted marker is left alone and the next
        // load retries. Nothing is treated as signed in meanwhile: ProtectedRoute
        // gates on a live in-memory access token, which this path never sets.
        if (import.meta.env.DEV) {
          console.error('[AuthSessionBootstrap] session restore failed', error?.message ?? error);
        }
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrapAuth();
  }, [hasHydrated]);

  return null;
}
