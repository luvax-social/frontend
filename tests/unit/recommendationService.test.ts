import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
vi.mock('@/services/axiosInstance', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

const { getRecommendedFeed } = await import('@/services/recommendation.service');

describe('recommendationService.getRecommendedFeed', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { data: { content: [] } } });
  });

  it('requests /recommendations/feed with limit and no excludeFollowed by default', async () => {
    await getRecommendedFeed({ limit: 10 });
    expect(getMock).toHaveBeenCalledWith('/recommendations/feed', {
      params: { limit: 10 },
      signal: undefined,
    });
  });

  it('omits cursor when not provided and includes it when provided', async () => {
    await getRecommendedFeed({ limit: 10, cursor: 'g:105:0' });
    expect(getMock).toHaveBeenCalledWith('/recommendations/feed', {
      params: { limit: 10, cursor: 'g:105:0' },
      signal: undefined,
    });
  });

  it('sends excludeFollowed=true only when the discovery variant is requested', async () => {
    await getRecommendedFeed({ limit: 10, excludeFollowed: true });
    expect(getMock).toHaveBeenCalledWith('/recommendations/feed', {
      params: { limit: 10, excludeFollowed: true },
      signal: undefined,
    });
  });

  it('returns the response body', async () => {
    const body = { data: { data: { content: [{ id: '1' }] } } };
    getMock.mockResolvedValueOnce(body);
    const result = await getRecommendedFeed({ limit: 10 });
    expect(result).toBe(body.data);
  });
});
