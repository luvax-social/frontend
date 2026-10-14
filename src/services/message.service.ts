import type { ApiResponse, CursorParams, CursorPage } from '@/types/api';
import type {
  ConversationFolder,
  ConversationSummaryResponse,
  ConversationResponse,
  MessageResponse,
  SendMessageRequest,
  UnreadCountResponse,
} from '@/types/domain';
import axiosInstance from './axiosInstance';

const CONVERSATION_API_PATH = '/conversations';

/**
 * Lists the caller's conversations in one inbox folder, most recent activity first.
 *
 * Calls `GET /conversations?folder=`. Each row already carries `unreadCount` and an embedded
 * `lastMessage`, so the list screen needs this call alone and never one request per conversation.
 * The folder defaults to `primary`; `requests` and `hidden_requests` hold the caller's incoming
 * message requests.
 *
 * @param {{folder?: string, cursor?: string, limit?: number, signal?: AbortSignal}} params
 * @returns {Promise<Object>} ApiResponse envelope wrapping a cursor page of conversation summaries.
 */
export const listConversations = async ({
  folder = 'primary',
  cursor,
  limit = 20,
  signal,
}: CursorParams & { folder?: ConversationFolder } = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<ConversationSummaryResponse>>>(
    CONVERSATION_API_PATH,
    {
      params: { folder, cursor, limit },
      signal,
    }
  );
  return response.data;
};

/**
 * Retrieves one conversation's detail, including its participant list.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope wrapping the conversation.
 */
export const getConversation = async (conversationId: string) => {
  const response = await axiosInstance.get<ApiResponse<ConversationResponse>>(
    `${CONVERSATION_API_PATH}/${conversationId}`
  );
  return response.data;
};

/**
 * Resolves or creates the direct conversation with one other user.
 *
 * Safe to call repeatedly: the database carries a direct-conversation pair key, so a second call
 * for the same pair returns the existing conversation rather than creating a duplicate.
 *
 * @param {string} targetUserId
 * @returns {Promise<Object>} ApiResponse envelope wrapping the conversation.
 */
export const createDirect = async (targetUserId: string) => {
  const response = await axiosInstance.post<ApiResponse<ConversationResponse>>(
    CONVERSATION_API_PATH,
    { targetUserId }
  );
  return response.data;
};

/**
 * Cursor-paginated message history for one conversation, newest first.
 * @param {string} conversationId
 * @param {{cursor?: string, limit?: number, signal?: AbortSignal}} params
 * @returns {Promise<Object>} ApiResponse envelope wrapping a cursor page of messages.
 */
export const listMessages = async (
  conversationId: string,
  { cursor, limit = 30, signal }: CursorParams = {}
) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<MessageResponse>>>(
    `${CONVERSATION_API_PATH}/${conversationId}/messages`,
    {
      params: { cursor, limit },
      signal,
    }
  );
  return response.data;
};

/**
 * Sends a message.
 *
 * `idempotencyKey` travels as the `Idempotency-Key` header the server already honours, so a
 * retried or double-tapped send cannot create two messages.
 *
 * @param {string} conversationId
 * @param {{messageType: string, content?: string, mediaAssetId?: string, sharedPostId?: string,
 *          sharedStoryId?: string, replyToId?: string}} body
 * @param {string} [idempotencyKey]
 * @returns {Promise<Object>} ApiResponse envelope wrapping the created message.
 */
export const sendMessage = async (
  conversationId: string,
  body: SendMessageRequest,
  idempotencyKey?: string
) => {
  const response = await axiosInstance.post<ApiResponse<MessageResponse>>(
    `${CONVERSATION_API_PATH}/${conversationId}/messages`,
    body,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
  );
  return response.data;
};

/**
 * Sender-only soft delete. The message stays in history as a placeholder.
 * @param {string} conversationId
 * @param {string} messageId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const deleteMessage = async (conversationId: string, messageId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/messages/${messageId}`
  );
  return response.data;
};

/**
 * Marks every message in a conversation as read for the caller.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const markRead = async (conversationId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/read`
  );
  return response.data;
};

/**
 * Clears the caller's read marker for a conversation, so every message in it counts as unread
 * again.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const markUnread = async (conversationId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/unread`
  );
  return response.data;
};

/**
 * Deletes a conversation from the caller's own inbox only. The other participant and the message
 * history are untouched; a new message from them brings it back.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const leaveConversation = async (conversationId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}`
  );
  return response.data;
};

/**
 * Total unread messages across every conversation; drives the navigation badge.
 * @returns {Promise<Object>} ApiResponse envelope wrapping the count.
 */
export const getUnreadCount = async () => {
  const response = await axiosInstance.get<ApiResponse<UnreadCountResponse>>(
    `${CONVERSATION_API_PATH}/unread-count`
  );
  return response.data;
};

/**
 * Pins a conversation to the top of the caller's own conversation list.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const pinConversation = async (conversationId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/pin`
  );
  return response.data;
};

/**
 * Unpins a conversation for the caller.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const unpinConversation = async (conversationId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/pin`
  );
  return response.data;
};

/**
 * Mutes a conversation's notifications for the caller.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const muteConversation = async (conversationId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/mute`
  );
  return response.data;
};

/**
 * Unmutes a conversation for the caller.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const unmuteConversation = async (conversationId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/mute`
  );
  return response.data;
};

/**
 * Sets or clears the caller's private label for the other participant in a conversation.
 * @param {string} conversationId
 * @param {string|null} nickname Pass null or blank to clear.
 * @returns {Promise<Object>} ApiResponse envelope.
 */
export const setNickname = async (conversationId: string, nickname: string | null) => {
  const response = await axiosInstance.put<ApiResponse<null>>(
    `${CONVERSATION_API_PATH}/${conversationId}/nickname`,
    {
      nickname,
    }
  );
  return response.data;
};

/**
 * Accepts a message request the caller received, moving it to the primary folder.
 *
 * Calls `POST /conversations/{id}/accept`. A `CONVERSATION_NOT_FOUND` answer covers every refusal,
 * a block included, so the caller cannot tell why it failed.
 * @param {string} conversationId
 * @returns {Promise<Object>} ApiResponse envelope wrapping the accepted conversation.
 */
export const acceptRequest = async (conversationId: string) => {
  const response = await axiosInstance.post<ApiResponse<ConversationResponse>>(
    `${CONVERSATION_API_PATH}/${conversationId}/accept`
  );
  return response.data;
};

/**
 * Deletes a message request the caller received. The sender is not told.
 *
 * Calls `DELETE /conversations/{id}/request`, which answers 204 with no body.
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export const deleteRequest = async (conversationId: string) => {
  await axiosInstance.delete(`${CONVERSATION_API_PATH}/${conversationId}/request`);
};

/**
 * Declines a message request and blocks its sender in one server transaction.
 *
 * Calls `POST /conversations/{id}/block`, which answers 204 with no body.
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export const blockRequester = async (conversationId: string) => {
  await axiosInstance.post(`${CONVERSATION_API_PATH}/${conversationId}/block`);
};

export const messageService = {
  listConversations,
  getConversation,
  createDirect,
  listMessages,
  sendMessage,
  deleteMessage,
  markRead,
  markUnread,
  leaveConversation,
  getUnreadCount,
  pinConversation,
  unpinConversation,
  muteConversation,
  unmuteConversation,
  setNickname,
  acceptRequest,
  deleteRequest,
  blockRequester,
};

export default messageService;
