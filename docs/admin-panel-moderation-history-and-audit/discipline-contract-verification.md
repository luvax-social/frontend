# Discipline Contract Verification

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 4. Every claim below was produced by calling the running backend at
`http://localhost:8080` on 2026-08-21, against the reset seed fixture
(`bash scripts/seed-dev-data.sh --reset`, five seed accounts, password `SeedPass123!`).

This document is committed **before any feature code**, per Definition of Done item 3.

The driver is a set of authenticated `urllib` calls made as `seed_mod` (moderator) and
`seed_admin` (administrator). Seed ids used below:

| account | role | id (prefix) |
|---|---|---|
| seed_alice | user | `ef48f585` |
| seed_bob | user | `b91de5cd` |
| seed_carol | user | `a0bcedec` |
| seed_mod | moderator | `e13ebd6a` |
| seed_admin | admin | `dc96ae05` |

---

## Headline findings

1. **The warn endpoint path in the prompt does not exist.** The prompt names
   `POST /api/v1/admin/users/{userId}/warn`. The OpenAPI document and the running server
   expose **`POST /api/v1/admin/warnings/for-user/{userId}`**. Searched: frontend repo,
   branch `feat/admin/moderation-history-and-audit`, `GET http://localhost:8080/api-docs`,
   grep of `paths` for `warn`. The prompt path returns nothing; the `warnings/for-user` path
   is the real one.
2. **A moderator MAY issue a warning** (`200 OK`). Warn is not administrator-only. This
   settles the Work Item 6.1 eligibility question toward option (b).
3. **The violations list omits revoked records.** A revoked warning or strike disappears from
   `GET /admin/violations/for-user/{userId}` entirely; it is not returned with a revoked
   marker. This diverges from requirement 5.1.6 and is discussed in §4.1 and §Divergences.
4. **`AdminViolationResponse` is typed `any` in OpenAPI.** The discriminated union shape is not
   in the spec and was enumerated empirically (§4.1).
5. **`metadata` is absent from every audit list row and present on the per-action fetch.**
   Confirmed across a full page (§4.4). The metadata object's shape depends on the action type;
   the six observed shapes are enumerated in §4.4.

---

## 4.1 Violations — `GET /api/v1/admin/violations/for-user/{userId}`

### Accepted query parameters

`cursor`, `limit`. Only these two (path `userId` aside). A bogus parameter is rejected:
`GET /admin/violations/for-user/{alice}?bogus=1` → **400** (strict-query rule holds on
`/admin/**`).

### 4.1.1 Both roles against the same account, same moment

`seed_alice` was driven to **5 active warnings + 1 active strike** (three warnings auto-issue a
strike; see §4.2). Read at the same moment:

| Caller | HTTP | count | kinds |
|---|---|---|---|
| moderator | 200 | **5** | warning ×5 |
| administrator | 200 | **6** | warning ×5, strike ×1 |

The moderator sees warnings only; the administrator sees warnings **and** strikes. The
moderator's view is complete for a moderator — the strike is simply not part of a moderator's
result set, not a hidden gap.

### 4.1.2 Empty account

`GET /admin/violations/for-user/{bob}` (an account with no discipline) returns:

```json
{ "content": [], "pageInfo": { "hasNextPage": false, "hasPreviousPage": false,
  "startCursor": null, "endCursor": null }, "degraded": false }
```

`data` is always `{ content, pageInfo, degraded }`. The `degraded` boolean is present on every
response (a resilience-fallback flag; `false` throughout this verification).

### 4.1.3 The discriminated union — discriminator field `kind`

The rows are a discriminated union on **`kind`**. Two branches observed:

**`kind: "warning"`**
```json
{ "kind": "warning", "id": "…", "userId": "…", "actorId": "…",
  "reasonKey": "spam", "note": "first warning for repeated spam",
  "createdAt": "2026-08-21T19:17:58.578678Z" }
```

**`kind: "strike"`**
```json
{ "kind": "strike", "id": "…", "userId": "…", "actorId": "…",
  "strikeNumber": 1, "createdAt": "2026-08-21T19:18:43.204484Z" }
```

Fields per branch:

| field | warning | strike |
|---|---|---|
| `kind` | ✓ (`"warning"`) | ✓ (`"strike"`) |
| `id` | ✓ | ✓ |
| `userId` | ✓ | ✓ |
| `actorId` | ✓ | ✓ |
| `createdAt` | ✓ | ✓ |
| `reasonKey` | ✓ | — |
| `note` | ✓ | — |
| `strikeNumber` | — | ✓ |

`reasonKey` and `note` exist only on the warning branch; `strikeNumber` only on the strike
branch. **Rendering must branch on `kind`, never on the presence of `reasonKey`/`strikeNumber`.**
Neither list branch carries a `revokedAt` field (see 4.1.5).

### 4.1.4 Cross-role cursor replay

Cursors are role-scoped. A `limit=2` page issued to each role decodes to a different opaque
prefix (`admvf:` for the administrator, `admvw:` for the moderator). Replaying across roles:

| Cursor issued to | Replayed by | Result |
|---|---|---|
| administrator | moderator | **400 `INVALID_CURSOR`** |
| moderator | administrator | **400 `INVALID_CURSOR`** |

`INVALID_CURSOR` is classified silent (discard cursor, restart from first page) in the
foundation error map. Because the query key includes the caller's role, the panel never issues a
cross-role cursor in practice, so this never surfaces to the user.

### 4.1.5 Revocation removes the record from the list

After `DELETE /admin/warnings/{warningId}` the revoked warning **disappears** from the list
(count 6 → 5; the revoked id is absent). The same holds for a revoked strike
(`DELETE /admin/strikes/{strikeId}`; strike vanishes, count 5 → 4). The endpoint has no
`includeRevoked` parameter (only `cursor`, `limit`), so there is no way to render a revoked
record from this endpoint. The revocation is preserved instead in the **audit log** as a
`revoke_warning` / `revoke_strike` action carrying the reason and metadata (§4.4). See the
Divergences section for the consequence to requirement 5.1.6.

---

## 4.2 Warnings and strikes

### 4.2.1 `POST /api/v1/admin/warnings/for-user/{userId}`

Body `AdminWarnUserRequest`:

| field | type | required | limit |
|---|---|---|---|
| `reasonKey` | string | **yes** | maxLength 50 |
| `note` | string | **yes**, non-blank | maxLength 2000 |

Response `AdminWarnUserResponse`:
```json
{ "warning": { "id","userId","issuedBy","reasonKey","note","revokedAt","createdAt" },
  "activeWarningCount": 1, "strikeIssued": false, "strike": null, "resultingStatus": "active" }
```

**Strike auto-issue:** every third active warning auto-issues a strike. On that call
`activeWarningCount` resets to 0, `strikeIssued` is `true`, `strike` is populated
(`{ id, userId, strikeNumber, triggeredBy, revokedAt, createdAt }`), and `resultingStatus`
becomes `suspended`. There is **no direct strike-issuing endpoint** (searched the OpenAPI:
only `DELETE /admin/strikes/{strikeId}` exists for strikes; strikes originate from warnings).

### 4.2.2 Who may call warn

| Caller | Target | HTTP | code |
|---|---|---|---|
| moderator | ordinary user (`seed_carol`) | **200** | OK |
| administrator | ordinary user | **200** | OK |

**A moderator may issue a warning against an ordinary account.**

### 4.2.3 Elevated / self target

| Caller | Target | HTTP | code | message |
|---|---|---|---|---|
| administrator | moderator (`seed_mod`) | **403** | `ADMIN_TARGET_NOT_WARNABLE` | Only an ordinary account can be warned |
| administrator | self (`seed_admin`) | **409** | `ADMIN_SELF_ACTION_NOT_ALLOWED` | You cannot apply a moderation action to your own account |

The elevated-target refusal is a **specific, distinguishable code** (`ADMIN_TARGET_NOT_WARNABLE`),
not a generic 403. This is the captured evidence that permits Work Item 6.1 option (b).

### 4.2.4 Reason validation and required fields

The reason field takes a **key from the `reportReasons` vocabulary** (not `moderationActions`,
not free text). An unrecognised or disabled key is refused:

| Body | HTTP | code | data |
|---|---|---|---|
| `reasonKey:"spam", note:"…"` | 200 | OK | — |
| `reasonKey:"not_a_real_reason"` | **422** | `WARNING_REASON_DISABLED` | null ("That reason is not available") |
| `reasonKey:"spam", note:""` | **400** | `VALIDATION_ERROR` | `{ "note": "must not be blank" }` |
| `reasonKey:"", note:"…"` | **400** | `VALIDATION_ERROR` | `{ "reasonKey": "must not be blank" }` |

`VALIDATION_ERROR` maps to per-field messages under `data` keyed by field name (`note`,
`reasonKey`). A disabled/unknown reason returns 422 `WARNING_REASON_DISABLED` with `data: null`
(a toast, not a field error).

### 4.2.5 Revocation endpoints

Located in the OpenAPI document:

| Path | Method | Body | Response |
|---|---|---|---|
| `/api/v1/admin/warnings/{warningId}` | **DELETE** | `AdminActionRequest { reason* (≤2000), reportId? }` | `AdminActionResponse` (`revoke_warning`) |
| `/api/v1/admin/strikes/{strikeId}` | **DELETE** | `AdminActionRequest { reason*, reportId? }` | `AdminActionResponse` (`revoke_strike`) |

Who may call:

| Caller | Endpoint | HTTP | code |
|---|---|---|---|
| moderator | `DELETE /admin/warnings/{id}` | **403** | `FORBIDDEN` |
| administrator | `DELETE /admin/warnings/{id}` | **200** | OK |
| administrator | `DELETE /admin/strikes/{id}` | **200** | OK |

**Revocation is administrator-only.** A moderator receives 403 `FORBIDDEN`.

### 4.2.6 A new warning in the list

After issuing a warning the account's violation list gains a `kind: "warning"` row at the top
(ordered by `createdAt` descending). The warn response's `warning.id` matches the new list row's
`id`. Issuing three warnings adds a `kind: "strike"` row as well (administrator view).

---

## 4.3 Per-account content

### 4.3.1 Endpoints and accepted parameters

| Endpoint | Accepted query params |
|---|---|
| `GET /api/v1/admin/content/for-user/{userId}/posts` | `cursor`, `limit` |
| `GET /api/v1/admin/content/for-user/{userId}/comments` | `cursor`, `limit` |

A bogus parameter is rejected: `?bogus=1` → **400 BAD_REQUEST**
"Unsupported query parameter: bogus. Accepted: cursor, limit".

### 4.3.2 Who may call

Both roles. Moderator and administrator each returned 200 with identical counts for the same
account.

### 4.3.3 Removed content is included and flagged

A post removed via `PATCH /admin/posts/{id}/remove` **remains in the list**, with
`status: "removed"` and `removed: true`. A live post is `removed: false`. Removed content is
therefore included and distinguished by the `removed` boolean, not filtered out. There is no
parameter to exclude it (only `cursor`, `limit`).

### 4.3.4 Row shape

**Posts** row:
```json
{ "id","userId","username","status","caption","removed","likeCount","commentCount","createdAt" }
```
The row carries `username` (no per-row id→name resolution needed, unlike the report queue) and
`caption`. **It carries no media field at all** — there is no `mediaUrls`/media array on the
content row. Media cannot be rendered from this row.

**Comments** row (observed shape; `seed_carol` comments): analogous `AdminContentRow` with the
comment body in place of `caption`, and the same `removed`, `status`, counts, `username`,
`createdAt`. A comment's `status` may be null (comments have no publication status).

The row carries enough to render a list line (owner, text, status, removed flag, counts, date)
without a second fetch.

---

## 4.4 The audit log

### 4.4.1 `GET /api/v1/admin/actions` by role, same window

| Caller | count | actor ids present |
|---|---|---|
| moderator | **1** | only `e13ebd6a` (the moderator itself) |
| administrator | **18** | all actors |

The moderator sees **only its own** actions. The single moderator row is its own
`escalate_report`.

### 4.4.2 Accepted query parameters — declared, not assumed

From the OpenAPI document, `GET /admin/actions` declares exactly:

`adminId` (string), `actionType` (enum of the 22 moderation-action keys), `cursor`, `limit`.

There is **no** date-range (`from`/`to`), **no** `targetUserId`, **no** `reportId` filter. A
bogus parameter → **400**. `?actionType=warn_user` returns only `warn_user` rows (works).

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** `targetUserId`, `from`, and `to` now exist and compose with `adminId` and `actionType`. The window is half-open — `from` inclusive, `to` exclusive, verified at the boundary — and the endpoint imposes no span limit of its own. The filters compose with the moderator's own-actions scoping rather than bypassing it. `reportId` is still not a declared filter.


`adminId` is declared but selecting one needs a user picker (the account phase); this phase has
no user search, so the only surfaced filter is `actionType`. `adminId` is recorded as
declared-but-unsurfaced, not fabricated away.

A sibling `GET /admin/actions/for-user/{userId}` exists (params `cursor`, `limit`) — the
per-account action history for the account phase, out of scope here.

### 4.4.3 `metadata` absent from every list row

List row keys (full page):
`actionType, adminId, createdAt, id, reason, reportId, targetEntityId, targetEntityType, targetUserId`.
**No `metadata` key on any row.** Confirmed across the administrator's full 18-row page: zero
rows carry `metadata`.

### 4.4.4 `GET /api/v1/admin/actions/{actionId}` by ownership and role

| Caller | Action performed by | HTTP | code |
|---|---|---|---|
| administrator | anyone | 200 | OK (metadata present) |
| moderator | itself | **200** | OK (metadata present) |
| moderator | an administrator | **404** | `ADMIN_ACTION_NOT_FOUND` |

A moderator can fetch the detail only of its own actions. In a moderator's own log every row is
its own, so the 404 does not arise from normal navigation; it is handled calmly if it does.

### 4.4.5 Enumerated metadata shapes (input to the drawer)

One captured `metadata` object per distinct action type produced:

| actionType | metadata | notes |
|---|---|---|
| `warn_user` | `{ "reasonKey": "harassment" }` | targetUserId set, targetEntityType `user` |
| `revoke_warning` | `{ "reasonKey": "spam" }` | targetEntityType `warning`, targetEntityId = warningId |
| `issue_strike` | `{ "warningIds": ["…","…","…"], "strikeNumber": 1, "resultingStatus": "suspended", "consequenceApplied": true, "triggeredByModeratorId": "…" }` | targetUserId set, targetEntityType `user` |
| `revoke_strike` | `{ "strikeNumber": 1 }` | targetEntityType `strike`, targetEntityId = strikeId |
| `remove_post` | `{ "resultingStatus": "removed" }` | targetEntityType `post` |
| `restore_post` | `{ "resultingStatus": "published" }` | with dropped tags: `{ "resultingStatus": "published", "strippedHashtags": ["droptagx"] }` (foundation item 14) |
| `remove_comment` | `null` | targetEntityType `comment` |
| `restore_comment` | `null` | no `droppedHashtags` wrapper |
| `resolve_report` | `null` | targetEntityType `post` |
| `dismiss_report` | `null` | — |
| `escalate_report` | `null` | reportId set |

**Distinct metadata shapes** (what the drawer renders):
1. `{ reasonKey }` — warn_user, revoke_warning
2. `{ warningIds[], strikeNumber, resultingStatus, consequenceApplied, triggeredByModeratorId }` — issue_strike
3. `{ strikeNumber }` — revoke_strike
4. `{ resultingStatus }` — remove_post, restore_post
5. `{ resultingStatus, strippedHashtags[] }` — restore_post with dropped tags
6. `null` — remove_comment, restore_comment, resolve_report, dismiss_report, escalate_report

The drawer renders each of these deliberately and falls back to a generic key/value renderer for
any shape not listed (forced test in the verification evidence).

### 4.4.6 Which action types carry a non-null `reportId`

`escalate_report` carries a non-null `reportId` (the link back to the originating report;
observed both on an administrator row and on the **moderator's own** `escalate_report`, id
`d52c5431-71ea-4ed1-946c-a3d964fe5285`). `resolve_report` and `dismiss_report` carry a
`reportId` when the action originated from a report; the direct actions produced here (invoked
without a report context) carried `reportId: null`. Any row whose `reportId` is non-null links
to `/admin/reports/{reportId}`. This is the moderator's route back to a report it escalated.

### 4.4.7 targetUserId vs targetEntityType/targetEntityId

| actionType | targetUserId | targetEntityType | targetEntityId |
|---|---|---|---|
| warn_user | set | `user` | userId |
| revoke_warning | set | `warning` | warningId |
| issue_strike | set | `user` | userId |
| revoke_strike | set | `strike` | strikeId |
| remove_post / restore_post | null | `post` | postId |
| remove_comment / restore_comment | null | `comment` | commentId |
| resolve/dismiss/escalate_report | null (escalate had null; a user-target escalation sets it) | `post`/`user` | entityId |

User-directed disciplinary actions carry `targetUserId`; content and report actions carry
`targetEntityType` + `targetEntityId`. A revoke carries both (the target user **and** the
revoked entity id).

---

## 4.5 Vocabulary alignment

`GET /api/v1/config/vocabularies` → `moderationActions` has **22** entries, all
`isEnabled: true` in this environment. Observed action types in the log (11): warn_user,
revoke_warning, issue_strike, revoke_strike, escalate_report, resolve_report, dismiss_report,
remove_post, restore_post, remove_comment, restore_comment. **Every observed type is present in
the vocabulary** — no observed type is absent, so the "raw key with a marker" fallback has no
natural trigger and is exercised by forcing an unknown key in the browser (DoD 25).

`requiresReason` / `isReversible` for every key:

| key | requiresReason | isReversible |
|---|---|---|
| ban_hashtag | true | true |
| ban_user | true | false |
| change_user_role | true | true |
| create_hashtag | false | true |
| delete_hashtag | true | false |
| dismiss_report | false | false |
| edit_hashtag | true | true |
| escalate_report | true | false |
| force_logout | true | false |
| issue_strike | true | true |
| remove_comment | true | true |
| remove_post | true | true |
| resolve_report | false | false |
| restore_comment | false | true |
| restore_post | false | true |
| revoke_strike | false | false |
| revoke_warning | false | false |
| suspend_user | true | true |
| unban_hashtag | false | true |
| unban_user | false | false |
| unsuspend_user | false | true |
| warn_user | true | true |

The panel does not drive these flags for control-rendering in this phase (the only controls this
phase renders are warn, revoke_warning, revoke_strike, and content remove/restore, whose
behaviour is fixed by the endpoints above); the flags are recorded for the account phase.

---

## Divergence table against the two prior verification documents

Compared against `docs/admin-panel-foundation-and-reports/report-contract-verification.md` and
`docs/admin-panel-reconnaissance/api-contract-verification.md`.

| Item | Prior docs | This verification | Divergence |
|---|---|---|---|
| Warn endpoint path | prompt/handoff imply `POST /admin/users/{id}/warn` | real path is `POST /admin/warnings/for-user/{id}` | **new: path differs** |
| Who may warn | prev phase deferred, assumed role unknowable | moderator MAY warn ordinary accounts (200) | **new: warn is not admin-only** |
| Elevated warn target | not recorded | 403 `ADMIN_TARGET_NOT_WARNABLE` (distinguishable) | **new** |
| Violations union | documented endpoint exists, shape not enumerated | discriminator `kind` ∈ {warning, strike}; fields per branch | **new: shape enumerated** |
| Revoked records | 5.1.6 assumes still visible, marked revoked | revoked records are removed from the list | **new: contradicts 5.1.6** |
| Role-scoped violation cursor | handoff noted role-scoped result + cursor | confirmed; cross-role replay → INVALID_CURSOR | consistent |
| Content row media | prompt 7.1.5 assumes a media array | content row carries **no** media field | **new: no media on row** |
| Audit list metadata | handoff: metadata only on per-action fetch | confirmed absent on list, present on detail | consistent |
| Audit filters | not enumerated | only `adminId`, `actionType` declared | **new: no date range** |
| Moderator audit scope | handoff: moderator sees own | confirmed (1 own row; admin sees all 18) | consistent |
| Metadata shapes | restore_post `{resultingStatus[,strippedHashtags]}` known | six distinct shapes enumerated (§4.4.5) | extended |
| reportId route-back | deferred-finding: escalate_report carries reportId | confirmed on the moderator's own row | consistent |

**Items checked: 30+** across §4.1–4.5. Divergences that shape the build: the warn path, the
moderator-warn capability with a distinguishable elevated-target refusal (settles 6.1(b)), the
revoked-record removal (forces an honest treatment of 5.1.6), the absence of media on the
content row, and the audit filter set being `actionType` only in practice.
