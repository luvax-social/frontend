import type { ComposerAttachment } from '@/types/composer';
import { v } from '@/config/tokens';
import { LxIcon } from './primitives';

/**
 * The ordered strip of attached files.
 *
 * The design export defines no such surface, so every value here is derived
 * from tokens already in use on the composer: the tile radius and the sunken
 * background match the media box, and the remove control repeats the
 * black50 circle the single-file preview already used.
 *
 * Reordering is done with a pair of buttons rather than by dragging. The order
 * decides what a viewer swipes through, so it has to be changeable on a phone,
 * and a button is the only control that answers to a tap, a mouse and a
 * keyboard without a gesture library.
 */

const TILE = 96;

const statusLabel = (item: ComposerAttachment) => {
  if (item.status === 'uploading') return `${item.progress}%`;
  if (item.status === 'done') return 'ready';
  if (item.status === 'failed') return 'failed';
  return '';
};

export function ComposerAttachments({
  items,
  onRemove,
  onMove,
  onRetry,
}: {
  items: ComposerAttachment[];
  onRemove: (id: string) => void;
  onMove: (id: string, direction: number) => void;
  onRetry: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        marginBottom: 14,
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          style={{
            position: 'relative',
            flex: `0 0 ${TILE}px`,
            width: TILE,
            height: TILE,
            borderRadius: 12,
            background: v.surfaceSunken,
            border: item.status === 'failed' ? `1px solid ${v.error}` : `1px solid ${v.border}`,
            overflow: 'hidden',
          }}
        >
          {item.isVideo ? (
            <video
              src={item.previewUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={item.previewUrl}
              alt={`attachment ${index + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              background: v.black50,
              color: v.white,
              fontFamily: v.fontMono,
              fontSize: 9,
              borderRadius: 999,
              padding: '2px 6px',
            }}
          >
            {index + 1}/{items.length}
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`remove attachment ${index + 1}`}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: v.black50,
              border: 'none',
              borderRadius: '50%',
              padding: 3,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <LxIcon name="close" size={12} color={v.white} />
          </button>

          {item.status === 'uploading' ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 22,
                height: 3,
                background: v.black50,
              }}
            >
              <div style={{ width: `${item.progress}%`, height: '100%', background: v.accent }} />
            </div>
          ) : null}

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: v.black50,
              padding: '2px 3px',
            }}
          >
            <button
              type="button"
              onClick={() => onMove(item.id, -1)}
              disabled={index === 0}
              aria-label={`move attachment ${index + 1} earlier`}
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                display: 'flex',
                cursor: index === 0 ? 'default' : 'pointer',
                opacity: index === 0 ? 0.35 : 1,
              }}
            >
              <LxIcon name="chevronLeft" size={13} color={v.white} />
            </button>

            <span style={{ fontFamily: v.fontMono, fontSize: 8, color: v.white }}>
              {statusLabel(item)}
            </span>

            <button
              type="button"
              onClick={() => onMove(item.id, 1)}
              disabled={index === items.length - 1}
              aria-label={`move attachment ${index + 1} later`}
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                display: 'flex',
                cursor: index === items.length - 1 ? 'default' : 'pointer',
                opacity: index === items.length - 1 ? 0.35 : 1,
              }}
            >
              <LxIcon name="chevronRight" size={13} color={v.white} />
            </button>
          </div>

          {item.status === 'failed' ? (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              aria-label={`retry attachment ${index + 1}`}
              style={{
                position: 'absolute',
                inset: 0,
                margin: 'auto',
                width: 'fit-content',
                height: 'fit-content',
                background: v.black50,
                color: v.white,
                border: 'none',
                borderRadius: 999,
                fontFamily: v.fontBody,
                fontSize: 11,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              retry
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
