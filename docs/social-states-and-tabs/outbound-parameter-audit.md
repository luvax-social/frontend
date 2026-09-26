# Outbound Query Parameter Audit

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

This document answers a question the backend team asked directly.

The question was whether the frontend sends query parameters the backend does not declare, anywhere at all.
The backend needs the answer to decide whether to enforce strict rejection of unrecognised query parameters across the whole API, rather than only on the handlers that have opted in so far.

This document is written to be handed to the backend team without further context.

## The answer

**The list is empty.**

Every query parameter the frontend sends today is declared by the backend for the endpoint it is sent to.

There is no endpoint where the client sends an undeclared parameter.

Strict rejection can be enabled across the whole API without breaking any call this frontend currently makes.

That conclusion is qualified in two ways, both recorded below under "Qualifications".
Neither qualification is an undeclared parameter.

## How the answer was produced

The client side of the comparison came from reading every outbound call in the frontend source rather than from observing traffic, so that endpoints not exercised in a browser session are still covered.

Every HTTP call in the frontend goes through one of four axios instances.
There are no `fetch` calls and no other HTTP clients.

| Instance | File | Used for |
|----------|------|----------|
| `axiosInstance` | `src/services/axiosInstance.js` | Authenticated feature calls |
| `axiosClient` | `src/api/axiosClient.js` | Authenticated auth and media calls |
| `publicClient` | `src/api/axiosClient.js` | Unauthenticated auth calls |
| (re-export) | `src/services/index` | Re-exports `axiosClient`, adds no calls |

Neither request interceptor injects query parameters.
This was checked directly: there is no assignment to `config.params` in either interceptor.
So the parameters a call sends are exactly the parameters its call site passes, with no global additions.

The backend side of the comparison came from the OpenAPI document served by the running application at `http://localhost:8080/api-docs`, read on 2026-08-13.
That document describes 92 operations.
It is the backend's own generated description of itself, not a hand-maintained summary, so it cannot drift from the handlers.

## Endpoint by endpoint

Every row is an endpoint the frontend calls.
"Sent" is what the client puts in the query string.
"Declared" is what the OpenAPI document lists as query parameters for that operation.

An endpoint that sends nothing and declares something is not a defect.
It means the client is using the backend's defaults, which is always safe under strict rejection.

### Authentication

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `POST /auth/login` | none | none | No |
| `POST /auth/register` | none | none | No |
| `POST /auth/logout` | none | none | No |
| `POST /auth/refresh` | none | none | No |
| `POST /auth/forgot-password` | none | none | No |
| `POST /auth/reset-password` | none | none | No |
| `GET /auth/verify-email` | `token` | `token` (required) | No |
| `POST /auth/verify-email/resend` | none | none | No |
| `POST /auth/oauth2/exchange` | none | none | No |

### Users

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `GET /users/me` | none | none | No |
| `PATCH /users/me` | none | none | No |
| `GET /users/{userId}` | none | none | No |
| `GET /users/search` | `q`, `cursor`, `limit` | `q` (required), `cursor`, `limit` | No |

### Posts

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `POST /posts` | none | none | No |
| `GET /posts/feed` | `cursor`, `limit` | `cursor`, `limit` | No |
| `GET /posts/search` | `q`, `cursor`, `limit` | `q` (required), `cursor`, `limit` | No |
| `GET /posts/user/{userId}` | `cursor`, `limit` | `type`, `cursor`, `limit` | No |
| `GET /posts/saved` | `cursor`, `limit` | `cursor`, `limit` | No |
| `GET /posts/{postId}` | none | none | No |
| `PATCH /posts/{postId}` | none | none | No |
| `DELETE /posts/{postId}` | none | none | No |
| `PATCH /posts/{postId}/status` | none | none | No |
| `POST /posts/{postId}/like` | none | none | No |
| `DELETE /posts/{postId}/like` | none | none | No |
| `POST /posts/{postId}/save` | none | none | No |
| `DELETE /posts/{postId}/save` | none | none | No |

### Comments

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `GET /posts/{postId}/comments` | `cursor`, `limit` | `sort`, `cursor`, `limit` | No |
| `POST /posts/{postId}/comments` | none | none | No |
| `GET /comments/{commentId}/replies` | `limit` | `cursor`, `limit` | No |
| `PATCH /comments/{commentId}` | none | none | No |
| `DELETE /comments/{commentId}` | none | none | No |
| `POST /comments/{commentId}/like` | none | none | No |
| `DELETE /comments/{commentId}/like` | none | none | No |

### Social

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `POST /social/follow/{targetUserId}` | none | none | No |
| `DELETE /social/follow/{targetUserId}` | none | none | No |
| `POST /social/block/{targetUserId}` | none | none | No |
| `DELETE /social/block/{targetUserId}` | none | none | No |
| `GET /social/users/{userId}/followers` | `cursor`, `limit` | `cursor`, `limit` | No |
| `GET /social/users/{userId}/following` | `cursor`, `limit` | `cursor`, `limit` | No |
| `GET /social/blocked` | `cursor`, `limit` | `cursor`, `limit` | No |
| `GET /social/follow-requests` | none | `cursor`, `limit` | No |
| `PATCH /social/follow-requests/{requesterId}/approve` | none | none | No |
| `PATCH /social/follow-requests/{requesterId}/reject` | none | none | No |

### Hashtags

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `GET /hashtags/search` | `q`, `cursor`, `limit` | `q` (required), `cursor`, `limit` | No |

### Notifications

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `GET /notifications` | `cursor`, `limit` | `cursor`, `limit` | No |
| `GET /notifications/unread-count` | none | none | No |
| `PATCH /notifications/{notificationId}/read` | none | none | No |
| `PATCH /notifications/read-all` | none | none | No |

### Media

| Endpoint | Sent | Declared | Undeclared? |
|----------|------|----------|-------------|
| `POST /media/upload` | none | none | No |
| `POST /media/upload-complete` | none | none | No |

## The three parameters the backend asked about specifically

The backend asked whether `mediaType`, `hasMedia`, or `postType` are still sent to `GET /posts/user/{userId}`, because a previous phase probed that endpoint with them and they would now return `400`.

**None of the three is sent as a query parameter anywhere in the frontend.**

They were probes issued from a terminal during the previous phase's contract investigation.
They were never written into frontend source.

Two of the three names do appear in the frontend source, and both are request body fields rather than query parameters.
Strict query parameter rejection does not affect either.

| Name | Where it appears | What it is |
|------|-----------------|------------|
| `postType` | `src/features/luvax/components/ComposerScreen.jsx:83` | A field in the `POST /posts` request body |
| `postType` | `src/features/luvax/components/PostCard.jsx:321` | A field read off a response, not sent |
| `mediaType` | `src/features/luvax/hooks/useMediaUpload.js:63,84` | A field in the `POST /media/upload` and `/media/upload-complete` request bodies |
| `mediaType` | `src/utils/helpers.js:256` | A field read off a response, not sent |
| `hasMedia` | nowhere | Not present in the frontend at all |

Confirmed against the running server that all three would in fact be rejected on that endpoint, so the question was worth asking:

```
GET /api/v1/posts/user/{userId}?hasMedia=true
400
{"success":false,"code":"BAD_REQUEST",
 "message":"Unsupported query parameter: hasMedia. Accepted: cursor, limit, type"}

GET /api/v1/posts/user/{userId}?mediaType=IMAGE   -> 400
GET /api/v1/posts/user/{userId}?postType=IMAGE    -> 400
```

The error message naming the accepted parameters is genuinely useful and made this audit faster.
Keeping that in the message if strict rejection is rolled out more widely is worth the effort.

## Qualifications

Neither of these is an undeclared parameter.
Both are recorded because they are things the backend team would reasonably want to know before turning strict rejection on everywhere.

### 1. The explore screen sends a search term the user never typed

`src/services/post.service.js:30` calls `GET /posts/search` and, when no term is present, substitutes the literal string `a`:

```js
if (!params.q) params.q = 'a';
```

`q` is declared and required on that endpoint, so this is a legal request and strict rejection does not touch it.

It is recorded here because it means the explore screen is not an explore feed.
It is a search for the letter `a`, presented as an explore feed.
That is a frontend problem rather than a backend one, and it is recorded in `deferred-findings.md` rather than fixed in this phase.

The reason it matters to the backend team is that explore traffic is currently indistinguishable from real post search traffic in any metric derived from `GET /posts/search`.

### 2. Two declared parameters are never sent

These are declared by the backend and unused by the client.
They are listed so the backend team knows the capability exists and is not being consumed, in case that affects a deprecation decision.

| Endpoint | Declared but never sent | Why |
|----------|------------------------|-----|
| `GET /posts/{postId}/comments` | `sort` | A comment sort control is explicitly out of scope for this phase |
| `GET /comments/{commentId}/replies` | `cursor` | Replies are fetched as a single page of up to 50 and never paged past that |

The `replies` case is a real limitation rather than a deliberate choice.
A comment with more than 50 direct replies will silently show only the first 50.
This is recorded in `deferred-findings.md`.

## Scope of this audit

What this audit covers:

- Every query parameter sent by the frontend application source under `src/`.

What it does not cover:

- Request bodies. Strict query parameter rejection does not inspect them.
- Path parameters.
- Headers. The client sends `Authorization` and, on comment creation, `Idempotency-Key`, both of which the backend declares.
- The seed script at `tools/seed/seed.py`. It is a development tool rather than application code. It was reviewed and sends only declared parameters.

## Recommendation to the backend team

Enabling strict rejection across the whole API is safe with respect to this frontend.

The audit found no call that would break.

One request: if strict rejection is rolled out, keep the `Accepted: ...` list in the error message.
It turns a failed request into a self-describing contract, and it is the reason this audit could confirm the accepted set for `GET /posts/user/{userId}` without reading backend source.
