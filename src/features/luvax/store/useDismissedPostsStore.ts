import { create } from 'zustand';

export type DismissalKind = 'not-interested' | 'show-fewer';

export interface PostDismissal {
  kind: DismissalKind;
  authorId: string;
  authorHandle: string;
}

interface DismissedPostsState {
  byPostId: Record<string, PostDismissal>;
  set: (postId: string, dismissal: PostDismissal) => void;
  clear: (postId: string) => void;
  /** Puts a post back to the dismissal it had before a change, or to none. */
  restore: (postId: string, previous: PostDismissal | undefined) => void;
}

/**
 * Posts the viewer dismissed from the feed during this session, by post id.
 *
 * A dismissed card stays in the cached list and renders as an undo row in its place, so the
 * list's height and scroll position do not change under the viewer. Nothing here is persisted
 * and it is not a source of truth: the server filters the post out of the next list it returns,
 * which drops the row with it. A page load starts empty, and so does a different account, because
 * signing out reloads the page.
 */
export const useDismissedPostsStore = create<DismissedPostsState>()((set) => ({
  byPostId: {},
  set: (postId, dismissal) =>
    set((state) => ({ byPostId: { ...state.byPostId, [postId]: dismissal } })),
  clear: (postId) =>
    set((state) => {
      const { [postId]: _removed, ...rest } = state.byPostId;
      return { byPostId: rest };
    }),
  restore: (postId, previous) =>
    set((state) => {
      const { [postId]: _current, ...rest } = state.byPostId;
      return { byPostId: previous ? { ...rest, [postId]: previous } : rest };
    }),
}));
