import type { Post } from '@/types/social';
import type { UserSummaryResponse } from '@/types/domain';
import type {
  NotificationTargetResponse,
  NotificationItemResponse,
  NotificationPageResponse,
  NotificationStateResponse,
  CommentResponse,
  ParticipantResponse,
  PublicUserProfileResponse,
  ConversationSummaryResponse,
} from '@/types/domain';
import type { Message, Conversation } from '@/features/messages/types';

export const userSummary = (overrides: Partial<UserSummaryResponse> = {}): UserSummaryResponse => ({
  id: 'fixture-user',
  username: 'fixture',
  displayName: null,
  avatarUrl: null,
  isVerified: false,
  verifiedCategory: null,
  ...overrides,
});

export const postFixture = (overrides: Partial<Post> = {}): Post => ({
  id: 'fixture-post',
  author: userSummary(),
  caption: null,
  postType: 'text',
  status: 'published',
  likeCount: 0,
  commentCount: 0,
  saveCount: 0,
  isLiked: false,
  isSaved: false,
  hasReported: false,
  viewCount: 0,
  locationName: null,
  latitude: null,
  longitude: null,
  media: [],
  hashtags: [],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  ...overrides,
});

export const notificationTarget = (
  overrides: Partial<NotificationTargetResponse> = {}
): NotificationTargetResponse => ({
  kind: 'post',
  postId: null,
  commentId: null,
  storyId: null,
  ticketId: null,
  userId: null,
  available: true,
  ...overrides,
});
export const notificationFixture = (
  overrides: Partial<NotificationItemResponse> = {}
): NotificationItemResponse => ({
  id: 'n1',
  type: 'like_post',
  category: 'like',
  actors: [userSummary({ id: 'u1', username: 'anna' })],
  actorCount: 1,
  isRead: false,
  readAt: null,
  isNew: true,
  activityAt: '2026-09-23T10:00:00.000000Z',
  createdAt: '2026-09-23T10:00:00.000000Z',
  target: notificationTarget({ postId: 'p1' }),
  preview: null,
  moderation: null,
  relationship: null,
  ...overrides,
});
export const notificationPage = (
  overrides: Partial<NotificationPageResponse> = {}
): NotificationPageResponse => ({
  content: [],
  pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
  degraded: false,
  head: null,
  ...overrides,
});
export const notificationState = (
  overrides: Partial<NotificationStateResponse> = {}
): NotificationStateResponse => ({
  unseen: { count: 0, capped: false },
  seen: null,
  previous: null,
  followRequests: { count: 0, capped: false, recent: [] },
  ...overrides,
});
export const commentFixture = (overrides: Partial<CommentResponse> = {}): CommentResponse => ({
  id: 'fixture-comment',
  postId: 'p1',
  author: userSummary(),
  parentId: null,
  rootId: null,
  depth: 0,
  content: 'hello',
  likeCount: 0,
  isLiked: false,
  hasReported: false,
  replyCount: 0,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  editedAt: null,
  pinned: false,
  ...overrides,
});
export const participantFixture = (
  overrides: Partial<ParticipantResponse> = {}
): ParticipantResponse => ({
  userId: 'fixture-user',
  username: 'fixture',
  displayName: null,
  avatarUrl: null,
  isVerified: false,
  verifiedCategory: null,
  joinedAt: '2026-09-01T00:00:00Z',
  leftAt: null,
  nickname: null,
  ...overrides,
});
export const messageFixture = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  messageType: 'text',
  content: 'hello',
  mediaAssetId: null,
  media: null,
  sharedPostId: null,
  sharedStoryId: null,
  replyToId: null,
  isDeleted: false,
  deletedAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  ...overrides,
});
export const conversationFixture = (
  overrides: Partial<
    Omit<ConversationSummaryResponse, 'lastMessage'> & { lastMessage: Message | null }
  > = {}
): Conversation => ({
  id: 'c1',
  participants: [],
  unreadCount: 0,
  lastMessage: null,
  lastMessageAt: null,
  pinned: false,
  muted: false,
  manuallyUnread: false,
  ...overrides,
});
export const profileFixture = (
  overrides: Partial<PublicUserProfileResponse> = {}
): PublicUserProfileResponse => ({
  id: 'fixture-user',
  username: 'fixture',
  displayName: null,
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  websiteUrl: null,
  isPrivate: false,
  isVerified: false,
  verifiedCategory: null,
  followerCount: 0,
  followingCount: 0,
  postCount: 0,
  createdAt: '2026-09-01T00:00:00Z',
  viewerState: {
    isFollowing: false,
    isFollowRequested: false,
    isFollowedBy: false,
    isBlocking: false,
    hasReported: false,
    isMutingPosts: false,
    isMutingStories: false,
    isShowingFewer: false,
  },
  ...overrides,
});
