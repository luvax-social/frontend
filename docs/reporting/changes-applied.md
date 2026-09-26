# Changes Applied

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change: what was missing, the evidence it was missing, what was built, and the file
touched.

All changes are in the frontend repository.
No file in the backend repository was modified.

## 1. No way to send a report to the server

**What was missing**

The frontend had no report service function.
`src/services/` held `notification`, `post`, `social`, and `user` services and nothing for reports.

**Evidence**

`grep -rn "report" src/` returned only three inert menu items and unrelated prose in comments.
No file referenced `/reports`.

**What was built**

A service exposing `submitReport`, the three target types this application uses, the eight reason
identifiers with their display copy, and the server's description limit as a named constant.

A blank description is omitted from the payload rather than sent as an empty string.

**File**

`src/services/report.service.js` (new)

## 2. No hook, and no way to tell one failure from another

**What was missing**

No mutation hook, and nothing that could distinguish a duplicate from a genuine error.

**Evidence**

The axios error normalizer at `src/api/axiosClient.js:264` overwrites `error.message` with a safe
message, and at line 267 overwrites `error.response.data.message` too.
Branching on message text would therefore be unreliable.
The `code` field is not touched by the normalizer.

**What was built**

A `useSubmitReport` mutation, a reader for the backend `code`, and a function turning a failure into
copy the reader can act on, with a distinct neutral case for the duplicate.

The hook holds no cache invalidation, because a regular user cannot read reports back and nothing on
any screen reflects that a report exists.

**File**

`src/features/luvax/hooks/useReports.js` (new)

## 3. No report modal

**What was missing**

The design export specifies a three-step report modal. Nothing in the application implemented it.

**Evidence**

`docs/reconnaissance/feature-gap-matrix.md` lines 86 to 89 record all three report capabilities as
`frontend-missing`, with "No service, no hook, no UI".
The design's `ReportModal` exists only inside the design bundle.

**What was built**

A single modal reused by all three target types, following the design's step sequence, structure,
and copy: a reason list, an optional details step, and a terminal step.

Departures from the design, both recorded in `report-contract.md` and `design-decisions.md`:

- the description limit is the server's 2000, not the design's 500
- a duplicate and a failed submission have states, which the design does not specify at all

**File**

`src/features/luvax/components/ReportModal.jsx` (new)

## 4. The post menu carried an inert report item

**What was missing**

The item existed and did nothing.

**Evidence**

`src/features/luvax/components/PostCard.jsx` listed a report item with `onClick: () => {}`.
The item was already correctly guarded by `!isOwner`.

**What was built**

The existing item now opens the modal for the post.
The `!isOwner` guard was left as it was, so the action stays absent on the viewer's own posts.

**File**

`src/features/luvax/components/PostCard.jsx` (modified)

## 5. The comment menu carried an inert report item

**What was missing**

The item existed and did nothing.

**Evidence**

`src/features/luvax/components/PostDetailScreen.jsx` listed a report item with `onClick: () => {}`
inside the branch taken when the comment is not the viewer's own.

**What was built**

The existing item now opens the modal for the comment.
It stays inside that branch, so it remains absent on the viewer's own comments, consistent with how
the like control was handled in the previous phase.

**File**

`src/features/luvax/components/PostDetailScreen.jsx` (modified)

## 6. The post detail screen had no report item at all

**What was missing**

The post menu on the post detail screen listed only Like, Share, and Copy link, so the same post
offered a report action in the feed but not when opened.

**Evidence**

The `menuItems` array in `PostDetailScreen` held three entries and no owner check.

**What was built**

A report item guarded by the screen's existing `isSelf`, so the action appears in the same place
with the same wording as in the feed, and never on the viewer's own post.

**File**

`src/features/luvax/components/PostDetailScreen.jsx` (modified)

## 7. The profile screen had no overflow menu

**What was missing**

No menu, so no place to put the report action.

**Evidence**

`grep -n "menu" src/features/luvax/components/ProfileScreen.jsx` returned nothing but an unrelated
line of text.
The header held a follow button and, for the viewer's own profile, an edit profile button.

The brief expected this action to join a block action in the same menu.
There is no such menu, and block lives in the post menu instead.

**What was built**

An overflow button beside the follow button, inside the existing `!isSelf` branch, opening a menu
whose only item is Report.

Because the button sits inside that branch, neither the menu nor the action can appear on the
viewer's own profile.

Block was not added; it is out of scope for this phase.

**File**

`src/features/luvax/components/ProfileScreen.jsx` (modified)

## Size

| Kind | Lines |
|------|-------|
| New files | 617 |
| Modified files | 117 added, 5 removed |
| Total | 734 |

Within the one thousand line target for code.

## What was found and deliberately left alone

Recorded in `deferred-findings.md`, not acted on:

- reports of targets the reporter cannot see are accepted by the backend
- the global query error logger reports an expected duplicate as a console error
- no modal in this application closes on Escape
- a stale compiled class in the backend build directory prevents a clean start
