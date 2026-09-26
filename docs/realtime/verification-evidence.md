# Verification Evidence

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Evidence for the realtime behaviour, separated by how it was obtained.

Anything not verified is listed as not verified.

The section 3 verification-gap exercises are in `verification-gaps-closed.md` and are not repeated here.

## Environment

| | |
|---|---|
| Backend | `http://localhost:8080`, commit `42f6147` |
| Frontend | `http://localhost:5173`, Vite 8.0.13 |
| Browser | Chromium via Playwright, dev tools attached throughout |
| Accounts | `luvax_ava` as the viewer, `luvax_ben` and `luvax_dan` as the other parties |
| Live flags | `app.comment.live.enabled` and `app.post.live.enabled`, toggled off and on again during the degradation test |

## Verified in the browser

### A comment created elsewhere arrives without a refresh

Ava had the post open and idle. Ben created a comment through the API.
The comment appeared in Ava's list. No reload, no refetch triggered by hand.

```
comment create status 201  ->  "LIVE ARRIVAL no refresh" present in the DOM
```

### Every event type propagates

| Event | Trigger | Observed in Ava's browser |
|-------|---------|---------------------------|
| comment created | Ben posts | Row appears, appended below the existing comments |
| comment edited | Ben edits | Body changes in place, old text gone |
| comment deleted | Ben deletes | Row disappears |
| comment liked | Dan likes | Count moves 1 to 2 |
| post liked | Ben likes | Post like control moves 0 to 1 |

### The viewer's own like state survives an arriving event

This is the case the broadcast shape makes easy to get wrong, so it was tested directly.

1. Ava liked a comment in the browser. The control changed to `unlike comment` and the count read **1**.
   It read 1 and not 2, which is the echo-suppression working: without it Ava's own like would have been counted once optimistically and once again on arrival.
2. Dan then liked the same comment from another session.
3. Ava's view: count moved to **2**, and the control still read `unlike comment`.

So a remote event moved the count and did not reset the viewer's own state.

### A comment the viewer wrote does not appear twice

Ava submitted a comment through the composer. It reaches the cache by two routes at once, the invalidation refetch that the create mutation triggers and the live broadcast of the same comment.

Occurrences of the comment's unique token in the DOM: **1**.

### The pinned block does not reorder

A comment was pushed into the pinned block by liking it from three accounts, giving it 3 likes against 0 for everything else, and confirmed as `pinned: true` on page 1 of the API response.

Order before the live events:

```
TOP COMMENT / Luvax Ben
Luvax Ben / should arrive after unblock
Luvax Ben / unlike probe
Luvax Ben / should arrive after unblock
Luvax Ben / should be withheld from ava
Luvax Ben / unlike probe
```

A new comment then arrived live, and a non-pinned comment was liked remotely. Order after:

```
TOP COMMENT / Luvax Ben          <- still first
Luvax Ben / should arrive after unblock
Luvax Ben / unlike probe
Luvax Ben / should arrive after unblock
Luvax Ben / should be withheld from ava
Luvax Ben / unlike probe
Luvax Ben / PINNED TEST arrival zzz9   <- appended at the end
```

The pinned comment stayed first, nothing already on screen moved, and the arrival landed at the end rather than inside the pinned block.

### Only the open post subscribes

With a socket tracker installed before any subscription, the feed and the profile screens opened **zero** sockets. A socket appeared only when a post was opened.

Note the tracker only sees sockets constructed through `window.WebSocket` after it is installed; SockJS captures its own reference at import time. This observation is therefore reliable for "no socket was opened by these screens" and was not used for anything else.

### With the connection prevented entirely, nothing is broken

The live tier was switched off on the server by restarting the backend with `--app.comment.live.enabled=false --app.post.live.enabled=false`. No backend file was modified. Both endpoints then answered `404`:

```
/ws/comments/info  ->  404
/ws/posts/info     ->  404
```

With the socket unable to connect at all, the post detail screen was opened and checked:

| | |
|---|---|
| Comments rendered | 7 |
| Pinned block present | yes |
| Comment composer present | yes |
| React render errors | 0 |

Everything the screen does without live updates, it still does.

### The reconnect backs off

Measured from `performance.getEntriesByType('resource')` while the live tier was disabled.

Before the fix, a fixed retry:

```
14 handshake attempts in 14 seconds, gaps of ~1.01s
```

After the fix:

```
6 attempts in 32 seconds, gaps of 1, 2, 4, 8, 16 seconds, then capped at 30
```

### The connection recovers on its own

The page was left open on the post detail screen through a full backend restart, backing off while the server was down. When the backend came back the client reconnected with no reload and no user action, and a comment created afterwards was delivered:

```
comment after backend restart -> 201
reconnectedAndDelivered: true
```

### Signing out leaves no connection

After signing out, with the page settled on the login screen:

```
wsRequestsSinceSignOut: 0
onLoginPage: true
```

**What this does and does not prove.** Sign-out in this build performs a full document load to `/login`, which by itself destroys every socket the previous document held. So the observation confirms that a signed-out browser holds no live socket, which is the requirement, but it does not isolate the token-watching teardown in `stompConnection` as the mechanism that achieved it. Both are in place; only the outcome was observed.

### Console

Zero React render errors on every surface touched: post detail, explore, composer, onboarding, profile, saved, blocked list, search.

Errors that do appear, and what they are:

- Failed SockJS handshakes while the live tier was deliberately disabled. Browser-level network errors that no application code can suppress. Developer-visible only.
- Blocked-profile `404`s and the global query error handler logging them, during the block exercise. Pre-existing and already recorded as deferred.

## Verified against the API, not in the browser

Captured with a Node client speaking SockJS and STOMP directly. Real observations, but not browser-level evidence.

- The full frame set for all seven event types, field by field. `realtime-contract.md` section 4.
- SockJS is mandatory: a raw WebSocket upgrade is refused `400` with and without a token, while the SockJS transport path opens.
- Connecting with no token and with a malformed token: both refused before STOMP is reached.
- A revoked token closes a live socket with code `1008`, roughly 30 seconds after logout, matching the sweep interval.
- Block filtering is applied per subscriber at delivery time. A viewer who stayed subscribed throughout received a comment made before the block and did not receive one made after it, on a third party's post so the blocked account could still write.
- That a blocked account cannot comment at all on a post owned by the viewer, `403`, which is why the block test needed third-party content.

## Not verified

Stated plainly rather than implied.

1. **Natural access-token expiry mid-connection.** The revocation path was exercised by logging out, which blacklists the token and produced the `1008` close. A token left to expire on its own over its full 900-second lifetime was not waited out. The server uses the same resolver for both, so the same close is expected, but expected is not observed.

2. **The token-watching teardown was not isolated.** See the sign-out entry above. The outcome is verified; the mechanism is not separated from the full page load that also achieves it.

3. **Two genuinely separate browsers were not used.** Propagation was verified between one browser and API calls made as other accounts, which exercises the same server-side fanout path. A second browser profile rendering the same post simultaneously was not opened.

4. **The echo-suppression race was not forced.** Two viewers liking the same comment within the same tick could in principle have one movement swallowed, as recorded in `design-decisions.md` section 8. This was reasoned, not reproduced.

5. **Reply-thread live updates were only partly exercised.** A reply arriving while its parent thread was expanded updates the cached replies query; that path was implemented and reviewed but the browser check was done on top-level comments. The reply count bump on the parent was not observed in the browser.

6. **Multi-instance fanout.** One backend instance was running throughout.

7. **Long-lived connection behaviour.** The longest connection held during testing was a few minutes. Idle timeouts and heartbeat behaviour over hours were not measured.

8. **Notifications live tier.** Enabled on the server, out of scope by the brief, never subscribed to, no frame captured.
