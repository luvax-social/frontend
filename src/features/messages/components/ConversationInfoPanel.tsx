import type { Thread } from '../utils/messageViewModel';
import type { CSSProperties } from 'react';
import type { PreviewMedia } from '../types';

interface Props {
  activeThread: Thread | null;
  openPreview: (items: PreviewMedia[], index?: number) => void;
  currentUserId?: string;
  compact?: boolean;
  mobileOverlay?: boolean;
  onClose?: (() => void) | null;
  onMute?: (() => void) | null;
  onUnmute?: (() => void) | null;
  onRename?: (() => void) | null;
  onReport?: (() => void) | null;
  onBlock?: (() => void) | null;
  onDelete?: (() => void) | null;
}
import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxToggle } from '@/components/ui/lx-toggle';
import { AvatarVisual } from './AvatarVisual';
import { MediaPlaceholder } from './MediaPlaceholder';

const SECTION_LABEL: CSSProperties = {
  fontFamily: v.fontMono,
  fontSize: 10,
  color: v.ink3,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

/**
 * Detail panel for a conversation.
 *
 * Every conversation is between exactly two people, so this shows the other person and what has
 * been shared between them. The group name, member list and membership actions that used to live
 * here went with group chat itself.
 *
 * Only the shared-media section scrolls - the header and avatar block stay in place above it, and
 * the action list stays in place below it, the same way the conversation row's own "..." menu
 * groups its safe actions above a separator from its dangerous ones.
 */
export function ConversationInfoPanel({
  activeThread,
  openPreview,
  currentUserId,
  compact = false,
  mobileOverlay = false,
  onClose,
  onMute,
  onUnmute,
  onRename,
  onReport,
  onBlock,
  onDelete,
}: Props) {
  const navigate = useNavigate();

  if (!activeThread) return null;

  const participants = activeThread.participants || [];
  const media = activeThread.media || [];
  const counterpart = participants.find((participant) => participant.userId !== currentUserId);

  const actions: {
    id: string;
    icon: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
    separator?: boolean;
  }[] = [
    onRename ? { id: 'rename', icon: 'edit', label: 'Set nickname', onClick: onRename } : null,
    onReport
      ? { id: 'report', icon: 'flag', label: 'Report', danger: true, onClick: onReport }
      : null,
    onBlock ? { id: 'block', icon: 'ban', label: 'Block', danger: true, onClick: onBlock } : null,
    onDelete
      ? { id: 'delete', icon: 'trash', label: 'Delete chat', danger: true, onClick: onDelete }
      : null,
  ].filter((item) => item !== null);
  // A single divider marks where the danger group starts, whichever action happens to be first.
  const firstDangerIndex = actions.findIndex((action) => action.danger);
  if (firstDangerIndex > 0) actions[firstDangerIndex].separator = true;

  const panel = (
    <aside
      style={{
        height: mobileOverlay ? 'min(804px, calc(100vh / var(--lx-scale) - 52px))' : '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: v.base,
        borderLeft: mobileOverlay ? 'none' : `1px solid ${v.borderSubtle}`,
      }}
    >
      {mobileOverlay ? (
        <div
          style={{
            height: 60,
            borderBottom: `1px solid ${v.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px 0 20px',
            flexShrink: 0,
          }}
        >
          <div style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 700, color: v.ink }}>
            Mute notification
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LxToggle
              label="mute notification"
              on={Boolean(activeThread.muted)}
              onChange={(next) => (next ? onMute?.() : onUnmute?.())}
            />
            <button
              type="button"
              onClick={onClose ?? undefined}
              aria-label="close chat info"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: v.surface,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <LxIcon name="close" size={14} color={v.ink3} />
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          padding: mobileOverlay ? '24px 22px 22px' : compact ? '22px 14px 18px' : '28px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: mobileOverlay ? 12 : compact ? 10 : 12,
          flexShrink: 0,
        }}
      >
        <AvatarVisual thread={activeThread} size={mobileOverlay ? 74 : compact ? 54 : 66} />
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div
            style={{
              fontFamily: v.fontDisplay,
              fontSize: mobileOverlay ? 18 : compact ? 15 : 18,
              fontWeight: 700,
              color: v.ink,
            }}
          >
            {activeThread.name}
          </div>
          <div style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink3, marginTop: 4 }}>
            @{activeThread.username}
          </div>
        </div>

        <button
          type="button"
          onClick={() => counterpart?.userId && navigate(routeTo.userProfile(counterpart.userId))}
          disabled={!counterpart?.userId}
          style={{
            height: mobileOverlay ? 34 : compact ? 30 : 32,
            padding: mobileOverlay ? '0 20px' : compact ? '0 16px' : '0 18px',
            borderRadius: 999,
            border: 'none',
            background: v.surface,
            color: v.ink,
            fontFamily: v.fontBody,
            fontSize: mobileOverlay ? 14 : compact ? 13 : 14,
            cursor: counterpart?.userId ? 'pointer' : 'default',
          }}
        >
          view profile
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div
          style={{
            padding: mobileOverlay ? '16px 20px 22px' : compact ? '16px 14px' : '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: mobileOverlay ? 14 : compact ? 12 : 16,
          }}
        >
          <div style={SECTION_LABEL}>shared media</div>
          {media.length ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: mobileOverlay ? 8 : compact ? 5 : 6,
              }}
            >
              {media.map((item, index) => (
                <MediaPlaceholder
                  key={item.id}
                  item={item}
                  onClick={() => openPreview?.(media, index)}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>
              no attachments in the messages loaded so far
            </div>
          )}
        </div>
      </div>

      {actions.length ? (
        <div
          style={{
            borderTop: `1px solid ${v.borderSubtle}`,
            padding: 7,
            flexShrink: 0,
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className={`lx-popover-item ${action.danger ? 'is-danger' : ''} ${action.separator ? 'has-separator' : ''}`}
            >
              <LxIcon name={action.icon} size={16} color={action.danger ? v.error : v.ink2} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );

  return panel;
}
