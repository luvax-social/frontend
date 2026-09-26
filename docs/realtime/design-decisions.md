# Design Decisions

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Decisions taken while building the live tier, with the reasoning and what was rejected.

Every treatment derived rather than specified is labelled as such.

## 1. SockJS is used because the server leaves no choice

**Decision.** Ship `sockjs-client` alongside `@stomp/stompjs`.

**Reasoning.** Not a preference. A raw WebSocket upgrade to `/ws/comments` is answered `400`, identically with and without a token, so the transport is refused before authentication is even reached. Only the SockJS transport path opens. Evidence in `realtime-contract.md` section 1.

**Rejected.** `@stomp/stompjs` pointed at a `ws://` URL, which is the lighter and more common setup. It cannot connect to this server.

**Consequence accepted.** `sockjs-client` is an older package and `npm install` reported vulnerabilities in its dependency tree. Recorded in `deferred-findings.md`; it is not addressed here because dependency remediation is not this phase.

## 2. One connection, opened against `/ws/comments`, carrying both topic families

**Decision.** A single shared client. The post topic is subscribed over the connection opened against the comment endpoint.

**Reasoning.** STOMP destinations are broker-wide rather than endpoint-scoped, which the backend states explicitly in `PostWebSocketConfig` and which the captures confirm: every frame in `realtime-contract.md`, comment and post alike, arrived over one connection.

**Rejected.** One connection per endpoint. It would double the sockets and the handshakes for no gain.

## 3. Reconnection is scheduled by hand, not by stompjs

**Decision.** `reconnectDelay: 0`, disabling the library's own reconnect, and an explicit timer with exponential backoff from 1 second, doubling, capped at 30 seconds. The client object is rebuilt on each attempt rather than reactivated.

**Reasoning.** Two defects were found by observation, not by reading.

The library's reconnect is a fixed delay with no backoff, and mutating `reconnectDelay` from inside `onWebSocketClose` does not change the retry it has already scheduled. Against a server with the live tier switched off, this produced a steady one-failed-handshake-per-second for as long as the screen stayed open.

The first fix, keeping the library's client and calling `activate()` on a timer, was worse: a stompjs client that still considers itself active ignores `activate()`, so it retried once and then stopped silently. A genuine drop would never have recovered.

Rebuilding the client per attempt fixes both. Measured gaps after the fix: 1, 2, 4, 8, 16 seconds, then capped at 30.

**Rejected.** Jitter on the backoff. It matters for a server facing many clients reconnecting at once; this is a single-user local build and the added non-determinism would have made the backoff harder to verify. Recorded as a deferred consideration rather than pretended to be unnecessary.

## 4. The token is read fresh on every attempt

**Decision.** The `webSocketFactory` reads the access token from the auth store each time it is called, rather than closing over the token that opened the previous socket.

**Reasoning.** The server closes a socket whose token has been revoked, with close code `1008`, within one 30 second sweep. A revoked or expired token is therefore the most likely reason the socket closed at all, and replaying it would be refused at the handshake, producing a permanently dead connection. Because `webSocketFactory` runs again on every attempt, and because `axiosClient` refreshes the access token into the same store on a REST `401`, a reconnect naturally picks up the refreshed token.

## 5. Teardown watches the token instead of being called from logout

**Decision.** `stompConnection` subscribes to the auth store and closes the connection when the access token goes from set to cleared.

**Reasoning.** The obvious wiring, calling `closeConnection()` from the store's `logout`, creates a circular import: the connection module imports the store. Watching the transition also covers session loss that does not go through the sign-out button, such as a failed refresh.

**Observed.** Sign-out in this build performs a full document load to the login page, which by itself destroys every socket the document held. The token watcher is therefore belt and braces rather than the only thing standing between a signed-out browser and a live socket. Stated because it changes what the verification proves; see `verification-evidence.md`.

## 6. Live comments are appended to the last page, never prepended

**Decision.** An arriving top-level comment is appended to the end of the last cached page.

**Reasoning.** Two constraints point the same way.

The first page opens with a pinned block the server selected. Prepending would insert a live arrival into that block, which the brief forbids and which would misrepresent a brand-new comment as a top comment.

Later pages are a keyset stream that assumes the pinned block was displayed separately, so re-sorting client side breaks pagination. Appending touches neither.

Appending also means nothing already on screen moves. A reader partway down the comments sees new content arrive below them, not existing content shift under them.

**Rejected.** An affordance such as "3 new comments, tap to show". It is the better pattern for a busy post, and it is what a high-traffic product would do. It was rejected here because the arrival already cannot displace anything the reader is looking at, so the affordance would add a control and a piece of state to solve a problem that appending has already solved. Recorded in `deferred-findings.md` as the right change if comment volume ever makes the list move quickly.

## 7. The viewer's own like state is never taken from a broadcast

**Decision.** On `comment.edited.v1`, only `content`, `editedAt` and `updatedAt` are copied out of the frame. `isLiked`, `hasReported`, `pinned` and `likeCount` are left exactly as the cache holds them.

**Reasoning.** `CommentBroadcastResponse` omits the per-viewer fields deliberately, and omits them rather than sending a placeholder precisely so a client sees the key as absent. Spreading the incoming object over the cached one would write `undefined` into `isLiked` and silently un-like a comment the viewer had liked. The same trap already exists on the REST path, where a single-comment response always reports `pinned` as false, and the existing edit mutation guards against it for that reason.

**Verified.** A remote like arrived on a comment the viewer had liked; the count moved and the viewer's own state did not.

## 8. Comment like counts are moved by one, and the viewer's own echo is suppressed

**Decision.** On `comment.liked.v1` and `comment.unliked.v1`, adjust `likeCount` by plus or minus one, and skip the frame if it is the echo of an action this viewer just performed.

**Reasoning.** This is forced by the payload. Those two frames carry no count, no delta and no liker identity, so the client has to derive the movement from the event name alone. The captures confirm the viewer receives the echo of their own like, and the existing like mutation already applies an optimistic plus one without invalidating. Applying the echo as well would count every self-like twice.

Suppression is a small registry keyed by comment id and event type, recorded in the mutation's `onMutate` and consumed by the first matching frame. Entries expire after 10 seconds so a dropped frame cannot suppress a later, genuinely remote event forever.

**Rejected.** Refetching the comment list on a like event. It would produce a correct count and would re-run the server's pinned selection, reordering comments under the reader, which is the exact failure the existing mutation avoids by not invalidating.

**Rejected.** Leaving the count untouched. Honest, and it drops a feature the brief asks for.

**Known limit, stated rather than hidden.** The suppression is heuristic. Two viewers liking the same comment within the same tick could in principle have one movement swallowed. The count is corrected by any later refetch of the list. This is recorded because the alternative, a count the server never confirms, is exactly the kind of quiet wrongness this project has been avoiding.

## 9. Post like counts are assigned, not added, and yield to the viewer's own tap

**Decision.** Assign the frame's `likeCount` directly. Never touch `isLiked`. Skip frames for a post whose like mutation is currently in flight.

**Reasoning.** The count is absolute by deliberate backend design: a dropped or reordered delta is unrecoverable, an absolute count self-heals on the next event. Assignment is therefore both correct and self-correcting, and no echo suppression is needed, which is why the post path is simpler than the comment path.

The one case where assignment fights the viewer is the moment their own tap is in flight. The server's count may not include it yet, so applying an arriving frame would visibly undo the tap before the mutation settled. Marking the post in flight for the duration of the mutation avoids that, and the absolute count corrects anything missed on the next frame or refetch.

`isLiked` is untouched for the same reason as decision 7: the frame is shared by every subscriber and says nothing about this viewer.

## 10. The deletion count is used instead of a refetch

**Decision.** Remove the named comment from the cache, drop its replies query, and decrement the post's comment count by `deletedCommentCount`.

**Reasoning.** The brief asks for the reasoning either way, so: using it is correct here. Deleting a comment soft-deletes its replies, and the frame reports how many rows went in total but not which ones. Removing the named comment and discarding its replies cache reproduces the visible effect exactly, because the replies were only ever displayed nested under the comment that is now gone.

A refetch would buy nothing that the count does not already give, and would cost the thing this design has protected throughout: refetching the first page re-runs the server's pinned selection and can reorder comments under a reader mid-read.

**Known limit.** If a descendant of the deleted comment happened to be cached somewhere other than under its parent, it would not be removed. No such path exists today, because replies are only fetched keyed by their parent.

## 11. Connection state is not shown to the viewer

**Decision.** No indicator, no toast, no error text. Every failure path in the connection module is silent and non-throwing.

**Reasoning.** The brief asks for this directly, and the degradation requirement makes it necessary: if the socket never connects, the post detail screen must behave exactly as it does today, and a permanently visible "disconnected" badge would be a visible change. Live updates are additive, so their absence is the pre-existing behaviour rather than a fault worth narrating.

**Derived treatment, labelled as such.** The design export defines nothing for a live or degraded connection state, so the treatment chosen is the absence of one. This is a derivation from the existing tokens in the weakest sense, in that it adds no new visual vocabulary at all.

**Consequence accepted.** A failed handshake still prints a browser network error to the console, which no application code can suppress. That is developer-visible, not viewer-visible. Backoff keeps it to six lines in the first thirty seconds rather than thirty.

## 12. Only the open post subscribes

**Decision.** `useLivePostUpdates` is called from `PostDetailScreen` and nowhere else.

**Reasoning.** The brief scopes it there. Verified rather than assumed: with the tracker installed, the feed and the profile opened zero sockets, and a socket appeared only when a post was opened.
