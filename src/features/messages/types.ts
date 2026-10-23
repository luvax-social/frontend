import type {
  ConversationSummaryResponse,
  ConversationResponse,
  MessageResponse,
  StoryMediaResponse,
} from '@/types/domain';
import type { InfiniteData } from '@tanstack/react-query';
import type { ApiResponse, CursorPage } from '@/types/api';

export interface MessageMedia {
  cdnUrl: string;
  mediaType: string;
  mediaAssetId?: string;
  id?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  blurhash?: string | null;
  mimeType?: string;
  contentType?: string;
  url?: string;
  label?: string;
  /** Alt text of a shared post media item; absent on message attachments. */
  altText?: string | null;
}
export type PreviewMedia = Partial<MessageMedia> & { label?: string; id?: string; title?: string };
export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
}
export type Message = Omit<MessageResponse, 'media'> & {
  media: MessageMedia | null;
  sharedStory?: { media: StoryMediaResponse };
};
export type Conversation =
  | ConversationResponse
  | (Omit<ConversationSummaryResponse, 'lastMessage'> & { lastMessage: Message | null });
export type MessageData = InfiniteData<ApiResponse<CursorPage<Message>>, string | null>;
/** One emoji on a message, with how many people chose it and whether the viewer is one. */
export interface ReactionChipView {
  emoji: string;
  count: number;
  mine: boolean;
  /** The id of a reaction by someone else on this chip, which a report names; null when every reaction on it is the viewer's own. */
  reactionId: string | null;
}
export interface MessageView {
  id: string;
  conversationId: string;
  from: 'me' | 'them';
  kind: 'deleted' | 'reply' | 'story' | 'post' | 'file' | 'text';
  text: string;
  time: string;
  senderName: string;
  senderAvatarUrl: string | null;
  media: MessageMedia | null;
  sharedStoryMedia: MessageMedia | null;
  sharedPostId: string | null;
  sharedStoryId: string | null;
  replyTo: string | null;
  replyText: string | null;
  replyUnavailable: boolean;
  reactions: ReactionChipView[];
  myReaction: string | null;
  handle: string | null;
  title: string | null;
  meta: string | null;
  atMs: number | null;
  createdAtIso: string | null;
}
export interface MessageRun {
  showAvatar: boolean;
  isFirstInRun: boolean;
  isLastInRun: boolean;
}
export type ThreadRow =
  | { rowType: 'separator'; id: string; label: string }
  | ({ rowType: 'message' } & MessageView & MessageRun)
  | ({
      rowType: 'album';
      id: string;
      from: 'me' | 'them';
      senderName: string;
      senderAvatarUrl: string | null;
      items: MessageView[];
    } & MessageRun);
