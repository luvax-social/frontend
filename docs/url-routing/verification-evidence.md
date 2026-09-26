# Verification Evidence

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Both applications running: backend on 8080 against the docker-compose stack, frontend on 5173, signed in as `luvax_ava`, seeded with `tools/seed/seed.py`.
Driven in Chromium with the dev tools console captured.

The four checks, per the brief:

1. Reach it through the user interface and confirm the address updates.
2. Open the address cold in a fresh load and confirm the screen renders.
3. Press back and confirm it returns to the previous screen rather than leaving the application.
4. Hard-refresh and confirm the screen and its parameters survive.

Checks 2, 3, and 4 were run against all twenty-two addresses in one automated sweep, each preceded by a visit to `/app/notifications` so that back had a known previous screen.
Check 1 was run by clicking the actual control, and the control used is named per row.

## Results

| Address | 1. reached by | 2. cold load renders | 3. back | 4. hard refresh |
|---------|---------------|----------------------|---------|-----------------|
| `/app` | home tab | feed with stories and posts | `/app/notifications` | same address |
| `/app/explore` | explore tab | topic chips and explore grid | `/app/notifications` | same address |
| `/app/explore?q=film` | header search field, submitted | `results for "film" / 2 found` | `/app/notifications` | same address, query kept |
| `/app/compose` | post tab | composer with type picker and hashtags | `/app/notifications` | same address |
| `/app/notifications` | activity tab | notification list | `/app` | same address |
| `/app/messages` | chats tab | thread list and conversation | `/app/notifications` | same address |
| `/app/settings` | profile then "edit profile" | settings panel with back header | `/app/notifications` | same address |
| `/app/settings/profile` | settings row "edit profile" | avatar, display name, username, bio | `/app/notifications` | same address |
| `/app/settings/password` | settings row "change password" | the "not available yet" notice | `/app/notifications` | same address |
| `/app/settings/blocked` | settings row "blocked users" | `NO BLOCKED USERS` | `/app/notifications` | same address |
| `/app/profile` | header avatar, and the mobile "you" tab | own profile, "edit profile" button | `/app/notifications` | same address |
| `/app/u/:userId` | author name on a feed post; a search person result; a notification actor; a follower row | other user's profile with a follow button | `/app/notifications` | same address, id kept |
| `/app/u/:userId/followers` | "followers" stat on a profile | `luvax_dan's Followers` and the rows | `/app/notifications` | same address, id kept |
| `/app/u/:userId/following` | "following" stat on a profile | `luvax_dan is following` and the rows | `/app/notifications` | same address, id kept |
| `/app/p/:postId` | comment count on a feed post; a post search result; a profile grid tile | overlay at z-index 1400 with the post and its comment tree | `/app/notifications` | same address, overlay still present |
| `/app/stories/new` | the "you" story tile in the feed carousel | composer: "tap to pick a photo / photo video text / share to story" | `/app/notifications` | same address |
| `/app/stories/:storyId` | a story tile in the feed carousel | the matching story: `s2` renders "three minutes of real quiet today", author `jo.x` | `/app/notifications` | same address, id kept |
| `/app/onboarding` | no control links to it, as before this phase | onboarding, no shell, as before | `/app/notifications` | same address |
| `/app/u/not-a-uuid` | typed | "we couldn't load this profile", inside the shell | `/app/notifications` | same address |
| `/app/p/not-a-real-post` | typed | "post not found", inside the shell | `/app/notifications` | same address |
| `/app/search` | reserved, no screen | "this page doesn't exist" with "back to feed", inside the shell | `/app/notifications` | same address |
| `/app/does-not-exist` | typed | "this page doesn't exist" with "back to feed", inside the shell | `/app/notifications` | same address |

Every row returned `stayedInApp=true` on the back check: no address left the application.

## Named navigation checks

Recorded verbatim from the driven session.

```
home tab        -> /app
explore tab     -> /app/explore
chats tab       -> /app/messages
post tab        -> /app/compose
activity tab    -> /app/notifications
header avatar   -> /app/profile

settings row "edit profile"     -> /app/settings/profile
settings row "change password"  -> /app/settings/password
settings row "blocked users"    -> /app/settings/blocked

own profile "followers" stat    -> /app/u/cfc010ee-.../followers   (heading "Your Followers")
follower row avatar             -> /app/u/f88345ed-...             (Luvax Dan, @luvax_dan)
their "followers" stat          -> /app/u/f88345ed-.../followers   (heading "luvax_dan's Followers")

feed post comment count         -> /app/p/32d5030a-...
feed post author name           -> /app/u/1f122b6b-...
feed story tile "jo.x"          -> /app/stories/s2
feed story tile "you"           -> /app/stories/new
notification actor              -> /app/u/1f122b6b-...
search person result            -> /app/u/1f122b6b-...
search post result              -> /app/p/50160b10-...
messages "view profile"         -> /app/u/priya
```

## Forward navigation after back

```
entry:        /app
opened post:  /app/p/32d5030a-4181-4059-be06-b4b1dc325f2a
back ->       /app
forward ->    /app/p/32d5030a-4181-4059-be06-b4b1dc325f2a
```

## Leaving the application

Back leaves the application only from the entry screen.
From `/app` with no prior in-app history, back exits to whatever preceded the application, which is the browser's own history.
Every other address in the table above returns to the previous screen.

## Overlay backdrops

The screen behind an overlay is the screen it was opened from, carried in history state:

```
post opened from the feed    -> backdrop /app
post opened from explore     -> backdrop /app/explore
```

Opened cold, an overlay has no recorded backdrop and falls back to the feed, matching what the screen-state implementation did after every reload.

## Console

No React render error appeared on any address.

Three addresses log browser network errors, all of them expected and none of them a render failure:

- `/app/u/not-a-uuid` logs `400 (Bad Request)` from `GET /users/not-a-uuid` plus the development-only `[QueryClient]` line. The screen renders its error state.
- `/app/p/not-a-real-post` logs the same for the post and comment queries. The screen renders "post not found".
- `/app/u/priya`, reached from messages, logs the same. The screen renders its error state.

The `[QueryClient]` line comes from the existing development-only handler in `main.jsx`.

## Storage and credentials

Inspected after a hard refresh on a post address:

```json
{
  "url": "/app/p/32d5030a-4181-4059-be06-b4b1dc325f2a",
  "overlayPresent": true,
  "localStorageKeys": ["luvax-auth-session"],
  "sessionStorageKeys": ["react-router-scroll-positions"],
  "anyTokenInStorage": false,
  "jsReadableCookie": "(none)"
}
```

`lx_screen` and `lx_params` are absent, and no code reads or writes them.
A case-insensitive search for "token" across the full contents of both stores finds nothing.

## No visual change

Feed, settings, and profile captured at 1440x900, first on the current branch, then with `src/` checked out at the commit before the routing work, then compared:

```
feed       2cb23c18f31fb9cc  2cb23c18f31fb9cc  IDENTICAL
settings   2d88f2a0116a0168  2d88f2a0116a0168  IDENTICAL
profile    d5df1629345a1864  d5df1629345a1864  IDENTICAL
```

SHA-256 prefixes of the PNGs, byte-for-byte identical.
The pre-routing captures for settings and profile were reached by seeding `lx_screen`, which is how that build selected a screen.

The one behavioural difference that can be seen is the screen drawn behind an overlay when a post is opened from another person's profile, or from a filtered explore.
It is described and justified in `route-table.md`.

## Build

```
$ npm run build
vite v8.0.13 building client environment for production...
✓ 285 modules transformed.
✓ built in 2.04s
```

The pre-existing chunk-size advisory is unchanged and unrelated.
