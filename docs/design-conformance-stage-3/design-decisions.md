# Design Decisions

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision taken in this stage, with its reasoning and what was rejected.
Derived treatments are labelled as such.

## Where the like state lives

**Decision: the query cache, patched in the mutation lifecycle.**

The alternative considered was lifting the state into a shared context or a Zustand slice.
It was rejected because the frontend rules make TanStack Query the owner of anything that originates from the backend, and duplicating server state into Zustand is called out explicitly as something not to do.
The post already round-trips through the query cache; the like is a property of that post, not a separate client concern.

The pattern was copied from `useToggleCommentLike`, which already did this correctly in the same file.
Copying an existing correct pattern was preferred over inventing a second one, so the file now has one idiom rather than two.

**The snapshot is captured, not re-derived.**
`patchCachedPost` returns a closure over the exact entries it read, so a rollback restores what was there when the mutation started.
Re-reading the cache at rollback time would let a second interaction's value be reinstated by the first interaction's failure.

**The burst animation stayed local.**
`heartBurst` and `saveBurst` are presentation, not server state.
Moving them into the cache would have made a visual flourish part of the data model.

## The absolute count from the realtime channel

**Decision: nothing was built.**

The brief asks that the realtime event's absolute count not fight the optimistic update.
There is no realtime consumer in this frontend at all, so no such event arrives.

Writing a reconciliation for a message that never comes would be code with no observable behaviour and no way to verify it.
The finding is recorded in `stale-findings.md` and the work is carried to `deferred-findings.md`.

**The server's own count is still honoured.**
Where the like endpoint returns a count in its response body, `onSuccess` applies it through the same cache patch, so it reaches both renderings rather than only the one that fired.

## ConfirmModal shape

**Decision: keep the design's `config` object, and let `message` be a node.**

The design passes a plain string.
The confirmations being migrated carry a bolded name and, in the block case, an inline failure notice.

The alternatives were to drop the emphasis and the failure notice, or to give the primitive extra named slots.
Dropping them would have changed copy the brief says must survive.
Extra slots would have made the primitive carry knowledge of its call sites.
Accepting a node does neither.

**Derived: `maxWidth: '100%'`.**
The design fixes the panel at 340 pixels, which overflows a 360-pixel phone once the 16-pixel padding is counted.
Derived from the existing pattern of pairing a fixed width with a viewport cap, which the report modal already uses.

**Derived: `role="dialog"`, `aria-modal`, `aria-label`.**
The design has none.
The report modal in this codebase already carries them, so this follows the frontend's own established treatment rather than inventing one.

**Derived: `confirmDisabled`.**
Needed so a pending block or delete can hold the button, which the modals being replaced already did.

## Gating the menu's block

**Decision: confirm, using the wording that already existed.**

New wording was rejected.
The block copy was written in an earlier phase against the backend's actual behaviour, and the brief requires it survive.
Using the same string in both places means one irreversible action reads identically wherever it is reached, which was the point of the divergence being raised.

## Escape at the primitive level

**Decision: one hook, applied inside `LxModal` and `LxBottomSheet` rather than at each call site.**

Applying it per call site was rejected: it would have to be repeated at every existing overlay and remembered at every future one, which is how the inconsistency being fixed arose in the first place.

**The dropdown was left alone.**
It already registers its own `window` listener for Escape.
Adding the hook as well would mean two handlers for one key on one surface.
The brief says not to break it, and the safest way not to break it was not to touch it.

**Derived: `document` rather than `window` for the new hook.**
No behavioural difference for this purpose; `document` was chosen so the two mechanisms are distinguishable when debugging.

## Video pause on scroll

**Decision: pause on leaving the viewport, do not resume on returning.**

Resuming was rejected.
The reader scrolled away from a video that was playing; scrolling back is not a request to start it again, and audio restarting unasked is worse than silence.

**Derived: a 0.25 intersection threshold.**
The design defines nothing here.
A threshold of 0 would keep a video playing while a single pixel remained on screen, which is not meaningfully in view.
A quarter visible is the point at which the card is still legibly present.

## The photos tab

**Decision: filter server-side, and map `photos` to `image,carousel`.**

The design's tabs do not filter.
Matching the design would mean shipping three controls that all do the same thing, which the brief rules out as worse than diverging, and which is the state this stage found.

Client-side filtering of a fetched page was rejected: it would show fewer items than a page holds and get worse as the profile grows, because the page boundary would be applied before the filter.

**Deriving `image,carousel` rather than `image`.**
A carousel of photographs is what most people mean by photos, and this application can now create them, so excluding carousels would hide most of the picture posts on a typical profile.
The cost is that a carousel containing a video also appears under photos.
That was judged the smaller error than hiding photo carousels entirely.

**The liked tab's row shape.**
`/posts/liked` returns `{ likedAt, post }`.
The post is lifted out at the flattening step rather than teaching the grid a second shape, so the grid keeps one contract.

## What was not decided

The following required decisions and were not reached, because the work was not done:

- Which actions get a toast, and the rule separating them from actions whose result is already visible.
- The notifications grouping boundary for items older than a week, which the design does not define.
- Whether the explore topic control is wired to a real filter or removed.
- The wording of the explore trending empty state.
- The capitalisation rule per surface, which `stale-findings.md` shows cannot simply be taken from the audit.

These are carried to `deferred-findings.md`.
