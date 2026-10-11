import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosClient, publicClient } from '@/api/axiosClient';
import { useAuthStore } from '@/store/useAuthStore';

let authMock: MockAdapter;
let publicMock: MockAdapter;

beforeEach(() => {
  authMock = new MockAdapter(axiosClient);
  publicMock = new MockAdapter(publicClient);
  useAuthStore.setState({
    accessToken: 'expired-token',
    refreshToken: 'refresh-1',
    user: { id: 'u1' },
    isAuthenticated: true,
  });
});

afterEach(() => {
  authMock.restore();
  publicMock.restore();
  vi.restoreAllMocks();
});

describe('single-flight token refresh', () => {
  it('issues exactly one refresh for concurrent 401s and replays both requests', async () => {
    let refreshCalls = 0;

    authMock.onGet('/a').replyOnce(401);
    authMock.onGet('/a').replyOnce(200, { ok: 'a' });
    authMock.onGet('/b').replyOnce(401);
    authMock.onGet('/b').replyOnce(200, { ok: 'b' });
    publicMock.onPost('/auth/refresh').reply(() => {
      refreshCalls += 1;
      return [200, { accessToken: 'fresh-token', refreshToken: 'refresh-2' }];
    });

    const [a, b] = await Promise.all([axiosClient.get('/a'), axiosClient.get('/b')]);

    expect(refreshCalls).toBe(1);
    expect(a.data.ok).toBe('a');
    expect(b.data.ok).toBe('b');
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('replays the original request with the new token, not the stale one', async () => {
    const seen: unknown[] = [];
    authMock.onGet('/protected').replyOnce(401);
    authMock.onGet('/protected').replyOnce((config) => {
      seen.push(config.headers?.Authorization);
      return [200, { ok: true }];
    });
    publicMock.onPost('/auth/refresh').reply(200, { accessToken: 'fresh-token' });

    await axiosClient.get('/protected');

    expect(seen).toEqual(['Bearer fresh-token']);
  });

  it('clears the session when the refresh itself fails', async () => {
    authMock.onGet('/protected').reply(401);
    publicMock.onPost('/auth/refresh').reply(401);

    await expect(axiosClient.get('/protected')).rejects.toBeTruthy();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('does not attempt a refresh for a public auth endpoint', async () => {
    let refreshCalls = 0;
    publicMock.onPost('/auth/refresh').reply(() => {
      refreshCalls += 1;
      return [200, { accessToken: 'x' }];
    });
    authMock.onPost('/auth/login').reply(401);

    await expect(axiosClient.post('/auth/login', {})).rejects.toBeTruthy();
    expect(refreshCalls).toBe(0);
  });

  it('attaches the current access token to an outgoing request', async () => {
    let seenHeader: unknown;
    authMock.onGet('/whoami').reply((config) => {
      seenHeader = config.headers?.Authorization;
      return [200, {}];
    });

    await axiosClient.get('/whoami');

    expect(seenHeader).toBe('Bearer expired-token');
  });
});

describe('error message normalization', () => {
  it('replaces a leaky backend message with a safe one', async () => {
    authMock.onGet('/boom').reply(500, {
      message: 'could not execute statement; SQL [insert into posts]; constraint [uq_posts]',
    });

    await expect(axiosClient.get('/boom')).rejects.toMatchObject({
      message: 'A server error occurred. Please try again shortly.',
    });
  });

  it('preserves a safe backend message', async () => {
    authMock.onGet('/nope').reply(404, { message: 'That post no longer exists.' });

    await expect(axiosClient.get('/nope')).rejects.toMatchObject({
      message: 'That post no longer exists.',
    });
  });

  it('reports a network failure without exposing internals', async () => {
    authMock.onGet('/offline').networkError();

    await expect(axiosClient.get('/offline')).rejects.toMatchObject({
      message: 'Unable to reach the server. Please check your connection.',
    });
  });
});
