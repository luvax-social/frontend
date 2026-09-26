# Deferred Findings

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Defects and gaps found during verification that the merge did not cause, and process notes.
None of these were fixed, in keeping with the rule to fix what the merge broke and record the rest.

## Pre-existing behaviour, not caused by the merge

### The search people follow control does not show a pending request

On the search results people tab, the follow control reads only `isFollowing`.
A person to whom the viewer has a pending follow request shows "follow" rather than "requested".
The same person's own profile shows "requested" correctly.
This is lineage A's own search implementation: the search follow control was written to distinguish following from not-following, and the pending state was never wired into it.
The merge did not change this file's follow logic.
Recorded for a later pass; wiring the requested state into the search control would make it consistent with the profile.

Reference: `src/features/search/components/SearchScreen.jsx`, where the control is given `initiallyFollowing={item.viewerState?.isFollowing ?? false}` and nothing about the requested state.

### Two block confirmation dialogs with different arming behaviour

The block confirmation opened from a post's overflow menu is B's shared `ConfirmModal`, whose confirm button is inert for about half a second after it appears.
The block confirmation opened from a profile is A's separate `BlockConfirmDialog`, which has the same wording but no arming delay: its confirm button is only disabled while the request is in flight.
Both existed independently on their branches; A built its own block dialog before B built the shared armed one.
The merge kept A's profile screen, so the profile block keeps A's dialog.
No capability is lost, and the block wording is intact in both, but the arming delay is inconsistent between the two entry points.
Unifying the profile block onto `ConfirmModal` would resolve it, and is out of scope here because it is a change to working code that the merge did not break.

Reference: `src/features/luvax/components/BlockConfirmDialog.jsx` has no arming delay; `src/features/luvax/components/ConfirmModal.jsx` has a 500ms one.

### The desktop right rail is empty

Resolving the trending-rail conflict kept A's removal of the fabricated trending list.
On desktop this leaves the right rail empty.
The real trending endpoint is not wired, and re-filling the rail with invented data would be worse than leaving it empty, which is the reasoning recorded on A's side and in `conflict-resolutions.md`.
Wiring the real trending endpoint, or removing the empty rail column from the desktop layout, is the proper follow-up.
This is a judgement call and is called out so a reviewer can revisit it.

### The profile stat measurements were kept from A, not ported from B

The profile stat block kept A's measurements because A's block carries the private-account null-count and readable guards that B's does not, and it could not be confirmed which side's exact pixel and letter-spacing values are the design-export ones without guessing.
If B's stat measurements are the authoritative conformance values, porting them onto A's guarded block is a small follow-up.
This is the one place a Rule 3 styling port was deliberately not applied.

## Process notes

### Two early reconciliation commits carry a message body

The frontend commit rule requires a single-line commit subject with no body.
The two merge and catalogue commits made early in this task carry a body.
They were not amended, because this task forbids rewriting history in any form, and amending a commit is a history rewrite.
All later commits in the series are single-line.
The conflict between the single-line rule and the no-amend rule was resolved in favour of the absolute no-amend constraint, and is recorded here rather than silently left.

### Test-data changes made during verification

Verification drove real state changes against the seed data, which were left as found where it mattered and are listed here for transparency:

- The seed accounts `luvax_ava`, `luvax_ben` and `luvax_dan` had their passwords set to a known value through the forgot-password flow, so the application could be logged into. Their prior passwords were not recoverable.
- The viewer's account was made private to test follow requests, then restored to public.
- One of the viewer's two saved posts was removed while testing unsave and was not re-saved.
- A carousel post captioned "MERGE-PROBE" and a comment captioned "REALTIME-PROBE" were created as test fixtures; the comment was deleted during the delete test, the post remains.
- Comment and post like states on the "light is the medium" seed post were toggled during testing and returned to their prior values where they were checked.

None of these touch application code or the repositories; they are rows in the local development database.

## Left undone

- Search, saved and liked paging past the first page was not exercised, because the seed data does not fill a first page. See `re-verification.md`.
- A video inside a carousel, the post detail with the socket blocked, and the composer's per-file progress bars were not exercised, for the reasons in `re-verification.md`.
