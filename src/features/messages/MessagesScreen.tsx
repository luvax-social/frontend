import type { CSSProperties } from 'react';
import type { MessageView, PendingAttachment, PreviewMedia } from './types';
import type { ThreadSummary } from './utils/messageViewModel';
import type { ReportTarget } from '@/types/report';
import type { ConversationFolder } from '@/types/domain';
type ThreadTarget = Omit<ThreadSummary, 'id'> & { id: string | null };
declare global {
  interface Window {
    __lxMessagesBack?: () => boolean;
  }
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { v } from '@/config/tokens';
import { CHAR_LIMITS, ROUTES, routeTo } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';
import { useAuthStore } from '@/store/useAuthStore';
import {
  counterpartOf,
  toPendingThread,
  toThread,
  toThreadSummary,
} from './utils/messageViewModel';
import {
  conversationsKey,
  useConversations,
  useInboxCounts,
  useMarkRead,
  useMarkUnread,
  useLeaveConversation,
  usePinConversation,
  useUnpinConversation,
  useMuteConversation,
  useUnmuteConversation,
  useSetNickname,
} from './hooks/useConversations';
import { useMessages, useDeleteMessage, useSendMessage } from './hooks/useMessages';
import { useLiveMessages } from './hooks/useLiveMessages';
import { useReactions } from './hooks/useReactions';
import { useAcceptRequest, useBlockRequester, useDeleteRequest } from './hooks/useMessageRequests';
import { deleteRequestConfirm } from './utils/requestConfirm';
import { UNAVAILABLE_NOTICE, isNotFoundError } from './utils/unavailable';
import { isVideoMessageMedia } from './utils/messageMedia';
import { ConversationListPanel } from './components/ConversationListPanel';
import { ChatCenterPanel } from './components/ChatCenterPanel';
import { ConversationInfoPanel } from './components/ConversationInfoPanel';
import { MediaPlaceholder } from './components/MediaPlaceholder';
import { messageService } from '@/services/message.service';
import { REPORT_TYPES } from '@/services/report.service';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useLuvaxTweaks } from '@/features/luvax/LuvaxTweaksContext';
import { toast } from '@/features/luvax/components/Toast';
import { useMediaUpload } from '@/features/luvax/hooks/useMediaUpload';
import { useMediaConstraints } from '@/features/luvax/hooks/useMediaConstraints';
import { useUserProfile } from '@/features/luvax/hooks/useUsers';
import { useBlock, useBlockedUsers } from '@/features/luvax/hooks/useSocial';
import { ReportModal } from '@/features/luvax/components/ReportModal';
import { BlockConfirmDialog } from '@/features/luvax/components/BlockConfirmDialog';
import { validateDuration, validateFile } from '@/features/luvax/utils/composerMedia';
import { extractPageContent } from '@/utils/helpers';
import { getErrorData, getErrorMessage } from '@/utils/errors';

// A message send holds fewer items than a post carousel by design: a burst of ten photos already
// reads as a lot in a chat thread, and the album viewer (see MessageAlbum) is tuned for that count.
const MAX_MESSAGE_ATTACHMENTS = 10;

// `vw`/`vh` are computed against the true browser viewport, not adjusted for the root's `zoom`
// scale (see APP_SCALE in LuvaxApp.tsx) applied to an ancestor - so a raw `92vw` here rendered
// `zoom` times too large and could push most of the image off-screen. Dividing by --lx-scale
// cancels the zoom multiplication back out, the same fix already used for this element's own
// on-screen position elsewhere (see lx-dropdown-menu.tsx).
const LIGHTBOX_MAX_WIDTH = 'calc(92vw / var(--lx-scale))';
const LIGHTBOX_MAX_HEIGHT = 'calc(92vh / var(--lx-scale))';

// Light frosted chips over the dark scrim, matching the post viewer's own carousel controls.
const lightboxArrowStyle = (side: 'left' | 'right'): CSSProperties => ({
  position: 'absolute',
  top: '50%',
  [side]: 16,
  transform: 'translateY(-50%)',
  width: 36,
  height: 36,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(255,255,255,0.9)',
  boxShadow: '0 1px 5px rgba(0,0,0,0.3)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  zIndex: 2,
});

const messagingUnavailableStorageKey = (userId: string | undefined) =>
  `luvax:messages:unavailable:${userId || 'anonymous'}`;

const readMessagingUnavailableKeys = (storageKey: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string')
      : [];
  } catch {
    return [];
  }
};

const writeMessagingUnavailableKeys = (storageKey: string, keys: string[]) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(keys))));
};

const removeMessagingUnavailableKey = (storageKey: string, keyToRemove: string) => {
  const next = readMessagingUnavailableKeys(storageKey).filter((key) => key !== keyToRemove);
  writeMessagingUnavailableKeys(storageKey, next);
  return next;
};

export function MessagesScreen() {
  const { viewport } = useLuvaxTweaks();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const unavailableStorageKey = useMemo(
    () => messagingUnavailableStorageKey(currentUserId),
    [currentUserId]
  );
  const [folder, setFolder] = useState<ConversationFolder>('primary');
  const { conversations, isLoading: conversationsLoading } = useConversations(folder);
  const { requestCount } = useInboxCounts();
  // The adapter owns every mapping from the API shape onto what these panels render.
  const threads = useMemo(
    () => conversations.map((conversation) => toThreadSummary(conversation, currentUserId)),
    [conversations, currentUserId]
  );
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageView | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(viewport !== 'mobile');
  const [infoOpen, setInfoOpen] = useState(false);
  // { items: [media, ...], index } while a lightbox is open, so a multi-photo album can step
  // through the whole set with next/prev instead of only ever showing the one tile clicked.
  const [previewGallery, setPreviewGallery] = useState<{
    items: PreviewMedia[];
    index: number;
  } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
  const [deleteThreadTarget, setDeleteThreadTarget] = useState<ThreadTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<ThreadTarget | null>(null);
  const [deleteRequestTarget, setDeleteRequestTarget] = useState<ThreadTarget | null>(null);
  const [blockRequestTarget, setBlockRequestTarget] = useState<ThreadTarget | null>(null);
  const [locallyBlockedUserIds, setLocallyBlockedUserIds] = useState<string[]>([]);
  const [unavailableProbeTick, setUnavailableProbeTick] = useState(0);
  const [messagingUnavailableByStorageKey, setMessagingUnavailableByStorageKey] = useState(() => ({
    [unavailableStorageKey]: readMessagingUnavailableKeys(unavailableStorageKey),
  }));
  const [nicknameTarget, setNicknameTarget] = useState<ThreadTarget | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  // Set only by a profile's "message" button, before any conversation exists between the two
  // people. Nothing is written to the server until the first message actually sends - see
  // handleSend - so this is the only record of that intent until then.
  const [pendingTargetUserId, setPendingTargetUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const listOnlyMobile = viewport === 'mobile' && !threadOpen;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeComposerKeyRef = useRef<string | null>(null);
  const draftRef = useRef('');
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const composerDraftsRef = useRef<Record<string, string>>({});
  const composerAttachmentsRef = useRef<Record<string, PendingAttachment[]>>({});

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter(
      (thread) =>
        thread.name.toLowerCase().includes(query) ||
        thread.username.toLowerCase().includes(query) ||
        thread.preview.toLowerCase().includes(query)
    );
  }, [search, threads]);

  // A pending target resolves to a real conversation the moment one exists for that pair -
  // whether it was already there (they messaged first, or a mutual follow provisioned one) or
  // was just created by this screen's own first send below.
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeThreadId) ||
    (pendingTargetUserId
      ? conversations.find(
          (conversation) =>
            counterpartOf(conversation, currentUserId)?.userId === pendingTargetUserId
        )
      : null) ||
    null;
  const { messages: activeMessages } = useMessages(activeConversation?.id);
  const { data: pendingProfileResponse } = useUserProfile(
    pendingTargetUserId,
    Boolean(pendingTargetUserId) && !activeConversation
  );
  const activeThread = activeConversation
    ? toThread(activeConversation, activeMessages, currentUserId)
    : pendingProfileResponse?.data
      ? toPendingThread(pendingProfileResponse.data)
      : null;
  const activeComposerKey =
    activeConversation?.id || (pendingTargetUserId ? `pending:${pendingTargetUserId}` : null);
  const activeReplyingTo =
    replyingTo?.conversationId === activeConversation?.id ? replyingTo : null;
  const { data: blockedResponse } = useBlockedUsers();
  const blockedRows = useMemo(() => extractPageContent(blockedResponse), [blockedResponse]);
  const serverBlockedUserIdSet = useMemo(() => {
    const ids = new Set<string>();
    blockedRows.forEach((row) => {
      const id = row?.user?.id ?? (row as typeof row & { id?: string }).id;
      if (id) ids.add(id);
    });
    return ids;
  }, [blockedRows]);
  const blockedUserIdSet = useMemo(() => {
    const ids = new Set(locallyBlockedUserIds);
    serverBlockedUserIdSet.forEach((id) => ids.add(id));
    return ids;
  }, [locallyBlockedUserIds, serverBlockedUserIdSet]);
  const isThreadBlocked = useCallback(
    (thread: ThreadTarget | null) =>
      Boolean(thread?.counterpartId && blockedUserIdSet.has(thread.counterpartId)),
    [blockedUserIdSet]
  );
  const activeCounterpartId = activeThread?.counterpartId || null;
  const isActiveThreadBlocked = isThreadBlocked(activeThread);
  const messagingUnavailableKeys =
    messagingUnavailableByStorageKey[unavailableStorageKey] ||
    readMessagingUnavailableKeys(unavailableStorageKey);
  const isMessagingUnavailable = Boolean(
    activeComposerKey && messagingUnavailableKeys.includes(activeComposerKey)
  );
  const messageBlockHint = isActiveThreadBlocked
    ? `you blocked ${activeThread?.username ? `@${activeThread.username}` : activeThread?.name}. messaging is paused until you unblock them.`
    : 'messaging is unavailable for this conversation.';

  useLiveMessages(activeConversation?.id);
  const { react } = useReactions(activeConversation?.id, currentUserId);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    const previousKey = activeComposerKeyRef.current;
    if (previousKey === activeComposerKey) return;

    if (previousKey) {
      composerDraftsRef.current[previousKey] = draftRef.current;
      composerAttachmentsRef.current[previousKey] = pendingAttachmentsRef.current;
    }

    activeComposerKeyRef.current = activeComposerKey;
    setReplyingTo(null);
    setDraft(activeComposerKey ? composerDraftsRef.current[activeComposerKey] || '' : '');
    setPendingAttachments(
      activeComposerKey ? composerAttachmentsRef.current[activeComposerKey] || [] : []
    );
  }, [activeComposerKey]);

  useEffect(
    () => () => {
      const previewUrls = new Set<string>();
      pendingAttachmentsRef.current.forEach((item) => {
        if (item.previewUrl) previewUrls.add(item.previewUrl);
      });
      Object.values(composerAttachmentsRef.current).forEach((items) => {
        items.forEach((item) => {
          if (item.previewUrl) previewUrls.add(item.previewUrl);
        });
      });
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  // Promotes a pending target to a real, selected conversation the moment one resolves above -
  // whether that took a round trip through handleSend or was already sitting in the list.
  useEffect(() => {
    if (pendingTargetUserId && activeConversation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveThreadId(activeConversation.id);
      setPendingTargetUserId(null);
    }
  }, [pendingTargetUserId, activeConversation]);

  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const leaveConversation = useLeaveConversation();
  const pinConversation = usePinConversation();
  const unpinConversation = useUnpinConversation();
  const muteConversation = useMuteConversation();
  const unmuteConversation = useUnmuteConversation();
  const setNickname = useSetNickname();
  const block = useBlock();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage(activeConversation?.id);
  const { uploadMedia, getMediaMetadata } = useMediaUpload();
  const { constraints: mediaConstraints } = useMediaConstraints();

  useEffect(() => {
    if (block.isPending) return;
    // Reconcile optimistic message-panel blocks with unblocks performed from profile/settings.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocallyBlockedUserIds((ids) => ids.filter((id) => serverBlockedUserIdSet.has(id)));
  }, [block.isPending, serverBlockedUserIdSet]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const retryUnavailableProbe = () => setUnavailableProbeTick((tick) => tick + 1);
    window.addEventListener('focus', retryUnavailableProbe);
    document.addEventListener('visibilitychange', retryUnavailableProbe);
    return () => {
      window.removeEventListener('focus', retryUnavailableProbe);
      document.removeEventListener('visibilitychange', retryUnavailableProbe);
    };
  }, []);

  useEffect(() => {
    if (
      !isMessagingUnavailable ||
      !activeConversation?.id ||
      !activeComposerKey ||
      !activeCounterpartId ||
      isActiveThreadBlocked
    ) {
      return undefined;
    }

    let cancelled = false;
    messageService
      .createDirect(activeCounterpartId)
      .then(() => {
        if (cancelled) return;
        setMessagingUnavailableByStorageKey((byKey) => ({
          ...byKey,
          [unavailableStorageKey]: removeMessagingUnavailableKey(
            unavailableStorageKey,
            activeComposerKey
          ),
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    activeComposerKey,
    activeConversation?.id,
    activeCounterpartId,
    isActiveThreadBlocked,
    isMessagingUnavailable,
    unavailableProbeTick,
    unavailableStorageKey,
  ]);

  useEffect(() => {
    if (activeConversation?.id) {
      markRead.mutate(activeConversation.id);
    }
    // markRead is recreated each render; depending on it would re-fire the mutation continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id]);

  useEffect(() => {
    // A pending target is its own selection; the usual "pick something" fallback must not
    // steal it back to the first real thread while it's still waiting to resolve.
    // A request folder never opens a request on its own: opening one is the recipient's choice, and
    // a request that disappears from the list simply leaves the panel empty.
    if (pendingTargetUserId || folder !== 'primary') return;
    if (!activeThreadId && filteredThreads[0]) {
      if (viewport !== 'mobile') {
        // Reconciles the selected thread with the thread list after it changes.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveThreadId(filteredThreads[0].id);
      }
    } else if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(threads[0]?.id || null);
    }
  }, [activeThreadId, filteredThreads, threads, viewport, pendingTargetUserId, folder]);

  useEffect(() => {
    if (pendingTargetUserId || folder !== 'primary') return;
    if (viewport !== 'mobile' && !activeThreadId && threads[0]) {
      // Selects a default thread once the viewport is wide enough to show one.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveThreadId(threads[0].id);
    }
  }, [viewport, activeThreadId, threads, pendingTargetUserId, folder]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [activeThreadId, threads]);

  // A profile's "message" button lands here carrying the target in route state rather than a URL
  // param, so a stale bookmark can never re-trigger it. The state is cleared right after firing, so
  // navigating back into the thread later - or a browser back/forward - does not replay it.
  // No conversation is created here: setting pendingTargetUserId is enough to show the thread
  // (see activeThread above), and the derivation there already picks up a real conversation if
  // one exists for this pair. Creating one is deferred to the first actual send, in handleSend.
  useEffect(() => {
    const targetUserId = location.state?.openWithUserId;
    if (!targetUserId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveThreadId(null);
    setPendingTargetUserId(targetUserId);
    if (viewport === 'mobile') {
      setThreadOpen(true);
      setInfoOpen(false);
    }
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    window.__lxMessagesBack = () => {
      if (viewport === 'mobile' && threadOpen) {
        setThreadOpen(false);
        return true;
      }
      return false;
    };

    return () => {
      if (window.__lxMessagesBack) {
        delete window.__lxMessagesBack;
      }
    };
  }, [threadOpen, viewport]);

  useEffect(() => {
    if (viewport !== 'mobile') {
      // Bridges the shell back action onto window for the mobile pane.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThreadOpen(true);
      setInfoOpen(false);
    }
  }, [viewport]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('lx_messages_thread_open', {
        detail: { open: viewport === 'mobile' && threadOpen },
      })
    );
  }, [threadOpen, viewport]);

  const openPreview = (items: PreviewMedia[], index = 0) => setPreviewGallery({ items, index });

  const openStory = (storyId: string) => {
    if (storyId) navigate(routeTo.storyView(storyId), { state: { background: ROUTES.MESSAGES } });
  };

  const selectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setPendingTargetUserId(null);
    if (viewport === 'mobile') {
      setThreadOpen(true);
      setInfoOpen(false);
    }
    // Unread is database-owned. Opening the conversation marks it read server-side through the
    // effect above, and the list is re-read from the response.
  };

  const nextIdempotencyKey = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sendTextMessage = (conversationId: string, value: string) => {
    const idempotencyKey = nextIdempotencyKey();
    return sendMessage.mutateAsync({
      conversationId,
      idempotencyKey,
      body: {
        messageType: 'text',
        content: value,
        replyToId: activeReplyingTo?.id || null,
      },
      // Shaped like a MessageResponse so the adapter renders it with no special case, and so a
      // rollback simply removes it again.
      optimisticMessage: {
        id: `pending-${idempotencyKey}`,
        conversationId,
        senderId: currentUserId ?? null,
        messageType: 'text',
        content: value,
        mediaAssetId: null,
        media: null,
        sharedPostId: null,
        sharedStoryId: null,
        replyToId: activeReplyingTo?.id || null,
        replyTo: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        reactions: [],
      },
    });
  };

  /**
   * Uploads one staged file through the same pre-signed R2 flow the post composer uses, then sends
   * it as a media message. The optimistic bubble renders from the staged preview URL so the
   * attachment appears immediately, before the CDN URL comes back on the real response.
   *
   * Awaits the send itself, not just the upload - `mutate()` fires the request and returns
   * immediately, so a caller looping over several attachments with only the upload awaited was
   * racing every send request over the network instead of sending them in order.
   */
  const sendAttachmentMessage = async (
    conversationId: string,
    item: PendingAttachment,
    caption: string | null = null
  ) => {
    const asset = await uploadMedia(item.file);
    const idempotencyKey = nextIdempotencyKey();
    const content = caption?.trim() || null;

    return sendMessage.mutateAsync({
      conversationId,
      idempotencyKey,
      body: {
        messageType: item.isVideo ? 'video' : 'image',
        content,
        mediaAssetId: asset.id,
        replyToId: activeReplyingTo?.id || null,
      },
      optimisticMessage: {
        id: `pending-${idempotencyKey}`,
        conversationId,
        senderId: currentUserId ?? null,
        messageType: item.isVideo ? 'video' : 'image',
        content,
        mediaAssetId: asset.id,
        media: {
          mediaAssetId: asset.id,
          mediaType: item.isVideo ? 'VIDEO' : 'IMAGE',
          cdnUrl: asset.cdnUrl || item.previewUrl,
        },
        sharedPostId: null,
        sharedStoryId: null,
        replyToId: activeReplyingTo?.id || null,
        replyTo: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        reactions: [],
      },
    });
  };

  /**
   * Validates and stages picked files, same checks the post composer runs (type, size, and
   * measured video duration against the server-published constraints) plus a per-send count cap
   * the server has no equivalent for.
   */
  const handleStageAttachments = async (files: File[]) => {
    const room = MAX_MESSAGE_ATTACHMENTS - pendingAttachments.length;
    if (room <= 0) {
      toast(`a message holds ${MAX_MESSAGE_ATTACHMENTS} attachments at most.`);
      return;
    }

    let rejection = '';
    if (files.length > room) {
      rejection = `a message holds ${MAX_MESSAGE_ATTACHMENTS} attachments at most, so ${room} of the ${files.length} you chose were added.`;
    }

    const accepted: PendingAttachment[] = [];
    for (const file of files.slice(0, room)) {
      const check = validateFile(file, mediaConstraints);
      if (!check.ok) {
        rejection = check.message ?? '';
        continue;
      }
      const metadata = await getMediaMetadata(file).catch(() => null);
      const durationCheck = validateDuration(
        file,
        typeof metadata?.duration === 'number' ? metadata.duration : undefined,
        mediaConstraints
      );
      if (!durationCheck.ok) {
        rejection = durationCheck.message ?? '';
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
      });
    }

    if (rejection) toast(rejection);
    if (accepted.length > 0) setPendingAttachments((current) => [...current, ...accepted]);
  };

  const handleRemovePendingAttachment = (id: string) => {
    setPendingAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  /**
   * Sends every staged attachment, in the order they were picked, followed by the typed caption as
   * its own trailing message. Each is a separate message rather than one album message - the
   * bubble grouping already collapses a same-sender burst sent seconds apart into one visual
   * cluster, so the reader sees one exchange either way.
   *
   * A pending (not-yet-real) thread has no conversation id to send into, so the first send here
   * creates one first - the same idempotent create-or-reuse call a mutual-follow auto-provision or
   * a second "message" click would hit, so two people who both clicked "message" on each other
   * before either typed anything still end up in the one conversation, not two.
   */
  const handleSend = async () => {
    const value = draft.trim();
    if ((!activeConversation && !pendingTargetUserId) || (!value && !pendingAttachments.length)) {
      return;
    }

    const sendingComposerKey = activeComposerKey;
    setIsSending(true);
    try {
      let conversationId = activeConversation?.id;
      if (!conversationId) {
        const response = await messageService.createDirect(pendingTargetUserId!);
        conversationId = response?.data?.id;
        // Awaited, not fired and forgotten: the reconciliation effects above reset the active
        // thread whenever its id is absent from the loaded list, so selecting it before the
        // refetch lands would snap the panel straight back to the previous thread.
        await queryClient.invalidateQueries({ queryKey: conversationsKey });
      }

      for (const [index, item] of pendingAttachments.entries()) {
        // Sequential, not parallel: message order in the thread must match send order.
        await sendAttachmentMessage(
          conversationId,
          item,
          index === 0 && pendingAttachments.length > 0 ? value : null
        );
      }
      pendingAttachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingAttachments([]);

      if (value && pendingAttachments.length === 0) await sendTextMessage(conversationId, value);

      [sendingComposerKey, conversationId]
        .filter((key): key is string => Boolean(key))
        .forEach((key) => {
          delete composerDraftsRef.current[key];
          delete composerAttachmentsRef.current[key];
        });
      draftRef.current = '';
      pendingAttachmentsRef.current = [];
      setDraft('');
      setReplyingTo(null);
      setActiveThreadId(conversationId);
      setPendingTargetUserId(null);
    } catch (error) {
      const code = getErrorData(error)?.code;
      if (sendingComposerKey && (code === 'CONVERSATION_NOT_FOUND' || code === 'NOT_FOUND')) {
        setMessagingUnavailableByStorageKey((byKey) => {
          const keys =
            byKey[unavailableStorageKey] || readMessagingUnavailableKeys(unavailableStorageKey);
          const next = keys.includes(sendingComposerKey) ? keys : [...keys, sendingComposerKey];
          writeMessagingUnavailableKeys(unavailableStorageKey, next);
          return { ...byKey, [unavailableStorageKey]: next };
        });
      }
      const uploadMessage =
        error && typeof error === 'object' && 'uploadMessage' in error
          ? error.uploadMessage
          : undefined;
      toast(
        typeof uploadMessage === 'string' && uploadMessage
          ? uploadMessage
          : getErrorMessage(error, "couldn't send that. try again.")
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteToggle = (messageId: string) => {
    setPendingDeleteMessageId(messageId);
  };

  const handleDeleteConfirm = () => {
    if (!activeConversation || !pendingDeleteMessageId) return;
    deleteMessage.mutate(pendingDeleteMessageId);
    setPendingDeleteMessageId(null);
  };

  const handleDeleteThreadConfirm = () => {
    if (!deleteThreadTarget) return;
    leaveConversation.mutate(deleteThreadTarget.id!, {
      onError: (error) => toast(error?.message || "couldn't delete that chat. try again."),
    });
    setDeleteThreadTarget(null);
  };

  const handleReportThread = (thread: ThreadTarget) => {
    setReportTarget({
      entityType: REPORT_TYPES.USER,
      entityId: thread.counterpartId!,
      author: thread.name,
      avatarUrl: thread.avatarUrl,
    });
  };

  const handleReportReaction = (reactionId: string) => {
    if (!activeThread) return;
    setReportTarget({
      entityType: REPORT_TYPES.MESSAGE_REACTION,
      entityId: reactionId,
      author: activeThread.name,
      avatarUrl: activeThread.avatarUrl,
    });
  };

  const handleBlockConfirm = () => {
    if (!blockTarget) return;
    const target = blockTarget;
    if (isThreadBlocked(target)) {
      setBlockTarget(null);
      return;
    }
    setLocallyBlockedUserIds((ids) =>
      ids.includes(target.counterpartId!) ? ids : [...ids, target.counterpartId!]
    );
    block.mutate(target.counterpartId!, {
      onError: (error) => {
        setLocallyBlockedUserIds((ids) => ids.filter((id) => id !== target.counterpartId));
        toast(error?.message || "couldn't block that account. try again.");
      },
    });
    setBlockTarget(null);
  };

  const handleRenameThread = (thread: ThreadTarget) => {
    setNicknameTarget(thread);
    setNicknameValue(thread.nickname || '');
  };

  const handleSaveNickname = () => {
    if (!nicknameTarget) return;
    setNickname.mutate(
      { conversationId: nicknameTarget.id!, nickname: nicknameValue.trim() },
      { onError: (error) => toast(error?.message || "couldn't save that nickname. try again.") }
    );
    setNicknameTarget(null);
  };

  const acceptRequest = useAcceptRequest();
  const deleteRequest = useDeleteRequest();
  const blockRequester = useBlockRequester();
  const requestBusy =
    acceptRequest.isPending || deleteRequest.isPending || blockRequester.isPending;

  const handleSelectFolder = (next: ConversationFolder) => {
    if (next === folder) return;
    setFolder(next);
    setActiveThreadId(null);
    setPendingTargetUserId(null);
  };

  // A not-found on a request action is answered with the same generic notice whatever caused it,
  // a block included. The failed row is rolled back by the mutation and then re-read, so a request
  // that really is gone drops out of the list without the client saying why.
  const handleRequestFailure = (error: unknown) =>
    toast(
      isNotFoundError(error)
        ? UNAVAILABLE_NOTICE
        : getErrorMessage(error, "Couldn't update that request. Try again.")
    );

  const handleAcceptRequest = async () => {
    const conversationId = activeConversation?.id;
    if (!conversationId) return;
    try {
      await acceptRequest.mutateAsync(conversationId);
      // The primary folder was refetched before the mutation settled, so the accepted
      // conversation is already listed when the panel switches to it.
      setFolder('primary');
      setActiveThreadId(conversationId);
    } catch (error) {
      handleRequestFailure(error);
    }
  };

  const handleDeleteRequestConfirm = () => {
    if (!deleteRequestTarget?.id) return;
    const conversationId = deleteRequestTarget.id;
    setDeleteRequestTarget(null);
    deleteRequest.mutate(conversationId, {
      onSuccess: () => setActiveThreadId(null),
      onError: handleRequestFailure,
    });
  };

  const handleBlockRequestConfirm = () => {
    if (!blockRequestTarget?.id) return;
    const conversationId = blockRequestTarget.id;
    setBlockRequestTarget(null);
    blockRequester.mutate(conversationId, {
      onSuccess: () => setActiveThreadId(null),
      onError: handleRequestFailure,
    });
  };

  const showDetail = viewport !== 'mobile' || threadOpen;
  const showSidebar = viewport !== 'mobile' || listOnlyMobile;
  const isDesktop = viewport === 'desktop';
  const isTablet = viewport === 'tablet';
  const desktopSidebar = 320;
  const tabletSidebar = 316;

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        background: v.base,
        color: v.ink,
        display: 'grid',
        // No third column for the info panel: it is hidden by default on every viewport now and
        // opens as an overlay from the header's info button, so it never reserves screen width it
        // isn't using.
        gridTemplateColumns: isDesktop
          ? `${desktopSidebar}px minmax(520px, 1fr)`
          : isTablet
            ? `${tabletSidebar}px minmax(40px, 1fr)`
            : '1fr',
        // Explicit, not auto: an auto row's track size can end up based on its content rather
        // than the container's own (definite) height, which is what let the message list and
        // the page itself both grow taller than the viewport and scroll independently.
        gridTemplateRows: '1fr',
        paddingTop: viewport === 'mobile' ? (threadOpen ? 0 : 56) : 0,
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        overflow: 'hidden',
        alignItems: 'stretch',
        borderLeft: viewport !== 'mobile' ? `1px solid ${v.border}` : 'none',
        borderRight: viewport !== 'mobile' ? `1px solid ${v.border}` : 'none',
      }}
    >
      {showSidebar ? (
        <ConversationListPanel
          folder={folder}
          requestCount={requestCount}
          onSelectFolder={handleSelectFolder}
          loading={conversationsLoading}
          search={search}
          setSearch={setSearch}
          filteredThreads={filteredThreads}
          activeThreadId={activeThreadId}
          selectThread={selectThread}
          viewport={viewport}
          onMarkRead={(threadId) => markRead.mutate(threadId)}
          onMarkUnread={(threadId) => markUnread.mutate(threadId)}
          onDeleteThread={setDeleteThreadTarget}
          onReportThread={handleReportThread}
          onBlockThread={setBlockTarget}
          isThreadBlocked={isThreadBlocked}
          onPinThread={(threadId) => pinConversation.mutate(threadId)}
          onUnpinThread={(threadId) => unpinConversation.mutate(threadId)}
          onMuteThread={(threadId) => muteConversation.mutate(threadId)}
          onUnmuteThread={(threadId) => unmuteConversation.mutate(threadId)}
          onRenameThread={handleRenameThread}
        />
      ) : null}

      {showDetail ? (
        <ChatCenterPanel
          viewport={viewport}
          activeThread={activeThread}
          setActiveThreadId={setActiveThreadId}
          closeThread={() => setThreadOpen(false)}
          openInfo={() => setInfoOpen(true)}
          isDesktop={isDesktop}
          isTablet={isTablet}
          scrollerRef={scrollerRef}
          openPreview={openPreview}
          openStory={openStory}
          handleDeleteToggle={handleDeleteToggle}
          replyingTo={activeReplyingTo}
          setReplyingTo={setReplyingTo}
          draft={draft}
          setDraft={setDraft}
          handleSend={handleSend}
          pendingAttachments={pendingAttachments}
          onStageAttachments={handleStageAttachments}
          onRemovePendingAttachment={handleRemovePendingAttachment}
          isSending={isSending}
          isBlocked={isActiveThreadBlocked || isMessagingUnavailable}
          blockedHint={messageBlockHint}
          onReact={react}
          onReportReaction={handleReportReaction}
          requestActions={{
            onAccept: handleAcceptRequest,
            onDelete: () => activeThread && setDeleteRequestTarget(activeThread),
            onBlock: () => activeThread && setBlockRequestTarget(activeThread),
            busy: requestBusy,
          }}
        />
      ) : null}

      {infoOpen && activeThread ? (
        <div
          onClick={() => setInfoOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: v.scrim,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            zIndex: 130,
            padding: viewport === 'mobile' ? '0 0 0 38px' : 0,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: viewport === 'mobile' ? 'min(calc(78vw / var(--lx-scale)), 340px)' : 320,
              background: v.base,
              border: `1px solid ${v.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <ConversationInfoPanel
              activeThread={activeThread}
              currentUserId={currentUserId}
              openPreview={openPreview}
              mobileOverlay
              onClose={() => setInfoOpen(false)}
              onMute={() => {
                if (activeThreadId) muteConversation.mutate(activeThreadId);
              }}
              onUnmute={() => {
                if (activeThreadId) unmuteConversation.mutate(activeThreadId);
              }}
              onRename={activeThread.counterpartId ? () => handleRenameThread(activeThread) : null}
              onReport={activeThread.counterpartId ? () => handleReportThread(activeThread) : null}
              onBlock={
                activeThread.counterpartId && !isActiveThreadBlocked
                  ? () => setBlockTarget(activeThread)
                  : null
              }
              onDelete={() => setDeleteThreadTarget(activeThread)}
            />
          </div>
        </div>
      ) : null}

      {previewGallery ? (
        // Clicking the scrim closes the viewer; clicking the media itself must not, so the media
        // element stops the click from reaching this handler. No card, no rounded corners, no
        // close button - the raw image or video at its own scale is the whole interface.
        <div
          onClick={() => setPreviewGallery(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,9,8,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: 24,
          }}
        >
          {(() => {
            const { items, index } = previewGallery;
            const current = items[index];
            const hasPrev = index > 0;
            const hasNext = index < items.length - 1;
            const go = (nextIndex: number) =>
              setPreviewGallery((gallery) => (gallery ? { ...gallery, index: nextIndex } : null));

            return (
              <>
                {hasPrev ? (
                  <button
                    type="button"
                    aria-label="previous item"
                    onClick={(event) => {
                      event.stopPropagation();
                      go(index - 1);
                    }}
                    style={lightboxArrowStyle('left')}
                  >
                    <LxIcon name="chevronLeft" size={18} color="#1c1a17" />
                  </button>
                ) : null}
                {current.cdnUrl ? (
                  isVideoMessageMedia(current) ? (
                    <video
                      key={current.mediaAssetId || current.cdnUrl}
                      src={current.cdnUrl}
                      controls
                      autoPlay
                      onClick={(event) => event.stopPropagation()}
                      className="lx-lightbox-media"
                      style={{
                        maxWidth: LIGHTBOX_MAX_WIDTH,
                        maxHeight: LIGHTBOX_MAX_HEIGHT,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <img
                      key={current.mediaAssetId || current.cdnUrl}
                      src={current.cdnUrl}
                      alt=""
                      onClick={(event) => event.stopPropagation()}
                      className="lx-lightbox-media"
                      style={{
                        maxWidth: LIGHTBOX_MAX_WIDTH,
                        maxHeight: LIGHTBOX_MAX_HEIGHT,
                        display: 'block',
                      }}
                    />
                  )
                ) : (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      width: 'min(420px, 100%)',
                      background: v.base,
                      border: `1px solid ${v.border}`,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <MediaPlaceholder item={current} large />
                    <div style={{ fontFamily: v.fontBody, fontSize: 15, color: v.ink }}>
                      {current.title || current.label}
                    </div>
                  </div>
                )}
                {hasNext ? (
                  <button
                    type="button"
                    aria-label="next item"
                    onClick={(event) => {
                      event.stopPropagation();
                      go(index + 1);
                    }}
                    style={lightboxArrowStyle('right')}
                  >
                    <LxIcon name="chevronRight" size={18} color="#1c1a17" />
                  </button>
                ) : null}
                {items.length > 1 ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 24,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(255,255,255,0.9)',
                      borderRadius: 999,
                      padding: '3px 9px',
                      fontFamily: v.fontMono,
                      fontSize: 11,
                      color: '#1c1a17',
                    }}
                  >
                    {index + 1}/{items.length}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {pendingDeleteMessageId ? (
        <>
          <div
            onClick={() => setPendingDeleteMessageId(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: v.scrim,
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 56px)',
              maxWidth: 348,
              background: v.base,
              borderRadius: 18,
              boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
              zIndex: 1001,
              padding: '22px 24px 20px',
            }}
          >
            <div
              style={{
                fontFamily: v.fontDisplay,
                fontSize: 18,
                fontWeight: 700,
                color: v.ink,
                letterSpacing: '-0.03em',
              }}
            >
              delete message?
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: v.fontBody,
                fontSize: 14,
                lineHeight: 1.45,
                color: v.ink3,
              }}
            >
              this can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setPendingDeleteMessageId(null)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 999,
                  border: 'none',
                  background: '#2c2621',
                  color: '#c4b9a8',
                  fontFamily: v.fontBody,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--lx-error)',
                  color: '#fff5f2',
                  fontFamily: v.fontBody,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                delete
              </button>
            </div>
          </div>
        </>
      ) : null}

      {nicknameTarget ? (
        <>
          <div
            onClick={() => setNicknameTarget(null)}
            style={{ position: 'fixed', inset: 0, background: v.scrim, zIndex: 1000 }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 56px)',
              maxWidth: 348,
              background: v.base,
              borderRadius: 18,
              boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
              zIndex: 1001,
              padding: '22px 24px 20px',
            }}
          >
            <div
              style={{
                fontFamily: v.fontDisplay,
                fontSize: 18,
                fontWeight: 700,
                color: v.ink,
                letterSpacing: '-0.03em',
              }}
            >
              nickname for {nicknameTarget.name}
            </div>
            <div style={{ marginTop: 14 }}>
              <input
                autoFocus
                value={nicknameValue}
                onChange={(event) => setNicknameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSaveNickname();
                }}
                placeholder="only you see this"
                maxLength={CHAR_LIMITS.nickname}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 999,
                  background: v.surfaceSunken,
                  border: `1px solid ${v.borderSubtle}`,
                  padding: '0 14px',
                  color: v.ink,
                  fontFamily: v.fontBody,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setNicknameTarget(null)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 999,
                  border: 'none',
                  background: '#2c2621',
                  color: '#c4b9a8',
                  fontFamily: v.fontBody,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNickname}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 999,
                  border: 'none',
                  background: v.accent,
                  color: v.ink,
                  fontFamily: v.fontBody,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                save
              </button>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmModal
        config={
          deleteThreadTarget
            ? {
                title: `delete chat with ${deleteThreadTarget.name}?`,
                message:
                  'this removes it from your inbox only. it comes back if they message you again.',
                onConfirm: handleDeleteThreadConfirm,
              }
            : null
        }
        onClose={() => setDeleteThreadTarget(null)}
      />

      <ConfirmModal
        config={
          deleteRequestTarget
            ? deleteRequestConfirm(deleteRequestTarget.name, handleDeleteRequestConfirm)
            : null
        }
        onClose={() => setDeleteRequestTarget(null)}
      />

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />

      <BlockConfirmDialog
        open={Boolean(blockRequestTarget)}
        handle={blockRequestTarget?.username ?? ''}
        pending={blockRequester.isPending}
        onCancel={() => setBlockRequestTarget(null)}
        onConfirm={handleBlockRequestConfirm}
      />

      <BlockConfirmDialog
        open={Boolean(blockTarget)}
        handle={blockTarget?.username ?? ''}
        pending={block.isPending}
        onCancel={() => setBlockTarget(null)}
        onConfirm={handleBlockConfirm}
      />
    </div>
  );
}
