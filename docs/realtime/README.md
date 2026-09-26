# Realtime, and the Verification Gaps That Came First

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Two pieces of work: closing the open browser-verification gaps left by the previous phase, then building the frontend's first WebSocket client.

## Branch

`feat/comment/realtime-and-verification-gaps`.

Cut from `feat/social/profile-tabs-and-social-states`, **not** from `develop`, because the previous phase's branch has not been merged. It was 13 commits ahead of `develop` when this phase started.

## What changed, in plain language

### The verification gaps

The previous phase built six things it never watched work. Five were closed here by actually doing them in a browser, not by re-reading the code.

The short-page case had never been reproduced. It was reproduced deliberately, in its strongest form: both the liked and saved lists were driven to return an **empty** first page while the server still reported another page existed. Both lists kept paging and rendered every row. The empty state was then confirmed to appear only when the server genuinely says there is no next page.

The block loop was walked end to end for the first time: profile, overflow menu, confirmation dialog, block, the blocked screen, the feed losing the blocked account's post, the blocked list, unblock, and the profile becoming readable again. The dialog's least obvious promise, that unblocking restores access but not the follows, was confirmed on screen.

The degraded search wording was seen rendered, with Elasticsearch stopped, and is clearly distinguishable from a genuine empty result.

A second page fetch was captured in the browser network log on both the profile posts grid and the photos tab. The photos tab needed image posts, which the database did not have; thirteen were created through the documented pre-signed upload flow.

Explore, the composer and onboarding were opened. Two of them had layout stranded where removed fabricated data used to be, and both were fixed.

### The realtime client

The contract was established from frames captured off the running server before any client code was written. That turned up several things that a description would not have:

- **SockJS is mandatory.** A raw WebSocket upgrade is refused. A client built on `@stomp/stompjs` alone cannot connect.
- **Comment like events carry no count and no liker identity.** The client has to move the count itself, and has to recognise the echo of the viewer's own like or count it twice.
- **Post like events carry an absolute count**, not a delta, which makes them self-healing.
- **Block filtering is enforced per subscriber at delivery time**, including for a viewer who was already subscribed when the block happened.

The client itself is one shared connection, reference counted, opening when the first subscriber arrives and closing when the last leaves. Only the post the viewer has open subscribes. Live events are written into the TanStack Query cache, never into component state. Arriving comments are appended so the server's pinned block is never disturbed and nothing moves under the reader.

Two defects in this phase's own reconnect logic were found by running the degradation exercise rather than by reading it: the backoff did not back off, and the first fix for that reconnected exactly once and then gave up silently. Both are described in `changes-applied.md` entry 8.

## Commits

Code and documentation are kept in separate commits.

| Commit | |
|--------|---|
| `94ca9ea` | `fix(post): drop layout left stranded by removed fabricated data` |
| `374441d` | `docs(common): record the closed verification gaps` |
| `be1a42b` | `docs(common): record the verified realtime contract` |
| `9ab4911` | `chore(common): add stomp and sockjs client dependencies` |
| `45cee47` | `feat(comment): add a shared stomp connection` |
| `51ee74f` | `feat(comment): apply live events to the open post` |

`374441d` landed before any realtime code, as required.

## The documents

| File | What is in it |
|------|---------------|
| `verification-gaps-closed.md` | The five gap exercises, with observed evidence and the defects they turned up |
| `realtime-contract.md` | Transport, authentication, topics and payloads, with the captured frames |
| `changes-applied.md` | One entry per change: what was wrong, the evidence, what changed, the file |
| `design-decisions.md` | Decisions with reasoning and what was rejected |
| `verification-evidence.md` | Browser evidence, API evidence, and what was not verified |
| `deferred-findings.md` | Everything found and deliberately not acted on |

## What was not verified

Kept as its own section because it is more useful than a document implying everything was checked. The full list is in `verification-evidence.md`; the ones that matter most:

- Natural token expiry mid-connection was not waited out. Revocation was exercised by logging out, which produced the documented `1008` close.
- Sign-out was confirmed to leave no live socket, but the mechanism was not isolated: sign-out performs a full page load, which would achieve the same thing on its own.
- Propagation was verified between one browser and API calls made as other accounts, not between two separate browser profiles.

## The backend was not modified

Required check. `git status` in the backend repository:

```
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile

```

`HEAD` is `42f6147`, unchanged throughout.

The staged `Makefile` is **pre-existing and not from this phase**. It was already staged when this work began, and its modification time is `2026-08-10`, three days before this session. It was left exactly as found, since removing or committing it would itself be a change to a repository this phase treats as read-only.

No file under `backend/` was created, modified or deleted here. Where the work needed the backend to behave differently, for the degradation test, that was done by restarting it with command-line properties (`--app.comment.live.enabled=false --app.post.live.enabled=false`) rather than by editing configuration.

## Running it

Nothing changed about how the applications start; `docs/reconnaissance/local-environment-runbook.md` still applies, with two corrections recorded in `deferred-findings.md`.

The live tier needs `app.comment.live.enabled` and `app.post.live.enabled`, both `true` in the dev profile. With either off, the post detail screen behaves exactly as it did before this phase, which is verified rather than assumed.
