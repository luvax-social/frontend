import { useMemo, useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { AvatarVisual } from './AvatarVisual';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';

/**
 * One row in the conversation list.
 *
 * The row itself is a plain `div`, not a `button`: it needs to contain the options trigger as its
 * own interactive child, and a button cannot nest another button. `onSelect` fires from a click
 * anywhere on the row except that child, which stops the click reaching here.
 */
export function ConvRow({
  thread,
  isActive,
  onSelect,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onReport,
  onBlock,
  onPin,
  onUnpin,
  onMute,
  onUnmute,
  onRename,
  viewport,
  revealedOptions = false,
  onRevealOptions,
  onHideOptions,
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const menuButtonRef = useRef(null);
  const dragStartRef = useRef(null);
  const swipedRef = useRef(false);
  const thresholdNotifiedRef = useRef(false);
  const isMobile = viewport === 'mobile';
  const showOptions = (isMobile && revealedOptions) || hovered || menuOpen;
  const openingProgress =
    isMobile && dragX < 0 ? Math.min(Math.max(Math.abs(dragX) / 74, 0), 1) : 0;
  const closingProgress =
    isMobile && revealedOptions && dragX > 0 ? Math.min(Math.max(dragX / 62, 0), 1) : 0;
  const revealProgress = showOptions ? 1 - closingProgress : openingProgress;
  const mobileActionsVisible = isMobile && (revealedOptions || openingProgress > 0.05);
  const desktopOptionsVisible = !isMobile && showOptions;
  const contentOffset = isMobile
    ? Math.round(dragX || (revealedOptions ? -10 * revealProgress : -revealProgress * 10))
    : 0;
  const rowLift = isMobile && revealProgress > 0 ? 1 : 0;

  // Combines the counted unread total with the caller's independent manual flag: clearing the
  // read marker alone has no effect when the viewer sent the conversation's own newest messages,
  // so the toggle (and the badge below) must reflect both, not the count on its own.
  const isUnread = thread.unread > 0 || thread.manuallyUnread;

  const menuItems = useMemo(
    () =>
      [
        isUnread
          ? { id: 'read', icon: 'check', label: 'Mark as read', onClick: () => onMarkRead?.() }
          : {
              id: 'unread',
              icon: 'chat',
              label: 'Mark as unread',
              onClick: () => onMarkUnread?.(),
            },
        thread.pinned
          ? { id: 'unpin', icon: 'pin', label: 'Unpin chat', onClick: () => onUnpin?.() }
          : { id: 'pin', icon: 'pin', label: 'Pin chat', onClick: () => onPin?.() },
        thread.muted
          ? { id: 'unmute', icon: 'bell', label: 'Unmute', onClick: () => onUnmute?.() }
          : { id: 'mute', icon: 'bellOff', label: 'Mute', onClick: () => onMute?.() },
        onRename
          ? { id: 'rename', icon: 'edit', label: 'Set nickname', onClick: () => onRename?.() }
          : null,
        {
          id: 'delete',
          icon: 'trash',
          label: 'Delete chat',
          tone: 'danger',
          separator: true,
          onClick: () => onDelete?.(),
        },
        onReport
          ? {
              id: 'report',
              icon: 'flag',
              label: 'Report',
              tone: 'danger',
              onClick: () => onReport?.(),
            }
          : null,
        onBlock
          ? { id: 'block', icon: 'ban', label: 'Block', tone: 'danger', onClick: () => onBlock?.() }
          : null,
      ].filter(Boolean),
    [
      isUnread,
      thread.pinned,
      thread.muted,
      onMarkRead,
      onMarkUnread,
      onPin,
      onUnpin,
      onMute,
      onUnmute,
      onRename,
      onDelete,
      onReport,
      onBlock,
    ]
  );
  const mobileQuickActions = useMemo(
    () =>
      [
        onBlock
          ? { id: 'block', icon: 'ban', label: 'block', tone: 'danger', onClick: () => onBlock?.() }
          : null,
        onReport
          ? {
              id: 'report',
              icon: 'flag',
              label: 'report',
              tone: 'danger',
              onClick: () => onReport?.(),
            }
          : null,
      ].filter(Boolean),
    [onBlock, onReport]
  );
  const dropdownItems =
    isMobile && revealedOptions
      ? menuItems.filter((item) => item.id !== 'block' && item.id !== 'report')
      : menuItems;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (swipedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          swipedRef.current = false;
          return;
        }
        onSelect?.();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(event) => {
        if (isMobile) {
          dragStartRef.current = { x: event.clientX, y: event.clientY };
          swipedRef.current = false;
          thresholdNotifiedRef.current = false;
        }
      }}
      onPointerMove={(event) => {
        if (!isMobile || !dragStartRef.current) return;
        const dx = event.clientX - dragStartRef.current.x;
        const dy = Math.abs(event.clientY - dragStartRef.current.y);
        if (dy > 24) {
          setDragX(0);
          dragStartRef.current = null;
          return;
        }
        if (revealedOptions && dx > 4) {
          setDragX(Math.min(dx, 70));
        } else if (dx < -4) {
          setDragX(Math.max(dx, -82));
        }
        if (revealedOptions && dx > 28 && dy < 22) {
          swipedRef.current = true;
          if (!thresholdNotifiedRef.current) {
            thresholdNotifiedRef.current = true;
            navigator.vibrate?.(6);
          }
          onHideOptions?.();
        }
        if (dx < -24 && dy < 22) {
          swipedRef.current = true;
          if (!thresholdNotifiedRef.current) {
            thresholdNotifiedRef.current = true;
            navigator.vibrate?.(8);
          }
          onRevealOptions?.();
        }
      }}
      onPointerUp={() => {
        if (isMobile) {
          if (revealedOptions && dragX > 28) {
            swipedRef.current = true;
            onHideOptions?.();
          } else if (dragX < -24) {
            swipedRef.current = true;
            onRevealOptions?.();
          }
        }
        setDragX(0);
        dragStartRef.current = null;
      }}
      onPointerCancel={() => {
        setDragX(0);
        dragStartRef.current = null;
      }}
      style={{
        width: '100%',
        background: isActive ? v.accentDim : 'transparent',
        borderLeft: isActive ? `3px solid ${v.accent}` : '3px solid transparent',
        borderBottom: `1px solid ${v.borderSubtle}`,
        padding: '9px 14px 9px 14px',
        cursor: 'pointer',
        touchAction: 'pan-y',
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr) auto',
        gap: 10,
        alignItems: 'center',
        textAlign: 'left',
        color: v.ink,
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 180ms ease, border-left-color 180ms ease, box-shadow 220ms ease',
        boxShadow: isMobile
          ? revealProgress > 0
            ? `0 ${rowLift * 8}px ${rowLift * 22}px color-mix(in srgb, #000 18%, transparent), inset -56px 0 56px color-mix(in srgb, ${v.accent} 12%, transparent)`
            : 'none'
          : desktopOptionsVisible
            ? `inset -82px 0 58px color-mix(in srgb, ${v.accent} 8%, transparent)`
            : 'none',
      }}
    >
      {isMobile ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '0 0 0 auto',
            width: 116,
            opacity: revealProgress,
            transform: `translateX(${Math.round((1 - revealProgress) * 22)}px)`,
            transition: dragX
              ? 'none'
              : 'opacity 260ms ease, transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            background:
              'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--lx-warning-dim) 62%, transparent) 42%, color-mix(in srgb, var(--lx-error-dim) 78%, transparent) 100%)',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          transition: dragX
            ? 'none'
            : 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1), filter 260ms ease',
          transform: `translateX(${contentOffset}px)`,
          filter: revealProgress > 0.4 ? 'brightness(1.05)' : 'none',
        }}
      >
        <AvatarVisual thread={thread} size={34} />
      </div>
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          position: 'relative',
          zIndex: 1,
          transition: dragX
            ? 'none'
            : 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease',
          transform: `translateX(${contentOffset}px)`,
          opacity: isMobile ? 1 - revealProgress * 0.08 : 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: v.fontBody,
            fontSize: 12.5,
            fontWeight: 700,
            color: v.ink,
          }}
        >
          <LxVerifiedName
            name={thread.name}
            verified={thread.isVerified}
            category={thread.verifiedCategory}
            size={12}
            textStyle={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          />
          {thread.pinned ? <LxIcon name="pin" size={10} filled color={v.ink3} /> : null}
          {thread.muted ? <LxIcon name="bellOff" size={11} color={v.ink3} /> : null}
        </div>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 11,
            color: thread.muted ? v.ink3 : v.ink2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {[thread.preview, thread.time].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: isMobile ? 88 : 24,
          justifyContent: 'flex-end',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {!showOptions && thread.unread > 0 ? (
          <span
            style={{
              minWidth: 16,
              height: 16,
              padding: '0 5px',
              borderRadius: 999,
              background: v.accent,
              color: v.ink,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: v.fontMono,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {thread.unread}
          </span>
        ) : !showOptions && thread.manuallyUnread ? (
          // No count to show - manually flagged with nothing new to number - so a plain dot
          // signals "unread" the same way the number does, without inventing a fake count.
          <span
            aria-label="unread"
            style={{ width: 8, height: 8, borderRadius: '50%', background: v.accent }}
          />
        ) : null}
        {mobileActionsVisible
          ? mobileQuickActions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick();
                }}
                aria-label={`${action.label} ${thread.name}`}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: action.tone === 'danger' ? v.errorDim : v.surfaceRaised,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  opacity: revealProgress,
                  transform: `translateX(${Math.round((1 - revealProgress) * 24)}px) translateY(${
                    index === 0 ? -Math.round((1 - revealProgress) * 4) : 0
                  }px) scale(${0.72 + revealProgress * 0.28}) rotate(${
                    index === 0 ? Math.round((1 - revealProgress) * -10) : 0
                  }deg)`,
                  transition:
                    'opacity 220ms ease, transform 340ms cubic-bezier(0.16, 1, 0.3, 1), background 180ms ease, box-shadow 220ms ease',
                  transitionDelay: `${index * 32}ms`,
                  boxShadow:
                    revealProgress > 0.8
                      ? '0 10px 22px color-mix(in srgb, #000 24%, transparent)'
                      : 'none',
                }}
              >
                <LxIcon
                  name={action.icon}
                  size={13}
                  color={action.tone === 'danger' ? v.error : v.ink3}
                />
              </button>
            ))
          : null}
        {showOptions ? (
          <button
            type="button"
            ref={menuButtonRef}
            onClick={(event) => {
              event.stopPropagation();
              onRevealOptions?.();
              setMenuOpen((open) => !open);
            }}
            aria-label={`options for ${thread.name}`}
            style={{
              width: isMobile ? 24 : 28,
              height: isMobile ? 24 : 28,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              opacity: isMobile ? revealProgress : 1,
              transform:
                isMobile && mobileActionsVisible
                  ? `translateX(${Math.round((1 - revealProgress) * 26)}px) scale(${
                      0.76 + revealProgress * 0.24
                    })`
                  : 'none',
              transition: isMobile
                ? 'opacity 220ms ease, transform 340ms cubic-bezier(0.16, 1, 0.3, 1)'
                : 'opacity 160ms ease',
              transitionDelay: isMobile && mobileActionsVisible ? '64ms' : '0ms',
              boxShadow: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                transform: 'none',
              }}
            >
              <LxIcon name="more" size={isMobile ? 13 : 15} color={v.ink3} />
            </span>
          </button>
        ) : null}
      </div>
      {/* display: contents keeps this wrapper out of the row's own grid layout - otherwise it
          becomes an unaccounted-for 4th item against a 3-column grid, auto-flowing into an
          implicit second row that adds a full row-gap of dead space below the row's content. */}
      <div style={{ display: 'contents' }} onClick={(event) => event.stopPropagation()}>
        <LxDropdownMenu
          anchorRef={menuButtonRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          items={dropdownItems}
          align="right"
          zIndex={2200}
        />
      </div>
    </div>
  );
}
