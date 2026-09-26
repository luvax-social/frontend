# Admin and Moderator Panel: Backend Handoff Package

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

This document is the complete contract for the administrative and moderation panel.
It is written for an engineer who has the backend repository available but has never run it, and who cannot ask a follow-up question.
Everything needed is stated here.
Nothing in this document refers to a report, a commit, a diagram, or a conversation you cannot see.

Every contract detail below was derived by calling the running application on 2026-08-21 against `develop` at commit `c297b03`.
Every example is a real captured request and response.
Where the API behaves in a way that will surprise you, this document says so before describing the thing that triggers it.

The companion file `openapi.json` in this same directory is the OpenAPI 3.1 document exported from the running application.
Generate your TypeScript types from that file.

Target stack for the panel: React 19, Vite, TanStack Query, Zustand, React Router DOM, Axios, shadcn/ui.

---

## What changed since the previous package

This document was regenerated against a running server after a round of backend work. If you built
against the previous version, these are the things that are now different. Everything below was
captured from a live call or read from the source, not carried over from notes.

### Corrections to statements that were wrong

| Was stated | Actually true |
|---|---|
| `POST /api/v1/admin/hashtags` returns 200 in the role matrix | It returns **201**. The endpoint's own entry always said 201; the summary table was wrong. |
| The statistics series and the activity log allow 30 requests a minute | Production allows **20**. Build to 20. Development is looser than both, so a limit you meet while building is not the one production enforces. |
| The first statistics snapshot appears within thirty minutes | Worst case is **just under an hour**. The interval is thirty minutes and the partial bucket the process starts inside is discarded. |
| An out-of-range granularity is forced to daily | It is **refused with 400**. The server resolves to daily only when you name no granularity at all. Asking for `half_hour` over a window older than the fine-bucket horizon is an error. Prevent the combination in your controls. |
| The statistics window limit is thirty days | Two different limits were being conflated. The **window may span at most one year**. The **thirty-day** figure is the fine-bucket horizon, applied to the window's *start* against the present moment. So a one-hour window starting thirty-one days ago is refused at fine granularity, while a year-long window starting today is accepted. The activity log's own thirty-day window limit is separate and still correct. |
| `droppedHashtags` on the post restore response | Renamed **`remainingBannedHashtags`**, and its meaning is now stated: it is the banned tags the caption still carries **after** the restore, which is the post's present state and not the set that one call changed. Restoring the same post twice returns the same names both times. That is correct, not a bug. The audit metadata key changed to match. |

### Behaviour that was always true and was never written down

- **The report queue is scoped by role.** A moderator sees `pending` and `reviewing` only; an
  administrator sees all five statuses. Asking for a status outside a moderator's scope returns an
  empty page, not an error. The cursor is scoped per role, so one issued to an administrator is
  rejected when a moderator replays it.
- **A closed report answers 404 to a moderator**, with one exception that matters: a moderator keeps
  read access to a report **it escalated itself**. That exception is what makes following your own
  escalations possible at all.
- **An empty `appliesTo` on a report reason means every report type, never none.** Four reasons carry
  an empty list: `spam`, `harassment`, `scam`, `other`. If you filter the reason list by the type
  being reported, treat empty as a match or those four vanish.
- **Omitting `durationDays` on a suspension is a supported, deliberate choice**, not an incomplete
  request. It suspends indefinitely with a null end time that the reinstatement sweep never matches,
  so the account stays suspended until an administrator lifts it. Offer it alongside a dated
  suspension.

### Rules that changed

- **The strict query-parameter rule now covers the report endpoints too.**
  `GET /api/v1/reports` and `GET /api/v1/reports/pending` reject an unrecognised parameter with 400
  instead of ignoring it. It previously applied to the administrative tree only. If you send only
  declared keys nothing changes for you.
- **`GET /api/v1/users/me/settings` no longer answers 404 on a valid account.** Every account has a
  settings record from creation and existing accounts were backfilled. Stop treating a 404 there as
  an expected state; if you see one now, it is a real fault.

### New endpoints

Eight. Their request and response schemas are in `openapi.json`, which was regenerated from the
running server alongside this document. Section 9's per-endpoint prose has **not** been extended to
cover them, so treat `openapi.json` as authoritative for their shapes and this section for their
behaviour.

Declared status codes, read out of the regenerated document:

| Endpoint | Declared responses |
|---|---|
| `PATCH /api/v1/admin/stories/{storyId}/remove` | 200, 400, 401, 403, 404, 409, 415, 429 |
| `PATCH /api/v1/admin/stories/{storyId}/restore` | 200, 400, 401, 403, 404, 409, 415, 429 |
| `PATCH /api/v1/admin/messages/{messageId}/remove` | 200, 400, 401, 403, 404, 409, 415, 429 |
| `PATCH /api/v1/admin/messages/{messageId}/restore` | 200, 400, 401, 403, 404, 409, 415, 429 |
| `DELETE /api/v1/admin/users/{userId}/sessions/{sessionId}` | 200, 400, 401, 403, 404, 415, 429 |
| `POST /api/v1/auth/session` | 200, 400, 401, 415, 429 |
| `GET /api/v1/admin/user-summaries` | 200, 400, 401, 403, 429 |
| `GET /api/v1/reports/escalated/mine` | 200, 400, 401, 403, 429 |

The four content actions take the same body every other moderation action takes,
`{"reason": "...", "reportId": "..."}` with `reason` mandatory, and return the same audit-row
response. 409 means the target is already in the state you asked for. The session revocation takes
that same body. `POST /api/v1/auth/session` takes an optional `{"refreshToken": "..."}` and falls
back to the HttpOnly cookie.

Behaviour you cannot read off a schema:

- **Story restore does not resurrect an expired story.** Removal writes only the soft-delete marker;
  expiry keeps deciding visibility. A story that expired while removed comes back to a live row that
  no feed shows. Once a story is both removed and expired the cleanup job deletes it outright and a
  later restore answers 404. Do not promise the reviewer that a restore always brings a story back.
- **Message removal withholds the text, the media and any shared post or story** from both
  participants, leaving the same "message deleted" placeholder the thread already shows when a
  sender deletes their own message. Restore returns all of it. A message the **sender** deleted
  cannot be restored by moderation and answers 409.
- **Revoking an already-revoked session answers 200, not an error**, so a double click is safe. A
  session belonging to a different account answers 404. Revoking one session does **not** sign the
  account out everywhere; force logout still does.
- **`user-summaries` returns one entry per requested id, in request order**, with `found: false` and
  a null `user` for an unknown or deleted id rather than omitting it. More than 100 ids is a 400,
  not a truncated list. Display fields only, so do not expect status, role or email.
- **`escalated/mine` carries no status filter**: a report an administrator has since resolved still
  appears, which is the outcome you escalated in order to see. An administrator calling it gets its
  own escalations, not everyone's.

| Endpoint | What it unlocks |
|---|---|
| `PATCH /api/v1/admin/stories/{storyId}/remove` and `/restore` | A reported story can be taken down and put back |
| `PATCH /api/v1/admin/messages/{messageId}/remove` and `/restore` | The same for a reported message |
| `DELETE /api/v1/admin/users/{userId}/sessions/{sessionId}` | End one session instead of all of them |
| `POST /api/v1/auth/session` | Ask which session the caller is using |
| `GET /api/v1/admin/user-summaries?ids=` | Resolve up to 100 account ids to names in one request |
| `GET /api/v1/reports/escalated/mine` | List the reports you escalated |

### Extended payloads

- `AdminUserDetailResponse.activeWarningCount` - non-nullable, zero for a clean account. Three
  active warnings issue a strike, so you can now warn the reviewer *before* the third.
- `GET /api/v1/admin/violations/for-user/{userId}?includeRevoked=true` - revoked warnings and
  strikes, each carrying `revokedAt` and `revokedBy`. Default is false and unchanged. The cursor is
  scoped on the flag, so a cursor from one listing is rejected by the other.
- `GET /api/v1/admin/actions?targetUserId=&from=&to=` - the audit log now filters by target and by a
  half-open time window. These compose with the moderator scoping; they do not bypass it.
- `AdminPostSummaryResponse.mediaUrls` - an account's post rows now carry their attached media.
  Comment rows do not, because comments have no media in this schema.

### The activity log now writes seven event types, in development only

`post_like`, `post_save`, `post_view` and `post_comment` join `session_start`, `search` and
`profile_view`. The consumer that writes the four engagement types depends on a recommender service
that was defined but never started; it is now part of the default local stack.

**Read this carefully before widening your filter.** This is true of the **development** stack only.
Nothing about a production deployment of that service was set up. A production panel will still only
ever see three types. If your filter is built from a constant, gate it on the environment or you
will offer four filters that can never match in production, against a server that will answer 200
with an empty page.

### Workarounds you can now delete

Leaving these in place alongside the new endpoints gives you two mechanisms for one job.

1. Rendering a story or message report read-only, and the copy telling the reviewer such content
   cannot be taken down from the panel. Four endpoints now exist.
2. Linking from a moderator's own audit rows back to a report it escalated.
   `GET /api/v1/reports/escalated/mine` replaces it.
3. Resolving account identifiers one at a time and caching the result.
   `GET /api/v1/admin/user-summaries` replaces it.
4. Treating suspension `durationDays` as required and bounded.
5. Stating the static three-warning rule before issuing a warning because the count could not be
   read. `activeWarningCount` on the account detail is the real number.

### What the panel still cannot do

Do not design a route for any of these.

- **No totals on any list.** No endpoint returns a count of matching rows, anywhere, except the
  escalated-report counter. This is deliberate and unchanged: adding `COUNT(*)` to every list
  reintroduces exactly the cost the statistics design exists to avoid. Every "how many" question
  stays unanswerable, and the panel is already built for that.
- **The administrative session listing carries no per-row "this is you" marker.** Call
  `POST /api/v1/auth/session` and correlate its `sessionId` against the listing yourself. The
  session is not derivable from an access token: the `jti` is unique per access token and the
  refresh cookie is scoped to `/api/v1/auth`, so it never reaches the administrative tree.
- **No media on comment rows.** The schema has none to give.
- **A revoked session cannot be un-revoked.** The account signs in again; that is the whole
  recovery path.

---

## Read this first: seven things that will cost you hours if you miss them

These are stated here, at the top, because you read linearly and each one is cheap to get wrong.

1. **Undeclared query parameters and undeclared request-body fields are both rejected with 400.**
A misspelled filter is not silently ignored.
Spreading extra state into an Axios request body will fail the request.
See section 7.

2. **Stop paginating when `pageInfo.hasNextPage` is `false`, never when the page is empty.**
The last page usually still contains items, and `endCursor` is non-null even past the end.
See section 7.

3. **`GET /api/v1/users/me` does not return the caller's role.**
Only the login and refresh responses carry `role`.
See section 6.

4. **A moderator gets 403 on most `/api/v1/admin/**` routes but 404 on `GET /api/v1/admin/actions/{actionId}`.**
The 404 is deliberate and does not mean the record is missing.
See section 8.

5. **Promoting an account to `admin` is irreversible through the API.**
There is no supported way to demote an administrator.
See section 11.

6. **The activity log's four engagement event types exist in development only.**
Gate the filter on the environment or you will offer four filters that can never match in
production. See "What changed since the previous package" above.

7. **An out-of-range statistics granularity is refused with 400, never silently forced to daily.**
Prevent the combination in your controls rather than handling the error. See section 9.

---

## 5. Getting the backend running

### 5.1 What you need installed

Docker Desktop, and a JDK 21.
The repository ships a Maven wrapper, so you do not need Maven installed.

### 5.2 Start the infrastructure

The repository root contains `docker-compose.yaml`.
It defines five services, all published on the loopback interface only.

| Service | Image | Host port | Used for |
|---|---|---|---|
| `postgres` | built from `docker/postgres` | 5432 | primary datastore |
| `rabbitmq` | `rabbitmq:4-management` | 5672, management UI 15672 | domain events |
| `redis` | `redis:7-alpine` | 6379 | token blacklist, rate limiting, one-time tokens |
| `mailpit` | `axllent/mailpit` | 1025 SMTP, web UI 8025 | local mail sink |
| `elasticsearch` | `elasticsearch:9.0.3` | 9200 | post and hashtag search |

Start them:

```bash
docker compose up -d
docker compose ps
```

Wait until every service reports `healthy`.
Elasticsearch is the slowest and takes about forty seconds.

### 5.3 Create the environment file

Copy `.env.example` to `.env` at the repository root and fill in the blanks.
`application.yaml` imports `.env` through `spring.config.import: optional:file:.env[.properties]`, so the file is read automatically.

These must be set or the application will not start:

| Variable | Note |
|---|---|
| `POSTGRES_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | must match the compose values |
| `REDIS_PASSWORD` | must match the compose value |
| `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, `SPRING_RABBITMQ_USERNAME`, `SPRING_RABBITMQ_PASSWORD` | must match the compose values |
| `JWT_SECRET` | minimum 32 characters, enforced at startup |
| `APP_COOKIE_SIGNING_SECRET` | minimum 32 characters, enforced at startup |
| `CORS_ALLOWED_ORIGINS` | must include the origin your Vite dev server runs on |

These may stay empty for everything the panel does:

| Variable | Why it can stay empty |
|---|---|
| `RESEND_API_KEY` | the dev profile routes mail to the local Mailpit sink instead |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | only used by the Google OAuth2 sign-in flow, which the panel does not use |
| `R2_*`, `MEDIA_CDN_BASE_URL` | only used by media upload, which the panel does not use |
| `GORSE_API_KEY`, `APP_GORSE_BASE_URL` | only used by the personalized feed, which the panel does not use |

Leave `SEED_DATA=false`.
The seeding you want is the script in section 5.5, not the in-process seeder.

### 5.4 Run the application once so Flyway migrates

Nothing works before this.
The database is empty until the application starts and Flyway applies the migrations.
The seed script in the next step explicitly refuses to run against an unmigrated database.

```bash
./mvnw -DskipTests clean package
java -jar target/luvax-0.0.1-SNAPSHOT.jar
```

Watch for these two lines:

```
o.f.core.internal.command.DbMigrate    | Successfully applied N migrations to schema "public", now at version v74
com.app.Application                    | Started Application in 29.961 seconds
```

Confirm it is serving:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/actuator/health
# 200
```

If port 8080 is already held, the application will fail to bind.
Check with `netstat -ano | grep ":8080"` before starting.

### 5.5 Seed the accounts

```bash
bash scripts/seed-dev-data.sh
```

The script is idempotent, so running it twice inserts nothing the second time.
It refuses to run against anything that is not a local database.

It creates five accounts.
**Every one of them uses the password `SeedPass123!`** and every one is pre-verified, so they can log in immediately.

| Username | Email | Role | Notes |
|---|---|---|---|
| `seed_alice` | `alice@seed.local` | `user` | public account, two text posts |
| `seed_bob` | `bob@seed.local` | `user` | private account |
| `seed_carol` | `carol@seed.local` | `user` | public account, one text post |
| `seed_mod` | `mod@seed.local` | `moderator` | use this to test every moderator screen |
| `seed_admin` | `admin@seed.local` | `admin` | use this to test every administrator screen |

Passing `--reset` additionally clears the content tables and returns the seeded accounts to `active`.
Use it when an earlier test left an account banned and you cannot log in.

```bash
bash scripts/seed-dev-data.sh --reset
```

### 5.6 Base URL and API documentation

The API base URL in development is `http://localhost:8080`.
Every path in this document is relative to that.

Swagger UI is served at `http://localhost:8080/api-docs` under the `dev` profile.

**Swagger is disabled in the production profile.**
Do not build a type-generation step that fetches the schema from a running server.
Generate your types from the `openapi.json` file shipped alongside this document.

### 5.7 Creating the fixtures the panel needs

Every command below was run against a live instance and produced the stated result.
Set `ADMIN` and `MOD` to access tokens obtained per section 6.1 before running them.

**A report in each of the five statuses.**

Reports are created by ordinary users, not by the panel.
The same reporter cannot report the same entity twice, so use different reporter accounts.

```bash
# as carol, against one of alice's posts
curl -s -X POST http://localhost:8080/api/v1/reports \
  -H "Authorization: Bearer $CAROL" -H 'Content-Type: application/json' \
  -d '{"reportType":"post","reportReason":"spam","entityId":"<POST_ID>","description":"fixture"}'
```

Create five such reports, then move them:

```bash
# pending    -> leave the first one alone
# reviewing  -> moderator transition
curl -s -X PATCH http://localhost:8080/api/v1/reports/<R2>/status \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"status":"reviewing"}'

# resolved
curl -s -X PATCH http://localhost:8080/api/v1/admin/reports/<R3>/resolve \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"reason":"confirmed violation"}'

# dismissed
curl -s -X PATCH http://localhost:8080/api/v1/admin/reports/<R4>/dismiss \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"reason":"no violation found"}'

# escalated
curl -s -X PATCH http://localhost:8080/api/v1/admin/reports/<R5>/escalate \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"reason":"needs admin judgement"}'
```

**A warned user.**

```bash
curl -s -X POST http://localhost:8080/api/v1/admin/warnings/for-user/<CAROL_ID> \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"reasonKey":"spam","note":"first warning"}'
```

**A suspended account.**
Two ways, and both are worth having.
Directly:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/admin/users/<USER_ID>/suspend \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"reason":"fixture","durationDays":7}'
```

Or automatically, by issuing a third warning against the same account, which produces a strike and suspends it.
Doing it this way also gives you a strike record to test the violations screen against.

**A banned hashtag.**

```bash
curl -s -X POST http://localhost:8080/api/v1/admin/hashtags \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"name":"fixturebanned","status":"banned","note":"fixture"}'
```

**Restoring an account you broke.**
An account promoted to `admin` cannot be demoted through the API.
If you need to undo that, go to the database directly:

```bash
docker compose exec -T postgres psql -U luvax -d luvax \
  -c "UPDATE users SET role='user' WHERE username='seed_carol';"
```

---

## 6. Authentication and session

This is the first thing you implement, so it is described exhaustively.

### 6.1 Login

`POST /api/v1/auth/login`
No authentication required.

Request body:

| Field | Type | Required | Notes |
|---|---|---|---|
| `identifier` | string | yes | accepts either the email address or the username |
| `password` | string | yes | |

Captured request:

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@seed.local","password":"SeedPass123!"}'
```

Captured response, HTTP 200:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyZjBkMDRjNi1lZmNkLTQyYjEtOTJhZi0yMmMxYmQ0NGQ3NTgiLCJhdWQiOiJMdXZheCIsIm5iZiI6MTc4NzMwNDk1Mywicm9sZSI6IkFETUlOIiwiaXNzIjoiTHV2YXgiLCJlcG9jaCI6MCwiZXhwIjoxNzg3MzA1ODUzLCJpYXQiOjE3ODczMDQ5NTMsImp0aSI6Ijk0YjAyMTU0LTA0Y2ItNGEwZS1hMDNkLTk3NzVmZjExM2YxMSJ9.s6FxcIuO2Y43LFbBisVAkXE5MvaWJrrOoIzQBBmYg-g",
    "refreshToken": "hXve7AnoSYlJWBttAmJt64ymV1WdPGZg-weknUBQaHY",
    "accessTokenExpiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
      "username": "seed_admin",
      "email": "admin@seed.local",
      "displayName": "Seed Admin",
      "role": "admin",
      "emailVerified": true
    }
  },
  "timestamp": "2026-08-21T09:35:53.687924800Z"
}
```

Field by field:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `data.accessToken` | string | no | JWT, HS256 |
| `data.refreshToken` | string | no | also delivered as a cookie; see 6.3 |
| `data.accessTokenExpiresIn` | integer | no | seconds; 900 in the shipped configuration |
| `data.tokenType` | string | no | always `Bearer` |
| `data.user.id` | uuid | no | |
| `data.user.username` | string | no | |
| `data.user.email` | string | no | |
| `data.user.displayName` | string | yes | |
| `data.user.role` | string | no | one of `user`, `moderator`, `admin`, lowercase |
| `data.user.emailVerified` | boolean | no | |

### 6.2 Where the role comes from, and the trap

**`GET /api/v1/users/me` does not return `role`.**
This is confirmed by calling it; the payload carries profile fields only.

There are exactly two places the caller's role is available:

1. `data.user.role` on the login response, lowercase (`admin`).
2. `data.user.role` on the refresh response, lowercase (`admin`).

The access token itself also carries a `role` claim, but **it is uppercase there** (`ADMIN`, `MODERATOR`, `USER`).
If you decode the JWT, normalise the case before comparing.

Recommended approach: store the role in a Zustand store at login, and re-populate it from the refresh response on application boot.
Do not call `/api/v1/users/me` expecting a role, and do not gate routes on a value you never populated.

### 6.3 The refresh token cookie

The refresh token is delivered as an HTTP-only cookie.
Captured `Set-Cookie` header from a development login:

```
Set-Cookie: luvax_refresh=hXve7AnoSYlJWBttAmJt64ymV1WdPGZg-weknUBQaHY; Path=/api/v1/auth; Max-Age=2592000; Expires=Sun, 20 Sep 2026 09:35:53 GMT; HttpOnly; SameSite=Lax
```

| Attribute | Development | Production |
|---|---|---|
| Name | `luvax_refresh` | same, from `REFRESH_COOKIE_NAME` |
| Path | `/api/v1/auth` | same, from `REFRESH_COOKIE_PATH` |
| `HttpOnly` | yes | yes |
| `SameSite` | `Lax` | `Lax` by default, from `REFRESH_COOKIE_SAME_SITE` |
| `Secure` | **absent** | `true` by default, from `REFRESH_COOKIE_SECURE` |
| `Max-Age` | 2592000 seconds, 30 days | from `REFRESH_TOKEN_TTL` |

**The trap.**
The cookie path is `/api/v1/auth`, so the browser sends it only to paths under `/api/v1/auth`.
It is never attached to any other request, and it does not need to be.

`SameSite=Lax` means the cookie is **not sent on cross-site requests**.
If you serve the panel from an origin the browser considers a different site from the API, refresh will silently fail with no cookie attached, and you will see `AUTH_REFRESH_TOKEN_INVALID` while believing you are logged in.
In development this is not a problem: `http://localhost:5173` calling `http://localhost:8080` is same-site, because SameSite compares registrable domains and both are `localhost`.

If you ever deploy the panel on a different registrable domain from the API, an operator must set `REFRESH_COOKIE_SAME_SITE=None`, `REFRESH_COOKIE_SECURE=true`, and `REFRESH_COOKIE_ALLOW_CROSS_SITE=true`.
The application refuses to start with `SameSite=None` unless the acknowledgement flag is also set, because that combination removes the only cross-site request protection on the refresh and logout endpoints.

**You must send credentials.**
Axios does not send cookies cross-origin unless told to:

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,  // http://localhost:8080
  withCredentials: true,                        // required for the refresh cookie
})
```

### 6.4 Attaching the access token

Send it as a bearer token on every request other than login and refresh:

```ts
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

Do not persist the access token in `localStorage` if you can avoid it.
It lives 15 minutes and section 6.5 gives you a way to recover a session without it.

### 6.5 Refresh

`POST /api/v1/auth/refresh`
No bearer token required.
No request body required.
The refresh cookie alone authenticates the call.

Captured request:

```bash
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:8080/api/v1/auth/refresh
```

Captured response, HTTP 200, with a rotated cookie:

```
Set-Cookie: luvax_refresh=qVsNA81Fxk5iYSy0aRiS6qnOnQJ52os0bR-8k4TyfJM; Path=/api/v1/auth; Max-Age=2592000; HttpOnly; SameSite=Lax
```

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...EWRXHQgfK_NQhyP4gWXvpndaCBLCJRTUzoYuOR_j4q4",
    "refreshToken": "qVsNA81Fxk5iYSy0aRiS6qnOnQJ52os0bR-8k4TyfJM",
    "accessTokenExpiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
      "username": "seed_admin",
      "email": "admin@seed.local",
      "displayName": "Seed Admin",
      "role": "admin",
      "emailVerified": true
    }
  },
  "timestamp": "2026-08-21T09:44:53.879821Z"
}
```

The response shape is identical to login, including the `user` object with `role`.
**Call refresh once on application boot.**
It is how you restore both the access token and the role after a page reload without asking the user to sign in again.

The refresh token is rotated on every call.
The old value stops working the moment a new one is issued.
Never run two refresh calls concurrently: the second will present a token the first already consumed and will fail.
Guard it with a single in-flight promise.

When refresh fails, HTTP 401:

```json
{
  "success": false,
  "code": "AUTH_REFRESH_TOKEN_INVALID",
  "message": "Invalid or revoked refresh token",
  "data": null,
  "timestamp": "2026-08-21T09:44:54.017733800Z"
}
```

On this response, clear the auth store and route to the login screen.
Do not retry.

### 6.6 Logout

`POST /api/v1/auth/logout`
Send the bearer token.
The refresh cookie is sent automatically because the path matches.

Captured response, HTTP 204, with no body:

```
HTTP/1.1 204
Set-Cookie: luvax_refresh=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
```

Logout does two things.
It clears the refresh cookie, and it blacklists the access token's `jti` in Redis until that token would have expired anyway.

**The access token you just logged out with is dead immediately.**
This was confirmed by calling an endpoint with it afterwards and receiving 401.
Clear it from your store rather than reusing it.

### 6.7 The token epoch, and the 401 you cannot distinguish

Read this before you write your 401 interceptor.

Each account carries a server-side epoch counter.
A force-logout and a role change both increment it.
Every access token issued before the increment stops working immediately, even though its `exp` claim is still in the future and your client has no way of knowing.

A ban, an unban, and a suspension have the same practical effect: existing tokens stop working.

Captured behaviour, using a token issued before the account was banned and unbanned:

```bash
curl -s -H "Authorization: Bearer $STALE" http://localhost:8080/api/v1/users/me
```

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication is required",
  "data": null,
  "timestamp": "2026-08-21T09:42:23.599999100Z"
}
```

HTTP 401, code `UNAUTHORIZED`.

**This is byte-for-byte the same response you get from an ordinary expired token.**
There is no distinct error code for epoch revocation.
You cannot tell the two apart from the response, and you should not try.

The correct handling is one rule that covers both:

```ts
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true
      try {
        await refreshOnce()               // single in-flight promise
        return api(original)              // replay the original request
      } catch {
        useAuthStore.getState().clear()
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
```

If the token died from ordinary expiry, the refresh succeeds and the replay works.
If it died from an epoch bump, the refresh also fails, and the user is correctly sent to the login screen.
Retry exactly once, tracked on the request config, or a permanently rejected token will loop.

A user whose account was suspended cannot log back in.
`POST /api/v1/auth/login` returns HTTP 403:

```json
{
  "success": false,
  "code": "AUTH_ACCOUNT_INACTIVE",
  "message": "This account is suspended or deactivated",
  "data": null,
  "timestamp": "2026-08-21T09:38:09.950942700Z"
}
```

Show this message on the login screen rather than a generic credential error, because the credentials were in fact correct.

### 6.8 CORS

Allowed origins come from the `CORS_ALLOWED_ORIGINS` environment variable, which is a comma-separated list.
The shipped `.env.example` sets `http://localhost:3000,http://localhost:5173`.
Vite's default port is 5173, so the default configuration already works.

Captured preflight from an allowed origin:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: authorization
Access-Control-Expose-Headers: Retry-After, X-Total-Count
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 3600
```

A preflight from an origin not on the list returns **HTTP 403**, not a missing-header failure.

If you run Vite on a non-default port, add that origin to `CORS_ALLOWED_ORIGINS` in `.env` and restart the application.
Do not attempt to work around it with a Vite proxy unless you also account for the cookie path.

Note that `Retry-After` is exposed, so your rate-limit handling can read it from the browser.

### 6.9 Real-time

**The panel does not need a WebSocket connection, and you should not build one.**

The real-time tiers that exist serve comments, notifications, post likes, and direct messages.
None of them carries an administrative or moderation event.
There is no push for a new report, no push for an escalation, and no push for a warning issued by another moderator.

A ticket endpoint exists and works, in case you later add a surface that needs it:

`POST /api/v1/auth/ws-ticket`, with a bearer token, returns HTTP 200:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": { "ticket": "2eb6633def21119d222d8abe67d5333f55e28a304a9e155c020dba19cdf1a0dd" },
  "timestamp": "2026-08-21T09:45:06.214628800Z"
}
```

The ticket is single-use and short-lived.
It exists so an access token never travels in a URL where proxies and content delivery networks would log it.

**Everything the panel needs that changes over time must be polled.**
Section 13 gives the recommended intervals.

---

## 7. Cross-cutting contracts

These hold for every endpoint in this document.
They are stated once here and not repeated in the catalogue.

### 7.1 The response envelope

Every response, success or failure, is wrapped in the same envelope.

Success:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": { },
  "timestamp": "2026-08-21T09:36:41.401512300Z"
}
```

Failure:

```json
{
  "success": false,
  "code": "ADMIN_TARGET_PROTECTED",
  "message": "This account is protected and cannot be changed through the API",
  "data": null,
  "timestamp": "2026-08-21T09:43:55.000000000Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `success` | boolean | no | mirrors the HTTP status class |
| `code` | string | no | machine-readable; `OK` or `CREATED` on success, an error code on failure. Branch on this, never on `message` |
| `message` | string | no | human-readable English; safe to show for most errors, but see section 10 for the ones you should replace |
| `data` | object or null | **yes** | the payload on success; `null` on most failures but **not all**, see section 10 |
| `timestamp` | string | no | ISO-8601 instant, UTC |

Unwrap `data` in a single Axios response interceptor so your query functions do not each repeat it.

The only endpoint in this document that does not return an envelope is `POST /api/v1/auth/logout`, which returns HTTP 204 with an empty body.

### 7.2 Cursor pagination

Every list endpoint in this document uses the same keyset cursor pagination.

Request parameters:

| Parameter | Type | Required | Default | Bounds |
|---|---|---|---|---|
| `cursor` | string | no | absent, meaning the first page | opaque; pass back exactly what you received |
| `limit` | integer | no | `20` | minimum 1, maximum 100 |

A `limit` of 0 or 101 is rejected with HTTP 400 and code `VALIDATION_ERROR`.

Response shape:

```json
{
  "content": [ ],
  "pageInfo": {
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "YWRtYToxNzg3MzA1ND...",
    "endCursor": "YWRtYToxNzg3MzA1ND..."
  },
  "degraded": false
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `content` | array | no | may be empty |
| `pageInfo.hasNextPage` | boolean | no | **the only correct termination signal** |
| `pageInfo.hasPreviousPage` | boolean | no | |
| `pageInfo.startCursor` | string | yes | null when `content` is empty |
| `pageInfo.endCursor` | string | yes | null when `content` is empty |
| `degraded` | boolean | no | true when the result came from a fallback path rather than the primary index or search cluster. Observed `false` on every administrative endpoint |

**The termination rule, stated precisely.**

Stop when `pageInfo.hasNextPage` is `false`.
Pass `pageInfo.endCursor` as the next request's `cursor` only while `hasNextPage` is `true`.

Two wrong rules that will bite you, both confirmed by walking a real list of 37 records at `limit=3`:

- **Do not stop when the page is empty.**
The final page contained one item and reported `hasNextPage: false`.
A loop that continues until it sees an empty page makes one unnecessary request; a loop that treats "fewer items than `limit`" as "keep going" never terminates correctly.
- **Do not stop when `endCursor` is null.**
On the final page `endCursor` was still a non-null string.
Requesting one more page with it returned `content: []` and `hasNextPage: false`, so a null check never fires.

With TanStack Query:

```ts
useInfiniteQuery({
  queryKey: ['admin', 'actions', filters],
  queryFn: ({ pageParam }) =>
    api.get('/api/v1/admin/actions', { params: { ...filters, cursor: pageParam, limit: 20 } }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) =>
    last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined,
})
```

Returning `undefined` from `getNextPageParam` is what stops TanStack Query.
Do not return `null`.

### 7.3 Cursor scope

**A cursor issued by one endpoint is rejected by every other endpoint.**

Cursors are scoped, and the scope is encoded inside the opaque string.
This matters because it is easy to share a generic pagination hook across screens and accidentally carry a cursor from one list into another.

Captured, passing a cursor obtained from `GET /api/v1/admin/users` into `GET /api/v1/admin/actions`:

```json
{
  "success": false,
  "code": "INVALID_CURSOR",
  "message": "Malformed pagination cursor",
  "data": null,
  "timestamp": "2026-08-21T09:42:00.000000000Z"
}
```

HTTP 400, code `INVALID_CURSOR`.

**This does not mean the cursor is corrupted, and it does not mean your storage is broken.**
It almost always means the cursor came from a different list.
Key your cursor state by endpoint.
Including the filter values in the TanStack Query key, as in the example above, gives you this for free: changing a filter starts a fresh pagination sequence rather than reusing a cursor that no longer applies.

### 7.4 Dates and times

Every timestamp is an ISO-8601 instant with an explicit offset, always UTC, for example `2026-08-21T09:36:41.401512300Z`.

Fractional seconds are present and vary in precision between six and nine digits.
Parse with something that tolerates variable precision.
`new Date(value)` in the browser handles these correctly.

The API never returns a local time and never returns a zone name.
Render in the viewer's local timezone, and label it, because a moderator reading an audit log needs to know whether `09:36` was their morning or someone else's.

Query parameters that take a time, namely `from` and `to`, accept the same ISO-8601 instant format.
Send them with a `Z` suffix.

### 7.5 Undeclared parameters and fields are rejected

This is the opposite of what most APIs do.
Both halves of this rule were confirmed by calling.

**Undeclared query parameters produce HTTP 400.**

```bash
curl -s -H "Authorization: Bearer $ADMIN" "http://localhost:8080/api/v1/admin/users?limitt=2"
```

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "Unsupported query parameter: limitt. Accepted: cursor, limit, role, status",
  "data": null,
  "timestamp": "2026-08-21T09:42:00.000000000Z"
}
```

The message enumerates the accepted parameters, which makes this easy to debug when it happens.

The practical consequence: **never spread a filter object into `params` if it can contain keys the endpoint does not declare.**
A common React pattern is to hold all filter state in one object and pass it wholesale.
Strip it to the declared keys first, and drop `undefined` values.

**Undeclared request-body fields also produce HTTP 400.**

```bash
curl -s -X PATCH http://localhost:8080/api/v1/admin/users/<id>/suspend \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"reason":"probe","nosuchfield":1}'
```

```json
{
  "success": false,
  "code": "MALFORMED_REQUEST_BODY",
  "message": "Request body could not be read",
  "data": null,
  "timestamp": "2026-08-21T09:41:30.000000000Z"
}
```

Note that the message here does **not** name the offending field.
If you get `MALFORMED_REQUEST_BODY` and the body looks like valid JSON, the cause is an extra field.

The practical consequence: **do not send your whole form state.**
React Hook Form will happily hand you every registered field plus anything else in the object.
Build the request body explicitly, field by field, from the tables in section 9.

### 7.6 Rate limiting

Limits are per caller, enforced on a sliding window in Redis.

| Path | Attempts | Window |
|---|---|---|
| `/api/v1/admin/**` | 300 | 60s |
| `/api/v1/admin/stats/timeseries` | 30 | 60s |
| `/api/v1/admin/user-events` | 30 | 60s |
| `/api/v1/admin/users/search` | 60 | 60s |
| `/api/v1/admin/hashtags/search` | 60 | 60s |
| `/api/v1/auth/login` | 10 | 900s |
| `/api/v1/auth/refresh` | 60 | 60s |
| `/api/v1/auth/ws-ticket` | 60 | 60s |

The four specific administrative rules override the broad `/api/v1/admin/**` rule for their exact paths.
The two search endpoints and the two expensive reads are therefore much tighter than the rest of the administrative surface.

Captured 429:

```
HTTP/1.1 429
Retry-After: 60
```

```json
{
  "success": false,
  "code": "TOO_MANY_REQUESTS",
  "message": "Too many requests. Please wait before trying again.",
  "data": null,
  "timestamp": "2026-08-21T09:46:29.009767300Z"
}
```

`Retry-After` is in seconds and is exposed to the browser through `Access-Control-Expose-Headers`, so you can read it.

**This matters most for search.**
A search-as-you-type input against `/api/v1/admin/users/search` at 60 requests per minute will hit the limit with a fast typist.
Debounce search inputs by at least 300 milliseconds, and disable the input rather than retrying when you get a 429.

Do not retry a 429 automatically inside TanStack Query.
Set `retry: (count, error) => error.response?.status !== 429 && count < 2` or similar, or a burst becomes a longer burst.

### 7.7 Login rate limit and the development trap

The login limit is 10 attempts per 15 minutes, keyed on the caller's IP address together with the submitted email.

While developing you will log in repeatedly from the same machine.
If you lock yourself out, either wait out the window or flush the key from Redis:

```bash
docker compose exec -T redis redis-cli -a redis --scan --pattern 'auth:ratelimit:*' | \
  xargs -r docker compose exec -T redis redis-cli -a redis DEL
```

---

## 8. Role matrix

### 8.1 The governing rule

An administrator can reach everything a moderator can reach, plus more.
There is no endpoint a moderator can call that an administrator cannot.

Where the two differ, the moderator is refused, and the refusal is almost always **403 `FORBIDDEN`**.

### 8.2 Unauthenticated requests

**Every endpoint in this document except `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh` returns HTTP 401 when called with no token.**
This was verified against all 47 endpoints.
It is not repeated in the table below.

### 8.3 403 and 404 mean different things, and you must render them differently

This codebase deliberately returns **404** in one place where most APIs would return 403, so that the response does not disclose that a record exists.

- **403 `FORBIDDEN`** means "this route is not for your role".
Render this as a route guard: the moderator should never have been able to navigate here.
Do not show an empty list; show nothing, or redirect.
- **404 `ADMIN_ACTION_NOT_FOUND`** on `GET /api/v1/admin/actions/{actionId}` means "no audit action with that id is visible to you".
A moderator gets this for any action it did not itself perform.
Render this as "not found", never as "forbidden", and never conclude the record was deleted.

### 8.4 The table

Status shown is the response for a well-formed request against a valid target.
`200` means the role is permitted.

| # | Method and path | MODERATOR | ADMIN |
|---|---|---|---|
| 1 | `POST /api/v1/auth/login` | 200 | 200 |
| 2 | `POST /api/v1/auth/refresh` | 200 | 200 |
| 3 | `POST /api/v1/auth/logout` | 204 | 204 |
| 4 | `POST /api/v1/auth/ws-ticket` | 200 | 200 |
| 5 | `GET /api/v1/users/me` | 200 | 200 |
| 6 | `GET /api/v1/users/me/warnings` | 200 | 200 |
| 7 | `GET /api/v1/config/vocabularies` | 200 | 200 |
| 8 | `GET /api/v1/reports` | 200 | 200 |
| 9 | `GET /api/v1/reports/pending` | 200 | 200 |
| 10 | `GET /api/v1/reports/{reportId}` | 200 | 200 |
| 11 | `PATCH /api/v1/reports/{reportId}/status` | 200 | 200 |
| 12 | `GET /api/v1/admin/actions` | 200, **own actions only** | 200, all actions |
| 13 | `GET /api/v1/admin/actions/{actionId}` | **404** unless the moderator performed it | 200 |
| 14 | `GET /api/v1/admin/actions/for-user/{userId}` | 200 | 200 |
| 15 | `GET /api/v1/admin/content/for-user/{userId}/posts` | 200 | 200 |
| 16 | `GET /api/v1/admin/content/for-user/{userId}/comments` | 200 | 200 |
| 17 | `GET /api/v1/admin/content/{entityType}/{entityId}` | 200 | 200 |
| 18 | `PATCH /api/v1/admin/posts/{postId}/remove` | 200 | 200 |
| 19 | `PATCH /api/v1/admin/posts/{postId}/restore` | 200 | 200 |
| 20 | `PATCH /api/v1/admin/comments/{commentId}/remove` | 200 | 200 |
| 21 | `PATCH /api/v1/admin/comments/{commentId}/restore` | 200 | 200 |
| 22 | `GET /api/v1/admin/reports/{reportId}/target` | 200 | 200 |
| 23 | `PATCH /api/v1/admin/reports/{reportId}/resolve` | 200, but **403** if the report is `escalated` | 200 |
| 24 | `PATCH /api/v1/admin/reports/{reportId}/dismiss` | 200, but **403** if the report is `escalated` | 200 |
| 25 | `PATCH /api/v1/admin/reports/{reportId}/escalate` | 200 | 200 |
| 26 | `GET /api/v1/admin/reports/escalated/count` | **403** | 200 |
| 27 | `GET /api/v1/admin/violations/for-user/{userId}` | 200 | 200 |
| 28 | `POST /api/v1/admin/warnings/for-user/{userId}` | 200 | 200 |
| 29 | `DELETE /api/v1/admin/warnings/{warningId}` | **403** | 200 |
| 30 | `DELETE /api/v1/admin/strikes/{strikeId}` | **403** | 200 |
| 31 | `GET /api/v1/admin/users` | **403** | 200 |
| 32 | `GET /api/v1/admin/users/search` | **403** | 200 |
| 33 | `GET /api/v1/admin/users/{userId}` | **403** | 200 |
| 34 | `PATCH /api/v1/admin/users/{userId}/ban` | **403** | 200 |
| 35 | `PATCH /api/v1/admin/users/{userId}/unban` | **403** | 200 |
| 36 | `PATCH /api/v1/admin/users/{userId}/suspend` | **403** | 200 |
| 37 | `PATCH /api/v1/admin/users/{userId}/unsuspend` | **403** | 200 |
| 38 | `PATCH /api/v1/admin/users/{userId}/role` | **403** | 200 |
| 39 | `POST /api/v1/admin/users/{userId}/force-logout` | **403** | 200 |
| 40 | `GET /api/v1/admin/hashtags` | **403** | 200 |
| 41 | `GET /api/v1/admin/hashtags/search` | **403** | 200 |
| 42 | `POST /api/v1/admin/hashtags` | **403** | 201 |
| 43 | `PATCH /api/v1/admin/hashtags/{hashtagId}` | **403** | 200 |
| 44 | `DELETE /api/v1/admin/hashtags/{hashtagId}` | **403** | 200 |
| 45 | `GET /api/v1/admin/stats/current` | **403** | 200 |
| 46 | `GET /api/v1/admin/stats/timeseries` | **403** | 200 |
| 47 | `GET /api/v1/admin/user-events` | **403** | 200 |

### 8.5 What this means for routing

A moderator has no access to any of: the user list, user search, user detail, every account status and role action, force-logout, warning and strike revocation, the entire hashtag registry, both statistics endpoints, the activity log, and the escalated-report counter.

Build two route trees.
Do not build one tree and hide buttons, because a moderator that types the URL of an administrator route must not reach a screen that then fires 403s.

Rows 12 and 13 are the only rows where a moderator sees a narrowed result rather than a refusal.
`GET /api/v1/admin/actions` returns only the actions that moderator performed.
This was verified: a moderator saw 5 of the 13 actions that existed, all of them its own.
This is what makes "my action log" and "the full action log" the same endpoint with different results.

---

## 9. Endpoint catalogue

Grouped by the area of the panel that uses them.

Conventions used throughout this section:

- Every endpoint requires the `Authorization: Bearer <accessToken>` header unless stated otherwise.
- Every list endpoint takes `cursor` and `limit` as described in section 7.2, and those two are not repeated per endpoint.
- Every endpoint can return `401`, `429`, and `500`; only the endpoint-specific errors are listed.
- "Nullable" means the field has been observed as `null` in practice or is declared nullable in the schema. Treat every one of these as genuinely optional in your types.

### 9.1 Session

#### `POST /api/v1/auth/login`

Covered in full in section 6.1.

Errors: `401 AUTH_INVALID_CREDENTIALS` for a wrong password, `403 AUTH_ACCOUNT_INACTIVE` for a suspended, banned, or deactivated account, `429 TOO_MANY_REQUESTS` after 10 attempts in 15 minutes.

#### `POST /api/v1/auth/refresh`

Covered in full in section 6.5.

#### `POST /api/v1/auth/logout`

Covered in full in section 6.6.
Returns 204 with no envelope.

#### `POST /api/v1/auth/ws-ticket`

Covered in section 6.9.
The panel does not need this.

#### `GET /api/v1/users/me`

Required role: any authenticated user.
No parameters.

Captured request:

```bash
curl -s -H "Authorization: Bearer $MOD" http://localhost:8080/api/v1/users/me
```

Captured response, HTTP 200:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "id": "026439a8-c92a-4b83-be97-f17db5854f16",
    "username": "seed_mod",
    "email": "mod@seed.local",
    "displayName": "Seed Mod",
    "bio": null,
    "avatarUrl": null,
    "bannerUrl": null,
    "websiteUrl": null,
    "isPrivate": false,
    "isVerified": false,
    "followerCount": 0,
    "followingCount": 0,
    "postCount": 0,
    "createdAt": "2026-08-18T21:18:48.921888Z"
  },
  "timestamp": "2026-08-21T09:44:42.258382300Z"
}
```

| Field | Type | Nullable |
|---|---|---|
| `id` | uuid | no |
| `username` | string | no |
| `email` | string | no |
| `displayName` | string | **yes** |
| `bio` | string | **yes** |
| `avatarUrl` | string | **yes** |
| `bannerUrl` | string | **yes** |
| `websiteUrl` | string | **yes** |
| `isPrivate` | boolean | no |
| `isVerified` | boolean | no |
| `followerCount` | integer | no |
| `followingCount` | integer | no |
| `postCount` | integer | no |
| `createdAt` | string | no |

**There is no `role` field.**
See section 6.2.
Use this endpoint for the signed-in user's display name and avatar in the panel header, and nothing else.

#### `GET /api/v1/users/me/warnings`

Required role: any authenticated user.
This is the account's own view of warnings issued against it.

Captured response, HTTP 200, for an account with one warning:

```json
{
  "content": [
    {
      "id": "16f87846-00b1-47a5-b5b7-1cf0107b1448",
      "reasonKey": "spam",
      "note": "handoff fixture: first warning",
      "createdAt": "2026-08-21T09:37:52.679664Z"
    }
  ],
  "pageInfo": {
    "hasNextPage": false,
    "hasPreviousPage": false,
    "startCursor": "b3dudzoxNzg3MzA1MDcyNjc5NjY0OjE2Zjg3ODQ2LTAwYjEtNDdhNS1iNWI3LTFjZjAxMDdiMTQ0OA",
    "endCursor": "b3dudzoxNzg3MzA1MDcyNjc5NjY0OjE2Zjg3ODQ2LTAwYjEtNDdhNS1iNWI3LTFjZjAxMDdiMTQ0OA"
  },
  "degraded": false
}
```

| Field | Type | Nullable |
|---|---|---|
| `id` | uuid | no |
| `reasonKey` | string | no |
| `note` | string | no |
| `createdAt` | string | no |

**The account is deliberately not told who issued the warning.**
Compare this with the moderator-facing violations payload in 9.4, which carries an `actorId`.
Do not attempt to show an issuer here; the field does not exist on this payload.

#### `GET /api/v1/config/vocabularies`

Required role: any authenticated user.
Covered in full in section 12.

### 9.2 Report queue

#### `GET /api/v1/reports`

Required role: moderator or administrator.

| Parameter | Type | Required | Default | Values |
|---|---|---|---|---|
| `status` | string | no | none, meaning all | `pending`, `reviewing`, `resolved`, `dismissed`, `escalated` |
| `reportType` | string | no | none, meaning all | `post`, `comment`, `user`, `story`, `message` |

**This is also the escalated queue.**
There is no separate endpoint for escalated reports.
Call `GET /api/v1/reports?status=escalated`.

Captured request:

```bash
curl -s -H "Authorization: Bearer $MOD" "http://localhost:8080/api/v1/reports?limit=1"
```

Captured `content[0]`, HTTP 200:

```json
{
  "id": "fe4572e0-4fc1-48f6-91f8-b87d2aa22122",
  "reporterId": "9bbc0295-1bc5-47c1-a52f-933be85fc803",
  "reportType": "post",
  "reportReason": "nudity",
  "entityId": "a0fc45e9-fb30-44ae-9a7a-a6f25131fda6",
  "status": "reviewing",
  "createdAt": "2026-08-21T09:37:03.116883Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `reporterId` | uuid | no | an id only; no username |
| `reportType` | string | no | |
| `reportReason` | string | no | a key from the `reportReasons` vocabulary |
| `entityId` | uuid | no | the reported entity, whose type is `reportType` |
| `status` | string | no | |
| `createdAt` | string | no | |

**The list carries no `description` and no reviewer fields.**
Those exist only on the single-report read below.

**The list gives you raw ids, not names.**
There is no endpoint that resolves a batch of user ids to usernames.
Either render the reporter as an id, or fetch `GET /api/v1/admin/content/user/{id}` per row, which a moderator is allowed to call.
Do not build a per-row fetch into an infinite-scrolling list without caching, because at 300 requests per minute you will hit the rate limit.

#### `GET /api/v1/reports/pending`

Required role: moderator or administrator.
Identical shape to `GET /api/v1/reports`, restricted to `pending`.
Equivalent to `GET /api/v1/reports?status=pending`.
Prefer the filtered form so one screen has one query.

#### `GET /api/v1/reports/{reportId}`

Required role: moderator or administrator.
A moderator retains read access to a report it escalated.

Captured response `data`, HTTP 200:

```json
{
  "id": "eecbade4-c9e9-4a42-ab1b-eea013ea72f4",
  "reporterId": "6db66fb3-6e51-4c21-8a20-f3218afd893d",
  "reportType": "user",
  "reportReason": "scam",
  "entityId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "description": "handoff fixture",
  "status": "escalated",
  "reviewedBy": null,
  "reviewedAt": null,
  "resolutionNote": null,
  "createdAt": "2026-08-21T09:37:03.738794Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `reporterId` | uuid | no | |
| `reportType` | string | no | |
| `reportReason` | string | no | |
| `entityId` | uuid | no | |
| `description` | string | **yes** | free text from the reporter; optional at submission |
| `status` | string | no | |
| `reviewedBy` | uuid | **yes** | null until a moderator or administrator closes it |
| `reviewedAt` | string | **yes** | null until closed |
| `resolutionNote` | string | **yes** | null until closed |
| `createdAt` | string | no | |

Errors: `404 REPORT_NOT_FOUND`.

#### `PATCH /api/v1/reports/{reportId}/status`

Required role: moderator or administrator.

**This endpoint performs exactly one transition: `pending` to `reviewing`.**
It cannot resolve, dismiss, or escalate a report, despite its request schema accepting all five status values.

Request body:

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | string | yes | accepts all five values, but only `reviewing` does anything useful |
| `resolutionNote` | string | no | accepted and then ignored; retained for wire compatibility only |

Do not build a resolution-note field on this call.
The note that gets recorded is the `reason` you send to the resolve and dismiss endpoints in 9.3.

Captured request:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/reports/<id>/status \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"status":"reviewing"}'
```

HTTP 200, `data` is the full report shape as in `GET /api/v1/reports/{reportId}`, with `status` now `reviewing`.

Errors: `404 REPORT_NOT_FOUND`, `409 REPORT_INVALID_TRANSITION` when the report is not `pending`.

### 9.3 Report resolution

All three action endpoints in this group return an `AdminActionResponse`, described in 9.4.

#### `PATCH /api/v1/admin/reports/{reportId}/resolve`

Required role: moderator or administrator.
**A moderator is refused with 403 if the report has already been escalated.**

Request body:

| Field | Type | Required | Constraint | On violation |
|---|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters | `400 VALIDATION_ERROR` |
| `reportId` | string | no | ignored on this path; the path parameter wins | |

Captured request:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/admin/reports/<id>/resolve \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"reason":"handoff fixture: confirmed violation"}'
```

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "resolve_report"`.

Errors: `403 FORBIDDEN` when a moderator targets an escalated report, `404 REPORT_NOT_FOUND`, `409 REPORT_INVALID_TRANSITION` when the report is already closed.

#### `PATCH /api/v1/admin/reports/{reportId}/dismiss`

Identical contract to resolve, with `actionType: "dismiss_report"`.
Works directly from `pending`; the report does not have to pass through `reviewing` first.

#### `PATCH /api/v1/admin/reports/{reportId}/escalate`

Required role: moderator or administrator.

Request body:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters |

The reason is mandatory.
HTTP 200, `data` is an `AdminActionResponse` with `actionType: "escalate_report"`.

Errors: `404 REPORT_NOT_FOUND`, `409 REPORT_INVALID_TRANSITION` when the report is already closed or already escalated.

#### `GET /api/v1/admin/reports/escalated/count`

Required role: **administrator only.**
No parameters.

Captured response, HTTP 200:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": { "count": 2 },
  "timestamp": "2026-08-21T09:46:00.248510200Z"
}
```

| Field | Type | Nullable |
|---|---|---|
| `count` | integer | no |

This is the only signal that a report has been escalated.
See section 13 for polling guidance.

#### `GET /api/v1/admin/reports/{reportId}/target`

Required role: moderator or administrator.
Returns the reported entity itself, so a reviewer can see what is being reported without leaving the report.

Captured response `data` for a report whose target is a user, HTTP 200:

```json
{
  "reportType": "user",
  "entityId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "ownerId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "ownerUsername": "seed_alice",
  "status": "active",
  "text": null,
  "mediaUrls": [],
  "removed": false,
  "createdAt": "2026-08-18T21:18:48.921888Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `reportType` | string | no | tells you which shape the other fields carry |
| `entityId` | uuid | no | |
| `ownerId` | uuid | **yes** | the account that owns the content; equals `entityId` when the target is a user |
| `ownerUsername` | string | **yes** | |
| `status` | string | **yes** | the entity's own lifecycle status, so `active` for a user, `published` for a post |
| `text` | string | **yes** | the caption or comment body; null when the target is a user |
| `mediaUrls` | array of string | no | empty array rather than null when there is no media |
| `removed` | boolean | no | whether moderation has already removed this entity |
| `createdAt` | string | no | |

**This is one payload serving five different entity types, so most fields are null most of the time.**
Branch your rendering on `reportType`, and do not assume `text` is present.

Errors: `404 REPORT_NOT_FOUND`.

### 9.4 The audit log

Every state-changing administrative call writes one row to the audit log and returns it.
That returned object is called `AdminActionResponse` here and is the response body of every action endpoint in sections 9.3, 9.5, 9.6, and 9.7.

**Read this before you render an audit row.**

Two fields will break a naive implementation:

- **`adminId` can be `null`.**
An automatic strike is issued by the system, not by a person, and its row carries no actor.
Rendering `row.adminId.slice(0,8)` or looking the id up unconditionally will throw.
Show something like "System" when it is null.
- **`metadata` is absent from every list response and present only on the single-action read.**
This was verified across all 13 rows of a list: not one carried a `metadata` key.
If your audit table shows metadata, you must fetch the detail per row, or not show it in the list.

Full shape, captured from `GET /api/v1/admin/actions/{actionId}`, HTTP 200:

```json
{
  "id": "c8992465-cc97-4aad-b318-df76c148e0e5",
  "adminId": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
  "actionType": "restore_post",
  "targetUserId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "targetEntityType": "post",
  "targetEntityId": "d454e232-d018-4a95-9deb-8874f5c8988b",
  "reportId": null,
  "reason": "handoff fixture: restore after ban",
  "metadata": {
    "resultingStatus": "published",
    "strippedHashtags": ["handoffactive"]
  },
  "createdAt": "2026-08-21T09:39:04.973006Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | the audit row's own id, **not** the id of the thing acted upon |
| `adminId` | uuid | **yes** | null for an automatic `issue_strike` |
| `actionType` | string | no | 22 values, listed below |
| `targetUserId` | uuid | **yes** | null when the target is not owned by an account, for example a hashtag |
| `targetEntityType` | string | **yes** | for example `post`, `comment`, `user`, `hashtag` |
| `targetEntityId` | uuid | **yes** | |
| `reportId` | uuid | **yes** | set when the action was taken from a report |
| `reason` | string | **yes** | |
| `metadata` | object | **yes** | **list responses omit this key entirely**; shape varies by `actionType` |
| `createdAt` | string | no | |

A captured example of the null-actor row:

```json
{
  "id": "128814de-7337-48a0-a545-90bf87809f5f",
  "adminId": null,
  "actionType": "issue_strike",
  "targetUserId": "9bbc0295-1bc5-47c1-a52f-933be85fc803",
  "targetEntityType": "user",
  "targetEntityId": "9bbc0295-1bc5-47c1-a52f-933be85fc803",
  "reportId": null,
  "reason": "Automatic strike after 3 active warnings",
  "createdAt": "2026-08-21T09:37:59.181139Z"
}
```

#### `GET /api/v1/admin/actions`

Required role: moderator or administrator.
**A moderator sees only the actions it performed.**
An administrator sees all actions.

| Parameter | Type | Required | Values |
|---|---|---|---|
| `adminId` | uuid | no | filter by actor |
| `actionType` | string | no | `ban_user`, `unban_user`, `suspend_user`, `unsuspend_user`, `remove_post`, `restore_post`, `remove_comment`, `restore_comment`, `remove_story`, `restore_story`, `remove_message`, `restore_message`, `resolve_report`, `dismiss_report`, `change_user_role`, `warn_user`, `revoke_warning`, `issue_strike`, `revoke_strike`, `escalate_report`, `force_logout`, `revoke_session`, `create_hashtag`, `edit_hashtag`, `ban_hashtag`, `unban_hashtag`, `delete_hashtag` |
| `targetUserId` | uuid | no | the account the action was taken against |
| `from` | string | no | ISO-8601 instant, **inclusive** lower bound on when the action was recorded |
| `to` | string | no | ISO-8601 instant, **exclusive** upper bound |

Five new `actionType` values are in that list: `remove_story`, `restore_story`, `remove_message`,
`restore_message` and `revoke_session`. If you render action types from a hard-coded map, add them
or those rows will fall through to a blank label.

**The window is half-open, `[from, to)`.** Two adjacent windows therefore partition the log with no
row counted twice and none skipped, which is what makes a month-by-month drill-down add up. Sending
`to` earlier than or equal to `from` is a `400 BAD_REQUEST`.

**Encode the offset.** A `+` in a query string is decoded as a space, so
`2026-08-21T13:00:00+07:00` arrives malformed and the endpoint answers 400. Send UTC with a `Z`
suffix, or percent-encode the `+` as `%2B`.

**The new filters compose with the moderator narrowing; they do not bypass it.** A moderator
supplying `targetUserId` sees only its own actions against that account. Verified live: a moderator
that explicitly asked for `adminId=<administrator>` still received only its own rows, because the
requested actor filter is discarded and replaced with the caller's own id. Do not build an
"investigate another moderator" view on this; it will silently return the caller's own work.

Captured request:

```bash
curl -s -H "Authorization: Bearer $ADMIN" "http://localhost:8080/api/v1/admin/actions?limit=3"

curl -s -H "Authorization: Bearer $ADMIN"   "http://localhost:8080/api/v1/admin/actions?targetUserId=<userId>&from=2026-08-21T13:21:19Z&to=2026-08-23T13:21:19Z&limit=1"
```

Returns a cursor page whose `content` entries have the `AdminActionResponse` shape **minus `metadata`**.

#### `GET /api/v1/admin/actions/{actionId}`

Required role: moderator or administrator.
This is the only place `metadata` is available.

**A moderator receives 404 `ADMIN_ACTION_NOT_FOUND` for any action it did not perform.**
This is deliberate and does not mean the row is missing.
See section 8.3.

Errors: `404 ADMIN_ACTION_NOT_FOUND`.

#### `GET /api/v1/admin/actions/for-user/{userId}`

Required role: moderator or administrator.
Every audit action taken against the given account.
Same entry shape as the list above, `metadata` omitted.

### 9.5 Content moderation

#### `GET /api/v1/admin/content/for-user/{userId}/posts`

Required role: moderator or administrator.
Lists the account's posts including drafts, archived posts, and posts moderation has already removed, regardless of whether the account is private or has blocked the reviewer.

Captured `content[0]`, HTTP 200:

```json
{
  "id": "a0fc45e9-fb30-44ae-9a7a-a6f25131fda6",
  "userId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "username": "seed_alice",
  "status": "published",
  "caption": "[seed] alice public post one",
  "removed": false,
  "likeCount": 0,
  "commentCount": 0,
  "createdAt": "2026-08-21T09:34:52.298865Z",
  "mediaUrls": []
}
```

**`mediaUrls` carries the attached images and video, in carousel order.** It is the same shape the
report-anchored moderation view returns, so a reviewer sees the same thing on both screens. Empty
for a text post, never null. Captured on a carousel post:

```json
"mediaUrls": ["https://cdn.example/e2e-1787404908-0.jpg",
              "https://cdn.example/e2e-1787404908-1.jpg"]
```

Comment rows carry no equivalent, because comments have no media in this schema. Do not build a
media column into a shared post-and-comment table component and expect it to fill on the comment
side.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `userId` | uuid | no | |
| `username` | string | **yes** | null for a deleted account |
| `status` | string | no | `draft`, `published`, `archived`, `removed` |
| `caption` | string | **yes** | a post need not have one |
| `removed` | boolean | no | |
| `likeCount` | integer | no | |
| `commentCount` | integer | no | |
| `createdAt` | string | no | |

#### `GET /api/v1/admin/content/for-user/{userId}/comments`

Required role: moderator or administrator.

Captured `content[0]`, HTTP 200:

```json
{
  "id": "f86b51c2-a444-46e5-874f-bbd96592e7e0",
  "userId": "6db66fb3-6e51-4c21-8a20-f3218afd893d",
  "username": "seed_carol",
  "postId": "198612b9-e84e-49f8-84a7-69d2e6eaf5ed",
  "parentId": null,
  "content": "admin matrix comment",
  "moderationStatus": "approved",
  "removed": false,
  "likeCount": 0,
  "createdAt": "2026-08-21T09:42:42.063426Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `userId` | uuid | no | |
| `username` | string | **yes** | |
| `postId` | uuid | no | the post the comment belongs to |
| `parentId` | uuid | **yes** | null for a top-level comment |
| `content` | string | no | |
| `moderationStatus` | string | no | for example `approved` |
| `removed` | boolean | no | |
| `likeCount` | integer | no | |
| `createdAt` | string | no | |

#### `GET /api/v1/admin/content/{entityType}/{entityId}`

Required role: moderator or administrator.
Opens a single entity by its own identifier, so a link from an audit row or a content listing does not dead-end.

| Parameter | In | Required | Values |
|---|---|---|---|
| `entityType` | path | yes | `post`, `comment`, `user`, `story`, `message` |
| `entityId` | path | yes | uuid |

**This returns the same payload shape as `GET /api/v1/admin/reports/{reportId}/target`, including a field literally named `reportType`, even though no report is involved here.**
Do not be confused by the name; on this endpoint it simply echoes the `entityType` you asked for.

Captured for a post, HTTP 200:

```json
{
  "reportType": "post",
  "entityId": "a0fc45e9-fb30-44ae-9a7a-a6f25131fda6",
  "ownerId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "ownerUsername": "seed_alice",
  "status": "published",
  "text": "[seed] alice public post one",
  "mediaUrls": [],
  "removed": false,
  "createdAt": "2026-08-21T09:34:52.298865Z"
}
```

Captured for a comment, HTTP 200, note `status` is null:

```json
{
  "reportType": "comment",
  "entityId": "34cdb03d-46e7-434c-b023-528e16e61b1d",
  "ownerId": "6db66fb3-6e51-4c21-8a20-f3218afd893d",
  "ownerUsername": "seed_carol",
  "status": null,
  "text": "handoff fixture comment",
  "mediaUrls": [],
  "removed": false,
  "createdAt": "2026-08-21T09:39:33.192434Z"
}
```

Field table is identical to `GET /api/v1/admin/reports/{reportId}/target` in section 9.3.

**This is the endpoint to use to resolve a user id to a username**, by calling it with `entityType=user`.
A moderator is permitted to call it, which is what makes the report queue renderable without administrator access.

#### `PATCH /api/v1/admin/posts/{postId}/remove`

Required role: moderator or administrator.

Request body:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters |
| `reportId` | uuid | no | links the action to the report that prompted it |

Captured request:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/admin/posts/<postId>/remove \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"reason":"handoff fixture: removing to test restore"}'
```

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "remove_post"`.

Errors: `404 POST_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when the post is already removed.

#### `PATCH /api/v1/admin/posts/{postId}/restore`

Required role: moderator or administrator.
Same request body as remove.

**This endpoint's response shape is different from every other action endpoint, and you must handle the difference.**
Where remove returns an `AdminActionResponse` directly as `data`, restore wraps it.

Captured response, HTTP 200:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "action": {
      "id": "c8992465-cc97-4aad-b318-df76c148e0e5",
      "adminId": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
      "actionType": "restore_post",
      "targetUserId": "28faa499-cfdc-4336-846b-81c37f6615a5",
      "targetEntityType": "post",
      "targetEntityId": "d454e232-d018-4a95-9deb-8874f5c8988b",
      "reportId": null,
      "reason": "handoff fixture: restore after ban",
      "metadata": {
        "resultingStatus": "published",
        "strippedHashtags": ["handoffactive"]
      },
      "createdAt": "2026-08-21T09:39:04.973006Z"
    },
    "remainingBannedHashtags": ["handoffactive"]
  },
  "timestamp": "2026-08-21T09:39:04.982561800Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `data.action` | object | no | an `AdminActionResponse`, and here it **does** carry `metadata` |
| `data.remainingBannedHashtags` | array of string | no | empty array when nothing was dropped |

**You must surface `remainingBannedHashtags` to the moderator.**
See the rule in section 11.8.

Errors: `404 POST_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when the post is not in a removed state.

#### `PATCH /api/v1/admin/comments/{commentId}/remove` and `/restore`

Required role: moderator or administrator.
Same request body as the post endpoints.
Both return an `AdminActionResponse` directly as `data`, with `actionType` of `remove_comment` or `restore_comment`.

Comments have no hashtags, so restore here has no `remainingBannedHashtags` wrapper.

Errors: `404 COMMENT_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION`.

#### `PATCH /api/v1/admin/stories/{storyId}/remove`

Required role: moderator or administrator.

Same request body as every other content action:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters |
| `reportId` | uuid | no | links the action to the report that prompted it |

```bash
curl -s -X PATCH http://localhost:8080/api/v1/admin/stories/<storyId>/remove \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"reason":"spam in story","reportId":"<reportId>"}'
```

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "remove_story"`.

The story disappears from its owner's profile and from every viewer's story feed immediately.

Errors: `404 STORY_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when it is already removed.

#### `PATCH /api/v1/admin/stories/{storyId}/restore`

Required role: moderator or administrator. Same body, `actionType: "restore_story"`.

**Do not promise the reviewer that a restore always brings a story back.** Removal writes only the
soft-delete marker; the twenty-four hour expiry is untouched and keeps deciding visibility. Three
outcomes, and your copy has to survive all of them:

| Situation | What happens |
|---|---|
| Story still within its 24 hours | It returns to the owner's profile and to viewers' feeds |
| Story expired while it was removed | The row comes back live, and **no feed shows it**. This is correct, not a bug: a restore must not extend content past its lifetime |
| Story was both removed and expired when the cleanup job last ran | The row is gone for good and this answers `404 STORY_NOT_FOUND` |

The cleanup job runs hourly by default, so the third case becomes reachable about an hour after a
removed story expires.

Errors: `404 STORY_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when it is not removed.

#### `PATCH /api/v1/admin/messages/{messageId}/remove`

Required role: moderator or administrator. Same body, `actionType: "remove_message"`.

Both participants immediately see the message as deleted, with `content`, `mediaAssetId`, `media`,
`sharedPostId` and `sharedStoryId` all null and `isDeleted: true`. That is the same placeholder the
thread already shows when a sender deletes their own message, so **render it with the existing
placeholder rather than adding a "removed by an administrator" variant** - the wire gives you no way
to tell the two apart, deliberately.

Captured, what each participant sees afterwards:

```json
{"id":"fc3a89c9-...","content":null,"mediaAssetId":null,"media":null,
 "isDeleted":true,"deletedAt":"2026-08-22T10:24:15.705062Z"}
```

The row keeps its payload behind the scenes, which is what makes the restore possible.

Errors: `404 MESSAGE_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when it is already removed.

#### `PATCH /api/v1/admin/messages/{messageId}/restore`

Required role: moderator or administrator. Same body, `actionType: "restore_message"`.

Returns the text, the media and any shared post or story to both participants.

**A message the sender deleted cannot be restored by moderation.** It answers
`409 ADMIN_INVALID_TRANSITION`. The sender's own deletion destroys the content, so there is nothing
to put back, and moderation does not reverse a user's own decision. If your UI offers restore on any
message showing the deleted placeholder, it will hit this 409 on the ones the sender deleted; gate
the control on the report, not on the placeholder.

Errors: `404 MESSAGE_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when it is not administratively
removed.

### 9.6 Account discipline

#### `GET /api/v1/admin/violations/for-user/{userId}`

Required role: moderator or administrator.

**A moderator sees warnings only. An administrator sees warnings and strikes.**
This was verified: for the same account, a moderator received 4 entries and an administrator received 5, the extra one being the strike.
This is not a filter you can override; it is derived from the caller's role.

**A consequence that will bite you: the cursor is scoped to the role variant.**
A cursor obtained by a moderator is rejected with `400 INVALID_CURSOR` if replayed by an administrator against the same endpoint, and the reverse also holds.
Include the caller's role in your TanStack Query key for this endpoint so a role change starts a fresh sequence.

**Revoked warnings and strikes are excluded by default, and included on request.**

| Parameter | Type | Required | Constraint |
|---|---|---|---|
| `includeRevoked` | boolean | no | default `false`, which is the previous behaviour |
| `cursor` | string | no | scoped to role **and** to this flag, see below |
| `limit` | integer | no | 1 to 100, default 20 |

Send `includeRevoked=true` and each revoked entry comes back carrying `revokedAt` and `revokedBy`.
Both are `null` on an entry that still stands, so a non-null `revokedAt` is what tells the two
apart. Captured, an administrator asking for them:

```json
{"content":[
  {"kind":"strike","id":"9ff4f5da-...","userId":"9bbc0295-...",
   "actorId":"2f0d04c6-...","strikeNumber":1,
   "createdAt":"2026-08-22T13:21:04.115434Z","revokedAt":null,"revokedBy":null},
  {"kind":"warning","id":"dc62b2ce-...","userId":"9bbc0295-...",
   "actorId":"2f0d04c6-...","reasonKey":"spam","note":"...",
   "createdAt":"2026-08-22T13:21:04.09328Z","revokedAt":null,"revokedBy":null}]}
```

**The cursor is scoped to this flag as well as to the role, so there are four variants.** Toggling
"show revoked" mid-listing invalidates the cursor you are holding: it will be rejected with
`400 INVALID_CURSOR`. Put both the role and the flag in your query key and start a fresh sequence
when either changes.

`revokedBy` is an account id, so resolve it through `GET /api/v1/admin/user-summaries` along with
the other identifiers on the page rather than one at a time.

The response is a **discriminated union** on the `kind` field.
The OpenAPI document declares this properly with a discriminator, so a generator will produce a usable union type.

Captured warning variant:

```json
{
  "kind": "warning",
  "id": "278565da-e4c1-4cb4-b351-b39fa598b797",
  "userId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "actorId": "026439a8-c92a-4b83-be97-f17db5854f16",
  "reasonKey": "spam",
  "note": "strike fixture 3",
  "createdAt": "2026-08-21T09:54:06.306825Z"
}
```

Captured strike variant:

```json
{
  "kind": "strike",
  "id": "eacd8453-e4d4-4f29-a6f2-46ddf2c47ff0",
  "userId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "actorId": "026439a8-c92a-4b83-be97-f17db5854f16",
  "strikeNumber": 1,
  "createdAt": "2026-08-21T09:54:06.368214Z"
}
```

| Field | Present on | Type | Nullable |
|---|---|---|---|
| `kind` | both | string | no, one of `warning` or `strike` |
| `id` | both | uuid | no |
| `userId` | both | uuid | no |
| `actorId` | both | uuid | **yes** |
| `reasonKey` | warning only | string | no |
| `note` | warning only | string | no |
| `strikeNumber` | strike only | integer | no |
| `createdAt` | both | string | no |

On a strike, `actorId` is the moderator whose warning triggered it, not a person who chose to issue a strike.
Label it accordingly, for example "triggered by".

#### `POST /api/v1/admin/warnings/for-user/{userId}`

Required role: moderator or administrator.

Request body:

| Field | Type | Required | Constraint | On violation |
|---|---|---|---|---|
| `reasonKey` | string | **yes** | max 50 characters; must be the `key` of an **enabled** row from the `reportReasons` vocabulary | `400 VALIDATION_ERROR` |
| `note` | string | **yes** | max 2000 characters | `400 VALIDATION_ERROR` |

**Populate the reason selector from `GET /api/v1/config/vocabularies` → `reportReasons`.**
Do not hardcode the list.
See section 12.

Captured request:

```bash
curl -s -X POST http://localhost:8080/api/v1/admin/warnings/for-user/<userId> \
  -H "Authorization: Bearer $MOD" -H 'Content-Type: application/json' \
  -d '{"reasonKey":"spam","note":"handoff fixture: first warning"}'
```

Captured response, HTTP 200, for a warning that did not trigger a strike:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "warning": {
      "id": "16f87846-00b1-47a5-b5b7-1cf0107b1448",
      "userId": "6db66fb3-6e51-4c21-8a20-f3218afd893d",
      "issuedBy": "026439a8-c92a-4b83-be97-f17db5854f16",
      "reasonKey": "spam",
      "note": "handoff fixture: first warning",
      "revokedAt": null,
      "createdAt": "2026-08-21T09:37:52.679664Z"
    },
    "activeWarningCount": 1,
    "strikeIssued": false,
    "strike": null,
    "resultingStatus": "active"
  },
  "timestamp": "2026-08-21T09:37:52.723012500Z"
}
```

Captured response, HTTP 200, for the **third** warning, which triggered a strike:

```json
{
  "data": {
    "warning": { "id": "05ac752d-...", "...": "as above" },
    "activeWarningCount": 0,
    "strikeIssued": true,
    "strike": {
      "id": "d36b87f6-9443-4cda-9857-5d10af29a297",
      "userId": "9bbc0295-1bc5-47c1-a52f-933be85fc803",
      "strikeNumber": 1,
      "triggeredBy": "026439a8-c92a-4b83-be97-f17db5854f16",
      "revokedAt": null,
      "createdAt": "2026-08-21T09:37:59.203278Z"
    },
    "resultingStatus": "suspended"
  }
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `warning.id` | uuid | no | |
| `warning.userId` | uuid | no | |
| `warning.issuedBy` | uuid | no | |
| `warning.reasonKey` | string | no | |
| `warning.note` | string | no | |
| `warning.revokedAt` | string | **yes** | always null on a freshly issued warning |
| `warning.createdAt` | string | no | |
| `activeWarningCount` | integer | no | **resets to 0 when a strike fires** |
| `strikeIssued` | boolean | no | |
| `strike` | object | **yes** | null unless `strikeIssued` is true |
| `strike.strikeNumber` | integer | no | 1, 2, or 3 and above |
| `strike.triggeredBy` | uuid | no | the moderator whose warning tripped the threshold |
| `resultingStatus` | string | no | the target account's status after the call: `active`, `suspended`, or `banned` |

**Drive your confirmation dialogue from the response, not from your own count.**
When `strikeIssued` is true, the account's status has just changed, and `resultingStatus` tells you to what.
Show that outcome to the moderator, because they did not explicitly ask to suspend anyone.

Errors: `403 ADMIN_TARGET_NOT_WARNABLE` when the target is a moderator or an administrator, `404 USER_NOT_FOUND`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/admin/warnings/{warningId}`

Required role: **administrator only.** A moderator gets 403.

Request body:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters |

Note this is a `DELETE` **with a body**.
Axios requires the body under a `data` key on delete:

```ts
api.delete(`/api/v1/admin/warnings/${id}`, { data: { reason } })
```

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "revoke_warning"`.

**Revoking a warning does not change the account's status.**
If a strike already suspended the account, revoking one of the warnings that caused it leaves the suspension in place.
Do not tell the moderator the account has been restored.

Errors: `404 WARNING_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when the warning is already revoked.

#### `DELETE /api/v1/admin/strikes/{strikeId}`

Required role: **administrator only.** A moderator gets 403.
Same request body and same Axios caveat as revoking a warning.

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "revoke_strike"`.

**Revoking a strike does not lift the suspension or ban that strike caused.**
The account's status is left exactly as it is.
To restore the account, call unsuspend or unban separately.

Errors: `404 STRIKE_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when already revoked.

### 9.7 Accounts

Every endpoint in this group is **administrator only**. A moderator receives 403 on all of them.

#### `GET /api/v1/admin/users`

| Parameter | Type | Required | Values |
|---|---|---|---|
| `status` | string | no | `active`, `suspended`, `deactivated`, `banned` |
| `role` | string | no | `user`, `moderator`, `admin` |

Captured `content[0]`, HTTP 200:

```json
{
  "id": "9bbc0295-1bc5-47c1-a52f-933be85fc803",
  "username": "seed_bob",
  "email": "bob@seed.local",
  "displayName": "Seed Bob",
  "role": "user",
  "status": "active",
  "isVerified": false,
  "isPrivate": true,
  "createdAt": "2026-08-18T21:18:48.921888Z",
  "lastLoginAt": "2026-08-21T09:42:24.871714Z",
  "deletedAt": null
}
```

| Field | Type | Nullable |
|---|---|---|
| `id` | uuid | no |
| `username` | string | no |
| `email` | string | no |
| `displayName` | string | **yes** |
| `role` | string | no |
| `status` | string | no |
| `isVerified` | boolean | no |
| `isPrivate` | boolean | no |
| `createdAt` | string | no |
| `lastLoginAt` | string | **yes** |
| `deletedAt` | string | **yes** |

#### `GET /api/v1/admin/users/search`

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `q` | string | **yes** | omitting it is a 400 |

Entry shape is identical to `GET /api/v1/admin/users`, verified by comparing both payloads for the same account.

**Rate limited to 60 requests per minute.**
Debounce the input by at least 300 milliseconds.

#### `GET /api/v1/admin/users/{userId}`

The richest payload in the API, and the one that should drive your control rendering.

Captured response `data`, HTTP 200, truncated in the `sessions` array only:

```json
{
  "id": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "username": "seed_alice",
  "email": "alice@seed.local",
  "displayName": "Seed Alice",
  "role": "user",
  "status": "active",
  "isVerified": false,
  "isPrivate": false,
  "createdAt": "2026-08-18T21:18:48.921888Z",
  "deletedAt": null,
  "registrationIp": null,
  "lastLoginIp": "::1",
  "lastLoginAt": "2026-08-21T09:36:08.896539Z",
  "suspendedUntil": null,
  "sessions": [
    {
      "id": "052c847a-86d0-418a-8d0d-c23c6d5bc292",
      "deviceId": null,
      "userAgent": "curl/8.14.1",
      "ipAddress": "::1",
      "createdAt": "2026-08-21T09:36:08.90329Z",
      "expiresAt": "2026-09-20T09:36:08.90055Z"
    }
  ],
  "reportsAgainst": [
    {
      "id": "eecbade4-c9e9-4a42-ab1b-eea013ea72f4",
      "reporterId": "6db66fb3-6e51-4c21-8a20-f3218afd893d",
      "reportReason": "scam",
      "status": "escalated",
      "createdAt": "2026-08-21T09:37:03.738794Z"
    }
  ],
  "capabilities": {
    "canChangeStatus": true,
    "canChangeRole": true,
    "assignableRoles": ["moderator"]
  },
  "activeWarningCount": 2
}
```

**`activeWarningCount` is how you warn the reviewer before the third warning, not after it.**

Three active warnings automatically issue a strike, and a strike suspends the account. This field is
the same number the strike decision itself uses, so when it reads `2` the next warning will suspend
the account. Say so in the confirmation dialog.

It is always present and never null; an account that has never been warned reads `0`. It is not a
count of every warning ever issued: it excludes revoked warnings, warnings issued before the most
recent unrevoked strike, and warnings older than the retention window. Verified live: it read `2`
after two warnings, and `0` immediately after the third issued a strike, because the strike consumes
the warnings that produced it.

Do not compute this yourself from the violations list. That list is a cursor page with no total, so
any number you derive from a partial page is fiction.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `username` | string | no | |
| `email` | string | no | |
| `displayName` | string | **yes** | |
| `role` | string | no | |
| `status` | string | no | |
| `isVerified` | boolean | no | |
| `isPrivate` | boolean | no | |
| `createdAt` | string | no | |
| `deletedAt` | string | **yes** | |
| `registrationIp` | string | **yes** | observed null on every seeded account |
| `lastLoginIp` | string | **yes** | |
| `lastLoginAt` | string | **yes** | null for an account that has never signed in |
| `suspendedUntil` | string | **yes** | null when not suspended, **and also null for an indefinite suspension** |
| `sessions` | array | no | may be empty |
| `sessions[].id` | uuid | no | |
| `sessions[].deviceId` | string | **yes** | |
| `sessions[].userAgent` | string | **yes** | |
| `sessions[].ipAddress` | string | **yes** | |
| `sessions[].createdAt` | string | no | |
| `sessions[].expiresAt` | string | no | |
| `reportsAgainst` | array | no | may be empty |
| `reportsAgainst[].id` | uuid | no | |
| `reportsAgainst[].reporterId` | uuid | no | |
| `reportsAgainst[].reportReason` | string | no | |
| `reportsAgainst[].status` | string | no | |
| `reportsAgainst[].createdAt` | string | no | |
| `capabilities` | object | no | see section 11.9 |
| `capabilities.canChangeStatus` | boolean | no | |
| `capabilities.canChangeRole` | boolean | no | |
| `capabilities.assignableRoles` | array of string | no | may be empty |

**`suspendedUntil` being null is ambiguous.**
It is null both for an account that is not suspended and for one suspended indefinitely.
Read `status` to tell them apart: if `status` is `suspended` and `suspendedUntil` is null, the suspension has no end date.

#### `PATCH /api/v1/admin/users/{userId}/suspend`

Request body:

| Field | Type | Required | Constraint | On violation |
|---|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters | `400 VALIDATION_ERROR` |
| `reportId` | uuid | no | | |
| `durationDays` | integer | no | minimum 1, maximum 3650; **omit for an indefinite suspension** | `400 VALIDATION_ERROR` |

The field is `durationDays`.
It is not `days`, and sending `days` produces `400 MALFORMED_REQUEST_BODY` because of the rule in section 7.5.

Captured, with body `{"reason":"probe"}`, HTTP 200: an indefinite suspension.

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "suspend_user"`.

Errors: `403 ADMIN_TARGET_PROTECTED`, `409 ADMIN_SELF_ACTION_NOT_ALLOWED`, `409 ADMIN_INVALID_TRANSITION` when already suspended, `404 USER_NOT_FOUND`.

#### `PATCH /api/v1/admin/users/{userId}/unsuspend`, `/ban`, `/unban`

Request body for all three:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters |
| `reportId` | uuid | no | |

Each returns an `AdminActionResponse` with the matching `actionType`.

Errors for all three: `403 ADMIN_TARGET_PROTECTED`, `409 ADMIN_SELF_ACTION_NOT_ALLOWED`, `409 ADMIN_INVALID_TRANSITION`, `404 USER_NOT_FOUND`.

**A ban or an unban invalidates the target's existing access tokens.**
If the target is signed in, their next request fails with 401.

#### `PATCH /api/v1/admin/users/{userId}/role`

Request body:

| Field | Type | Required | Values |
|---|---|---|---|
| `role` | string | **yes** | `user`, `moderator`, `admin` |
| `reason` | string | **yes** | max 2000 characters |

Read section 11.1 before building this control.
The permitted transitions are narrow and the failures are all avoidable.

Errors: `403 ADMIN_TARGET_PROTECTED` when the target is an administrator, `409 ADMIN_SELF_ACTION_NOT_ALLOWED`, `409 ADMIN_ROLE_TRANSITION_NOT_ALLOWED` when the transition skips a level, `404 USER_NOT_FOUND`.

#### `POST /api/v1/admin/users/{userId}/force-logout`

Request body:

| Field | Type | Required |
|---|---|---|
| `reason` | string | **yes** |

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "force_logout"`.

Ends every session the account has by incrementing its token epoch.
Every access token the account holds stops working immediately, and every refresh token is revoked.

### 9.8 Hashtag registry

Every endpoint in this group is **administrator only**. A moderator receives 403 on all five.

#### `GET /api/v1/admin/hashtags`

| Parameter | Type | Required | Values |
|---|---|---|---|
| `status` | string | no | `active`, `banned`, `deleted` |

Captured `content[0]`, HTTP 200:

```json
{
  "id": "9b55eaa5-2c3a-4f7a-a2cb-f198484b812b",
  "name": "handoffbanned",
  "postCount": 0,
  "status": "banned",
  "statusNote": "handoff fixture: banned tag",
  "statusAt": "2026-08-21T09:38:40.282767Z",
  "statusBy": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
  "createdAt": "2026-08-21T09:38:41.023421Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `name` | string | no | without the leading `#`, always lowercase |
| `postCount` | integer | no | survives a ban and a delete |
| `status` | string | no | `active`, `banned`, `deleted` |
| `statusNote` | string | **yes** | null for a hashtag that has never had its status set explicitly |
| `statusAt` | string | **yes** | |
| `statusBy` | uuid | **yes** | |
| `createdAt` | string | no | |

#### `GET /api/v1/admin/hashtags/search`

| Parameter | Type | Required | Values |
|---|---|---|---|
| `q` | string | **yes** | |
| `status` | string | no | `active`, `banned`, `deleted` |

Same entry shape as the listing.
Rate limited to 60 requests per minute; debounce.

#### `POST /api/v1/admin/hashtags`

Request body:

| Field | Type | Required | Constraint | On violation |
|---|---|---|---|---|
| `name` | string | **yes** | max 101 characters; the leading `#` is optional and the value is lowercased before insert | `400 VALIDATION_ERROR` |
| `status` | string | **yes** | `active` or `banned`; **`deleted` is refused** | `400` |
| `note` | string | **yes** | max 2000 characters | `400 VALIDATION_ERROR` |

**The response is the audit action, not the hashtag.**
This is the single easiest mistake to make on this endpoint.

Captured request:

```bash
curl -s -X POST http://localhost:8080/api/v1/admin/hashtags \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"name":"handoffactive","status":"active","note":"handoff fixture: active tag"}'
```

Captured response, HTTP 201, code `CREATED`:

```json
{
  "success": true,
  "code": "CREATED",
  "message": "Resource created successfully",
  "data": {
    "id": "db16cc34-3104-4794-bf2f-19b89d62407b",
    "adminId": "2f0d04c6-efcd-42b1-92af-22c1bd44d758",
    "actionType": "create_hashtag",
    "targetUserId": null,
    "targetEntityType": "hashtag",
    "targetEntityId": "19fa8eee-7480-4352-b7c7-1f4be2bb65c0",
    "reportId": null,
    "reason": "handoff fixture: active tag",
    "metadata": { "name": "handoffactive", "resultingStatus": "active" },
    "createdAt": "2026-08-21T09:38:40.167748Z"
  },
  "timestamp": "2026-08-21T09:38:40.174457600Z"
}
```

**`data.id` is the audit action's id. The new hashtag's id is `data.targetEntityId`.**
If you navigate to the new hashtag using `data.id` you will get a 404 that looks inexplicable.

Errors: `409` when the name already exists, `400 VALIDATION_ERROR`.

#### `PATCH /api/v1/admin/hashtags/{hashtagId}`

Request body:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `status` | string | **yes** | `active`, `banned`, `deleted`; must differ from the current status |
| `note` | string | **yes** | max 2000 characters |

**The hashtag's name is immutable, and a body carrying a `name` field is rejected** with `400 MALFORMED_REQUEST_BODY` under the rule in section 7.5.
Render the name as read-only text in your edit form, and never include it in the request body.

Captured response, HTTP 200, `data` is an `AdminActionResponse`:

```json
{
  "actionType": "ban_hashtag",
  "metadata": { "name": "handoffactive", "resultingStatus": "banned", "previousStatus": "active" },
  "...": "remaining AdminActionResponse fields"
}
```

`actionType` reflects the transition: `ban_hashtag`, `unban_hashtag`, `delete_hashtag`, or `edit_hashtag`.

Errors: `404 HASHTAG_NOT_FOUND`, `409 ADMIN_INVALID_TRANSITION` when the requested status equals the current one.

#### `DELETE /api/v1/admin/hashtags/{hashtagId}`

Request body:

| Field | Type | Required | Constraint |
|---|---|---|---|
| `reason` | string | **yes** | max 2000 characters |

A `DELETE` with a body; use `api.delete(url, { data: { reason } })`.

HTTP 200, `data` is an `AdminActionResponse` with `actionType: "delete_hashtag"`.

This is a status transition to `deleted`, not a row deletion.
Posts that used the tag, their associations, and `postCount` all survive.

### 9.9 Observability

Both statistics endpoints and the activity log are **administrator only**.

#### `GET /api/v1/admin/stats/current`

No parameters.

**Read section 13.1 before building this screen.**
On a freshly deployed or freshly reset system this endpoint returns zeros and nulls, and that is correct behaviour, not a failure.

Captured response on a system with no collected buckets, HTTP 200:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "bucketStart": null,
    "computedAt": null,
    "totalUsers": 0,
    "usersByStatus": {},
    "usersByRole": {},
    "totalPosts": 0,
    "totalComments": 0,
    "totalStories": 0,
    "reportsByStatus": {},
    "reportsByReason": {},
    "topHashtags": [],
    "topHashtagsLive": true
  },
  "timestamp": "2026-08-21T09:45:23.744749300Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `bucketStart` | string | **yes** | **null until the first bucket is collected** |
| `computedAt` | string | **yes** | **null until the first bucket is collected** |
| `totalUsers` | integer | no | 0 when uncollected |
| `usersByStatus` | object | no | map of status to count; **`{}` when uncollected**, not null |
| `usersByRole` | object | no | map of role to count |
| `totalPosts` | integer | no | |
| `totalComments` | integer | no | |
| `totalStories` | integer | no | |
| `reportsByStatus` | object | no | map of status to count |
| `reportsByReason` | object | no | map of reason key to count |
| `topHashtags` | array | no | empty array when uncollected |
| `topHashtagsLive` | boolean | no | true when the hashtag figures were computed live rather than read from the stored bucket |

**`computedAt` is how stale the snapshot is, and you must show it.**
Buckets are collected every 30 minutes, so a non-null `computedAt` can be up to 30 minutes old.
Render it as "as of HH:MM" next to the figures.
Do not present these numbers as live.

When `computedAt` is null, render the whole panel as "no data collected yet" rather than showing a wall of zeros, which reads as a broken screen.

#### `GET /api/v1/admin/stats/timeseries`

| Parameter | Type | Required | Default | Values |
|---|---|---|---|---|
| `metric` | string | no | `registrations` | the 14 values below |
| `granularity` | string | no | chosen by the server from the window width | `half_hour`, `day` |
| `from` | string | no | 24 hours ago | ISO-8601 instant |
| `to` | string | no | now | ISO-8601 instant |

The 14 metric values, exactly:

`users_total`, `users_by_status`, `users_by_role`, `posts_total`, `comments_total`, `stories_total`, `reports_by_status`, `reports_by_reason`, `registrations`, `posts_created`, `comments_created`, `follows_created`, `likes_created`, `admin_actions_by_type`

Captured response, HTTP 200, on a system with no collected buckets:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "metric": "users_total",
    "granularity": "half_hour",
    "from": "2026-08-20T09:45:33.6854117Z",
    "to": "2026-08-21T09:45:33.6854117Z",
    "points": []
  },
  "timestamp": "2026-08-21T09:45:33.689537900Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `metric` | string | no | echoes the requested metric |
| `granularity` | string | no | **the granularity actually used**, which may differ from what you asked for |
| `from` | string | no | the resolved window start |
| `to` | string | no | the resolved window end |
| `points` | array | no | empty when nothing has been collected |

**Read `granularity` off the response, not off your request.**
When you omit it the server picks, and your axis labels must follow what it picked.

**Asking for `half_hour` over a window older than 30 days is refused.**
Captured, HTTP 400:

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "Fine buckets are kept for 30 days; a window reaching further back can only be read at day granularity",
  "data": null,
  "timestamp": "2026-08-21T09:45:33.916854200Z"
}
```

If your date-range picker offers a range wider than 30 days, force `granularity=day` when the range start is more than 30 days ago, or you will hand the user an error instead of a chart.

**Rate limited to 20 requests per minute.**
A dashboard that renders 14 charts on one screen will exhaust that in two page loads.
Fetch only the visible chart, and cache aggressively with TanStack Query's `staleTime`.

#### `GET /api/v1/admin/user-events`

| Parameter | Type | Required | Values |
|---|---|---|---|
| `userId` | uuid | no | omit to read across all accounts |
| `from` | string | **yes** | ISO-8601 instant |
| `to` | string | **yes** | ISO-8601 instant |
| `eventType` | string | no | the schema declares 20 values; **only 3 are ever present**, see below |

**Both `from` and `to` are mandatory, and the window may span at most 30 days.**

Captured, omitting both, HTTP 400:

```
Both 'from' and 'to' are required; the activity log has no unbounded read
```

Captured, with a 31-day window, HTTP 400:

```
The window may span at most 30 days
```

A 30-day window is accepted.
Build your date-range picker to clamp at 30 days rather than letting the user discover the limit through an error.

Captured `content[0]`, HTTP 200:

```json
{
  "id": "29312f56-2986-49d8-b203-33bbdb8c8cb0",
  "userId": "28faa499-cfdc-4336-846b-81c37f6615a5",
  "eventType": "session_start",
  "entityType": null,
  "entityId": null,
  "metadata": null,
  "createdAt": "2026-08-21T09:36:11.333365Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `userId` | uuid | no | |
| `eventType` | string | no | |
| `entityType` | string | **yes** | observed null on every captured row |
| `entityId` | uuid | **yes** | observed null on every captured row |
| `metadata` | object | **yes** | observed null on every captured row |
| `createdAt` | string | no | |

**Rate limited to 20 requests per minute.**

---

### 9.10 Single-session revocation and self-identification

#### `DELETE /api/v1/admin/users/{userId}/sessions/{sessionId}`

Required role: administrator.

Body is the standard `{"reason": ..., "reportId": ...}`. `sessionId` is the `id` of a row in the
`sessions` array of `GET /api/v1/admin/users/{userId}`.

Captured:

```json
{"success":true,"code":"OK","data":{
  "id":"920e443e-a53f-4755-b2fc-9f60d1a0204d",
  "adminId":"2f0d04c6-efcd-42b1-92af-22c1bd44d758",
  "actionType":"revoke_session",
  "targetUserId":"28faa499-cfdc-4336-846b-81c37f6615a5",
  "targetEntityType":"user","targetEntityId":"28faa499-cfdc-4336-846b-81c37f6615a5",
  "reason":"e2e single revoke",
  "metadata":{"alreadyRevoked":false,"sessionId":"b001636f-c58c-4078-b1ed-52f2f9f89f1f"},
  "createdAt":"2026-08-22T13:18:37.084446Z"}}
```

Three behaviours to build against:

1. **Revoking twice is a success, not an error.** The second call returns 200 with
   `metadata.alreadyRevoked: true`. A reviewer who double-clicks must not see a failure, so do not
   disable-on-success as an error-avoidance measure.
2. **A session belonging to another account answers `404 NOT_FOUND`**, even though the identifier is
   real and the listing handed it out. Never construct this URL from one account's page with another
   account's session id.
3. **This does not advance the token epoch**, so the account's other sessions and its access tokens
   are untouched. Force logout still does advance it and still ends everything.

Errors: `404 USER_NOT_FOUND`, `404 NOT_FOUND` when no such session belongs to that account.

#### `POST /api/v1/auth/session`

Required role: any authenticated caller.

This is how you mark "this is you" in a session listing. **The administrative session listing has no
such marker of its own**, and it cannot have one: the access token's `jti` is unique per access
token and carries no link to the session, and the refresh cookie is scoped to `/api/v1/auth` so it
never reaches the administrative tree.

Optional body `{"refreshToken": "..."}`; when omitted it reads the HttpOnly refresh cookie, which is
why this endpoint lives under the auth path.

Captured:

```json
{"success":true,"code":"OK","data":{"sessionId":"15368165-ea7c-411c-a9ab-798dd9522c10"}}
```

Correlate that `sessionId` against the `id` of each row in
`GET /api/v1/admin/users/{yourOwnId}`'s `sessions` array. Verified live: it matches exactly one row
on the caller's own account and zero rows on anyone else's.

`sessionId` is **null** when the request carried no usable refresh token. That is not an error and
does not mean the caller is signed out; it means you cannot draw the marker. Render the listing
without one rather than showing an error.

### 9.11 Batch identifier resolution

#### `GET /api/v1/admin/user-summaries`

Required role: moderator **or** administrator. It sits outside the `/users/**` sub-tree precisely so
a moderator can reach it, because queues, audit rows and violation rows are moderator surfaces and
they all carry bare identifiers.

| Parameter | Type | Required | Constraint |
|---|---|---|---|
| `ids` | comma-separated uuids | **yes** | at most 100 |

Captured:

```bash
curl -s "http://localhost:8080/api/v1/admin/user-summaries?ids=<a>,<unknown>" \
  -H "Authorization: Bearer $MOD"
```

```json
{"success":true,"code":"OK","data":[
  {"userId":"2f0d04c6-efcd-42b1-92af-22c1bd44d758","found":true,
   "user":{"id":"2f0d04c6-efcd-42b1-92af-22c1bd44d758","username":"seed_admin",
           "displayName":"Seed Admin","avatarUrl":null,"isVerified":false}},
  {"userId":"00000000-0000-0000-0000-0000000000ff","found":false,"user":null}]}
```

**One entry per requested identifier, in request order, duplicates collapsed.** An unknown or
deleted identifier is returned with `found: false` and a null `user` rather than omitted, so your
lookup map is never silently short. Render those as an unresolvable account rather than leaving a
bare uuid on screen.

**Over the bound is refused, not truncated.** Captured with 101 identifiers, HTTP 400:

```json
{"success":false,"code":"BAD_REQUEST",
 "message":"At most 100 identifiers may be resolved in one call"}
```

Chunk your requests at 100. Do not rely on the server trimming.

Display fields only: `id`, `username`, `displayName`, `avatarUrl`, `isVerified`. There is no status,
role, email or counter here and there never will be; this must not become a second route to the
administrative account detail.

### 9.12 A moderator's own escalations

#### `GET /api/v1/reports/escalated/mine`

Required role: moderator or administrator.

| Parameter | Type | Required | Constraint |
|---|---|---|---|
| `cursor` | string | no | own scope, see below |
| `limit` | integer | no | 1 to 100, default 20 |

Captured:

```json
{"success":true,"code":"OK","data":{"content":[
  {"id":"a0dc5552-e258-4bf6-85e9-3ce41a77a119",
   "reporterId":"6db66fb3-6e51-4c21-8a20-f3218afd893d",
   "reportType":"post","reportReason":"spam",
   "entityId":"58d8c43d-5fab-417a-86aa-612eeef7a25c",
   "status":"escalated","createdAt":"2026-08-21T15:03:00.083835Z"}],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
    "startCursor":"cnB0ZW06...","endCursor":"cnB0ZW06..."}}}
```

Three things that decide how you use it:

1. **Always the caller's own escalations.** An administrator calling it gets its own, not everyone's;
   the full escalated queue already serves that need. Verified live: the administrator saw zero rows
   while the moderator saw two.
2. **No status filter.** A report an administrator has since resolved still appears, because that
   outcome is exactly what you escalated in order to see. Read `status` on each row and render the
   resolved ones as closed rather than filtering them out.
3. **Its own cursor scope.** Ordering is by escalation time, not creation time, so a cursor from the
   report queue is rejected. Verified live: replaying one returned
   `400 INVALID_CURSOR "Malformed pagination cursor"`.

## 10. Error codes

Branch on `code`, never on `message`.
Message text is not part of the contract and may be reworded.

Every code in this table was produced by a real call during the preparation of this document, except where the "Condition" column says it was read from the schema.

### 10.1 The table

| Code | HTTP | Emitted by | Condition | Payload in `data` | What the panel should do |
|---|---|---|---|---|---|
| `OK` | 200 | everything | success | the payload | proceed |
| `CREATED` | 201 | `POST /admin/hashtags`, `POST /reports` | success | the payload | proceed |
| `UNAUTHORIZED` | 401 | every authenticated endpoint | no token, expired token, or a token invalidated by force-logout, role change, ban, unban, or logout | `null` | attempt one refresh, replay the request once, and on failure clear the session and route to login. See section 6.7 |
| `AUTH_INVALID_CREDENTIALS` | 401 | `POST /auth/login` | wrong password or unknown identifier | `null` | field error on the password field. Do not say which of the two was wrong |
| `AUTH_ACCOUNT_INACTIVE` | 403 | `POST /auth/login` | the account is suspended, banned, or deactivated | `null` | full-form message on the login screen. The credentials were correct, so a password field error is misleading |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | `POST /auth/refresh` | no cookie, expired, revoked, or already-rotated refresh token | `null` | clear the session and route to login. Never retry |
| `FORBIDDEN` | 403 | every administrator-only endpoint; also moderator resolve or dismiss of an escalated report | the caller's role does not permit this route | `null` | this should be unreachable if your route guards are right. Render a full-page "not available" and log it as a client bug |
| `ADMIN_TARGET_PROTECTED` | 403 | ban, unban, suspend, unsuspend, role | the target account is an administrator | `null` | **do not render the control at all** for an administrator target. See section 11.3 |
| `ADMIN_TARGET_NOT_WARNABLE` | 403 | `POST /admin/warnings/for-user/{userId}` | the target is a moderator or an administrator | `null` | do not render the warning control unless the target's role is `user` |
| `ADMIN_SELF_ACTION_NOT_ALLOWED` | 409 | ban, suspend, role, force-logout | the actor is the target | `null` | do not render moderation controls on the signed-in account's own detail page |
| `ADMIN_ROLE_TRANSITION_NOT_ALLOWED` | 409 | `PATCH /admin/users/{userId}/role` | the transition skips a level, for example `user` to `admin` | `null` | populate the role selector only from `capabilities.assignableRoles`. See section 11.1 |
| `ADMIN_INVALID_TRANSITION` | 409 | every status-changing endpoint | the target is already in the requested state | `null` | toast, then refetch the entity. Usually means another moderator acted first, or a double submit |
| `ADMIN_ACTION_NOT_FOUND` | 404 | `GET /admin/actions/{actionId}` | no such action, **or the action exists but was performed by someone else and the caller is a moderator** | `null` | render "not found". Never render "forbidden", and never conclude the row was deleted |
| `REPORT_NOT_FOUND` | 404 | every report endpoint | no such report | `null` | full-page not-found on a detail route; toast and refetch in a list |
| `REPORT_INVALID_TRANSITION` | 409 | `PATCH /reports/{id}/status`, resolve, dismiss, escalate | the report is not in a state that permits this transition | `null` | toast, then refetch the report. Another reviewer probably closed it first |
| `USER_NOT_FOUND` | 404 | every account endpoint | no such account | `null` | full-page not-found |
| `POST_NOT_FOUND` | 404 | post remove and restore | no such post | `null` | toast and refetch the list |
| `COMMENT_NOT_FOUND` | 404 | comment remove and restore | no such comment | `null` | toast and refetch the list |
| `HASHTAG_NOT_FOUND` | 404 | hashtag patch and delete | no such hashtag | `null` | toast and refetch the registry |
| `HASHTAG_ALREADY_EXISTS` | 409 | `POST /admin/hashtags` | a hashtag with that normalised name exists | `null` | field error on the name input, offering to open the existing tag |
| `WARNING_NOT_FOUND` | 404 | `DELETE /admin/warnings/{id}` | no such warning, or already revoked | `null` | toast and refetch |
| `STRIKE_NOT_FOUND` | 404 | `DELETE /admin/strikes/{id}` | no such strike, or already revoked | `null` | toast and refetch |
| `VALIDATION_ERROR` | 400 | any endpoint with a validated body or bounded parameter | a field violated a declared constraint | **object: field name to message** | **map onto per-field form errors.** See 10.2 |
| `BAD_REQUEST` | 400 | any endpoint | an undeclared query parameter, or a semantic refusal such as an over-wide stats window | `null` | the `message` is specific and actionable here; surface it. See 10.3 |
| `MALFORMED_REQUEST_BODY` | 400 | any endpoint taking a body | the body is not valid JSON, **or it carries a field the endpoint does not declare** | `null` | this is almost always a client bug. See section 7.5 |
| `INVALID_CURSOR` | 400 | every paginated endpoint | the cursor is malformed, truncated, or **came from a different endpoint or a different role variant** | `null` | discard the cursor and restart pagination from the first page. Do not surface this to the user |
| `POST_BANNED_HASHTAG` | 422 | `POST /posts`, `PATCH /posts/{id}`, `PATCH /posts/{id}/status` | the caption names a banned hashtag | **object with `bannedTags`** | see 10.4 |
| `TOO_MANY_REQUESTS` | 429 | rate-limited paths | the caller exceeded the window | `null` | read the `Retry-After` header, disable the control for that many seconds, and do not auto-retry |

### 10.2 `VALIDATION_ERROR` carries a field map

This is the only common error whose `data` is structured, and it maps directly onto form errors.

Captured:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "data": { "limit": "must be less than or equal to 100" },
  "timestamp": "2026-08-21T09:41:47.214430600Z"
}
```

`data` is an object whose keys are field names and whose values are messages.
With React Hook Form:

```ts
if (error.response?.data?.code === 'VALIDATION_ERROR') {
  const fields = error.response.data.data ?? {}
  for (const [name, message] of Object.entries(fields)) {
    setError(name as keyof FormValues, { type: 'server', message: String(message) })
  }
}
```

The keys match the request body field names, so `reason`, `note`, `reasonKey`, `durationDays`, and so on.
A key may also be a query parameter name, as in the `limit` example above, which will not match any form field; ignore keys you do not recognise rather than crashing.

### 10.3 `BAD_REQUEST` messages are worth surfacing

Unlike most error messages, these are specific and tell the user what to change.
Three captured examples:

```
Unsupported query parameter: limitt. Accepted: cursor, limit, role, status
Fine buckets are kept for 30 days; a window reaching further back can only be read at day granularity
The window may span at most 30 days
```

The first indicates a client bug and should never reach a user.
The second and third are user-facing and should be shown as-is next to the date-range control that caused them.

### 10.4 `POST_BANNED_HASHTAG` carries the offending tags

The panel does not create posts, so you will meet this only if you build a caption-editing surface.
It is documented because it is the one error whose payload you are expected to render inline.

Captured, HTTP 422:

```json
{
  "success": false,
  "code": "POST_BANNED_HASHTAG",
  "message": "Caption contains banned hashtags",
  "data": { "bannedTags": ["handoffbanned"] },
  "timestamp": "2026-08-21T09:38:49.987060300Z"
}
```

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `data.bannedTags` | array of string | no | tag names **without** the leading `#` |

**Highlight each named tag inside the caption rather than showing a generic message.**
The user cannot otherwise tell which of several tags was the problem.
Match case-insensitively against the caption text, and remember the API strips the `#`.

### 10.5 A single Axios error handler

```ts
export function describeError(error: unknown): {
  kind: 'field' | 'toast' | 'page' | 'silent'
  message: string
  fields?: Record<string, string>
} {
  const body = (error as AxiosError<ApiEnvelope>).response?.data
  const code = body?.code
  switch (code) {
    case 'VALIDATION_ERROR':
      return { kind: 'field', message: body!.message, fields: body!.data ?? {} }
    case 'INVALID_CURSOR':
      return { kind: 'silent', message: '' }          // restart pagination instead
    case 'USER_NOT_FOUND':
    case 'REPORT_NOT_FOUND':
    case 'ADMIN_ACTION_NOT_FOUND':
    case 'FORBIDDEN':
      return { kind: 'page', message: body!.message }
    default:
      return { kind: 'toast', message: body?.message ?? 'Something went wrong' }
  }
}
```

---

## 11. Business rules that shape the interface

Every rule here is stated as an instruction, followed by the API behaviour that enforces it, so you can verify your implementation against the same evidence.

### 11.1 Role transitions

**Populate the role selector only from `capabilities.assignableRoles` on the account detail payload.**
Do not build your own list of roles.

The permitted transitions, verified by calling:

| From | To | Result |
|---|---|---|
| `user` | `moderator` | 200 |
| `moderator` | `user` | 200 |
| `moderator` | `admin` | 200 |
| `user` | `admin` | **409 `ADMIN_ROLE_TRANSITION_NOT_ALLOWED`** |
| `admin` | anything | **403 `ADMIN_TARGET_PROTECTED`** |
| any | any, where actor equals target | **409 `ADMIN_SELF_ACTION_NOT_ALLOWED`** |

**A role change may not skip a level.**
Promoting an ordinary account to administrator takes two calls: first to `moderator`, then to `admin`.
Decide whether your interface performs both, or refuses and tells the administrator to promote to moderator first.
If you perform both, handle the case where the first succeeds and the second fails, because the account is then left as a moderator.

**Promoting an account to `admin` is a one-way door.**
Once an account is an administrator, no API call can change its role or its status.
The only way back is a direct database update.
**Put a confirmation dialogue on the promotion-to-admin control that says this in plain words**, because nothing in the API will warn the administrator and nothing will let them undo it.

**No actor may act on its own account.**
Do not render any moderation control on the signed-in administrator's own detail page.

### 11.2 Account status changes

| Target | Suspend | Unsuspend | Ban | Unban | Warn |
|---|---|---|---|---|---|
| `user` | yes | yes | yes | yes | yes |
| `moderator` | yes | yes | yes | yes | **no, 403 `ADMIN_TARGET_NOT_WARNABLE`** |
| `admin` | **no, 403** | **no, 403** | **no, 403** | **no, 403** | **no, 403** |
| self | **no, 409** | **no, 409** | **no, 409** | **no, 409** | **no, 409** |

All of these were verified by calling.

Repeating a status change that is already in effect returns `409 ADMIN_INVALID_TRANSITION`.
Disable the control while a mutation is in flight so a double click does not produce a confusing error.

### 11.3 An administrator account is untouchable through the API

**Never render ban, unban, suspend, unsuspend, force-logout, warn, or role controls when the target account's role is `admin`.**

Verified against a non-self administrator target:

```
PATCH /api/v1/admin/users/{adminId}/ban       -> 403 ADMIN_TARGET_PROTECTED
PATCH /api/v1/admin/users/{adminId}/suspend   -> 403 ADMIN_TARGET_PROTECTED
PATCH /api/v1/admin/users/{adminId}/role      -> 403 ADMIN_TARGET_PROTECTED
POST  /api/v1/admin/warnings/for-user/{adminId} -> 403 ADMIN_TARGET_NOT_WARNABLE
```

The account detail payload tells you this without your having to check the role:

```json
"capabilities": { "canChangeStatus": false, "canChangeRole": false, "assignableRoles": [] }
```

### 11.4 The warning and strike ladder

**A warning may only target an account whose role is `user`.**
Verified: warning a moderator returns `403 ADMIN_TARGET_NOT_WARNABLE`.

**A warning requires both a `reasonKey` and a `note`.**
The `reasonKey` must be the key of an enabled `reportReasons` vocabulary row.
The `note` is free text, maximum 2000 characters.

**Three active warnings produce a strike automatically.**
The moderator does not choose this and cannot prevent it.
Verified live: the first and second warnings returned `strikeIssued: false`; the third returned `strikeIssued: true`, `activeWarningCount: 0`, and `resultingStatus: "suspended"`.

The strike ladder, read from the server implementation because it cannot be observed without issuing nine warnings:

| Strike number | Consequence |
|---|---|
| 1 | suspended for 7 days |
| 2 | suspended for 30 days |
| 3 and above | banned, with no end date |

Warnings age out of the count after **90 days**.
The count is of unrevoked warnings issued since the account's last strike, within that 90-day window.

**Tell the moderator what just happened.**
When `strikeIssued` is true, the account's status changed as a side effect of their click.
Show `resultingStatus` in the success message, for example "Warning issued. This was the third active warning, so the account has been suspended."

**What the warned account sees, and what it does not.**
`GET /api/v1/users/me/warnings` returns `id`, `reasonKey`, `note`, and `createdAt`.
It does **not** return who issued the warning, and it does not expose strikes at all.
Do not build a user-facing screen that promises either.

**Revocation does not undo consequences.**
Revoking a warning does not remove a strike that it helped trigger.
Revoking a strike does not lift the suspension or ban that strike caused.
Both are administrator-only, and both leave `users.status` untouched.
After revoking, if the administrator also wants the account restored, they must call unsuspend or unban separately.
**Say so in the confirmation dialogue**, or an administrator will revoke a strike, see the account still suspended, and file a bug.

### 11.5 Who sees strikes

**A moderator never sees strikes.**
`GET /api/v1/admin/violations/for-user/{userId}` returns warnings only for a moderator and warnings plus strikes for an administrator.
Verified: 4 entries for a moderator, 5 for an administrator, same account, same moment.

Design the violations screen so the strike column or badge simply does not exist in the moderator variant, rather than appearing empty.

**The cursor for this endpoint is scoped to the role variant.**
A cursor issued to a moderator is rejected with `400 INVALID_CURSOR` when replayed by an administrator, and the reverse.
Include the caller's role in the query key.

### 11.6 Report escalation

**Both a moderator and an administrator may escalate a report.**
Verified: both return 200.

**A reason is mandatory on escalation.**
`PATCH /api/v1/admin/reports/{reportId}/escalate` requires `reason`.

**Escalation moves the report out of the moderator's reach for closing, but not for reading.**
Verified against an escalated report:

```
GET   /api/v1/reports/{id}                       as moderator -> 200
PATCH /api/v1/admin/reports/{id}/resolve         as moderator -> 403 FORBIDDEN
PATCH /api/v1/admin/reports/{id}/dismiss         as moderator -> 403 FORBIDDEN
```

**A moderator keeps read-only access to what it escalated.**
Render the escalated report for a moderator with its resolve and dismiss controls absent, not disabled and not throwing.

**Administrator resolution is final.**
Once an administrator resolves or dismisses an escalated report, no further transition is accepted; another attempt returns `409 REPORT_INVALID_TRANSITION`.

**There is no notification when a report is escalated.**
See section 13.5.

### 11.7 The hashtag lifecycle

There are exactly three statuses.

| Status | Effect |
|---|---|
| `active` | the tag is discoverable, appears in trending, and may be used on new posts |
| `banned` | the tag is removed from discovery and from trending immediately, and **new posts naming it are refused**. Posts that already used it keep it, and it still renders on them |
| `deleted` | as banned, and additionally the tag stops appearing in the hashtag list shown on a post. The post's caption keeps the literal text |

**Banning a hashtag never hides existing posts.**
Nothing is removed.
`postCount` survives both a ban and a delete.
Both decisions are reversible by moving the status back to `active`.
Do not let your interface imply that banning a tag takes down the content that used it, because it does not, and a moderator relying on that will leave the content up.

**A hashtag's name is immutable.**
There is no rename.
`PATCH /api/v1/admin/hashtags/{hashtagId}` accepts only `status` and `note`.
Sending a `name` field returns `400 MALFORMED_REQUEST_BODY`, verified.
Render the name as static text in the edit form and never include it in the request body.

**A hashtag cannot be created in the `deleted` state.**
`POST /api/v1/admin/hashtags` with `status: "deleted"` returns `400 BAD_REQUEST`, verified.
Offer only `active` and `banned` in the create form.

**Creating a hashtag returns the audit action, not the hashtag.**
The new hashtag's id is `data.targetEntityId`, not `data.id`.
See section 9.8.

### 11.8 Restoring a post can silently drop hashtags

**When a post is restored, any hashtag banned while the post was removed is dropped from it, and you must tell the moderator.**

The restore response names them:

```json
"data": {
  "action": { "...": "audit row" },
  "remainingBannedHashtags": ["handoffactive"]
}
```

Verified end to end: a post carrying `#handoffactive` was removed, the tag was banned while the post was down, and the restore returned `remainingBannedHashtags: ["handoffactive"]`.

**Do not treat a successful restore as nothing more than a success toast.**
When `remainingBannedHashtags` is non-empty, show the names.
The moderator restored a post believing it would come back as it was, and it did not.

When the array is empty, a plain success toast is correct.

### 11.9 Drive controls from `capabilities`, not from your own copy of these rules

`GET /api/v1/admin/users/{userId}` returns:

```json
"capabilities": {
  "canChangeStatus": true,
  "canChangeRole": true,
  "assignableRoles": ["moderator"]
}
```

| Field | Meaning |
|---|---|
| `canChangeStatus` | whether the signed-in actor may ban, unban, suspend, or unsuspend this target |
| `canChangeRole` | whether the actor may change this target's role at all |
| `assignableRoles` | the exact set of roles this target may be moved to, given who the actor is |

Verified: for an ordinary account this was `true`, `true`, `["moderator"]`.
For an administrator target it was `false`, `false`, `[]`.

**Render the status controls when `canChangeStatus` is true, the role control when `canChangeRole` is true, and populate the role selector from `assignableRoles` verbatim.**

The rules in 11.1 through 11.3 are written here so you can understand and test the behaviour, **not so you can reimplement them in the client**.
Two copies of an authorization rule diverge the first time the server's rule changes, and the client copy is the one that will be wrong.
The client copy also fails silently, by rendering a control that then 403s, which is worse than not rendering it.

The one rule `capabilities` does not cover is warning eligibility.
Gate the warning control on `role === 'user'` yourself.

---

## 12. Vocabularies

**The panel must not hardcode any enumerated value that a user selects from.**

### 12.1 `GET /api/v1/config/vocabularies`

Required role: any authenticated user.
No parameters.

Captured response, HTTP 200, abbreviated to the first entries of each list:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operation completed successfully",
  "data": {
    "reportReasons": [
      { "key": "spam", "displayName": "Spam", "description": null, "appliesTo": [], "isEnabled": true, "sortOrder": 1 },
      { "key": "nudity", "displayName": "Nudity or Sexual Content", "description": null, "appliesTo": ["post", "comment", "story", "message"], "isEnabled": true, "sortOrder": 2 },
      { "key": "violence", "displayName": "Violence or Dangerous Content", "description": null, "appliesTo": ["post", "comment", "story", "message"], "isEnabled": true, "sortOrder": 3 }
    ],
    "notificationTypes": [
      { "key": "comment_post", "displayName": "Comment on Post", "templateKey": "comment_post", "isUserToggleable": true, "isEnabled": true }
    ],
    "moderationActions": [
      { "key": "ban_hashtag", "displayName": "Ban Hashtag", "requiresReason": true, "isReversible": true, "isEnabled": true },
      { "key": "ban_user", "displayName": "Ban User", "requiresReason": true, "isReversible": false, "isEnabled": true }
    ]
  },
  "timestamp": "2026-08-21T09:37:.."
}
```

Counts observed: `reportReasons` 8 entries, `notificationTypes` 11 entries, `moderationActions` 22 entries.

`reportReasons` entry:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `key` | string | no | the value you send in `reasonKey` and receive in `reportReason` |
| `displayName` | string | no | render this, never the key |
| `description` | string | **yes** | observed null on every entry |
| `appliesTo` | array of string | no | entity types this reason is valid for; **an empty array means all of them**, never none |

**If you filter the reason list by the type being reported, treat an empty `appliesTo` as a match.**
Four reasons carry an empty array - `spam`, `harassment`, `scam` and `other` - because each applies
to an account as readily as to a piece of content, and enumerating all five types would say the same
thing at more length. Treating empty as "no types" makes those four vanish from every reason picker
you build.
| `isEnabled` | boolean | no | see 12.2 |
| `sortOrder` | integer | no | order your selector by this |

`notificationTypes` entry:

| Field | Type | Nullable |
|---|---|---|
| `key` | string | no |
| `displayName` | string | no |
| `templateKey` | string | no |
| `isUserToggleable` | boolean | no |
| `isEnabled` | boolean | no |

`moderationActions` entry:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `key` | string | no | matches `actionType` on an audit row |
| `displayName` | string | no | **use this to label audit rows** instead of formatting the raw key |
| `requiresReason` | boolean | no | |
| `isReversible` | boolean | no | |
| `isEnabled` | boolean | no | |

### 12.2 The `isEnabled` flag is not a filter

**Render a disabled entry as unavailable. Do not hide it.**

A disabled row is returned and flagged rather than omitted, precisely so a client can show it greyed out with an explanation instead of silently offering a shorter list.
Hiding it makes an existing report or audit row whose reason is now disabled render with a missing label.

In a shadcn/ui `Select`:

```tsx
{reasons.map((r) => (
  <SelectItem key={r.key} value={r.key} disabled={!r.isEnabled}>
    {r.displayName}{!r.isEnabled && ' (unavailable)'}
  </SelectItem>
))}
```

You must still be able to **display** a disabled key, because historical records reference it.
Build a lookup map from the full list, including disabled entries, and use it for rendering labels everywhere.

### 12.3 When to call it

Once per session, at application start, after authentication.
It requires a token, so it cannot be fetched before login.

Cache it in TanStack Query with a long `staleTime`; one hour is ample.
It changes only when an operator edits a configuration table.

```ts
useQuery({
  queryKey: ['vocabularies'],
  queryFn: () => api.get('/api/v1/config/vocabularies'),
  staleTime: 60 * 60 * 1000,
})
```

### 12.4 Where every enumerated value in the panel comes from

Leave nothing to guess.

| Value set | Source | Notes |
|---|---|---|
| Report reasons, for the warning reason selector | **vocabulary** `reportReasons` | send `key` as `reasonKey` |
| Report reasons, for display on a report row | **vocabulary** `reportReasons` | map `reportReason` to `displayName` |
| Moderation action types, for display on an audit row | **vocabulary** `moderationActions` | map `actionType` to `displayName` |
| Notification types | **vocabulary** `notificationTypes` | the panel does not currently need these |
| Report statuses: `pending`, `reviewing`, `resolved`, `dismissed`, `escalated` | **OpenAPI schema** | fixed set of 5; no vocabulary endpoint serves them |
| Report types: `post`, `comment`, `user`, `story`, `message` | **OpenAPI schema** | fixed set of 5 |
| User roles: `user`, `moderator`, `admin` | **OpenAPI schema**, and `capabilities.assignableRoles` for what is selectable | never build a selector from the schema list; use `assignableRoles` |
| User statuses: `active`, `suspended`, `deactivated`, `banned` | **OpenAPI schema** | used as filter values on `GET /admin/users` |
| Hashtag statuses: `active`, `banned`, `deleted` | **OpenAPI schema** | `deleted` is a valid filter but not a valid value on create |
| Post statuses: `draft`, `published`, `archived`, `removed` | **OpenAPI schema** | read-only in the panel |
| Statistics metrics, the 14 values | **OpenAPI schema**, `metric` parameter | listed in section 9.9 |
| Statistics granularity: `half_hour`, `day` | **OpenAPI schema** | |
| Activity log event types | **OpenAPI schema** declares 20, **but only 3 occur** | see section 13.3 before building a filter |
| Audit action types, as filter values on `GET /admin/actions` | **OpenAPI schema**, `actionType` parameter | 22 values, matching the `moderationActions` vocabulary keys |

**The rule of thumb**: if a human picks it and it has a display label, it comes from the vocabulary endpoint.
If it is a lifecycle state or a filter value, it comes from the OpenAPI schema and is fixed.

---

## 13. Known gaps and surprising behaviour

Each item states what you will observe, why it happens, and what to build instead.

### 13.1 Statistics are empty for the first 30 days, and that is correct

**What you will observe.**
`GET /api/v1/admin/stats/current` returns zeros, `{}` for every map, `[]` for `topHashtags`, and **null** for both `bucketStart` and `computedAt`.
`GET /api/v1/admin/stats/timeseries` returns `points: []`.

Captured on a freshly migrated database:

```json
{ "bucketStart": null, "computedAt": null, "totalUsers": 0, "usersByStatus": {}, "topHashtags": [], "topHashtagsLive": true }
```

**Why.**
Statistics are collected into 30-minute buckets by a background job.
**There is no backfill.**
A bucket that was never collected can never be collected later, and the partial bucket the process starts inside is deliberately skipped.
So a system that has just been deployed, or whose database has just been reset, genuinely has nothing to chart until the job has run at least once.
Fine buckets are retained 30 days and daily rows 365 days, and those retention windows are the real limits of what can ever be charted.

**What to build.**
Treat `computedAt === null` as a first-class empty state, not an error and not a zero.
Render "No statistics collected yet. The first snapshot appears within an hour of the server starting."
Do not render a chart axis with a flat zero line, because that asserts something false: that there are zero users.

To see real data during development, leave the application running for at least 30 minutes, or accept the empty state and build against it.

### 13.2 `stats/current` is a snapshot up to 30 minutes old

**What you will observe.**
Once collection has run, `computedAt` is a timestamp that can be up to 30 minutes in the past, and the figures will not match what you can count yourself in the database.

**Why.**
The endpoint reads the most recently completed bucket.
It is not a live query.
The one exception is `topHashtags`, which is flagged by `topHashtagsLive: true` to say it was computed live rather than read from the bucket.

**What to build.**
Show the staleness.
Render `computedAt` next to the figures as "as of 09:15", and never label this panel "live" or "now".
An administrator who bans an account and then sees the banned count unchanged will otherwise report a bug.

Do not poll this endpoint faster than the collection interval; there is nothing new to get.
A `staleTime` of 5 minutes and a manual refresh control is a reasonable design.

### 13.3 The activity log writes seven of its twenty declared event types in development, three in production

**This one changed, and the change is environment-dependent. Read it before you build the filter.**

The `eventType` parameter accepts 20 values and the OpenAPI schema documents all 20. Seven of them
can now produce rows; thirteen never will.

Three have always been written by the application itself:

- `session_start`
- `search`
- `profile_view`

Four more are written by a consumer that turns engagement into behavioural events:

- `post_like`
- `post_save`
- `post_view`
- `post_comment`

That consumer depends on a recommender service. The service was defined but never started, so every
engagement event was retried against nothing and discarded. It is now part of the default local
development stack, and those four types land. Verified live: a save produced a `post_save` row and
the dead-letter queue stayed empty.

**Nothing about a production deployment of that service was set up.** In production those four types
still produce nothing.

**What to build.**
Do not generate the filter from the OpenAPI enumeration; thirteen of the twenty return nothing
anywhere. Offer the three always-written types unconditionally. Gate the four engagement types on
the environment, or a production administrator gets four filters that return an empty page against a
server answering 200, and concludes the log is broken.

A view of one's own profile is deliberately not recorded, because it would bury the views that
matter.

### 13.4 The activity log refuses an unbounded or over-wide window

**What you will observe.**
Omitting `from` or `to` returns HTTP 400.
A window wider than 30 days returns HTTP 400.

Captured messages:

```
Both 'from' and 'to' are required; the activity log has no unbounded read
The window may span at most 30 days
```

A window of exactly 30 days is accepted; 31 days is refused.

**Why.**
The underlying table is partitioned by time.
A query without a time bound prunes no partitions and reads the entire history of the platform.

**What to build.**
Make the date-range control mandatory, and default it to something sensible such as the last 7 days.
**Clamp the maximum span to 30 days in the picker itself**, and disable ranges wider than that, rather than letting the user select 90 days and meet an error.

### 13.5 An escalated report produces no notification, so you must poll

**What you will observe.**
When a moderator escalates a report, nothing is pushed anywhere.
No WebSocket event, no notification row, no email.
An administrator will not find out unless they look.

**Why.**
Escalation writes an audit row and changes the report's status.
No notification is produced by that path.

**What to build.**
`GET /api/v1/admin/reports/escalated/count` is the only signal.
It is administrator-only and returns a single integer:

```json
{ "count": 2 }
```

Poll it and render a badge on the escalated-queue navigation item.

**A reasonable interval is 60 seconds.**
The endpoint is cheap and falls under the 300-per-minute administrator budget, so 60 seconds costs one request per minute out of 300.
Do not poll faster than 30 seconds; there is no benefit, and a panel left open all day will generate a lot of traffic for a number that changes a few times a week.

```ts
useQuery({
  queryKey: ['escalated-count'],
  queryFn: () => api.get('/api/v1/admin/reports/escalated/count'),
  refetchInterval: 60_000,
  enabled: role === 'admin',
})
```

A moderator gets 403 on this endpoint, so gate the query on the role or you will fire a failing request every minute for every moderator.

### 13.6 Reported stories and messages can now be actioned, with two catches

**This one changed.** Remove and restore now exist for all four content types:

```
PATCH /api/v1/admin/posts/{postId}/remove       PATCH /api/v1/admin/posts/{postId}/restore
PATCH /api/v1/admin/comments/{commentId}/remove PATCH /api/v1/admin/comments/{commentId}/restore
PATCH /api/v1/admin/stories/{storyId}/remove    PATCH /api/v1/admin/stories/{storyId}/restore
PATCH /api/v1/admin/messages/{messageId}/remove PATCH /api/v1/admin/messages/{messageId}/restore
```

Same body, same response shape, same 409 on an invalid transition. Section 9.5 has the detail.

**Delete the read-only treatment and the copy telling the reviewer such content cannot be taken
down.** Leaving it beside a working control is worse than either alone.

Two catches that do not apply to posts and comments:

1. **A story restore does not always bring the story back.** Expiry is untouched by removal, so a
   story that expired while removed returns to a live row that no feed shows, and one the cleanup
   job has already purged answers 404. Word the confirmation as reversing the removal, not as
   restoring visibility.
2. **A message the sender deleted cannot be restored by moderation**; it answers 409. Gate the
   restore control on the report, not on the deleted placeholder, because the wire does not
   distinguish a sender deletion from an administrative removal.

### 13.7 There is no total count anywhere

**What you will observe.**
No list endpoint returns a total.
There is no `total`, no `totalElements`, and no `X-Total-Count` header, even though the CORS configuration exposes that header name.
This was verified by inspecting the response headers of a list call.

**Why.**
Pagination is keyset-based throughout.
A keyset page does not know how many rows exist without a second counting query.

**What to build.**
Do not design "Showing 1 to 20 of 350" or a numbered page control.
Use infinite scroll or a "Load more" button driven by `hasNextPage`.
If a count is genuinely needed, the only one available in the whole administrative surface is the escalated-report count.

### 13.8 Batch lookup from account id to name now exists

**This one changed.** `GET /api/v1/admin/user-summaries?ids=a,b,c` resolves up to 100 identifiers in
one request, and a moderator can call it. Section 9.11 has the detail.

**Delete the one-at-a-time resolution and its cache.** Collect the distinct identifiers on a page,
resolve them in one call, and key your map on `userId`.

An unknown or deleted identifier comes back with `found: false` rather than being omitted, so the map
you build is always complete and you can render those as unresolvable rather than leaving a bare
uuid on screen. More than 100 identifiers is a 400, not a trimmed list, so chunk at 100.

### 13.9 The audit list omits `metadata`

**What you will observe.**
Every entry in `GET /api/v1/admin/actions` lacks a `metadata` key.
`GET /api/v1/admin/actions/{actionId}` includes it.
Verified across all 13 rows of a list.

**What to build.**
Do not design an audit table column that shows metadata.
Put it in an expandable row or a detail drawer that fetches the single action on open.

Remember a moderator gets 404 on the detail endpoint for actions it did not perform, so the expand control should not appear on rows a moderator cannot open.
A moderator's list contains only its own actions, so in practice every row it sees is openable.

### 13.10 An automatic strike has no actor

**What you will observe.**
An audit row with `actionType: "issue_strike"` has `adminId: null`.

**What to build.**
Render "System" rather than crashing on a null id lookup.
This is the only `actionType` observed to produce a null actor, but treat `adminId` as nullable everywhere rather than special-casing.

### 13.11 `suspendedUntil` is null for two different things

**What you will observe.**
`suspendedUntil` is null both when an account is not suspended and when it is suspended with no end date.

**What to build.**
Read `status` first.
If `status === 'suspended'` and `suspendedUntil === null`, render "Suspended indefinitely".
If `status === 'suspended'` and `suspendedUntil` is set, render the date.
Never render "not suspended" from `suspendedUntil` alone.

### 13.12 `GET /api/v1/users/me` has no role

Covered in section 6.2 and repeated here because it is the single most likely thing to send you down a wrong path on day one.
Get the role from login or refresh.

### 13.13 The content read endpoint returns a field called `reportType`

**What you will observe.**
`GET /api/v1/admin/content/{entityType}/{entityId}` returns a payload whose first field is `reportType`, even though you did not come from a report.

**Why.**
It shares its response shape with `GET /api/v1/admin/reports/{reportId}/target`.

**What to build.**
Nothing special; just do not be misled into thinking you have fetched a report.
On this endpoint the field echoes the `entityType` you requested.

### 13.14 Screens the use cases imply that have no endpoint behind them

Do not design a route for any of these.

Three entries that were in this table are gone, because the endpoints now exist: story and message
takedown, an audit trail filtered by date range, and batch identifier resolution. See 13.6, 9.4 and
13.8.

| Screen | Why it cannot be built |
|---|---|
| A moderation dashboard with counts by queue | no aggregate endpoint; only the escalated count exists |
| A global warnings or strikes list across all accounts | violations are readable per account only, through `/admin/violations/for-user/{userId}` |
| A count of how many accounts match a filter | no list returns a total, anywhere; see 13.7 |
| A numbered pagination control on any list | no total count; see 13.7 |
| A per-row "this is your session" marker straight off the session listing | the listing carries no such field; call `POST /api/v1/auth/session` and correlate, see 9.10 |
| Media on an account's comment rows | comments have no media in the schema; post rows do carry it |
| Un-revoking a session | there is no inverse; the account signs in again |
| Investigating another moderator's actions as a moderator | the actor filter is replaced with the caller's own id, so it silently returns your own work; see 9.4 |
| Undoing an administrator promotion | no API path demotes an administrator; see 11.1 |
| A notification centre for moderators or administrators | no administrative notification is produced by any moderation action |
| Bulk actions on multiple reports or accounts | every action endpoint takes exactly one target |
| Editing a hashtag's name | names are immutable; see 11.7 |

---

## 14. Screen map

Each screen states its purpose in one sentence, the calls it makes and in what order, what is needed on first paint, which controls are conditional, which errors are normal, and the empty state.

Throughout, "first paint" means the request whose result the screen cannot render without.
Everything else should load after, so the screen appears fast.

### 14.0 Application shell, both roles

**Purpose: establish who is signed in, what role they hold, and which navigation tree to render.**

On boot, in order:

1. `POST /api/v1/auth/refresh`. This restores both the access token and the role after a page reload. If it fails with `AUTH_REFRESH_TOKEN_INVALID`, route to login.
2. `GET /api/v1/config/vocabularies`. Cache for one hour. Needed by almost every screen for display labels.
3. `GET /api/v1/users/me`, for the display name and avatar in the header. Not needed for routing.

First paint needs 1 only.
2 and 3 load after.

Conditional rendering: the entire navigation tree branches on `role`.
A moderator sees the moderation group only.
An administrator sees both groups.

Normal errors: none once signed in.

### 14.1 Login, both roles

**Purpose: exchange credentials for a session.**

Calls: `POST /api/v1/auth/login`.

First paint: nothing; the form is static.

Normal errors: `AUTH_INVALID_CREDENTIALS` as a field error, `AUTH_ACCOUNT_INACTIVE` as a form-level message, `TOO_MANY_REQUESTS` after 10 attempts in 15 minutes, which should disable the submit button for the `Retry-After` duration.

Empty state: not applicable.

### 14.2 Report queue, both roles

**Purpose: show the reports awaiting review so a reviewer can pick one up.**

Calls, in order:

1. `GET /api/v1/reports?status=pending&limit=20` for first paint.
2. Optionally `GET /api/v1/admin/content/user/{reporterId}` per distinct reporter, after paint, cached.

Filters: `status` and `reportType`, both from the fixed schema lists in section 12.4.
Changing a filter must reset pagination, because the cursor is scoped.

Conditional controls: none. Both roles have identical access to this screen.

Normal errors: `INVALID_CURSOR` if you reuse a cursor across a filter change, which you should prevent by including filters in the query key.

Empty state: "No reports in this queue." This is the healthy steady state, so word it positively rather than as an error.

### 14.3 Escalated queue, administrator only

**Purpose: show reports a moderator has handed up, which only an administrator can close.**

Calls:

1. `GET /api/v1/reports?status=escalated&limit=20` for first paint.
2. `GET /api/v1/admin/reports/escalated/count` on a 60-second interval, for the navigation badge. This can live in the shell rather than the screen.

Conditional controls: this whole route must be unreachable for a moderator. The count endpoint returns 403 for a moderator, so gate the polling query on role.

Empty state: "No escalated reports."

### 14.4 Report detail, both roles

**Purpose: show one report together with the content it is about, so a reviewer can decide.**

Calls, in order:

1. `GET /api/v1/reports/{reportId}` for first paint.
2. `GET /api/v1/admin/reports/{reportId}/target` immediately after, for the reported content. This can render in a second pane so the report itself is not blocked.
3. `GET /api/v1/admin/content/user/{report.reporterId}` after paint, for the reporter's name.
4. `GET /api/v1/admin/violations/for-user/{target.ownerId}` after paint, for the owner's warning history. Remember a moderator sees warnings only.

Conditional controls:

- **Resolve and dismiss**: render when `report.status` is not `escalated`, or when the signed-in role is `admin`. A moderator must not see them on an escalated report; it returns 403.
- **Escalate**: render when `report.status` is `pending` or `reviewing`. Both roles may escalate.
- **Mark as reviewing**: render only when `report.status === 'pending'`.
- **Remove content**: render only when `target.reportType` is `post` or `comment`, and `target.removed` is false. See 13.6.
- **Restore content**: render only when `target.reportType` is `post` or `comment`, and `target.removed` is true.
- **Warn the owner**: render only when the owner's role is `user`. You will need the owner's role, which means calling `GET /api/v1/admin/users/{ownerId}` if you are an administrator. A moderator cannot call that endpoint, so a moderator's warning control must instead rely on attempting the call and handling `ADMIN_TARGET_NOT_WARNABLE`, or simply always offering it since the vast majority of reported accounts are ordinary users.

Normal errors: `REPORT_INVALID_TRANSITION` when another reviewer acted first, which should refetch rather than alarm; `403 FORBIDDEN` if a moderator's escalated-report controls leaked through.

Empty state: not applicable; a report always exists or 404s.

### 14.5 Post moderation, both roles

**Purpose: review an account's posts and take one down or put it back.**

Calls:

1. `GET /api/v1/admin/content/for-user/{userId}/posts?limit=20` for first paint.

Actions: `PATCH /api/v1/admin/posts/{postId}/remove` and `/restore`, each requiring a `reason`.

Conditional controls: show remove when `removed` is false, restore when `removed` is true.

**On a successful restore, read `data.remainingBannedHashtags`.**
If it is non-empty, show the names in the success message.
See section 11.8.

Normal errors: `ADMIN_INVALID_TRANSITION` on a double submit; disable the button while the mutation is in flight.

Empty state: "This account has no posts."

### 14.6 Comment moderation, both roles

**Purpose: review an account's comments and take one down or put it back.**

Identical in shape to 14.5, using `GET /api/v1/admin/content/for-user/{userId}/comments` and the comment remove and restore endpoints.

Comments have no hashtags, so the restore response is a plain `AdminActionResponse` with no `remainingBannedHashtags` wrapper.

Empty state: "This account has no comments."

### 14.7 Warning issuance, both roles

**Purpose: record a warning against an ordinary account, knowing the third one suspends it.**

Calls: `POST /api/v1/admin/warnings/for-user/{userId}`.

The form has two fields: a reason selector populated from the `reportReasons` vocabulary, and a free-text note of up to 2000 characters.
Both are required.

Conditional rendering: **do not render this control unless the target's role is `user`.**

**On success, read the response before writing your toast.**
When `strikeIssued` is true, the account's status changed.
Say so: "Warning issued. This was the third active warning, so the account has been suspended."
Include `resultingStatus`.

Normal errors: `ADMIN_TARGET_NOT_WARNABLE` if the target is staff, `VALIDATION_ERROR` on an empty note or an unknown reason key.

Empty state: not applicable.

### 14.8 Violations history, both roles

**Purpose: show what discipline an account has accumulated.**

Calls: `GET /api/v1/admin/violations/for-user/{userId}?limit=20`.

**A moderator sees warnings only; an administrator also sees strikes.**
Render the union type by branching on `kind`.

Conditional controls: revoke controls on both warnings and strikes are **administrator only**. Do not render them for a moderator.

Include the caller's role in the query key, because the cursor is scoped to the role variant and will be rejected across it.

Normal errors: none in ordinary use.

Empty state: "No warnings recorded for this account." For an administrator, "No warnings or strikes recorded."

### 14.9 My action log, moderator

**Purpose: let a moderator review what they themselves have done.**

Calls: `GET /api/v1/admin/actions?limit=20`.

**The server already scopes this to the moderator's own actions.**
Do not add an `adminId` filter; it is unnecessary and the moderator does not know its own id unless you kept it from login.

Label each row using the `moderationActions` vocabulary, mapping `actionType` to `displayName`.

Metadata is not in the list; open a row to fetch `GET /api/v1/admin/actions/{actionId}` if you want it.

Empty state: "You have not taken any moderation actions yet."

### 14.10 Full action log, administrator

**Purpose: review every moderation action taken on the platform.**

Calls: `GET /api/v1/admin/actions?limit=20`, optionally filtered by `adminId` and `actionType`.

**There is no date filter on this endpoint.** See 13.14.

Render `adminId === null` as "System". See 13.10.

Empty state: "No moderation actions recorded."

### 14.11 User list and search, administrator only

**Purpose: find an account to act on.**

Calls:

- `GET /api/v1/admin/users?limit=20`, with optional `status` and `role` filters, for browsing.
- `GET /api/v1/admin/users/search?q=...&limit=20` when the search box has content.

**Debounce the search input by at least 300 milliseconds.** The search endpoint allows 60 requests per minute.
Disable the input on `TOO_MANY_REQUESTS` for the `Retry-After` duration rather than retrying.

Both endpoints return the same entry shape, so one row component serves both.

Filters come from the fixed schema lists: `status` has four values, `role` has three.

Empty state: for browsing, "No accounts match these filters." For search, "No accounts match that search."

### 14.12 User detail, administrator only

**Purpose: see everything about one account and take action on it.**

Calls, in order:

1. `GET /api/v1/admin/users/{userId}` for first paint. This one call carries the profile, the sessions, the reports against the account, and the `capabilities` object.
2. `GET /api/v1/admin/violations/for-user/{userId}` after paint.
3. `GET /api/v1/admin/actions/for-user/{userId}` after paint, for the audit trail against this account.
4. `GET /api/v1/admin/content/for-user/{userId}/posts` and `/comments`, lazily, when the user opens those tabs.

**Render every action control from `capabilities`, not from your own rules.**

| Control | Render when |
|---|---|
| Ban, unban, suspend, unsuspend | `capabilities.canChangeStatus === true` |
| Role selector | `capabilities.canChangeRole === true`, with options from `capabilities.assignableRoles` |
| Warn | `user.role === 'user'`. `capabilities` does not cover this |
| Force logout | `capabilities.canChangeStatus === true` is a reasonable proxy; there is no dedicated flag |

Additionally:

- Show ban when `status !== 'banned'`, unban when `status === 'banned'`.
- Show suspend when `status !== 'suspended'`, unsuspend when `status === 'suspended'`.
- When `status === 'suspended'` and `suspendedUntil === null`, label it "Suspended indefinitely". See 13.11.
- **Put an explicit confirmation on promotion to `admin`** saying the change cannot be undone through the panel. See 11.1.

Every action takes a `reason` of up to 2000 characters, so use one shared confirmation dialogue with a reason field.
Suspend additionally offers an optional `durationDays` between 1 and 3650; leaving it empty means indefinite.

Normal errors: `ADMIN_INVALID_TRANSITION` on a double submit, `ADMIN_SELF_ACTION_NOT_ALLOWED` if you failed to hide controls on the administrator's own page.

Empty state: not applicable.

### 14.13 Hashtag registry, administrator only

**Purpose: manage which tags are usable on the platform.**

Calls:

- `GET /api/v1/admin/hashtags?limit=20`, optional `status` filter with three values.
- `GET /api/v1/admin/hashtags/search?q=...` when searching, debounced, 60 per minute.

Actions:

- Create: `POST /api/v1/admin/hashtags` with `name`, `status`, and `note`. **Offer only `active` and `banned` as the status.** After success, the new hashtag's id is `data.targetEntityId`, not `data.id`.
- Change status: `PATCH /api/v1/admin/hashtags/{hashtagId}` with `status` and `note`. **Never send `name`.**
- Delete: `DELETE /api/v1/admin/hashtags/{hashtagId}` with `reason` in the body, via `api.delete(url, { data })`.

Conditional controls: offer only transitions that differ from the current status; requesting the current status returns `409 ADMIN_INVALID_TRANSITION`.

**Word the ban confirmation carefully.**
Banning removes the tag from discovery and refuses it on new posts.
It does not take down any existing post.
Say that, or a moderator will ban a tag believing the content is gone.

Normal errors: `HASHTAG_ALREADY_EXISTS` on create, as a field error on the name input.

Empty state: "No hashtags match these filters."

### 14.14 Statistics, administrator only

**Purpose: show platform health over time.**

Calls:

1. `GET /api/v1/admin/stats/current` for first paint.
2. `GET /api/v1/admin/stats/timeseries?metric=...` for whichever chart is visible.

**Read section 13.1 and 13.2 before building this.**
An empty result is correct on a new deployment, and the snapshot is up to 30 minutes stale.

**Fetch only the visible chart.**
The timeseries endpoint allows 20 requests per minute in production, and there are 14 metrics.
A screen that renders all 14 at once will exhaust the budget in two page loads.
Use a metric selector, or lazy-load charts as they scroll into view, with a generous `staleTime`.

Clamp the date-range control: if the range starts more than 30 days ago, force `granularity=day`, or the request is refused.
Read `granularity` back off the response to label the axis, because the server may choose a different one from the one you sent.

Empty state: when `computedAt` is null, "No statistics collected yet. The first snapshot appears within an hour of the server starting." Do not draw an empty chart.

### 14.15 User activity log, administrator only

**Purpose: see what one account has been doing.**

Calls: `GET /api/v1/admin/user-events?userId=...&from=...&to=...&limit=20`.

**`from` and `to` are mandatory and the span may not exceed 30 days.**
Default the range to the last 7 days and clamp the picker at 30. See 13.4.

**Offer exactly three event-type filter options**: `session_start`, `search`, `profile_view`. See 13.3.

`userId` is optional; omitting it reads across all accounts, which is useful for a platform-wide activity view.

Rate limited to 20 requests per minute in production; do not refetch on every keystroke of the date picker, only on commit.

Empty state: "No recorded activity in this window." This is common and expected, because only three event kinds are ever written.

---

## 15. Verification checklist for the frontend agent

Run these against your implementation when you believe it is complete.
Each has an expected observable result.
These are written to catch a plausible wrong implementation, not merely a broken one.

### 15.1 Session

1. Sign in as `admin@seed.local` with `SeedPass123!`. **Expect** the panel to land on an administrator route and the navigation to show the administrator group.
2. Sign in as `mod@seed.local`. **Expect** the moderator navigation only, with no user list, no hashtags, no statistics, and no activity log entry.
3. While signed in, reload the page. **Expect** to stay signed in without re-entering credentials, and **expect** the role-dependent navigation to be correct immediately rather than flickering from moderator to administrator. If the role is briefly wrong, you are reading it from somewhere that is not the refresh response.
4. Sign in, then force a logout through the API rather than the database: `POST /api/v1/admin/users/{yourId}/force-logout` with a reason. Make any request. **Expect** exactly one refresh attempt, then a redirect to login. **Expect no infinite loop of 401s.**

   Use the endpoint, not `UPDATE users SET token_epoch = token_epoch + 1`. Advancing the epoch by hand invalidates the access token but leaves the refresh token alive, so the client refreshes and heals itself and you will conclude your handling is broken when it is not. Force logout revokes the refresh tokens and advances the epoch in one transaction, which is what a real sign-out does. Verified live: after it, the old access token answered 401 and the refresh answered `401 AUTH_REFRESH_TOKEN_INVALID`.
5. Open the browser network tab and confirm the refresh request carries the `luvax_refresh` cookie. **Expect** it present. If absent, `withCredentials` is not set.
6. Sign out. **Expect** a 204, the cookie cleared, and the previous access token to fail if replayed.

### 15.2 Role separation

7. Signed in as the moderator, type the user-list route directly into the address bar. **Expect** an unreachable route: a redirect or a "not available" page. **Expect not** an empty table, and **expect not** a table that renders and then fires a 403.
8. Signed in as the moderator, confirm no request is ever sent to `/api/v1/admin/reports/escalated/count`. **Expect** zero such requests in the network tab. If the badge poller is not gated on role, you will see a failing request every 60 seconds.
9. Signed in as the moderator, open the violations screen for an account that has a strike. **Expect** warnings only, and **expect** no empty strike column or placeholder.
10. Signed in as the administrator, open the same screen. **Expect** the strike to appear.

### 15.3 Authorization-shaped controls

11. Open the user detail for `seed_admin` while signed in as a different administrator. **Expect** no ban, suspend, role, or warn controls to render at all. **Expect not** disabled buttons, and **expect not** a 403 toast after clicking.
12. Open the user detail for the account you are signed in as. **Expect** no moderation controls.
13. Open the user detail for `seed_alice`, an ordinary account. **Expect** the role selector to offer exactly one option, `moderator`, and **expect not** `admin`.
14. Promote `seed_alice` to moderator, then open her detail again. **Expect** the role selector to now offer `user` and `admin`.
15. Attempt to promote an ordinary account directly to `admin` by any means your interface allows. **Expect** it to be impossible through the interface. If you can construct the request, the server returns `409 ADMIN_ROLE_TRANSITION_NOT_ALLOWED`.
16. Open the user detail for `seed_mod`. **Expect** suspend and ban controls to render, and **expect** the warn control not to render, because a moderator cannot be warned.

### 15.4 Discipline

17. Issue a first warning to an ordinary account. **Expect** a success message with no mention of suspension.
18. Issue a second, then a third. **Expect** the third to report that the account has been suspended, naming the outcome. If your toast says only "Warning issued", you are not reading `strikeIssued` and `resultingStatus`.
19. As an administrator, revoke that strike. **Expect** the confirmation or the result to state that the account remains suspended. If your interface implies the account is restored, it is wrong.
20. Confirm the account is still `suspended` afterwards by reloading its detail.

### 15.5 Reports

21. Escalate a report as the moderator. **Expect** success.
22. Reload that report as the same moderator. **Expect** it to be readable, and **expect** resolve and dismiss controls to be absent.
23. Open the same report as an administrator. **Expect** resolve and dismiss to be available.
24. Open a report whose `reportType` is `story` or `message`. **Expect** the target to render read-only with no remove or restore control, and **expect** a note explaining the content cannot be taken down here.
25. Have two browser tabs open on the same pending report. Resolve it in one, then resolve it in the other. **Expect** the second to show a non-alarming message and refetch, not a raw error dialogue.

### 15.6 Content moderation

26. Create a post containing a hashtag, remove the post, ban that hashtag, then restore the post. **Expect** the success message to name the dropped hashtag. If it says only "Post restored", you are ignoring `remainingBannedHashtags`.
27. Restore a post with no banned hashtags. **Expect** a plain success message with no empty "dropped: " text.

### 15.7 Hashtags

28. Open a hashtag's edit form. **Expect** the name to be non-editable.
29. Submit a status change. **Expect** the request body to contain only `status` and `note`. Inspect it in the network tab. If `name` is present, the request will 400.
30. Create a hashtag. **Expect** the status selector to offer only `active` and `banned`.
31. After creating one, if your interface navigates to the new hashtag, **expect** it to load. If you get a 404, you used `data.id` instead of `data.targetEntityId`.
32. Create a hashtag with a name that already exists. **Expect** a field error on the name input, not a generic toast.

### 15.8 Pagination

33. Find a list with more items than one page. Scroll or click through to the end. **Expect** the final page's items to be visible. If the last few items are missing, you are terminating on an empty page instead of on `hasNextPage === false`.
34. Confirm the loop stops. **Expect** no request beyond the page where `hasNextPage` became false.
35. Apply a filter on a list you have already paginated. **Expect** pagination to restart from the first page and **expect no** `INVALID_CURSOR` error. If you see one, the cursor is being carried across the filter change.
36. Confirm no numbered pagination control exists anywhere. There is no total count to build one from.

### 15.9 Strictness

37. Inspect any list request in the network tab. **Expect** the query string to contain only parameters that endpoint declares. A stray `page`, `sort`, or `search` will produce a 400 naming the offending parameter.
38. Inspect any mutation request body. **Expect** only the declared fields. If your form library is spreading extra state, you will get `MALFORMED_REQUEST_BODY`.
39. Submit a form with a field that violates a constraint, such as an empty required reason. **Expect** the message to appear against that specific field, not as a generic toast. This requires reading the `data` map on `VALIDATION_ERROR`.

### 15.10 Vocabularies

40. Open the warning form. **Expect** the reason list to come from `GET /api/v1/config/vocabularies` and to be ordered by `sortOrder`. Confirm in the network tab that the request happens.
41. In the database, run `UPDATE report_reason_configs SET is_enabled = false WHERE reason_key = 'spam';` and reload. **Expect** "Spam" to still appear in the list, rendered as unavailable and not selectable. **Expect not** for it to vanish.
42. Open an audit log row whose `actionType` is `ban_hashtag`. **Expect** the label "Ban Hashtag" from the vocabulary, not a raw key or a client-side string transformation.

### 15.11 Observability

43. Open the statistics screen on a freshly reset database. **Expect** a "no statistics collected yet" empty state. **Expect not** a chart of zeros and **expect not** an error page.
44. Once data exists, **expect** the snapshot panel to display `computedAt` and to be labelled as of that time, not as live.
45. Set the statistics date range to something starting more than 30 days ago **without naming a granularity**. **Expect** the server to resolve to daily on its own. Then send the same range **with `granularity=half_hour`** and **expect a 400**: an out-of-range granularity is refused, never silently forced. Your controls must prevent that combination reaching the server.
46. Open the activity log. **Expect** the event-type filter to offer three options against production and seven against local development, never twenty. If it offers twenty you generated it from the OpenAPI enumeration; if it offers seven against production you did not gate the four engagement types on the environment.
47. Attempt to set the activity log range to 60 days. **Expect** the picker to prevent it rather than the server to refuse it.
48. Leave the panel open for two minutes as an administrator. **Expect** roughly two requests to the escalated count endpoint, not twenty.

### 15.12 Null handling

49. Find an audit row with `actionType: "issue_strike"`. **Expect** the actor column to read "System". If the row is blank or the page crashes, you are not handling a null `adminId`.
50. Open a user detail for an account suspended with no end date. **Expect** "Suspended indefinitely", not "Not suspended" and not a blank date.
51. Open a report whose target is a user. **Expect** no empty content block where `text` would be; the field is null for user targets.

### 15.13 The endpoints added since the previous package

52. Open a report whose `reportType` is `story`. **Expect** remove and restore controls, not a read-only panel with copy saying the content cannot be taken down. If that copy is still there, you did not delete the workaround.
53. Remove a reported story, then read the owner's profile and a follower's story feed. **Expect** the story absent from both, and **expect** exactly one `remove_story` row in the audit log.
54. Restore a story whose 24 hours have already passed. **Expect** the call to succeed and **expect** the story still to be absent from every feed. If your copy promised the reviewer it would come back, fix the copy.
55. Remove a reported message. **Expect** both participants to see the existing "message deleted" placeholder, with `content`, `media` and the share fields all null. **Expect not** a new "removed by an administrator" variant; the wire cannot tell you which it was.
56. Try to restore a message the sender deleted. **Expect** `409`. If your restore control was enabled by the placeholder rather than by the report, you will hit this.
57. Warn an account twice and open its detail. **Expect** `activeWarningCount` to read `2` and **expect** your warning dialog to say the next one will suspend the account. Issue the third and reopen the detail: **expect** `0`.
58. Open an account's violations, revoke a warning, and reload. **Expect** it gone. Toggle "show revoked": **expect** it back, marked, with a revocation time and actor. **Expect** the toggle to start a fresh page rather than reusing the cursor you were holding, which would be a `400 INVALID_CURSOR`.
59. List an account's sessions, revoke one. **Expect** exactly one to disappear and the rest to survive. Click revoke again on the same row: **expect** success, not an error.
60. As an administrator viewing your own account, **expect** exactly one session row marked as yours, resolved through `POST /api/v1/auth/session`. View another account: **expect** none marked.
61. Open a page of audit rows. **Expect** one `GET /api/v1/admin/user-summaries` request resolving every distinct identifier on it, not one request per row. Include an identifier that does not exist: **expect** an entry with `found: false`, not a missing key in your map.
62. Filter the audit log by a date range and a target account together. As a moderator, **expect** only your own rows. Ask explicitly for another actor with `adminId`: **expect** still only your own rows, silently.
63. As a moderator, escalate a report, then open your escalations list. **Expect** it there. Have an administrator resolve it, reload: **expect** it still there, rendered as closed. If it vanished, you filtered on status.
64. Open an account's post rows for an account with image posts. **Expect** the media on each row. **Expect not** a media column on the comment rows; there is none to fill.
