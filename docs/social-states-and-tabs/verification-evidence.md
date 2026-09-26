# Verification Evidence

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Observed evidence, separated by how it was obtained.

Anything not verified is listed as not verified.
Nothing in this document is inferred.

## Environment

| | |
|---|---|
| Backend | `http://localhost:8080`, commit `42f6147`, running on the host |
| Frontend | `http://localhost:5173`, Vite dev server |
| Infrastructure | compose project `appphase0`: postgres, redis, rabbitmq, elasticsearch, mailpit |
| Browser | Chromium via Playwright |
| Accounts | `luvax_ava`, `luvax_ben`, `luvax_cleo` (private), `luvax_dan` |

### The seed had to be loaded first, and the runbook was out of date

The documented `luvax_*` seed set was not present.
The database held a different dataset: 307 accounts named `bulk_*` and `seed_*`, 205,017 posts, and 3 follow rows.
So the graph section 9 relies on, the pending request from Ava to Cleo, did not exist.

`docs/reconnaissance/seed-data.md` records that seeding is blocked because the mail provider rejects `example.com`, and prescribes a manual `UPDATE` against `user_credentials` to work around it.

**That blocker is stale.** It described the Resend transport.
The dev profile now uses SMTP against the Mailpit container in the compose project.

So the accounts were verified through the real contract instead:
the seed was run, the four verification emails were read from the Mailpit API, and each token was submitted to `GET /auth/verify-email`, which returned 200 four times.
The seed was then rerun and completed, exit 0.

No database write was needed.
This is worth recording because it preserves the property the seed script exists for: it proves the documented contract rather than reaching around it.

The seed could not attach media (`422 MEDIA_OBJECT_NOT_UPLOADED`, object storage credentials required), so all `luvax_*` posts are text only.
Profiles with real media were taken from the pre-existing bulk dataset.

## Verified in the browser

### Private account, non-follower with a pending request

`/app/u/{cleo}` as Ava.
Accessibility tree:

```
button "requested"
button "more options for @luvax_cleo"
generic: Luvax Cleo
generic: "@luvax_cleo"
generic: "-"  / posts
generic: "-"  / following
generic: "-"  / followers
generic: this account is private.
generic: your follow request is waiting to be approved. you will see their posts once it is.
```

Confirms at once:

- the follow control reads `requested`, driven by `viewerState.isFollowRequested` and not by having clicked
- the three null counts render as `-` rather than `0`
- the private notice is shown, with the pending wording rather than the "follow to see" wording
- no tabs and no grid are rendered, because every request behind them would 403

Console errors: **0**.

### Own profile, three tabs

`/app/profile` as Ava. Tabs rendered: `posts`, `photos`, `liked`.

Liked tab clicked, and it populated:

```
button "liked" [active]
generic: "[luvax-seed] morning, window, coffee #photography"
generic: "[luvax-seed] light is the medium, not the message #observation"
```

Two rows, matching the two likes the seed creates for Ava.
Confirms the liked tab reads `row.post` correctly out of the `{post, likedAt}` row shape.

### Another person's profile, two tabs

`/app/u/{seed_alice}`, an account with 5008 posts.
Tabs rendered: `posts`, `photos`. **No liked tab**, and no disabled third tab.

Confirms DoD 5.

### The photos tab sends the right request

Network log for the tab switch on that profile:

```
GET /api/v1/posts/user/0c3eaeeb-...?limit=10                        => 200
GET /api/v1/posts/user/0c3eaeeb-...?limit=10&type=image,carousel    => 200
```

The comma form is sent, not the bracket form axios would produce from an array.
The second request carries no cursor, so switching tabs started a fresh sequence.

Every API request made during the session returned 200. **No 400 from a replayed cursor.**

```
POST /api/v1/auth/refresh                     => 200
GET  /api/v1/social/follow-requests           => 200
GET  /api/v1/notifications/unread-count       => 200
GET  /api/v1/users/0c3eaeeb-...               => 200
GET  /api/v1/social/blocked?limit=20          => 200
GET  /api/v1/posts/user/0c3eaeeb-...?limit=10 => 200
GET  /api/v1/posts/user/...&type=image,carousel => 200
```

### Follow requests, seen and approved

`/app/notifications` as Cleo, `requests` tab:

```
button "requests" [active]
strong: Luvax Ava
text: requested to follow you
generic: 25m
button "accept"
button "decline"
```

`accept` clicked.
Ava's view of the relationship then re-read from the API with a fresh token:

| | before approval | after approval |
|---|---|---|
| `viewerState.isFollowing` | false | **true** |
| `viewerState.isFollowRequested` | true | **false** |
| counts | `null, null, null` | **1, 0, 0** |
| `GET /posts/user/{cleo}` | **403** | **200** |

Confirms DoD 11 and the requirement that approving updates the requester's view on their next load.

### The disabled navigation tab

```
button "chats are not part of this build" [disabled]
```

Rendered in the header navigation. Not focusable, not clickable.

### Console errors

Zero React render errors on every surface visited.

Four resource errors were observed on the bulk-data profile:

```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
  https://cdn.example.invalid/inv-img-1
  https://cdn.example.invalid/inv-img-2
  https://cdn.example.invalid/inv-vid-1
  https://cdn.example.invalid/inv-car-1
```

These are pre-existing seed rows whose media points at a deliberately unresolvable host.
They are network failures on `<img>` loads, not render errors, and they are not produced by any change in this phase.

## Verified against the API, not in the browser

These were exercised directly with `curl` against the running server.
They are real observations, but they are not browser-level evidence.

- The full `type` value set, the bracket-form rejection, and that the filter discriminates. See `endpoint-verification.md` section 1.
- Cursor binding: replaying a cursor under no filter, a superset, and a different filter all return `400 INVALID_CURSOR`; reordering the same set returns 200.
- The `degraded` flag, by stopping and restarting the Elasticsearch container. Post search flipped to `degraded=true` with zero rows and back to `degraded=false` with rows. Hashtag search, user search and feed stayed `false` throughout.
- The block loop: block returns 201, the blocked profile then answers 404, the blocked list carries the account, unblock returns 204, the profile answers 200 again, and the previously mutual follows are gone and not restored.
- Private account visibility: posts, followers and following all 403 to a non-follower.

## Not verified

Stated plainly rather than implied.

1. **The short-page case was not deliberately produced.**
   The fix is in place and reasoned from the endpoint's documented behaviour, and the defect it addresses was confirmed by reading the shipped code. It was not reproduced by making a liked post unavailable and observing the list continue paging. This is the weakest point in the evidence and the first thing to check next.

2. **The block loop was not walked in the browser.**
   Every step was confirmed at the API level, including the 404 that drove the design. The browser path from the profile overflow menu, through the confirmation dialog, to the blocked state and back via the blocked list was not exercised.

3. **The degraded search wording was not seen rendered.**
   The flag was verified at the API level with Elasticsearch stopped. The `SearchDegraded` state that consumes it was not observed in the browser.

4. **Pagination was not exercised past the first page in the browser.**
   The profile used had 5008 posts and the sentinel was in view, but a second page fetch was not captured in the network log.

5. **The explore, composer and onboarding screens were not re-opened after their fabricated data was removed.**
   They compile and the removed symbols have no remaining references, but the resulting layouts were not looked at.

6. **Failure states were not induced** beyond the Elasticsearch outage. The error branches were not observed by taking the backend down.

## The defect this phase found in already-shipped code

`SavedPostsScreen.jsx` treated a short page as the end of the list, exactly as section 6 predicted.

The infinite-scroll sentinel was rendered **only** inside the branch where at least one row exists:

```jsx
} else if (posts.length === 0) {
  body = notice('bookmark', 'nothing saved yet.', ...);
} else {
  body = (<>
    ...grid...
    <div ref={ref} />   {/* the sentinel, unreachable when the list is empty */}
  </>);
}
```

So an empty first page with `hasNextPage: true` did two wrong things at once.
It told the viewer they had saved nothing, which is a claim about their data that the response does not support.
And it never mounted the sentinel, so nothing could trigger the next fetch and the list stopped for good.

Both are fixed by `useDrainEmptyPages`, which drives the fetch from the accumulated row count rather than from a viewport sentinel, and by gating the empty state on the server's `hasNextPage` rather than on page length.
