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
export type Conversation = ConversationResponse | ConversationSummaryResponse;
export type MessageData = InfiniteData<ApiResponse<CursorPage<Message>>, string | null>;
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
