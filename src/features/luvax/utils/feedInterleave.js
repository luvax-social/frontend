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
export const CARD_TYPES = ['stories', 'people', 'hashtags'];

/** Posts before the first card. */
export const FIRST_SLOT = 3;

/** Posts between cards after the first. */
export const SLOT_STRIDE = 5;

/**
 * Builds the feed's render list.
 *
 * @param {Array<Object>} posts - Flattened, filtered posts in display order.
 * @param {Object} availability - `{stories, people, hashtags}`; a type is eligible only when true,
 *   so a loading, failed and empty query all read the same way - the card does not render.
 * @param {Array<string>} dismissed - Card keys the reader has dismissed this session.
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

  const place = () => {
    for (let offset = 0; offset < CARD_TYPES.length; offset += 1) {
      const type = CARD_TYPES[(cursor + offset) % CARD_TYPES.length];
      const key = `${type}-${slot}`;
      if (availability[type] && !skipped.has(key)) {
        cursor = (cursor + offset + 1) % CARD_TYPES.length;
        return { kind: 'card', type, key };
      }
    }
    // Nothing eligible. The slot stays empty rather than rendering a shell, and the next slot is
    // unaffected.
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
