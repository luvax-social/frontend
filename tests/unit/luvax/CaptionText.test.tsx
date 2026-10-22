import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { CaptionText } from '@/features/luvax/components/CaptionText';
import type { PostMentionResponse } from '@/types/domain';

const mentions: PostMentionResponse[] = [{ handle: 'an.pham', userId: 'u1', username: 'an.pham' }];

const renderCaption = (text: string, stored: PostMentionResponse[] = mentions) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<CaptionText text={text} mentions={stored} />} />
        <Route path="/app/u/:userId" element={<p>profile page</p>} />
        <Route path="/app/tags/:name" element={<p>tag page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('CaptionText', () => {
  it('renders a stored mention as a link to the account by id', () => {
    renderCaption('Morning with @an.pham #danang');

    fireEvent.click(screen.getByRole('button', { name: '@an.pham' }));

    expect(screen.getByText('profile page')).toBeInTheDocument();
  });

  it('shows the current username for a mention typed under another spelling', () => {
    renderCaption('hi @AN.PHAM', [{ handle: 'AN.PHAM', userId: 'u1', username: 'an.pham' }]);

    expect(screen.getByRole('button', { name: '@an.pham' })).toBeInTheDocument();
  });

  it('leaves an unstored @name as plain text', () => {
    renderCaption('hi @stranger');

    expect(screen.queryByRole('button', { name: '@stranger' })).toBeNull();
    expect(screen.getByText('hi @stranger')).toBeInTheDocument();
  });

  it('still links hashtags beside mentions', () => {
    renderCaption('@an.pham #danang');

    fireEvent.click(screen.getByRole('button', { name: '#danang' }));

    expect(screen.getByText('tag page')).toBeInTheDocument();
  });
});
