# Changes Applied

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

All source changes are inside the frontend panel feature (`src/features/admin/`) except two shared
files called out below with justification. Nothing outside the frontend repository was touched; the
backend was read and called, never modified.

## API layer

- `src/features/admin/api/adminApi.js` — added the account surface (`getUsers`, `searchUsers`,
  `getUserDetail`), the six lifecycle actions (`banUser`, `unbanUser`, `suspendUser`,
  `unsuspendUser`, `changeUserRole`, `forceLogout`), and the hashtag registry (`getHashtags`,
  `searchHashtags`, `createHashtag`, `updateHashtag`, `deleteHashtag`), each unwrapping the envelope,
  sending only declared query keys, and building bodies field by field. Declared-key lists added for
  each endpoint.

## Shared panel lib

- `src/features/admin/lib/errors.js` — added the four account/hashtag lifecycle 409 codes to the
  conflict set so a race surfaces as a calm refetch rather than a raw error.

## Hooks

- `useDebouncedSearch.js` (new) — the debounce, minimum-length, blank-guard, and rate-limit-cooldown
  controller shared by account search and the actor picker.
- `useAccounts.js` (new) — `useAccountList` (status/role filters) and `useAccountSearch`.
- `useAccountDetail.js` (new) — the detail with capabilities, exposing `capabilities` only on success.
- `useAccountActions.js` (new) — the six lifecycle mutations, refetching the detail before controls
  re-render.
- `useHashtags.js` (new) — `useHashtagList` and `useHashtagSearch`.
- `useHashtagActions.js` (new) — create, status transition, delete.
- `useActions.js` (modified) — added the `adminId` actor filter.

## Components

- `AccountLifecyclePanel.jsx` (new) — the capabilities-driven state summary and controls.
- `SuspendDialog.jsx`, `RoleChangeDialog.jsx`, `HashtagCreateDialog.jsx` (new) — the field-carrying
  confirmation dialogs quoting the shared shape.
- `AccountSearchPicker.jsx` (new) — the debounced account picker used by the actor filter.
- `AccountDisciplinePanel.jsx` (modified) — the warn success feedback now surfaces the post-issue
  `activeWarningCount`.

## Screens

- `AccountListScreen.jsx` (new) — the account list and search.
- `HashtagRegistryScreen.jsx` (new) — the hashtag registry.
- `AccountModerationScreen.jsx` (modified) — added the administrator-only "state & actions" card and
  a back link to the list.
- `AuditLogScreen.jsx` (modified) — added the administrator-only actor filter.

## Routing and navigation

- `src/features/admin/adminRoutes.jsx` (modified) — registered the account list and hashtag registry
  behind the administrator-only guard; the account detail route already existed.
- `src/features/admin/components/AdminShell.jsx` (modified) — added the accounts and hashtags nav
  entries to the administration group (administrator only).
- `src/features/admin/guards/AdminOnlyRoute.jsx` (modified) — its refusal message is now generic
  because it guards more than the escalated queue.

## Shared files outside the panel directory (called out)

- **`src/config/constants.js`** — added `ROUTES.ADMIN_USERS` (the list) and `ROUTES.ADMIN_HASHTAGS`,
  and expanded the comment on `ROUTES.ADMIN_USER`. Justification: `constants.js` is the single source
  of route paths for the whole app; the routing rule requires every panel route to be declared here
  rather than hardcoded, and the prior admin phases added their routes the same way. No behaviour
  outside the panel changes — only two new admin path constants and a comment.

No user-facing application code was changed. The user-facing regression (sign in, feed, open a post,
comment) was verified unaffected.
