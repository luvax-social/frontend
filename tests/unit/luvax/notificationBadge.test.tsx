import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationBadge } from '@/features/luvax/notifications/NotificationBadge';

describe('NotificationBadge', () => {
  it('renders nothing at 0', () => {
    const { container } = render(<NotificationBadge count={0} capped={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the number when not capped', () => {
    render(<NotificationBadge count={7} capped={false} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders 99+ when capped', () => {
    render(<NotificationBadge count={99} capped />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('carries an aria-label naming the count', () => {
    render(<NotificationBadge count={5} capped={false} />);
    expect(screen.getByLabelText('5 new notifications')).toBeInTheDocument();
  });

  it('the aria-label says 99+ new notifications when capped', () => {
    render(<NotificationBadge count={99} capped />);
    expect(screen.getByLabelText('99+ new notifications')).toBeInTheDocument();
  });
});
