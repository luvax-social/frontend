import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/api/authApi';
import AuthSessionBootstrap from '@/components/common/AuthSessionBootstrap';
import { useAuthStore } from '@/store/useAuthStore';

vi.mock('@/api/authApi', () => ({
  authApi: {
    refreshSession: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

const SESSION_USER = { id: 'u1', username: 'aaron.codes', name: null, displayName: null };

const setSession = (overrides: Partial<ReturnType<typeof useAuthStore.getState>>) =>
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    isBootstrapping: false,
    hasHydrated: true,
    sessionRestoreError: false,
    sessionRestoreAttempt: 0,
    ...overrides,
  });

// The component reads window.location.pathname directly, so the path under test is set on
// the real history rather than through a router.
const visit = (pathname: string) => window.history.pushState({}, '', pathname);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setSession({});
  visit('/');
});

describe('AuthSessionBootstrap', () => {
  // The in-memory refresh token is deliberately never persisted, so after any full page load
  // it is always null. Treating that as "no session" signed out every authenticated visitor
  // who arrived on one of these paths holding a valid HttpOnly refresh cookie.
  it.each(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'])(
    'restores the cookie-backed session on %s instead of signing the visitor out',
    async (pathname: string) => {
      visit(pathname);
      setSession({ isAuthenticated: true, user: SESSION_USER });
      vi.mocked(authApi.refreshSession).mockResolvedValue({
        accessToken: 'fresh',
        refreshToken: null,
        user: { ...SESSION_USER, name: null, displayName: null },
        message: null,
      });

      render(<AuthSessionBootstrap />);

      await waitFor(() => expect(authApi.refreshSession).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
      expect(useAuthStore.getState().user).toEqual(SESSION_USER);
    }
  );

  it.each([401, 403])(
    'signs the visitor out when restoration is rejected with %i',
    async (status) => {
      // The persisted marker says a session existed here, so the call must still be made and its
      // credential rejection must sign the visitor out, including an account-state denial.
      visit('/login');
      setSession({ isAuthenticated: true, user: SESSION_USER });
      vi.mocked(authApi.refreshSession).mockRejectedValue({ response: { status } });

      render(<AuthSessionBootstrap />);

      await waitFor(() => expect(authApi.refreshSession).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
      expect(useAuthStore.getState().user).toBeNull();
    }
  );

  it('makes no request for a visitor who has never held a session', async () => {
    // No in-memory token and no persisted marker: there is nothing to restore, so the call that
    // could only ever 401 is not made at all. It previously fired on every anonymous cold load,
    // putting a failed request in the console on the first screen every visitor sees and
    // spending the refresh budget on anonymous traffic.
    visit('/');

    render(<AuthSessionBootstrap />);

    await waitFor(() => expect(useAuthStore.getState().isBootstrapping).toBe(false));
    expect(authApi.refreshSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('leaves the OAuth callback to complete its own exchange', async () => {
    // The callback page exchanges its own short-lived code and calls setAuth with the result.
    // A refresh running beside it would either consume the refresh cookie concurrently or, on
    // the 401 a first-time Google sign-in returns, clear the session it had just established.
    visit('/oauth2/callback');
    setSession({ isAuthenticated: true, user: SESSION_USER });

    render(<AuthSessionBootstrap />);

    await waitFor(() => expect(useAuthStore.getState().isBootstrapping).toBe(false));
    expect(authApi.refreshSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(SESSION_USER);
  });
});
