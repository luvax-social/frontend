import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/features/luvax/components/PostCard', () => ({
  PostCard: ({ post }) => <div data-testid={`post-${post.id}`} />,
}));

const { FeedInjectedList } = await import('@/features/luvax/components/FeedScreen');

const posts = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));

const renderList = (props) =>
  render(
    <MemoryRouter>
      <FeedInjectedList
        posts={posts(9)}
        cards={{ stories: () => null, people: () => null, hashtags: () => null }}
        availability={{ stories: 0, people: false, hashtags: false }}
        tweaks={{ density: 'default', showTags: true }}
        viewport="desktop"
        betweenPosts={56}
        {...props}
      />
    </MemoryRouter>
  );

describe('FeedInjectedList', () => {
  it('renders every post when no card has data', () => {
    renderList();
    expect(screen.getAllByTestId(/^post-/)).toHaveLength(9);
  });

  it('places a card among the posts when one has data', () => {
    renderList({
      cards: {
        stories: (i) => <div data-testid={`story-card-${i}`} />,
        people: () => null,
        hashtags: () => null,
      },
      availability: { stories: 1, people: false, hashtags: false },
    });
    expect(screen.getByTestId('story-card-0')).toBeTruthy();
    expect(screen.getAllByTestId(/^post-/)).toHaveLength(9);
  });

  it('never drops a post to make room for a card', () => {
    renderList({
      cards: {
        stories: () => <div data-testid="story-card" />,
        people: () => <div data-testid="people-card" />,
        hashtags: () => null,
      },
      availability: { stories: 1, people: true, hashtags: false },
    });
    posts(9).forEach((post) => expect(screen.getByTestId(`post-${post.id}`)).toBeTruthy());
  });

  it('honours a dismissed card type in every slot', () => {
    renderList({
      cards: {
        stories: () => <div data-testid="story-card" />,
        people: () => <div data-testid="people-card" />,
        hashtags: () => null,
      },
      availability: { stories: 1, people: true, hashtags: false },
      dismissed: ['stories'],
    });
    expect(screen.queryByTestId('story-card')).toBeNull();
    expect(screen.getAllByTestId('people-card').length).toBeGreaterThan(0);
  });

  it('renders an empty feed without crashing', () => {
    const { container } = renderList({ posts: [] });
    expect(container.querySelectorAll('[data-testid^="post-"]')).toHaveLength(0);
  });
});
