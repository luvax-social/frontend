import type { Thread } from '../utils/messageViewModel';
import type { Viewport } from '@/features/luvax/LuvaxTweaksContext';
import type { CSSProperties } from 'react';
import type { MessageView, MessageRun, PreviewMedia } from '../types';
import { unwrapApiResponse } from '@/utils/unwrapApiResponse';

interface Props {
  message: MessageView & MessageRun;
  activeThread: Thread;
  onPreviewMedia: (item: PreviewMedia) => void;
  onOpenStory?: (id: string) => void;
  onDeleteToggle: (id: string) => void;
  onReplyMessage: (message: MessageView) => void;
  viewport: Viewport;
  forceShowActions?: boolean;
  /** Whether the thread accepts reactions; false when messaging is paused or unavailable. */
  canReact?: boolean;
  /** Sets the viewer's reaction on a message, or removes it when the emoji is null. */
  onReact?: (messageId: string, emoji: string | null) => void;
}
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { LxIcon } from '@/components/ui/lx-icon';
import { ROUTES, routeTo } from '@/config/constants';
import { copyToClipboard, getDisplayName, getUserSummary } from '@/utils/helpers';
import { usePostDetail } from '@/features/luvax/hooks/usePosts';
import { bubbleCornerRadius } from '../utils/bubbleShape';
import { REACTION_TRIGGER_ATTRIBUTE } from '../utils/reactionOptions';
import { AvatarVisual } from './AvatarVisual';
import { MediaPlaceholder } from './MediaPlaceholder';
import { ReactionPicker } from './ReactionPicker';
import { ReactionChip } from './ReactionChip';
import { ReplyQuote } from './ReplyQuote';

const AVATAR_SIZE = 21;
// Extends the hover/click target a few pixels past the bubble itself in every direction, so the
// actions button appears from a hover anywhere near the message rather than only on the bubble's
// exact pixels. The padding is cancelled by an equal negative margin, so neighbouring rows and the
// list's own gap do not move.
const HIT_PADDING = 7;
const EMOJI_ONLY_PATTERN = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D\s]+$/u;

export function MessageBubble({
  message,
  activeThread,
  onPreviewMedia,
  onOpenStory,
  onDeleteToggle,
  onReplyMessage,
  viewport,
  forceShowActions = false,
  canReact = false,
  onReact,
}: Props) {
  const navigate = useNavigate();
  const isMine = message.from === 'me';
  const isMobile = viewport === 'mobile';
  const isTouchLayout = viewport === 'mobile' || viewport === 'tablet';
  const { data: sharedPostResponse } = usePostDetail(message.sharedPostId);
  const sharedPost = sharedPostResponse ? unwrapApiResponse(sharedPostResponse) : null;
  const sharedPostAuthor = sharedPost ? getUserSummary(sharedPost) : null;
  const sharedPostCaption = sharedPost?.caption || message.title || message.text || 'shared post';
  const sharedPostMedia = Array.isArray(sharedPost?.media) ? sharedPost.media[0] : null;
  const sharedPostHandle = sharedPostAuthor?.username ? `@${sharedPostAuthor.username}` : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touchRevealed, setTouchRevealed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRowRef = useRef<HTMLDivElement | null>(null);
  const textForCopy =
    message.kind === 'reply'
      ? `${message.replyText}\n${message.text}`
      : message.kind === 'post'
        ? [sharedPostHandle, sharedPostCaption, message.meta]
            .filter((item) => item !== null)
            .join('\n')
        : message.kind === 'file'
          ? message.text
          : message.text;
  const canCopyText = Boolean(textForCopy);
  const isEmojiOnly =
    message.kind !== 'reply' &&
    Boolean(message.text?.trim()) &&
    EMOJI_ONLY_PATTERN.test(message.text.trim()) &&
    !/[A-Za-z0-9]/.test(message.text);
  const menuItems = useMemo(
    () =>
      [
        canCopyText
          ? {
              id: 'copy',
              icon: 'link',
              label: 'Copy text',
              onClick: () => copyToClipboard(textForCopy),
            }
          : null,
        isMine && message.kind !== 'deleted'
          ? {
              id: 'delete',
              icon: 'trash',
              label: 'Delete',
              tone: 'danger',
              onClick: () => onDeleteToggle(message.id),
            }
          : null,
      ].filter((item) => item !== null),
    [canCopyText, isMine, message, onDeleteToggle, textForCopy]
  );
  const supportsHover =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const showActions =
    forceShowActions ||
    menuOpen ||
    pickerOpen ||
    (!isTouchLayout && hovered) ||
    (isTouchLayout && touchRevealed);
  const openSharedPost = () => {
    if (message.sharedPostId) {
      navigate(routeTo.postDetail(message.sharedPostId), {
        state: { background: ROUTES.MESSAGES },
      });
      return;
    }
    onPreviewMedia({ label: sharedPostCaption });
  };

  const handleHoverStart = () => {
    setHovered(true);
  };

  const handleHoverEnd = () => {
    setHovered(false);
    if (!menuOpen) {
      setTouchRevealed(false);
    }
  };

  useEffect(() => {
    if (supportsHover || (!touchRevealed && !menuOpen)) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const bubbleRow = bubbleRowRef.current;
      const menuButton = menuButtonRef.current;
      if (
        bubbleRow?.contains(event.target instanceof Node ? event.target : null) ||
        menuButton?.contains(event.target instanceof Node ? event.target : null)
      ) {
        return;
      }
      setTouchRevealed(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen, supportsHover, touchRevealed]);

  const handleBubbleInteraction = () => {
    if (isTouchLayout || !supportsHover) {
      setTouchRevealed(true);
    }
  };

  const handleTouchMenuToggle = () => {
    if (!isTouchLayout) {
      return;
    }
    setTouchRevealed(false);
    setMenuOpen((open) => !open);
  };

  const bubbleBase: CSSProperties = {
    maxWidth:
      message.kind === 'post' || message.kind === 'file'
        ? isMobile
          ? 196
          : 248
        : isMine
          ? isMobile
            ? 'min(100%, 264px)'
            : 440
          : isMobile
            ? 'min(100%, 224px)'
            : 300,
    // Deleted (tombstone) bubbles stay uniformly rounded - they are never part of a same-sender
    // run's visual continuity, just a standalone notice - everything else follows the bubble's
    // position within its run.
    borderRadius:
      message.kind === 'deleted'
        ? 15
        : bubbleCornerRadius({
            isMine,
            isFirstInRun: message.isFirstInRun,
            isLastInRun: message.isLastInRun,
          }),
    padding: message.kind === 'deleted' ? '9px 13px' : '9px 13px',
    fontFamily: v.fontBody,
    fontSize: 13.5,
    lineHeight: 1.42,
    position: 'relative',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };

  // The other party's avatar sits at the bottom of their last bubble in a run, echoing how most
  // chat UIs collapse a burst of consecutive messages down to one identity marker. The viewer's
  // own messages never carry one - the reader already knows who those are. Mobile drops the column
  // entirely per the design brief, rather than just hiding the image inside it.
  const avatarSlot =
    isMobile || isMine ? null : message.showAvatar ? (
      <AvatarVisual
        thread={{ avatarUrl: message.senderAvatarUrl, name: message.senderName }}
        size={AVATAR_SIZE}
      />
    ) : (
      <div style={{ width: AVATAR_SIZE, flexShrink: 0 }} aria-hidden="true" />
    );

  const menuButtonStyle = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    opacity: 0.82,
    padding: 0,
    flexShrink: 0,
  };

  const replyButtonStyle = {
    ...menuButtonStyle,
    background: 'rgba(255,255,255,0.06)',
  };

  // A tombstoned message carries neither a chip nor a picker: its reactions are hidden with it.
  const reactable = canReact && Boolean(onReact) && message.kind !== 'deleted';

  const reactionButton =
    showActions && reactable ? (
      <button
        type="button"
        {...{ [REACTION_TRIGGER_ATTRIBUTE]: '' }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setPickerOpen((open) => !open);
        }}
        aria-label="react to message"
        aria-expanded={pickerOpen}
        style={replyButtonStyle}
      >
        <LxIcon name="smile" size={12} color={isMine ? v.ink2 : v.ink3} />
      </button>
    ) : null;

  const reactionChips =
    message.kind !== 'deleted' && message.reactions.length > 0 ? (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: -8,
          padding: '0 8px',
          position: 'relative',
          zIndex: 1,
          alignSelf: isMine ? 'flex-end' : 'flex-start',
        }}
      >
        {message.reactions.map((reaction) => (
          <ReactionChip
            key={reaction.emoji}
            reaction={reaction}
            onRemoveMine={() => onReact?.(message.id, null)}
          />
        ))}
      </div>
    ) : null;

  const reactionPicker =
    pickerOpen && reactable ? (
      <div
        style={{
          position: 'absolute',
          bottom: '100%',
          marginBottom: 6,
          [isMine ? 'right' : 'left']: 0,
          zIndex: 6,
        }}
      >
        <ReactionPicker
          current={message.myReaction}
          onPick={(emoji) => {
            onReact?.(message.id, emoji);
            setPickerOpen(false);
          }}
          onRemove={() => {
            onReact?.(message.id, null);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      </div>
    ) : null;

  // The padding/negative-margin pair widens the hover and tap target past the bubble's own edges
  // without shifting this row's siblings apart - hovering "near" a message reveals its actions, not
  // only a precise hover on the bubble pixels themselves.
  const hitAreaStyle = {
    padding: HIT_PADDING,
    margin: -HIT_PADDING,
  };

  if (message.kind === 'deleted') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          flexDirection: isMine ? 'row-reverse' : 'row',
        }}
      >
        {avatarSlot}
        <div
          style={{
            ...bubbleBase,
            background: 'transparent',
            color: v.ink3,
            border: `1px dashed ${v.borderStrong}`,
            fontStyle: 'italic',
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  if (message.kind === 'file' || message.kind === 'post' || message.kind === 'story') {
    const isFile = message.kind === 'file';
    const isStory = message.kind === 'story';
    const storyMedia = message.sharedStoryMedia || { label: message.meta || 'shared story' };
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          flexDirection: isMine ? 'row-reverse' : 'row',
          ...hitAreaStyle,
        }}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        onPointerEnter={handleHoverStart}
        onPointerLeave={handleHoverEnd}
      >
        {avatarSlot}
        <div
          ref={bubbleRowRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexDirection: isMine ? 'row-reverse' : 'row',
          }}
          onPointerDown={handleBubbleInteraction}
          onClick={handleTouchMenuToggle}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {isStory ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  gap: 8,
                  maxWidth: isMobile ? 300 : 460,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: v.ink3,
                    fontFamily: v.fontBody,
                    fontSize: 13,
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <LxIcon name="reply" size={12} color={v.ink3} />
                  <span>
                    {isMine
                      ? `you replied to ${activeThread.name}'s story`
                      : `${message.senderName} replied to your story`}
                  </span>
                </div>
                <div
                  style={{
                    width: isMobile ? 116 : 180,
                    height: isMobile ? 154 : 240,
                    borderRadius: 14,
                    overflow: 'hidden',
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                    background: v.surface,
                  }}
                >
                  <MediaPlaceholder
                    item={storyMedia}
                    onClick={() =>
                      message.sharedStoryId
                        ? onOpenStory?.(message.sharedStoryId)
                        : onPreviewMedia(storyMedia)
                    }
                  />
                </div>
                {message.text ? (
                  <div
                    style={{
                      maxWidth: '100%',
                      padding: '8px 12px',
                      borderRadius: 16,
                      background: isMine ? activeThread.accent || v.accentDim : v.surface,
                      color: v.ink,
                      fontFamily: v.fontBody,
                      fontSize: 14.5,
                      lineHeight: 1.42,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {message.text}
                  </div>
                ) : null}
              </div>
            ) : isFile ? (
              // A real photo or video is the bubble - no surrounding card, border, or padding
              // framing it. Chrome around a thumbnail read as over-designed next to a plain photo.
              <div
                style={{
                  maxWidth: isMobile ? 196 : 248,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  gap: message.text ? 2 : 0,
                }}
              >
                <MediaPlaceholder
                  item={
                    message.media
                      ? { ...message.media, label: message.text }
                      : { label: message.text }
                  }
                  large
                  onClick={() => onPreviewMedia(message.media || { label: message.text })}
                />
                {message.text ? (
                  <div
                    style={{
                      maxWidth: '100%',
                      padding: '8px 11px',
                      borderRadius: bubbleCornerRadius({
                        isMine,
                        isFirstInRun: false,
                        isLastInRun: message.isLastInRun,
                      }),
                      background: isMine ? activeThread.accent || v.accentDim : v.surface,
                      color: v.ink,
                      fontFamily: v.fontBody,
                      fontSize: 13.5,
                      lineHeight: 1.42,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {message.text}
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                style={{
                  ...bubbleBase,
                  background: isMine ? activeThread.accent || v.accentDim : v.surface,
                  border: isMine ? 'none' : `1px solid ${v.border}`,
                  padding: 9,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <MediaPlaceholder
                    item={sharedPostMedia || { label: message.meta || 'shared post' }}
                    onClick={openSharedPost}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontFamily: v.fontMono, fontSize: 10, color: v.accent }}>
                      {sharedPostHandle || message.meta || 'shared post'}
                    </div>
                    <div
                      style={{
                        color: v.ink,
                        fontSize: 12.5,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {sharedPostCaption}
                    </div>
                    {sharedPostAuthor ? (
                      <div
                        style={{
                          fontFamily: v.fontBody,
                          fontSize: 11,
                          color: v.ink3,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        by {getDisplayName(sharedPostAuthor)}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: 'flex',
                        gap: 7,
                        fontFamily: v.fontMono,
                        fontSize: 10,
                        color: v.ink3,
                      }}
                    >
                      <span>{message.meta}</span>
                      <button
                        type="button"
                        onClick={openSharedPost}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: v.ink3,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        view
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {reactionChips}
            {reactionPicker}
          </div>
          {reactionButton}
          {showActions ? (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onReplyMessage?.(message);
              }}
              aria-label="reply to message"
              style={replyButtonStyle}
            >
              <LxIcon name="reply" size={12} color={v.ink3} />
            </button>
          ) : null}
          {showActions && menuItems.length > 0 ? (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="message actions"
              style={menuButtonStyle}
            >
              <LxIcon name="more" size={10} color={v.ink3} />
            </button>
          ) : null}
        </div>
        <LxDropdownMenu
          anchorRef={menuButtonRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          items={menuItems}
          width={172}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onPointerEnter={handleHoverStart}
      onPointerLeave={handleHoverEnd}
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        flexDirection: isMine ? 'row-reverse' : 'row',
        ...hitAreaStyle,
      }}
    >
      {avatarSlot}
      <div
        ref={bubbleRowRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexDirection: isMine ? 'row-reverse' : 'row',
          minWidth: 0,
        }}
        onPointerDown={handleBubbleInteraction}
        onClick={handleTouchMenuToggle}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <div
            style={{
              ...bubbleBase,
              background: isEmojiOnly
                ? 'transparent'
                : isMine
                  ? activeThread.accent || v.accentDim
                  : v.surface,
              color: v.ink,
              border: isEmojiOnly || isMine ? 'none' : `1px solid ${v.border}`,
              minWidth: isEmojiOnly || isMobile ? 0 : 76,
              width: isMobile ? '100%' : 'auto',
              overflow: 'hidden',
              padding: isEmojiOnly ? '0 2px' : bubbleBase.padding,
              fontFamily: isEmojiOnly
                ? '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", sans-serif'
                : v.fontBody,
              fontSize: isEmojiOnly ? 34 : bubbleBase.fontSize,
              lineHeight: isEmojiOnly ? 1.15 : bubbleBase.lineHeight,
            }}
          >
            {message.kind === 'reply' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <ReplyQuote
                  name={message.replyTo}
                  text={message.replyText}
                  unavailable={message.replyUnavailable}
                />
                <strong
                  style={{
                    fontWeight: 600,
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.text}
                </strong>
              </div>
            ) : (
              message.text
            )}
          </div>
          {reactionChips}
          {reactionPicker}
        </div>
        {showActions ? (
          <>
            {reactionButton}
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onReplyMessage?.(message);
              }}
              aria-label="reply to message"
              style={replyButtonStyle}
            >
              <LxIcon name="reply" size={12} color={isMine ? v.ink2 : v.ink3} />
            </button>
            {menuItems.length > 0 ? (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="message actions"
                style={menuButtonStyle}
              >
                <LxIcon name="more" size={10} color={isMine ? v.ink2 : v.ink3} />
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <LxDropdownMenu
        anchorRef={menuButtonRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        width={172}
      />
    </div>
  );
}
