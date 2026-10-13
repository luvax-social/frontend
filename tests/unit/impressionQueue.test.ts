import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authState = { isAuthenticated: true, accessToken: 'token-abc' };
const useAuthStoreMock = { getState: () => authState };
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: useAuthStoreMock,
}));
vi.mock('@/api/axiosClient', () => ({ API_BASE_URL: '/api/v1' }));

let fetchMock: Mock<
  (
    url: string,
    init: { method: string; keepalive: boolean; headers: Record<string, string>; body: string }
  ) => Promise<{ ok: boolean; status: number; headers?: { get: (name: string) => string | null } }>
>;

beforeEach(async () => {
  vi.resetModules();
  authState.isAuthenticated = true;
  authState.accessToken = 'token-abc';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-uuid') });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = () => import('@/services/impressionQueue');

describe('impressionQueue.reportImpression', () => {
  it('does nothing for an unauthenticated session', async () => {
    authState.isAuthenticated = false;
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'feed');
    await flushImpressions();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the same postId only once (session dedup)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'feed');
    reportImpression('post-1', 1, 'feed');
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.impressions).toHaveLength(1);
  });

  it('does not re-send a postId that already flushed successfully', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'feed');
    await flushImpressions();
    reportImpression('post-1', 1, 'feed');
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('impressionQueue.flushImpressions', () => {
  it('sends a batch with keepalive, the bearer token, and the wire shape', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'explore');
    await flushImpressions();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/recommendations/impressions');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.headers.Authorization).toBe('Bearer token-abc');
    const body = JSON.parse(init.body);
    expect(body.impressions[0]).toEqual({
      impressionId: 'generated-uuid',
      postId: 'post-1',
      dwellSeconds: 1,
      surface: 'explore',
    });
  });

  it('splits a queue larger than 100 into separate requests', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    const { reportImpression, flushImpressions } = await load();
    for (let i = 0; i < 150; i += 1) {
      reportImpression(`post-${i}`, 1, 'feed');
    }
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).impressions).toHaveLength(100);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).impressions).toHaveLength(50);
  });

  it('keeps a batch queued for the next attempt on a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'feed');
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 202 });
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).impressions).toHaveLength(1);
  });

  it('keeps a batch queued and does not throw on a server error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers() });
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'feed');
    await expect(flushImpressions()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('backs off on a 429 and does not retry until Retry-After elapses', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '30' }),
    });
    const { reportImpression, flushImpressions } = await load();
    reportImpression('post-1', 1, 'feed');
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 202 });
    vi.advanceTimersByTime(31_000);
    await flushImpressions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does nothing when the queue is empty', async () => {
    const { flushImpressions } = await load();
    await flushImpressions();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('impressionQueue.initImpressionQueue', () => {
  it('registers exactly one flush interval and one listener of each kind, even if called twice', async () => {
    vi.useFakeTimers();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const { initImpressionQueue } = await load();

    initImpressionQueue();
    initImpressionQueue();

    const visibilityCalls = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'visibilitychange'
    );
    const pagehideCalls = windowAddEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'pagehide'
    );
    expect(visibilityCalls).toHaveLength(1);
    expect(pagehideCalls).toHaveLength(1);
    vi.useRealTimers();
  });
});
