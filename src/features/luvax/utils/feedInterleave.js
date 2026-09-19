/**
 * Where the injected suggestion cards sit among the posts.
 *
 * Pure and React-free on purpose. The rules below are the kind that regress silently inside a
 * component - an empty card between two posts, two cards back to back, a slot that vanishes - and
 * each one is cheap to assert here and expensive to notice in a rendered tree.
 *
 * Positions are computed from the flattened, already-filtered post array rather than from API page
 * boundaries. Page size is not fixed and `canViewerSeePost` can shrink a page arbitrarily, so
 * anchoring to pages would make the spacing visibly irregular.
 */

/** Rotation order. One card type per slot, cycling. */
export const CARD_TYPES = ['people', 'hashtags'];

/** Posts before the first card. */
export const FIRST_SLOT = 3;

/** Posts between cards after the first. */
export const SLOT_STRIDE = 5;

/**
 * Builds the feed's render list.
 *
 * @param {Array<Object>} posts - Flattened, filtered posts in display order.
 * @param {Object} availability - `{people, hashtags}`; a type is eligible only when true, so a
 *   loading, failed and empty query all read the same way - the card does not render.
 * @param {Array<string>} dismissed - Card *types* the reader has dismissed this session. Keyed by
 *   type rather than by slot on purpose: dismissing a card means "not this kind of thing", not "not
 *   in this position", and a slot-keyed dismissal would bring the same card back five posts later.
 * @returns {Array<Object>} `{kind:'post', post}` and `{kind:'card', type, key}` entries.
 */
export function interleaveFeed(posts = [], availability = {}, dismissed = []) {
  const skipped = new Set(dismissed);
  const items = [];
  // Advances only when a card is actually placed. Advancing once per slot instead would let a type
  // skipped for having no data still consume its turn, so the next slot would repeat whichever
  // type took its place.
  let cursor = 0;
  let slot = 0;

  // A type is used at most once in a feed. Both cards carry the same rows every time they are
  // built, so a second one would be the same card twice, which is what made the suggestions read
  // as a loop rather than as recommendations.
  const used = new Set();

  const place = () => {
    for (let offset = 0; offset < CARD_TYPES.length; offset += 1) {
      const type = CARD_TYPES[(cursor + offset) % CARD_TYPES.length];
      if (availability[type] && !skipped.has(type) && !used.has(type)) {
        cursor = (cursor + offset + 1) % CARD_TYPES.length;
        used.add(type);
        return { kind: 'card', type, key: type };
      }
    }
    // Nothing eligible, either because no type has data or because every type has had its turn.
    // The slot stays empty rather than rendering a shell.
    return null;
  };

  if (posts.length < FIRST_SLOT) {
    // Too short to space cards out. One card, appended, so a brand new account still gets a way in
    // without the whole first screen becoming suggestions.
    posts.forEach((post) => items.push({ kind: 'post', post }));
    const card = place();
    if (card) items.push(card);
    return items;
  }

  posts.forEach((post, index) => {
    items.push({ kind: 'post', post });
    const placed = index + 1;
    if (placed >= FIRST_SLOT && (placed - FIRST_SLOT) % SLOT_STRIDE === 0) {
      const card = place();
      if (card) items.push(card);
      slot += 1;
    }
  });

  return items;
}
