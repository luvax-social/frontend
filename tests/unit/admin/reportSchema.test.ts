import { describe, expect, it, vi } from 'vitest';

import {
  removeConfirmDescription,
  removeSuccessMessage,
  restoreConfirmDescription,
  restoreSuccessMessage,
} from '@/features/admin/lib/contentModeration';
import {
  ACTIONABLE_TARGET_TYPES,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  contentNoun,
} from '@/features/admin/lib/reportSchema';
import { adminApi } from '@/features/admin/api/adminApi';
import { axiosClient } from '@/api/axiosClient';
import { REPORT_TYPES as SUBMIT_REPORT_TYPES } from '@/services/report.service';
import type { AdminActionType } from '@/types/admin';

vi.mock('@/api/axiosClient', () => ({
  axiosClient: { patch: vi.fn(), get: vi.fn(), post: vi.fn() },
  publicClient: { get: vi.fn(), post: vi.fn() },
}));

describe('report types', () => {
  it('lists a message reaction as a reportable type with a label', () => {
    expect(REPORT_TYPES).toContain('message_reaction');
    REPORT_TYPES.forEach((type) => expect(REPORT_TYPE_LABELS[type]).toBeTruthy());
    expect(REPORT_TYPE_LABELS.message_reaction).toBe('message reaction');
  });

  it('can be submitted by a reader as message_reaction', () => {
    expect(SUBMIT_REPORT_TYPES.MESSAGE_REACTION).toBe('message_reaction');
  });

  it('removes and restores a reaction but never an account', () => {
    expect(ACTIONABLE_TARGET_TYPES.has('message_reaction')).toBe(true);
    expect(ACTIONABLE_TARGET_TYPES.has('user')).toBe(false);
  });

  it('names a reaction "reaction" in controls and keeps other type names', () => {
    expect(contentNoun('message_reaction')).toBe('reaction');
    expect(contentNoun('message')).toBe('message');
    expect(contentNoun('post')).toBe('post');
  });
});

describe('reaction moderation copy', () => {
  it('says what removing a reaction takes away and that the reason is recorded', () => {
    expect(removeConfirmDescription('message_reaction')).toContain('reaction');
    expect(removeConfirmDescription('message_reaction')).toContain('the reason is recorded');
    expect(removeSuccessMessage('message_reaction')).toBe('reaction removed');
  });

  it('says a restore returns the reaction with its original emoji', () => {
    expect(restoreConfirmDescription('message_reaction')).toContain('original emoji');
    expect(restoreSuccessMessage('message_reaction', null)).toBe('reaction restored');
  });
});

describe('moderation action vocabulary', () => {
  it('knows the five actions added with reaction moderation and hidden words', () => {
    const added: AdminActionType[] = [
      'create_hidden_word',
      'edit_hidden_word',
      'delete_hidden_word',
      'remove_message_reaction',
      'restore_message_reaction',
    ];
    expect(new Set(added).size).toBe(5);
  });
});

describe('adminApi reaction moderation', () => {
  it('removes a reaction through its own endpoint, anchored on the report', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { data: { id: 'a1' } } });

    await adminApi.removeMessageReaction('r1', 'harassment', 'report-1');

    expect(axiosClient.patch).toHaveBeenCalledWith('/admin/message-reactions/r1/remove', {
      reason: 'harassment',
      reportId: 'report-1',
    });
  });

  it('restores a reaction through its own endpoint', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { data: { id: 'a2' } } });

    await adminApi.restoreMessageReaction('r1', 'reviewed again', 'report-1');

    expect(axiosClient.patch).toHaveBeenCalledWith('/admin/message-reactions/r1/restore', {
      reason: 'reviewed again',
      reportId: 'report-1',
    });
  });
});
