# Deferred Findings

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found and deliberately not acted on, plus the parts of this stage's own brief that were not completed.

## Work items from this brief that were not done

These are not optional extras.
They are part of the stage as specified and remain open.

| Item | Brief section | What it still needs |
|------|---------------|---------------------|
| Toast mechanism | 5.2 | The host and component from chunk `9bffeb59` lines 13-24, then a decision per action against the rule that a toast only speaks where the result is not already visible |
| Post detail two-pane layout | 6.1 | The desktop two-pane geometry, caption typography, entry animation, and around twenty values. This is also what resolves the media scrolling away with the comments |
| Notifications | 6.2 | Date grouping into `today` and `this week`, a third group derived for older items, and the per-type icon and colour maps that already exist but are ignored by the row |
| Explore | 6.3 | Uncapping people from `.slice(0, 1)`, making the search field a form, resolving the dead topic control, and two empty states including the deliberate one for the trending grid |
| Settings | 6.4 | The remaining measured values |
| Report modal | 6.5 | Two keyframes, the 2.2 stroke, the dead counter threshold, and one string |
| Copy capitalisation | 7.1 | Re-deriving the rule from the design, since `stale-findings.md` shows the audit's version is contradicted by the design's own `ConfirmModal` |

The exact design values for each were not transcribed here, because the brief requires every value be re-read from the design source at the time it is applied rather than copied from a document.
The extraction procedure is in `docs/design/README.md`.

## The frontend has no realtime consumer

The backend publishes post like events to a `post.live.events` fanout exchange, and comment and notification events to their own live tiers.
No frontend code subscribes to any of them.

Two consequences:

- The absolute-count reconciliation the brief asks about has nothing to reconcile.
- Two separate browser windows cannot agree on a like without a refetch, because there is no channel between them.

**Belongs to:** a phase that connects the frontend to the live tier.
That phase inherits the absolute-count question, and the cache patch built here is where it would land.

## Post detail's like state was wrong, not merely stale

Recorded in `stale-findings.md` and fixed here, but worth carrying forward as a class of defect: `liked` and `saved` were `useState(false)` with no synchronisation from the server at all, while the count beside them was synchronised.

Any other screen seeding interaction state from `useState` rather than from query data will have the same fault.
No audit of the remaining screens for this pattern was carried out.

**Belongs to:** a sweep for the same pattern elsewhere.

## Escape coverage is structural, not observed

The hook is applied inside `LxModal` and `LxBottomSheet`, so every call site inherits it.
Each call site was not opened and dismissed individually.

**Belongs to:** the verification pass for whichever phase next touches those surfaces.

## The `photos` filter includes carousels that contain video

`type=image,carousel` cannot distinguish a carousel of photographs from a carousel that mixes in a video, because the type is a property of the post rather than of its items.

A carousel containing one video therefore appears under `photos`.
Judged the smaller error than excluding photo carousels entirely, but it is an error.

**Belongs to:** a backend filter that can express item composition, if this ever matters enough.

## Explore trending renders nothing in this environment

Confirmed as still true at planning time, though not acted on.
The grid ranks from a table populated by a background process in the recommendation module, which is still being built.

This is not a frontend defect and must not be papered over with fabricated content.
It does currently render blank space, which is the part that needs fixing.

**Belongs to:** section 6.3, above.

## The story composer still hardcodes a duration limit

Carried forward from the composer rework.
`StoryScreens.jsx` reads `max 60s` rather than reading the value from the server.

Explicitly out of scope for this stage as well.

**Belongs to:** a stories phase.

## Declared out of scope by this brief

Recorded, no action taken.

- Building messages, stories, or onboarding.
- Poster frames for video.
- Rendering a blurhash. None is produced.
- Tablet.
- Lint.
