# Admin Panel — Observability and Hardening

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

The final phase. It adds the last two screens, expands the last carry-over surface, and audits the
whole panel as one product for the first time.

**The panel is complete: fifteen screens across ten routes, both roles, and all 51 checks in section
15 of the backend handoff walked and recorded.**

## What this delivered

- **Statistics** (`/admin/statistics`, administrator only) — the stored snapshot with its staleness
  stated, and a series chart for any of the fourteen metrics over a bounded window. Built as inline
  SVG; no charting library was added. It keeps three states apart that are easy to conflate: nothing
  was ever collected, it was measured and it was zero, and a bucket in the middle is missing.
- **Activity log** (`/admin/activity`, administrator only) — what an account has been doing, or the
  whole platform. Both ends of the window are required and it issues nothing until it has them.
  The event-type filter offers only the three types the application actually writes.
- **Sessions and reports-against** — the account detail's two remaining counts expanded into real
  lists. Sessions render the user agent and address as the strings the payload carries, with no
  per-session revoke control, because the API has none.
- **Seven hardening fixes** across all four phases, found by walking section 15 rather than by
  reviewing this phase's own work: a range clamped to the wrong limit, a clamp that applied silently,
  a strike that did not name its outcome, a revocation that implied restoration, a warn control on a
  target that cannot be warned, an indefinite suspension that rendered as nothing, and a hashtag ban
  confirmation that omitted the one sentence that stops a reviewer misreading it.
- **One consolidated backend request** at `docs/admin-panel/backend-request.md`, gathering every item
  all four phases deferred.

## What to open first

1. `orchestrator-brief.md` — the two-page summary for the planner.
2. `observability-contract-verification.md` — the live contract findings, committed before any code.
3. `hardening-sweep.md` — all 51 checks with their outcomes.
4. `completion-audit.md` — the fifteen screens and both role walks.
5. `design-decisions.md` — the chart, the three-state distinction, the written-event-types rule.
6. `verification-evidence.md` — every check with the screenshot that evidences it.
7. `deferred-findings.md` — what is still open, and the fixture state this phase leaves behind.

`docs/admin-panel/backend-request.md` sits outside this directory on purpose: it belongs to the
panel effort as a whole, not to one phase.

## How to run it

**Backend.** The compose stack healthy (postgres, redis, rabbitmq, elasticsearch, mailpit) and the
application running. Seed with `bash backend/scripts/seed-dev-data.sh --reset`. Seed accounts —
`seed_admin`, `seed_mod`, `seed_alice`, `seed_bob`, `seed_carol` — share the password
`SeedPass123!`.

**One thing to know before you reset.** `--reset` empties `platform_stats`. The statistics screen
then has nothing to show until the collection job has written its first bucket, which takes up to an
hour from a cold start: the job runs 30 minutes after startup and discards the partial bucket the
process began inside. That is not a fault, and the screen says so — but if you want to see a chart,
leave the application running rather than resetting just before you look.

**Frontend.** `npm run dev`, then sign in.

## Navigating the finished panel

Sign in at `/login`; the panel is at `/admin` and redirects to the report queue.

**As a moderator** (`mod@seed.local`) you get one group, `moderation`: the report queue and your own
action log. From a report you can mark it reviewing, escalate it, remove or restore a post or
comment, see the owner's warnings, and warn them. Resolve and dismiss are an administrator's to
make, so they are not shown to you on a report you escalated. The five administrator-only routes are
unreachable rather than empty.

**As an administrator** (`admin@seed.local`) you get that plus `administration`: the escalated queue
with a live count, the account list, the hashtag registry, statistics, and the activity log. From an
account you can ban, suspend, lift either, change role, end every session, warn, and revoke a warning
or strike, with each control shown only where the server permits it for that account.

Two habits the panel expects of its endpoints and therefore of you:

- **Nothing has a total.** No list says "1 to 20 of 350", because no endpoint returns a count. Lists
  extend with "load more" until there is no more.
- **The two observability screens are the tightest-rate-limited in the system**, so their range
  controls fire when you apply them, not while you drag them. If the server refuses one, the control
  says how long it is holding and does not retry behind your back.

## Notes

- Colours are `--lx-*` tokens only; no raw hex, `rgb()`, or `hsl()` anywhere in the panel across all
  four phases, grep-verified.
- No dependency was added by this phase, and no file was moved or renamed.
- Nothing in the backend was modified. The user-facing application was not changed; its settings-page
  defect was diagnosed to the backend and recorded rather than patched.
