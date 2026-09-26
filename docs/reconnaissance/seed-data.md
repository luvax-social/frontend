# Seed Data

`tools/seed/seed.py` creates the demo data set through the public HTTP API only.

This document covers `seed.py` alone. `tools/seed/` also holds `seed_rich.py`, a larger curated
dataset with real media, which is documented in `tools/seed/README.md` rather than here.

It never writes to the database.
That is deliberate: because every row it creates is created by a request a browser could make, the
script doubles as an executable check of the contract in `backend-api-contract.md`.
If the documented contract is wrong, the script fails.

It found two contract facts that way, during this audit:
`SOCIAL_ALREADY_REQUESTED` as a distinct duplicate-follow code for private accounts, and the
403 returned when an author likes their own comment.

## Requirements

- Python 3, standard library only. No `pip install`.
- Both applications already running.
- Accounts must be email-verified. See the blocker below.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `LUVAX_API_BASE_URL` | `http://localhost:8080/api/v1` | API base, including the version prefix |
| `LUVAX_SEED_PASSWORD` | `ReconPass123!` | Password for every seeded account |
| `LUVAX_SEED_DOMAIN` | `example.com` | Email domain for seeded accounts |

The base URL is never hardcoded.

## Running it from the host

```bash
cd frontend
python tools/seed/seed.py
```

Against a different backend:

```bash
LUVAX_API_BASE_URL=http://localhost:8080/api/v1 python tools/seed/seed.py
```

## Running it in a container

**There is no backend container to `docker exec` into.**
`backend/docker-compose.yaml` defines exactly four services: `postgres`, `rabbitmq`, `redis`, and
`elasticsearch`. The Spring Boot application runs on the host through `./mvnw spring-boot:run`.
A `Dockerfile` for the backend exists but no compose service uses it.

Of the four containers that do run, none has a Python interpreter; the postgres image is Debian 13
with no `python` or `python3` on the path.

So the containerised invocation is a throwaway Python container attached to the same compose
network, reaching the host-run API through `host.docker.internal`.
This is verified working:

```bash
cd frontend
MSYS_NO_PATHCONV=1 docker run --rm \
  --network backend_default \
  --add-host=host.docker.internal:host-gateway \
  -e LUVAX_API_BASE_URL=http://host.docker.internal:8080/api/v1 \
  -v "$(pwd)/tools/seed:/seed:ro" \
  python:3.12-alpine python /seed/seed.py
```

`MSYS_NO_PATHCONV=1` is needed only under Git Bash on Windows, which otherwise rewrites the
container-side `/seed` path into a Windows path.
Drop it on Linux, macOS, or PowerShell.

If the backend is ever added to `docker-compose.yaml` as a service, and if its image carries a
Python interpreter, the invocation becomes the plain one that was originally asked for:

```bash
docker exec -e LUVAX_API_BASE_URL=http://localhost:8080/api/v1 \
  backend-app-1 python /app/tools/seed/seed.py
```

That is not runnable today and has not been tested.

## Idempotency

Verified: the script was run four times against the same database.
Row counts after the fourth run, read directly from PostgreSQL:

```
 posts     |     5
 comments  |    13
 max_depth |    10
 follows   |     5
 saves     |     2
 users     |     4
```

Identical to the counts after the first successful run.

Three mechanisms make that work:

| Resource | Mechanism |
|----------|-----------|
| Accounts | `409 USER_ALREADY_EXISTS` is tolerated |
| Follows, blocks, likes, saves, reports | Every duplicate returns a 409 with a distinct code. The script tolerates the full set: `SOCIAL_ALREADY_FOLLOWING`, `SOCIAL_ALREADY_REQUESTED`, `SOCIAL_ALREADY_BLOCKED`, `POST_ALREADY_LIKED`, `POST_ALREADY_SAVED`, `COMMENT_ALREADY_LIKED`, `MEDIA_STORAGE_KEY_ALREADY_EXISTS`, `REPORT_DUPLICATE` |
| Comments | The `Idempotency-Key` header. A replay returns 201 with the **same comment id**, verified. This is true idempotency, not tolerated duplication |
| Posts | No idempotency support on `POST /posts`, so the script marks every caption it writes with `[luvax-seed]`, lists the author's existing posts through `GET /posts/user/{userId}`, and skips any caption already present |

Only the 409 codes listed above are tolerated.
Any other error aborts with a non-zero exit and prints the status and code, so a genuine contract
break is never silently swallowed.

## What it creates

### Accounts

| Username | Role in the demo |
|----------|-----------------|
| `luvax_ava` | The viewer. Log in as this one |
| `luvax_ben` | Mutual follow with Ava, author of the feed posts |
| `luvax_cleo` | Private account, `isPrivate: true` |
| `luvax_dan` | The block target |

### Follow graph, with edges in both directions

| Edge | Status |
|------|--------|
| ava to ben | accepted |
| ben to ava | accepted |
| ava to dan | accepted |
| dan to ava | accepted |
| ava to cleo | **pending**, because Cleo is private |

Five rows. Two mutual pairs plus one pending request, which exercises the follow request inbox.

### Posts

| Author | Count | Note |
|--------|-------|------|
| `luvax_ben` | 3 | One carries a media asset. These are what Ava sees in her feed |
| `luvax_ava` | 1 | Ava's own, for the edit and delete steps |
| `luvax_dan` | 1 | Disappears from the feed once Dan is blocked |

Ben's posts are the feed content because **the feed carries followed authors only and never the
viewer's own posts**. Without this the demo's step 1 shows an empty screen.

### Comment tree at maximum depth

One top-level comment on Ben's first post, then replies down to **depth 10**, the backend maximum.
Verified in the database: `max(depth) = 10`.

The cap is enforced twice, by `MAX_DEPTH = 10` in `CommentServiceImpl` and by
`CHECK (depth >= 0 AND depth <= 10)` on the `comments` table.
Authorship alternates between Ava and Ben so every level has a reply-to-someone-else affordance.

Two further top-level comments exist to make the ordering visible:

| Comment | Written | Likes |
|---------|---------|-------|
| "an older comment everyone liked" | last | 2 |
| "a top-level comment" | first | 1 |
| "a newer comment nobody liked" | second to last | 0 |

### Uneven likes, so sorting differs visibly

That distribution is the point.
The backend prepends a pinned block of the top three top-level comments by like count on the first
page, and only comments with at least one like are eligible.

So the comment written **last** appears **first**, marked `"pinned": true`, and the zero-like
comment never enters the pinned block at all.
Ordering by like count and ordering by time produce visibly different results, which is what the
demo needs in order to show the behaviour.

Post likes are similarly uneven: 2, 1, and 0 across Ben's three posts.

Note the script does **not** have Dan like his own comments.
`POST /comments/{id}/like` used to return `403 COMMENT_FORBIDDEN` when the actor is the author,
while posts had no such restriction.
This was discovered by the script failing, which is the script working as intended.

**That restriction has since been removed.** The endpoint now succeeds for the comment's author,
verified against the running server. The script still avoids the case, so its behaviour is
unchanged; the constraint it was avoiding simply no longer exists.

### Saved posts

Two of Ben's posts are saved by Ava, so `GET /posts/saved` is non-empty.

### One report

Ava reports Dan's post for `spam`, so the moderation queue is not empty.
A regular account cannot read it back: `GET /reports` returns 403.

## What it could not create, and why

### Email-verified accounts

**This blocker is resolved.** The section below is kept because the script's behaviour is unchanged:
it still stops and reports rather than verifying accounts itself.

Mail is now delivered locally by Mailpit, which accepts every address including the seed domain, so
verification links do arrive. The manual database write this section used to require is no longer
needed: open `http://localhost:8025`, open each account's "Verify your email address" mail, and
click the link.

What follows describes the original blocker.

The script registers all four accounts successfully, then cannot log in:

```
403 AUTH_EMAIL_NOT_VERIFIED  "This account's email address has not been verified"
```

Verification requires a token that is only ever delivered by email.
The mail provider at the time, Resend, rejected the seed domain:

```
Failed to send email: 422 {"statusCode":422,"name":"validation_error",
"message":"Invalid `to` field. Please use our testing email address instead of domains like
`example.com`."}
```

The token is stored in Redis under `auth:token:email-verification:{sha256}`, hashed, so it cannot
be recovered from the store either.
There is no HTTP endpoint that verifies an address without the token.

The script therefore **stops and reports** rather than reaching into the database.
Output on a first run against fresh accounts:

```
accounts
  registered luvax_ava
  registered luvax_ben
  registered luvax_cleo
  registered luvax_dan

BLOCKED: not every seeded account could log in.
  - luvax_ava: email is not verified, so this account cannot be used. Verification needs a token
    that is only delivered by email, and the local mail provider rejects the seed email domain.
    There is no HTTP endpoint that verifies an address without that token, so this script cannot
    resolve it without writing to the database.
  ...
```

Exit code 1.

**The step between the first and second invocation**, as it works now:

Open `http://localhost:8025`, and for each of the four accounts open the "Verify your email address"
mail and click **Verify Email Address**.

Then rerun the script; it completes and exits 0.

The database write this step used to require is no longer needed:

```bash
# No longer necessary. Kept only for environments predating the local mail catcher.
docker exec backend-postgres-1 psql -U luvax -d luvax -c \
  "UPDATE user_credentials SET email_verified = true, email_verified_at = NOW()
   WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'luvax\_%')
     AND email_verified = false;"
```

Why the script does not just run the SQL itself: the whole value of an API-only seed is that it
fails when the documented contract is wrong. A script that reaches around a gap in the contract no
longer proves anything about it. See `open-decisions.md` O8.

### Media that actually renders

The script registers one media asset and attaches it to a post, so the media relation on a post is
exercised end to end.

It does **not** upload any bytes.

**This step no longer works.** `POST /media/upload-complete` now verifies that the object exists in
storage and that its size matches the submitted metadata, and answers
`422 MEDIA_OBJECT_NOT_UPLOADED` when it does not. Verified against the running server.

The script registers an asset without transferring anything, so it will fail at that step on a
fresh environment. Fixing it means either uploading real bytes to the pre-signed URL or dropping
the media asset from the seed set. Neither has been done.

When this previously succeeded, the server performed no object inspection: the asset row was
created and a `cdnUrl` returned for an object that was never transferred.

The consequence is that the image in that post **404s in the browser**.
The post is structurally correct and visually broken.
Asset rows created before the check existed are not repaired by it.
Uploading real bytes would write real objects into the project's Cloudflare R2 bucket, which is an
outward-facing side effect the audit did not take on its own initiative.

If a rendering image is needed for the demo, someone should upload one deliberately.

### A moderator or administrator account

Every `/api/v1/admin/**` endpoint, plus `GET /reports`, `GET /reports/pending`,
`GET /reports/{id}`, and `PATCH /reports/{id}/status`, requires `moderator` or `admin`.
`user_role` is set at registration and there is no API to change it.
Granting one needs a direct database write, which the script does not do.

### Stories and messages

Both modules are implemented on the backend and respond, but they are out of scope as product
features and the frontend renders mock data for both.
The script creates neither.

### Notifications

Not created directly, and they do not need to be.
The follows, likes, and comments the script creates generate notification rows asynchronously
through RabbitMQ. `GET /notifications` was verified returning populated results after the endpoint
sweep.

Because delivery is asynchronous, the notification list may lag the seed run by a moment.
