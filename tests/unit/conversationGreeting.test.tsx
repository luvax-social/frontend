import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { ConversationGreeting } from '@/features/messages/components/ConversationGreeting';

const renderGreeting = (
  props: Omit<ComponentProps<typeof ConversationGreeting>, 'pending'> & { pending?: boolean }
) =>
  render(
    <MemoryRouter>
      <ConversationGreeting pending={false} {...props} />
    </MemoryRouter>
  );

describe('ConversationGreeting', () => {
  it('greets a conversation that has no messages', () => {
    renderGreeting({ messageCount: 0, name: 'Priya' });
    expect(screen.getByText(/connected on luvax/i)).toBeInTheDocument();
  });

  it('keeps the profile card once anything has been said', () => {
    renderGreeting({ messageCount: 1, name: 'Priya' });
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByText(/connected on luvax/i)).toBeInTheDocument();
  });

  it('shows the target instead of a connection message for a conversation that does not exist yet', () => {
    // "You're now connected" would be false here - a profile's "message" button reaches this state
    // whether or not the two people follow each other at all.
    renderGreeting({
      messageCount: 0,
      pending: true,
      name: 'Priya',
      username: 'priya_m',
      avatarUrl: null,
    });
    expect(screen.queryByText(/connected on luvax/i)).not.toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('priya_m · luvax')).toBeInTheDocument();
  });
});
