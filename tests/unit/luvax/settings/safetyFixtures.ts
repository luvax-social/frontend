import type { ApiResponse, CursorPage } from '@/types/api';
import type {
  HiddenWordEntryResponse,
  HiddenWordListResponse,
  InteractionLimitResponse,
  MuteResponse,
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

export const muteFixture = (
  userId: string,
  username: string,
  mutePosts: boolean,
  muteStories: boolean
): MuteResponse => ({
  userId,
  mutePosts,
  muteStories,
  user: {
    id: userId,
    username,
    displayName: username
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    avatarUrl: null,
    isVerified: false,
    verifiedCategory: null,
  },
});

export const mutePage = (
  rows: MuteResponse[],
  endCursor: string | null = null
): ApiResponse<CursorPage<MuteResponse>> => ({
  success: true,
  code: 'OK',
  message: 'ok',
  data: {
    content: rows,
    pageInfo: {
      hasNextPage: endCursor !== null,
      hasPreviousPage: false,
      startCursor: null,
      endCursor,
    },
    degraded: false,
  },
  timestamp: '2026-10-14T00:00:00Z',
});
