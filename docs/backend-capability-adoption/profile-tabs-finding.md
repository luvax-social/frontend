# Profile Tabs

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Investigation only. Nothing was changed.

Two documents contradict each other on this and the question was asked so it can be settled with facts.

## What the screen actually renders

Three tabs. The list is hardcoded.

```jsx
// src/features/luvax/components/ProfileScreen.jsx:212
{['posts', 'photos', 'liked'].map(t => (
```

Confirmed in the browser on Ben's profile:

```
- button "posts"
- button "photos"
- button "liked"
```

## What backs each tab

Nothing backs two of them.

| Tab | Backed by | Behaviour |
|-----|-----------|-----------|
| `posts` | `GET /posts/user/{userId}` through `useUserPosts` | Renders the author's posts |
| `photos` | nothing | Selecting it renders the same posts as `posts` |
| `liked` | nothing | Selecting it renders the same posts as `posts` |

The selected tab is held in state at `ProfileScreen.jsx:21` and read in exactly two places, both cosmetic: the foreground colour at line 215 and the underline at line 218.

It never reaches a query, a filter, or the grid.

The grid at line 230 maps over `posts` unconditionally, whatever is selected.

Verified in the browser: selecting "photos" left the grid identical, still listing all three of Ben's posts including a text-only post that has no image at all.

So `photos` and `liked` are decorative. They move an underline and change nothing else.

No endpoint for either exists in the frontend. There is no call for a user's liked posts anywhere in the codebase, and no media-filtered variant of the user posts call.

## Which document is wrong

The reconnaissance documents are wrong. The later verification records are right.

| Document | Claim | Verdict |
|----------|-------|---------|
| `docs/reconnaissance/open-decisions.md:13` | "Already implemented. `ProfileScreen.jsx:12` has only `posts`" | **Wrong.** The array holds three entries and is at line 212 |
| `docs/reconnaissance/design-conformance-gaps.md:89` | Frontend has "`['posts']` only", cited to `ProfileScreen.jsx:12` | **Wrong.** Same array, same reason |
| `docs/reconnaissance/demo-readiness.md:247` | "the frontend already" matches the settled decision | **Wrong**, following from the same two |
| `docs/reporting/verification-evidence.md:121` | Buttons present: `["luvax", "edit profile", "posts", "photos", "liked"]` | **Right** |
| `docs/response-shape-and-session/verification-evidence.md:229` | `[posts] [photos] [liked]` | **Right** |

The two wrong claims share a line reference, `ProfileScreen.jsx:12`, that does not point at the tab list and probably never did. The reports that looked at the running screen rather than at a line number got it right.

Per the instruction not to edit earlier reports, none of those files was changed. The correction lives here.

## What is left to decide

The settled decision was posts only. The screen does not implement it.

Two options, and this phase deliberately takes neither:

1. **Drop the two tabs.** Matches the settled decision and removes two controls that do nothing. Smallest change; the tab state becomes unnecessary along with them.
2. **Implement them.** `photos` could filter the existing response by media presence with no new endpoint. `liked` has no endpoint at all and would need backend work, since no route exposes another user's liked posts.

Nothing else in the frontend depends on the tab state, so either is self-contained.
