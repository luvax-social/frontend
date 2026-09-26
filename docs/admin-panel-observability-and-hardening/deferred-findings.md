# Deferred Findings

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything still open at the end of the panel effort, tagged with who owns it.

The panel is complete. Nothing here blocks it. **Everything that needs the backend has been moved
out of this file and into `docs/admin-panel/backend-request.md`**, so a reader looking for backend
work has one place to look; this file holds what remains on the frontend side, plus the state this
phase leaves behind.

---

## Frontend — owner: whoever next touches the panel

- **CLEANUP (a phase permitted to move files).** The panel still imports `LxBtn` and `LxTag` from
  `features/luvax/components/primitives.jsx`, and `toast` / `ToastHost` from
  `features/luvax/components/Toast.jsx`. These are cross-feature imports, and this phase added more
  of them because moving a file has been out of scope in every phase. Their correct home is
  `src/components/`. Carried unchanged from the first panel phase.

- **CRAFT: nested Escape.** While a listbox is open inside a dialog, Escape closes both, because both
  register a document-level listener. Not wrong — Escape closing a dialog is expected, and the
  listbox also closes on selection and on an outside click — but a refinement could close only the
  innermost overlay. It needs overlay-stack state threaded through the shared hook, which is more
  risk than the behaviour is worth at this point. Carried from the discipline phase.

- **PANEL: the event-type filter should widen if the recommendation consumer is ever deployed.** The
  filter offers the three types the application unconditionally writes. A second writer exists in
  the source for four engagement types and is enabled in both profiles, but its messages dead-letter
  in every environment the panel can observe, because the service it depends on is not deployed. If
  that service is deployed, the filter should widen to seven. The unfiltered list already shows any
  type a row carries, so nothing is hidden in the meantime. Evidence in
  `observability-contract-verification.md` §2.3 and `design-decisions.md` §3; the backend side of the
  question is item 7 of the backend request.

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** **Answered.** The recommender service is now part of the default local compose stack, and all four engagement types were produced and read back out of `user_events`. The filter widens to seven in a development build and stays at three in a production build, gated on the environment — a production deployment of that service still does not exist. Evidence and the gate's reasoning are in the uptake phase's `design-decisions.md` §1.


- **PANEL: statistics for a breakdown metric with more than seven dimensions.** The categorical token
  palette has seven entries, so at most seven series are drawn and the rest are named rather than
  drawn. `admin_actions_by_type` can exceed seven in a busy deployment. If that becomes common, the
  screen wants a way to choose which dimensions to plot rather than taking the seven largest. Today
  it states what it did not draw, which is honest but not selectable.

- **VERIFICATION: one check could not be run and should be re-run where it can be.** Section 15 item
  11 — an administrator viewing **another administrator** — could not be exercised, because this
  deployment has exactly one administrator and promotion is irreversible through the API. The
  mechanism was verified from source and through the self-target branch that reaches the same
  all-false capabilities. **In any environment with two administrators, open one's detail as the
  other and confirm no ban, suspend, role, or warn control renders.** Detail in
  `hardening-sweep.md` item 11.

---

## Documentation drift — owner: a documentation phase

Unchanged since the reconnaissance recorded it; none of it is in this phase's write scope.

- `frontend/.claude/rules/struct.md` and `global_rules.md` are stale on routing, tokens, and the icon
  library. `struct.md` in particular still describes the authenticated application as living at a
  single `/app` route with screens swapped in component state; every screen has had its own address
  for several phases, and the admin panel adds ten more.
- The workspace-level `STRUCT.md` describes 18 backend migrations and five services with no
  Elasticsearch and no recommendation module. Both are far out of date.
- `backend/.claude/rules/struct.md` states a migration count that no longer matches.

---

## Fixture state this phase leaves behind

Recorded so the next person is not surprised. All of it is dev fixture data and none of it affects a
fresh `bash scripts/seed-dev-data.sh --reset`.

**Not reversible:**

- **Two statistics buckets were deleted** (`2026-08-22 06:00+07` and `06:30+07`, 40 rows) to
  reproduce a missed collection pass, which is the only way to see the gap rendering against real
  absent data. There is no backfill, so those two buckets are gone permanently. Every other bucket
  was backed up and restored intact around the pre-collection check.

**Reversible, and reverted:**

- `seed_carol` was promoted to moderator and returned to `user`.
- The `spam` report reason was disabled and re-enabled.
- `seed_carol` and `seed_bob` were suspended by the three-warning sequence and have been unsuspended.

**Left as it stands:**

- `seed_bob` and `seed_carol` each carry warnings from the discipline checks; `seed_bob` has a
  revoked strike. `seed_alice` remains suspended with warnings and a strike, which predates this
  phase.
- Two hashtags were created: `dropcheck` (banned) and `keepcheck` (active). One pre-existing tag was
  unbanned while capturing a request body.
- One post by `seed_carol` and one comment on a seed post were created during the checks.
- Two reports were created: one against a message (resolved during the double-resolve check) and one
  against a post (escalated by the moderator).
- `seed_carol`'s and `seed_mod`'s sessions were revoked by force-logout during verification; both
  can simply sign in again.

---

## Explicitly closed by this phase

Recorded so nobody re-opens them:

- **The account phase's deferred force-logout verification.** It had been verified only by simulating
  the epoch bump and token revocation by hand. This phase drove the **real** endpoint against a
  signed-in moderator: exactly one refresh attempt, then a clean redirect, no loop.
- **The account phase's session, reports-against, and address fields.** All three were surfaced as
  counts; all three are now rendered as what they are.
- **The reduced-motion verification limitation** recorded by the first panel phase. It was exercised
  this phase through real media emulation across all eight routes.
- **The user-facing settings 404.** Reproduced end to end and diagnosed: the cause is the backend and
  its seed script, not the frontend. It is item 6 of the backend request.
