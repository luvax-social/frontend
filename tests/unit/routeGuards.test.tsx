import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import GuestRoute from '@/components/common/GuestRoute';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { useAuthStore } from '@/store/useAuthStore';

// Both guards render <Outlet /> rather than children, so they are exercised as parent
// routes with a nested child, which is how the real router wires them.
const renderGuard = (
  guard: ReactNode,
  { entry, childPath }: { entry: string; childPath: string }
) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={guard}>
          <Route path={childPath} element={<div>guarded content</div>} />
        </Route>
        <Route path="/login" element={<div>login screen</div>} />
        <Route path="/app" element={<div>app shell</div>} />
      </Routes>
    </MemoryRouter>
  );

const setSession = (overrides: Partial<ReturnType<typeof useAuthStore.getState>>) =>
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    isBootstrapping: false,
    hasHydrated: true,
    ...overrides,
  });

beforeEach(() => {
  localStorage.clear();
  setSession({});
});

describe('ProtectedRoute', () => {
  it('redirects to login when there is no session', () => {
    renderGuard(<ProtectedRoute />, { entry: '/app', childPath: '/app' });
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('renders the child route when a live access token is present', () => {
    setSession({ accessToken: 'live-token', isAuthenticated: true, user: { id: 'u1' } });
    renderGuard(<ProtectedRoute />, { entry: '/app', childPath: '/app' });
    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });

  it('does not trust the persisted flag without a live token', () => {
    // This is the window between persist rehydration and AuthSessionBootstrap finishing:
    // isAuthenticated is restored from localStorage while accessToken is still null.
    setSession({ accessToken: null, isAuthenticated: true, user: { id: 'u1' } });
    renderGuard(<ProtectedRoute />, { entry: '/app', childPath: '/app' });
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('shows the loader while the session is still bootstrapping', () => {
    setSession({ isBootstrapping: true });
    renderGuard(<ProtectedRoute />, { entry: '/app', childPath: '/app' });
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
  });
});

describe('GuestRoute', () => {
  it('renders the guest screen when unauthenticated', () => {
    renderGuard(<GuestRoute />, { entry: '/login', childPath: '/login' });
    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });

  it('redirects an authenticated visitor to the app', () => {
    setSession({ accessToken: 'live-token', isAuthenticated: true, user: { id: 'u1' } });
    renderGuard(<GuestRoute />, { entry: '/login', childPath: '/login' });
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
    expect(screen.getByText('app shell')).toBeInTheDocument();
  });

  it('allows an authenticated visitor through when reauth is requested', () => {
    setSession({ accessToken: 'live-token', isAuthenticated: true, user: { id: 'u1' } });
    renderGuard(<GuestRoute />, { entry: '/login?reauth=1', childPath: '/login' });
    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });

  it('shows the loader while the session is still bootstrapping', () => {
    setSession({ isBootstrapping: true });
    renderGuard(<GuestRoute />, { entry: '/login', childPath: '/login' });
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
  });
});
