import { v } from '@/config/tokens';

const ICONS = {
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  explore: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  chat: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  profile: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  edit: (
    <>
      <path d="M12 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-5" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L11 15l-4 1 1-4Z" />
    </>
  ),
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  reply: (
    <>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </>
  ),
  share: (
    <>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.2 4.72" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L12.8 19.28" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),
  video: (
    <>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </>
  ),
  type: (
    <>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </>
  ),
  hash: (
    <>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </>
  ),
  bookmark: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  chevronRight: <polyline points="9 18 15 12 9 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />,
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.4 2 4 2 4-2 4-2" />
      <circle cx="9" cy="10" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V5" />
      <path d="M5 5h11l-2 4 2 4H5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="7.4" x2="12" y2="13.2" />
      <circle cx="12" cy="16.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  chevronLeft: <polyline points="14 18 8 12 14 6" />,
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </>
  ),
  userMinus: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </>
  ),
  userPlus: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </>
  ),
  // A thumbtack, not a map marker: a pin cap and a body that tapers to a point, with a short
  // stick below showing it pushed into a surface - the "pin this chat" metaphor, not "location."
  pin: (
    <>
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      <line x1="12" y1="17" x2="12" y2="22" />
    </>
  ),
  bellOff: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </>
  ),
  // Added for the admin panel: a shield for the panel identity, a funnel for the
  // filter bar, a door-and-arrow for sign out, and a downward chevron for the
  // select control. Same outline style as the rest of the set.
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  // A clock for the moderation action log, and an outward arrow for a link that
  // leaves the current screen (the audit row's route back to its report). Same
  // outline style as the rest of the set.
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>
  ),
  // A question mark in a circle: the support nav item's icon. `check` read as
  // "done" rather than "help", which is confusing beside a queue of open
  // tickets that are anything but done.
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 1.8-2.5 2.4-2.85 3.9" />
      <circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none" />
    </>
  ),

  // The eight verification category glyphs. These are drawn for the inside of a 14px badge, which
  // is a harder brief than the rest of this map: at that size the glyph is under 8px across, so
  // every one of them is reduced to a single silhouette with no interior detail that would close
  // up. Each is tested against the other seven at 14px in a browser, not by reading the paths.
  'music-note': (
    <>
      <circle cx="8.5" cy="17" r="3.5" />
      <path d="M12 17V4l7 2.2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-1.6 2-1.7 3.2-1.7A5 5 0 0 0 22 12c0-5-4.5-9-10-9Z" />
      <circle cx="7.5" cy="12" r="1.1" />
      <circle cx="11.5" cy="7.5" r="1.1" />
      <circle cx="16" cy="10" r="1.1" />
    </>
  ),
  'pen-nib': (
    <>
      <path d="M12 21 5.5 8 12 3l6.5 5L12 21Z" />
      <circle cx="12" cy="9.5" r="1.8" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3v6.2L4.6 18.4A2 2 0 0 0 6.4 21.4h11.2a2 2 0 0 0 1.8-3L14.5 9.2V3" />
      <path d="M8 3h8" />
      <path d="M7.2 15h9.6" />
    </>
  ),
  clapperboard: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3.6 9 6.5 4.2h3.8L7.4 9" />
      <path d="M12.2 9l2.9-4.8h3.8L16 9" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="5.8" />
      <path d="M8.6 10 6 3h12l-2.6 7" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2.5" y="7" width="19" height="14" rx="2" />
      <path d="M8.5 7V5.2A2.2 2.2 0 0 1 10.7 3h2.6a2.2 2.2 0 0 1 2.2 2.2V7" />
    </>
  ),
  gamepad: (
    <>
      <rect x="2" y="6.5" width="20" height="11" rx="5.5" />
      <path d="M7 10v4" />
      <path d="M5 12h4" />
      <circle cx="16.2" cy="10.8" r="1.05" />
      <circle cx="18.4" cy="13.4" r="1.05" />
    </>
  ),
};

// Filled variants are distinct artwork, not the outline paths with a fill added. Each shape sets
// its own fill and switches stroke off, because leaving the outline stroke on top of a filled
// shape grows it by half the stroke width in every direction. Three of the seven are drawn
// differently from their outline counterpart rather than merely filled: home swaps its door
// polyline for a knocked-out rectangle, explore keeps its handle as a stroked path over a filled
// lens, and bell keeps its clapper as an open arc so it does not become a solid wedge.
const ICONS_FILLED = {
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="none" />
      <rect x="9" y="13" width="6" height="9" rx="1" fill="var(--lx-base)" stroke="none" />
    </>
  ),
  explore: (
    <>
      <circle cx="11" cy="11" r="7" fill="currentColor" stroke="none" />
      <path
        d="m21 21-4.35-4.35"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </>
  ),
  chat: (
    <path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" stroke="none" />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="7" r="4" fill="currentColor" stroke="none" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="currentColor" stroke="none" />
    </>
  ),
  heart: (
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill="currentColor"
      stroke="none"
    />
  ),
  bookmark: (
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor" stroke="none" />
  ),
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pin: (
    <>
      <path
        d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
        fill="currentColor"
        stroke="none"
      />
      <line
        x1="12"
        y1="17"
        x2="12"
        y2="22"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),
};

export function LxIcon({ name, size = 20, color, filled = false, stroke = 1.5 }) {
  const node = filled && ICONS_FILLED[name] ? ICONS_FILLED[name] : ICONS[name];
  if (!node) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || v.ink}
      // The filled artwork paints with currentColor, so the SVG has to carry a color for those
      // shapes to resolve against. Without it they inherit whatever colour is in scope.
      style={{ color: color || v.ink }}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {node}
    </svg>
  );
}
