import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { HiddenWordsCategory } from '@/features/luvax/components/settings/HiddenWordsCategory';
import * as userService from '@/services/user.service';

import { apiError, envelope, settingsFixture } from './settingsFixtures';
import { hiddenWordEntry, hiddenWordList } from './safetyFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);

const renderCategory = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<HiddenWordsCategory />, { wrapper });
};

const input = () => screen.getByRole('textbox', { name: 'add a word or phrase' });
const addButton = () => screen.getByRole('button', { name: 'add' });

const loaded = async (phrases = ['spam link', 'Đồ điên', 'idiot']) => {
  service.getMyHiddenWords.mockResolvedValue(envelope(hiddenWordList(phrases)));
  renderCategory();
  await screen.findByText(`${phrases.length} of 200`);
};

const type = (value: string) => fireEvent.change(input(), { target: { value } });

// The server's copy of the settings, so a refetch after a save returns what it really holds.
let stored = settingsFixture();

beforeEach(() => {
  vi.resetAllMocks();
  stored = settingsFixture();
  service.getMySettings.mockImplementation(async () => envelope({ ...stored }));
  service.updateMySettings.mockImplementation(async (patch) => {
    if (typeof patch.hiddenWordsSystemEnabled === 'boolean') {
      stored = { ...stored, hiddenWordsSystemEnabled: patch.hiddenWordsSystemEnabled };
    }
    return envelope({ ...stored });
  });
});

describe('hidden words: the luvax list', () => {
  it('shows the switch on by default and saves a change on its own', async () => {
    await loaded();
    const toggle = screen.getByRole('switch', { name: 'use the luvax list' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(service.updateMySettings).toHaveBeenCalledWith({ hiddenWordsSystemEnabled: false });
  });

  it('puts the switch back and reports the failure when the save is refused', async () => {
    service.updateMySettings.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    await loaded();
    const toggle = screen.getByRole('switch', { name: 'use the luvax list' });
    await waitFor(() => expect(toggle).toBeEnabled());

    fireEvent.click(toggle);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't save that just now. Try again in a moment."
    );
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

describe('hidden words: the personal list', () => {
  it('lists each entry as a removable chip with the count against the limit', async () => {
    await loaded();

    const list = screen.getByRole('list', { name: 'your hidden words' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['spam link', 'Đồ điên', 'idiot']);
    expect(screen.getByRole('button', { name: 'remove idiot' })).toBeInTheDocument();
    expect(screen.getByText('3 of 200')).toBeInTheDocument();
  });

  it('previews the normalised form beside the field as the person types', async () => {
    await loaded();

    expect(screen.queryByText(/^Matches/)).toBeNull();
    type('Đồ ngu!');

    expect(
      screen.getByText(
        'Matches "do ngu", including accented, capitalised and number-swapped spellings.'
      )
    ).toBeInTheDocument();
  });

  it('keeps add disabled while nothing would be matched', async () => {
    await loaded();

    expect(addButton()).toBeDisabled();
    type('   ');
    expect(addButton()).toBeDisabled();
    type('!!!');
    expect(addButton()).toBeDisabled();
    type('rude');
    expect(addButton()).toBeEnabled();
  });

  it('adds a phrase optimistically and keeps the server row', async () => {
    service.addHiddenWord.mockResolvedValue(envelope(hiddenWordEntry('new-id', 'cam mom')));
    await loaded();

    type('  cam mom ');
    fireEvent.click(addButton());

    await screen.findByText('4 of 200');
    expect(service.addHiddenWord).toHaveBeenCalledWith('cam mom');
    expect(input()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'remove cam mom' })).toBeInTheDocument();
  });

  it('submits with the enter key', async () => {
    service.addHiddenWord.mockResolvedValue(envelope(hiddenWordEntry('new-id', 'rude')));
    await loaded();

    type('rude');
    fireEvent.submit(input().closest('form') as HTMLFormElement);

    await waitFor(() => expect(service.addHiddenWord).toHaveBeenCalledWith('rude'));
  });

  it('refuses a duplicate of an existing entry before any request is made', async () => {
    await loaded(['do dien', 'idiot']);

    type('Đỏ ĐIÊN!');
    fireEvent.click(addButton());

    expect(await screen.findByText('You already hide "do dien".')).toBeInTheDocument();
    expect(service.addHiddenWord).not.toHaveBeenCalled();
    expect(input()).toHaveValue('Đỏ ĐIÊN!');
  });

  it('treats number-swapped spellings as the same entry', async () => {
    await loaded(['idiot']);

    type('1d10t');
    fireEvent.click(addButton());

    expect(await screen.findByText('You already hide "idiot".')).toBeInTheDocument();
    expect(service.addHiddenWord).not.toHaveBeenCalled();
  });

  it('shows the server duplicate answer inline and rolls the row back', async () => {
    service.addHiddenWord.mockRejectedValue(apiError('HIDDEN_WORD_DUPLICATE', 409));
    await loaded();

    type('newly typed');
    fireEvent.click(addButton());

    expect(await screen.findByText('You already hide "newly typed".')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3 of 200')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'remove newly typed' })).toBeNull();
    expect(input()).toHaveValue('newly typed');
  });

  it('says the list is full when the server answers HIDDEN_WORD_LIMIT_REACHED', async () => {
    service.addHiddenWord.mockRejectedValue(apiError('HIDDEN_WORD_LIMIT_REACHED', 422));
    await loaded();

    type('one more');
    fireEvent.click(addButton());

    expect(
      await screen.findByText('Your list is full. Remove a word to add another.')
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3 of 200')).toBeInTheDocument());
  });

  it('explains the bounds when the server answers HIDDEN_WORD_INVALID', async () => {
    service.addHiddenWord.mockRejectedValue(apiError('HIDDEN_WORD_INVALID', 400));
    await loaded();

    type('a b c d e f g');
    fireEvent.click(addButton());

    expect(
      await screen.findByText('Use 1 to 64 characters that make up 1 to 6 words.')
    ).toBeInTheDocument();
  });

  it('falls back to a generic sentence for any other failure', async () => {
    service.addHiddenWord.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    await loaded();

    type('rude');
    fireEvent.click(addButton());

    expect(
      await screen.findByText("We couldn't add that just now. Try again in a moment.")
    ).toBeInTheDocument();
  });

  it('clears an inline error as soon as the person edits the field', async () => {
    await loaded(['idiot']);
    type('idiot');
    fireEvent.click(addButton());
    await screen.findByText('You already hide "idiot".');

    type('idiots');

    expect(screen.queryByText('You already hide "idiot".')).toBeNull();
  });

  it('removes a chip at once and sends the entry id', async () => {
    service.removeHiddenWord.mockResolvedValue(undefined);
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'remove idiot' }));

    await screen.findByText('2 of 200');
    expect(service.removeHiddenWord).toHaveBeenCalledWith('w3');
    expect(screen.queryByRole('button', { name: 'remove idiot' })).toBeNull();
  });

  it('restores a chip and says so when the removal fails', async () => {
    service.removeHiddenWord.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'remove idiot' }));

    expect(
      await screen.findByText("We couldn't remove that just now. Try again in a moment.")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'remove idiot' })).toBeInTheDocument()
    );
    expect(screen.getByText('3 of 200')).toBeInTheDocument();
  });

  it('shows an empty state sentence when there are no entries', async () => {
    service.getMyHiddenWords.mockResolvedValue(envelope(hiddenWordList([])));
    renderCategory();

    expect(await screen.findByText('0 of 200')).toBeInTheDocument();
    expect(screen.getByText('You have not added any words yet.')).toBeInTheDocument();
  });

  it('blocks adding once the list holds the limit', async () => {
    service.getMyHiddenWords.mockResolvedValue(envelope(hiddenWordList(['a', 'b'], 2)));
    renderCategory();
    await screen.findByText('2 of 2');

    type('rude');

    expect(addButton()).toBeDisabled();
    expect(
      screen.getByText('Your list is full. Remove a word to add another.')
    ).toBeInTheDocument();
  });
});

describe('hidden words: links between the field and its messages', () => {
  it('describes the field by the preview and by an error once there is one', async () => {
    await loaded(['do dien']);

    type('Đồ ngu!');
    const preview = screen.getByText(/^Matches/);
    expect(input().getAttribute('aria-describedby')).toBe(preview.id);

    type('do dien');
    fireEvent.click(addButton());
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('You already hide "do dien".');
    expect(input()).toHaveAttribute('aria-errormessage', error.id);
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(input().getAttribute('aria-describedby')?.split(' ')).toEqual(
      expect.arrayContaining([screen.getByText(/^Matches/).id, error.id])
    );
  });

  it('does not point at messages that are not there', async () => {
    await loaded();

    expect(input()).not.toHaveAttribute('aria-describedby');
    expect(input()).not.toHaveAttribute('aria-errormessage');
  });

  it('announces a failed removal as an alert', async () => {
    service.removeHiddenWord.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'remove idiot' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't remove that just now. Try again in a moment."
    );
  });
});

describe('hidden words: focus', () => {
  const press = (name: string) => {
    const button = screen.getByRole('button', { name });
    button.focus();
    fireEvent.click(button);
  };

  it('returns to the add field after a word is added', async () => {
    service.addHiddenWord.mockResolvedValue(envelope(hiddenWordEntry('new-id', 'rude')));
    await loaded();

    type('rude');
    press('add');

    await screen.findByText('4 of 200');
    expect(input()).toHaveFocus();
  });

  it('moves to the next chip after a chip is removed', async () => {
    service.removeHiddenWord.mockResolvedValue(undefined);
    await loaded();

    press('remove spam link');

    await screen.findByText('2 of 200');
    expect(screen.getByRole('button', { name: 'remove Đồ điên' })).toHaveFocus();
  });

  it('moves to the previous chip when the last chip is removed', async () => {
    service.removeHiddenWord.mockResolvedValue(undefined);
    await loaded();

    press('remove idiot');

    await screen.findByText('2 of 200');
    expect(screen.getByRole('button', { name: 'remove Đồ điên' })).toHaveFocus();
  });

  it('moves to the add field when the only chip is removed', async () => {
    service.removeHiddenWord.mockResolvedValue(undefined);
    await loaded(['idiot']);

    press('remove idiot');

    await screen.findByText('0 of 200');
    expect(input()).toHaveFocus();
  });
});

describe('hidden words: a failed background refetch', () => {
  it('keeps the cached list on screen instead of replacing it with the load error', async () => {
    service.getMyHiddenWords.mockResolvedValue(envelope(hiddenWordList(['spam link'])));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <HiddenWordsCategory />
      </QueryClientProvider>
    );
    await screen.findByText('1 of 200');

    service.getMyHiddenWords.mockRejectedValue(apiError('INTERNAL_ERROR', 500));
    await queryClient.invalidateQueries({ queryKey: ['users', 'me', 'hiddenWords'] });

    await waitFor(() => expect(service.getMyHiddenWords).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('we could not load your hidden words')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'remove spam link' })).toBeInTheDocument();
  });
});
