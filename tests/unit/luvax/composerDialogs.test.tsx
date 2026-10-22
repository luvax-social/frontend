import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AltTextDialog } from '@/features/luvax/components/composer/AltTextDialog';
import { CollaboratorPicker } from '@/features/luvax/components/composer/CollaboratorPicker';
import { SchedulePicker } from '@/features/luvax/components/composer/SchedulePicker';
import { TagPeopleEditor } from '@/features/luvax/components/composer/TagPeopleEditor';
import type { ComposerAttachment } from '@/types/composer';

const people = [
  { id: 'u1', username: 'an.pham', displayName: 'An Pham', avatarUrl: null },
  { id: 'u2', username: 'linh.ng', displayName: 'Linh Ng', avatarUrl: null },
  { id: 'u3', username: 'minh.le', displayName: 'Minh Le', avatarUrl: null },
  { id: 'u4', username: 'hoa.vo', displayName: 'Hoa Vo', avatarUrl: null },
].map((user) => ({ ...user, isVerified: false, verifiedCategory: null }));

vi.mock('@/features/search/hooks/useSearch', () => ({
  getUserSearchTerms: (value: string) => (value.trim().length >= 2 ? [value.trim()] : []),
  useUserSearch: (term: string) => ({
    isLoading: false,
    data: term
      ? { pages: [{ data: { content: people.map((user) => ({ user })), pageInfo: {} } }] }
      : undefined,
  }),
}));

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'me' } }),
}));

const attachment = (id: string, patch: Partial<ComposerAttachment> = {}): ComposerAttachment => ({
  id,
  file: null,
  previewUrl: `https://cdn.example/${id}.jpg`,
  isVideo: false,
  status: 'done',
  progress: 100,
  assetId: `asset-${id}`,
  error: null,
  altText: '',
  ...patch,
});

beforeEach(() => {
  vi.useRealTimers();
});

describe('SchedulePicker', () => {
  it('states both limits in the helper and offers the quick choices', () => {
    render(<SchedulePicker value={null} onSet={vi.fn()} onClear={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId('schedule-helper')).toHaveTextContent('Between 1 minute and 30 days');
    expect(screen.getByText('in 1 hour')).toBeInTheDocument();
    expect(screen.getByText('tomorrow 09:00')).toBeInTheDocument();
  });

  it('replaces the helper with the limit message and disables set time for a past date', () => {
    render(<SchedulePicker value={null} onSet={vi.fn()} onClear={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('date'), { target: { value: '2020-01-01' } });

    expect(screen.getByTestId('schedule-helper')).toHaveTextContent(
      'Choose a time at least a minute from now.'
    );
    expect(screen.getByRole('button', { name: 'set time' })).toBeDisabled();
  });

  it('refuses a date beyond thirty days', () => {
    render(<SchedulePicker value={null} onSet={vi.fn()} onClear={vi.fn()} onCancel={vi.fn()} />);
    const far = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    const iso = `${far.getFullYear()}-${String(far.getMonth() + 1).padStart(2, '0')}-${String(far.getDate()).padStart(2, '0')}`;

    fireEvent.change(screen.getByLabelText('date'), { target: { value: iso } });

    expect(screen.getByTestId('schedule-helper')).toHaveTextContent(
      'Choose a time within the next 30 days.'
    );
    expect(screen.getByRole('button', { name: 'set time' })).toBeDisabled();
  });

  it('hands the chosen time back floored to the minute', () => {
    const onSet = vi.fn();
    render(<SchedulePicker value={null} onSet={onSet} onClear={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'set time' }));

    expect(onSet).toHaveBeenCalledTimes(1);
    const at = onSet.mock.calls[0][0] as Date;
    expect(at.getSeconds()).toBe(0);
    expect(at.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('AltTextDialog', () => {
  const items = [
    { key: 'a', src: 'https://cdn.example/a.jpg', isVideo: false, altText: '' },
    { key: 'b', src: 'https://cdn.example/b.jpg', isVideo: false, altText: 'A boat' },
  ];

  it('states the neutral label readers get when the text is empty', () => {
    render(
      <AltTextDialog
        items={items}
        initialKey="a"
        authorUsername="minh.tran"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Leave it empty and readers hear/)).toHaveTextContent(
      'Photo 1 of 2 by @minh.tran'
    );
  });

  it('disables save and marks the count when the text passes 500 characters', () => {
    render(<AltTextDialog items={items} initialKey="a" onSave={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('alt text for image 1'), {
      target: { value: 'x'.repeat(501) },
    });

    expect(screen.getByText('501 / 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
  });

  it('saves every item whose text changed and closes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AltTextDialog items={items} initialKey="a" onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('alt text for image 1'), {
      target: { value: '  Two cyclists  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^image 2/ }));
    fireEvent.change(screen.getByLabelText('alt text for image 2'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('a', 'Two cyclists');
    expect(onSave).toHaveBeenCalledWith('b', '');
  });

  it('stays open and shows the reason when a save is refused', async () => {
    const onClose = vi.fn();
    render(
      <AltTextDialog
        items={items}
        initialKey="a"
        onSave={vi.fn().mockRejectedValue(new Error('Alt text was refused'))}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByLabelText('alt text for image 1'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Alt text was refused');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('CollaboratorPicker', () => {
  it('states what an invitation means', () => {
    render(<CollaboratorPicker value={[]} onDone={vi.fn()} onClose={vi.fn()} />);

    expect(
      screen.getByText(/They appear on the post only after they accept\. You keep editing/)
    ).toBeInTheDocument();
  });

  it('stops at three invitations and says so on the remaining rows', () => {
    const onDone = vi.fn();
    render(<CollaboratorPicker value={[]} onDone={onDone} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('search people to invite'), { target: { value: 'an' } });
    for (const name of ['an.pham', 'linh.ng', 'minh.le']) {
      fireEvent.click(document.querySelector(`[data-person="${name}"]`)!);
    }

    expect(screen.getByText('3 of 3 invited')).toBeInTheDocument();
    expect(screen.getByText('You can invite up to 3 people')).toBeInTheDocument();
    expect(document.querySelector('[data-person="hoa.vo"]')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    expect(onDone.mock.calls[0][0].map((user: { username: string }) => user.username)).toEqual([
      'an.pham',
      'linh.ng',
      'minh.le',
    ]);
  });

  it('leaves the composer unchanged on cancel', () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    render(<CollaboratorPicker value={[]} onDone={onDone} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('search people to invite'), { target: { value: 'an' } });
    fireEvent.click(document.querySelector('[data-person="an.pham"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TagPeopleEditor', () => {
  it('asks for a photo when there are only videos', () => {
    render(
      <TagPeopleEditor
        attachments={[attachment('v1', { isVideo: true })]}
        tags={[]}
        onDone={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Videos cannot be tagged/)).toBeInTheDocument();
  });

  it('tags a person at the clicked spot and counts it against twenty', () => {
    const onDone = vi.fn();
    // jsdom has no layout, so the frame is given a 400 by 400 box before the editor measures it.
    const size = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    render(
      <TagPeopleEditor
        attachments={[attachment('p1')]}
        tags={[]}
        onDone={onDone}
        onClose={vi.fn()}
      />
    );
    const photo = screen.getByTestId('tag-photo');
    photo.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 }) as DOMRect;

    fireEvent.pointerDown(photo, { clientX: 100, clientY: 300 });
    fireEvent.change(screen.getByLabelText('search people to tag'), { target: { value: 'an' } });
    fireEvent.click(document.querySelector('[data-person="an.pham"]')!);

    expect(screen.getByText('1 of 20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    const tags = onDone.mock.calls[0][0];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ attachmentId: 'p1' });
    expect(tags[0].x).toBeCloseTo(0.25, 2);
    expect(tags[0].y).toBeCloseTo(0.75, 2);
    size.mockRestore();
    height.mockRestore();
  });

  it('removes a tag from the list and refuses a second tag of the same person', () => {
    render(
      <TagPeopleEditor
        attachments={[attachment('p1')]}
        tags={[{ id: 't1', attachmentId: 'p1', user: people[0], x: 0.5, y: 0.5 }]}
        onDone={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('search people to tag'), { target: { value: 'an' } });
    expect(document.querySelector('[data-person="an.pham"]')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'remove tag an.pham' }));
    expect(screen.getByText('0 of 20')).toBeInTheDocument();
  });
});
