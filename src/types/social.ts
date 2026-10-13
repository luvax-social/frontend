import type { UserSummaryResponse, PostResponse, UserListItemResponse } from './domain';

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
  isLiked?: boolean;
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
export interface SocialUser extends Partial<Omit<UserSummaryResponse, 'id'>>, Relationship {
  id?: string | null;
  name?: string | null;
  bio?: string | null;
  followerCount?: number | null;
  followersCount?: number | null;
  bannerUrl?: string | null;
  isPrivate?: boolean;
  viewerState?: ViewerState;
  relationship?: Relationship;
}

export interface Post extends PostResponse {
  text?: string;
  type?: string;
  author: UserSummaryResponse & SocialUser;
  viewerState?: ViewerState;
  tags?: string[];
  editedAt?: string | null;
}

export type UserListItem = Omit<UserListItemResponse, 'user'> & {
  viewerState: UserListItemResponse['viewerState'] & Relationship;
  user: UserSummaryResponse & SocialUser;
  followerCount?: number;
  followersCount?: number;
};
