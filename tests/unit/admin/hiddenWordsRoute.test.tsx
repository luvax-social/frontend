import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ROUTES } from '@/config/constants';
import { adminRoute } from '@/features/admin/adminRoutes';
import AdminOnlyRoute from '@/features/admin/guards/AdminOnlyRoute';
import { useAuthStore } from '@/store/useAuthStore';

interface RouteNode {
  path?: string;
  element?: ReactElement;
  children?: RouteNode[];
}

const adminShellChildren = (adminRoute as RouteNode).children![0].children!;
const adminOnlyBranch = adminShellChildren.find((node) => node.element?.type === AdminOnlyRoute);

describe('hidden words route', () => {
  beforeEach(() => {
    useAuthStore.setState({ role: null });
  });

  it('declares the path constants for the settings and admin screens', () => {
    expect(ROUTES.SETTINGS_MUTED).toBe('/app/settings/muted');
    expect(ROUTES.SETTINGS_HIDDEN_WORDS).toBe('/app/settings/hidden-words');
    expect(ROUTES.SETTINGS_LIMITS).toBe('/app/settings/limits');
    expect(ROUTES.ADMIN_HIDDEN_WORDS).toBe('/admin/hidden-words');
  });

  it('registers the registry only inside the administrator-only branch', () => {
    const relative = ROUTES.ADMIN_HIDDEN_WORDS.slice(ROUTES.ADMIN.length + 1);

    expect(adminOnlyBranch?.children?.map((node) => node.path)).toContain(relative);
    expect(adminShellChildren.some((node) => node.path === relative)).toBe(false);
  });

  it('refuses a moderator before the screen mounts', () => {
    useAuthStore.setState({ role: 'moderator' });
    render(
      <MemoryRouter initialEntries={[ROUTES.ADMIN_HIDDEN_WORDS]}>
        <Routes>
          <Route element={<AdminOnlyRoute />}>
            <Route path={ROUTES.ADMIN_HIDDEN_WORDS} element={<div>registry screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('registry screen')).not.toBeInTheDocument();
    expect(screen.getByText('this area is available to administrators only.')).toBeInTheDocument();
  });

  it('lets an administrator through', () => {
    useAuthStore.setState({ role: 'admin' });
    render(
      <MemoryRouter initialEntries={[ROUTES.ADMIN_HIDDEN_WORDS]}>
        <Routes>
          <Route element={<AdminOnlyRoute />}>
            <Route path={ROUTES.ADMIN_HIDDEN_WORDS} element={<div>registry screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('registry screen')).toBeInTheDocument();
  });
});
