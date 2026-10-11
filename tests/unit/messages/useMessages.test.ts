import type { Message } from '@/features/messages/types';
import type { ApiResponse, CursorPage } from '@/types/api';
import { messageFixture } from '../../fixtures/domain';
import { describe, expect, it } from 'vitest';

import { mergeMessagePages } from '@/features/messages/hooks/useMessages';

const page = (
  content: Message[],
  cursor: string | null = null
): ApiResponse<CursorPage<Message>> => ({
  success: true,
  code: 'OK',
  message: 'OK',
  timestamp: '2026-09-01T00:00:00Z',
  data: {
    degraded: false,
    content,
    pageInfo: {
      endCursor: cursor,
      startCursor: null,
      hasPreviousPage: false,
      hasNextPage: Boolean(cursor),
    },
  },
});

const message = (id: string, createdAt: string, content = id) =>
  messageFixture({ id, createdAt, content });

describe('mergeMessagePages', () => {
  it('preserves loaded history when a refresh page no longer contains an older marker message', () => {
    const marker = message('marker', '2026-08-24T01:00:00.000Z', 'user 1 marker');
    const oldData = {
      pages: [page([message('old-newest', '2026-08-24T01:01:00.000Z'), marker])],
      pageParams: [null],
    };
    const newData = {
      pages: [
        page([
          message('spam-2', '2026-08-24T01:03:00.000Z'),
          message('spam-1', '2026-08-24T01:02:00.000Z'),
        ]),
      ],
      pageParams: [null],
    };

    const result = mergeMessagePages(oldData, newData);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].data.content.map((item) => item.id)).toEqual([
      'spam-2',
      'spam-1',
      'old-newest',
      'marker',
    ]);
  });

  it('uses the refreshed message when the same id is present in old and new pages', () => {
    const oldData = {
      pages: [page([message('same', '2026-08-24T01:00:00.000Z', 'old text')])],
      pageParams: [null],
    };
    const newData = {
      pages: [page([message('same', '2026-08-24T01:00:00.000Z', 'new text')])],
      pageParams: [null],
    };

    const result = mergeMessagePages(oldData, newData);

    expect(result.pages[0].data.content).toHaveLength(1);
    expect(result.pages[0].data.content[0].content).toBe('new text');
  });
});
