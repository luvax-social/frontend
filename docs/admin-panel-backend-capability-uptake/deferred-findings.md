# Deferred Findings

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything still open at the end of this phase, tagged with who owns it.

Nothing here blocks the panel. Items needing the backend are also carried into
`docs/admin-panel/backend-request.md`, so a reader looking for backend work has one place to look.

---

## Backend — owner: whoever next touches the backend

### 1. The story target payload carries no expiry

**New this phase, and the one thing the phase asked for that could not be delivered.**

`GET /admin/reports/{id}/target` returns, for a story:

```
reportType, entityId, ownerId, ownerUsername, status, text, mediaUrls, removed, createdAt
```

There is no `expiresAt`, and expiry is not derivable. The lifetime comes from the server's
`story_duration_hours` setting, which the panel never sees, and the data does not support a
constant: three of the four stories in this database have an `expires_at` **earlier** than their
`created_at`, so a `createdAt + 24h` rule would report the opposite of the truth on three rows out of
four.

**Consequence.** A reviewer restoring a story is told the rule — a story past its expiry stays out of
every feed — rather than what happened to *this* story, because the panel cannot know. Adding
`expiresAt` to the target payload would let the panel say "this story expired four hours ago; the
restore lifts the removal but it will not reappear", which is what the phase actually wanted.

Evidence: `uptake-contract-verification.md` §1.1.

### 2. A moderation restore refusal cannot be told from a double-click refusal

Both answer `409 ADMIN_INVALID_TRANSITION` with the message *Target is already in the requested
moderation state*. The panel cannot distinguish "someone else already restored this" from any other
already-in-state case by the response alone, so every 409 on these endpoints is surfaced as a
concurrency conflict — which is the most likely cause but not provably the only one.

A distinct code for each refusal reason would let the panel say which happened. Low priority: the
conflict wording is correct for the common case and the panel refetches either way.

### 3. A moderator cannot read `activeWarningCount`

The count lives on `AdminUserDetailResponse`, and the whole detail is administrator-only — a
moderator receives `403`. So the reviewer most likely to be issuing a warning is the one who cannot
be told how many the account already has.

The panel says so plainly rather than showing a number it does not have, but this is the one place
where a moderator gets strictly less information than the decision warrants. Either exposing the
count on a moderator-readable endpoint, or returning a reduced detail payload to moderators, would
close it.

Evidence: `uptake-contract-verification.md` §4.1; the interface branch is in
`design-decisions.md` §8.

---

## Frontend — owner: whoever next touches the panel

- **CLEANUP (a phase permitted to move files).** The panel still imports `LxBtn` and `LxTag` from
  `features/luvax/components/primitives.jsx`, and `toast` / `ToastHost` from
  `features/luvax/components/Toast.jsx`. These are cross-feature imports and their correct home is
  `src/components/`. **Carried unchanged since the first panel phase**, and this phase had to *edit*
  one of those files to fix a real defect, which is the clearest argument yet for moving them: a
  shared primitive that several features depend on should not live inside one feature's directory.

- **CRAFT: nested Escape.** While a listbox is open inside a dialog, Escape closes both, because both
  register a document-level listener. Not wrong — Escape closing a dialog is expected, and the
  listbox also closes on selection and on an outside click — but a refinement could close only the
  innermost overlay. Carried from the discipline phase.

- **PANEL: statistics for a breakdown metric with more than seven dimensions.** The categorical token
  palette has seven entries, so at most seven series are drawn and the rest are named rather than
  drawn. `admin_actions_by_type` can exceed seven in a busy deployment. Today the screen states what
  it did not draw, which is honest but not selectable. Carried from the observability phase.

- **PANEL: the hundred-id split has no *screen* that reaches it.** The loader was driven directly
  with 150 ids and split correctly into two requests of 100 and 50, all 150 settling and each real id
  resolving to its own account (`verification-evidence.md` §2) — so the mechanism is verified. What
  is not verified is any interface path that produces more than a hundred distinct people in one
  page, because none exists. If a screen ever does — a much larger page size, or a list where every
  row names a different person — drive it through the interface as well.

- **VERIFICATION: one check still cannot be run here.** An administrator viewing **another
  administrator** — this deployment has exactly one administrator and promotion is irreversible
  through the API. **In any environment with two administrators, open one's detail as the other and
  confirm no ban, suspend, role, or warn control renders.** Carried from the observability phase,
  unchanged.

- **VERIFICATION: the two role trees were walked sequentially, not simultaneously.** The session
  lives in one `localStorage` key, so two tabs in one browser profile share one identity. Both trees
  were walked in isolated sessions, which exercises the same surfaces. A future run with two browser
  profiles could do it concurrently and would additionally catch anything that only breaks when two
  roles act at the same moment.

---

## Documentation drift — owner: a documentation phase

Unchanged since the reconnaissance recorded it; none of it is in this phase's write scope. This
phase's own corrections to earlier documents are listed in `changes-applied.md`.

- `frontend/.claude/rules/struct.md` and `global_rules.md` are stale on routing, tokens, and the icon
  library. `struct.md` still describes the authenticated application as a single `/app` route with
  screens swapped in component state; every screen has had its own address for several phases, and
  the panel now adds eleven.
- The workspace-level `STRUCT.md` describes 18 backend migrations and five services with no
  Elasticsearch, no recommendation module, and no `gorse`. The schema is at v82 and the compose stack
  has six services.
- `backend/.claude/rules/struct.md` states a migration count that no longer matches.

---

## Fixture state this phase leaves behind

Recorded so the next person is not surprised. All dev fixture data; none of it survives a fresh
`bash scripts/seed-dev-data.sh --reset`.

**Environment, worth knowing before anything else:**

- The compose project is **`app`**, not `backend`. Use `docker compose -p app up -d` and
  `COMPOSE_PROJECT_NAME=app bash scripts/seed-dev-data.sh --reset`, or the script cannot find
  postgres and refuses to run. The named volumes are `app_postgres_data` and friends.
- The jar on disk may predate the source. Rebuild before trusting an endpoint's absence.

**Left as it stands:**

- Two `media_assets` rows (`uptake/fixture-1.webp`, `uptake/fixture-2.webp`) pointing at
  `http://localhost:5173/1.webp` and `/2.webp`, attached to `seed_alice`'s post `3c5e02ab`. These
  exist because `post_media` is empty in a seeded database and media upload needs R2 credentials the
  dev stack does not have. They render only while the dev server is running on 5173.
- Two story media rows repointed at `http://localhost:5173/3.webp`, so the story screenshots show the
  rendering rather than a broken external CDN link. Other seed and e2e media rows still point at
  `cdn.example` / `cdn.example.local`, which do not resolve; those produce the
  `ERR_NAME_NOT_RESOLVED` console entries recorded in `verification-evidence.md` §9.
- One story's `expires_at` was pushed to `now() + 23 hours` so a reliably **live** story existed for
  the remove/restore checks. The three e2e stories remain expired, which is what made the
  expired-story branch verifiable at all.
- `seed_carol` carries two active warnings, one revoked warning, and one revoked strike — the state
  the third-warning consequence and the revoked-records toggle were photographed against.
- `seed_bob` is **suspended indefinitely** (`suspendedUntil` null), from the omitted-duration check.
- Four hashtags created: `uptakebanned`, `uptakekeep`, `uptakesecond` (all banned), `uptakekeep` was
  active when the probe post was written and banned afterwards.
- One post by `seed_alice` (`uptake restore probe #uptakekeep #uptakesecond`), removed and restored
  four times across the two double-restore passes.
- Four reports by `seed_carol`: against a live story, an expired story, a message, and a post. The
  post report was escalated by `seed_mod` and resolved by `seed_admin` — that pairing is what makes
  the escalations screen show a closed report.
- Many `seed_alice` and `seed_admin` sessions from repeated API logins, one of `seed_alice`'s revoked
  by the single-session check and one of `seed_admin`'s by the double-click check.
- `user_events` carries at least one row of each of the seven types, produced deliberately.

**Reverted:**

- `seed_carol` was suspended by the three-warning sequence and has been unsuspended.

---

## Explicitly closed by this phase

Recorded so nobody re-opens them:

- **The observability phase's event-filter question.** It asked whether the filter should widen if
  the recommender service were ever deployed. It is deployed locally, all four types were produced
  and read back, and the filter is now gated on the environment.
- **The moderation-history phase's acceptance that revoked records vanish.** `includeRevoked` exists;
  the toggle is built and the record is marked.
- **The accounts phase's "durationDays is required" reading.** It is optional and omitting it is a
  supported, deliberate choice.
- **The observability phase's user-facing settings 404.** Diagnosed there as backend-side, fixed
  there, confirmed here: `GET /users/me/settings` → `200` for a seed account, page renders.
