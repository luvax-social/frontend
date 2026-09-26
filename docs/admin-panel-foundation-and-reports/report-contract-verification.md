# Report Contract Verification

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 4.
Every claim below was produced by calling the running backend at `http://localhost:8080` on 2026-08-21, against a freshly reset seed fixture.
This document is committed before any feature code, per the Definition of Done item 1.

Bearer and refresh tokens are redacted to their first eight characters where shown.
The verification driver is a standalone script that logs in as the five seed accounts, creates report fixtures through the public API, drives them through every status, and records the request and response for each of the sixteen items.

The headline finding: the handoff and the reconnaissance are accurate on every point they cover, with one class of behaviour neither documented that changes the design.
`GET /api/v1/reports` returns a role-scoped result set.
A moderator sees only `pending` and `reviewing` reports; an administrator sees all five statuses.
This is recorded in full in item 4 and item 5 and summarised in the divergence table at the end.

## Baseline

The fixture was reset before verification because the reconnaissance phase left it mutated (`seed_alice` promoted to `moderator`, `seed_bob` suspended).
After reset: five seed accounts, `seed_alice`, `seed_bob`, `seed_carol` are `user`/`active`, `seed_mod` is `moderator`, `seed_admin` is `admin`, three seed posts, zero reports.
Fixtures created during verification: one comment, one hashtag-bearing post, and a set of reports driven into every status.

## Item 1: login as seed_mod and seed_admin

Both logins returned HTTP 200.

| Field | seed_mod | seed_admin |
|---|---|---|
| `data.user.role` casing | `moderator` (lowercase) | `admin` (lowercase) |
| JWT `role` claim casing | `MODERATOR` (uppercase) | `ADMIN` (uppercase) |
| JWT `epoch` claim | `2` (integer, present) | `0` (integer, present) |

The `data.user` object carries exactly `id, username, email, displayName, role, emailVerified`.
The role appears in `data.user.role` lowercase and in the access-token `role` claim uppercase, exactly as the handoff section 6.2 states.
Casing must be normalised once at capture.

## Item 2: refresh

`POST /api/v1/auth/refresh` with the rotated `luvax_refresh` cookie returned HTTP 200.
The response carries the same `user` object including `role` (`admin`).
Rotated cookie, redacted: `luvax_refresh=edFr5X0L...; Path=/api/v1/auth; Max-Age=2592000; Expires=Sun, 20 Sep 2026 14:32:27 GMT; HttpOnly; SameSite=Lax`.
The refresh response is the boot-time source of the role after a reload.

## Item 3: vocabularies

`GET /api/v1/config/vocabularies` returned three lists.

| List | Entry count |
|---|---|
| `reportReasons` | 8 |
| `notificationTypes` | 11 |
| `moderationActions` | 22 |

Full `reportReasons` (every entry `isEnabled: true`):

| key | displayName | sortOrder | isEnabled | appliesTo |
|---|---|---|---|---|
| spam | Spam | 1 | true | [] |
| nudity | Nudity or Sexual Content | 2 | true | post, comment, story, message |
| violence | Violence or Dangerous Content | 3 | true | post, comment, story, message |
| hate_speech | Hate Speech | 4 | true | post, comment, story, message |
| harassment | Harassment or Bullying | 5 | true | [] |
| false_information | False Information | 6 | true | post, comment, story |
| scam | Scam or Fraud | 7 | true | [] |
| other | Other | 99 | true | [] |

`moderationActions` entries carry `{ key, displayName, requiresReason, isReversible, isEnabled }`.
No entry in any of the three lists has `isEnabled` false in this environment, so a disabled entry has to be produced by editing the config table before the disabled-entry rendering can be verified in a browser (Definition of Done item 25).

## Item 4: `GET /api/v1/reports` with filters

Measured immediately after driving five reports into the five statuses (`pending` x2 counting the transition fixture, `reviewing`, `resolved`, `dismissed`, `escalated`), called as a moderator:

| Request | HTTP | content length |
|---|---|---|
| `/reports?limit=50` (no filter) | 200 | 3 |
| `/reports?status=pending&limit=50` | 200 | 2 |
| `/reports?reportType=post&limit=50` | 200 | 3 |
| `/reports?status=pending&reportType=post&limit=50` | 200 | 2 |

The accepted parameter set is `status`, `reportType`, `cursor`, `limit`.
A row carries `id, reporterId, reportType, reportReason, entityId, status, createdAt` and no username and no description, matching the handoff section 9.2.

**Divergence, not previously recorded: the moderator no-filter result is 3, not 6.**
The moderator's `GET /reports` returns only `pending` and `reviewing` reports.
Confirmed by calling every status filter as both roles:

| Request | Moderator | Administrator |
|---|---|---|
| `/reports` (no filter) | 200, 3 rows, statuses {pending, reviewing} | 200, 9 rows, statuses {pending, reviewing, resolved, dismissed, escalated} |
| `/reports?status=escalated` | 200, 0 rows | 200, 2 rows |
| `/reports?status=resolved` | 200, 0 rows | 200, 2 rows |
| `/reports?status=dismissed` | 200, 0 rows | 200, 2 rows |

The endpoint returns HTTP 200 for a moderator on every status filter; it simply returns an empty page for the three terminal-or-escalated states.
The result set therefore varies by role on this endpoint, which is why the queue query key must include the caller's role.

## Item 5: escalated queue

`GET /api/v1/reports?status=escalated` is the escalated queue; there is no separate list endpoint for it.
As an administrator it returned the two escalated reports.
As a moderator it returned an empty page (see item 4).
The escalated queue is therefore administrator-only at the data layer, not only by route guard.
The administrator escalated counter (`GET /api/v1/admin/reports/escalated/count`) returned `{ "count": 2 }`, agreeing with the two rows.

## Item 6: `GET /api/v1/reports/{reportId}` in each status

Read as a moderator.

| Report status | HTTP | reviewedBy | reviewedAt | resolutionNote | description |
|---|---|---|---|---|---|
| pending | 200 | null | null | null | present |
| reviewing | 200 | set (the reviewing moderator) | set | null | present |
| resolved | **404 REPORT_NOT_FOUND** | n/a | n/a | n/a | n/a |
| dismissed | **404 REPORT_NOT_FOUND** | n/a | n/a | n/a | n/a |
| escalated | 200 | null | null | null | present |

Full single-report shape keys: `id, reporterId, reportType, reportReason, entityId, description, status, reviewedBy, reviewedAt, resolutionNote, createdAt`.

**Divergence, not previously recorded: a moderator receives 404 on a resolved or dismissed report.**
The same resolved report read as an administrator returned 200.
A moderator retains read access to `pending`, `reviewing`, and a report it escalated, but loses read access once a report is resolved or dismissed.
This is the behaviour the panel relies on for the two-window conflict case: after another reviewer closes a report, a moderator's refetch returns 404 and the detail screen renders not-found, which is a calm outcome rather than a raw error.

## Item 7: `GET /api/v1/admin/reports/{reportId}/target`

Read as a moderator, one target of each available type.

| reportType | status | text | ownerUsername | mediaUrls | removed |
|---|---|---|---|---|---|
| post | `published` | the caption | seed_alice | `[]` | false |
| comment | `null` | the comment body | seed_alice | `[]` | false |
| user | `active` | `null` | seed_bob | `[]` | false |

`status` is null for a comment, `text` is null for a user, `mediaUrls` is an empty array rather than null in every case.
One payload serves all five entity types, so rendering must branch on `reportType`.

## Item 8: `GET /api/v1/admin/content/user/{userId}`

Called as a moderator for `seed_alice`: HTTP 200, `data.ownerUsername` is `seed_alice`.
The payload shape is identical to the report target (it carries `reportType: "user"`, `ownerId`, `ownerUsername`, `status`, and null `text`).
This is the only id-to-username resolution reachable by a moderator, and it works.

## Item 9: `PATCH /api/v1/reports/{reportId}/status`

| Call | HTTP | code |
|---|---|---|
| `{status:"reviewing"}` on a pending report | 200 | OK, new status `reviewing` |
| `{status:"resolved"}` on the now-reviewing report | 409 | REPORT_INVALID_TRANSITION |
| `{status:"reviewing"}` again on the reviewing report | 409 | REPORT_INVALID_TRANSITION |

The endpoint performs only the `pending` to `reviewing` transition, and refuses every other request with 409, exactly as documented.

## Item 10: resolve, dismiss, escalate response shapes

Each returns an `AdminActionResponse` directly as `data` (not wrapped), HTTP 200.

| Endpoint | actionType | targetEntityType | targetUserId |
|---|---|---|---|
| `/admin/reports/{id}/resolve` | `resolve_report` | post | null (post is not user-owned in this response) |
| `/admin/reports/{id}/dismiss` | `dismiss_report` | post | null |
| `/admin/reports/{id}/escalate` | `escalate_report` | user | the target user id |

`metadata` is null on these direct action responses.
`reason` echoes the submitted reason.

## Item 11: moderator resolve or dismiss of an escalated report

| Call | HTTP | code |
|---|---|---|
| moderator resolve on an escalated report | 403 | FORBIDDEN |
| moderator dismiss on an escalated report | 403 | FORBIDDEN |

Confirmed. The controls must be absent for a moderator on an escalated report, not rendered and then refused.

## Item 12: moderator escalated count

| Caller | HTTP | code / data |
|---|---|---|
| moderator | 403 | FORBIDDEN |
| administrator | 200 | `{ "count": 2 }` |

The badge poll must be gated on the administrator role, or a moderator produces one failing request per interval.

## Item 13: post remove and restore, side by side

| Endpoint | data shape |
|---|---|
| `/admin/posts/{id}/remove` | `AdminActionResponse` directly, actionType `remove_post`, keys `id, adminId, actionType, targetUserId, targetEntityType, targetEntityId, reportId, reason, metadata, createdAt` |
| `/admin/posts/{id}/restore` | wrapped: `{ action, droppedHashtags }`, actionType `restore_post` |

For a post with no banned hashtag, `droppedHashtags` is `[]` and `action.metadata` is `{ resultingStatus: "published" }` with no `strippedHashtags` key.

> **Superseded by `docs/admin-panel-backend-capability-uptake/` (backend capability uptake).** The field is now **`remainingBannedHashtags`**, in both the wrapper and `action.metadata`, and its meaning changed: it is the banned tags the caption still carries **after** the restore, not the set the call dropped. Restoring the same post twice returns the same names both times.

The two response shapes differ, and the restore wrapper must be unwrapped separately from remove.

## Item 14: non-empty droppedHashtags, reproduced end to end

Created a post as `seed_carol` with caption `drop repro #droptagx contract check` through `POST /api/v1/posts`; the hashtag `droptagx` was created and linked synchronously.
Banned the hashtag with `PATCH /api/v1/admin/hashtags/{id}` (`status: banned`, actionType `ban_hashtag`).
Removed the post, then restored it.

Restore response `data`:

```json
{
  "action": { "actionType": "restore_post", "metadata": { "resultingStatus": "published", "strippedHashtags": ["droptagx"] } },
  "droppedHashtags": ["droptagx"]
}
```

`data.droppedHashtags` and `data.action.metadata.strippedHashtags` both carry `["droptagx"]`.
The success message on a restore must name these tags when the array is non-empty.

## Item 15: comment remove and restore

Both return an `AdminActionResponse` directly as `data`, with `actionType` `remove_comment` and `restore_comment`.
Neither carries a `droppedHashtags` wrapper (`restore_has_droppedHashtags: false`).
Comment restore must be handled separately from post restore, not by analogy.

## Item 16: strictness probes

| Probe | HTTP | code | message |
|---|---|---|---|
| `GET /admin/users?limitt=2` (misspelled query param) | 400 | BAD_REQUEST | `Unsupported query parameter: limitt. Accepted: cursor, limit, role, status` |
| `GET /reports?bogus=1` (misspelled query param) | 200 | OK | ignored, not rejected |
| `PATCH /admin/reports/{id}/escalate` with an extra body field | 400 | MALFORMED_REQUEST_BODY | `Request body could not be read` (does not name the field) |

The strict-query-parameter rule holds on `/api/v1/admin/**` and does not hold on `/api/v1/reports`.
The strict-body rule holds everywhere with a body.
The sanitiser is therefore built to send only declared query keys on every endpoint (defensive even where not enforced) and to build request bodies field by field.

## Divergence table against `docs/admin-panel-reconnaissance/api-contract-verification.md`

The reconnaissance verified 46 of 47 role-matrix rows exactly and the five headline traps.
This verification confirms all of those and adds two behaviours the reconnaissance did not record.

| Item checked | Reconnaissance | This verification | Divergence |
|---|---|---|---|
| Login role casing, JWT casing, epoch | lowercase user / uppercase claim / epoch present | identical | none |
| Refresh carries user with role | yes | yes | none |
| Vocabulary counts and reportReasons set | 8 / 11 / 22, all enabled | identical | none |
| `GET /reports` accepted parameters | status, reportType, cursor, limit | identical | none |
| `GET /reports` result set by role | not recorded | moderator sees only pending and reviewing; administrator sees all five | **new: role-scoped result set** |
| `GET /reports/{id}` on resolved or dismissed, as moderator | not recorded | 404 REPORT_NOT_FOUND for a moderator, 200 for an administrator | **new: moderator loses read on closed reports** |
| `PATCH /reports/{id}/status` performs only pending to reviewing | confirmed | confirmed (409 REPORT_INVALID_TRANSITION otherwise) | none |
| resolve, dismiss, escalate return AdminActionResponse directly | confirmed | confirmed | none |
| Moderator resolve/dismiss on escalated report | 403 (row 23, 24 caveat) | 403 FORBIDDEN | none |
| Moderator escalated count | 403 (row 26) | 403 FORBIDDEN | none |
| Post restore wraps, remove and comment endpoints do not | confirmed | confirmed | none |
| Non-empty droppedHashtags reproduced | confirmed with `dropme2` | confirmed with `droptagx` | none |
| Comment restore has no droppedHashtags wrapper | confirmed | confirmed | none |
| Strict query params on /admin/** only | confirmed | confirmed | none |
| Strict body fields everywhere | confirmed | confirmed | none |

Sixteen work items were checked.
Two behaviours diverged from the reconnaissance, both refinements rather than contradictions, and both shape the panel: the report queue query key must include the caller's role, and the report detail screen must treat a 404 on a closed report as a calm not-found rather than an error.
