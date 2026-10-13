/**
 * Presentation configuration for the Luvax shell.
 *
 * This file used to also hold invented people, invented posts, invented
 * stories, invented notifications and a list of interests. All of it has been
 * removed. It rendered as though it were real content, and the story rail
 * built links out of it that led to stories which do not exist.
 *
 * Nothing that stands in for server data belongs here. If a surface needs
 * content, it reads it from the API or it says plainly that it has none.
 * See docs/social-states-and-tabs/fabricated-data-removal.md.
 */

export const ACCENT_PALETTES = ['#C8A97E', '#7A9E7A', '#C4847A'];

export const FONT_MAP: Record<string, string> = {
  syne: "'Syne', sans-serif",
  serif: "'Instrument Serif', serif",
};

export const TWEAK_DEFAULTS = {
  accent: '#C8A97E',
  dark: true,
  font: 'syne',
  density: 'cozy',
  showTags: true,
};

// The story rail's presentation data, restored on the owner's direction. The
// rail is an interface with no live data wiring yet, so this stands in for the
// stories feed the backend implements.
export const STORIES = [
  { id: 's0', author: 'you', idx: 0, hasStory: false, isOwn: true },
  {
    id: 's1',
    author: 'sol.r',
    idx: 1,
    hasStory: true,
    viewed: false,
    type: 'photo',
    bg: '#C4BCB2',
    text: null,
    caption: 'morning',
  },
  {
    id: 's2',
    author: 'jo.x',
    idx: 2,
    hasStory: true,
    viewed: false,
    type: 'text',
    bg: 'var(--lx-ink)',
    text: 'three minutes of\nreal quiet today',
    caption: null,
  },
  {
    id: 's3',
    author: 'ren.ko',
    idx: 3,
    hasStory: true,
    viewed: false,
    type: 'video',
    bg: 'var(--lx-ink-2)',
    text: null,
    caption: 'walking somewhere',
  },
  {
    id: 's4',
    author: 'lea.p',
    idx: 4,
    hasStory: true,
    viewed: true,
    type: 'photo',
    bg: '#BDB0A0',
    text: null,
    caption: 'film, 2023',
  },
  {
    id: 's5',
    author: 'noa.b',
    idx: 5,
    hasStory: true,
    viewed: true,
    type: 'text',
    bg: '#C8A97E',
    text: 'observation\nis a practice',
    caption: null,
  },
  {
    id: 's6',
    author: 'mara.v',
    idx: 6,
    hasStory: true,
    viewed: true,
    type: 'photo',
    bg: '#D5C9BE',
    text: null,
    caption: null,
  },
];
