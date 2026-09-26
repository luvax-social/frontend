# Admin Panel — Discipline History and Audit

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

This phase adds the discipline record and the audit trail to the moderation panel. A reviewer can
now see an account's warnings and strikes, issue a warning, browse everything an account has posted
or commented, and read back the log of moderation actions including the metadata that exists only
on a per-action fetch.

## What this phase delivered

- **Violation history** — an account's warnings (and strikes, for an administrator), reached from
  the account view and embedded in the report detail. Rendering branches on the union discriminator
  `kind`. Administrators can revoke a warning or strike.
- **Warning issuance** — a vocabulary-driven reason selector and a required note, for both roles.
- **Per-account content** — an account's posts and comments as two tabs of one screen, with
  remove/restore and removed content visibly distinguished.
- **The audit log** — one screen for a moderator (its own actions) and an administrator (all), with
  a detail drawer that fetches metadata on open and links back to the originating report.

## What to open first

1. `discipline-contract-verification.md` — the backend contract, committed before any feature code.
   The metadata shapes and the divergences are here.
2. `orchestrator-brief.md` — the two-page summary for the planner: decisions, divergences, open
   questions.
3. `design-decisions.md` — the warn-eligibility decision, the metadata rendering strategy, and the
   revoked-record divergence, in full.
4. `verification-evidence.md` — every check, what was driven, what was observed, with each
   screenshot linked from the check it evidences.
5. `screens/` — 30 screenshots; the filename alone says what each shows.

## How to run it

- Backend up at `http://localhost:8080` with the compose stack healthy; seed data reset
  (`bash scripts/seed-dev-data.sh --reset` in the backend repo). Seed accounts use the password
  `SeedPass123!`.
- `npm run dev` in this repo (Vite, port 5173).
- Sign in as `seed_admin` (administrator) or `seed_mod` (moderator). Both land in the panel.
- Reach the surfaces:
  - **Audit log:** the "actions" nav item, or `/admin/actions`. Open a row for its detail;
    `?action={id}` makes it a shareable link.
  - **Account moderation** (violation history, warn, content): `/admin/users/{userId}`, or the
    target-account link in an audit action's drawer, or the account-history region on a report
    detail.

## Key files

- Screens: `src/features/admin/screens/AuditLogScreen.jsx`,
  `src/features/admin/screens/AccountModerationScreen.jsx`.
- Components: `ViolationHistory`, `AccountDisciplinePanel`, `WarnDialog`, `ReasonSelect`,
  `AccountContent`, `ActionDetailDrawer`.
- Hooks: `useViolations`, `useDisciplineActions`, `useUserContent`, `useActions`.
- API: the discipline/content/audit calls in `src/features/admin/api/adminApi.js`.
