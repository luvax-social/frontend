# Completion Audit

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

The panel is finished at the end of this phase. This establishes that it actually is.

Everything below was seen working in the browser **during this phase**, not carried forward from a
previous phase's word.

---

## 1. The fifteen screens

Section 14 of the backend handoff describes fifteen screens (14.1 – 14.15) plus the application
shell (14.0).

**Fifteen screens, ten routes.** Five of the fifteen are surfaces of one account, not destinations
of their own: post moderation, comment moderation, warning issuance, and violations history all
belong to the account they act on, so they are composed onto the account route rather than given
separate addresses a reviewer would have to navigate between while looking at one person. Warning
issuance and violations history additionally appear on the report detail, so a reviewer deciding a
report can see the owner's record and act on it without leaving the report. Each is listed
separately below with where it lives.

| # | Screen (handoff §14) | Route | Reachable by | Seen working this phase |
|---|---|---|---|---|
| 14.1 | Login | `/login` | anyone | Yes — signed in as administrator, as moderator, and as an ordinary account; a moderator lands on `/admin/reports` |
| 14.2 | Report queue | `/admin/reports` | moderator, administrator | Yes — both roles. Empty state seen for a moderator with no pending reports; populated state seen after a report was created |
| 14.3 | Escalated queue | `/admin/escalated` | administrator only | Yes — administrator sees it; moderator gets the not-available page and never calls the count endpoint |
| 14.4 | Report detail | `/admin/reports/:reportId` | moderator, administrator | Yes — post target, user target, and message target; both roles; conflict path exercised |
| 14.5 | Post moderation | `/admin/users/:userId` → posts tab | moderator, administrator | Yes — removed and restored a post twice, including the dropped-hashtag path |
| 14.6 | Comment moderation | `/admin/users/:userId` → comments tab | moderator, administrator | Yes — tab renders with its empty state on an account with no comments |
| 14.7 | Warning issuance | warn dialog on `/admin/users/:userId` and on the report detail | moderator, administrator | Yes — six warnings issued through the dialog, including the third that suspends |
| 14.8 | Violations history | discipline card on `/admin/users/:userId` and on the report detail | moderator, administrator | Yes — warnings-only for a moderator, warnings and strikes for an administrator, revoke exercised |
| 14.9 | My action log | `/admin/actions` | moderator | Yes — moderator sees a table of its own actions |
| 14.10 | Full action log | `/admin/actions` | administrator | Yes — administrator sees every actor, including system-issued strikes |
| 14.11 | Account list and search | `/admin/users` | administrator only | Yes — paginated all 170 accounts, filtered, searched |
| 14.12 | Account detail | `/admin/users/:userId` | moderator (discipline and content), administrator (everything) | Yes — both roles; lifecycle actions, sessions, and reports-against exercised as administrator |
| 14.13 | Hashtag registry | `/admin/hashtags` | administrator only | Yes — listed, created, hit the duplicate-name error, changed a status |
| 14.14 | Statistics | `/admin/statistics` | administrator only | Yes — pre-collection, with data, empty window, gap, zero series, granularity block, rate-limit refusal |
| 14.15 | Activity log | `/admin/activity` | administrator only | Yes — unbounded state, results, empty result, window clamp, event-type filter |
| 14.0 | Application shell | wraps every `/admin` route | both, branching on role | Yes — role-correct navigation on first paint after reload, escalated badge, sign out |

One route exists that is not a screen: `/admin` redirects to the report queue, and any unknown
`/admin/*` path renders a not-found inside the shell.

---

## 2. The moderator tree, walked end to end

Signed in as `mod@seed.local` in its own browser context, with the administrator context signed in
simultaneously (both identities read in the same tick: `@seed_admin` and `@seed_mod`).

**Navigation offered:** `reports`, `actions`. One group, `moderation`. Nothing else.

| Route | Result | Screenshot |
|---|---|---|
| `/admin/reports` | Renders. Empty when no pending report exists, populated when one does | [tree-mod-reports.png](screens/tree-mod-reports.png), [tree-mod-reports-with-pending.png](screens/tree-mod-reports-with-pending.png) |
| `/admin/reports/:id` | Renders. Escalate available on a pending report; resolve and dismiss absent once escalated | [tree-mod-report-detail.png](screens/tree-mod-report-detail.png), [tree-mod-escalated-report-no-close-controls.png](screens/tree-mod-escalated-report-no-close-controls.png) |
| `/admin/actions` | Renders the moderator's own actions | [tree-mod-actions.png](screens/tree-mod-actions.png) |
| `/admin/users/:userId` | Renders discipline and content only. No state-and-actions card, no session list | [tree-mod-account-detail.png](screens/tree-mod-account-detail.png), [tree-mod-violations-warnings-only.png](screens/tree-mod-violations-warnings-only.png) |
| `/admin/users` | Not available | [tree-mod-accounts-BLOCKED.png](screens/tree-mod-accounts-BLOCKED.png) |
| `/admin/hashtags` | Not available | [tree-mod-hashtags-BLOCKED.png](screens/tree-mod-hashtags-BLOCKED.png) |
| `/admin/escalated` | Not available | [tree-mod-escalated-BLOCKED.png](screens/tree-mod-escalated-BLOCKED.png) |
| `/admin/statistics` | Not available | [tree-mod-statistics-BLOCKED.png](screens/tree-mod-statistics-BLOCKED.png) |
| `/admin/activity` | Not available | [tree-mod-activity-BLOCKED.png](screens/tree-mod-activity-BLOCKED.png) |

The five refused routes render the not-available page. **None of them mounts a table**, and none
issues a request that is then refused.

**Instrumented across the whole walk:** 43 API calls, **0 requests to the escalated-count endpoint**,
**0 requests to any administrator-only endpoint**, **0 responses with status 403**, **0 console
errors**.

---

## 3. The administrator tree, walked end to end

Signed in as `admin@seed.local`.

**Navigation offered:** `reports`, `actions` under `moderation`; `escalated` (with its live count
badge), `accounts`, `hashtags`, `statistics`, `activity` under `administration`. Seven links.

| Route | Result | Screenshot |
|---|---|---|
| `/admin/reports` | Renders | [tree-admin-reports.png](screens/tree-admin-reports.png) |
| `/admin/escalated` | Renders | [tree-admin-escalated.png](screens/tree-admin-escalated.png) |
| `/admin/reports/:id` | Renders, post target and user target | [tree-admin-report-detail-post-escalated.png](screens/tree-admin-report-detail-post-escalated.png), [tree-admin-report-detail-user-target.png](screens/tree-admin-report-detail-user-target.png) |
| `/admin/actions` | Renders, all actors including system | [tree-admin-actions.png](screens/tree-admin-actions.png), [tree-admin-action-log-drawer.png](screens/tree-admin-action-log-drawer.png) |
| `/admin/users` | Renders | [tree-admin-accounts.png](screens/tree-admin-accounts.png) |
| `/admin/users/:userId` | Renders with lifecycle, sessions, reports-against, discipline, content | [tree-admin-account-detail.png](screens/tree-admin-account-detail.png), [sessions-list.png](screens/sessions-list.png) |
| `/admin/hashtags` | Renders | [tree-admin-hashtags.png](screens/tree-admin-hashtags.png) |
| `/admin/statistics` | Renders | [tree-admin-statistics.png](screens/tree-admin-statistics.png) |
| `/admin/activity` | Renders | [tree-admin-activity.png](screens/tree-admin-activity.png) |

**Instrumented over an eleven-route sweep:** **0 console errors**, **0 responses with status ≥ 400**,
no screen crashed, and no numbered pagination control exists on any of them.

---

## 4. No control returns 403

Both role trees were instrumented for 403 responses across every route and every control that
renders. **Zero 403 responses were recorded in either tree.**

This holds structurally rather than by luck:

- Administrator-only routes sit behind a guard, so their screens never mount for a moderator and
  never fire a request.
- The escalated-count poll is gated on the role, so a moderator never starts it.
- Account lifecycle controls render from the server's own capabilities object, so a control the
  server would refuse is never drawn.
- The two reads that would 403 for a moderator — the account detail, needed for a target's role and
  status — are now explicitly disabled for a moderator rather than fired and discarded.

## 5. No screen exists that its role cannot use

Every route in the panel is reachable and useful to at least one role, and every route a role can
reach is fully usable by it. The moderator's account detail is the only partial surface: it shows
discipline and content and withholds the administrator-only lifecycle card. It withholds it
entirely rather than rendering an empty card, so the moderator sees a complete screen, not a
truncated one.

---

## 6. The user-facing application is unbroken

Signed in as an ordinary account (`carol@seed.local`) in its own context and walked the whole path.

| Step | Result | Screenshot |
|---|---|---|
| Sign in | Lands on `/app` | — |
| Feed | Renders with posts | [userapp-feed.png](screens/userapp-feed.png) |
| Open a post | Renders with its comments | [userapp-post.png](screens/userapp-post.png) |
| Comment | **Posted and appeared** — the new comment's text was found in the page after submission | [userapp-post.png](screens/userapp-post.png) |
| Profile | Renders, showing the signed-in account | [userapp-profile.png](screens/userapp-profile.png) |
| Settings | Renders in full — account, appearance, and privacy sections. **Still produces two not-found responses on the settings read**, which is the pre-existing defect diagnosed in work item 3.4 | [userapp-settings.png](screens/userapp-settings.png) |

The settings defect was reproduced end to end and diagnosed to the backend and its seed script; the
frontend requests the correct path. Per the phase constraint it was recorded and nothing was
changed. It is item 6 of `docs/admin-panel/backend-request.md`.

**No user-facing application code was modified by this phase.** The only file changed outside
`src/features/admin/` is `src/config/constants.js`, which gained two route constants for the two new
panel routes.

---

## 7. Nothing unresolved sits outside the two documents

Every open item from all four phases now lives in exactly one of two places:

- **`docs/admin-panel/backend-request.md`** — everything that needs the backend. Ten grouped items,
  gathered from all four phases plus this one.
- **`docs/admin-panel-observability-and-hardening/deferred-findings.md`** — everything else still
  open, each tagged with its owner.

The two `explained` items from the hardening sweep (a second administrator cannot be created
reversibly; the hashtag registry has no post-create navigation) are recorded in the sweep itself with
their reasoning, and the first is carried into `deferred-findings.md` as the one check that a future
environment with two administrators should re-run.

Fixture state this phase leaves behind is listed in `deferred-findings.md` so the next person is not
surprised by it.
