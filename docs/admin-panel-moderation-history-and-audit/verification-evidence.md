# Verification Evidence

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every check below was driven against the running application at `http://localhost:5173`
(backend `http://localhost:8080`) in a real browser through the Playwright plugin. Reasoning is
never counted as verification. Two browser contexts held a moderator (`seed_mod`) and an
administrator (`seed_admin`) session simultaneously for the role-split checks; a third short-lived
context held an ordinary user (`seed_carol`) for the user-app regression.

Screenshots are under `screens/` and linked from the check they evidence.

---

## Section A — Carry-over corrections (Work Item 3)

### A.1 Reduced motion, exercised through Playwright media emulation

The previous phase listed reduced motion under "what could not be verified", stating the browser
tooling could not toggle it. That is false: Playwright emulates it directly.

**Driven.** Signed in as the administrator, emulated the preference with
`page.emulateMedia({ reducedMotion: 'reduce' })`, confirmed
`window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`, then loaded the report
queue and a report detail under the preference.

**Observed.**
- `matchMedia('(prefers-reduced-motion: reduce)').matches` → `true`.
- Computed `transition-duration` on `.lx-admin-navlink` → `1e-06s` (the global rule at
  `src/index.css:594` collapsed it; a `!important` stylesheet rule overrides even the panel's
  inline-style transitions).
- Running animations under the preference → **0**.
- Report queue and report detail rendered correctly, no residual motion.
- Console: 0 errors, 0 warnings.

**Conclusion.** The app already honours the preference through the universal reduced-motion block;
the panel adds no motion that bypasses it. Nothing animated; nothing needed fixing. The claim was
removed from the previous phase's `orchestrator-brief.md`.
Evidence: `screens/reduced-motion-report-queue-desktop.png`,
`screens/reduced-motion-report-detail-desktop.png`.

### A.2 Other previously skipped-for-tooling checks

The only other limitation the previous phase recorded is the message-target report, which was not
skipped for lack of tooling but for lack of conversation/message fixtures the panel does not build
— a data limitation, not a browser-tooling one. Playwright cannot conjure the fixtures either, so
it stays a data limitation. No other tooling-blocked check was found that the tooling could in
fact have run.

---

## Section B — Violation history

### B.1 Two roles, same account, same moment (DoD 6, 7)

Both contexts open at once, viewing `seed_alice` (5 warnings + 1 strike) at the same moment:

| Context | Records shown | Revoke controls |
|---|---|---|
| administrator | strike #1 **and** 5 warnings (6 records) | present on every record |
| moderator | 5 warnings only, **no strike** | none (0 revoke buttons, measured) |

The administrator sees the strike branch and the warning branch; the moderator sees warnings only
and is not told a strike exists. Rendering branches on the union discriminator `kind` (verifiable
in `ViolationHistory.jsx`: `record.kind === 'warning'` vs `record.kind === 'strike'`), never on a
field being present. A strike renders "strike #N" with a critical-tone badge; a warning renders
its reason label and note with a caution-tone badge.
Evidence: `screens/violation-history-administrator-desktop.png`,
`screens/violation-history-moderator-desktop.png`.

### B.2 Cross-role cursor (DoD 8)

The violations query key includes the caller's role (`listQueryKey('violations', role, …)`), so the
panel never issues a cursor minted for the other role. At the API level a cross-role replay returns
`INVALID_CURSOR` (recorded in the contract doc §4.1.4), which the error map classifies silent
(discard cursor, restart). No user-visible error can arise because the role-keyed query prevents
the cross-role cursor from ever being sent.

### B.3 Empty history (DoD 10)

`seed_bob` (no discipline) shows the healthy empty state: "clean record — no warnings or strikes on
file for this account." (administrator wording; the moderator wording omits strikes).
Evidence: `screens/violation-history-empty-and-content-empty-desktop.png`.

### B.4 On the report detail (DoD 11)

The escalated report `d52c5431` (owner `seed_alice`) renders the report, the reported content, and
the actions first; an "account history" region loads below through its own query and never blocks
them, showing the owner's strike, warnings, the revoke controls, and the "issue warning" control.
This closes the two items the previous phase deferred (the owner's history panel and the
warn-the-owner control). When a target carries no owner id the region is absent rather than empty.
Evidence: `screens/violation-history-on-report-detail-desktop.png`.

### B.5 Revocation and the record-leaves divergence (DoD 9)

Requirement 5.1.6 asks for a revoked record to stay visible, marked revoked. The backend does not
support that: revoking a warning or strike **removes it from the list** (contract doc §4.1.5,
count 6→5 with the revoked id absent; strike 5→4). Verified in the browser: revoking
`seed_carol`'s only warning (administrator, through the shared reason confirmation) left the
history reading "clean record". The revocation is not lost — it is preserved in the action log as
a `revoke_warning` action carrying the reason. A revoked record marked-in-place cannot be produced
because the server never returns it; this is stated as a divergence rather than faked.
Evidence: `screens/revoke-confirmation-dialog.png`,
`screens/revoke-result-record-leaves-history.png`.

---

## Section C — Warning issuance

### C.1 Eligibility (DoD 12)

Settled by contract §4.2.2–4.2.3: a moderator MAY warn an ordinary account (200), and an
ineligible (elevated) target is refused with the specific code `ADMIN_TARGET_NOT_WARNABLE`. The
control therefore renders for both roles (option b); the moderator's "issue warning" button is
present on `seed_alice`'s and `seed_carol`'s account views. The rejected option (a, administrator
only) is named in `design-decisions.md`.

### C.2 Vocabulary reason selector (DoD 13)

`scam` was disabled in `report_reason_configs`; a fresh load refetched the vocabulary. The reason
selector opened showing all eight reasons ordered by `sortOrder`, with **"Scam or Fraud" greyed and
labelled UNAVAILABLE**, unselectable, not hidden. `scam` was **restored to enabled afterwards**
(verified through the vocabulary API).
Evidence: `screens/warn-dialog-reason-selector-disabled-entry.png`.

### C.3 Field errors on empty required fields (DoD 14)

Submitting the warn form empty produced a message against the specific field — "select a reason"
under the reason field and "a note is required" under the note field, both with a red border — not
a generic toast. The note counter shows `0/2000`.
Evidence: `screens/warn-dialog-field-errors-empty.png`.

### C.4 Happy path refetches the history (DoD 15)

Selected "Nudity or Sexual Content", typed a note, submitted. The dialog closed and the new warning
appeared at the top of the discipline history without a page reload (the mutation invalidates the
violations query). Verified by reading the top record after submit.

### C.5 Server VALIDATION_ERROR mapping

`VALIDATION_ERROR.data` maps onto the same per-field slots (`reasonKey`, `note`); a key matching no
field is ignored. A disabled reason (`WARNING_REASON_DISABLED`, 422), an ineligible target
(`ADMIN_TARGET_NOT_WARNABLE`, 403), and a self-action (`ADMIN_SELF_ACTION_NOT_ALLOWED`, 409) are
surfaced as honest toasts, not field errors.

---

## Section D — Per-account content

### D.1 Two views of one screen (DoD 16)

`AccountContent` renders posts and comments as tabs on one screen. `seed_alice` shows two published
posts; `seed_carol` shows two comments.
Evidence: `screens/violation-history-administrator-desktop.png` (posts),
`screens/content-comments-removed-distinguished-desktop.png` (comments).

### D.2 Removed content distinguished (DoD 17)

`seed_carol`'s removed comment renders dimmed with a strikethrough and a "removed" badge, and offers
"restore"; the live comment is normal and offers "remove". A removed post shows `status: removed`.
Evidence: `screens/content-comments-removed-distinguished-desktop.png`.

### D.3 Remove/restore reuse and dropped-hashtag handling (DoD 18, 19)

Remove and restore call the same `adminApi` functions the report detail uses (the API request is
the single copy; only the cache invalidation differs). The restore success message is composed by
one shared helper (`restoreSuccessMessage`) used by both the report detail and the content screen:
it names dropped hashtags only for a post and only when the array is non-empty, and shows no empty
"dropped" text otherwise. Comment restore is handled separately (its response carries no
dropped-hashtag wrapper). The dropped-tag rendering path is evidenced in the drawer
(`screens/drawer-metadata-stripped-hashtags.png`).

### D.4 Empty content (DoD 16 empty), media absence

`seed_bob` shows "no posts — this account has not posted anything." The content row carries no media
field (contract §4.3.4), so no media is rendered; its absence is the row not carrying it, not a
fabricated placeholder.
Evidence: `screens/violation-history-empty-and-content-empty-desktop.png`.

---

## Section E — Audit log and the detail drawer

### E.1 Role split and counts (DoD 20)

Over the same window: the **moderator** log had **2 rows, all its own** (distinct actor `@seed_mod`
only) — its `escalate_report` and its `warn_user` on `seed_carol`. The **administrator** log had
the full set (20 rows on the first page, every actor). Measured in both contexts.
Evidence: `screens/audit-log-administrator-all-desktop.png`,
`screens/audit-log-moderator-own-only-desktop.png`.

### E.2 No metadata column; opening a row is the only detail fetch (DoD 21)

The list columns are action / by / target / report / when — **no metadata column**. Reading the
network log for a 20-row page: exactly one `GET /admin/actions?limit=20` and four deduplicated
`GET /admin/content/user/{id}` username resolutions (one per distinct user, not per row), and
**zero** `GET /admin/actions/{id}` detail requests. A detail is fetched only when a row is opened.

### E.3 Action types as vocabulary display names; unknown marker (DoD 25)

Types render as display names ("Warn User", "Issue Strike"). Forcing an unrecognised type
(`quarantine_account`, injected) rendered the **raw key with a visible "UNKNOWN" marker** rather
than blank. All 11 observed real types are in the vocabulary (contract §4.5), so no real type is
missing.
Evidence: `screens/audit-unknown-action-type-marker.png`.

### E.4 Filters are only what the endpoint declares (DoD 26)

The only filter is `actionType` (a select of the 22 vocabulary display names); the endpoint
declares only `adminId` and `actionType`, and `adminId` needs an account picker this phase does not
build. No date range or other filter exists, and nothing is filtered client-side.

### E.5 Actor and target resolution; timestamps

Actor and target render as resolved usernames through the existing resolution layer (an unresolved
id shows its short form, honestly). An auto-issued strike (null `adminId`) renders as *system*.
Timestamps render in the viewer's local zone, labelled (e.g. "Asia/Saigon").

### E.6 Every metadata shape renders deliberately (DoD 22)

One drawer screenshot per distinct enumerated shape:

| Shape | Action | Rendering | Screenshot |
|---|---|---|---|
| `{reasonKey}` | warn_user | reason → display name ("Nudity or Sexual Content") | `drawer-metadata-reasonkey-warn-user.png` |
| `{warningIds[], strikeNumber, resultingStatus, consequenceApplied, triggeredByModeratorId}` | issue_strike | rolled-up count, strike number, status, yes/no, resolved actor | `drawer-metadata-issue-strike.png` |
| `{strikeNumber}` | revoke_strike | strike number | `drawer-metadata-strikenumber-revoke-strike.png` |
| `{resultingStatus}` | remove_post | resulting status ("removed") | `drawer-metadata-resultingstatus-remove-post.png` |
| `{resultingStatus, strippedHashtags[]}` | restore_post (injected) | status + "#bannedword, #spam2" | `drawer-metadata-stripped-hashtags.png` |
| `null` | escalate_report | "no additional detail recorded." | `drawer-metadata-null-with-report-link-escalate.png` |

### E.7 Unknown shape renders readably (DoD 23)

Forcing an unenumerated shape (`{escalationTier, reviewerNote, appealWindowHours, context:{…}}`,
injected) rendered each key humanized with its value, the nested object as pretty JSON — no crash,
no blank.
Evidence: `screens/drawer-metadata-unknown-shape-forced.png`.

### E.8 Report route-back, both ends (DoD 24)

The `escalate_report` detail shows "open report d52c5431" (external-link icon). Following it
navigated to `/admin/reports/d52c5431-…`, the actual report. This is the moderator's route back to
a report it escalated. The moderator's own `escalate_report` carries the `reportId`, so the link
exists in the moderator's log too.
Evidence: `screens/drawer-metadata-null-with-report-link-escalate.png` (link),
`screens/violation-history-on-report-detail-desktop.png` (the report it reaches).

### E.9 Moderator opening a foreign action (DoD, §8.2.4)

A moderator opening the detail of an action it did not perform receives 404
(`ADMIN_ACTION_NOT_FOUND`); the drawer renders a calm "action not available". In a moderator's own
log every row is its own, so this does not arise from navigation, but it is handled calmly.
Evidence: `screens/failure-moderator-foreign-action-404.png`.

### E.10 Drawer is portalled, Escape-closes, URL-reflected (DoD 27)

Opening a row set `?action={id}` in the URL; the drawer is portalled to `document.body`; pressing
Escape closed it and cleared the parameter. A specific action is a shareable link.

---

## Section F — Regression, craft, and failure branches

- **Query strings (DoD 28):** the actions list sent only `limit`; content and violations lists send
  only `cursor`/`limit`; the actions filter adds only `actionType`. Guaranteed by `pickParams` and
  read from the network log.
- **Mutation bodies (DoD 29):** built field by field with `buildBody` (warn → `{reasonKey, note}`;
  revoke → `{reason}`; remove/restore → `{reason}`), never spread from form state.
- **Pagination (DoD 30, 31):** lists terminate on `pageInfo.hasNextPage` via the reused
  `getNextPageParam`; the `LoadMore` button renders nothing once it is false. No numbered
  pagination exists anywhere (no endpoint returns a total).
- **Colour (DoD 32):** the code this phase added uses only `--lx-*` tokens through the `v` object;
  no raw hex value appears (grep of the added files for `#[0-9a-fA-F]{3,6}` finds none).
- **Escape (DoD 33):** the warn dialog, the reason listbox, the revoke confirmation, and the action
  drawer all close on Escape.
- **Narrow width (DoD 34):** at 390px the shell collapses to a top bar, the record table scrolls
  inside its own container, and the page body does not scroll sideways
  (`scrollWidth <= innerWidth`, measured for the audit log and the account view).
  Evidence: `screens/audit-log-narrow.png`, `screens/account-view-narrow.png`.
- **Light and dark (DoD 35):** the two list screens render correctly in both themes.
  Evidence: `screens/audit-log-administrator-all-desktop.png` (light) +
  `screens/audit-log-administrator-dark-desktop.png` (dark);
  `screens/violation-history-administrator-desktop.png` (light) +
  `screens/account-view-dark-desktop.png` (dark).
- **Console (DoD 36):** across every non-failure check the console was clean (0 errors). The only
  errors observed were the deliberately injected network-failure branch (aborted
  `GET /admin/actions` requests and the resulting "Unable to reach the server" message), which is
  the state under test, not a defect.

### Failure branches

- **Loading:** the record table shows skeleton rows while the first page is in flight (captured
  mid-retry during the network-failure test).
- **Network failure:** aborting the list request shows the FailedState — "something went wrong /
  Unable to reach the server / try again". Evidence: `screens/failure-audit-network-error.png`.
- **Permission refusal:** a moderator has no revoke control (0 buttons, measured) and receives 404
  on a foreign action detail (calm not-found).
- **Invalid input:** the empty warn submit produces per-field messages (C.3).
- **List boundary:** all lists here fit one page (hasNextPage false), so no LoadMore renders;
  termination is the reused, foundation-verified `getNextPageParam`.

### Regression

- **User-facing app (DoD 37):** signed in as `seed_carol`, the feed loaded with real posts, opened
  a post (`/app/p/c8d4921b`), and added a comment that appeared. Evidence:
  `screens/regression-user-app-feed.png`, `screens/regression-user-app-post-detail.png`,
  `screens/regression-user-app-comment.png`.
- **Report queue and detail (DoD 38):** the queue defaults to `status=pending` (empty here because
  every report was driven to a closed state during verification — correct, not a regression);
  filtering to "all" showed the three closed reports. The report detail renders correctly with the
  new account-history region. Evidence: `screens/regression-report-queue-works.png`,
  `screens/violation-history-on-report-detail-desktop.png`.

---

## Section G — What could not be verified

- **A revoked record shown as still-present and marked revoked (DoD 9 / requirement 5.1.6).** The
  backend removes a revoked record from the violations list and exposes no include-revoked
  parameter, so the panel cannot render a revoked-but-visible record without fabricating data it
  never receives. The honest outcome — the record leaves the history and the revocation is preserved
  in the action log — was verified instead (B.5). This is a contract divergence, not a tooling
  limitation.
- **The `{resultingStatus, strippedHashtags}` metadata shape and an unknown metadata shape** were
  produced by response interception rather than by real backend fixtures, because the reset seed has
  no banned-hashtag post to drop and the backend never emits an unknown shape. The interception
  tested the exact drawer renderer; both are labelled as injected in E.6/E.7. This is a data-fixture
  limitation, not a tooling one.

Nothing appears in this section that the available tooling could in fact have verified.
