export interface UserSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  verifiedCategory: string | null;
}

export type UserSummaryView = Omit<UserSummary, 'id'> & { id: string | null };
