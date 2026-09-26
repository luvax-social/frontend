# Changes Applied

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

One entry per change: what was wrong, the evidence, what changed, the file touched.

---

## 1. Paginated lists read the cursor block at the wrong level

**Wrong**: `useSocial.js` (followers, following) and `useNotifications.js` read `lastPage?.data?.hasNextPage` and `lastPage.data.endCursor`.

**Evidence**: `CursorPageResponse` nests both under `pageInfo`, confirmed in the class and in a real response.

```json
{ "content": [ ... ], "pageInfo": { "hasNextPage": true, "hasPreviousPage": false, "startCursor": "ZmVlZDox...", "endCursor": "ZmVlZDox..." } }
```

`data.hasNextPage` is undefined, so `getNextPageParam` always returned undefined and TanStack Query concluded there were no further pages.
Followers, following, and notifications silently stopped after the first page.

The class is easy to misread: its `of()` factory takes the five values as flat parameters and only then nests them, so reading the constructor signature suggests a flat envelope.

**Changed**: added `extractPageInfo` and `getNextCursor` to `helpers.js` and pointed all three hooks at `getNextCursor`.
`usePosts.js` already read `pageInfo` correctly in four places; those were consolidated onto the same helper so there is now one implementation rather than five.

**Files**: `src/utils/helpers.js`, `src/features/luvax/hooks/useSocial.js`, `src/features/luvax/hooks/useNotifications.js`, `src/features/luvax/hooks/usePosts.js`

---

## 2. Posts rendered the author object where a string was expected

**Wrong**: `PostCard`, `ExploreScreen`, and `PostDetailScreen` all evaluated `post.username || post.author`.

**Evidence**: `PostResponse` and `FeedPostResponse` embed the author as a `UserSummaryResponse`. There is no top-level `username`.

```json
"author": { "id": "9810eec3-...", "username": "luvax_dan", "displayName": "Luvax Dan", "avatarUrl": null, "isVerified": false }
```

`post.username` is undefined, so the expression yields the object, and two separate paths then failed fatally.

Observed in the browser with seeded data, on the feed:

```
TypeError: seedKey?.startsWith is not a function
    at resolveSeedDisplayDate (useRelativeTime.js:4:28)
    at PostCard (PostCard.jsx:98:18)
```

and, on explore:

```
Objects are not valid as a React child (found: object with keys {id, username, displayName, avatarUrl, isVerified})
```

Both replaced the entire screen with the error boundary.

**Changed**: added `getUserSummary` and `getDisplayName` accessors and used them in all three components.
The fallback chains were removed rather than extended: a chain is what produced this, because it turns a wrong path into a plausible-looking wrong value instead of an obvious failure.

**Files**: `src/utils/helpers.js`, `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/ExploreScreen.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`

---

## 3. Post actions received an undefined user id

**Wrong**: `post.userId || post.authorId`, in `PostCard` for `isOwner`, the follow toggle, the block action, and the view-profile navigation, and in `ExploreScreen` for the author link.

**Evidence**: neither field exists on any post response. The id is `author.id`.

The consequences were quieter than the crash and would have outlived it.
`isOwner` compared the current user against undefined, so the owner-only edit and delete menu items never appeared on the owner's own posts.
Follow, block, and view-profile all received undefined.

**Changed**: all read `author.id` through `getUserSummary`.

**Files**: `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/ExploreScreen.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`

---

## 4. Server like and save state was ignored

**Wrong**: `useState(false)` for both `liked` and `saved` in `PostCard`.

**Evidence**: `PostResponse` returns `isLiked` and `isSaved`, and the feed showed `"isLiked": false, "isSaved": false` alongside real values on other posts.

Neither field was read anywhere, so a post the user had already liked always rendered an empty heart until they clicked it, at which point the count incremented from an already-incremented server value.

**Changed**: initialised from `post.isLiked ?? false` and `post.isSaved ?? false`.

**File**: `src/features/luvax/components/PostCard.jsx`

---

## 5. A fabricated comment count

**Wrong**:

```jsx
{post.commentCount || Math.floor((post.likes || 0) / 8) + 2}
```

**Evidence**: `commentCount` is returned and authoritative. `post.likes` does not exist on any response.

Because `0` is falsy, a post with no comments fell through to the right-hand branch and displayed `2`.
The interface invented a number and showed it as fact.

**Changed**: `{post.commentCount ?? 0}`.

**File**: `src/features/luvax/components/PostCard.jsx`

---

## 6. Prototype field names left in fallback chains

**Wrong**: `post.text`, `post.likes`, `post.time`, and `post.idx` appeared throughout `PostCard`, `ExploreScreen`, and `PostDetailScreen`.

**Evidence**: these are the field names of the static mock data in `features/luvax/constants/data.js`. No API response carries any of them.

Each was the right-hand side of a `||`, so each was dead in every real render and served only to make the wrong path look deliberate.

**Changed**: removed. `post.caption ?? ''` replaces `post.caption || post.text`; `post.likeCount ?? 0` replaces `post.likeCount || post.likes || 0`; `post.createdAt` replaces `post.createdAt || post.time`; `idx` was dropped from `LxAvatar` calls where it always evaluated to `0`.

**Files**: `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/ExploreScreen.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`

---

## 7. Comments fetched a profile per row with an undefined id

**Wrong**:

```js
const { data: authorProfileData } = useUserProfile(comment.userId);
const authorName = authorProfile?.username || authorProfile?.displayName || 'unknown';
```

**Evidence**: `CommentResponse` has no `userId`. The author is embedded as a `UserSummaryResponse`, so no fetch is needed.

Every comment rendered "unknown" while issuing a wasted request per row.

**Changed**: reads the embedded author. The `useUserProfile` import was removed from the file.

**File**: `src/features/luvax/components/PostDetailScreen.jsx`

---

## 8. Notifications fetched a profile per row with an undefined id

**Wrong**: `useUserProfile(n.actorId)`, with the same shape as the comment case.

**Evidence**: `NotificationResponse` has no `actorId`; `actor` is embedded.

Every notification rendered "Someone", and the accept and decline handlers for follow requests received undefined.

**Changed**: reads `getUserSummary(n, 'actor')`.

**File**: `src/features/luvax/components/NotificationsScreen.jsx`

---

## 9. Notification text tested for enum values that do not exist

**Wrong**:

```js
const text = isFollow ? 'started following you' : n.type === 'like' ? 'liked your post' : 'interacted with you';
```

**Evidence**: the `notification_type` enum members are `like_post`, `like_comment`, `comment_post`, `reply_comment`, `follow`, `follow_request`, `mention_post`, `mention_comment`, `story_view`, `message`.
Neither `like` nor `comment` is a member. A real response carried `"type": "like_comment"`.

Every non-follow notification read "interacted with you".

**Changed**: a `NOTIFICATION_TEXT` map keyed on the ten real enum values, with the generic wording retained as the fallback for a type added server-side before the frontend knows about it.

**File**: `src/features/luvax/components/NotificationsScreen.jsx`

---

## 10. The unread badge read the wrong field

**Wrong**: `unreadResponse?.data?.count || 0`, in three places in `shell.jsx`.

**Evidence**: `UnreadCountResponse` declares `unreadCount`.

```json
{"data":{"unreadCount":8}}
```

The account had eight unread notifications and the badge never appeared.

**Changed**: `unreadResponse?.data?.unreadCount ?? 0`.

**File**: `src/features/luvax/components/shell.jsx`

---

## 11. Follower and following rows were read flat

**Wrong**: five call sites treated a `UserListItemResponse` as if it were the user.

**Evidence**:

```json
{ "user": { "id": "9810eec3-...", "username": "luvax_dan", "displayName": "Luvax Dan", ... },
  "viewerState": { "isFollowing": true, "isFollowRequested": false, "isFollowedBy": true, "isBlocking": false } }
```

Two sites rendered rows, so every follower and following row showed "Unknown", "@unknown", no avatar, and a dead click target.

Three sites tested list membership to decide whether a follow button reads "Follow" or "Unfollow":

```js
list.some((user) => user.id === targetUserId)
```

`item.id` is undefined on every row, so the test always returned false and the button always offered "Follow", including for accounts the viewer already follows.

**Changed**: all five read `getUserSummary(item, 'user')`.

**Files**: `src/features/luvax/components/FollowersScreen.jsx`, `src/features/luvax/components/FollowingScreen.jsx`, `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`, `src/features/luvax/components/ProfileScreen.jsx`

---

## 12. The server's follow state on list rows was ignored

**Wrong**: `UserCard` takes `initiallyFollowing` and defaults it to `false`. Neither list screen passed it.

**Evidence**: `viewerState.isFollowing` is returned on every row and was read nowhere.

Observed in the browser: both of ava's followers, whom she follows, showed a "follow" button.

**Changed**: both screens pass `initiallyFollowing={item.viewerState?.isFollowing ?? false}`.

Verified afterwards: both rows read "following".

**Files**: `src/features/luvax/components/FollowersScreen.jsx`, `src/features/luvax/components/FollowingScreen.jsx`

---

## 13. Follow requests were read from the wrong field and the wrong container

**Wrong**: `req.requester`, `req.requesterId`, and `requestsResponse?.data || requestsResponse || []`.

**Evidence**: `FollowRequestResponse` names the field `follower`, and the endpoint is cursor-paginated, so `data` is `{content, pageInfo}` rather than an array.

`user` was always `{}`, so rows rendered blank and accept and decline sent undefined.
`requests.length` was undefined on the envelope object, so the badge never showed and the tab always read "No pending requests" even with a request outstanding.

**Changed**: `getUserSummary(req, 'follower')` for the user, `extractPageContent(requestsResponse)` for the list.

**Files**: `src/features/luvax/components/NotificationsScreen.jsx`, `src/features/luvax/components/shell.jsx`

---

## 14. Hidden profile counts rendered as zero

**Wrong**:

```jsx
['posts', user?.postCount || user?.postsCount || 0]
```

**Evidence**: `PublicUserProfileResponse` types the three counts as `Integer`, not `int`, and returns null when the viewer may not see them.

```json
"isPrivate": true, "followerCount": null, "followingCount": null, "postCount": null
```

`|| 0` turned a hidden count into `0`.
That is a defined value but a false statement: it told the viewer the account has no posts and no followers, rather than that the numbers are not visible to them.

`user.postsCount` and `user.followersCount` exist on no response type.

**Changed**: added `formatCount`, which renders a number unchanged and anything else as an en dash.
The same helper serves `UserProfileResponse`, where the counts are primitive `int` and never null, so the one component handles both types.

Verified in the browser against a private account the viewer does not follow: all three render `–`.

**File**: `src/features/luvax/components/ProfileScreen.jsx`

---

## 15. Videos rendered as images

**Wrong**: `media.mediaType === 'VIDEO'` in three components.

**Evidence**: the enum serialises lower case, matching the PostgreSQL enum.

```json
"mediaType": "image"
```

`postType` and `status` are serialised the same way, so this is the backend's consistent convention rather than a quirk of one field.
The comparison never matched, so every video rendered through the `<img>` branch.

**Changed**: added `isVideoMedia`, comparing against `'video'`.

Checked the request direction separately: `POST /media/upload` accepts both `"IMAGE"` and `"image"`, so the uploader's uppercase value is fine and was left alone.

**Files**: `src/utils/helpers.js`, `src/features/luvax/components/PostCard.jsx`, `src/features/luvax/components/ExploreScreen.jsx`, `src/features/luvax/components/PostDetailScreen.jsx`

---

## 16. A dead fallback on the shared user card

**Wrong**: `user.bio || user.headline || \`@${user.username}\``.

**Evidence**: `headline` exists on no response type.

`bio` is a legitimate conditional: `PublicUserProfileResponse` carries it and `UserSummaryResponse` does not, and `UserCard` renders both.
Falling through to the handle for a summary is correct. `headline` was simply dead.

**Changed**: removed the `headline` branch.

**File**: `src/features/luvax/components/UserCard.jsx`

---

## 17. A development guard against recurrence

**Added**: `warnOnShapeDrift`, called from `getUserSummary` and `getNextCursor`.

Section 4.5 asked whether a Zod schema check at the service boundary is proportionate.
It was judged not to be, for a reason worth stating:

**a response schema would not have caught a single one of the sixteen defects above.**

Every response was exactly what the backend promised.
It was the frontend's reads that were wrong.
A schema validating `PostResponse` against its true shape would have passed while `post.username` still returned undefined.

Schemas would also duplicate every backend DTO in the frontend, creating a second source of truth to maintain in lockstep, against the project rule that the backend is the single source of truth for data shapes.

What does catch this class is centralising the path knowledge, which the accessors now do, and making the moment a path fails to resolve loud rather than silent.
So the guard lives in the accessors: when a response object is non-empty but carries no summary at the expected key, or a page carries content but no `pageInfo`, it logs the key it wanted and the keys actually present.

It is gated on `import.meta.env.DEV`, never throws, and never rejects a response.
Verified absent from the production bundle: `grep -c 'response shape' dist/assets/*.js` returns `0`.

**File**: `src/utils/helpers.js`

---

## 18. Line-ending configuration

Covered in full in `lint-baseline.md`.

Added `.gitattributes` declaring `* text=auto eol=lf`, with `docs/design/Luvax.html` and binary asset types excluded.
Changed `.prettierrc` `endOfLine` from `lf` to `auto`.
Renormalised the working tree in a separate commit.

Verified the design export is byte-identical to its committed state and still extracts correctly, and that the renormalisation diff is line-endings only.

**Files**: `.gitattributes`, `.prettierrc`

---

## Not changed, deliberately

`AuthSessionBootstrap` and `ProtectedRoute` were investigated in depth and found already correct.
`isBootstrapping` initialises to `true`, so the guard shows a loader from the first render rather than flashing the login screen, and it requires a live access token rather than trusting the rehydrated `isAuthenticated` flag.

No session change was possible.
The reasoning and the exact backend capability required are in `session-and-token-flow.md`.
