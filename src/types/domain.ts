// Wire contracts mirror the backend DTO records; IDs and timestamps are JSON strings.
import type { PageInfo } from './api';

// modules/post/dto/response/PostResponse.java
export interface PostResponse {
  id: string;
  author: UserSummaryResponse;
  caption: string | null;
  postType: PostType;
  status: PostStatus;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  isLiked: boolean;
  isSaved: boolean;
  hasReported: boolean;
  viewCount: number;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  media: PostMediaResponse[];
  hashtags: HashtagSummaryResponse[];
  createdAt: string;
  updatedAt: string;
}

// common/response/UserSummaryResponse.java
export interface UserSummaryResponse {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  verifiedCategory: string | null;
}

export type PostType = 'image' | 'video' | 'carousel' | 'text';

export type PostStatus = 'draft' | 'published' | 'archived' | 'removed';

// modules/post/dto/response/PostMediaResponse.java
export interface PostMediaResponse {
  id: string;
  mediaAssetId: string;
  position: number;
  altText: string | null;
  cdnUrl: string;
  mediaType: MediaType;
  width: number | null;
  height: number | null;
  blurhash: string | null;
}

export type MediaType = 'image' | 'video';

// modules/hashtag/dto/response/HashtagSummaryResponse.java
export interface HashtagSummaryResponse {
  id: string;
  name: string;
}

// modules/post/dto/response/FeedPostResponse.java
export interface FeedPostResponse {
  id: string;
  author: UserSummaryResponse;
  caption: string | null;
  postType: PostType;
  status: PostStatus;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  isLiked: boolean;
  isSaved: boolean;
  hasReported: boolean;
  viewCount: number;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  media: PostMediaResponse[];
  hashtags: HashtagSummaryResponse[];
  createdAt: string;
  updatedAt: string;
  rankingScore: number | null;
}

// modules/post/dto/response/SavedPostResponse.java
export interface SavedPostResponse {
  post: PostResponse;
  savedAt: string;
}

// modules/post/dto/response/LikedPostResponse.java
export interface LikedPostResponse {
  post: PostResponse;
  likedAt: string;
}

// modules/post/dto/response/LikeActionResponse.java
export interface LikeActionResponse {
  postId: string;
  liked: boolean;
  likeCount: number;
}

// modules/post/dto/request/CreatePostRequest.java
export interface CreatePostRequest {
  caption?: string | null;
  postType: PostType | Uppercase<PostType>;
  mediaIds?: string[] | null;
  status?: PostStatus | Uppercase<PostStatus> | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// modules/post/dto/request/UpdatePostCaptionRequest.java
export interface UpdatePostCaptionRequest {
  caption: string;
}

// modules/comment/dto/response/CommentResponse.java
export interface CommentResponse {
  id: string;
  postId: string;
  author: UserSummaryResponse;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  content: string;
  likeCount: number;
  isLiked: boolean;
  hasReported: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  pinned: boolean;
}

// modules/comment/dto/response/CommentContextResponse.java
export interface CommentContextResponse {
  postId: string;
  thread: CommentResponse[];
}

// modules/comment/dto/response/CommentDeletionScopeResponse.java
export interface CommentDeletionScopeResponse {
  deletedCommentCount: number;
}

// modules/users/dto/response/UserProfileResponse.java
export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  verifiedCategory: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: string;
}

// modules/users/dto/response/PublicUserProfileResponse.java
export interface PublicUserProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  verifiedCategory: string | null;
  followerCount: number | null;
  followingCount: number | null;
  postCount: number | null;
  createdAt: string;
  viewerState: ViewerRelationshipResponse;
}

// common/response/ViewerRelationshipResponse.java
export interface ViewerRelationshipResponse {
  isFollowing: boolean;
  isFollowRequested: boolean;
  isFollowedBy: boolean;
  isBlocking: boolean;
  hasReported: boolean;
}

// modules/users/dto/response/UserSettingsResponse.java
export interface UserSettingsResponse {
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyMentions: boolean;
  notifyMessages: boolean;
  showActivityStatus: boolean;
  allowStoryReplies: boolean;
  messagePermission: MessagePermission;
  suggestible: boolean;
  hiddenWordsSystemEnabled: boolean;
  updatedAt: string;
}

export type MessagePermission = 'everyone' | 'following' | 'nobody';

// modules/users/dto/request/UpdateProfileRequest.java
export interface UpdateProfileRequest {
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  websiteUrl?: string | null;
  isPrivate?: boolean | null;
}

// modules/users/dto/request/UpdateSettingsRequest.java
export interface UpdateSettingsRequest {
  notifyLikes?: boolean | null;
  notifyComments?: boolean | null;
  notifyFollows?: boolean | null;
  notifyMentions?: boolean | null;
  notifyMessages?: boolean | null;
  showActivityStatus?: boolean | null;
  allowStoryReplies?: boolean | null;
  messagePermission?: MessagePermission | null;
  suggestible?: boolean | null;
  hiddenWordsSystemEnabled?: boolean | null;
}

// modules/social/dto/response/HiddenWordEntryResponse.java
export interface HiddenWordEntryResponse {
  id: string;
  /** The phrase as the account typed it, not its normalised matching form. */
  phrase: string;
  createdAt: string;
}

// modules/social/dto/response/HiddenWordListResponse.java
export interface HiddenWordListResponse {
  /** Newest first. */
  entries: HiddenWordEntryResponse[];
  /** The most entries one account may keep. */
  limit: number;
}

// modules/social/dto/request/CreateHiddenWordRequest.java
export interface CreateHiddenWordRequest {
  phrase: string;
}

/** The durations `PUT /users/me/interaction-limits` accepts, in days. */
export type InteractionLimitDuration = 1 | 3 | 7 | 14 | 28;

// modules/social/dto/response/InteractionLimitResponse.java
export interface InteractionLimitResponse {
  limitNonFollowers: boolean;
  limitRecentFollowers: boolean;
  /** Null when no limit was ever set. */
  expiresAt: string | null;
  /** True only while `expiresAt` is in the future. */
  active: boolean;
}

// modules/social/dto/request/UpdateInteractionLimitRequest.java
export interface UpdateInteractionLimitRequest {
  limitNonFollowers: boolean;
  limitRecentFollowers: boolean;
  durationDays: InteractionLimitDuration;
}

// common/response/UserListItemResponse.java
export interface UserListItemResponse {
  user: UserSummaryResponse;
  viewerState: ViewerRelationshipResponse;
}

// modules/social/dto/response/FollowResponse.java
export interface FollowResponse {
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: string;
}

export type FollowStatus = 'pending' | 'accepted';

// modules/social/dto/response/FollowRequestResponse.java
export interface FollowRequestResponse {
  id: string;
  follower: UserSummaryResponse;
  status: FollowStatus;
  createdAt: string;
  viewerState: ViewerRelationshipResponse;
}

// modules/notification/dto/response/NotificationPageResponse.java
export interface NotificationPageResponse {
  content: NotificationItemResponse[];
  pageInfo: PageInfo;
  degraded: boolean;
  head: NotificationKeyResponse | null;
}

// modules/notification/dto/response/NotificationItemResponse.java
export interface NotificationItemResponse {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  actors: UserSummaryResponse[];
  actorCount: number;
  isRead: boolean;
  readAt: string | null;
  isNew: boolean;
  activityAt: string;
  createdAt: string;
  target: NotificationTargetResponse;
  preview: NotificationPreviewResponse | null;
  moderation: NotificationModerationResponse | null;
  relationship: NotificationRelationshipResponse | null;
}

export type NotificationType =
  | 'like_post'
  | 'like_comment'
  | 'comment_post'
  | 'reply_comment'
  | 'follow'
  | 'follow_request'
  | 'mention_post'
  | 'mention_comment'
  | 'story_view'
  | 'message'
  | 'warning'
  | 'support_ticket_update'
  | 'post_removed'
  | 'comment_removed'
  | 'story_removed'
  | 'message_removed'
  | 'report_post_removed'
  | 'post_restored'
  | 'report_dismissed';

export type NotificationCategory =
  | 'like'
  | 'comment'
  | 'mention'
  | 'follow'
  | 'story'
  | 'message'
  | 'system';

// modules/notification/dto/response/NotificationTargetResponse.java
export interface NotificationTargetResponse {
  kind: string;
  postId: string | null;
  commentId: string | null;
  storyId: string | null;
  ticketId: string | null;
  userId: string | null;
  available: boolean;
}

// modules/notification/dto/response/NotificationPreviewResponse.java
export interface NotificationPreviewResponse {
  media: PreviewMediaResponse | null;
  commentSnippet: string | null;
  parentCommentSnippet: string | null;
  storyExpiresAt: string | null;
}

// common/response/PreviewMediaResponse.java
export interface PreviewMediaResponse {
  url: string;
  blurhash: string | null;
  mediaType: string;
  width: number | null;
  height: number | null;
}

// modules/notification/dto/response/NotificationModerationResponse.java
export interface NotificationModerationResponse {
  actionType: string | null;
  reason: string | null;
  affectedKind: string | null;
  affectedSnippet: string | null;
  affectedAt: string | null;
  appealActionId: string | null;
  appealable: boolean;
}

// modules/notification/dto/response/NotificationRelationshipResponse.java
export interface NotificationRelationshipResponse {
  isFollowing: boolean;
  isRequested: boolean;
  hasPendingRequestFrom: boolean;
}

// modules/notification/dto/response/NotificationKeyResponse.java
export interface NotificationKeyResponse {
  activityAt: string;
  id: string;
}

// modules/notification/dto/response/NotificationStateResponse.java
export interface NotificationStateResponse {
  unseen: UnseenCountResponse;
  seen: NotificationKeyResponse | null;
  previous: NotificationKeyResponse | null;
  followRequests: FollowRequestSummaryResponse;
}

// modules/notification/dto/response/UnseenCountResponse.java
export interface UnseenCountResponse {
  count: number;
  capped: boolean;
}

// modules/notification/dto/response/FollowRequestSummaryResponse.java
export interface FollowRequestSummaryResponse {
  count: number;
  capped: boolean;
  recent: UserSummaryResponse[];
}

// modules/notification/dto/response/NotificationReadStateResponse.java
export interface NotificationReadStateResponse {
  id: string;
  readAt: string | null;
}

// modules/notification/dto/response/ReadAllResponse.java
export interface ReadAllResponse {
  updated: number;
}

// modules/story/dto/response/StoryResponse.java
export interface StoryResponse {
  id: string;
  userId: string;
  username: string | null;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  storyType: StoryType;
  caption: string | null;
  media: StoryMediaResponse;
  viewCount: number | null;
  seen: boolean | null;
  likeCount: number | null;
  liked: boolean;
  createdAt: string;
  expiresAt: string;
}

export type StoryType = 'image' | 'video';

// modules/story/dto/response/StoryMediaResponse.java
export interface StoryMediaResponse {
  mediaAssetId: string;
  cdnUrl: string;
  mediaType: MediaType;
  width: number | null;
  height: number | null;
  duration: number | null;
  blurhash: string | null;
}

// modules/story/dto/response/StoryFeedItemResponse.java
export interface StoryFeedItemResponse {
  userId: string;
  username: string;
  isVerified: boolean;
  verifiedCategory: string | null;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  hasUnseen: boolean;
  latestStoryAt: string;
  stories: StoryResponse[];
}

// modules/story/dto/response/StoryViewActionResponse.java
export interface StoryViewActionResponse {
  storyId: string;
  viewed: boolean;
  viewCount: number;
}

// modules/story/dto/response/StoryLikeActionResponse.java
export interface StoryLikeActionResponse {
  storyId: string;
  liked: boolean;
  likeCount: number;
}

// modules/story/dto/request/CreateStoryRequest.java
export interface CreateStoryRequest {
  mediaId: string;
  caption?: string | null;
}

// modules/hashtag/dto/response/HashtagResponse.java
export interface HashtagResponse {
  id: string;
  name: string;
  postCount: number;
  createdAt: string;
}

// modules/hashtag/dto/response/HashtagDetailResponse.java
export interface HashtagDetailResponse {
  id: string;
  name: string;
  postCount: number;
  status: HashtagStatus;
  createdAt: string;
  pinned: boolean;
}

export type HashtagStatus = 'active' | 'banned' | 'deleted';

// modules/hashtag/dto/response/HashtagTrendingResponse.java
export interface HashtagTrendingResponse {
  hashtagId: string;
  name: string;
  postCount: number | null;
  rank: number;
  periodStart: string;
  periodEnd: string;
  pinned: boolean;
  source: TrendingSource;
}

export type TrendingSource = 'platform' | 'affinity' | 'novel';

// modules/hashtag/dto/response/TrendingPreviewResponse.java
export interface TrendingPreviewResponse {
  hashtagId: string;
  name: string;
  postCount: number | null;
  pinned: boolean;
  previewUrl: string | null;
}

// modules/recommendation/dto/response/SuggestedUserResponse.java
export interface SuggestedUserResponse {
  user: UserSummaryResponse;
  viewerState: ViewerRelationshipResponse;
  bannerUrl: string | null;
  sources: string | null;
  followerCount: number;
}

// modules/recommendation/dto/response/UserEventResponse.java
export interface UserEventResponse {
  id: string;
  userId: string;
  eventType: UserEventType;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type UserEventType =
  | 'post_view'
  | 'post_like'
  | 'post_unlike'
  | 'post_save'
  | 'post_unsave'
  | 'post_share'
  | 'post_comment'
  | 'story_view'
  | 'story_reply'
  | 'profile_view'
  | 'profile_follow'
  | 'profile_unfollow'
  | 'search'
  | 'hashtag_click'
  | 'comment_like'
  | 'comment_reply'
  | 'message_send'
  | 'session_start'
  | 'session_end'
  | 'app_open';

// modules/report/dto/request/CreateReportRequest.java
export interface CreateReportRequest {
  reportType: ReportType;
  reportReason: ReportReason;
  entityId: string;
  description?: string | null;
  turnstileToken: string;
}

export type ReportType = 'post' | 'comment' | 'user' | 'story' | 'message';

export type ReportReason =
  | 'spam'
  | 'nudity'
  | 'violence'
  | 'hate_speech'
  | 'harassment'
  | 'false_information'
  | 'scam'
  | 'other';

// modules/report/dto/response/ReportResponse.java
export interface ReportResponse {
  id: string;
  reporterId: string;
  reportType: ReportType;
  reportReason: ReportReason;
  entityId: string;
  description: string | null;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'escalated';

// common/vocabulary/dto/response/VocabularyResponse.java
export interface VocabularyResponse {
  reportReasons: ReportReasonVocabularyResponse[];
  notificationTypes: NotificationTypeVocabularyResponse[];
  moderationActions: ModerationActionVocabularyResponse[];
  supportCategories: SupportCategoryVocabularyResponse[];
}

// common/vocabulary/dto/response/ReportReasonVocabularyResponse.java
export interface ReportReasonVocabularyResponse {
  key: string;
  displayName: string;
  description: string | null;
  appliesTo: string[];
  isEnabled: boolean;
  sortOrder: number;
}

// common/vocabulary/dto/response/NotificationTypeVocabularyResponse.java
export interface NotificationTypeVocabularyResponse {
  key: string;
  displayName: string;
  templateKey: string | null;
  isUserToggleable: boolean;
  isEnabled: boolean;
}

// common/vocabulary/dto/response/ModerationActionVocabularyResponse.java
export interface ModerationActionVocabularyResponse {
  key: string;
  displayName: string;
  requiresReason: boolean;
  isReversible: boolean;
  isEnabled: boolean;
}

// common/vocabulary/dto/response/SupportCategoryVocabularyResponse.java
export interface SupportCategoryVocabularyResponse {
  categoryKey: string;
  displayName: string;
  description: string | null;
  isAppeal: boolean;
  allowsPublicForm: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

// modules/media/dto/response/MediaConstraintsResponse.java
export interface MediaConstraintsResponse {
  acceptedImageMimeTypes: string[];
  acceptedVideoMimeTypes: string[];
  maxFileSizeBytes: number;
  maxVideoDurationSeconds: number;
}

// modules/media/dto/request/MediaUploadCompleteRequest.java
export interface MediaUploadCompleteRequest {
  storageKey: string;
  mediaType: MediaType;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  duration?: number | null;
  blurhash?: string | null;
}

// modules/media/dto/request/MediaUploadUrlRequest.java
export interface MediaUploadUrlRequest {
  mediaType: MediaType;
  mimeType: string;
  fileSize: number;
}

// modules/media/dto/response/MediaAssetResponse.java
export interface MediaAssetResponse {
  id: string;
  userId: string;
  storageKey: string;
  cdnUrl: string;
  mediaType: MediaType;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  blurhash: string | null;
  createdAt: string;
}

// modules/media/dto/response/MediaUploadUrlResponse.java
export interface MediaUploadUrlResponse {
  storageKey: string;
  uploadUrl: string;
  method: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

// modules/message/dto/response/ConversationResponse.java
export interface ConversationResponse {
  id: string;
  createdBy: string | null;
  participants: ParticipantResponse[];
  lastMessageAt: string | null;
  createdAt: string;
  pinned: boolean;
  muted: boolean;
}

// modules/message/dto/response/ParticipantResponse.java
export interface ParticipantResponse {
  userId: string;
  username: string | null;
  isVerified: boolean;
  verifiedCategory: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  leftAt: string | null;
  nickname: string | null;
}

// modules/message/dto/response/ConversationSummaryResponse.java
export interface ConversationSummaryResponse {
  id: string;
  participants: ParticipantResponse[];
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: MessageResponse | null;
  pinned: boolean;
  muted: boolean;
  manuallyUnread: boolean;
}

// modules/message/dto/response/MessageResponse.java
export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string | null;
  messageType: MessageType;
  content: string | null;
  mediaAssetId: string | null;
  media: MessageMediaResponse | null;
  sharedPostId: string | null;
  sharedStoryId: string | null;
  replyToId: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'post_share' | 'story_share';

// modules/message/dto/response/MessageMediaResponse.java
export interface MessageMediaResponse {
  mediaAssetId: string;
  mediaType: MediaType;
  cdnUrl: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  blurhash: string | null;
}

// modules/message/dto/request/SendMessageRequest.java
export interface SendMessageRequest {
  messageType: MessageType;
  content?: string | null;
  mediaAssetId?: string | null;
  sharedPostId?: string | null;
  sharedStoryId?: string | null;
  replyToId?: string | null;
}

// modules/message/dto/response/UnreadCountResponse.java
export interface UnreadCountResponse {
  unreadCount: number;
}

// modules/admin/dto/response/UserWarningResponse.java
export interface UserWarningResponse {
  id: string;
  reasonKey: string;
  note: string;
  adminActionId: string;
  createdAt: string;
}
