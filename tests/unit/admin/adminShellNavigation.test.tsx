import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminShell from '@/features/admin/components/AdminShell';
import { useAuthStore } from '@/store/useAuthStore';

vi.mock('@/features/admin/hooks/useVocabularies', () => ({ useVocabularies: () => undefined }));
vi.mock('@/features/admin/hooks/useEscalatedCount', () => ({
  useEscalatedCount: () => ({ count: 0 }),
}));
vi.mock('@/api/authApi', () => ({
  authApi: { getCurrentUser: vi.fn().mockResolvedValue(null), logout: vi.fn() },
}));

const renderShell = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminShell />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  useAuthStore.setState({ role: null });
});

describe('admin sidebar hidden words entry', () => {
  it('is shown to an administrator', () => {
    useAuthStore.setState({ role: 'admin' });
    renderShell();
    expect(screen.getByRole('link', { name: 'hidden words' })).toHaveAttribute(
      'href',
      '/admin/hidden-words'
    );
  });

  it('is not shown to a moderator, who cannot open the registry', () => {
    useAuthStore.setState({ role: 'moderator' });
    renderShell();
    expect(screen.getByRole('link', { name: 'reports' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'hidden words' })).not.toBeInTheDocument();
  });

  it('uses an icon of its own rather than the statistics eye', () => {
    useAuthStore.setState({ role: 'admin' });
    renderShell();
    const iconMarkup = (name: string) =>
      screen.getByRole('link', { name }).querySelector('svg')?.innerHTML;
    expect(iconMarkup('hidden words')).toBeTruthy();
    expect(iconMarkup('hidden words')).not.toBe(iconMarkup('statistics'));
  });
});
