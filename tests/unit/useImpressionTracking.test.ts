import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { IntersectionOptions } from 'react-intersection-observer';
import type { Mock } from 'vitest';

const reportImpressionMock = vi.fn();
vi.mock('@/services/impressionQueue', () => ({
  reportImpression: (...args: unknown[]) => reportImpressionMock(...args),
}));

const authState = { isAuthenticated: true };
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

let inViewState: { ref: Mock; value: boolean; lastOptions?: IntersectionOptions };
vi.mock('react-intersection-observer', () => ({
  useInView: (opts: IntersectionOptions) => {
    inViewState.lastOptions = opts;
    return { ref: inViewState.ref, inView: inViewState.value };
  },
}));

const { useImpressionTracking } = await import('@/hooks/useImpressionTracking');

describe('useImpressionTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reportImpressionMock.mockReset();
    authState.isAuthenticated = true;
    inViewState = { ref: vi.fn(), value: false };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Each test below uses its own postId. The hook's "reported this session"
  // set is module-level by design (see the hook's own doc comment), so it
  // persists across tests in this file; reusing one postId across tests
  // would make a later test's post look already-reported from an earlier
  // test's successful report.

  it('observes at a 50% threshold', () => {
    renderHook(() => useImpressionTracking('post-threshold', 'feed'));
    expect(inViewState.lastOptions).toMatchObject({ threshold: 0.5 });
  });

  it('reports after exactly one continuous second in view', () => {
    const { rerender } = renderHook(
      ({ inView }) => {
        inViewState.value = inView;
        return useImpressionTracking('post-dwell', 'feed');
      },
      { initialProps: { inView: true } }
    );
    rerender({ inView: true });

    act(() => vi.advanceTimersByTime(999));
    expect(reportImpressionMock).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(reportImpressionMock).toHaveBeenCalledWith('post-dwell', 1, 'feed');
  });

  it('resets the dwell timer if the post leaves the viewport before one second', () => {
    const { rerender } = renderHook(
      ({ inView }) => {
        inViewState.value = inView;
        return useImpressionTracking('post-reset', 'feed');
      },
      { initialProps: { inView: true } }
    );

    act(() => vi.advanceTimersByTime(600));
    rerender({ inView: false });
    act(() => vi.advanceTimersByTime(600));
    expect(reportImpressionMock).not.toHaveBeenCalled();

    rerender({ inView: true });
    act(() => vi.advanceTimersByTime(999));
    expect(reportImpressionMock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(reportImpressionMock).toHaveBeenCalledTimes(1);
  });

  it('clears the pending timer on unmount so nothing fires after navigation away', () => {
    const { unmount, rerender } = renderHook(
      ({ inView }) => {
        inViewState.value = inView;
        return useImpressionTracking('post-unmount', 'feed');
      },
      { initialProps: { inView: true } }
    );
    rerender({ inView: true });

    act(() => vi.advanceTimersByTime(500));
    unmount();
    act(() => vi.advanceTimersByTime(600));
    expect(reportImpressionMock).not.toHaveBeenCalled();
  });

  it('does nothing when surface is not provided', () => {
    inViewState.value = true;
    renderHook(() => useImpressionTracking('post-no-surface', undefined));
    act(() => vi.advanceTimersByTime(1500));
    expect(reportImpressionMock).not.toHaveBeenCalled();
  });

  it('does nothing when postId is not provided', () => {
    inViewState.value = true;
    renderHook(() => useImpressionTracking(undefined, 'feed'));
    act(() => vi.advanceTimersByTime(1500));
    expect(reportImpressionMock).not.toHaveBeenCalled();
  });

  it('does nothing for an unauthenticated session', () => {
    authState.isAuthenticated = false;
    inViewState.value = true;
    renderHook(() => useImpressionTracking('post-unauthenticated', 'feed'));
    act(() => vi.advanceTimersByTime(1500));
    expect(reportImpressionMock).not.toHaveBeenCalled();
  });
});
