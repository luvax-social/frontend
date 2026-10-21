import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();
const putMock = vi.fn();
const getMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('@/services/axiosInstance', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

const feedback = await import('@/services/postFeedback.service');
const safety = await import('@/services/safety.service');

beforeEach(() => {
  postMock.mockReset().mockResolvedValue({ data: undefined });
  putMock.mockReset();
  getMock.mockReset();
  deleteMock.mockReset().mockResolvedValue({ data: undefined });
});

describe('postFeedback.service', () => {
  it('posts a not interested signal for the post', async () => {
    await feedback.markNotInterested('p1');
    expect(postMock).toHaveBeenCalledWith('/posts/p1/not-interested');
  });

  it('deletes the signal to undo it', async () => {
    await feedback.undoNotInterested('p1');
    expect(deleteMock).toHaveBeenCalledWith('/posts/p1/not-interested');
  });
});

describe('safety.service show fewer', () => {
  it('posts show fewer for the author', async () => {
    await safety.showFewer('u1');
    expect(postMock).toHaveBeenCalledWith('/social/show-fewer/u1');
  });

  it('deletes show fewer to undo it', async () => {
    await safety.undoShowFewer('u1');
    expect(deleteMock).toHaveBeenCalledWith('/social/show-fewer/u1');
  });
});

describe('safety.service mutes', () => {
  it('puts absolute mute values and returns the envelope', async () => {
    const body = { data: { userId: 'u1', mutePosts: true, muteStories: false } };
    putMock.mockResolvedValue({ data: body });

    const result = await safety.setMute('u1', { mutePosts: true, muteStories: false });

    expect(putMock).toHaveBeenCalledWith('/social/mutes/u1', {
      mutePosts: true,
      muteStories: false,
    });
    expect(result).toBe(body);
  });

  it('deletes a mute', async () => {
    await safety.unmute('u1');
    expect(deleteMock).toHaveBeenCalledWith('/social/mutes/u1');
  });

  it('lists mutes with a limit and a cursor only when there is one', async () => {
    getMock.mockResolvedValue({ data: { data: { content: [] } } });

    await safety.getMutes({ limit: 20 });
    await safety.getMutes({ cursor: 'c1', limit: 20 });

    expect(getMock).toHaveBeenNthCalledWith(1, '/social/mutes', {
      params: { limit: 20 },
      signal: undefined,
    });
    expect(getMock).toHaveBeenNthCalledWith(2, '/social/mutes', {
      params: { limit: 20, cursor: 'c1' },
      signal: undefined,
    });
  });
});
