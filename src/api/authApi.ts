import {
  axiosClient,
  getRefreshTokenFromResponse,
  getTokenFromResponse,
  publicClient,
  requestSessionRefresh,
} from '@/api/axiosClient';
import type { AxiosResponse } from 'axios';
import type { AppError } from '@/api/axiosClient';
import type { AuthFormValues, AuthPayload, SessionUser } from '@/types/auth';

type UserPayload = SessionUser & {
  user?: SessionUser;
  data?: { user?: SessionUser };
  profile?: SessionUser;
};

type CompatiblePayload = AuthPayload & Partial<UserPayload>;
type AuthEnvelope = CompatiblePayload & { data?: CompatiblePayload };

const DEFAULT_GOOGLE_AUTHORIZATION_PATH = '/api/v1/auth/oauth2/authorize/google';

const getPayload = (response: AxiosResponse<AuthEnvelope>): CompatiblePayload =>
  response?.data?.data ?? response?.data ?? {};

const normalizeEmail = (email: string | undefined) =>
  typeof email === 'string' ? email.trim().toLowerCase() : email;

// The backend resolves the account type by '@' presence, so only lowercase the
// email form here and leave usernames as typed.
const normalizeIdentifier = (identifier: string | undefined) => {
  if (typeof identifier !== 'string') {
    return identifier;
  }

  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
};

const normalizeUser = (payload: Partial<UserPayload> | null | undefined) => {
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

const normalizeMessage = (error: AppError | null | undefined, fallback: string) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

const isGoogleCallbackPath = (pathname: string) =>
  /\/(?:auth\/oauth2\/callback|oauth2\/callback|oauth\/callback)\/?/i.test(pathname);

const containsProviderPlaceholder = (value: string) =>
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

const buildRequestBody = (payload: Record<string, unknown> = {}) =>
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

const extractAuthSession = (response: AxiosResponse<AuthEnvelope>) => {
  const payload = getPayload(response);

  return {
    accessToken: getTokenFromResponse(response?.data),
    refreshToken: getRefreshTokenFromResponse(response?.data),
    user: normalizeUser(payload),
    message: payload?.message ?? response?.data?.message ?? null,
  };
};

const normalizeVerificationPayload = (values: AuthFormValues = {}) => {
  const token = values?.token?.trim?.() || values?.otp?.trim?.() || values?.code?.trim?.() || '';

  return {
    token,
    email: normalizeEmail(values?.email),
  };
};

export const authApi = {
  async login(values: AuthFormValues) {
    const response = await publicClient.post<AuthEnvelope>(
      '/auth/login',
      buildRequestBody({
        identifier: normalizeIdentifier(values?.identifier ?? values?.email),
        password: values?.password,
        turnstileToken: values?.turnstileToken,
      })
    );

    return extractAuthSession(response);
  },

  async register(values: AuthFormValues) {
    const response = await publicClient.post<AuthEnvelope>(
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
  async logout() {
    await axiosClient.post('/auth/logout', {});
  },

  async refreshSession() {
    const response = await requestSessionRefresh();

    return extractAuthSession(response);
  },

  async getCurrentUser() {
    const response = await axiosClient.get<AuthEnvelope>('/users/me');
    return normalizeUser(getPayload(response));
  },

  async verifyEmail(values: AuthFormValues) {
    const verification = normalizeVerificationPayload(values);

    if (!verification.token) {
      throw new Error('Verification token is required.');
    }

    const response = await publicClient.get<AuthEnvelope>('/auth/verify-email', {
      params: {
        token: verification.token,
      },
    });

    return getPayload(response);
  },

  async resendVerification(values: AuthFormValues) {
    const response = await publicClient.post<AuthEnvelope>(
      '/auth/verify-email/resend',
      buildRequestBody({
        email: normalizeEmail(values?.email),
        turnstileToken: values?.turnstileToken,
      })
    );

    return getPayload(response);
  },

  async forgotPassword(values: AuthFormValues) {
    const response = await publicClient.post<AuthEnvelope>(
      '/auth/forgot-password',
      buildRequestBody({
        email: normalizeEmail(values?.email),
        turnstileToken: values?.turnstileToken,
      })
    );

    return getPayload(response);
  },

  async resetPassword(values: AuthFormValues) {
    const verification = normalizeVerificationPayload(values);
    const nextPassword = values?.newPassword ?? values?.password ?? '';

    // The backend rejects unrecognised fields on this endpoint, so the body must
    // carry exactly token + newPassword + turnstileToken.
    const response = await publicClient.post<AuthEnvelope>(
      '/auth/reset-password',
      buildRequestBody({
        token: verification.token || undefined,
        newPassword: nextPassword,
        turnstileToken: values?.turnstileToken,
      })
    );

    return getPayload(response);
  },

  async exchangeOAuthCode(code: string) {
    const response = await publicClient.post<AuthEnvelope>(
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
