import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuditLogScreen } from '@/features/admin/screens/AuditLogScreen';
import { useAuthStore } from '@/store/useAuthStore';

vi.mock('@/features/admin/hooks/useActions', () => ({
  useActions: () => ({
    rows: [],
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/admin/hooks/useVocabularies', () => ({
  useVocabularies: () => ({
    moderationActions: [],
    actionLabel: (key) => key,
    actionKnown: () => true,
  }),
}));

vi.mock('@/features/admin/hooks/useResolveUsername', () => ({
  useResolveUsername: () => ({ username: null }),
}));

const NOTE = 'new actions can take a few seconds to appear here.';

const renderScreen = (role) => {
  useAuthStore.setState({ role });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuditLogScreen />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AuditLogScreen replication note', () => {
  beforeEach(() => {
    useAuthStore.setState({ role: null });
  });

  it.each([
    ['admin', 'action log'],
    ['moderator', 'my actions'],
  ])('renders the note for the %s role under the date range hints', (role, title) => {
    renderScreen(role);

    expect(screen.getByText(title)).toBeTruthy();
    const note = screen.getByText(NOTE);
    expect(note).toBeTruthy();

    const hint = screen.getByText(/no time window is applied/i);
    expect(note.tagName).toBe('P');
    expect(note.style.fontSize).toBe(hint.style.fontSize);
    expect(note.style.color).toBe(hint.style.color);
    expect(note.style.fontFamily).toBe(hint.style.fontFamily);
    expect(hint.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
