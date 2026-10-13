import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SettingsScreen } from '@/features/luvax/components/SettingsScreen';
import {
  resolveCategory,
  SETTINGS_CATEGORIES,
  SETTINGS_GROUPS,
} from '@/features/luvax/components/settingsCatalog';
import { ROUTES } from '@/config/constants';
import * as userService from '@/services/user.service';

import { envelope, settingsFixture } from './settingsFixtures';
import { hiddenWordList, limitFixture } from './safetyFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);

const audience = () => SETTINGS_GROUPS.find((group) => group.id === 'audience')!;

const renderAt = (path: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(
    <Routes>
      <Route path={ROUTES.SETTINGS_CATEGORY} element={<SettingsScreen />} />
    </Routes>,
    { wrapper }
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  service.getMySettings.mockResolvedValue(envelope(settingsFixture()));
  service.getMyHiddenWords.mockResolvedValue(envelope(hiddenWordList(['idiot'])));
  service.getMyInteractionLimit.mockResolvedValue(envelope(limitFixture()));
});

describe('settings catalog: interaction controls', () => {
  it('lists hidden words and limit interactions in who can see your content', () => {
    const entries = audience().categories.map((category) => [category.id, category.label]);

    expect(entries).toContainEqual(['hidden-words', 'hidden words']);
    expect(entries).toContainEqual(['limits', 'limit interactions']);
  });

  it('files each one at its route constant', () => {
    expect(resolveCategory('hidden-words')?.path).toBe(ROUTES.SETTINGS_HIDDEN_WORDS);
    expect(resolveCategory('limits')?.path).toBe(ROUTES.SETTINGS_LIMITS);
  });

  it('gives every category an address that ends in its own id', () => {
    for (const category of SETTINGS_CATEGORIES) {
      expect(category.path.endsWith(`/${category.id}`)).toBe(true);
    }
  });
});

describe('settings screen: interaction controls', () => {
  it('renders the hidden words category at its address', async () => {
    renderAt(ROUTES.SETTINGS_HIDDEN_WORDS);

    expect(
      await screen.findByRole('heading', { name: 'hidden words', level: 2 })
    ).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: 'use the luvax list' })).toBeInTheDocument();
  });

  it('renders the limit interactions category at its address', async () => {
    renderAt(ROUTES.SETTINGS_LIMITS);

    expect(
      await screen.findByRole('heading', { name: 'limit interactions', level: 2 })
    ).toBeInTheDocument();
    expect(await screen.findByRole('radiogroup', { name: 'for how long' })).toBeInTheDocument();
  });
});
