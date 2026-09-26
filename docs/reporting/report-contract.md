# Report Contract

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

The verified contract for `POST /api/v1/reports`, every failure case with its observed response,
and the one disagreement found between the backend enum and the design export.

Everything below was read from the backend source, then re-verified against the running server.
Nothing here is carried over from reconnaissance without being re-checked.

## How this was verified

The backend source was read first: `ReportController`, `CreateReportRequest`, `ReportReason`,
`ReportType`, `ReportServiceImpl`, `ReportTargetRepositoryImpl`, and migration
`V30__add_reports_duplicate_unique_index.sql`.

The running server was then checked independently.
The live OpenAPI document at `http://localhost:8080/api-docs` returned a `CreateReportRequest`
schema identical to the source in every field, enum value, and constraint.

Every case in the failure table was then executed with `curl` against the running server.

## Endpoint

| Property | Value |
|----------|-------|
| Method and path | `POST /api/v1/reports` |
| Authentication | Required. Unauthenticated calls answer `401 UNAUTHORIZED` |
| Success status | `201 Created` |
| Response envelope | `ApiResponse<ReportResponse>` |

## Request shape

| Field | Type | Required | Constraint |
|-------|------|----------|-----------|
| `reportType` | string enum | Yes | One of the five type values below |
| `reportReason` | string enum | Yes | One of the eight reason values below |
| `entityId` | UUID string | Yes | Must resolve to an existing, non-deleted row of the given type |
| `description` | string | No | `@Size(max = 2000)`. May be omitted or null |

`required` above is taken from the live OpenAPI document, which lists exactly
`["entityId", "reportReason", "reportType"]`.

## Accepted target types

`ReportType` serialises lowercase through `@JsonValue`.
The complete set the backend accepts:

| Wire value | Owner column resolved by the backend |
|------------|--------------------------------------|
| `post` | `posts.user_id` |
| `comment` | `comments.user_id` |
| `user` | `users.id` |
| `story` | `stories.user_id` |
| `message` | `messages.sender_id` |

This application sends only `post`, `comment`, and `user`.
`story` and `message` are accepted by the backend but have no entry point here.

## The complete reason enum

`ReportReason` serialises lowercase through `@JsonValue`.
All eight values, exactly as they go on the wire:

| Wire value |
|------------|
| `spam` |
| `nudity` |
| `violence` |
| `hate_speech` |
| `harassment` |
| `false_information` |
| `scam` |
| `other` |

Each of the eight was submitted to the running server at least once and accepted.
See `verification-evidence.md` for the per-reason record.

## Success response

`201 Created`, observed body:

```json
{"success":true,"code":"CREATED","message":"Resource created successfully",
 "data":{"id":"54d4fd4c-e565-4cf3-9001-f7445089ce63",
         "reporterId":"556c0a7a-5b64-46e6-bc49-bd062307867f",
         "reportType":"post","reportReason":"spam",
         "entityId":"d3c9d6b8-c045-4fe8-83e2-182c173e4899",
         "description":"curl contract check","status":"pending",
         "reviewedBy":null,"reviewedAt":null,"resolutionNote":null,
         "createdAt":"2026-08-12T05:00:49.805759Z"}}
```

The new report is always created with `status: "pending"`.

## Failure cases

Every case below was executed against the running server.
The status and `code` are as observed.

| Case | Status | `code` | Observed message |
|------|--------|--------|------------------|
| Same reporter, same target, same reason | 409 | `REPORT_DUPLICATE` | You have already reported this entity |
| Same reporter, same target, **different** reason | 409 | `REPORT_DUPLICATE` | You have already reported this entity |
| Reporting your own post | 400 | `REPORT_SELF_NOT_ALLOWED` | You cannot report your own content |
| Reporting your own account | 400 | `REPORT_SELF_NOT_ALLOWED` | You cannot report your own content |
| Reporting your own comment | 400 | `REPORT_SELF_NOT_ALLOWED` | You cannot report your own content |
| Target does not exist | 404 | `REPORT_TARGET_NOT_FOUND` | Reported entity not found |
| `reportReason` omitted | 400 | `VALIDATION_ERROR` | `{"reportReason":"must not be null"}` |
| `reportReason` not in the enum | 400 | `MALFORMED_REQUEST_BODY` | Request body could not be read |
| `reportType` not in the enum | 400 | `MALFORMED_REQUEST_BODY` | Request body could not be read |
| `description` 2001 characters | 400 | `VALIDATION_ERROR` | `{"description":"size must be between 0 and 2000"}` |
| `GET /reports` as a regular user | 403 | `FORBIDDEN` | Access to this resource is forbidden |
| `POST /reports` unauthenticated | 401 | `UNAUTHORIZED` | Authentication is required |

`description` of exactly 2000 characters was accepted with `201`, so 2000 is inclusive.

## What counts as a duplicate

This was the question that most affected the wording of the interface, so it was checked directly
rather than inferred.

The uniqueness key is **`(reporter_id, report_type, entity_id)`**.
The reason is **not** part of it.

Two independent sources agree:

- `V30__add_reports_duplicate_unique_index.sql` creates
  `CREATE UNIQUE INDEX uq_reports_reporter_type_entity ON reports (reporter_id, report_type, entity_id)`.
  The index was confirmed present in the running database.
- `ReportServiceImpl.validateDuplicateReport` pre-checks
  `existsByReporterIdAndReportTypeAndEntityId`, and the `saveAndFlush` is wrapped so a
  `DataIntegrityViolationException` from that index also surfaces as `REPORT_DUPLICATE`.

Confirmed by submission: after reporting a post for `spam`, resubmitting the same post for `scam`
also returned `409 REPORT_DUPLICATE`.

**Consequence for the interface**: a message saying "you already reported this" is accurate.
A message implying a different reason would succeed would be wrong.
This directly determined the duplicate copy described in `design-decisions.md`.

## Reporting a target you cannot see

Reporting a blocked user's post **succeeds**.

Observed: an account blocked another, then reported that account's post.
The report returned `201 Created`, while `GET /posts/{id}` for the same post returned `403`.

The backend's owner lookup is a native SQL read that filters only on `deleted_at`; it applies no
visibility or block gate.
This is recorded as an observation about the backend, not a defect fixed here, because the backend
is read-only in this phase and the state is not reachable from the interface: a viewer who cannot
see the post has no menu from which to open the report modal.

Recorded in `deferred-findings.md`.

## Whether a user can read back their own reports

No.

`GET /reports`, `GET /reports/pending`, and `GET /reports/{id}` all carry
`@PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")`.

Confirmed: `GET /reports` with a regular user's token returned `403 FORBIDDEN`.

This is the reason the report control can never be pre-disabled, and the reason a duplicate can only
be discovered on submission.

## Disagreement between the backend enum and the design export

### The reason identifiers agree completely

The design export's `REPORT_REASONS` array uses these ids:
`spam`, `nudity`, `violence`, `hate_speech`, `harassment`, `false_information`, `scam`, `other`.

These match the backend `ReportReason` enum exactly, all eight, including the underscored forms.
There is no disagreement to resolve here.

### The description length limit disagrees

This is the one real disagreement found.

| Source | Limit |
|--------|-------|
| Backend `CreateReportRequest.description` | `@Size(max = 2000)` |
| Design export textarea | `e.target.value.slice(0, 500)`, counter renders `/500` |

The design caps the description at 500 characters and shows a `0/500` counter.
The server accepts 2000.

The backend limit was used, and the counter reads `0/2000`.
The instruction for this phase is explicit that the client must enforce the server's limit rather
than one the client invented, and 500 is a limit with no basis in the contract.

The visible consequence is that the character counter differs from the design export.
Recorded here rather than silently resolved.

### The design's submit path is not a real submission

The design export's `submit()` only advances its own step counter.
It performs no network call and has no error state of any kind: no duplicate handling, no failure
message, no pending state.

Everything in the interface that deals with a failed submission is therefore derived rather than
specified. That derivation is documented in `design-decisions.md`.
