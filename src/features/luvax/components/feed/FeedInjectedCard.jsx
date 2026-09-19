import { v } from '@/config/tokens';

import { LxIcon } from '../primitives';

/**
 * The frame every injected suggestion card shares: surface, eyebrow, dismiss control.
 *
 * Only the frame. The three card types deliberately differ inside it - a dark portrait scroller, a
 * light banner scroller, a row list - because three cards sharing one geometry blur into a single
 * block the reader learns to scroll past. The shared surface and eyebrow keep them recognisably one
 * family while the silhouettes stay distinct.
 *
 * @param {string} eyebrow - Mono label, lowercase, naming what the card carries.
 * @param {string} [accentEyebrow] - Optional second label in accent ink, after a separator dot.
 * @param {React.ReactNode} [trailing] - Optional element left of the dismiss control.
 * @param {Function} onDismiss - Called when the reader dismisses the whole card.
 * @param {string} dismissLabel - Accessible name for the dismiss control; sentence case.
 */
export function FeedInjectedCard({
  eyebrow,
  accentEyebrow = null,
  trailing = null,
  onDismiss,
  dismissLabel,
  viewport = 'desktop',
  children,
}) {
  const isMobile = viewport === 'mobile';
  return (
    <section
      aria-label={accentEyebrow ? `${eyebrow}, ${accentEyebrow}` : eyebrow}
      // No card chrome, for the reason PostCard gives: the feed is one continuous surface on the
      // page background, and posts are told apart by the space between them rather than by a box.
      // A raised surface with a radius here drew a visible container around the suggestions that
      // nothing else in the column has.
      style={{ background: v.base }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // Matches the horizontal inset PostCard gives its own text rows, so the eyebrow lines
          // up with the caption of the post above it.
          padding: isMobile ? '12px 14px 10px' : '12px 4px 10px',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={eyebrowStyle}>{eyebrow}</span>
          {accentEyebrow ? (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: v.ink3,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  ...eyebrowStyle,
                  color: v.accentText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {accentEyebrow}
              </span>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {trailing}
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <LxIcon name="close" size={13} color={v.ink2} />
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

// ink2 rather than ink3: the right rail renders this eyebrow in ink3 on the same surface, which
// measures about 2.5:1 and is below WCAG AA for text. Correcting the rail is its own change, but
// there is no reason to copy the fault into new code.
const eyebrowStyle = {
  fontFamily: v.fontMono,
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: v.ink2,
};

export default FeedInjectedCard;
