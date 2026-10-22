// Wire contracts mirror backend admin DTO records.
import type {
  HashtagStatus,
  PlaceStatus,
  ReportType,
  ReportReason,
  ReportStatus,
  UserSummaryResponse,
} from './domain';
// modules/social/dto/response/AdminHiddenWordResponse.java
export interface AdminHiddenWordResponse {
  id: string;
  phrase: string;
  normalizedPhrase: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// modules/hashtag/dto/response/HashtagAdminResponse.java
export interface HashtagAdminResponse {
  id: string;
  name: string;
  postCount: number;
  status: HashtagStatus;
  statusNote: string | null;
  statusAt: string | null;
  statusBy: string | null;
  createdAt: string;
  pinnedAt: string;
  pinnedBy: string;
}

// modules/auth/dto/response/CurrentSessionResponse.java
export interface CurrentSessionResponse {
  sessionId: string | null;
}

// modules/admin/dto/response/AdminActionResponse.java
export interface AdminActionResponse {
  id: string;
  adminId: string | null;
  actionType: AdminActionType;
  targetUserId: string | null;
  targetEntityType: string;
  targetEntityId: string;
  reportId: string | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type AdminActionType =
  | 'ban_user'
  | 'unban_user'
  | 'suspend_user'
  | 'unsuspend_user'
  | 'remove_post'
  | 'restore_post'
  | 'remove_comment'
  | 'restore_comment'
  | 'remove_story'
  | 'restore_story'
  | 'remove_message'
  | 'restore_message'
  | 'remove_message_reaction'
  | 'restore_message_reaction'
  | 'resolve_report'
  | 'dismiss_report'
  | 'change_user_role'
  | 'warn_user'
  | 'revoke_warning'
  | 'issue_strike'
  | 'revoke_strike'
  | 'escalate_report'
  | 'force_logout'
  | 'revoke_session'
  | 'respond_support_ticket'
  | 'reject_support_ticket'
  | 'escalate_support_ticket'
  | 'create_hashtag'
  | 'edit_hashtag'
  | 'ban_hashtag'
  | 'unban_hashtag'
  | 'delete_hashtag'
  | 'pin_hashtag'
  | 'unpin_hashtag'
  | 'grant_verification'
  | 'reject_verification'
  | 'revoke_verification'
  | 'create_hidden_word'
  | 'edit_hidden_word'
  | 'delete_hidden_word';

// modules/admin/dto/response/AdminActionSummaryResponse.java
export interface AdminActionSummaryResponse {
  id: string;
  adminId: string | null;
  actionType: AdminActionType;
  targetUserId: string | null;
  targetEntityType: string;
  targetEntityId: string;
  reportId: string | null;
  reason: string;
  createdAt: string;
}

// modules/admin/dto/response/AdminCommentSummaryResponse.java
export interface AdminCommentSummaryResponse {
  id: string;
  userId: string;
  username: string | null;
  postId: string;
  parentId: string | null;
  content: string;
  moderationStatus: string;
  removed: boolean;
  likeCount: number;
  createdAt: string;
}

// modules/admin/dto/response/AdminPostRestoreResponse.java
export interface AdminPostRestoreResponse {
  action: AdminActionResponse;
  remainingBannedHashtags: string[];
}

// modules/admin/dto/response/AdminPostSummaryResponse.java
export interface AdminPostSummaryResponse {
  id: string;
  userId: string;
  username: string | null;
  status: string;
  caption: string | null;
  removed: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  mediaUrls: string[];
}

// modules/admin/dto/response/AdminReportTargetResponse.java
export interface AdminReportTargetResponse {
  reportType: ReportType;
  entityId: string;
  ownerId: string | null;
  ownerUsername: string | null;
  status: string | null;
  text: string | null;
  mediaUrls: string[];
  removed: boolean;
  createdAt: string;
  /** The emoji of a reported message reaction; null for every other type. */
  emoji: string | null;
}

// modules/admin/dto/response/AdminStatsCurrentResponse.java
export interface AdminStatsCurrentResponse {
  bucketStart: string | null;
  computedAt: string | null;
  totalUsers: number;
  usersByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
  totalPosts: number;
  totalComments: number;
  totalStories: number;
  reportsByStatus: Record<string, number>;
  reportsByReason: Record<string, number>;
  topHashtags: TopHashtagResponse[];
  topHashtagsLive: boolean;
}

// modules/admin/dto/response/TopHashtagResponse.java
export interface TopHashtagResponse {
  name: string;
  postCount: number;
}

// modules/admin/dto/response/AdminStatsTimeseriesResponse.java
export interface AdminStatsTimeseriesResponse {
  metric: string;
  granularity: StatGranularity;
  from: string;
  to: string;
  points: StatPointResponse[];
}

export type StatGranularity = 'half_hour' | 'day';

// modules/admin/dto/response/StatPointResponse.java
export interface StatPointResponse {
  bucketStart: string;
  dimension: string;
  value: number;
}

// modules/admin/dto/response/AdminStrikeResponse.java
export interface AdminStrikeResponse {
  id: string;
  userId: string;
  strikeNumber: number;
  triggeredBy: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// modules/admin/dto/response/AdminStrikeViolationResponse.java
export interface AdminStrikeViolationResponse {
  kind: 'strike';
  id: string;
  userId: string;
  actorId: string | null;
  strikeNumber: number;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

// modules/admin/dto/response/AdminUserCapabilitiesResponse.java
export interface AdminUserCapabilitiesResponse {
  canChangeStatus: boolean;
  canChangeRole: boolean;
  assignableRoles: UserRole[];
}

export type UserRole = 'user' | 'moderator' | 'admin';

// modules/admin/dto/response/AdminUserDetailResponse.java
export interface AdminUserDetailResponse {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: string;
  deletedAt: string | null;
  registrationIp: string | null;
  lastLoginIp: string | null;
  lastLoginAt: string | null;
  suspendedUntil: string | null;
  sessions: AdminUserSessionResponse[];
  reportsAgainst: AdminUserReportResponse[];
  capabilities: AdminUserCapabilitiesResponse;
  activeWarningCount: number;
}

export type UserStatus = 'active' | 'suspended' | 'deactivated' | 'banned';

// modules/admin/dto/response/AdminUserSessionResponse.java
export interface AdminUserSessionResponse {
  id: string;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

// modules/admin/dto/response/AdminUserReportResponse.java
export interface AdminUserReportResponse {
  id: string;
  reporterId: string;
  reportReason: ReportReason;
  status: ReportStatus;
  createdAt: string;
}

// modules/admin/dto/response/AdminUserListItemResponse.java
export interface AdminUserListItemResponse {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

// modules/admin/dto/response/AdminUserLookupResponse.java
export interface AdminUserLookupResponse {
  userId: string;
  found: boolean;
  user: UserSummaryResponse | null;
}

// modules/admin/dto/response/AdminWarningResponse.java
export interface AdminWarningResponse {
  id: string;
  userId: string;
  issuedBy: string | null;
  reasonKey: string;
  note: string;
  revokedAt: string | null;
  createdAt: string;
}

// modules/admin/dto/response/AdminWarningViolationResponse.java
export interface AdminWarningViolationResponse {
  kind: 'warning';
  id: string;
  userId: string;
  actorId: string | null;
  reasonKey: string;
  note: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

// modules/admin/dto/response/AdminWarnUserResponse.java
export interface AdminWarnUserResponse {
  warning: AdminWarningResponse;
  activeWarningCount: number;
  strikeIssued: boolean;
  strike: AdminStrikeResponse | null;
  resultingStatus: string;
}

// modules/admin/dto/response/EscalatedReportCountResponse.java
export interface EscalatedReportCountResponse {
  count: number;
}

// modules/admin/dto/response/ModerationNoticeResponse.java
export interface ModerationNoticeResponse {
  adminActionId: string;
  actionType: string;
  reason: string;
  affectedKind: string;
  affectedSnippet: string;
  affectedAt: string;
  appealable: boolean;
}

// modules/admin/dto/request/AdminActionRequest.java
export interface AdminActionRequest {
  reason: string;
  reportId?: string;
}

// modules/admin/dto/request/AdminCreateHashtagRequest.java
export interface AdminCreateHashtagRequest {
  name: string;
  status?: HashtagStatus;
  note: string;
}

// modules/admin/dto/request/AdminDeleteHashtagRequest.java
export interface AdminDeleteHashtagRequest {
  reason: string;
}

// modules/admin/dto/request/AdminDeleteHiddenWordRequest.java
export interface AdminDeleteHiddenWordRequest {
  reason: string;
}

// modules/admin/dto/request/AdminEscalateReportRequest.java
export interface AdminEscalateReportRequest {
  reason: string;
}

// modules/admin/dto/request/AdminHashtagPinRequest.java
export interface AdminHashtagPinRequest {
  note?: string;
}

// modules/admin/dto/request/AdminHiddenWordRequest.java
export interface AdminHiddenWordRequest {
  phrase?: string;
  reason: string;
}

// modules/admin/dto/request/AdminRoleChangeRequest.java
export interface AdminRoleChangeRequest {
  role: UserRole;
  reason: string;
}

// modules/admin/dto/request/AdminSuspendUserRequest.java
export interface AdminSuspendUserRequest {
  reason: string;
  reportId?: string;
  durationDays?: number;
}

// modules/admin/dto/request/AdminUpdateHashtagRequest.java
export interface AdminUpdateHashtagRequest {
  status: HashtagStatus;
  note: string;
}

// modules/admin/dto/request/AdminUpdatePlaceRequest.java
export interface AdminUpdatePlaceRequest {
  status: PlaceStatus;
  /** Required when the status is banned or deleted; recorded on the place and the audit row. */
  note?: string | null;
  /** A report about this place that the action resolves in the same transaction. */
  reportId?: string | null;
}

// modules/admin/dto/request/AdminWarnUserRequest.java
export interface AdminWarnUserRequest {
  reasonKey: string;
  note: string;
}
export type AdminViolationResponse = AdminWarningViolationResponse | AdminStrikeViolationResponse;
