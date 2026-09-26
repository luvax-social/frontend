# Changes Applied

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

By area. 30 source files, +1502 / −184. Twelve commits on
`feat/admin/backend-capability-uptake`, cut from `develop`.

The verification document was committed **before the first line of feature code**, as the phase
requires (`774d092`, ahead of `d133b17`).

---

## Commits

| Commit | Subject |
|---|---|
| `c1ebfa0` | docs(admin): take up the regenerated backend handoff and openapi contract |
| `774d092` | docs(admin): verify the new backend capabilities against a running server |
| `d133b17` | feat(admin): expose the new backend endpoints in the panel api layer |
| `60ac19e` | feat(admin): remove and restore a reported story or message |
| `e3d6920` | feat(admin): end one session and mark the caller's own row |
| `8044979` | feat(admin): show the warning count and list revoked violations |
| `25948c9` | feat(admin): filter the audit log and list your own escalations |
| `ef5d20d` | feat(admin): offer indefinite suspension and render post media |
| `5dbef34` | feat(admin): offer the activity filters this environment actually writes |
| `e526490` | docs(admin): record why the reason list is never filtered by type |
| `d6d516c` | fix(common): let a button opt out of submitting its form |
| `b443a14` | docs(admin): capture the uptake verification screenshots |

---

## API layer

**`src/features/admin/api/adminApi.js`**

- **Added** `getUserSummaries(ids)` — `GET /admin/user-summaries`, with
  `paramsSerializer: { indexes: null }`. Axios's default `ids[]=` is rejected with 400, so this is
  required, not stylistic. `pickParams` is deliberately not used: it exists to drop undeclared
  *filter* keys, and `ids` is the endpoint's one declared, required parameter.
- **Deleted** `getUserContent(userId)` — the per-id resolver. It had exactly one caller.
- **Added** `removeStory`, `restoreStory`, `removeMessage`, `restoreMessage`.
- **Added** `revokeSession(userId, sessionId, { reason })` and `getCurrentSession(refreshToken)`.
- **Added** `getMyEscalations({ cursor, limit })`.
- **Extended** `getViolations` with `includeRevoked`; new `VIOLATIONS_QUERY_KEYS`.
- **Extended** `getActions` with `targetUserId`, `from`, `to`; `ACTIONS_QUERY_KEYS` grew from four
  declared keys to six.
- **Rewrote** `restorePost`'s contract note for the renamed field and its changed meaning.

---

## Shared layer

**`src/features/admin/lib/userSummaries.js`** *(new)* — the batching loader. Coalesces every id
requested in one tick into a single call, chunks at the server's `MAX_IDS_PER_REQUEST = 100`, indexes
responses by the `userId` each entry carries rather than by position, and settles a not-found id as
`null` so React Query caches it as a resolved answer instead of retrying.

**`src/features/admin/hooks/useResolveUsername.js`** — reimplemented on the loader. Same file, same
export name, same signature; every call site unchanged. Gained an `isUnknown` flag.

**`src/features/admin/lib/contentModeration.js`** — rewritten. `restoreSuccessMessage` now branches
per type; added `removeSuccessMessage`, `removeConfirmDescription`, `restoreConfirmDescription`. The
post message describes present state; the story and message messages state what a restore does and
does not do.

**`src/features/admin/lib/reportSchema.js`** — `ACTIONABLE_TARGET_TYPES` gained `story` and
`message`; the "the rest are read-only" note is gone.

---

## Hooks

| File | Change |
|---|---|
| `useReportActions.js` | Two four-entry dispatch maps replace the post/comment ternaries — with four types a ternary chain has a silent default, and the default would have been "treat it as a comment" |
| `useCurrentSession.js` *(new)* | `POST /auth/session`, returning `sessionId` and a separate `isKnown`, so a screen can say "not determined" rather than marking nothing |
| `useAccountActions.js` | Added the `revokeSession` mutation |
| `useMyEscalations.js` *(new)* | The escalations cursor list. No status filter, deliberately |
| `useViolations.js` | Takes `includeRevoked`; the flag is in the query key because the cursor is scoped on it |
| `useActions.js` | Takes `targetUserId`, `from`, `to`; all three in the query key |
| `useUserEvents.js` | Split into `UNCONDITIONAL_EVENT_TYPES` and `ENGAGEMENT_EVENT_TYPES`; `WRITTEN_EVENT_TYPES` is now composed at module load from the environment gate |
| `useVocabularies.js` | Comment only — records why the reason list is never filtered by `appliesTo` |

---

## Components

| File | Change |
|---|---|
| `AccountSessionsPanel.jsx` | Per-row *end* column, `THIS SESSION` badge, a note for the undetermined case; the "there is no per-session revocation" doc block and the "sessions cannot be ended one at a time" copy are gone |
| `AccountLifecyclePanel.jsx` | Wires the session props, holds the row queued for revocation, adds the per-session confirmation, sharpens the indefinite-suspension line |
| `WarnDialog.jsx` | Takes `activeWarningCount`; new `WarningConsequence` block with three branches; the static three-warning sentence is gone |
| `AccountDisciplinePanel.jsx` | Passes the count through, `null` for a moderator; corrected a comment the new payload made false |
| `ViolationHistory.jsx` | The revoked toggle, rendered in every list state; `REVOKED` badge, revoked-by/when line, reduced emphasis; no revoke control on an already-revoked record |
| `ActionDetailDrawer.jsx` | Reads `remainingBannedHashtags` and relabels it; an `escalate_report` row no longer links |
| `SuspendDialog.jsx` | Dated / indefinite radio pair; indefinite omits `durationDays` entirely |
| `AccountContent.jsx` | Renders `mediaUrls` on post rows; the "carries no media field" note is corrected |
| `DateRangeControl.jsx` | New `unsetHint` prop; states the half-open boundary |
| `AdminShell.jsx` | *my escalations* nav entry, both roles |

---

## Screens and routes

| File | Change |
|---|---|
| `ReportDetailScreen.jsx` | The read-only panel and `isReadOnlyType` deleted, with the import the panel needed; new confirmation and success copy wired |
| `AuditLogScreen.jsx` | `TargetFilter`, the window control, `MAX_WINDOW_DAYS`, URL-held `target`/`from`/`to`, `commitRange` moving both bounds in one history entry |
| `MyEscalationsScreen.jsx` *(new)* | The escalations list |
| `ActivityLogScreen.jsx` | Copy is environment-aware and counts the offered types rather than saying "three" |
| `adminRoutes.jsx` | The escalations route, outside the administrator-only guard |
| `config/constants.js` | `ROUTES.ADMIN_MY_ESCALATIONS` |

---

## Outside the panel's directories

One file, named and justified as the phase requires.

**`src/features/luvax/components/primitives.jsx`** — `LxBtn` now forwards a `type` prop.

**Why.** `DateRangeControl` already passed `type="button"` to its preset buttons and `type="submit"`
to its apply button; `LxBtn` accepted neither, so both fell through to the browser's `submit`
default. Clicking a preset submitted the form as well as applying the preset, and with the draft
fields still empty the submit handler set an error note. The result was a false statement on screen —
*enter both a start and an end before applying* — displayed while a window was applied and rows were
showing.

**Scope of the change.** The prop is forwarded, **not defaulted**, so every existing call site keeps
the browser's own behaviour and nothing else in the application changes.

**Verified.** Reproduced from a clean page before the fix; after it, the message is gone and the
preset still commits (URL gains `from`/`to`). The defect predates this phase and affected the
activity log's copy of the same control, so it was fixed at the root rather than worked around in one
caller.

No other change was made outside `src/features/admin/` and `src/config/constants.js`. The
user-facing application was otherwise only **read**, to verify its settings page now loads.

---

## Documentation corrected in place

Earlier phases' documents that this phase reversed or invalidated. A reader opening any of these must
not find the old answer stated as current.

| Document | Correction |
|---|---|
| `admin-panel-moderation-history-and-audit/design-decisions.md` | The audit-row link is no longer the route to your own escalations |
| `admin-panel-moderation-history-and-audit/deferred-findings.md` | Revoked records no longer vanish |
| `admin-panel-moderation-history-and-audit/discipline-contract-verification.md` | The action log now declares a target filter and a time window |
| `admin-panel-accounts-and-hashtags/accounts-contract-verification.md` | `durationDays` is optional; omitting it suspends indefinitely |
| `admin-panel-foundation-and-reports/report-contract-verification.md` | `droppedHashtags` → `remainingBannedHashtags`, meaning changed |
| `admin-panel-foundation-and-reports/design-decisions.md` | Per-id resolution replaced by the batch endpoint |
| `admin-panel-reconnaissance/api-contract-verification.md` | Same rename |
| `admin-panel-observability-and-hardening/deferred-findings.md` | The event filter question is answered; the recommender service is deployed locally |
| `admin-panel-observability-and-hardening/observability-contract-verification.md` | The four engagement types no longer dead-letter |
| `docs/admin-panel/backend-request.md` | Delivered items marked delivered, not deleted |

Each correction is an inline note naming this phase, left beside the original text rather than
replacing it, so the record of what was true then survives.
