# Accounts and Hashtags — Contract Verification

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 3. Written from live calls against the running backend (dev profile) and, where marked,
from the backend source. Committed before any feature code.

Callers used: `seed_admin` (admin), `seed_mod` (moderator), `seed_carol` (ordinary user, for the
force-logout session test). All seed accounts use password `SeedPass123!`. Seed ids:

| Account | Role | Id | Notes |
|---|---|---|---|
| seed_admin | admin | dc96ae05-6b6e-40a0-b62c-3b9111346aa6 | the caller; also the only admin (self == admin target) |
| seed_mod | moderator | e13ebd6a-dde8-46a8-a882-42844934b462 | |
| seed_alice | user | ef48f585-03b1-413e-8353-a77259104025 | suspended, carries one warning (suspended target) |
| seed_bob | user | b91de5cd-fe2e-4d3a-80c9-96bb7595976c | active (active target) |
| seed_carol | user | a0bcedec-e369-497a-a9c9-6e2843dabe00 | active; used for the force-logout test |
| t_msydqu3a4wi67 | user | 4a450850-aeb7-4849-8fe7-c99a55813c3d | disposable, left **banned** (banned target) |

---

## 3.1 The capabilities object

**Endpoint.** There is no standalone capabilities endpoint. Capabilities are a field of the
account detail: `GET /api/v1/admin/users/{userId}` returns `AdminUserDetailResponse`, whose
`capabilities` property is `AdminUserCapabilitiesResponse`.

**Who may call.** Administrator only. A moderator receives **403 FORBIDDEN** on
`GET /admin/users/{userId}` (and on `/admin/users` and `/admin/users/search`). The whole account
surface — list, search, detail, every lifecycle action — is administrator-only. Verified live.

**Fields** (three, coarse — not one flag per action):

| Field | Type | Governs |
|---|---|---|
| `canChangeStatus` | boolean | Whether **any** status action (ban / unban / suspend / unsuspend) is legal against the target. It does not say which; the current `status` decides which transition applies. |
| `canChangeRole` | boolean | Whether a role change is legal at all. True iff `assignableRoles` is non-empty. |
| `assignableRoles` | string[] (`user`/`moderator`/`admin`) | The exact set of roles the target may be moved to. This is the only source of which role transitions to offer. Promotion to administrator appears here as `"admin"` in the list. |

There is **no** capability field for force-logout (see 3.3).

**Fetched with the detail, and does not update without a refetch.** Capabilities arrive inside the
detail payload. No action response (`AdminActionResponse`) carries capabilities, so after any
action the detail must be refetched to obtain the new `status`, `suspendedUntil`, and capabilities.

**Six target types, from the admin caller:**

| Target | status | canChangeStatus | canChangeRole | assignableRoles |
|---|---|---|---|---|
| ordinary active (bob) | active | true | true | `["moderator"]` |
| suspended (alice) | suspended | true | true | `["moderator"]` |
| banned (disposable) | banned | true | true | `["moderator"]` |
| moderator (seed_mod) | active | true | true | `["user","admin"]` |
| administrator (seed_admin) | active | **false** | **false** | `[]` |
| self (seed_admin — same account) | active | **false** | **false** | `[]` |

**Self-targeting / acting on an administrator.** For the admin viewing their own account, every
capability is false and `assignableRoles` is empty — the server refuses to let an administrator
act on themselves through the capabilities object, so the panel renders no lifecycle control for
the caller's own account without computing anything. The only administrator in the seed set is the
caller, so "administrator target" and "self" coincide here; the backend source
(`AdminAuthorizationServiceImpl.evaluateActorAndTarget`, read from source) shows they are distinct
reasons that both yield all-false capabilities: `SELF_TARGET` when actor == target, and
`TARGET_IS_ADMIN` when the target is any administrator. Either way **no administrator, self or
other, is actionable, and an administrator can never be demoted** — which is what makes promotion
to administrator irreversible.

---

## 3.2 Account list and search

**List — `GET /api/v1/admin/users`.** Administrator only. Declared query parameters, exactly:

| Param | Type | Notes |
|---|---|---|
| `status` | enum `active`/`suspended`/`deactivated`/`banned` | optional |
| `role` | enum `user`/`moderator`/`admin` | optional |
| `cursor` | string | optional |
| `limit` | int 1..100, default 20 | optional |

Two real filters, `status` and `role`. No text filter on the list (that is search). Undeclared
query params are rejected 400 by the backend, so only these four are ever sent.

**Row shape — `AdminUserListItemResponse`.** `id`, `username`, `email`, `displayName` (nullable),
`role`, `status`, `isVerified`, `isPrivate`, `createdAt`, `lastLoginAt` (nullable), `deletedAt`
(nullable). Carries role and status, so a row is fully renderable and triage-able without a second
fetch.

**Search — `GET /api/v1/admin/users/search`.** Administrator only. Params: `q` (required), `cursor`,
`limit` (1..100, default 20). Behaviour, verified live:

- `q=""` → **400 BAD_REQUEST**. `q="   "` (whitespace) → **400 BAD_REQUEST**.
- `q="a"` (1 char) → **400 BAD_REQUEST**. `q="ab"` (2 chars) → **200**. **Minimum length is 2.**

**Rate limit, established by calling until refused.** Hammering `/admin/users/search` refused on
the **60th** request in the window with **429**, code **`TOO_MANY_REQUESTS`**, **`Retry-After: 60`**.
The limiter counts even the 400 (too-short) requests toward the window. Dev budget is 60 / 60s;
**production budget is 40 / 60s** for both admin search endpoints (`application-prod.yml`), stricter
than the prompt's stated "60 per minute" (that figure is the dev budget). The client is built to the
production 40/min discipline.

**Same row shape.** List and search both return
`CursorPageResponseAdminUserListItemResponse` — identical rows, so one renderer serves both.

---

## 3.3 Lifecycle actions

All administrator only; a moderator gets 403; the caller must be an administrator
(`ACTOR_NOT_ADMIN` → FORBIDDEN, from source). All responses are `ApiResponseAdminActionResponse`
(`AdminActionResponse`: id, adminId, actionType, targetUserId, targetEntityType, targetEntityId,
reportId, reason, metadata, createdAt).

| Action | Method + path | Body | Required | Ineligible refusal | Self refusal |
|---|---|---|---|---|---|
| ban | `PATCH /admin/users/{id}/ban` | `AdminActionRequest` {reason, reportId?} | reason | 409 `ADMIN_INVALID_TRANSITION` (already banned) | 409 `ADMIN_SELF_ACTION_NOT_ALLOWED` |
| unban | `PATCH /admin/users/{id}/unban` | `AdminActionRequest` | reason | 409 `ADMIN_INVALID_TRANSITION` (not banned) | — (server-refused via capabilities) |
| suspend | `PATCH /admin/users/{id}/suspend` | `AdminSuspendUserRequest` {reason, reportId?, durationDays?} | reason | 409 `ADMIN_INVALID_TRANSITION` (already suspended) | as above |
| unsuspend | `PATCH /admin/users/{id}/unsuspend` | `AdminActionRequest` | reason | 409 `ADMIN_INVALID_TRANSITION` (not suspended) | as above |
| role change | `PATCH /admin/users/{id}/role` | `AdminRoleChangeRequest` {role, reason} | role, reason | 409 `ADMIN_ROLE_TRANSITION_NOT_ALLOWED` (no-op / skip-level) | 409 `ADMIN_SELF_ACTION_NOT_ALLOWED` |
| force logout | `POST /admin/users/{id}/force-logout` | `AdminActionRequest` | reason | — (always permitted) | permitted (see below) |

**Suspend form.** `durationDays` is an integer, **unit days**, bounds **1..3650**. Verified:
`durationDays: 3` → 200, `suspendedUntil` set to now + 3 days (`AdminUserDetailResponse.suspendedUntil`);
`durationDays: 9999` → **400 VALIDATION_ERROR** (over max). `reason` is the only required field in
the schema; the panel treats `durationDays` as a required, bounded input because showing a resulting

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** `durationDays` is **optional**. Omitting it suspends indefinitely: `200`, then `status = suspended` with `suspendedUntil = null`, and the reinstatement sweep never matches it. The panel now offers an indefinite suspension alongside a dated one. The 1..3650 bounds remain correct when a duration *is* given.

end time needs one. The server accepts a duration, not an end time; the panel computes and displays
`now + durationDays` in local time before confirming.

**Role transitions (read from source — `AdminAuthorizationServiceImpl`, plus live confirmation):**

- Permitted: `user → moderator`; `moderator → user`; `moderator → admin`.
- Refused `ADMIN_ROLE_TRANSITION_NOT_ALLOWED`: `user → admin` (skip-level, live 409); target==requested (no-op, live 409).
- Refused `ADMIN_SELF_ACTION_NOT_ALLOWED`: any self role change (live 409).
- Refused `ADMIN_TARGET_PROTECTED` (from source; not observable live with one admin): any role change targeting an existing administrator.
- **`moderator → admin` is the one-way door.** Once a target is `admin`, `TARGET_IS_ADMIN` blocks
  every further role change on them, so promotion to administrator cannot be reversed through the
  API. `assignableRoles` for a moderator includes `"admin"`; the panel surfaces exactly that and no
  more, and **this transition was not performed during verification.**

**Force logout — performed, both outcomes recorded (settles the previous phase's open question).**
Logged in as seed_carol, captured a live access token and refresh token. `POST force-logout` → 200,
`metadata: {"revokedSessions": 6}`. Then, with carol's still-issued credentials:

- carol's old **access token** → `GET /users/me` = **401** (the token-epoch increment invalidates
  every already-issued access token immediately, on the REST path via `TokenPrincipalResolver`).
- carol's **refresh token** → `POST /auth/refresh` = **401 `AUTH_REFRESH_TOKEN_INVALID`** (all
  refresh tokens revoked).
- carol re-login → succeeds.

From source (`AdminUserServiceImpl.forceLogout`): it revokes all refresh tokens **and** increments
the token epoch in the same transaction. The previous phase found a bare epoch bump insufficient
because the refresh token survived; force-logout does **both**, so it fully ends the session on the
access-token and the refresh paths alike. Force-logout has **no capability flag and no self/admin
protection** in the service — it is administrator-only but permitted against any target including
self and other administrators.

---

## 3.4 Hashtag registry

Administrator only; a moderator gets **403** on `GET /admin/hashtags`.

**List — `GET /api/v1/admin/hashtags`.** Params: `status` (enum `active`/`banned`/`deleted`),
`cursor`, `limit` (1..100, default 20). Row — `HashtagAdminResponse`: `id`, `name`, `postCount`,
`status`, `statusNote` (nullable), `statusAt` (nullable), `statusBy` (nullable uuid), `createdAt`.

**Search — `GET /api/v1/admin/hashtags/search`.** Params: `q` (required), `status`, `cursor`,
`limit`. Same row shape. `q=""` → **400 BAD_REQUEST**; `q="a"` → **200** — **minimum length 1**
(note: differs from user search, which requires 2). Rate limit: same bucket rule as user search —
dev 60/min, **prod 40/min**, separate bucket from user search.

**Create — `POST /api/v1/admin/hashtags`.** Body `AdminCreateHashtagRequest` {name (≤101), status
(enum), note (≤2000)} — all three required. Returns **201 CREATED** with an
**`AdminActionResponse`** (the audit action), not the hashtag. The created hashtag's identifier is
**`targetEntityId`** — confirmed by fetching it back: `search?q={name}` returns a row whose `id`
equals the create response's `targetEntityId`. The response's own `id` is the audit action's id and
does **not** resolve to a hashtag. `actionType` is `create_hashtag`.

**Duplicate — 409 `HASHTAG_ALREADY_EXISTS`.** Shown against the name input, not as a generic toast.

**Statuses and transitions.** Status enum: `active`, `banned`, `deleted`. Transitions via
`PATCH /admin/hashtags/{id}` (`AdminUpdateHashtagRequest` {status, note} both required):
`active → banned` = 200, `banned → active` = 200. Returns `AdminActionResponse`.

**Delete — `DELETE /admin/hashtags/{id}`.** Body `AdminDeleteHashtagRequest` {reason (required)}.
Returns 200 `AdminActionResponse` (`delete_hashtag`). **Delete marks, does not remove:** after
delete the tag still resolves in `search`, now with `status: "deleted"` and the reason in
`statusNote`. It is a soft, status-based delete — the record persists and stays queryable under the
`deleted` status filter.

---

## 3.5 Warning count

`AdminWarnUserResponse` (the warn **response**) carries **`activeWarningCount`** (integer) alongside
`strikeIssued`, `strike`, and `resultingStatus`. So the resulting active-warning count is available
**after** issuing a warning.

**Before** issuing, no read exposes it: `GET /admin/violations/for-user/{id}` returns
`{content, pageInfo, degraded}` — a cursor page with **no total and no count field**; its warning
rows are `{kind, id, userId, actorId, reasonKey, note, createdAt}` with no ordinal.
`AdminUserDetailResponse` carries no warning or strike count. `GET /users/me/warnings` is likewise a
cursor page with no total.

Conclusion: the current active-warning count **cannot** be determined before issuing without
fabricating it from a partial page (warnings span pages and revoked ones leave the list). The panel
therefore shows no pre-issue count (recorded in `deferred-findings.md`) and surfaces the honest
post-issue `activeWarningCount` in the success feedback. The static "three active warnings issue a
strike" rule remains stated.

---

## Divergence table

### Against this prompt

| Prompt says | Server / source is | Impact |
|---|---|---|
| Capabilities as per-action legality flags | Three coarse fields: `canChangeStatus`, `canChangeRole`, `assignableRoles[]`. No force-logout flag. | Status controls gate on `canChangeStatus` and derive which transition from `status`; role controls come entirely from `assignableRoles`; force-logout is handled outside capabilities. |
| Suspend "takes a duration or an end time" | `durationDays` integer, unit days, 1..3650. No end-time form. | Panel collects days, computes end time locally for display. |
| Search "production limit is 60 per minute" | Prod is **40/min**; 60/min is the dev budget. | Debounce/min-length built to 40/min. |
| Account list/search callable by a reviewer generally | Administrator only; moderator gets 403 on the entire account surface. | Account list/search and detail lifecycle controls are administrator-only; a moderator on `/admin/users/:userId` sees the discipline surfaces only (capabilities unavailable → no lifecycle control). |
| Hashtag create identifier "field you verified" | `targetEntityId`. | Read new id from `targetEntityId`. |
| Every path/param/field named in the prompt | Confirmed against OpenAPI; all lifecycle paths exist as named except force-logout is **POST** (not PATCH). | No path invented. |

### Against `admin-panel-reconnaissance/api-contract-verification.md`

No contradiction found. That document mapped the endpoint matrix; this one adds the account and
hashtag request/response shapes, the capabilities object, and the live rate-limit and force-logout
readings it deferred.

### Against `admin-panel-foundation-and-reports` (design-decisions / deferred-findings)

Consistent. The report-anchored `reportId` optional field on action requests (`AdminActionRequest`,
`AdminSuspendUserRequest`) matches the foundation's report-linking pattern. The `ApiResponse`
envelope, cursor `pageInfo`, and 400-on-undeclared-param contract hold here unchanged.

### Against `admin-panel-moderation-history-and-audit/discipline-contract-verification.md`

Consistent and extends it. That phase deferred the `adminId` audit filter for want of a user picker
(now built), and could not settle whether force-logout ends a session (now settled: it does, via
epoch + refresh revocation). The warning/strike ladder (strike every third warning) is unchanged;
this phase adds that `activeWarningCount` is exposed only on the warn response, not on any read.
