import type { MessageView, MessageMedia } from '../types';

interface Props {
  items: MessageView[];
  onOpenViewer: (items: MessageView[], index: number) => void;
  isMine: boolean;
  isFirstInRun: boolean;
  isLastInRun: boolean;
  onDeleteItem?: (id: string) => void;
  onReplyItem?: (item: MessageView) => void;
  forceShowActions?: boolean;
}
import { useEffect, useMemo, useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { LxIcon } from '@/components/ui/lx-icon';
import { copyToClipboard } from '@/utils/helpers';
import { bubbleCornerRadius } from '../utils/bubbleShape';
import { isVideoMessageMedia } from '../utils/messageMedia';
import { MediaPlaceholder } from './MediaPlaceholder';

// Four tiles read as a grid at a glance; a fifth would either shrink every tile to fit or force
// the album taller than a normal bubble, so it stays hidden behind the "+N" on the fourth instead.
const MAX_VISIBLE_TILES = 4;
const ALBUM_WIDTH = 210;

async function copyImageToClipboard(media: MessageMedia | null) {
  const url = media?.cdnUrl;
  if (!url) return;

  if (navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || 'image/png']: blob,
        }),
      ]);
      return;
    } catch {
      // Some CDNs block cross-origin blob reads. Copying the URL still gives the user the asset.
    }
  }

  await copyToClipboard(url, 'copy image');
}

function AlbumTile({
  item,
  items,
  index,
  isLastTile,
  overflow,
  isMine,
  onOpenViewer,
  onDeleteItem,
  onReplyItem,
  forceShowActions = false,
}: Pick<
  Props,
  'items' | 'onOpenViewer' | 'isMine' | 'onDeleteItem' | 'onReplyItem' | 'forceShowActions'
> & { item: MessageView; index: number; isLastTile: boolean; overflow: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touchRevealed, setTouchRevealed] = useState(false);
  const tileRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const supportsHover =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const showActions =
    forceShowActions || menuOpen || (supportsHover && hovered) || (!supportsHover && touchRevealed);
  const textForCopy = item.text || item.media?.label || '';
  const isVideo = isVideoMessageMedia(item.media);
  const canCopyImage = Boolean(item.media?.cdnUrl && !isVideo);
  const canDelete = isMine && item.kind !== 'deleted';
  const menuItems = useMemo(
    () =>
      [
        canCopyImage
          ? {
              id: 'copy-image',
              icon: 'image',
              label: 'Copy image',
              onClick: () => copyImageToClipboard(item.media),
            }
          : null,
        textForCopy
          ? {
              id: 'copy',
              icon: 'link',
              label: 'Copy text',
              onClick: () => copyToClipboard(textForCopy),
            }
          : null,
        canDelete
          ? {
              id: 'delete',
              icon: 'trash',
              label: 'Delete',
              tone: 'danger',
              onClick: () => onDeleteItem?.(item.id),
            }
          : null,
      ].filter((item) => item !== null),
    [canCopyImage, canDelete, item, onDeleteItem, textForCopy]
  );

  useEffect(() => {
    if (supportsHover || (!touchRevealed && !menuOpen)) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        tileRef.current?.contains(event.target instanceof Node ? event.target : null) ||
        menuButtonRef.current?.contains(event.target instanceof Node ? event.target : null)
      ) {
        return;
      }
      setTouchRevealed(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen, supportsHover, touchRevealed]);

  const handleTileInteraction = () => {
    if (!supportsHover) {
      setTouchRevealed(true);
    }
  };

  return (
    <div
      ref={tileRef}
      data-message-id={item.id}
      style={{ position: 'relative', minWidth: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        if (!menuOpen) setTouchRevealed(false);
      }}
      onPointerDown={handleTileInteraction}
    >
      <MediaPlaceholder
        item={item.media || { label: item.text }}
        onClick={() => onOpenViewer(items, index)}
      />
      {isLastTile && overflow > 0 ? (
        <div
          onClick={() => onOpenViewer(items, index)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: v.fontBody,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            zIndex: 1,
          }}
        >
          +{overflow}
        </div>
      ) : null}
      {showActions && (menuItems.length > 0 || item.kind !== 'deleted') ? (
        <>
          {item.kind !== 'deleted' ? (
            <button
              type="button"
              aria-label="reply to message image"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onReplyItem?.(item);
              }}
              style={{
                position: 'absolute',
                top: 6,
                right: 33,
                width: 23,
                height: 23,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0,0,0,0.48)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: 'none',
              }}
            >
              <LxIcon name="reply" size={12} color="#fff" />
            </button>
          ) : null}
          {menuItems.length > 0 ? (
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="message image actions"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setTouchRevealed(false);
                setMenuOpen((open) => !open);
              }}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 23,
                height: 23,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0,0,0,0.48)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: 'none',
              }}
            >
              <LxIcon name="more" size={10} color="#fff" />
            </button>
          ) : null}
        </>
      ) : null}
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

/**
 * A run of consecutive photo/video messages from one sender, collapsed into one grid tile instead
 * of a stack of separate bubbles. Each tile is still its own message underneath - the grouping
 * happens only here, at render time - so nothing about sending, deleting, or reading the messages
 * individually has to change for it to work.
 *
 * Takes the same run-position props as a text bubble and shapes its own corners the same way, so
 * an album sitting between two bubbles from the same run reads as part of one continuous shape.
 */
export function MessageAlbum({
  items,
  onOpenViewer,
  isMine,
  isFirstInRun,
  isLastInRun,
  onDeleteItem,
  onReplyItem,
  forceShowActions = false,
}: Props) {
  const visible = items.slice(0, MAX_VISIBLE_TILES);
  const overflow = items.length - MAX_VISIBLE_TILES;
  const caption = items.find((item) => item.text)?.text || '';
  const albumRadius = bubbleCornerRadius({
    isMine,
    isFirstInRun,
    isLastInRun: !caption && isLastInRun,
  });

  return (
    <div
      style={{
        width: ALBUM_WIDTH,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
          borderRadius: albumRadius,
          overflow: 'hidden',
        }}
      >
        {visible.map((item, index) => {
          const isLastTile = index === MAX_VISIBLE_TILES - 1;
          return (
            <AlbumTile
              key={item.id}
              item={item}
              items={items}
              index={index}
              isLastTile={isLastTile}
              overflow={overflow}
              isMine={isMine}
              onOpenViewer={onOpenViewer}
              onDeleteItem={onDeleteItem}
              onReplyItem={onReplyItem}
              forceShowActions={forceShowActions}
            />
          );
        })}
      </div>
      {caption ? (
        <div
          style={{
            maxWidth: '100%',
            marginTop: 2,
            padding: '8px 11px',
            borderRadius: bubbleCornerRadius({
              isMine,
              isFirstInRun: false,
              isLastInRun,
            }),
            background: isMine ? v.accentDim : v.surface,
            color: v.ink,
            fontFamily: v.fontBody,
            fontSize: 13.5,
            lineHeight: 1.42,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}
