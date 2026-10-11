import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRateLimitCooldown } from '@/hooks/useRateLimitCooldown';

describe('useRateLimitCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts not cooling', () => {
    const { result } = renderHook(() => useRateLimitCooldown());
    expect(result.current.cooling).toBe(false);
    expect(result.current.remaining).toBe(0);
  });

  it('enters cooldown for the given number of seconds', () => {
    const { result } = renderHook(() => useRateLimitCooldown());
    act(() => result.current.start(30));
    expect(result.current.cooling).toBe(true);
    expect(result.current.remaining).toBe(30);
  });

  it('falls back to 60 seconds when the value is missing or invalid', () => {
    const { result } = renderHook(() => useRateLimitCooldown());
    act(() => result.current.start(undefined));
    expect(result.current.remaining).toBe(60);
  });

  it('stops cooling once the window elapses', () => {
    const { result } = renderHook(() => useRateLimitCooldown());
    act(() => result.current.start(1));
    expect(result.current.cooling).toBe(true);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.cooling).toBe(false);
  });
});
