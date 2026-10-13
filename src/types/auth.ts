export type Role = 'user' | 'moderator' | 'admin';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: Role;
  emailVerified: boolean;
}

// Persisted identities may be incomplete until the bootstrap refresh completes.
export interface SessionUser extends Partial<Omit<AuthenticatedUser, 'role'>> {
  role?: Role | null;
  name?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  verifiedCategory?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  tokenType: string;
  user: AuthenticatedUser;
}

export interface AuthPayload {
  accessToken?: string;
  token?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  user?: SessionUser;
  message?: string;
  data?: AuthPayload;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string | null;
}

export interface AuthInput {
  accessToken?: unknown;
  refreshToken?: unknown;
  user?: SessionUser | null;
}

export interface AuthFormValues {
  identifier?: string;
  email?: string;
  username?: string;
  name?: string;
  password?: string;
  newPassword?: string;
  turnstileToken?: string;
  token?: string;
  otp?: string;
  code?: string;
}
