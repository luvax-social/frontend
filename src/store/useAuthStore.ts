import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { normalizeRole } from '@/config/roles';
import type { AuthInput, Role, SessionUser } from '@/types/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  hasHydrated: boolean;
}

interface AuthActions {
  setAuth: (input: AuthInput) => void;
  setTokens: (input: Omit<AuthInput, 'user'>) => void;
  setAccessToken: (token: unknown) => void;
  setRefreshToken: (token: unknown) => void;
  setUser: (user: SessionUser | null | undefined) => void;
  setBootstrapping: (value: boolean) => void;
  markHydrated: () => void;
  logout: () => void;
}

type PersistedAuth = { user: Omit<SessionUser, 'role'> | null; isAuthenticated: boolean };

/**
 * Drops the `role` from a user object before it is persisted. The role is a
 * server fact restored from the boot refresh, never a value read back from
 * browser storage, so it must not ride along inside the persisted `user`. The
 * in-memory `user` keeps its role; only the on-disk copy is stripped.
 */
const stripPersistedRole = (user: SessionUser | null) => {
  if (!user || typeof user !== 'object') {
    return user;
  }
  const { role: _role, ...rest } = user;
  return rest;
};

// Keys used for Google OAuth PKCE-style state and nonce — kept in sessionStorage
// (tab-scoped, never written to the persisted store).
export const GOOGLE_OAUTH_STATE_KEY = 'luvax-google-oauth-state';
export const GOOGLE_OAUTH_NONCE_KEY = 'luvax-google-oauth-nonce';

/**
 * Removes any leftover auth artifacts from a previous storage strategy.
 * Call during logout or session reset to ensure a clean slate.
 */
export const clearLegacyAuthStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(GOOGLE_OAUTH_NONCE_KEY);
  // Belt-and-suspenders: wipe any legacy full-session blobs that older
  // versions may have written under these keys.
  window.localStorage.removeItem('luvax-auth');
  window.sessionStorage.removeItem('luvax-auth');
};

/**
 * Legacy-blob migration: strips `accessToken`/`refreshToken` from the raw
 * `luvax-auth-session` blob in localStorage. Earlier versions of this store
 * persisted both tokens to disk; this scrubs any such leftover blob without
 * forcing a logout — by the time this runs, `persist` has already merged the
 * blob into the live in-memory state, so the current tab keeps a working
 * session while the on-disk copy is cleaned. Runs on every hydration but is
 * idempotent (no-op once nothing is left to strip).
 */
const migrateLegacyPersistedTokens = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const raw = window.localStorage.getItem('luvax-auth-session');
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.state || (!('accessToken' in parsed.state) && !('refreshToken' in parsed.state))) {
      return;
    }

    delete parsed.state.accessToken;
    delete parsed.state.refreshToken;
    window.localStorage.setItem('luvax-auth-session', JSON.stringify(parsed));
  } catch {
    // Malformed persisted blob — leave it for the persist middleware to overwrite normally.
  }
};

/**
 * Normalises a token to either a non-blank string or null.
 *
 * Every setter derives `isAuthenticated` from the result of this rather than from its own raw
 * argument. Deriving it from the argument let a blank token persist `isAuthenticated: true`
 * alongside `accessToken: null`, and `isAuthenticated` is the half that reaches localStorage.
 */
const normalizeToken = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;

const initialState: AuthState = {
  // Access token is in-memory only — never persisted to localStorage.
  accessToken: null,
  // Refresh token is in-memory only — ready to be migrated to HttpOnly cookie
  // flow; it is stripped from the persist partialize function below.
  refreshToken: null,
  user: null,
  // Normalised lowercase role captured from the login and refresh responses
  // only. In-memory, never persisted; restored from the boot refresh. Null
  // until the first login or refresh populates it.
  role: null,
  isAuthenticated: false,
  isBootstrapping: true,
  // Starts false; set to true only after persist middleware rehydrates.
  hasHydrated: false,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist<AuthState & AuthActions, [], [], PersistedAuth>(
    (set) => ({
      ...initialState,

      setAuth: ({ accessToken, refreshToken, user }) => {
        const nextAccessToken = normalizeToken(accessToken);

        return set({
          accessToken: nextAccessToken,
          // refreshToken stays in memory; not persisted (see partialize below).
          refreshToken: normalizeToken(refreshToken),
          user: user ?? null,
          // Captured here at login and at refresh, normalised once.
          role: normalizeRole(user?.role),
          isAuthenticated: Boolean(nextAccessToken),
        });
      },

      setTokens: ({ accessToken, refreshToken }) =>
        set((state) => {
          const nextAccessToken = normalizeToken(accessToken);
          const nextRefreshToken = normalizeToken(refreshToken) ?? state.refreshToken ?? null;

          return {
            accessToken: nextAccessToken,
            refreshToken: nextRefreshToken,
            isAuthenticated: Boolean(nextAccessToken),
          };
        }),

      setAccessToken: (accessToken) => {
        const nextAccessToken = normalizeToken(accessToken);

        return set({
          accessToken: nextAccessToken,
          isAuthenticated: Boolean(nextAccessToken),
        });
      },

      setRefreshToken: (refreshToken) =>
        set({
          refreshToken: normalizeToken(refreshToken),
        }),

      setUser: (user) =>
        set({
          user: user ?? null,
          // The boot refresh and login both flow their user through here or
          // through setAuth; either way the role is recaptured from the same
          // server object, so a reloaded session restores the role.
          role: normalizeRole(user?.role),
        }),

      setBootstrapping: (isBootstrapping) =>
        set({
          isBootstrapping,
        }),

      markHydrated: () =>
        set({
          hasHydrated: true,
        }),

      logout: () => {
        clearLegacyAuthStorage();

        set({
          ...initialState,
          isBootstrapping: false,
          // Hydration already happened before logout was possible.
          hasHydrated: true,
        });
      },
    }),
    {
      name: 'luvax-auth-session',
      storage: createJSONStorage(() => localStorage),

      /**
       * Persist only `user` and `isAuthenticated` to localStorage so the UI
       * can render an optimistic "logged-in" shell immediately on reload.
       * `accessToken` and `refreshToken` are intentionally excluded — they
       * live in memory only. A reload does clear both from memory, but the
       * session is not lost: the HttpOnly refresh cookie is replayed by the
       * browser and AuthSessionBootstrap exchanges it for a fresh access token
       * on mount. ProtectedRoute checks both flags (isAuthenticated + a live
       * accessToken) together because the persisted flag alone is true during
       * the window before that exchange completes, and is not evidence of a
       * working session.
       */
      partialize: (state) => ({
        user: stripPersistedRole(state.user),
        isAuthenticated: state.isAuthenticated,
      }),

      /**
       * onRehydrateStorage is called by persist middleware when hydration
       * completes (or fails). This is the single authoritative place that
       * sets hasHydrated to true, replacing the previous broken pattern of
       * initializing it to `true` before hydration ever ran. It also runs
       * the one-time legacy-token migration (see migrateLegacyPersistedTokens).
       */
      onRehydrateStorage: () => (state) => {
        migrateLegacyPersistedTokens();
        if (state) {
          state.markHydrated();
        }
      },
    }
  )
);
