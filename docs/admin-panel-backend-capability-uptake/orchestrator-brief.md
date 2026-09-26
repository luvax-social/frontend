# Orchestrator Brief — Backend Capability Uptake

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

For the planner. Nothing here needs the codebase or a running application.

---

## What this phase did

The backend answered the panel's request. Eight endpoints are new, four payloads extended, one field
renamed with its meaning changed. The panel took all of it up and **deleted the five workarounds it
replaces**. Nine feature commits on `feat/admin/backend-capability-uptake`.

**Taken up:** story and message removal/restore; per-session revocation; the caller's-own-session
lookup; batch identifier resolution; a moderator's own escalations; the active warning count; revoked
violations; the audit log's target and time filters; media on post rows; indefinite suspension; the
renamed restore field.

**Deleted:** the read-only story/message rendering and its copy; the audit-row route to your own
escalations; per-id identifier resolution and its cache; the required-duration suspension form; the
static three-warning sentence.

**One new screen** (`/admin/my-escalations`, both roles). No route was designed for anything the
handoff says the panel still cannot do.

---

## The headline number

A fully rendered page of twenty audit rows referencing five distinct people:

| | Identifier requests |
|---|---|
| Before | **5** — one per distinct person |
| After | **1** |

Read from the network log. Zero calls to the old per-id endpoint remain anywhere in either role tree.

---

## Five things in the prompt that the server or the codebase contradicted

This is the part that changes the planner's model of where the work stands.

1. **Three of the five "corrected facts" were already correct.** The prompt says the panel conflates
   the statistics span limit with the fine-bucket horizon, is built on a 30-per-minute rate limit,
   and states a thirty-minute pre-collection wait. The panel already carried 365 days and 30 days as
   separate constants, already said 20 requests a minute, and already said "within an hour" — the
   observability phase found and fixed all three. They were re-verified against the server and
   confirmed, not rebuilt. **Only two of the five were genuinely wrong**: the required suspension
   duration and the static three-warning sentence.

2. **The sender-deleted message refusal does not exist as described.** The handoff and the prompt say
   a message the sender deleted cannot be restored and answers 409. The schema has two independent
   columns — the sender's deletion and moderation's removal — and they do not interact. Moderation
   *can* remove such a message and *can* restore it (200); what it cannot do is make it visible,
   because the sender's deletion survives. The 409 that does occur is the ordinary already-in-state
   refusal, identical in code and message to a double restore. The panel words the outcome for the
   case that is real and invisible, and surfaces a genuine 409 as a concurrency conflict.

3. **A story's expiry is not readable by the panel.** The report target payload has no expiry field
   and the lifetime comes from a server-side setting, so it cannot be derived. In this database three
   of four stories have an `expires_at` *earlier* than their `created_at`, so a "created + 24h" rule
   would state the opposite of the truth on three rows out of four. The panel therefore states the
   mechanism — true of every story — rather than inventing a per-story determination. **This is the
   one place the phase could not do what it asked**, and it is now a backend request.

4. **Axios's default array serialisation breaks the new batch endpoint.** `ids[]=` is rejected with
   400. The request must send repeated bare `ids=` keys. This is one line of configuration and
   without it the highest-traffic new call fails outright.

5. **There is no session *listing* endpoint.** Sessions arrive inside the account detail payload. The
   caller's own row is marked by correlating `POST /auth/session` against `row.id`, which is the only
   mechanism available.

---

## Architectural decisions, and what was rejected

| Decision | Rejected alternative | Why |
|---|---|---|
| Batch resolution as a **module-level batching loader**; callers still ask for one id | A React context collecting ids during render | The context couples resolution to the component tree and needs a provider everywhere. The loader changed **no call site at all** |
| The activity filter gates on `import.meta.env.DEV` **and** `VITE_APP_ENV` | Either signal alone | The env var alone is one careless `.env` from shipping four filters that can never match; the build flag alone ignores the variable the phase named. The conjunction errs toward *fewer* filters, which is the safe direction |
| The escalation link removed **only** from `escalate_report` rows | Deleting the drawer's report link entirely | On other action types the link was never an escalation route; deleting it removes a working affordance and replaces nothing |
| The warning dialogue states the **whole strike ladder** (7 days → 30 days → ban) | Naming the one rung this account would land on | The account detail carries no strike count, so one rung would be a guess. Naming only "a strike" would repeat an omission a previous phase already fixed |
| A moderator is told the count **cannot be read** | Deriving it from the violations list a moderator can read | "Active" means unrevoked *and* newer than the last unrevoked strike *and* within 90 days. Reconstructing that client-side would be inventing a number and attributing it to the server |
| Indefinite suspension is an explicit radio choice | A blank duration field meaning indefinite | A blank field is indistinguishable from an unfinished form; the strongest action on the screen must not be reachable by omission |
| Restore copy says the caption **"still carries"** banned tags | Keeping "dropped: #x" with the new field | Restoring twice returns the same names. Under the old wording a reviewer would read two events that never happened |

---

## One change outside the panel

`LxBtn` (a shared primitive) now forwards a `type` prop. It previously dropped it, so
`DateRangeControl`'s preset buttons fell through to the browser's `submit` default: clicking a preset
submitted the empty form and displayed **"enter both a start and an end before applying" while a
window was applied and rows were showing**. A false statement on screen, pre-existing, affecting the
activity log too. Fixed at the root; the prop is forwarded but not defaulted, so no existing caller
changes behaviour.

---

## What remains unresolved, and where it is written

All in `deferred-findings.md`, and the backend items also in
`docs/admin-panel/backend-request.md`:

- **The story target payload carries no `expiresAt`.** Until it does, no panel can tell a reviewer
  what actually happened to one particular story. *Backend.*
- **A moderation restore refusal is indistinguishable from a double-click refusal** — same code, same
  message. *Backend.*
- **A moderator cannot read `activeWarningCount`**, because the whole account detail is
  administrator-only. *Backend.*
- Carried forward untouched: the cross-feature imports awaiting a phase permitted to move files;
  nested-Escape refinement; the seven-dimension statistics palette; the two-administrator check that
  needs a second administrator to exist.

---

## What could not be verified with anything the tooling could run

- **The production rate limit of 20 requests a minute.** The dev profile is looser: 25 rapid calls
  all returned 200 and no rate-limit header came back. The figure is documentation-sourced and the
  panel is built to it; it cannot be measured from here.
- **A *screen* that reaches the hundred-id split.** The loader itself was driven with 150 ids and
  split correctly into two requests of 100 and 50 — so the mechanism is verified. No panel screen
  produces more than a hundred distinct people in one page, so no interface path exercises it.
- **Two administrators viewing each other.** Still one administrator in this deployment, and
  promotion is irreversible through the API. Carried from the previous phase.
- **The two role contexts open simultaneously.** The session lives in one `localStorage` key, so two
  tabs share one identity. Both trees were walked sequentially in isolated sessions, which exercises
  the same surfaces; true simultaneity needs two browser profiles.

---

## State of the branch

Verification was committed **before the first line of feature code**, as required. Nine feature
commits, all building clean. Nothing in the backend repository was modified — the backend was rebuilt
and run, which touches only gitignored build output.
