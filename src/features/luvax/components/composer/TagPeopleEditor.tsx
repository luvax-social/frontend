import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { ComposerAttachment, ComposerTag } from '@/types/composer';
import type { UserSummaryResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

import { LxAvatar, LxBtn } from '../primitives';
import {
  containedRect,
  imageFractionToPoint,
  pointToImageFraction,
  type Rect,
} from '../../utils/containedRect';
import { DialogShell } from './DialogShell';
import { monoHint } from './dialogStyles';
import { PersonSearch } from './PersonSearch';

/** Mirrors the `max_post_tags_per_media` setting. */
export const MAX_TAGS_PER_MEDIA = 20;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 };

/**
 * Tags people on the photos of a post being composed.
 *
 * Tagging happens over the image, per image: a click on the photo places a marker, the person is
 * then picked from search, and a marker can be dragged to a better spot. Each image holds at most
 * twenty tags. Whether a person allows tags, and whether they review them first, is the server's
 * decision when the post is published; the dialog says so rather than guessing, because a search
 * result does not carry anyone's tag settings and a block is never revealed.
 *
 * Edits are kept in a local copy and handed back only on done, so cancel leaves the composer as
 * it was.
 */
export function TagPeopleEditor({
  attachments,
  tags,
  onDone,
  onClose,
}: {
  attachments: ComposerAttachment[];
  tags: ComposerTag[];
  onDone: (tags: ComposerTag[]) => void;
  onClose: () => void;
}) {
  const photos = attachments.filter((item) => !item.isVideo);
  const [activeId, setActiveId] = useState(photos[0]?.id ?? '');
  const [draft, setDraft] = useState<ComposerTag[]>(tags);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<string | null>(null);
  // The photo is shown with object-fit: contain, so its own rectangle inside the frame is what a
  // fraction of the image refers to; the frame's edges are not.
  const [ratio, setRatio] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect>(EMPTY_RECT);

  const active = photos.find((item) => item.id === activeId) ?? photos[0];
  const onPhoto = draft.filter((tag) => tag.attachmentId === active?.id);
  const full = onPhoto.length >= MAX_TAGS_PER_MEDIA;

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const measure = () => setRect(containedRect(node.clientWidth, node.clientHeight, ratio));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ratio, active?.id]);

  const framePoint = (clientX: number, clientY: number) => {
    const box = frameRef.current?.getBoundingClientRect();
    return box ? { x: clientX - box.left, y: clientY - box.top } : null;
  };

  // A click on the letterbox bars is not on the photo, so it places nothing.
  const placePending = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current || full) return;
    const at = framePoint(event.clientX, event.clientY);
    const point = at ? pointToImageFraction(rect, at.x, at.y) : null;
    if (point) setPending(point);
  };

  // A dragged marker is held at the photo's edge instead of leaving it.
  const pointToFraction = (clientX: number, clientY: number) => {
    const at = framePoint(clientX, clientY);
    if (!at || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp((at.x - rect.left) / rect.width),
      y: clamp((at.y - rect.top) / rect.height),
    };
  };

  const choose = (user: UserSummaryResponse) => {
    if (!active || full) return;
    const at = pending ?? { x: 0.5, y: 0.5 };
    setDraft((current) => [
      ...current,
      { id: crypto.randomUUID(), attachmentId: active.id, user, x: at.x, y: at.y },
    ]);
    setPending(null);
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    dragging.current = id;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const id = dragging.current;
    if (!id) return;
    const point = pointToFraction(event.clientX, event.clientY);
    if (!point) return;
    setDraft((current) => current.map((tag) => (tag.id === id ? { ...tag, ...point } : tag)));
  };

  const endDrag = () => {
    // Cleared on the next frame so the click that ends a drag does not also place a marker.
    window.setTimeout(() => {
      dragging.current = null;
    }, 0);
  };

  if (!active) {
    return (
      <DialogShell title="tag people" onClose={onClose} width={420} testId="tag-people-editor">
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 14, color: v.ink2 }}>
          Add a photo to tag people. Videos cannot be tagged.
        </p>
      </DialogShell>
    );
  }

  const position = photos.findIndex((item) => item.id === active.id) + 1;

  return (
    <DialogShell title="tag people" onClose={onClose} width={980} testId="tag-people-editor">
      <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {photos.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveId(item.id);
                  setPending(null);
                }}
                aria-label={`photo ${index + 1}`}
                aria-current={item.id === active.id}
                style={{
                  appearance: 'none',
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: v.fontBody,
                  fontSize: 13,
                  color: v.ink,
                  background: item.id === active.id ? v.accentDim : 'transparent',
                  border: `1px solid ${item.id === active.id ? v.accent : v.border}`,
                }}
              >
                {index + 1}
              </button>
            ))}
            <span style={{ ...monoHint, marginLeft: 'auto' }}>click the photo to tag someone</span>
          </div>
          <div
            ref={frameRef}
            onPointerDown={placePending}
            data-testid="tag-photo"
            style={{
              position: 'relative',
              height: 460,
              background: v.surfaceSunken,
              borderRadius: 12,
              overflow: 'hidden',
              cursor: full ? 'not-allowed' : 'crosshair',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <img
              src={active.previewUrl}
              alt={active.altText.trim() || `photo ${position}`}
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                setRatio(naturalHeight > 0 ? naturalWidth / naturalHeight : null);
              }}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
            />
            {onPhoto.map((tag) => (
              <button
                key={tag.id}
                type="button"
                data-tag={tag.user.username ?? undefined}
                aria-label={`tag ${tag.user.username}, drag to move`}
                onPointerDown={(event) => startDrag(event, tag.id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  appearance: 'none',
                  position: 'absolute',
                  ...imageFractionToPoint(rect, tag.x, tag.y),
                  transform: 'translate(-50%, -6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'grab',
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: v.base,
                    border: `2px solid ${v.accent}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 12,
                    color: v.inkInverse,
                    background: v.black,
                    borderRadius: 999,
                    padding: '2px 9px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag.user.username}
                </span>
              </button>
            ))}
            {pending ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  ...imageFractionToPoint(rect, pending.x, pending.y),
                  width: 14,
                  height: 14,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 999,
                  border: `2px solid ${v.accent}`,
                  background: v.accentDim,
                }}
              />
            ) : null}
          </div>
          <p style={{ ...monoHint, margin: '8px 0 0' }}>
            Image {position} of {photos.length}. Markers sit at the spot you click and can be
            dragged.
          </p>
        </div>

        <div style={{ flex: '0 1 340px', minWidth: 260, display: 'flex', flexDirection: 'column' }}>
          <PersonSearch
            onChoose={choose}
            placeholder="search people to tag"
            autoFocus={false}
            emptyHint={
              pending
                ? 'Now choose who to tag at the marker.'
                : 'Click the photo, then choose a person.'
            }
            rowState={(user) =>
              onPhoto.some((tag) => tag.user.id === user.id)
                ? { badge: 'tagged', disabled: true }
                : full
                  ? { note: `At most ${MAX_TAGS_PER_MEDIA} tags on a photo`, disabled: true }
                  : {}
            }
          />

          <div style={{ borderTop: `1px solid ${v.border}`, marginTop: 14, paddingTop: 12 }}>
            <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, marginBottom: 6 }}>
              On this photo{' '}
              <span style={monoHint}>
                {onPhoto.length} of {MAX_TAGS_PER_MEDIA}
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {onPhoto.map((tag) => (
                <li
                  key={tag.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
                >
                  <LxAvatar size={26} src={tag.user.avatarUrl} />
                  <span style={{ flex: 1, fontFamily: v.fontBody, fontSize: 14, color: v.ink }}>
                    {tag.user.username}
                  </span>
                  <button
                    type="button"
                    aria-label={`remove tag ${tag.user.username}`}
                    onClick={() => setDraft((current) => current.filter((t) => t.id !== tag.id))}
                    style={{
                      appearance: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      padding: 4,
                    }}
                  >
                    <LxIcon name="close" size={16} color={v.ink3} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p
            style={{
              margin: '16px 0 14px',
              marginTop: 'auto',
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.ink2,
            }}
          >
            Some people review tags before they appear on their profile. We will let them know when
            you post.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <LxBtn variant="ghost" type="button" onClick={onClose}>
              cancel
            </LxBtn>
            <LxBtn
              type="button"
              onClick={() => {
                onDone(draft);
                onClose();
              }}
            >
              done
            </LxBtn>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
