import type { ViewerState } from './social';

export interface UserSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  verifiedCategory: string | null;
}

export type UserSummaryView = Omit<UserSummary, 'id'> & {
  id: string | null;
  bio?: string | null;
  isPrivate?: boolean;
  followerCount?: number | null;
  followersCount?: number | null;
  viewerState?: ViewerState;
};
