import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'node:path';

import type { Api } from './session';
import { capture, captureAtAllWidths, itemsOf, walk } from './session';

/**
 * Where the post creation specs write their screenshots. The file name carries the requirement id
 * and the viewport width, `docs/post-creation/README.md` maps each to its behavior and spec.
 */
export const POST_SHOTS = path.resolve(process.cwd(), 'docs/post-creation/screenshots');

/** Captures the current viewport into the post creation screenshots. */
export const shoot = (page: Page, requirementId: string, width: number) =>
  capture(page, requirementId, width, POST_SHOTS);

/** Captures a modified surface at every required width. */
export const shootAtAllWidths = (
  page: Page,
  requirementId: string,
  prepare?: () => Promise<void>
) => captureAtAllWidths(page, requirementId, prepare, POST_SHOTS);

export interface PostMediaRow {
  id: string;
  mediaAssetId: string;
  altText: string | null;
  cdnUrl: string;
  mediaType: 'image' | 'video';
  tags: { id: string; user: { id: string; username: string }; status: string }[];
}

export interface PostRow {
  id: string;
  status: string;
  caption: string | null;
  postType: string;
  publishedAt: string | null;
  scheduledAt?: string | null;
  place: { id: string; name: string } | null;
  media: PostMediaRow[];
  mentions: { handle: string; userId: string; username: string }[];
  collaborators: { user: { id: string; username: string }; status: string }[];
  viewerCollaboration: string | null;
  author: { id: string; username: string };
}

/**
 * The media assets an account already owns, taken from its own published posts.
 *
 * A new post may reuse an asset its owner uploaded for an earlier post, so a spec can build a post
 * with real, loadable pictures without uploading anything to storage.
 */
export async function ownedImageAssets(api: Api, count: number): Promise<string[]> {
  const posts = await walk<PostRow>(api, `/posts/user/${api.user.id}?limit=20`, 4);
  const ids = posts.flatMap((post) =>
    post.media.filter((item) => item.mediaType === 'image').map((item) => item.mediaAssetId)
  );
  const unique = [...new Set(ids)];
  expect(unique.length, `${api.username} owns enough image assets`).toBeGreaterThanOrEqual(count);
  return unique.slice(0, count);
}

/** Creates a post for `api` and returns it; the request body is exactly what the composer sends. */
export async function createPost(api: Api, body: Record<string, unknown>): Promise<PostRow> {
  const result = await api.call<PostRow>('POST', '/posts', body);
  expect(result.status, `create post: ${result.code}`).toBe(201);
  return result.data;
}

/** The post as `api` sees it, or null when it answers not found. */
export async function readPost(api: Api, postId: string): Promise<PostRow | null> {
  const result = await api.call<PostRow>('GET', `/posts/${postId}`);
  return result.status === 200 ? result.data : null;
}

/** Deletes a post the account owns; used in cleanup so a run leaves its drafts behind it. */
export async function deletePost(api: Api, postId: string): Promise<void> {
  await api.call('DELETE', `/posts/${postId}`);
}

/** The owner's posts in one non-published state. */
export async function ownPosts(
  api: Api,
  status: 'draft' | 'scheduled' | 'archived'
): Promise<PostRow[]> {
  return walk<PostRow>(api, `/users/me/posts?status=${status}&limit=50`, 3);
}

/** The ids of the owner's drafts and scheduled posts, so a spec can remove what it created. */
export async function deleteAllHeld(api: Api): Promise<void> {
  for (const status of ['draft', 'scheduled'] as const) {
    for (const post of await ownPosts(api, status)) await deletePost(api, post.id);
  }
}

/** The notifications of `api`, newest first. */
export async function notificationsOf(api: Api, limit = 30) {
  const result = await api.call<unknown>('GET', `/notifications?limit=${limit}`);
  expect(result.status).toBe(200);
  return itemsOf<{ id: string; type: string; target: { postId: string | null } }>(result.data);
}
