import { useEffect, useMemo, useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { CHAR_LIMITS } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';
import { AvatarVisual } from './AvatarVisual';
import { ConversationGreeting } from './ConversationGreeting';
import { MessageAlbum } from './MessageAlbum';
import { MessageBubble } from './MessageBubble';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';

// Matches MessageBubble's own avatar column - albums sit in the same left/right rail and need to
// line up with the bubbles above and below them in the same run.
const ALBUM_AVATAR_SIZE = 21;

const DRAFT_MAX_HEIGHT = 108;

const autoResizeDraft = (element) => {
  if (!element) return;
  element.style.height = '0px';
  element.style.height = `${Math.min(element.scrollHeight, DRAFT_MAX_HEIGHT)}px`;
};

const ACCEPTED_ATTACHMENT_TYPES = 'image/*,video/*';
const CLIPBOARD_IMAGE_FALLBACK_NAME = 'pasted-image.png';
const MESSAGE_ICON_GROUPS = [
  {
    label: 'recently used',
    categoryIcon: '🕘',
    icons: [
      ['😀', 'grinning happy smile face'],
      ['😂', 'laugh tears joy'],
      ['😍', 'love heart eyes'],
      ['😭', 'cry sad tears'],
      ['😘', 'kiss love'],
      ['🥰', 'smiling hearts love'],
      ['😎', 'cool sunglasses'],
      ['🤔', 'thinking'],
      ['👍', 'thumbs up like'],
      ['❤️', 'heart love'],
    ],
  },
  {
    label: 'smileys & people',
    categoryIcon: '😀',
    icons: [
      ['😃', 'smile happy'],
      ['😄', 'laugh happy'],
      ['😁', 'grin'],
      ['😆', 'laugh squint'],
      ['😅', 'sweat smile'],
      ['🤣', 'rolling laugh'],
      ['😊', 'blush happy'],
      ['😇', 'halo angel'],
      ['🙂', 'slight smile'],
      ['🙃', 'upside down'],
      ['😉', 'wink'],
      ['😌', 'relieved calm'],
      ['🥺', 'pleading'],
      ['😮', 'surprised wow'],
      ['😴', 'sleep tired'],
      ['🤯', 'mind blown'],
      ['😬', 'grimace'],
      ['😡', 'angry'],
      ['👋', 'wave hello'],
      ['🙌', 'hands celebrate'],
    ],
  },
  {
    label: 'animals & nature',
    categoryIcon: '🌿',
    icons: [
      ['🐶', 'dog'],
      ['🐱', 'cat'],
      ['🐭', 'mouse'],
      ['🐰', 'rabbit'],
      ['🦊', 'fox'],
      ['🐻', 'bear'],
      ['🐼', 'panda'],
      ['🐨', 'koala'],
      ['🌸', 'flower'],
      ['🌹', 'rose'],
      ['🌻', 'sunflower'],
      ['🌿', 'leaf nature'],
      ['✨', 'sparkles'],
      ['🔥', 'fire'],
      ['🌙', 'moon'],
      ['⭐', 'star'],
    ],
  },
  {
    label: 'food & drink',
    categoryIcon: '🍴',
    icons: [
      ['🍕', 'pizza'],
      ['🍔', 'burger'],
      ['🍟', 'fries'],
      ['🍜', 'noodles'],
      ['🍣', 'sushi'],
      ['🍰', 'cake'],
      ['🍪', 'cookie'],
      ['☕', 'coffee'],
      ['🧋', 'milk tea boba'],
      ['🍻', 'beer cheers'],
    ],
  },
  {
    label: 'activities',
    categoryIcon: '⚽',
    icons: [
      ['⚽', 'football soccer'],
      ['🏀', 'basketball'],
      ['🎮', 'game'],
      ['🎧', 'music headphones'],
      ['🎬', 'movie'],
      ['🎨', 'art'],
      ['✈️', 'travel plane'],
      ['🚗', 'car'],
      ['💡', 'idea'],
      ['📌', 'pin'],
    ],
  },
  {
    label: 'symbols',
    categoryIcon: '💯',
    icons: [
      ['💯', 'hundred perfect'],
      ['✅', 'check done'],
      ['❌', 'x no'],
      ['❗', 'important'],
      ['❓', 'question'],
      ['💬', 'chat message'],
      ['📎', 'attach'],
      ['🔒', 'lock'],
      ['🎉', 'party'],
      ['🫶', 'heart hands love'],
    ],
  },
];
const MESSAGE_EMOJI_FONT = '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", sans-serif';
const DEFAULT_RECENT_MESSAGE_ICONS = ['😀', '😂', '😍', '😭', '😘'];

function MessageActionRow({ children, isMine, minHeight = 'auto', alignItems = 'stretch' }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        width: '100%',
        minHeight,
        alignItems,
      }}
    >
      {children(hovered)}
    </div>
  );
}

export function ChatCenterPanel({
  viewport,
  activeThread,
  setActiveThreadId,
  closeThread,
  openInfo,
  isDesktop,
  isTablet,
  scrollerRef,
  openPreview,
  openStory,
  handleDeleteToggle,
  replyingTo,
  setReplyingTo,
  draft,
  setDraft,
  handleSend,
  pendingAttachments,
  onStageAttachments,
  onRemovePendingAttachment,
  isSending,
  isBlocked = false,
  blockedHint,
}) {
  const draftInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const emojiGroupRefs = useRef({});
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [recentIcons, setRecentIcons] = useState(DEFAULT_RECENT_MESSAGE_ICONS);

  const handleAttachmentChange = (event) => {
    if (isBlocked) {
      event.target.value = '';
      return;
    }

    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onStageAttachments?.(files);
  };

  const handleDraftPaste = (event) => {
    if (isBlocked) {
      event.preventDefault();
      return;
    }

    const imageFiles = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)
      .map(
        (file, index) =>
          new File([file], file.name || `${Date.now()}-${index}-${CLIPBOARD_IMAGE_FALLBACK_NAME}`, {
            type: file.type || 'image/png',
            lastModified: file.lastModified || Date.now(),
          })
      );

    if (!imageFiles.length) return;
    event.preventDefault();
    onStageAttachments?.(imageFiles);
  };

  const hasDraftContent = Boolean(draft.trim() || pendingAttachments?.length);
  const canSend = hasDraftContent && !isSending && !isBlocked;
  const normalizedEmojiSearch = emojiSearch.trim().toLowerCase();
  const visibleEmojiGroups = useMemo(() => {
    const recents = {
      ...MESSAGE_ICON_GROUPS[0],
      icons: recentIcons.map((icon) => [icon, 'recently used']),
    };
    const groups = [recents, ...MESSAGE_ICON_GROUPS.slice(1)];
    if (!normalizedEmojiSearch) return groups;
    return groups
      .map((group) => ({
        ...group,
        icons: group.icons.filter(
          ([icon, keywords]) =>
            icon.includes(normalizedEmojiSearch) || keywords.includes(normalizedEmojiSearch)
        ),
      }))
      .filter((group) => group.icons.length > 0);
  }, [normalizedEmojiSearch, recentIcons]);

  const appendMessageIcon = (icon) => {
    const nextDraft = `${draft}${icon}`;
    setDraft(nextDraft.slice(0, CHAR_LIMITS.message));
    setRecentIcons((current) => [icon, ...current.filter((item) => item !== icon)].slice(0, 10));
  };

  useEffect(() => {
    autoResizeDraft(draftInputRef.current);
  }, [draft, replyingTo]);

  // Hooks above this line. Both previously sat below it, so opening or closing a thread changed the
  // hook count between renders, which React resolves by binding state to the wrong slot.
  if (!activeThread) return null;

  const blockedHandle = activeThread.username ? `@${activeThread.username}` : activeThread.name;
  const blockedMessage =
    blockedHint || `you blocked ${blockedHandle}. messaging is paused until you unblock them.`;

  const mobileHeaderIconButton = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: `1px solid ${v.borderSubtle}`,
    background: v.surface,
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'none',
  };

  return (
    <section
      style={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '52px minmax(0, 1fr) auto',
        minWidth: 0,
        borderLeft: isDesktop || isTablet ? `1px solid ${v.borderSubtle}` : 'none',
        background: v.base,
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${v.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'space-between',
          padding: viewport === 'mobile' ? '0 20px' : '0 18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: viewport === 'mobile' ? 10 : 12,
            minWidth: 0,
          }}
        >
          {viewport !== 'desktop' && viewport !== 'tablet' ? (
            <button type="button" onClick={() => closeThread()} style={mobileHeaderIconButton}>
              <LxIcon name="chevronLeft" size={15} color={v.ink2} />
            </button>
          ) : null}
          <AvatarVisual thread={activeThread} size={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <LxVerifiedName
              name={activeThread.name}
              verified={activeThread.isVerified}
              category={activeThread.verifiedCategory}
              size={13}
              textStyle={{ fontFamily: v.fontBody, fontSize: 13, fontWeight: 700, color: v.ink }}
            />
            <div style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3 }}>
              {activeThread.nickname && activeThread.profileName
                ? activeThread.profileName
                : `@${activeThread.username}`}
            </div>
            {activeThread.nickname && activeThread.username ? (
              <div style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3 }}>
                @{activeThread.username}
              </div>
            ) : null}
          </div>
        </div>
        {/* The info panel is hidden by default on every viewport and opens from here, as an
            overlay drawer, rather than sitting permanently in its own column. */}
        <button
          type="button"
          onClick={() => openInfo?.()}
          aria-label="open chat info"
          style={mobileHeaderIconButton}
        >
          <LxIcon name="alert" size={viewport === 'mobile' ? 17 : 15} color={v.ink2} />
        </button>
      </div>

      <div
        ref={scrollerRef}
        style={{
          overflowY: 'auto',
          padding: viewport === 'mobile' ? '14px 20px' : '16px 18px 10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minHeight: '100%',
            justifyContent: activeThread.messages.length <= 1 ? 'space-between' : 'flex-start',
          }}
        >
          <ConversationGreeting
            messageCount={activeThread.messages.length}
            pending={!activeThread.id}
            name={activeThread.name}
            username={activeThread.username}
            avatarUrl={activeThread.avatarUrl}
            userId={activeThread.counterpartId}
          />
          {activeThread.rows.map((row) => {
            if (row.rowType === 'separator') {
              return (
                <div
                  key={row.id}
                  role="separator"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '4px 0',
                  }}
                >
                  <span
                    style={{
                      fontFamily: v.fontMono,
                      fontSize: 10,
                      color: v.ink3,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {row.label}
                  </span>
                </div>
              );
            }

            if (row.rowType === 'album') {
              const isMine = row.from === 'me';
              const isMobile = viewport === 'mobile';
              const avatarSlot =
                isMobile || isMine ? null : row.showAvatar ? (
                  <AvatarVisual
                    thread={{ avatarUrl: row.senderAvatarUrl, name: row.senderName }}
                    size={ALBUM_AVATAR_SIZE}
                  />
                ) : (
                  <div style={{ width: ALBUM_AVATAR_SIZE, flexShrink: 0 }} aria-hidden="true" />
                );
              return (
                <MessageActionRow key={row.id} isMine={isMine} alignItems="flex-end">
                  {(rowHovered) => (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 6,
                      }}
                    >
                      {avatarSlot}
                      <MessageAlbum
                        items={row.items}
                        isMine={isMine}
                        isFirstInRun={row.isFirstInRun}
                        isLastInRun={row.isLastInRun}
                        onOpenViewer={(items, itemIndex) =>
                          openPreview?.(
                            items.map((item) => item.media || { label: item.text }),
                            itemIndex
                          )
                        }
                        onDeleteItem={handleDeleteToggle}
                        onReplyItem={setReplyingTo}
                        forceShowActions={rowHovered}
                      />
                    </div>
                  )}
                </MessageActionRow>
              );
            }

            return (
              <MessageActionRow
                key={row.id}
                isMine={row.from === 'me'}
                minHeight="auto"
                alignItems="stretch"
              >
                {(rowHovered) => (
                  <MessageBubble
                    message={row}
                    viewport={viewport}
                    activeThread={activeThread}
                    onPreviewMedia={(media) => openPreview?.([media], 0)}
                    onOpenStory={openStory}
                    onDeleteToggle={handleDeleteToggle}
                    onReplyMessage={setReplyingTo}
                    forceShowActions={rowHovered}
                  />
                )}
              </MessageActionRow>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${v.border}`,
          padding: '10px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
          position: 'relative',
        }}
      >
        {isBlocked ? (
          <div
            style={{
              borderTop: `1px solid ${v.borderSubtle}`,
              borderBottom: `1px solid ${v.borderSubtle}`,
              background: v.surface,
              color: v.ink2,
              fontFamily: v.fontBody,
              fontSize: 12.5,
              lineHeight: 1.35,
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <LxIcon name="ban" size={14} color={v.error} />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{blockedMessage}</span>
          </div>
        ) : null}

        {replyingTo ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '0 2px',
              fontFamily: v.fontMono,
              fontSize: 10.5,
              color: v.accentText,
              minWidth: 0,
            }}
          >
            <div
              style={{
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              <span style={{ flexShrink: 0 }}>
                ↩ replying to {replyingTo.from === 'me' ? 'you' : activeThread.name}
              </span>
              <span
                style={{
                  color: v.ink2,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {replyingTo.text}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.14)',
                border: 'none',
                color: v.ink3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 10,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ) : null}

        {pendingAttachments?.length ? (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 2px' }}>
            {pendingAttachments.map((item) => (
              <div key={item.id} style={{ position: 'relative', flexShrink: 0 }}>
                {item.isVideo ? (
                  <video
                    src={item.previewUrl}
                    muted
                    style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <img
                    src={item.previewUrl}
                    alt=""
                    style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onRemovePendingAttachment?.(item.id)}
                  aria-label="remove attachment"
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `1px solid ${v.border}`,
                    background: v.base,
                    color: v.ink2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px minmax(0, 1fr) 32px',
            alignItems: 'end',
            gap: 6,
            minWidth: 0,
            minHeight: 42,
            borderRadius: 22,
            border: `1px solid ${v.borderSubtle}`,
            background: v.surfaceSunken,
            padding: '4px 7px',
            boxSizing: 'border-box',
          }}
        >
          <input
            ref={attachmentInputRef}
            type="file"
            accept={ACCEPTED_ATTACHMENT_TYPES}
            multiple
            onChange={handleAttachmentChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => setIconPickerOpen((open) => !open)}
            disabled={isSending || isBlocked}
            aria-label="choose message icon"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSending ? 'wait' : isBlocked ? 'default' : 'pointer',
              opacity: isSending || isBlocked ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            <LxIcon name="smile" size={15} color={v.ink3} />
          </button>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 32,
              borderRadius: 0,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              padding: '7px 4px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <textarea
              ref={draftInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPaste={handleDraftPaste}
              maxLength={CHAR_LIMITS.message}
              disabled={isBlocked}
              onKeyDown={(event) => {
                if (isBlocked) return;
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isBlocked ? 'blocked' : replyingTo ? 'write a reply...' : 'Message...'}
              rows={1}
              style={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                minHeight: 16,
                maxHeight: DRAFT_MAX_HEIGHT,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: isBlocked ? v.ink3 : v.ink,
                fontFamily: v.fontBody,
                fontSize: 13.5,
                lineHeight: 1.4,
                resize: 'none',
                overflowY: 'auto',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                padding: 0,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => (hasDraftContent ? handleSend() : attachmentInputRef.current?.click())}
            disabled={hasDraftContent ? !canSend : isSending || isBlocked}
            aria-label={hasDraftContent ? 'send message' : 'attach a photo, video, or gif'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: hasDraftContent ? v.accent : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: hasDraftContent ? (canSend ? 'pointer' : 'default') : 'pointer',
              opacity: hasDraftContent ? (canSend ? 1 : 0.5) : isSending || isBlocked ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            <LxIcon
              name={hasDraftContent ? 'send' : 'image'}
              size={14}
              color={hasDraftContent ? v.ink : v.ink3}
            />
          </button>
        </div>
        {iconPickerOpen && !isBlocked ? (
          <div
            style={{
              position: 'absolute',
              left: 58,
              bottom: 'calc(100% + 8px)',
              width: 'min(340px, calc(100% - 80px))',
              border: `1px solid ${v.borderSubtle}`,
              borderRadius: 8,
              background: v.surface,
              boxShadow: `0 18px 46px ${v.shadow25}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
              zIndex: 20,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 154,
                bottom: -7,
                width: 14,
                height: 14,
                background: v.surface,
                borderRight: `1px solid ${v.borderSubtle}`,
                borderBottom: `1px solid ${v.borderSubtle}`,
                transform: 'rotate(45deg)',
              }}
            />
            <div style={{ padding: 10, borderBottom: `1px solid ${v.borderSubtle}` }}>
              <div
                style={{
                  height: 34,
                  borderRadius: 8,
                  background: v.surfaceSunken,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 10px',
                }}
              >
                <LxIcon name="explore" size={14} color={v.ink3} />
                <input
                  type="search"
                  value={emojiSearch}
                  onChange={(event) => setEmojiSearch(event.target.value)}
                  placeholder="search emoji"
                  aria-label="search emoji"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: v.ink,
                    fontFamily: v.fontBody,
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
            <div
              style={{
                maxHeight: 242,
                overflowY: 'auto',
                padding: '10px 12px 12px',
              }}
            >
              {visibleEmojiGroups.length ? (
                visibleEmojiGroups.map((group) => (
                  <section
                    key={group.label}
                    ref={(node) => {
                      emojiGroupRefs.current[group.label] = node;
                    }}
                    style={{ marginBottom: 14 }}
                  >
                    <div
                      style={{
                        fontFamily: v.fontBody,
                        fontSize: 12,
                        fontWeight: 700,
                        color: v.ink3,
                        marginBottom: 8,
                      }}
                    >
                      {group.label}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, 1fr)',
                        gap: 3,
                      }}
                    >
                      {group.icons.map(([icon]) => (
                        <button
                          key={`${group.label}-${icon}`}
                          type="button"
                          onClick={() => appendMessageIcon(icon)}
                          aria-label={`insert ${icon}`}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: MESSAGE_EMOJI_FONT,
                            fontSize: 24,
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div
                  style={{
                    padding: '22px 8px',
                    textAlign: 'center',
                    fontFamily: v.fontBody,
                    fontSize: 13,
                    color: v.ink3,
                  }}
                >
                  no emoji found
                </div>
              )}
            </div>
            <div
              style={{
                borderTop: `1px solid ${v.borderSubtle}`,
                display: 'grid',
                gridTemplateColumns: `repeat(${MESSAGE_ICON_GROUPS.length}, 1fr)`,
                background: v.surface,
              }}
            >
              {MESSAGE_ICON_GROUPS.map((group) => (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => {
                    setEmojiSearch('');
                    window.requestAnimationFrame(() => {
                      emojiGroupRefs.current[group.label]?.scrollIntoView({
                        block: 'nearest',
                      });
                    });
                  }}
                  aria-label={group.label}
                  style={{
                    height: 38,
                    border: 'none',
                    borderRight: `1px solid ${v.borderSubtle}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: MESSAGE_EMOJI_FONT,
                    fontSize: 17,
                    padding: 0,
                  }}
                >
                  {group.categoryIcon}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
