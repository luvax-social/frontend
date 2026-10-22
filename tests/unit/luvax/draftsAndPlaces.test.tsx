import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftsPanel } from '@/features/luvax/components/composer/DraftsPanel';
import { PlacePicker } from '@/features/luvax/components/composer/PlacePicker';
import * as postService from '@/services/post.service';
import * as placeService from '@/services/place.service';
import { postFixture } from '../../fixtures/domain';

vi.mock('@/services/post.service');
vi.mock('@/services/place.service');

const posts = vi.mocked(postService);
const places = vi.mocked(placeService);

const envelope = <T,>(data: T) => ({
  success: true,
  code: 'OK',
  message: 'ok',
  data,
  timestamp: '',
});

const page = <T,>(content: T[]) =>
  envelope({ content, pageInfo: { hasNextPage: false, hasPreviousPage: false } });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('DraftsPanel', () => {
  const draft = postFixture({ id: 'd1', status: 'draft', caption: 'Morning at the beach' });
  const scheduled = postFixture({
    id: 's1',
    status: 'scheduled',
    caption: 'Launch day',
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
  });

  const open = () => {
    posts.getMyPostCounts.mockResolvedValue(
      envelope({ draft: 12, scheduled: 3, archived: 0, limit: 50 })
    );
    posts.getMyPosts.mockImplementation(async ({ status }) =>
      page(status === 'scheduled' ? [scheduled] : [draft])
    );
    const onResume = vi.fn();
    const onClose = vi.fn();
    render(<DraftsPanel onResume={onResume} onClose={onClose} />, { wrapper });
    return { onResume, onClose };
  };

  it('states the shared limit with the numbers the server reported', async () => {
    open();

    expect(await screen.findByTestId('drafts-limit')).toHaveTextContent(
      '15 of 50 used. Drafts and scheduled posts share the limit.'
    );
  });

  it('hands a draft to the composer when resume is chosen', async () => {
    const { onResume } = open();

    fireEvent.click(await screen.findByRole('button', { name: 'resume' }));

    expect(onResume).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('asks before deleting and deletes only on confirmation', async () => {
    posts.deletePost.mockResolvedValue(envelope(null));
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'delete draft' }));
    expect(posts.deletePost).not.toHaveBeenCalled();
    expect(screen.getByText('delete this draft?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    await waitFor(() => expect(posts.deletePost).toHaveBeenCalledWith('d1'));
  });

  it('keeps the draft when the person chooses keep', async () => {
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'delete draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'keep' }));

    expect(posts.deletePost).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'resume' })).toBeInTheDocument();
  });

  it('shows scheduled posts with their time, publish now and move to drafts', async () => {
    posts.updatePostStatus.mockResolvedValue(envelope(scheduled) as never);
    open();

    fireEvent.click(await screen.findByRole('tab', { name: /scheduled/ }));

    expect(await screen.findByText(/publishes tomorrow/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'move to drafts' }));
    await waitFor(() =>
      expect(posts.updatePostStatus).toHaveBeenCalledWith('s1', 'draft', undefined)
    );
  });
});

describe('PlacePicker', () => {
  const search = (names: string[]) =>
    places.searchPlaces.mockResolvedValue(
      page(names.map((name, index) => ({ id: `p${index}`, name, postCount: 10 - index }))) as never
    );

  it('offers to add the typed name only when no result has the same normalised name', async () => {
    search(['Da Nang', 'Da Nang Beach']);
    render(<PlacePicker value={null} onChoose={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />, {
      wrapper,
    });

    fireEvent.change(screen.getByLabelText('search places'), { target: { value: 'da nang' } });
    await screen.findByText('Da Nang Beach');
    expect(screen.queryByText(/Add “da nang”/)).toBeNull();

    fireEvent.change(screen.getByLabelText('search places'), {
      target: { value: 'da nang old quarter' },
    });
    expect(await screen.findByText(/Add “da nang old quarter”/)).toBeInTheDocument();
    expect(screen.getByText(/Places are shared/)).toBeInTheDocument();
  });

  it('says the place is not available when the registry refuses the name', async () => {
    search([]);
    places.createPlace.mockRejectedValue({
      message: 'This place is not available',
      response: { status: 422, data: { code: 'POST_PLACE_UNAVAILABLE' } },
    });
    render(<PlacePicker value={null} onChoose={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />, {
      wrapper,
    });

    fireEvent.change(screen.getByLabelText('search places'), { target: { value: 'Pirate Copy' } });
    fireEvent.click(await screen.findByText(/Add “Pirate Copy”/));

    expect(await screen.findByRole('alert')).toHaveTextContent('That place is not available.');
    expect(screen.getByRole('button', { name: 'done' })).toBeDisabled();
  });

  it('chooses a place from the results and hands it back on done', async () => {
    search(['Da Nang']);
    const onChoose = vi.fn();
    render(<PlacePicker value={null} onChoose={onChoose} onRemove={vi.fn()} onClose={vi.fn()} />, {
      wrapper,
    });

    fireEvent.change(screen.getByLabelText('search places'), { target: { value: 'da' } });
    fireEvent.click(await screen.findByText('Da Nang'));
    fireEvent.click(screen.getByRole('button', { name: 'done' }));

    expect(onChoose).toHaveBeenCalledWith({ id: 'p0', name: 'Da Nang' });
  });

  it('removes the place only when there is one', () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <PlacePicker value={null} onChoose={vi.fn()} onRemove={onRemove} onClose={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByRole('button', { name: 'remove location' })).toBeDisabled();

    rerender(
      <PlacePicker
        value={{ id: 'p1', name: 'Da Nang' }}
        onChoose={vi.fn()}
        onRemove={onRemove}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'remove location' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
