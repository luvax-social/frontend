import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { SearchResultPost } from '@/features/luvax/components/RecommendedPostsGrid';
import { postFixture, userSummary } from '../../fixtures/domain';

vi.mock('@/hooks/useImpressionTracking', () => ({
  useImpressionTracking: () => ({ ref: vi.fn() }),
}));

const post = postFixture({
  id: 'post-7',
  caption: 'a tile',
  tags: [],
  author: userSummary({ id: 'a1', username: 'a1' }),
});

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{JSON.stringify(location.state)}</div>;
}

const renderTile = (surface?: 'feed' | 'explore' | 'search') =>
  render(
    <MemoryRouter>
      <SearchResultPost post={post} surface={surface} />
      <Probe />
    </MemoryRouter>
  );

describe('post tiles hand their list to post detail', () => {
  it('records explore, so the detail menu can offer show fewer', () => {
    renderTile('explore');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('state').textContent).toContain('"feedSurface":"explore"');
  });

  it('records no feed surface from search', () => {
    renderTile('search');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('state').textContent).not.toContain('feedSurface');
  });

  it('records no feed surface for inline results with no surface', () => {
    renderTile();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('state').textContent).not.toContain('feedSurface');
  });
});
