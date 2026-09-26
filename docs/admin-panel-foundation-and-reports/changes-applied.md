# Changes Applied

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

By area, with anything touched outside the panel's own directories called out separately with its justification.

## The panel (`src/features/admin/`, all new)

- `api/adminApi.js`: the panel's API surface, every call through the shared `axiosClient`, unwrapping the envelope, sending only declared query keys, building bodies field by field.
- `lib/`: `requestContract.js` (declared-key param sanitiser and explicit body builder), `errors.js` (the field/toast/page/silent classification), `pagination.js` (`hasNextPage` termination, role-in-key, 429-excluding retry), `reportSchema.js` (the fixed report status and type enums from the API schema).
- `hooks/`: `useVocabularies`, `useEscalatedCount` (admin-gated poll), `useResolveUsername` (id-to-name, cached by id), `useReportQueue` (role in key), `useReportDetail` (report and target as separate queries), `useReportActions` (the mutations with cache invalidation).
- `components/`: `AdminShell` and `panelStyles` (layout, role navigation, header identity, sign out, escalated badge), the derived patterns `RecordTable`, `FilterBar`, `StatusBadge`, `ReasonConfirmDialog`, `LoadMore`, `ListStates`, plus `LocalTime`, `PanelPage`, `NotAvailable`, `ReporterName`, `reportColumns`.
- `guards/`: `AdminRouteGuard` (panel-role gate) and `AdminOnlyRoute` (administrator-only gate).
- `screens/`: `ReportQueueScreen`, `EscalatedQueueScreen`, `ReportDetailScreen`.
- `adminRoutes.jsx` and `index.js`: the lazily loaded route subtree and its public export.

## Files touched outside the panel's directories

Each of these is part of the shared authentication and design layer the panel genuinely requires, not the user-facing application's own screens.

- `src/config/roles.js` (new): the shared role model (`ROLES`, `normalizeRole`, `isPanelRole`, `isAdminRole`, `landingPathForRole`).
It lives in shared config rather than in the panel because the auth page, the guest guard, and the store all consume it, and a feature must not import from another feature.
- `src/config/constants.js`: added the `/admin` route constants and the `routeTo.adminReportDetail` builder, in the existing central form.
- `src/config/tokens.js`: exposed the `warning`, `warning-dim`, `warning-text`, and `success-dim` tokens in the `v` shorthand.
They existed in `index.css` but were absent from the JavaScript object, and the status vocabulary needs the caution tone.
- `src/components/ui/lx-icon.jsx`: added `shield`, `filter`, `logout`, and `chevronDown` in the existing inline-SVG style.
- `src/store/useAuthStore.js`: added an in-memory `role` field captured from login and refresh, normalised once, excluded from persistence, and stripped from the persisted `user`.
This is the shared session store; the change is additive and no existing reader of the store is affected.
- `src/api/axiosClient.js`: the interceptor-driven refresh now carries the refresh response's `user` through, so a background refresh repopulates the role rather than dropping it.
This closes a gap the reconnaissance flagged and changes no existing path.
- `src/features/auth/components/AuthPage.jsx`: the post-login destination is now chosen by role, so a moderator or administrator lands in the panel.
A remembered origin from a redirected navigation still wins.
- `src/components/common/GuestRoute.jsx`: an already-authenticated visitor is redirected by role rather than always to the application.
- `src/routes/index.jsx`: registered the `/admin` subtree inside the existing authentication guard.

## A deliberate cross-feature import, forced by the no-move rule

The panel imports `LxBtn` and `LxTag` from `src/features/luvax/components/primitives.jsx` and `toast`/`ToastHost` from `src/features/luvax/components/Toast.jsx`.
This is a cross-feature import, which the frontend rules generally forbid.
It is accepted here because the settled positions require the panel to be built from the existing internal `Lx*` primitives and to introduce no second design vocabulary, and those primitives live inside the luvax feature.
The rules' own remedy, extracting them to `src/components/`, is a file move, which this phase is explicitly forbidden from doing.
Duplicating them into the panel would create the second design vocabulary the settled positions forbid.
The import is therefore the honest consequence of "reuse the primitives, do not move them"; it is recorded here and in `deferred-findings.md` as a cleanup for a phase that is allowed to move files.

## Verification-only, not committed to the application

Report fixtures were created through the public API, and a story-target report through direct SQL, purely to exercise the screens in a browser.
None of this is application code.

## The user-facing application

No change beyond the shared authentication layer above.
The application was re-verified after the changes: sign in, feed, post, and comment all work (see `verification-evidence.md`).
