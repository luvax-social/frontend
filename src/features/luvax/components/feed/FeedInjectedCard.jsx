import { useRef, useState } from 'react';

import { v } from '@/config/tokens';

import { LxDropdownMenu, LxIcon } from '../primitives';

/**
 * The frame every injected suggestion card shares: section label, options menu, and the content
 * the card itself supplies.
 *
 * Only the frame. The cards deliberately differ inside it, because two cards sharing one geometry
 * blur into a single block the reader learns to scroll past.
 *
 * The header carries an options menu rather than a bare dismiss control. A close button on a
 * suggestion reads as "this was a mistake to show me"; the same action inside a menu reads as one
 * choice among several, which is what it is.
 *
 * @param {string} eyebrow - Mono label, lowercase, naming what the card carries.
 * @param {string} icon - Glyph shown before the label, so the section is recognisable before it is
 *   read.
 * @param {string} [accentEyebrow] - Optional second label in accent ink, after a separator dot.
 * @param {React.ReactNode} [trailing] - Optional element left of the options control.
 * @param {Array<Object>} menuItems - Rows for the options menu, in LxDropdownMenu's shape.
 * @param {string} menuLabel - Accessible name for the options control; sentence case.
 */
export function FeedInjectedCard({
  eyebrow,
  icon,
  accentEyebrow = null,
  trailing = null,
  menuItems = [],
  menuLabel,
  viewport = 'desktop',
  children,
}) {
  const isMobile = viewport === 'mobile';
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      aria-label={accentEyebrow ? `${eyebrow}, ${accentEyebrow}` : eyebrow}
      // No card chrome, for the reason PostCard gives: the feed is one continuous surface on the
      // page background, and posts are told apart by the space between them rather than by a box.
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {icon ? <LxIcon name={icon} size={14} color={v.ink2} /> : null}
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
            ref={menuButtonRef}
            type="button"
            aria-label={menuLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              width: 28,
              height: 28,
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
            <LxIcon name="more" size={16} color={v.ink2} />
          </button>
        </div>
      </div>
      {children}
      <LxDropdownMenu
        anchorRef={menuButtonRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        width={248}
      />
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
