import { describe, expect, it } from 'vitest';

import {
  attachmentsFromPost,
  buildContentRequest,
  collaboratorsFromPost,
  tagsFromPost,
  type ComposerSnapshot,
} from '@/features/luvax/utils/composerContent';
import type { ComposerAttachment } from '@/types/composer';
import type { PostResponse, UserSummaryResponse } from '@/types/domain';

const user = (id: string): UserSummaryResponse => ({
  id,
  username: `user_${id}`,
  displayName: null,
  avatarUrl: null,
  isVerified: false,
  verifiedCategory: null,
});

const attachment = (id: string, patch: Partial<ComposerAttachment> = {}): ComposerAttachment => ({
  id,
  file: null,
  previewUrl: `blob:${id}`,
  isVideo: false,
  status: 'done',
  progress: 100,
  assetId: `asset-${id}`,
  error: null,
  altText: '',
  ...patch,
});

const snapshot = (patch: Partial<ComposerSnapshot> = {}): ComposerSnapshot => ({
  caption: 'Morning at the beach',
  items: [attachment('a'), attachment('b')],
  place: null,
  tags: [],
  collaborators: [],
  ...patch,
});

const assets = (...ids: string[]) => new Map(ids.map((id) => [id, `asset-${id}`] as const));

describe('buildContentRequest', () => {
  it('sends alt text per item and omits blank alt text', () => {
    const request = buildContentRequest(
      snapshot({
        items: [attachment('a', { altText: '  A boat at dawn ' }), attachment('b')],
      }),
      assets('a', 'b')
    );

    expect(request?.media).toEqual([
      { mediaId: 'asset-a', altText: 'A boat at dawn' },
      { mediaId: 'asset-b' },
    ]);
    expect(request?.postType).toBe('CAROUSEL');
  });

  it('returns null while an attachment has no uploaded asset', () => {
    expect(buildContentRequest(snapshot(), new Map([['a', 'asset-a']]))).toBeNull();
  });

  it('names each tag image by its position in the media list', () => {
    const request = buildContentRequest(
      snapshot({
        tags: [
          { id: 't1', attachmentId: 'b', user: user('u1'), x: 0.123456, y: 0.5 },
          { id: 't2', attachmentId: 'a', user: user('u2'), x: 1, y: 0 },
        ],
      }),
      assets('a', 'b')
    );

    expect(request?.tags).toEqual([
      { mediaPosition: 1, userId: 'u1', x: 0.1235, y: 0.5 },
      { mediaPosition: 0, userId: 'u2', x: 1, y: 0 },
    ]);
  });

  it('leaves out a tag on a video and a tag whose image was removed', () => {
    const request = buildContentRequest(
      snapshot({
        items: [attachment('a', { isVideo: true })],
        tags: [
          { id: 't1', attachmentId: 'a', user: user('u1'), x: 0.5, y: 0.5 },
          { id: 't2', attachmentId: 'gone', user: user('u2'), x: 0.5, y: 0.5 },
        ],
      }),
      assets('a')
    );

    expect(request?.tags).toEqual([]);
    expect(request?.postType).toBe('VIDEO');
  });

  it('sends the place by id and the collaborators by id', () => {
    const request = buildContentRequest(
      snapshot({
        place: { id: 'p1', name: 'Da Nang' },
        collaborators: [user('c1'), user('c2')],
      }),
      assets('a', 'b')
    );

    expect(request?.placeId).toBe('p1');
    expect(request?.collaboratorIds).toEqual(['c1', 'c2']);
  });

  it('builds a text post with a trimmed caption and no media', () => {
    const request = buildContentRequest(snapshot({ items: [], caption: '  hello  ' }), new Map());

    expect(request?.postType).toBe('TEXT');
    expect(request?.caption).toBe('hello');
    expect(request?.media).toBeUndefined();
  });
});

describe('resuming a stored post', () => {
  const post = {
    media: [
      {
        id: 'pm1',
        mediaAssetId: 'asset1',
        position: 0,
        altText: 'A boat',
        cdnUrl: 'https://cdn.example/1.jpg',
        mediaType: 'image',
        width: 10,
        height: 10,
        blurhash: null,
        tags: [{ id: 'tag1', user: user('u1'), x: 0.25, y: 0.75, status: 'pending' }],
      },
      {
        id: 'pm2',
        mediaAssetId: 'asset2',
        position: 1,
        altText: null,
        cdnUrl: 'https://cdn.example/2.mp4',
        mediaType: 'video',
        width: 10,
        height: 10,
        blurhash: null,
        tags: [],
      },
    ],
    collaborators: [
      { user: user('c1'), status: 'invited' },
      { user: user('c2'), status: 'accepted' },
    ],
  } as unknown as PostResponse;

  it('keeps the uploaded assets so nothing is uploaded again', () => {
    const items = attachmentsFromPost(post);

    expect(items.map((item) => [item.id, item.assetId, item.status, item.isVideo])).toEqual([
      ['pm1', 'asset1', 'done', false],
      ['pm2', 'asset2', 'done', true],
    ]);
    expect(items[0].altText).toBe('A boat');
    expect(items[1].altText).toBe('');
  });

  it('restores tags against the stored media ids with numeric positions', () => {
    expect(tagsFromPost(post)).toEqual([
      { id: 'tag1', attachmentId: 'pm1', user: user('u1'), x: 0.25, y: 0.75 },
    ]);
  });

  it('restores every invited co-author', () => {
    expect(collaboratorsFromPost(post).map((entry) => entry.id)).toEqual(['c1', 'c2']);
  });
});
