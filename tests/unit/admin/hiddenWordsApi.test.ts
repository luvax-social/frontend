import { describe, it, expect, vi, beforeEach } from 'vitest';

import { axiosClient } from '@/api/axiosClient';
import { hiddenWordsApi } from '@/features/admin/api/hiddenWords';

vi.mock('@/api/axiosClient', () => ({
  axiosClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const client = vi.mocked(axiosClient, true);
const envelope = <T>(data: T) => ({ data: { data } });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('hiddenWordsApi', () => {
  it('lists with only the declared query parameters and unwraps the envelope', async () => {
    const body = {
      content: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
      degraded: false,
    };
    client.get.mockResolvedValue(envelope(body));

    const result = await hiddenWordsApi.list({ q: 'ngu', cursor: null, limit: 20 });

    expect(client.get).toHaveBeenCalledWith('/admin/hidden-words', {
      params: { q: 'ngu', limit: 20 },
    });
    expect(result).toBe(body);
  });

  it('omits a blank search term', async () => {
    client.get.mockResolvedValue(envelope({}));
    await hiddenWordsApi.list({ q: '', limit: 20 });
    expect(client.get).toHaveBeenCalledWith('/admin/hidden-words', { params: { limit: 20 } });
  });

  it('creates with exactly phrase and reason', async () => {
    client.post.mockResolvedValue(envelope({ id: 'w1' }));
    const result = await hiddenWordsApi.create({ phrase: 'đồ ngu', reason: 'abuse' });
    expect(client.post).toHaveBeenCalledWith('/admin/hidden-words', {
      phrase: 'đồ ngu',
      reason: 'abuse',
    });
    expect(result).toEqual({ id: 'w1' });
  });

  it('updates with a patch carrying phrase and reason', async () => {
    client.patch.mockResolvedValue(envelope({ id: 'w1' }));
    await hiddenWordsApi.update('w1', { phrase: 'x', reason: 'fix' });
    expect(client.patch).toHaveBeenCalledWith('/admin/hidden-words/w1', {
      phrase: 'x',
      reason: 'fix',
    });
  });

  it('deletes with the reason in the request body', async () => {
    client.delete.mockResolvedValue({ data: undefined });
    await hiddenWordsApi.remove('w1', { reason: 'too broad' });
    expect(client.delete).toHaveBeenCalledWith('/admin/hidden-words/w1', {
      data: { reason: 'too broad' },
    });
  });
});
