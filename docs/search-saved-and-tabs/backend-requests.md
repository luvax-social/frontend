# Requests to the Backend Team

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Two profile views cannot be built because the data they need cannot be requested.

This document describes what was observed and what the frontend needs.

It does not propose a design.

How to provide these capabilities, and whether to provide them at all, is your team's call.

## Context

The profile screen has three tabs: `posts`, `photos`, and `liked`.

Only `posts` is backed by an endpoint.

Until now the other two were decorative: selecting them moved an underline and left the same grid of all posts on screen, including text-only posts under a tab labelled `photos`.

That was misleading, so both tabs now show a short notice saying the view is not available yet.

Nothing is filtered on the client, because filtering one page of already-fetched results produces a grid that silently omits posts and paginates incorrectly.

## Request 1: a profile's posts that carry media

### What was observed

`GET /api/v1/posts/user/{userId}` returns a cursor page of a profile's posts.

It accepts `cursor` and `limit`.

Three plausible filter parameters were tried against an account with three posts, none of which carry media.

| Request | Response |
|---------|----------|
| `GET /posts/user/{id}?limit=50` | `200`, 3 posts, 0 carrying media |
| `GET /posts/user/{id}?mediaType=IMAGE&limit=50` | `200`, 3 posts, 0 carrying media |
| `GET /posts/user/{id}?hasMedia=true&limit=50` | `200`, 3 posts, 0 carrying media |
| `GET /posts/user/{id}?postType=image&limit=50` | `200`, 3 posts, 0 carrying media |

All four returned an identical list of post ids.

Three of those requests asked for image posts and received three text posts.

### The part worth flagging

An unrecognised query parameter is accepted and ignored, and the response is a normal `200`.

From a client's position, "this filter is not supported" and "this filter matched everything" look exactly the same.

A client cannot detect the difference and will render an unfiltered list believing it is filtered.

This is worth knowing independently of whether the filter itself is ever added.

### What the frontend needs

A way to ask for a profile's posts restricted to those carrying media, with the same cursor pagination the existing endpoint uses, so the tab can page like every other list in the application.

The rows can be the same post shape already returned; nothing new is needed in the payload.

### What the user sees today

The `photos` tab shows: "photo-only posts aren't available yet."

## Request 2: the posts an account has liked

### What was observed

Four candidate addresses were probed with an authenticated regular account.

| Request | Response |
|---------|----------|
| `GET /api/v1/users/{userId}/liked-posts` | `404` |
| `GET /api/v1/users/me/liked-posts` | `404` |
| `GET /api/v1/posts/user/{userId}/liked` | `404` |
| `GET /api/v1/posts/liked` | `400`, `BAD_REQUEST` |

The `400` is not a sign that something exists at that address.

`/posts/liked` appears to be read as a request for a single post whose identifier is the word `liked`, which fails before reaching any handler.

The closest existing capability is `GET /api/v1/posts/{postId}/likes`, which returns the accounts that liked one post.

That is the opposite direction and cannot be composed into "the posts this account liked" without walking every post in the system.

### What the frontend needs

A way to ask for the posts a given account has liked, cursor-paginated like the others.

### The visibility question, which only you can answer

The frontend needs to know whether this list is retrievable only for the authenticated account, or for any account subject to the usual privacy and blocking rules.

The answer decides a product question we cannot decide alone: whether the `liked` tab appears on other people's profiles or only on the viewer's own.

If the list is only ever available for the authenticated account, the tab will be shown only on the viewer's own profile.

If it is available for others under the normal rules, the tab can stay where it is on every profile.

Right now the tab is equally unavailable everywhere, including the viewer's own profile, so no behaviour depends on the answer yet.

### What the user sees today

The `liked` tab shows: "liked posts aren't available yet."

## A third observation, offered as information only

This one is not a request and needs no action from anyone.

`GET /api/v1/posts/search` returns `200` with an empty page when its search backend is unavailable.

This was verified by stopping the Elasticsearch container and repeating a query that had just returned a result.

The response during the outage was byte-identical to a genuine no-match response apart from the timestamp.

There is no field, code, or status a client can use to tell the two apart.

The consequence is that the search screen cannot honestly tell a user "there are no posts matching this", because the same response also means "search is down".

The post half of the search results screen is therefore worded to cover both readings.

The user half is not affected, since it stayed available throughout the same outage.

We have adapted to this and are not asking for a change.

It is recorded here in case the ambiguity is unintentional.

## Verification details

Every observation above is reproducible.

The full requests and responses, including the account used and the exact commands, are in `endpoint-verification.md` in this directory.

Observed on 2026-08-12 against the backend running at `http://localhost:8080/api/v1`.
