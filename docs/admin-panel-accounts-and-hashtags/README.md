# Admin Panel — Accounts and Hashtags

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

This phase adds the account surface and the hashtag registry to the moderation panel. A reviewer can
now find any account, see its state, and take every lifecycle action the server permits, and can
manage the hashtag vocabulary. The audit log gained its actor filter.

## What this delivered

- **Account list and search** (`/admin/users`, administrator only) — filter by status and role,
  debounced rate-limited search, each row triage-able without opening it.
- **Account detail** (`/admin/users/:userId`) — the existing discipline/content screen, expanded for
  administrators with a capabilities-driven "state & actions" card: ban, unban, suspend, unsuspend,
  role change, and force logout, every control rendered from the server's capabilities.
- **Hashtag registry** (`/admin/hashtags`, administrator only) — list, search, create, status
  transitions, and delete.
- **Audit log actor filter** — filter the action log by who acted, using the new account search.

## What to open first

1. `orchestrator-brief.md` — the two-page summary for the planner.
2. `accounts-contract-verification.md` — the live contract findings, committed before any code.
3. `design-decisions.md` — the capabilities strategy, the self-targeting rules, the one-way door.
4. `verification-evidence.md` — every check with its screenshot.

## How to run it

- Backend: the compose stack healthy, seeded with `bash backend/scripts/seed-dev-data.sh --reset`.
  Seed accounts (`seed_admin`, `seed_mod`, `seed_alice`, `seed_bob`, `seed_carol`) share the password
  `SeedPass123!`.
- Frontend: `npm run dev`, then sign in as `seed_admin` to reach the accounts and hashtags screens
  (they are administrator only; `seed_mod` sees reports and actions).

## Notes

- The whole account surface (list, search, detail) is administrator-only — the backend returns 403
  to a moderator. A moderator on an account detail sees discipline and content only.
- Colours are `--lx-*` tokens only; no raw hex was added (grep-verified).
- Nothing in the backend was modified. The user-facing application was not changed.
