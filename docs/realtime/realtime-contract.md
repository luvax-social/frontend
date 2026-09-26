# Realtime Contract

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything here was observed against the running server at `localhost:8080`, backend commit `42f6147`.

Frames were captured with a Node client speaking SockJS and STOMP directly, so what appears below is what the server actually sent, not a description of what it should send.

No topic is described that a message was not received on.

## 1. Transport

### SockJS is required, not optional

Both endpoints are registered with `.withSockJS()`.
A raw WebSocket upgrade is refused.

| Attempt | Result |
|---------|--------|
| `GET /ws/comments` with no upgrade headers | `200` (the SockJS greeting) |
| Raw WebSocket upgrade to `/ws/comments?token=<valid>` | `400`, connection closed before established |
| Raw WebSocket upgrade to `/ws/posts?token=<valid>` | `400`, connection closed before established |
| SockJS transport `/ws/comments/{server}/{session}/websocket?token=<valid>` | Opens |

The raw upgrade returns `400` rather than `401`, and returns it identically with and without a token.
The transport is rejected before the authentication interceptor is reached.

**Consequence for the client:** a SockJS client is mandatory. `@stomp/stompjs` alone, pointed at a `ws://` URL, cannot connect to this server.

### Endpoints

| Endpoint | Enabled by |
|----------|-----------|
| `/ws/comments` | `app.comment.live.enabled` |
| `/ws/posts` | `app.post.live.enabled` |
| `/ws/notifications` | `app.notification.live.enabled` |

All three are `true` in the dev profile.

`GET /ws/comments/info` returns:

```json
{"entropy":-1546801819,"origins":["*:*"],"cookie_needed":true,"websocket":true}
```

### One connection serves both topic families

STOMP destinations are broker-wide rather than endpoint-scoped.
A client connected to `/ws/comments` may subscribe to `/topic/posts.{postId}.events` over that same connection.
This is stated in `PostWebSocketConfig`'s class comment and is what the captures below rely on: every frame in this document arrived over a single connection opened against `/ws/comments`.

**Consequence for the client:** one socket, not one per topic family.

## 2. Authentication

The access token travels as a `token` **query parameter** on the handshake URL.
Browsers cannot set an `Authorization` header on a WebSocket upgrade, so there is no header form.

```
ws://localhost:8080/ws/comments/000/{session}/websocket?token=<accessToken>
```

Observed outcomes:

| Credential | Result |
|------------|--------|
| Valid access token | `CONNECTED` frame received |
| No `token` parameter | Connection refused, never reaches STOMP |
| Malformed token | Connection refused, never reaches STOMP |

The handshake applies the same signature, expiry, blacklist, and account-status checks as the REST path.

The `CONNECTED` frame as received:

```
CONNECTED
version:1.2
heart-beat:0,0
```

Note the server advertises `heart-beat:0,0` even when the client offers `10000,10000`.
The server does not send STOMP-level heartbeats. SockJS sends its own `h` frames.

### A revoked token closes the socket, after a delay

`WebSocketRevocationSweepService` re-validates every live session on a schedule, `app.websocket.revocation.interval`, default `PT30S`, and closes any session whose token no longer resolves.

Observed by opening a socket, calling `POST /auth/logout` to blacklist the token's `jti`, and waiting:

```
logout status 204
[dan-temp] SOCKJS CLOSE FRAME [1008,""]
[dan-temp] WS CLOSED code=1008 reason=(none)
```

The close arrived roughly 30 seconds after logout, consistent with the sweep interval.

**Consequences for the client.**
The connection is not closed at the instant a token expires or is revoked; it survives up to one sweep interval.
The close code is `1008`, and a client that blindly reconnects with the same dead token will be refused at the handshake.
Reconnection must therefore obtain a current access token rather than replaying the one the dead socket used.

## 3. Topics

Two topics matter for this phase. A message was received on each.

| Topic | Carries |
|-------|---------|
| `/topic/comments.{postId}.events` | `comment.created.v1`, `comment.edited.v1`, `comment.deleted.v1`, `comment.liked.v1`, `comment.unliked.v1` |
| `/topic/posts.{postId}.events` | `post.live.liked.v1`, `post.live.unliked.v1` |

`{postId}` is the plain post UUID.

Every frame body has the same envelope:

```json
{ "data": { ... }, "eventType": "<name>" }
```

## 4. Payloads, field by field

### The embedded comment object

`comment.created.v1` and `comment.edited.v1` nest a comment under `data.comment` with exactly these fields:

`id`, `depth`, `author{id, username, avatarUrl, isVerified, displayName}`, `postId`, `rootId`, `content`, `editedAt`, `parentId`, `createdAt`, `likeCount`, `updatedAt`, `replyCount`.

**Deliberately absent, confirmed against `CommentBroadcastResponse`:**

| Field | Why it is absent |
|-------|------------------|
| `isLiked` | Per-viewer. One serialised blob is shared by every subscriber, so it cannot be resolved for the frame |
| `hasReported` | Per-viewer, same reason |
| `pinned` | Describes a comment's position on a requested page, and a broadcast frame belongs to no page |

The key is omitted entirely rather than carrying a placeholder, so a client sees the key absent instead of a value that looks correct and is not.

### comment.created.v1

Captured, top-level comment:

```json
{"data":{"depth":0,"postId":"fa10f2b2-08c7-417b-988c-800a83da7514","userId":"f70f7348-2a43-470e-a60d-c037cd4e6748","comment":{"id":"28ff800c-d41e-465b-aafe-d4d63d426bf7","depth":0,"author":{"id":"f70f7348-2a43-470e-a60d-c037cd4e6748","username":"luvax_ben","avatarUrl":null,"isVerified":false,"displayName":"Luvax Ben"},"postId":"fa10f2b2-08c7-417b-988c-800a83da7514","rootId":null,"content":"live probe comment","editedAt":null,"parentId":null,"createdAt":"2026-08-13T04:27:21.641985Z","likeCount":0,"updatedAt":"2026-08-13T04:27:21.641985Z","replyCount":0},"commentId":"28ff800c-d41e-465b-aafe-d4d63d426bf7","postOwnerId":"556c0a7a-5b64-46e6-bc49-bd062307867f","commentOwnerId":"f70f7348-2a43-470e-a60d-c037cd4e6748","mentionedUserIds":[]},"eventType":"comment.created.v1"}
```

A reply carries three additional keys, captured separately: `rootId`, `parentId`, and `parentOwnerId`, with `depth: 1`.

### comment.edited.v1

```json
{"data":{"depth":0,"postId":"fa10f2b2-...","comment":{"id":"28ff800c-...","content":"live probe comment edited","editedAt":"2026-08-13T04:27:20.026082Z","createdAt":"2026-08-13T04:27:21.641985Z","likeCount":0,"updatedAt":"2026-08-13T04:27:23.996567Z","replyCount":0,"...":"..."},"commentId":"28ff800c-...","commentOwnerId":"f70f7348-..."},"eventType":"comment.edited.v1"}
```

`editedAt` becomes non-null. `updatedAt` also moves, but `updatedAt` moves for counter changes too, so an edited marker must come from `editedAt`.

### comment.deleted.v1

```json
{"data":{"postId":"fa10f2b2-...","commentId":"28ff800c-...","commentOwnerId":"f70f7348-...","deletedCommentCount":1},"eventType":"comment.deleted.v1"}
```

`deletedCommentCount` is the size of the removed subtree, since deleting a comment soft-deletes its replies.
It is a count, not a list of ids. The frame does not say **which** descendants went.

### comment.liked.v1 and comment.unliked.v1

```json
{"data":{"postId":"fa10f2b2-...","commentId":"3e4e532e-...","commentOwnerId":"f70f7348-..."},"eventType":"comment.liked.v1"}
{"data":{"postId":"fa10f2b2-...","commentId":"3e4e532e-...","commentOwnerId":"f70f7348-..."},"eventType":"comment.unliked.v1"}
```

**These frames carry no count.**
There is no `likeCount` and no delta. The two event types are distinguished only by their name.
The identity of the liker is not carried either, so a subscriber cannot tell whether a given like was its own.

This is the single most consequential fact in this document for the client design, and `design-decisions.md` records what was done about it.

### post.live.liked.v1 and post.live.unliked.v1

```json
{"data":{"likeCount":1,"postId":"fa10f2b2-..."},"eventType":"post.live.liked.v1"}
{"data":{"likeCount":0,"postId":"fa10f2b2-..."},"eventType":"post.live.unliked.v1"}
```

**The count is absolute, not a delta.**
This is deliberate and documented in `PostLiveFanoutConsumer`: a dropped or reordered delta is unrecoverable, whereas an absolute count self-heals on the next event.

The count is read at push time rather than captured when the event was enqueued, because the outbox publisher runs after the liking transaction commits and a captured count would already be stale.

Like the comment like events, the frame does not identify the liker.

## 5. Block filtering is applied per subscriber, at delivery time

This was the open question, and the answer is observed rather than reasoned.

The test used a third party's post so the blocked account could still write, and the viewer never resubscribed:

```
third-party post (dan): 8a1ec69f-46c5-45c9-9aee-f6ac92d18ebe
control: ben comments on dan post BEFORE any block   -> 201
  ava received: comment.created.v1 "before block"
ava blocks ben (ava stays subscribed throughout)     -> 201
ben comments on dan post AFTER the block             -> 201
  frames ava received after the block: 0
```

Ava held one subscription across the whole sequence.
She received the comment made before the block and did not receive the one made after it.

So the filter is enforced on the outbound channel per recipient session, not at subscription time.
A viewer who was already connected when a block happened is covered.

**Consequence for the client:** none. There is nothing to implement. The client does not need to re-subscribe after a block, and must not attempt to filter blocked authors itself.

A related limit worth recording: on a post owned by the viewer, a blocked account cannot comment at all, `403`. The filtering above only becomes observable on third-party content.

## 6. What this contract does not cover

Stated plainly rather than implied.

- **Natural access-token expiry mid-connection was not observed.** The revocation path was exercised by logout, which blacklists the token and produced the `1008` close. A token left to expire on its own for the full 900-second TTL was not waited out. The sweep uses the same resolver for both cases, so the same close is expected, but expected is not observed.
- **`/ws/notifications` was not subscribed to.** It is enabled on the server and out of scope by section 5.1 of the brief, so no frame was captured and no topic is described.
- **Multi-instance fanout was not exercised.** One backend instance was running. The per-instance queue naming implies a fanout design, but nothing here tests it.
- **Heartbeat and idle-timeout behaviour was not measured.** Connections were held for under a minute in most captures.
