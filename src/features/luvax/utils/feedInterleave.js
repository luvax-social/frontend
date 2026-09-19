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
 * @param {Object} availability - `{people, hashtags}`. A boolean means the type may be used once;
 *   a number means it may be used that many times, each appearance carrying a different subject. A
 *   loading, failed and empty query all read the same way - the card does not render.
 * @param {Array<string>} dismissed - Card *types* the reader has dismissed this session. Keyed by
 *   type rather than by slot on purpose: dismissing a card means "not this kind of thing", not "not
 *   in this position", and a slot-keyed dismissal would bring the same card back five posts later.
 * @returns {Array<Object>} `{kind:'post', post}` and `{kind:'card', type, key, occurrence}`
 *   entries, where `occurrence` is the zero-based index of that type's appearance and is what a
 *   repeatable card uses to pick which subject it shows.
 */
export function interleaveFeed(posts = [], availability = {}, dismissed = []) {
  const skipped = new Set(dismissed);
  const items = [];
  // Advances only when a card is actually placed. Advancing once per slot instead would let a type
  // skipped for having no data still consume its turn, so the next slot would repeat whichever
  // type took its place.
  let cursor = 0;
  let slot = 0;

  // How many times a type may appear. A boolean is the once-only case. A count is the paged case:
  // the people card shows one page of accounts per appearance, so repeating it carries the next
  // page rather than the same card twice, and the number of pages is the natural bound.
  const capacityOf = (type) => {
    const value = availability[type];
    if (typeof value === 'number') return Math.max(0, value);
    return value ? 1 : 0;
  };

  const used = {};

  const place = () => {
    for (let offset = 0; offset < CARD_TYPES.length; offset += 1) {
      const type = CARD_TYPES[(cursor + offset) % CARD_TYPES.length];
      const taken = used[type] ?? 0;
      if (taken < capacityOf(type) && !skipped.has(type)) {
        cursor = (cursor + offset + 1) % CARD_TYPES.length;
        used[type] = taken + 1;
        // The appearance index rides on the item so a paged card knows which page is its own, and
        // the key stays unique per appearance for React.
        return { kind: 'card', type, key: `${type}-${taken}`, occurrence: taken };
      }
    }
    // Nothing eligible, either because no type has data or because every type has been used as
    // often as it may be. The slot stays empty rather than rendering a shell.
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
