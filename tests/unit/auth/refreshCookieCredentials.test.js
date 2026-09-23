import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authApi } from '@/api/authApi';
import { axiosClient, publicClient } from '@/api/axiosClient';
import { useAuthStore } from '@/store/useAuthStore';

// The API is served from a different origin than the SPA (localhost:8080 against localhost:5173
// in development, api.luvax.online against luvax.online in production). A browser only stores a
// Set-Cookie from a cross-origin response, and only sends the cookie back, when the request was
// made with credentials. Every call that can receive the HttpOnly refresh cookie must therefore
// carry withCredentials, or a full page reload finds no cookie and signs the user out.

const session = { accessToken: 'access-1', refreshToken: 'refresh-1', user: { id: 'u1' } };

let publicMock;
let authMock;
let seen;

const record = (label) => (config) => {
  seen[label] = config.withCredentials === true;
  return [200, { data: session }];
};

beforeEach(() => {
  seen = {};
  publicMock = new MockAdapter(publicClient);
  authMock = new MockAdapter(axiosClient);
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
  });
});

afterEach(() => {
  publicMock.restore();
  authMock.restore();
});

describe('refresh cookie credentials', () => {
  it('login sends credentials so the browser stores the refresh cookie', async () => {
    publicMock.onPost('/auth/login').reply(record('login'));

    await authApi.login({ identifier: 'someone', password: 'secret', turnstileToken: 't' });

    expect(seen.login).toBe(true);
  });

  it('email verification sends credentials because it issues a session', async () => {
    publicMock.onGet('/auth/verify-email').reply(record('verify'));

    await authApi.verifyEmail({ token: 'abc' });

    expect(seen.verify).toBe(true);
  });

  it('the oauth code exchange sends credentials because it issues a session', async () => {
    publicMock.onPost('/auth/oauth2/exchange').reply(record('exchange'));

    await authApi.exchangeOAuthCode('code-1');

    expect(seen.exchange).toBe(true);
  });

  it('the boot refresh sends credentials so the cookie reaches the server', async () => {
    publicMock.onPost('/auth/refresh').reply(record('refresh'));

    await authApi.refreshSession();

    expect(seen.refresh).toBe(true);
  });

  it('both clients default to credentials, so a new auth call cannot forget them', () => {
    expect(publicClient.defaults.withCredentials).toBe(true);
    expect(axiosClient.defaults.withCredentials).toBe(true);
  });
});
