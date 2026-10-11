import type { AuthFormValues } from '@/types/auth';
import { authApi } from '@/api/authApi';

/**
 * Auth service — all API calls related to authentication.
 */
const authService = {
  /**
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ user: object, token: string }>}
   */
  login: async (credentials: AuthFormValues) => {
    return authApi.login(credentials);
  },

  /**
   * @param {{ name: string, email: string, password: string }} payload
   * @returns {Promise<{ user: object, token: string }>}
   */
  register: async (payload: AuthFormValues) => {
    return authApi.register(payload);
  },

  /**
   * @returns {Promise<void>}
   */
  logout: async (refreshToken?: string | null) => {
    await authApi.logout(refreshToken);
  },

  /**
   * @returns {Promise<object>}
   */
  getMe: async () => {
    return authApi.getCurrentUser();
  },

  /**
   * @param {{ token: string, email?: string }} values
   * @returns {Promise<object>}
   */
  verifyEmail: async (values: AuthFormValues) => authApi.verifyEmail(values),

  /**
   * @param {{ email: string }} values
   * @returns {Promise<object>}
   */
  resendVerification: async (values: AuthFormValues) => authApi.resendVerification(values),

  /**
   * @param {{ email: string }} values
   * @returns {Promise<object>}
   */
  forgotPassword: async (values: AuthFormValues) => authApi.forgotPassword(values),

  /**
   * @param {{ token: string, password: string }} values
   * @returns {Promise<object>}
   */
  resetPassword: async (values: AuthFormValues) => authApi.resetPassword(values),

  /**
   * @param {string} code
   * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
   */
  exchangeOAuthCode: async (code: string) => authApi.exchangeOAuthCode(code),
};

export default authService;
