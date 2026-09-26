# Changes Applied

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

By area, not by line. Everything is inside the panel's own directories except where called out.

## New files (panel)

- `src/features/admin/hooks/useViolations.js` — role-keyed infinite list of an account's violations.
- `src/features/admin/hooks/useDisciplineActions.js` — warn, revoke-warning, revoke-strike
  mutations, invalidating the account's history on success.
- `src/features/admin/hooks/useUserContent.js` — infinite list of an account's posts or comments,
  plus `useContentModeration` (remove/restore reusing the existing `adminApi` calls).
- `src/features/admin/hooks/useActions.js` — role-keyed infinite audit list (`useActions`) and the
  single-action detail fetch (`useActionDetail`).
- `src/features/admin/lib/contentModeration.js` — the single `restoreSuccessMessage` helper (names
  dropped hashtags for a post restore only).
- `src/features/admin/components/ReasonSelect.jsx` — vocabulary-driven reason listbox (shared).
- `src/features/admin/components/WarnDialog.jsx` — the warning issuance form.
- `src/features/admin/components/ViolationHistory.jsx` — the violation list, branching on `kind`.
- `src/features/admin/components/AccountDisciplinePanel.jsx` — history + warn control, shared by the
  account view and the report detail.
- `src/features/admin/components/AccountContent.jsx` — posts/comments tabs with remove/restore.
- `src/features/admin/components/ActionDetailDrawer.jsx` — the portalled action drawer and its
  metadata renderers.
- `src/features/admin/screens/AuditLogScreen.jsx` — the audit log (both roles).
- `src/features/admin/screens/AccountModerationScreen.jsx` — the account moderation host.

## Modified files (panel)

- `src/features/admin/api/adminApi.js` — added the discipline, content, and audit calls with their
  declared query-key lists.
- `src/features/admin/hooks/useVocabularies.js` — added `actionKnown(key)`.
- `src/features/admin/adminRoutes.jsx` — added `/admin/actions` and `/admin/users/:userId` (neither
  administrator-only).
- `src/features/admin/components/AdminShell.jsx` — added the `actions` nav entry for both roles.
- `src/features/admin/screens/ReportDetailScreen.jsx` — added the account-history region (rendered
  from `target.ownerId`, absent when unavailable) and switched its restore message to the shared
  `restoreSuccessMessage` helper.

## Touched outside the panel's own directories (called out with justification)

- `src/config/constants.js` — **additive**: two routes (`ADMIN_ACTIONS`, `ADMIN_USER`), two
  `routeTo` builders (`adminUser`, `adminAction`), and `CHAR_LIMITS.warningNote = 2000`. No existing
  value changed. Justification: routes and limits have a single source in this file.
- `src/components/ui/lx-icon.jsx` — **additive**: `clock` and `external` icons in the existing
  outline style. Justification: the panel adds icons to the shared internal icon set, as the
  previous phase did; no existing icon changed.

No file was moved, renamed, or reorganised. No backend file was touched. No TypeScript file was
added. No new UI dependency was introduced.

## Test data touched (not code)

- `report_reason_configs.is_enabled` for `scam` was set false to demonstrate the disabled-entry
  rendering, then **restored to true** (verified through the vocabulary API). This is fixture data,
  not application code.
