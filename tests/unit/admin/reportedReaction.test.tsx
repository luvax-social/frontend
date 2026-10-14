import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReportedReaction } from '@/features/admin/components/ReportedReaction';
import type { AdminReportTargetResponse } from '@/types/admin';

const THUMBS_UP = '👍';

const target = (overrides: Partial<AdminReportTargetResponse> = {}): AdminReportTargetResponse => ({
  reportType: 'message_reaction',
  entityId: 'r1',
  ownerId: 'user-1',
  ownerUsername: 'troll.acc',
  status: null,
  text: 'minh vua dang anh',
  mediaUrls: [],
  removed: false,
  createdAt: '2026-10-09T10:14:00Z',
  emoji: THUMBS_UP,
  ...overrides,
});

describe('ReportedReaction', () => {
  it('shows the emoji, who reacted and the message it sits on', () => {
    render(<ReportedReaction target={target()} />);
    expect(screen.getByText('reported reaction')).toBeInTheDocument();
    expect(screen.getByText(THUMBS_UP)).toBeInTheDocument();
    expect(screen.getByText('@troll.acc')).toBeInTheDocument();
    expect(screen.getByText(/reacted/)).toBeInTheDocument();
    expect(screen.getByText('on this message')).toBeInTheDocument();
    expect(screen.getByText('minh vua dang anh')).toBeInTheDocument();
  });

  it('says so when the message has no text left to quote', () => {
    render(<ReportedReaction target={target({ text: null })} />);
    expect(screen.getByText('The message is no longer shown.')).toBeInTheDocument();
  });

  it('marks an already removed reaction', () => {
    render(<ReportedReaction target={target({ removed: true })} />);
    expect(screen.getByText('removed')).toBeInTheDocument();
  });

  it('falls back to the account id when the username is gone', () => {
    render(<ReportedReaction target={target({ ownerUsername: null, ownerId: 'abcdef12-3456' })} />);
    expect(screen.getByText('abcdef12')).toBeInTheDocument();
  });
});
