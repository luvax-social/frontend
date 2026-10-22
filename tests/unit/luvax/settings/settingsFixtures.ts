import type { ApiResponse } from '@/types/api';
import type { UserSettingsResponse } from '@/types/domain';

export const envelope = <T>(data: T): ApiResponse<T> => ({
  success: true,
  code: 'OK',
  message: 'ok',
  data,
  timestamp: '2026-10-14T00:00:00Z',
});

export const settingsFixture = (
  overrides: Partial<UserSettingsResponse> = {}
): UserSettingsResponse => ({
  notifyLikes: true,
  notifyComments: true,
  notifyFollows: true,
  notifyMentions: true,
  notifyMessages: true,
  showActivityStatus: true,
  allowStoryReplies: true,
  messagePermission: 'everyone',
  suggestible: true,
  hiddenWordsSystemEnabled: true,
  tagPermission: 'everyone',
  manualTagApproval: false,
  updatedAt: '2026-10-14T00:00:00Z',
  ...overrides,
});

/** An axios-shaped failure carrying the backend error code the interceptor preserves. */
export const apiError = (code: string, status: number) =>
  Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: code } },
  });
