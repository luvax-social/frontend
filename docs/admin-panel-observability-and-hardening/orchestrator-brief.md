# Orchestrator Brief — Observability and Hardening

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

For the planner. Under two pages. No codebase access assumed.

**The panel is finished.** Fifteen screens, both roles, all 51 checks in section 15 of the backend
handoff walked and recorded: 44 pass, 5 fixed, 2 explained. Every deferred item from all four phases
is now in one of two documents.

---

## What was built

**Statistics** (administrator only). The stored snapshot, labelled as of its collection time and
never as live, plus a series chart for any of the fourteen metrics over a bounded window. The chart
is inline SVG built from the existing colour tokens; **no charting library was added**, and no
dependency of any kind.

**Activity log** (administrator only). What one account, or every account, has been doing. Both ends
of the time window are mandatory, so the screen issues nothing at all until it has them.

**Sessions and reports-against.** The account detail's last two counts expanded into real lists.

**Seven hardening fixes** across all four phases, described below.

---

## Architectural decisions, and what was rejected

| Decision | Rejected alternative | Why |
|---|---|---|
| The chart's x axis is **time**, not the index of a point | An index axis, which is simpler | On an index axis a missing measurement is invisible: the points either side sit adjacent, and the chart silently claims the series continued. On a time axis the absence leaves a visible blank that can be marked |
| The chart is sized from a **measured container** via a resize observer | A fixed coordinate system scaled with CSS | Scaling the drawing scales the type with it; at a phone width the axis labels would render at about four pixels. Measuring lets the plot shrink while the type stays legible |
| **At most seven series are drawn**, and the rest are named | Cycling the palette | Cycling gives two dimensions the same colour, which makes the chart ambiguous. Naming what was not drawn is honest; a silent top-N reads as "this is everything" |
| Range controls **fire on commit**, never on change | Firing on change, the usual React shape | These two endpoints allow twenty requests a minute in production. A control wired to `onChange` issues a request per intermediate value and exhausts that in seconds. Verified: 17 drags and edits produced **zero** requests |
| The event-type filter offers **three** options | Generating twenty from the API document | Seventeen have no writer anywhere. Offering them presents filters that can never match — the same mistake this project already settled on the report queue |
| **No per-session revoke control is drawn** | Drawing one and disabling it | No such endpoint exists. A control that cannot work is not worth drawing; the account-wide action is offered instead, named for what it does |
| The pre-collection state shows **no figures at all** | Showing the payload's zeros | Those zeros are placeholders for absent rows. Rendering them asserts the platform has no accounts, which is false |

---

## Contract divergences found

Every one was checked against the running server; the server was taken as authoritative.

1. **Two limits are conflated in the handoff and in this phase's own prompt.** The window a series
   may span is **one year**. The **thirty-day** figure is the horizon past which fine buckets no
   longer exist, applied to the window's *start* against the present moment. A one-hour window
   starting thirty-one days ago is refused at fine granularity; a year-long window starting today is
   accepted. They drive different controls.
2. **The rate limits are tighter than stated.** The prompt says thirty per minute for both new
   endpoints. Production is **twenty**. Built to twenty.
3. **A granularity is refused, not forced.** The handoff says an out-of-range window forces daily.
   The server *refuses* an explicit fine granularity and resolves to daily only when none was asked
   for. The control prevents the refused combination, so no 400 ever reaches a reviewer — verified
   at the network level.
4. **The time to a first statistics bucket is up to an hour, not thirty minutes.** The interval is
   thirty minutes *and* the partial starting bucket is discarded. The screen says within an hour,
   because a reviewer who waits thirty minutes and sees nothing concludes the job is broken.
5. **The written-event-type claim is more complicated than documented.** Three types have an
   unconditional writer, as documented. A **second writer exists in the source** for four engagement
   types, enabled in both profiles — undocumented. It was tested rather than argued about: the event
   was published, consumed, and **dead-lettered without writing a row**, because it depends on a
   service that is not deployed. The filter offers three; the question is raised with the backend.
6. **There is no per-session read and no per-session revoke.** The prompt asks for both. The whole
   backend source was searched; the only revocation ends every session at once, verified live
   (three sessions to zero).
7. **A third state exists that the prompt's framing misses.** It asks whether an empty window returns
   an empty array or zero-valued buckets. Both occur, *and* a bucket can be absent from the middle of
   a returned series. Three states, rendered three ways.

---

## The settings-defect diagnosis

Reproduced end to end in the browser and at the API level across three accounts.

**The cause is in the backend, not the frontend.** The frontend requests exactly the path the
backend publishes, with the matching method and prefix. The read answers not-found when an account
has no settings record — and exactly the five seed accounts have none: 165 of 170 accounts have one,
and the five that do not are precisely those the seed script creates.

Per the phase constraint, nothing was changed. It is item 6 of the backend request. (The backend
repository carries an unmerged branch whose name suggests this is already known there; the item is
recorded anyway so it is not lost.)

---

## What the sweep found and fixed

Five of the 51 checks failed on the first walk. All five were fixed and re-verified:

1. A range clamped to the module's 365-day constant instead of its own endpoint's limit, so the
   activity log's 30-day bound was not enforced and an over-wide window reached the server as a 400.
2. The clamp then applied **silently** — the note explaining it was cleared in the same tick it was
   written.
3. A third warning said a strike was applied but did not say the account had been **suspended**.
4. Revoking a strike implied the account had been **restored**; it had not.
5. The warn control rendered on targets that **cannot be warned**.

Two more were found outside the 51: an indefinite suspension rendered as nothing, so a suspended
account read as unsuspended; and the hashtag ban confirmation omitted that **no existing post comes
down**, which is the exact misreading the handoff warns about.

---

## What remains unresolved, and where it is written

**`docs/admin-panel/backend-request.md`** — ten grouped items needing the backend, gathered from all
four phases. The three that matter most: a reported story or message cannot be actioned at all; a
revoked warning or strike vanishes instead of staying visible and marked; an account's active warning
count cannot be read before a warning is issued.

**`deferred-findings.md`** — the frontend remainder: the cross-feature imports still awaiting a phase
permitted to move files, a nested-Escape refinement, the condition under which the event filter should
widen, and the fixture state this phase leaves behind.

Nothing unresolved exists anywhere else.

---

## What could not be verified

**One item.** Section 15's check that an administrator sees no controls when viewing **another
administrator**. This deployment has one administrator, and creating a second is irreversible — no
API path demotes an administrator — so doing it would have permanently consumed the only moderator
account and disabled the rest of the sweep. The mechanism was verified two other ways: from the
server source, where the protected-target branch fires on the target's role regardless of actor; and
in the browser through the self-target case, which reaches the same all-false capabilities and
renders no controls. It is recorded as the one check to re-run in an environment with two
administrators.

Everything else was verified by driving the real interface against the real server, in two
simultaneous browser contexts, with the console and network captured throughout: zero console errors,
zero 403 responses, and zero failed requests across both role trees.
