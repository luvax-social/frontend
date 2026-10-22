import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * The panel's media viewer.
 *
 * It deliberately matches, rather than reuses, the viewer the user-facing
 * application opens for a post. That viewer is `PostDetailScreen` in overlay
 * form: a route-level component in the luvax feature that resolves a post from
 * the path, loads its comments, and offers liking, saving and commenting.
 * Mounting it here would import across features, fire requests this phase is
 * not allowed to add, and hand the panel capabilities a moderation surface must
 * not have. So the behaviour and the appearance are matched on purpose:
 *
 *   - a full-viewport overlay over the application's own scrim
 *   - Escape closes it, through the same `useEscapeKey` hook the post overlay
 *     uses, and the arrow keys move between items
 *   - forward and back controls, a position counter and position dots, drawn as
 *     the light frosted chips the post carousel uses so a quiet control stays
 *     legible on top of any photograph
 *
 * Every colour is a token. The chip is the white utility token rather than a
 * theme surface because it sits on the media, not on the page.
 */

function isVideo(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url));
}

const CHIP: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: 'none',
  background: v.white75,
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

function MediaViewerOverlay({
  urls,
  index,
  onIndex,
  onClose,
  label,
}: {
  urls: string[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  label: string;
}) {
  const count = urls.length;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEscapeKey(true, onClose);

  useEffect(() => {
    // The close control is the first thing reached, so the overlay is operable
    // from the keyboard the moment it opens.
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' && index < count - 1) {
        event.preventDefault();
        onIndex(index + 1);
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onIndex(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onIndex]);

  const url = urls[index];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        background: v.scrim,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="close viewer"
        onClick={onClose}
        style={{ ...CHIP, position: 'absolute', top: 20, right: 20 }}
      >
        <LxIcon name="close" size={17} color={v.black} />
      </button>

      {count > 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            background: v.white75,
            borderRadius: 999,
            padding: '4px 10px',
            fontFamily: v.fontMono,
            fontSize: 11,
            color: v.black,
          }}
        >
          {index + 1}/{count}
        </div>
      ) : null}

      {count > 1 && index > 0 ? (
        <button
          type="button"
          aria-label="previous item"
          onClick={(event) => {
            event.stopPropagation();
            onIndex(index - 1);
          }}
          style={{ ...CHIP, position: 'absolute', left: 20 }}
        >
          <LxIcon name="chevronLeft" size={18} color={v.black} />
        </button>
      ) : null}

      {count > 1 && index < count - 1 ? (
        <button
          type="button"
          aria-label="next item"
          onClick={(event) => {
            event.stopPropagation();
            onIndex(index + 1);
          }}
          style={{ ...CHIP, position: 'absolute', right: 20 }}
        >
          <LxIcon name="chevronRight" size={18} color={v.black} />
        </button>
      ) : null}

      {/* Stops a click on the media itself from closing the overlay. */}
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      >
        {isVideo(url) ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '82vh', display: 'block' }}
          />
        ) : (
          <img
            src={url}
            alt={`${label}, item ${index + 1} of ${count}`}
            style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', display: 'block' }}
          />
        )}
      </div>

      {count > 1 ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 5,
            background: v.white75,
            borderRadius: 999,
            padding: '6px 8px',
          }}
        >
          {urls.map((item, i) => (
            <span
              key={item}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: v.black,
                opacity: i === index ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

/**
 * A row of media thumbnails that open the viewer. Replaces the plain images the
 * panel drew before, which could not be opened at all.
 *
 * @param {string[]} urls the media attached to the record
 * @param {string} label what the media belongs to, for the viewer's label
 */
export function AdminMediaGrid({
  urls = [],
  label = 'media',
}: {
  urls?: string[];
  label?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const originRef = useRef<HTMLButtonElement>(null);
  const safeUrls = urls.filter(Boolean);

  const close = useCallback(() => {
    setOpenIndex(null);
    // Focus goes back to the thumbnail the viewer was opened from.
    originRef.current?.focus();
  }, []);

  if (safeUrls.length === 0) return null;

  return (
    <>
      <div className="lx-admin-media-grid">
        {safeUrls.map((url, index) => (
          <button
            key={url}
            type="button"
            className="lx-admin-media-thumb"
            aria-label={`open ${label}, item ${index + 1} of ${safeUrls.length}`}
            onClick={(event) => {
              originRef.current = event.currentTarget;
              setOpenIndex(index);
            }}
          >
            {isVideo(url) ? (
              <video src={url} muted preload="metadata" />
            ) : (
              <img
                src={url}
                alt={`${label}, item ${index + 1} of ${safeUrls.length}`}
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <MediaViewerOverlay
          urls={safeUrls}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={close}
          label={label}
        />
      ) : null}
    </>
  );
}
