import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConvRow } from '@/features/messages/components/ConvRow';
import { toThreadSummary } from '@/features/messages/utils/messageViewModel';
import { conversationFixture, participantFixture } from '../../fixtures/domain';

describe('conversation preview separator', () => {
  it.each([
    ['', '', ''],
    ['hello', '', 'hello'],
    ['', '10:15', '10:15'],
    ['hello', '10:15', 'hello · 10:15'],
  ])('joins preview %j and time %j without an empty separator', (preview, time, expected) => {
    const thread = toThreadSummary(
      conversationFixture({
        participants: [participantFixture({ userId: 'other', displayName: 'Priya' })],
      }),
      'me'
    );
    render(<ConvRow thread={{ ...thread, preview, time }} isActive={false} viewport="desktop" />);
    const previewLine = screen.getByText('Priya').closest('div')!.nextElementSibling!;
    expect(previewLine.textContent).toBe(expected);
  });
});
