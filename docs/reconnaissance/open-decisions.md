# Open Decisions

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

Decisions a human has to make, derived from what the audit actually found.

Settled decisions are recorded first, with a note where the backend changes the picture.

## Settled decisions

| Topic | Decision | Status against the backend |
|-------|----------|---------------------------|
| Realtime | Limited to like count and new comments on the currently open post, only if a transport already exists | **Half workable.** A STOMP transport exists and is enabled. New comments and comment like changes are broadcast. **Post like count is not broadcast on any topic.** See O1 |
| Icons | Port `LxIcon`, remove `lucide-react` | **Mostly already done.** `LxIcon` exists in the frontend with an identical signature. `lucide-react` has zero imports and is a one-line `package.json` removal. See O2 for the glyph reconciliation |
| Profile tabs | Posts only; drop `photos` and `liked` | **Already implemented.** `ProfileScreen.jsx:12` has only `posts` |
| Followers and following screens | Build as dedicated screens, derived | **Already exist** as `FollowersScreen.jsx` and `FollowingScreen.jsx`, both live against the API. Neither is in the design export, so both need the derived label |
| Block, private account, follow request UI | Derive from existing tokens and patterns, label as derived | Backend supports all three fully. The blocked list has a correctness problem, see D4 |
| Bottom navigation | All six tabs visible, out-of-scope tabs disabled | **Constrained by the design.** `LxBtn`'s `disabled` state restyles only the `primary` variant, and `LxBottomNav` items are raw buttons with no disabled treatment at all. The disabled appearance is undesigned and must be derived |
| Loading, empty, error states | Derived from tokens, not a pixel-perfect violation | Confirmed necessary. The export defines none |
| Design conformance target | Pixel-perfect for everything the export defines | Achievable. The token layer is already 100% conformant; the gaps are component measurements, listed in `design-conformance-gaps.md` |
| Theme | Light by default, following `prefers-color-scheme`, no manual toggle | **Needs wiring that does not exist.** The export keys dark off `html[data-theme="dark"]`, an explicit attribute, and provides nothing that sets it from the media query. Also note `SettingsScreen.jsx:88` currently writes `localStorage.setItem('lxDarkManual', '1')`, which is a manual toggle |
| Backend | Read-only for the whole project | Honoured. No backend file was modified |
| Auth and landing pages | Frozen | Honoured, but see O3: login is broken inside the frozen area |

## O1. Realtime is only half available

**The decision as written is not fully deliverable.**

What exists, runtime-verified:

- STOMP over SockJS at `/ws/comments` and `/ws/notifications`.
- `401` without a token, `101 Switching Protocols` with `?token=<accessToken>`.
- Topic `/topic/comments.{postId}.events`.
- Event types `comment.created.v1`, `comment.edited.v1`, `comment.deleted.v1`,
  `comment.liked.v1`, `comment.unliked.v1`.
- Per-subscriber block filtering on the outbound channel.

What does not exist:

- **No post like event on any topic.** The comment topic carries comment events only. There is no
  post topic.
- The broadcast payload `CommentBroadcastResponse` deliberately omits `isLiked` and `pinned`,
  because one blob is shared by all subscribers. Those keys are absent, not false.

Options:

1. Take the half that works. Live new comments and live comment like counts on the open post; the
   post's own like count refreshes on refetch or navigation.
2. Poll the post detail endpoint on an interval for the post like count, alongside the socket for
   comments.
3. Drop realtime entirely, as the decision allows.

**Recommendation: option 1.** The comment stream is the part a viewer actually notices on an open
post, the transport is already built and authenticated, and the block filtering is already correct.
Polling for one integer would add a second mechanism for the least visible half of the feature.
Note that when a comment event arrives the client must resolve `isLiked` itself from its own
state, since the frame does not carry it.

## O2. The N+1 concern the audit was asked to quantify does not exist

The premise was that if viewer state is absent from the response DTOs, the frontend would need
either an N+1 fan-out or a client cache that is wrong on first load.

**Measured result: viewer state is present on every relevant DTO.**

| Response | Viewer fields | Verified |
|----------|--------------|----------|
| `PostResponse`, `FeedPostResponse` | `isLiked`, `isSaved` | runtime |
| `CommentResponse` | `isLiked` | runtime |
| `PublicUserProfileResponse` | `viewerState{isFollowing, isFollowRequested, isFollowedBy, isBlocking}` | runtime |
| `UserListItemResponse` (likers, followers, following, blocked, user search) | same `viewerState` | runtime |

Request count for a feed page of twenty posts:

| Capability | Endpoints required per item | Requests for 20 posts |
|-----------|----------------------------|----------------------|
| Post liked state | none, `isLiked` is on the item | 0 |
| Post saved state | none, `isSaved` is on the item | 0 |
| Author follow state | none for the feed; a feed post carries only `UserSummaryResponse`, and the feed is by definition of followed authors | 0 |
| **Total** | | **1 request for the page, 0 additional** |

For a profile the same holds: one `GET /users/{id}` carries `viewerState`, so the follow button
renders correctly on first paint with no extra call.

The three genuinely absent pieces of viewer state:

| Missing | Consequence | Requests to work around |
|---------|-------------|------------------------|
| "Have I reported this" | A report control cannot be pre-disabled. `GET /reports` is 403 for a regular user, so there is no endpoint to ask | Not obtainable at any cost |
| `isLiked` on a WebSocket comment frame | A live-arriving comment cannot show the viewer's like state | 0, resolve from local state |
| "Has this user blocked me" | Deliberately withheld by the stealth block model | Not obtainable, by design |

**Recommendation: no mitigation is needed, and no client-side viewer-state cache should be built.**
Read `isLiked`, `isSaved`, and `viewerState` straight from the response and let TanStack Query own
them. The one thing to avoid is the pattern already present in `useSocial.js`, which shadows
server-owned block state in `localStorage`; that is the failure mode the concern was worried about,
and it is currently self-inflicted rather than forced by the backend.

For the report control, the only honest options are to let a duplicate return `409 REPORT_DUPLICATE`
and show a friendly message, or to remember submissions in session state and accept that a reload
forgets. **Recommendation: handle the 409**, since it is authoritative and the design's
`ReportModal` already has an `onSubmitted` callback for the optimistic case.

## O3. Login is broken inside a frozen area

`src/api/authApi.js` posts `{ email, password }`; the backend requires `{ identifier, password }`.
Verified in a browser and with `curl`: the UI login returns 400 and no session can be established.
Details in `defects.md` D1.

The login page is frozen and must not be modified.
The freeze and a working demo are therefore in direct conflict.

Options:

1. Grant a narrow exception: change the posted key to `identifier` in `authApi.js`. One field name,
   no visual change, no change to the form or the layout.
2. Change the Zod schema and the form field name to `identifier` as well, for internal consistency.
   Touches three files inside the frozen slice.
3. Leave it. The demo is then given by driving the API directly, which is not a demo.

**Recommendation: option 1.** The freeze is plainly about the visual design of the auth pages, and
option 1 changes one string in the transport layer with no visual consequence. Option 2 is tidier
but spreads the exception across the schema and the component for no user-visible gain. This needs
an explicit decision because it is a written constraint, not an oversight.

## O4. `Luvax.html` lives on one machine and is in no repository

The pixel-perfect conformance target is defined by a file at
`C:\Users\minhg\OneDrive\Desktop\Luvax.html`.
It is not in the frontend repository, not in the backend repository, and not in either git history.

If that machine is lost, the acceptance criterion for every UI task in the project becomes
unverifiable.

Options:

1. Commit `Luvax.html` to the frontend repository. About 1 MB, mostly base64 fonts and images.
2. Commit only the extracted source chunks and the token CSS, roughly 250 KB of readable
   JavaScript, and keep the bundle elsewhere.
3. Store the bundle in shared storage and reference it from the documentation.

**Recommendation: option 1.** A megabyte is nothing against the cost of losing the only definition
of "correct" for the entire design conformance target, and a single self-contained file is the
artefact people will actually open. Option 2 loses the fonts, which are part of the specification.

## O5. Whether to keep pretending stories and messages have no backend

Both modules are **implemented on the backend** and verified responding:
`GET /stories/feed` returns 200 and `GET /conversations` returns 200.
The frontend renders hardcoded mock arrays on both screens.

The settled decision renders out-of-scope tabs disabled.
That is a reasonable call, but it was probably made on the assumption those backends did not exist.

Options:

1. Keep them disabled as decided. Cheapest, and the scope holds.
2. Wire the read path only, so the tabs show real, empty state instead of fabricated conversations.
3. Build them. Out of scope.

**Recommendation: option 1, with one change.** Keep the tabs disabled, but delete or clearly mark
`mockThreads.js` and the `STORIES` array. Fabricated conversations from named strangers rendering
in a demo is a worse look than a disabled tab, and someone will click through to them by accident.
Flagging this because the decision's premise was incomplete, not to reopen the scope.

## O6. The `pinned` comment flag has no design and no plan

The backend returns `pinned: true` on up to three comments on the first page of a post's comment
list, selected by like count, and excludes them from the chronological remainder.

Neither the design export nor the frontend has any treatment for it.
Without one, the first three comments appear in an order the user cannot explain and that changes
as likes arrive.

Options:

1. Render a visual distinction for pinned comments, derived from tokens. A label such as "top
   comment", or a subtle surface change.
2. Ignore the flag. Comments then appear out of chronological order with no explanation.
3. Merge and re-sort client-side into pure chronological order. Fights the backend, and breaks
   pagination because the pinned ids are excluded from the keyset stream.

**Recommendation: option 1.** It is a small derived treatment and the alternative is a list whose
order looks like a bug. Option 3 is actively wrong: page two is a pure keyset stream that assumes
the pinned block was displayed separately.

## O7. Deep linking and browser navigation

The entire authenticated application is one route, `/app`, with the current screen in `useState`.
There are no URLs for a post, a profile, or a search result; the back button exits the application;
a refresh returns to the feed.

This was not raised as a decision, but it determines whether a live walkthrough survives an
accidental refresh, and whether the lead can be sent a link.

Options:

1. Leave it. Accept that the demo is a single uninterrupted session.
2. Add real routes for the in-scope screens: feed, explore, post detail, profile, search,
   followers, following, blocked.
3. Add routes only for post detail and profile, the two things worth linking to.

**Recommendation: option 2 for the in-scope set.** The screens and their parameters already exist;
what is missing is the router configuration and reading parameters from the URL instead of from
component state. It is not a rewrite. Raising it because it is invisible until it fails, and it
fails in front of an audience.

## O8. Whether the seed script's manual database step is acceptable

The seed script creates everything through the HTTP API, as required.
It cannot create a usable account, because login requires a verified email, verification requires a
token delivered by email, and the local mail provider rejects the seed domain.

The script stops and reports this rather than writing to the database.
A human then runs one SQL statement and reruns the script, which then completes.

Options:

1. Keep it as is: one documented manual step, and the script stays honest about being API-only.
2. Let the script run the SQL itself when it detects the condition. It then writes to the database
   and stops being executable proof of the contract.
3. Use a real deliverable email domain and verify each account by hand through the inbox. Correct,
   and unusable for four accounts on every fresh environment.

**Recommendation: option 1.** The value of the script is that it fails when the documented contract
is wrong. A script that reaches into the database to paper over a gap no longer proves anything.
The manual step is one command and is documented in `seed-data.md` and the runbook.

Worth noting separately: this also means **no new user can complete signup in a local environment
through the product itself.** That is a bigger problem than the seed script, and it is not solvable
on the frontend.
