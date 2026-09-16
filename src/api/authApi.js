import {
  AUTH_WITH_CREDENTIALS,
  axiosClient,
  getRefreshTokenFromResponse,
  getTokenFromResponse,
  publicClient,
} from '@/api/axiosClient';
import { useAuthStore } from '@/store/useAuthStore';

const DEFAULT_GOOGLE_AUTHORIZATION_PATH = '/api/v1/auth/oauth2/authorize/google';

const getPayload = (response) => response?.data?.data ?? response?.data ?? {};

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : email);

// The backend resolves the account type by '@' presence, so only lowercase the
// email form here and leave usernames as typed.
const normalizeIdentifier = (identifier) => {
  if (typeof identifier !== 'string') {
    return identifier;
  }

  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
};

const normalizeUser = (payload) => {
  const rawUser = payload?.user ?? payload?.data?.user ?? payload?.profile ?? payload ?? null;

  if (!rawUser || typeof rawUser !== 'object') {
    return rawUser;
  }

  return {
    ...rawUser,
    name: rawUser.name ?? rawUser.displayName ?? null,
    displayName: rawUser.displayName ?? rawUser.name ?? null,
  };
};

const normalizeMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

const isGoogleCallbackPath = (pathname) =>
  /\/(?:auth\/oauth2\/callback|oauth2\/callback|oauth\/callback)\/?/i.test(pathname);

const containsProviderPlaceholder = (value) =>
  /\{provider\}/i.test(value) || /%7Bprovider/i.test(value);

const deriveBackendOriginFromApiUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();

  if (!apiUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(apiUrl);
    parsedUrl.pathname = '';
    parsedUrl.search = '';
    parsedUrl.hash = '';
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return apiUrl.replace(/\/api(?:\/v\d+)?(?:\/.*)?$/i, '').replace(/\/$/, '');
  }
};

const buildRequestBody = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      return true;
    })
  );

const extractAuthSession = (response) => {
  const payload = getPayload(response);

  return {
    accessToken: getTokenFromResponse(response?.data),
    refreshToken: getRefreshTokenFromResponse(response?.data),
    user: normalizeUser(payload),
    message: payload?.message ?? response?.data?.message ?? null,
  };
};

const normalizeVerificationPayload = (values = {}) => {
  const token = values?.token?.trim?.() || values?.otp?.trim?.() || values?.code?.trim?.() || '';

  return {
    token,
    email: normalizeEmail(values?.email),
  };
};

export const authApi = {
  async login(values) {
    const response = await publicClient.post(
      '/auth/login',
      buildRequestBody({
        identifier: normalizeIdentifier(values?.identifier ?? values?.email),
        password: values?.password,
        turnstileToken: values?.turnstileToken,
      })
    );

    return extractAuthSession(response);
  },

  async register(values) {
    const response = await publicClient.post(
      '/auth/register',
      buildRequestBody({
        displayName: values?.name,
        username: values?.username,
        email: normalizeEmail(values?.email),
        password: values?.password,
        turnstileToken: values?.turnstileToken,
      })
    );

    return extractAuthSession(response);
  },

  // The backend lists /auth/logout as an authenticated path, so it must go out
  // on the client that attaches the bearer token. Sent unauthenticated it
  // answers 401 without revoking the refresh token or expiring the refresh
  // cookie, which would leave a "logged out" browser able to restore the
  // session on the next reload.
  async logout(refreshToken = useAuthStore.getState().refreshToken) {
    await axiosClient.post(
      '/auth/logout',
      buildRequestBody({
        refreshToken: refreshToken ?? undefined,
      }),
      {
        withCredentials: AUTH_WITH_CREDENTIALS,
      }
    );
  },

  async refreshSession(refreshToken = useAuthStore.getState().refreshToken) {
    const response = await publicClient.post(
      '/auth/refresh',
      buildRequestBody({
        refreshToken: refreshToken ?? undefined,
      }),
      {
        withCredentials: AUTH_WITH_CREDENTIALS,
        skipAuthRefresh: true,
      }
    );

    return extractAuthSession(response);
  },

  async getCurrentUser() {
    const response = await axiosClient.get('/users/me');
    return normalizeUser(getPayload(response));
  },

  async verifyEmail(values) {
    const verification = normalizeVerificationPayload(values);

    if (!verification.token) {
      throw new Error('Verification token is required.');
    }

    const response = await publicClient.get('/auth/verify-email', {
      params: {
        token: verification.token,
      },
    });

    return getPayload(response);
  },

  async resendVerification(values) {
    const response = await publicClient.post(
      '/auth/verify-email/resend',
      buildRequestBody({
        email: normalizeEmail(values?.email),
        turnstileToken: values?.turnstileToken,
      })
    );

    return getPayload(response);
  },

  async forgotPassword(values) {
    const response = await publicClient.post(
      '/auth/forgot-password',
      buildRequestBody({
        email: normalizeEmail(values?.email),
        turnstileToken: values?.turnstileToken,
      })
    );

    return getPayload(response);
  },

  async resetPassword(values) {
    const verification = normalizeVerificationPayload(values);
    const nextPassword = values?.newPassword ?? values?.password ?? '';

    // The backend rejects unrecognised fields on this endpoint, so the body must
    // carry exactly token + newPassword + turnstileToken.
    const response = await publicClient.post(
      '/auth/reset-password',
      buildRequestBody({
        token: verification.token || undefined,
        newPassword: nextPassword,
        turnstileToken: values?.turnstileToken,
      })
    );

    return getPayload(response);
  },

  async exchangeOAuthCode(code) {
    const response = await publicClient.post(
      '/auth/oauth2/exchange',
      buildRequestBody({
        code,
      })
    );

    return extractAuthSession(response);
  },

  getDefaultGoogleAuthorizationUrl() {
    const backendOrigin = deriveBackendOriginFromApiUrl();

    if (!backendOrigin) {
      throw new Error(
        "google sign-in isn't available right now. try signing in with your email instead."
      );
    }

    return `${backendOrigin}${DEFAULT_GOOGLE_AUTHORIZATION_PATH}`;
  },

  getGoogleLoginUrl() {
    const envGoogleAuthUrl =
      import.meta.env.VITE_GOOGLE_AUTH_URL?.trim() || this.getDefaultGoogleAuthorizationUrl();

    if (envGoogleAuthUrl) {
      const loginUrl = new URL(envGoogleAuthUrl, window.location.origin);

      if (
        containsProviderPlaceholder(loginUrl.pathname) ||
        containsProviderPlaceholder(loginUrl.href)
      ) {
        throw new Error(
          "google sign-in isn't available right now. try signing in with your email instead."
        );
      }

      if (isGoogleCallbackPath(loginUrl.pathname)) {
        throw new Error(
          "google sign-in isn't available right now. try signing in with your email instead."
        );
      }

      return loginUrl.toString();
    }

    throw new Error(
      "google sign-in isn't available right now. try signing in with your email instead."
    );
  },

  normalizeMessage,
};
