# Local Environment Runbook

Exact steps to bring both applications up from a clean state, and every error hit while doing it.

Verified on Windows 11 with Git Bash, Docker Desktop, JDK 23, and Node with npm, on 2026-08-12.

The service table and the mail section were corrected on 2026-09-12 against `docker-compose.yaml`
and `application.yaml`; the step-by-step bring-up below has not been re-run since the original
verification date.

## Prerequisites

| Tool | Version used | Note |
|------|-------------|------|
| Docker Desktop | running | Five containers are started |
| JDK | 23.0.1 | The project targets Java 21. JDK 23 compiles and runs it without changes |
| Node | whatever satisfies Vite 8 | Vite 8 requires Node 20 or newer |
| Python | 3.x | Only for the seed script, standard library only |

Repository layout:

```
Luvax/
├── backend/     Spring Boot 4.0.6
└── frontend/    React 19, Vite 8
```

Note the workspace `STRUCT.md` calls these `Luvax/` and `app-fe/`.
On disk they are `backend/` and `frontend/`.

## 1. Environment files

Both `.env` files already exist and are populated.
Neither is in git, and neither should be committed.

`backend/.env` is derived from `backend/.env.example`.
The values that must be real for a full local run:

| Variable | Purpose | Consequence if unset |
|----------|---------|---------------------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database and container credentials | Backend fails to start |
| `REDIS_PASSWORD` | Redis auth | Backend fails to start |
| `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, `SPRING_RABBITMQ_*` | Broker | Backend fails to start |
| `JWT_SECRET`, `APP_COOKIE_SIGNING_SECRET` | Token signing | Backend fails to start |
| `ELASTICSEARCH_URIS` | Search | Post search silently returns empty results |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `MEDIA_CDN_BASE_URL` | Media pre-signed URLs | `POST /media/upload` fails; posts with media cannot be created |
| `MAIL_FROM_ADDRESS`, `RESEND_API_KEY` | Outbound email | Verification and reset emails are never delivered |
| `CORS_ALLOWED_ORIGINS` | Must include `http://localhost:5173` | Browser requests and the WebSocket handshake are rejected |

`frontend/.env`:

```
VITE_API_URL=http://localhost:8080/api/v1
VITE_GOOGLE_AUTH_URL=http://localhost:8080/api/v1/auth/oauth2/authorize/google
VITE_GOOGLE_REDIRECT_PATH=/oauth2/callback
VITE_APP_NAME=MyApp
VITE_APP_ENV=development
```

In dev the frontend actually calls `/api/v1` and lets Vite proxy it, so `VITE_API_URL` only takes
effect in a production build.
`VITE_APP_NAME` is a placeholder; see `defects.md` D22.

## 2. Start the infrastructure

```bash
cd backend
docker compose up -d
```

Five services start:

| Service | Port | Image |
|---------|------|-------|
| postgres | 5432 | built from `docker/postgres` |
| rabbitmq | 5672 broker, 15672 management UI | `rabbitmq:4-management` |
| redis | 6379 | `redis:7-alpine`, password-protected |
| elasticsearch | 9200 | `docker.elastic.co/elasticsearch/elasticsearch:9.0.3`, single-node, security disabled |
| gorse | 8088 | `zhenghaoz/gorse-in-one:0.5.11`, the recommender behind the personalised feed |

The postgres image is built locally on first run, which takes a minute or so.
Elasticsearch is capped at `-Xms512m -Xmx512m`.

Confirm:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## 3. Start the backend

```bash
cd backend
./mvnw spring-boot:run
```

The default active profile is `dev`, set in `application.yaml`.
That matters: `application-dev.yml` enables Swagger, every RabbitMQ consumer, and both WebSocket
live flags.

Flyway applies 44 migrations on first run, in under a second.
Startup takes about 26 seconds.

Wait for:

```
o.s.boot.tomcat.TomcatWebServer | Tomcat started on port 8080 (http) with context path '/'
com.app.Application | Started Application in 26.123 seconds
```

Confirm:

```bash
curl -s http://localhost:8080/actuator/health
{"groups":["liveness","readiness"],"status":"UP"}
```

Useful endpoints in the dev profile:

| URL | Purpose |
|-----|---------|
| `http://localhost:8080/api-docs` | OpenAPI JSON, the authoritative contract |
| `http://localhost:8080/swagger-ui` | Swagger UI |
| `http://localhost:8080/actuator/health` | Health, unauthenticated |

Note `/actuator/env` and most other actuator endpoints require authentication and return
`401 UNAUTHORIZED`.

## 4. Start the frontend

```bash
cd frontend
npm run dev
```

This runs `scripts/dev-server.mjs`, not `vite` directly.

```
VITE v8.0.13  ready in 3655 ms
➜  Local:   http://localhost:5173/
```

On the first run after a config change Vite re-optimises dependencies, which adds a few seconds.

`npm run dev:reset` does the same with a state reset.

## 5. Create usable accounts

This step is completed entirely through the API and the browser.

> **Mail no longer works the way the rest of this section describes.**
> Mailpit was removed from `docker-compose.yaml`. The transport is now Resend in every profile
> (`app.mail.transport: resend`), with a non-network `noop` transport selectable in the `dev`
> profile only via `APP_MAIL_TRANSPORT=noop`; `MailTransportGuard` refuses `noop` outside `dev`
> and logs the resolved transport at startup.
> `noop` sends nothing and opens no connection: it records the rendered mail into
> `SentMailRecorder` and writes an `email_deliveries` row with a null `provider_message_id`.
> `app.mail.allowed-recipient-domains` additionally restricts which recipient domains a machine
> may send to, defaulting to a reserved domain that cannot receive mail.
> The Mailpit steps below are kept as the record of how this was done in August 2026; they have
> not been re-verified against the current transports, and the `localhost:8025` interface they
> refer to does not exist any more.

Mail was delivered locally by Mailpit, which accepted every address, so verification links arrived
and the manual database write this section used to require is no longer needed.

Registration works:

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"luvax_ava","email":"luvax_ava@example.com",
       "password":"ReconPass123!","displayName":"Luvax Ava"}'
```

Login is refused until the address is verified:

```
403 {"success":false,"code":"AUTH_EMAIL_NOT_VERIFIED",
     "message":"This account's email address has not been verified"}
```

Two mails are delivered per registration, "Verify your email address" and "Welcome to Social".
Open the Mailpit interface at `http://localhost:8025`, open the verification mail, and click
**Verify Email Address**. The link points at the frontend:

```
http://localhost:5173/verify-email?token=<token>
```

Following it verifies the address and signs you in.

To pull the link without leaving the terminal:

```bash
curl -s "http://localhost:8025/api/v1/search?query=to%3Aluvax_ava%40example.com" \
  | python -c "import sys,json; print(json.load(sys.stdin)['messages'][0]['ID'])"

curl -s "http://localhost:8025/api/v1/message/<messageId>" \
  | python -c "import sys,json,re; print(re.findall(r'http://localhost:5173/verify-email\?token=\S+', json.load(sys.stdin)['Text'])[0])"
```

Login then succeeds:

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"luvax_ava@example.com","password":"ReconPass123!"}'
```

Note the field is `identifier`, not `email`.

### Update: the browser path now works too

At the time this runbook was written, the manual SQL above was the only way to reach a usable
session, because the login form posted `email` and every attempt failed with
`400 MALFORMED_REQUEST_BODY`. That is fixed. See `docs/backend-contract-alignment/`.

The verification step above is still required, but it is now done by clicking the link in Mailpit
rather than by writing to the database. Verify, then log in through the browser at
`http://localhost:5173/login`.

Both identifier forms work in the form's "username or email" field:

- `luvax_ava@example.com`
- `luvax_ava`

Registering through the browser also works, and the form now accepts exactly what the server
accepts. Two cases that the form previously rejected on its own are valid:

- usernames containing a dot, such as `luvax.ava`, which the backend pattern permits
- passwords with no uppercase letter and no digit, which the backend does not require

A freshly registered account still lands on the verification notice, and is verified by clicking
the link in Mailpit as described in step 5.

### Update: a session now survives a reload, and screens have addresses

Two later changes affect the startup and login path described above. See `docs/url-routing/`.

Signing in sets an `HttpOnly` cookie named `luvax_refresh`, scoped to `/api/v1/auth`. A reload now
restores the session from it instead of returning you to the sign-in page, so the log-in step no
longer has to be repeated after every refresh. Nothing else about signing in changed, and the
verification step described in step 5 is still required.

The whole signed-in application no longer lives at `/app`. Every screen has its own address, so you
can go straight to the one you want instead of clicking through:

```
http://localhost:5173/app                     feed
http://localhost:5173/app/explore             explore
http://localhost:5173/app/settings            settings
http://localhost:5173/app/profile             your own profile
http://localhost:5173/app/u/<userId>          someone else's profile
http://localhost:5173/app/p/<postId>          a post
```

The full table is in `docs/url-routing/route-table.md`.

Two consequences worth knowing when testing:

- Signing out now genuinely revokes the session server-side. It previously failed silently, so a
  "signed out" browser stayed usable. If you need a clean slate, sign out and reload; you will land
  on the sign-in page.
- To reach an empty session without signing out, clear the `luvax_refresh` cookie for
  `localhost`. Clearing `localStorage` alone is no longer enough, because the cookie is what
  restores the session.

## 6. Seed the demo data

```bash
cd frontend
python tools/seed/seed.py
```

The script registers the four accounts, so the usual order is: run it once (it stops and reports
that the accounts are unverified), verify each one through Mailpit, then run it again.

Full detail in `seed-data.md`.

## 7. Test accounts

Created by the seed script.
All share one password.

| Username | Email | Password | Role in the demo |
|----------|-------|----------|-----------------|
| `luvax_ava` | `luvax_ava@example.com` | `ReconPass123!` | The viewer. Log in as this one |
| `luvax_ben` | `luvax_ben@example.com` | `ReconPass123!` | Mutual follow with Ava. Author of the feed posts |
| `luvax_cleo` | `luvax_cleo@example.com` | `ReconPass123!` | Private account with a pending request from Ava |
| `luvax_dan` | `luvax_dan@example.com` | `ReconPass123!` | The block target |

The password is overridable with `LUVAX_SEED_PASSWORD`.

These are local development accounts on a local database.
Do not reuse this password anywhere else.

## 8. Verify the whole stack

```bash
# Backend
curl -s http://localhost:8080/actuator/health

# API through the Vite proxy, which is the path the browser uses
curl -s http://localhost:5173/api/v1/posts/feed
# 401 UNAUTHORIZED is correct here: the proxy works and auth is enforced

# WebSocket, dev profile only
curl -s http://localhost:8080/ws/comments/info
# {"entropy":...,"origins":["*:*"],"cookie_needed":true,"websocket":true}

# Frontend
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

## Errors encountered, and their resolutions

Every one of these was hit during this audit.

### Login returns 400 in the browser but 200 with curl

**Cause:** the frontend posts `{email, password}`; the backend requires
`{identifier, password}`.
`defects.md` D1.

**Resolution:** none applied. This is inside the frozen auth slice.
For any API work, call `/auth/login` directly with `identifier`.
There is currently no way to obtain a session through the user interface.

### `403 AUTH_EMAIL_NOT_VERIFIED` on every fresh account

**Cause:** email verification is mandatory and the account has not been verified yet.

**Resolution:** open `http://localhost:8025` and click the link in the verification mail. See step 5.

### Historical: `Failed to send email: 422 ... domains like example.com`

**No longer occurs.** Mail was previously sent through Resend, which rejected `example.com` as a
destination domain, so no verification link was ever delivered locally and a manual database write
was the only way to reach a usable session.

Mail is now delivered to Mailpit, which accepts every address. Kept here only so the error is
recognisable if an older environment is encountered.

### `HTTP method not supported: POST` on approving a follow request

**Cause:** `PATCH /social/follow-requests/{requesterId}/approve` is a `PATCH`. Sending `POST`
returns 400, not 405.

**Resolution:** use `PATCH`. `defects.md` D9 covers the wrong status code.

### `400 MALFORMED_REQUEST_BODY` on a post status transition

**Cause:** the field is `targetStatus`, not `status`.

**Resolution:** send `{"targetStatus":"archived"}`. `defects.md` D2 covers the frontend service
that gets this wrong.

### Historical: `403 COMMENT_FORBIDDEN` when liking a comment

**No longer occurs.** The author could not previously like their own comment, and the message did
not say so.

The prohibition has been removed, and `POST /comments/{id}/like` now succeeds for the comment's
author. Verified against the running server. Kept here only so the error is recognisable if an
older environment is encountered.

### `400 BAD_REQUEST` on `GET /users/suggestions`

**Cause:** no such endpoint. The path is matched by `GET /users/{userId}` and `"suggestions"` fails
UUID conversion.

**Resolution:** none available; the endpoint does not exist. `defects.md` D3.

### Three CGLIB warnings during startup

```
WARN o.s.aop.framework.CglibAopProxy | Public final method [... OidcUserService
.setClaimTypeConverterFactory ...] cannot get proxied via CGLIB
```

**Cause:** framework noise from proxying Spring Security's `OidcUserService`.

**Resolution:** none needed. These are the only warnings in an otherwise clean startup, and there
are no errors.

## Shutting down

```bash
# Stop the frontend and backend with Ctrl-C in their terminals, then:
cd backend
docker compose down

# To also discard the Elasticsearch volume:
docker compose down -v
```

Postgres has no named volume in `docker-compose.yaml`, so `docker compose down` discards the
database and the next start reapplies all 44 migrations to an empty schema.
The accounts and seed data are lost, and steps 5 and 6 must be repeated.
