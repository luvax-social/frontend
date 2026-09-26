# Environment Bring-Up

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 4.
Everything here is from a command and its output, run on 2026-08-21.

## Summary

The infrastructure and the backend were already running when this phase began, started from a second checkout of the backend at `C:\Users\minhg\OneDrive\Desktop\GitClone\app` on the same `develop` commit `c297b03`, clean working tree.
That instance was stopped and restarted from its existing jar so a cold start-up could be observed.
The backend runs and serves.
Both a moderator session and an administrator session were obtained.
The recommendation module (Gorse) does not block the panel: it is a separate compose stack that is not started, and the application boots and serves every administrative endpoint with its variables left empty.

## 4.1 Infrastructure

The compose stack is defined in `backend/docker-compose.yaml`.
It defines five services, all published on the loopback interface only.

| Service | Image | Host port(s) | Health outcome |
|---|---|---|---|
| `postgres` | built from `docker/postgres` (Postgres 18.6) | 127.0.0.1:5432 | healthy |
| `rabbitmq` | `rabbitmq:4-management` | 127.0.0.1:5672, 15672 | healthy |
| `redis` | `redis:7-alpine` | 127.0.0.1:6379 | healthy |
| `mailpit` | `axllent/mailpit` | 127.0.0.1:1025, 8025 | healthy |
| `elasticsearch` | `docker.elastic.co/elasticsearch/elasticsearch:9.0.3` | 127.0.0.1:9200 | healthy |

The running stack was already up for about four hours under the compose project name `app` (containers `app-postgres-1` and so on), every service reporting `healthy`.
An attempt to bring the stack up a second time under the project name `backend` failed on a port collision (`Bind for 127.0.0.1:5432 failed: port is already allocated`) and was torn down; the already-running `app` stack was adopted instead.
Elasticsearch is the slowest to reach health, consistent with the handoff's "about forty seconds"; exact cold-start time was not re-measured because the stack was already healthy.

### Difference from the handoff's five services

The handoff section 5.2 lists exactly these five services, and the list matches.
No recommendation service such as Gorse is present in `docker-compose.yaml`.
Gorse lives in a separate, un-referenced file at `backend/gorse/docker-compose.gorse.yml` with its own `config/config.toml` and `seed/seed.py`.
It was not started and is not part of the main stack.

## 4.2 Configuration and start-up

### The .env situation

A populated `.env` already existed in both backend checkouts.
It carries real secrets (Postgres password, JWT secret, Resend API key, Google OAuth client secret, Cloudflare R2 keys); every one of those is redacted from this report.
The existing `.env` was preserved rather than regenerated from `.env.example`, because overwriting it would have destroyed the working credentials the running instance depends on.

The existing `.env` is stale relative to `.env.example`.
It omits, among others, `TZ`, every `REFRESH_COOKIE_*` variable, every `GORSE_*` and `APP_GORSE_BASE_URL` variable, every `STATS_*` variable, and the per-module consumer flags.
The application still starts, because `application.yaml` supplies a default for each of these (for example `STATS_INTERVAL` defaults to `PT30M`, `REFRESH_COOKIE_*` default to the values documented in the handoff).

### Variables the application refuses to start without

Not re-derived by deletion in this phase, to avoid disturbing a working local environment.
From the handoff and `application.yaml`, the enforced-at-startup set is `JWT_SECRET` and `APP_COOKIE_SIGNING_SECRET` (minimum 32 characters each), the Postgres coordinates, `REDIS_PASSWORD`, and the RabbitMQ credentials.
These are all present in the existing `.env`.

### Recommendation variables left empty

`GORSE_API_KEY` and `APP_GORSE_BASE_URL` are absent from the running `.env` entirely, so they resolve to their `application.yaml` defaults (`APP_GORSE_BASE_URL` defaults to `http://localhost:8088`, `GORSE_API_KEY` empty).
The application starts and serves with them empty.
The handoff's claim that these may stay empty holds.

### The Flyway line

```
o.f.core.internal.command.DbMigrate | Current version of schema "public": 74
o.f.core.internal.command.DbMigrate | Schema "public" is up to date. No migration necessary.
```

The database was already migrated by the earlier run, so this start-up applied nothing.
`flyway_schema_history` holds 74 successful rows; the resulting schema version is 74.
On a fresh database the same set would apply as "Successfully applied 74 migrations ... now at version v74".
Migration files on disk run to `V74__add_admin_actions_created_index.sql`.

Note: the backend's own `.claude/rules/struct.md` still says 72 migrations (max `V72`); the code and database are at `V74` (`V73__add_reports_open_queue_index`, `V74__add_admin_actions_created_index` are newer).
The workspace-level `STRUCT.md` says 18 migrations, which is far more stale.

### Start-up time and health

```
com.app.Application | Started Application in 27.52 seconds (process running for 28.732)
```

`GET /actuator/health` returns HTTP 200 with `{"groups":["liveness","readiness"],"status":"UP"}`.
`GET /actuator/info` returns HTTP 401 `UNAUTHORIZED` (it requires authentication).
`GET /api-docs` returns HTTP 200 (dev profile).

The running jar is `java -jar target/luvax-0.0.1-SNAPSHOT.jar` on `C:\Program Files\Java\jdk-23` (JDK 23), even though `pom.xml` pins `java.version` to 21.
The build compiles with `--release 21` and runs on 23 without incident.

### Every start-up warning, verbatim

Only three `WARN` lines, no `ERROR`.
All three are the same benign Spring AOP CGLIB proxy notice for `OidcUserService` final methods:

```
o.s.aop.framework.CglibAopProxy | Public final method [public final void org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService.setRetrieveUserInfo(java.util.function.Predicate)] cannot get proxied via CGLIB, consider removing the final marker or using interface-based JDK proxies.
o.s.aop.framework.CglibAopProxy | Public final method [public final void org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService.setOauth2UserService(org.springframework.security.oauth2.client.userinfo.OAuth2UserService)] cannot get proxied via CGLIB, consider removing the final marker or using interface-based JDK proxies.
o.s.aop.framework.CglibAopProxy | Public final method [public final void org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService.setClaimTypeConverterFactory(java.util.function.Function)] cannot get proxied via CGLIB, consider removing the final marker or using interface-based JDK proxies.
```

## 4.3 Seeding

`bash scripts/seed-dev-data.sh` was run from `GitClone/app` (the checkout whose compose project owns the running Postgres; the script issues `docker compose exec -T postgres psql`, which resolves to the running container only from that directory).

### Idempotence

Run once, every insert reported `INSERT 0 0` (nothing new).
Run twice more; the two account tables were captured and diffed byte-for-byte identical.
Seeding is genuinely idempotent.

### The reset

The database was found in a dirty state from the earlier session: `seed_alice` could not log in (`403 AUTH_ACCOUNT_INACTIVE`) and token epochs were bumped on several accounts.
`bash scripts/seed-dev-data.sh --reset` was run to recover a known baseline.
It cleared the content tables, returned every `@seed.local` account to `active`, and recreated the three seed posts (`INSERT 0 3`).
This was run deliberately, to make `seed_alice` usable again and to give the contract work clean targets.

Residual note: after reset, `seed_alice.follower_count` reads 2 while the seed follow graph implies 1.
Reset does not touch the follow graph or recompute trigger-maintained counters, so a stray follow from earlier testing survives.
This does not affect the contract work.

### Accounts that exist and authenticate

All five seeded accounts exist and authenticate after the reset:

| Username | Role | Login |
|---|---|---|
| `seed_alice` | user | 200 |
| `seed_bob` | user | 200 |
| `seed_carol` | user | 200 |
| `seed_mod` | moderator | 200 |
| `seed_admin` | admin | 200 |

All use password `SeedPass123!`.

## 4.4 The recommendation module

1. What it added, at the endpoint and start-up level: a personalized ranked feed backed by an external Gorse recommender reached over REST, plus a `user_events` activity table and its partition job.
The recommendation-owned HTTP surface is the ranked feed and the activity-log read (`GET /api/v1/admin/user-events`).
Start-up gained a Gorse client and a `gorse` circuit breaker; neither blocks boot when Gorse is unreachable, because the feed degrades to a popularity ranking then a chronological feed.
2. Effect on the administrative surface: the only administrative endpoint it touches is `GET /api/v1/admin/user-events` (row 47 of the matrix), which is administrator-only and returns 200 with a mandatory `from`/`to` window.
It does not otherwise change the administrative surface.
3. Effect on the frontend repository: none found.
Searched the frontend on branch `chore/admin/panel-reconnaissance` (cut from `develop`); there is no Gorse client, no recommendation service, and no recommendation route under `src/`.
4. Frontend build/run with it present: not separately affected, because it added nothing to the frontend.

The module does not block the panel.
It neither broke start-up nor broke seeding in this environment.
