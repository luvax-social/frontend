# Changes Applied

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change: what was wrong or missing, the evidence, what changed, and the file.

## 1. Explore left a strip of blank space where the topic chips had been

**What was wrong.** The hardcoded topic chips were removed in the previous phase, but the flex row that had held them was left in place, still carrying `padding: '12px 16px'`. An empty container with vertical padding still reserves its own height, so the screen rendered a band of dead space between the search field and the `trending today` label.

**Evidence.** Screenshot of `/app/explore` before the change, showing the gap. This is the stranding that gap 3.5 existed to find, and it was found only by opening the screen.

**What changed.** The empty container was removed. The comment explaining why the chips were removed is preserved above the block, extended to record that the row went with them.

**File.** `src/features/luvax/components/ExploreScreen.jsx`

## 2. The composer's hashtags label reserved space for chips that can no longer appear

**What was wrong.** The same pattern in a milder form. The suggested tag chips were removed and the `hashtags` label kept the `marginBottom: 8` that had separated it from them, leaving the label floating above empty space.

**Evidence.** Screenshot of `/app/compose`, showing the label with a gap beneath it and nothing following.

**What changed.** The bottom margin was dropped. The label itself was kept, because it is not a leftover: it reports a live count of tags typed into the caption.

**File.** `src/features/luvax/components/ComposerScreen.jsx`

## 3. There was no realtime client at all

**What was missing.** The backend has had a working STOMP transport with comment events, and more recently post like events, with all three live flags enabled in the dev profile. The frontend had no WebSocket client of any kind.

**Evidence.** `docs/realtime/realtime-contract.md`, built from frames captured off the running server.

**What changed.** A shared, reference-counted STOMP connection. One socket for the whole application, opened when the first subscriber arrives and closed when the last leaves. Reconnection with exponential backoff. The access token is read fresh on each attempt. The connection is torn down when the session ends.

**File.** `src/services/realtime/stompConnection.js` (new)

## 4. Live events had nowhere to land

**What was missing.** Nothing consumed the events.

**What changed.** A hook that applies comment created, edited, deleted, liked and unliked events, and post liked and unliked events, to the TanStack Query cache. The correctness rules it enforces are set out in `design-decisions.md` sections 6 to 10: append rather than prepend so the pinned block is never disturbed, never take per-viewer state from a broadcast, suppress the echo of the viewer's own comment like, assign the absolute post like count, and use the deletion count instead of refetching.

**File.** `src/features/luvax/hooks/useLivePostUpdates.js` (new)

## 5. The viewer's own comment like would have been counted twice

**What was wrong.** `comment.liked.v1` and `comment.unliked.v1` carry no count, so the live handler has to move the count by one itself. The captures show the viewer receives the echo of their own like, and the existing like mutation already applies an optimistic plus one. Left alone, every self-like would have counted twice.

**Evidence.** Captured frames in `realtime-contract.md` section 4, showing no `likeCount` and no liker identity. Confirmed in the browser: after the fix, the viewer's own like left the count at 1, not 2.

**What changed.** The comment like mutation records the action before it fires, and the live handler consumes that record to skip the matching echo. The post like mutation marks the post in flight for its duration, so an arriving absolute count cannot undo the viewer's tap mid-request.

**File.** `src/features/luvax/hooks/usePosts.js`

## 6. The open post did not subscribe

**What changed.** `PostDetailScreen` calls `useLivePostUpdates(postId)`. Nothing else subscribes: not the feed, not notifications, not the profile.

**File.** `src/features/luvax/components/PostDetailScreen.jsx`

## 7. sockjs-client could not load in the browser at all

**What was wrong.** `sockjs-client` is written for a CommonJS environment and dereferences the Node `global` object at module scope. Under Vite that threw `ReferenceError: global is not defined` before any connection was attempted.

**Evidence.** Console error on first load of the post detail screen, with the stack pointing into the SockJS bundle.

**What changed.** `define: { global: 'globalThis' }` in the Vite config. This is not cosmetic: SockJS is mandatory because the backend refuses a raw WebSocket upgrade, so without this the live tier could not load.

**File.** `vite.config.js`

## 8. The reconnect loop did not back off, and then did not reconnect

**What was wrong.** Two defects in this phase's own code, both found by running the degradation exercise rather than by reading.

First, retries ran at a fixed one-second interval. `@stomp/stompjs` uses a fixed `reconnectDelay`, and mutating it from inside `onWebSocketClose` does not change the retry already scheduled. Against a server with the live tier disabled this produced fourteen failed handshakes in fourteen seconds.

Second, the initial fix, reusing the client and calling `activate()` on a backoff timer, retried exactly once and then stopped. A stompjs client that still considers itself active ignores `activate()`, so a genuine drop would never have recovered.

**Evidence.** Request timestamps from `performance.getEntriesByType('resource')`. Before: fourteen attempts, ~1.01 second apart. After the first fix: one attempt in thirty seconds. After the second fix: gaps of 1, 2, 4, 8, 16 seconds, then capped at 30.

**What changed.** The library's reconnect is disabled and reconnection is scheduled explicitly, rebuilding the client on each attempt. Recovery was then confirmed end to end: a page left open through a full backend restart reconnected on its own and delivered a comment, with no reload.

**File.** `src/services/realtime/stompConnection.js`

## 9. Dependencies added

`@stomp/stompjs` and `sockjs-client`.

**File.** `package.json`, `package-lock.json`
