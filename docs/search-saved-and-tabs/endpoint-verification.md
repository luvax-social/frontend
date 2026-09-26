# Endpoint Verification

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Written before any feature code, against the running backend.

Every request and response below was observed, not inferred from source.

## Environment

| Item | Value |
|------|-------|
| Backend | `http://localhost:8080/api/v1`, running |
| Frontend | `http://localhost:5173`, running |
| Date observed | 2026-08-12 |
| Account used | `luvax_ava`, a regular `USER` role account |
| Login identifier | `luvax_ava@example.com` |

The seed email domain is `example.com`.
An earlier attempt with `luvax.test` returned `401 AUTH_INVALID_CREDENTIALS`, so the domain is recorded here to save the next person the same detour.

Token acquisition, used for every request below:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"luvax_ava@example.com","password":"ReconPass123!"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
```

## Summary

| Capability | Endpoint | Exists | Usable as needed |
|------------|----------|--------|------------------|
| Post search | `GET /posts/search?q=` | Yes | Yes |
| User search | `GET /users/search?q=` | Yes | Yes |
| Hashtag search | `GET /hashtags/search?q=` | Yes | Yes |
| Saved posts | `GET /posts/saved` | Yes | Yes |
| Posts filtered by media type | none | **No** | **No** |
| Posts a user has liked | none | **No** | **No** |

The last two rows are the finding that governs the profile tabs.
Section 8 of the brief applies to both.

## Post search

### Request and response, matching

```
GET /api/v1/posts/search?q=light&limit=2
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[{
    "id":"4600d442-2d3d-4069-8368-7f282ad6f1bc",
    "author":{"id":"f70f7348-2a43-470e-a60d-c037cd4e6748","username":"luvax_ben",
              "displayName":"Luvax Ben","avatarUrl":null,"isVerified":false},
    "caption":"[luvax-seed] light is the medium, not the message #observation",
    "postType":"text","status":"published",
    "likeCount":1,"commentCount":13,"saveCount":0,
    "isLiked":false,"isSaved":false,"hasReported":true,
    "viewCount":0,"locationName":null,"latitude":null,"longitude":null,
    "media":[],
    "createdAt":"2026-08-12T04:59:54.094572Z","updatedAt":"2026-08-12T08:42:20.679496Z"}],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
              "startCursor":"MA","endCursor":"MQ"}},
  "timestamp":"2026-08-12T09:55:55.230526600Z"}
```

HTTP `200`.

Parameter names are `q`, `cursor`, and `limit`.
Items are full `PostResponse` objects, the same shape the feed and profile grids already consume.
Pagination is the standard `pageInfo` block with `hasNextPage` and `endCursor`, so the existing `getNextCursor` helper works unchanged.

Matching is stemmed rather than exact substring.
The term `light` matched the caption "light is the medium, not the message", and the reconnaissance audit separately observed `sunsets` matching "about sunsets".

### Request and response, no match

```
GET /api/v1/posts/search?q=zzzznotarealterm
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
              "startCursor":null,"endCursor":null}},
  "timestamp":"2026-08-12T09:55:55.293593300Z"}
```

HTTP `200`.

### Request and response, missing the query parameter

```
GET /api/v1/posts/search
```

```json
{"success":false,"code":"MISSING_REQUIRED_PARAMETER",
 "message":"A required request parameter is missing","data":null,
 "timestamp":"2026-08-12T09:55:55.357192800Z"}
```

HTTP `400`.

`q` is required.
The client must not issue the request with a blank term.

### Behaviour when the search backend is unavailable

The reconnaissance audit recorded that post search degrades to an empty page rather than erroring.
That was re-tested directly rather than taken on trust.

The search backend is Elasticsearch, running as container `backend-elasticsearch-1` on image `docker.elastic.co/elasticsearch/elasticsearch:9.0.3`.

Before the outage, `q=light` returned one post and HTTP `200`.

The container was then stopped:

```bash
docker stop backend-elasticsearch-1
```

During the outage:

```
GET /api/v1/posts/search?q=light
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
              "startCursor":null,"endCursor":null}},
  "timestamp":"2026-08-12T09:56:58.185958300Z"}
```

HTTP `200`.

**The behaviour is unchanged and the degradation is still silent.**

This response is byte-identical to the genuine no-match response recorded above, apart from the timestamp.
There is no field, no code, and no status difference a client could branch on.

As a control, `GET /users/search?q=luvax` returned `200` with results during the same outage, confirming that only the post half depends on Elasticsearch.

The container was restarted immediately.
Post search took roughly fifteen seconds to return results again while the index came back up, which is worth knowing because it means a restart produces a window in which search looks empty rather than broken.

```bash
docker start backend-elasticsearch-1
```

Verified recovered: `q=light` returns the post again.

**Consequence for the interface.**
A user cannot be told "there are no posts matching this" with confidence, because the same response means "search is down".
The post half of the search screen must use wording that covers both readings.
The people and tags halves do not share this problem and can state the empty case plainly.

## User search

### Request and response, matching

```
GET /api/v1/users/search?q=luvax&limit=2
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[
    {"user":{"id":"f70f7348-2a43-470e-a60d-c037cd4e6748","username":"luvax_ben",
             "displayName":"Luvax Ben","avatarUrl":null,"isVerified":false},
     "viewerState":{"isFollowing":true,"isFollowRequested":false,
                    "isFollowedBy":true,"isBlocking":false,"hasReported":true}},
    {"user":{"id":"e95da1cb-f900-4bd5-b2cb-cf9677014149","username":"luvax_dan",
             "displayName":"Luvax Dan","avatarUrl":null,"isVerified":false},
     "viewerState":{"isFollowing":true,"isFollowRequested":false,
                    "isFollowedBy":true,"isBlocking":false,"hasReported":true}}],
  "pageInfo":{"hasNextPage":true,"hasPreviousPage":false,
              "startCursor":"MA","endCursor":"Mg"}},
  "timestamp":"2026-08-12T09:56:07.318597900Z"}
```

HTTP `200`.

The item is a `UserListItemResponse`: the account nests under `user` and is not at the top level.
This is the same shape `FollowersScreen` already consumes through `getUserSummary(item, 'user')`.

**Each row carries its own `viewerState`.**
This is what allows a follow control on a result row to reflect the real relationship rather than always reading "follow".
`isFollowing` was `true` for both rows here, which is correct: Ava follows Ben and Dan in the seed graph.

`viewerState` also carries `hasReported`, which the contract documents did not previously record at this level.

Matching is on username substring.
Accounts in a block relationship with the viewer are excluded in both directions.

Note `hasNextPage` is `true` at `limit=2`, so the user half can be paged with the existing seed data without creating anything.

### Request and response, no match

```
GET /api/v1/users/search?q=zzzznotarealterm
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
              "startCursor":null,"endCursor":null}},
  "timestamp":"2026-08-12T09:56:07.363524200Z"}
```

HTTP `200`.

### Missing the query parameter

```
GET /api/v1/users/search
```

HTTP `400`.

`q` is required here too.

## Hashtag search

```
GET /api/v1/hashtags/search?q=obs
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[{"id":"53cba600-77b2-45e5-99d9-7199199b9819","name":"observation",
              "postCount":1,"createdAt":"2026-08-12T04:59:54.094Z"}],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
              "startCursor":"MA","endCursor":"MQ"}},
  "timestamp":"2026-08-12T09:56:07.490988600Z"}
```

HTTP `200`.

The endpoint exists and is cursor-paginated like the others.
Matching is a prefix or substring on the tag name: `obs` matched `observation`.

The id field is `id` here.
On `GET /hashtags/trending` the same concept is named `hashtagId`.
A shared row component across the two would need to account for that.

`postCount` is returned, which makes a result row informative on its own rather than just a name.

**Product decision: hashtags are included on the search screen.**
The reasoning and the rejected alternative are recorded in `design-decisions.md`.

## Saved posts

```
GET /api/v1/posts/saved?limit=2
```

```json
{"success":true,"code":"OK","message":"Operation completed successfully","data":{
  "content":[
    {"post":{"id":"d3c9d6b8-c045-4fe8-83e2-182c173e4899",
             "author":{"id":"f70f7348-2a43-470e-a60d-c037cd4e6748","username":"luvax_ben",
                       "displayName":"Luvax Ben","avatarUrl":null,"isVerified":false},
             "caption":"[luvax-seed] grain on film is the texture of memory #film",
             "postType":"text","status":"published",
             "likeCount":0,"commentCount":0,"saveCount":1,
             "isLiked":false,"isSaved":true,"hasReported":true,
             "viewCount":0,"locationName":null,"latitude":null,"longitude":null,
             "media":[],
             "createdAt":"2026-08-12T04:59:54.253682Z",
             "updatedAt":"2026-08-12T04:59:55.293528Z"},
     "savedAt":"2026-08-12T04:59:55.293528Z"},
    {"post":{"id":"d6db9033-492a-431a-9ccc-ce426d2e8f65", "...": "second row elided"},
     "savedAt":"..."}],
  "pageInfo":{"hasNextPage":false,"hasPreviousPage":false,
              "startCursor":"MA","endCursor":"MQ"}},
  "timestamp":"2026-08-12T09:56:07.6Z"}
```

HTTP `200`.

**The item is not a bare post.**
It is a wrapper: the post nests under `post` and the row adds `savedAt`.
This differs from the feed and from post search, both of which return `PostResponse` at the top level of the item.
A screen that reuses the profile grid must unwrap `row.post` rather than reading `row.id`.

The nested post carries `isSaved: true`, so a save control rendered from this list starts in the correct state without a second call.

Pagination is the standard `pageInfo` block.

## Posts filtered by media type, for the `photos` tab

**The capability does not exist.**

`GET /posts/user/{userId}` accepts `cursor` and `limit` only.

The failure mode here is the dangerous one, so it was tested rather than assumed: an unrecognised query parameter is silently ignored and the endpoint returns `200` with the full unfiltered set.
A client cannot tell that apart from a filter that matched everything.

Ben has three posts and none of them carry media, which makes the evidence unambiguous.

| Request | Result |
|---------|--------|
| `GET /posts/user/{ben}?limit=50` | 3 posts, 0 carrying media, ids `d3c9d6b8,d6db9033,4600d442` |
| `GET /posts/user/{ben}?mediaType=IMAGE&limit=50` | 3 posts, 0 carrying media, ids `d3c9d6b8,d6db9033,4600d442` |
| `GET /posts/user/{ben}?hasMedia=true&limit=50` | 3 posts, 0 carrying media, ids `d3c9d6b8,d6db9033,4600d442` |
| `GET /posts/user/{ben}?postType=image&limit=50` | 3 posts, 0 carrying media, ids `d3c9d6b8,d6db9033,4600d442` |

All four responses are HTTP `200` and return an identical id list.
Three of them asked for image posts only and received three text posts.

The parameter is not honoured under any of the three plausible names.

Corroborating source read, for completeness only.
`../backend/src/main/java/com/app/modules/post/controller/PostController.java:116-121` declares `listUserPosts` with `@RequestParam` for `cursor` and `limit` and nothing else.
A grep across all backend Java source for `mediaType` as a request parameter, `hasMedia`, and `onlyMedia` returned no matches.

## Posts the viewer has liked, for the `liked` tab

**The capability does not exist.**

Four candidate routes were probed:

| Route | HTTP |
|-------|------|
| `GET /users/{userId}/liked-posts` | `404` |
| `GET /users/me/liked-posts` | `404` |
| `GET /posts/user/{userId}/liked` | `404` |
| `GET /posts/liked` | `400` |

The `400` is not evidence of a route.
`/posts/liked` collides with the `/posts/{postId}` template, and `liked` fails to convert to a UUID, so the request is rejected before reaching a handler:

```json
{"success":false,"code":"BAD_REQUEST","message":"Invalid request","data":null,
 "timestamp":"2026-08-12T09:56:39.766324300Z"}
```

The related endpoint that does exist is `GET /posts/{postId}/likes`, which returns the users who liked one post.
That is the inverse relation and cannot be composed into a user's liked posts without fetching every post in the system.

Corroborating source read, for completeness only.
`../backend/src/main/java/com/app/common/ApiConstants.java` enumerates the entire route surface of the application.
No constant in it describes a liked-posts collection.
A grep across all backend Java source for `liked-posts`, `likedPosts`, and `/liked` returned no matches.

### Visibility question for the `liked` tab

The brief asks whether `liked` should appear on another person's profile or only the viewer's own, and says the backend's answer decides it.

The backend exposes no endpoint for either case.
The question is therefore not answerable yet and the tab is equally unavailable on every profile, including the viewer's own.

If the capability later arrives scoped to the authenticated user only, the tab must be hidden on other people's profiles at that point.
This is recorded in `backend-requests.md`.

## What this means for the build

| Surface | Decision |
|---------|----------|
| Post search | Build. Empty-state wording must cover the silent-degradation case |
| User search | Build. Follow control reads `viewerState.isFollowing` per row |
| Hashtag search | Build as a third result type |
| Saved posts | Build. Unwrap `row.post` |
| `photos` tab | Do not build. No server-side filter exists. Render a derived unavailable state and hand the gap to the backend team |
| `liked` tab | Do not build. No endpoint exists. Same treatment |

Filtering either tab client-side was considered and rejected.
A client-side media filter over one page of results produces a grid that is missing posts and paginates incorrectly, and the brief forbids presenting it as a server-backed feature.
