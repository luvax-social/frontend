import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('API base URL', () => {
  it('uses the configured API origin instead of reducing it to a same-origin path', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1/');

    const { API_BASE_URL, axiosClient, publicClient } = await import('@/api/axiosClient');

    expect(API_BASE_URL).toBe('https://api.example.test/api/v1');
    expect(axiosClient.defaults.baseURL).toBe('https://api.example.test/api/v1');
    expect(publicClient.defaults.baseURL).toBe('https://api.example.test/api/v1');
  });
});
