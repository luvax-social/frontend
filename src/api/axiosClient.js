import axios from 'axios';

import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '/api/v1';
// The refresh token is delivered as an HttpOnly cookie. The API sits on a
// different origin from the SPA in every environment (localhost:8080 against
// localhost:5173 in development, api.luvax.online against luvax.online in
// production), and a browser both discards a cross-origin Set-Cookie and
// withholds the cookie unless the request is made with credentials. Login,
// email verification and the OAuth exchange issue the cookie, refresh rotates
// it and logout clears it, so it is a client default rather than a per-call
// option: a per-call flag was once missing from login, which let the browser
// drop the cookie and signed every user out on the next full page reload. The
// cookie is path-scoped to /api/v1/auth, so no other endpoint receives it.
const AUTH_WITH_CREDENTIALS = true;
const REFRESH_PATH = '/auth/refresh';

const createClient = (config = {}) =>
  axios.create({
    baseURL: API_BASE_URL,
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: AUTH_WITH_CREDENTIALS,
    ...config,
  });

export const publicClient = createClient();
export const axiosClient = createClient();

let isRefreshing = false;
let isRedirecting = false;
let refreshQueue = [];

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/verify-email/resend',
  '/auth/oauth2/exchange',
];

export const getTokenFromResponse = (payload) =>
  payload?.accessToken ??
  payload?.token ??
  payload?.data?.accessToken ??
  payload?.data?.token ??
  payload?.data?.access_token ??
  payload?.access_token ??
  null;

export const getRefreshTokenFromResponse = (payload) =>
  payload?.refreshToken ??
  payload?.data?.refreshToken ??
  payload?.data?.refresh_token ??
  payload?.refresh_token ??
  null;

// The refresh response carries the same `user` object as login, including the
// role. Pulling it out here lets the interceptor-driven refresh repopulate the
// role, not only the tokens; without it a background refresh would leave the
// role stale because setTokens does not touch the user.
export const getUserFromResponse = (payload) => payload?.data?.user ?? payload?.user ?? null;

const isSkippableRequest = (config = {}) => {
  const url = config.url || '';
  return (
    config.skipAuthRefresh ||
    url.includes(REFRESH_PATH) ||
    PUBLIC_AUTH_PATHS.some((path) => url.includes(path))
  );
};

const flushRefreshQueue = (error, nextAuth = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(nextAuth);
  });

  refreshQueue = [];
};

// '/login' only ever redirects to '/', which is where the sign-in form actually
// renders. Treating '/login' alone as "already there" makes a redirect fire on
// the very page it is trying to reach, costing a needless full reload.
const AUTH_SCREEN_PATHS = new Set(['/', '/login']);

export const clearAuthAndRedirect = () => {
  useAuthStore.getState().logout();

  if (typeof window === 'undefined' || isRedirecting) {
    return;
  }

  isRedirecting = true;

  if (!AUTH_SCREEN_PATHS.has(window.location.pathname)) {
    // useNavigate is a React hook and cannot be called outside the component
    // tree. This interceptor runs at the module level, so a hard navigation is
    // the only way to guarantee a clean redirect that resets all in-memory
    // state (Zustand stores, QueryClient cache) after session expiry.
    // This is an intentional, audited exception — not an oversight.
    window.location.assign('/login');
    return;
  }

  isRedirecting = false;
};

const persistAuthSession = ({ accessToken, refreshToken, user }) => {
  const { setAuth, setTokens } = useAuthStore.getState();

  if (user !== undefined) {
    setAuth({ accessToken, refreshToken, user });
    return;
  }

  setTokens({ accessToken, refreshToken });
};

const refreshAccessToken = async () => {
  const { refreshToken } = useAuthStore.getState();

  // An absent in-memory token is not a dead end: the HttpOnly refresh cookie
  // rides along with the request and the server falls back to it when the body
  // omits the field. Sending an empty body is what lets a reloaded tab, which
  // has lost the in-memory copy, still rotate a session.
  const response = await publicClient.post(REFRESH_PATH, refreshToken ? { refreshToken } : {}, {
    skipAuthRefresh: true,
  });

  const payload = response?.data;
  const nextAccessToken = getTokenFromResponse(payload);
  const nextRefreshToken = getRefreshTokenFromResponse(payload) || refreshToken;
  const nextUser = getUserFromResponse(payload);

  if (!nextAccessToken) {
    throw new Error('Refresh response did not include an access token.');
  }

  persistAuthSession({
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    // Only pass `user` when the response carried one, so persistAuthSession
    // routes to setAuth (which restores the role) rather than setTokens.
    ...(nextUser ? { user: nextUser } : {}),
  });

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
  };
};

// ─── Error normalizer ─────────────────────────────────────────────────────────

/**
 * STATUS_MESSAGES
 *
 * Maps HTTP status codes to safe, user-facing messages.
 * These are the fallback when the backend does not supply its own message.
 * Never expose raw database errors, constraint names, or internal stack traces.
 */
const STATUS_MESSAGES = {
  400: 'The request was invalid. Please check your input and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action could not be completed due to a conflict.',
  422: 'The submitted data could not be processed. Please review your input.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again shortly.',
  502: 'The server is temporarily unavailable. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
};

/**
 * REDACTED_PATTERNS
 *
 * Regex patterns that match raw backend implementation details that must
 * never reach the UI. When a backend message matches any of these patterns,
 * the message is replaced with the generic status-code fallback.
 *
 * Covers common leakage vectors:
 * - Database constraint violation strings (PostgreSQL, MySQL)
 * - JPA/Hibernate internal exception class names
 * - SQL keywords and table/column references
 * - Stack trace fragments
 * - Internal account-status enum values (INACTIVE, BANNED, etc.)
 */
const REDACTED_PATTERNS = [
  /duplicate key/i,
  /unique constraint/i,
  /foreign key constraint/i,
  /violates.*constraint/i,
  /DataIntegrityViolationException/i,
  /ConstraintViolationException/i,
  /TransactionSystemException/i,
  /org\.hibernate/i,
  /org\.springframework/i,
  /com\.mysql/i,
  /com\.postgres/i,
  /\bSQL\b/i,
  /\bselect\b.*\bfrom\b/i,
  /at [a-z]+\.[a-z]+\.[A-Z]/, // Java stack trace line: "at com.example.Service"
  /\bINACTIVE\b/,
  /\bBANNED\b/,
  /\bSUSPENDED\b/,
  /\bDELETED\b.*account/i,
];

/**
 * normalizeAxiosError
 *
 * Rewrites the error object that flows to TanStack Query hooks and direct
 * Axios callers. The normalized message is set on `error.message` and also
 * written to `error.response.data.message` so all existing consumers
 * (authApi.normalizeMessage, LoginForm error display, etc.) see a safe value
 * without requiring changes at each call site.
 */
const normalizeAxiosError = (error) => {
  if (!error || !error.isAxiosError) {
    // If it's a generic JS Error (like thrown during refresh token checks), keep its message
    if (error && !error.response && error.message) {
      return error;
    }
    if (!error?.response) {
      error = error || new Error('Unknown error');
      error.message = 'Unable to reach the server. Please check your connection.';
      return error;
    }
  }

  if (!error.response) {
    // Network error or timeout — no HTTP response to inspect.
    error.message = 'Unable to reach the server. Please check your connection.';
    return error;
  }

  const status = error.response.status;
  const data = error.response.data ?? {};

  // Candidate message from backend — prefer the most specific field.
  const rawMessage = data.message || data.error || data.detail || data.errors?.[0]?.message || null;

  // Check if the raw message leaks internal implementation details.
  const isRedacted = rawMessage && REDACTED_PATTERNS.some((pattern) => pattern.test(rawMessage));

  // Final user-facing message: use raw message only if it is safe,
  // otherwise fall back to the status-code lookup, then a generic fallback.
  const safeMessage = isRedacted
    ? (STATUS_MESSAGES[status] ?? 'An unexpected error occurred.')
    : (rawMessage ?? STATUS_MESSAGES[status] ?? 'An unexpected error occurred.');

  // Mutate the error in-place so all existing error-reading code paths
  // (authApi.normalizeMessage, component catch blocks) transparently receive
  // the safe message without any changes at each call site.
  error.message = safeMessage;

  if (error.response.data && typeof error.response.data === 'object') {
    error.response.data.message = safeMessage;
  }

  // A VALIDATION_ERROR carries its detail as a field-name to message map in the
  // envelope's `data`. Lifting it onto the error here is what lets a form put a
  // refusal against the field that caused it, without every call site reaching
  // into `error.response.data` for itself. Only string values are copied, so a
  // nested or unexpected payload cannot end up rendered as a field message.
  if (data.code === 'VALIDATION_ERROR' && data.data && typeof data.data === 'object') {
    const fieldErrors = {};
    for (const [field, message] of Object.entries(data.data)) {
      if (typeof message === 'string') fieldErrors[field] = message;
    }
    if (Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  }

  return error;
};

// ─── publicClient interceptors ────────────────────────────────────────────────

// Normalize errors on publicClient (used for auth endpoints and OAuth exchange).
// No auth-refresh logic here — public routes do not carry access tokens.
publicClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeAxiosError(error))
);

// ─── axiosClient interceptors ─────────────────────────────────────────────────

axiosClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest || status !== 401 || isSkippableRequest(originalRequest)) {
      return Promise.reject(normalizeAxiosError(error));
    }

    if (originalRequest._retry) {
      clearAuthAndRedirect();
      return Promise.reject(normalizeAxiosError(error));
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: ({ accessToken }) => {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            resolve(axiosClient(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const nextAuth = await refreshAccessToken();

      flushRefreshQueue(null, nextAuth);

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAuth.accessToken}`;

      return axiosClient(originalRequest);
    } catch (refreshError) {
      flushRefreshQueue(refreshError);
      clearAuthAndRedirect();
      return Promise.reject(normalizeAxiosError(refreshError));
    } finally {
      isRefreshing = false;
    }
  }
);

export { API_BASE_URL, AUTH_WITH_CREDENTIALS, REFRESH_PATH };
