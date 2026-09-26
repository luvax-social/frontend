# Deferred Findings

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found and deliberately not acted on, with the phase it belongs to.

## Deferred by the brief

These were named in the brief as record-and-take-no-action. Each is confirmed as still true.

| Finding | Belongs to |
|---------|-----------|
| Realtime anywhere other than the open post. The notification live tier is enabled on the server and has no frontend consumer | A later realtime phase |
| Messages, stories and onboarding as features | Feature phases of their own |
| A comment sort control | A comment phase |
| Reply pagination past the first fifty | A comment phase |
| The explore screen being a search for the letter `a` | An explore phase |
| Block confirmation in the post overflow menu | A social phase |
| The design system port and any pixel-perfect work | The design conformance phase |
| Escape-key dismissal for modals | The design conformance phase |
| The global query error handler logging expected outcomes as errors | A cleanup phase |
| Lint | A cleanup phase |

Two of these were observed directly during this phase rather than taken on trust.

**The global error handler.** Blocking a profile produced six console errors, four `404`s from the now-unreadable profile and two `[QueryClient]` lines logging those same `404`s as errors. The `404` is the expected, designed answer for a blocked profile, so logging it as an error is noise that will mask a real fault later.

**Explore is a search for `a`.** Confirmed at the API: `GET /posts/search?q=a&limit=10` returns zero rows, `degraded: false`. This is why the `trending today` label sits above an empty region. The label was left alone: fixing it without fixing the query would hide the symptom and make the real problem harder to find.

## Found in this phase and not acted on

### The blocked-list empty state is capitalised

`No blocked users`, where every sibling empty state in the application is lower case: `nothing saved yet.`, `this page doesn't exist`, `no comments yet.`, `no posts match "..."`.

Found while walking the block loop. Left alone because copy casing is design conformance, which this phase explicitly does not do.

**Belongs to** the design conformance phase.

### sockjs-client brings vulnerable transitive dependencies

`npm install @stomp/stompjs sockjs-client` reported 9 vulnerabilities, 7 of them high, in the resulting tree. `sockjs-client` is an older package with an older dependency set.

Not addressed because dependency remediation is not this phase, and because the dependency is not optional: the backend refuses a raw WebSocket upgrade, so SockJS is the only way to connect at all.

**Belongs to** a dependency maintenance phase. Worth pairing with a check of whether the backend could also register a plain WebSocket endpoint, which would remove the need for SockJS entirely and is a backend change.

### The reconnect backoff has no jitter

The backoff is deterministic: 1, 2, 4, 8, 16, capped at 30 seconds. With many clients reconnecting after a server restart they would retry in lockstep.

Not added because this is a single-user local build, and because deterministic timing is what made the backoff verifiable in the first place.

**Belongs to** whichever phase first runs this against a shared environment.

### The comment like echo suppression is heuristic

Recorded in full in `design-decisions.md` section 8. The frames carry no liker identity, so a viewer's own like can only be distinguished from someone else's by remembering that they just performed it. Two viewers liking the same comment in the same tick could have one movement swallowed. Any later refetch of the list corrects the count.

The clean fix is a backend change: carry either the liker id or an absolute count on `comment.liked.v1`, as `post.live.liked.v1` already carries an absolute count. The backend is read-only this phase.

**Belongs to** a backend phase, with a frontend simplification following it.

### An arriving comment appears immediately, with no affordance

Decided rather than overlooked; the reasoning is in `design-decisions.md` section 6. Because arrivals are appended, they cannot displace what the reader is looking at, so a "3 new comments" control would add state without solving a problem.

**Belongs to** whichever phase first has posts busy enough that the list moves quickly.

### Reply-thread live paths are implemented but under-verified

A reply arriving while its parent thread is expanded updates the cached replies query, and bumps the parent's reply count. Implemented and reviewed, but the browser verification was done on top-level comments.

**Belongs to** the next comment phase, or a verification pass.

## Documentation that is out of date

Found while working, not fixed, because these files belong to other phases and this phase does not restructure.

### The rules files name the submodules wrongly

`.claude/rules/STRUCT.md` and `WORKSPACE.md` at the workspace root call the two sub-projects `Luvax/` and `app-fe/`. On disk they are `backend/` and `frontend/`. `docs/reconnaissance/local-environment-runbook.md` already notes this discrepancy but the rules files themselves were never corrected.

### The runbook is wrong about the database being disposable

`local-environment-runbook.md` states that postgres has no named volume, so `docker compose down` discards the database and the accounts and seed data must be recreated. In this session the full stack was brought up from stopped containers and the data was intact: 35 users, 31 posts, and all four `luvax_*` accounts present and usable. No reseed was needed.

Worth correcting, because the current text tells the next person to redo work that is not necessary.

### The runbook's WebSocket check is thinner than it looks

The runbook verifies the live tier with `curl -s http://localhost:8080/ws/comments/info`. That returns `200` and a JSON body advertising `"websocket":true`, which reads like confirmation that a WebSocket client can connect. It is not: a raw WebSocket upgrade to the same path is refused `400`. Anyone using that check to decide how to build a client will build the wrong one.

**Belongs to** a documentation pass.
