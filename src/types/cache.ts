import type { CommentResponse } from './domain';
import type { Post, SocialUser, ViewerState } from './social';
import type { PageInfo } from './api';

// Post, saved/liked-post and suggested-user rows share a cache traversal. These
// fields describe that traversal without treating arbitrary cache values as DTOs.
export interface SocialCacheRow extends Partial<Omit<Post, 'author' | 'id'>>, SocialUser {
  author?: SocialUser;
  post?: SocialCacheRow;
  user?: SocialUser;
  viewerState?: ViewerState;
  content?: SocialCacheRow[];
}

export interface SocialCacheEntry {
  data?: SocialCacheRow;
  pages?: SocialCacheEntry[];
  pageParams?: unknown[];
}

export interface CommentCachePage {
  data?: { content?: CommentResponse[]; pageInfo?: PageInfo; degraded?: boolean };
  pages?: CommentCachePage[];
  pageParams?: unknown[];
}
