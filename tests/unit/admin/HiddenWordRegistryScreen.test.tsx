import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { hiddenWordsApi } from '@/features/admin/api/hiddenWords';
import { HiddenWordRegistryScreen } from '@/features/admin/screens/HiddenWordRegistryScreen';
import { toast } from '@/features/luvax/components/Toast';

vi.mock('@/features/admin/api/hiddenWords', () => ({
  hiddenWordsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/features/luvax/components/Toast', () => ({ toast: vi.fn() }));

vi.mock('@/features/admin/hooks/useResolveUsername', () => ({
  useResolveUsername: (id: string | null | undefined) => ({
    username: id === 'admin-1' ? 'admin.ha' : null,
  }),
  shortId: (id: string | null | undefined) => (id ?? '').slice(0, 8),
}));

const api = vi.mocked(hiddenWordsApi);

const entry = (over: Partial<Record<string, string | null>> = {}) => ({
  id: 'w1',
  phrase: 'câm mồm',
  normalizedPhrase: 'cam mom',
  createdBy: 'admin-1',
  createdAt: '2026-10-02T08:00:00Z',
  updatedAt: '2026-10-02T08:00:00Z',
  ...over,
});

const page = (content: ReturnType<typeof entry>[], hasNextPage = false) => ({
  content,
  pageInfo: {
    hasNextPage,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: hasNextPage ? 'next' : null,
  },
  degraded: false,
});

const apiError = (code: string, message = 'server said no') =>
  Object.assign(new Error(message), { response: { status: 400, data: { code, message } } });

const renderScreen = (ui: ReactNode = <HiddenWordRegistryScreen />) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

// user-event is not a dependency of this project, so the two interactions the screen needs are
// expressed with fireEvent; typing appends to the current value like a keyboard would.
const userEvent = {
  setup: () => ({
    click: async (element: Element) => {
      fireEvent.click(element);
    },
    type: async (element: Element, text: string) => {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      fireEvent.change(field, { target: { value: field.value + text } });
    },
  }),
};

const openEdit = async (user: ReturnType<typeof userEvent.setup>, phrase: string) => {
  await user.click(await screen.findByRole('button', { name: `edit ${phrase}` }));
  return screen.getByRole('complementary', { name: 'edit word' });
};

beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue(page([entry()]));
});

describe('HiddenWordRegistryScreen list', () => {
  it('renders a row with the phrase, what it matches, who added it and when', async () => {
    api.list.mockResolvedValue(
      page([
        entry(),
        entry({ id: 'w2', phrase: 'l0ser', normalizedPhrase: 'loser', createdBy: null }),
      ])
    );
    renderScreen();

    expect(await screen.findByText('câm mồm')).toBeInTheDocument();
    expect(screen.getByText('cam mom')).toBeInTheDocument();
    expect(screen.getByText('admin.ha')).toBeInTheDocument();
    expect(screen.getByText('l0ser')).toBeInTheDocument();
    expect(screen.getByText('loser')).toBeInTheDocument();
    expect(screen.getByText('removed account')).toBeInTheDocument();
    for (const header of ['word or phrase', 'matches', 'added by', 'updated']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'hidden words' })).toBeInTheDocument();
  });

  it('shows a loading state while the first page loads', () => {
    api.list.mockReturnValue(new Promise(() => undefined));
    renderScreen();
    expect(screen.queryByText('câm mồm')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an empty state when there are no words and none is being searched', async () => {
    api.list.mockResolvedValue(page([]));
    renderScreen();
    expect(await screen.findByText('no hidden words yet')).toBeInTheDocument();
  });

  it('shows a failure state with a retry that reloads the list', async () => {
    const user = userEvent.setup();
    // The panel retry policy allows one retry with the default backoff, so the failure state
    // appears after about a second.
    api.list.mockRejectedValue(new Error('network down'));
    renderScreen();

    expect(await screen.findByText('network down', {}, { timeout: 4000 })).toBeInTheDocument();
    api.list.mockResolvedValue(page([entry()]));
    await user.click(screen.getByRole('button', { name: 'try again' }));
    expect(await screen.findByText('câm mồm')).toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    const user = userEvent.setup();
    api.list
      .mockResolvedValueOnce(page([entry()], true))
      .mockResolvedValueOnce(page([entry({ id: 'w2', phrase: 'free followers' })]));
    renderScreen();

    await user.click(await screen.findByRole('button', { name: /load more/i }));
    expect(await screen.findByText('free followers')).toBeInTheDocument();
    expect(api.list).toHaveBeenLastCalledWith({ q: '', cursor: 'next', limit: 20 });
  });

  it('searches by the typed term and words the empty result for a search', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    api.list.mockResolvedValue(page([]));
    await user.type(screen.getByPlaceholderText('search words'), 'zzz');

    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ q: 'zzz', cursor: undefined, limit: 20 })
    );
    expect(await screen.findByText('no words match')).toBeInTheDocument();
  });
});

describe('HiddenWordRegistryScreen add', () => {
  it('opens the side form, previews the normalised form and creates with the reason', async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(entry({ id: 'w9', phrase: 'Đồ Ngu', normalizedPhrase: 'do ngu' }));
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), 'Đồ Ngu');
    expect(within(form).getByText('Matches "do ngu".')).toBeInTheDocument();

    await user.type(within(form).getByLabelText('reason'), '  Abuse reported repeatedly  ');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        phrase: 'Đồ Ngu',
        reason: 'Abuse reported repeatedly',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'add word' })).not.toBeInTheDocument()
    );
    expect(toast).toHaveBeenCalledWith('Hidden word added.');
  });

  it('refuses a missing reason before any request is made', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), 'loser');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(within(form).getByText('A reason is required.')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty phrase', '', 'Enter a word or phrase.'],
    ['a phrase of only punctuation', '...', 'Enter a word or phrase.'],
    [
      'a phrase of more than six words',
      'one two three four five six seven',
      'A hidden word must be 1 to 64 characters and contain 1 to 6 words.',
    ],
  ])('refuses %s before any request is made', async (_name, phrase, message) => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    if (phrase) {
      await user.type(within(form).getByLabelText('word or phrase'), phrase);
    }
    await user.type(within(form).getByLabelText('reason'), 'because');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(within(form).getByText(message)).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('shows a duplicate against the phrase field and keeps the form open', async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(apiError('HIDDEN_WORD_DUPLICATE'));
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), 'cam mom');
    await user.type(within(form).getByLabelText('reason'), 'again');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(
      await within(form).findByText('This phrase is already on the list.')
    ).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'add word' })).toBeInTheDocument();
  });

  it('closes the form on cancel without a request', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    await user.click(screen.getByRole('button', { name: 'cancel' }));

    expect(screen.queryByRole('complementary', { name: 'add word' })).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe('HiddenWordRegistryScreen edit and delete', () => {
  it('prefills the form from the row and updates with the reason', async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue(entry({ phrase: 'câm mồm đi' }));
    renderScreen();
    await screen.findByText('câm mồm');

    const form = await openEdit(user, 'câm mồm');
    const phrase = within(form).getByLabelText('word or phrase');
    expect(phrase).toHaveValue('câm mồm');
    expect(within(form).getByText('Matches "cam mom".')).toBeInTheDocument();

    await user.type(phrase, ' đi');
    await user.type(within(form).getByLabelText('reason'), 'Wider phrase');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('w1', {
        phrase: 'câm mồm đi',
        reason: 'Wider phrase',
      })
    );
    expect(toast).toHaveBeenCalledWith('Hidden word updated.');
  });

  it('refuses a save without a reason', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    const form = await openEdit(user, 'câm mồm');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(within(form).getByText('A reason is required.')).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('deletes with the reason and closes the form', async () => {
    const user = userEvent.setup();
    api.remove.mockResolvedValue(undefined);
    renderScreen();
    await screen.findByText('câm mồm');

    const form = await openEdit(user, 'câm mồm');
    await user.type(within(form).getByLabelText('reason'), 'Hid too many ordinary comments');
    await user.click(within(form).getByRole('button', { name: 'delete' }));

    await waitFor(() =>
      expect(api.remove).toHaveBeenCalledWith('w1', { reason: 'Hid too many ordinary comments' })
    );
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'edit word' })).not.toBeInTheDocument()
    );
    expect(toast).toHaveBeenCalledWith('Hidden word deleted.');
  });

  it('refuses a delete without a reason', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    const form = await openEdit(user, 'câm mồm');
    await user.click(within(form).getByRole('button', { name: 'delete' }));

    expect(within(form).getByText('A reason is required.')).toBeInTheDocument();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('reports a failed save against the form and keeps it open', async () => {
    const user = userEvent.setup();
    api.update.mockRejectedValue(apiError('HIDDEN_WORD_INVALID'));
    renderScreen();
    await screen.findByText('câm mồm');

    const form = await openEdit(user, 'câm mồm');
    await user.type(within(form).getByLabelText('reason'), 'edit');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(
      await within(form).findByText(
        'A hidden word must be 1 to 64 characters and contain 1 to 6 words.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'edit word' })).toBeInTheDocument();
  });
});

describe('HiddenWordRegistryScreen focus and announcements', () => {
  it('moves focus to the reason field when only the reason is missing', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), 'loser');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(within(form).getByLabelText('reason')).toHaveFocus();
    expect(within(form).getByLabelText('reason')).toHaveAccessibleDescription(
      'A reason is required.'
    );
  });

  it('moves focus to the phrase field when the phrase is the first error', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.click(within(form).getByRole('button', { name: 'save' }));

    expect(within(form).getByLabelText('word or phrase')).toHaveFocus();
    expect(within(form).getByLabelText('word or phrase')).toHaveAccessibleDescription(
      'Enter a word or phrase.'
    );
  });

  it('returns focus to the phrase field when the server refuses a duplicate', async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(apiError('HIDDEN_WORD_DUPLICATE'));
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), 'cam mom');
    await user.type(within(form).getByLabelText('reason'), 'again');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    await within(form).findByText('This phrase is already on the list.');
    await waitFor(() => expect(within(form).getByLabelText('word or phrase')).toHaveFocus());
  });

  it('announces the matched form in a polite live region', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), 'Đồ Ngu');

    expect(within(form).getByRole('status')).toHaveTextContent('Matches "do ngu".');
  });

  it('accepts a 40 character phrase of characters outside the basic plane', async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(entry({ id: 'w9' }));
    renderScreen();
    await screen.findByText('câm mồm');

    await user.click(screen.getByRole('button', { name: 'add word' }));
    const form = screen.getByRole('complementary', { name: 'add word' });
    await user.type(within(form).getByLabelText('word or phrase'), '\u{1D49C}'.repeat(40));
    await user.type(within(form).getByLabelText('reason'), 'because');
    await user.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() => expect(api.create).toHaveBeenCalled());
  });
});

describe('HiddenWordRegistryScreen stale rows', () => {
  it('reloads the list when a delete finds the word already gone', async () => {
    const user = userEvent.setup();
    api.remove.mockRejectedValue(
      Object.assign(new Error('gone'), {
        response: { status: 404, data: { code: 'HIDDEN_WORD_NOT_FOUND', message: 'gone' } },
      })
    );
    renderScreen();
    await screen.findByText('câm mồm');
    expect(api.list).toHaveBeenCalledTimes(1);

    const form = await openEdit(user, 'câm mồm');
    api.list.mockResolvedValue(page([]));
    await user.type(within(form).getByLabelText('reason'), 'cleanup');
    await user.click(within(form).getByRole('button', { name: 'delete' }));

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('no hidden words yet')).toBeInTheDocument();
  });
});
