import type { UserSummaryResponse } from '@/types/domain';
import type { Post } from '@/types/social';

/** The authors a post names: its owner first, then every co-author who accepted. */
export function postAuthors(post: Post): UserSummaryResponse[] {
  const coAuthors = (post.collaborators ?? [])
    .filter((entry) => entry.status === 'accepted')
    .map((entry) => entry.user);
  return [post.author as UserSummaryResponse, ...coAuthors].filter(Boolean);
}
