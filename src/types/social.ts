import type { UserSummaryResponse, PostResponse } from './domain';

export interface Relationship {
  isFollowing?: boolean;
  isFollowedByViewer?: boolean;
  isRequested?: boolean;
  isFollowRequested?: boolean;
  isBlockedByViewer?: boolean;
  isBlocked?: boolean;
  isSelf?: boolean;
  isOwner?: boolean;
}

export interface ViewerState extends Relationship {
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
  isAuthorFollowed?: boolean;
  followsAuthor?: boolean;
  author?: Relationship;
  authorRelationship?: Relationship;
  relationship?: Relationship;
}

// Compatibility fields already read by the UI and cache adapters. They are not
// guaranteed by the current backend DTO and therefore remain optional.
export interface SocialUser extends Partial<UserSummaryResponse>, Relationship {
  name?: string | null;
  bio?: string | null;
  bannerUrl?: string | null;
  isPrivate?: boolean;
  viewerState?: ViewerState;
  relationship?: Relationship;
}

export interface Post extends PostResponse {
  author: UserSummaryResponse & SocialUser;
  viewerState?: ViewerState;
  tags?: string[];
  editedAt?: string | null;
}
