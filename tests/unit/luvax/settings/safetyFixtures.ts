import type {
  HiddenWordEntryResponse,
  HiddenWordListResponse,
  InteractionLimitResponse,
} from '@/types/domain';

export const hiddenWordEntry = (id: string, phrase = id): HiddenWordEntryResponse => ({
  id,
  phrase,
  createdAt: '2026-10-01T00:00:00Z',
});

export const hiddenWordList = (phrases: string[], limit = 200): HiddenWordListResponse => ({
  entries: phrases.map((phrase, index) => hiddenWordEntry(`w${index + 1}`, phrase)),
  limit,
});

export const limitFixture = (
  overrides: Partial<InteractionLimitResponse> = {}
): InteractionLimitResponse => ({
  limitNonFollowers: false,
  limitRecentFollowers: false,
  expiresAt: null,
  active: false,
  ...overrides,
});
