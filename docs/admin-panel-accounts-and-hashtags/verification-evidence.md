# Verification Evidence

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every check, what was driven, what was observed. Both role contexts were exercised. Screenshots are
in `screens/` and linked from the check they evidence.

**Tooling note on "simultaneous contexts":** the application authenticates via an HttpOnly refresh
cookie, so two roles cannot be live at once in one browser profile (tabs share the cookie). The
administrator and moderator contexts were therefore exercised sequentially in the same run
(administrator, then moderator, then a regular user for the user-app regression). This is a property
of the app's session model, not a check the tooling could otherwise have run simultaneously.

## Contract (Work Item 3)

- **Verification committed before feature code.** `accounts-contract-verification.md` was committed
  (`docs(admin): record accounts and hashtags contract verification`) before the first line of
  feature code. Full findings there.
- **Every prompt path/param/field checked.** Divergence table in the contract doc: capabilities are
  three coarse fields (not per-action), suspend takes `durationDays` (not an end time), production
  search limit is 40/min (not 60), the whole account surface is administrator-only, the created
  hashtag's id is `targetEntityId`, force-logout is POST. No path was assumed.
- **Capabilities documented field by field, fetched for all six targets** (contract 3.1): active,
  suspended, banned, moderator, administrator, and self.
- **Force logout performed; both outcomes recorded** (contract 3.3): after force-logout, the target's
  old access token → 401 and its refresh → 401 `AUTH_REFRESH_TOKEN_INVALID`; re-login works. Settles
  the previous phase's open question.
- **Search rate limit established by calling**: refused at the 60th request (dev), 429
  `TOO_MANY_REQUESTS`, `Retry-After: 60`.

## Accounts (administrator context)

- **Only declared filters, no client-side filtering** (DoD 6, 22). Network log: unfiltered list is
  `GET /admin/users?limit=20`; the banned filter is `GET /admin/users?status=banned&limit=20` — only
  declared keys. Evidence: `screens/account-list-populated-desktop-light.png`,
  `screens/account-list-filtered-banned-desktop.png`, empty via `screens/account-list-empty-desktop.png`.
- **Search does not fire per keystroke** (DoD 7). Typed the 27-character sentence "seed account
  lookup by name"; the network log shows exactly **one** `GET /admin/users/search?q=...` request.
- **Rate-limit refusal disables for `Retry-After`, no auto-retry** (DoD 8). Exhausted the bucket via
  the API (same user/IP), then a browser search returned 429; the input disabled with "search is
  rate limited. it will be available again in 45s. no automatic retry." and no further request fired.
  Evidence: `screens/account-search-rate-limit-refusal-desktop.png`. Result set and no-results:
  `screens/account-search-results-desktop.png`, `screens/account-search-no-results-desktop.png`.
- **Every lifecycle control renders from capabilities, and they differ** (DoD 9). Observed rendered
  controls per target:
  - active (bob): suspend, ban, change role, force logout — `screens/account-detail-active-desktop.png`
  - suspended (alice): lift suspension, ban, change role, force logout, plus the local-time
    suspension end — `screens/account-detail-suspended-desktop.png`
  - banned (t_): lift ban, change role, force logout — `screens/account-detail-banned-desktop.png`
  - moderator (mod): suspend, ban, change role (offers demote-to-user and promote-to-admin), force
    logout — `screens/account-detail-moderator-desktop.png`
  - self (admin): only "sign out my sessions", with a "this is you" badge —
    `screens/account-detail-self-desktop.png`
- **Capabilities refetched before controls re-render after a success** (DoD 10). Suspended a
  disposable in the browser; the controls changed from "suspend" to "lift suspension" and the
  suspension end appeared, then the disposable was unsuspended and the controls reverted — the detail
  refetch drove the change, not a status guess.
- **With capabilities unavailable, no control renders** (DoD 11). A moderator's detail 403s; the
  moderation screen shows discipline and content but no "state & actions" card and no lifecycle
  control — `screens/moderator-account-detail-no-lifecycle-desktop.png`.
- **Promotion control distinguished, states irreversibility, not pre-armed** (DoD 12). On the
  moderator, the role dialog's "promote to administrator" is its own tone with a "one-way — cannot be
  undone" label; selecting it raises the irreversibility banner and switches the confirm to the
  destructive tone — `screens/promotion-confirmation-irreversibility-desktop.png`. The action was not
  performed.
- **Self-targeting handled** (DoD 13). Refused self actions (ban/suspend/role) do not render for the
  caller's own account; the server-permitted self force-logout renders and its confirmation states
  it signs the reviewer out immediately —
  `screens/account-detail-self-desktop.png`, `screens/self-force-logout-confirmation-desktop.png`.
- **Suspension shows the resulting end time in local time before confirming** (DoD 14). The dialog
  shows "ends Aug 29, 2026, 10:15 AM Asia/Saigon" for a 7-day duration, and 9999 days is blocked with
  "between 1 and 3650" before submission — `screens/suspension-duration-endtime-desktop.png`.
- **Warning count surfaced where the payload supports it** (DoD 15). The warn response carries
  `activeWarningCount` (network response body observed: `activeWarningCount: 2`); the success
  feedback surfaces it. The pre-issue count is unavailable and its absence is recorded in
  `deferred-findings.md`. Evidence: `screens/warning-issued-count-toast-desktop.png`.

## Hashtags (administrator context)

- **Creation reads the new id from `targetEntityId`; the tag is reachable afterward** (DoD 16).
  Created "photography" through the dialog; it appeared in the list immediately (the create response
  is the audit action, id in `targetEntityId`, and the list refetches). Dialog:
  `screens/hashtag-create-dialog-desktop.png`; list: `screens/hashtag-registry-list-desktop.png`.
- **Duplicate refusal shows against the input, not a toast** (DoD 17). Re-creating "photography"
  returned 409 `HASHTAG_ALREADY_EXISTS`; the dialog stayed open with "a hashtag with this name
  already exists" under the name field — `screens/hashtag-duplicate-refusal-desktop.png`.
- **Status transitions are only those the server permits** (DoD 18). Row actions are status-driven:
  active → ban, delete; banned → unban, delete; deleted → restore. All verified server-permitted.
- **Ban confirmation states the post consequence** (DoD 19): "a banned hashtag is blocked from new
  posts, and a post restored later that carries this tag drops it. unbanning returns the tag to
  active." — `screens/hashtag-ban-confirmation-desktop.png`.
- **Delete confirmation states the real verified consequence** (DoD 20): "delete marks this hashtag
  deleted rather than removing it: it stops being usable and the record remains, findable under the
  deleted filter." Performing it moved "nature" to the deleted status with a restore action, not
  removal. Search: `screens/hashtag-search-results-desktop.png`.

## Carry-over (Work Item 7)

- **The audit actor filter exists and works, using account search** (DoD 21). On the administrator
  audit log, the actor picker searched and selected `@seed_admin`; the URL gained `?actor=<id>` and
  the request became `GET /admin/actions?adminId=<id>&limit=20` — only declared params. On the
  moderator audit log ("my actions") the actor filter does not render. Evidence:
  `screens/audit-log-actor-filter-desktop.png`.

## Craft and regression

- **Query strings carry only declared parameters** (DoD 22). Read from the network log: list
  `?limit=20` / `?status=banned&limit=20`; search `?q=...&limit=20`; actions `?adminId=...&limit=20`.
- **Mutation bodies carry only declared fields** (DoD 23). The warn body was `{"reasonKey":"spam",
  "note":"..."}` (network request body). All lifecycle and hashtag bodies are built field by field
  via `buildBody`.
- **Pagination terminates on `hasNextPage`; no numbered pagination** (DoD 24, 25). All lists use
  `LoadMore`, which renders nothing once `hasNextPage` is false; no page numbers exist anywhere.
- **No raw hex in the phase's code** (DoD 26). Every colour is an `--lx-*` token via `v` or the
  `StatusBadge`/tone maps. (Grep evidence in the README.)
- **Every modal/drawer closes on Escape** (DoD 27). Verified on the role dialog and the self
  force-logout confirmation; all dialogs use `useEscapeKey`.
- **Narrow width reflows cleanly** (DoD 28). At 390px, `document.body.scrollWidth` (384) does not
  exceed the viewport on the account list, account detail, and hashtag registry; the tables scroll
  inside their own containers. Evidence: `screens/account-list-populated-narrow.png`,
  `screens/hashtag-registry-list-narrow.png`, `screens/account-detail-suspended-narrow.png`.
- **List screens in light and dark** (DoD 29): `screens/account-list-populated-desktop-light.png` /
  `...-dark.png`; `screens/hashtag-registry-list-desktop.png` / `...-dark.png`.
- **Reduced motion** (DoD 30). Emulated `prefers-reduced-motion: reduce` via Playwright media
  emulation; the confirm button's computed `transition-duration` collapsed to ~0 (the global rule
  neutralises the inline transitions), while the safety arming delay (a JS timeout, not a CSS
  animation) is preserved. Evidence: `screens/account-detail-reduced-motion-desktop.png`.
- **Console errors** (DoD 31). Across the whole panel session only four errors appeared, all from the
  two deliberate negative tests: the 429 rate-limit test (a browser network-resource log plus the
  app's global QueryClient logger) and the 409 duplicate-hashtag test (same pair). Both are handled
  gracefully in the UI. A separate three errors came from the **user-facing** settings page
  (`GET /users/me/settings` → 404), which this phase did not cause and did not change (recorded in
  `deferred-findings.md`).
- **A moderator cannot reach the administrator-only screens** (DoD 32). The moderator nav shows only
  reports and actions; `/admin/users` and `/admin/hashtags` render "not available — this area is
  available to administrators only." Evidence:
  `screens/moderator-accounts-route-blocked-desktop.png`.
- **Previous phases still work** (DoD 33). Moderator report queue renders
  (`screens/regression-report-queue-moderator-desktop.png`); the audit log renders as "my actions"
  with two of the moderator's own actions; violation history, warning issuance, and per-account
  content render on the account moderation screen (visible in the account-detail screenshots).
- **The user-facing application still works** (DoD 34). Signed in as `seed_bob`, the feed rendered
  (empty state), a post opened, and a comment posted successfully (input cleared, comment shown).
  Evidence: `screens/regression-user-app-post-comment-desktop.png`.
