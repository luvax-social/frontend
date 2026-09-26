# Deferred Findings

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Found during this phase, deliberately not acted on, with where each belongs.

## Found while routing

### Stories are not backed by the API

`StoryViewScreen` and the feed carousel read `STORIES` from `constants/data.js`, a fixed array of seven entries with client-side ids such as `s1` and `s2`.
There is no story fetch anywhere in the frontend, although the backend has a story module.

`/app/stories/:storyId` therefore resolves against that array, not against the server.
That is the honest option available: routing it by a server id would mean inventing an identifier the current data flow does not carry, which section 2.5 of the brief rules out.
An unknown id falls back to the placeholder the screen already used.

The address shape will not need to change when stories become real; only what it resolves against.

**Belongs to:** the phase that builds out stories.

### The messages module cannot link to a real profile

Its threads come from `data/mockThreads.js`, whose ids are strings like `priya`.
The conversation info panel's "view profile" button now navigates to `/app/u/priya`, which the backend answers with `400` and the profile screen renders as its error state.

The control behaved no better before: it set a screen parameter carrying a mock user object, so it displayed a profile that never existed.
Routing has made the gap visible rather than created it.

**Belongs to:** the phase that builds out messages.

### `posts/search` is called with a placeholder query

Loading `/app/explore` with no search issues `GET /api/v1/posts/search?q=a&limit=10`.
The literal `a` is a stand-in for "show me something", not a user's query.

Out of scope here and untouched, but the explore grid is not currently browsing anything, it is searching for the letter `a`.

**Belongs to:** the phase that builds the search and explore experience.

### Scroll position is not restored inside paginated lists

`<ScrollRestoration />` restores the document scroller, so back returns to the previous offset and a new address starts at the top.

It does not restore position within the feed, explore, or profile lists once they have loaded several pages.
Those lists remount on a route change and refill from the TanStack Query cache, with `useInView` driving further pages, so the restored document offset can land past the content that has been rendered so far.

Doing this properly means virtualising the lists and lifting their pagination state above the route, which changes how the lists are built rather than how the router works.
It is not attempted here rather than half-implemented, as the brief asks.

**Belongs to:** a list-virtualisation phase, or whichever phase reworks the feed.

### A readable profile address is available but unused

`GET /users/by-username/{username}` was verified working: `200` for `luvax_ben`, `404` for an unknown handle.

The route uses the id, for the reasons set out in `route-table.md`.
A `/app/u/@username` alias resolving to the canonical id address can be added later without revisiting the route table.

**Belongs to:** whichever phase decides that shared links should be human-readable.

### The right rail's trending list is hardcoded

`LxRightRail` renders six fixed strings and its items are styled as clickable but have no handler, so there is nothing for a hashtag route to point at.
No hashtag address was reserved, because there is no screen and no data behind one.

**Belongs to:** the phase that builds hashtags.

### `LxRightRail` is passed a `navigate` prop it does not accept

`LxShell` passes `navigate` to `LxRightRail` in all three viewport branches; the component's signature takes only `compact`.
Pre-existing and harmless.
Left alone because removing it is unrelated to routing.

**Belongs to:** any later tidy-up of the shell.

### `LxAppBar` has a permanently dead branch

`const mobileMsgBack = screen === 'messages' && viewport === 'mobile' && false` can never be true, so the mobile back header for messages is unreachable.
Pre-existing, and clearly a deliberate switch-off rather than an accident.
Left as found.

**Belongs to:** the design conformance phase.

### The dashboard route is an orphan

`/dashboard` renders a stub that nothing links to and that predates the Luvax shell.
It is still routed and still guarded, and was left exactly as it was.

**Belongs to:** whichever phase decides whether it should exist.

## Found while verifying the cookie

### `POST /auth/logout` returning `401` unauthenticated is easy to misread

The controller's Javadoc says logout is "Idempotent, including when neither the body nor the cookie carries a token", which describes the handler.
It does not mention that the endpoint is behind authentication, so a client that never attaches a bearer token never reaches that handler at all.

The frontend has been fixed.
The backend is correct as designed and was not touched; the note is only that the documentation reads as though the endpoint were public.

**Belongs to:** a backend documentation pass, if anyone wants it.

### The refresh cookie's `Path` scopes it to `/api/v1/auth`

Correct and deliberate, and it works in development because Vite proxies `/api/v1` so the browser sees one origin.

Worth stating for deployment: the cookie is only sent to paths under `/api/v1/auth`.
A production topology that serves the API from a different registrable domain needs `SameSite=None` with `Secure`, which the backend already refuses to start without.

**Belongs to:** the deployment phase.

### `VITE_AUTH_WITH_CREDENTIALS` is now unused

The constant it fed is unconditional, so the variable does nothing.
It was never declared in `.env` or `.env.example`, so there is nothing to remove there.

**Belongs to:** nowhere; recorded so nobody reintroduces it as a switch.

## Explicitly out of scope, untouched

Listed in the brief and confirmed not acted on:

- the design system port and pixel-perfect work
- whether post detail should be a modal; only the route shape was decided
- comment like, edit, and delete
- report
- the search results screen itself
- the saved posts list
- the `pinned` comment flag
- realtime and the WebSocket client
- building out stories, messages, and onboarding
- disabling out-of-scope navigation tabs
- lint, including formatting and any counts
- `comment.isLiked`
