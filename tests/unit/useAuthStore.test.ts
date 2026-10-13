import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/store/useAuthStore';

const PERSIST_KEY = 'luvax-auth-session';

describe('useAuthStore persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('never writes tokens to localStorage', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      user: { id: 'u1', username: 'someone' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const raw = localStorage.getItem(PERSIST_KEY) ?? '';
    expect(raw).not.toContain('access-abc');
    expect(raw).not.toContain('refresh-xyz');

    const persisted = JSON.parse(raw);
    expect(persisted.state.user.username).toBe('someone');
    expect(persisted.state.isAuthenticated).toBe(true);
    expect(persisted.state).not.toHaveProperty('accessToken');
    expect(persisted.state).not.toHaveProperty('refreshToken');
  });

  it('keeps tokens available in memory', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      user: { id: 'u1' },
    });

    expect(useAuthStore.getState().accessToken).toBe('access-abc');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-xyz');
  });

  it('treats a blank access token as unauthenticated', () => {
    useAuthStore.getState().setAuth({ accessToken: '   ', refreshToken: null, user: null });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('preserves the existing refresh token when setTokens omits it', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: 'u1' },
    });
    useAuthStore.getState().setTokens({ accessToken: 'a2' });

    expect(useAuthStore.getState().accessToken).toBe('a2');
    expect(useAuthStore.getState().refreshToken).toBe('r1');
  });

  it('clears all session state on logout', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: 'u1' },
    });
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
