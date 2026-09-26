# Verification Evidence

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

Browser-level before and after for every fix with a user-reachable path, plus the `curl` evidence behind each contract claim.

Environment: backend `450212e` on `develop` at `http://localhost:8080`, Vite dev server at `http://localhost:5173`, PostgreSQL, Redis, RabbitMQ, and Elasticsearch from `docker-compose`.

Data: the four seeded accounts from `tools/seed/seed.py`, logged in as `luvax_ava`.
Seeded data mattered here: the previous phase saw no crash because the feed was empty.
The defect only appears once a post exists.

---

## 1. The feed and explore screens

### Before

Logged in as `luvax_ava`, who has three posts from `luvax_ben` and one from `luvax_dan` in her feed.

The application rendered the error boundary in place of the entire screen:

```
heading:   Something went wrong
paragraph: An unexpected error occurred. Please try again or return to the home page.
detail:    seedKey?.startsWith is not a function
```

Console, six errors, the root one being:

```
[RouterErrorPage] TypeError: seedKey?.startsWith is not a function
    at resolveSeedDisplayDate (src/features/luvax/hooks/useRelativeTime.js:4:28)
    at formatRelativeTime (src/features/luvax/hooks/useRelativeTime.js:20:24)
    at useRelativeTime (src/features/luvax/hooks/useRelativeTime.js:43:9)
    at PostCard (src/features/luvax/components/PostCard.jsx:98:18)
...
The above error occurred in the <PostCard> component.
```

On explore, the same root cause surfaced through the other fatal path:

```
Objects are not valid as a React child (found: object with keys {id, username, displayName, avatarUrl, isVerified}).
```

Neither the feed nor explore was usable.

### After

Feed renders. Four posts, real authors, real captions, real counts:

```
article: Luvax Dan · 15h
         "[luvax-seed] this disappears from the feed once dan is blocked #recon"
         #recon    0 likes  0 comments
article: Luvax Ben · 15h
         "[luvax-seed] grain on film is the texture of memory #film"
         #film     0 likes  0 comments
article: Luvax Ben · 15h   (with image)
         "[luvax-seed] morning, window, coffee #photography"
         #photography  1 like  0 comments
article: Luvax Ben · 15h
         "[luvax-seed] light is the medium, not the message #observation"
         #observation  2 likes  13 comments
```

Note the last row: 2 likes and 13 comments, both read from `likeCount` and `commentCount`.
The previous code would have shown a fabricated `2` for the comment count on any post whose real count was zero.

Explore renders:

```
trending today
  Target User
  a post from target user
```

Console after the fix, across feed and explore:

```
Total messages: 3 (Errors: 0, Warnings: 0)
```

Zero errors. DoD 1 and DoD 4 for these two screens.

---

## 2. Post detail and comments

### Before

Unreachable: the feed it is opened from was down.
The comment rows would additionally have rendered "unknown" for every author, because `useUserProfile(comment.userId)` was called with an undefined id.

### After

Opened the post with 13 comments. Rendered:

```
Luvax Ben
15h ago
[luvax-seed] light is the medium, not the message #observation
#observation

Luvax Dan    an older comment everyone liked      15h   2 likes   Reply
Luvax Ava    a top-level comment                  15h   1 likes   Reply   View replies (1)
Luvax Dan    a newer comment nobody liked         15h   0 likes   Reply
```

Real author names on every comment, from the embedded summary, with no per-row profile request.

A post with no comments renders its empty state:

```
Target User
1h ago
a post from target user
no comments yet.
```

Console: zero errors.

---

## 3. Notifications

### Before

Every row would have read "Someone interacted with you": the actor came from `useUserProfile(n.actorId)` with an undefined id, and the type test compared against `'like'` and `'comment'`, which are not members of the enum.

The unread badge never appeared despite eight unread notifications, because the count was read as `data.count` rather than `data.unreadCount`.

### After

```
Luvax Ben  liked your comment        15h
Luvax Ben  replied to your comment   15h
Luvax Ben  replied to your comment   15h
Luvax Ben  replied to your comment   15h
Luvax Ben  replied to your comment   15h
Luvax Ben  replied to your comment   15h
Luvax Dan  started following you     15h
Luvax Ben  started following you     15h
```

Real actor names, and text specific to each notification type rather than one generic string.

### curl backing

```
GET /notifications
{"actor":{"id":"f34d7750-...","username":"luvax_ben","displayName":"Luvax Ben",...},"type":"like_comment",...}

GET /notifications/unread-count
{"data":{"unreadCount":8}}
```

---

## 4. Follower and following lists

### Before

Rows are `UserListItemResponse`, nesting the user under `user`.
`UserCard` read the row as the user, so `user.displayName`, `user.username`, and `user.avatarUrl` were all undefined, rendering "Unknown" and "@unknown" with a dead click target.

### After

Ava's followers:

```
Your Followers
  Luvax Dan   @luvax_dan   [following]
  Luvax Ben   @luvax_ben   [following]
```

Ava's following:

```
You are following
  Luvax Ben   @luvax_ben   [following]
```

Both the identity and the follow state are correct.

The follow state is a separate fix worth showing on its own, because the first render after the identity fix still showed the wrong button:

```
before:  Luvax Dan   @luvax_dan   [follow]      <- viewerState.isFollowing not read
after:   Luvax Dan   @luvax_dan   [following]   <- read from the server
```

Ava follows both, so "follow" was wrong.

### curl backing

```
GET /social/users/{avaId}/followers
{"user":{"id":"9810eec3-...","username":"luvax_dan","displayName":"Luvax Dan","avatarUrl":null,"isVerified":false},
 "viewerState":{"isFollowing":true,"isFollowRequested":false,"isFollowedBy":true,"isBlocking":false}}
```

---

## 5. A profile whose counts are hidden

DoD 5 requires a defined state rather than blank or null, verified against a private account.

Reaching one in the interface needed care: a private account hides the very content that would link to its profile.
Notification actors stay clickable regardless of privacy, which gives a reliable path.

Setup, through the API:

```
PATCH /users/me  {"isPrivate":true}          as luvax_ben     -> 200
DELETE /social/follow/{benId}                as luvax_ava     -> 204
GET /users/{benId}                           as luvax_ava
  isPrivate: True | followerCount: None | followingCount: None | postCount: None
```

Then in the browser, from ava's notifications, clicking Luvax Ben:

```
[follow]
Luvax Ben
@luvax_ben
  –  posts
  –  following
  –  followers
[posts] [photos] [liked]
we couldn't load these posts. check your connection and try again.
```

All three counts render an en dash.

Before this change they rendered `0`, `0`, `0`, which is defined but false: it asserted the account has no posts and no followers rather than that the numbers are not visible.

The seed state was restored afterwards:

```
PATCH /users/me {"isPrivate":false}  as luvax_ben
POST /social/follow/{benId}          as luvax_ava
GET /users/{benId} as ava -> isPrivate: False counts: 1 1 3
```

---

## 6. Pagination

No before and after screenshot exists for this one, and the honest reason is that the seeded data does not fill a second page on any of the three affected lists.
The defect is therefore demonstrated from the contract rather than from a scroll.

```
GET /posts/feed?limit=1
"pageInfo": {"hasNextPage": true, ..., "endCursor": "ZmVlZDoxNzg2MDM0MDU5NzUzOTUzOjliNmZkMmZjLTlmOTYtNGQyNi1hZWMxLTVlNjc5MDA1NjE2Ng"}
```

`hasNextPage` is `true` here and lives under `pageInfo`.
Read as `data.hasNextPage` it is `undefined`, so `getNextPageParam` returns `undefined` and TanStack Query stops.

Followers, following, and notifications each read it at the wrong level and would have stopped after their first page once any of those lists exceeded its page size.
All three now share the same helper as the four post lists, which already read it correctly.

---

## 7. Videos

Also demonstrated from the contract: the seed contains no video asset.

```
GET /posts/feed  ->  "mediaType": "image"
```

The enum serialises lower case, as do `postType` (`"text"`) and `status` (`"published"`).
`=== 'VIDEO'` cannot match any value the server sends, so every video rendered through the `<img>` branch.

Checked the request direction separately, since the uploader sends uppercase:

```
POST /media/upload {"mediaType":"IMAGE",...}  -> 200, storageKey + uploadUrl returned
POST /media/upload {"mediaType":"image",...}  -> 200, storageKey + uploadUrl returned
```

Both accepted, so the uploader needed no change.

---

## 8. Session and tokens

### What the browser holds after login

```json
{
  "localStorage": { "luvax-auth-session": "{\"state\":{\"user\":{...},\"isAuthenticated\":true},\"version\":0}" },
  "sessionStorage": { "lx_params": "{}", "lx_screen": "\"notifications\"" },
  "cookies": "(none readable by JS)",
  "containsAccessToken": false,
  "containsRefreshToken": false
}
```

No token in either store. DoD 8.

### What a hard refresh does

Navigated to `/app` while logged in:

```
Page URL after load: http://localhost:5173/
API requests issued: none
Persisted state:     { "user": null, "isAuthenticated": false }
```

The user is returned to login, and the persisted flag is cleared rather than left disagreeing with the absent token. No half-authenticated state. DoD 7.

Zero network calls, because there was no refresh token to attempt a refresh with.

### Why

```
$ curl -s -D - -o /dev/null -X POST .../auth/login -d '{"identifier":"luvax_ava","password":"ReconPass123!"}'
HTTP/1.1 200
```

No `Set-Cookie` header. The refresh token is returned in the response body only.

Rotation and reuse detection both work server-side:

```
login          -> refreshToken lwH9LyAxFYTW...
POST /refresh  -> refreshToken 654619WxC0_R...
POST /refresh with the consumed token
  401 {"code":"AUTH_REFRESH_TOKEN_INVALID","message":"Invalid or revoked refresh token"}
```

Full analysis and the backend capability required are in `session-and-token-flow.md`.
DoD 6 is met by documenting precisely what is missing rather than by making refresh survive.

---

## 9. The development shape guard

Verified it does not fire on correct responses: across feed, explore, post detail, comments, notifications, profile, followers, and following, the console showed zero errors.

Verified it is absent from production:

```
$ npm run build
✓ built in 572ms
$ grep -c 'response shape' dist/assets/*.js
0
```

---

## 10. Lint

```
before : 9863 problems  (9812 line-ending, 51 other)
after  : 1045 problems  (0 line-ending, 1045 other)
```

The `prettier/prettier` count rose from 0 to 994 because those problems were previously unreportable: each affected line was already spending its one error slot on `Delete ␍`.
The genuine non-formatting count is unchanged at 51.

Full breakdown by rule and by file in `lint-baseline.md`.

---

## 11. Build

```
$ npm run build
dist/index.html                   0.64 kB │ gzip:   0.37 kB
dist/assets/index-*.css          50.71 kB │ gzip:  10.32 kB
dist/assets/index-B3LDZXxV.js   639.81 kB │ gzip: 187.09 kB
✓ built in 572ms
```

---

## 12. Design export integrity

The line-ending work risked corrupting the committed design reference, so it was checked explicitly.

```
$ git diff HEAD --stat -- docs/design/Luvax.html
(no output)

manifest entries: 29
  ed9a0c12... 176988 B OK
  9bffeb59...  30633 B OK
  3b513cf1...  44507 B OK
```

Byte-identical to its committed state, and the three chunk sizes match those recorded during reconnaissance.

---

## 13. Backend untouched

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean

$ git log --oneline -1
450212e Merge pull request #142 from zentech-graduation/fix/common/api-contract-and-security-hardening
```

---

## A note on test-induced state changes

Two seed mutations were made during verification and both were reversed.

Ben was made private and unfollowed to produce a profile with hidden counts, then restored to public and re-followed.

Ava's follow of Dan was dropped by a stray click on a follow button during a snapshot, and restored:

```
$ SELECT u.username, f.status FROM follows f JOIN users u ON u.id=f.following_id WHERE f.follower_id='{avaId}';
luvax_ben|accepted
luvax_cleo|pending
luvax_dan|accepted
```

This matches the graph the seed script creates.
